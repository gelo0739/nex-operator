// Report photos (feedback tickets, lost items). New reports store a private
// Storage path (readable only by the reporter and operators — storage.rules);
// reports from before the lockdown stored a public download URL.
export const resolvePhotoUrl = async (path, legacyUrl) => {
  if (path) {
    // Loaded on demand so the Storage SDK stays out of the always-loaded chunk.
    const [{ getDownloadURL, ref }, { storage }] = await Promise.all([import("firebase/storage"), import("../lib/storage")]);
    return getDownloadURL(ref(storage, path));
  }
  return legacyUrl ?? null;
};
