# Search Specification Tiering & Geographic Reach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `queryBuild`'s flat, overspecified single-tier query list with a narrow/broad tiered plan plus an evidence-grounded `geo_scope` (elasticity-calibrated catchment), and thread that through the Reach Engine (adaptive broadening, geo-fit tagging), ranking, and both surfaces (web app + MCP) so search neither over- nor under-specifies, and geography is reasoned about rather than ignored.

**Architecture:** `queryBuild` now emits `geo_scope` (search_elasticity + named catchment places, no invented precision) and `search_tiers` (narrow = all must-haves ANDed, broad = core signal only). `reachEngine.discover()` runs the narrow tier first, adaptively fires the broad tier only if raw hits are thin (config-gated threshold), then scrapes+normalizes once on the merged set. `normalize.js` tags each candidate's `geo_fit` against the whole `geo_scope` object (not list lookup). `syntheticReach.js` filters the fixed demo pool deterministically by country instead of ignoring location. `rankTargets` receives `location`/`geo_fit` as explicit ranking input.

**Tech Stack:** Node.js (ESM), Express, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, zero test framework — this repo tests via plain `node scripts/*.js` assertion scripts (`ok(name, cond)` pattern), not jest/vitest. Follow that convention; do not introduce a test framework.

## Global Constraints

- No specific minute/km figures are ever emitted in `geo_scope` — relative/comparative judgment only (validated empirically; see `docs/superpowers/specs/2026-08-02-search-specification-and-geography-design.md`).
- `search_elasticity` is derived from role scarcity/seniority, never from `work_mode` alone, never by mirroring place-list length or border-crossing.
- The anchor location (`position.location`) must always appear in `geo_scope.catchment_places`, regardless of elasticity.
- `loose` elasticity must still name real places — an empty `catchment_places` is not an acceptable output.
- No backwards-compatibility shims for the old flat `firecrawl_search_queries` shape — every caller in this repo is updated in this same plan (per user preference: no compat hacks when you can just change the code).
- All new/changed Hungarian prompt text follows the existing `LANG` constant convention in `core/capabilities.js` (natural Hungarian, no marketing language, fact/inference/assumption kept separate).

---

## File Structure

| File | Responsibility |
|---|---|
| `core/config.js` | + `reachBroadenThreshold` |
| `core/reach/syntheticReach.js` | Deterministic geo-filtering of the fixed demo pool |
| `core/reach/normalize.js` | + per-candidate `geo_fit` classification against `geo_scope` |
| `core/reach/firecrawlReach.js` | Split `gatherHits` into `searchHits` (search-only) + `scrapeTopHits` (scrape-only), so broadening never double-scrapes |
| `core/reach/reachEngine.js` | `discover()` orchestrates narrow→(maybe broad)→scrape-once→normalize |
| `core/capabilities.js` | `queryBuild` new schema, `discoverCandidates` passthrough, `rankTargets` geo-aware input |
| `core/demo.js` | `queryBuild` demo fallback matches new schema |
| `app/server.js` | `/discover` route reads `search_tiers`/`geo_scope` |
| `mcp/server.js` | `query_build`/`discover_candidates` tool schemas match |
| `scripts/smoke.js`, `scripts/test-mcp.js` | Updated to new shapes |
| `app/public/app.js` | `geo_scope` display block, `geo_fit` badges |

---

### Task 1: `config.js` — add `reachBroadenThreshold`

**Files:**
- Modify: `core/config.js:38-40`

**Interfaces:**
- Produces: `config.reachBroadenThreshold` (number) — consumed by Task 5 (`reachEngine.js`).

- [ ] **Step 1: Edit `core/config.js`**

Find this block (lines 38-40):

```js
  reachSearchLimit: parseInt(process.env.REACH_SEARCH_LIMIT || "6", 10),
  reachScrapeTop: parseInt(process.env.REACH_SCRAPE_TOP || "6", 10),
  reachDefaultSource: process.env.REACH_DEFAULT_SOURCE || "auto",
```

Replace with:

```js
  reachSearchLimit: parseInt(process.env.REACH_SEARCH_LIMIT || "6", 10),
  reachScrapeTop: parseInt(process.env.REACH_SCRAPE_TOP || "6", 10),
  reachDefaultSource: process.env.REACH_DEFAULT_SOURCE || "auto",
  reachBroadenThreshold: parseInt(process.env.REACH_BROADEN_THRESHOLD || "6", 10),
```

- [ ] **Step 2: Verify**

Run: `node -e "import('./core/config.js').then(m => console.log(m.config.reachBroadenThreshold))"`
Expected: `6`

- [ ] **Step 3: Commit**

```bash
git add core/config.js
git commit -m "config: add reachBroadenThreshold for adaptive search broadening"
```

---

### Task 2: `syntheticReach.js` — deterministic geo-filtering of the demo pool

**Files:**
- Modify: `core/reach/syntheticReach.js`
- Test: `scripts/test-synthetic-geo.js` (new)

**Interfaces:**
- Consumes: nothing new (pure module).
- Produces: `gatherSynthetic(geoScope)` — signature changes from `gatherSynthetic()` to `gatherSynthetic(geoScope)`. `geoScope` shape: `{ catchment_places: [{ place, country, cross_border, note }], ... }` or `null`/`undefined`. Consumed by Task 5 (`reachEngine.js`).

