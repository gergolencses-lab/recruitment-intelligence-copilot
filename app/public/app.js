// Recruitment Intelligence Copilot — frontend (vanilla JS, nulla build).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = { projectId: null, project: null, status: null };

// ── Kliens-oldali projekt-tár (localStorage) ────────────────────────────
// A szerver STATELESS (Vercel-kompatibilis): nincs szerveroldali lemez, a
// projekt-állapot a böngészőben él, és minden művelethez elküldjük a body-ban.
const LS_KEY = "ric.projects.v1";
function lsAll() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function lsSave(p) {
  if (!p || !p.id) return p;
  const all = lsAll();
  p.updated_at = new Date().toISOString();
  all[p.id] = p;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (e) { toast("A böngésző tárhelye megtelt — törölj régi projektet."); }
  return p;
}
function lsGet(id) { return lsAll()[id] || null; }
function lsList() {
  return Object.values(lsAll())
    .map((p) => ({ id: p.id, name: p.name, updated_at: p.updated_at, candidates: (p.candidates || []).length, has_brief: !!p.intake }))
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
}
function persist() { if (state.project) lsSave(state.project); }
function emptyProjectJS(id, name) {
  return {
    id, name: name || id,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    brief_raw: "", intake: null, query: null, candidates: [], talent_map: null,
    assessments: {}, ranking: null, attraction: {}, outreach: {}, outreach_status: {},
    baseline_response_rate: null, first_shortlist_at: null,
    pilot: { cooling_days: 7, mono_source_threshold: 0.7 },
    advisory: null, interview: null, coach_notes: [], memory: [], interactions: [],
  };
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
}
async function api(method, path, body) {
  // Projekt-műveletekhez a stateless szerver a kliens állapotából dolgozik:
  // elküldjük a teljes projektet a body-ban.
  if (method === "POST" && /^\/api\/project\/[^/]/.test(path) && state.project) {
    body = { ...(body || {}), project: state.project };
  }
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
async function withLoading(btn, fn) {
  if (!btn) return fn();
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    return await fn();
  } catch (e) {
    toast("Hiba: " + e.message);
    throw e;
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}
function demoTag(o) {
  return o && (o._demo || o._mode === "demo") ? '<span class="demo-tag">DEMO</span>' : "";
}
function needProject() {
  if (!state.projectId) {
    toast("Előbb válassz vagy hozz létre projektet.");
    return false;
  }
  return true;
}

// ── STATUS ──────────────────────────────────────────────
async function loadStatus() {
  const s = await api("GET", "/api/status");
  state.status = s;
  const b = $("#badges");
  b.innerHTML =
    (s.brain ? `<span class="badge badge-live">🟢 Agy: éles</span>` : `<span class="badge badge-demo">🟡 Agy: demo</span>`) +
    (s.reach_live ? `<span class="badge badge-live">🟢 Firecrawl</span>` : `<span class="badge badge-demo">🟡 szintetikus</span>`);
  $("#modelLine").textContent = `modell: ${s.model} · ${s.knowledge_version}`;
  const mt = $("#modelLineTop"); if (mt) mt.textContent = `${s.mode === "live" ? "éles" : "demo"} · ${s.model}`;
  const sel = $("#sourceSel");
  if (!s.reach_live) sel.value = "synthetic";
}

// ── PROJECTS ────────────────────────────────────────────
async function loadProjects() {
  const list = lsList();
  const sel = $("#projectSelect");
  sel.innerHTML = `<option value="">— válassz projektet —</option>` +
    list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${p.candidates} jelölt)</option>`).join("");
  if (state.projectId) sel.value = state.projectId;
}
async function selectProject(id) {
  state.projectId = id || null;
  if (!id) {
    state.project = null;
    $("#projTitle").textContent = "Válassz vagy hozz létre projektet";
    $("#crumbs").textContent = "Nincs projekt kiválasztva";
    clearAllOutputs();
    renderOverview(null);
    return;
  }
  const p = lsGet(id);
  if (!p) { toast("A projekt nem található ebben a böngészőben."); state.projectId = null; renderOverview(null); return; }
  state.project = p;
  $("#projTitle").textContent = p.name;
  $("#crumbs").textContent = `Projekt · ${p.id}`;
  renderProject(p);
}
function clearAllOutputs() {
  ["#intakeOut", "#queryOut", "#discoverNote", "#talentOut", "#rankOut", "#attractOut", "#outreachOut", "#advisoryOut", "#interviewOut", "#coachOut"].forEach((s) => ($(s).innerHTML = ""));
  $("#candidateGrid").innerHTML = "";
  $("#briefInput").value = "";
  $("#attractCand").innerHTML = "";
}
function renderProject(p) {
  clearAllOutputs();
  $("#briefInput").value = p.brief_raw || "";
  if (p.intake) renderIntake(p.intake);
  if (p.query) renderQuery(p.query);
  if (p.candidates && p.candidates.length) renderCandidates(p.candidates, p);
  if (p.discover_note) $("#discoverNote").innerHTML = `<div class="note">${esc(p.discover_note)}</div>`;
  if (p.talent_map) renderTalent(p.talent_map);
  if (p.ranking) renderRank(p.ranking);
  if (p.advisory) renderAdvisory(p.advisory);
  if (p.interview) renderInterview(p.interview);
  if (p.coach_notes && p.coach_notes.length) renderCoach(p.coach_notes[p.coach_notes.length - 1]);
  renderOverview(p);
}

// ── OVERVIEW / REPORTS DASHBOARD ────────────────────────
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function clamp5(x) { return Math.max(0, Math.min(5, x)); }
function tierLetter(t) { const s = String(t || ""); return s.startsWith("A") ? "A" : s.startsWith("B") ? "B" : s.startsWith("C") ? "C" : "C"; }
function srcLabel(s) {
  return { linkedin: "LinkedIn", github: "GitHub", synthetic: "Szintetikus", web: "Web", blog: "Blog", community: "Közösség", xing: "Xing", stackoverflow: "StackOverflow", social: "Social", "egyéb": "Egyéb" }[s] || (s || "Egyéb");
}
function niceCeil(n) { const steps = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000]; for (const s of steps) if (n <= s) return s; return Math.ceil(n / 1000) * 1000; }
const PALETTE = ["oklch(0.55 0.18 264)", "oklch(0.58 0.15 235)", "oklch(0.6 0.14 205)", "oklch(0.62 0.13 175)", "oklch(0.64 0.12 150)"];

function kpiCard(tint, dot, title, sub, num, delta, desc) {
  return `<div class="kpi-card">
    <div class="kpi-top">
      <div class="kpi-ico" style="background:${tint}"><span class="kpi-dot" style="background:${dot}"></span></div>
      <div><div class="kpi-title">${esc(title)}</div><div class="kpi-subt">${esc(sub)}</div></div>
    </div>
    <div class="kpi-figrow"><div class="kpi-num">${esc(num)}</div>${delta ? `<div class="kpi-delta ${delta.cls || ""}">${esc(delta.txt)}</div>` : ""}</div>
    <div class="kpi-desc">${esc(desc)}</div>
  </div>`;
}
function emptyChart(el, title, sub, msg) {
  el.innerHTML = `<div class="chart-head"><div><div class="chart-title">${esc(title)}</div><div class="chart-sub">${esc(sub)}</div></div></div><div class="ov-empty">${esc(msg)}</div>`;
}

function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }
function shorten(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
function sentiChip(s) { const m = { "pozitív": "good", "semleges": "warn", "negatív": "bad" }; return `<span class="chip ${m[s] || ""}">válasz: ${esc(s)}</span>`; }

// ── COCKPIT (Zita napi vezérlőpultja) ──
function cockpitModel(p) {
  const c = (p && p.candidates) || [];
  const byId = {}; c.forEach((x) => (byId[x.id] = x));
  const ranked = (p && p.ranking && p.ranking.ranked) || [];
  const os = (p && p.outreach_status) || {}, attr = (p && p.attraction) || {}, out = (p && p.outreach) || {}, ass = (p && p.assessments) || {};
  const coolDays = (p && p.pilot && p.pilot.cooling_days) || 7;
  const rows = ranked.filter((r) => { const t = tierLetter(r.tier); return t === "A" || t === "B"; }).map((r) => {
    const id = r.candidate_id, cand = byId[id] || {}, st = os[id] || {};
    return {
      id, cand, tier: tierLetter(r.tier), priority: r.pursue_priority,
      reason: (ass[id] && ass[id].standout) || shorten(r.rationale, 88),
      hook: attr[id] && attr[id].hook, hasAttr: !!attr[id], hasDraft: !!out[id],
      sent: !!st.sent_at, replied: !!st.replied, sentiment: st.sentiment, touched: daysSince(cand.last_touched),
    };
  });
  return { c, rows, coolDays };
}

function renderOverview(p) {
  const st = $("#ckStatus"); if (!st) return;
  const hero = $("#ckHero"), stuck = $("#ckStuck"), cov = $("#ckCoverage");
  if (!p || !(p.candidates || []).length || !p.ranking) {
    st.innerHTML = "";
    hero.innerHTML = `<div class="ov-empty">Még nincs mit vezérelni. A sorrend: 1) Intake — illeszd be a briefet · 2) Discover — futtasd a felkutatást · 3) Rank — rangsoroltasd a jelölteket. Utána itt látod, ma kivel mit lépj.</div>`;
    stuck.innerHTML = ""; cov.innerHTML = "";
    renderProof(p); return;
  }
  const d = cockpitModel(p);
  renderCkStatus(p, d); renderCkHero(p, d); renderCkStuck(p, d); renderCkCoverage(p, d); renderProof(p);
}

function renderCkStatus(p, d) {
  const A = d.rows.filter((r) => r.tier === "A");
  const contactable = A.filter((r) => r.hasAttr && r.hasDraft).length;
  const blocked = d.rows.filter((r) => !(r.hasAttr && r.hasDraft)).length;
  const cooling = d.rows.filter((r) => r.hasAttr && !r.replied && (r.touched == null || r.touched > d.coolDays)).length;
  const sent = Object.values(p.outreach_status || {}).filter((s) => s && s.sent_at).length;
  const age = daysSince(p.created_at);
  $("#ckStatus").innerHTML = `<div class="ck-status">
    <div class="ck-status-main">
      <div class="ck-status-num">${contactable}</div>
      <div><div class="ck-status-lbl">ma megkereshető „A” jelölt <span class="ck-hint">(kész elcsábítási terv + kész megkereső)</span></div>
      <div class="ck-status-sub">„A” prioritás: ${A.length} · elakadva: ${blocked} · régóta nincs lépés: ${cooling} · a keresés ${age == null ? "?" : age} napja fut</div></div>
    </div>
    <button class="ck-phase2" data-goto="proof">kiküldve: ${sent}/${d.rows.length} · Bizonyíték →</button>
  </div>`;
  const b = $("#ckStatus .ck-phase2"); if (b) b.onclick = () => $("#stage-proof").scrollIntoView({ behavior: "smooth" });
}

function actionRow(r, coolDays) {
  const draftState = r.replied ? sentiChip(r.sentiment)
    : r.sent ? `<span class="chip good">kiküldve</span>`
    : r.hasDraft ? `<span class="chip">megkereső kész</span>`
    : r.hasAttr ? `<span class="chip warn">nincs megkereső</span>`
    : `<span class="chip warn">nincs terv</span>`;
  const cta = !r.hasAttr ? "Terv készítése" : !r.hasDraft ? "Megkereső írása" : "Megkereső megnyitása";
  const cool = (r.touched != null && r.touched > coolDays) ? `<span class="ck-cool">· ${r.touched} napja nincs lépés</span>` : "";
  let track = "";
  if (r.hasDraft && !r.sent) track = `<button class="ck-mini" data-act="sent" data-id="${r.id}">Kiküldve ✓</button>`;
  else if (r.sent && !r.replied) track = `<span class="ck-mini-lbl">válasz:</span><button class="ck-mini good" data-act="pozitív" data-id="${r.id}">+</button><button class="ck-mini warn" data-act="semleges" data-id="${r.id}">0</button><button class="ck-mini bad" data-act="negatív" data-id="${r.id}">−</button>`;
  else if (r.replied) track = `<button class="ck-mini" data-act="reset" data-id="${r.id}" title="visszavonás">↺</button>`;
  return `<div class="act-card tier-${r.tier}">
    <div class="act-rank">${r.priority}</div>
    <div class="act-body">
      <div class="act-top"><span class="act-name">${esc(r.cand.name || r.id)}</span><span class="tier-badge">${r.tier}</span></div>
      <div class="act-co">${esc(r.cand.headline || "")}${r.cand.current_company ? " · " + esc(r.cand.current_company) : ""}</div>
      <div class="act-why">${esc(r.reason || "")}</div>
      ${r.hook ? `<div class="act-hook">🪝 „${esc(shorten(r.hook, 150))}”</div>` : ""}
      <div class="act-foot">${draftState}${cool}<span class="act-track">${track}</span></div>
    </div>
    <button class="btn btn-primary act-cta" data-id="${r.id}">${cta}</button>
  </div>`;
}

function renderCkHero(p, d) {
  const rows = d.rows.slice(0, 12);
  $("#ckHero").innerHTML = `<div class="ck-sec-head"><h3>Következő lépések — kit üldözz most</h3><span class="ck-sec-note">${d.rows.length} A/B jelölt üldözési sorrendben${d.rows.length > 12 ? " · top 12" : ""}</span></div><div class="act-list">${rows.map((r) => actionRow(r, d.coolDays)).join("")}</div>`;
  $$("#ckHero .act-cta").forEach((btn) => (btn.onclick = () => openAttract(btn.dataset.id)));
  $$("#ckHero .ck-mini").forEach((btn) => (btn.onclick = () => trackOutreach(btn.dataset.id, btn.dataset.act)));
}

async function trackOutreach(id, act) {
  try {
    const body = act === "sent" ? { candidateId: id, status: "sent" } : act === "reset" ? { candidateId: id, status: "reset" } : { candidateId: id, sentiment: act };
    const r = await api("POST", `/api/project/${state.projectId}/outreach-status`, body);
    state.project.outreach_status = state.project.outreach_status || {};
    if (r.status) state.project.outreach_status[id] = r.status; else delete state.project.outreach_status[id];
    const cd = (state.project.candidates || []).find((x) => x.id === id); if (cd) cd.last_touched = new Date().toISOString();
    persist();
    renderOverview(state.project);
  } catch (e) { toast("Hiba: " + e.message); }
}

function openAttract(id) {
  $("#attractCand").value = id;
  $("#stage-attract").scrollIntoView({ behavior: "smooth" });
  const stored = state.project && state.project.attraction && state.project.attraction[id];
  const cand = (state.project.candidates || []).find((c) => c.id === id);
  if (stored) {
    renderAttract(stored, cand);
    const dr = state.project.outreach && state.project.outreach[id];
    $("#outreachOut").innerHTML = ""; if (dr) renderOutreach(dr);
  } else $("#attractBtn").click();
}

function renderCkStuck(p, d) {
  const blockers = d.rows.map((r) => {
    const need = !r.hasAttr ? { txt: "hiányzik az elcsábítási terv", cta: "Terv" }
      : !r.hasDraft ? { txt: "hiányzik a megkereső", cta: "Megkereső" }
      : (String(r.cand.art14_status || "").includes("pending") ? { txt: "GDPR Art.14 rendezetlen", cta: "Megnyit" } : null);
    return need ? { ...r, need } : null;
  }).filter(Boolean);
  const cooling = d.rows.filter((r) => r.hasAttr && !r.replied && (r.touched == null || r.touched > d.coolDays))
    .sort((a, b) => (b.touched == null ? 9999 : b.touched) - (a.touched == null ? 9999 : a.touched));
  const bHtml = blockers.length ? blockers.slice(0, 8).map((r) => `<div class="stuck-item"><span class="tier-badge tier-${r.tier} tb">${r.tier}</span><span class="stuck-name">${esc(r.cand.name || r.id)}</span><span class="stuck-need">${esc(r.need.txt)}</span><button class="btn stuck-cta" data-id="${r.id}">${r.need.cta}</button></div>`).join("") : `<div class="ov-empty sm">Nincs blokkolt A/B jelölt — mind mozgatható. 💪</div>`;
  const cHtml = cooling.length ? cooling.slice(0, 8).map((r) => `<div class="stuck-item"><span class="stuck-days">${r.touched == null ? "—" : r.touched + "n"}</span><span class="stuck-name">${esc(r.cand.name || r.id)}</span><span class="stuck-need">${r.touched == null ? "még nem volt lépés" : "nincs lépés"}</span><button class="btn stuck-cta touch" data-id="${r.id}">Léptem vele</button></div>`).join("") : `<div class="ov-empty sm">Nincs hűlő szál — minden priorizált jelölt friss.</div>`;
  $("#ckStuck").innerHTML = `<div class="stuck-grid">
    <div><div class="ck-sec-head sm"><h3>Ami blokkol</h3><span class="ck-sec-note">${blockers.length} jelölt akad egy hiányzó lépésen</span></div>${bHtml}</div>
    <div><div class="ck-sec-head sm"><h3>Hűlő szálak</h3><span class="ck-sec-note">rangsorolt, de nincs rajta lépés</span></div>${cHtml}</div>
  </div>`;
  $$("#ckStuck .stuck-cta").forEach((btn) => (btn.onclick = () => btn.classList.contains("touch") ? touchCand(btn.dataset.id) : openAttract(btn.dataset.id)));
}

async function touchCand(id) {
  try {
    await api("POST", `/api/project/${state.projectId}/touch`, { candidateId: id });
    const cd = (state.project.candidates || []).find((x) => x.id === id); if (cd) cd.last_touched = new Date().toISOString();
    persist();
    renderOverview(state.project); toast("Rögzítve — kikerült a hűlő szálak közül.");
  } catch (e) { toast("Hiba: " + e.message); }
}

function renderCkCoverage(p, d) {
  const c = d.c;
  const dist = {}; c.forEach((x) => { const k = x.source_type || "egyéb"; dist[k] = (dist[k] || 0) + 1; });
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const top = entries[0] || ["—", 0];
  const topShare = c.length ? top[1] / c.length : 0;
  const thr = (p.pilot && p.pilot.mono_source_threshold) || 0.7;
  const mono = topShare >= thr && entries.length <= 2;
  const targets = (p.talent_map && p.talent_map.target_companies && p.talent_map.target_companies.map((t) => t.name)) || (p.query && p.query.target_companies) || [];
  const companies = c.map((x) => (x.current_company || "").toLowerCase()).filter(Boolean);
  const covered = targets.filter((t) => { const key = String(t || "").toLowerCase().replace(/[()]/g, "").slice(0, 7); return key && companies.some((cc) => cc.includes(key)); }).length;
  const blind = Math.max(0, targets.length - covered);
  let callout = "";
  if (mono) callout = `A pool <b>${Math.round(topShare * 100)}%-a egy forrásból</b> (${esc(srcLabel(top[0]))}). A többi csatorna (LinkedIn/GitHub/közösség) szisztematikusan kimarad → bővítsd a Discovery-t más forrással, mielőtt a poolból következtetsz.`;
  else if (blind > 0) callout = `<b>${blind} cél-cég érintetlen</b> a ${targets.length}-ből — vak folt. Kutasd fel ezeket, mielőtt lezárnád a merítést.`;
  else callout = `A merítés forrás- és cégoldalról kiegyensúlyozott — nincs kiugró vak folt.`;
  const alert = mono || blind > 0;
  const distHtml = entries.map(([k, v]) => `<div class="cov-src"><span class="cov-src-lbl">${esc(srcLabel(k))}</span><span class="cov-bar"><span style="width:${Math.round(v / c.length * 100)}%;background:${k === top[0] && mono ? "var(--bad)" : "var(--accent)"}"></span></span><span class="cov-src-val">${Math.round(v / c.length * 100)}%</span></div>`).join("");
  $("#ckCoverage").innerHTML = `<div class="cov-card ${alert ? "alert" : ""}">
    <div class="ck-sec-head sm"><h3>Lefedettség-őr</h3>${alert ? `<span class="cov-flag">figyelem</span>` : `<span class="cov-ok">rendben</span>`}</div>
    <div class="cov-block"><div class="cov-label">Forrás-koncentráció</div>${distHtml || "<div class='ov-empty sm'>—</div>"}</div>
    <div class="cov-block"><div class="cov-label">Cél-cég lefedettség</div><div class="cov-targets">${covered}/${targets.length} érintve · <b>${blind}</b> vak folt</div></div>
    <div class="cov-callout ${alert ? "alert" : ""}">${callout}</div>
  </div>`;
}

function abRowCount(p) { const ranked = (p.ranking && p.ranking.ranked) || []; return ranked.filter((r) => { const t = tierLetter(r.tier); return t === "A" || t === "B"; }).length; }

function renderProof(p) {
  const el = $("#proofBody"); if (!el) return;
  if (!p) { el.innerHTML = `<div class="ov-empty">Válassz projektet a bizonyíték-nézethez.</div>`; return; }
  const vals = Object.values(p.outreach_status || {});
  const sent = vals.filter((s) => s && s.sent_at).length;
  const replied = vals.filter((s) => s && s.replied).length;
  const positive = vals.filter((s) => s && s.replied && (s.sentiment === "pozitív" || s.sentiment === "semleges")).length;
  const rate = sent ? Math.round(positive / sent * 100) : null;
  const base = p.baseline_response_rate;
  const delta = (rate != null && base != null) ? rate - base : null;
  const age = daysSince(p.created_at);
  const shortDays = (p.first_shortlist_at && p.created_at) ? Math.floor((new Date(p.first_shortlist_at) - new Date(p.created_at)) / 86400000) : null;

  const heroHtml = sent === 0
    ? `<div class="proof-empty"><div class="proof-empty-num">0/${abRowCount(p)}</div><div class="proof-empty-lbl">megkeresés kiküldve</div><p>A bizonyíték-szám — a megkeresések pozitív válaszaránya a saját kézi válaszarányodhoz képest — itt jelenik meg, amint a vezérlőpulton „Kiküldve”-t jelölsz és beérkezik a válasz. Kitalált számot sosem mutatunk.</p></div>`
    : `<div class="proof-compare">
        <div class="proof-col"><div class="proof-big">${rate}%</div><div class="proof-cap">RIC-megkeresések<br>pozitív válaszaránya</div></div>
        <div class="proof-vs">vs</div>
        <div class="proof-col dim"><div class="proof-big">${base == null ? "—" : base + "%"}</div><div class="proof-cap">saját baseline<br>(kézi megkeresés)</div></div>
        ${delta != null ? `<div class="proof-delta ${delta >= 0 ? "pos" : "neg"}">${delta >= 0 ? "+" : ""}${delta}pp</div>` : `<div class="proof-delta muted">add meg a baseline-t →</div>`}
      </div>
      <div class="proof-sample">${positive}/${sent} kiküldött célszemély reagált pozitívan${replied > positive ? ` · ${replied - positive} semleges/negatív` : ""}</div>`;

  el.innerHTML = `
    <div class="page-head" style="margin-bottom:0"><div><div class="crumbs">Tulaj / fizető partner nézet</div><h1 style="font-size:20px">Bizonyíték — működik-e a módszer?</h1><div class="page-sub">EGY kérdés: az elcsábítás érdemben magasabb pozitív-válasz arányt hoz-e a jelenlegi kézi módszernél, és gyorsabb-e a shortlist. Őszinte üres állapot, míg nincs valós adat.</div></div></div>
    <div class="proof-hero card">${heroHtml}</div>
    <div class="proof-row">
      <div class="card proof-metric"><div class="cov-label">Idő az első prezentálható shortlistig</div>
        ${shortDays != null ? `<div class="proof-mid">${shortDays} nap</div><div class="kpi-desc">cél: ≥30% gyorsulás a kézi módszerhez képest</div><button class="btn btn-ghost" id="proofShortClear" style="margin-top:6px">visszavonás</button>`
          : `<div class="proof-mid">${age == null ? "?" : age} napja fut</div><button class="btn" id="proofShortDone" style="margin-top:6px">Shortlist kész — jelöld most</button>`}
      </div>
      <div class="card proof-metric"><div class="cov-label">Saját (kézi) válaszarány — baseline</div>
        <div class="proof-baseline-row"><input id="proofBaseline" class="brief-line" type="number" min="0" max="100" placeholder="%" value="${base == null ? "" : base}" style="max-width:100px"><button class="btn" id="proofBaselineSave">Mentés</button></div>
        <div class="kpi-desc">Egyszeri, kézzel — ehhez méri magát a pilot (önbevallás vagy korábbi ATS-export).</div>
      </div>
    </div>
    <div class="note">A kiküldés/válasz adat a vezérlőpult jelöléseiből épül (a rendszer nem küld semmit). A teljes automata engagement/ATS Fázis 2. A szakaszidő-alapú konverzió akkor pontos, ha a szakaszváltások időbélyegzettek.</div>`;

  const bs = $("#proofBaselineSave"); if (bs) bs.onclick = async () => { const r = await api("POST", `/api/project/${state.projectId}/baseline`, { rate: $("#proofBaseline").value }); state.project.baseline_response_rate = r.baseline_response_rate; persist(); renderProof(state.project); toast("Baseline mentve."); };
  const sd = $("#proofShortDone"); if (sd) sd.onclick = async () => { const r = await api("POST", `/api/project/${state.projectId}/shortlist-done`, {}); state.project.first_shortlist_at = r.first_shortlist_at; persist(); renderProof(state.project); toast("Shortlist-idő rögzítve."); };
  const sc = $("#proofShortClear"); if (sc) sc.onclick = async () => { await api("POST", `/api/project/${state.projectId}/shortlist-done`, { clear: true }); state.project.first_shortlist_at = null; persist(); renderProof(state.project); };
}

// Chart 1 — fél-donut gauge: jelöltek forrás szerint
function renderGauge(el, candidates) {
  if (!candidates.length) return emptyChart(el, "Jelöltek forrás szerint", "Discovery-eloszlás", "Indíts egy Discover-t a Discover lépésben.");
  const groups = {};
  candidates.forEach((c) => { const k = c.source_type || "egyéb"; groups[k] = (groups[k] || 0) + 1; });
  let entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  if (entries.length > 5) { const rest = entries.slice(4).reduce((s, e) => s + e[1], 0); entries = entries.slice(0, 4); entries.push(["egyéb", rest]); }
  const total = candidates.length, cx = 110, cy = 110, r = 88, gap = 2.4, n = entries.length;
  const span = 180 - (n - 1) * gap;
  let angle = 180;
  const segs = entries.map((e, i) => {
    const pct = e[1] / total * 100, sweep = pct / 100 * span;
    const s = polar(cx, cy, r, angle), en = polar(cx, cy, r, angle + sweep);
    const path = `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${en.x.toFixed(2)} ${en.y.toFixed(2)}`;
    angle += sweep + gap;
    return { label: srcLabel(e[0]), pct: Math.round(pct), color: PALETTE[i % PALETTE.length], path };
  });
  el.innerHTML = `<div class="chart-head"><div><div class="chart-title">Jelöltek forrás szerint</div><div class="chart-sub">Discovery-eloszlás, aktuális projekt</div></div></div>
    <div class="gauge-wrap">
      <svg viewBox="0 0 220 128" style="width:100%;max-width:220px">
        ${segs.map((s) => `<path d="${s.path}" stroke="${s.color}" stroke-width="22" fill="none" stroke-linecap="butt"></path>`).join("")}
        <text x="110" y="98" text-anchor="middle" font-size="11" fill="oklch(0.55 0.01 260)">Összes</text>
        <text x="110" y="118" text-anchor="middle" font-size="20" font-weight="700" fill="oklch(0.2 0.02 260)">${total}</text>
      </svg>
      <div class="legend">
        ${segs.map((s) => `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.pct}% ${esc(s.label)}</div>`).join("")}
      </div>
    </div>`;
}

// Chart 2 — stepped vonal: üldözési tölcsér
function renderFunnel(el, m) {
  if (!m.discovered) return emptyChart(el, "Üldözési tölcsér", "Jelöltek a pipeline szakaszain", "Még nincs felkutatott jelölt.");
  const stages = [
    { label: "Felkut.", v: m.discovered },
    { label: "Érték.", v: m.assessed },
    { label: "„A”", v: m.tierA },
    { label: "Csábít.", v: m.attracted },
    { label: "Reach", v: m.outreach },
  ];
  const vals = stages.map((s) => s.v), max = niceCeil(Math.max(...vals, 1));
  const W = 500, H = 190, padL = 34, padR = 14, top = 14, bottom = 34;
  const usableH = H - top - bottom, usableW = W - padL - padR, xStep = usableW / (stages.length - 1);
  const pts = vals.map((v, i) => ({ x: padL + i * xStep, y: top + usableH * (1 - v / max) }));
  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) path += ` L ${pts[i].x.toFixed(1)} ${pts[i - 1].y.toFixed(1)} L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const grid = gridVals.map((v) => ({ y: top + usableH * (1 - v / max), label: v }));
  const peak = pts[0], peakStage = stages[0];
  el.innerHTML = `<div class="chart-head"><div><div class="chart-title">Üldözési tölcsér</div><div class="chart-sub">Jelöltek a pipeline szakaszain</div></div><div class="period-pill" style="padding:6px 10px;font-size:12px">Projekt ▾</div></div>
    <div style="position:relative">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%">
        ${grid.map((g) => `<line x1="${padL}" x2="${W - padR}" y1="${g.y.toFixed(1)}" y2="${g.y.toFixed(1)}" stroke="oklch(0.94 0.006 260)" stroke-width="1"></line><text x="6" y="${(g.y + 3).toFixed(1)}" font-size="10" fill="oklch(0.6 0.01 260)">${g.label}</text>`).join("")}
        <path d="${path}" fill="none" stroke="oklch(0.55 0.18 264)" stroke-width="2"></path>
        ${pts.map((pt) => `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#fff" stroke="oklch(0.55 0.18 264)" stroke-width="2"></circle>`).join("")}
        ${stages.map((s, i) => `<text x="${pts[i].x.toFixed(1)}" y="${H - 12}" font-size="10" fill="oklch(0.55 0.01 260)" text-anchor="middle">${esc(s.label)}</text>`).join("")}
      </svg>
      <div class="chart-tip" style="left:${(peak.x / W * 100).toFixed(1)}%;top:2px"><div class="t">${esc(peakStage.label)}</div><div class="v">${peakStage.v} jelölt</div></div>
    </div>`;
}

// Chart 3 — sűrű oszlopok: jelöltenkénti jel-erősség
function renderSignalBars(el, candidates, tierMap, t) {
  if (!candidates.length) return emptyChart(el, "Jel-erősség jelöltenként", "Evidencia-pontszám", "Még nincs felkutatott jelölt.");
  const tierColor = { A: "var(--tier-a)", B: "var(--tier-b)", C: "var(--tier-c)" };
  const scored = candidates.map((c, i) => {
    const score = (c.signals || []).reduce((s, sg) => s + (sg.strength === "erős" ? 3 : sg.strength === "közepes" ? 2 : 1), 0);
    const tier = tierMap[c.id];
    const hue = 264 - (i / Math.max(candidates.length - 1, 1)) * 220;
    const color = t.hasRank && tier ? tierColor[tier] : `oklch(0.6 0.14 ${hue.toFixed(0)})`;
    return { score, color };
  });
  const maxScore = Math.max(...scored.map((s) => s.score), 1);
  const totalStrong = candidates.reduce((s, c) => s + (c.signals || []).filter((x) => x.strength === "erős").length, 0);
  const legend = t.hasRank
    ? [["A — most", t.tA, "var(--tier-a)"], ["B — párhuz.", t.tB, "var(--tier-b)"], ["C — melegen", t.tC, "var(--tier-c)"]]
    : [["Jelöltek", candidates.length, "var(--accent)"], ["Erős jelek", totalStrong, "var(--dot-cyan)"], ["Átlag jel/fő", (scored.reduce((s, x) => s + x.score, 0) / candidates.length).toFixed(1), "var(--dot-green)"]];
  el.innerHTML = `<div class="chart-head"><div><div class="chart-title">Jel-erősség jelöltenként</div><div class="chart-sub">Evidencia-pontszám, tier szerint színezve</div></div></div>
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px"><div style="font-size:22px;font-weight:700;color:oklch(0.2 0.02 260)">${totalStrong}</div><div class="kpi-delta">erős jel</div></div>
    <div class="bars">
      ${scored.map((s) => `<div class="bar" style="height:${Math.max(8, Math.round(s.score / maxScore * 100))}%;background:${s.color}"></div>`).join("")}
    </div>
    <div class="legend-3">
      ${legend.map(([lbl, val, col]) => `<div><div class="lg-lbl"><span class="legend-dot" style="background:${col}"></span>${esc(lbl)}</div><div class="lg-val">${esc(val)}</div></div>`).join("")}
    </div>`;
}

// Chart 4 — radar: pool-profil vs benchmark
function renderRadar(el, candidates, m) {
  if (!candidates.length) return emptyChart(el, "Pool-profil", "Kulcsdimenziók vs benchmark", "Még nincs felkutatott jelölt.");
  const n = candidates.length;
  const avgStrongRatio = candidates.reduce((s, c) => { const sg = c.signals || []; return s + (sg.length ? sg.filter((x) => x.strength === "erős").length / sg.length : 0); }, 0) / n;
  const distinct = new Set(candidates.map((c) => c.source_type)).size;
  const avgSignals = m.totalSignals / n;
  const reachable = candidates.filter((c) => (c.source_type && c.source_type !== "linkedin")).length / n;
  const labelsData = ["Seniority", "Forrás-div.", "Evidencia", "Üldözés", "Elérhet."];
  const seriesA = [
    clamp5(avgStrongRatio * 5),
    clamp5(distinct),
    clamp5(avgSignals / 3 * 5),
    clamp5((m.attractionCount + m.outreachCount) / n * 8 + (m.attractionCount ? 1.5 : 0)),
    clamp5(reachable * 5),
  ];
  const seriesB = [3.5, 3.2, 3.5, 2.5, 3.5];
  const rcx = 110, rcy = 110, R = 78, scaleMax = 5;
  const axisAngles = labelsData.map((_, i) => -90 + i * 72);
  const ptsFor = (vals) => axisAngles.map((deg, i) => { const p = polar(rcx, rcy, (vals[i] / scaleMax) * R, deg); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
  const rings = [0.33, 0.66, 1].map((sc) => axisAngles.map((deg) => { const p = polar(rcx, rcy, R * sc, deg); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" "));
  const axisLines = axisAngles.map((deg) => polar(rcx, rcy, R, deg));
  const labels = axisAngles.map((deg, i) => { const p = polar(rcx, rcy, R + 18, deg); let anchor = "middle"; if (p.x < rcx - 5) anchor = "end"; else if (p.x > rcx + 5) anchor = "start"; return { x: p.x, y: p.y, text: labelsData[i], anchor }; });
  el.innerHTML = `<div class="chart-head"><div><div class="chart-title">Pool-profil</div><div class="chart-sub">Kulcsdimenziók vs benchmark</div></div></div>
    <svg viewBox="-34 -8 288 240" style="width:100%">
      ${rings.map((r) => `<polygon points="${r}" fill="none" stroke="oklch(0.93 0.006 260)" stroke-width="1"></polygon>`).join("")}
      ${axisLines.map((a) => `<line x1="110" y1="110" x2="${a.x.toFixed(1)}" y2="${a.y.toFixed(1)}" stroke="oklch(0.93 0.006 260)" stroke-width="1"></line>`).join("")}
      <polygon points="${ptsFor(seriesB)}" fill="oklch(0.9 0.006 260 / 0.5)" stroke="oklch(0.7 0.006 260)" stroke-width="1.5"></polygon>
      <polygon points="${ptsFor(seriesA)}" fill="oklch(0.55 0.18 264 / 0.18)" stroke="oklch(0.55 0.18 264)" stroke-width="2"></polygon>
      ${labels.map((l) => `<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" font-size="9" text-anchor="${l.anchor}" fill="oklch(0.4 0.01 260)">${esc(l.text)}</text>`).join("")}
    </svg>
    <div class="radar-legend">
      <div style="display:flex;align-items:center;gap:6px"><span class="sw" style="background:oklch(0.55 0.18 264)"></span>Ez a projekt</div>
      <div style="display:flex;align-items:center;gap:6px"><span class="sw" style="background:oklch(0.75 0.006 260)"></span>Benchmark</div>
    </div>`;
}

// ── RENDERERS ───────────────────────────────────────────
function list(items) {
  return `<ul class="klist">${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
function chips(items, cls) {
  return `<div class="chips">${(items || []).map((i) => `<span class="chip ${cls || ""}">${esc(i)}</span>`).join("")}</div>`;
}

function renderIntake(o) {
  $("#intakeOut").innerHTML = `
    <div class="card">
      <h4>Újrakeretezett kereslet ${demoTag(o)}</h4>
      <p class="lead">${esc(o.reframed_brief)}</p>
    </div>
    <div class="card">
      <h4>Must have</h4>${list(o.must_haves)}
      <h4 style="margin-top:10px">Nice to have</h4>${chips(o.nice_to_haves)}
    </div>
    ${(o.bad_brief_flags || []).length ? `<div class="card"><h4>⚠️ Hol rossz a brief</h4>${(o.bad_brief_flags || []).map((f) => `<div class="flag">${esc(f)}</div>`).join("")}</div>` : ""}
    ${(o.hidden_requirements || []).length ? `<div class="card"><h4>Rejtett valódi igény</h4>${list(o.hidden_requirements)}</div>` : ""}
    ${(o.search_hypotheses || []).length ? `<div class="card"><h4>Hol vannak ezek az emberek</h4>${list(o.search_hypotheses)}</div>` : ""}
  `;
}

function renderQuery(o) {
  $("#queryOut").innerHTML = `
    <div class="card">
      <h4>Keresési stratégia ${demoTag(o)}</h4>
      ${(o.boolean_queries || []).map((q) => `<div class="q-plat">${esc(q.platform)}</div><code class="q-code">${esc(q.query)}</code>`).join("")}
      <h4 style="margin-top:8px">Firecrawl lekérdezések (ezek hajtják a felkutatást)</h4>
      ${(o.firecrawl_search_queries || []).map((q) => `<code class="q-code">${esc(q)}</code>`).join("")}
      ${(o.target_titles || []).length ? `<h4 style="margin-top:8px">Cél-titulusok</h4>${chips(o.target_titles)}` : ""}
    </div>`;
}

function srcBadge(t) {
  return `<span class="src-badge src-${esc(t)}">${esc(t)}</span>`;
}
function renderCandidates(cands, p) {
  const grid = $("#candidateGrid");
  grid.innerHTML = "";
  cands.forEach((c) => {
    const assessed = p && p.assessments && p.assessments[c.id];
    const card = el("div", "cand");
    card.innerHTML = `
      <div class="cand-top">
        <div><div class="cand-name">${esc(c.name)}</div><div class="cand-head">${esc(c.headline || "")}</div></div>
        ${srcBadge(c.source_type)}
      </div>
      ${c.location ? `<div class="cand-meta">📍 ${esc(c.location)}${c.current_company ? " · " + esc(c.current_company) : ""}</div>` : ""}
      <div class="cand-sig">${(c.signals || []).slice(0, 3).map((s) => `<span class="s">• ${esc(s.signal)} <span class="chip ${s.strength === "erős" ? "good" : s.strength === "gyenge" ? "" : "warn"}">${esc(s.strength || "")}</span></span>`).join("")}</div>
      ${c.source_url ? `<div class="prov"><a href="${esc(c.source_url)}" target="_blank" rel="noopener">forrás ↗</a> · <span class="art14">Art.14: ${esc(c.art14_status)}</span></div>` : `<div class="prov"><span class="art14">${esc(c.art14_status)}</span></div>`}
      <div class="cand-actions">
        <button class="btn assess-btn">Értékeld</button>
        <button class="btn btn-primary attract-btn">⭐ Csábítás</button>
      </div>
      <div class="assess-slot"></div>`;
    $(".assess-btn", card).onclick = (e) => withLoading(e.target, async () => {
      const out = await api("POST", `/api/project/${state.projectId}/assess`, { candidateId: c.id });
      renderAssessInline($(".assess-slot", card), out);
      state.project.assessments = state.project.assessments || {};
      state.project.assessments[c.id] = out;
      persist();
      renderOverview(state.project);
    });
    $(".attract-btn", card).onclick = () => {
      $("#attractCand").value = c.id;
      $("#stage-attract").scrollIntoView({ behavior: "smooth" });
      $("#attractBtn").click();
    };
    if (assessed) renderAssessInline($(".assess-slot", card), assessed);
    grid.appendChild(card);
  });
  // attract selector
  $("#attractCand").innerHTML = cands.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
}
function renderAssessInline(slot, o) {
  slot.innerHTML = `<div class="card" style="margin-top:8px">
    <h4>Senior-olvasat ${demoTag(o)}</h4>
    <p><b>Seniority:</b> ${esc(o.seniority_read || "")}</p>
    ${(o.fit_signals || []).length ? `<div>${o.fit_signals.map((s) => `<div class="cand-sig"><span class="s">✓ ${esc(s.signal)} <span class="chip ${s.strength === "erős" ? "good" : "warn"}">${esc(s.strength)}</span></span></div>`).join("")}</div>` : ""}
    ${(o.gaps_to_explore || []).length ? `<h4 style="margin-top:8px">Beszélgetésben feltárandó (nem kizáró)</h4>${list(o.gaps_to_explore)}` : ""}
    ${o.standout ? `<p style="margin-top:6px"><b>Kiemelkedő:</b> ${esc(o.standout)}</p>` : ""}
    <div class="note" style="margin-top:8px">${esc(o.note || "")}</div>
  </div>`;
}

function renderTalent(o) {
  $("#talentOut").innerHTML = `<div class="card"><h4>Talent map ${demoTag(o)}</h4>
    ${(o.target_companies || []).map((c) => `<div class="rank-body" style="margin-bottom:8px"><span class="rank-name">${esc(c.name)}</span> — ${esc(c.why)} ${chips(c.likely_roles)}</div>`).join("")}
    ${(o.where_they_gather || []).length ? `<h4 style="margin-top:6px">Hol gyűlnek</h4>${chips(o.where_they_gather)}` : ""}
  </div>`;
}

function renderRank(o) {
  const html = (o.ranked || []).map((r) => {
    const tier = (r.tier || "").startsWith("A") ? "A" : (r.tier || "").startsWith("B") ? "B" : "C";
    return `<div class="rank-item tier-${tier}">
      <div class="rank-pos">${r.pursue_priority}</div>
      <div class="rank-body">
        <span class="rank-name">${esc(r.name || r.candidate_id)}</span><span class="tier-badge">${esc(r.tier)}</span>
        <div class="rank-rat">${esc(r.rationale || "")}</div>
        ${(r.evidence || []).length ? chips(r.evidence) : ""}
      </div></div>`;
  }).join("");
  $("#rankOut").innerHTML = `<div class="card"><h4>Üldözési rangsor ${demoTag(o)}</h4>${html}<div class="note">${esc(o.note || "")}</div></div>`;
}

function renderAttract(o, cand) {
  const drivers = (o.what_moves_them || []).map((d) => {
    const cf = (d.confidence || "közepes").toLowerCase();
    return `<div class="driver"><div class="driver-h">${esc(d.driver)}<span class="conf conf-${esc(cf)}">${esc(d.confidence || "")}</span></div><div class="driver-e">${esc(d.evidence || "")}</div></div>`;
  }).join("");
  $("#attractOut").innerHTML = `<div class="card attract-hero">
    <h4>⭐ Elcsábítási stratégia — ${esc(cand ? cand.name : "")} ${demoTag(o)}</h4>
    <div class="angle">${esc(o.angle || "")}</div>
    ${o.hook ? `<div class="attract-hook">🪝 „${esc(o.hook)}”</div>` : ""}
    <div class="attract-grid">
      <div><h4>Mi mozgatja</h4>${drivers}</div>
      <div>
        <h4>Timing</h4><p>${esc(o.timing || "")}</p>
        <h4 style="margin-top:8px">Csatorna</h4><p>${esc(o.channel || "")}</p>
        <h4 style="margin-top:8px">Ajánlati karok</h4>${chips(o.offer_levers)}
        ${(o.risks || []).length ? `<h4 style="margin-top:8px">⚠️ Mi taszítaná el</h4>${(o.risks || []).map((r) => `<div class="flag">${esc(r)}</div>`).join("")}` : ""}
      </div>
    </div>
    ${o.confidence ? `<div class="note">Konfidencia: ${esc(o.confidence)}</div>` : ""}
    <div class="row" style="margin-top:12px">
      <label>Megkereső nyelve:</label>
      <select id="outLang"><option value="">auto</option><option value="en">angol</option><option value="hu">magyar</option></select>
      <button id="outBtn" class="btn btn-primary">Megkereső megírása</button>
    </div>
  </div>`;
  $("#outBtn").onclick = (e) => withLoading(e.target, async () => {
    const out = await api("POST", `/api/project/${state.projectId}/outreach`, { candidateId: cand.id, language: $("#outLang").value || undefined });
    if (state.project) { state.project.outreach = state.project.outreach || {}; state.project.outreach[cand.id] = out; }
    persist();
    renderOutreach(out);
    renderOverview(state.project);
  });
}
function renderOutreach(o) {
  $("#outreachOut").innerHTML = `<div class="card">
    <h4>Megkereső (vázlat) ${demoTag(o)}</h4>
    <div class="mail">
      <div class="mail-head"><span class="mail-subj">${esc(o.subject || "(nincs tárgy)")}</span><button class="btn copy-btn" id="copyMail">Másolás</button></div>
      <div class="mail-body" id="mailBody">${esc(o.body || "")}</div>
    </div>
    ${(o.why_this_works || []).length ? `<h4 style="margin-top:10px">Miért hatásos</h4>${list(o.why_this_works)}` : ""}
    <div class="note">${esc(o.note || "Draft — a rendszer nem küld. A recruiter nézi át.")}</div>
    <div class="row" style="margin-top:10px"><button id="art14Btn" class="btn btn-ghost">⚖️ GDPR Art.14 értesítő generálása</button></div>
    <div id="art14Slot"></div>
  </div>`;
  $("#copyMail").onclick = () => {
    navigator.clipboard.writeText((o.subject ? o.subject + "\n\n" : "") + (o.body || ""));
    toast("Vágólapra másolva");
  };
  $("#art14Btn").onclick = (e) => withLoading(e.target, async () => {
    const a = await api("POST", `/api/project/${state.projectId}/art14`, { candidateId: o.candidate_id });
    $("#art14Slot").innerHTML = `<div class="mail" style="margin-top:10px"><div class="mail-head"><span class="mail-subj">${esc(a.subject)}</span><span>${esc(a.must_send_within)}</span></div><div class="mail-body">${esc(a.body)}</div></div><div class="note">${esc(a.note)}</div>`;
  });
}
function renderAdvisory(o) {
  $("#advisoryOut").innerHTML = `<div class="card"><h4>Client advisory ${demoTag(o)}</h4>${list(o.talking_points)}
    ${o.seniority_framing ? `<h4 style="margin-top:8px">Hogyan tűnj seniornak</h4><p>${esc(o.seniority_framing)}</p>` : ""}
    ${(o.watch_outs || []).length ? `<h4 style="margin-top:8px">⚠️ Mire figyelj</h4>${chips(o.watch_outs, "warn")}` : ""}</div>`;
}
function renderInterview(o) {
  $("#interviewOut").innerHTML = `<div class="card"><h4>Interjú-intelligencia ${demoTag(o)}</h4>
    ${(o.competency_questions || []).map((q) => `<div style="margin-bottom:10px"><div class="q-plat">${esc(q.competency)}</div><p style="margin:2px 0"><b>${esc(q.question)}</b></p><div class="driver-e">Jó válasz: ${esc(q.what_good_looks_like)}</div></div>`).join("")}
    ${(o.red_flags_to_probe || []).length ? `<h4>Red flag-ek</h4>${chips(o.red_flags_to_probe, "bad")}` : ""}</div>`;
}
function renderCoach(o) {
  $("#coachOut").innerHTML = `<div class="card"><h4>Coach ${demoTag(o)}</h4>
    <p><b>Egy senior itt:</b> ${esc(o.what_a_senior_would_do || "")}</p>
    ${o.one_lever_now ? `<div class="attract-hook" style="font-style:normal">💡 Most bevethető: ${esc(o.one_lever_now)}</div>` : ""}
    ${o.skill_focus ? `<p><b>Fejlesztendő készség:</b> ${esc(o.skill_focus)}</p>` : ""}
    ${o.encouragement ? `<p class="mut">${esc(o.encouragement)}</p>` : ""}</div>`;
}

// ── WIRING ──────────────────────────────────────────────
$("#newProjBtn").onclick = async () => {
  const raw = $("#newProjId").value.trim();
  if (!raw) return toast("Adj meg egy projekt-azonosítót.");
  const id = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) return toast("Érvénytelen azonosító.");
  if (!lsGet(id)) lsSave(emptyProjectJS(id, raw));
  $("#newProjId").value = "";
  await loadProjects();
  $("#projectSelect").value = id;
  await selectProject(id);
  toast("Projekt létrehozva: " + id);
};
$("#projectSelect").onchange = (e) => selectProject(e.target.value);

