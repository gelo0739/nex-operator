// Callable Cloud Functions for operator-only account management.
//
// Creating another user's login, changing their password, or deleting their
// account needs the Admin SDK, which must never run in the browser. The
// dashboard calls these through httpsCallable (src/utils/conductorServices.js).
//
// Every function checks that the caller is an operator (users/{uid}.role ==
// "operator") and only touches conductors on that operator's bus line.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();

const USERS = "users";
const EMAIL_DOMAIN = "nex.com";
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

// Returns the calling operator's { uid, line }, or throws.
async function requireOperator(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  const snapshot = await db.collection(USERS).doc(request.auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.role !== "operator") {
    throw new HttpsError("permission-denied", "Only operators can manage conductor accounts.");
  }
  if (!profile.line) {
    throw new HttpsError("failed-precondition", "Your account has no bus line assigned.");
  }
  return { uid: request.auth.uid, line: profile.line };
}

// Loads a conductor on the operator's line, or throws.
async function requireConductor(uid, line) {
  if (typeof uid !== "string" || uid.length === 0) {
    throw new HttpsError("invalid-argument", "Missing conductor id.");
  }
  const ref = db.collection(USERS).doc(uid);
  const snapshot = await ref.get();
  const profile = snapshot.data();
  if (!profile || profile.role !== "conductor") {
    throw new HttpsError("not-found", "Conductor not found.");
  }
  if (profile.line !== line) {
    throw new HttpsError("permission-denied", "This conductor belongs to another bus line.");
  }
  return ref;
}

function requirePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

// Creates the conductor's login (username@nex.com) and their users/{uid}
// profile. The conductor must change the temporary password at first login.
export const createConductor = onCall(async (request) => {
  const operator = await requireOperator(request);
  const name = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  const username =
    typeof request.data?.username === "string" ? request.data.username.trim().toLowerCase() : "";
  const { password } = request.data ?? {};

  if (!name || name.length > 80) {
    throw new HttpsError("invalid-argument", "Enter the conductor's full name (max 80 characters).");
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpsError(
      "invalid-argument",
      "Username must be 3–30 characters: lowercase letters, numbers, dots, dashes or underscores.",
    );
  }
  requirePassword(password);

  const email = `${username}@${EMAIL_DOMAIN}`;

  let user;
  try {
    user = await auth.createUser({ email, password, displayName: name });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", `${email} is already taken.`);
    }
    if (error.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "That password isn't allowed. Try a longer one.");
    }
    throw new HttpsError("internal", "Couldn't create the login.");
  }

  try {
    await db.collection(USERS).doc(user.uid).set({
      email,
      name,
      role: "conductor",
      line: operator.line,
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: operator.uid,
    });
  } catch {
    // Don't leave a login behind without a profile.
    await auth.deleteUser(user.uid).catch(() => {});
    throw new HttpsError("internal", "Couldn't save the conductor profile.");
  }

  return { uid: user.uid, email };
});

// Sets a new temporary password, signs the conductor out of every device,
// and makes them choose their own password at next login.
export const resetConductorPassword = onCall(async (request) => {
  const operator = await requireOperator(request);
  const { uid, password } = request.data ?? {};
  const ref = await requireConductor(uid, operator.line);
  requirePassword(password);

  try {
    await auth.updateUser(uid, { password });
    await auth.revokeRefreshTokens(uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "This conductor has no login account.");
    }
    throw new HttpsError("internal", "Couldn't reset the password.");
  }

  await ref.update({ mustChangePassword: true, passwordResetAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

// Deletes the conductor's login and profile.
export const deleteConductor = onCall(async (request) => {
  const operator = await requireOperator(request);
  const { uid } = request.data ?? {};
  const ref = await requireConductor(uid, operator.line);

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    // Already gone from Auth: still remove the profile.
    if (error.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "Couldn't delete the login.");
    }
  }

  await ref.delete();
  return { ok: true };
});
