// Thresholds for Notify on Arrival (arrivalWatches.js, arrivalLogic.js).
// Distances are measured ALONG the route polyline, in meters.

// ─── STAGES ─────────────────────────────────────────────────────
// "Bus X is approaching" once the bus is this far from the boarding point…
export const APPROACHING_METERS = 1500;
// …and "Bus X is arriving" from here (the watch then completes).
export const ARRIVING_METERS = 300;
// A bus this far beyond the boarding point has passed it.
export const PASSED_BUFFER_METERS = 50;

export const STAGE = Object.freeze({
  APPROACHING: "approaching",
  ARRIVING: "arriving",
  PASSED: "passed",
});

// ─── WATCHES ────────────────────────────────────────────────────
// Active watches per commuter (one per bus — the doc id is {uid}_{busId}).
export const MAX_ACTIVE_WATCHES = 3;
// A watch ends by itself after this long, notified or not.
export const WATCH_TTL_MS = 2 * 60 * 60 * 1000;
// Ended / expired watches are deleted this long after they expire.
export const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
// The boarding point must be this close to the route.
export const BOARDING_MAX_OFFSET_METERS = 300;

// ─── BUS DATA ───────────────────────────────────────────────────
// A live update older than this is ignored (no stage is sent from it).
export const BUS_STALE_MS = 2 * 60 * 1000;
// A bus this far from the polyline is on a detour — ignored until it's back.
export const BUS_DETOUR_METERS = 300;
// The route's typical speed (Google's car drive time) is scaled by this for
// a bus — the same factor as the app (ETA_ROUTE_SPEED_FACTOR).
export const ROUTE_SPEED_FACTOR = 0.8;
export const MIN_ROUTE_SPEED_KMH = 5;
export const MAX_ROUTE_SPEED_KMH = 120;

// ─── PROJECTION (same values as the app's src/constants/config.js) ──
// Stretches of route within this of the closest one tie; the earliest wins.
export const LEG_TIE_TOLERANCE_METERS = 50;
// Candidates within this distance along the route are one stretch of road.
export const LEG_SEPARATION_METERS = 200;
// A bus is kept on the stretch at/after its previous position minus this.
export const BACKWARD_JITTER_METERS = 30;

// ─── CACHES (per function instance) ─────────────────────────────
// Which buses have active watches — re-read at most this often, so a bus
// nobody watches costs no Firestore read.
export const WATCHED_CACHE_MS = 15 * 1000;
// Route polylines.
export const ROUTE_CACHE_MS = 10 * 60 * 1000;
// A bus's last position along the route, used to keep it on its own
// carriageway (the U-turn past PITX) — forgotten after this.
export const BUS_ALONG_MEMORY_MS = 2 * 60 * 1000;
