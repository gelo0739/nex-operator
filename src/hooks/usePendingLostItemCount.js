import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * Live number of PENDING lost-item reports on the operator's line
 * (Fleet Overview card). Returns null while loading or if the listener fails.
 */
export default function usePendingLostItemCount(line) {
  const [result, setResult] = useState({ line: null, count: null });

  useEffect(() => {
    if (!line) return undefined;
    const pendingQuery = query(
      collection(db, "lost_item_reports"),
      where("line", "==", line),
      where("status", "==", "PENDING"),
    );
    return onSnapshot(
      pendingQuery,
      (snapshot) => setResult({ line, count: snapshot.size }),
      (error) => {
        console.error("Failed to subscribe to pending lost items:", error);
        setResult({ line, count: null });
      },
    );
  }, [line]);

  return result.line === line ? result.count : null;
}
