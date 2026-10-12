import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";

export const LOST_ITEMS_COLLECTION = "lost_item_reports";
export const MAX_LOST_ITEM_NOTE_LENGTH = 1000;

// Resolution workflow. The NEX app files reports as PENDING. RETURNED and
// CLOSED count as resolved: they set `resolvedAt`, which starts the 180-day
// photo-retention clock (functions/photoRetention.js).
export const LOST_ITEM_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "FOUND", label: "Item Found" },
  { value: "RETURNED", label: "Returned" },
  { value: "CLOSED", label: "Closed" },
];
const RESOLVED_STATUSES = new Set(["RETURNED", "CLOSED"]);
export const isResolvedStatus = (status) => RESOLVED_STATUSES.has(status);
export const lostItemStatus = (report) => report.status ?? "PENDING";

// Short, human-friendly reference shown as "ID: #LX-3F9K2A" (from the doc id).
export const lostItemRef = (id) => `LX-${String(id).slice(0, 6).toUpperCase()}`;

// Route / status filters → constraints shared by the list and the count.
// Backed by the lost_item_reports indexes in firestore.indexes.json.
const filterConstraints = (line, { routeId, status } = {}) => {
  const constraints = [where("line", "==", line)];
  if (routeId) constraints.push(where("routeId", "==", routeId));
  if (status) constraints.push(where("status", "==", status));
  return constraints;
};

const lostItemsCollection = () => collection(db, LOST_ITEMS_COLLECTION);

// One page of reports, newest first. `cursor` = last doc of the previous page.
export const fetchLostItemPage = async (line, filters, cursor, pageSize) => {
  const constraints = [...filterConstraints(line, filters), orderBy("createdAt", "desc")];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const snapshot = await getDocs(query(lostItemsCollection(), ...constraints));
  return {
    items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

// Server-side count (≈ 1 read per 1,000 matching reports).
export const fetchLostItemCount = async (line, filters) => {
  const snapshot = await getAggregateFromServer(query(lostItemsCollection(), ...filterConstraints(line, filters)), {
    total: count(),
  });
  return snapshot.data().total;
};

// The reporter's account email (operators may read users/*). Reports filed
// before the lockdown have no userId.
export const getReporterEmail = async (userId) => {
  if (!userId) return null;
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  return snapshot.exists() ? snapshot.data().email ?? null : null;
};

// Sets the resolution status + note (only these fields may change — see
// firestore.rules). Returns the patch so the caller can update its copy.
export const updateLostItemStatus = async (id, { status, note }, operator) => {
  const resolved = isResolvedStatus(status);
  const patch = {
    status,
    operatorNote: note.trim().slice(0, MAX_LOST_ITEM_NOTE_LENGTH),
    resolvedAt: resolved ? serverTimestamp() : null,
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: operator.uid,
    statusUpdatedByEmail: operator.email ?? null,
  };
  try {
    await updateDoc(doc(db, LOST_ITEMS_COLLECTION, id), patch);
  } catch (error) {
    console.error("Failed to update lost item report:", error);
    throw new Error("Couldn't save the status. Please try again.", { cause: error });
  }
  // serverTimestamp() is a sentinel; show "now" locally until the next fetch.
  const now = new Date();
  return { ...patch, resolvedAt: resolved ? now : null, statusUpdatedAt: now };
};
