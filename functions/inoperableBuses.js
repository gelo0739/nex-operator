// "Mark as Inoperable" — a conductor takes a broken-down bus out of service.
//
// The NEX app (Console) calls markBusInoperable after it has flipped its live
// `activeBuses/{busNumber}` entry to status "inoperable" and stopped GPS. This
// function then:
//   1. writes `inoperableBuses/{busNumber}` (RTDB) — the node conductor maps
//      and the operator dashboard subscribe to (red marker). Clients can't
//      write it (database.rules.json), so its contents are trusted;
//   2. pushes an FCM notification to the line's operators and the other
//      conductors on the line. Tokens live in Firestore `push_tokens/{uid}`,
//      which no client can read — that's why this runs here and not on the phone.
//
// The entry is cleared by an operator (clearInoperableBus, "Return to service")
// or expires after 24 h (expireInoperableBuses). While it exists, the RTDB rules
// refuse any `status: "active"` write for that bus, so no trip can start on it.
//
// The entry carries the reporting conductor's account id, never their name:
// every signed-in NEX user (commuters too) can read inoperableBuses, so the
// name stays in users/{uid}, which only the conductor and their line's
// operators can read (the dashboard resolves conductorId → name itself).

import { getDatabase } from "firebase-admin/database";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Set explicitly: this module is evaluated before index.js calls
// setGlobalOptions, so the global region would not apply here.
const REGION = "asia-southeast1";

const USERS = "users";
const BUSES = "buses";
const ROUTES = "routes";
const PUSH_TOKENS = "push_tokens";

const MINUTE_MS = 60 * 1000;
const STALE_LIVE_ENTRY_MS = 10 * MINUTE_MS; // matches the takeover window in database.rules.json
const ABANDONED_LIVE_ENTRY_MS = 30 * MINUTE_MS; // an "active" entry this old belongs to no running trip
const NOTIFY_CLAIM_MS = 2 * MINUTE_MS; // one sender at a time per report
const INOPERABLE_EXPIRY_MS = 24 * 60 * MINUTE_MS;
const FCM_BATCH_SIZE = 500;

// RTDB keys can't contain . $ # [ ] /
const BUS_ID_PATTERN = /^[^.$#[\]/]{1,40}$/;
const REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

// Tokens that will never work again — removed from push_tokens.
const DEAD_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// Returns the caller's { uid, line } if their profile has `role`, or throws.
async function requireRole(request, role) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  const snapshot = await getFirestore().collection(USERS).doc(request.auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.role !== role) {
    throw new HttpsError("permission-denied", `Only ${role} accounts can do this.`);
  }
  if (!profile.line) {
    throw new HttpsError("failed-precondition", "Your account has no bus line assigned.");
  }
  return { uid: request.auth.uid, line: profile.line };
}

function requireBusId(busId) {
  if (typeof busId !== "string" || !BUS_ID_PATTERN.test(busId)) {
    throw new HttpsError("invalid-argument", "Missing or invalid bus number.");
  }
  return busId;
}

const optionalString = (value, max) =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : null;

const isLatitude = (value) => typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
const isLongitude = (value) => typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;

// Every FCM token registered by the line's operators and conductors, minus the caller.
async function collectRecipientTokens(line, excludeUid) {
  const db = getFirestore();
  const [operators, conductors] = await Promise.all([
    db.collection(USERS).where("role", "==", "operator").where("line", "==", line).get(),
    db.collection(USERS).where("role", "==", "conductor").where("line", "==", line).get(),
  ]);

  const uids = [...operators.docs, ...conductors.docs]
    .map((doc) => doc.id)
    .filter((uid) => uid !== excludeUid);
  if (uids.length === 0) return { recipients: 0, entries: [] };

  const snapshots = await db.getAll(...uids.map((uid) => db.collection(PUSH_TOKENS).doc(uid)));
  const seen = new Set();
  const entries = [];
  for (const snapshot of snapshots) {
    const tokens = snapshot.get("tokens");
    if (!tokens || typeof tokens !== "object") continue;
    for (const token of Object.keys(tokens)) {
      if (seen.has(token)) continue;
      seen.add(token);
      entries.push({ uid: snapshot.id, token });
    }
  }
  return { recipients: uids.length, entries };
}

