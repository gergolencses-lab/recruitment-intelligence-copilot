// Egységteszt: syntheticReach determinisztikus geo-szűrése (nincs API-hívás).
// A client-alapú "insider" injektálás (kizárás-funkció) a geo-szűréstől függetlenül működik tovább.
import { gatherSynthetic } from "../core/reach/syntheticReach.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// 1) Nincs geoScope → mind a 17 jelölt visszajön (14 alap + 3 client-insider) — a meglévő viselkedés megmarad.
const all = await gatherSynthetic("", null);
ok("geoScope nélkül → mind a 17 jelölt visszajön (14 alap + 3 insider)", all.length === 17);

// 2) A client-alapú insider-injektálás (kizárás-funkció) NEM sérül a geo-szűréstől.
const withClient = await gatherSynthetic("Acme Kft", null);
ok("client paraméter → változatlanul beszúrja a nevesített insider jelölteket", withClient.some((c) => c.current_company === "Acme Kft"));

// 3) Szűk (HU-only) geo_scope → csak HU-jelöltek jönnek vissza, kevesebb, mint 17.
const huOnly = await gatherSynthetic("", {
  catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
});
ok("HU-only geo_scope → csak magyar helyszínű jelöltek", huOnly.every((c) => c.location.trim().toUpperCase().endsWith("HU")));
ok("HU-only geo_scope → szűkebb, mint a teljes pool", huOnly.length > 0 && huOnly.length < 17);

// 4) Több ország (HU + SK) → legalább egy SK jelölt is bekerül.
const huSk = await gatherSynthetic("", {
  catchment_places: [
    { place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" },
    { place: "Bratislava", country: "Slovakia", cross_border: true, note: "cross-border" },
  ],
});
ok("HU+SK geo_scope → tartalmaz SK jelöltet", huSk.some((c) => c.location.trim().toUpperCase().endsWith("SK")));

// 5) Ha a szűrt halmaz túl vékony (<3), essen vissza a teljes poolra (soha ne legyen üres demo).
const nothingMatches = await gatherSynthetic("", {
  catchment_places: [{ place: "Reykjavik", country: "Iceland", cross_border: false, note: "no match in pool" }],
});
ok("Nincs egyező ország → visszaesik a teljes (17-es) poolra (fail-open)", nothingMatches.length === 17);

// 6) PL-only geo_scope: csak 2 lengyel jelölt az alap poolban (Nowak, Wójcik).
// 2 < MIN_SYNTHETIC_RESULTS (3) → fallback teljes poolra + insiderek = 17.
const polandOnly = await gatherSynthetic("", {
  catchment_places: [{ place: "Warsaw", country: "Poland", cross_border: false, note: "test" }],
});
ok("PL-only geo_scope → csak 2 páldány az alap poolban, fallback teljes pool → 17", polandOnly.length === 17);

// 7) PL-only + Acme Kft: insiderek túl kell élniük a geo-szűrésnek,
// még akkor is, ha az alap pool a küszöb alatt van.
const polandAcme = await gatherSynthetic("Acme Kft", {
  catchment_places: [{ place: "Warsaw", country: "Poland", cross_border: false, note: "test" }],
});
ok("PL-only geo_scope + Acme Kft → insiderek túlélik a szűrést", polandAcme.some((c) => c.current_company === "Acme Kft"));
ok("PL-only + Acme Kft → teljes pool + insiderek = 17", polandAcme.length === 17);

// 6) A geo_scope.country mezőt a live LLM magyarul írja (pl. "Magyarország") — a szűrésnek
// ezt is fel kell ismernie, nem csak az angol elnevezéseket.
const hungarianNames = await gatherSynthetic("", {
  catchment_places: [{ place: "Budapest", country: "Magyarország", cross_border: false, note: "anchor, magyar nyelvű ország-mező" }],
});
ok("Magyar nyelvű ország-mező ('Magyarország') → csak magyar helyszínű jelöltek (nem esik vissza a teljes poolra)", hungarianNames.length > 0 && hungarianNames.length < 17 && hungarianNames.every((c) => c.location.trim().toUpperCase().endsWith("HU")));

const hungarianMulti = await gatherSynthetic("", {
  catchment_places: [
    { place: "Győr", country: "Magyarország", cross_border: false, note: "anchor" },
    { place: "Dunaszerdahely", country: "Szlovákia", cross_border: true, note: "határon-átnyúló" },
  ],
});
ok("Magyar nyelvű 'Szlovákia' is felismerve → SK jelölt is bekerül", hungarianMulti.some((c) => c.location.trim().toUpperCase().endsWith("SK")));

console.log("\nsyntheticReach geo-szűrés teszt kész.");
