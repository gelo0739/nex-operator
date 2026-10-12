import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export const MIN_PASSWORD_LENGTH = 8;

const MESSAGES = {
  "auth/invalid-credential": "Your current password is incorrect.",
  "auth/wrong-password": "Your current password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/weak-password": `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`,
  "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
  "auth/requires-recent-login": "Please sign out and sign back in, then try again.",
};

// Changes the signed-in operator's own password. Firebase requires a recent
// sign-in for this, so the current password is re-verified first. Other
// sessions of this account are signed out by Firebase; this one stays.
export const changeOwnPassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("You're signed out. Sign in again to change your password.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Failed to change password:", error);
    const message =
      MESSAGES[error?.code] ??
      (error?.code === "auth/password-does-not-meet-requirements"
        ? "That password doesn't meet the project's password policy."
        : "Couldn't change your password. Please try again.");
    throw new Error(message, { cause: error });
  }
};