// Sends `message` to every entry; prunes dead tokens. Returns the success count.
async function sendToEntries(entries, message) {
  const messaging = getMessaging();
  const db = getFirestore();
  let successCount = 0;
  const dead = [];

  for (let i = 0; i < entries.length; i += FCM_BATCH_SIZE) {
    const batch = entries.slice(i, i + FCM_BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      ...message,
      tokens: batch.map((entry) => entry.token),
    });
    successCount += response.successCount;
    response.responses.forEach((result, index) => {
      if (!result.success && DEAD_TOKEN_ERRORS.has(result.error?.code)) dead.push(batch[index]);
    });
  }

  await Promise.all(
    dead.map(({ uid, token }) =>
      db
        .collection(PUSH_TOKENS)
        .doc(uid)
        .update(new FieldPath("tokens", token), FieldValue.delete())
        .catch((error) => logger.warn("Could not prune push token", { uid, error: error.message })),
    ),
  );
  if (dead.length > 0) logger.info(`Pruned ${dead.length} dead push token(s).`);

  return successCount;
}

function buildMessage({ busId, routeId, routeName }) {
  const message = {
    notification: {
      title: `Bus ${busId} marked inoperable`,
      body: `An unexpected issue has been reported on ${routeName || "this route"}. The bus has been taken out of service.`,
    },
    data: { type: "bus_inoperable", busId, routeId: routeId ?? "" },
    android: { priority: "high", notification: { channelId: "nex-alerts" } },
  };
  // FCM requires an absolute HTTPS link for web pushes. Optional: without it
  // the dashboard's service worker opens /dashboard on click.
  const dashboardUrl = process.env.DASHBOARD_URL;
  if (typeof dashboardUrl === "string" && dashboardUrl.startsWith("https://")) {
    message.webpush = { fcmOptions: { link: `${dashboardUrl.replace(/\/$/, "")}/dashboard` } };
  }
  return message;
}

