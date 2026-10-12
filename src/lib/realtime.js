import { getDatabase } from "firebase/database";
import { app } from "./firebase";

// Realtime Database (live bus positions: activeBuses).
export const database = getDatabase(app);
