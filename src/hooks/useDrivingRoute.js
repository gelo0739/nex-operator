import { useEffect, useState } from "react";
import { fetchDrivingRoute } from "../utils/directions";

const DEBOUNCE_MS = 500;

/**
 * Calculates the road-following route through start → waypoints → end,
 * waiting until the points have stopped changing for DEBOUNCE_MS (e.g. while
 * a marker is being dragged or list rows are being reordered).
 *
 * Returns { route, loading, error }. `route` is the last calculated result
 * ({ coordinates, distanceMeters, durationSeconds }), kept on screen while a
 * newer one loads; `loading` is true until the result matches the current
 * points, so callers can block saving a stale route.
 */
export default function useDrivingRoute(start, end, waypoints, enabled = true) {
  const points = start && end ? [start, ...waypoints, end] : null;
  // Only coordinates matter for routing; renaming a stop must not refetch.
  const key = enabled && points ? points.map((p) => `${p.lat},${p.lng}`).join("|") : null;

  const [result, setResult] = useState({ key: null, route: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;

    const timer = setTimeout(async () => {
      const coords = key.split("|").map((pair) => {
        const [lat, lng] = pair.split(",").map(Number);
        return { lat, lng };
      });
      try {
        const route = await fetchDrivingRoute(coords[0], coords[coords.length - 1], coords.slice(1, -1));
        if (!cancelled) setResult({ key, route, error: null });
      } catch (error) {
        console.error("Failed to calculate route:", error);
        if (!cancelled) setResult({ key, route: null, error });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  const isCurrent = key !== null && result.key === key;
  return {
    route: key ? result.route : null,
    loading: key !== null && !isCurrent,
    error: isCurrent ? result.error : null,
  };
}
