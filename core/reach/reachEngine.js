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
