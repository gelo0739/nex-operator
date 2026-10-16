// Tests for arrivalLogic.js — `npm test` in functions/ (Node's test runner).
// The route is the real Alfonso -> PITX polyline (copied from the NEX app's
// scripts/fixtures/alfonsoPitx.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assessBus,
  buildRouteProfile,
  describeNotification,
  evaluateWatch,
  projectOntoRoute,
  routeSpeedKmh,
} from "../arrivalLogic.js";
import {
  APPROACHING_METERS,
  ARRIVING_METERS,
  BUS_STALE_MS,
  STAGE,
} from "../arrivalConstants.js";

const route = JSON.parse(readFileSync(new URL("./alfonsoPitx.json", import.meta.url)));
const profile = buildRouteProfile(route.routeCoordinates);
const SPEED = routeSpeedKmh(route);
const NOW = 1_800_000_000_000;
const METERS_PER_DEGREE = (6371000 * Math.PI) / 180;

const pointAt = (along, sideMeters = 0) => {
  let i = profile.cumulative.findIndex((c) => c > along) - 1;
  if (i < 0) i = profile.points.length - 2;
  const a = profile.points[i];
  const b = profile.points[i + 1];
  const t = (along - profile.cumulative[i]) / (profile.cumulative[i + 1] - profile.cumulative[i]);
  const xScale = METERS_PER_DEGREE * Math.cos((a.latitude * Math.PI) / 180);
  const dx = (b.longitude - a.longitude) * xScale;
  const dy = (b.latitude - a.latitude) * METERS_PER_DEGREE;
  const length = Math.hypot(dx, dy);
  return {
    lat: a.latitude + (b.latitude - a.latitude) * t + ((dx / length) * sideMeters) / METERS_PER_DEGREE,
    lng: a.longitude + (b.longitude - a.longitude) * t + ((-dy / length) * sideMeters) / xScale,
  };
};

const watch = (overrides = {}) => ({
  status: "active",
  boardingAlong: 20000,
  notifiedStages: [],
  expiresAt: NOW + 60 * 60 * 1000,
  ...overrides,
});

test("route profile and speed from the real route", () => {
  assert.ok(Math.abs(profile.totalLength - route.distanceMeters) < 200);
  assert.ok(SPEED > 20 && SPEED < 30, `${SPEED}`); // 32.3 km/h × 0.8
  assert.equal(routeSpeedKmh({ distanceMeters: 100, durationSeconds: 0 }), null);
  assert.equal(buildRouteProfile([]), null);
  assert.equal(buildRouteProfile([[NaN, 1], [1, 1]]), null);
});

test("projection: boarding point on the route, and the PITX U-turn", () => {
  const p = projectOntoRoute(pointAt(12345), profile);
  assert.ok(Math.abs(p.along - 12345) < 1 && p.offset < 1);
  const apex = profile.cumulative[
    profile.points.reduce((best, pt, i) => (pt.latitude > profile.points[best].latitude ? i : best), 0)
  ];
  // a boarding point on the return side ties with the northbound side: the
  // earlier pass wins (the bus reaches it first)
  assert.ok(projectOntoRoute(pointAt(apex + 600), profile).along < apex);
  // a bus already on the return leg stays on it
  const bus = projectOntoRoute(pointAt(apex + 600), profile, { fromAlong: apex + 570 });
  assert.ok(Math.abs(bus.along - (apex + 600)) < 5);
  assert.equal(projectOntoRoute({ lat: NaN, lng: 0 }, profile), null);
});

test("assessBus: fresh, stale, detour", () => {
  const ok = assessBus({ ...pointAt(15000), lastUpdated: NOW - 5000 }, profile, NOW);
  assert.equal(ok.usable, true);
  assert.ok(Math.abs(ok.along - 15000) < 1);
  assert.equal(
    assessBus({ ...pointAt(15000), lastUpdated: NOW - BUS_STALE_MS - 1 }, profile, NOW).reason,
    "stale",
  );
  assert.equal(assessBus({ ...pointAt(15000, 800), lastUpdated: NOW }, profile, NOW).reason, "detour");
  assert.equal(assessBus({ lat: "x", lastUpdated: NOW }, profile, NOW).reason, "no_position");
});

