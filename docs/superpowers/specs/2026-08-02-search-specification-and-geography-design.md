# Search specification tiering & geographic reach — design spec

**Date:** 2026-08-02
**Scope:** `queryBuild` → Reach Engine (`firecrawlReach`/`syntheticReach`) → `normalize` → `rankTargets`, plus the app/MCP callers and UI surfaces that touch them.

## Problem

Two related failures in the discovery pipeline:

1. **Search over/under-specification.** `queryBuild` produces a single flat list of 5 `firecrawl_search_queries` in one shot. A detailed brief tends to AND every must-have together into each query (specific stack + years + location + pedigree), so queries return few or zero hits — already observed in the project's own eval (`eval/REPORT.md`, brief #02: 4 raw hits, 2 not even people). There's no fallback broadening, and no notion that a "good enough" match should still surface rather than requiring a perfect one.
2. **No geographic reasoning.** `position.location` is free text, `work_mode` is on-site/hybrid/remote, and both are only ever dumped as raw JSON into prompts. Nothing expands a location into a sensible search/candidate-matching scope, no candidate location is compared against the role, and even the synthetic demo pool ignores geography entirely (always returns all 14 fixed candidates regardless of role location).

## Empirical basis for the geography design

Two research workflows validated the design choices below before implementation (see session transcript for full data):

- **Drive-time verification** (3 anchor cities, web-search fact-checked): Claude's *relative* geographic judgment (which places are plausibly near an anchor, including cross-border) was reliable — no place was ever put in a wrong tier. Specific **minute/km figures were not** — errors of 15–25 minutes were common in both directions. Conclusion: reason about places, never state invented precision.
- **16-scenario strategy tournament** (4 Hungarian job types × Győr/Debrecen/Pécs/Budapest × 3 candidate prompt strategies, blind-judged, refined, re-tested): pure geography reasoning without explicit scarcity/elasticity calibration got the clerk-vs-executive distinction **wrong in over half the relevant cases** — it drifted to "loose" whenever the place list got long or crossed a border, independent of whether the role was actually scarce. Explicit calibration tiers, a self-consistency check, and scoped anti-padding measurably fixed this (2/3 win rate on a held-out re-test). Also surfaced: the anchor location must always appear in its own catchment list (dropping it was a real regression), and "loose" searches must still name real places, not return an empty list.

## 1. `queryBuild` (`core/capabilities.js`)

New output schema (replaces the flat `firecrawl_search_queries` list):

```jsonc
{
  "boolean_queries": [ /* unchanged, reference-only */ ],
  "geo_scope": {
    "search_elasticity": "tight | moderate | loose",
    "anchor": "Győr, HU",                 // echoes position.location
    "catchment_places": [
      { "place": "...", "country": "...", "cross_border": true, "note": "<concrete, evidence-based reason>" }
    ],
    "rationale": "<geography narrative + elasticity justification together, self-consistent>"
  },
  "search_tiers": [
    { "tier": "narrow", "firecrawl_search_queries": ["..."] },  // all must-haves ANDed, geo_scope folded in
    { "tier": "broad",  "firecrawl_search_queries": ["..."] }   // core title/domain signal only, geo_scope folded in
  ],
  "target_companies": ["..."],
  "target_titles": ["..."],
  "synonyms": ["..."]
}
```

Prompt requirements for `geo_scope` (each one earned by a specific observed failure — do not simplify away):

- `search_elasticity` is derived from how the role is actually sourced in the real labor market (scarcity/seniority/replaceability from the brief + `position.seniority` + `intake.must_haves`), **not** from `work_mode` and **not** by mirroring the length of the place list or whether a border is crossed. Calibration:
  - **tight** — entry-level, high-volume, shift-based, or otherwise interchangeable/non-scarce roles with a physical-presence requirement. Bounded local/employer-shuttle catchment.
  - **moderate** — senior IC/specialist/team-lead roles with a real but partial onsite requirement. Wider hybrid-commute area, possibly cross-border, not a relocation search.
  - **loose** — true executive/C-suite or genuinely scarce-specialist searches, normally sourced nationally/internationally with relocation as the norm. Reason in relocation/national-pool terms, not commute-radius terms.
- **Self-consistency check**: before finalizing, the elasticity label must match the tone of the geography narrative (a "bounded shuttle ring" narrative cannot end in `loose`; a "national talent pool" narrative cannot end in `tight`).
- **Anti-padding, correctly scoped**: only include a catchment place with a concrete, evidence-based reason (real transit corridor, known commuter town, documented cross-border labor flow). This targets *speculative/hedge-only* entries — it must not be used to trim well-evidenced local detail, and must not lead the model to assert unconfirmed specific facts (e.g. which company has a plant where) it isn't confident about.
- **The anchor location is always included** in `catchment_places` regardless of elasticity — non-negotiable.
- **`loose` elasticity still names real places** — major talent-concentration hubs, relevant international nodes tied to the brief's own context (e.g. an international-expansion mandate → CEE regional HQ hubs). An empty list is a dead end for the downstream query builder, not a valid "geography doesn't matter" answer.
- **No specific minute/km figures ever** — relative/comparative judgment only ("X is closer to the anchor by road than Y").

