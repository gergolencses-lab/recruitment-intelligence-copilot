# Search Specification Tiering & Geographic Reach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrow/broad query-tier fallback plus an evidence-grounded, elasticity-calibrated `geo_scope` to `queryBuild`'s output, additively (no breaking changes to the existing chat-editable `firecrawl_search_queries` field or the client-exclusion feature), and thread both through the Reach Engine (adaptive broadening, geo-fit tagging), ranking, and both surfaces (web app + MCP).

**Architecture:** `queryBuild` keeps its existing `firecrawl_search_queries` field (narrow tier, unchanged, still chat-editable) and adds two new fields: `firecrawl_search_queries_broad` (broad tier, read-only, automatic fallback) and `geo_scope` (search_elasticity + named catchment places, no invented precision, read-only). `reachEngine.discover()` runs the narrow tier first, adaptively fires the broad tier only if raw hits are thin, then scrapes+normalizes once on the merged set. `normalize.js` tags each candidate's `geo_fit` against the whole `geo_scope` object. `syntheticReach.js` filters the fixed demo pool deterministically by country. `rankTargets` receives `location`/`geo_fit` as explicit ranking input. The existing client-exclusion feature (`exclude_companies`, `past_companies`, `client` param, injected synthetic "insider" candidates) is untouched throughout.

**Tech Stack:** Node.js (ESM), Express, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, zero test framework — this repo tests via plain `node scripts/*.js` assertion scripts (`ok(name, cond)` pattern), not jest/vitest. Follow that convention; do not introduce a test framework.

## ⚠️ Important: this plan replaced an earlier version

An earlier version of this plan was written against a stale snapshot of the repo (a `search_tiers` nested-array design). Before dispatching Task 1, the controller discovered 9 new commits had landed on `main` in the meantime — a client-exclusion feature and a chat-driven "strategy assistant" that hardcodes `firecrawl_search_queries` as a flat, chat-editable field in three places. The nested design would have silently broken that feature. This version is corrected and verified against the actual current file contents (quoted verbatim in each task below) as of branch `search-geo-tiering`. **Do not reuse code blocks from any earlier draft of this plan — use only what's written in this file.**

## Global Constraints

- No specific minute/km figures are ever emitted in `geo_scope` — relative/comparative judgment only (validated empirically; see `docs/superpowers/specs/2026-08-02-search-specification-and-geography-design.md`).
- `search_elasticity` is derived from role scarcity/seniority, never from `work_mode` alone, never by mirroring place-list length or border-crossing.
- The anchor location (`position.location`) must always appear in `geo_scope.catchment_places`, regardless of elasticity.
- `loose` elasticity must still name real places — an empty `catchment_places` is not an acceptable output.
- `firecrawl_search_queries` (existing field) keeps its exact name and meaning (narrow tier) — do not rename or restructure it. It remains the field the chat-driven strategy assistant edits.
- The existing client-exclusion feature (`exclude_companies`, `exclusion_note`, `past_companies`, the `client` parameter flowing through `discoverCandidates`/`discover`/`gatherSynthetic`, the injected synthetic "insider" candidates) must keep working identically — every task that touches a function carrying `client` must preserve that parameter.
- No backwards-compatibility shims — every caller of a changed function signature in this repo is updated in this same plan.
- All new/changed Hungarian prompt text follows the existing `LANG` constant convention in `core/capabilities.js` (natural Hungarian, no marketing language, fact/inference/assumption kept separate).

---

## File Structure

| File | Responsibility |
|---|---|
| `core/config.js` | + `reachBroadenThreshold` |
| `core/reach/syntheticReach.js` | + deterministic geo-filtering of the fixed demo pool, alongside the existing client-insider injection |
| `core/reach/normalize.js` | + per-candidate `geo_fit` classification against `geo_scope` |
| `core/reach/firecrawlReach.js` | Split `gatherHits` into `searchHits` (search-only) + `scrapeTopHits` (scrape-only), so broadening never double-scrapes |
| `core/reach/reachEngine.js` | `discover()` orchestrates narrow→(maybe broad)→scrape-once→normalize, preserving `client` passthrough |
| `core/capabilities.js` | `queryBuild` gains `firecrawl_search_queries_broad` + `geo_scope`; `discoverCandidates` passes them through; `rankTargets` gets geo-aware input |
| `core/demo.js` | `queryBuild` demo fallback matches the new additive fields |
| `app/server.js` | `/discover` route reads the two new `p.query` fields |
| `mcp/server.js` | `query_build`/`discover_candidates` tool schemas match |
| `scripts/smoke.js` | Updated to the new fields |
| `app/public/app.js` | `geo_scope` + broad-tier read-only display, `geo_fit` badges |

---

### Task 1: `config.js` — add `reachBroadenThreshold`

**Files:**
- Modify: `core/config.js`

**Interfaces:**
- Produces: `config.reachBroadenThreshold` (number) — consumed by Task 5 (`reachEngine.js`).

- [ ] **Step 1: Edit `core/config.js`**

Find this block:

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

### Task 2: `syntheticReach.js` — deterministic geo-filtering alongside client-insider injection

**Files:**
- Modify: `core/reach/syntheticReach.js`
- Test: `scripts/test-synthetic-geo.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `gatherSynthetic(client, geoScope)` — signature changes from `gatherSynthetic(client)` by adding a second parameter. `geoScope` shape: `{ catchment_places: [{ place, country, cross_border, note }], ... }` or `null`/`undefined`. Consumed by Task 5 (`reachEngine.js`).

The current file (verified — do not assume any other shape) builds a 14-entry base `POOL` (locations use `"City, XX"` / `"City/Remote, XX"` suffixes, country codes `HU`/`PL`/`CZ`/`RO`/`SK`), then via `clientInsiders(client)` generates 3 more Budapest-based candidates tied to the given client name (a deliberate exclusion-feature test fixture) and splices them into the pool at fixed positions, for **17 total**. `geo_scope.catchment_places[].country` will contain full country names (e.g. `"Hungary"`, `"Slovakia"`) per the validated prompt design — filtering needs a small name→code map for exactly those 5 countries. Fail open (don't filter) whenever a location or country can't be confidently parsed, and fail open to the full 17-candidate pool if the geo-filtered set is too thin (< 3) — a demo must never go to zero candidates.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-synthetic-geo.js`:

```js
// Egységteszt: syntheticReach determinisztikus geo-szűrése (nincs API-hívás).
// A client-alapú "insider" injektálás (kizárás-funkció) a geo-szűréstől függetlenül működik tovább.
import { gatherSynthetic } from "../core/reach/syntheticReach.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// 1) Nincs geoScope → mind a 17 jelölt visszajön (14 alap + 3 client-insider) — a meglévő viselkedés megmarad.
const all = await gatherSynthetic("", null);
ok("geoScope nélkül → mind a 17 jelölt visszajön (14 alap + 3 insider)", all.length === 17);

// 2) A client-alapú insider-injektálás (kizárás-funkció) NEM sérül a geo-szűréstől.
const withClient = await gatherSynthetic("Acme Kft", null);
ok("client paraméter → változatlanul beszúrja a nevesített insider jelölteket", withClient.some((c) => c.current_company === "Acme Kft"));

// 3) Szűk (HU-only) geo_scope → csak HU-jelöltek jönnek vissza, kevesebb, mint 17.
const huOnly = await gatherSynthetic("", {
  catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
});
ok("HU-only geo_scope → csak magyar helyszínű jelöltek", huOnly.every((c) => c.location.trim().toUpperCase().endsWith("HU")));
ok("HU-only geo_scope → szűkebb, mint a teljes pool", huOnly.length > 0 && huOnly.length < 17);

// 4) Több ország (HU + SK) → legalább egy SK jelölt is bekerül.
const huSk = await gatherSynthetic("", {
  catchment_places: [
    { place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" },
    { place: "Bratislava", country: "Slovakia", cross_border: true, note: "cross-border" },
  ],
});
ok("HU+SK geo_scope → tartalmaz SK jelöltet", huSk.some((c) => c.location.trim().toUpperCase().endsWith("SK")));

// 5) Ha a szűrt halmaz túl vékony (<3), essen vissza a teljes poolra (soha ne legyen üres demo).
const nothingMatches = await gatherSynthetic("", {
  catchment_places: [{ place: "Reykjavik", country: "Iceland", cross_border: false, note: "no match in pool" }],
});
ok("Nincs egyező ország → visszaesik a teljes (17-es) poolra (fail-open)", nothingMatches.length === 17);

console.log("\nsyntheticReach geo-szűrés teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-synthetic-geo.js`
Expected: fails (current `gatherSynthetic` only takes `client`, does no geo filtering — assertions 3/4/5 fail).

- [ ] **Step 3: Implement the filtering**

