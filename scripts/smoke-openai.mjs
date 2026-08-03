// Éles füst-teszt az OpenAI-ágra. Egyetlen valódi hívás a TERMÉK láncán —
// nem szintetikus "hello", hanem az igazi queryBuild a magyar prompttal.
//
// Amit egyszerre bizonyít:
//   - a kulcs érvényes és van keret
//   - a max_completion_tokens paraméternév átmegy (vagy a fallback működik)
//   - a response_format: json_object elfogadott
//   - a persona + magyar prompt értelmes magyar JSON-t ad vissza
//   - a földrajzi logika (geo_scope) egyáltalán működik az új modellen
//
// SOHA nem ír ki kulcsot — a kimenet megosztható.
import { config, brainAvailable } from "../core/config.js";
import { queryBuild } from "../core/capabilities.js";

const line = (s = "") => console.log(s);
let failed = false;
function check(name, cond, detail) {
  line(`${cond ? "✅" : "❌"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!cond) failed = true;
}

line("── JEL · OpenAI füst-teszt ────────────────────────────────");
line(`szolgáltató : ${config.llmProvider}`);
line(`modell      : ${config.model}`);
line(`bíró-modell : ${config.judgeModel}`);
line(`kulcs       : ${config.openaiApiKey ? `megvan (…${config.openaiApiKey.slice(-4)}, ${config.openaiApiKey.length} karakter)` : "NINCS"}`);
line();

if (config.llmProvider !== "openai") {
  line(`❌ A szolgáltató nem "openai", hanem "${config.llmProvider}".`);
  line("   Ellenőrizd a .env-ben: LLM_PROVIDER=openai");
  process.exit(1);
}
if (!brainAvailable()) {
  line("❌ Nincs használható OPENAI_API_KEY — a rendszer demo-módban futna.");
  process.exit(1);
}

line("Éles hívás indul (queryBuild, gyártásmérnök / Győr)…\n");

const t0 = Date.now();
let out;
try {
  out = await queryBuild({
    brief:
      "Gyártásmérnököt keresünk a présüzem folyamatfejlesztésére. Elvárás: gépészmérnök diploma, " +
      "min. 5 év autóipari tapasztalat, IATF 16949 gyakorlat, tárgyalóképes angol.",
    position: {
      title: "Gyártásmérnök",
      client: "",
      location: "Győr",
      work_mode: "helyszíni",
      seniority: "senior",
    },
  });
} catch (e) {
  line(`❌ A hívás elhalt: ${String(e.message || e).slice(0, 500)}`);
  line();
  line("Gyakori okok:");
  line("  · érvénytelen kulcs (401)          → nézd meg platform.openai.com/api-keys");
  line("  · nincs feltöltve egyenleg (429)   → platform.openai.com/settings/organization/billing");
  line("  · ismeretlen modellnév (404)       → .env: OPENAI_MODEL=gpt-5.6-terra");
  process.exit(1);
}
const ms = Date.now() - t0;

line(`Válasz megérkezett ${(ms / 1000).toFixed(1)} mp alatt.\n`);

const geo = out.geo_scope;
const narrow = out.firecrawl_search_queries || [];
const broad = out.firecrawl_search_queries_broad || [];
const places = (geo?.catchment_places || []).map((p) => p.place);

check("érvényes JSON jött vissza", !!out && typeof out === "object");
check("geo_scope megvan", !!geo, geo ? `rugalmasság: ${geo.search_elasticity}` : "hiányzik");
check("az anchor (Győr) benne van a vonzáskörzetben",
  places.some((p) => String(p).toLowerCase().includes("győr") || String(p).toLowerCase().includes("gyor")),
  places.join(", ") || "üres lista");
check("szűk lekérdezések megvannak", narrow.length > 0, `${narrow.length} db`);
check("tág lekérdezések megvannak", broad.length > 0, `${broad.length} db`);
check("magyar nyelvű a kimenet",
  /[áéíóöőúüű]/i.test(JSON.stringify(out)), "ékezetes karakterek jelen vannak");

line();
line("── Amit a modell kitalált ─────────────────────────────────");
line(`rugalmasság : ${geo?.search_elasticity}`);
line(`vonzáskörzet: ${places.join(", ")}`);
const xb = (geo?.catchment_places || []).filter((p) => p.cross_border).map((p) => `${p.place} (${p.country})`);
line(`határon át  : ${xb.length ? xb.join(", ") : "— nincs —"}`);
line();
line("szűk lekérdezések:");
narrow.forEach((q) => line(`  · ${q}`));
line("tág lekérdezések:");
broad.forEach((q) => line(`  · ${q}`));
line("───────────────────────────────────────────────────────────");
line();
line(failed ? "❌ A füst-teszt HIBÁVAL zárult." : "✅ Az OpenAI-ág él és a magyar lánc működik.");
process.exit(failed ? 1 : 0);
