#!/usr/bin/env node
// Set FIT by Flaux's price to Free and fill in the age rating declaration
// via the ASC API. Survival's scripts/asc-price-age.mjs, pointed at FIT,
// with FIT's answers (see app/listing-kit.md, Age rating).
//   node app/scripts/asc-price-age.mjs --issuer <uuid>            (shows what's there)
//   node app/scripts/asc-price-age.mjs --issuer <uuid> --apply    (sets it)
import { api, args, APP_ID } from "./asc-common.mjs";

const apply = args.includes("--apply");

// --- 1. price: Free, base territory AUS ---
const points = await api("GET", `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=AUS&limit=1`);
const freePoint = points.data.find((p) => Number(p.attributes.customerPrice) === 0) || points.data[0];
console.log("price point", freePoint.id, freePoint.attributes.customerPrice);
if (apply) {
  await api("POST", `/v1/appPriceSchedules`, {
    data: {
      type: "appPriceSchedules",
      relationships: {
        app: { data: { type: "apps", id: APP_ID } },
        baseTerritory: { data: { type: "territories", id: "AUS" } },
        manualPrices: { data: [{ type: "appPrices", id: "${price1}" }] },
      },
    },
    included: [{
      type: "appPrices",
      id: "${price1}",
      attributes: { startDate: null },
      relationships: {
        appPricePoint: { data: { type: "appPricePoints", id: freePoint.id } },
      },
    }],
  });
  console.log("app price set to Free (base AUS)");
}

// --- 2. age rating declaration ---
// Everything none or no, except Health or Wellness Topics: Apple's
// definition includes "exercise recommendations", which is what FIT
// builds, so it's yes (Apple rates that 9+). FIT's line about checking
// with your doctor and its injury alternatives are not medical or
// treatment information (no diagnosis, no managing a condition).
const NONE_ENUMS = [
  "alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated",
  "gunsOrOtherWeapons", "medicalOrTreatmentInformation",
  "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity",
  "horrorOrFearThemes", "matureOrSuggestiveThemes", "violenceCartoonOrFantasy",
  "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic",
];
const FALSE_BOOLS = [
  "advertising", "gambling", "lootBox", "messagingAndChat", "parentalControls",
  "socialMedia", "unrestrictedWebAccess", "userGeneratedContent", "ageAssurance",
];
const TRUE_BOOLS = ["healthOrWellnessTopics"];

const infos = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
const info = infos.data.find((i) => i.attributes.state !== "READY_FOR_DISTRIBUTION") || infos.data[0];
const decl = await api("GET", `/v1/appInfos/${info.id}/ageRatingDeclaration`);
console.log("declaration id", decl.data.id);
console.log("current attrs", JSON.stringify(decl.data.attributes));
if (apply) {
  const attrs = {};
  for (const k of NONE_ENUMS) if (k in decl.data.attributes) attrs[k] = "NONE";
  for (const k of FALSE_BOOLS) if (k in decl.data.attributes) attrs[k] = false;
  for (const k of TRUE_BOOLS) if (k in decl.data.attributes) attrs[k] = true;
  await api("PATCH", `/v1/ageRatingDeclarations/${decl.data.id}`, {
    data: { type: "ageRatingDeclarations", id: decl.data.id, attributes: attrs },
  });
  console.log("age rating declaration set");
}
console.log("done");
