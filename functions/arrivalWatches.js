// Notify on Arrival — a commuter's bell on a bus in the NEX app's Live Map.
//
// An ARRIVAL WATCH (Firestore arrivalWatches/{uid}_{busId}) is a temporary,
// server-side note: "this commuter is waiting for this bus at this boarding
// point". Only the boarding point is stored — never the commuter's live
// location — and only while the watch is active.
//
//   createArrivalWatch (callable) — the only way a watch is created: checks
//     the commuter, the bus and the boarding point, works out how far along
//     the route the boarding point is (never trusted from the client), and
//     enforces one watch per bus and MAX_ACTIVE_WATCHES per commuter.
//   onBusLocationWritten (RTDB trigger on activeBuses/{busId}) — on each live
//     update of a WATCHED bus: "approaching" (≤ APPROACHING_METERS along the
//     route), "arriving" (≤ ARRIVING_METERS, completes the watch), "passed",
//     and ends the watches when the trip ends or the bus goes out of service.
//     Each stage is claimed in a transaction before it is sent, so it goes
//     out at most once. A bus nobody watches costs no Firestore read.
//
// When a watch ends, its boarding point (and its along-route distance) is
// removed right away; the doc itself is deleted by cleanupArrivalWatches.
//
// Watch doc: { userId, line, busId, routeId, routeName, boardingPoint:
// { lat, lng }, boardingLabel, boardingAlong, notifiedStages, status:
// 'active' | 'completed' | 'cancelled' | 'expired', endReason, createdAt,
// expiresAt, endedAt }. firestore.rules: the owner (and operators of the
// line) can read; the owner can only cancel; everything else is server-only.

import { getDatabase } from "firebase-admin/database";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onValueWritten } from "firebase-functions/v2/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
  BOARDING_MAX_OFFSET_METERS,
  BUS_ALONG_MEMORY_MS,
  BUS_STALE_MS,
  CLEANUP_GRACE_MS,
  MAX_ACTIVE_WATCHES,
  PASSED_BUFFER_METERS,
  ROUTE_CACHE_MS,
  WATCH_TTL_MS,
  WATCHED_CACHE_MS,
} from "./arrivalConstants.js";
import {
  assessBus,
  buildRouteProfile,
  describeNotification,
  evaluateWatch,
  finiteOrNull,
  isValidCoordinates,
  projectOntoRoute,
  routeSpeedKmh,
} from "./arrivalLogic.js";
import { collectTokens, sendToEntries } from "./push.js";

// Set explicitly: this module is evaluated before index.js calls
// setGlobalOptions, so the global region would not apply here.
const REGION = "asia-southeast1";
// An RTDB trigger must run in its database's region — the default instance
// (nex-71ab9-default-rtdb.firebaseio.com) is in us-central1.
const DATABASE_REGION = "us-central1";

// Android: the app's arrival channel (high importance, vibration, public on
// the lock screen — created by the app; see its pushServices.js).
const ARRIVAL_CHANNEL_ID = "nex-bus-arrival";
const ARRIVAL_ALERT_TYPE = "bus_arrival";

export const WATCHES = "arrivalWatches";
const USERS = "users";
const ROUTES = "routes";

