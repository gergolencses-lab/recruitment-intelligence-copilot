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
