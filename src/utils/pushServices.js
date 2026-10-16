import { deleteField, doc, FieldPath, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db } from "../lib/firebase";
import { getMessagingIfSupported } from "../lib/messaging";

// Web push for operators. The markBusInoperable Cloud Function pushes "Bus X
// marked inoperable" to every token of the line's operators and conductors,
// read from Firestore push_tokens/{uid} ({ tokens: { <token>: { platform,
// updatedAt } } } — writable by its owner, readable by nobody but the Admin SDK).
//
// Loaded dynamically by AppShell (and AuthContext on sign-out) — keep it out
// of anything the shell imports statically.

export const VAPID_KEY = import.meta.env.VITE_PUBLIC_FIREBASE_VAPID_KEY;
const TOKEN_STORAGE_KEY = "nex_push_token"; // this browser's registered token
const PUSH_TOKENS = "push_tokens";
const SW_PATH = "/firebase-messaging-sw.js";

const readStored = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeStored = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // storage blocked — the token just won't be cleaned up on sign-out
  }
};

const removeToken = (uid, token) =>
  updateDoc(doc(db, PUSH_TOKENS, uid), new FieldPath("tokens", token), deleteField(), "updatedAt", serverTimestamp());

// The service worker can't read Vite env, so it gets the Firebase config in
// its URL (these values are public client config, not secrets).
const registerServiceWorker = () => {
  const env = import.meta.env;
  const params = new URLSearchParams({
    apiKey: env.VITE_PUBLIC_FIREBASE_API_KEY ?? "",
    projectId: env.VITE_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: env.VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.VITE_PUBLIC_FIREBASE_APP_ID ?? "",
  });
  return navigator.serviceWorker.register(`${SW_PATH}?${params}`);
};

let stopForeground = null;

// While the dashboard tab is focused FCM doesn't show anything itself.
function showForegroundNotification(payload) {
  const { title, body } = payload?.notification ?? {};
  if (!title || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.svg",
      tag: payload.data?.busId ? `inoperable-${payload.data.busId}` : undefined,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (window.location.pathname !== "/dashboard") window.location.assign("/dashboard");
    };
  } catch (error) {
    console.warn("Could not show notification:", error);
  }
}

/**
 * Registers this browser for pushes and saves its token. Returns the
 * resulting permission: "granted" | "default" | "denied" | "unsupported".
 * Pass `{ prompt: true }` only from a click — browsers ignore or penalise
 * permission prompts that aren't triggered by the user.
 */
export async function enableWebPush(uid, { prompt = false } = {}) {
  if (!uid || !VAPID_KEY || !("serviceWorker" in navigator) || typeof Notification === "undefined") {
    return "unsupported";
  }
  const messaging = await getMessagingIfSupported();
  if (!messaging) return "unsupported";

  let permission = Notification.permission;
  if (permission === "default" && prompt) permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const registration = await registerServiceWorker();
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return "unsupported";

  await setDoc(
    doc(db, PUSH_TOKENS, uid),
    { tokens: { [token]: { platform: "web", updatedAt: serverTimestamp() } }, updatedAt: serverTimestamp() },
    { merge: true },
  );
  const previous = readStored();
  writeStored(token);
  if (previous && previous !== token) removeToken(uid, previous).catch(() => {});

  if (!stopForeground) stopForeground = onMessage(messaging, showForegroundNotification);
  return "granted";
}

// Sign-out: this browser stops receiving the account's pushes. Never throws.
export async function disableWebPush(uid) {
  stopForeground?.();
  stopForeground = null;
  const token = readStored();
  writeStored(null);
  if (!uid || !token) return;
  try {
    await removeToken(uid, token);
  } catch (error) {
    console.warn("Could not remove push token:", error);
  }
}

// True when this browser has a token registered (so sign-out has work to do).
export const hasStoredPushToken = () => Boolean(readStored());
