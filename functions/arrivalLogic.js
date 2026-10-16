// Notify on Arrival — pure logic (no Firebase imports; tested by
// arrivalLogic.test.js).
//
// Linear referencing, as in the NEX app: the bus and the commuter's
// boarding point are both projected onto the route polyline, giving
// `along` (meters from the route start) and `offset` (meters from the line).
// Remaining distance = boardingAlong − busAlong.
//
// KEEP IN SYNC: buildRouteProfile / projectOntoRoute mirror the NEX app's
// src/utils/etaEngine.js (the two repos deploy separately and can't share
// a module). The thresholds mirror its src/constants/config.js.
import {
  APPROACHING_METERS,
  ARRIVING_METERS,
  BACKWARD_JITTER_METERS,
  BUS_DETOUR_METERS,
  BUS_STALE_MS,
  LEG_SEPARATION_METERS,
  LEG_TIE_TOLERANCE_METERS,
  MAX_ROUTE_SPEED_KMH,
  MIN_ROUTE_SPEED_KMH,
  PASSED_BUFFER_METERS,
  ROUTE_SPEED_FACTOR,
  STAGE,
} from "./arrivalConstants.js";

const EARTH_RADIUS_M = 6371000;
const METERS_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180;
const KMH_PER_MPS = 3.6;
const toRad = (deg) => (deg * Math.PI) / 180;

export const finiteOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const isValidCoordinates = (lat, lng) =>
  finiteOrNull(lat) !== null &&
  finiteOrNull(lng) !== null &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

// { latitude, longitude } (route polylines), { lat, lng } (live entries,
// boarding points) or [lat, lng].
export const toPoint = (raw) => {
  const latitude = Array.isArray(raw) ? raw[0] : (raw?.latitude ?? raw?.lat);
  const longitude = Array.isArray(raw) ? raw[1] : (raw?.longitude ?? raw?.lng);
  return isValidCoordinates(latitude, longitude) ? { latitude, longitude } : null;
};

const haversineMeters = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ─── ROUTE PROFILE ──────────────────────────────────────────────
// Valid points in order (invalid ones and consecutive duplicates dropped)
// with the distance from the route start at every vertex; null if fewer
// than two distinct points remain.
export const buildRouteProfile = (routeCoordinates) => {
  if (!Array.isArray(routeCoordinates)) return null;
  const points = [];
  const cumulative = [];
  let total = 0;
  for (const raw of routeCoordinates) {
    const point = toPoint(raw);
    if (!point) continue;
    const previous = points[points.length - 1];
    if (previous) {
      const segment = haversineMeters(previous, point);
      if (!(segment > 0)) continue;
      total += segment;
    }
    points.push(point);
    cumulative.push(total);
  }
  if (points.length < 2 || !(total > 0)) return null;
  return { points, cumulative, totalLength: total };
};

// Nearest point on segment i, in a local flat frame around its start.
const projectOntoSegment = (point, profile, i) => {
  const a = profile.points[i];
  const b = profile.points[i + 1];
  const xScale = METERS_PER_DEGREE * Math.cos(toRad(a.latitude));
  const bx = (b.longitude - a.longitude) * xScale;
  const by = (b.latitude - a.latitude) * METERS_PER_DEGREE;
  const px = (point.longitude - a.longitude) * xScale;
  const py = (point.latitude - a.latitude) * METERS_PER_DEGREE;
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared)) : 0;
  const segmentLength = profile.cumulative[i + 1] - profile.cumulative[i];
  return {
    along: profile.cumulative[i] + t * segmentLength,
    offset: Math.hypot(px - t * bx, py - t * by),
  };
};

// { along, offset } or null. Where the road passes near itself (the U-turn
// past PITX), stretches within LEG_TIE_TOLERANCE_METERS of the closest tie
// and the earliest one along the route wins — at or after `fromAlong` (a
// bus's previous position) when given.
export const projectOntoRoute = (rawPoint, profile, { fromAlong } = {}) => {
  const point = toPoint(rawPoint);
  if (!point || !profile) return null;

  const candidates = [];
  let best = null;
  for (let i = 0; i < profile.points.length - 1; i += 1) {
    const candidate = projectOntoSegment(point, profile, i);
    candidates.push(candidate);
    if (!best || candidate.offset < best.offset) best = candidate;
  }

  const maxOffset = best.offset + LEG_TIE_TOLERANCE_METERS;
  const previous = finiteOrNull(fromAlong);
  const minAlong = previous !== null ? previous - BACKWARD_JITTER_METERS : -Infinity;
  const first = candidates.find((c) => c.offset <= maxOffset && c.along >= minAlong);
  if (!first) return best;

  let chosen = first;
  for (const candidate of candidates) {
    if (candidate.along < first.along) continue;
    if (candidate.along > first.along + LEG_SEPARATION_METERS) break;
    if (candidate.offset < chosen.offset) chosen = candidate;
  }
  return chosen;
};

