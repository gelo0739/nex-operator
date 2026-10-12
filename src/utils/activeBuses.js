import { ref, onValue } from "firebase/database";
import { database } from "../lib/realtime";

// Live RTDB `activeBuses`, sorted by bus number. Calls `callback` with the
// full list on every change (an empty list on error). Returns the unsubscribe
// function. Freshness / status filtering happens in useLiveBuses.
export const subscribeToActiveBuses = (callback) => {
  try {
    return onValue(
      ref(database, "activeBuses"),
      (snapshot) => {
        const data = snapshot.val() || {};
        callback(Object.values(data).sort((a, b) => String(a.busId).localeCompare(String(b.busId))));
      },
      (error) => {
        console.error("Failed to subscribe to active buses:", error);
        callback([]);
      },
    );
  } catch (error) {
    console.error("Failed to set up active buses subscription:", error);
    return () => {};
  }
};
