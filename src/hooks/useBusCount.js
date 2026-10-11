
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function useBusCount() {
  const [busCount, setBusCount] = useState(0);

  useEffect(() => {
    const busesRef = collection(db, "buses");

    const unsubscribe = onSnapshot(busesRef, (snapshot) => {
      setBusCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  return busCount;
}

