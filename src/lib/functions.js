import { getFunctions } from "firebase/functions";
import { app } from "./firebase";

// Callable Cloud Functions — must match the region in functions/index.js.
export const functions = getFunctions(app, "asia-southeast1");
