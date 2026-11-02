#!/usr/bin/env node
// Play Console publisher for FIT by Flaux via the Android Publisher API.
// Survival's scripts/play-publish.mjs, pointed at FIT. FIT is free with
// nothing to buy, so Survival's create-iap is left out.
//   node app/scripts/play-publish.mjs upload-aab                      -> internal testing
//   node app/scripts/play-publish.mjs promote <versionCode> [notesFile] -> production
//   node app/scripts/play-publish.mjs upload-graphics
// Auth: a service account JSON at app/keys/fit-*.json (git-ignored), with
// release access to the app in Play Console (see app/README.md).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "au.com.flaux.fit.app";
const KEYS = join(APP, "keys");
const saFile = existsSync(KEYS) && readdirSync(KEYS).find((f) => /^fit-.*\.json$/.test(f));
if (!saFile) { console.error(`No service account key: put it at ${KEYS}/fit-<anything>.json`); process.exit(2); }
const sa = JSON.parse(readFileSync(join(KEYS, saFile), "utf8"));

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: "RS256", typ: "JWT" });
  const body = b64u({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  });
  const s = createSign("RSA-SHA256"); s.update(`${head}.${body}`);
  const jwt = `${head}.${body}.${s.sign(sa.private_key).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const d = await res.json();
  if (!d.access_token) throw new Error("token: " + JSON.stringify(d));
  return d.access_token;
}

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;
let TOK;
async function api(method, url, body, contentType) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOK}`,
      "Content-Type": contentType || "application/json",
    },
    body: body ? (contentType ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const cmd = process.argv[2];
if (!["upload-aab", "promote", "upload-graphics"].includes(cmd)) {
  console.error("usage: play-publish.mjs upload-aab | promote <versionCode> [notesFile] | upload-graphics");
  process.exit(2);
}
TOK = await token();

if (cmd === "upload-aab") {
  const edit = await api("POST", `${API}/edits`);
  console.log("edit", edit.id);
  const aab = readFileSync(join(APP, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab"));
  const bundle = await api("POST", `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, aab, "application/octet-stream");
  console.log("bundle versionCode", bundle.versionCode);
  await api("PUT", `${API}/edits/${edit.id}/tracks/internal`, {
    track: "internal",
    releases: [{ status: "completed", versionCodes: [String(bundle.versionCode)] }],
  });
  const committed = await api("POST", `${API}/edits/${edit.id}:commit`);
  console.log("committed edit", committed.id);
} else if (cmd === "promote") {
  // promote <versionCode> [notesFile] - full rollout of an already-uploaded bundle to production
  const vc = process.argv[3];
  if (!vc) { console.error("usage: play-publish.mjs promote <versionCode> [notesFile]"); process.exit(2); }
  const notesFile = process.argv[4];
  const release = { status: "completed", versionCodes: [String(vc)] };
  if (notesFile) {
    release.releaseNotes = [{ language: "en-AU", text: readFileSync(notesFile, "utf8").trim() }];
  }
  const edit = await api("POST", `${API}/edits`);
  console.log("edit", edit.id);
  await api("PUT", `${API}/edits/${edit.id}/tracks/production`, {
    track: "production",
    releases: [release],
  });
  const committed = await api("POST", `${API}/edits/${edit.id}:commit`);
  console.log("PROMOTED versionCode", vc, "to production (edit", committed.id + ")");
} else if (cmd === "upload-graphics") {
  // the files listed under Play Console in app/listing-kit.md
  const edit = await api("POST", `${API}/edits`);
  const lang = "en-AU";
  const S = join(APP, "store-assets");
  const put = async (type, file) => {
    const bytes = readFileSync(file);
    const r = await api("POST", `${UPLOAD}/edits/${edit.id}/listings/${lang}/${type}?uploadType=media`, bytes, "image/png");
    console.log(type, r.image ? "ok" : JSON.stringify(r).slice(0, 80));
  };
  await put("icon", join(S, "play-icon-512.png"));
  await put("featureGraphic", join(S, "feature-graphic-1024x500.png"));
  const SHOTS = ["1-home", "2-workout", "3-two-people", "4-finish", "5-move"];
  for (const n of SHOTS) await put("phoneScreenshots", join(S, "shots", `phone-${n}.png`));
  for (const n of SHOTS) {
    await put("tenInchScreenshots", join(S, "shots", `ipad13-${n}.png`));
    await put("sevenInchScreenshots", join(S, "shots", `ipad13-${n}.png`));
  }
  const committed = await api("POST", `${API}/edits/${edit.id}:commit`);
  console.log("committed edit", committed.id);
}
