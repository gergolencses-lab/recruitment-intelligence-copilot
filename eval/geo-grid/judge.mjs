// A rács értékelője. SZÁNDÉKOSAN független a core promptjaitól: saját
// Anthropic-hívást használ, hogy a mért kód módosítása ne módosítsa a mércét.
// Így a körök pontszáma összehasonlítható marad.
//
// Egy cella akkor JÓ, ha MIND az öt kapu átmegy:
//   G1  rugalmasság      — a szerep valós piaci mintázatához illik   (LLM-bíró)
//   G2  vonzáskörzet     — a megnevezett helyek valósak és elérhetők (LLM-bíró)
//   G3  földrajz a query-ben — a catchment nevek tényleg beépültek   (determinisztikus)
//   G4  megtalálhatóság  — a szűk kör nem szűkült nullára            (LLM-bíró + nyers találat)
//   G5  jelöltek         — valóban a szerepre és a földrajzra illenek (LLM-bíró)
//
// Használat: node eval/geo-grid/judge.mjs --run-id=r1 [--concurrency=4]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../core/config.js";
import { parseJson } from "../../core/llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const RUN_ID = args["run-id"] || "r1";
const CONCURRENCY = parseInt(args.concurrency || "4", 10);
const JUDGE_MODEL = args.model || "claude-opus-5";
const RUN_DIR = path.join(__dirname, "runs", RUN_ID);

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const RUBRIC = `Te magyar munkaerőpiaci és földrajzi szakértő vagy, aki egy fejvadász-kereső rendszer kimenetét auditálja. A mércéd SZIGORÚ: kétség esetén BUKTATSZ. Nem a jóindulatú olvasat a feladatod, hanem az, hogy egy tapasztalt magyar recruiter mit mondana erre a keresésre.

Négy kaput kell megítélned.

G1 — RUGALMASSÁG (search_elasticity)
A kérdés: erre a szerepre EBBEN a városban egy tapasztalt magyar recruiter tényleg ilyen szélesre nyitná-e a földrajzot?
A mérce a szerep valós utánpótlási mintázata, NEM a munkavégzés helyszíne:
 - "tight": bőséges helyi kínálat, helyettesíthető szerep, napi ingázási gyűrű a merítés.
 - "moderate": valóban szűkös helyi kínálat vagy szakértői szerep — tágabb, régiós merítés indokolt.
 - "loose": felsővezetői vagy ritka szakértői keresés, ahol a költözés a norma; országos/nemzetközi piac.
BUKIK, ha a választott érték egy recruiter szemében védhetetlen. Legyél tárgyilagos mindkét irányban: a túl szűk és a túl tág is hiba. Vedd figyelembe, hogy egy nagyvárosban bőséges kínálatú szerep egy kisebb városban valóban szűkös lehet — ha a modell EMIATT lépett feljebb, és ezt az indoklás alá is támasztja, az védhető. De ha egyszerű, bőséges kínálatú támogató szerepre nyit tágra pusztán óvatosságból, az bukik.

G2 — VONZÁSKÖRZET (catchment_places)
A kérdés: egy ilyen szerepre, ilyen fizetésen, EBBŐL a városból tényleg jöhet-e jelölt a felsorolt helyekről?
BUKIK, ha bármelyik igaz:
 - olyan helyet sorol fel, ahonnan erre a szerepre/fizetésre reálisan senki nem ingázna naponta (pl. belépő szintű, 450 ezres asszisztensi állásra 60+ km-es napi ingázás)
 - kitalált, nem létező vagy rossz országba sorolt helynév
 - az anchor (a megbízás helyszíne) hiányzik a listából
 - "loose" rugalmasságnál szűk ingázó-falugyűrűt sorol fel országos/nemzetközi vezetői piac helyett
 - "tight" rugalmasságnál távoli nagyvárosokat vagy külföldet sorol fel indok nélkül
 - kihagy egy OLYAN nyilvánvaló, nagy helyet, ami erre a szerepre valóban a legfontosabb merítés lenne (pl. Székesfehérvár esetén egy mérnöki szerepnél Budapest, vagy Győr esetén egy szakértői szerepnél a szlovák határ menti agglomeráció)
Magyar földrajzi valóságot használj: Győr–Mosonmagyaróvár–Csorna valós ingázási folyosó; Győrből Bratislava/Dunaszerdahely valóban közel van; Pécs elszigetelt, gyenge a vonzáskörzete (Szigetvár, Komló, Mohács, Szekszárd a reális kör); Székesfehérvár–Budapest ingázás létezik, de csak megfelelő fizetési szint fölött; Budapest agglomerációja (Érd, Budaörs, Vác, Gödöllő, Dunakeszi, Szigetszentmiklós) napi ingázó terület.

G4 — MEGTALÁLHATÓSÁG (a szűk kör nem túlspecifikált)
A kérdés: ez a szűk lekérdezés-halmaz hoz-e egyáltalán találatot egy valódi keresőn?
BUKIK, ha: a szűk lekérdezések annyi kötelező feltételt ÉSelnek egyetlen stringbe, hogy reálisan nulla vagy majdnem nulla találatot adnak (pl. 6+ szakmai szűrő, több minősítés és két nyelv egyszerre egy lekérdezésben); vagy ha a nyers találatszám 0-2 volt ÉS a lekérdezések láthatóan túlszűkítettek.
ÁTMEGY, ha a szűk kör valóban szűk, de reális — vagy ha kevés találatot hozott, de a tág kör érdemben tágabb és felfogta.

G5 — JELÖLTEK
A kérdés: a visszakapott jelöltek tényleg erre a SZEREPRE és erre a FÖLDRAJZRA illenek?
Jelöltenként döntsd el: (a) a szerep szempontjából releváns-e a headline/jelek alapján — nem a pontos titulus kell, hanem hogy hihetően ugyanabban a szakmai sávban van-e; (b) földrajzilag illeszkedik-e vagy legalább nem mond ellent.
BUKIK, ha 3-nál kevesebb olyan jelölt van, aki szerep szerint releváns ÉS földrajzilag nem mond ellent.
Fontos: az ismeretlen (null) helyszín önmagában nem földrajzi ellentmondás, de az egyértelműen más országban/más szakmában lévő jelölt igen. A drasztikusan más szakmai sáv (pl. villamosmérnök egy marketing asszisztens keresésben) NEM releváns.

TERJEDELEM: a "per_candidate" tömb LEGFELJEBB 8 elemet tartalmazzon — a döntés szempontjából legfontosabbakat. Az "on_target_count" viszont az ÖSSZES jelöltre vonatkozzon, ne csak a felsoroltakra.

Kimeneti JSON séma — kizárólag ez, magyarázó szöveg vagy komment nélkül:
{
 "g1_elasticity": { "pass": true|false, "defensible_value": "tight|moderate|loose", "reason": "<1-2 mondat>" },
 "g2_catchment": { "pass": true|false, "defects": ["<konkrét hiba>"], "reason": "<1-2 mondat>" },
 "g4_findability": { "pass": true|false, "reason": "<1-2 mondat>" },
 "g5_candidates": { "pass": true|false, "on_target_count": <szám>, "per_candidate": [{"name":"...","role_match":true|false,"geo_ok":true|false}], "reason": "<1-2 mondat>" },
 "primary_failure": "<a legsúlyosabb egyetlen hiba, vagy null ha nincs>",
 "fix_suggestion": "<mit kellene a rendszerprompton változtatni, 1 mondat — vagy null>"
}`;