`search_tiers` is purely a **must-have specificity** axis, orthogonal to geography: `narrow` ANDs the query terms from `intake.must_haves`, `broad` drops to core title/domain signal only (relaxing niche must-have combos) — same distinction the original over-specification problem called for. **Both tiers use the same `geo_scope.catchment_places`** for their geographic terms; elasticity has already calibrated that list to the right breadth for the role (a `tight` clerk search naturally gets a small close-in list, a `loose` GM search naturally gets a spread national one), so geography doesn't need a second, separate narrow/broad cut on top of that. The broad tier only fires adaptively if narrow is thin (§2) — broadening relaxes skill strictness, not geographic scope.

## 2. Reach Engine (`core/reach/reachEngine.js`, `firecrawlReach.js`)

`discover()` signature changes from `{ searchQueries, source, onProgress }` to `{ searchTiers, geoScope, source, onProgress }`.

Adaptive broadening:
1. Run the `narrow` tier first (existing query cap unchanged for a well-scoped brief).
2. Count unique raw hits (deduped by URL) **before** the expensive scrape+normalize step.
3. If below `config.reachBroadenThreshold` (new, default 6), also run the `broad` tier and merge.
4. Scrape-top-N + `normalizeHits` runs once on the combined hit set — broadening only ever doubles search calls, never doubles LLM extraction cost. Each surviving candidate is tagged `matched_tier: "narrow" | "broad"`.
5. The engine's `note` string reports when broadening fired.

## 3. `normalize.js` — geo-fit tagging

`normalizeHits(hits, geoScope)` — the existing extraction prompt (already classifying each hit's `location`) also classifies `geo_fit: "in_scope" | "adjacent" | "out_of_scope" | "unknown"` **by passing the whole `geo_scope` object** (not a list-membership lookup) so the classifier reasons freshly per candidate against the anchor/elasticity/rationale — catching places never explicitly enumerated in `catchment_places`. Same LLM call as today's extraction, no extra round-trip.

## 4. `syntheticReach.js` — deterministic, no LLM call

`gatherSynthetic(searchTiers, geoScope)` filters/tags the fixed 14-profile pool with plain JS: parse the `"City, XX"` country-code suffix (controlled fixture data, safe to hardcode-parse — this is not a general geo taxonomy, just parsing our own authored fixtures) and do a keyword match against tier terms. Demo mode currently always returns all 14 regardless of role location; after this change a Budapest-onsite-clerk demo shows a geo-relevant subset, a remote-CEE demo shows the full spread.

## 5. `rankTargets` (`core/capabilities.js`)

Candidate input to the ranking prompt gains `location` and `geo_fit` alongside the existing `signals`, so ranking can reason about geography explicitly (e.g. a strong candidate in the wrong place for a `tight`-elasticity on-site role gets that named as part of its rationale, not silently ignored or silently dropped — consistent with the existing accountability guardrail that everyone still appears in `ranked`).

## 6. `config.js`

Add `reachBroadenThreshold` (default 6, env override `REACH_BROADEN_THRESHOLD`) alongside the existing `reachSearchLimit`/`reachScrapeTop` pattern.

## 7. UI (`app/public/app.js`)

- `renderQuery` (Célpiac view, ~app.js:665): add a `geo_scope` block — elasticity + catchment places + rationale, read-only, same card style as the existing "Keresési terv" card. Recruiter-facing transparency, no edit UI in v1 (matches the product's existing "javaslat, amit a recruiter ellenőriz" pattern elsewhere).
- `renderCandidatesView` row (~app.js:758-769) and `renderDrawer` (~app.js:808-830): add a `geo_fit` badge next to `location`, reusing the existing `.chip`/`.chip.good/.warn` classes (no new CSS needed) — `in_scope` → `.chip.good`, `adjacent` → `.chip.warn` (bare `.chip`), `out_of_scope` → `.chip.bad`.

## 8. MCP surface (`mcp/server.js`)

`query_build` and `discover_candidates` tool descriptions/`inputSchema` updated to match the new shapes so Surface B stays consistent with Surface A (`search_queries` → `search_tiers`, `geo_scope` threaded through).

## 9. Other callers to update

- `app/server.js` `/discover` route (~line 127-128): currently reads `p.query.firecrawl_search_queries` flat; must read `p.query.search_tiers` + `p.query.geo_scope`.
- `core/demo.js` `queryBuild` demo fallback: needs the new shape or demo mode (no API key) breaks.
- `scripts/smoke.js`: calls `discoverCandidates({ searchQueries: query.firecrawl_search_queries, ... })` directly — update to the new shape so the smoke test keeps exercising the real pipeline.

## Testing

- `npm run smoke` must pass end-to-end in demo mode against the new schema.
- Manual check: a same clerk-role brief run against two different `position.location` values (e.g. Győr vs Budapest) should produce visibly different `geo_scope.catchment_places` and (in synthetic mode) a different candidate subset — this is the direct regression test for "just looks for Hungarian candidates" no longer being true.
- Manual check: the same brief text with `position.seniority` swapped from entry-level to C-level should flip `search_elasticity` from `tight` to `loose` without the location changing — this is the direct regression test for the clerk-vs-GM distinction.
