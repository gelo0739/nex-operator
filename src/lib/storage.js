import { getStorage } from "firebase/storage";
import { app } from "./firebase";

// Cloud Storage (private feedback / lost-item photos).
export const storage = getStorage(app);
