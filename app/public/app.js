// Recruitment Intelligence Copilot — frontend (vanilla JS, nulla build).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = { projectId: null, project: null, status: null };

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
  const list = await api("GET", "/api/projects");
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
  const p = await api("GET", `/api/project/${encodeURIComponent(id)}`);
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

function renderOverview(p) {
  const c = (p && p.candidates) || [];
  const ranking = p && p.ranking;
  const tierMap = {}; let tA = 0, tB = 0, tC = 0;
  if (ranking && ranking.ranked) ranking.ranked.forEach((r) => { const t = tierLetter(r.tier); tierMap[r.candidate_id] = t; if (t === "A") tA++; else if (t === "B") tB++; else tC++; });
  const attractionCount = p ? Object.keys(p.attraction || {}).length : 0;
  const outreachCount = p ? Object.keys(p.outreach || {}).length : 0;
  const assessCount = p ? Object.keys(p.assessments || {}).length : 0;
  const strongSignals = c.reduce((s, cd) => s + (cd.signals || []).filter((x) => x.strength === "erős").length, 0);
  const totalSignals = c.reduce((s, cd) => s + (cd.signals || []).length, 0);
  const source = (p && p.discover_source) || "—";

  // KPI row
  const pctA = c.length ? Math.round((tA / c.length) * 100) : 0;
  const avgStrong = c.length ? (strongSignals / c.length).toFixed(1) : "0";
  $("#kpiRow").innerHTML =
    kpiCard("var(--accent-tint)", "var(--accent)", "Felkutatott jelöltek", "Aktuális projekt", c.length,
      { txt: source === "firecrawl" ? "élő" : source === "synthetic" ? "szintetikus" : "—", cls: "neutral" },
      "Passzív célszemélyek a poolban.") +
    kpiCard("var(--tint-blue)", "var(--dot-blue)", "„A” prioritás", "Most üldözd", ranking ? tA : "—",
      ranking ? { txt: pctA + "%", cls: "" } : { txt: "rangsor kell", cls: "neutral" },
      ranking ? "A pool azonnal üldözendő része." : "Futtass rangsorolást a Rank lépésben.") +
    kpiCard("var(--tint-cyan)", "var(--dot-cyan)", "Elcsábítási tervek", "Bespoke stratégia", attractionCount,
      { txt: outreachCount + " draft", cls: "neutral" },
      "Kidolgozott megnyerési stratégiák.") +
    kpiCard("var(--tint-green)", "var(--dot-green)", "Erős jelek", "Evidencia a poolban", strongSignals,
      { txt: "Ø " + avgStrong + "/fő", cls: "neutral" },
      "Megerősített szakmai jelek összesen.");

  renderGauge($("#chartSource"), c);
  renderFunnel($("#chartFunnel"), { discovered: c.length, assessed: assessCount, tierA: tA, attracted: attractionCount, outreach: outreachCount });
  renderSignalBars($("#chartSignals"), c, tierMap, { tA, tB, tC, hasRank: !!ranking });
  renderRadar($("#chartRadar"), c, { attractionCount, outreachCount, strongSignals, totalSignals });
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
      <label>Outreach nyelv:</label>
      <select id="outLang"><option value="">auto</option><option value="en">angol</option><option value="hu">magyar</option></select>
      <button id="outBtn" class="btn btn-primary">Outreach draft készítése</button>
    </div>
  </div>`;
  $("#outBtn").onclick = (e) => withLoading(e.target, async () => {
    const out = await api("POST", `/api/project/${state.projectId}/outreach`, { candidateId: cand.id, language: $("#outLang").value || undefined });
    if (state.project) { state.project.outreach = state.project.outreach || {}; state.project.outreach[cand.id] = out; }
    renderOutreach(out);
    renderOverview(state.project);
  });
}
function renderOutreach(o) {
  $("#outreachOut").innerHTML = `<div class="card">
    <h4>Megkereső-draft ${demoTag(o)}</h4>
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
  await api("POST", "/api/project", { id, name: raw });
  $("#newProjId").value = "";
  await loadProjects();
  $("#projectSelect").value = id;
  await selectProject(id);
  toast("Projekt létrehozva: " + id);
};
$("#projectSelect").onchange = (e) => selectProject(e.target.value);

$("#intakeBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const out = await api("POST", `/api/project/${state.projectId}/intake`, { brief: $("#briefInput").value });
  state.project.intake = out;
  renderIntake(out);
  toast("Brief megtámadva.");
});
$("#queryBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  renderQuery(await api("POST", `/api/project/${state.projectId}/query`));
});
$("#discoverBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const out = await api("POST", `/api/project/${state.projectId}/discover`, { source: $("#sourceSel").value });
  state.project = await api("GET", `/api/project/${state.projectId}`);
  renderCandidates(out.candidates, state.project);
  $("#discoverNote").innerHTML = `<div class="note">${esc(out.note)}</div>`;
  renderOverview(state.project);
  toast(`${out.candidates.length} jelölt felkutatva (${out.source}).`);
});
$("#talentBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  renderTalent(await api("POST", `/api/project/${state.projectId}/talent-map`));
});
$("#rankBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const r = await api("POST", `/api/project/${state.projectId}/rank`);
  if (state.project) state.project.ranking = r;
  renderRank(r);
  renderOverview(state.project);
});
$("#attractBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  const id = $("#attractCand").value;
  if (!id) return toast("Előbb kutass fel jelölteket (Discover).");
  const cand = (state.project.candidates || []).find((c) => c.id === id);
  const out = await api("POST", `/api/project/${state.projectId}/attract`, { candidateId: id });
  if (state.project) { state.project.attraction = state.project.attraction || {}; state.project.attraction[id] = out; }
  renderAttract(out, cand);
  $("#outreachOut").innerHTML = "";
  renderOverview(state.project);
});
$("#advisoryBtn").onclick = (e) => needProject() && withLoading(e.target, async () => renderAdvisory(await api("POST", `/api/project/${state.projectId}/advisory`)));
$("#interviewBtn").onclick = (e) => needProject() && withLoading(e.target, async () => renderInterview(await api("POST", `/api/project/${state.projectId}/interview`)));
$("#coachBtn").onclick = (e) => needProject() && withLoading(e.target, async () => {
  renderCoach(await api("POST", `/api/project/${state.projectId}/coach`, { context: $("#coachCtx").value }));
});

// Memory drawer
$("#memBtn").onclick = async () => {
  if (!needProject()) return;
  $("#memDrawer").classList.remove("hidden");
  const m = await api("GET", `/api/project/${state.projectId}/memory`);
  $("#memList").innerHTML = (m.memory || []).slice().reverse().map((e) => `<div class="mem-entry"><div class="t">${esc(e.ts)} · ${esc(e.kind)}</div>${esc(e.note)}</div>`).join("") || `<div class="empty">Még nincs jegyzet.</div>`;
};
$("#memClose").onclick = () => $("#memDrawer").classList.add("hidden");
$("#memSave").onclick = async () => {
  const note = $("#memNote").value.trim();
  if (!note) return;
  await api("POST", `/api/project/${state.projectId}/memory`, { note });
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
  const list = await api("GET", "/api/projects");
  if (list.length) {
    $("#projectSelect").value = list[0].id;
    await selectProject(list[0].id);
  }
})();
