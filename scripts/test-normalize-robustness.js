// Egységteszt: normalizeHits geo_fit-validáció (nincs élő API-hívás, brainAvailable csak akkor
// true, ha van kulcs — ez a teszt a nem-live ágat és a validációs logikát célozza direktben).
import { normalizeHits } from "../core/reach/normalize.js";
import { brainAvailable } from "../core/llm.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

// Nincs API-kulcs (vagy legalábbis ez a teszt nem attól függ) → brainAvailable() valószínűleg
// false ebben a környezetben, így az extracted map üres marad, és minden mező a heurisztikus
// ágra esik — geo_fit ilyenkor mindig null kell legyen, sosem invalid string.
const hits = [
  { url: "https://example.com/a", title: "Teszt Elek - Senior Engineer", description: "desc", source_type: "web", query: "q", excerpt: "" },
];
const result = await normalizeHits(hits, { catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "x" }] });
ok("normalizeHits nem dob hibát geoScope-pal, API-hívás nélkül is", Array.isArray(result) && result.length === 1);
ok("geo_fit heurisztikus ágon null (sosem invalid string)", result[0].geo_fit === null);

console.log("\nnormalize robusztusság-teszt kész.");
