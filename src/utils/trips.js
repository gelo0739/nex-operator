import {
  Timestamp,
  average,
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";
import { formatDuration, toMillis } from "./format";

// Completed trips, written by the NEX conductor app when a trip ends
// (buildTripObject → saveCompletedTrip). Times are Firestore Timestamps.
export const TRIPS_COLLECTION = "trips";

const startOfDay = (yyyyMmDd) => Timestamp.fromDate(new Date(`${yyyyMmDd}T00:00:00`));
const startOfNextDay = (yyyyMmDd) => {
  const date = new Date(`${yyyyMmDd}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return Timestamp.fromDate(date);
};

// Filters → constraints shared by the list and the stats. Every combination is
// backed by a `trips` index in firestore.indexes.json (list: … endTime DESC;
// average: … [endTime ASC,] durationSeconds ASC).
const filterConstraints = (line, { routeId, busId, conductorId, from, to } = {}) => {
  const constraints = [where("line", "==", line)];
  if (routeId) constraints.push(where("routeId", "==", routeId));
  if (busId) constraints.push(where("busId", "==", busId));
  if (conductorId) constraints.push(where("conductorId", "==", conductorId));
  if (from) constraints.push(where("endTime", ">=", startOfDay(from)));
  if (to) constraints.push(where("endTime", "<", startOfNextDay(to)));
  return constraints;
};

const tripsCollection = () => collection(db, TRIPS_COLLECTION);

// One batch of trips, most recently completed first. `cursor` = last doc of
// the previous batch ("Load More").
export const fetchTripPage = async (line, filters, cursor, pageSize) => {
  const constraints = [...filterConstraints(line, filters), orderBy("endTime", "desc")];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const snapshot = await getDocs(query(tripsCollection(), ...constraints));
  return {
    items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

// Every trip matching the filters (for CSV export), newest first, fetched in
// batches of 500 and capped at `max`. Costs one read per trip.
export const EXPORT_MAX_TRIPS = 10000;
export const fetchAllTrips = async (line, filters, onProgress, max = EXPORT_MAX_TRIPS) => {
  const all = [];
  let cursor = null;
  while (all.length < max) {
    const { items, lastDoc } = await fetchTripPage(line, filters, cursor, Math.min(500, max - all.length));
    all.push(...items);
    onProgress?.(all.length);
    if (items.length === 0 || !lastDoc || items.length < 500) break;
    cursor = lastDoc;
  }
  return all;
};

// Trip count + average duration, computed by Firestore on the server (about
// one read per 1,000 matching trips). Run separately so the count (which also
// drives "Load More") survives if the average fails.
export const fetchTripStats = async (line, filters) => {
  const filtered = query(tripsCollection(), ...filterConstraints(line, filters));
  const [countResult, avgResult] = await Promise.allSettled([
    getAggregateFromServer(filtered, { total: count() }),
    getAggregateFromServer(filtered, { avgSeconds: average("durationSeconds") }),
  ]);
  if (countResult.status === "rejected") throw countResult.reason;
  if (avgResult.status === "rejected") console.error("Failed to compute average trip duration:", avgResult.reason);
  const avgSeconds = avgResult.status === "fulfilled" ? avgResult.value.data().avgSeconds : null;
  return {
    total: countResult.value.data().total,
    avgSeconds: typeof avgSeconds === "number" ? avgSeconds : null,
    avgError: avgResult.status === "rejected" ? avgResult.reason : null,
  };
};

// The conductor's profile (name + email) for the full report. Operators may
// read users/*; returns null for deleted accounts.
export const getConductorProfile = async (uid) => {
  if (!uid || uid === "UNKNOWN") return null;
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  return snapshot.exists() ? snapshot.data() : null;
};

// Short, human-friendly reference shown as "T-3F9K2A" (from the trip id).
export const tripRef = (id) => `T-${String(id).slice(0, 6).toUpperCase()}`;

// "Ricardo Mendoza" → "RM"; falls back to the first two letters.
export const initials = (name) => {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// "Ricardo Mendoza" → "Ricardo M." (table column, as in the mockup).
export const shortName = (name) => {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  return `${words[0]} ${words[words.length - 1][0]}.`;
};

// ---- CSV export ---------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
// "2026-10-24 14:42:05" in the operator's local time (Excel-friendly).
const csvDateTime = (value) => {
  const n = toMillis(value);
  if (!n || n <= 0) return "";
  const d = new Date(n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// RFC 4180 quoting + CSV-injection guard: a cell starting with = + - @ (or a
// tab / carriage return) could run as a formula in Excel, so it's prefixed with '.
const csvCell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const CSV_COLUMNS = [
  ["Trip Ref", (t) => tripRef(t.id)],
  ["Trip ID", (t) => t.id],
  ["Completed", (t) => csvDateTime(t.endTime)],
  ["Started", (t) => csvDateTime(t.startTime)],
  ["Route", (t) => t.route ?? ""],
  ["Bus", (t) => (t.busId && t.busId !== "UNKNOWN" ? t.busId : "")],
  ["Conductor", (t, names) => names.get(t.conductorId) ?? "Unknown conductor"],
  ["Duration (s)", (t) => t.durationSeconds ?? ""],
  ["Duration", (t) => formatDuration(t.durationSeconds)],
  ["Distance (km)", (t) => (typeof t.totalDistanceKm === "number" ? t.totalDistanceKm.toFixed(2) : "")],
  ["Avg Speed (km/h)", (t) => (typeof t.averageSpeedKmh === "number" ? t.averageSpeedKmh.toFixed(1) : "")],
];

// CSV text (with a UTF-8 BOM so Excel shows "Parañaque" correctly).
export const buildTripsCsv = (trips, conductorNames) => {
  const header = CSV_COLUMNS.map(([label]) => csvCell(label)).join(",");
  const rows = trips.map((trip) => CSV_COLUMNS.map(([, get]) => csvCell(get(trip, conductorNames))).join(","));
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
};

// Triggers a browser download of `text` as `filename`.
export const downloadCsv = (text, filename) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
