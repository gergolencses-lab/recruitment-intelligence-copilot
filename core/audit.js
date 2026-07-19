// Audit-nyomvonal: minden capability-hívás naplózva (AI Act / GDPR elszámoltathatóság).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config, KNOWLEDGE_VERSION } from "./config.js";

const AUDIT_PATH = path.join(config.dataDir, "audit.log.jsonl");

function hash(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

export function audit({ capability, projectId, input, mode }) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const rec = {
      ts: new Date().toISOString(),
      capability,
      project_id: projectId || null,
      input_hash: hash(input ?? {}),
      knowledge_version: KNOWLEDGE_VERSION,
      model: config.model,
      mode, // "live" | "demo"
      human_reviewed: false, // az ember override-olja a UI-ban
    };
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(rec) + "\n", "utf8");
    return rec;
  } catch {
    return null;
  }
}
