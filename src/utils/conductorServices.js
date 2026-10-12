import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../lib/firebase";
import { functions } from "../lib/functions";
import { USERS_COLLECTION } from "../lib/collections";

export const CONDUCTOR_EMAIL_DOMAIN = "nex.com";

// The Cloud Functions send back readable messages; fall back to a generic one
// for network / unexpected errors.
const toMessage = (error, fallback) => {
  if (error?.code === "functions/unavailable" || error?.code === "functions/deadline-exceeded") {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (error?.code === "functions/not-found" && /function/i.test(error?.message ?? "")) {
    return "Account management isn't set up yet (Cloud Functions not deployed).";
  }
  // Unhandled server errors arrive as code "internal" with the bare message "INTERNAL".
  return error?.message && !/^internal$/i.test(error.message) ? error.message : fallback;
};

const call = async (name, data, fallback) => {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (error) {
    console.error(`${name} failed:`, error);
    throw new Error(toMessage(error, fallback), { cause: error });
  }
};

// Creates the conductor's login (username@nex.com) and profile. Returns { uid, email }.
export const createConductor = ({ name, username, password }) =>
  call("createConductor", { name, username, password }, "Couldn't create the conductor account.");

// Sets a new temporary password; the conductor must change it at next login.
export const resetConductorPassword = (uid, password) =>
  call("resetConductorPassword", { uid, password }, "Couldn't reset the password.");

// Deletes the conductor's login and profile.
export const deleteConductor = (uid) =>
  call("deleteConductor", { uid }, "Couldn't delete the conductor.");

// Profile fields an operator can edit directly (allowed by firestore.rules).
export const updateConductor = async (uid, { name }) => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), { name: name.trim() });
  } catch (error) {
    console.error("Failed to update conductor:", error);
    throw new Error("Couldn't save the changes.", { cause: error });
  }
};

// Readable temporary password like "nex-7KQ4-M2PX" (no 0/O/1/I/L to avoid
// mix-ups when it's read out loud or copied by hand).
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const generateTempPassword = () => {
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]);
  return `nex-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
};