In `core/reach/syntheticReach.js`, add immediately before the `const stamp = (c) => ({` line:

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
export async function gatherSynthetic(client) {
  const pool = POOL.map((c, i) => stamp({ ...c, id: `syn-${String(i + 1).padStart(3, "0")}` }));
  const ins = clientInsiders(client).map(stamp);
  // Szétszórva, nem a lista végén: így a prioritási javaslat is felveszi őket,
  // és látszik, hogy a kizárás valódi, magas prioritású találatokat fog meg.
  pool.splice(1, 0, ins[0]);
  pool.splice(4, 0, ins[1]);
  pool.splice(7, 0, ins[2]);
  return pool;
}
```

with:

```js
export async function gatherSynthetic(client, geoScope) {
  const pool = POOL.map((c, i) => stamp({ ...c, id: `syn-${String(i + 1).padStart(3, "0")}` }));
  const ins = clientInsiders(client).map(stamp);
  // Szétszórva, nem a lista végén: így a prioritási javaslat is felveszi őket,
  // és látszik, hogy a kizárás valódi, magas prioritású találatokat fog meg.
  pool.splice(1, 0, ins[0]);
  pool.splice(4, 0, ins[1]);
  pool.splice(7, 0, ins[2]);
  const geoFiltered = pool.filter((c) => matchesGeo(c, geoScope));
  return geoFiltered.length >= MIN_SYNTHETIC_RESULTS ? geoFiltered : pool;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-synthetic-geo.js`
Expected: all 6 `✅` lines, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add core/reach/syntheticReach.js scripts/test-synthetic-geo.js
git commit -m "reach: synthetic pool filters by geo_scope, alongside existing client-insider injection"
```

---

### Task 3: `normalize.js` — per-candidate `geo_fit` classification

**Files:**
- Modify: `core/reach/normalize.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeHits(hits, geoScope)` — signature changes from `normalizeHits(hits)`. Adds `geo_fit: "in_scope" | "adjacent" | "out_of_scope" | "unknown" | null` to each returned candidate record, alongside the existing `past_companies` field (used by the client-exclusion feature — do not remove it). Consumed by Task 5 (`reachEngine.js`).

- [ ] **Step 1: Edit the extraction schema and prompt**

In `core/reach/normalize.js`, replace the `EXTRACT_TASK` constant:

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
      "past_companies": ["<korábbi munkáltató, ha a szövegből EVIDENCIÁLISAN kiolvasható — különben üres tömb>"],
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
      "past_companies": ["<korábbi munkáltató, ha a szövegből EVIDENCIÁLISAN kiolvasható — különben üres tömb>"],
      "location": "<város/ország vagy null>",
      "geo_fit": "in_scope|adjacent|out_of_scope|unknown|null",
      "signals": [ { "signal": "<konkrét szakmai jel a szövegből>", "strength": "erős|közepes|gyenge" } ]
    }
  ]
}`;
```

- [ ] **Step 2: Thread `geoScope` through `normalizeHits` and the input builder**

Replace:

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

Find this line in the final `.map` inside `normalizeHits`:

```js
      past_companies: Array.isArray(e.past_companies) ? e.past_companies.filter(Boolean) : [],
      location: e.location || null,
      is_person: e.is_person !== false,
```

Replace with:

```js
      past_companies: Array.isArray(e.past_companies) ? e.past_companies.filter(Boolean) : [],
      location: e.location || null,
      geo_fit: e.geo_fit || null,
      is_person: e.is_person !== false,
```

- [ ] **Step 4: Manual verification (no automated test — this path requires a live LLM call)**

This function only produces `geo_fit` when `brainAvailable()` is true (live mode); there's no synchronous/deterministic path to unit-test here without an API key, matching how this codebase already treats LLM-extraction quality (verified via `eval/`, not `npm run smoke`). Confirm the file parses and exports correctly:

Run: `node -e "import('./core/reach/normalize.js').then(m => console.log(typeof m.normalizeHits))"`
Expected: `function`

The end-to-end live-mode check happens in Task 15.

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

This file was **not** touched by the upstream commits that landed since the original repo exploration (confirmed via `git diff --stat`) — the code below is accurate as-is.

- [ ] **Step 1: Replace `gatherHits` with two functions**