// RTDB keys can't contain . $ # [ ] /
const BUS_ID_PATTERN = /^[^.$#[\]/]{1,40}$/;
const ROUTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_LABEL_LENGTH = 80;

export const watchIdFor = (uid, busId) => `${uid}_${busId}`;

// ─── ROUTES (cached per instance) ───────────────────────────────
// { id, name, line, profile, speedKmh } or null when the route doesn't exist
// or has no usable polyline.
const routeCache = new Map();

export async function loadRoute(routeId) {
  const cached = routeCache.get(routeId);
  if (cached && Date.now() - cached.at < ROUTE_CACHE_MS) return cached.route;

  const snapshot = await getFirestore().collection(ROUTES).doc(routeId).get();
  const data = snapshot.exists ? snapshot.data() : null;
  const profile = data ? buildRouteProfile(data.routeCoordinates) : null;
  const route = profile
    ? {
        id: routeId,
        name: typeof data.name === "string" ? data.name : null,
        line: typeof data.line === "string" ? data.line : null,
        profile,
        speedKmh: routeSpeedKmh(data),
      }
    : null;
  routeCache.set(routeId, { at: Date.now(), route });
  return route;
}

// ─── CREATE ─────────────────────────────────────────────────────
function readInput(data) {
  const busId = data?.busId;
  if (typeof busId !== "string" || !BUS_ID_PATTERN.test(busId)) {
    throw new HttpsError("invalid-argument", "Missing or invalid bus number.");
  }
  const routeId = data?.routeId;
  if (typeof routeId !== "string" || !ROUTE_ID_PATTERN.test(routeId)) {
    throw new HttpsError("invalid-argument", "Missing or invalid route.");
  }
  const lat = data?.boardingPoint?.lat;
  const lng = data?.boardingPoint?.lng;
  if (!isValidCoordinates(lat, lng)) {
    throw new HttpsError("invalid-argument", "Missing or invalid boarding point.");
  }
  const label =
    typeof data?.boardingLabel === "string" && data.boardingLabel.trim()
      ? data.boardingLabel.trim().slice(0, MAX_LABEL_LENGTH)
      : null;
  return { busId, routeId, boardingPoint: { lat, lng }, boardingLabel: label };
}

export const createArrivalWatch = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  // conductors and operators carry a role claim; this is a commuter feature
  if (request.auth.token.role) {
    throw new HttpsError("permission-denied", "Notify on Arrival is for commuter accounts.");
  }
  const uid = request.auth.uid;
  const { busId, routeId, boardingPoint, boardingLabel } = readInput(request.data);

  const db = getFirestore();
  const profileSnap = await db.collection(USERS).doc(uid).get();
  if (profileSnap.get("role") !== "commuter") {
    throw new HttpsError("permission-denied", "Notify on Arrival is for commuter accounts.");
  }

  // 1. the boarding point, measured along the route — server-side
  const route = await loadRoute(routeId);
  if (!route) {
    throw new HttpsError("not-found", "This route isn't available for notifications.");
  }
  const boarding = projectOntoRoute(boardingPoint, route.profile);
  if (!boarding || boarding.offset > BOARDING_MAX_OFFSET_METERS) {
    throw new HttpsError(
      "invalid-argument",
      "Your boarding point is too far from this route. Choose a stop on the route instead.",
    );
  }

  // 2. the bus: live, on this route, not out of service, not already past
  const rtdb = getDatabase();
  const [liveSnap, inoperableSnap] = await Promise.all([
    rtdb.ref(`activeBuses/${busId}`).get(),
    rtdb.ref(`inoperableBuses/${busId}`).get(),
  ]);
  const live = liveSnap.val();
  if (inoperableSnap.exists() || live?.status === "inoperable") {
    throw new HttpsError("failed-precondition", `Bus ${busId} has been taken out of service.`);
  }
  if (!live || live.status !== "active") {
    throw new HttpsError("failed-precondition", `Bus ${busId} isn't on a trip right now.`);
  }
  const now = Date.now();
  const lastUpdated = finiteOrNull(live.lastUpdated);
  if (lastUpdated === null || now - lastUpdated > BUS_STALE_MS) {
    throw new HttpsError(
      "failed-precondition",
      `Bus ${busId} hasn't shared its location recently. Try again when it's back online.`,
    );
  }
  if (live.routeId !== routeId) {
    throw new HttpsError("failed-precondition", `Bus ${busId} is running a different route.`);
  }
  const bus = projectOntoRoute(live, route.profile);
  if (bus && bus.along > boarding.along + PASSED_BUFFER_METERS) {
    throw new HttpsError("failed-precondition", `Bus ${busId} has already passed your boarding point.`);
  }

  // 3. limits + write, in one transaction (two taps can't both slip past)
  const watchRef = db.collection(WATCHES).doc(watchIdFor(uid, busId));
  const expiresAtMs = now + WATCH_TTL_MS;
  await db.runTransaction(async (tx) => {
    const active = await tx.get(
      db.collection(WATCHES).where("userId", "==", uid).where("status", "==", "active"),
    );
    // an expired watch the cleanup hasn't swept yet doesn't count
    const others = active.docs.filter(
      (doc) => doc.id !== watchRef.id && (doc.get("expiresAt")?.toMillis?.() ?? 0) > now,
    );
    if (others.length >= MAX_ACTIVE_WATCHES) {
      throw new HttpsError(
        "resource-exhausted",
        `You can follow up to ${MAX_ACTIVE_WATCHES} buses at a time. Turn one off first.`,
      );
    }
    tx.set(watchRef, {
      userId: uid,
      line: route.line,
      busId,
      routeId,
      routeName: route.name,
      boardingPoint,
      boardingLabel,
      boardingAlong: boarding.along,
      notifiedStages: [],
      status: "active",
      endReason: null,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      endedAt: null,
    });
  });

  logger.info("Arrival watch created", { uid, busId, routeId });
  return { watchId: watchRef.id, boardingAlong: boarding.along, expiresAt: expiresAtMs };
});

