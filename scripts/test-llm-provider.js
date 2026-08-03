// Egységteszt: a szolgáltató- és modellválasztás (nincs élő API-hívás).
//
// Alprocesszekben fut, mert a config modul-betöltéskor dől el, és az ESM
// modul-cache miatt egy processzen belül nem lehet többféle env-et kipróbálni.
//
// Figyelem: a config.js saját .env-betöltője CSAK akkor tölt be egy kulcsot, ha
// az a process.env-ben undefined. Ezért a "nincs kulcs" esetet ÜRES STRINGGEL
// modellezzük — így a repo .env-je nem szivárog be a tesztbe. (Ez a csapda
// egy korábbi körben már megtréfált minket.)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function ok(name, cond, got) {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : `  → kapott: ${JSON.stringify(got)}`}`);
  if (!cond) process.exitCode = 1;
}

function resolve(env) {
  const out = execFileSync(
    process.execPath,
    ["-e", "import('./core/config.js').then(m=>console.log(JSON.stringify({p:m.config.llmProvider,model:m.config.model,judge:m.config.judgeModel,brain:m.brainAvailable()})))"],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        // minden releváns változó explicit — semmi ne szivárogjon a shellből
        LLM_PROVIDER: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "",
        LLM_MODEL: "", OPENAI_MODEL: "", CLAUDE_MODEL: "", JUDGE_MODEL: "",
        ...env,
      },
    }
  );
  return JSON.parse(out.trim().split("\n").pop());
}

// ── Automatikus felismerés: az számít, amelyikhez van kulcs ────────────
let r = resolve({ OPENAI_API_KEY: "sk-teszt" });
ok("csak OpenAI-kulcs → openai", r.p === "openai", r);
ok("csak OpenAI-kulcs → gpt-5.6-terra az alapmodell", r.model === "gpt-5.6-terra", r);
ok("csak OpenAI-kulcs → brain elérhető", r.brain === true, r);

r = resolve({ ANTHROPIC_API_KEY: "sk-ant-teszt" });
ok("csak Anthropic-kulcs → anthropic", r.p === "anthropic", r);
ok("csak Anthropic-kulcs → claude-sonnet-5 az alapmodell", r.model === "claude-sonnet-5", r);

r = resolve({ OPENAI_API_KEY: "sk-teszt", ANTHROPIC_API_KEY: "sk-ant-teszt" });
ok("mindkét kulcs → OpenAI az elsőbbség", r.p === "openai", r);

// ── Explicit kapcsoló felülír mindent ─────────────────────────────────
r = resolve({ LLM_PROVIDER: "anthropic", OPENAI_API_KEY: "sk-teszt", ANTHROPIC_API_KEY: "sk-ant-teszt" });
ok("LLM_PROVIDER=anthropic felülírja az automatikát", r.p === "anthropic", r);
ok("visszaváltáskor a Claude-modell jön vissza", r.model === "claude-sonnet-5", r);

r = resolve({ LLM_PROVIDER: "openai", ANTHROPIC_API_KEY: "sk-ant-teszt" });
ok("LLM_PROVIDER=openai kulcs nélkül → brain NEM elérhető (nem hazudik élő módot)",
  r.p === "openai" && r.brain === false, r);

// ── Modell-felülírás ──────────────────────────────────────────────────
r = resolve({ OPENAI_API_KEY: "sk-teszt", OPENAI_MODEL: "gpt-5.6-luna" });
ok("OPENAI_MODEL felülírja az alapmodellt", r.model === "gpt-5.6-luna", r);

r = resolve({ OPENAI_API_KEY: "sk-teszt", OPENAI_MODEL: "gpt-5.6-luna", LLM_MODEL: "gpt-5.6-sol" });
ok("LLM_MODEL mindent felülír", r.model === "gpt-5.6-sol", r);

// ── Bíró-modell ───────────────────────────────────────────────────────
r = resolve({ OPENAI_API_KEY: "sk-teszt" });
ok("bíró alapból az erősebb modell (openai → sol)", r.judge === "gpt-5.6-sol", r);
r = resolve({ ANTHROPIC_API_KEY: "sk-ant-teszt" });
ok("bíró alapból az erősebb modell (anthropic → opus)", r.judge === "claude-opus-5", r);
r = resolve({ OPENAI_API_KEY: "sk-teszt", JUDGE_MODEL: "gpt-5.6-terra" });
ok("JUDGE_MODEL felülírható", r.judge === "gpt-5.6-terra", r);

// ── Ismeretlen érték ne törje el a rendszert ──────────────────────────
r = resolve({ LLM_PROVIDER: "gemini", OPENAI_API_KEY: "sk-teszt" });
ok("ismeretlen LLM_PROVIDER → visszaesik az automatikára, nem dob", r.p === "openai", r);

console.log("\nSzolgáltató-választás teszt kész.");
