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
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";

export const FEEDBACK_COLLECTION = "service_feedbacks";

// Same tags the NEX app offers (src/app/(commuter)/Feedback.jsx).
export const FEEDBACK_TAGS = [
  { label: "Smooth Drive", tone: "positive" },
  { label: "Clean Bus", tone: "positive" },
  { label: "On Time", tone: "positive" },
  { label: "Polite Staff", tone: "positive" },
  { label: "Reckless Driving", tone: "negative" },
  { label: "Delayed Arrival", tone: "negative" },
  { label: "AC Issue", tone: "negative" },
  { label: "Overcrowded", tone: "negative" },
];
// Review workflow. New feedback starts as "new" (set by the NEX app).
export const FEEDBACK_STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];
export const MAX_OPERATOR_NOTE_LENGTH = 1000;
export const feedbackStatus = (feedback) => feedback.status ?? "new";

const TAG_TONES = new Map(FEEDBACK_TAGS.map((t) => [t.label, t.tone]));
export const tagTone = (label) => TAG_TONES.get(label) ?? "neutral";

// New docs have `categories` (array). Older ones only have the combined
// string "Tag A, Tag B | Route: …" — parse that as a fallback.
export const feedbackCategories = (feedback) => {
  if (Array.isArray(feedback.categories)) return feedback.categories;
  if (typeof feedback.category !== "string") return [];
  return feedback.category
    .split(" | Route:")[0]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => TAG_TONES.has(s));
};

const startOfDay = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00`);
const startOfNextDay = (yyyyMmDd) => {
  const date = startOfDay(yyyyMmDd);
  date.setDate(date.getDate() + 1);
  return date;
};

// Filters → query constraints (no ordering), shared by the list and the stats
// so both always describe the same set of feedback.
// Every combination is backed by an index in firestore.indexes.json.
const filterConstraints = (line, { status, routeId, category, from, to } = {}) => {
  const constraints = [where("line", "==", line)];
  if (status) constraints.push(where("status", "==", status));
  if (routeId) constraints.push(where("routeId", "==", routeId));
  if (category) constraints.push(where("categories", "array-contains", category));
  if (from) constraints.push(where("createdAt", ">=", Timestamp.fromDate(startOfDay(from))));
  if (to) constraints.push(where("createdAt", "<", Timestamp.fromDate(startOfNextDay(to))));
  return constraints;
};

const feedbackCollection = () => collection(db, FEEDBACK_COLLECTION);

// One page of feedback, newest first. `cursor` is the last doc snapshot of the
// previous page (or null for the first page).
export const fetchFeedbackPage = async (line, filters, cursor, pageSize) => {
  const constraints = [...filterConstraints(line, filters), orderBy("createdAt", "desc")];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const snapshot = await getDocs(query(feedbackCollection(), ...constraints));
  return {
    items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

// Count + average rating computed by Firestore on the server — billed at about
// one read per 1,000 matching docs instead of reading every feedback.
//
// They run as two separate aggregations so the count (which also drives
// pagination) still works if the average fails. average("rating") needs a
// composite index that ends in `rating` for every filter combination — see the
// "rating:ASC" entries in firestore.indexes.json. A missing one throws
// failed-precondition, returned here as `avgError`.
export const fetchFeedbackStats = async (line, filters) => {
  const filtered = query(feedbackCollection(), ...filterConstraints(line, filters));
  const [countResult, avgResult] = await Promise.allSettled([
    getAggregateFromServer(filtered, { total: count() }),
    getAggregateFromServer(filtered, { avgRating: average("rating") }),
  ]);
  if (countResult.status === "rejected") throw countResult.reason;
  if (avgResult.status === "rejected") console.error("Failed to compute average rating:", avgResult.reason);
  const avgRating = avgResult.status === "fulfilled" ? avgResult.value.data().avgRating : null;
  return {
    total: countResult.value.data().total,
    avgRating: typeof avgRating === "number" ? avgRating : null,
    avgError: avgResult.status === "rejected" ? avgResult.reason : null,
  };
};

// Feedback count in the last 30 days vs the 30 days before (same filters,
// minus any date range), for the trend under "Total Feedbacks".
export const fetchFeedbackTrend = async (line, filters) => {
  const base = filterConstraints(line, { ...filters, from: null, to: null });
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Timestamp.fromDate(new Date(now.getTime() - 30 * day));
  const sixtyDaysAgo = Timestamp.fromDate(new Date(now.getTime() - 60 * day));
  const [recent, previous] = await Promise.all([
    getAggregateFromServer(query(feedbackCollection(), ...base, where("createdAt", ">=", thirtyDaysAgo)), { n: count() }),
    getAggregateFromServer(
      query(feedbackCollection(), ...base, where("createdAt", ">=", sixtyDaysAgo), where("createdAt", "<", thirtyDaysAgo)),
      { n: count() },
    ),
  ]);
  return { recent: recent.data().n, previous: previous.data().n };
};

// A single feedback (null if missing or not on the operator's line).
export const getFeedback = async (id, line) => {
  const snapshot = await getDoc(doc(db, FEEDBACK_COLLECTION, id));
  if (!snapshot.exists() || snapshot.data().line !== line) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

// Sets the review status + note. Only these fields may change (firestore.rules).
// Returns the patch so the caller can update its local copy.
export const updateFeedbackReview = async (id, { status, note }, operator) => {
  const patch = {
    status,
    operatorNote: note.trim().slice(0, MAX_OPERATOR_NOTE_LENGTH),
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: operator.uid,
    statusUpdatedByEmail: operator.email ?? null,
  };
  try {
    await updateDoc(doc(db, FEEDBACK_COLLECTION, id), patch);
  } catch (error) {
    console.error("Failed to update feedback review:", error);
    throw new Error("Couldn't save the review. Please try again.", { cause: error });
  }
  // serverTimestamp() is a sentinel; show "now" locally until the next fetch.
  return { ...patch, statusUpdatedAt: new Date() };
};

// The commuter's email, for the details view (operators may read users/*).
export const getSubmitterEmail = async (userId) => {
  if (!userId) return null;
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  return snapshot.exists() ? snapshot.data().email ?? null : null;
};