The 14 fixed profiles use `"City, XX"` / `"City/Remote, XX"` locations with country codes `HU`, `PL`, `CZ`, `RO`, `SK` (confirmed by reading the full pool). `geo_scope.catchment_places[].country` will contain full country names (e.g. `"Hungary"`, `"Slovakia"`) per the validated prompt design — so filtering needs a small name→code map for exactly those 5 countries. Fail open (don't filter) whenever a location or country can't be confidently parsed, and fail open to the full pool if the geo-filtered set is too thin (< 3) — a demo must never go to zero candidates.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-synthetic-geo.js`:

```js
// Egységteszt: syntheticReach determinisztikus geo-szűrése (nincs API-hívás).
import { gatherSynthetic } from "../core/reach/syntheticReach.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// 1) Nincs geo_scope → visszaadja az összes 14 mintajelöltet (jelenlegi viselkedés megmarad).
const all = await gatherSynthetic(null);
ok("geoScope nélkül → mind a 14 minta visszajön", all.length === 14);

// 2) Szűk (HU-only) geo_scope → csak HU-jelöltek jönnek vissza, és kevesebb, mint 14.
const huOnly = await gatherSynthetic({
  catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
});
ok("HU-only geo_scope → csak magyar helyszínű jelöltek", huOnly.every((c) => c.location.trim().toUpperCase().endsWith("HU")));
ok("HU-only geo_scope → szűkebb, mint a teljes pool", huOnly.length > 0 && huOnly.length < 14);

// 3) Több ország (HU + SK) → legalább egy SK jelölt is bekerül.
const huSk = await gatherSynthetic({
  catchment_places: [
    { place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" },
    { place: "Bratislava", country: "Slovakia", cross_border: true, note: "cross-border" },
  ],
});
ok("HU+SK geo_scope → tartalmaz SK jelöltet", huSk.some((c) => c.location.trim().toUpperCase().endsWith("SK")));

// 4) Ha a szűrt halmaz túl vékony (<3), essen vissza a teljes poolra (soha ne legyen üres demo).
const nothingMatches = await gatherSynthetic({
  catchment_places: [{ place: "Reykjavik", country: "Iceland", cross_border: false, note: "no match in pool" }],
});
ok("Nincs egyező ország → visszaesik a teljes poolra (fail-open)", nothingMatches.length === 14);

console.log("\nsyntheticReach geo-szűrés teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-synthetic-geo.js`
Expected: throws or fails, because `gatherSynthetic` doesn't accept a `geoScope` argument yet and does no filtering.

- [ ] **Step 3: Implement the filtering**

In `core/reach/syntheticReach.js`, add before the `let seq = 0;` line (currently line 147):

```js
const COUNTRY_NAME_TO_CODE = {
  hungary: "HU",
  poland: "PL",
  czechia: "CZ",
  "czech republic": "CZ",
  romania: "RO",
  slovakia: "SK",
};

function countryCodeOf(location) {
  const parts = String(location || "").split(",");
  if (parts.length < 2) return null;
  return parts[parts.length - 1].trim().toUpperCase();
}

function matchesGeo(candidate, geoScope) {
  if (!geoScope || !Array.isArray(geoScope.catchment_places) || !geoScope.catchment_places.length) return true;
  const candCode = countryCodeOf(candidate.location);
  if (!candCode) return true;
  const wantedCodes = new Set(
    geoScope.catchment_places
      .map((p) => COUNTRY_NAME_TO_CODE[String(p.country || "").trim().toLowerCase()])
      .filter(Boolean)
  );
  if (!wantedCodes.size) return true;
  return wantedCodes.has(candCode);
}

const MIN_SYNTHETIC_RESULTS = 3;
```

Then replace the existing `gatherSynthetic` function:

```js
let seq = 0;
export async function gatherSynthetic() {
  seq = 0;
  return POOL.map((c) => {
    seq += 1;
    return {
      ...c,
      id: `syn-${String(seq).padStart(3, "0")}`,
      synthetic: true,
      source_url: null,
      source_type: "synthetic",
      art14_status: "n/a (mintaadat)",
      provenance: {
        method: "synthetic-pool",
        query: null,
        fetched_at: new Date().toISOString(),
      },
    };
  });
}
```

with:

```js
let seq = 0;
export async function gatherSynthetic(geoScope) {
  seq = 0;
  const geoFiltered = POOL.filter((c) => matchesGeo(c, geoScope));
  const chosen = geoFiltered.length >= MIN_SYNTHETIC_RESULTS ? geoFiltered : POOL;
  return chosen.map((c) => {
    seq += 1;
    return {
      ...c,
      id: `syn-${String(seq).padStart(3, "0")}`,
      synthetic: true,
      source_url: null,
      source_type: "synthetic",
      art14_status: "n/a (mintaadat)",
      provenance: {
        method: "synthetic-pool",
        query: null,
        fetched_at: new Date().toISOString(),
      },
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-synthetic-geo.js`
Expected: all 5 `✅` lines, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add core/reach/syntheticReach.js scripts/test-synthetic-geo.js
git commit -m "reach: synthetic pool filters by geo_scope instead of ignoring location"
```

---

### Task 3: `normalize.js` — per-candidate `geo_fit` classification

**Files:**
- Modify: `core/reach/normalize.js`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `normalizeHits(hits, geoScope)` — signature changes from `normalizeHits(hits)`. Adds `geo_fit: "in_scope" | "adjacent" | "out_of_scope" | "unknown" | null` to each returned candidate record. Consumed by Task 5 (`reachEngine.js`).

- [ ] **Step 1: Edit the extraction schema and prompt**

In `core/reach/normalize.js`, replace the `EXTRACT_TASK` constant (current lines 19-36):

```js
const EXTRACT_TASK = `FELADAT: Nyers webes találatokból strukturálj passzív jelölt-rekordokat egy fejvadász-kutatáshoz (senior tech / CEE).
Minden találathoz adj vissza egy objektumot. CSAK azt írd le, ami a szövegből EVIDENCIÁLISAN kiolvasható; ne találj ki nevet, céget, tényt.
Ha egy találat nyilván NEM személy (pl. céglista, álláshirdetés, cikk), akkor is add vissza, de jelöld: "is_person": false.

Kimeneti séma:
{
  "candidates": [
    {
      "ref": "<a bemeneti hit 'ref' mezője, változatlanul>",
      "is_person": true|false,
      "name": "<név vagy null>",
      "headline": "<jelenlegi szerep/pozíció rövid leírása vagy null>",
      "current_company": "<cég vagy null>",
      "location": "<város/ország vagy null>",
      "signals": [ { "signal": "<konkrét szakmai jel a szövegből>", "strength": "erős|közepes|gyenge" } ]
    }
  ]
}`;
```

with:

```js
const EXTRACT_TASK = `FELADAT: Nyers webes találatokból strukturálj passzív jelölt-rekordokat egy fejvadász-kutatáshoz (senior tech / CEE).
Minden találathoz adj vissza egy objektumot. CSAK azt írd le, ami a szövegből EVIDENCIÁLISAN kiolvasható; ne találj ki nevet, céget, tényt.
Ha egy találat nyilván NEM személy (pl. céglista, álláshirdetés, cikk), akkor is add vissza, de jelöld: "is_person": false.

Ha a bemenet tartalmaz egy FÖLDRAJZI HATÓKÖR (geo_scope) blokkot, minden személynél (is_person=true) állapítsd meg a "geo_fit" mezőt is, a kinyert "location" és a geo_scope (anchor, search_elasticity, catchment_places, rationale) alapján — NE listaegyezés alapján dönts, hanem gondolkodj el frissen minden jelöltnél, hogy a helyszíne beleillik-e a geo_scope logikájába (olyan helyre is mondhatsz "in_scope"-ot, ami nincs név szerint felsorolva a catchment_places-ben, ha a rugalmasság/indoklás ezt alátámasztja):
- "in_scope": a helyszín egyértelműen megfelel a geo_scope-nak (az anchor, egy megnevezett catchment hely, vagy — "loose" rugalmasságnál — bármely, a rationale szerint releváns ország/régió).
- "adjacent": plauzibilis, de nem egyértelmű illeszkedés (pl. közeli, de nem nevesített település; vagy határeset egy "moderate" keresésnél).
- "out_of_scope": a helyszín egyértelműen máshol van, és a rugalmasság ezt nem indokolja (pl. "tight" keresésnél távoli ország).
- "unknown": a location mezőből nem állapítható meg megbízhatóan.
Ha nincs geo_scope a bemenetben, vagy a jelölt nem személy, a "geo_fit" legyen null.

Kimeneti séma:
{
  "candidates": [
    {
      "ref": "<a bemeneti hit 'ref' mezője, változatlanul>",
      "is_person": true|false,
      "name": "<név vagy null>",
      "headline": "<jelenlegi szerep/pozíció rövid leírása vagy null>",
      "current_company": "<cég vagy null>",
      "location": "<város/ország vagy null>",
      "geo_fit": "in_scope|adjacent|out_of_scope|unknown|null",
      "signals": [ { "signal": "<konkrét szakmai jel a szövegből>", "strength": "erős|közepes|gyenge" } ]
    }
  ]
}`;
```

- [ ] **Step 2: Thread `geoScope` through `normalizeHits` and the input builder**

Replace the `export async function normalizeHits(hits) {` line and the `input` construction inside it (current lines 38-51):

```js
export async function normalizeHits(hits) {
  const withRef = hits.map((h, i) => ({ ...h, ref: `h${i}` }));

  let extracted = {};
  if (brainAvailable() && withRef.length) {
    try {
      const input =
        "TALÁLATOK:\n" +
        withRef
          .map(
            (h) =>
              `[${h.ref}] forrás=${h.source_type} url=${h.url}\ncím: ${h.title}\nleírás: ${h.description}\nkivonat: ${(h.excerpt || "").slice(0, 800)}`
          )
          .join("\n\n");
      const out = await think({ task: EXTRACT_TASK, input, maxTokens: 6000, temperature: 0.2 });
      for (const c of out.candidates || []) extracted[c.ref] = c;
    } catch {
      // ha az extrakció elhal, jön a heurisztika
    }
  }
```

with:

```js
export async function normalizeHits(hits, geoScope) {
  const withRef = hits.map((h, i) => ({ ...h, ref: `h${i}` }));

  let extracted = {};
  if (brainAvailable() && withRef.length) {
    try {
      const geoBlock = geoScope ? `FÖLDRAJZI HATÓKÖR (geo_scope):\n${JSON.stringify(geoScope)}\n\n` : "";
      const input =
        geoBlock +
        "TALÁLATOK:\n" +
        withRef
          .map(
            (h) =>
              `[${h.ref}] forrás=${h.source_type} url=${h.url}\ncím: ${h.title}\nleírás: ${h.description}\nkivonat: ${(h.excerpt || "").slice(0, 800)}`
          )
          .join("\n\n");
      const out = await think({ task: EXTRACT_TASK, input, maxTokens: 6000, temperature: 0.2 });
      for (const c of out.candidates || []) extracted[c.ref] = c;
    } catch {
      // ha az extrakció elhal, jön a heurisztika
    }
  }
```

- [ ] **Step 3: Include `geo_fit` in the returned candidate record**

Find the return object inside `normalizeHits`'s final `.map` (current lines 59-84, the `return { id: idFor(...), ... }` block). Locate this line:

```js
      location: e.location || null,
      is_person: e.is_person !== false,
```

Replace with:

```js
      location: e.location || null,
      geo_fit: e.geo_fit || null,
      is_person: e.is_person !== false,
```

- [ ] **Step 4: Manual verification (no automated test — this path requires a live LLM call)**

This function only produces `geo_fit` when `brainAvailable()` is true (live mode); there's no synchronous/deterministic path to unit-test here without an API key, matching how this codebase already treats LLM-extraction quality (verified via `eval/`, not `npm run smoke`). Confirm the file parses and exports correctly:

Run: `node -e "import('./core/reach/normalize.js').then(m => console.log(typeof m.normalizeHits))"`
Expected: `function`

The end-to-end live-mode check happens in Task 16.

- [ ] **Step 5: Commit**

```bash
git add core/reach/normalize.js
git commit -m "reach: normalize.js classifies geo_fit per candidate against geo_scope"
```

---

### Task 4: `firecrawlReach.js` — split search from scrape

**Files:**
- Modify: `core/reach/firecrawlReach.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `searchHits(queries, { onProgress })` (search-only, returns hit objects with empty `excerpt`) and `scrapeTopHits(hits, { onProgress })` (mutates/returns the same array with `excerpt` filled for the top `config.reachScrapeTop` scrapable hits). Replaces the single `gatherHits` export. Consumed by Task 5 (`reachEngine.js`) — this split lets the engine decide whether to broaden *before* paying the scrape cost, and scrape only once on the merged set.

- [ ] **Step 1: Replace `gatherHits` with two functions**

In `core/reach/firecrawlReach.js`, replace the entire `gatherHits` function (current lines 67-108):

```js
/**
 * Nyers találatok gyűjtése több keresési lekérdezésből, majd a legígéretesebbek
 * mély scrapelése. Visszaad: [{url, title, description, source_type, excerpt, query}]
 */
export async function gatherHits(queries, { onProgress } = {}) {
  const capped = (queries || []).filter(Boolean).slice(0, 5);
  const seen = new Map();

  for (const q of capped) {
    onProgress && onProgress(`Keresés: ${q}`);
    let rows = [];
    try {
      rows = await search(q, config.reachSearchLimit);
    } catch (e) {
      onProgress && onProgress(`⚠️ keresés hiba (${q}): ${e.message}`);
      continue;
    }
    for (const r of rows) {
      if (seen.has(r.url)) continue;
      seen.set(r.url, {
        url: r.url,
        title: r.title,
        description: r.description,
        source_type: classifySource(r.url),
        query: q,
        excerpt: "",
      });
    }
  }

  const hits = [...seen.values()];

  // Mély scrapelés a top scrapelhető találatokra.
  const scrapable = hits.filter((h) => isDeepScrapable(h.source_type)).slice(0, config.reachScrapeTop);
  for (const h of scrapable) {
    onProgress && onProgress(`Scrapelés: ${h.url}`);
    const s = await scrape(h.url);
    h.excerpt = (s.markdown || "").slice(0, 1600);
  }

  return hits;
}
```

with:

```js
/**
 * Keresés (nincs scrapelés) több lekérdezésből, URL szerint dedupelve.
 * Visszaad: [{url, title, description, source_type, excerpt: "", query}]
 */
export async function searchHits(queries, { onProgress } = {}) {
  const capped = (queries || []).filter(Boolean).slice(0, 5);
  const seen = new Map();

  for (const q of capped) {
    onProgress && onProgress(`Keresés: ${q}`);
    let rows = [];
    try {
      rows = await search(q, config.reachSearchLimit);
    } catch (e) {
      onProgress && onProgress(`⚠️ keresés hiba (${q}): ${e.message}`);
      continue;
    }
    for (const r of rows) {
      if (seen.has(r.url)) continue;
      seen.set(r.url, {
        url: r.url,
        title: r.title,
        description: r.description,
        source_type: classifySource(r.url),
        query: q,
        excerpt: "",
      });
    }
  }

  return [...seen.values()];
}

/**
 * Mély scrapelés a legígéretesebb (scrapelhető típusú) találatokra, egyszer,
 * a teljes (esetlegesen szűk+tág körből összefésült) hit-halmazon.
 * A bemeneti tömböt módosítja és adja vissza.
 */
export async function scrapeTopHits(hits, { onProgress } = {}) {
  const scrapable = hits.filter((h) => isDeepScrapable(h.source_type) && !h.excerpt).slice(0, config.reachScrapeTop);
  for (const h of scrapable) {
    onProgress && onProgress(`Scrapelés: ${h.url}`);
    const s = await scrape(h.url);
    h.excerpt = (s.markdown || "").slice(0, 1600);
  }
  return hits;
}
```

- [ ] **Step 2: Verify the module still loads and exports the new functions**

Run: `node -e "import('./core/reach/firecrawlReach.js').then(m => console.log(typeof m.searchHits, typeof m.scrapeTopHits, typeof m.gatherHits))"`
Expected: `function function undefined`

- [ ] **Step 3: Commit**

```bash
git add core/reach/firecrawlReach.js
git commit -m "reach: split gatherHits into searchHits + scrapeTopHits (scrape-once for adaptive broadening)"
```

---

### Task 5: `reachEngine.js` — adaptive narrow→broad discovery

**Files:**
- Modify: `core/reach/reachEngine.js`
- Test: `scripts/test-reach-tiers.js` (new)

**Interfaces:**
- Consumes: `config.reachBroadenThreshold` (Task 1), `gatherSynthetic(geoScope)` (Task 2), `normalizeHits(hits, geoScope)` (Task 3), `searchHits`/`scrapeTopHits` (Task 4).
- Produces: `discover({ searchTiers, geoScope, source, onProgress })` — signature changes from `discover({ searchQueries, source, onProgress })`. `searchTiers` shape: `[{ tier: "narrow"|"broad", firecrawl_search_queries: string[] }]`. Consumed by Task 8 (`capabilities.js` `discoverCandidates`).

This task can't call live Firecrawl in an automated test (no key in CI/dev by default), so the automated test uses dependency-injection-free unit coverage of the pure tier-lookup helper, and full behavior is exercised via the synthetic path (which Task 2 already made deterministic) plus manual live verification in Task 16.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-reach-tiers.js`:

```js
// Egységteszt: reachEngine tier-választása és a synthetic-ág geo-átadása (nincs élő API-hívás).
import { discover } from "../core/reach/reachEngine.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// Synthetic ágon a discover() a geoScope-ot változatlanul továbbadja gatherSynthetic-nek,
// és search_tiers hiányában/üresen sem dob hibát.
const res = await discover({
  searchTiers: [
    { tier: "narrow", firecrawl_search_queries: ["site:linkedin.com/in staff engineer payments Budapest"] },
    { tier: "broad", firecrawl_search_queries: ["payments engineer CEE"] },
  ],
  geoScope: {
    catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
  },
  source: "synthetic",
});
ok("discover(synthetic) → source visszaadva", res.source === "synthetic");
ok("discover(synthetic) → geoScope alkalmazva (szűkebb, mint a teljes pool)", res.candidates.length > 0 && res.candidates.length <= 14);
ok("discover(synthetic) → minden jelölt magyar helyszínű", res.candidates.every((c) => c.location.trim().toUpperCase().endsWith("HU")));

const empty = await discover({ searchTiers: [], geoScope: null, source: "synthetic" });
ok("discover(synthetic) üres tiers/geoScope esetén sem dob hibát", empty.candidates.length === 14);

console.log("\nreachEngine tier-teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-reach-tiers.js`
Expected: throws (`discover` still destructures `searchQueries`, not `searchTiers`, so `gatherSynthetic` is called with no `geoScope` and filtering doesn't happen — the "HU-only" assertion fails).

- [ ] **Step 3: Implement the new `discover()`**

Replace the entire `core/reach/reachEngine.js` file contents (currently lines 1-49) with:

```js
// Reach Engine — egységes discovery interfész. A felület nem tudja, mi van mögötte.
// Ez a "seam", ahova később a residential-proxy / vendor-feed bővítés becsatolható (spec §5).
import { config, reachLiveAvailable } from "../config.js";
import { searchHits, scrapeTopHits } from "./firecrawlReach.js";
import { gatherSynthetic } from "./syntheticReach.js";
import { normalizeHits } from "./normalize.js";

function pickSource(requested) {
  const r = requested || config.reachDefaultSource || "auto";
  if (r === "synthetic") return "synthetic";
  if (r === "firecrawl") return reachLiveAvailable() ? "firecrawl" : "synthetic";
  // auto
  return reachLiveAvailable() ? "firecrawl" : "synthetic";
}

function tierQueries(searchTiers, tierName) {
  const t = (searchTiers || []).find((x) => x && x.tier === tierName);
  return (t && t.firecrawl_search_queries) || [];
}

/**
 * @param {object} p
 * @param {Array<{tier: string, firecrawl_search_queries: string[]}>} p.searchTiers - a queryBuild "search_tiers" kimenete
 * @param {object} [p.geoScope] - a queryBuild "geo_scope" kimenete
 * @param {string} [p.source] - "auto" | "firecrawl" | "synthetic"
 * @param {function} [p.onProgress]
 * @returns {Promise<{source, candidates, note}>}
 */
export async function discover({ searchTiers, geoScope, source, onProgress }) {
  const chosen = pickSource(source);

  if (chosen === "synthetic") {
    const candidates = await gatherSynthetic(geoScope);
    return {
      source: "synthetic",
      candidates,
      note:
        "Mintaadatok (senior tech / CEE) — nem valós személyek. " +
        "Élő kutatáshoz a nyilvános webes forrás bekapcsolása szükséges (lásd Beállítások / telepítési útmutató).",
    };
  }

  const narrowQ = tierQueries(searchTiers, "narrow");
  const broadQ = tierQueries(searchTiers, "broad");

  onProgress && onProgress("Firecrawl publikus-web discovery indul (szűk kör)…");
  let hits = await searchHits(narrowQ, { onProgress });
  let broadened = false;
  if (hits.length < config.reachBroadenThreshold && broadQ.length) {
    broadened = true;
    onProgress && onProgress(`Kevés találat (${hits.length}) — kibővített kereséssel folytatjuk…`);
    const more = await searchHits(broadQ, { onProgress });
    const seen = new Set(hits.map((h) => h.url));
    for (const h of more) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      hits.push(h);
    }
  }

  onProgress && onProgress(`${hits.length} nyers találat — mély scrapelés a legígéretesebbeken…`);
  hits = await scrapeTopHits(hits, { onProgress });

  onProgress && onProgress(`normalizálás…`);
  const candidates = await normalizeHits(hits, geoScope);
  const persons = candidates.filter((c) => c.is_person !== false);
  return {
    source: "firecrawl",
    candidates: persons,
    note:
      `Nyilvános webes források: ${persons.length} jelölt ${hits.length} találatból.` +
      (broadened ? " A szűk keresés kevés találatot hozott — automatikusan kibővítettük a keresést." : "") +
      " Nincs belépett/fake-account LinkedIn-hozzáférés — a LinkedIn-URL-ek a keresőből, a mélység a nyilvánosan elérhető forrásokból (GitHub, cég-oldal, konferencia-bio, blog).",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-reach-tiers.js`
Expected: all 4 `✅` lines, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add core/reach/reachEngine.js scripts/test-reach-tiers.js
git commit -m "reach: discover() adaptively broadens narrow→broad tiers, scrapes once"
```

---

### Task 6: `capabilities.js` + `demo.js` — `queryBuild` new schema

**Files:**
- Modify: `core/capabilities.js:57-71`
- Modify: `core/demo.js:30-46`
- Test: `scripts/test-query-build-demo.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `queryBuild(...)` output shape `{ boolean_queries, geo_scope: { search_elasticity, anchor, catchment_places, rationale }, search_tiers: [{tier, firecrawl_search_queries}], target_companies, target_titles, synonyms }` — no more flat `firecrawl_search_queries`. Consumed by Task 8, Task 10, Task 11, Task 12.

These two files must change together — `capabilities.js`'s live-mode schema and `demo.js`'s no-key fallback must describe the same shape, or demo mode (which most local runs use, per README) breaks. The test below runs in demo mode (no `ANTHROPIC_API_KEY`), which is deterministic and needs no live call.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-query-build-demo.js`:

```js
// Egységteszt: queryBuild demo-módban (nincs API-kulcs) az új sémát adja vissza.
import * as ric from "../core/index.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (ric.brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

const q = await ric.queryBuild({ intake: { must_haves: ["payments"] }, brief: "teszt brief" });

ok("queryBuild → geo_scope objektum jelen van", !!q.geo_scope && typeof q.geo_scope === "object");
ok("queryBuild → geo_scope.search_elasticity érvényes érték", ["tight", "moderate", "loose"].includes(q.geo_scope.search_elasticity));
ok("queryBuild → geo_scope.catchment_places tömb, nem üres", Array.isArray(q.geo_scope.catchment_places) && q.geo_scope.catchment_places.length > 0);
ok("queryBuild → geo_scope.rationale szöveg", typeof q.geo_scope.rationale === "string" && q.geo_scope.rationale.length > 0);
ok("queryBuild → search_tiers tömb, narrow + broad szinttel", Array.isArray(q.search_tiers) && q.search_tiers.some((t) => t.tier === "narrow") && q.search_tiers.some((t) => t.tier === "broad"));
ok("queryBuild → régi lapos firecrawl_search_queries NINCS a gyökérben", q.firecrawl_search_queries === undefined);

console.log("\nqueryBuild demo-séma teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-query-build-demo.js`
Expected: fails on `geo_scope` assertions (current demo fallback has no `geo_scope`/`search_tiers`, still has flat `firecrawl_search_queries`).

- [ ] **Step 3: Update `core/capabilities.js`'s `queryBuild`**

Replace the entire `queryBuild` function (current lines 57-71):

```js
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
```

with:

```js
// ── 🧠 KERESÉSI TERV ─────────────────────────────────────────
export async function queryBuild({ intake, brief, position }, { projectId } = {}) {
  const task = `FELADAT: Készíts keresési tervet KÉT részben.

(1) FÖLDRAJZI HATÓKÖR ("geo_scope"): gondolkodj el a szerep valódi keresési földrajzán. Elsőként reálisan, megnevezett helyekben gondolkodj (akár országhatáron át is, ha egy külföldi hely road-távolságban közelebb van, mint egy belföldi) — csak olyan helyet vegyél fel, amire konkrét, evidencia-alapú indokod van (valós ingázási folyosó, ismert vonzáskörzeti település, dokumentált határon-átnyúló munkaerő-mozgás); ne told fel a listát spekulatív, "néha idesorolható" helyekkel. NE adj meg konkrét perc- vagy km-adatot — ehhez nincs megbízható adatod, csak relatív/összehasonlító ítéleted lehet ("X közelebb van az anchorhoz, mint Y"). Az anchor (a megbízás helyszíne, position.location) MINDIG szerepeljen a catchment_places listában, a rugalmasságtól függetlenül.

Másodjára állapítsd meg a "search_elasticity" értéket (tight|moderate|loose) — ez azt fejezi ki, mennyire kell a keresést földrajzilag megkötni, és a szerep valós piaci utánpótlási mintázatából következik, NEM a munkavégzés helyszínéből (helyszíni/hibrid/távoli) és NEM abból, hogy a helylista hosszú-e vagy határon átnyúlik-e:
- "tight": belépő szintű, nagy volumenű, műszakos vagy más módon helyettesíthető/bőséges helyi munkaerő-kínálatú szerep, fizikai jelenléttel. Behatárolt helyi/céges-buszjárat vonzáskörzet.
- "moderate": senior IC / szakértő / csoportvezetői szerep valós, de részleges helyszíni elvárással. Szélesebb, akár régiós/határon-átnyúló ingázási terület, de nem költözés-alapú keresés.
- "loose": valódi felsővezetői/C-szintű vagy ritka szakértői keresés, amit jellemzően országosan vagy nemzetközileg töltenek be, ahol a költözés/nem-napi ingázás a norma. Ilyenkor ne ingázási sugárban gondolkodj, hanem országos/nemzetközi tehetségpiacban.

Mielőtt lezárnád: ellenőrizd, hogy a "search_elasticity" összhangban van-e a földrajzi indoklásoddal — ha behatárolt helyi/buszjárat-vonzáskörzetet írtál le, az elasticity nem lehet "loose"; ha országos/ritka-szakértői tehetségpiacról írtál, ne írj le egyúttal szűk ingázó-települések gyűrűjét. Ha a kettő nem egyezik, javítsd az egyiket, mielőtt válaszolsz. "loose" rugalmasság esetén is adj meg valós, konkrét helyeket (pl. domináns szakmai-vezetői központokat, releváns nemzetközi csomópontokat a brief kontextusához kötve) — az üres lista nem elfogadható válasz.

(2) KERESÉSI LEKÉRDEZÉSEK ("search_tiers"): két szint. "narrow": az elengedhetetlen feltételek (must_haves) mindegyikét ÉSeli, a geo_scope catchment_places-ét beleszőve. "broad": csak a szerep magja (cím/terület), az elengedhetetlen feltételek szigorú kombinációja NÉLKÜL, ugyanazzal a geo_scope-pal — ez akkor kerül ténylegesen lekérdezésre, ha a szűk kör kevés találatot hoz.

ÉS Boolean lekérdezéseket a szokásos platformokra (referenciaanyag, nem kerül automatikusan lekérdezésre).
${LANG}
Kimeneti JSON séma:
{
 "boolean_queries": [ { "platform": "linkedin-xray|github|google", "query": "..." } ],
 "geo_scope": {
   "search_elasticity": "tight|moderate|loose",
   "anchor": "<position.location visszaadva>",
   "catchment_places": [ { "place": "...", "country": "...", "cross_border": true, "note": "<konkrét, evidencia-alapú indok>" } ],
   "rationale": "<földrajzi indoklás + elasticity-indoklás együtt, önellentmondás-mentesen>"
 },
 "search_tiers": [
   { "tier": "narrow", "firecrawl_search_queries": ["<3-4 szűk lekérdezés, site: operátorokkal>"] },
   { "tier": "broad", "firecrawl_search_queries": ["<2-3 tág lekérdezés, site: operátorokkal>"] }
 ],
 "target_companies": ["..."],
 "target_titles": ["..."],
 "synonyms": ["..."]
}`;
  const input = `JAVASOLT POZÍCIÓ-ÖSSZEFOGLALÓ:\n${J(intake || { brief })}${positionCtx(position)}`;
  return run("queryBuild", { task, input, demoInput: { intake } }, projectId);
}
```

- [ ] **Step 4: Update `core/demo.js`'s `queryBuild` fallback**

Replace the entire `queryBuild` entry in the `demo` object (current lines 30-46):

```js
  queryBuild: (input) => ({
    _demo: true,
    boolean_queries: [
      { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' },
      { platform: "github", query: 'site:github.com payments idempotency location:Hungary OR location:Poland' },
      { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' },
    ],
    firecrawl_search_queries: [
      'site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw',
      'site:github.com senior backend engineer payments idempotency Hungary OR Poland',
      'craft conf speaker distributed systems payments CEE',
      'principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in',
    ],
    target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
    target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
    synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
  }),
```

with:

```js
  queryBuild: (input) => ({
    _demo: true,
    boolean_queries: [
      { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' },
      { platform: "github", query: 'site:github.com payments idempotency location:Hungary OR location:Poland' },
      { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' },
    ],
    geo_scope: {
      search_elasticity: "moderate",
      anchor: "Budapest, HU",
      catchment_places: [
        { place: "Budapest", country: "Hungary", cross_border: false, note: "A megbízás helyszíne — a jelöltpiac magja." },
        { place: "Győr", country: "Hungary", cross_border: false, note: "Regionális tech-hub, hibrid munkavégzéssel elérhető távolság." },
        { place: "Bratislava", country: "Slovakia", cross_border: true, note: "Vasúti/autópálya-kapcsolat Budapesttel, valós CEE senior tech ingázási/hibrid folyosó." },
      ],
      rationale: "Hibrid, senior egyéni-szakértői/tech-lead jellegű szerep — szélesebb, akár határon-átnyúló ingázási területet enged meg, de nem országos költözés-alapú keresést, ezért 'moderate'.",
    },
    search_tiers: [
      {
        tier: "narrow",
        firecrawl_search_queries: [
          'site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw',
          'site:github.com senior backend engineer payments idempotency Hungary OR Poland',
        ],
      },
      {
        tier: "broad",
        firecrawl_search_queries: [
          'craft conf speaker distributed systems payments CEE',
          'principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in',
        ],
      },
    ],
    target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
    target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
    synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
  }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/test-query-build-demo.js`
Expected: all 6 `✅` lines, exit code 0. (If `ANTHROPIC_API_KEY` is set in your shell, temporarily unset it for this run: `env -u ANTHROPIC_API_KEY node scripts/test-query-build-demo.js`.)

- [ ] **Step 6: Commit**

```bash
git add core/capabilities.js core/demo.js scripts/test-query-build-demo.js
git commit -m "capabilities: queryBuild emits geo_scope + tiered search_tiers instead of flat query list"
```

---

### Task 7: `capabilities.js` — `discoverCandidates` passthrough

**Files:**
- Modify: `core/capabilities.js:73-78`

**Interfaces:**
- Consumes: `discover({ searchTiers, geoScope, source, onProgress })` (Task 5).
- Produces: `discoverCandidates({ searchTiers, geoScope, source, onProgress }, { projectId })` — signature changes from `discoverCandidates({ searchQueries, source, onProgress }, ...)`. Consumed by Task 9 (`app/server.js`), Task 10 (`mcp/server.js`).

- [ ] **Step 1: Edit `core/capabilities.js`**

Replace (current lines 73-78):

```js
// ── 📡 JELÖLTKUTATÁS (Reach Engine) ──────────────────────────
export async function discoverCandidates({ searchQueries, source, onProgress }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchQueries, source }, mode: "reach" });
  const res = await reachDiscover({ searchQueries, source, onProgress });
  return res; // { source, candidates, note }
}
```

with:

```js
// ── 📡 JELÖLTKUTATÁS (Reach Engine) ──────────────────────────
export async function discoverCandidates({ searchTiers, geoScope, source, onProgress }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchTiers, geoScope, source }, mode: "reach" });
  const res = await reachDiscover({ searchTiers, geoScope, source, onProgress });
  return res; // { source, candidates, note }
}
```

- [ ] **Step 2: Verify with a synthetic-mode smoke call**

Run:
```bash
node -e "
import('./core/index.js').then(async (ric) => {
  const r = await ric.discoverCandidates({ searchTiers: [], geoScope: null, source: 'synthetic' });
  console.log('candidates:', r.candidates.length, 'source:', r.source);
});
"
```
Expected: `candidates: 14 source: synthetic` (no `geoScope` → fail-open per Task 2, full pool returned).

- [ ] **Step 3: Commit**

```bash
git add core/capabilities.js
git commit -m "capabilities: discoverCandidates passes searchTiers/geoScope through to reachEngine"
```

---

### Task 8: `capabilities.js` — `rankTargets` geo-aware input

**Files:**
- Modify: `core/capabilities.js:118-145`
- Test: `scripts/test-rank-geo.js` (new)

**Interfaces:**
- Consumes: candidate records with `location`/`geo_fit` fields (Task 3 produces these on real candidates; synthetic candidates from Task 2 have `location` but no `geo_fit` — both must be handled without crashing).
- Produces: no signature change (`rankTargets({ candidates, intake }, { projectId })` stays the same) — only the prompt input and instructions change. Guardrail `assertRankingComplete` behavior (imported from `core/guardrails.js`) is unchanged and must still hold.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-rank-geo.js`:

```js
// Egységteszt: rankTargets demo-módban geo_fit mezős jelöltekkel sem szegi meg
// az elszámoltathatósági guardrailt (mindenki bekerül a rangsorba).
import * as ric from "../core/index.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (ric.brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

const candidates = [
  { id: "c1", name: "Teszt Elek", headline: "Staff Engineer", location: "Budapest, HU", geo_fit: "in_scope", signals: [{ signal: "payments", strength: "erős" }] },
  { id: "c2", name: "Teszt Éva", headline: "Staff Engineer", location: "Cluj-Napoca, RO", geo_fit: "out_of_scope", signals: [{ signal: "payments", strength: "közepes" }] },
];

const rank = await ric.rankTargets({ candidates, intake: { must_haves: ["payments"] } });
ok("rankTargets → minden jelölt szerepel a rangsorban", candidates.every((c) => (rank.ranked || []).some((r) => r.candidate_id === c.id)));
ok("rankTargets → nem dobott hibát a geo_fit mezőtől", Array.isArray(rank.ranked));

console.log("\nrankTargets geo-mező teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-rank-geo.js`
Expected: this should actually already pass structurally (demo fallback just maps over candidates) — run it now to confirm the *current* code passes, establishing the baseline before the prompt-text edit in Step 3 (which must not regress it).

- [ ] **Step 3: Edit the `rankTargets` task prompt and input**

In `core/capabilities.js`, find the `rankTargets` function (current lines 118-145). Replace this line:

```js
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki némán (de kaphat D-kategóriát).
```

with:

```js
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki némán (de kaphat D-kategóriát).
FÖLDRAJZ: ha egy jelölt "geo_fit" mezője "out_of_scope", és a szerep helyszínhez kötött (nem távoli munkavégzés), vedd figyelembe a rangsorolásnál, és jelezd tömören a rationale-ben.
```

Then find this line (candidate mapping in the `input` construction):

```js
  const input = `JELÖLTEK:\n${J((candidates || []).map((c) => ({ id: c.id, name: c.name, headline: c.headline, signals: c.signals })))}\n\nSZEREP:\n${J(intake || {})}`;
```

Replace with:

```js
  const input = `JELÖLTEK:\n${J((candidates || []).map((c) => ({ id: c.id, name: c.name, headline: c.headline, location: c.location, geo_fit: c.geo_fit, signals: c.signals })))}\n\nSZEREP:\n${J(intake || {})}`;
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `node scripts/test-rank-geo.js`
Expected: both `✅` lines, exit code 0 (demo fallback is unaffected by prompt-text changes since demo mode never reads `task`/`input`; this confirms the plumbing didn't break).

- [ ] **Step 5: Commit**

```bash
git add core/capabilities.js scripts/test-rank-geo.js
git commit -m "capabilities: rankTargets receives location/geo_fit as explicit ranking input"
```

---

### Task 9: `app/server.js` — `/discover` route

**Files:**
- Modify: `app/server.js:122-134`

**Interfaces:**
- Consumes: `discoverCandidates({ searchTiers, geoScope, source, onProgress }, ...)` (Task 7).
- Produces: no change to the HTTP contract (`POST /api/project/:id/discover` still returns `{ source, candidates, note }`) — only what it reads from `p.query` changes.

- [ ] **Step 1: Edit `app/server.js`**

Replace (current lines 122-134):

```js
// 3) Discover (Reach Engine)
app.post("/api/project/:id/discover", A(async (req, res) => {
  const p = getProj(req, res);
  if (!p) return;
  const source = (req.body && req.body.source) || undefined;
  const sq = (p.query && p.query.firecrawl_search_queries) || [];
  const result = await ric.discoverCandidates({ searchQueries: sq, source }, { projectId: p.id });
  p.candidates = result.candidates;
  p.discover_note = result.note;
  p.discover_source = result.source;
  saveProject(p);
  res.json(result);
}));
```

with:

```js
// 3) Discover (Reach Engine)
app.post("/api/project/:id/discover", A(async (req, res) => {
  const p = getProj(req, res);
  if (!p) return;
  const source = (req.body && req.body.source) || undefined;
  const searchTiers = (p.query && p.query.search_tiers) || [];
  const geoScope = (p.query && p.query.geo_scope) || null;
  const result = await ric.discoverCandidates({ searchTiers, geoScope, source }, { projectId: p.id });
  p.candidates = result.candidates;
  p.discover_note = result.note;
  p.discover_source = result.source;
  saveProject(p);
  res.json(result);
}));
```

- [ ] **Step 2: Verify the server still boots**

Run: `npm run app &` then `sleep 1 && curl -s http://localhost:5178/api/status && kill %1`
Expected: JSON status response, no crash on boot (confirms no syntax error introduced).

- [ ] **Step 3: Commit**

```bash
git add app/server.js
git commit -m "app: /discover route reads query.search_tiers + query.geo_scope"
```

---

### Task 10: `mcp/server.js` — tool schemas

**Files:**
- Modify: `mcp/server.js:19-30`

**Interfaces:**
- Consumes: `queryBuild({ intake, brief, position }, ...)` (Task 6, unchanged signature — only adding `position` passthrough here), `discoverCandidates({ searchTiers, geoScope, source }, ...)` (Task 7).
- Produces: no change to the MCP tool *names*, only `inputSchema`/`description`/`run` for `query_build` and `discover_candidates`.

- [ ] **Step 1: Edit `mcp/server.js`**

Replace (current lines 19-30):

```js
  {
    name: "query_build",
    description: "🧠 Keresési terv készítése: boolean lekérdezések + 'firecrawl_search_queries', amelyek a nyilvános webes jelöltkutatást vezérlik (senior tech / CEE).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.queryBuild({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "discover_candidates",
    description: "📡 Jelöltkutatás nyilvánosan elérhető szakmai forrásokban (nincs belépett/fake-account LinkedIn-hozzáférés). Kulcs nélkül mintaadatokkal fut. Bemenet: a query_build 'firecrawl_search_queries' listája.",
    inputSchema: { type: "object", properties: { search_queries: { type: "array", items: STR }, source: { type: "string", enum: ["auto", "firecrawl", "synthetic"] } }, required: ["search_queries"] },
    run: (a) => ric.discoverCandidates({ searchQueries: a.search_queries, source: a.source }),
  },
```

with:

```js
  {
    name: "query_build",
    description: "🧠 Keresési terv készítése: 'geo_scope' (földrajzi hatókör + rugalmasság) és 'search_tiers' (szűk/tág lekérdezés-szintek), amelyek a nyilvános webes jelöltkutatást vezérlik (senior tech / CEE).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR, position: OBJ } },
    run: (a) => ric.queryBuild({ intake: a.intake, brief: a.brief, position: a.position }),
  },
  {
    name: "discover_candidates",
    description: "📡 Jelöltkutatás nyilvánosan elérhető szakmai forrásokban (nincs belépett/fake-account LinkedIn-hozzáférés). Kulcs nélkül mintaadatokkal fut. Bemenet: a query_build 'search_tiers' és 'geo_scope' kimenete.",
    inputSchema: { type: "object", properties: { search_tiers: { type: "array", items: OBJ }, geo_scope: OBJ, source: { type: "string", enum: ["auto", "firecrawl", "synthetic"] } }, required: ["search_tiers"] },
    run: (a) => ric.discoverCandidates({ searchTiers: a.search_tiers, geoScope: a.geo_scope, source: a.source }),
  },
```

- [ ] **Step 2: Verify the module still parses**

Run: `node -e "import('./mcp/server.js')" &` then `sleep 1 && kill %1`
Expected: no syntax/import error before it's killed (the server blocks on stdio, so this just confirms it starts without crashing).

- [ ] **Step 3: Commit**

```bash
git add mcp/server.js
git commit -m "mcp: query_build/discover_candidates tool schemas match new search_tiers/geo_scope shape"
```

---

### Task 11: `scripts/smoke.js` — update to new shapes

**Files:**
- Modify: `scripts/smoke.js:16-19`

**Interfaces:**
- Consumes: `queryBuild` (Task 6), `discoverCandidates` (Task 7) new shapes.
- Produces: n/a (this is the test script itself).

- [ ] **Step 1: Edit `scripts/smoke.js`**

Replace (current lines 16-19):

```js
const query = await ric.queryBuild({ intake });
ok("queryBuild → firecrawl_search_queries", Array.isArray(query.firecrawl_search_queries) && query.firecrawl_search_queries.length > 0);

const disc = await ric.discoverCandidates({ searchQueries: query.firecrawl_search_queries, source: "synthetic" });
```

with:

```js
const query = await ric.queryBuild({ intake });
ok("queryBuild → geo_scope", !!query.geo_scope && ["tight", "moderate", "loose"].includes(query.geo_scope.search_elasticity));
ok("queryBuild → search_tiers (narrow+broad)", Array.isArray(query.search_tiers) && query.search_tiers.length >= 2);

const disc = await ric.discoverCandidates({ searchTiers: query.search_tiers, geoScope: query.geo_scope, source: "synthetic" });
```

- [ ] **Step 2: Run the full smoke suite**

Run: `npm run smoke`
Expected: all `✅` lines (demo mode if no `ANTHROPIC_API_KEY`, live mode otherwise), `Smoke kész.` at the end, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke.js
git commit -m "scripts: smoke.js exercises the new geo_scope/search_tiers pipeline shape"
```

---

### Task 12: `scripts/test-mcp.js` — update `discover_candidates` call

**Files:**
- Modify: `scripts/test-mcp.js:21`

**Interfaces:**
- Consumes: MCP `discover_candidates` tool's new `inputSchema` (Task 10).
- Produces: n/a (test script).

- [ ] **Step 1: Edit `scripts/test-mcp.js`**

Replace (current line 21):

```js
const disc = await client.callTool({ name: "discover_candidates", arguments: { search_queries: ["site:linkedin.com/in staff engineer payments"], source: "synthetic" } });
```

with:

```js
const disc = await client.callTool({ name: "discover_candidates", arguments: { search_tiers: [{ tier: "narrow", firecrawl_search_queries: ["site:linkedin.com/in staff engineer payments"] }], source: "synthetic" } });
```

- [ ] **Step 2: Run the MCP smoke test**

Run: `node scripts/test-mcp.js`
Expected: all `✅` lines, `MCP smoke kész.` at the end, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-mcp.js
git commit -m "scripts: test-mcp.js discover_candidates call uses search_tiers"
```

---

### Task 13: `app/public/app.js` — `geo_scope` display in the Célpiac view

**Files:**
- Modify: `app/public/app.js:665-681` (`renderQuery`)

**Interfaces:**
- Consumes: `p.query.geo_scope` (Task 6's output shape, stored client-side after the existing `/query` API call — no new endpoint needed).
- Produces: n/a (UI render function, no exported interface consumed elsewhere).

- [ ] **Step 1: Edit `renderQuery`**

Replace the entire `renderQuery` function (current lines 665-681):

```js
function renderQuery(p) {
  const o = p.query;
  const out = $("#queryOut");
  if (!o) { if (p.intake) out.innerHTML = ""; return; }
  out.innerHTML = `
    <div class="card">
      <h4>Keresési terv ${demoTag(o)}</h4>
      ${(o.target_titles || []).length ? `<h4 style="margin-top:4px">Célpozíciók</h4>${chips(o.target_titles)}` : ""}
      ${(o.target_companies || []).length ? `<h4 style="margin-top:8px">Célcégek</h4>${chips(o.target_companies)}` : ""}
      ${(o.synonyms || []).length ? `<h4 style="margin-top:8px">Kulcs-szinonimák</h4>${chips(o.synonyms)}` : ""}
      <details class="or-why" style="margin-top:10px"><summary>Keresési lekérdezések (részletek)</summary>
        ${(o.boolean_queries || []).map((q) => `<div class="q-plat">${esc(q.platform)}</div><code class="q-code">${esc(q.query)}</code>`).join("")}
        <h4 style="margin-top:8px">Webes kereső-lekérdezések</h4>
        ${(o.firecrawl_search_queries || []).map((q) => `<code class="q-code">${esc(q)}</code>`).join("")}
      </details>
    </div>`;
}
```

with:

```js
function renderQuery(p) {
  const o = p.query;
  const out = $("#queryOut");
  if (!o) { if (p.intake) out.innerHTML = ""; return; }
  const gs = o.geo_scope;
  const elasticityLabel = { tight: "szűk (helyi)", moderate: "közepes (régiós)", loose: "tág (országos/nemzetközi)" };
  out.innerHTML = `
    <div class="card">
      <h4>Keresési terv ${demoTag(o)}</h4>
      ${(o.target_titles || []).length ? `<h4 style="margin-top:4px">Célpozíciók</h4>${chips(o.target_titles)}` : ""}
      ${(o.target_companies || []).length ? `<h4 style="margin-top:8px">Célcégek</h4>${chips(o.target_companies)}` : ""}
      ${(o.synonyms || []).length ? `<h4 style="margin-top:8px">Kulcs-szinonimák</h4>${chips(o.synonyms)}` : ""}
      ${gs ? `
        <h4 style="margin-top:8px">Földrajzi hatókör <span class="chip">${esc(elasticityLabel[gs.search_elasticity] || gs.search_elasticity)}</span></h4>
        ${chips((gs.catchment_places || []).map((c) => c.cross_border ? `${c.place} (${c.country})` : c.place))}
        ${gs.rationale ? `<p class="kpi-desc" style="margin-top:4px">${esc(gs.rationale)}</p>` : ""}
      ` : ""}
      <details class="or-why" style="margin-top:10px"><summary>Keresési lekérdezések (részletek)</summary>
        ${(o.boolean_queries || []).map((q) => `<div class="q-plat">${esc(q.platform)}</div><code class="q-code">${esc(q.query)}</code>`).join("")}
        ${(o.search_tiers || []).map((t) => `
          <h4 style="margin-top:8px">Webes kereső-lekérdezések — ${esc(t.tier === "narrow" ? "szűk kör" : "tág kör (csak ha a szűk kör kevés találatot hoz)")}</h4>
          ${(t.firecrawl_search_queries || []).map((q) => `<code class="q-code">${esc(q)}</code>`).join("")}
        `).join("")}
      </details>
    </div>`;
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run app`, open `http://localhost:5178`, create a project, run "Brief elemzése" then "Célpiac" → the "Keresési terv" card should show a "Földrajzi hatókör" section with an elasticity chip, place chips, and a rationale paragraph (demo mode is deterministic, so this reflects Task 6's demo fallback content).

- [ ] **Step 3: Commit**

```bash
git add app/public/app.js
git commit -m "ui: Célpiac view shows geo_scope (elasticity + catchment + rationale)"
```

---

### Task 14: `app/public/app.js` — `geo_fit` badge on candidates

**Files:**
- Modify: `app/public/app.js:758-769` (`renderCandidatesView` row) and `:808-830` (`renderDrawer`)

**Interfaces:**
- Consumes: `candidate.geo_fit` (Task 3's output field, present on live-mode candidates; `null`/`undefined` on synthetic candidates — must render nothing rather than a broken badge in that case).
- Produces: n/a.

- [ ] **Step 1: Add a shared badge helper**

In `app/public/app.js`, insert this function immediately above `function renderCandidatesView(p) {` (current line 715):

```js
function geoFitChip(geoFit) {
  if (!geoFit || geoFit === "unknown") return "";
  const cls = geoFit === "in_scope" ? "good" : geoFit === "out_of_scope" ? "bad" : "warn";
  const label = geoFit === "in_scope" ? "helyszín: illeszkedik" : geoFit === "out_of_scope" ? "helyszín: eltér" : "helyszín: bizonytalan";
  return `<span class="chip ${cls}">${esc(label)}</span>`;
}
```

- [ ] **Step 2: Use it in the candidate row**

In `renderCandidatesView`, find (current lines 764-765):

```js
        <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}</div>
        <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut" style="font-size:10px">kézzel állítva</span>` : ""}</div>
```

Replace with:

```js
        <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}${geoFitChip(x.geo_fit) ? "<br>" + geoFitChip(x.geo_fit) : ""}</div>
        <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut" style="font-size:10px">kézzel állítva</span>` : ""}</div>
```

- [ ] **Step 3: Use it in the candidate drawer**

In `renderDrawer`, find (current line 820):

```js
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")}</div>
```

Replace with:

```js
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")} ${geoFitChip(c.geo_fit)}</div>
```

- [ ] **Step 4: Manual verification**

Run: `npm run app`, open a project with discovered candidates (synthetic candidates won't show a badge since `geo_fit` is `null` for them — expected, per Task 2/3 scope; only live-mode Firecrawl candidates get `geo_fit`). Confirm no rendering errors (check browser console) and that the `.chip.good/.bad/.warn` classes render with the existing color scheme (reuses CSS already defined at `app/public/styles.css:162-166` — no new CSS needed).

- [ ] **Step 5: Commit**

```bash
git add app/public/app.js
git commit -m "ui: candidate row and drawer show geo_fit badge"
```

---

### Task 15: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run every automated check in sequence**

```bash
node scripts/test-synthetic-geo.js
node scripts/test-reach-tiers.js
env -u ANTHROPIC_API_KEY node scripts/test-query-build-demo.js
env -u ANTHROPIC_API_KEY node scripts/test-rank-geo.js
npm run smoke
node scripts/test-mcp.js
```

Expected: every script prints only `✅` lines and exits 0.

- [ ] **Step 2: If everything passes, no commit needed** (nothing changed in this task — it's a checkpoint). If anything fails, fix the specific failure in the file/task it belongs to and re-run only that script before re-running the full sequence.

---

### Task 16: Manual live-mode verification (matches the spec's two regression scenarios)

**Files:** none — this exercises live `ANTHROPIC_API_KEY` (and optionally `FIRECRAWL_API_KEY`) behavior that can't be asserted deterministically.

- [ ] **Step 1: Location sensitivity check**

With `ANTHROPIC_API_KEY` set, run the app (`npm run app`), create two projects with the *same* brief (a common, replaceable role — e.g. adapt `test-briefs/01-platform-engineer-budapest-startup.md`'s brief text but keep it entry/mid-level) but different `position.location` (e.g. Győr vs Budapest). Run "Brief elemzése" → "Célpiac" on both. Confirm: `geo_scope.catchment_places` differs meaningfully between the two (not just the anchor city swapped in a template), and — in `synthetic` reach mode — the discovered candidate subset differs too. This is the direct regression test for "just looks for Hungarian candidates" no longer being true.

- [ ] **Step 2: Elasticity sensitivity check**

Using the same location, create two projects with `position.seniority` set to an entry-level value vs a C-level/executive value (brief text can otherwise stay similar, or use the clerk vs GM brief content drafted during design — see session history / `eval/` for reference style). Run "Brief elemzése" → "Célpiac" on both. Confirm: `geo_scope.search_elasticity` is `tight` (or close to it) for the entry-level case and `loose` for the executive case, with `catchment_places` visibly narrower vs. wider accordingly. This is the direct regression test for the clerk-vs-GM distinction that motivated this whole feature.

- [ ] **Step 3: If either check fails**

Do not patch by hand-tuning the demo fallback (Task 6) — that only affects no-key mode. If live-mode reasoning drifts, the fix belongs in the `queryBuild` task prompt (Task 6, `core/capabilities.js`); re-read the calibration rules in `docs/superpowers/specs/2026-08-02-search-specification-and-geography-design.md` before changing them, since they were empirically validated, not guessed.

- [ ] **Step 4: Update the README if the geography behavior is worth documenting for users**

Optional — only if you judge it worth surfacing in `README.md`'s existing "📡 A scraping — mit csinál és mit NEM" section. Not required for this plan to be considered done.
