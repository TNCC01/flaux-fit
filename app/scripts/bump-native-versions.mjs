#!/usr/bin/env node
// Bump the Mac-local native project versions for FIT by Flaux.
// Survival's scripts/bump-native-versions.mjs, pointed at FIT's app/.
// app/android and app/ios are git-ignored, so a version bump cannot ride
// along in a branch; run this from the checkout that holds the native
// projects (normally ~/Documents/GitHub/flaux-fit) after merging the
// release branch.
//
//   node app/scripts/bump-native-versions.mjs --check
//   node app/scripts/bump-native-versions.mjs --version 1.0.0 --android-code 1 --ios-build 1   (first release)
//   node app/scripts/bump-native-versions.mjs --version 1.0.1 --android-code 2 --ios-build 2
//
// --check prints the current values and changes nothing. A bump refuses to
// move a number backwards. --root <path> points at another checkout's repo
// root (default: the repo this script lives in).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const ROOT = argOf("--root") || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GRADLE = join(ROOT, "app", "android", "app", "build.gradle");
const PBXPROJ = join(ROOT, "app", "ios", "App", "App.xcodeproj", "project.pbxproj");
const checkOnly = args.includes("--check");

for (const f of [GRADLE, PBXPROJ]) {
  if (!existsSync(f)) { console.error(`missing ${f}\n(native projects are Mac-local; run from the checkout that has them)`); process.exit(2); }
}
let gradle = readFileSync(GRADLE, "utf8");
let pbx = readFileSync(PBXPROJ, "utf8");
const cur = {
  androidCode: Number((gradle.match(/^\s*versionCode (\d+)\s*$/m) || [])[1]),
  androidName: (gradle.match(/^\s*versionName "([^"]+)"\s*$/m) || [])[1],
  iosVersion: (pbx.match(/MARKETING_VERSION = ([^;]+);/) || [])[1],
  iosBuild: Number((pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/) || [])[1]),
};
console.log(`on disk: Android versionCode ${cur.androidCode} / versionName ${cur.androidName}; iOS MARKETING_VERSION ${cur.iosVersion} / CURRENT_PROJECT_VERSION ${cur.iosBuild}`);
if (checkOnly) process.exit(0);

const version = argOf("--version");
const androidCode = Number(argOf("--android-code"));
const iosBuild = Number(argOf("--ios-build"));
if (!/^\d+\.\d+\.\d+$/.test(version || "") || !androidCode || !iosBuild) {
  console.error("usage: bump-native-versions.mjs [--root <repo>] --check | --version x.y.z --android-code <n> --ios-build <n>");
  process.exit(2);
}
// Fresh projects from `npx cap add` say 1.0, build 1: setting 1.0.0 (1)
// on them for the first release is the one bump that moves no number.
const first = androidCode === 1 && iosBuild === 1 && cur.androidCode === 1 && cur.iosBuild === 1;
if (androidCode <= cur.androidCode && !first) { console.error(`refusing: Android versionCode ${androidCode} is not above ${cur.androidCode}`); process.exit(1); }
if (iosBuild <= cur.iosBuild && !first) { console.error(`refusing: iOS build ${iosBuild} is not above ${cur.iosBuild}`); process.exit(1); }

gradle = gradle.replace(/^(\s*versionCode )\d+(\s*)$/m, `$1${androidCode}$2`).replace(/^(\s*versionName )"[^"]+"(\s*)$/m, `$1"${version}"$2`);
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`).replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${iosBuild};`);
writeFileSync(GRADLE, gradle);
writeFileSync(PBXPROJ, pbx);
const n = (pbx.match(/MARKETING_VERSION = /g) || []).length;
console.log(`bumped: Android versionCode ${androidCode} / versionName ${version}; iOS MARKETING_VERSION ${version} / CURRENT_PROJECT_VERSION ${iosBuild} (${n} build configurations)`);
