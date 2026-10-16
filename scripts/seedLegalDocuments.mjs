// Uploads the NEX legal documents (Terms & Conditions, Privacy Policy) to
// Firestore legalDocuments/{docId}. The source of truth is the JSON bundled in
// the NEX app (NEX/src/constants/legal/*.json), so the app's offline copy and
// the live copy never drift apart.
//
// Clients can't write legalDocuments (firestore.rules), so this uses the Admin
// SDK from functions/node_modules (run `npm install` in functions/ first).
//
// Usage (from the nex-operator folder):
//   node scripts/seedLegalDocuments.mjs <path to NEX/src/constants/legal> --project <projectId> [--dry-run] [--allow-placeholders]
//
// Credentials: `gcloud auth application-default login`, or set
// GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.
//
// Safety:
//  - refuses to upload a document that still contains "[[TO BE CONFIRMED"
//    unless --allow-placeholders is passed (for a test project only);
//  - refuses to replace a document with a LOWER version, and skips one whose
//    version is unchanged but whose text differs (bump `version` — users only
//    re-accept when the version goes up).

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const DOC_IDS = ["terms_commuter", "terms_conductor", "privacy_policy"];
const PLACEHOLDER = "[[TO BE CONFIRMED";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const sourceDir = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--project");
const projectId = option("--project");
const dryRun = flag("--dry-run");
const allowPlaceholders = flag("--allow-placeholders");

if (!sourceDir || !projectId) {
  console.error("Usage: node scripts/seedLegalDocuments.mjs <NEX/src/constants/legal> --project <projectId> [--dry-run] [--allow-placeholders]");
  process.exit(1);
}

const sameContent = (a, b) =>
  JSON.stringify({ title: a.title, effectiveDate: a.effectiveDate, sections: a.sections, changes: a.changes ?? [] }) ===
  JSON.stringify({ title: b.title, effectiveDate: b.effectiveDate, sections: b.sections, changes: b.changes ?? [] });

function validate(docId, legalDoc) {
  if (legalDoc.docId !== docId) throw new Error(`${docId}: docId field is "${legalDoc.docId}"`);
  if (!Number.isInteger(legalDoc.version) || legalDoc.version < 1) throw new Error(`${docId}: version must be an integer ≥ 1`);
  if (typeof legalDoc.title !== "string" || !Array.isArray(legalDoc.sections) || legalDoc.sections.length === 0) {
    throw new Error(`${docId}: needs a title and sections`);
  }
  for (const section of legalDoc.sections) {
    if (typeof section.heading !== "string" || !Array.isArray(section.body)) {
      throw new Error(`${docId}: every section needs a heading and a body array`);
    }
  }
  if (!allowPlaceholders && JSON.stringify(legalDoc).includes(PLACEHOLDER)) {
    throw new Error(`${docId}: still contains ${PLACEHOLDER} ...]] placeholders (pass --allow-placeholders for a test project)`);
  }
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

let failed = false;
for (const docId of DOC_IDS) {
  try {
    const legalDoc = JSON.parse(await readFile(path.resolve(sourceDir, `${docId}.json`), "utf8"));
    validate(docId, legalDoc);

    const ref = db.collection("legalDocuments").doc(docId);
    const current = (await ref.get()).data();
    if (current && current.version > legalDoc.version) {
      throw new Error(`${docId}: Firestore has version ${current.version}, the file has ${legalDoc.version} — refusing to go back`);
    }
    if (current && current.version === legalDoc.version) {
      console.log(sameContent(current, legalDoc)
        ? `${docId}: v${legalDoc.version} already up to date`
        : `${docId}: SKIPPED — text changed but version is still ${legalDoc.version}; bump "version" so users are asked to accept it`);
      continue;
    }

    const data = {
      title: legalDoc.title,
      version: legalDoc.version,
      effectiveDate: legalDoc.effectiveDate,
      sections: legalDoc.sections,
      changes: legalDoc.changes ?? [],
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (dryRun) {
      console.log(`${docId}: would upload v${legalDoc.version} (${legalDoc.sections.length} sections)`);
    } else {
      await ref.set(data);
      console.log(`${docId}: uploaded v${legalDoc.version}`);
    }
  } catch (error) {
    failed = true;
    console.error(error.message);
  }
}
process.exit(failed ? 1 : 0);
