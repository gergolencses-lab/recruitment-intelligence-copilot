// ─────────────────────────────────────────────────────────────
// CAPABILITY SERVICES — a közös mag. Az App ÉS az MCP ezt hívja.
// Minden capability: (demo|live) + guardrail + audit + evidencia-nyomvonal.
// ─────────────────────────────────────────────────────────────
import { think, brainAvailable } from "./llm.js";
import { demo } from "./demo.js";
import { audit } from "./audit.js";
import { assertRankingComplete, groundAttraction } from "./guardrails.js";
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

// ── 🧠 PROFILE ASSESSMENT (őszinte fit-olvasat) ──────────────
export async function profileAssess({ candidate, intake }, { projectId } = {}) {
  const task = `FELADAT: Senior-olvasat egy jelöltről, KIZÁRÓLAG a jeleiből visszavezethető evidenciával. Mondd ki ŐSZINTÉN, mennyire fit a szerepre (erős/közepes/gyenge/nem fit) — indoklással. NE találj ki tényt: amit a jelekből nem tudsz róla, tedd az "unknowns"-ba.
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "fit": "erős|közepes|gyenge|nem fit",
 "fit_reason": "<miért ez a fit — evidenciára építve, egy-két mondat>",
 "seniority_read": "...",
 "fit_signals": [ { "signal": "...", "strength": "erős|közepes|gyenge", "evidence": "<a jel, amiből származik>" } ],
 "gaps_to_explore": ["<beszélgetésben feltárandó pont>"],
 "unknowns": ["<amit a jelekből NEM tudunk a jelöltről>"],
 "standout": "<mi teszi ritkává, ha bármi>",
 "evidence": ["<a felhasznált jelek>"]
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nSZEREP-KONTEXTUS:\n${J(intake || {})}`;
  return run(
    "profileAssess",
    { task, input, demoInput: { candidate_id: candidate && candidate.id } },
    projectId
  );
}

// ── 🧠 TARGET RANKING (őszinte prioritás, akár elutasítás) ───
export async function rankTargets({ candidates, intake }, { projectId } = {}) {
  const ids = (candidates || []).map((c) => c.id);
  const task = `FELADAT: Rangsorold a jelölteket a szerephez — kit érdemes üldözni és milyen sorrendben, és kit NEM. Őszinte prioritás: a gyenge/nem-fit jelölt is kap helyet, de a "D — nem éri meg" tier-ben, indoklással. A verdikt LEHET elutasító, ha az evidencia ezt támasztja alá.
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki NÉMÁN (de kaphat D-tiert).
TÖMÖRSÉG (kötelező): gyors sor, NEM mély elemzés. A "rationale" EGYETLEN rövid mondat (max ~12 szó). Az "evidence" legfeljebb 1 rövid elem (vagy üres tömb).
Kimeneti JSON séma:
{
 "ranked": [ { "candidate_id": "...", "name": "...", "pursue_priority": 1, "tier": "A — most üldözd|B — párhuzamos|C — melegen tartsd|D — nem éri meg", "rationale": "<egy rövid mondat>", "evidence": ["<max 1 elem>"] } ],
 "note": "Őszinte üldözési prioritás — a D-tier evidencia alapján nem éri meg."
}`;
  const input = `JELÖLTEK:\n${J((candidates || []).map((c) => ({ id: c.id, name: c.name, headline: c.headline, signals: c.signals })))}\n\nSZEREP:\n${J(intake || {})}`;
  return run(
    "rankTargets",
    {
      task,
      input,
      // Tömör kimenet → gyors generálás, hogy a serverless 60s limit alatt maradjon
      // akkor is, ha sok (10+) jelöltet kell egy hívásban rangsorolni.
      maxTokens: 4000,
      demoInput: { candidates },
      // No-reject guard MEGSZŰNT; az elszámoltathatóság (senki nem esik ki némán) marad.
      guard: (o) => assertRankingComplete(ids, o.ranked || []),
    },
    projectId
  );
}

// ── ⭐ ATTRACTION STRATEGY ────────────────────────────────────
// KÉT ÉLESEN ELVÁLASZTOTT rész: (1) grounded_read = amit a jelöltről BIZTOSAN
// tudunk (csak a jeleiből, jel-hivatkozással); (2) attraction_ideas = 3 spekulatív
// elcsábítási ötlet, versenyeztetve, jelölve. A guard kiszűri a nem-földelt tényt.
export async function attractionStrategy({ candidate, assessment, intake }, { projectId } = {}) {
  const task = `FELADAT: Készíts elcsábítási tervet EGY célszemélyre, KÉT ÉLESEN ELVÁLASZTOTT részben.

(1) GROUNDED READ — amit a jelöltről BIZTOSAN tudunk. CSAK a jeleiből (signals) evidenciálisan visszavezethető tény. MINDEN fact mellé idézd a jelet, amiből ered ("from_signal"). Amit NEM tudsz (motiváció, fizetés, cégméret, jelenlegi elégedettség, jövőterv), az az "unknowns"-ba megy. Kitalált tény a személyről SZIGORÚAN TILOS.

(2) ATTRACTION IDEAS — pontosan 3 elcsábítási ötlet, amit MAGADBAN VERSENYEZTETSZ. Ezek szükségszerűen SPEKULATÍVAK (a jelölt fejét nem ismerjük) — a "speculative": true jelöli. Rangsorold: rank 1 = a legjobb, részletesen (szög + horog + miért működhet); rank 2-3 RÖVIDEN. Az ötletek a grounded jelekből induljanak ki, de bátrak lehetnek.

Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "grounded_read": {
   "known_facts": [ { "fact": "<csak a jelekből visszavezethető tény>", "from_signal": "<idézd a jelet, amiből ered>" } ],
   "unknowns": ["<amit a jelekből NEM tudunk: motiváció, fizetés, elégedettség...>"],
   "confidence": "alacsony|közepes|magas"
 },
 "attraction_ideas": [
   { "rank": 1, "angle": "<a fő megközelítés — tét, nem állás>", "hook": "<konkrét nyitómondat-ötlet a munkájára reflektálva>", "why_might_work": "<mire épít a hipotézis>", "speculative": true },
   { "rank": 2, "angle": "<röviden>", "why_might_work": "<röviden>", "speculative": true },
   { "rank": 3, "angle": "<röviden>", "why_might_work": "<röviden>", "speculative": true }
 ],
 "recommended": 1,
 "channel": "<legjobb csatorna + miért>",
 "timing": "<miért most, ha van rá jel>",
 "risks": ["<mi taszíthatná el egy seniornál>"]
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nÉRTÉKELÉS:\n${J(assessment || {})}\n\nSZEREP:\n${J(intake || {})}`;
  return run(
    "attractionStrategy",
    // 4000 backstop: a tömörség-direktívával a tényleges kimenet jóval ez alatt van,
    // így a serverless 60s limit alatt marad, csonkolás nélkül.
    // Guard: a nem a jelekből visszavezethető "known_facts" kiszűrése (evidencia-földelés).
    { task, input, demoInput: { candidate_id: candidate && candidate.id }, maxTokens: 4000, guard: (o) => groundAttraction(o, candidate) },
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
