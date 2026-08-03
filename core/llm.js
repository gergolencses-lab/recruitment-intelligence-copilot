// LLM wrapper — strukturált JSON kimenettel, cache-elt personával.
//
// KÉT SZOLGÁLTATÓ, EGY FELÜLET. A think() szignatúrája szolgáltató-független:
// a capabilities.js és a normalize.js nem tudja, melyik modell dolgozik mögötte.
// A váltás egyetlen env-sor (LLM_PROVIDER=openai|anthropic), így egy rosszabb
// eredmény kódvisszaállítás nélkül visszafordítható.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config, brainAvailable } from "./config.js";
import { PERSONA, personaBlock } from "./knowledge/persona.js";

let _anthropic = null;
let _openai = null;

function anthropicClient() {
  if (!config.anthropicApiKey) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  return _anthropic;
}

function openaiClient() {
  if (!config.openaiApiKey) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: config.openaiApiKey });
  return _openai;
}

export { brainAvailable };

// A kimeneti szerződés mindkét szolgáltatónál szó szerint azonos, hogy a
// magyar promptok változtatás nélkül átvihetők legyenek — különben a
// szolgáltató-összehasonlítás nem a modellt mérné, hanem a prompt-eltérést.
const OUTPUT_CONTRACT =
  "\n\n---\nVálaszolj KIZÁRÓLAG egyetlen érvényes JSON objektummal, magyarázó szöveg, markdown vagy code-fence nélkül. Magyar mezőértékek, ahol szöveges tartalom. Ha egy mező nem tölthető ki evidenciával, adj üres tömböt vagy null-t, ne találj ki tényt." +
  "\nFogalmazz TÖMÖREN, töltelék nélkül: minden szöveges mező legyen lényegre törő (jellemzően 1–2 mondat), a listák max 3–4 magas jelértékű elem. A tömörség jel-sűrítés, nem tartalomvesztés — a hosszú, magyarázkodó kimenet hiba.";

/**
 * Egy capability LLM-hívása. A persona (Knowledge Core) cache-elve.
 * @param {object} p
 * @param {string} p.task  - a konkrét feladat-instrukció (mit adjon vissza, milyen JSON-sémában)
 * @param {string} p.input - a konkrét bemenet (brief, jelölt, stb.)
 * @param {number} [p.maxTokens]
 * @param {number} [p.temperature] - megtartva a hívói kompatibilitásért; egyik
 *   szolgáltatónál sem küldjük ki, mert a reasoning-modellek nem fogadják.
 * @param {string} [p.model] - felülírja a konfigurált modellt (pl. értékeléshez)
 * @param {string} [p.effort] - felülírja a gondolkodási szintet erre a hívásra.
 *   Mechanikus kinyeréshez (normalize) fölösleges a mély gondolkodás: lassú és drága.
 */
export async function think({ task, input, maxTokens = 6000, temperature, model, effort }) {
  if (!brainAvailable()) {
    const e = new Error(
      `NO_BRAIN: nincs ${config.llmProvider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} — demo-mód aktív.`
    );
    e.code = "NO_BRAIN";
    throw e;
  }
  const user = input + OUTPUT_CONTRACT;
  const text =
    config.llmProvider === "openai"
      ? await callOpenAI({ task, user, maxTokens, model, effort })
      : await callAnthropic({ task, user, maxTokens, model });
  return parseJson(text);
}

async function callAnthropic({ task, user, maxTokens, model }) {
  const c = anthropicClient();
  // temperature szándékosan nincs: az újabb modellek (claude-sonnet-5+) már nem fogadják.
  const resp = await c.messages.create({
    model: model || config.model,
    max_tokens: maxTokens,
    system: [personaBlock(), { type: "text", text: task }],
    messages: [{ role: "user", content: user }],
  });
  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Az OpenAI reasoning-modelleknél a max_completion_tokens a GONDOLKODÁSI
// tokeneket is beleszámolja, nem csak a látható kimenetet. A hívó maxTokens
// értéke a kimenet kerete; a gondolkodásnak ezen FELÜL kell hely. Enélkül
// "high" szinten a gondolkodás felemészti a keretet, és a JSON csonka lesz
// (mérve: high és xhigh is elhasalt 6000-rel).
const REASONING_HEADROOM = {
  none: 0,
  low: 4000,
  medium: 8000,
  high: 20000,
  xhigh: 40000,
  max: 80000,
};

async function callOpenAI({ task, user, maxTokens, model, effort: effortOverride }) {
  const c = openaiClient();
  const effort = effortOverride || config.openaiReasoningEffort;
  const budget = maxTokens + (REASONING_HEADROOM[effort] ?? 8000);
  // A persona külön, ELSŐ system-üzenet: az OpenAI automatikus prefix-cache-e
  // így ismeri fel az állandó előtagot (a Knowledge Core minden hívásban azonos),
  // és a bemenet 10%-os áron számlázódik. Ezért nem fűzzük a task-hoz.
  const req = {
    model: model || config.model,
    messages: [
      { role: "system", content: PERSONA },
      { role: "system", content: task },
      { role: "user", content: user },
    ],
    // Szolgáltatói garancia érvényes JSON-ra. Ez pont az a hibaosztály, ami a
    // korábbi éles futásokban a rankTargets-et elvitte (malformed JSON, retry nélkül).
    response_format: { type: "json_object" },
    max_completion_tokens: budget,
    reasoning_effort: effort,
  };

  let resp;
  try {
    resp = await c.chat.completions.create(req);
  } catch (e) {
    // A reasoning-modellek a max_completion_tokens nevet várják, a régebbiek a
    // max_tokens-t. Ha a szolgáltató épp a paraméternevet kifogásolja, váltunk egyet.
    const msg = String((e && e.message) || "");
    if (/reasoning_effort/i.test(msg)) {
      const { reasoning_effort, ...rest } = req;
      resp = await c.chat.completions.create(rest);
    } else if (/max_completion_tokens|max_tokens|Unsupported parameter|unknown_parameter/i.test(msg)) {
      const { max_completion_tokens, ...rest } = req;
      resp = await c.chat.completions.create({ ...rest, max_tokens: max_completion_tokens });
    } else {
      throw e;
    }
  }

  const choice = resp.choices && resp.choices[0];
  // Csonka JSON-t ne adjunk tovább némán a parsernek: mondjuk ki, mi történt.
  if (choice && choice.finish_reason === "length") {
    throw new Error(
      `Az LLM-válasz elérte a token-korlátot (${budget}: ${maxTokens} kimenet + ` +
      `${budget - maxTokens} gondolkodási tartalék, effort=${effort}) — a JSON csonka. ` +
      `Emeld a REASONING_HEADROOM értékét, vagy vidd lejjebb a gondolkodási szintet.`
    );
  }
  return (choice && choice.message && choice.message.content) || "";
}

// Robusztus JSON-parse: code-fence-t leszed, az első { és utolsó } közti részt próbálja.
export function parseJson(text) {
  if (!text) throw new Error("Üres LLM-válasz.");
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {}
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const slice = t.slice(first, last + 1);
    return JSON.parse(slice);
  }
  throw new Error("Nem sikerült JSON-t kinyerni az LLM-válaszból: " + t.slice(0, 200));
}
