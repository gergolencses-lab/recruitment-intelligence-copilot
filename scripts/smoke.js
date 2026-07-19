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
ok("profileAssess → note (no-reject framing)", !!assess.note);

const rank = await ric.rankTargets({ candidates: disc.candidates, intake });
ok("rankTargets → mindenki benne (no-reject)", (rank.ranked || []).length === disc.candidates.length);

const attract = await ric.attractionStrategy({ candidate: cand, assessment: assess, intake });
ok("attractionStrategy → angle + hook", !!attract.angle && !!attract.hook);

const outreach = await ric.outreachDraft({ candidate: cand, attraction: attract });
ok("outreachDraft → body", !!outreach.body);

const coach = await ric.recruitmentCoach({ context: "A recruiter a briefet szó szerint végrehajtotta." });
ok("recruitmentCoach → one_lever_now", !!coach.one_lever_now);

// Guardrail negatív teszt: reject-verdikt tiltott
try {
  const { assertNoReject } = await import("../core/guardrails.js");
  assertNoReject({ decision: "elutasít" }, "test");
  ok("guardrail no-reject dob", false);
} catch {
  ok("guardrail no-reject dob", true);
}

// Memory
ric.memorySave({ projectId: "smoke-proj", projectName: "Smoke", note: "Teszt-jegyzet" });
const mem = ric.memoryRecall({ projectId: "smoke-proj" });
ok("memory save+recall", (mem.memory || []).length > 0);

console.log("\nSmoke kész.");
