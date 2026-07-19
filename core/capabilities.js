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

// Közös nyelvi direktíva minden capability-hez (a persona nyelvi szabályainak
// tömör megerősítése a feladat-szinten is).
const LANG = `NYELV: természetes magyar üzleti nyelv, tárgyszerűen. Tiltott: "üldöz", "hajszol", "elcsábít", "megtámad", "senior-fejű", drámai/marketinges fordulatok, teljes nagybetűs nyomaték. Tényt, következtetést és feltételezést különválasztva fogalmazz.`;

// A megbízás metaadatai (pozíció, ügyfél, helyszín...) kontextusként a promptba.
function positionCtx(position) {
  if (!position || !Object.values(position).some(Boolean)) return "";
  return `\n\nMEGBÍZÁS-ADATOK:\n${J(position)}`;
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

// ── 🧠 POZÍCIÓ ÉS BRIEF — brief elemzése ─────────────────────
export async function intakeReframe({ brief, position }, { projectId } = {}) {
  const task = `FELADAT: Elemezd a hiring manager briefjét, és készíts belőle javasolt pozíció-összefoglalót. Szúrd ki az ellentmondást, a fölösleges megkötést és a valószínű, de le nem írt igényt — tisztázandó pontként megfogalmazva. Minden kimenet JAVASLAT, amit a recruiter ellenőriz.
${LANG}
Kimeneti JSON séma:
{
 "reframed_brief": "<a valódi kereslet 2-3 mondatban — javasolt pozíció-összefoglaló>",
 "must_haves": ["<elengedhetetlen feltétel>"],
 "nice_to_haves": ["<előnyt jelentő tapasztalat>"],
 "clarification_points": ["<a hiring managerrel tisztázandó pont: hiány, ellentmondás, fölösleges megkötés>"],
 "inferred_requirements": ["<feltételezett további igény — a briefből következtetve, nem tényként>"],
 "search_hypotheses": ["<keresési hipotézis: célcégek, közösségek, jelek — hol érdemes keresni>"]
}`;
  return run("intakeReframe", { task, input: `BRIEF:\n${brief}${positionCtx(position)}`, demoInput: { brief } }, projectId);
}

// ── 🧠 KERESÉSI TERV ─────────────────────────────────────────
export async function queryBuild({ intake, brief, position }, { projectId } = {}) {
  const task = `FELADAT: Készíts keresési tervet. Boolean lekérdezéseket a szokásos platformokra, ÉS "firecrawl_search_queries" listát, ami a nyilvános webes felkutatást vezérli (Google-stílusú, site: operátorokkal, senior tech / CEE fókusz).
${LANG}
Kimeneti JSON séma:
{
 "boolean_queries": [ { "platform": "linkedin-xray|github|google", "query": "..." } ],
 "firecrawl_search_queries": ["<4-5 konkrét kereső-lekérdezés, site: operátorokkal>"],
 "target_companies": ["..."],
 "target_titles": ["..."],
 "synonyms": ["..."]
}`;
  const input = `JAVASOLT POZÍCIÓ-ÖSSZEFOGLALÓ:\n${J(intake || { brief })}${positionCtx(position)}`;
  return run("queryBuild", { task, input, demoInput: { intake } }, projectId);
}

// ── 📡 JELÖLTKUTATÁS (Reach Engine) ──────────────────────────
export async function discoverCandidates({ searchQueries, source, onProgress }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchQueries, source }, mode: "reach" });
  const res = await reachDiscover({ searchQueries, source, onProgress });
  return res; // { source, candidates, note }
}

