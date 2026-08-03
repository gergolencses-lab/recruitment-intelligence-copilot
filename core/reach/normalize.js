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
