// ─────────────────────────────────────────────────────────────
// CAPABILITY SERVICES — a közös mag. Az App ÉS az MCP ezt hívja.
// Minden capability: (demo|live) + guardrail + audit + evidencia-nyomvonal.
// ─────────────────────────────────────────────────────────────
import { think, brainAvailable } from "./llm.js";
import { demo } from "./demo.js";
import { audit } from "./audit.js";
import { assertNoReject, assertRankingComplete } from "./guardrails.js";
import { discover as reachDiscover } from "./reach/reachEngine.js";

function J(obj) {
  return JSON.stringify(obj, null, 2);
}

// Generikus futtató: demo-fallback + audit + guardrail-hook.
async function run(name, { task, input, demoInput, temperature, maxTokens, guard }, projectId) {
  const mode = brainAvailable() ? "live" : "demo";
  audit({ capability: name, projectId, input: input, mode });

  let out;
  if (!brainAvailable()) {
    out = demo[name] ? demo[name](demoInput ?? {}) : { _demo: true, note: "Nincs demo-minta ehhez." };
  } else {
    out = await think({ task, input, temperature, maxTokens });
    out._mode = "live";
  }
  if (guard) out = guard(out);
  return out;
}

// ── 🧠 INTAKE / SEARCH STRATEGY ──────────────────────────────
export async function intakeReframe({ brief }, { projectId } = {}) {
  const task = `FELADAT: Egy senior fejvadász szemével keretezd ÚJRA a hiring manager briefjét. Támadd meg: hol gyenge, hol ellentmond, mi a rejtett valódi igény.
Kimeneti JSON séma:
{
 "reframed_brief": "<a valódi kereslet 2-3 mondatban>",
 "must_haves": ["..."],
 "nice_to_haves": ["..."],
 "bad_brief_flags": ["<hol rossz/fölösleges/ellentmondó a brief>"],
 "hidden_requirements": ["<amit a HM valójában akar, de nem írt le>"],
 "search_hypotheses": ["<hol vannak ezek az emberek: célcégek, közösségek, jelek>"]
}`;
  return run("intakeReframe", { task, input: `BRIEF:\n${brief}`, demoInput: { brief } }, projectId);
}

// ── 🧠 BOOLEAN / QUERY BUILDER ───────────────────────────────
export async function queryBuild({ intake, brief }, { projectId } = {}) {
  const task = `FELADAT: Építs keresési stratégiát. Boolean lekérdezéseket a szokásos platformokra, ÉS "firecrawl_search_queries" listát, ami a publikus-web discovery motort fogja vezérelni (Google-stílusú, site: operátorokkal, senior tech / CEE fókusz).
Kimeneti JSON séma:
{
 "boolean_queries": [ { "platform": "linkedin-xray|github|google", "query": "..." } ],
 "firecrawl_search_queries": ["<4-5 konkrét kereső-lekérdezés, site: operátorokkal>"],
 "target_companies": ["..."],
 "target_titles": ["..."],
 "synonyms": ["..."]
}`;
  const input = `ÚJRAKERETEZETT BRIEF:\n${J(intake || { brief })}`;
  return run("queryBuild", { task, input, demoInput: { intake } }, projectId);
}

// ── 📡 CANDIDATE DISCOVERY (Reach Engine) ────────────────────
export async function discoverCandidates({ searchQueries, source, onProgress }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchQueries, source }, mode: "reach" });
  const res = await reachDiscover({ searchQueries, source, onProgress });
  return res; // { source, candidates, note }
}

