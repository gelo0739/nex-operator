import { useEffect, useState } from "react";
import { subscribeToActiveBuses } from "../utils/dashboardServices";

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes — same rule as useActiveBusCount.js
const RECHECK_INTERVAL = 30 * 1000;

/**
 * Live RTDB `activeBuses`, keyed by conductor uid. Only buses with status
 * "active" that reported within the last 5 minutes count; the cutoff is
 * re-checked every 30 s so a bus that stops reporting drops off on its own.
 *
 * Returns Map<conductorId, { busId, routeId, routeName, lastUpdated }>.
 */
export default function useActiveBuses() {
  const [buses, setBuses] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeToActiveBuses(setBuses), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const byConductor = new Map();
  for (const bus of buses) {
    const fresh = bus.lastUpdated && now - bus.lastUpdated <= STALE_THRESHOLD;
    if (bus.status !== "active" || !fresh || !bus.conductorId) continue;
    const previous = byConductor.get(bus.conductorId);
    // If a conductor somehow shows on two buses, keep the latest report.
    if (!previous || bus.lastUpdated > previous.lastUpdated) {
      byConductor.set(bus.conductorId, {
        busId: bus.busId,
        routeId: bus.routeId ?? null,
        routeName: bus.routeName ?? null,
        lastUpdated: bus.lastUpdated,
      });
    }
  }
  return byConductor;
}
