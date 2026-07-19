// RIC kiértékelő runner — headless, közvetlen core-import (nincs szerver/rate-limit).
// Végigviszi az 5 teszt-briefet a teljes láncon, N=3 intake-kel + nyers-modell ablációval,
// és minden capability nyers JSON kimenetét + latenciát + guardrail-eredményt elment.
//
// Futtatás:  node eval/run.mjs
// A .env auto-töltődik a core import miatt. Kimenet: eval/results/<id>/*.json + _summary.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import * as ric from "../core/index.js";
import { config } from "../core/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RESULTS = path.join(__dirname, "results");
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, "rubric.json"), "utf8"));

const N_INTAKE = 3; // stabilitás
const raw = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 4 });

function saveJSON(id, name, obj) {
  const dir = path.join(RESULTS, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify(obj, null, 2), "utf8");
}

// Csak a "## 📋 A brief" szekció szövege — a "## 🧪 Teszt-jegyzet" SOHA nem megy a modellbe.
function parseBrief(mdPath) {
  const md = fs.readFileSync(mdPath, "utf8");
  const start = md.indexOf("## 📋");
  if (start === -1) throw new Error("Nincs '## 📋 A brief' szekció: " + mdPath);
  const after = md.indexOf("\n", start);
  const rest = md.slice(after + 1);
  const nextH2 = rest.indexOf("\n## ");
  const body = (nextH2 === -1 ? rest : rest.slice(0, nextH2)).trim();
  return body;
}

// Egy hívás időzítése + hibavédelme.
async function timed(fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    return { ok: true, ms: Date.now() - t0, out };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String(e && e.message || e) };
  }
}

