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
