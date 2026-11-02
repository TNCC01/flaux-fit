#!/usr/bin/env node
// Set up TestFlight internal testing for FIT by Flaux and invite a tester
// (Wayne). Survival's scripts/asc-testflight.mjs, pointed at FIT.
//   node app/scripts/asc-testflight.mjs --issuer <uuid> --email <appleid-email>
import { api, argOf, APP_ID } from "./asc-common.mjs";

const email = argOf("--email");
if (!email) { console.error("usage: asc-testflight.mjs --issuer <uuid> --email <appleid-email> [--app <id>]"); process.exit(2); }

// internal beta group (create if missing)
const groups = await api("GET", `/v1/apps/${APP_ID}/betaGroups`);
let group = groups.data.find((g) => g.attributes.isInternalGroup);
if (!group) {
  const created = await api("POST", `/v1/betaGroups`, {
    data: {
      type: "betaGroups",
      attributes: { name: "Internal", isInternalGroup: true, hasAccessToAllBuilds: true },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  group = created.data;
  console.log("created internal group", group.id);
} else {
  console.log("internal group", group.attributes.name, group.id, "allBuilds:", group.attributes.hasAccessToAllBuilds);
}

// invite the tester (internal testers must be ASC users; this links the user)
try {
  const tester = await api("POST", `/v1/betaTesters`, {
    data: {
      type: "betaTesters",
      attributes: { email },
      relationships: { betaGroups: { data: [{ type: "betaGroups", id: group.id }] } },
    },
  });
  console.log("tester added", tester.data.attributes.email);
} catch (e) {
  console.log("tester add:", e.message.slice(0, 200));
}
console.log("done");
