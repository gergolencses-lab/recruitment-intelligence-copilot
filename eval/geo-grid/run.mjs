// A 4×4 földrajzi/specifikációs rács ÉLES futtatója.
//
// Minden cella a valódi terméklánc: intakeReframe → queryBuild → discover
// (élő Anthropic + élő Firecrawl). A futtató HARNESS-SZINTEN újrapróbál, mert a
// core run() wrapperében nincs retry — így az infrastruktúra-hiba nem
// keveredik össze a tervezési hibával a mérésben.
//
// Használat:
//   node eval/geo-grid/run.mjs [--run-id=r1] [--concurrency=3] [--only=kulcs]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cells } from "./briefs.js";
import { intakeReframe, queryBuild, discoverCandidates } from "../../core/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const RUN_ID = args["run-id"] || "r1";
const CONCURRENCY = parseInt(args.concurrency || "3", 10);
const ONLY = args.only || null;
const CELL_TIMEOUT_MS = 240000;
const MAX_ATTEMPTS = 3;

const OUT_DIR = path.join(__dirname, "runs", RUN_ID);
fs.mkdirSync(OUT_DIR, { recursive: true });

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`TIMEOUT after ${ms}ms in ${label}`)), ms);
    }),
  ]);
}

// A core run() wrapperében nincs retry (ismert P1 hiány) — itt pótoljuk, és
// külön számoljuk, hányszor kellett, mert ez önmagában is mérési eredmény.
async function retrying(label, fn, record) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const out = await withTimeout(fn(), CELL_TIMEOUT_MS, label);
      if (attempt > 1) record.retries.push({ step: label, attempts: attempt, recovered: true });
      return out;
    } catch (e) {
      lastErr = e;
      record.retries.push({ step: label, attempt, error: String(e.message || e) });
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

// ── Determinisztikus mérőszámok (LLM nélkül) ────────────────────────────

// A catchment helynevek szét vannak választva, mert a modell néha
// "Gyál / Dunaharaszti / Szigetszentmiklós" formában ad meg egy mezőt.
function placeNames(geoScope) {
  const raw = (geoScope && geoScope.catchment_places) || [];
  const names = [];
  for (const p of raw) {
    for (const part of String(p.place || "").split(/[\/,;]| és | vagy /)) {
      const n = part.trim();
      if (n) names.push(n);
    }
  }
  return names;
}

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function geoFoldMetrics(geoScope, narrow, broad) {
  const anchor = (geoScope && geoScope.anchor) || "";
  const names = placeNames(geoScope);
  const nonAnchor = names.filter((n) => norm(n) !== norm(anchor));
  const nq = norm((narrow || []).join(" || "));
  const bq = norm((broad || []).join(" || "));
  const inNarrow = nonAnchor.filter((n) => nq.includes(norm(n)));
  const inBroad = nonAnchor.filter((n) => bq.includes(norm(n)));
  return {
    anchor,
    catchment_count: names.length,
    non_anchor_count: nonAnchor.length,
    anchor_in_catchment: names.some((n) => norm(n) === norm(anchor)),
    non_anchor_places_in_narrow: inNarrow.length,
    non_anchor_places_in_broad: inBroad.length,
    folded_into_narrow: inNarrow.length > 0,
    folded_into_broad: inBroad.length > 0,
    examples_folded: inNarrow.slice(0, 4),
    examples_missing: nonAnchor.filter((n) => !nq.includes(norm(n))).slice(0, 4),
  };
}

// Placeholder-szivárgás: a korábbi éles futásban valódi hiba volt.
function placeholderLeak(qb) {
  const blob = JSON.stringify(qb);
  const hits = blob.match(/\[[A-ZÁÉÍÓÖŐÚÜŰ_]{4,}\]/g) || [];
  return [...new Set(hits)];
}

async function runCell(cell) {
  const record = {
    id: cell.id,
    role: cell.role.label,
    role_key: cell.role.key,
    city: cell.city.name,
    expected_elasticity: cell.role.expected_elasticity,
    started_at: new Date().toISOString(),
    retries: [],
    progress: [],
    error: null,
  };
  const t0 = Date.now();

  try {
    const intake = await retrying("intakeReframe", () =>
      intakeReframe({ brief: cell.role.brief, position: cell.position }), record);
    record.intake = intake;

    const qb = await retrying("queryBuild", () =>
      queryBuild({ intake, brief: cell.role.brief, position: cell.position }), record);
    record.query = qb;

    const narrow = qb.firecrawl_search_queries || [];
    const broad = qb.firecrawl_search_queries_broad || [];
    const geoScope = qb.geo_scope || null;

    const disc = await retrying("discover", () =>
      discoverCandidates({
        searchQueries: narrow,
        broadSearchQueries: broad,
        geoScope,
        source: "firecrawl",
        onProgress: (m) => record.progress.push(m),
      }), record);
    record.discover = disc;

    // Nyers találatszám a progress-naplóból: a szűk kör önmagában elég volt-e.
    const broadenLine = record.progress.find((m) => /Kevés találat \((\d+)\)/.test(m));
    const totalLine = record.progress.find((m) => /(\d+) nyers találat/.test(m));
    const narrowHits = broadenLine ? parseInt(broadenLine.match(/\((\d+)\)/)[1], 10)
      : totalLine ? parseInt(totalLine.match(/(\d+) nyers/)[1], 10) : null;

    record.metrics = {
      elasticity: geoScope ? geoScope.search_elasticity : null,
      elasticity_expected: cell.role.expected_elasticity,
      elasticity_match: !!geoScope && cell.role.elasticity_tolerance.includes(geoScope.search_elasticity),
      geo: geoFoldMetrics(geoScope, narrow, broad),
      narrow_query_count: narrow.length,
      broad_query_count: broad.length,
      narrow_raw_hits: narrowHits,
      broadened: !!broadenLine,
      candidates: (disc.candidates || []).length,
      geo_fit_breakdown: (disc.candidates || []).reduce((acc, c) => {
        const k = c.geo_fit || "missing";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
      placeholder_leak: placeholderLeak(qb),
      search_failures: record.progress.filter((m) => /keresés hiba|hiba \(/i.test(m)).length,
    };
  } catch (e) {
    record.error = String(e.stack || e.message || e);
  }

  record.duration_ms = Date.now() - t0;
  record.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, `${cell.id}.json`), JSON.stringify(record, null, 2));
  return record;
}

async function pool(items, n, worker) {
  const results = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

const all = cells().filter((c) => !ONLY || c.id.includes(ONLY));
console.log(`Rács futtatása: ${all.length} cella, párhuzamosság=${CONCURRENCY}, run=${RUN_ID}\n`);

const done = await pool(all, CONCURRENCY, async (cell) => {
  const r = await runCell(cell);
  const m = r.metrics || {};
  const flag = r.error ? "💥" : m.elasticity_match && m.geo?.folded_into_narrow && m.candidates >= 3 ? "✅" : "⚠️ ";
  console.log(
    `${flag} ${cell.id.padEnd(38)} elast=${String(m.elasticity).padEnd(8)}` +
    `(vár: ${r.expected_elasticity.padEnd(8)}) geo→query=${m.geo?.folded_into_narrow ? "igen" : "NEM "} ` +
    `nyers=${String(m.narrow_raw_hits ?? "-").padStart(3)} jelölt=${String(m.candidates ?? "-").padStart(3)} ` +
    `${m.broadened ? "[kibővítve]" : ""}${r.error ? " HIBA: " + r.error.split("\n")[0] : ""}`
  );
  return r;
});

const summary = {
  run_id: RUN_ID,
  at: new Date().toISOString(),
  cells: done.length,
  errors: done.filter((r) => r.error).length,
  elasticity_match: done.filter((r) => r.metrics?.elasticity_match).length,
  geo_folded: done.filter((r) => r.metrics?.geo?.folded_into_narrow).length,
  broadened: done.filter((r) => r.metrics?.broadened).length,
  zero_candidates: done.filter((r) => (r.metrics?.candidates ?? 0) === 0).length,
  placeholder_leaks: done.filter((r) => (r.metrics?.placeholder_leak || []).length).length,
  total_retries: done.reduce((a, r) => a + r.retries.filter((x) => x.error).length, 0),
};
fs.writeFileSync(path.join(OUT_DIR, "_summary.json"), JSON.stringify(summary, null, 2));
console.log(`\n── Összesítés (${RUN_ID}) ──`);
console.log(JSON.stringify(summary, null, 2));
console.log(`\nArtifactok: ${OUT_DIR}`);
