// Shared display formatting: dates, durations, distances and load errors.
// Accepts Firestore Timestamps, Dates or epoch-ms numbers wherever a time is
// expected (older records stored ms numbers).

// Timestamp | Date | epoch-ms number → epoch ms (or null).
export const toMillis = (value) => {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const ms = (value) => {
  const n = toMillis(value);
  return n && n > 0 ? n : null;
};

const DATE_TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const DATE_TIME_24 = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const TIME_24 = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DATE_LONG = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fmt = (formatter, fallback) => (value) => {
  const n = ms(value);
  return n ? formatter.format(n) : fallback;
};

export const formatDateTime = fmt(DATE_TIME, "—"); //      "Oct 24, 09:12 AM"
export const formatDateTime24 = fmt(DATE_TIME_24, "—"); // "Oct 24, 14:30"
export const formatDate = fmt(DATE, "—"); //              "Oct 24, 2026"
export const formatTime24 = fmt(TIME_24, ""); //          "14:42"
export const formatDateLong = fmt(DATE_LONG, "—"); //     "Fri, October 24, 2026, 09:12 AM"

// Durations, precise enough for short trips: "53s", "12m 4s", "1h 52m".
export const formatDuration = (seconds) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.round((s % 3600) / 60);
  return minutes === 60 ? `${hours + 1}h 0m` : `${hours}h ${minutes}m`;
};

// Route travel-time estimates, rounded to minutes: "45 min", "2 hr", "2 hr 9 min".
export const formatTravelTime = (seconds) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
};

// "64.9 km"
export const formatDistance = (meters) =>
  typeof meters === "number" && Number.isFinite(meters) ? `${(meters / 1000).toFixed(1)} km` : "—";

// Firestore reports a missing / still-building index as "failed-precondition".
export const isIndexBuildingError = (error) => error?.code === "failed-precondition";

// User-facing message for a failed list / count load.
export const loadErrorMessage = (error, what) =>
  isIndexBuildingError(error)
    ? "Search indexes are still building — try again in a few minutes."
    : `Couldn’t load ${what}. Check your connection and refresh.`;
