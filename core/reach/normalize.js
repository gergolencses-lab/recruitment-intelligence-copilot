// Nyers Firecrawl-találatok → strukturált Candidate rekordok.
// AI-extrakció (ha van Agy), különben heurisztikus parse.
import crypto from "node:crypto";
import { think, brainAvailable } from "../llm.js";
import { stripSensitive } from "../guardrails.js";

function idFor(url, title) {
  return "fc-" + crypto.createHash("sha1").update((url || "") + (title || "")).digest("hex").slice(0, 8);
}

function heuristicName(title) {
  if (!title) return "(ismeretlen)";
  // "Name - Title | LinkedIn"  /  "Name (@handle) · GitHub"
  let t = title.split("|")[0].split("·")[0].split(" - ")[0].split(" — ")[0].trim();
  t = t.replace(/\(@[^)]+\)/g, "").trim();
  return t || "(ismeretlen)";
}

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
      location: e.location || null,
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
