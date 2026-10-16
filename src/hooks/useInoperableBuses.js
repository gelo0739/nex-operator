import { useEffect, useMemo, useState } from "react";
import { subscribeToInoperableBuses } from "../utils/inoperableBuses";

/**
 * Buses on `busLine` that a conductor marked inoperable (RTDB
 * `inoperableBuses`, see utils/inoperableBuses.js). Entries without a known
 * position (lat/lng null) are included — the map skips them, lists show them.
 */
export default function useInoperableBuses(busLine) {
  const [buses, setBuses] = useState([]);

  useEffect(() => subscribeToInoperableBuses(setBuses), []);

  return useMemo(
    () => (busLine ? buses.filter((bus) => bus.line === busLine) : []),
    [buses, busLine],
  );
}