// ─── TRIGGER ────────────────────────────────────────────────────
// Bus ids with at least one active watch, re-read at most every
// WATCHED_CACHE_MS per instance — every activeBuses write (~every 5 s per
// bus) triggers the function, and most buses have no watchers. A new watch
// is picked up within that time.
let watchedCache = { at: 0, ids: new Set(), pending: null };

async function getWatchedBusIds() {
  if (Date.now() - watchedCache.at < WATCHED_CACHE_MS) return watchedCache.ids;
  if (!watchedCache.pending) {
    watchedCache.pending = getFirestore()
      .collection(WATCHES)
      .where("status", "==", "active")
      .select("busId")
      .get()
      .then((snapshot) => {
        const ids = new Set(snapshot.docs.map((doc) => doc.get("busId")));
        watchedCache = { at: Date.now(), ids, pending: null };
        return ids;
      })
      .catch((error) => {
        watchedCache.pending = null;
        throw error;
      });
  }
  return watchedCache.pending;
}

// A bus's last position along its route (per instance): keeps it on its own
// carriageway where the road passes near itself (the U-turn past PITX).
const busAlongMemory = new Map();

function rememberedAlong(busId, routeId, now) {
  const memory = busAlongMemory.get(busId);
  return memory && memory.routeId === routeId && now - memory.at < BUS_ALONG_MEMORY_MS
    ? memory.along
    : undefined;
}

// Ends the watch / records the sent stages — only if it is still active and
// the stage hasn't been sent yet (another invocation may have got there
// first). Returns true if this invocation should send the notification.
async function claimDecision(ref, decision) {
  return getFirestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const watch = snapshot.data();
    if (!watch || watch.status !== "active") return false;
    const sent = Array.isArray(watch.notifiedStages) ? watch.notifiedStages : [];
    if (decision.action === "send" && sent.includes(decision.stage)) return false;

    const update = {};
    const marks = decision.markStages ?? (decision.stage ? [decision.stage] : []);
    if (marks.length > 0) update.notifiedStages = FieldValue.arrayUnion(...marks);
    if (decision.status && decision.status !== "active") {
      update.status = decision.status;
      update.endReason = decision.endReason;
      update.endedAt = FieldValue.serverTimestamp();
      // the boarding point is kept only while the watch is active
      update.boardingPoint = FieldValue.delete();
      update.boardingAlong = FieldValue.delete();
    }
    tx.update(ref, update);
    return true;
  });
}

function buildArrivalMessage({ kind, busId, routeId, routeName, minutes }) {
  const text = describeNotification({ kind, busId, routeName, minutes });
  if (!text) return null;
  return {
    notification: text,
    data: { type: ARRIVAL_ALERT_TYPE, stage: kind, busId, routeId: routeId ?? "" },
    android: {
      priority: "high",
      notification: {
        channelId: ARRIVAL_CHANNEL_ID,
        visibility: "public",
        defaultSound: true,
        defaultVibrateTimings: true,
        // "arriving" replaces "approaching" for the same bus in the shade
        tag: `nex-arrival-${busId}`,
      },
    },
  };
}

// Claims each decision, then sends the notifications that were claimed —
// identical messages (same text) go out in one multicast.
async function applyDecisions(busId, items) {
  const outgoing = new Map(); // message key → { message, uids }
  for (const { ref, watch, decision } of items) {
    let claimed = false;
    try {
      claimed = await claimDecision(ref, decision);
    } catch (error) {
      logger.error("Could not update arrival watch", { watchId: ref.id, error: error.message });
    }
    if (!claimed) continue;

    const kind = decision.notify ?? decision.stage;
    const message = kind
      ? buildArrivalMessage({
          kind,
          busId,
          routeId: watch.routeId,
          routeName: watch.routeName,
          minutes: decision.minutes,
        })
      : null;
    if (!message) continue;
    const key = JSON.stringify(message);
    if (!outgoing.has(key)) outgoing.set(key, { message, uids: [] });
    outgoing.get(key).uids.push(watch.userId);
  }

  for (const { message, uids } of outgoing.values()) {
    try {
      const entries = await collectTokens(uids);
      const sent = entries.length > 0 ? await sendToEntries(entries, message) : 0;
      logger.info("Arrival notification sent", { busId, stage: message.data.stage, users: uids.length, sent });
    } catch (error) {
      logger.error("Arrival notification failed", { busId, stage: message.data.stage, error: error.message });
    }
  }
}

