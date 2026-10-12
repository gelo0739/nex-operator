import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LOST_ITEMS_COLLECTION } from "../utils/lostItems";

/**
 * A cheap "something changed" signal for lost-item reports on a line, so the
 * page's server-side counts stay live without listening to every report.
 *
 * Two listeners, one document each:
 *  - the most recent status change (orderBy statusUpdatedAt desc, limit 1) —
 *    fires when any operator (any tab) updates a report;
 *  - the newest report (orderBy createdAt desc, limit 1) — fires when the NEX
 *    app files a new one.
 *
 * Returns { version, changed }: `version` increments on every change after the
 * first snapshot (use it to re-run counts); `changed` maps report id → latest
 * data for every report whose status changed since mount (to patch visible rows).
 */
const EMPTY = { version: 0, changed: {} };

export default function useLostItemChanges(line) {
  const [signal, setSignal] = useState({ line: null, version: 0, changed: {} });

  useEffect(() => {
    if (!line) return undefined;
    const reports = collection(db, LOST_ITEMS_COLLECTION);
    const seen = { status: false, created: false };

    const listen = (name, q, isStatusChange) =>
      onSnapshot(
        q,
        (snapshot) => {
          // The first snapshot is the current state, not a change.
          if (!seen[name]) {
            seen[name] = true;
            return;
          }
          const d = snapshot.docs[0];
          setSignal((prev) => {
            const base = prev.line === line ? prev : { version: 0, changed: {} };
            return {
              line,
              version: base.version + 1,
              changed: isStatusChange && d ? { ...base.changed, [d.id]: { id: d.id, ...d.data() } } : base.changed,
            };
          });
        },
        (error) => console.error(`Lost item ${name} listener failed:`, error),
      );

    const unsubStatus = listen(
      "status",
      query(reports, where("line", "==", line), orderBy("statusUpdatedAt", "desc"), limit(1)),
      true,
    );
    const unsubCreated = listen(
      "created",
      query(reports, where("line", "==", line), orderBy("createdAt", "desc"), limit(1)),
      false,
    );
    return () => {
      unsubStatus();
      unsubCreated();
    };
  }, [line]);

  return signal.line === line ? signal : EMPTY;
}