// ── 📡 TALENT MAPPING ────────────────────────────────────────
export async function talentMap({ intake, brief }, { projectId } = {}) {
  const task = `FELADAT: Talent map — hol dolgoznak a legjobbak. Célcégek + miért + milyen szerepek + hol gyűlnek (közösség, konferencia).
Kimeneti JSON séma:
{
 "target_companies": [ { "name": "...", "why": "...", "likely_roles": ["..."], "url_guess": null } ],
 "competitor_clusters": ["..."],
 "where_they_gather": ["<közösségek, konferenciák, meetupok>"]
}`;
  const input = `KONTEXTUS:\n${J(intake || { brief })}`;
  return run("talentMap", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 PROFILE ASSESSMENT (üldözés inputja, NEM screening) ────
export async function profileAssess({ candidate, intake }, { projectId } = {}) {
  const task = `FELADAT: Senior-olvasat egy jelöltről, evidenciával. EZ NEM SCREENING-DÖNTÉS és NEM elutasítás — az üldözés inputja: hol erős, mit kell a beszélgetésben feltárni. A "gap" nálad "feltárandó kérdés", sosem kizáró ok.
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "seniority_read": "...",
 "fit_signals": [ { "signal": "...", "strength": "erős|közepes|gyenge", "evidence": "<forrás>" } ],
 "gaps_to_explore": ["<beszélgetésben feltárandó, NEM kizáró>"],
 "standout": "<mi teszi ritkává>",
 "evidence": ["<források>"],
 "note": "Nem screening-döntés; az üldözés inputja."
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nSZEREP-KONTEXTUS:\n${J(intake || {})}`;
  return run(
    "profileAssess",
    { task, input, demoInput: { candidate_id: candidate && candidate.id }, guard: (o) => assertNoReject(o, "profileAssess") },
    projectId
  );
}

// ── 🧠 TARGET RANKING (üldözésre, sosem reject) ──────────────
export async function rankTargets({ candidates, intake }, { projectId } = {}) {
  const ids = (candidates || []).map((c) => c.id);
  const task = `FELADAT: Rangsorold a jelölteket ÜLDÖZÉSRE — kit hajszolj és milyen sorrendben. SENKI NEM ESIK KI. Ez nem elutasítás, hanem prioritás: mindenki kap helyet a sorban (A: most, B: párhuzamos, C: melegen tartsd).
FONTOS: a "ranked" tömbnek MINDEN bemeneti jelöltet tartalmaznia kell.
Kimeneti JSON séma:
{
 "ranked": [ { "candidate_id": "...", "name": "...", "pursue_priority": 1, "tier": "A — most üldözd|B — párhuzamos|C — melegen tartsd", "rationale": "...", "evidence": ["..."] } ],
 "note": "Üldözési prioritás, NEM elutasítás."
}`;
  const input = `JELÖLTEK:\n${J((candidates || []).map((c) => ({ id: c.id, name: c.name, headline: c.headline, signals: c.signals })))}\n\nSZEREP:\n${J(intake || {})}`;
  return run(
    "rankTargets",
    {
      task,
      input,
      demoInput: { candidates },
      guard: (o) => {
        assertNoReject(o, "rankTargets");
        assertRankingComplete(ids, o.ranked || []);
        return o;
      },
    },
    projectId
  );
}

// ── ⭐ ATTRACTION STRATEGY (a termék szíve) ──────────────────
export async function attractionStrategy({ candidate, assessment, intake }, { projectId } = {}) {
  const task = `FELADAT: Készíts BESPOKE elcsábítási stratégiát EGY top célszemélyre. A kérdés sosem "megfelel-e", hanem "HOGYAN nyerjük meg". Fejtsd ki: mi mozgatja (evidenciával + konfidenciával), a szög, a horog (egy konkrét nyitómondat-ötlet a saját munkájára reflektálva), a timing, az ajánlati kar(ok), a csatorna, és a kockázatok (mi taszítaná el).
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "what_moves_them": [ { "driver": "...", "evidence": "...", "confidence": "alacsony|közepes|magas" } ],
 "angle": "<a fő pozicionálás — tét, nem állás>",
 "hook": "<egy konkrét nyitómondat-ötlet, a jelölt saját munkájára reflektálva>",
 "timing": "<miért most>",
 "offer_levers": ["<mit tegyél az asztalra>"],
 "channel": "<legjobb csatorna + miért>",
 "risks": ["<mi taszítaná el egy seniornál>"],
 "evidence": ["<források>"],
 "confidence": "<összegző konfidencia + mi validálja>"
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nÉRTÉKELÉS:\n${J(assessment || {})}\n\nSZEREP:\n${J(intake || {})}`;
  return run(
    "attractionStrategy",
    { task, input, demoInput: { candidate_id: candidate && candidate.id }, maxTokens: 6000, guard: (o) => assertNoReject(o, "attractionStrategy") },
    projectId
  );
}

// ── 🧠 OUTREACH ASSISTANT (draft, nem küldés) ────────────────
export async function outreachDraft({ candidate, attraction, language }, { projectId } = {}) {
  const lang = language || "a jelölt valószínű nyelve (jellemzően angol nemzetközi tech szerepnél)";
  const task = `FELADAT: Az elcsábítási stratégiából írj EGY személyre szabott megkereső-draftot. Az első mondat KÖSSE a jelölt saját munkájához. Tét, nem állás. Alacsony súrlódású zárás. Nyelv: ${lang}.
FONTOS: ez DRAFT — a rendszer nem küld semmit; a recruiter nézi át.
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "language": "hu|en|...",
 "channel": "<javasolt csatorna>",
 "subject": "<tárgy, ha e-mail>",
 "body": "<a teljes üzenet>",
 "why_this_works": ["<miért hatásos — 2-3 pont>"],
 "note": "Draft — a rendszer nem küld. A recruiter nézi át és küldi."
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nELCSÁBÍTÁSI STRATÉGIA:\n${J(attraction || {})}`;
  return run("outreachDraft", { task, input, demoInput: { candidate_id: candidate && candidate.id }, temperature: 0.6 }, projectId);
}

// ── 🧠 CLIENT ADVISORY ───────────────────────────────────────
export async function clientAdvisory({ intake, brief }, { projectId } = {}) {
  const task = `FELADAT: Talking pointok a hiring managernek — "tűnj seniornak" a HM előtt: piaci jelek, hol rossz a brief, mit igazítson, mire figyeljen a folyamatban.
Kimeneti JSON séma:
{
 "talking_points": ["..."],
 "seniority_framing": "<hogyan pozicionálja magát a recruiter a HM előtt>",
 "watch_outs": ["<folyamat-kockázatok>"]
}`;
  const input = `KONTEXTUS:\n${J(intake || { brief })}`;
  return run("clientAdvisory", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 INTERVIEW INTELLIGENCE ────────────────────────────────
export async function interviewIntel({ intake, brief }, { projectId } = {}) {
  const task = `FELADAT: Interjúkérdések a kompetenciamodellből — kompetenciánként 1 éles kérdés + "mi a jó válasz". Plusz red flag-ek, amiket meg kell piszkálni.
Kimeneti JSON séma:
{
 "competency_questions": [ { "competency": "...", "question": "...", "what_good_looks_like": "..." } ],
 "red_flags_to_probe": ["..."]
}`;
  const input = `SZEREP:\n${J(intake || { brief })}`;
  return run("interviewIntel", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 RECRUITMENT COACH (a differenciátor) ──────────────────
export async function recruitmentCoach({ context }, { projectId } = {}) {
  const task = `FELADAT: Módszertani coaching a recruiternek. Egy senior itt mit csinált volna másképp? Egy konkrét fogás, amit MOST bevethet. Melyik készségre fókuszáljon. Röviden, bátorítón, de őszintén.
Kimeneti JSON séma:
{
 "what_a_senior_would_do": "...",
 "one_lever_now": "<egy konkrét, azonnal bevethető fogás>",
 "skill_focus": "...",
 "encouragement": "..."
}`;
  const input = `MIT CSINÁLT A RECRUITER / KONTEXTUS:\n${typeof context === "string" ? context : J(context || {})}`;
  return run("recruitmentCoach", { task, input, demoInput: { context } }, projectId);
}

export const CAPABILITIES = [
  "intakeReframe", "queryBuild", "discoverCandidates", "talentMap",
  "profileAssess", "rankTargets", "attractionStrategy", "outreachDraft",
  "clientAdvisory", "interviewIntel", "recruitmentCoach",
];
