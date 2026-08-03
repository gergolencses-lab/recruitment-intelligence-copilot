// Környezeti konfiguráció + pehelysúlyú .env betöltő (nulla függőség).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env beolvasása, ha létezik (a process.env felülírja a fájlt).
function loadDotenv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined && val !== "") process.env[key] = val;
  }
}
loadDotenv();

// ── 🧠 Agy: melyik szolgáltató? ───────────────────────────────────────
// Egyetlen kapcsoló dönt (LLM_PROVIDER=openai|anthropic). Ha nincs megadva,
// az számít, amelyikhez van kulcs — OpenAI-t előnyben részesítve, mert az a
// jelenlegi alapértelmezés. Így egy env-sor visszakapcsol a másikra anélkül,
// hogy kódot kellene visszaállítani.
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

function resolveProvider() {
  const explicit = String(process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (explicit === "openai" || explicit === "anthropic") return explicit;
  if (OPENAI_KEY) return "openai";
  if (ANTHROPIC_KEY) return "anthropic";
  return "openai";
}

const PROVIDER = resolveProvider();

// Modell: az általános LLM_MODEL mindent felülír; utána a szolgáltató-specifikus
// változó (a régi CLAUDE_MODEL visszafelé kompatibilis marad).
const DEFAULT_MODEL = {
  openai: process.env.OPENAI_MODEL || "gpt-5.6-terra",
  anthropic: process.env.CLAUDE_MODEL || "claude-sonnet-5",
};

export const config = {
  root: ROOT,
  dataDir: path.join(ROOT, "data"),

  // 🧠 Agy
  llmProvider: PROVIDER,
  openaiApiKey: OPENAI_KEY,
  anthropicApiKey: ANTHROPIC_KEY,
  model: process.env.LLM_MODEL || DEFAULT_MODEL[PROVIDER],
  // A bíró/értékelő szándékosan erősebb modellt kap, mint a termék.
  judgeModel:
    process.env.JUDGE_MODEL ||
    (PROVIDER === "openai" ? "gpt-5.6-sol" : "claude-opus-5"),
  // GPT-5.6 gondolkodási szint: none|low|medium|high|xhigh|max.
  // Mérve ugyanazon a queryBuild-en: low 17,6 mp / 4 hely a vonzáskörzetben,
  // medium 33,9-46,7 mp / 9 hely. A "low" pont a leggyengébb kapunkat (G2,
  // vonzáskörzet) rontja, ezért nem azon futunk. A vercel.json maxDuration
  // 120 mp-re emelve, hogy a magasabb szint elférjen.
  openaiReasoningEffort: process.env.OPENAI_REASONING_EFFORT || "high",

  // 📡 Elérés
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || "",
  firecrawlBase: (process.env.FIRECRAWL_BASE || "https://api.firecrawl.dev/v1").replace(/\/+$/, ""),
  reachSearchLimit: parseInt(process.env.REACH_SEARCH_LIMIT || "6", 10),
  reachScrapeTop: parseInt(process.env.REACH_SCRAPE_TOP || "6", 10),
  reachDefaultSource: process.env.REACH_DEFAULT_SOURCE || "auto",
  reachBroadenThreshold: parseInt(process.env.REACH_BROADEN_THRESHOLD || "6", 10),
  // Nyers találat != használható jelölt. A találatok nagy része nem személy
  // (céglista, cikk, hirdetés), ezért a kibővítés valódi kapuja a JELÖLTSZÁM.
  reachMinCandidates: parseInt(process.env.REACH_MIN_CANDIDATES || "6", 10),

  port: parseInt(process.env.PORT || "5178", 10),
};

export function brainAvailable() {
  return config.llmProvider === "openai" ? !!config.openaiApiKey : !!config.anthropicApiKey;
}

export function reachLiveAvailable() {
  return !!config.firecrawlApiKey;
}

// Verzió-stamp az audithoz (a Knowledge Core verziója).
export const KNOWLEDGE_VERSION = "kc-2026-07-19.v2";
