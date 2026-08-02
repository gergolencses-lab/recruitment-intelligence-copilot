// Egységteszt: rankTargets demo-módban geo_fit mezős jelöltekkel sem szegi meg
// az elszámoltathatósági guardrailt (mindenki bekerül a rangsorba).
import * as ric from "../core/index.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (ric.brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

const candidates = [
  { id: "c1", name: "Teszt Elek", headline: "Staff Engineer", location: "Budapest, HU", geo_fit: "in_scope", signals: [{ signal: "payments", strength: "erős" }] },
  { id: "c2", name: "Teszt Éva", headline: "Staff Engineer", location: "Cluj-Napoca, RO", geo_fit: "out_of_scope", signals: [{ signal: "payments", strength: "közepes" }] },
];

const rank = await ric.rankTargets({ candidates, intake: { must_haves: ["payments"] } });
ok("rankTargets → minden jelölt szerepel a rangsorban", candidates.every((c) => (rank.ranked || []).some((r) => r.candidate_id === c.id)));
ok("rankTargets → nem dobott hibát a geo_fit mezőtől", Array.isArray(rank.ranked));

console.log("\nrankTargets geo-mező teszt kész.");
