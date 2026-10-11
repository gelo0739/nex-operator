import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../lib/firebase";

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export default function useActiveBusCount() {
  const [activeBusCount, setActiveBusCount] = useState(0);

  useEffect(() => {
    const activeBusesRef = ref(database, "activeBuses");

    const unsubscribe = onValue(activeBusesRef, (snapshot) => {
      const buses = snapshot.val();

      if (!buses) {
        setActiveBusCount(0);
        return;
      }

      const now = Date.now();

      const count = Object.values(buses).filter((bus) => {
        const isActive = bus.status === "active";
        const isRecent =
          bus.lastUpdated &&
          now - bus.lastUpdated <= STALE_THRESHOLD;

        return isActive && isRecent;
      }).length;

      setActiveBusCount(count);
    });

    return () => unsubscribe();
  }, []);

  return activeBusCount;
}