// Called by the NEX conductor app. Idempotent per `reportId`: retries (the app
// retries after losing connection) never write twice or notify twice.
export const markBusInoperable = onCall({ region: REGION }, async (request) => {
  const conductor = await requireRole(request, "conductor");
  const data = request.data ?? {};

  const busId = requireBusId(data.busId);
  if (typeof data.reportId !== "string" || !REPORT_ID_PATTERN.test(data.reportId)) {
    throw new HttpsError("invalid-argument", "Missing or invalid report id.");
  }
  const reportId = data.reportId;
  const hasPosition = isLatitude(data.lat) && isLongitude(data.lng);
  const now = Date.now();
  const inoperableAt =
    typeof data.inoperableAt === "number" &&
    Number.isFinite(data.inoperableAt) &&
    data.inoperableAt <= now + MINUTE_MS &&
    data.inoperableAt >= now - INOPERABLE_EXPIRY_MS
      ? data.inoperableAt
      : now;

  const firestore = getFirestore();
  const rtdb = getDatabase();

  // The bus must be a registered bus on the conductor's line.
  const busQuery = await firestore
    .collection(BUSES)
    .where("busNumber", "==", busId)
    .where("line", "==", conductor.line)
    .limit(1)
    .get();
  if (busQuery.empty) {
    throw new HttpsError("not-found", `Bus ${busId} is not registered on your line.`);
  }

  // The route name in the notification comes from the routes doc, not the client.
  let routeId = optionalString(data.routeId, 128);
  let routeName = null;
  if (routeId) {
    const routeSnap = await firestore.collection(ROUTES).doc(routeId).get();
    if (routeSnap.exists && routeSnap.get("line") === conductor.line) {
      routeName = optionalString(routeSnap.get("name"), 200);
    } else {
      routeId = null;
    }
  }

  // Only the conductor running this bus (or nobody, or a stale entry) may report it.
  const liveSnap = await rtdb.ref(`activeBuses/${busId}`).get();
  const live = liveSnap.val();
  if (
    live &&
    live.conductorId !== conductor.uid &&
    typeof live.lastUpdated === "number" &&
    live.lastUpdated >= now - STALE_LIVE_ENTRY_MS
  ) {
    throw new HttpsError("permission-denied", `Bus ${busId} is being operated by another conductor.`);
  }

  // Create the entry unless one already exists (transaction: retries can race).
  const nodeRef = rtdb.ref(`inoperableBuses/${busId}`);
  const newNode = {
    busId,
    source: "conductor",
    conductorId: conductor.uid,
    line: conductor.line,
    routeId,
    routeName,
    lat: hasPosition ? data.lat : null,
    lng: hasPosition ? data.lng : null,
    status: "inoperable",
    inoperableAt,
    reportId,
    tripId: optionalString(data.tripId, 128),
    notifiedAt: null,
    notifiedCount: 0,
  };
  const created = await nodeRef.transaction((current) => (current === null ? newNode : undefined));
  const node = created.snapshot.val();

  if (!node || node.reportId !== reportId) {
    // Already out of service from an earlier report — nothing more to do.
    return { alreadyReported: true, notified: 0 };
  }
  if (node.notifiedAt) {
    return { alreadyReported: true, notified: node.notifiedCount ?? 0 };
  }

  // Claim the send so two overlapping retries can't both notify.
  const claim = await nodeRef.child("notifyClaimedAt").transaction((current) =>
    typeof current === "number" && Date.now() - current < NOTIFY_CLAIM_MS ? undefined : Date.now(),
  );
  if (!claim.committed) {
    return { alreadyReported: true, notified: 0, notifyInProgress: true };
  }

  try {
    const { recipients, entries } = await collectRecipientTokens(conductor.line, conductor.uid);
    const notified =
      entries.length > 0
        ? await sendToEntries(entries, buildMessage({ busId, routeId: node.routeId, routeName: node.routeName }))
        : 0;

    await nodeRef.update({ notifiedAt: Date.now(), notifiedCount: notified, notifyClaimedAt: null });
    logger.info(`Bus ${busId} marked inoperable`, { reportId, line: conductor.line, recipients, notified });
    return { notified, recipients };
  } catch (error) {
    // The inoperableBuses entry is written — maps and the dashboard already
    // show it. Release the claim so the app's retry can try the send again.
    logger.error("Inoperable notification failed", { busId, reportId, error: error.message });
    await nodeRef.child("notifyClaimedAt").remove().catch(() => {});
    return { notified: 0, notifyFailed: true };
  }
});

// Operator sets a bus inoperable from Manage Bus (e.g. maintenance). Only
// while it isn't on a route — a bus mid-trip is marked by its conductor from
// the NEX app, which also ends and saves the trip. No push is sent. Entries
// with source "operator" don't expire; they stay until "Return to service".
export const markBusInoperableByOperator = onCall({ region: REGION }, async (request) => {
  const operator = await requireRole(request, "operator");
  const busId = requireBusId(request.data?.busId);
  const firestore = getFirestore();
  const rtdb = getDatabase();
  const now = Date.now();

  const busQuery = await firestore
    .collection(BUSES)
    .where("busNumber", "==", busId)
    .where("line", "==", operator.line)
    .limit(1)
    .get();
  if (busQuery.empty) {
    throw new HttpsError("not-found", `Bus ${busId} is not registered on your line.`);
  }

  const live = (await rtdb.ref(`activeBuses/${busId}`).get()).val();
  if (
    live?.status === "active" &&
    typeof live.lastUpdated === "number" &&
    live.lastUpdated >= now - STALE_LIVE_ENTRY_MS
  ) {
    throw new HttpsError(
      "failed-precondition",
      `${busId} is on a route right now. Its conductor can mark it inoperable from the NEX app, or try again after the trip ends.`,
    );
  }

  const nodeRef = rtdb.ref(`inoperableBuses/${busId}`);
  const created = await nodeRef.transaction((current) =>
    current === null
      ? {
          busId,
          source: "operator",
          markedBy: operator.uid,
          conductorId: null,
          line: operator.line,
          routeId: null,
          routeName: null,
          lat: null,
          lng: null,
          status: "inoperable",
          inoperableAt: now,
          reportId: `OP-${now.toString(36)}`,
          tripId: null,
          notifiedAt: now,
          notifiedCount: 0,
        }
      : undefined,
  );

  if (!created.committed) return { alreadyInoperable: true };
  logger.info(`Bus ${busId} marked inoperable by operator`, { operator: operator.uid });
  return { ok: true };
});