async function judgeCell(rec) {
  const q = rec.query || {};
  const cands = (rec.discover?.candidates || []).slice(0, 24).map((c) => ({
    name: c.name,
    headline: c.headline,
    current_company: c.current_company,
    location: c.location,
    geo_fit: c.geo_fit,
    signals: (c.signals || []).slice(0, 2),
  }));

  const input = `MEGBÍZÁS
Szerep: ${rec.role}
Helyszín (anchor): ${rec.city}

BRIEF (rövidítve):
${(rec._brief || "").slice(0, 900)}

A RENDSZER FÖLDRAJZI HATÓKÖRE (geo_scope):
${JSON.stringify(q.geo_scope, null, 2)}

SZŰK LEKÉRDEZÉSEK:
${JSON.stringify(q.firecrawl_search_queries, null, 2)}

TÁG LEKÉRDEZÉSEK:
${JSON.stringify(q.firecrawl_search_queries_broad, null, 2)}

NYERS TALÁLATSZÁM a szűk körből: ${rec.metrics?.narrow_raw_hits}
Kibővítésre került-e: ${rec.metrics?.broadened ? "igen" : "nem"}

VISSZAKAPOTT JELÖLTEK (${cands.length} db):
${JSON.stringify(cands, null, 2)}`;

  const resp = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: RUBRIC }],
    messages: [{ role: "user", content: input + "\n\n---\nVálaszolj KIZÁRÓLAG a megadott JSON objektummal." }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseJson(text);
}

