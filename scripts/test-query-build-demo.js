// Egységteszt: queryBuild demo-módban (nincs API-kulcs) az új mezőket adja vissza,
// és a meglévő kizárás-funkció (exclude_companies) nem sérül.
import * as ric from "../core/index.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (ric.brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

const q = await ric.queryBuild({ intake: { must_haves: ["payments"] }, brief: "teszt brief", position: { client: "Acme Kft" } });

ok("queryBuild → firecrawl_search_queries megmaradt (a meglévő szerkeszthető mező nem sérült)", Array.isArray(q.firecrawl_search_queries) && q.firecrawl_search_queries.length > 0);
ok("queryBuild → firecrawl_search_queries_broad új mező, nem üres tömb", Array.isArray(q.firecrawl_search_queries_broad) && q.firecrawl_search_queries_broad.length > 0);
ok("queryBuild → geo_scope objektum jelen van", !!q.geo_scope && typeof q.geo_scope === "object");
ok("queryBuild → geo_scope.search_elasticity érvényes érték", ["tight", "moderate", "loose"].includes(q.geo_scope.search_elasticity));
ok("queryBuild → geo_scope.catchment_places tömb, nem üres", Array.isArray(q.geo_scope.catchment_places) && q.geo_scope.catchment_places.length > 0);
ok("queryBuild → geo_scope.rationale szöveg", typeof q.geo_scope.rationale === "string" && q.geo_scope.rationale.length > 0);
ok("queryBuild → a meglévő kizárás-funkció nem sérült (exclude_companies)", Array.isArray(q.exclude_companies) && q.exclude_companies.includes("Acme Kft"));
ok("queryBuild → exclusion_note is megmaradt", typeof q.exclusion_note === "string" && q.exclusion_note.length > 0);

console.log("\nqueryBuild demo-séma teszt kész.");
