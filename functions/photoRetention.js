// Scheduled clean-up of passenger photos (privacy + storage cost).
//
// Retention policy:
//  - Feedback ticket photos: deleted 180 days after the feedback was sent.
//  - Lost-item photos: kept while the report is open; deleted 180 days after
//    it was resolved (`resolvedAt`), or 365 days after it was filed at most.
//
// Docs that still hold photos carry `hasPhotos: true` (set by the NEX app), so
// each run only reads docs that actually need work. After deleting the files
// the doc's photo fields are cleared, so nothing points at a missing file.

import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;
const FEEDBACK_RETENTION_DAYS = 180;
const LOST_ITEM_AFTER_RESOLVED_DAYS = 180;
const LOST_ITEM_MAX_DAYS = 365;
const ORPHAN_MAX_DAYS = 366;
const BATCH_SIZE = 200;
const PHOTO_PREFIXES = ["feedback/", "lost_items/", "tickets/"];
// Set explicitly: this module is evaluated before index.js calls
// setGlobalOptions, so the global region would not apply here.
const REGION = "asia-southeast1";

const PHOTO_FIELDS = {
  service_feedbacks: { paths: ["ticketPhotoPath"], urls: ["ticketPhotoUrl"] },
  lost_item_reports: { paths: ["photoPath", "ticketPhotoPath"], urls: ["photoUrl", "ticketPhotoUrl"] },
};

const daysAgo = (days) => Timestamp.fromMillis(Date.now() - days * DAY_MS);

// Legacy docs store a token download URL:
//   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=…
// Returns the object path if the URL points at our bucket, else null.
export function pathFromDownloadUrl(url, bucketName) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
  if (!match || match[1] !== bucketName) return null;
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

export async function deleteFile(bucket, path) {
  try {
    await bucket.file(path).delete();
    return true;
  } catch (error) {
    if (error.code === 404) return false; // already gone
    throw error;
  }
}

// Deletes every photo a doc references, then clears its photo fields.
async function purgeDocPhotos(docSnap, fields, bucket) {
  const data = docSnap.data();
  const paths = new Set();
  for (const field of fields.paths) if (typeof data[field] === "string") paths.add(data[field]);
  for (const field of fields.urls) {
    const path = pathFromDownloadUrl(data[field], bucket.name);
    if (path) paths.add(path);
  }

  for (const path of paths) await deleteFile(bucket, path);

  const patch = { hasPhotos: false, photosPurgedAt: FieldValue.serverTimestamp() };
  for (const field of [...fields.paths, ...fields.urls]) {
    if (field in data) patch[field] = null;
  }
  await docSnap.ref.update(patch);
  return paths.size;
}

async function purgeQuery(collection, dateField, cutoff, bucket) {
  const snapshot = await getFirestore()
    .collection(collection)
    .where("hasPhotos", "==", true)
    .where(dateField, "<", cutoff)
    .limit(BATCH_SIZE)
    .get();

  let files = 0;
  for (const docSnap of snapshot.docs) {
    try {
      files += await purgeDocPhotos(docSnap, PHOTO_FIELDS[collection], bucket);
    } catch (error) {
      logger.error(`Failed to purge photos for ${collection}/${docSnap.id}`, error);
    }
  }
  return { docs: snapshot.size, files };
}

// Daily at 03:00 Manila time.
export const purgeOldPhotos = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Asia/Manila", region: REGION, timeoutSeconds: 540 },
  async () => {
    const bucket = getStorage().bucket();
    const results = {
      feedback: await purgeQuery("service_feedbacks", "createdAt", daysAgo(FEEDBACK_RETENTION_DAYS), bucket),
      lostItemsResolved: await purgeQuery(
        "lost_item_reports",
        "resolvedAt",
        daysAgo(LOST_ITEM_AFTER_RESOLVED_DAYS),
        bucket,
      ),
      lostItemsExpired: await purgeQuery("lost_item_reports", "createdAt", daysAgo(LOST_ITEM_MAX_DAYS), bucket),
    };
    logger.info("purgeOldPhotos finished", results);
  },
);

// Weekly backstop: removes photo files older than a year that no doc purged —
// e.g. uploads whose Firestore write never happened.
export const purgeOrphanPhotos = onSchedule(
  { schedule: "30 3 * * 0", timeZone: "Asia/Manila", region: REGION, timeoutSeconds: 540 },
  async () => {
    const bucket = getStorage().bucket();
    const cutoff = Date.now() - ORPHAN_MAX_DAYS * DAY_MS;
    let deleted = 0;
    for (const prefix of PHOTO_PREFIXES) {
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) {
        const created = Date.parse(file.metadata?.timeCreated ?? "");
        if (Number.isFinite(created) && created < cutoff) {
          if (await deleteFile(bucket, file.name)) deleted += 1;
        }
      }
    }
    logger.info("purgeOrphanPhotos finished", { deleted });
  },
);
