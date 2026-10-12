import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { BUSES_COLLECTION } from "../lib/collections";

/**
 * Live list of the operator's buses (Firestore `buses` where line == line),
 * sorted by bus number. Returns { buses, loading, error }.
 */
export default function useBuses(line) {
  const [result, setResult] = useState({ line: null, buses: [], error: null });

  useEffect(() => {
    if (!line) return undefined;
    return onSnapshot(
      query(collection(db, BUSES_COLLECTION), where("line", "==", line)),
      (snapshot) => {
        const buses = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(a.busNumber ?? "").localeCompare(String(b.busNumber ?? ""), undefined, { numeric: true }));
        setResult({ line, buses, error: null });
      },
      (error) => {
        console.error("Failed to subscribe to buses:", error);
        setResult({ line, buses: [], error });
      },
    );
  }, [line]);

  const isCurrent = result.line === line;
  return {
    buses: isCurrent ? result.buses : [],
    loading: Boolean(line) && !isCurrent,
    error: isCurrent ? result.error : null,
  };
}
