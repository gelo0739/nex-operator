import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ROUTES_COLLECTION } from "../lib/collections";

/**
 * Live list of Firestore `routes` on the given bus line.
 * Returns { routes, loading, error }.
 */
export default function useRoutes(line) {
  const [result, setResult] = useState({ line: null, routes: [], error: null });

  useEffect(() => {
    if (!line) return undefined;

    const routesQuery = query(collection(db, ROUTES_COLLECTION), where("line", "==", line));

    return onSnapshot(
      routesQuery,
      (snapshot) => {
        const routes = snapshot.docs
          .map((document) => ({ id: document.id, ...document.data() }))
          .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
        setResult({ line, routes, error: null });
      },
      (error) => {
        console.error("Failed to subscribe to routes:", error);
        setResult({ line, routes: [], error });
      },
    );
  }, [line]);

  // Only trust results that belong to the requested line.
  const isCurrent = result.line === line;
  return {
    routes: isCurrent ? result.routes : [],
    loading: Boolean(line) && !isCurrent,
    error: isCurrent ? result.error : null,
  };
}
