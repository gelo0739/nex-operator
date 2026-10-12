import { useEffect, useState } from "react";
import { subscribeToActiveBuses } from "../utils/activeBuses";

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes — a bus with no update for longer is not live
const RECHECK_INTERVAL = 30 * 1000;

/**
 * Live buses from RTDB `activeBuses`: status "active" and reported within the
 * last 5 minutes (re-checked every 30 s, so a bus that stops reporting drops
 * off on its own). Each entry:
 * { busId, conductorId, routeId, routeName, lat, lng, speed (km/h),
 *   tripStartedAt (ms | null), lastUpdated (ms) }.
 */
export default function useLiveBuses() {
  const [buses, setBuses] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeToActiveBuses(setBuses), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return buses.filter(
    (bus) =>
      bus.status === "active" &&
      typeof bus.lastUpdated === "number" &&
      now - bus.lastUpdated <= STALE_THRESHOLD &&
      Number.isFinite(bus.lat) &&
      Number.isFinite(bus.lng),
  );
}
