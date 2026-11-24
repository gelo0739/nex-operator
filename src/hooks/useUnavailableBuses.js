import { useEffect, useMemo, useState } from "react";
import { subscribeToUnavailableBuses } from "../utils/unavailableBuses";

/**
 * Live list of buses on `line` marked unavailable (RTDB `unavailableBuses`,
 * see utils/unavailableBuses.js), newest first. Entries without a known
 * position (lat/lng null) are included — the map skips them, lists show them.
 */
export default function useUnavailableBuses(line) {
  const [buses, setBuses] = useState([]);

  useEffect(() => subscribeToUnavailableBuses(setBuses), []);

  return useMemo(() => (line ? buses.filter((bus) => bus.line === line) : []), [buses, line]);
}