$("#intakeBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  state.project.brief_raw = $("#briefInput").value;
  const out = await api("POST", `/api/project/${state.projectId}/intake`, { brief: $("#briefInput").value });
  state.project.intake = out;
  persist();
  renderIntake(out);
  toast("Brief megtámadva.");
});
$("#queryBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const q = await api("POST", `/api/project/${state.projectId}/query`);
  state.project.query = q;
  persist();
  renderQuery(q);
});
$("#discoverBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const out = await api("POST", `/api/project/${state.projectId}/discover`, { source: $("#sourceSel").value });
  state.project.candidates = out.candidates;
  state.project.discover_note = out.note;
  state.project.discover_source = out.source;
  persist();
  renderCandidates(out.candidates, state.project);
  $("#discoverNote").innerHTML = `<div class="note">${esc(out.note)}</div>`;
  renderOverview(state.project);
  toast(`${out.candidates.length} jelölt felkutatva (${out.source}).`);
});
$("#talentBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const t = await api("POST", `/api/project/${state.projectId}/talent-map`);
  state.project.talent_map = t;
  persist();
  renderTalent(t);
});
$("#rankBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const r = await api("POST", `/api/project/${state.projectId}/rank`);
  if (state.project) state.project.ranking = r;
  persist();
  renderRank(r);
  renderOverview(state.project);
});
$("#attractBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const id = $("#attractCand").value;
  if (!id) return toast("Előbb kutass fel jelölteket (Discover).");
  const cand = (state.project.candidates || []).find((c) => c.id === id);
  const out = await api("POST", `/api/project/${state.projectId}/attract`, { candidateId: id });
  if (state.project) { state.project.attraction = state.project.attraction || {}; state.project.attraction[id] = out; }
  persist();
  renderAttract(out, cand);
  $("#outreachOut").innerHTML = "";
  renderOverview(state.project);
});
$("#advisoryBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const a = await api("POST", `/api/project/${state.projectId}/advisory`);
  state.project.advisory = a;
  persist();
  renderAdvisory(a);
});
$("#interviewBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const iv = await api("POST", `/api/project/${state.projectId}/interview`);
  state.project.interview = iv;
  persist();
  renderInterview(iv);
});
$("#coachBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const out = await api("POST", `/api/project/${state.projectId}/coach`, { context: $("#coachCtx").value });
  state.project.coach_notes = state.project.coach_notes || [];
  state.project.coach_notes.push({ ts: new Date().toISOString(), ...out });
  persist();
  renderCoach(out);
});

