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

export const config = {
  root: ROOT,
  dataDir: path.join(ROOT, "data"),

  // 🧠 Agy
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.CLAUDE_MODEL || "claude-sonnet-5",

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
  return !!config.anthropicApiKey;
}

export function reachLiveAvailable() {
  return !!config.firecrawlApiKey;
}

// Verzió-stamp az audithoz (a Knowledge Core verziója).
export const KNOWLEDGE_VERSION = "kc-2026-07-19.v2";