export const onBusLocationWritten = onValueWritten(
  { ref: "/activeBuses/{busId}", region: DATABASE_REGION, maxInstances: 10 },
  async (event) => {
    const { busId } = event.params;

    let watched;
    try {
      watched = await getWatchedBusIds();
    } catch (error) {
      logger.error("Could not read watched buses", { error: error.message });
      return;
    }
    if (!watched.has(busId)) return;

    const snapshot = await getFirestore()
      .collection(WATCHES)
      .where("busId", "==", busId)
      .where("status", "==", "active")
      .get();
    if (snapshot.empty) return;

    const live = event.data.after.val();
    const now = Date.now();
    const items = [];

    // trip ended / taken out of service: every watch on this bus ends
    if (!live || live.status === "inoperable") {
      const reason = live ? "inoperable" : "trip_ended";
      for (const doc of snapshot.docs) {
        items.push({
          ref: doc.ref,
          watch: doc.data(),
          decision: { action: "end", status: "cancelled", endReason: reason, notify: reason },
        });
      }
      busAlongMemory.delete(busId);
      await applyDecisions(busId, items);
      return;
    }
    if (live.status !== "active") return;

    const busByRoute = new Map(); // routeId → assessBus result
    for (const doc of snapshot.docs) {
      const watch = doc.data();

      // the bus started a trip on another route: this watch's trip is over
      if (watch.routeId !== live.routeId) {
        items.push({
          ref: doc.ref,
          watch,
          decision: { action: "end", status: "cancelled", endReason: "trip_ended", notify: "trip_ended" },
        });
        continue;
      }

      const route = await loadRoute(watch.routeId);
      if (!route) continue;
      if (!busByRoute.has(route.id)) {
        const bus = assessBus(live, route.profile, now, rememberedAlong(busId, route.id, now));
        if (bus.usable) busAlongMemory.set(busId, { routeId: route.id, along: bus.along, at: now });
        busByRoute.set(route.id, bus);
      }
      const bus = busByRoute.get(route.id);

      // stale or on a detour: no stage from this update (expiry still applies)
      const decision = evaluateWatch(watch, bus.usable ? bus.along : null, now, route.speedKmh);
      if (decision.action !== "none") items.push({ ref: doc.ref, watch, decision });
    }

    if (items.length > 0) await applyDecisions(busId, items);
  },
);

// ─── CLEANUP ────────────────────────────────────────────────────
// Daily: a watch still "active" past expiresAt (its bus stopped sending, so
// the trigger never ended it) is marked expired and loses its boarding
// point; any watch whose expiresAt is more than CLEANUP_GRACE_MS ago is
// deleted. expiresAt is creation + 2 h, so nothing outlives ~26 h. One
// single-field range query — no composite index.
const CLEANUP_BATCH_SIZE = 400;

export const cleanupArrivalWatches = onSchedule(
  { schedule: "every day 03:00", timeZone: "Asia/Manila", region: REGION },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const snapshot = await db
      .collection(WATCHES)
      .where("expiresAt", "<", Timestamp.fromMillis(now))
      .get();

    const operations = [];
    let expired = 0;
    let deleted = 0;
    for (const doc of snapshot.docs) {
      const expiresAt = doc.get("expiresAt")?.toMillis?.() ?? 0;
      if (expiresAt < now - CLEANUP_GRACE_MS) {
        operations.push((batch) => batch.delete(doc.ref));
        deleted += 1;
      } else if (doc.get("status") === "active") {
        operations.push((batch) =>
          batch.update(doc.ref, {
            status: "expired",
            endReason: "expired",
            endedAt: FieldValue.serverTimestamp(),
            boardingPoint: FieldValue.delete(),
            boardingAlong: FieldValue.delete(),
          }),
        );
        expired += 1;
      }
    }

    for (let start = 0; start < operations.length; start += CLEANUP_BATCH_SIZE) {
      const batch = db.batch();
      operations.slice(start, start + CLEANUP_BATCH_SIZE).forEach((apply) => apply(batch));
      await batch.commit();
    }
    logger.info("cleanupArrivalWatches", { expired, deleted });
  },
);
