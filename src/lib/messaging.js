import { getMessaging, isSupported } from "firebase/messaging";
import { app } from "./firebase";

// Firebase Cloud Messaging (web push — "Bus X marked inoperable"). Only
// imported through utils/pushServices.js, which the shell loads dynamically,
// so the SDK isn't part of the first-load bundle. Resolves to null in
// browsers without push support.
export const getMessagingIfSupported = async () => ((await isSupported()) ? getMessaging(app) : null);
