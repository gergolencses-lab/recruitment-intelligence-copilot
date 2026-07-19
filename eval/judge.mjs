// RIC kiértékelő bíró — NYERS SDK-hívások (NEM a RIC personája). Három pass:
//  1) VAK abláció: brief + két intake (RIC vs nyers), A/B anonim → melyik senioribb/hasznosabb.
//  2) Rubrika-bíró: a RIC kimenetei + a briefenkénti 'judge' kritériumok → pass/fail + evidencia.
//  3) Szkeptikus: attract.evidence visszavezethető-e a jelölt tényleges signals[]-ára (kitalált tény?).
//
// Előfeltétel: előbb fusson az eval/run.mjs (eval/results/ meglegyen).
// Futtatás:  node eval/judge.mjs   → eval/scores/<id>.json + eval/scores/_scores.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../core/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(__dirname, "results");
const SCORES = path.join(__dirname, "scores");
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, "rubric.json"), "utf8"));
const raw = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 4 });

function readRes(id, name) {
  const p = path.join(RESULTS, id, name + ".json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
function briefText(id, slug) {
  const md = fs.readFileSync(path.join(__dirname, "..", "test-briefs", `${id}-${slug}.md`), "utf8");
  const start = md.indexOf("## 📋");
  const after = md.indexOf("\n", start);
  const rest = md.slice(after + 1);
  const nextH2 = rest.indexOf("\n## ");
  return (nextH2 === -1 ? rest : rest.slice(0, nextH2)).trim();
}
async function askJSON(system, user, maxTokens = 3000) {
  const resp = await raw.messages.create({ model: config.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return JSON.parse(a !== -1 && b !== -1 ? t.slice(a, b + 1) : t);
}

// 1) VAK ABLÁCIÓ ------------------------------------------------------------
async function judgeAblation(id, meta, brief) {
  const intakeRuns = readRes(id, "intake-runs");
  const ric = intakeRuns && (intakeRuns.find((r) => r.ok) || {}).out;
  const base = readRes(id, "baseline-intake");
  const baseParsed = base && base.parsed;
  if (!ric || !baseParsed) return { skipped: "hiányzó intake vagy baseline" };

  // Determinisztikus, de nem-triviális A/B sorrend (páratlan id → RIC=A). A bíró VAK.
  const ricIsA = parseInt(id, 10) % 2 === 1;
  const A = ricIsA ? ric : baseParsed;
  const B = ricIsA ? baseParsed : ric;
  const crit = meta.criteria.filter((c) => c.type === "judge" && c.field.startsWith("intake."));

  const system =
    "You are a rigorous, neutral evaluator of technical-recruitment analysis. Two anonymous systems each reframed the SAME hiring brief. " +
    "Judge which reframing is more SENIOR, SPECIFIC and USEFUL to a headhunter. You do not know which system produced which and must not assume.";
  const user =
    "HIRING BRIEF:\n" + brief +
    "\n\nOUTPUT A:\n" + JSON.stringify(A) +
    "\n\nOUTPUT B:\n" + JSON.stringify(B) +
    "\n\nCRITERIA (does each output satisfy them?):\n" +
    crit.map((c) => `- ${c.id}: ${c.must}`).join("\n") +
    "\n\nReturn ONLY JSON: {\"criteria\":[{\"id\":\"..\",\"a_pass\":bool,\"b_pass\":bool}]," +
    "\"winner\":\"A\"|\"B\"|\"tie\",\"margin\":\"clear\"|\"slight\"|\"none\",\"reason\":\"one sentence\"}. No markdown.";
  const v = await askJSON(system, user, 3500);
  // Dekódolás A/B → RIC/nyers
  const map = (x) => (x === "tie" ? "tie" : (x === "A") === ricIsA ? "RIC" : "baseline");
  const crv = (v.criteria || []).map((r) => ({ id: r.id, ric_pass: ricIsA ? r.a_pass : r.b_pass, baseline_pass: ricIsA ? r.b_pass : r.a_pass }));
  return { winner: map(v.winner), margin: v.margin, reason: v.reason, ric_is_A: ricIsA, criteria: crv };
}

// 2) RUBRIKA-BÍRÓ (RIC kimenet) --------------------------------------------
function bundle(id) {
  const intake = (readRes(id, "intake-runs") || []).find((r) => r.ok);
  const disc = readRes(id, "discover");
  const rank = readRes(id, "rank");
  return {
    intake: intake && intake.out,
    query: readRes(id, "query"),
    talent_map: readRes(id, "talent-map"),
    discover_sample: disc && (disc.candidates || []).slice(0, 12).map((c) => ({ name: c.name, headline: c.headline, company: c.current_company, signals: (c.signals || []).map((s) => s.signal) })),
    rank_sample: rank && (rank.ranked || []).slice(0, 8).map((r) => ({ name: r.name, tier: r.tier, rationale: r.rationale })),
    attract: readRes(id, "attract-top"),
    advisory: readRes(id, "advisory"),
  };
}
async function judgeRubric(id, meta) {
  const crit = meta.criteria.filter((c) => c.type === "judge");
  const b = bundle(id);
  const system =
    "You are a rigorous, skeptical evaluator of a recruitment-intelligence system's outputs. For each criterion answer strictly whether the system's output SATISFIES it. " +
    "Be hard to please: 'partially' = false. Quote the exact evidence field/text you relied on.";
  const user =
    "SYSTEM OUTPUTS (relevant fields):\n" + JSON.stringify(b).slice(0, 14000) +
    "\n\nCRITERIA:\n" + crit.map((c) => `- ${c.id} [${c.field}]: ${c.must}`).join("\n") +
    "\n\nReturn ONLY JSON: {\"criteria\":[{\"id\":\"..\",\"pass\":bool,\"evidence\":\"short quote or field\",\"note\":\"<=1 sentence\"}]}. No markdown.";
  const v = await askJSON(system, user, 3500);
  return v.criteria || [];
}

// 3) SZKEPTIKUS (evidencia-földelés) ---------------------------------------
async function judgeSkeptic(id) {
  const attract = readRes(id, "attract-top");
  const cand = readRes(id, "attract-candidate");
  if (!attract || !cand) return { skipped: "nincs attract/candidate" };
  const system =
    "You are an adversarial fact-checker. A recruitment system produced an 'attraction strategy' for ONE candidate. " +
    "You are given the candidate's ACTUAL known signals. Your job: find every claim in the strategy's evidence/drivers that is NOT traceable to those signals — i.e. invented facts about this specific person. Be strict but fair: general market reasoning is allowed; invented biographical/employer/skill facts are NOT.";
  const user =
    "CANDIDATE (the only known facts):\n" + JSON.stringify({ name: cand.name, headline: cand.headline, company: cand.current_company, location: cand.location, synthetic: cand.synthetic, signals: (cand.signals || []).map((s) => s.signal) }) +
    "\n\nATTRACTION STRATEGY:\n" + JSON.stringify({ known_facts: attract.grounded_read && attract.grounded_read.known_facts, unknowns: attract.grounded_read && attract.grounded_read.unknowns, confidence: attract.grounded_read && attract.grounded_read.confidence, attraction_ideas: attract.attraction_ideas, channel: attract.channel, timing: attract.timing }).slice(0, 8000) +
    "\n\nReturn ONLY JSON: {\"fabricated_claims\":[{\"claim\":\"..\",\"why\":\"why not traceable\"}]," +
    "\"grounded\":bool,\"calibrated\":bool,\"calibration_note\":\"is stated confidence honest given thin evidence? <=1 sentence\"}. No markdown.";
  return await askJSON(system, user, 2500);
}

(async () => {
  fs.mkdirSync(SCORES, { recursive: true });
  const ids = process.env.IDS ? process.env.IDS.split(",") : Object.keys(rubric.briefs);
  // Meglévő pontszámok betöltése (részleges újrafuttatáshoz — pl. csak a törött abláció).
  const existing = fs.existsSync(path.join(SCORES, "_scores.json")) ? JSON.parse(fs.readFileSync(path.join(SCORES, "_scores.json"), "utf8")).scores || {} : {};
  const all = { ...existing };
  for (const id of ids) {
    const meta = rubric.briefs[id];
    const brief = briefText(id, meta.slug);
    console.log(`[${id}] bírálat…`);
    const [ablation, rubricScores, skeptic] = await Promise.all([
      judgeAblation(id, meta, brief).catch((e) => ({ error: String(e.message) })),
      judgeRubric(id, meta).catch((e) => ({ error: String(e.message) })),
      judgeSkeptic(id).catch((e) => ({ error: String(e.message) })),
    ]);
    const rec = readRes(id, "_record") || {};
    const score = {
      id, slug: meta.slug, trap: meta.trap,
      ablation,                 // vak: winner RIC|baseline|tie
      rubric: rubricScores,     // judge kritériumok pass/fail
      auto: rec.auto || {},     // runner automata jelei (no-reject, live, HU)
      skeptic,                  // evidencia-földelés
    };
    all[id] = score;
    fs.writeFileSync(path.join(SCORES, `${id}.json`), JSON.stringify(score, null, 2), "utf8");
    const rp = Array.isArray(rubricScores) ? rubricScores.filter((c) => c.pass).length + "/" + rubricScores.length : "hiba";
    console.log(`[${id}] rubrika ${rp} | abláció győztes: ${ablation && ablation.winner} | fabrikált: ${skeptic && (skeptic.fabricated_claims || []).length}`);
  }
  fs.writeFileSync(path.join(SCORES, "_scores.json"), JSON.stringify({ ts: new Date().toISOString(), model: config.model, scores: all }, null, 2), "utf8");
  console.log(`\n=== BÍRÁLAT KÉSZ — eval/scores/_scores.json ===`);
})();
