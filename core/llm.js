// Claude API wrapper — strukturált JSON kimenettel, prompt-cache-elt personával.
import Anthropic from "@anthropic-ai/sdk";
import { config, brainAvailable } from "./config.js";
import { personaBlock } from "./knowledge/persona.js";

let _client = null;
function client() {
  if (!config.anthropicApiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey: config.anthropicApiKey });
  return _client;
}

export { brainAvailable };

/**
 * Egy capability LLM-hívása. A persona (Knowledge Core) cache-elve.
 * @param {object} p
 * @param {string} p.task  - a konkrét feladat-instrukció (mit adjon vissza, milyen JSON-sémában)
 * @param {string} p.input - a konkrét bemenet (brief, jelölt, stb.)
 * @param {number} [p.maxTokens]
 * @param {number} [p.temperature]
 */
export async function think({ task, input, maxTokens = 6000, temperature = 0.4 }) {
  const c = client();
  if (!c) {
    const e = new Error("NO_BRAIN: nincs ANTHROPIC_API_KEY — demo-mód aktív.");
    e.code = "NO_BRAIN";
    throw e;
  }
  const system = [
    personaBlock(),
    { type: "text", text: task },
  ];
  const user =
    input +
    "\n\n---\nVálaszolj KIZÁRÓLAG egyetlen érvényes JSON objektummal, magyarázó szöveg, markdown vagy code-fence nélkül. Magyar mezőértékek, ahol szöveges tartalom. Ha egy mező nem tölthető ki evidenciával, adj üres tömböt vagy null-t, ne találj ki tényt.";

  // temperature szándékosan nincs: az újabb modellek (claude-sonnet-5+) már nem fogadják.
  const resp = await c.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseJson(text);
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
