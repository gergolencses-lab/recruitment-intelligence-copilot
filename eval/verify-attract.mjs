// Verifikáció: az ÚJ attract a #3 Firecrawl-jelöltön (a korábbi 6-fabrikációs eset).
// Ellenőrzi: a known_facts visszavezethető-e a jelölt jeleire, a spekuláció jelölt-e,
// és hány állítást szűrt ki a földelő guard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ric from "../core/index.js";
import { assertGrounded } from "../core/guardrails.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cand = JSON.parse(fs.readFileSync(path.join(__dirname, "results/03/attract-candidate.json"), "utf8"));

console.log("JELÖLT:", cand.name, "| jelek száma:", (cand.signals || []).length);
console.log("A jelek:", (cand.signals || []).map((s) => "• " + s.signal).join("\n           "));
console.log("\n— attract futtatása (ÚJ séma, éles) —\n");

const o = await ric.attractionStrategy({ candidate: cand, assessment: null, intake: null });

const kf = (o.grounded_read && o.grounded_read.known_facts) || [];
console.log("GROUNDED — known_facts (" + kf.length + "):");
kf.forEach((f) => console.log("  ✓ " + f.fact + "\n     🔗 from_signal: " + (f.from_signal || "(nincs)")));
console.log("\nUNKNOWNS (" + ((o.grounded_read && o.grounded_read.unknowns) || []).length + "):");
((o.grounded_read && o.grounded_read.unknowns) || []).forEach((u) => console.log("  ? " + u));
console.log("\nkiszűrt nem-földelt állítás:", (o.grounded_read && o.grounded_read._stripped_ungrounded) || 0);

const ideas = o.attraction_ideas || [];
console.log("\nATTRACTION IDEAS (" + ideas.length + "), mind spekulatív? " + ideas.every((i) => i.speculative === true));
ideas.forEach((i) => console.log("  #" + i.rank + " [" + (i.speculative ? "spekuláció" : "NEM jelölt!") + "] " + (i.angle || "").slice(0, 90)));

// Független földelés-ellenőrzés: a kimenet known_facts-ai tényleg a jelekből?
const g = assertGrounded(kf, cand.signals);
console.log("\n=== VERIFIKÁCIÓ ===");
console.log("known_facts mind földelt a jelekre? " + (g.stripped_count === 0 ? "IGEN ✅" : "NEM — " + g.stripped_count + " nem-földelt maradt ❌"));
console.log("minden ötlet spekulatívnak jelölve? " + (ideas.length > 0 && ideas.every((i) => i.speculative === true) ? "IGEN ✅" : "NEM ❌"));
console.log("van őszinte 'unknowns' lista? " + (((o.grounded_read && o.grounded_read.unknowns) || []).length > 0 ? "IGEN ✅" : "NEM ❌"));
