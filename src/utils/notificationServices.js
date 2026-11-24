import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";

// Dismisses the bell's current notifications for this operator only: the bell
// then counts just feedback created / buses marked unavailable after this
// moment. The feedback keeps its "new" review status and unavailable buses
// stay on the Fleet Overview map. (firestore.rules lets users update their own
// doc as long as `role` / `line` are untouched.)
export const clearNotifications = async (uid) => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), { notificationsClearedAt: serverTimestamp() });
  } catch (error) {
    console.error("Failed to clear notifications:", error);
    throw new Error("Couldn't clear notifications.", { cause: error });
  }
};
