// Projekt-silózott JSON perzisztencia (nulla függőség).
// Egy tenant = egy kliens = egy projekt-fájl. Nincs cross-projekt átjárás.
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const PROJ_DIR = path.join(config.dataDir, "projects");

function ensureDirs() {
  fs.mkdirSync(PROJ_DIR, { recursive: true });
}

function projPath(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(PROJ_DIR, `${safe}.json`);
}

// Megbízás-státuszok (üzleti állapot — nem azonos a belső AI-lépésekkel).
export const STATUSES = [
  "Előkészítés",
  "Kutatás folyamatban",
  "Megkeresés folyamatban",
  "Interjúk folyamatban",
  "Várakozik az ügyfélre",
  "Szüneteltetve",
  "Betöltve",
  "Lezárva",
];

// A megbízás üzleti metaadatai (pozíció, ügyfél...). A technikai adatmodellben
// a "project" név megmarad; a felületen a neve: Megbízás.
export function emptyPosition() {
  return {
    title: "",        // pozíció neve
    client: "",       // ügyfél
    location: "",     // helyszín
    work_mode: "",    // helyszíni | hibrid | távoli
    seniority: "",    // tapasztalati szint
    owner: "",        // felelős recruiter
    hiring_manager: "",
    language: "",
    salary_band: "",
    due_date: "",
    priority: "",
  };
}

export function emptyProject(id, name) {
  return {
    id,
    name: name || id,
    position: emptyPosition(),
    status: "Előkészítés",
    priority_overrides: {}, // candidate_id -> "A"|"B"|"C"|"D" (recruiter felülbírálat)
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    brief_raw: "",
    intake: null,          // intakeReframe output
    brief_final: null,     // a recruiter által szerkesztett, véglegesített brief (ez megy tovább)
    query: null,           // queryBuild output
    candidates: [],        // discover/talent-map normalizált jelöltek
    // Kizárás a merítésből: az ügyfél saját (volt) emberei + off-limits cégek.
    // A kizárt jelölt nem törlődik, csak külön sávra kerül, indoklással.
    exclusions: { companies: [], candidates: {}, allow_alumni: false, client_aliases: [] },
    strategy_chat: [],     // a stratégia-asszisztens beszélgetés-naplója
    talent_map: null,
    assessments: {},       // candidate_id -> profileAssess
    ranking: null,         // rankTargets output
    attraction: {},        // candidate_id -> attractionStrategy
    outreach: {},          // candidate_id -> outreachDraft
    outreach_status: {},   // candidate_id -> { sent_at, replied, sentiment }  (a recruiter jelöli, a rendszer nem küld)
    baseline_response_rate: null, // Zita jelenlegi outreach-válaszaránya (%), egyszer, kézzel
    first_shortlist_at: null,     // mikor lett kész az első prezentálható shortlist
    pilot: { cooling_days: 7, mono_source_threshold: 0.7 },
    advisory: null,
    interview: null,
    coach_notes: [],
    memory: [],            // szabad-szöveges projekt-kontextus jegyzetek
    interactions: [],      // interakció-napló
  };
}

// Régi projektek előre-kompatibilissá tétele: hiányzó mezők feltöltése.
export function normalizeProject(p) {
  if (!p.position) p.position = { ...emptyPosition(), title: p.name || p.id };
  if (!p.status) p.status = (p.candidates || []).length ? "Kutatás folyamatban" : "Előkészítés";
  if (!p.priority_overrides) p.priority_overrides = {};
  if (!p.outreach_status) p.outreach_status = {};
  if (p.baseline_response_rate === undefined) p.baseline_response_rate = null;
  if (p.first_shortlist_at === undefined) p.first_shortlist_at = null;
  if (!p.pilot) p.pilot = { cooling_days: 7, mono_source_threshold: 0.7 };
  if (p.brief_final === undefined) p.brief_final = null;
  if (!p.strategy_chat) p.strategy_chat = [];
  if (!p.exclusions) p.exclusions = {};
  if (!p.exclusions.companies) p.exclusions.companies = [];
  if (!p.exclusions.candidates) p.exclusions.candidates = {};
  if (!p.exclusions.client_aliases) p.exclusions.client_aliases = [];
  if (p.exclusions.allow_alumni === undefined) p.exclusions.allow_alumni = false;
  return p;
}

export function loadProject(id) {
  try {
    ensureDirs();
    const p = projPath(id);
    if (!fs.existsSync(p)) return null;
    return normalizeProject(JSON.parse(fs.readFileSync(p, "utf8")));
  } catch {
    // Serverless (pl. Vercel) csak-olvasható FS → a kliens tartja az állapotot.
    return null;
  }
}

export function saveProject(proj) {
  proj.updated_at = new Date().toISOString();
  try {
    ensureDirs();
    fs.writeFileSync(projPath(proj.id), JSON.stringify(proj, null, 2), "utf8");
  } catch {
    // Serverless csak-olvasható FS: a lemez-írás elhagyható, a kliens perzisztál (localStorage).
  }
  return proj;
}

export function upsertProject(id, name) {
  let proj = loadProject(id);
  if (!proj) {
    proj = emptyProject(id, name);
    saveProject(proj);
  } else if (name && proj.name !== name) {
    proj.name = name;
    saveProject(proj);
  }
  return proj;
}

export function listProjects() {
  try {
    ensureDirs();
    return fs
      .readdirSync(PROJ_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const p = JSON.parse(fs.readFileSync(path.join(PROJ_DIR, f), "utf8"));
          return {
            id: p.id,
            name: p.name,
            updated_at: p.updated_at,
            candidates: (p.candidates || []).length,
            has_brief: !!p.intake,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  } catch {
    return []; // serverless: nincs lemez, a kliens listázza a saját projektjeit
  }
}
