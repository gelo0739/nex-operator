import { useEffect, useState } from "react";
import { collection, onSnapshot,query,where } from "firebase/firestore";
import { db } from "../lib/firebase";

export default  function usePendinglostItemCount(){
    const [pendingLostItemCount,setPendingLostItemCount] = useState(0);

     useEffect(() => {
    const lostItemRef = collection(db, "lost_item_reports");
    
    const pendingQuery = query(lostItemRef,where("status","==","PENDING"));

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      setPendingLostItemCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  return pendingLostItemCount;
}
