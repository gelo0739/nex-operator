import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { BUSES_COLLECTION } from "../lib/collections";

// Writes to `buses` are operator-only and line-scoped (firestore.rules).
// busNumber and line can't change after creation: trips (busDocId + busNumber)
// and live tracking (RTDB activeBuses/{busNumber}) key on them.

const friendly = (error, fallback) =>
  error?.code === "permission-denied" ? "You don't have permission to change this bus." : fallback;

// Adds a bus to the operator's line. Bus numbers must be unique across ALL
// lines, because live tracking is keyed by the bus number alone.
export const createBus = async ({ busNumber, plateNumber, model }, line) => {
  let existing;
  try {
    existing = await getDocs(query(collection(db, BUSES_COLLECTION), where("busNumber", "==", busNumber), limit(1)));
  } catch (error) {
    console.error("Failed to check bus number:", error);
    throw new Error("Couldn't check the bus number. Please try again.", { cause: error });
  }
  if (!existing.empty) {
    const err = new Error(`${busNumber} already exists.`);
    err.field = "busNumber";
    throw err;
  }
  try {
    const ref = await addDoc(collection(db, BUSES_COLLECTION), {
      busNumber,
      plateNumber,
      model,
      line,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    console.error("Failed to create bus:", error);
    throw new Error(friendly(error, "Couldn't add the bus. Please try again."), { cause: error });
  }
};

// Only the plate number and model are editable.
export const updateBus = async (id, { plateNumber, model }) => {
  try {
    await updateDoc(doc(db, BUSES_COLLECTION, id), { plateNumber, model, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Failed to update bus:", error);
    throw new Error(friendly(error, "Couldn't save the changes. Please try again."), { cause: error });
  }
};

export const deleteBus = async (id) => {
  try {
    await deleteDoc(doc(db, BUSES_COLLECTION, id));
  } catch (error) {
    console.error("Failed to delete bus:", error);
    throw new Error(friendly(error, "Couldn't delete the bus. Please try again."), { cause: error });
  }
};
