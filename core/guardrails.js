// Guardrail-réteg: a "no reject, only attract" strukturális garanciája + PII-minimalizálás.
// A promptok is tiltják az elutasítást; ez a második védővonal, ami kódban is kikényszeríti.

const REJECT_WORDS = [
  "elutasít", "elutasitas", "elutasítás", "reject", "disqualif", "kiszűr", "kiszur",
  "kizár", "kizar", "nem alkalmas", "alkalmatlan", "screen out", "screen-out", "screened out",
];

// Mezőnevek, amikben tilos "reject" jellegű verdiktnek megjelennie.
const VERDICT_FIELDS = ["verdict", "decision", "recommendation", "dontes", "döntés", "ajanlas", "ajánlás"];

/**
 * Strukturális no-reject ellenőrzés. Ha egy verdikt-mező elutasítást tartalmaz,
 * hibát dobunk — a rendszer sosem szállíthat ki hátrányos döntést.
 */
export function assertNoReject(output, ctx = "") {
  const walk = (node, keyPath) => {
    if (node == null) return;
    if (typeof node === "string") {
      const key = keyPath[keyPath.length - 1] || "";
      const isVerdictField = VERDICT_FIELDS.some((f) => key.toLowerCase().includes(f));
      if (isVerdictField) {
        const low = node.toLowerCase();
        if (REJECT_WORDS.some((w) => low.includes(w))) {
          throw new Error(
            `GUARDRAIL[no-reject]: elutasítás-jellegű verdikt tiltott (${ctx} @ ${keyPath.join(".")}): "${node}"`
          );
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, [...keyPath, String(i)]));
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, [...keyPath, k]);
    }
  };
  walk(output, []);
  return output;
}

/**
 * Rangsor-garancia: a rankTargets SOHA nem dobhat el jelöltet.
 * Minden bemeneti jelöltnek szerepelnie kell a kimeneti rangsorban.
 */
export function assertRankingComplete(candidateIds, ranked) {
  const rankedIds = new Set((ranked || []).map((r) => r.candidate_id));
  const missing = candidateIds.filter((id) => !rankedIds.has(id));
  if (missing.length) {
    throw new Error(
      `GUARDRAIL[no-reject]: a rangsorból hiányzik ${missing.length} jelölt — üldözési prioritást KELL kapniuk, nem eshetnek ki: ${missing.join(", ")}`
    );
  }
  return ranked;
}

// Special-category jelzők — ha bármelyik felbukkanna, kiszűrjük a tárolásból/kimenetből.
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
