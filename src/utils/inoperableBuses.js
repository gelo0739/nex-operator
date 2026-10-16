import { ref, onValue } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { database } from "../lib/realtime";
import { functions } from "../lib/functions";

// RTDB `inoperableBuses/{busNumber}` — buses a conductor took out of service
// ("Mark as Inoperable" in the NEX app). Written only by the markBusInoperable
// Cloud Function; the NEX conductor map subscribes to the same node. Entry:
// { busId, conductorId, line, routeId, routeName, lat, lng
//   (null if unknown), status: "inoperable", inoperableAt (ms), reportId,
//   tripId, notifiedAt (ms | null), notifiedCount }.
// Calls `callback` with the list sorted by bus number (empty list on error).
// Returns the unsubscribe function. Line filtering happens in useInoperableBuses.
export const subscribeToInoperableBuses = (callback) => {
  try {
    return onValue(
      ref(database, "inoperableBuses"),
      (snapshot) => {
        const data = snapshot.val() || {};
        callback(Object.values(data).sort((a, b) => String(a.busId).localeCompare(String(b.busId))));
      },
      (error) => {
        console.error("Failed to subscribe to inoperable buses:", error);
        callback([]);
      },
    );
  } catch (error) {
    console.error("Failed to set up inoperable buses subscription:", error);
    return () => {};
  }
};

// The operator can't write RTDB directly — both changes go through callables.
const call = async (name, data, fallback) => {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (error) {
    console.error(`${name} failed:`, error);
    const message =
      error?.code === "functions/unavailable" || error?.code === "functions/deadline-exceeded"
        ? "Couldn't reach the server. Check your connection and try again."
        : error?.message && !/^internal$/i.test(error.message)
          ? error.message
          : fallback;
    throw new Error(message, { cause: error });
  }
};

// Manage Bus "Mark inoperable": takes a bus that isn't on a route out of
// service (no new trips) until it's returned to service. No 24 h expiry.
export const markBusInoperable = (busId) =>
  call("markBusInoperableByOperator", { busId }, "Couldn't mark the bus inoperable.");

// "Return to service" / "Mark operable": removes the bus's inoperable entry.
// Conductors can then start trips on it again.
export const clearInoperableBus = (busId) =>
  call("clearInoperableBus", { busId }, "Couldn't return the bus to service.");
