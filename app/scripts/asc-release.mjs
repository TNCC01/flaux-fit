#!/usr/bin/env node
// App Store Connect release tool for FIT by Flaux. No browser needed.
// Survival's scripts/asc-release.mjs, pointed at FIT (see asc-common.mjs
// for the app id and the key).
//
//   node app/scripts/asc-release.mjs status --issuer <ISSUER_UUID>
//   node app/scripts/asc-release.mjs ship   --issuer <ISSUER_UUID> --build 2 [--version 1.0.1] [--notes app/whats-new-1.0.1.txt]
//
// "status" shows the editable version and recent builds. "ship" attaches the
// given build to the editable version (creating --version if none is
// editable), sets What's New from --notes, declares no non-exempt
// encryption on the build if undeclared, and submits the version for App
// Review.

import { readFileSync } from "node:fs";
import { api, argOf, args, APP_ID } from "./asc-common.mjs";

const cmd = args[0];
const wantBuild = argOf("--build");
const wantVersion = argOf("--version"); // create this version if none is editable
const notesPath = argOf("--notes");     // file whose text becomes What's New
if (!["status", "ship"].includes(cmd) || (cmd === "ship" && !wantBuild)) {
  console.error("usage: asc-release.mjs status|ship --issuer <uuid> [--app <id>] [--build <n>] [--version <x.y.z>] [--notes <file>]");
  process.exit(2);
}

// --- lookups ---
async function editableVersion() {
  const states = "PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED,INVALID_BINARY";
  const r = await api(
    "GET",
    `/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=${states}&limit=5&fields[appStoreVersions]=versionString,appStoreState`
  );
  return r.data[0];
}
async function recentBuilds() {
  const r = await api(
    "GET",
    `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,usesNonExemptEncryption,expired`
  );
  return r.data;
}

if (cmd === "status") {
  const v = await editableVersion();
  console.log(
    v
      ? `Editable version: ${v.attributes.versionString} [${v.attributes.appStoreState}] (id ${v.id})`
      : "No editable version (nothing in Prepare for Submission)."
  );
  for (const b of await recentBuilds()) {
    const a = b.attributes;
    console.log(`  build ${a.version}  ${a.processingState}${a.expired ? " EXPIRED" : ""}  nonExemptEncryption=${a.usesNonExemptEncryption}`);
  }
  process.exit(0);
}

// --- ship ---
let v = await editableVersion();
if (!v && wantVersion) {
  const created = await api("POST", `/v1/appStoreVersions`, {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: wantVersion },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  v = created.data;
  console.log(`Created version ${wantVersion} (id ${v.id}).`);
}
if (!v) throw new Error("No editable App Store version found (pass --version x.y.z to create one).");
console.log(`Version: ${v.attributes.versionString} [${v.attributes.appStoreState || "new"}]`);

if (notesPath) {
  const whatsNew = readFileSync(notesPath, "utf8").trim();
  const locs = await api("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`);
  for (const loc of locs.data) {
    await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew } },
    });
    console.log(`What's New set for ${loc.attributes.locale}.`);
  }
}

const build = (await recentBuilds()).find((b) => b.attributes.version === String(wantBuild) && !b.attributes.expired);
if (!build) throw new Error(`Build ${wantBuild} not found among recent builds.`);
if (build.attributes.processingState !== "VALID")
  throw new Error(`Build ${wantBuild} is ${build.attributes.processingState}, not VALID yet - retry shortly.`);
console.log(`Build ${wantBuild}: VALID (id ${build.id})`);

await api("PATCH", `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: build.id } });
console.log(`Attached build ${wantBuild} to ${v.attributes.versionString}.`);

if (build.attributes.usesNonExemptEncryption === null) {
  await api("PATCH", `/v1/builds/${build.id}`, {
    data: { type: "builds", id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
  console.log("Declared: uses no non-exempt encryption.");
} else {
  console.log(`Encryption declaration already set (${build.attributes.usesNonExemptEncryption}).`);
}

// Reuse an open review submission if one exists, else create one.
let sub;
const open = await api("GET", `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW&limit=1`);
if (open.data.length) {
  sub = open.data[0];
  console.log(`Reusing open review submission ${sub.id}.`);
} else {
  const created = await api("POST", `/v1/reviewSubmissions`, {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  sub = created.data;
  console.log(`Created review submission ${sub.id}.`);
}

try {
  await api("POST", `/v1/reviewSubmissionItems`, {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
      },
    },
  });
  console.log("Added the version to the submission.");
} catch (e) {
  if (String(e).includes("STATE_ERROR") || String(e).includes("already")) console.log("Version already in the submission.");
  else throw e;
}

await api("PATCH", `/v1/reviewSubmissions/${sub.id}`, {
  data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } },
});
console.log(`SUBMITTED ${v.attributes.versionString} (build ${wantBuild}) for App Review.`);
