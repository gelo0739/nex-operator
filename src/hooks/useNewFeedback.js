import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FEEDBACK_COLLECTION } from "../utils/feedback";

const MAX_TRACKED = 50;

/**
 * Live list of feedback still marked "new" on the operator's line, newest
 * first (capped at 50 — the bell then shows "50+").
 * `since` (Timestamp | null): only feedback created after it — the operator's
 * `notificationsClearedAt`, so cleared notifications stay cleared.
 * Returns { items, count, capped }.
 */
export default function useNewFeedback(line, since = null) {
  const [result, setResult] = useState({ key: null, items: [] });
  const sinceMs = since?.toMillis?.() ?? null;
  const key = line ? `${line}|${sinceMs ?? ""}` : null;

  useEffect(() => {
    if (!line) return undefined;
    const constraints = [where("line", "==", line), where("status", "==", "new")];
    if (since) constraints.push(where("createdAt", ">", since));
    const newFeedbackQuery = query(
      collection(db, FEEDBACK_COLLECTION),
      ...constraints,
      orderBy("createdAt", "desc"),
      limit(MAX_TRACKED),
    );
    return onSnapshot(
      newFeedbackQuery,
      (snapshot) => setResult({ key, items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) }),
      (error) => {
        console.error("Failed to subscribe to new feedback:", error);
        setResult({ key, items: [] });
      },
    );
    // `since` is represented by sinceMs inside `key`.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = result.key === key ? result.items : [];
  return { items, count: items.length, capped: items.length >= MAX_TRACKED };
}
