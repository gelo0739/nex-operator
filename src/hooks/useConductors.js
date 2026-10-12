import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";

/**
 * Live list of conductors (Firestore `users` with role "conductor") on the
 * given bus line. Returns { conductors, loading, error }.
 */
export default function useConductors(line) {
  const [result, setResult] = useState({ line: null, conductors: [], error: null });

  useEffect(() => {
    if (!line) return undefined;

    const conductorsQuery = query(
      collection(db, USERS_COLLECTION),
      where("role", "==", "conductor"),
      where("line", "==", line),
    );

    return onSnapshot(
      conductorsQuery,
      (snapshot) => {
        const conductors = snapshot.docs
          .map((document) => ({ id: document.id, ...document.data() }))
          .sort((a, b) => String(a.name ?? a.email ?? "").localeCompare(String(b.name ?? b.email ?? "")));
        setResult({ line, conductors, error: null });
      },
      (error) => {
        console.error("Failed to subscribe to conductors:", error);
        setResult({ line, conductors: [], error });
      },
    );
  }, [line]);

  const isCurrent = result.line === line;
  return {
    conductors: isCurrent ? result.conductors : [],
    loading: Boolean(line) && !isCurrent,
    error: isCurrent ? result.error : null,
  };
}