async function pool(items, n, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await worker(items[k]); }
  }));
  return out;
}

// ── betöltés ───────────────────────────────────────────────────────────
const { ROLES } = await import("./briefs.js");
const briefByKey = Object.fromEntries(ROLES.map((r) => [r.key, r.brief]));

const files = fs.readdirSync(RUN_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const records = files.map((f) => {
  const r = JSON.parse(fs.readFileSync(path.join(RUN_DIR, f), "utf8"));
  r._brief = briefByKey[r.role_key] || "";
  return r;
});
records.sort((a, b) => a.id.localeCompare(b.id));

console.log(`Értékelés: ${records.length} cella, bíró=${JUDGE_MODEL}, run=${RUN_ID}\n`);

const scored = await pool(records, CONCURRENCY, async (rec) => {
  if (rec.error) {
    return { id: rec.id, good: false, gates: { G1: false, G2: false, G3: false, G4: false, G5: false },
      primary_failure: "A cella futása hibára futott: " + rec.error.split("\n")[0], judge: null, rec };
  }
  let judge;
  for (let a = 1; a <= 3; a++) {
    try { judge = await judgeCell(rec); break; }
    catch (e) { if (a === 3) { console.error(`  ⚠️ BÍRÓ-HIBA ${rec.id}: ${e.message}`); return { id: rec.id, good: false, judge_error: true, gates: {}, primary_failure: "BÍRÓ-HIBA: " + e.message, judge: null, rec }; } }
  }
  const m = rec.metrics || {};
  const gates = {
    G1: !!judge.g1_elasticity?.pass,
    G2: !!judge.g2_catchment?.pass,
    G3: !!m.geo?.folded_into_narrow,
    G4: !!judge.g4_findability?.pass,
    G5: !!judge.g5_candidates?.pass,
  };
  const good = Object.values(gates).every(Boolean);
  return { id: rec.id, role: rec.role, city: rec.city, good, gates, judge,
    primary_failure: good ? null : judge.primary_failure, rec };
});

// ── riport ─────────────────────────────────────────────────────────────
const goodCount = scored.filter((s) => s.good).length;
console.log("cella".padEnd(40) + "G1 G2 G3 G4 G5   ítélet");
console.log("─".repeat(78));
for (const s of scored) {
  const g = (k) => (s.gates[k] ? "✅" : "❌");
  console.log(
    s.id.padEnd(40) + `${g("G1")} ${g("G2")} ${g("G3")} ${g("G4")} ${g("G5")}   ` +
    (s.good ? "JÓ" : "bukik — " + String(s.primary_failure || "").slice(0, 70))
  );
}
console.log("─".repeat(78));
console.log(`\n🎯 EREDMÉNY: ${goodCount} / ${scored.length} jó keresés  (cél: 14/16)\n`);

const gateFails = {};
for (const s of scored) for (const [k, v] of Object.entries(s.gates)) if (!v) gateFails[k] = (gateFails[k] || 0) + 1;
console.log("Kapuk bukásai:", JSON.stringify(gateFails));

const out = {
  run_id: RUN_ID, judged_at: new Date().toISOString(), judge_model: JUDGE_MODEL,
  good: goodCount, total: scored.length, gate_failures: gateFails,
  cells: scored.map((s) => ({
    id: s.id, role: s.role, city: s.city, good: s.good, gates: s.gates,
    primary_failure: s.primary_failure,
    g1: s.judge?.g1_elasticity,
    elasticity_vs_prior: { emitted: s.rec.metrics?.elasticity, my_prior: s.rec.expected_elasticity, matched_prior: !!s.rec.metrics?.elasticity_match },
    fix_suggestion: s.judge?.fix_suggestion || null,
    g2: s.judge?.g2_catchment, g4: s.judge?.g4_findability,
    g5: s.judge?.g5_candidates ? { pass: s.judge.g5_candidates.pass, on_target_count: s.judge.g5_candidates.on_target_count, reason: s.judge.g5_candidates.reason } : null,
    metrics: s.rec.metrics,
  })),
};
fs.writeFileSync(path.join(RUN_DIR, "_scores.json"), JSON.stringify(out, null, 2));
console.log(`\nRészletes pontozás: ${path.join(RUN_DIR, "_scores.json")}`);
