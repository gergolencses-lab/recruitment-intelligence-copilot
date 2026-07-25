// Guardrail-réteg: evidencia-földelés + elszámoltathatóság + PII-minimalizálás.
// A "no reject" doktrína MEGSZŰNT — a rendszer őszintén mondhatja, hogy valaki nem fit.
// A tét most az ELLENKEZŐJE: a rendszer nem állíthat KITALÁLT tényt a jelöltről.

/**
 * Elszámoltathatóság: a rank NEM ejthet el csendben jelöltet — mindenkinek meg
 * kell jelennie a kimeneti rangsorban (akár "nem éri meg / kizárva" verdikttel is).
 * Ez nem "no reject" — ez anti-néma-bukás: a modell számoljon el minden jelölttel.
 */
export function assertRankingComplete(candidateIds, ranked) {
  const rankedIds = new Set((ranked || []).map((r) => r.candidate_id));
  const missing = candidateIds.filter((id) => !rankedIds.has(id));
  if (missing.length) {
    throw new Error(
      `GUARDRAIL[accountability]: a rangsorból hiányzik ${missing.length} jelölt — mindenkit el kell számolni (akár elutasítva), nem eshetnek ki némán: ${missing.join(", ")}`
    );
  }
  return ranked;
}

// ── Evidencia-földelés ───────────────────────────────────────────────
// Az attract "known_facts" mezőjéből kiszűri azokat az állításokat, amelyek NEM
// vezethetők vissza a jelölt egyetlen jelére sem. Így a stratégia nem állíthat
// kitalált tényt a személyről. (Második védővonal a prompt mögött.)
function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

/**
 * @param {Array} knownFacts - [{ fact, from_signal }]
 * @param {Array} signals - a jelölt tényleges jelei ([{signal}] vagy [string])
 * @returns {{ kept: Array, stripped: Array, stripped_count: number }}
 */
export function assertGrounded(knownFacts, signals) {
  const facts = Array.isArray(knownFacts) ? knownFacts : [];
  const sigTokens = (signals || [])
    .map((s) => (typeof s === "string" ? s : s && s.signal) || "")
    .map(tokens);
  const kept = [], stripped = [];
  for (const f of facts) {
    const ref = (f && (f.from_signal || f.fact)) || "";
    const ft = tokens(ref);
    // Földelt, ha van jel, aminek legalább 1 érdemi tokene egyezik a hivatkozással.
    const grounded = ft.length > 0 && sigTokens.some((st) => st.some((w) => ft.includes(w)));
    (grounded ? kept : stripped).push(f);
  }
  return { kept, stripped, stripped_count: stripped.length };
}

/**
 * Attract-kimenet földelése: a known_facts-ból kiszedi a nem-visszavezethető
 * állításokat, és jelöli, hányat dobott. A guard-láncból hívjuk, a jelölttel.
 */
export function groundAttraction(output, candidate) {
  const gr = output && output.grounded_read;
  if (gr && Array.isArray(gr.known_facts)) {
    const g = assertGrounded(gr.known_facts, candidate && candidate.signals);
    gr.known_facts = g.kept;
    if (g.stripped_count) gr._stripped_ungrounded = g.stripped_count;
  }
  return output;
}

// ── Special-category (GDPR) minimalizálás ────────────────────────────
const SENSITIVE_HINTS = [
  "egészségi", "egeszsegi", "betegség", "vallás", "vallasi", "etnik", "szexuál", "szexual",
  "terhes", "fogyaték", "fogyatek", "politikai párt", "szakszervezet",
];

export function stripSensitive(text) {
  if (typeof text !== "string") return text;
  const low = text.toLowerCase();
  if (SENSITIVE_HINTS.some((h) => low.includes(h))) {
    return "[eltávolítva: potenciálisan special-category adat — PII-minimalizálás]";
  }
  return text;
}

// ── Stratégia-asszisztens: a műveletek sémára szorítása ─────────────────
// Az LLM kimenete közvetlenül a keresési tervet és a térképet módosítja, ezért
// itt vágjuk le az érvénytelen célt/mezőt: ismeretlen mező csendben elrontaná
// az állapotot. Ami nem fér a sémába, azt eldobjuk, és jelezzük a kimenetben.
const STRATEGY_FIELDS = {
  query: ["target_titles", "target_companies", "synonyms", "boolean_queries", "firecrawl_search_queries"],
  map: ["target_companies", "competitor_clusters", "where_they_gather"],
  exclusions: ["companies"],
};

function validStrategyAction(a) {
  if (!a || (a.op !== "add" && a.op !== "remove")) return false;
  const fields = STRATEGY_FIELDS[a.target];
  if (!fields || !fields.includes(a.field)) return false;
  const v = a.value && typeof a.value === "object" ? a.value.name || a.value.query : a.value;
  return typeof v === "string" && v.trim().length > 0;
}

function normStrategyAction(a) {
  const v = a.value && typeof a.value === "object" ? a.value : String(a.value).trim();
  const label = String(a.label || (typeof v === "object" ? v.name || v.query : v)).trim();
  return { op: a.op, target: a.target, field: a.field, value: v, label };
}

export function guardStrategyChat(out) {
  const o = out || {};
  const rawA = Array.isArray(o.actions) ? o.actions : [];
  const rawP = Array.isArray(o.proposals) ? o.proposals : [];
  const actions = rawA.filter(validStrategyAction).map(normStrategyAction);
  const proposals = rawP.filter(validStrategyAction).map(normStrategyAction);
  const dropped = rawA.length - actions.length + (rawP.length - proposals.length);
  return {
    ...o,
    reply: String(o.reply || "").trim() || "Nem sikerült értelmezni a kérést — nevezd meg, melyik listát módosítsam.",
    actions,
    proposals,
    ...(dropped ? { _dropped_invalid: dropped } : {}),
  };
}
