// A közös mag publikus felülete. Az App ÉS az MCP kizárólag innen importál.
export * from "./capabilities.js";
export { art14Notice } from "./art14.js";
export { config, brainAvailable, reachLiveAvailable, KNOWLEDGE_VERSION } from "./config.js";
export {
  loadProject, saveProject, upsertProject, listProjects, emptyProject,
} from "./store.js";

// ── Project Memory (kliens-silózott) — save/recall, nem LLM ──
import { loadProject, saveProject, upsertProject } from "./store.js";
import { audit } from "./audit.js";

export function memorySave({ projectId, projectName, note, kind }) {
  const proj = upsertProject(projectId, projectName);
  const entry = { ts: new Date().toISOString(), kind: kind || "note", note };
  proj.memory.push(entry);
  saveProject(proj);
  audit({ capability: "memorySave", projectId, input: { kind, len: (note || "").length }, mode: "store" });
  return entry;
}

export function memoryRecall({ projectId }) {
  const proj = loadProject(projectId);
  if (!proj) return { project: null, memory: [] };
  return {
    project: { id: proj.id, name: proj.name, updated_at: proj.updated_at },
    intake: proj.intake,
    candidates: (proj.candidates || []).length,
    memory: proj.memory || [],
    interactions: proj.interactions || [],
  };
}