// Nyers-modell abláció: ugyanaz a brief, persona/scaffold NÉLKÜL, azonos modell, azonos séma.
async function baselineIntake(brief) {
  const sys =
    "You are a senior technical headhunter. Reframe a hiring brief through a senior headhunter lens: " +
    "attack weak/vague/contradictory parts, surface hidden requirements, propose search hypotheses.";
  const user =
    "BRIEF:\n" + brief +
    "\n\n---\nReturn ONLY one valid JSON object with these fields (Hungarian text values): " +
    '{"reframed_brief": string, "must_haves": string[], "nice_to_haves": string[], ' +
    '"clarification_points": string[], "inferred_requirements": string[], "search_hypotheses": string[]}. ' +
    "No markdown, no code fence, no commentary.";
  const t0 = Date.now();
  const resp = await raw.messages.create({
    model: config.model,
    max_tokens: 6000,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let parsed = null, parseError = null;
  try {
    let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    parsed = JSON.parse(a !== -1 && b !== -1 ? t.slice(a, b + 1) : t);
  } catch (e) { parseError = String(e.message); }
  return { ms: Date.now() - t0, model: config.model, no_persona: true, parsed, parseError, rawText: parsed ? undefined : text.slice(0, 1200) };
}

// Magyar-heurisztika (auto-kritérium #1-hez).
function looksHungarian(s) {
  if (!s) return false;
  const t = String(s).toLowerCase();
  const accents = (t.match(/[őűáéúíóöü]/g) || []).length;
  const words = ["és", "hogy", "nem", "egy ", "kell", "való", "keres", "szerep", "mérnök"];
  const hits = words.filter((w) => t.includes(w)).length;
  return accents >= 3 || hits >= 3;
}

async function runBrief(id, meta) {
  const briefPath = path.join(ROOT, "test-briefs", `${id}-${meta.slug}.md`);
  const brief = parseBrief(briefPath);
  const log = (m) => console.log(`[${id}] ${m}`);
  const rec = { id, slug: meta.slug, trap: meta.trap, reach: meta.reach, brief_len: brief.length, steps: {}, auto: {}, ts: new Date().toISOString() };
  log(`start — trap: ${meta.trap} | reach: ${meta.reach} | brief ${brief.length} char`);

  // 1) INTAKE ×N (stabilitás) + abláció
  const intakes = [];
  for (let i = 0; i < N_INTAKE; i++) {
    const r = await timed(() => ric.intakeReframe({ brief }, { projectId: `eval-${id}` }));
    intakes.push(r);
    log(`intake ${i + 1}/${N_INTAKE} — ${r.ok ? r.ms + "ms _mode=" + (r.out && r.out._mode) : "HIBA: " + r.error}`);
  }
  saveJSON(id, "intake-runs", intakes);
  const intake = (intakes.find((r) => r.ok) || {}).out || null;
  rec.steps.intake = { runs: intakes.map((r) => ({ ok: r.ok, ms: r.ms, mode: r.out && r.out._mode, error: r.error })) };

  log(`abláció (nyers modell)…`);
  const baseline = await baselineIntake(brief).catch((e) => ({ error: String(e.message) }));
  saveJSON(id, "baseline-intake", baseline);
  rec.steps.baseline = { ms: baseline.ms, ok: !!baseline.parsed, parseError: baseline.parseError };

  if (!intake) { rec.auto.fatal = "intake mind az N futásban elhalt"; saveJSON(id, "_record", rec); return rec; }

  // 2) QUERY
  const q = await timed(() => ric.queryBuild({ intake, brief }, { projectId: `eval-${id}` }));
  saveJSON(id, "query", q.out || { error: q.error });
  rec.steps.query = { ok: q.ok, ms: q.ms, mode: q.out && q.out._mode, error: q.error };
  const searchQueries = (q.out && q.out.firecrawl_search_queries) || [];
  log(`query — ${q.ok ? q.ms + "ms, " + searchQueries.length + " keresés" : "HIBA: " + q.error}`);

  // 3) DISCOVER (synthetic vagy élő firecrawl)
  const disc = await timed(() => ric.discoverCandidates({ searchQueries, source: meta.reach }, { projectId: `eval-${id}` }));
  saveJSON(id, "discover", disc.out || { error: disc.error });
  const candidates = (disc.out && disc.out.candidates) || [];
  rec.steps.discover = { ok: disc.ok, ms: disc.ms, source: disc.out && disc.out.source, count: candidates.length, error: disc.error };
  log(`discover — ${disc.ok ? disc.ms + "ms, forrás=" + disc.out.source + ", " + candidates.length + " jelölt" : "HIBA: " + disc.error}`);

  // 3b) TALENT MAP
  const tm = await timed(() => ric.talentMap({ intake, brief }, { projectId: `eval-${id}` }));
  saveJSON(id, "talent-map", tm.out || { error: tm.error });
  rec.steps.talent_map = { ok: tm.ok, ms: tm.ms, mode: tm.out && tm.out._mode, error: tm.error };
  log(`talent-map — ${tm.ok ? tm.ms + "ms" : "HIBA: " + tm.error}`);

  // 4) RANK (no-reject: mindenkit)
  let ranked = [];
  if (candidates.length) {
    const rk = await timed(() => ric.rankTargets({ candidates, intake }, { projectId: `eval-${id}` }));
    saveJSON(id, "rank", rk.out || { error: rk.error });
    ranked = (rk.out && rk.out.ranked) || [];
    rec.steps.rank = { ok: rk.ok, ms: rk.ms, mode: rk.out && rk.out._mode, ranked_count: ranked.length, error: rk.error };
    log(`rank — ${rk.ok ? rk.ms + "ms, " + ranked.length + " rangsorolva" : "HIBA: " + rk.error}`);

    // AUTO: strukturális no-reject — minden jelölt-id megjelenik-e a rangsorban?
    const candIds = candidates.map((c) => c.id);
    const rankedIds = new Set(ranked.map((r) => r.candidate_id));
    const missing = candIds.filter((cid) => !rankedIds.has(cid));
    const undefIds = ranked.filter((r) => r.candidate_id === "undefined" || r.candidate_id === "false" || r.candidate_id == null).length;
    rec.auto.no_reject_complete = missing.length === 0;
    rec.auto.no_reject_missing = missing;
    rec.auto.candidate_id_undefined = undefIds;
  } else {
    rec.steps.rank = { skipped: "nincs jelölt" };
  }

  // 5) ASSESS + 6) ATTRACT a top-jelöltre
  const topId = (ranked[0] && ranked[0].candidate_id) || (candidates[0] && candidates[0].id);
  const topCand = candidates.find((c) => c.id === topId) || candidates[0];
  if (topCand) {
    const as = await timed(() => ric.profileAssess({ candidate: topCand, intake }, { projectId: `eval-${id}` }));
    saveJSON(id, "assess-top", as.out || { error: as.error });
    rec.steps.assess = { ok: as.ok, ms: as.ms, mode: as.out && as.out._mode, candidate: topCand.id, error: as.error };

    const at = await timed(() => ric.attractionStrategy({ candidate: topCand, assessment: as.out, intake }, { projectId: `eval-${id}` }));
    saveJSON(id, "attract-top", at.out || { error: at.error });
    // A jelölt tényleges signal-jait is elmentjük — a szkeptikus evidencia-ellenőrzéshez.
    saveJSON(id, "attract-candidate", { id: topCand.id, name: topCand.name, headline: topCand.headline, current_company: topCand.current_company, location: topCand.location, synthetic: topCand.synthetic, signals: topCand.signals, source_url: topCand.source_url });
    rec.steps.attract = { ok: at.ok, ms: at.ms, mode: at.out && at.out._mode, candidate: topCand.id, error: at.error };
    log(`assess+attract (${topCand.id}) — ${at.ok ? at.ms + "ms" : "HIBA: " + at.error}`);
  }

  // 8) ADVISORY (csak ahol a brief indokolja: #1, #5)
  if (meta.advisory) {
    const ad = await timed(() => ric.clientAdvisory({ intake, brief }, { projectId: `eval-${id}` }));
    saveJSON(id, "advisory", ad.out || { error: ad.error });
    rec.steps.advisory = { ok: ad.ok, ms: ad.ms, mode: ad.out && ad.out._mode, error: ad.error };
    log(`advisory — ${ad.ok ? ad.ms + "ms" : "HIBA: " + ad.error}`);
  }

  // AUTO: live-mode minden LLM-kimeneten + HU-heurisztika (#1)
  const llmModes = [intake, q.out, tm.out].filter(Boolean).map((o) => o._mode);
  rec.auto.all_live = llmModes.every((m) => m === "live");
  if (meta.lang === "hu") rec.auto.intake_hungarian = looksHungarian(intake.reframed_brief);

  saveJSON(id, "_record", rec);
  log(`kész.`);
  return rec;
}

(async () => {
  console.log(`\n=== RIC EVAL RUN ===`);
  console.log(`brain=${ric.brainAvailable()} reach_live=${ric.reachLiveAvailable()} model=${config.model}\n`);
  fs.mkdirSync(RESULTS, { recursive: true });

  const ids = Object.keys(rubric.briefs); // 01..05
  // Briefek párhuzamosan (láncon belül szekvenciális) — a peak ~5 egyidejű API-hívás.
  const records = await Promise.all(ids.map((id) => runBrief(id, rubric.briefs[id]).catch((e) => ({ id, fatal: String(e.message) }))));

  const summary = {
    ts: new Date().toISOString(),
    model: config.model,
    brain: ric.brainAvailable(),
    reach_live: ric.reachLiveAvailable(),
    n_intake: N_INTAKE,
    briefs: records,
  };
  saveJSON("", "_summary", summary);
  fs.writeFileSync(path.join(RESULTS, "_summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n=== KÉSZ — összefoglaló: eval/results/_summary.json ===`);
})();
