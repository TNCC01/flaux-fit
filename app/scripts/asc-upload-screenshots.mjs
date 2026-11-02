#!/usr/bin/env node
// Upload App Store screenshots for FIT by Flaux via the ASC API.
// Survival's scripts/asc-upload-screenshots.mjs, pointed at FIT.
//
//   node app/scripts/asc-upload-screenshots.mjs --issuer <uuid> \
//     --set APP_IPHONE_67:file1.png,file2.png --set APP_IPAD_PRO_3GEN_129:...
//
// The display types FIT needs are in app/listing-kit.md (Screenshots).

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { api, args, APP_ID } from "./asc-common.mjs";

const sets = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--set") {
  const [type, list] = args[i + 1].split(":");
  sets.push({ type, files: list.split(",") });
}
if (!sets.length) { console.error("usage: --issuer <uuid> [--app <id>] --set TYPE:f1,f2"); process.exit(2); }

// find the editable version
const vers = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION&limit=1`);
const version = vers.data[0];
if (!version) throw new Error("no editable version");
console.log("version", version.attributes.versionString, version.id);

// localization (en-AU)
const locs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const loc = locs.data.find((l) => l.attributes.locale === "en-AU") || locs.data[0];
console.log("localization", loc.attributes.locale, loc.id);

for (const { type, files } of sets) {
  // reuse or create the screenshot set
  const existing = await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  let set = existing.data.find((s) => s.attributes.screenshotDisplayType === type);
  if (!set) {
    const created = await api("POST", `/v1/appScreenshotSets`, {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: type },
        relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } },
      },
    });
    set = created.data;
  }
  console.log("set", type, set.id);

  for (const file of files) {
    const bytes = readFileSync(file);
    const name = basename(file);
    const resv = await api("POST", `/v1/appScreenshots`, {
      data: {
        type: "appScreenshots",
        attributes: { fileName: name, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
      },
    });
    for (const op of resv.data.attributes.uploadOperations) {
      const chunk = bytes.subarray(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders) headers[h.name] = h.value;
      const up = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (!up.ok) throw new Error(`upload chunk failed ${up.status}`);
    }
    const md5 = createHash("md5").update(bytes).digest("hex");
    await api("PATCH", `/v1/appScreenshots/${resv.data.id}`, {
      data: { type: "appScreenshots", id: resv.data.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    console.log("uploaded", name);
  }
}
console.log("done");
