import { collection, getDocs , query,
  where,
  getCountFromServer} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, database } from "../lib/firebase";

export const BUSES_COLLECTION = "buses";
export const ROUTES_COLLECTION = "routes";
export const USERS_COLLECTION = "users";


//get buses
export const getBuses = async () => {
  try {
    const snapshot = await getDocs(collection(db, BUSES_COLLECTION));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  } catch (error) {
    console.error("Failed to get buses:", error);
    throw error;
  }
};
//get routes from firestore
export const getRoutes = async () => {
  try {
    const snapshot = await getDocs(collection(db, ROUTES_COLLECTION));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  } catch (error) {
    console.error("Failed to get routes:", error);
    throw error;
  }
};

export const getConductorCount = async () => {
    //query to get all conductors
    const conductorQuery = query(collection(db,"users"),where("role","==","conductor"));
    try{
        const snapshot = await getCountFromServer(conductorQuery);
        const conductorCount = snapshot.data().count;
        return conductorCount;
    }catch(error){
        console.error("Failed to get Conductor count:", error)
    }
}

export const subscribeToActiveBuses = (callback) => {
  try {
    const activeBusesRef = ref(database, "activeBuses");

    // onValue() returns its own unsubscribe function — this is the
    // modular SDK API, distinct from the legacy off() pattern
    const unsubscribe = onValue(
      activeBusesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const buses = Object.values(data).sort((a, b) =>
          String(a.busId).localeCompare(String(b.busId)),
        );
        callback(buses);
      },
      (error) => {
        console.error("Failed to subscribe to active buses:", error);
        callback([]);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error("Failed to set up active buses subscription:", error);
    return () => {};
  }
};
