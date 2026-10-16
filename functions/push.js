// FCM sending shared by the inoperable-bus alerts (inoperableBuses.js) and
// Notify on Arrival (arrivalWatches.js).
//
// Tokens live in Firestore push_tokens/{uid} ({ tokens: { <token>: { platform,
// updatedAt } }, updatedAt }), written by each user's own app and readable by
// no client — only these functions read them.

import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";

export const PUSH_TOKENS = "push_tokens";
const FCM_BATCH_SIZE = 500;

// Tokens that will never work again — removed from push_tokens.
const DEAD_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// [{ uid, token }] for every token the given users registered (duplicates
// dropped).
export async function collectTokens(uids) {
  const unique = [...new Set(uids)].filter((uid) => typeof uid === "string" && uid);
  if (unique.length === 0) return [];
  const db = getFirestore();
  const snapshots = await db.getAll(...unique.map((uid) => db.collection(PUSH_TOKENS).doc(uid)));
  const seen = new Set();
  const entries = [];
  for (const snapshot of snapshots) {
    const tokens = snapshot.get("tokens");
    if (!tokens || typeof tokens !== "object") continue;
    for (const token of Object.keys(tokens)) {
      if (seen.has(token)) continue;
      seen.add(token);
      entries.push({ uid: snapshot.id, token });
    }
  }
  return entries;
}

// Sends `message` to every entry; prunes dead tokens. Returns the success count.
export async function sendToEntries(entries, message) {
  const messaging = getMessaging();
  const db = getFirestore();
  let successCount = 0;
  const dead = [];

  for (let i = 0; i < entries.length; i += FCM_BATCH_SIZE) {
    const batch = entries.slice(i, i + FCM_BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      ...message,
      tokens: batch.map((entry) => entry.token),
    });
    successCount += response.successCount;
    response.responses.forEach((result, index) => {
      if (!result.success && DEAD_TOKEN_ERRORS.has(result.error?.code)) dead.push(batch[index]);
    });
  }

  await Promise.all(
    dead.map(({ uid, token }) =>
      db
        .collection(PUSH_TOKENS)
        .doc(uid)
        .update(new FieldPath("tokens", token), FieldValue.delete())
        .catch((error) => logger.warn("Could not prune push token", { uid, error: error.message })),
    ),
  );
  if (dead.length > 0) logger.info(`Pruned ${dead.length} dead push token(s).`);

  return successCount;
}
