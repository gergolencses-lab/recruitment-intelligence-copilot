// Surface A — Web App. Express szerver: statikus UI + Capability API.
// Minden route a KÖZÖS magot hívja (core/index.js), és a projekt-store-ba perzisztál.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ric from "../core/index.js";
import { loadProject, saveProject, upsertProject } from "../core/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// segéd: projekt betöltése vagy 404
function getProj(res, id) {
  const p = loadProject(id);
  if (!p) {
    res.status(404).json({ error: `Nincs ilyen projekt: ${id}` });
    return null;
  }
  return p;
}

// async route wrapper
const A = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  });

app.get("/api/status", (req, res) => {
  res.json({
    brain: ric.brainAvailable(),
    reach_live: ric.reachLiveAvailable(),
    model: ric.config.model,
    knowledge_version: ric.KNOWLEDGE_VERSION,
    mode: ric.brainAvailable() ? "live" : "demo",
  });
});

app.get("/api/projects", (req, res) => res.json(ric.listProjects()));

app.post("/api/project", A((req, res) => {
  const { id, name } = req.body || {};
  if (!id) return res.status(400).json({ error: "id kötelező" });
  res.json(upsertProject(id, name));
}));

app.get("/api/project/:id", (req, res) => {
  const p = getProj(res, req.params.id);
  if (p) res.json(p);
});

// 1) Intake
app.post("/api/project/:id/intake", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const brief = (req.body && req.body.brief) || "";
  p.brief_raw = brief;
  p.intake = await ric.intakeReframe({ brief }, { projectId: p.id });
  saveProject(p);
  res.json(p.intake);
}));

// 2) Query build
app.post("/api/project/:id/query", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  p.query = await ric.queryBuild({ intake: p.intake, brief: p.brief_raw }, { projectId: p.id });
  saveProject(p);
  res.json(p.query);
}));

// 3) Discover (Reach Engine)
app.post("/api/project/:id/discover", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const source = (req.body && req.body.source) || undefined;
  const sq = (p.query && p.query.firecrawl_search_queries) || [];
  const result = await ric.discoverCandidates({ searchQueries: sq, source }, { projectId: p.id });
  p.candidates = result.candidates;
  p.discover_note = result.note;
  p.discover_source = result.source;
  saveProject(p);
  res.json(result);
}));

// 3b) Talent map
app.post("/api/project/:id/talent-map", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  p.talent_map = await ric.talentMap({ intake: p.intake, brief: p.brief_raw }, { projectId: p.id });
  saveProject(p);
  res.json(p.talent_map);
}));

// 4) Assess one candidate
app.post("/api/project/:id/assess", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const cand = (p.candidates || []).find((c) => c.id === req.body.candidateId);
  if (!cand) return res.status(404).json({ error: "Nincs ilyen jelölt" });
  const out = await ric.profileAssess({ candidate: cand, intake: p.intake }, { projectId: p.id });
  p.assessments[cand.id] = out;
  saveProject(p);
  res.json(out);
}));

// 5) Rank all
app.post("/api/project/:id/rank", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  p.ranking = await ric.rankTargets({ candidates: p.candidates, intake: p.intake }, { projectId: p.id });
  saveProject(p);
  res.json(p.ranking);
}));

// 6) Attraction strategy (hero)
app.post("/api/project/:id/attract", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const cand = (p.candidates || []).find((c) => c.id === req.body.candidateId);
  if (!cand) return res.status(404).json({ error: "Nincs ilyen jelölt" });
  const out = await ric.attractionStrategy(
    { candidate: cand, assessment: p.assessments[cand.id], intake: p.intake },
    { projectId: p.id }
  );
  p.attraction[cand.id] = out;
  saveProject(p);
  res.json(out);
}));

// 7) Outreach draft
app.post("/api/project/:id/outreach", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const cand = (p.candidates || []).find((c) => c.id === req.body.candidateId);
  if (!cand) return res.status(404).json({ error: "Nincs ilyen jelölt" });
  const out = await ric.outreachDraft(
    { candidate: cand, attraction: p.attraction[cand.id], language: req.body.language },
    { projectId: p.id }
  );
  p.outreach[cand.id] = out;
  saveProject(p);
  res.json(out);
}));

// 8) Advisory / Interview / Coach
app.post("/api/project/:id/advisory", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  p.advisory = await ric.clientAdvisory({ intake: p.intake, brief: p.brief_raw }, { projectId: p.id });
  saveProject(p);
  res.json(p.advisory);
}));

app.post("/api/project/:id/interview", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  p.interview = await ric.interviewIntel({ intake: p.intake, brief: p.brief_raw }, { projectId: p.id });
  saveProject(p);
  res.json(p.interview);
}));

app.post("/api/project/:id/coach", A(async (req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const out = await ric.recruitmentCoach({ context: (req.body && req.body.context) || p.brief_raw }, { projectId: p.id });
  p.coach_notes.push({ ts: new Date().toISOString(), ...out });
  saveProject(p);
  res.json(out);
}));

// Art. 14 értesítő
app.post("/api/project/:id/art14", A((req, res) => {
  const p = getProj(res, req.params.id);
  if (!p) return;
  const cand = (p.candidates || []).find((c) => c.id === req.body.candidateId);
  if (!cand) return res.status(404).json({ error: "Nincs ilyen jelölt" });
  res.json(ric.art14Notice({ candidate: cand, controller: req.body.controller }, { projectId: p.id }));
}));

// Memory
app.post("/api/project/:id/memory", A((req, res) => {
  const entry = ric.memorySave({
    projectId: req.params.id,
    projectName: (req.body && req.body.projectName) || undefined,
    note: (req.body && req.body.note) || "",
    kind: (req.body && req.body.kind) || "note",
  });
  res.json(entry);
}));

app.get("/api/project/:id/memory", (req, res) => res.json(ric.memoryRecall({ projectId: req.params.id })));

app.listen(ric.config.port, () => {
  const mode = ric.brainAvailable() ? "🟢 ÉLES (Claude)" : "🟡 DEMO (nincs kulcs)";
  const reach = ric.reachLiveAvailable() ? "🟢 Firecrawl él" : "🟡 szintetikus pool";
  console.log(`\n  Recruitment Intelligence Copilot`);
  console.log(`  → http://localhost:${ric.config.port}`);
  console.log(`  Agy: ${mode}  |  Elérés: ${reach}  |  modell: ${ric.config.model}\n`);
});