// The route's typical bus speed (km/h): its doc's distanceMeters /
// durationSeconds scaled by ROUTE_SPEED_FACTOR, or null if unusable.
export const routeSpeedKmh = (route) => {
  const meters = finiteOrNull(route?.distanceMeters);
  const seconds = finiteOrNull(route?.durationSeconds);
  if (!(meters > 0) || !(seconds > 0)) return null;
  const kmh = (meters / seconds) * KMH_PER_MPS * ROUTE_SPEED_FACTOR;
  return kmh >= MIN_ROUTE_SPEED_KMH && kmh <= MAX_ROUTE_SPEED_KMH ? kmh : null;
};

// ─── BUS ────────────────────────────────────────────────────────
// Whether one live update can be used: { usable: true, along, offset } or
// { usable: false, reason: 'stale' | 'no_position' | 'detour' }.
export const assessBus = (live, profile, now, fromAlong) => {
  const lastUpdated = finiteOrNull(live?.lastUpdated);
  if (lastUpdated === null || now - lastUpdated > BUS_STALE_MS) {
    return { usable: false, reason: "stale" };
  }
  const projection = projectOntoRoute(live, profile, { fromAlong });
  if (!projection) return { usable: false, reason: "no_position" };
  if (projection.offset > BUS_DETOUR_METERS) {
    return { usable: false, reason: "detour", along: projection.along, offset: projection.offset };
  }
  return { usable: true, along: projection.along, offset: projection.offset };
};

// ─── WATCH ──────────────────────────────────────────────────────
const toMillis = (value) => {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return finiteOrNull(value);
};

// What one usable bus position means for one active watch:
//   { action: 'none' }
//   { action: 'send', stage, markStages, status, endReason, remainingMeters, minutes }
//   { action: 'end', status, endReason, stage? }   (stage → send that message)
// Each stage is sent at most once (`notifiedStages`); arriving completes the
// watch, and marks approaching too so it can never follow.
export const evaluateWatch = (watch, busAlong, now, speedKmh) => {
  if (!watch || watch.status !== "active") return { action: "none" };

  const expiresAt = toMillis(watch.expiresAt);
  if (expiresAt !== null && now >= expiresAt) {
    return { action: "end", status: "expired", endReason: "expired" };
  }

  const boardingAlong = finiteOrNull(watch.boardingAlong);
  const along = finiteOrNull(busAlong);
  if (boardingAlong === null || along === null) return { action: "none" };

  const sent = new Set(Array.isArray(watch.notifiedStages) ? watch.notifiedStages : []);
  const remaining = boardingAlong - along;

  if (remaining < -PASSED_BUFFER_METERS) {
    return { action: "end", status: "completed", endReason: "passed", stage: STAGE.PASSED };
  }

  const speed = finiteOrNull(speedKmh);
  const minutes = speed && speed > 0 ? Math.max(0, remaining) / (speed / KMH_PER_MPS) / 60 : null;

  if (remaining <= ARRIVING_METERS) {
    if (sent.has(STAGE.ARRIVING)) return { action: "none" };
    return {
      action: "send",
      stage: STAGE.ARRIVING,
      markStages: [STAGE.APPROACHING, STAGE.ARRIVING],
      status: "completed",
      endReason: "arrived",
      remainingMeters: Math.max(0, remaining),
      minutes,
    };
  }

  if (remaining <= APPROACHING_METERS && !sent.has(STAGE.APPROACHING)) {
    return {
      action: "send",
      stage: STAGE.APPROACHING,
      markStages: [STAGE.APPROACHING],
      status: "active",
      endReason: null,
      remainingMeters: remaining,
      minutes,
    };
  }

  return { action: "none" };
};

// ─── MESSAGES ───────────────────────────────────────────────────
// { title, body } for a stage or an end reason; null when nothing is sent.
export const describeNotification = ({ kind, busId, routeName, minutes }) => {
  const route = typeof routeName === "string" && routeName ? routeName : "your route";
  switch (kind) {
    case STAGE.APPROACHING: {
      const value = finiteOrNull(minutes);
      let when = "";
      if (value !== null) {
        when = value < 1 ? " · less than a minute away" : ` · about ${Math.round(value)} min away`;
      }
      return { title: `Bus ${busId} is approaching`, body: `${route}${when}` };
    }
    case STAGE.ARRIVING:
      return { title: `Bus ${busId} is arriving — ${route}`, body: "Get ready at your boarding point." };
    case STAGE.PASSED:
      return {
        title: `Bus ${busId} has passed your boarding point`,
        body: `${route} · Notify on Arrival is now off.`,
      };
    case "trip_ended":
      return {
        title: `Bus ${busId} ended its trip`,
        body: `${route} · Notify on Arrival is now off.`,
      };
    case "inoperable":
      return {
        title: `Bus ${busId} is out of service`,
        body: `It was taken out of service. Notify on Arrival is now off.`,
      };
    default:
      return null;
  }
};
