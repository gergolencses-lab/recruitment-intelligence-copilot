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
 * Olcsó előkapu: már a NYERS találatszám is kevés, még scrapelés előtt.
 * @returns {boolean}
 */
export function shouldBroadenOnHits({ hitCount, hasBroad, threshold }) {
  return hasBroad && hitCount < threshold;
}

/**
 * Valódi kapu: sok nyers találat is adhat kevés HASZNÁLHATÓ jelöltet, mert a
 * találatok nagy része nem személy (céglista, cikk, hirdetés). A kibővítést
 * ezért a jelöltszámhoz kötjük, nem a találatszámhoz — ez volt az a hiba,
 * ami miatt 12-13 találatos cellák 1-2 jelölttel értek véget bővítés nélkül.
 * @returns {boolean}
 */
export function shouldBroadenOnCandidates({ personCount, alreadyBroadened, hasBroad, minCandidates }) {
  return hasBroad && !alreadyBroadened && personCount < minCandidates;
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
  const hasBroad = (broadSearchQueries || []).length > 0;

  // 1) Olcsó előkapu: ha már a nyers találatszám is kevés, bővítsünk MÉG a
  //    scrapelés előtt — így a tág kör találatai is részesülnek a scrape-keretből.
  if (shouldBroadenOnHits({ hitCount: hits.length, hasBroad, threshold: config.reachBroadenThreshold })) {
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
  let candidates = await normalizeHits(hits, geoScope);
  let persons = candidates.filter((c) => c.is_person !== false);

  // 2) Valódi kapu: sok nyers találat is adhat kevés HASZNÁLHATÓ jelöltet, mert a
  //    találatok nagy része nem személy. Ilyenkor az előkapu nem sült el — itt
  //    pótoljuk, a jelöltszám alapján.
  if (shouldBroadenOnCandidates({
    personCount: persons.length, alreadyBroadened: broadened,
    hasBroad, minCandidates: config.reachMinCandidates,
  })) {
    broadened = true;
    onProgress && onProgress(
      `Kevés használható jelölt (${persons.length} a ${hits.length} találatból) — kibővített kereséssel folytatjuk…`
    );
    const more = await searchHits(broadSearchQueries, { onProgress });
    const seen = new Set(hits.map((h) => h.url));
    const fresh = more.filter((h) => !seen.has(h.url));
    if (fresh.length) {
      const scraped = await scrapeTopHits(fresh, { onProgress });
      const extra = await normalizeHits(scraped, geoScope);
      const known = new Set(candidates.map((c) => c.id));
      candidates = candidates.concat(extra.filter((c) => !known.has(c.id)));
      persons = candidates.filter((c) => c.is_person !== false);
      hits = hits.concat(scraped);
    }
  }
  return {
    source: "firecrawl",
    candidates: persons,
    note:
      `Nyilvános webes források: ${persons.length} jelölt ${hits.length} találatból.` +
      (broadened ? " A szűk keresés kevés találatot hozott — automatikusan kibővítettük a keresést." : "") +
      " Nincs belépett/fake-account LinkedIn-hozzáférés — a LinkedIn-URL-ek a keresőből, a mélység a nyilvánosan elérhető forrásokból (GitHub, cég-oldal, konferencia-bio, blog).",
  };
}
