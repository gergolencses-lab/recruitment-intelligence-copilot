# Search specification tiering & geographic reach — design spec

**Date:** 2026-08-02 (revised same day after discovering upstream drift — see Revision note)
**Scope:** `queryBuild` → Reach Engine (`firecrawlReach`/`syntheticReach`) → `normalize` → `rankTargets`, plus the app/MCP callers and UI surfaces that touch them.

## Revision note

The first version of this spec was written against a snapshot of the repo that a subsequent `git log` check showed was stale: 9 commits (4 merged PRs) had landed on `main` in the meantime, adding a client-exclusion feature (`exclude_companies`, `past_companies`, a whole `Kizárás` UI) and a chat-driven "strategy assistant" that lets recruiters edit `firecrawl_search_queries` (and other query-plan fields) via natural language, backed by a hardcoded field whitelist in three places (`core/guardrails.js` `STRATEGY_FIELDS`, `core/demo.js` `CHAT_FIELDS`, `app/public/app.js`'s chip-editor wiring). The original design nested queries into a `search_tiers: [{tier, firecrawl_search_queries}]` structure — that would have silently broken the chat-editable field, since none of those three whitelists would recognize the new nested shape. This revision keeps every new field **additive** and leaves `firecrawl_search_queries` untouched in name and meaning.

## Problem

Two related failures in the discovery pipeline:

1. **Search over/under-specification.** `queryBuild` produces a single flat list of `firecrawl_search_queries` in one shot. A detailed brief tends to AND every must-have together into each query (specific stack + years + location + pedigree), so queries return few or zero hits — already observed in the project's own eval (`eval/REPORT.md`, brief #02: 4 raw hits, 2 not even people). There's no fallback broadening, and no notion that a "good enough" match should still surface rather than requiring a perfect one.
2. **No geographic reasoning.** `position.location` is free text, `work_mode` is on-site/hybrid/remote, and both are only ever dumped as raw JSON into prompts. Nothing expands a location into a sensible search/candidate-matching scope, no candidate location is compared against the role, and even the synthetic demo pool ignores geography entirely (always returns the whole fixed pool regardless of role location).

## Empirical basis for the geography design

Two research workflows validated the design choices below before implementation (see session transcript for full data):

- **Drive-time verification** (3 anchor cities, web-search fact-checked): Claude's *relative* geographic judgment (which places are plausibly near an anchor, including cross-border) was reliable — no place was ever put in a wrong tier. Specific **minute/km figures were not** — errors of 15–25 minutes were common in both directions. Conclusion: reason about places, never state invented precision.
- **16-scenario strategy tournament** (4 Hungarian job types × Győr/Debrecen/Pécs/Budapest × 3 candidate prompt strategies, blind-judged, refined, re-tested): pure geography reasoning without explicit scarcity/elasticity calibration got the clerk-vs-executive distinction **wrong in over half the relevant cases** — it drifted to "loose" whenever the place list got long or crossed a border, independent of whether the role was actually scarce. Explicit calibration tiers, a self-consistency check, and scoped anti-padding measurably fixed this (2/3 win rate on a held-out re-test). Also surfaced: the anchor location must always appear in its own catchment list (dropping it was a real regression), and "loose" searches must still name real places, not return an empty list.

## 1. `queryBuild` (`core/capabilities.js`)

New output fields, **added alongside** the existing schema (`boolean_queries`, `firecrawl_search_queries`, `target_companies`, `target_titles`, `synonyms`, `exclude_companies`, `exclusion_note` — all unchanged, all still chat-editable exactly as today):

```jsonc
{
  // ...existing fields, unchanged...
  "firecrawl_search_queries_broad": ["..."],  // NEW — fallback tier, NOT chat-editable, used only when the narrow (existing) list is thin
  "geo_scope": {                              // NEW — read-only, informational
    "search_elasticity": "tight | moderate | loose",
    "anchor": "Győr, HU",                     // echoes position.location
    "catchment_places": [
      { "place": "...", "country": "...", "cross_border": true, "note": "<concrete, evidence-based reason>" }
    ],
    "rationale": "<geography narrative + elasticity justification together, self-consistent>"
  }
}
```

`firecrawl_search_queries` (existing) is the **narrow** tier — all must-haves ANDed, `geo_scope` folded into the query strings. `firecrawl_search_queries_broad` (new) is the **broad** tier — core title/domain signal only, must-have combos relaxed, same `geo_scope` folded in. Both tiers use the *same* `geo_scope.catchment_places`; elasticity has already calibrated that list to the right breadth for the role (a `tight` clerk search naturally gets a small close-in list, a `loose` GM search naturally gets a spread national one), so geography doesn't need its own separate narrow/broad cut. The broad tier only gets executed if the narrow tier's results are thin (§2) — broadening relaxes skill strictness, not geographic scope.

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

The existing exclusion feature (`exclude_companies`, `exclusion_note`, the `-"ClientName"` negative filter baked into query strings) is untouched and must keep working exactly as today — `geo_scope`/`firecrawl_search_queries_broad` are reasoned about independently and appended to the same prompt/schema, not a replacement for any of it.

## 2. Reach Engine (`core/reach/reachEngine.js`, `firecrawlReach.js`)

`discover()` signature gains two new **optional** parameters: `{ searchQueries, broadSearchQueries, geoScope, source, onProgress, client }` — `searchQueries` and `client` are the existing parameters (unchanged meaning; `client` drives the existing insider-exclusion synthetic-pool injection and must keep flowing through exactly as today).

Adaptive broadening:
1. Run `searchQueries` (narrow) first (existing query cap unchanged for a well-scoped brief).
2. Count unique raw hits (deduped by URL) **before** the expensive scrape+normalize step.
3. If below `config.reachBroadenThreshold` (new, default 6), also run `broadSearchQueries` and merge.
4. Scrape-top-N + `normalizeHits` runs once on the combined hit set — broadening only ever doubles search calls, never doubles LLM extraction cost.
5. The engine's `note` string reports when broadening fired.

This requires splitting `firecrawlReach.js`'s `gatherHits` (search + scrape in one call) into a search-only step and a scrape-only step, so scraping happens exactly once regardless of whether broadening fired.

## 3. `normalize.js` — geo-fit tagging

`normalizeHits(hits, geoScope)` — the existing extraction prompt (already classifying each hit's `location`, `current_company`, `past_companies` for the exclusion feature) also classifies `geo_fit: "in_scope" | "adjacent" | "out_of_scope" | "unknown"` **by passing the whole `geo_scope` object** (not a list-membership lookup) so the classifier reasons freshly per candidate against the anchor/elasticity/rationale — catching places never explicitly enumerated in `catchment_places`. Same LLM call as today's extraction, no extra round-trip. The existing `past_companies` extraction (used by the client-exclusion feature) is unrelated and untouched.

## 4. `syntheticReach.js` — deterministic, no LLM call

The fixed synthetic pool already takes a `client` parameter (`gatherSynthetic(client)`) to inject 3 deliberately-planted "client insider" candidates so the exclusion feature has something real to catch in demo mode — this must keep working unchanged. `gatherSynthetic(client, geoScope)` additionally filters the resulting pool (POOL + injected insiders) by country, parsed from the `"City, XX"` / `"City/Remote, XX"` location suffix already used throughout the pool (controlled fixture data — this is a hardcoded parse of the project's own authored fixtures, not a general geo taxonomy). Fail-open (don't filter) whenever a location or `geo_scope.catchment_places[].country` can't be confidently mapped, and fail open to the unfiltered pool if the geo-filtered set is too thin — a demo must never go to zero candidates. Demo mode currently always returns the same fixed set regardless of role location; after this change a Budapest-onsite-clerk demo shows a geo-relevant subset, a remote-CEE demo shows the full spread.

## 5. `rankTargets` (`core/capabilities.js`)

Candidate input to the ranking prompt gains `location` and `geo_fit` alongside the existing `signals`, so ranking can reason about geography explicitly (e.g. a strong candidate in the wrong place for a `tight`-elasticity on-site role gets that named as part of its rationale, not silently ignored or silently dropped — consistent with the existing accountability guardrail that everyone still appears in `ranked`).

## 6. `config.js`

Add `reachBroadenThreshold` (default 6, env override `REACH_BROADEN_THRESHOLD`) alongside the existing `reachSearchLimit`/`reachScrapeTop` pattern.

## 7. UI (`app/public/app.js`)

- `renderQuery` (Célpiac view — the "Keresési terv" card, now inside the recruiter-editable chip-editor UI): add a **read-only** `geo_scope` block (elasticity + catchment places + rationale) and a **read-only** display of `firecrawl_search_queries_broad` inside the existing `<details>` "Keresési lekérdezések" section, clearly labeled as an automatic fallback. Neither is wired into `chipEditor`/`wireChipEditor`/`_edited_by_recruiter` tracking or the strategy-chat field whitelist — matches the product's existing "javaslat, amit a recruiter ellenőriz" pattern for informational-only AI output.
- Candidate `geo_fit` badge: added to the board-card renderer, the list-row renderer, and the candidate drawer (the three main candidate-viewing surfaces) — reusing the existing `.chip`/`.chip.good/.warn/.bad` classes (no new CSS needed). The separate "excluded candidates" row renderer is out of scope (secondary view, different concern).

## 8. MCP surface (`mcp/server.js`)

`query_build` and `discover_candidates` tool descriptions/`inputSchema` updated to match the new additive fields (`broad_search_queries` param name on the MCP side, `geo_scope` threaded through) so Surface B stays consistent with Surface A. This file was unaffected by the upstream drift — confirmed via `git diff --stat` against current `main`.

## 9. Other callers to update

- `app/server.js` `/discover` route: currently reads `p.query.firecrawl_search_queries` and `p.position.client` and passes both through; must additionally read `p.query.firecrawl_search_queries_broad` and `p.query.geo_scope`.
- `core/demo.js` `queryBuild` demo fallback: needs the new fields (already takes a `client` param for the existing exclusion demo behavior — preserve that) or demo mode (no API key) is missing `geo_scope`/broad-tier data.
- `scripts/smoke.js`, `scripts/test-mcp.js`: confirmed unchanged since the original repo snapshot (`git diff --stat` shows zero delta) — update their `discoverCandidates`/`discover_candidates` calls to pass the new fields so the smoke tests keep exercising the real pipeline shape.

## Testing

- `npm run smoke` must pass end-to-end in demo mode against the new schema, and the existing exclusion-guardrail smoke assertion must keep passing unmodified.
- Manual check: the same clerk-role brief run against two different `position.location` values (e.g. Győr vs Budapest) should produce visibly different `geo_scope.catchment_places` and (in synthetic mode) a different candidate subset — this is the direct regression test for "just looks for Hungarian candidates" no longer being true.
- Manual check: the same brief text with `position.seniority` swapped from entry-level to C-level should flip `search_elasticity` from `tight` to `loose` without the location changing — this is the direct regression test for the clerk-vs-GM distinction.
- Manual check: the existing client-exclusion feature (`exclude_companies`, insider-candidate filtering) must still work identically after this change — run a project with `position.client` set and confirm `exclusion_note`/`exclude_companies` still populate and synthetic insider candidates are still injected and still excludable.
