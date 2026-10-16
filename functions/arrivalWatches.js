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
//
// Watch doc: { userId, line, busId, routeId, routeName, boardingPoint:
// { lat, lng }, boardingLabel, boardingAlong, notifiedStages, status:
// 'active' | 'completed' | 'cancelled' | 'expired', endReason, createdAt,
// expiresAt, endedAt }. firestore.rules: the owner (and operators of the
// line) can read; the owner can only cancel; everything else is server-only.

import { getDatabase } from "firebase-admin/database";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  BOARDING_MAX_OFFSET_METERS,
  BUS_STALE_MS,
  MAX_ACTIVE_WATCHES,
  PASSED_BUFFER_METERS,
  ROUTE_CACHE_MS,
  WATCH_TTL_MS,
} from "./arrivalConstants.js";
import {
  buildRouteProfile,
  finiteOrNull,
  isValidCoordinates,
  projectOntoRoute,
  routeSpeedKmh,
} from "./arrivalLogic.js";

// Set explicitly: this module is evaluated before index.js calls
// setGlobalOptions, so the global region would not apply here.
const REGION = "asia-southeast1";

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
    const others = active.docs.filter((doc) => doc.id !== watchRef.id);
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
