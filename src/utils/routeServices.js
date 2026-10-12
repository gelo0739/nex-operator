import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ROUTES_COLLECTION } from "./dashboardServices";

// get one route from firestore (null if it doesn't exist)
export const getRoute = async (routeId) => {
  try {
    const snapshot = await getDoc(doc(db, ROUTES_COLLECTION, routeId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    console.error("Failed to get route:", error);
    throw error;
  }
};

// add a new route to firestore, returns the new doc id
export const createRoute = async (data) => {
  try {
    const docRef = await addDoc(collection(db, ROUTES_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Failed to create route:", error);
    throw error;
  }
};

// update an existing route in firestore
export const updateRoute = async (routeId, data) => {
  try {
    await updateDoc(doc(db, ROUTES_COLLECTION, routeId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to update route:", error);
    throw error;
  }
};

// delete a route from firestore
export const deleteRoute = async (routeId) => {
  try {
    await deleteDoc(doc(db, ROUTES_COLLECTION, routeId));
  } catch (error) {
    console.error("Failed to delete route:", error);
    throw error;
  }
};
