// Commuter self-service account deletion (NEX app → Account → Delete Account;
// also what the public account-deletion page points to).
//
// Clients can't do this themselves: the rules forbid deleting users/*, and
// only operators may change or delete feedback, lost-item reports and photos.
//
// Retention (Privacy Policy §9): the commuter's login, profile, photos and the
// contact details in their lost-item reports are deleted. Their feedback and
// lost-item reports are kept for the operator's records, anonymized — the
// `userId` link is removed and `userDeleted: true` is set.
//
// Order matters, and every step can be repeated: photos first (paths are still
// readable from the docs on a retry), then the docs are anonymized, then the
// profile, and the login LAST — so a failure part-way leaves a working account
// the commuter can retry with, never a login without its data cleaned up. A
// retry after the profile is gone is still allowed (no role claim = commuter).

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deleteFile, pathFromDownloadUrl } from "./photoRetention.js";

// Set explicitly: this module is evaluated before index.js calls
// setGlobalOptions, so the global region would not apply here.
const REGION = "asia-southeast1";

// The app re-authenticates right before calling; an older sign-in is refused.
const RECENT_LOGIN_SECONDS = 5 * 60;
const BATCH_SIZE = 400;

// Fields removed from the commuter's docs. `paths` / `urls` are photo fields.
const ANONYMIZE = {
  service_feedbacks: {
    remove: ["userId", "ticketPhotoPath", "ticketPhotoUrl"],
    paths: ["ticketPhotoPath"],
    urls: ["ticketPhotoUrl"],
  },
  lost_item_reports: {
    remove: ["userId", "contactName", "contactPhone", "photoPath", "ticketPhotoPath", "photoUrl", "ticketPhotoUrl"],
    paths: ["photoPath", "ticketPhotoPath"],
    urls: ["photoUrl", "ticketPhotoUrl"],
  },
};
// Current private photo folders (storage.rules); legacy flat files are found
// through the docs' download URLs instead.
const PHOTO_PREFIXES = (uid) => [`feedback/${uid}/`, `lost_items/${uid}/`];

function photoPathsOf(data, fields, bucketName) {
  const paths = [];
  for (const field of fields.paths) if (typeof data[field] === "string") paths.push(data[field]);
  for (const field of fields.urls) {
    const path = pathFromDownloadUrl(data[field], bucketName);
    if (path) paths.push(path);
  }
  return paths;
}

function anonymizePatch(data, fields) {
  const patch = {
    hasPhotos: false,
    userDeleted: true,
    userDeletedAt: FieldValue.serverTimestamp(),
  };
  for (const field of fields.remove) {
    if (field in data) patch[field] = FieldValue.delete();
  }
  return patch;
}

async function commitInBatches(db, operations) {
  for (let start = 0; start < operations.length; start += BATCH_SIZE) {
    const batch = db.batch();
    for (const apply of operations.slice(start, start + BATCH_SIZE)) apply(batch);
    await batch.commit();
  }
}

export const deleteMyAccount = onCall({ region: REGION, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  const { uid, token } = request.auth;

  // Conductor accounts carry a role claim; they (and operators) are managed
  // from the dashboard, never deleted by their owner.
  if (token.role) {
    throw new HttpsError("permission-denied", "This account is managed by your operator.");
  }
  const authTime = Number(token.auth_time);
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
    throw new HttpsError("failed-precondition", "Please enter your password again to confirm.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const profile = (await userRef.get()).data();
  if (profile && profile.role !== "commuter") {
    throw new HttpsError("permission-denied", "This account is managed by your operator.");
  }

  try {
    const bucket = getStorage().bucket();
    const [feedback, lostItems, rateLimits, arrivalWatches] = await Promise.all([
      db.collection("service_feedbacks").where("userId", "==", uid).get(),
      db.collection("lost_item_reports").where("userId", "==", uid).get(),
      db.collection("feedback_rate_limits").where("uid", "==", uid).get(),
      // Notify on Arrival watches (boarding points) — see arrivalWatches.js
      db.collection("arrivalWatches").where("userId", "==", uid).get(),
    ]);

    // 1. photos
    const photoPaths = new Set();
    for (const docSnap of feedback.docs) {
      photoPathsOf(docSnap.data(), ANONYMIZE.service_feedbacks, bucket.name).forEach((p) => photoPaths.add(p));
    }
    for (const docSnap of lostItems.docs) {
      photoPathsOf(docSnap.data(), ANONYMIZE.lost_item_reports, bucket.name).forEach((p) => photoPaths.add(p));
    }
    for (const path of photoPaths) await deleteFile(bucket, path);
    for (const prefix of PHOTO_PREFIXES(uid)) await bucket.deleteFiles({ prefix });

    // 2. anonymize reports, drop rate limits, arrival watches and push tokens
    const operations = [
      ...feedback.docs.map((docSnap) => (batch) =>
        batch.update(docSnap.ref, anonymizePatch(docSnap.data(), ANONYMIZE.service_feedbacks))),
      ...lostItems.docs.map((docSnap) => (batch) =>
        batch.update(docSnap.ref, anonymizePatch(docSnap.data(), ANONYMIZE.lost_item_reports))),
      ...rateLimits.docs.map((docSnap) => (batch) => batch.delete(docSnap.ref)),
      ...arrivalWatches.docs.map((docSnap) => (batch) => batch.delete(docSnap.ref)),
      (batch) => batch.delete(db.collection("push_tokens").doc(uid)),
    ];
    await commitInBatches(db, operations);

    // 3. profile, then 4. login
    await userRef.delete();
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    logger.info("Commuter account deleted", {
      uid,
      feedback: feedback.size,
      lostItems: lostItems.size,
      arrivalWatches: arrivalWatches.size,
      photos: photoPaths.size,
    });
    return { ok: true };
  } catch (error) {
    logger.error("Account deletion failed", { uid, error: error.message });
    throw new HttpsError("internal", "Your account couldn't be deleted. It still exists — please try again.");
  }
});
