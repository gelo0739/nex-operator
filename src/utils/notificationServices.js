import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { USERS_COLLECTION } from "../lib/collections";

// Dismisses the bell's current notifications for this operator only: the bell
// then counts just feedback created after this moment. The feedback itself
// keeps its "new" review status. (firestore.rules lets users update their own
// doc as long as `role` / `line` are untouched.)
export const clearNotifications = async (uid) => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), { notificationsClearedAt: serverTimestamp() });
  } catch (error) {
    console.error("Failed to clear notifications:", error);
    throw new Error("Couldn't clear notifications.", { cause: error });
  }
};