// ── 📡 CÉLPIAC ───────────────────────────────────────────────
export async function talentMap({ intake, brief, position }, { projectId } = {}) {
  const task = `FELADAT: Célpiac-térkép — hol dolgoznak a szerephez legjobban illő emberek. Célcégek + indoklás + valószínű szerepek + hol találkoznak (közösség, konferencia).
${LANG}
Kimeneti JSON séma:
{
 "target_companies": [ { "name": "...", "why": "...", "likely_roles": ["..."], "url_guess": null } ],
 "competitor_clusters": ["..."],
 "where_they_gather": ["<közösségek, konferenciák, meetupok>"]
}`;
  const input = `KONTEXTUS:\n${J(intake || { brief })}${positionCtx(position)}`;
  return run("talentMap", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 PROFIL ÖSSZEGZÉSE (őszinte alkalmasság-értékelés) ─────
export async function profileAssess({ candidate, intake }, { projectId } = {}) {
  const task = `FELADAT: Jelöltprofil összegzése, KIZÁRÓLAG a jeleiből visszavezethető evidenciával. Mondd ki őszintén, mennyire illik a szerepre (erős/közepes/gyenge/nem fit) — indoklással. NE találj ki tényt: amit a jelekből nem tudsz róla, tedd az "unknowns"-ba.
${LANG}
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "fit": "erős|közepes|gyenge|nem fit",
 "fit_reason": "<miért ez az értékelés — evidenciára építve, egy-két mondat>",
 "profile_summary": "<tapasztalati szint és profil tömör összegzése>",
 "role_relevant_signals": [ { "signal": "...", "strength": "erős|közepes|gyenge", "evidence": "<a jel, amiből származik>" } ],
 "questions_to_clarify": ["<a beszélgetésen tisztázandó pont>"],
 "unknowns": ["<amit a jelekből NEM tudunk a jelöltről>"],
 "key_strength": "<a legfontosabb erőssége a szerep szempontjából, ha van>",
 "evidence": ["<a felhasznált jelek>"]
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nSZEREP-KONTEXTUS:\n${J(intake || {})}`;
  return run(
    "profileAssess",
    { task, input, demoInput: { candidate_id: candidate && candidate.id } },
    projectId
  );
}

// ── 🧠 PRIORITÁSI JAVASLAT (őszinte, akár elutasító) ─────────
export async function rankTargets({ candidates, intake }, { projectId } = {}) {
  const ids = (candidates || []).map((c) => c.id);
  const task = `FELADAT: Készíts prioritási javaslatot: kivel érdemes először felvenni a kapcsolatot, és kivel nem. Őszinte prioritás: a gyenge/nem-illő jelölt is kap helyet, a "D — most nem javasolt" kategóriában, indoklással. A javaslat LEHET elutasító, ha az evidencia ezt támasztja alá. A prioritást a recruiter felülbírálhatja.
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki némán (de kaphat D-kategóriát).
TÖMÖRSÉG (kötelező): gyors sor, NEM mély elemzés. A "rationale" EGYETLEN rövid tagmondat (max ~10 szó). SEMMI más mező — se név, se evidencia-lista.
${LANG}
Kimeneti JSON séma:
{
 "ranked": [ { "candidate_id": "...", "contact_priority": 1, "tier": "A — elsőként keresd meg|B — következő kör|C — figyelőlista|D — most nem javasolt", "rationale": "<max 10 szó>" } ],
 "note": "Prioritási javaslat evidencia alapján — a recruiter felülbírálhatja."
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
      // A guard ellenőriz (hiányzó jelöltnél dob), de a teljes kimenetet adjuk vissza.
      guard: (o) => { assertRankingComplete(ids, o.ranked || []); return o; },
    },
    projectId
  );
}

// ── ⭐ MEGKÖZELÍTÉSI TERV ─────────────────────────────────────
// KÉT ÉLESEN ELVÁLASZTOTT rész: (1) grounded_read = amit a jelöltről BIZTOSAN
// tudunk (csak a jeleiből, jel-hivatkozással); (2) approach_ideas = 3 nyíltan
// feltételezés-alapú megközelítési ötlet, összevetve, jelölve. A guard kiszűri
// a nem-földelt tényt.
export async function attractionStrategy({ candidate, assessment, intake }, { projectId } = {}) {
  const task = `FELADAT: Készíts megközelítési tervet EGY jelöltre, KÉT ÉLESEN ELVÁLASZTOTT részben.

(1) GROUNDED READ — amit a jelöltről BIZTOSAN tudunk. CSAK a jeleiből (signals) evidenciálisan visszavezethető tény. MINDEN fact mellé idézd a jelet, amiből ered ("from_signal"). Amit NEM tudsz (motiváció, fizetés, cégméret, jelenlegi elégedettség, jövőterv), az az "unknowns"-ba megy. Kitalált tény a személyről SZIGORÚAN TILOS.

(2) APPROACH IDEAS — pontosan 3 megközelítési ötlet, amelyeket ÖSSZEVETSZ egymással. Ezek szükségszerűen FELTÉTELEZÉSEK (a jelölt motivációit nem ismerjük) — a "speculative": true jelöli. Rangsorold: rank 1 = a legerősebb, részletesen (megközelítés + nyitómondat + miért működhet); rank 2-3 RÖVIDEN. Az ötletek a földelt jelekből induljanak ki.
${LANG}
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "grounded_read": {
   "known_facts": [ { "fact": "<csak a jelekből visszavezethető tény>", "from_signal": "<idézd a jelet, amiből ered>" } ],
   "unknowns": ["<amit a jelekből NEM tudunk: motiváció, fizetés, elégedettség...>"],
   "confidence": "alacsony|közepes|magas"
 },
 "attraction_ideas": [
   { "rank": 1, "angle": "<a fő megközelítés: mi lehet vonzó a pozícióban ennek a jelöltnek>", "hook": "<konkrét nyitómondat-ötlet a munkájára reflektálva>", "why_might_work": "<mire épít a hipotézis>", "speculative": true },
   { "rank": 2, "angle": "<röviden>", "why_might_work": "<röviden>", "speculative": true },
   { "rank": 3, "angle": "<röviden>", "why_might_work": "<röviden>", "speculative": true }
 ],
 "recommended": 1,
 "channel": "<javasolt csatorna + miért>",
 "timing": "<miért lehet időszerű, ha van rá jel>",
 "risks": ["<kerülendő megközelítés — mi ronthatja a válasz esélyét>"]
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

// ── 🧠 ÜZENETVÁZLAT (draft, nem küldés) ──────────────────────
export async function outreachDraft({ candidate, attraction, language }, { projectId } = {}) {
  const lang = language || "a jelölt valószínű nyelve (jellemzően angol nemzetközi tech szerepnél)";
  const task = `FELADAT: A megközelítési tervből írj EGY személyre szabott üzenetvázlatot. Az első mondat KÖSSE a jelölt saját munkájához. A szakmai kihívást és a hatáskört mutasd be, ne csak a pozíciót. Alacsony súrlódású zárás. Nyelv: ${lang}.
FONTOS: ez VÁZLAT — a rendszer nem küld semmit; a recruiter ellenőrzi és küldi.
${LANG}
Kimeneti JSON séma:
{
 "candidate_id": "${candidate && candidate.id}",
 "language": "hu|en|...",
 "channel": "<javasolt csatorna>",
 "subject": "<tárgy, ha e-mail>",
 "body": "<a teljes üzenet>",
 "why_this_works": ["<a javaslat indoklása — 2-3 pont>"],
 "note": "Vázlat — a rendszer nem küld. A recruiter ellenőrzi és küldi."
}`;
  const input = `JELÖLT:\n${J(candidate)}\n\nMEGKÖZELÍTÉSI TERV:\n${J(attraction || {})}`;
  return run("outreachDraft", { task, input, demoInput: { candidate_id: candidate && candidate.id }, temperature: 0.6 }, projectId);
}

// ── 🧠 ÜGYFÉLEGYEZTETÉS ──────────────────────────────────────
export async function clientAdvisory({ intake, brief, position }, { projectId } = {}) {
  const task = `FELADAT: Készítsd fel a recruitert a hiring managerrel való egyeztetésre: piaci jelek, tisztázandó briefpontok, javasolt módosítások, folyamat-kockázatok.
${LANG}
Kimeneti JSON séma:
{
 "talking_points": ["<egyeztetési pont, tárgyszerűen>"],
 "meeting_preparation": "<hogyan készüljön fel az egyeztetésre: milyen piaci adatot, kockázatot vigyen>",
 "watch_outs": ["<folyamat-kockázat>"]
}`;
  const input = `KONTEXTUS:\n${J(intake || { brief })}${positionCtx(position)}`;
  return run("clientAdvisory", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 INTERJÚTERV ───────────────────────────────────────────
export async function interviewIntel({ intake, brief, position }, { projectId } = {}) {
  const task = `FELADAT: Interjúterv a kompetenciamodellből — kompetenciánként 1 éles kérdés + "mit jelez egy erős válasz". Plusz tisztázandó jelek, amiket a beszélgetésen érdemes megvizsgálni.
${LANG}
Kimeneti JSON séma:
{
 "competency_questions": [ { "competency": "...", "question": "...", "what_good_looks_like": "..." } ],
 "signals_to_clarify": ["<a beszélgetésen tisztázandó jel>"]
}`;
  const input = `SZEREP:\n${J(intake || { brief })}${positionCtx(position)}`;
  return run("interviewIntel", { task, input, demoInput: { intake } }, projectId);
}

// ── 🧠 MÓDSZERTANI SEGÍTSÉG ──────────────────────────────────
export async function recruitmentCoach({ context }, { projectId } = {}) {
  const task = `FELADAT: Módszertani javaslat a recruiternek a leírt helyzetre. Egy javasolt megközelítés indoklással, egy konkrét, most bevethető lépés, és melyik készségre érdemes fókuszálnia. Röviden, tárgyszerűen, tekintélyérv nélkül — a javaslatot az indoklás igazolja.
${LANG}
Kimeneti JSON séma:
{
 "recommended_approach": "<a javasolt megközelítés + miért>",
 "one_lever_now": "<egy konkrét, azonnal bevethető lépés>",
 "skill_focus": "...",
 "encouragement": "<rövid, tárgyszerű visszajelzés arról, mi működik már most>"
}`;
  const input = `MIT CSINÁLT A RECRUITER / KONTEXTUS:\n${typeof context === "string" ? context : J(context || {})}`;
  return run("recruitmentCoach", { task, input, demoInput: { context } }, projectId);
}

export const CAPABILITIES = [
  "intakeReframe", "queryBuild", "discoverCandidates", "talentMap",
  "profileAssess", "rankTargets", "attractionStrategy", "outreachDraft",
  "clientAdvisory", "interviewIntel", "recruitmentCoach",
];