test("stages: far → nothing, approaching once, arriving completes", () => {
  assert.equal(evaluateWatch(watch(), 20000 - APPROACHING_METERS - 10, NOW, SPEED).action, "none");

  const approaching = evaluateWatch(watch(), 20000 - 1200, NOW, SPEED);
  assert.equal(approaching.action, "send");
  assert.equal(approaching.stage, STAGE.APPROACHING);
  assert.equal(approaching.status, "active");
  assert.ok(approaching.minutes > 2 && approaching.minutes < 4, `${approaching.minutes}`);

  // already sent → not again
  const again = evaluateWatch(watch({ notifiedStages: [STAGE.APPROACHING] }), 20000 - 1000, NOW, SPEED);
  assert.equal(again.action, "none");

  const arriving = evaluateWatch(watch({ notifiedStages: [STAGE.APPROACHING] }), 20000 - 200, NOW, SPEED);
  assert.equal(arriving.stage, STAGE.ARRIVING);
  assert.equal(arriving.status, "completed");
  assert.deepEqual(arriving.markStages, [STAGE.APPROACHING, STAGE.ARRIVING]);

  // first seen already within arriving range: arriving only (approaching marked)
  const direct = evaluateWatch(watch(), 20000 - ARRIVING_METERS + 1, NOW, SPEED);
  assert.equal(direct.stage, STAGE.ARRIVING);
});

test("passed, expired, unusable input", () => {
  const passed = evaluateWatch(watch(), 20100, NOW, SPEED);
  assert.equal(passed.action, "end");
  assert.equal(passed.endReason, "passed");
  assert.equal(passed.stage, STAGE.PASSED);
  // a bus just past (within the buffer) is still "arriving"
  assert.equal(evaluateWatch(watch(), 20030, NOW, SPEED).stage, STAGE.ARRIVING);

  const expired = evaluateWatch(watch({ expiresAt: NOW - 1 }), 19000, NOW, SPEED);
  assert.equal(expired.status, "expired");
  // Firestore Timestamps work too
  const ts = { toMillis: () => NOW - 1 };
  assert.equal(evaluateWatch(watch({ expiresAt: ts }), 19000, NOW, SPEED).status, "expired");

  assert.equal(evaluateWatch(watch({ status: "cancelled" }), 19000, NOW, SPEED).action, "none");
  assert.equal(evaluateWatch(watch({ boardingAlong: NaN }), 19000, NOW, SPEED).action, "none");
  assert.equal(evaluateWatch(null, 19000, NOW, SPEED).action, "none");
  // no route speed: still sent, just without minutes
  const noSpeed = evaluateWatch(watch(), 20000 - 1000, NOW, null);
  assert.equal(noSpeed.stage, STAGE.APPROACHING);
  assert.equal(noSpeed.minutes, null);
});

test("message texts", () => {
  assert.deepEqual(
    describeNotification({ kind: STAGE.APPROACHING, busId: "NEX-1", routeName: "Alfonso - PITX", minutes: 3.4 }),
    { title: "Bus NEX-1 is approaching", body: "Alfonso - PITX · about 3 min away" },
  );
  assert.equal(
    describeNotification({ kind: STAGE.APPROACHING, busId: "NEX-1", routeName: "R", minutes: null }).body,
    "R",
  );
  assert.equal(
    describeNotification({ kind: STAGE.ARRIVING, busId: "NEX-1", routeName: "R" }).title,
    "Bus NEX-1 is arriving — R",
  );
  assert.ok(describeNotification({ kind: "trip_ended", busId: "NEX-1" }).title.includes("ended its trip"));
  assert.equal(describeNotification({ kind: "expired", busId: "NEX-1" }), null);
});
