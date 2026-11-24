// RTDB `unavailableBuses/{busNumber}` — buses taken out of service with
// "Mark as Unavailable" in the NEX conductor app. Written only by the deployed
// `markBusUnavailable` Cloud Function (clients can read, not write). Entry:
// { busId, conductorId, conductorName, line, routeId, routeName,
//   lat, lng (null if unknown), status: "unavailable", unavailableAt (ms),
//   reportId, tripId, notifiedAt, notifiedCount, source? ("operator") }.
// Kept until an operator returns the bus to service (clearUnavailableBus) or
// 24 h pass (expireUnavailableBuses, hourly).
//
// The notification bell (always loaded) uses this, so the RTDB and Functions
// SDKs are imported on demand to keep them out of the shell's chunk.

// Calls `callback` with the list sorted newest first (empty list on error).
// Returns the unsubscribe function. Line filtering happens in useUnavailableBuses.
export const subscribeToUnavailableBuses = (callback) => {
  let unsubscribe = () => {};
  let cancelled = false;

  Promise.all([import("firebase/database"), import("../lib/realtime")])
    .then(([{ ref, onValue }, { database }]) => {
      if (cancelled) return;
      unsubscribe = onValue(
        ref(database, "unavailableBuses"),
        (snapshot) => {
          const data = snapshot.val() || {};
          callback(
            Object.entries(data)
              .map(([key, entry]) => ({ ...entry, busId: entry?.busId || key }))
              .sort((a, b) => (b.unavailableAt ?? 0) - (a.unavailableAt ?? 0)),
          );
        },
        (error) => {
          console.error("Failed to subscribe to unavailable buses:", error);
          callback([]);
        },
      );
    })
    .catch((error) => {
      console.error("Failed to set up unavailable buses subscription:", error);
      callback([]);
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
};

// True when the entry has a usable map position.
export const hasPosition = (bus) => Number.isFinite(bus?.lat) && Number.isFinite(bus?.lng);

// "Return to service": the deployed clearUnavailableBus callable deletes the
// entry, so conductors can start trips on the bus again and the NEX app lifts
// its block. Operators can't write RTDB directly.
export const returnBusToService = async (busId) => {
  try {
    const [{ httpsCallable }, { functions }] = await Promise.all([
      import("firebase/functions"),
      import("../lib/functions"),
    ]);
    const result = await httpsCallable(functions, "clearUnavailableBus")({ busId });
    return result.data;
  } catch (error) {
    console.error("clearUnavailableBus failed:", error);
    const message =
      error?.code === "functions/unavailable" || error?.code === "functions/deadline-exceeded"
        ? "Couldn't reach the server. Check your connection and try again."
        : error?.message && !/^internal$/i.test(error.message)
          ? error.message
          : "Couldn't return the bus to service.";
    throw new Error(message, { cause: error });
  }
};