// Operator "Return to service": removes the inoperable entry (and any leftover
// inoperable live entry) for a bus on the operator's line.
export const clearInoperableBus = onCall({ region: REGION }, async (request) => {
  const operator = await requireRole(request, "operator");
  const busId = requireBusId(request.data?.busId);
  const rtdb = getDatabase();

  const [nodeSnap, liveSnap] = await Promise.all([
    rtdb.ref(`inoperableBuses/${busId}`).get(),
    rtdb.ref(`activeBuses/${busId}`).get(),
  ]);
  const node = nodeSnap.val();
  if (!node) return { ok: true };
  if (node.line !== operator.line) {
    throw new HttpsError("permission-denied", "This bus belongs to another bus line.");
  }

  const updates = { [`inoperableBuses/${busId}`]: null };
  if (liveSnap.val()?.status === "inoperable") updates[`activeBuses/${busId}`] = null;
  await rtdb.ref().update(updates);

  logger.info(`Bus ${busId} returned to service`, { operator: operator.uid });
  return { ok: true };
});

// Hourly backstop: conductor reports expire after 24 h (operator-set entries
// stay until returned to service), live entries left in status "inoperable"
// (the app couldn't delete them) are removed after 10 min, and "active"
// entries abandoned mid-trip (phone died / app killed — nothing else removes
// them) after ABANDONED_LIVE_ENTRY_MS. A phone that comes back recreates its
// entry with its next update. Readers already hide entries > 5 min stale.
export const expireInoperableBuses = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Asia/Manila", region: REGION },
  async () => {
    const rtdb = getDatabase();
    const now = Date.now();
    const [inoperableSnap, liveSnap] = await Promise.all([
      rtdb.ref("inoperableBuses").get(),
      rtdb.ref("activeBuses").get(),
    ]);

    const updates = {};
    Object.entries(inoperableSnap.val() ?? {}).forEach(([busId, node]) => {
      if (node?.source === "operator") return;
      const at = typeof node?.inoperableAt === "number" ? node.inoperableAt : 0;
      if (at < now - INOPERABLE_EXPIRY_MS) updates[`inoperableBuses/${busId}`] = null;
    });
    Object.entries(liveSnap.val() ?? {}).forEach(([busId, live]) => {
      if (live?.status === "inoperable") {
        const at = live.inoperableAt ?? live.lastUpdated ?? 0;
        if (at < now - STALE_LIVE_ENTRY_MS) updates[`activeBuses/${busId}`] = null;
        return;
      }
      const lastUpdated = typeof live?.lastUpdated === "number" ? live.lastUpdated : 0;
      if (lastUpdated < now - ABANDONED_LIVE_ENTRY_MS) updates[`activeBuses/${busId}`] = null;
    });

    const count = Object.keys(updates).length;
    if (count > 0) await rtdb.ref().update(updates);
    logger.info(`expireInoperableBuses removed ${count} entr${count === 1 ? "y" : "ies"}.`);
  },
);
