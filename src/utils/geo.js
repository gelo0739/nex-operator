// Small geometry / operating-hours helpers for route editing.

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in meters between two { lat, lng } points.
export const haversineMeters = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

// Given the ordered stops [start, ...waypoints, end] and a new point, returns
// the waypoint index to insert at so the detour is smallest. The new stop
// slots in between the two stops it sits between, instead of always being
// appended (which would make the route double back on itself).
export const bestInsertIndex = (orderedPoints, point) => {
  if (orderedPoints.length < 2) return 0;
  let bestGap = 0;
  let bestCost = Infinity;
  for (let i = 0; i < orderedPoints.length - 1; i += 1) {
    const a = orderedPoints[i];
    const b = orderedPoints[i + 1];
    const cost = haversineMeters(a, point) + haversineMeters(point, b) - haversineMeters(a, b);
    if (cost < bestCost) {
      bestCost = cost;
      bestGap = i;
    }
  }
  // Gap i sits right after orderedPoints[i]. orderedPoints[0] is the start,
  // so gap i is waypoint index i.
  return bestGap;
};

// --- Operating hours -------------------------------------------------------
// Stored in Firestore as a display string ("2:00 AM - 10:00 PM" or
// "24 Hours"); edited as <input type="time"> values ("02:00", "22:00").

export const ALL_DAY_HOURS = "24 Hours";
export const DEFAULT_HOURS = { start: "05:00", end: "22:00", allDay: false };

const to24h = (hour, minute, meridiem) => {
  let h = Number(hour) % 12;
  if (meridiem.toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
};

const to12h = (value) => {
  const [h, m] = value.split(":").map(Number);
  const meridiem = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${meridiem}`;
};

export const parseHours = (hours) => {
  if (typeof hours !== "string") return DEFAULT_HOURS;
  if (/^\s*24\s*hours?\s*$/i.test(hours)) return { ...DEFAULT_HOURS, allDay: true };
  const match = hours.match(
    /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i,
  );
  if (!match) return DEFAULT_HOURS;
  return {
    start: to24h(match[1], match[2], match[3]),
    end: to24h(match[4], match[5], match[6]),
    allDay: false,
  };
};

export const formatHours = ({ start, end, allDay }) =>
  allDay ? ALL_DAY_HOURS : `${to12h(start)} - ${to12h(end)}`;
