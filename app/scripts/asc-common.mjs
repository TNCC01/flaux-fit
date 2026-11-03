// What every App Store Connect script for FIT by Flaux shares: the app's
// id, and the API key. Survival's scripts each carried their own copy of
// this; FIT's keep it in one place, since the app id is still to come.
//
// The app id (a number like 6790217784) exists once the app is created in
// App Store Connect (see app/README.md, One-time setup): put it in FIT_ID
// below and commit it, as Survival's is in its scripts. Until then pass
// --app <id> to any script.
//
// Auth: the first AuthKey_<KEYID>.p8 in ~/.appstoreconnect/private_keys
// (the key ID comes from the file name), and --issuer <uuid>. The .p8
// never lives in the repo. Same key as Survival's (Flaux's team key).
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSign } from "node:crypto";

const FIT_ID = "REPLACE_WITH_ASC_APP_ID"; // FIT by Flaux, au.com.flaux.fit.app
export const BUNDLE_ID = "au.com.flaux.fit.app";
export const API = "https://api.appstoreconnect.apple.com";

const args = process.argv.slice(2);
export const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
export { args };

export const APP_ID = argOf("--app") || FIT_ID;
if (!/^\d+$/.test(APP_ID)) {
  console.error("No App Store Connect app id yet: create the app (README, One-time setup), then set FIT_ID in app/scripts/asc-common.mjs or pass --app <id>");
  process.exit(2);
}
const issuer = argOf("--issuer");
if (!issuer) {
  console.error("--issuer <uuid> is required (App Store Connect > Users and Access > Integrations)");
  process.exit(2);
}

// --- JWT (ES256, 15 min) ---
const keyDir = join(homedir(), ".appstoreconnect", "private_keys");
const keyFile = readdirSync(keyDir).find((f) => /^AuthKey_.+\.p8$/.test(f));
if (!keyFile) {
  console.error(`No AuthKey_*.p8 found in ${keyDir}`);
  process.exit(2);
}
const kid = keyFile.replace(/^AuthKey_/, "").replace(/\.p8$/, "");
const pem = readFileSync(join(keyDir, keyFile), "utf8");
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: "ES256", kid, typ: "JWT" });
  const body = b64u({ iss: issuer, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign({ key: pem, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

export async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail || e.title}`).join("; ");
    throw new Error(`${method} ${path} -> ${res.status}${detail ? ` (${detail})` : ""}`);
  }
  return json;
}
