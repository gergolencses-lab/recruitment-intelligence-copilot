// Smoke-teszt: a mag demo-módban végigfut, a guardrailek élnek.
import * as ric from "../core/index.js";

const brief = `Keresünk egy senior Java fejlesztőt, 10+ év tapasztalat, aki egyedül viszi a payments rendszerünket, de csapatot is épít. Budapest, hibrid.`;

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

console.log(`brainAvailable=${ric.brainAvailable()}  reachLive=${ric.reachLiveAvailable()}  model=${ric.config.model}\n`);

const intake = await ric.intakeReframe({ brief });
ok("intakeReframe → reframed_brief", !!intake.reframed_brief);
ok("intakeReframe → bad_brief_flags", Array.isArray(intake.bad_brief_flags) && intake.bad_brief_flags.length > 0);

const query = await ric.queryBuild({ intake });
ok("queryBuild → firecrawl_search_queries", Array.isArray(query.firecrawl_search_queries) && query.firecrawl_search_queries.length > 0);

const disc = await ric.discoverCandidates({ searchQueries: query.firecrawl_search_queries, source: "synthetic" });
ok("discover → candidates", Array.isArray(disc.candidates) && disc.candidates.length > 0);
console.log(`   forrás=${disc.source}, jelöltek=${disc.candidates.length}`);

const cand = disc.candidates[0];
const assess = await ric.profileAssess({ candidate: cand, intake });
ok("profileAssess → fit (őszinte ítélet)", !!assess.fit);

const rank = await ric.rankTargets({ candidates: disc.candidates, intake });
ok("rankTargets → mindenki elszámolva", disc.candidates.every((c) => (rank.ranked || []).some((r) => r.candidate_id === c.id)));

const attract = await ric.attractionStrategy({ candidate: cand, assessment: assess, intake });
ok("attractionStrategy → grounded_read + attraction_ideas", !!(attract.grounded_read && Array.isArray(attract.attraction_ideas) && attract.attraction_ideas.length));
ok("attract → ötletek spekulatívnak jelölve", (attract.attraction_ideas || []).length > 0 && (attract.attraction_ideas || []).every((i) => i.speculative === true));

const outreach = await ric.outreachDraft({ candidate: cand, attraction: attract });
ok("outreachDraft → body", !!outreach.body);

const coach = await ric.recruitmentCoach({ context: "A recruiter a briefet szó szerint végrehajtotta." });
ok("recruitmentCoach → one_lever_now", !!coach.one_lever_now);

// Guardrail teszt: evidencia-földelés kiszűri a nem-visszavezethető ("kitalált") tényt
const { assertGrounded } = await import("../core/guardrails.js");
const g = assertGrounded(
  [
    { fact: "Fraud rendszereken dolgozott", from_signal: "kitalált fraud tapasztalat" },
    { fact: "Kubernetes operátort írt", from_signal: "Kubernetes operátort írt Go-ban" },
  ],
  [{ signal: "Kubernetes operátort írt Go-ban" }]
);
ok("guardrail földelés: kitalált tény kiszűrve, földelt megmarad", g.stripped_count === 1 && g.kept.length === 1);

// Memory
ric.memorySave({ projectId: "smoke-proj", projectName: "Smoke", note: "Teszt-jegyzet" });
const mem = ric.memoryRecall({ projectId: "smoke-proj" });
ok("memory save+recall", (mem.memory || []).length > 0);

console.log("\nSmoke kész.");
