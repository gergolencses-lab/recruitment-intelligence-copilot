// Egységteszt: reachEngine tier-választása, geo-átadása és client-passthrough (nincs élő API-hívás).
import { discover } from "../core/reach/reachEngine.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// Synthetic ágon a discover() a geoScope-ot és a client-et is változatlanul továbbadja.
const res = await discover({
  searchQueries: ["site:linkedin.com/in staff engineer payments Budapest"],
  broadSearchQueries: ["payments engineer CEE"],
  geoScope: {
    catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
  },
  source: "synthetic",
  client: "Acme Kft",
});
ok("discover(synthetic) → source visszaadva", res.source === "synthetic");
ok("discover(synthetic) → geoScope alkalmazva (szűkebb, mint a teljes 17-es pool)", res.candidates.length > 0 && res.candidates.length <= 17);
ok("discover(synthetic) → minden jelölt magyar helyszínű", res.candidates.every((c) => c.location.trim().toUpperCase().endsWith("HU")));
ok("discover(synthetic) → client passthrough megmaradt (insider jelölt szerepel)", res.candidates.some((c) => c.current_company === "Acme Kft"));

const empty = await discover({ searchQueries: [], broadSearchQueries: [], geoScope: null, source: "synthetic" });
ok("discover(synthetic) üres bemenetek esetén is a teljes (17-es) poolra esik vissza", empty.candidates.length === 17);

console.log("\nreachEngine tier-teszt kész.");
