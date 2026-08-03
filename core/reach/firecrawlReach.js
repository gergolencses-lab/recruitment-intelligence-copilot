// 📡 Reach Engine — Firecrawl-alapú PUBLIKUS-web discovery.
//
// FONTOS (jogi + működési, ld. spec §5/§11):
// - Ez NEM belépett/fake-account LinkedIn-scraping. Publikus keresés + publikus
//   oldalak scrapelése (GitHub, cég-oldalak, konferencia-bio-k, személyes site-ok).
// - A LinkedIn publikus profil-URL-ek a keresőn át jönnek; a profil-oldal maga
//   jellemzően auth-fal mögött van, ezért a SERP-snippetet tartjuk meg róla.
// - A valódi mélységet a ténylegesen scrapelhető publikus források adják.
import { config } from "../config.js";

async function fc(pathname, body) {
  const res = await fetch(`${config.firecrawlBase}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.firecrawlApiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${pathname} HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function search(query, limit) {
  const json = await fc("/search", { query, limit: limit || config.reachSearchLimit });
  const rows = json.data || json.results || [];
  return rows.map((r) => ({
    url: r.url || r.link || (r.metadata && r.metadata.sourceURL) || "",
    title: r.title || (r.metadata && r.metadata.title) || "",
    description: r.description || r.snippet || (r.metadata && r.metadata.description) || "",
  })).filter((r) => r.url);
}

export async function scrape(url) {
  try {
    const json = await fc("/scrape", { url, formats: ["markdown"], onlyMainContent: true });
    const d = json.data || json;
    return {
      markdown: d.markdown || d.content || "",
      title: (d.metadata && d.metadata.title) || "",
    };
  } catch (e) {
    return { markdown: "", title: "", error: String(e.message || e) };
  }
}

export function classifySource(url) {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com/in")) return "linkedin";
  if (u.includes("github.com")) return "github";
  if (u.includes("xing.com")) return "xing";
  if (u.includes("stackoverflow.com") || u.includes("stackexchange")) return "stackoverflow";
  if (u.includes("medium.com") || u.includes("dev.to") || u.includes("substack")) return "blog";
  if (u.includes("twitter.com") || u.includes("x.com")) return "social";
  if (u.includes("meetup.com") || u.includes("sessionize") || u.includes("conf")) return "community";
  return "web";
}

// Scrapelhető-e mélyen? A LinkedIn/social auth-fal mögött van — ott csak a snippet marad.
function isDeepScrapable(sourceType) {
  return ["github", "blog", "community", "web", "xing", "stackoverflow"].includes(sourceType);
}

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