In `core/reach/firecrawlReach.js`, replace the entire `gatherHits` function:

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
- Consumes: `config.reachBroadenThreshold` (Task 1), `gatherSynthetic(client, geoScope)` (Task 2), `normalizeHits(hits, geoScope)` (Task 3), `searchHits`/`scrapeTopHits` (Task 4).
- Produces: `discover({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client })` — `searchQueries`, `source`, `onProgress`, `client` are existing parameters (preserve `client`'s exact current meaning — it drives the synthetic insider-exclusion test fixture and must keep flowing to `gatherSynthetic`). `broadSearchQueries` and `geoScope` are new. Consumed by Task 7 (`capabilities.js` `discoverCandidates`).

The current file (verified — do not assume any other shape):

```js
// Reach Engine — egységes discovery interfész. A felület nem tudja, mi van mögötte.
// Ez a "seam", ahova később a residential-proxy / vendor-feed bővítés becsatolható (spec §5).
import { config, reachLiveAvailable } from "../config.js";
import { gatherHits } from "./firecrawlReach.js";
import { gatherSynthetic } from "./syntheticReach.js";
import { normalizeHits } from "./normalize.js";

function pickSource(requested) {
  const r = requested || config.reachDefaultSource || "auto";
  if (r === "synthetic") return "synthetic";
  if (r === "firecrawl") return reachLiveAvailable() ? "firecrawl" : "synthetic";
  // auto
  return reachLiveAvailable() ? "firecrawl" : "synthetic";
}

/**
 * @param {object} p
 * @param {string[]} p.searchQueries - firecrawl keresési lekérdezések (a queryBuild-ból)
 * @param {string} [p.source] - "auto" | "firecrawl" | "synthetic"
 * @param {function} [p.onProgress]
 * @returns {Promise<{source, candidates, note}>}
 */
export async function discover({ searchQueries, source, onProgress, client }) {
  const chosen = pickSource(source);

  if (chosen === "synthetic") {
    const candidates = await gatherSynthetic(client);
    return {
      source: "synthetic",
      candidates,
      note:
        "Mintaadatok (senior tech / CEE) — nem valós személyek. " +
        "Élő kutatáshoz a nyilvános webes forrás bekapcsolása szükséges (lásd Beállítások / telepítési útmutató).",
    };
  }

  onProgress && onProgress("Firecrawl publikus-web discovery indul…");
  const hits = await gatherHits(searchQueries, { onProgress });
  onProgress && onProgress(`${hits.length} nyers találat — normalizálás…`);
  const candidates = await normalizeHits(hits);
  const persons = candidates.filter((c) => c.is_person !== false);
  return {
    source: "firecrawl",
    candidates: persons,
    note:
      `Nyilvános webes források: ${persons.length} jelölt ${hits.length} találatból. ` +
      "Nincs belépett/fake-account LinkedIn-hozzáférés — a LinkedIn-URL-ek a keresőből, a mélység a nyilvánosan elérhető forrásokból (GitHub, cég-oldal, konferencia-bio, blog).",
  };
}
```

- [ ] **Step 1: Write the failing test**

Create `scripts/test-reach-tiers.js`:

```js
// Egységteszt: reachEngine tier-választása, geo-átadása és client-passthrough (nincs élő API-hívás).
import { discover } from "../core/reach/reachEngine.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// Synthetic ágon a discover() a geoScope-ot és a client-et is változatlanul továbbadja.
const res = await discover({
  searchQueries: ["site:linkedin.com/in staff engineer payments Budapest"],
  broadSearchQueries: ["payments engineer CEE"],
  geoScope: {
    catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "anchor" }],
  },
  source: "synthetic",
  client: "Acme Kft",
});
ok("discover(synthetic) → source visszaadva", res.source === "synthetic");
ok("discover(synthetic) → geoScope alkalmazva (szűkebb, mint a teljes 17-es pool)", res.candidates.length > 0 && res.candidates.length <= 17);
ok("discover(synthetic) → minden jelölt magyar helyszínű", res.candidates.every((c) => c.location.trim().toUpperCase().endsWith("HU")));
ok("discover(synthetic) → client passthrough megmaradt (insider jelölt szerepel)", res.candidates.some((c) => c.current_company === "Acme Kft"));

const empty = await discover({ searchQueries: [], broadSearchQueries: [], geoScope: null, source: "synthetic" });
ok("discover(synthetic) üres bemenetek esetén is a teljes (17-es) poolra esik vissza", empty.candidates.length === 17);

console.log("\nreachEngine tier-teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-reach-tiers.js`
Expected: throws or fails (current `discover` doesn't apply `geoScope` to the synthetic path the way this test expects — `gatherSynthetic` isn't geo-aware yet at the `reachEngine` call site before this task's edit; also `broadSearchQueries` is unused).

- [ ] **Step 3: Implement the new `discover()`**

Replace the entire `core/reach/reachEngine.js` file contents with:

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

/**
 * @param {object} p
 * @param {string[]} p.searchQueries - szűk körű firecrawl keresési lekérdezések (a queryBuild "firecrawl_search_queries" kimenete)
 * @param {string[]} [p.broadSearchQueries] - tág körű lekérdezések, csak akkor futnak, ha a szűk kör kevés találatot hoz
 * @param {object} [p.geoScope] - a queryBuild "geo_scope" kimenete
 * @param {string} [p.source] - "auto" | "firecrawl" | "synthetic"
 * @param {function} [p.onProgress]
 * @param {string} [p.client] - az ügyfél cége, a kizárási teszt-jelöltek (synthetic) beszúrásához
 * @returns {Promise<{source, candidates, note}>}
 */
export async function discover({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client }) {
  const chosen = pickSource(source);

  if (chosen === "synthetic") {
    const candidates = await gatherSynthetic(client, geoScope);
    return {
      source: "synthetic",
      candidates,
      note:
        "Mintaadatok (senior tech / CEE) — nem valós személyek. " +
        "Élő kutatáshoz a nyilvános webes forrás bekapcsolása szükséges (lásd Beállítások / telepítési útmutató).",
    };
  }

  onProgress && onProgress("Firecrawl publikus-web discovery indul (szűk kör)…");
  let hits = await searchHits(searchQueries, { onProgress });
  let broadened = false;
  if (hits.length < config.reachBroadenThreshold && (broadSearchQueries || []).length) {
    broadened = true;
    onProgress && onProgress(`Kevés találat (${hits.length}) — kibővített kereséssel folytatjuk…`);
    const more = await searchHits(broadSearchQueries, { onProgress });
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
Expected: all 5 `✅` lines, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add core/reach/reachEngine.js scripts/test-reach-tiers.js
git commit -m "reach: discover() adaptively broadens narrow→broad queries, preserves client passthrough"
```

---

### Task 6: `capabilities.js` + `demo.js` — `queryBuild` gains `geo_scope` + broad tier

**Files:**
- Modify: `core/capabilities.js` (the `queryBuild` function)
- Modify: `core/demo.js` (the `queryBuild` entry)
- Test: `scripts/test-query-build-demo.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `queryBuild(...)` output gains `firecrawl_search_queries_broad: string[]` and `geo_scope: { search_elasticity, anchor, catchment_places, rationale }`, **added alongside** all existing fields (`boolean_queries`, `firecrawl_search_queries`, `target_companies`, `target_titles`, `synonyms`, `exclude_companies`, `exclusion_note` — all unchanged). Consumed by Task 7, Task 9, Task 10, Task 11, Task 12.

The current `queryBuild` in `core/capabilities.js` (verified — do not assume any other shape):

```js
// ── 🧠 KERESÉSI TERV ─────────────────────────────────────────
export async function queryBuild({ intake, brief, position, briefFinal }, { projectId } = {}) {
  const client = (position && position.client) || "";
  const task = `FELADAT: Készíts keresési tervet. Boolean lekérdezéseket a szokásos platformokra, ÉS "firecrawl_search_queries" listát, ami a nyilvános webes felkutatást vezérli (Google-stílusú, site: operátorokkal, senior tech / CEE fókusz).
${LANG}
KIZÁRÁS — KÖTELEZŐ: az ügyfél saját cége SOHA nem lehet célcég, és a lekérdezésekbe negatív szűrőként be kell kerülnie (pl. -"Ügyfél Neve"). Az ügyfél jelenlegi és volt munkatársait a hiring manager amúgy is ismeri; ha bekerülnek a merítésbe, az a keresés hitelét viszi. Az "exclude_companies" listába vedd fel az ügyfél cégét és a felismerhető leányvállalatait.
Kimeneti JSON séma:
{
 "boolean_queries": [ { "platform": "linkedin-xray|github|google", "query": "<lekérdezés, az ügyfél negatív szűrőjével>" } ],
 "firecrawl_search_queries": ["<4-5 konkrét kereső-lekérdezés, site: operátorokkal>"],
 "target_companies": ["<az ügyfél cége NEM szerepelhet itt>"],
 "target_titles": ["..."],
 "synonyms": ["..."],
 "exclude_companies": ["<az ügyfél cége és leányvállalatai — off-limits>"],
 "exclusion_note": "<egy mondat: kinek a munkatársai maradnak ki a merítésből és miért>"
}`;
  // A recruiter által VÉGLEGESÍTETT brief az elsődleges bemenet; az AI-javaslat
  // csak akkor, ha a véglegesítés még nem történt meg.
  const basis =
    briefFinal && briefFinal.text
      ? {
          veglegesitett_brief: briefFinal.text,
          must_haves: briefFinal.must_haves,
          nice_to_haves: briefFinal.nice_to_haves,
        }
      : intake || { brief };
  const input = `POZÍCIÓ-ÖSSZEFOGLALÓ (a keresés alapja):\n${J(basis)}${positionCtx(position)}${
    client ? `\n\nAZ ÜGYFÉL CÉGE (kizárandó): ${client}` : ""
  }`;
  return run("queryBuild", { task, input, demoInput: { intake, client } }, projectId);
}
```

The current `queryBuild` entry in `core/demo.js` (verified):

```js
  // Az ügyfél kizárása a TERV része, nem utólagos szűrés — a demó-kimenet is
  // így néz ki, hogy a szabály ugyanaz legyen kulccsal és kulcs nélkül.
  queryBuild: (input) => {
    const client = (input && input.client) || "";
    const neg = client ? ` -"${client}"` : "";
    return {
      _demo: true,
      boolean_queries: [
        { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' + neg },
        { platform: "github", query: "site:github.com payments idempotency location:Hungary OR location:Poland" + neg },
        { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' + neg },
      ],
      firecrawl_search_queries: [
        "site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw" + neg,
        "site:github.com senior backend engineer payments idempotency Hungary OR Poland" + neg,
        "craft conf speaker distributed systems payments CEE",
        "principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in" + neg,
      ],
      target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
      target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
      synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
      exclude_companies: client ? [client] : [],
      exclusion_note: client
        ? `Az ügyfél (${client}) jelenlegi és volt munkatársai nem kerülnek a merítésbe — őket a hiring manager amúgy is ismeri.`
        : "Add meg az ügyfél nevét a pozícióadatoknál, hogy a saját munkatársai automatikusan kimaradjanak.",
    };
  },
```

These two must change together — `capabilities.js`'s live-mode schema and `demo.js`'s no-key fallback must describe the same shape, or demo mode (which most local runs use) breaks. The test below runs in demo mode (no `ANTHROPIC_API_KEY`), which is deterministic and needs no live call.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-query-build-demo.js`:

```js
// Egységteszt: queryBuild demo-módban (nincs API-kulcs) az új mezőket adja vissza,
// és a meglévő kizárás-funkció (exclude_companies) nem sérül.
import * as ric from "../core/index.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

if (ric.brainAvailable()) {
  console.log("⚠️  ANTHROPIC_API_KEY be van állítva — ez a teszt demo-módra épül, kilépek.");
  process.exit(0);
}

const q = await ric.queryBuild({ intake: { must_haves: ["payments"] }, brief: "teszt brief", position: { client: "Acme Kft" } });

ok("queryBuild → firecrawl_search_queries megmaradt (a meglévő szerkeszthető mező nem sérült)", Array.isArray(q.firecrawl_search_queries) && q.firecrawl_search_queries.length > 0);
ok("queryBuild → firecrawl_search_queries_broad új mező, nem üres tömb", Array.isArray(q.firecrawl_search_queries_broad) && q.firecrawl_search_queries_broad.length > 0);
ok("queryBuild → geo_scope objektum jelen van", !!q.geo_scope && typeof q.geo_scope === "object");
ok("queryBuild → geo_scope.search_elasticity érvényes érték", ["tight", "moderate", "loose"].includes(q.geo_scope.search_elasticity));
ok("queryBuild → geo_scope.catchment_places tömb, nem üres", Array.isArray(q.geo_scope.catchment_places) && q.geo_scope.catchment_places.length > 0);
ok("queryBuild → geo_scope.rationale szöveg", typeof q.geo_scope.rationale === "string" && q.geo_scope.rationale.length > 0);
ok("queryBuild → a meglévő kizárás-funkció nem sérült (exclude_companies)", Array.isArray(q.exclude_companies) && q.exclude_companies.includes("Acme Kft"));
ok("queryBuild → exclusion_note is megmaradt", typeof q.exclusion_note === "string" && q.exclusion_note.length > 0);

console.log("\nqueryBuild demo-séma teszt kész.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-query-build-demo.js`
Expected: fails on the `firecrawl_search_queries_broad`/`geo_scope` assertions (current demo fallback has neither).

- [ ] **Step 3: Update `core/capabilities.js`'s `queryBuild`**

Replace the entire `queryBuild` function (the exact current text quoted above) with:

```js
// ── 🧠 KERESÉSI TERV ─────────────────────────────────────────
export async function queryBuild({ intake, brief, position, briefFinal }, { projectId } = {}) {
  const client = (position && position.client) || "";
  const task = `FELADAT: Készíts keresési tervet HÁROM részben.

(1) LEKÉRDEZÉSEK: "firecrawl_search_queries" — a SZŰK kör, ami a nyilvános webes felkutatást vezérli (Google-stílusú, site: operátorokkal, senior tech / CEE fókusz), az elengedhetetlen feltételek (must_haves) mindegyikét ÉSelve. ÉS "firecrawl_search_queries_broad" — a TÁG kör: csak a szerep magja (cím/terület), az elengedhetetlen feltételek szigorú kombinációja NÉLKÜL; ez akkor kerül ténylegesen lekérdezésre, ha a szűk kör kevés találatot hoz. Boolean lekérdezéseket is adj a szokásos platformokra.
${LANG}
KIZÁRÁS — KÖTELEZŐ: az ügyfél saját cége SOHA nem lehet célcég, és MINDKÉT lekérdezés-listába (szűk és tág is) negatív szűrőként be kell kerülnie (pl. -"Ügyfél Neve"). Az ügyfél jelenlegi és volt munkatársait a hiring manager amúgy is ismeri; ha bekerülnek a merítésbe, az a keresés hitelét viszi. Az "exclude_companies" listába vedd fel az ügyfél cégét és a felismerhető leányvállalatait.

(2) FÖLDRAJZI HATÓKÖR ("geo_scope"): gondolkodj el a szerep valódi keresési földrajzán. Elsőként reálisan, megnevezett helyekben gondolkodj (akár országhatáron át is, ha egy külföldi hely road-távolságban közelebb van, mint egy belföldi) — csak olyan helyet vegyél fel, amire konkrét, evidencia-alapú indokod van (valós ingázási folyosó, ismert vonzáskörzeti település, dokumentált határon-átnyúló munkaerő-mozgás); ne told fel a listát spekulatív, "néha idesorolható" helyekkel. NE adj meg konkrét perc- vagy km-adatot — ehhez nincs megbízható adatod, csak relatív/összehasonlító ítéleted lehet ("X közelebb van az anchorhoz, mint Y"). Az anchor (a megbízás helyszíne, position.location) MINDIG szerepeljen a catchment_places listában, a rugalmasságtól függetlenül.

Másodjára állapítsd meg a "search_elasticity" értéket (tight|moderate|loose) — ez azt fejezi ki, mennyire kell a keresést földrajzilag megkötni, és a szerep valós piaci utánpótlási mintázatából következik, NEM a munkavégzés helyszínéből (helyszíni/hibrid/távoli) és NEM abból, hogy a helylista hosszú-e vagy határon átnyúlik-e:
- "tight": belépő szintű, nagy volumenű, műszakos vagy más módon helyettesíthető/bőséges helyi munkaerő-kínálatú szerep, fizikai jelenléttel. Behatárolt helyi/céges-buszjárat vonzáskörzet.
- "moderate": senior IC / szakértő / csoportvezetői szerep valós, de részleges helyszíni elvárással. Szélesebb, akár régiós/határon-átnyúló ingázási terület, de nem költözés-alapú keresés.
- "loose": valódi felsővezetői/C-szintű vagy ritka szakértői keresés, amit jellemzően országosan vagy nemzetközileg töltenek be, ahol a költözés/nem-napi ingázás a norma. Ilyenkor ne ingázási sugárban gondolkodj, hanem országos/nemzetközi tehetségpiacban.

Mielőtt lezárnád: ellenőrizd, hogy a "search_elasticity" összhangban van-e a földrajzi indoklásoddal — ha behatárolt helyi/buszjárat-vonzáskörzetet írtál le, az elasticity nem lehet "loose"; ha országos/ritka-szakértői tehetségpiacról írtál, ne írj le egyúttal szűk ingázó-települések gyűrűjét. Ha a kettő nem egyezik, javítsd az egyiket, mielőtt válaszolsz. "loose" rugalmasság esetén is adj meg valós, konkrét helyeket (pl. domináns szakmai-vezetői központokat, releváns nemzetközi csomópontokat a brief kontextusához kötve) — az üres lista nem elfogadható válasz.

(3) Célcégek, célpozíciók, kulcs-szinonimák — a szokásos módon.

Kimeneti JSON séma:
{
 "boolean_queries": [ { "platform": "linkedin-xray|github|google", "query": "<lekérdezés, az ügyfél negatív szűrőjével>" } ],
 "firecrawl_search_queries": ["<3-4 szűk lekérdezés, site: operátorokkal, az ügyfél negatív szűrőjével>"],
 "firecrawl_search_queries_broad": ["<2-3 tág lekérdezés, site: operátorokkal, az ügyfél negatív szűrőjével>"],
 "target_companies": ["<az ügyfél cége NEM szerepelhet itt>"],
 "target_titles": ["..."],
 "synonyms": ["..."],
 "exclude_companies": ["<az ügyfél cége és leányvállalatai — off-limits>"],
 "exclusion_note": "<egy mondat: kinek a munkatársai maradnak ki a merítésből és miért>",
 "geo_scope": {
   "search_elasticity": "tight|moderate|loose",
   "anchor": "<position.location visszaadva>",
   "catchment_places": [ { "place": "...", "country": "...", "cross_border": true, "note": "<konkrét, evidencia-alapú indok>" } ],
   "rationale": "<földrajzi indoklás + elasticity-indoklás együtt, önellentmondás-mentesen>"
 }
}`;
  // A recruiter által VÉGLEGESÍTETT brief az elsődleges bemenet; az AI-javaslat
  // csak akkor, ha a véglegesítés még nem történt meg.
  const basis =
    briefFinal && briefFinal.text
      ? {
          veglegesitett_brief: briefFinal.text,
          must_haves: briefFinal.must_haves,
          nice_to_haves: briefFinal.nice_to_haves,
        }
      : intake || { brief };
  const input = `POZÍCIÓ-ÖSSZEFOGLALÓ (a keresés alapja):\n${J(basis)}${positionCtx(position)}${
    client ? `\n\nAZ ÜGYFÉL CÉGE (kizárandó): ${client}` : ""
  }`;
  return run("queryBuild", { task, input, demoInput: { intake, client } }, projectId);
}
```

- [ ] **Step 4: Update `core/demo.js`'s `queryBuild` fallback**

Replace the entire `queryBuild` entry (the exact current text quoted above) with:

```js
  // Az ügyfél kizárása a TERV része, nem utólagos szűrés — a demó-kimenet is
  // így néz ki, hogy a szabály ugyanaz legyen kulccsal és kulcs nélkül.
  queryBuild: (input) => {
    const client = (input && input.client) || "";
    const neg = client ? ` -"${client}"` : "";
    return {
      _demo: true,
      boolean_queries: [
        { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' + neg },
        { platform: "github", query: "site:github.com payments idempotency location:Hungary OR location:Poland" + neg },
        { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' + neg },
      ],
      firecrawl_search_queries: [
        "site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw" + neg,
        "site:github.com senior backend engineer payments idempotency Hungary OR Poland" + neg,
        "craft conf speaker distributed systems payments CEE",
        "principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in" + neg,
      ],
      firecrawl_search_queries_broad: [
        "staff engineer OR principal engineer payments Budapest OR CEE" + neg,
        "platform engineer Kubernetes CEE site:linkedin.com/in" + neg,
      ],
      target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
      target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
      synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
      exclude_companies: client ? [client] : [],
      exclusion_note: client
        ? `Az ügyfél (${client}) jelenlegi és volt munkatársai nem kerülnek a merítésbe — őket a hiring manager amúgy is ismeri.`
        : "Add meg az ügyfél nevét a pozícióadatoknál, hogy a saját munkatársai automatikusan kimaradjanak.",
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
    };
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/test-query-build-demo.js`
Expected: all 8 `✅` lines, exit code 0. (If `ANTHROPIC_API_KEY` is set in your shell, temporarily unset it for this run: `env -u ANTHROPIC_API_KEY node scripts/test-query-build-demo.js`.)

- [ ] **Step 6: Commit**

```bash
git add core/capabilities.js core/demo.js scripts/test-query-build-demo.js
git commit -m "capabilities: queryBuild adds geo_scope + firecrawl_search_queries_broad, additively"
```

---

### Task 7: `capabilities.js` — `discoverCandidates` passthrough

**Files:**
- Modify: `core/capabilities.js` (the `discoverCandidates` function)

**Interfaces:**
- Consumes: `discover({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client })` (Task 5).
- Produces: `discoverCandidates({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client }, { projectId })`. Consumed by Task 9 (`app/server.js`), Task 10 (`mcp/server.js`).

The current function (verified):

```js
// ── 📡 JELÖLTKUTATÁS (Reach Engine) ──────────────────────────
export async function discoverCandidates({ searchQueries, source, onProgress, client }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchQueries, source }, mode: "reach" });
  const res = await reachDiscover({ searchQueries, source, onProgress, client });
  return res; // { source, candidates, note }
}
```

- [ ] **Step 1: Edit `core/capabilities.js`**

Replace it with:

```js
// ── 📡 JELÖLTKUTATÁS (Reach Engine) ──────────────────────────
export async function discoverCandidates({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client }, { projectId } = {}) {
  audit({ capability: "discoverCandidates", projectId, input: { searchQueries, broadSearchQueries, geoScope, source }, mode: "reach" });
  const res = await reachDiscover({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client });
  return res; // { source, candidates, note }
}
```

- [ ] **Step 2: Verify with a synthetic-mode smoke call**

Run:
```bash
node -e "
import('./core/index.js').then(async (ric) => {
  const r = await ric.discoverCandidates({ searchQueries: [], broadSearchQueries: [], geoScope: null, source: 'synthetic' });
  console.log('candidates:', r.candidates.length, 'source:', r.source);
});
"
```
Expected: `candidates: 17 source: synthetic` (no `geoScope` → fail-open per Task 2, full pool returned).

- [ ] **Step 3: Commit**

```bash
git add core/capabilities.js
git commit -m "capabilities: discoverCandidates passes broadSearchQueries/geoScope through to reachEngine"
```

---

### Task 8: `capabilities.js` — `rankTargets` geo-aware input

**Files:**
- Modify: `core/capabilities.js` (the `rankTargets` function)
- Test: `scripts/test-rank-geo.js` (new)

**Interfaces:**
- Consumes: candidate records with `location`/`geo_fit` fields (Task 3 produces these on real candidates; synthetic candidates from Task 2 have `location` but no `geo_fit` — both must be handled without crashing).
- Produces: no signature change (`rankTargets({ candidates, intake }, { projectId })` stays the same) — only the prompt input and instructions change. Guardrail `assertRankingComplete` behavior (imported from `core/guardrails.js`) is unchanged and must still hold.

The current `rankTargets` (verified):

```js
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
```

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

Find this line:

```js
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki némán (de kaphat D-kategóriát).
```

Replace with:

```js
ELSZÁMOLTATHATÓSÁG: a "ranked" tömb MINDEN bemeneti jelöltet tartalmazzon — senki nem eshet ki némán (de kaphat D-kategóriát).
FÖLDRAJZ: ha egy jelölt "geo_fit" mezője "out_of_scope", és a szerep helyszínhez kötött (nem távoli munkavégzés), vedd figyelembe a rangsorolásnál, és jelezd tömören a rationale-ben.
```

Then find this line:

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
- Modify: `app/server.js`

**Interfaces:**
- Consumes: `discoverCandidates({ searchQueries, broadSearchQueries, geoScope, source, onProgress, client }, ...)` (Task 7).
- Produces: no change to the HTTP contract (`POST /api/project/:id/discover` still returns `{ source, candidates, note }`) — only what it reads from `p.query` changes.

The current route (verified):

```js
// 3) Discover (Reach Engine)
app.post("/api/project/:id/discover", A(async (req, res) => {
  const p = getProj(req, res);
  if (!p) return;
  const source = (req.body && req.body.source) || undefined;
  const sq = (p.query && p.query.firecrawl_search_queries) || [];
  const client = (p.position && p.position.client) || "";
  const result = await ric.discoverCandidates({ searchQueries: sq, source, client }, { projectId: p.id });
  p.candidates = result.candidates;
  p.discover_note = result.note;
  p.discover_source = result.source;
  saveProject(p);
  res.json(result);
}));
```

- [ ] **Step 1: Edit `app/server.js`**

Replace it with:

```js
// 3) Discover (Reach Engine)
app.post("/api/project/:id/discover", A(async (req, res) => {
  const p = getProj(req, res);
  if (!p) return;
  const source = (req.body && req.body.source) || undefined;
  const sq = (p.query && p.query.firecrawl_search_queries) || [];
  const broadSq = (p.query && p.query.firecrawl_search_queries_broad) || [];
  const geoScope = (p.query && p.query.geo_scope) || null;
  const client = (p.position && p.position.client) || "";
  const result = await ric.discoverCandidates({ searchQueries: sq, broadSearchQueries: broadSq, geoScope, source, client }, { projectId: p.id });
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
git commit -m "app: /discover route reads query.firecrawl_search_queries_broad + query.geo_scope"
```

---

### Task 10: `mcp/server.js` — tool schemas

**Files:**
- Modify: `mcp/server.js`

**Interfaces:**
- Consumes: `queryBuild({ intake, brief, position, briefFinal }, ...)` (Task 6, adding `position` passthrough here since MCP currently doesn't pass it), `discoverCandidates({ searchQueries, broadSearchQueries, geoScope, source }, ...)` (Task 7).
- Produces: no change to the MCP tool *names*, only `inputSchema`/`description`/`run` for `query_build` and `discover_candidates`.

This file was **not** touched by the upstream commits (confirmed via `git diff --stat`) — the current content (verified) is:

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

- [ ] **Step 1: Edit `mcp/server.js`**

Replace it with:

```js
  {
    name: "query_build",
    description: "🧠 Keresési terv készítése: 'firecrawl_search_queries' (szűk kör) + 'firecrawl_search_queries_broad' (tág, tartalék kör) + 'geo_scope' (földrajzi hatókör + rugalmasság), amelyek a nyilvános webes jelöltkutatást vezérlik (senior tech / CEE).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR, position: OBJ } },
    run: (a) => ric.queryBuild({ intake: a.intake, brief: a.brief, position: a.position }),
  },
  {
    name: "discover_candidates",
    description: "📡 Jelöltkutatás nyilvánosan elérhető szakmai forrásokban (nincs belépett/fake-account LinkedIn-hozzáférés). Kulcs nélkül mintaadatokkal fut. Bemenet: a query_build 'firecrawl_search_queries', 'firecrawl_search_queries_broad' és 'geo_scope' kimenete.",
    inputSchema: { type: "object", properties: { search_queries: { type: "array", items: STR }, broad_search_queries: { type: "array", items: STR }, geo_scope: OBJ, source: { type: "string", enum: ["auto", "firecrawl", "synthetic"] } }, required: ["search_queries"] },
    run: (a) => ric.discoverCandidates({ searchQueries: a.search_queries, broadSearchQueries: a.broad_search_queries, geoScope: a.geo_scope, source: a.source }),
  },
```

- [ ] **Step 2: Verify the module still parses**

Run: `node -e "import('./mcp/server.js')" &` then `sleep 1 && kill %1`
Expected: no syntax/import error before it's killed (the server blocks on stdio, so this just confirms it starts without crashing).

- [ ] **Step 3: Run the existing MCP smoke script as a regression check (no edit needed — its `discover_candidates` call uses only the still-valid, still-required `search_queries` param)**

Run: `node scripts/test-mcp.js`
Expected: all `✅` lines, `MCP smoke kész.` at the end, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add mcp/server.js
git commit -m "mcp: query_build/discover_candidates tool schemas expose firecrawl_search_queries_broad + geo_scope"
```

---

### Task 11: `scripts/smoke.js` — update to new fields

**Files:**
- Modify: `scripts/smoke.js`

**Interfaces:**
- Consumes: `queryBuild` (Task 6), `discoverCandidates` (Task 7) new fields.
- Produces: n/a (this is the test script itself).

This file was **not** touched by the upstream commits (confirmed via `git diff --stat`) — the current relevant lines (verified against the original repo read) are:

```js
const query = await ric.queryBuild({ intake });
ok("queryBuild → firecrawl_search_queries", Array.isArray(query.firecrawl_search_queries) && query.firecrawl_search_queries.length > 0);

const disc = await ric.discoverCandidates({ searchQueries: query.firecrawl_search_queries, source: "synthetic" });
```

- [ ] **Step 1: Edit `scripts/smoke.js`**

Replace it with:

```js
const query = await ric.queryBuild({ intake });
ok("queryBuild → firecrawl_search_queries", Array.isArray(query.firecrawl_search_queries) && query.firecrawl_search_queries.length > 0);
ok("queryBuild → firecrawl_search_queries_broad", Array.isArray(query.firecrawl_search_queries_broad));
ok("queryBuild → geo_scope", !!query.geo_scope && ["tight", "moderate", "loose"].includes(query.geo_scope.search_elasticity));

const disc = await ric.discoverCandidates({ searchQueries: query.firecrawl_search_queries, broadSearchQueries: query.firecrawl_search_queries_broad, geoScope: query.geo_scope, source: "synthetic" });
```

- [ ] **Step 2: Run the full smoke suite**

Run: `npm run smoke`
Expected: all `✅` lines (demo mode if no `ANTHROPIC_API_KEY`, live mode otherwise), `Smoke kész.` at the end, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke.js
git commit -m "scripts: smoke.js exercises the new geo_scope/broad-tier fields"
```

---

### Task 12: `app/public/app.js` — `geo_scope` + broad-tier display in the Célpiac view

**Files:**
- Modify: `app/public/app.js` (the `renderQuery` function)

**Interfaces:**
- Consumes: `p.query.geo_scope`, `p.query.firecrawl_search_queries_broad` (Task 6's output, stored client-side after the existing `/query` API call — no new endpoint needed).
- Produces: n/a (UI render function, no exported interface consumed elsewhere).

The current `renderQuery` function (verified — this is the live, current code, not the version from an earlier draft of this plan):

```js
// A terv minden kategóriája szerkeszthető: hozzáadás és elvétel egyaránt.
function renderQuery(p) {
  const o = p.query;
  const out = $("#queryOut");
  if (!o) { if (p.intake) out.innerHTML = ""; return; }
  const edited = !!o._edited_by_recruiter;
  out.innerHTML = `
    <div class="card">
      <h4>Keresési terv ${demoTag(o)} ${edited ? `<span class="ai-status ok">Recruiter által szerkesztve</span>` : `<span class="ai-status">AI-javaslat — szerkeszthető</span>`}</h4>
      <p class="kpi-desc" style="margin-top:0">A kategóriákhoz bármikor hozzáadhatsz vagy elvehetsz belőlük — a frissítés nem törli a kézi elemeidet.</p>
      <div class="cov-label" style="margin-top:10px">Célpozíciók</div>${chipEditor("qTitles", o.target_titles, { placeholder: "Új célpozíció…" })}
      <div class="cov-label" style="margin-top:12px">Célcégek</div>${chipEditor("qCompanies", o.target_companies, { placeholder: "Új célcég…" })}
      <div class="cov-label" style="margin-top:12px">Kulcs-szinonimák</div>${chipEditor("qSyn", o.synonyms, { placeholder: "Új szinonima…" })}
      <details class="or-why" id="qDetails"${detailsOpen("qDetails")} style="margin-top:12px"><summary>Keresési lekérdezések (szerkeszthető)</summary>
        <div class="cov-label" style="margin-top:8px">Boolean / X-ray lekérdezések</div>
        ${(o.boolean_queries || []).map((q, i) => `<div class="q-row"><div class="q-plat">${esc(q.platform || "egyéb")}</div><textarea class="q-code q-edit" data-qi="${i}" rows="2">${esc(q.query || "")}</textarea><button class="btn ed-x-btn" data-qrm="${i}" title="Lekérdezés törlése">×</button></div>`).join("")
          || `<div class="ed-empty">— még nincs lekérdezés —</div>`}
        <div class="ed-add q-add"><input class="ed-in" id="qBoolNew" placeholder="Új boolean lekérdezés…" /><button class="btn" id="qBoolAdd">+</button></div>
        <div class="cov-label" style="margin-top:14px">Webes kereső-lekérdezések</div>
        ${chipEditor("qWeb", o.firecrawl_search_queries, { placeholder: "Új webes lekérdezés…" })}
      </details>
    </div>`;
  wireDetails("qDetails");
  const touch = () => { o._edited_by_recruiter = true; };
  // Minden kategória ugyanazt a szerződést kapja: hozzáadás + elvétel, és az
  // elvétel emlékezetes (a frissítés nem hozza vissza).
  const wireQ = (id, field) => wireChipEditor(id,
    (v) => { touch(); o[field] = o[field] || []; addUnique(o[field], v); v.forEach((x) => unnoteRemoval(o, field, x)); afterChipEdit(renderCelpiac, p, id); },
    (i) => { touch(); noteRemoval(o, field, (o[field] || [])[i]); o[field].splice(i, 1); afterChipEdit(renderCelpiac, p, id); });
  wireQ("qTitles", "target_titles");
  wireQ("qCompanies", "target_companies");
  wireQ("qSyn", "synonyms");
  wireQ("qWeb", "firecrawl_search_queries");
  $$("#queryOut .q-edit").forEach((ta) => (ta.onchange = () => { touch(); o.boolean_queries[Number(ta.dataset.qi)].query = ta.value; persist(); }));
  $$("#queryOut [data-qrm]").forEach((b) => (b.onclick = () => {
    touch();
    const i = Number(b.dataset.qrm);
    noteRemoval(o, "boolean_queries", (o.boolean_queries[i] || {}).query);
    o.boolean_queries.splice(i, 1);
    persist();
    renderCelpiac(p);
  }));
  const qAdd = $("#qBoolAdd");
  if (qAdd) qAdd.onclick = () => {
    const v = $("#qBoolNew").value.trim();
    if (!v) return;
    touch();
    o.boolean_queries = o.boolean_queries || [];
    o.boolean_queries.push({ platform: "egyéni", query: v });
    persist();
    renderCelpiac(p);
  };
}
```

**Do not touch** `wireQ`, `touch`, the boolean-query editing block, or any `_edited_by_recruiter`/`noteRemoval`/`afterChipEdit` logic — the new fields are read-only and must not be wired into that machinery.

- [ ] **Step 1: Add the read-only geo_scope + broad-tier display**

Replace the `out.innerHTML = ...` assignment (the template literal shown above, from `` out.innerHTML = ` `` through the closing `` </div>`; ``) with:

```js
  const gs = o.geo_scope;
  const elasticityLabel = { tight: "szűk (helyi)", moderate: "közepes (régiós)", loose: "tág (országos/nemzetközi)" };
  out.innerHTML = `
    <div class="card">
      <h4>Keresési terv ${demoTag(o)} ${edited ? `<span class="ai-status ok">Recruiter által szerkesztve</span>` : `<span class="ai-status">AI-javaslat — szerkeszthető</span>`}</h4>
      <p class="kpi-desc" style="margin-top:0">A kategóriákhoz bármikor hozzáadhatsz vagy elvehetsz belőlük — a frissítés nem törli a kézi elemeidet.</p>
      <div class="cov-label" style="margin-top:10px">Célpozíciók</div>${chipEditor("qTitles", o.target_titles, { placeholder: "Új célpozíció…" })}
      <div class="cov-label" style="margin-top:12px">Célcégek</div>${chipEditor("qCompanies", o.target_companies, { placeholder: "Új célcég…" })}
      <div class="cov-label" style="margin-top:12px">Kulcs-szinonimák</div>${chipEditor("qSyn", o.synonyms, { placeholder: "Új szinonima…" })}
      ${gs ? `
      <div class="cov-label" style="margin-top:12px">Földrajzi hatókör <span class="chip">${esc(elasticityLabel[gs.search_elasticity] || gs.search_elasticity)}</span></div>
      ${chips((gs.catchment_places || []).map((c) => c.cross_border ? `${c.place} (${c.country})` : c.place))}
      ${gs.rationale ? `<p class="kpi-desc" style="margin-top:4px">${esc(gs.rationale)}</p>` : ""}
      ` : ""}
      <details class="or-why" id="qDetails"${detailsOpen("qDetails")} style="margin-top:12px"><summary>Keresési lekérdezések (szerkeszthető)</summary>
        <div class="cov-label" style="margin-top:8px">Boolean / X-ray lekérdezések</div>
        ${(o.boolean_queries || []).map((q, i) => `<div class="q-row"><div class="q-plat">${esc(q.platform || "egyéb")}</div><textarea class="q-code q-edit" data-qi="${i}" rows="2">${esc(q.query || "")}</textarea><button class="btn ed-x-btn" data-qrm="${i}" title="Lekérdezés törlése">×</button></div>`).join("")
          || `<div class="ed-empty">— még nincs lekérdezés —</div>`}
        <div class="ed-add q-add"><input class="ed-in" id="qBoolNew" placeholder="Új boolean lekérdezés…" /><button class="btn" id="qBoolAdd">+</button></div>
        <div class="cov-label" style="margin-top:14px">Webes kereső-lekérdezések</div>
        ${chipEditor("qWeb", o.firecrawl_search_queries, { placeholder: "Új webes lekérdezés…" })}
        ${(o.firecrawl_search_queries_broad || []).length ? `
        <div class="cov-label" style="margin-top:14px">Tág kör (automatikus tartalék, ha a szűk kör kevés találatot hoz)</div>
        ${(o.firecrawl_search_queries_broad || []).map((q) => `<code class="q-code">${esc(q)}</code>`).join("")}
        ` : ""}
      </details>
    </div>`;
```

The rest of the function (`wireDetails("qDetails");` onward, `touch`, `wireQ`, the boolean-query handlers) is unchanged — leave it exactly as-is below this block.

- [ ] **Step 2: Manual verification**

Run: `npm run app`, open `http://localhost:5178`, create a project, run "Brief elemzése" then "Keresési terv készítése" in the Célpiac view → the "Keresési terv" card should show a "Földrajzi hatókör" section with an elasticity chip, place chips, and a rationale paragraph, and the expanded "Keresési lekérdezések" details should show a "Tág kör" section below the editable web-query chips (demo mode is deterministic, so this reflects Task 6's demo fallback content). Confirm the existing editable chips (célpozíciók, célcégek, szinonimák, webes lekérdezések) still work exactly as before (add/remove, persists across `renderCelpiac` re-render).

- [ ] **Step 3: Commit**

```bash
git add app/public/app.js
git commit -m "ui: Célpiac view shows geo_scope (elasticity + catchment + rationale) and the broad-tier fallback queries, read-only"
```

---

### Task 13: `app/public/app.js` — `geo_fit` badge on candidates

**Files:**
- Modify: `app/public/app.js` (`candCardHtml`, `candRowHtml`, `renderDrawer`)

**Interfaces:**
- Consumes: `candidate.geo_fit` (Task 3's output field, present on live-mode candidates; `null`/`undefined` on synthetic candidates — must render nothing rather than a broken badge in that case).
- Produces: n/a.

The current relevant functions (verified — this is the live, current code):

```js
function candCardHtml(p, x) {
  const t = effTier(p, x.id);
  const ov = p.priority_overrides[x.id];
  return `<div class="bcard tier-${t || "none"}" data-id="${esc(x.id)}" tabindex="0" role="button" aria-label="${esc(x.name)} megnyitása">
    <div class="bcard-top">
      <select class="prio-sel bcard-prio" data-id="${esc(x.id)}" title="Prioritás — a recruiter felülbírálhatja" aria-label="Prioritás">
        <option value="" ${!t ? "selected" : ""}>—</option>
        ${["A", "B", "C", "D"].map((k) => `<option value="${k}" ${t === k ? "selected" : ""}>${k}</option>`).join("")}
      </select>
      ${x.is_new ? `<span class="new-chip">Új</span>` : ""}
      ${ov ? `<span class="bcard-ov" title="A recruiter állította be">kézzel</span>` : ""}
    </div>
    <div class="bcard-name">${esc(x.name)}</div>
    <div class="bcard-meta">${esc(x.headline || "")}</div>
    <div class="bcard-meta dim">${esc([x.current_company, x.location].filter(Boolean).join(" · "))}</div>
    <div class="bcard-chips">${candStateChips(p, x)}<span class="chip">${strongCount(x)} erős jel</span></div>
    <div class="bcard-next">${esc(candNext(p, x))}</div>
  </div>`;
}
function candRowHtml(p, x) {
  const t = effTier(p, x.id);
  const ov = p.priority_overrides[x.id];
  return `<div class="crow tier-${t || "none"}" data-id="${esc(x.id)}">
    <select class="prio-sel" data-id="${esc(x.id)}" title="Prioritás — a recruiter felülbírálhatja">
      <option value="" ${!t ? "selected" : ""}>—</option>
      ${["A", "B", "C", "D"].map((k) => `<option value="${k}" ${t === k ? "selected" : ""}>${k}</option>`).join("")}
    </select>
    <div><div class="crow-name">${esc(x.name)}</div><div class="crow-head">${esc(x.headline || "")}</div></div>
    <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}</div>
    <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut" style="font-size:10px">kézzel állítva</span>` : ""}</div>
    <div class="crow-state">${candStateChips(p, x)}<div class="mut" style="margin-top:3px">Következő: ${candNext(p, x)}</div></div>
    <button class="btn crow-open" data-id="${esc(x.id)}">Részletek</button>
  </div>`;
}
```

And in `renderDrawer`:

```js
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")}</div>
      ${(c.past_companies || []).length ? `<div class="crow-meta" style="margin-top:2px">Korábban: ${(c.past_companies || []).map(esc).join(" · ")}</div>` : ""}
```

- [ ] **Step 1: Add a shared badge helper**

In `app/public/app.js`, insert this function immediately above `function candCardHtml(p, x) {`:

```js
function geoFitChip(geoFit) {
  if (!geoFit || geoFit === "unknown") return "";
  const cls = geoFit === "in_scope" ? "good" : geoFit === "out_of_scope" ? "bad" : "warn";
  const label = geoFit === "in_scope" ? "helyszín: illeszkedik" : geoFit === "out_of_scope" ? "helyszín: eltér" : "helyszín: bizonytalan";
  return `<span class="chip ${cls}">${esc(label)}</span>`;
}
```

- [ ] **Step 2: Use it in the board card**

Find (inside `candCardHtml`):

```js
    <div class="bcard-meta dim">${esc([x.current_company, x.location].filter(Boolean).join(" · "))}</div>
```

Replace with:

```js
    <div class="bcard-meta dim">${esc([x.current_company, x.location].filter(Boolean).join(" · "))}</div>
    ${geoFitChip(x.geo_fit)}
```

- [ ] **Step 3: Use it in the list row**

Find (inside `candRowHtml`):

```js
    <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}</div>
    <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut" style="font-size:10px">kézzel állítva</span>` : ""}</div>
```

Replace with:

```js
    <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}${geoFitChip(x.geo_fit) ? "<br>" + geoFitChip(x.geo_fit) : ""}</div>
    <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut" style="font-size:10px">kézzel állítva</span>` : ""}</div>
```

- [ ] **Step 4: Use it in the candidate drawer**

In `renderDrawer`, find:

```js
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")}</div>
      ${(c.past_companies || []).length ? `<div class="crow-meta" style="margin-top:2px">Korábban: ${(c.past_companies || []).map(esc).join(" · ")}</div>` : ""}
```

Replace with:

```js
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")} ${geoFitChip(c.geo_fit)}</div>
      ${(c.past_companies || []).length ? `<div class="crow-meta" style="margin-top:2px">Korábban: ${(c.past_companies || []).map(esc).join(" · ")}</div>` : ""}
```

- [ ] **Step 5: Manual verification**

Run: `npm run app`, open a project with discovered candidates (synthetic candidates won't show a badge since `geo_fit` is `null` for them — expected, per Task 2/3 scope; only live-mode Firecrawl candidates get `geo_fit`). Confirm no rendering errors (check browser console) in both board and list view, and in the candidate drawer.

- [ ] **Step 6: Commit**

```bash
git add app/public/app.js
git commit -m "ui: candidate board card, list row, and drawer show geo_fit badge"
```

---

### Task 14: Full regression pass

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

### Task 15: Manual live-mode verification (matches the spec's regression scenarios)

**Files:** none — this exercises live `ANTHROPIC_API_KEY` (and optionally `FIRECRAWL_API_KEY`) behavior that can't be asserted deterministically.

- [ ] **Step 1: Location sensitivity check**

With `ANTHROPIC_API_KEY` set, run the app (`npm run app`), create two projects with the *same* brief (a common, replaceable role — entry/mid-level) but different `position.location` (e.g. Győr vs Budapest). Run "Brief elemzése" → "Keresési terv készítése" on both. Confirm: `geo_scope.catchment_places` differs meaningfully between the two (not just the anchor city swapped in a template), and — in `synthetic` reach mode — the discovered candidate subset differs too. This is the direct regression test for "just looks for Hungarian candidates" no longer being true.

- [ ] **Step 2: Elasticity sensitivity check**

Using the same location, create two projects with `position.seniority` set to an entry-level value vs a C-level/executive value (brief text can otherwise stay similar). Run "Brief elemzése" → "Keresési terv készítése" on both. Confirm: `geo_scope.search_elasticity` is `tight` (or close to it) for the entry-level case and `loose` for the executive case, with `catchment_places` visibly narrower vs. wider accordingly. This is the direct regression test for the clerk-vs-GM distinction that motivated this whole feature.

- [ ] **Step 3: Exclusion-feature regression check**

Create a project with `position.client` set to a real-sounding company name. Run through Brief elemzése → Keresési terv. Confirm `exclude_companies` includes the client and `exclusion_note` reads correctly (unaffected by this plan's changes). Run "Jelöltkutatás" with `source: synthetic` and confirm the injected insider candidates are still present and still get excluded/flagged by the existing `Kizárás` UI exactly as before this plan's changes.

- [ ] **Step 4: If any check fails**

Do not patch by hand-tuning the demo fallback (Task 6) — that only affects no-key mode. If live-mode reasoning drifts, the fix belongs in the `queryBuild` task prompt (Task 6, `core/capabilities.js`); re-read the calibration rules in `docs/superpowers/specs/2026-08-02-search-specification-and-geography-design.md` before changing them, since they were empirically validated, not guessed. If the exclusion-feature check fails, that's a regression this plan caused — fix it in whichever task's diff touched the affected file, don't work around it.

- [ ] **Step 5: Update the README if the geography behavior is worth documenting for users**

Optional — only if you judge it worth surfacing in `README.md`'s existing "📡 A scraping — mit csinál és mit NEM" section. Not required for this plan to be considered done.

---

### Task 16: Live-verification fixes — geo_fit enum validation, extraction retry, conditional exclusion filter

**Why this task exists:** Task 15's live-mode run (real Firecrawl + real Anthropic calls) surfaced three concrete defects that no synthetic/demo test could catch, since they only manifest with real LLM output variance and real noisy web content:

1. On a clean, small batch, live extraction correctly classified `geo_fit` — but the model returned the string `"unclear"` for one candidate, which is not one of the four values `normalize.js`'s own prompt schema defines (`in_scope|adjacent|out_of_scope|unknown`). `core/reach/normalize.js`'s current return mapping (`geo_fit: e.geo_fit || null`) does not validate this, so an arbitrary out-of-schema string can reach the UI's `geoFitChip()` (Task 13), which was only designed to handle the four documented values plus null/undefined.
2. A larger, noisier live batch (17 raw hits including large non-candidate GitHub content) came back with `location`/`geo_fit` null and generic heuristic-fallback signals for **every single candidate** — the exact signature of the extraction `think()` call throwing (JSON parse failure or similar) and silently falling back to heuristics for the whole batch, with zero retry and zero logging. This is a pre-existing gap already named in this project's own `eval/REPORT.md` fix backlog ("`think()`: 1× retry JSON-parse-hibára") — not something earlier tasks in this plan introduced, but this plan's new `geo_fit` feature is now the most visible casualty of it in live use.
3. `queryBuild`'s KIZÁRÁS instruction (`core/capabilities.js`) has no explicit fallback for "no client provided" — when `position.client` is empty, the live model invented a literal placeholder string `-"[ÜGYFÉL_CÉGNÉV_MEGADANDÓ]"` and appended it to every single search query (both tiers), observed directly in a live run. Harmless in effect (no real page matches that literal string, so the negative filter is a no-op) but visibly wrong, and now more visible than before since Task 12 surfaces raw queries to the recruiter in the UI.

**Files:**
- Modify: `core/reach/normalize.js` (fixes 1 and 2)
- Modify: `core/capabilities.js` (fix 3, the `queryBuild` task prompt only)

**Interfaces:** No signature changes anywhere — these are internal robustness/correctness fixes to functions already wired up by Tasks 3 and 6. Nothing downstream needs to change.

The current `core/reach/normalize.js` (verified, current state after Task 3):

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

  return withRef.map((h) => {
    const e = extracted[h.ref] || {};
    const name = e.name || heuristicName(h.title);
    const signals = (e.signals || []).map((s) => ({
      signal: stripSensitive(s.signal),
      strength: s.strength || "közepes",
    }));
    return {
      id: idFor(h.url, h.title),
      synthetic: false,
      name,
      headline: stripSensitive(e.headline || h.description || h.title || ""),
      current_company: e.current_company || null,
      // A kizárási szabály ("korábban az ügyfélnél dolgozott") ezen a mezőn áll
      // vagy bukik — ha üres, csak a jelenlegi munkáltatóra tudunk szűrni.
      past_companies: Array.isArray(e.past_companies) ? e.past_companies.filter(Boolean) : [],
      location: e.location || null,
      geo_fit: e.geo_fit || null,
      is_person: e.is_person !== false,
      signals: signals.length ? signals : [{ signal: stripSensitive(h.description || ""), strength: "gyenge" }],
      source_url: h.url,
      source_type: h.source_type,
      art14_status: h.source_type === "linkedin" || h.source_type === "synthetic" ? "n/a" : "pending_notice",
      provenance: {
        method: "firecrawl-public-web",
        query: h.query,
        fetched_at: new Date().toISOString(),
      },
    };
  });
}
```

- [ ] **Step 1: Fix 1 + Fix 2 in `core/reach/normalize.js` — validate geo_fit enum, retry extraction once with logging**

Replace the entire `normalizeHits` function above with:

```js
const VALID_GEO_FIT = ["in_scope", "adjacent", "out_of_scope", "unknown"];

export async function normalizeHits(hits, geoScope) {
  const withRef = hits.map((h, i) => ({ ...h, ref: `h${i}` }));

  let extracted = {};
  if (brainAvailable() && withRef.length) {
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
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const out = await think({ task: EXTRACT_TASK, input, maxTokens: 6000, temperature: 0.2 });
        for (const c of out.candidates || []) extracted[c.ref] = c;
        break;
      } catch (e) {
        if (attempt === 2) {
          console.error(`normalizeHits: AI-extrakció 2 kísérlet után is elhalt, heurisztikára esik vissza (${withRef.length} találat): ${e.message}`);
        }
      }
    }
  }

  return withRef.map((h) => {
    const e = extracted[h.ref] || {};
    const name = e.name || heuristicName(h.title);
    const signals = (e.signals || []).map((s) => ({
      signal: stripSensitive(s.signal),
      strength: s.strength || "közepes",
    }));
    return {
      id: idFor(h.url, h.title),
      synthetic: false,
      name,
      headline: stripSensitive(e.headline || h.description || h.title || ""),
      current_company: e.current_company || null,
      // A kizárási szabály ("korábban az ügyfélnél dolgozott") ezen a mezőn áll
      // vagy bukik — ha üres, csak a jelenlegi munkáltatóra tudunk szűrni.
      past_companies: Array.isArray(e.past_companies) ? e.past_companies.filter(Boolean) : [],
      location: e.location || null,
      geo_fit: VALID_GEO_FIT.includes(e.geo_fit) ? e.geo_fit : null,
      is_person: e.is_person !== false,
      signals: signals.length ? signals : [{ signal: stripSensitive(h.description || ""), strength: "gyenge" }],
      source_url: h.url,
      source_type: h.source_type,
      art14_status: h.source_type === "linkedin" || h.source_type === "synthetic" ? "n/a" : "pending_notice",
      provenance: {
        method: "firecrawl-public-web",
        query: h.query,
        fetched_at: new Date().toISOString(),
      },
    };
  });
}
```

Note what changed and why: `input` is now built once outside the retry loop (it doesn't depend on the attempt). The `try/catch` becomes a `for` loop trying up to twice; only on the second (final) failure does it log to `console.error` — so a transient failure that succeeds on retry stays silent (no noise in the common case), but a genuine, persistent failure is no longer silent. `geo_fit` is now validated against `VALID_GEO_FIT` before being stored — any value the model returns that isn't one of the four documented options (including things like the observed `"unclear"`) is coerced to `null`, matching the "unknown/unparseable → null" contract the EXTRACT_TASK prompt already documents for the "no geo_scope" case.

- [ ] **Step 2: Verify the module still loads correctly**

Run: `node -e "import('./core/reach/normalize.js').then(m => console.log(typeof m.normalizeHits))"`
Expected: `function`

- [ ] **Step 3: Fix 3 in `core/capabilities.js` — make the KIZÁRÁS negative filter conditional on a known client**

Find this exact line inside `queryBuild`'s `task` template literal (unchanged since Task 6):

```
KIZÁRÁS — KÖTELEZŐ: az ügyfél saját cége SOHA nem lehet célcég, és MINDKÉT lekérdezés-listába (szűk és tág is) negatív szűrőként be kell kerülnie (pl. -"Ügyfél Neve"). Az ügyfél jelenlegi és volt munkatársait a hiring manager amúgy is ismeri; ha bekerülnek a merítésbe, az a keresés hitelét viszi. Az "exclude_companies" listába vedd fel az ügyfél cégét és a felismerhető leányvállalatait.
```

Replace it with:

```
KIZÁRÁS — KÖTELEZŐ, HA AZ ÜGYFÉL CÉGE ISMERT: ha a bemenetben szerepel "AZ ÜGYFÉL CÉGE" adat, az a cég SOHA nem lehet célcég, és MINDKÉT lekérdezés-listába (szűk és tág is) negatív szűrőként be kell kerülnie (pl. -"Ügyfél Neve"). Az ügyfél jelenlegi és volt munkatársait a hiring manager amúgy is ismeri; ha bekerülnek a merítésbe, az a keresés hitelét viszi. Az "exclude_companies" listába vedd fel az ügyfél cégét és a felismerhető leányvállalatait. HA AZ ÜGYFÉL CÉGE NEM ISMERT (nincs megadva a bemenetben): SEMMILYEN körülmények között ne találj ki vagy told be helyőrző/placeholder szöveget (pl. "[ÜGYFÉL_CÉGNÉV_MEGADANDÓ]") a lekérdezésekbe — egyszerűen hagyd ki a negatív szűrőt mindkét listából, és az "exclude_companies" legyen üres tömb.
```

This is a single-line find/replace within the existing `task` template literal — do not touch anything else in `queryBuild` (the JSON schema block, the `basis`/`briefFinal` logic, the `input` construction are all untouched by this task).

- [ ] **Step 4: Write a regression test covering both normalize.js fixes**

Create `scripts/test-normalize-robustness.js`:

```js
// Egységteszt: normalizeHits geo_fit-validáció (nincs élő API-hívás, brainAvailable csak akkor
// true, ha van kulcs — ez a teszt a nem-live ágat és a validációs logikát célozza direktben).
import { normalizeHits } from "../core/reach/normalize.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// Nincs API-kulcs (vagy legalábbis ez a teszt nem attól függ) → brainAvailable() valószínűleg
// false ebben a környezetben, így az extracted map üres marad, és minden mező a heurisztikus
// ágra esik — geo_fit ilyenkor mindig null kell legyen, sosem invalid string.
const hits = [
  { url: "https://example.com/a", title: "Teszt Elek - Senior Engineer", description: "desc", source_type: "web", query: "q", excerpt: "" },
];
const result = await normalizeHits(hits, { catchment_places: [{ place: "Budapest", country: "Hungary", cross_border: false, note: "x" }] });
ok("normalizeHits nem dob hibát geoScope-pal, API-hívás nélkül is", Array.isArray(result) && result.length === 1);
ok("geo_fit heurisztikus ágon null (sosem invalid string)", result[0].geo_fit === null);

console.log("\nnormalize robusztusság-teszt kész.");
```

- [ ] **Step 5: Run the new test plus the full regression sequence**

Run:
```bash
node scripts/test-normalize-robustness.js
node scripts/test-synthetic-geo.js
node scripts/test-reach-tiers.js
env -u ANTHROPIC_API_KEY node scripts/test-query-build-demo.js
env -u ANTHROPIC_API_KEY node scripts/test-rank-geo.js
npm run smoke
node scripts/test-mcp.js
```
Expected: every script prints only `✅` lines and exits 0 — this task must not regress anything from Tasks 1-14.

- [ ] **Step 6: Commit**

```bash
git add core/reach/normalize.js core/capabilities.js scripts/test-normalize-robustness.js
git commit -m "reach+capabilities: validate geo_fit enum, retry failed extraction once, stop inventing a client placeholder when none is given"
```

- [ ] **Step 7: Re-run a live spot-check if `ANTHROPIC_API_KEY`/`FIRECRAWL_API_KEY` are available**

Not required for task completion (no deterministic way to force the original failure on demand), but if credentials are available, re-running the same kind of live `queryBuild` call with no `position.client` set is a good confirmation that the placeholder string no longer appears in `firecrawl_search_queries`/`firecrawl_search_queries_broad`.