// Memory drawer
$("#memBtn").onclick = async () => {
  if (!needProject()) return;
  $("#memDrawer").classList.remove("hidden");
  const mem = (state.project && state.project.memory) || [];
  $("#memList").innerHTML = mem.slice().reverse().map((e) => `<div class="mem-entry"><div class="t">${esc(e.ts)} · ${esc(e.kind)}</div>${esc(e.note)}</div>`).join("") || `<div class="empty">Még nincs jegyzet.</div>`;
};
$("#memClose").onclick = () => $("#memDrawer").classList.add("hidden");
$("#memSave").onclick = async () => {
  const note = $("#memNote").value.trim();
  if (!note) return;
  state.project.memory = state.project.memory || [];
  state.project.memory.push({ ts: new Date().toISOString(), kind: "note", note });
  persist();
  $("#memNote").value = "";
  $("#memBtn").click();
  toast("Mentve a projekt-memóriába.");
};

// Export projekt JSON
$("#exportBtn").onclick = () => {
  if (!needProject()) return;
  const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.projectId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Projekt exportálva.");
};

// Topbar kereső — jelölt-grid szűrése + ugrás a Discoverre
$("#globalSearch").oninput = (e) => {
  const q = e.target.value.trim().toLowerCase();
  $$("#candidateGrid .cand").forEach((card) => {
    const txt = card.textContent.toLowerCase();
    card.style.display = !q || txt.includes(q) ? "" : "none";
  });
};
$("#globalSearch").onfocus = () => { const d = $("#stage-discover"); if (d && $$("#candidateGrid .cand").length) d.scrollIntoView({ behavior: "smooth" }); };

// Active step on scroll
const obs = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      const id = en.target.id.replace("stage-", "");
      $$(".step").forEach((s) => s.classList.toggle("active", s.dataset.step === id));
    }
  });
}, { rootMargin: "-40% 0px -55% 0px" });
$$(".stage").forEach((s) => obs.observe(s));

// Init
(async () => {
  await loadStatus();
  await loadProjects();
  const list = lsList();
  if (list.length) {
    $("#projectSelect").value = list[0].id;
    await selectProject(list[0].id);
  }
})();
