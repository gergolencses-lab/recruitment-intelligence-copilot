// JEL — frontend (vanilla JS, nulla build). Jelöltből jó döntés.
// Megbízás-alapú munkatér: nézetek (Áttekintés / Pozíció / Célpiac / Jelöltek /
// Megkeresések / Ügyfél / Eredmények / Jegyzetek), állandó megbízás-fejléccel.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = {
  projectId: null, project: null, status: null,
  view: "home", homeFilter: "aktiv",
  candFilter: { prio: "", state: "", q: "" },
  candView: "board",   // board | list — a tábla az alapértelmezés
  drawerId: null,      // a jelöltpanelben nyitott jelölt
  panelTab: "profil",  // profil · megkozelites · uzenet · naplo
  notesOpen: false,    // a napló-fiók nyitva van-e
  moreOpen: false,     // az alsó „⋯ Több” lap nyitva van-e
  newEngStep: 0,       // 0 = zárva, 1 = alapadatok, 2 = brief
  openExcluded: false, // a kizárt jelöltek sávja nyitva nyíljon-e
};

// ── Kliens-oldali megbízás-tár (localStorage) ───────────────────────────
// A szerver STATELESS (Vercel-kompatibilis): nincs szerveroldali lemez, a
// megbízás-állapot a böngészőben él, és minden művelethez elküldjük a body-ban.
// (A technikai adatmodellben a neve "project" — a felületen: Megbízás.)
const LS_KEY = "ric.projects.v1";
const UI_KEY = "ric.ui.v1";

const STATUSES = [
  "Előkészítés", "Kutatás folyamatban", "Megkeresés folyamatban",
  "Interjúk folyamatban", "Várakozik az ügyfélre", "Szüneteltetve",
  "Betöltve", "Lezárva",
];
const STATUS_CLS = {
  "Előkészítés": "", "Kutatás folyamatban": "st-active", "Megkeresés folyamatban": "st-outreach",
  "Interjúk folyamatban": "st-interview", "Várakozik az ügyfélre": "st-wait",
  "Szüneteltetve": "st-wait", "Betöltve": "st-done", "Lezárva": "st-closed",
};
const TIER_LABEL = { A: "A — elsőként keresd meg", B: "B — következő kör", C: "C — figyelőlista", D: "D — most nem javasolt" };
const WORK_MODES = ["", "helyszíni", "hibrid", "távoli"];

function emptyPosition() {
  return { title: "", client: "", location: "", work_mode: "", seniority: "", owner: "", hiring_manager: "", language: "", salary_band: "", due_date: "", priority: "" };
}
function migrate(p) {
  if (!p.position) p.position = { ...emptyPosition(), title: p.name || p.id };
  if (!p.status) p.status = (p.candidates || []).length ? "Kutatás folyamatban" : "Előkészítés";
  if (!p.priority_overrides) p.priority_overrides = {};
  if (p.intake_review === undefined) p.intake_review = null;
  if (p.brief_final === undefined) p.brief_final = null;
  if (!p.exclusions) p.exclusions = {};
  if (!p.exclusions.companies) p.exclusions.companies = [];
  if (!p.exclusions.candidates) p.exclusions.candidates = {};
  if (!p.exclusions.client_aliases) p.exclusions.client_aliases = [];
  if (p.exclusions.allow_alumni === undefined) p.exclusions.allow_alumni = false;
  if (!p.strategy_chat) p.strategy_chat = [];
  if (!p.outreach_status) p.outreach_status = {};
  if (!p.outreach) p.outreach = {};
  if (!p.attraction) p.attraction = {};
  if (!p.assessments) p.assessments = {};
  if (!p.coach_notes) p.coach_notes = [];
  if (!p.memory) p.memory = [];
  if (p.archived === undefined) p.archived = false;
  // Régi build: a ranking csupasz tömbként mentődött (guard-mellékhatás) — normalizáljuk.
  if (Array.isArray(p.ranking)) p.ranking = { ranked: p.ranking };
  return p;
}
function lsAll() { try { const a = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); Object.values(a).forEach(migrate); return a; } catch { return {}; } }
function lsSave(p) {
  if (!p || !p.id) return p;
  const all = lsAll();
  p.updated_at = new Date().toISOString();
  all[p.id] = p;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); }
  catch (e) { toast("A böngésző tárhelye megtelt. Archiválj vagy törölj régi megbízást a nyitóképernyőn.", true); }
  return p;
}
function lsGet(id) { return lsAll()[id] || null; }
function lsDelete(id) {
  const all = lsAll();
  const removed = all[id];
  delete all[id];
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  return removed;
}
// A törlés visszavonható: a kivett megbízást memóriában tartjuk, amíg a
// visszavonó buborék él. Enélkül a törlés az egyetlen visszafordíthatatlan
// művelet lenne egy termékben, ami mindenhol máshol megőrzi a nyomot.
function lsRestore(p) { if (p && p.id) { const all = lsAll(); all[p.id] = p; try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {} } }
function lsListFull() { return Object.values(lsAll()).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")); }
function persist() { if (state.project) lsSave(state.project); }
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ projectId: state.projectId, view: state.view, homeFilter: state.homeFilter, candView: state.candView })); } catch {} syncHash(); }
function loadUi() { try { return JSON.parse(localStorage.getItem(UI_KEY) || "{}"); } catch { return {}; } }

/* ── CÍMSOR-ÁLLAPOT ──────────────────────────────────────────────────────
   Eddig minden navigáció `href="#"` volt: egy megbízást nem lehetett
   könyvjelzőzni, linkként elküldeni, és a Vissza gomb sem csinált semmit.
   A hash a megbízás azonosítóját és a nézetet hordozza — a tárolás marad
   böngésző-lokális, de a hely megosztható és megjegyezhető. */
let hashLock = false;
function syncHash() {
  if (hashLock) return;
  const want = state.projectId ? `#/m/${encodeURIComponent(state.projectId)}/${state.view}` : "#/";
  if (location.hash === want) return;
  hashLock = true;
  try { history.replaceState(history.state, "", want); } finally { hashLock = false; }
}
function parseHash() {
  const m = /^#\/m\/([^/]+)(?:\/([a-z]+))?/.exec(location.hash || "");
  return m ? { id: decodeURIComponent(m[1]), view: m[2] || "attekintes" } : null;
}
// Két fül ugyanazon az origin-en eddig némán felülírta egymást. Nem oldjuk
// fel az ütközést automatikusan — megmondjuk, hogy megtörtént.
function watchExternalWrites() {
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY || !state.projectId) return;
    const fresh = lsGet(state.projectId);
    if (!fresh) { toast("Ezt a megbízást egy másik lapon törölték.", true); closeEngagement(); return; }
    if (fresh.updated_at && state.project && fresh.updated_at > (state.project.updated_at || "")) {
      toast("Ezt a megbízást egy másik lapon módosították — újratöltve.", true);
      state.project = fresh;
      render(state.view);
    }
  });
}

function emptyProjectJS(id, name) {
  return migrate({
    id, name: name || id,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    brief_raw: "", intake: null, brief_final: null, query: null, candidates: [], talent_map: null,
    exclusions: { companies: [], candidates: {}, allow_alumni: false, client_aliases: [] },
    strategy_chat: [],
    assessments: {}, ranking: null, attraction: {}, outreach: {}, outreach_status: {},
    baseline_response_rate: null, first_shortlist_at: null,
    pilot: { cooling_days: 7, mono_source_threshold: 0.7 },
    advisory: null, interview: null, coach_notes: [], memory: [], interactions: [],
  });
}

// ── Mező-fallbackok: az új sémanevek mellett a régi mentett adatot is olvassuk ──
const F = {
  clarif: (o) => (o && (o.clarification_points || o.bad_brief_flags)) || [],
  inferred: (o) => (o && (o.inferred_requirements || o.hidden_requirements)) || [],
  summary: (o) => (o && (o.profile_summary || o.seniority_read)) || "",
  signals: (o) => (o && (o.role_relevant_signals || o.fit_signals)) || [],
  qclarify: (o) => (o && (o.questions_to_clarify || o.gaps_to_explore)) || [],
  strength: (o) => (o && (o.key_strength || o.standout)) || "",
  prio: (r) => (r && (r.contact_priority != null ? r.contact_priority : r.pursue_priority)),
  meetPrep: (o) => (o && (o.meeting_preparation || o.seniority_framing)) || "",
  ivSignals: (o) => (o && (o.signals_to_clarify || o.red_flags_to_probe)) || [],
  coachRec: (o) => (o && (o.recommended_approach || o.what_a_senior_would_do)) || "",
};

// ── Segédek ─────────────────────────────────────────────────────────────
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
// A visszajelzés két csatornán megy: a látható buborék, és — mert a buborék
// képernyőolvasóval néma volt — egy élő régió. A hiba a riasztó régióba megy.
function announce(msg, isError) {
  const n = $(isError ? "#srAlert" : "#srLive");
  if (!n) return;
  n.textContent = "";
  setTimeout(() => { n.textContent = msg; }, 30);
}
function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("toast-err", !!isError);
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), isError ? 5200 : 2600);
  announce(msg, isError);
}

/* ── HIBAKEZELÉS ─────────────────────────────────────────────────────────
   A korábbi működés minden hibát egy 2,6 másodperces buborékba tett a nyers
   üzenettel („Hiba: HTTP 504"). Egy hatvan másodperces, elbukott művelet így
   nyomtalanul tűnt el: a képernyő pixelre ugyanaz maradt, mint kattintás
   előtt, tehát a hibát nem lehetett megkülönböztetni attól, hogy a felhasználó
   el sem indította. Ezért a hiba mostantól ODA kerül, ahol az eredményt
   vártuk, ott is marad, magyarul mondja meg az okot, és felkínálja a
   kijáratot — 504-nél azt, amit a README is javasol: mintaadatok. */
const TASK_TIMEOUT_MS = 55000;   // a Vercel-függvény 60 mp-es plafonja alatt

function apiError(status, msg) {
  const e = new Error(msg || `HTTP ${status}`);
  e.status = status;
  return e;
}
// Státuszkód → magyar ok + a belőle következő kijárat.
function errorInfo(e) {
  const st = e && e.status;
  if (e && e.name === "AbortError") {
    return e._userCancelled
      ? { title: "Megszakítva", detail: "A műveletet te állítottad le. Bármikor újraindíthatod.", retry: "Újraindítom" }
      : { title: "A művelet túllépte az időkorlátot",
          detail: "A kiszolgáló 60 másodpercnél tovább dolgozott volna. Élő webes kereséssel ez nagy lekérdezés-számnál előfordul.",
          retry: "Újrapróbálom", hint: "timeout" };
  }
  if (st === 504 || st === 408) {
    return { title: "A keresés túllépte a 60 másodperces korlátot",
      detail: "Az élő webes kutatás nem fejeződött be időben. A mintaadatok azonnal futnak, és ugyanezt a folyamatot végigjátsszák.",
      retry: "Újrapróbálom", hint: "timeout" };
  }
  if (st === 429) {
    return { title: "Elérted az óránkénti korlátot",
      detail: "Túl sok művelet indult rövid időn belül erről a hálózatról. Várj néhány percet, aztán folytasd.", retry: "Újrapróbálom" };
  }
  if (st === 401 || st === 403) {
    return { title: "A kiszolgáló elutasította a kérést",
      detail: "Az AI-kulcs hiányzik vagy lejárt. A mintaadatokkal a folyamat kulcs nélkül is végigjátszható.", hint: "timeout" };
  }
  if (st >= 500) {
    return { title: "A kiszolgáló hibát adott",
      detail: `A művelet nem fejeződött be (${st}). Ez általában átmeneti — próbáld újra.`, retry: "Újrapróbálom" };
  }
  if (st >= 400) {
    return { title: "A kérést nem lehetett feldolgozni", detail: e.message || `A kiszolgáló ${st} hibát adott.`, retry: "Újrapróbálom" };
  }
  // fetch-szintű bukás: hálózat vagy DNS
  return { title: "Nincs kapcsolat a kiszolgálóval",
    detail: "Ellenőrizd az internetkapcsolatot. A már elmentett megbízások offline is olvashatók.", retry: "Újrapróbálom" };
}

async function api(method, path, body, opts) {
  opts = opts || {};
  if (method === "POST" && /^\/api\/project\/[^/]/.test(path) && state.project) {
    body = { ...(body || {}), project: state.project };
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    throw new Error("network");        // errorInfo ebből ad hálózati üzenetet
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, data.error);
  return data;
}

/* ── VÁRAKOZÁS ───────────────────────────────────────────────────────────
   Egy 20–60 másodperces művelet korábban egyetlen 14px-es spinnert kapott egy
   gombon, aminek közben a felirata is eltűnt. A cél-panel eközben végig a
   régi üres állapotot mutatta. Most a várakozás oda kerül, ahol az eredmény
   lesz, a márkajel geometriájával: szűkülő sávok futnak a korall pontba. */
const SK_BARS = [11, 9, 7, 5];
function skeletonHtml(label, id) {
  return `<div class="task" id="${id}">
    <div class="task-head">
      <span class="task-label">${esc(label)}</span>
      <span class="task-time" id="${id}-t" aria-hidden="true"></span>
      <button class="btn btn-ghost task-cancel" id="${id}-c">Megszakítás</button>
    </div>
    <div class="task-funnel" aria-hidden="true">${SK_BARS.map((h, i) =>
      `<span class="task-bar" style="height:${h}px;animation-delay:${i * 0.16}s"></span>`).join("")}<span class="task-dot"></span></div>
    <div class="task-note" id="${id}-n">Ez 20–60 másodpercig tarthat.</div>
  </div>`;
}
function errorCardHtml(info, id, altLabel) {
  return `<div class="task task-error" id="${id}" role="group" aria-label="Hiba">
    <div class="task-head"><span class="task-label">${esc(info.title)}</span></div>
    <p class="task-note">${esc(info.detail)}</p>
    <div class="row task-acts">
      ${info.retry ? `<button class="btn btn-primary" id="${id}-r">${esc(info.retry)}</button>` : ""}
      ${altLabel ? `<button class="btn" id="${id}-a">${esc(altLabel)}</button>` : ""}
    </div>
  </div>`;
}

let taskSeq = 0;
/* withLoading(btn, fn) — a régi, rövid műveletekre változatlan szerződéssel.
   Az opts megadásával a hosszú műveletek megkapják a teljes kezelést:
   skeleton a cél-panelben, eltelt idő, megszakítás, és tartós hibakártya
   retry / alternatíva gombbal.
     opts.into      — a cél-panel szelektora (ide megy a skeleton és a hiba)
     opts.label     — mit csinál éppen, sima magyarul
     opts.alt       — { label, run } második kijárat (pl. váltás mintaadatokra) */
async function withLoading(btn, fn, opts) {
  opts = opts || {};
  const into = opts.into ? $(opts.into) : null;
  const id = "task" + ++taskSeq;
  const ctrl = new AbortController();
  let t0 = Date.now(), tick = null, timeout = null;

  const cleanup = () => {
    clearInterval(tick); clearTimeout(timeout);
    if (btn) { btn.classList.remove("loading"); btn.disabled = false; }
  };
  if (btn) { btn.classList.add("loading"); btn.disabled = true; }
  if (into) {
    into.innerHTML = skeletonHtml(opts.label || "Feldolgozás…", id);
    announce((opts.label || "Feldolgozás") + " — folyamatban.");
    const c = $("#" + id + "-c");
    if (c) c.onclick = () => { ctrl._userCancelled = true; ctrl.abort(); };
    // Az eltelt idő csak 5 másodperc után jelenik meg: rövid műveletnél
    // a számláló maga is zaj lenne.
    tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      const el2 = $("#" + id + "-t");
      if (el2 && s >= 5) el2.textContent = s + " mp";
      const n = $("#" + id + "-n");
      if (n && s >= 30) n.textContent = "Még dolgozik — az élő webes keresés a leglassabb lépés.";
    }, 1000);
  }
  timeout = setTimeout(() => ctrl.abort(), TASK_TIMEOUT_MS);

  try {
    const r = await fn(ctrl.signal);
    cleanup();
    // Ha a hívó nem írta felül a cél-panelt (mert pl. másik nézetre lépett),
    // a saját skeletonunkat magunk takarítjuk el — különben a visszatérő
    // felhasználó egy örökké „folyamatban" állapotot találna ott.
    const left = $("#" + id);
    if (left && left.classList.contains("task")) left.remove();
    return r;
  } catch (e) {
    cleanup();
    if (ctrl._userCancelled && e && e.name === "AbortError") e._userCancelled = true;
    const info = errorInfo(e);
    if (into) {
      const alt = opts.alt && info.hint === "timeout" ? opts.alt : null;
      into.innerHTML = errorCardHtml(info, id, alt ? alt.label : null);
      const r = $("#" + id + "-r");
      if (r && opts.retry) r.onclick = () => opts.retry();
      else if (r) r.onclick = () => { if (btn) btn.click(); };
      const a = $("#" + id + "-a");
      if (a && alt) a.onclick = () => alt.run();
      announce(info.title + " " + info.detail, true);
    } else {
      toast(info.title, true);
    }
    throw e;
  }
}
// A hosszú műveletek egy helyen kapják meg a védelmet: a kattintáskori
// megbízás-azonosítót elmentjük, és a válasz csak akkor íródik be, ha még
// ugyanaz a megbízás van nyitva. Enélkül egy közben elnavigáló felhasználó
// eredménye némán elveszett — miközben lefutott egy „kész" visszajelzés.
function stillOn(pid) { return state.project && state.project.id === pid; }
function demoTag(o) {
  return o && (o._demo || o._mode === "demo") ? '<span class="demo-tag">MINTA</span>' : "";
}
function aiTag(reviewed) {
  return reviewed
    ? '<span class="ai-status ok">Recruiter által jóváhagyva</span>'
    : '<span class="ai-status">AI-javaslat — még nincs ellenőrizve</span>';
}
/* ── EVIDENCIA-EREDET ────────────────────────────────────────────────────
   A termék tézise, hogy egy állítás mögött mi áll: forrás, következtetés vagy
   feltételezés. Ez eddig három majdnem egyforma pasztell pirulaként jelent
   meg — a legfontosabb megkülönböztetés volt a legkevésbé látható.
   Mostantól a FORMA hordozza a bizonyosságot, nem csak a szín: a tömör sáv
   igazolt, a körvonal következtetés, a szaggatott körvonal feltételezés.
   Ugyanaz a logika, mint a tölcséré — ahogy csökken a biztos, úgy fogy az
   anyag is. Színvakon és fekete-fehér nyomtatásban is olvasható marad. */
const EV_KINDS = {
  fact: { label: "Forrással igazolt", short: "igazolt" },
  inference: { label: "Következtetés", short: "következtetés" },
  assume: { label: "Ellenőrizendő feltételezés", short: "feltételezés" },
};
function evTag(kind, textOverride) {
  const k = EV_KINDS[kind] ? kind : "assume";
  return `<span class="ev-tag ev-${k}"><span class="ev-mark" aria-hidden="true"></span>${esc(textOverride || EV_KINDS[k].label)}</span>`;
}
function needEngagement() {
  if (!state.projectId) { toast("Nyiss meg egy megbízást."); return false; }
  return true;
}
function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return isNaN(d) ? null : d; }
// A „ma / tegnap" naptári nap, nem 24 óra. A nyers ms-különbség floor-olása
// miatt egy 23:50-kor mentett bejegyzés 00:10-kor még „tegnap"-ot mutatott.
function midnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function calDaysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.round((midnight(Date.now()) - midnight(t)) / 86400000);
}
function relTime(iso) {
  const d = calDaysSince(iso);
  if (d == null) return "—";
  if (d <= 0) return "ma";
  if (d === 1) return "tegnap";
  return `${d} napja`;
}
function shorten(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
function list(items) { return `<ul class="klist">${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`; }
function chips(items, cls) { return `<div class="chips">${(items || []).map((i) => `<span class="chip ${cls || ""}">${esc(i)}</span>`).join("")}</div>`; }
function tierLetter(t) { const s = String(t || ""); return s.startsWith("A") ? "A" : s.startsWith("B") ? "B" : s.startsWith("D") ? "D" : "C"; }

// ── Szerkeszthető lista (chip + törlés + hozzáadás) ─────────────────────
// Mindenhol ez adja a „vegyél hozzá / vegyél el” interakciót: brief-feltételek,
// keresési terv kategóriái, célpiac-térkép elemei.
function chipEditor(id, items, opts) {
  opts = opts || {};
  const label = (v) => (v && typeof v === "object" ? (v.name || v.query || "") : String(v == null ? "" : v));
  // Az „Eltávolítás" gomb korábban minden chipen ugyanazt a nevet viselte:
  // képernyőolvasóval N egyforma gomb, kontextus nélkül.
  const body = (items || []).map((v, i) =>
    `<span class="ed-chip ${opts.cls || ""}">${esc(label(v))}<button class="ed-x" data-i="${i}" title="Eltávolítás: ${esc(label(v))}" aria-label="Eltávolítás: ${esc(label(v))}">×</button></span>`).join("");
  const ph = opts.placeholder || "Új elem… (vesszővel több is)";
  return `<div class="ed-list" id="${id}">${body || `<span class="ed-empty">${esc(opts.empty || "— még üres —")}</span>`}
    <span class="ed-add"><input class="ed-in" placeholder="${esc(ph)}" aria-label="${esc(ph)}" /><button class="btn ed-plus" title="Hozzáadás" aria-label="Hozzáadás: ${esc(ph)}">+</button></span></div>`;
}
// onAdd: string[] · onRemove: index. A hívó a végén újrarendereli a nézetet.
function wireChipEditor(id, onAdd, onRemove) {
  const root = $("#" + id);
  if (!root) return;
  $$(".ed-x", root).forEach((b) => (b.onclick = (e) => { e.preventDefault(); onRemove(Number(b.dataset.i)); }));
  const inp = $(".ed-in", root), plus = $(".ed-plus", root);
  const commit = () => {
    const vals = inp.value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return;
    inp.value = "";
    onAdd(vals);
  };
  if (plus) plus.onclick = (e) => { e.preventDefault(); commit(); };
  if (inp) inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };
}
// A lenyíló blokkok nyitottsága túléli az újrarendert (a szerkesztés közben
// becsukódó panel a leggyakoribb apró bosszúság).
const openDetails = {};
function detailsOpen(id) { return openDetails[id] ? " open" : ""; }
function wireDetails(id) {
  const d = $("#" + id);
  if (d) d.ontoggle = () => { openDetails[id] = d.open; };
}
// Szerkesztés után: mentés, újrarender, és a fókusz visszaáll az input mezőre.
function afterChipEdit(renderFn, p, listId) {
  persist();
  renderFn(p);
  const i = $("#" + listId + " .ed-in");
  if (i) i.focus();
}
// Listaelem-azonosítás (címek, szinonimák, lekérdezések) — a cégnév-specifikus
// normCo-tól külön, mert az utótag-szűrés a szakmai kifejezéseket megcsonkítaná.
function normVal(v) {
  const s = v && typeof v === "object" ? (v.name || v.query || "") : v;
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
function addUnique(arr, vals) {
  let n = 0;
  (vals || []).forEach((v) => { if (!arr.some((x) => normVal(x) === normVal(v))) { arr.push(v); n++; } });
  return n;
}
function srcLabel(s) {
  return { linkedin: "LinkedIn", github: "GitHub", synthetic: "Mintaadat", web: "Web", blog: "Blog", community: "Közösség", xing: "Xing", stackoverflow: "StackOverflow", social: "Social", "egyéb": "Egyéb" }[s] || (s || "Egyéb");
}
function sentiLabel(s) { return { "pozitív": "pozitív válasz", "semleges": "semleges válasz", "negatív": "negatív válasz" }[s] || s; }
function sentiChip(s) { const m = { "pozitív": "good", "semleges": "warn", "negatív": "bad" }; return `<span class="chip ${m[s] || ""}">${esc(sentiLabel(s))}</span>`; }

/* ── KIZÁRÁSI MOTOR (ügyfél saját emberei + off-limits cégek) ────────────
   A hiring manager a saját (volt) munkatársait ismeri — ha ilyen név kerül a
   listára, az egész merítés hitelét viszi. A szabály nem törli a találatot
   (a néma törlés is bizalomvesztés), hanem külön sávra teszi, megindokolja,
   és a recruiter egy kattintással visszahozhatja.                          */
const CO_NOISE = /\b(kft|zrt|bt|nyrt|kkt|rt|ltd|limited|inc|llc|plc|gmbh|ag|sa|nv|bv|oy|ab|as|sp|zoo|co|company|group|holding|technologies|technology|tech|solutions|services|systems|software|labs|digital|international|hungary|magyarorszag|europe)\b/g;
function normCo(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[()\[\]{}.,\/&+'"’`|-]/g, " ").replace(CO_NOISE, " ").replace(/\s+/g, " ").trim();
}
// Két cégnév ugyanazt a céget jelöli-e (token-halmaz alapú, ragok/utótagok nélkül).
function coMatch(a, b) {
  const x = normCo(a), y = normCo(b);
  if (x.length < 3 || y.length < 3) return false;
  if (x === y) return true;
  const tx = x.split(" ").filter((t) => t.length > 2), ty = y.split(" ").filter((t) => t.length > 2);
  if (!tx.length || !ty.length) return false;
  return ty.every((t) => tx.includes(t)) || tx.every((t) => ty.includes(t));
}
function clientNames(p) {
  return [((p.position || {}).client || ""), ...((p.exclusions || {}).client_aliases || [])].filter(Boolean);
}
// null = a merítésben marad. Egyébként { kind, label, detail, soft }.
function exclusionFor(p, c) {
  if (!p || !c) return null;
  const ex = p.exclusions || {};
  const man = (ex.candidates || {})[c.id];
  if (man && man.state === "include") return null;                       // recruiter: mégis vigyük
  if (man && man.state === "exclude") return { kind: "manual", label: "Kézzel kizárva", detail: man.reason || "A recruiter vette ki a merítésből." };
  const cur = c.current_company || "", past = c.past_companies || [];
  for (const cn of clientNames(p)) {
    if (coMatch(cur, cn)) return { kind: "client_current", label: "Az ügyfélnél dolgozik", detail: `Jelenlegi munkahelye: ${cur} — ez az ügyfél (${cn}).` };
  }
  for (const cn of clientNames(p)) {
    for (const pc of past) if (coMatch(pc, cn)) return { kind: "client_alumni", label: "Korábban az ügyfélnél dolgozott", detail: `Volt munkahelye: ${pc} — az ügyfél ismeri.`, soft: true };
  }
  for (const o of ex.companies || []) {
    if (coMatch(cur, o)) return { kind: "offlimits", label: "Off-limits cég", detail: `${cur} szerepel a kizárt cégek között.` };
    for (const pc of past) if (coMatch(pc, o)) return { kind: "offlimits_past", label: "Off-limits cégnél dolgozott", detail: `${pc} szerepel a kizárt cégek között.`, soft: true };
  }
  return null;
}
// A „soft” kizárás (alumni) feloldható egyetlen kapcsolóval a Célpiac nézetben.
function isExcluded(p, c) {
  const e = exclusionFor(p, c);
  if (!e) return false;
  if (e.soft && (p.exclusions || {}).allow_alumni) return false;
  return true;
}
function activeCandidates(p) { return ((p && p.candidates) || []).filter((c) => !isExcluded(p, c)); }
function excludedCandidates(p) { return ((p && p.candidates) || []).filter((c) => isExcluded(p, c)); }
function setCandExclusion(p, id, state, reason) {
  p.exclusions.candidates = p.exclusions.candidates || {};
  if (state) p.exclusions.candidates[id] = { state, reason: reason || "", at: new Date().toISOString() };
  else delete p.exclusions.candidates[id];
  persist();
}

// A jelölt effektív prioritása: a recruiter felülbírálata győz az AI-javaslat felett.
function effTier(p, id) {
  const ov = p.priority_overrides && p.priority_overrides[id];
  if (ov) return ov;
  const r = ((p.ranking && p.ranking.ranked) || []).find((x) => x.candidate_id === id);
  return r ? tierLetter(r.tier) : null;
}
function orState(p, id) {
  const st = (p.outreach_status || {})[id] || {};
  return {
    hasAttr: !!(p.attraction || {})[id],
    hasDraft: !!(p.outreach || {})[id],
    reviewed: !!st.reviewed_at,
    sent: !!st.sent_at,
    replied: !!st.replied,
    sentiment: st.sentiment,
  };
}
function candById(p, id) { return ((p && p.candidates) || []).find((c) => c.id === id); }

/* ── ÁLLAPOT-LÉTRA ───────────────────────────────────────────────────────
   Egyetlen hely mondja meg, hol tart egy jelölt. Korábban ugyanez a létra
   több helyen volt kézzel újraírva, eltérő sorrendben — ebből származott,
   hogy a felület több, egymásnak ellentmondó sorrendet tanított.
   A kulcsok finomak; a felület ezekből durvít oszlopokra.                */
const STAGE_LABEL = {
  kizart: "kizárva a merítésből",
  rangsorolatlan: "prioritás beállítása",
  figyelo: "figyelőlista",
  elvetve: "most nem javasolt",
  nincs_terv: "megközelítési terv készítése",
  nincs_vazlat: "üzenetvázlat készítése",
  jovahagyasra: "vázlat ellenőrzése",
  kuldesre: "kiküldés rögzítése",
  kikuldve: "válaszra vár",
  valaszolt: "folyamatban",
};
// A kizárás mindent megelőz: van A prioritású jelölt, aki az ügyfélnél dolgozik.
function candStage(p, c) {
  if (!c) return "rangsorolatlan";
  if (isExcluded(p, c)) return "kizart";
  const t = effTier(p, c.id);
  if (!t) return "rangsorolatlan";
  if (t === "C") return "figyelo";
  if (t === "D") return "elvetve";
  const s = orState(p, c.id);
  if (!s.hasAttr) return "nincs_terv";
  if (!s.hasDraft) return "nincs_vazlat";
  if (!s.reviewed && !s.sent) return "jovahagyasra";
  if (!s.sent) return "kuldesre";
  if (!s.replied) return "kikuldve";
  return "valaszolt";
}
// Egy jelölt teljes, származtatott sora. Semmit nem tárol — minden mező a
// meglévő projekt-mezőkből számolódik.
function candRow(p, c, ranked) {
  const id = c.id;
  const r = ranked || ((p.ranking && p.ranking.ranked) || []).find((x) => x.candidate_id === id) || {};
  return {
    id, cand: c,
    tier: effTier(p, id),
    stage: candStage(p, c),
    excluded: isExcluded(p, c),
    priority: F.prio(r),
    reason: F.strength((p.assessments || {})[id]) || shorten(r.rationale, 88),
    ...orState(p, id),
    touched: daysSince(c.last_touched),
  };
}
// A tábla öt oszlopa és két sávja. Minden jelölt pontosan egy vödörbe kerül.
const STAGE_BUCKET = {
  kizart: "kizart",
  rangsorolatlan: "rangsorolatlan",
  figyelo: "figyelolista", elvetve: "figyelolista",
  nincs_terv: "elokeszites", nincs_vazlat: "elokeszites",
  jovahagyasra: "jovahagyasra", kuldesre: "jovahagyasra",
  kikuldve: "kikuldve",
  valaszolt: "valaszolt",
};
function boardBuckets(p) {
  const out = { rangsorolatlan: [], elokeszites: [], jovahagyasra: [], kikuldve: [], valaszolt: [], figyelolista: [], kizart: [] };
  for (const c of (p && p.candidates) || []) out[STAGE_BUCKET[candStage(p, c)]].push(candRow(p, c));
  return out;
}

// A/B prioritású jelöltek munkalistája (a felülbírálatokkal együtt).
// A rangsor sorrendjében iterál — a stabil sorrend a lista sajátja.
function pipelineRows(p) {
  const ranked = (p.ranking && p.ranking.ranked) || [];
  const coolDays = (p.pilot && p.pilot.cooling_days) || 7;
  const rows = [];
  for (const r of ranked) {
    const cand = candById(p, r.candidate_id);
    if (!cand) continue;
    const row = candRow(p, cand, r);
    if (row.tier !== "A" && row.tier !== "B") continue;
    if (row.excluded) continue;          // kizárt jelölt nem kerül a munkalistára
    rows.push(row);
  }
  rows.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  return { rows, coolDays };
}

/* ── Következő teendő (megbízásonként egy kiemelt lépés) ─────────────────
   Szabálytábla, nem if-létra: a szabályok sorrendben értékelődnek, az első
   találó nyer. Így egy nézet átnevezése egy mező átírása, nem vezérlési
   szerkezet átszabása.                                                   */
// Kihűlés: kiküldött megkeresés, amire régóta nincs válasz és nincs lépés.
// Korábban a „következő teendő” és a „figyelmet igényel” eltérő feltételt
// használt (sent vs. hasAttr) — ugyanarra a fogalomra, két helyen.
function isCooling(r, coolDays) {
  return r.sent && !r.replied && (r.touched == null || r.touched > coolDays);
}
const NEXT_STEP_RULES = [
  { when: (x) => !x.p.brief_raw && !x.p.intake, view: "pozicio", cta: "Pozíció és brief",
    label: () => "Illeszd be a briefet, majd futtasd az elemzést", sub: () => "A megbízás a brief tisztázásával indul" },
  { when: (x) => !x.p.intake, view: "pozicio", cta: "Pozíció és brief",
    label: () => "Brief elemzése", sub: () => "A brief megvan — kérj javasolt pozíció-összefoglalót" },
  { when: (x) => !x.c.length && x.p.intake_review !== "approved", view: "pozicio", cta: "Pozíció és brief",
    label: () => "Véglegesítsd a briefet", sub: () => "Szerkeszd a javaslatot, és hagyd jóvá — erre épül a keresés" },
  { when: (x) => !x.c.length && !x.p.query, view: "celpiac", cta: "Célpiac",
    label: () => "Keresési terv készítése", sub: () => "Ez adja a jelöltkutatás alapját" },
  { when: (x) => !x.c.length, view: "celpiac", cta: "Célpiac",
    label: () => "Jelöltkutatás indítása", sub: () => "A keresési terv kész — indíthatod a kutatást" },
  { when: (x) => !x.p.ranking, view: "jeloltek", cta: "Jelöltek",
    label: (x) => "Prioritási javaslat készítése", sub: (x) => `${x.c.length} jelölt vár prioritásra` },
  { when: (x) => x.newC, view: "jeloltek", cta: "Jelöltek",
    label: (x) => `Ellenőrizd a(z) ${x.newC} új jelöltet`, sub: () => "Az új találatok még nincsenek átnézve" },
  { when: (x) => x.blocked.length, view: "jeloltek", cta: "Jelöltek",
    label: (x) => `${x.blocked.length} jelöltnél hiányzik a megközelítési terv vagy az üzenetvázlat`, sub: () => "A prioritásos jelöltek megkereséséhez ezek kellenek" },
  { when: (x) => x.toReview.length, view: "jeloltek", cta: "Jelöltek",
    label: (x) => `${x.toReview.length} üzenetvázlat vár ellenőrzésre`, sub: () => "Kiküldés előtt hagyd jóvá a vázlatokat" },
  { when: (x) => x.toSend.length, view: "jeloltek", cta: "Jelöltek",
    label: (x) => `${x.toSend.length} jóváhagyott üzenetvázlat vár kiküldésre`, sub: () => "Küldd ki a saját csatornádon, és rögzítsd itt" },
  { when: (x) => x.cooling.length, view: "jeloltek", cta: "Jelöltek",
    label: (x) => `${x.cooling.length} jelöltnél régóta nincs lépés — utánkövetés`, sub: (x) => `${x.coolDays}+ napja nincs aktivitás` },
  { when: (x) => x.awaiting.length, view: "jeloltek", cta: "Jelöltek",
    label: () => "Rögzítsd a beérkező válaszokat", sub: (x) => `${x.awaiting.length} kiküldött megkeresésre várunk választ` },
  { when: () => true, view: "eredmenyek", cta: "Eredmények",
    label: () => "Nézd át az eredményeket", sub: () => "Minden folyamatban lévő lépés naprakész" },
];
function nextStep(p) {
  if (!p) return null;
  const c = activeCandidates(p);
  const { rows, coolDays } = pipelineRows(p);
  const x = {
    p, c, coolDays, rows,
    newC: c.filter((y) => y.is_new).length,
    blocked: rows.filter((r) => !(r.hasAttr && r.hasDraft)),
    toReview: rows.filter((r) => r.hasDraft && !r.reviewed && !r.sent),
    toSend: rows.filter((r) => r.reviewed && !r.sent),
    cooling: rows.filter((r) => isCooling(r, coolDays)),
    awaiting: rows.filter((r) => r.sent && !r.replied),
  };
  const rule = NEXT_STEP_RULES.find((r) => r.when(x));
  return rule ? { view: rule.view, label: rule.label(x), sub: rule.sub(x), cta: rule.cta } : null;
}

// Figyelmet igényel? (nyitóképernyő jelzéshez)
function needsAttention(p) {
  if (!p.ranking) return false;
  const { rows, coolDays } = pipelineRows(p);
  const blocked = rows.filter((r) => !(r.hasAttr && r.hasDraft)).length;
  const cooling = rows.filter((r) => isCooling(r, coolDays)).length;
  return blocked > 0 || cooling > 0;
}

// ── STATUS (rendszerállapot) ────────────────────────────────────────────
async function loadStatus() {
  const s = await api("GET", "/api/status");
  state.status = s;
  // Egy helyen él: korábban ugyanez a két jelvény egyszerre látszott az
  // oldalsáv alján és a felső sávban, egymástól ezer pixelre.
  const live = `<span class="badge ${s.brain ? "badge-live" : "badge-demo"}">${s.brain ? "AI elérhető" : "Bemutató mód"}</span>`;
  const src = `<span class="badge ${s.reach_live ? "badge-live" : "badge-demo"}">${s.reach_live ? "Nyilvános webes források" : "Mintaadatok"}</span>`;
  $("#badges").innerHTML = live + src;
  $("#modelLine").textContent = `modell: ${s.model} · ${s.knowledge_version}`;
  const sel = $("#sourceSel");
  if (sel && !s.reach_live) sel.value = "synthetic";
}

// ── NÉZET-VÁLTÁS ────────────────────────────────────────────────────────
// A böngészőben eltárolt nézetnév túléli a felület átalakítását. Ha egy nézet
// megszűnik vagy átnevezik, a visszatérő látogató enélkül üres munkateret kap.
/* Három fázis, mert a munka valóban háromféle: egyszeri előkészítés,
   ismétlődő jelöltmunka, lezárás. A fázis megmondja, mibe kell ma
   belenyúlni és mibe nem. */
const PHASES = [
  { key: "elokeszites", label: "1 · Előkészítés", views: [
    ["pozicio", "Brief és pozíció"],
    ["ugyfel", "Ügyfél-egyeztetés"],
    ["celpiac", "Célpiac"],
  ] },
  { key: "merites", label: "2 · Merítés és megkeresés", views: [
    ["jeloltek", "Jelöltek"],
    ["interju", "Interjúterv"],
  ] },
  { key: "lezaras", label: "3 · Lezárás", views: [
    ["eredmenyek", "Eredmények"],
  ] },
];
const VIEWS = ["home", "attekintes"].concat(...PHASES.map((f) => f.views.map(([v]) => v)));
// A jegyzet már nem nézet, hanem fiók — a régi nézetnév oda irányít.
const LEGACY_VIEW_REDIRECT = { megkeresesek: "jeloltek", jegyzetek: "attekintes" };
function showView(v) {
  if (LEGACY_VIEW_REDIRECT[v]) v = LEGACY_VIEW_REDIRECT[v];
  if (!VIEWS.includes(v)) v = state.project ? "attekintes" : "home";
  if (v !== "home" && !state.project) v = "home";
  state.view = v;
  $("#view-home").classList.toggle("active", v === "home");
  $("#workspace").classList.toggle("hidden", v === "home");
  $$(".eng-view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
  $("#engNav").classList.toggle("hidden", !state.project);
  if (state.project) {
    $("#engNavLabel").textContent = shorten(state.project.position.title || state.project.name, 26);
    renderEngNav(state.project);
  }
  $$("[data-view]").forEach((s) => s.classList.toggle("active", s.dataset.view === v));
  renderSubNav();
  renderBotNav();
  render(v);
  saveUi();
}
// Van-e már pozitív válasz? Ez oldja fel az interjútervet — és ez NEM
// ugyanaz, mint hogy „érkezett válasz”: a negatív válasz nem nyit interjút.
function hasPositiveReply(p) {
  return Object.values((p && p.outreach_status) || {}).some((s) => s && s.replied && s.sentiment === "pozitív");
}
// Mennyi munka áll az egyes fázisokban — a fázisfejléc ezt mutatja.
function phaseState(p, key) {
  if (key === "elokeszites") {
    const done = !!p.intake && p.intake_review === "approved" && !!(p.query || p.talent_map);
    return { done, note: done ? "✓" : "" };
  }
  if (key === "merites") {
    const b = boardBuckets(p);
    const open = b.rangsorolatlan.length + b.elokeszites.length + b.jovahagyasra.length;
    const total = open + b.kikuldve.length + b.valaszolt.length;
    return { done: total > 0 && open === 0, note: total ? `${open}/${total}` : "" };
  }
  const sent = Object.values(p.outreach_status || {}).some((s) => s && s.sent_at);
  return { done: p.status === "Betöltve" || p.status === "Lezárva", note: sent ? "" : "" };
}
const BOT_SLOTS = [
  { key: "attekintes", label: "Áttekintés", icon: "◎", view: "attekintes" },
  { key: "elokeszites", label: "Felkészülés", icon: "◔", phase: "elokeszites" },
  { key: "jeloltek", label: "Jelöltek", icon: "▦", view: "jeloltek" },
  { key: "lezaras", label: "Eredmény", icon: "◆", phase: "lezaras" },
  { key: "more", label: "Több", icon: "⋯" },
];
function phaseOf(view) {
  const f = PHASES.find((x) => x.views.some(([v]) => v === view));
  return f ? f.key : null;
}
function renderBotNav() {
  const nav = $("#botNav");
  if (!nav) return;
  // A nyitóképernyőn nincs megbízás-navigáció — ugyanaz a szabály, mint az oldalsávban.
  nav.classList.toggle("hidden", !state.project || state.view === "home");
  if (!state.project) return;
  const cur = state.view === "jeloltek" ? "jeloltek" : (phaseOf(state.view) || state.view);
  nav.innerHTML = BOT_SLOTS.map((s) => {
    const on = s.key === "more" ? state.moreOpen
      : s.key === "jeloltek" ? state.view === "jeloltek"
      : s.view ? state.view === s.view : (cur === s.phase && state.view !== "jeloltek");
    return `<button class="botnav-b${on ? " on" : ""}" data-bot="${s.key}" aria-current="${on ? "page" : "false"}">
      <span class="botnav-i" aria-hidden="true">${s.icon}</span><span class="botnav-l">${esc(s.label)}</span></button>`;
  }).join("");
  $$(".botnav-b", nav).forEach((b) => (b.onclick = () => {
    const slot = BOT_SLOTS.find((s) => s.key === b.dataset.bot);
    if (slot.key === "more") return toggleMoreSheet();
    closeMoreSheet();
    if (slot.view) return showView(slot.view);
    const f = PHASES.find((x) => x.key === slot.phase);
    if (f) showView(f.views[0][0]);
  }));
}
// A fázison belüli lépések: keskeny képernyőn ez váltja ki az oldalsávot.
function renderSubNav() {
  const box = $("#subNav");
  if (!box) return;
  const fk = phaseOf(state.view);
  const f = PHASES.find((x) => x.key === fk);
  const show = !!state.project && !!f && f.views.length > 1 && state.view !== "jeloltek";
  box.classList.toggle("hidden", !show);
  if (!show) { box.innerHTML = ""; return; }
  // Ez navigáció, nem fülsáv: a role="tablist" panelek nélkül olyasmit ígért
  // a képernyőolvasónak, ami nem létezett. Nézetváltás → aria-current.
  const gate = !hasPositiveReply(state.project);
  box.innerHTML = `<span class="subnav-lbl">${esc(f.label)}</span>` + f.views.map(([v, lbl]) =>
    `<button class="subnav-b${v === state.view ? " on" : ""}${v === "interju" && gate ? " locked" : ""}" data-view="${v}" aria-current="${v === state.view ? "page" : "false"}">${esc(lbl)}</button>`).join("");
}
function toggleMoreSheet() { state.moreOpen ? closeMoreSheet() : openMoreSheet(); }
function closeMoreSheet() {
  if (!state.moreOpen) return;
  state.moreOpen = false;
  $("#moreSheet").classList.add("hidden");
  syncScrim();
  renderBotNav();
}
function openMoreSheet() {
  if (!state.project) return;
  closeDrawer(); closeNotesDrawer();
  state.moreOpen = true;
  const p = state.project;
  $("#moreBody").innerHTML = `
    <button class="sheet-row" id="msNotes"><b>Napló</b><span>Jegyzetek és módszertani segítség</span></button>
    <button class="sheet-row" data-view="ugyfel"><b>Ügyfél-egyeztetés</b><span>Felkészülés a hiring managerrel</span></button>
    <button class="sheet-row" data-view="interju"><b>Interjúterv</b><span>Kompetencia-alapú kérdések</span></button>
    <div class="sheet-sec">
      <label class="cov-label">Státusz</label>
      <select id="msStatus" aria-label="Megbízás státusza">${STATUSES.map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
    </div>
    <div class="sheet-row-inline">
      <button class="btn" id="msExport">Export</button>
      <button class="btn btn-ghost" id="msBack">← Megbízások</button>
    </div>
    <div class="sheet-foot">${$("#badges").innerHTML}<div class="mut" style="margin-top:6px">${esc(($("#modelLine") || {}).textContent || "")}</div></div>`;
  $("#moreSheet").classList.remove("hidden");
  syncScrim();
  renderBotNav();
  $("#msNotes").onclick = () => { closeMoreSheet(); openNotesDrawer(); };
  $$("#moreBody [data-view]").forEach((b) => (b.onclick = () => { closeMoreSheet(); showView(b.dataset.view); }));
  $("#msStatus").onchange = (e) => { p.status = e.target.value; persist(); render(state.view); toast("Státusz frissítve."); };
  $("#msExport").onclick = () => { closeMoreSheet(); const b = $("#exportBtn"); if (b) b.click(); };
  $("#msBack").onclick = () => { closeMoreSheet(); closeEngagement(); };
}
function renderEngNav(p) {
  const box = $("#engSteps");
  if (!box) return;
  const gate = !hasPositiveReply(p);
  box.innerHTML = `<a href="#" class="step" data-view="attekintes"><span class="dot"></span>Áttekintés</a>` +
    PHASES.map((f) => {
      const st = phaseState(p, f.key);
      return `<div class="phase${st.done ? " done" : ""}">
        <div class="phase-head"><span class="phase-tick">${st.done ? "✓" : "·"}</span>${esc(f.label)}${st.note ? `<span class="phase-note">${esc(st.note)}</span>` : ""}</div>
        ${f.views.map(([v, lbl]) =>
          `<a href="#" class="step sub${v === "interju" && gate ? " locked" : ""}" data-view="${v}"><span class="dot"></span>${esc(lbl)}${v === "interju" && gate ? `<span class="step-lock" title="Az első pozitív válasz oldja fel">zárva</span>` : ""}</a>`).join("")}
      </div>`;
    }).join("");
}
function render(v) {
  if (v === "home") return renderHome();
  const p = state.project;
  if (!p) return;
  renderEngHeader(p);
  if (v === "attekintes") renderOverview(p);
  if (v === "pozicio") renderPositionView(p);
  if (v === "celpiac") renderCelpiac(p);
  if (v === "jeloltek") renderCandidatesView(p);
  if (v === "ugyfel") renderAdvisory(p.advisory);
  if (v === "interju") renderInterviewView(p);
  if (v === "eredmenyek") renderResults(p);
}
function openEngagement(id, view) {
  const p = lsGet(id);
  if (!p) { toast("A megbízás nem található ebben a böngészőben."); return; }
  state.projectId = id;
  state.project = p;
  state.panelTab = "profil";
  closeDrawer();
  showView(view || "attekintes");
}
function closeEngagement() {
  state.projectId = null;
  state.project = null;
  closeDrawer();
  closeNotesDrawer();
  const te = $("#topEng"); if (te) te.innerHTML = "";
  showView("home");
}

// ── MEGBÍZÁSOK NYITÓKÉPERNYŐ ────────────────────────────────────────────
const HOME_FILTERS = [
  ["aktiv", "Aktív"], ["figyelem", "Figyelmet igényel"], ["varakozik", "Várakozik"], ["lezart", "Lezárt"], ["archivalt", "Archivált"], ["mind", "Mind"],
];
function homeFilterFn(key) {
  return (p) => {
    const closed = p.status === "Betöltve" || p.status === "Lezárva";
    if (key === "archivalt") return !!p.archived;
    if (p.archived) return key === "mind";      // az archivált csak a „Mind"-ben és a saját szűrőjében jön elő
    if (key === "aktiv") return !closed;
    if (key === "figyelem") return !closed && needsAttention(p);
    if (key === "varakozik") return p.status === "Várakozik az ügyfélre" || p.status === "Szüneteltetve";
    if (key === "lezart") return closed;
    return true;
  };
}
function renderHome() {
  const all = lsListFull();
  const listEl = $("#engList");
  // Nulla megbízásnál eddig öt szűrőpirula renderelődött a „Még nincs
  // megbízás" kártya fölé — öt szűrő, ami semmit sem szűr —, és az űrlap
  // megnyitása után is ott maradt az üres állapot saját, immár értelmetlen
  // „Új megbízás" gombja. Egyszerre egy hívás legyen a képernyőn.
  if (!all.length) {
    $("#engFilters").innerHTML = "";
    renderNewEngForm();
    listEl.innerHTML = state.newEngStep ? "" : `<div class="eng-empty"><h3>Még nincs megbízás</h3>
      <p>Egy megbízás = egy ügyfél egy konkrét pozíciója. A brieftől a shortlistig itt fut végig.</p>
      <button class="btn btn-primary" id="emptyNewBtn">Első megbízás létrehozása</button></div>`;
    const b = $("#emptyNewBtn"); if (b) b.onclick = () => openNewEngForm();
    return;
  }
  const counts = {};
  HOME_FILTERS.forEach(([k]) => (counts[k] = all.filter(homeFilterFn(k)).length));
  $("#engFilters").innerHTML = HOME_FILTERS.filter(([k]) => counts[k] || k === state.homeFilter || k === "aktiv" || k === "mind")
    .map(([k, lbl]) => `<button class="filter-pill ${state.homeFilter === k ? "active" : ""}" data-f="${k}" aria-pressed="${state.homeFilter === k}">${lbl}<span class="pill-n">${counts[k]}</span></button>`).join("");
  $$("#engFilters .filter-pill").forEach((b) => (b.onclick = () => { state.homeFilter = b.dataset.f; saveUi(); renderHome(); }));
  const filtered = all.filter(homeFilterFn(state.homeFilter));
  listEl.innerHTML = filtered.length ? `<div class="eng-grid">` + filtered.map((p) => {
    const ns = nextStep(p);
    const attn = needsAttention(p);
    const fi = funnelInfo(p);
    const phaseIdx = PHASES.findIndex((f) => f.views.some(([vv]) => vv === (ns ? ns.view : "")));
    const meta2 = [p.position.location, p.position.work_mode, p.position.owner ? "Felelős: " + p.position.owner : ""].filter(Boolean).join(" · ");
    return `<div class="eng-card${p.archived ? " archived" : ""}" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.position.title || p.name)} megnyitása">
      <div class="eng-card-top">
        <div><div class="eng-title">${esc(p.position.title || p.name)}</div><div class="eng-client">${esc(p.position.client || "—")}</div></div>
        <span class="status-chip ${p.archived ? "" : STATUS_CLS[p.status] || ""}">${p.archived ? "archivált" : esc(p.status)}</span>
      </div>
      <div class="pg-mini" title="${fi.felkutatva} felkutatva · ${fi.prioritasos} prioritásos · ${fi.megkeresve} megkeresve · ${fi.valaszolt} válaszolt">
        <span class="ph-dots">${PHASES.map((f, i) => `<span class="ph-dot${i <= phaseIdx ? " on" : ""}"></span>`).join("")}</span>
        <span class="v">${fi.felkutatva} · ${fi.prioritasos} · ${fi.megkeresve} · ${fi.valaszolt}</span>
      </div>
      ${meta2 ? `<div class="eng-meta">${esc(meta2)}</div>` : ""}
      ${ns ? `<div class="eng-next"><b>Következő:</b> ${esc(ns.label)}</div>` : ""}
      <div class="eng-card-foot">
        <span>${(p.candidates || []).length} jelölt</span><span>·</span><span>${relTime(p.updated_at)}</span>
        <span class="spacer"></span>
        ${attn ? `<span class="attn-flag">figyelmet igényel</span>` : ""}
      </div>
    </div>`;
  }).join("") + `</div>` : `<div class="eng-empty"><h3>Nincs megbízás ebben a szűrőben</h3><p>Válts szűrőt, vagy hozz létre újat.</p></div>`;
  $$("#engList .eng-card").forEach((r) => {
    r.onclick = () => openEngagement(r.dataset.id);
    r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEngagement(r.dataset.id); } };
  });
  renderNewEngForm();
}

// Új megbízás — két lépés: 1) alapadatok, 2) brief
function openNewEngForm() {
  state.newEngStep = 1;
  renderHome();
  $("#newEngForm").scrollIntoView({ behavior: "smooth", block: "start" });
  const f = $("#ne_title"); if (f) f.focus();
}
function slugify(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function renderNewEngForm() {
  const box = $("#newEngForm");
  if (!state.newEngStep) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  box.classList.remove("hidden");
  const d = renderNewEngForm._draft || (renderNewEngForm._draft = { ...emptyPosition(), brief: "" });
  if (state.newEngStep === 1) {
    box.innerHTML = `<div class="new-eng">
      <h3>Új megbízás — 1/2 · Alapadatok</h3>
      <div class="step-note">Egy megbízás = egy ügyfél egy konkrét pozíciója.</div>
      <div class="form-grid">
        <div class="fld"><label for="ne_title">Pozíció neve <abbr title="kötelező">*</abbr></label><input id="ne_title" required aria-required="true" value="${esc(d.title)}" placeholder="pl. Staff Backend Engineer" /></div>
        <div class="fld"><label for="ne_client">Ügyfél <abbr title="kötelező">*</abbr></label><input id="ne_client" required aria-required="true" value="${esc(d.client)}" placeholder="pl. Acme Payments" /></div>
        <div class="fld"><label for="ne_location">Helyszín</label><input id="ne_location" value="${esc(d.location)}" placeholder="pl. Budapest" /></div>
        <div class="fld"><label for="ne_work">Munkavégzés</label><select id="ne_work">${WORK_MODES.map((m) => `<option value="${m}" ${d.work_mode === m ? "selected" : ""}>${m || "—"}</option>`).join("")}</select></div>
        <div class="fld"><label for="ne_seniority">Tapasztalati szint</label><input id="ne_seniority" value="${esc(d.seniority)}" placeholder="pl. Staff / Senior" /></div>
        <div class="fld"><label for="ne_owner">Felelős recruiter</label><input id="ne_owner" value="${esc(d.owner)}" placeholder="pl. Zita" /></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary" id="ne_next">Tovább a briefhez</button>
        <button class="btn btn-ghost" id="ne_cancel">Mégse</button>
      </div>
    </div>`;
    // A begépelt érték azonnal a draftba kerül, hogy egy közbeeső újrarender
    // (pl. szűrő-kattintás) ne veszítse el.
    const syncStep1 = () => {
      d.title = $("#ne_title").value.trim();
      d.client = $("#ne_client").value.trim();
      d.location = $("#ne_location").value.trim();
      d.work_mode = $("#ne_work").value;
      d.seniority = $("#ne_seniority").value.trim();
      d.owner = $("#ne_owner").value.trim();
    };
    ["ne_title", "ne_client", "ne_location", "ne_work", "ne_seniority", "ne_owner"].forEach((id) => {
      const inp = $("#" + id);
      if (inp) inp.oninput = syncStep1;
    });
    // A hiányzó kötelező mezőt a mezőnél jelezzük és oda visszük a fókuszt,
    // nem csak egy elszálló buborékban mondjuk meg.
    const failField = (id, msg) => {
      const inp = $("#" + id);
      if (inp) { inp.classList.add("invalid"); inp.setAttribute("aria-invalid", "true"); inp.focus(); inp.oninput = () => { inp.classList.remove("invalid"); inp.removeAttribute("aria-invalid"); syncStep1(); }; }
      toast(msg, true);
    };
    $("#ne_next").onclick = () => {
      syncStep1();
      if (!d.title) return failField("ne_title", "A pozíció neve kötelező.");
      if (!d.client) return failField("ne_client", "Az ügyfél neve kötelező.");
      state.newEngStep = 2;
      renderNewEngForm();
      const b2 = $("#ne_brief"); if (b2) b2.focus();
    };
    $("#ne_cancel").onclick = () => { state.newEngStep = 0; renderNewEngForm._draft = null; renderHome(); };
  } else {
    box.innerHTML = `<div class="new-eng">
      <h3>Új megbízás — 2/2 · Brief</h3>
      <div class="step-note">${esc(d.title)} · ${esc(d.client)} — illeszd be a hiring manager nyers briefjét (később is megteheted).</div>
      <label class="sr-only" for="ne_brief">A hiring manager nyers briefje</label>
      <textarea id="ne_brief" class="brief" placeholder="Illeszd be a nyers briefet ide…">${esc(d.brief)}</textarea>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-primary" id="ne_create">Megbízás létrehozása</button>
        <button class="btn btn-ghost" id="ne_back">← Vissza</button>
      </div>
    </div>`;
    $("#ne_brief").oninput = () => { d.brief = $("#ne_brief").value; };
    $("#ne_back").onclick = () => { d.brief = $("#ne_brief").value; state.newEngStep = 1; renderNewEngForm(); };
    $("#ne_create").onclick = () => {
      d.brief = $("#ne_brief").value;
      let id = slugify(`${d.client}-${d.title}`) || "megbizas";
      const all = lsAll();
      if (all[id]) { let i = 2; while (all[`${id}-${i}`]) i++; id = `${id}-${i}`; }
      const p = emptyProjectJS(id, `${d.title} · ${d.client}`);
      p.position = { ...emptyPosition(), title: d.title, client: d.client, location: d.location, work_mode: d.work_mode, seniority: d.seniority, owner: d.owner };
      p.brief_raw = d.brief || "";
      lsSave(p);
      state.newEngStep = 0;
      renderNewEngForm._draft = null;
      toast("Megbízás létrehozva.");
      openEngagement(id, d.brief ? "pozicio" : "attekintes");
    };
  }
}

// ── ÁLLANDÓ MEGBÍZÁS-FEJLÉC ─────────────────────────────────────────────
function renderEngHeader(p) {
  const pos = p.position;
  const sub = [pos.client, pos.location, pos.work_mode, pos.seniority ? pos.seniority + " szint" : ""].filter(Boolean).join(" · ");
  const sub2 = [pos.owner ? "Felelős: " + pos.owner : "", "Frissítve: " + relTime(p.updated_at)].filter(Boolean).join(" · ");
  const chipsArr = [
    ...(((p.query || {}).synonyms) || []).slice(0, 2),
    pos.salary_band, pos.language,
  ].filter(Boolean).slice(0, 4);
  // A JEL-jel motívuma valódi számokra kötve: keskenyedő menta sávok a
  // korall döntési pontba. Ugyanaz a forma, mint a márkajel — csak igaz.
  const fi = funnelInfo(p);
  const pgHtml = `<div class="funnel-wrap">${funnelHtml(fi)}${fi.kizart ? `<span class="funnel-excl">+${fi.kizart} kizárva</span>` : ""}</div>`;
  $("#engHeader").innerHTML = `<div class="eng-header">
    <div class="eng-header-top">
      <div>
        <h1 class="eng-h-title">${esc(pos.title || p.name)}</h1>
        <div class="eng-h-sub">${esc(sub || "—")}${sub2 ? " · " + esc(sub2) : ""}</div>
      </div>
      <div class="eng-h-actions">
        <label class="sr-only" for="statusSel">Megbízás státusza</label>
        <select id="statusSel">${STATUSES.map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <button class="btn btn-primary" id="exportBtn">Shortlist az ügyfélnek</button>
        <details class="stepmenu engmenu"><summary aria-label="További műveletek">⋯</summary>
          <div class="menu-pop">
            <button class="menu-item" id="expCsv">Jelöltlista CSV-ben</button>
            <button class="menu-item" id="expJson">Nyers adat (JSON)</button>
            <button class="menu-item" id="engArchive">${p.archived ? "Archiválás visszavonása" : "Archiválás"}</button>
            <button class="menu-item danger" id="engDelete">Megbízás törlése</button>
          </div>
        </details>
        <button class="btn btn-ghost" id="backBtn">← Megbízások</button>
      </div>
    </div>
    ${pgHtml}
    ${chipsArr.length ? `<div class="eng-chips">${chipsArr.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>` : ""}
  </div>`;
  const te = $("#topEng");
  if (te) te.innerHTML = `<span class="top-eng-t">${esc(shorten(pos.title || p.name, 34))}</span><span class="top-eng-c">${esc(pos.client || "")}</span>`;
  $("#statusSel").onchange = async (e) => {
    p.status = e.target.value;
    persist();
    try { await api("POST", `/api/project/${p.id}/meta`, { status: p.status }); } catch {}
    toast("Státusz frissítve.");
    render(state.view);
  };
  $("#exportBtn").onclick = () => exportShortlist(p);
  $("#expCsv").onclick = () => exportCsv(p);
  $("#expJson").onclick = () => download(`${p.id}.json`, JSON.stringify(p, null, 2), "application/json");
  $("#engArchive").onclick = () => {
    p.archived = !p.archived;
    persist();
    toast(p.archived ? "Megbízás archiválva." : "Archiválás visszavonva.");
    p.archived ? closeEngagement() : render(state.view);
  };
  $("#engDelete").onclick = () => deleteEngagement(p);
  $("#backBtn").onclick = () => closeEngagement();
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// A törlés az egyetlen visszafordíthatatlan művelet — ezért nem elég a
// megerősítés: a kivett megbízás a visszavonó buborék lejártáig visszahozható.
function deleteEngagement(p) {
  if (!confirm(`Törlöd ezt a megbízást?\n\n${p.position.title || p.name}\n${(p.candidates || []).length} jelölttel\n\nA törlés után 10 másodpercig visszavonható.`)) return;
  const snapshot = lsDelete(p.id);
  closeEngagement();
  const t = $("#toast");
  t.innerHTML = `<span>Megbízás törölve.</span><button class="btn toast-undo" id="undoDel">Visszavonás</button>`;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.classList.add("hidden"); t.textContent = ""; }, 10000);
  announce("Megbízás törölve. A visszavonás tíz másodpercig elérhető.");
  $("#undoDel").onclick = () => {
    lsRestore(snapshot);
    clearTimeout(toast._t);
    t.classList.add("hidden"); t.textContent = "";
    renderHome();
    toast("Törlés visszavonva.");
  };
}

/* ── ÜGYFÉLNEK ADHATÓ SHORTLIST ──────────────────────────────────────────
   A fejvadász deliverable-je egy dokumentum, amit a hiring manager elolvas.
   Eddig az egyetlen kijárat egy `p.id.json` volt — fejlesztői artefaktum ott,
   ahol emberi olvasnivaló kell. Minden, amit a termék nehezen kiharcol (őszinte
   besorolás, evidencia-nyom, lefedettségi vakfolt), pontosan az, amit egy
   ügyfél-prezentáción meg kell mutatni. Ez a nyomtatható HTML az. */
function shortlistRows(p) {
  const ranked = (p.ranking && p.ranking.ranked) || [];
  const byId = {};
  ranked.forEach((r) => (byId[r.candidate_id] = r));
  return activeCandidates(p)
    .map((c) => candRow(p, c, byId[c.id]))
    .filter((r) => r.tier === "A" || r.tier === "B")
    .sort((a, b) => (a.tier === b.tier ? (a.priority || 99) - (b.priority || 99) : a.tier < b.tier ? -1 : 1));
}
function exportShortlist(p) {
  const rows = shortlistRows(p);
  if (!rows.length) return toast("Még nincs A vagy B prioritású jelölt a shortlisthez.", true);
  const pos = p.position || {};
  const fi = funnelInfo(p);
  const today = new Date().toISOString().slice(0, 10);
  const card = (r) => {
    const c = r.cand, a = (p.assessments || {})[r.id] || {};
    const sig = (c.signals || []).filter((s) => s.strength === "erős").slice(0, 4);
    return `<article class="c">
      <div class="ch"><span class="t t${r.tier}">${r.tier}</span><h3>${esc(c.name)}</h3></div>
      <p class="hl">${esc(c.headline || "")}${c.current_company ? " · " + esc(c.current_company) : ""}${c.location ? " · " + esc(c.location) : ""}</p>
      ${r.reason ? `<p class="wy"><b>Miért ő:</b> ${esc(r.reason)}</p>` : ""}
      ${sig.length ? `<p class="sg"><b>Igazolt jelek:</b> ${sig.map((s) => esc(s.signal)).join(" · ")}</p>` : ""}
      ${F.qclarify(a).length ? `<p class="qs"><b>Beszélgetésen tisztázandó:</b> ${F.qclarify(a).map(esc).join(" · ")}</p>` : ""}
      ${(a.unknowns || []).length ? `<p class="uk"><b>Amit nem tudunk:</b> ${a.unknowns.map(esc).join(" · ")}</p>` : ""}
    </article>`;
  };
  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<title>Shortlist — ${esc(pos.title || p.name)}</title>
<style>
  @page{margin:18mm}
  *{box-sizing:border-box}
  body{font:14px/1.55 "Avenir Next",Avenir,"Segoe UI",system-ui,sans-serif;color:#172238;margin:0;padding:28px;max-width:62rem}
  h1{font-size:24px;margin:0 0 2px;letter-spacing:-.01em}
  .sub{color:#5D6678;font-size:13px;margin-bottom:20px}
  .fx{display:flex;gap:18px;align-items:flex-end;border-top:1px solid #EAE6DC;border-bottom:1px solid #EAE6DC;padding:14px 0;margin-bottom:22px}
  .fx div{flex:1}.fx b{display:block;font-size:20px}.fx span{font-size:11px;color:#5D6678}
  .fx i{width:12px;height:12px;border-radius:50%;background:#FF5A5F;display:block;margin-bottom:4px}
  .c{border-top:1px solid #EAE6DC;padding:16px 0;page-break-inside:avoid}
  .ch{display:flex;align-items:baseline;gap:10px}
  .ch h3{margin:0;font-size:16px}
  .t{font-weight:800;font-size:11px;padding:2px 8px;border-radius:20px;background:#D5F3EA;color:#0B7D66}
  .tB{background:#E4EBF7;color:#2F4A80}
  .hl{color:#5D6678;font-size:13px;margin:3px 0 8px}
  p{margin:5px 0;font-size:13px}
  .uk,.qs{color:#5D6678}
  footer{margin-top:28px;border-top:1px solid #EAE6DC;padding-top:12px;font-size:11px;color:#5D6678}
</style></head><body>
<h1>${esc(pos.title || p.name)}</h1>
<div class="sub">${[pos.client, pos.location, pos.work_mode, pos.seniority].filter(Boolean).map(esc).join(" · ")} — shortlist, ${today}</div>
<div class="fx">
  <div><b>${fi.felkutatva}</b><span>felkutatva</span></div>
  <div><b>${fi.prioritasos}</b><span>prioritásos</span></div>
  <div><b>${fi.megkeresve}</b><span>megkeresve</span></div>
  <div><b>${fi.valaszolt}</b><span>válaszolt</span></div>
  <div style="flex:0"><i></i><span>${fi.pozitiv} pozitív</span></div>
</div>
${rows.map(card).join("")}
<footer>A besorolás a recruiter döntése, az elemzés javaslat. „Amit nem tudunk" tételek szándékosan szerepelnek: ezek a beszélgetésen tisztázandók, nem hiányosságok.${fi.kizart ? ` ${fi.kizart} találat kizárva a merítésből (ügyfél jelenlegi vagy volt munkatársa, illetve off-limits cég).` : ""}</footer>
</body></html>`;
  download(`${p.id}-shortlist-${today}.html`, html, "text/html");
  toast(`Shortlist exportálva — ${rows.length} jelölt. Böngészőben megnyitva nyomtatható PDF-be.`);
}
function exportCsv(p) {
  const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const head = ["Prioritás", "Név", "Headline", "Jelenlegi cég", "Helyszín", "Erős jelek", "Forrás", "Következő lépés", "Indoklás"];
  const rows = activeCandidates(p).map((c) => {
    const r = candRow(p, c);
    return [r.tier || "—", c.name, c.headline, c.current_company, c.location,
      (c.signals || []).filter((s) => s.strength === "erős").map((s) => s.signal).join("; "),
      srcLabel(c.source_type), STAGE_LABEL[r.stage] || "", r.reason || ""].map(q).join(",");
  });
  download(`${p.id}-jeloltek.csv`, "﻿" + [head.map(q).join(","), ...rows].join("\r\n"), "text/csv");
  toast("Jelöltlista CSV-ben exportálva.");
}

// ── ÁTTEKINTÉS ──────────────────────────────────────────────────────────
/* ── TÖLCSÉR ─────────────────────────────────────────────────────────────
   A haladás nem százalék, hanem emberek száma. A korábbi mérföldkő-sáv azt
   mérte, megtörtént-e valaha egyszer valami, ezért 100%-ot mutatott olyankor
   is, amikor állt a munka.

   Hatókör: a kizártak nem számítanak bele — ugyanaz az elv, amit a keresési
   lefedettség is használ („a valódi merítésre mérünk”). A „megkeresve” és a
   „válaszolt” viszont NEM szűkül A/B prioritásra: különben egy megkeresett,
   majd hátrasorolt jelölt visszamenőleg csökkentené a tölcsért.          */
function funnelInfo(p) {
  const act = activeCandidates(p);
  const rows = act.map((c) => candRow(p, c));
  return {
    felkutatva: act.length,
    prioritasos: rows.filter((r) => r.tier === "A" || r.tier === "B").length,
    megkeresve: rows.filter((r) => r.sent).length,
    valaszolt: rows.filter((r) => r.replied).length,
    pozitiv: rows.filter((r) => r.replied && r.sentiment === "pozitív").length,
    kizart: excludedCandidates(p).length,
  };
}
const FUNNEL_STEPS = [["felkutatva", "felkutatva"], ["prioritasos", "prioritásos"], ["megkeresve", "megkeresve"], ["valaszolt", "válaszolt"]];
function funnelHtml(fi) {
  const max = Math.max(1, fi.felkutatva);
  return `<div class="funnel" role="img" aria-label="${FUNNEL_STEPS.map(([k, l]) => `${fi[k]} ${l}`).join(", ")}, ${fi.pozitiv} pozitív válasz">
    ${FUNNEL_STEPS.map(([k, l]) => `<div class="fseg">
      <div class="fnum">${fi[k]}</div>
      <div class="ftrack"><span class="fbar" style="width:${Math.round(Math.min(1, fi[k] / max) * 100)}%"></span></div>
      <div class="flab">${esc(l)}</div>
    </div>`).join("")}
    <div class="fseg fseg-end">
      <div class="fnum">${fi.pozitiv}</div>
      <div class="ftrack"><span class="fdot${fi.pozitiv ? " full" : ""}"></span></div>
      <div class="flab">pozitív</div>
    </div>
  </div>`;
}
function renderOverview(p) {
  const v = $("#view-attekintes");
  const ns = nextStep(p);
  const posSum = p.intake ? shorten(finalBriefText(p), 220) : (p.brief_raw ? shorten(p.brief_raw, 220) : "Még nincs brief.");
  // Az elakadt jelöltek ide, a teendő alá kerülnek: ami egy kattintással
  // elintézhető, azt ne kelljen máshol megkeresni.
  const { rows, coolDays } = pipelineRows(p);
  const todo = [];
  rows.forEach((r) => {
    if (!r.hasAttr) todo.push({ r, txt: "hiányzik a megközelítési terv", cta: "Terv", tab: "megkozelites" });
    else if (!r.hasDraft) todo.push({ r, txt: "hiányzik az üzenetvázlat", cta: "Vázlat", tab: "uzenet" });
    else if (!r.reviewed && !r.sent) todo.push({ r, txt: "a vázlat ellenőrzésre vár", cta: "Ellenőrzés", tab: "uzenet" });
    else if (r.reviewed && !r.sent) todo.push({ r, txt: "jóváhagyva, még nem ment ki", cta: "Kiküldés", tab: "uzenet" });
  });
  rows.forEach((r) => { if (isCooling(r, coolDays)) todo.push({ r, txt: `${r.touched == null ? "még nem volt" : r.touched + " napja nincs"} lépés`, cta: "Utánkövetés", tab: "naplo" }); });

  v.innerHTML = `
    <div class="card ov-lead">
      <div class="next-inline">
        <div>
          <div class="next-lbl">Következő teendő</div>
          <div class="next-txt">${esc(ns.label)}</div>
          <div class="next-sub">${esc(ns.sub || "")}</div>
        </div>
        <button class="btn btn-primary" id="nsGo">${esc(ns.cta || "Megnyitás")}</button>
      </div>
      ${todo.length ? `<div class="todo-list">${todo.slice(0, 5).map((t) => `
        <div class="todo-row">
          <span class="tier-badge tb tier-${t.r.tier}">${t.r.tier}</span>
          <span class="todo-name">${esc(t.r.cand.name || t.r.id)}</span>
          <span class="todo-need">${esc(t.txt)}</span>
          <button class="btn todo-cta" data-id="${esc(t.r.id)}" data-tab="${esc(t.tab)}">${esc(t.cta)}</button>
        </div>`).join("")}
        ${todo.length > 5 ? `<div class="card-d">…és további ${todo.length - 5} jelölt.</div>` : ""}</div>`
        : `<div class="ov-empty sm">Minden prioritásos jelöltnél megvan a következő lépés.</div>`}
    </div>
    <div class="ov-grid">
      <div class="ov-col">
        <div class="card"><h4>${p.intake && p.intake_review === "approved" ? "Véglegesített brief" : "Pozíció röviden"} ${p.intake ? aiTag(p.intake_review === "approved") : ""}</h4><p>${esc(posSum)}</p>
          <div class="row" style="margin-top:6px"><button class="btn" id="ovToPoz">Brief és pozíció</button></div></div>
      </div>
      <div class="ov-col"><div id="ovCoverage"></div></div>
    </div>`;
  $("#nsGo").onclick = () => showView(ns.view);
  $("#ovToPoz").onclick = () => showView("pozicio");
  $$("#view-attekintes .todo-cta").forEach((b) => (b.onclick = () => openPanel(b.dataset.id, b.dataset.tab)));
  renderCoverage(p);
}
function renderCoach(o) {
  const out = $("#coachOut"); if (!out) return;
  out.innerHTML = `<div class="card">
    <h4>Javaslat ${demoTag(o)}</h4>
    <p>${esc(F.coachRec(o))}</p>
    ${o.one_lever_now ? `<p><b>Most bevethető:</b> ${esc(o.one_lever_now)}</p>` : ""}
    ${o.skill_focus ? `<p><b>Készség-fókusz:</b> ${esc(o.skill_focus)}</p>` : ""}
    ${o.encouragement ? `<p class="mut">${esc(o.encouragement)}</p>` : ""}</div>`;
}
function renderCoverage(p) {
  const box = $("#ovCoverage"); if (!box) return;
  const c = activeCandidates(p);        // a lefedettséget a valódi merítésre mérjük
  if (!c.length) { box.innerHTML = ""; return; }
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
  if (mono) callout = `A jelöltek <b>${Math.round(topShare * 100)}%-a egy forrásból</b> jön (${esc(srcLabel(top[0]))}). A többi csatorna kimarad — bővítsd a kutatást más forrással, mielőtt a listából következtetsz.`;
  else if (blind > 0) callout = `<b>${blind} célcég érintetlen</b> a ${targets.length}-ből. Érdemes ezekre is kutatni, mielőtt lezárnád a merítést.`;
  else callout = `A merítés forrás- és cégoldalról kiegyensúlyozott.`;
  const alert = mono || blind > 0;
  const distHtml = entries.map(([k, v]) => `<div class="cov-src"><span class="cov-src-lbl">${esc(srcLabel(k))}</span><span class="cov-bar"><span style="width:${Math.round(v / c.length * 100)}%;background:${k === top[0] && mono ? "var(--bad)" : "var(--accent)"}"></span></span><span class="cov-src-val">${Math.round(v / c.length * 100)}%</span></div>`).join("");
  box.innerHTML = `<div class="cov-card ${alert ? "alert" : ""}">
    <div class="ck-sec-head sm"><h3>Keresési lefedettség</h3>${alert ? `<span class="cov-flag">figyelem</span>` : `<span class="cov-ok">rendben</span>`}</div>
    <div class="cov-block"><div class="cov-label">Forrás-eloszlás</div>${distHtml || "<div class='ov-empty sm'>—</div>"}</div>
    <div class="cov-block"><div class="cov-label">Célcég-lefedettség</div><div class="cov-targets">${covered}/${targets.length} érintve</div></div>
    <div class="cov-callout ${alert ? "alert" : ""}">${callout}</div>
  </div>`;
}
async function touchCand(id) {
  try {
    await api("POST", `/api/project/${state.projectId}/touch`, { candidateId: id });
    const cd = candById(state.project, id); if (cd) cd.last_touched = new Date().toISOString();
    persist();
    render(state.view);
    toast("Aktivitás rögzítve.");
  } catch (e) { const i = errorInfo(e); toast(i.title + " " + i.detail, true); }
}

// ── POZÍCIÓ ÉS BRIEF ────────────────────────────────────────────────────
/* Tíz lapos, egyenrangú mező helyett három csoport. A csoportosítás nem
   kozmetika: a „ki dolgozik rajta" és a „mi a szerep" két külön kérdés, és a
   három egyenlő oszlopból álló rács volt az, ami a hosszú chip-listák mellett
   túlnyúlt és rárajzolt a szomszéd oszlop címkéire. */
const POS_GROUPS = [
  ["A szerep", [["title", "Pozíció neve", "text"], ["client", "Ügyfél", "text"], ["seniority", "Tapasztalati szint", "text"]]],
  ["Feltételek", [["location", "Helyszín", "text"], ["work_mode", "Munkavégzés", "select"], ["language", "Nyelv", "text"], ["salary_band", "Bérsáv", "text"]]],
  ["Felelősség és határidő", [["owner", "Felelős recruiter", "text"], ["hiring_manager", "Hiring manager", "text"], ["due_date", "Céldátum", "date"]]],
];
function renderPositionView(p) {
  $("#briefInput").value = p.brief_raw || "";
  $("#posForm").innerHTML = POS_GROUPS.map(([title, fields]) => `
    <fieldset class="pos-group">
      <legend>${esc(title)}</legend>
      <div class="form-grid">${fields.map(([k, lbl, type]) => {
        const id = "pos_" + k;
        if (type === "select") return `<div class="fld"><label for="${id}">${esc(lbl)}</label><select id="${id}" data-pos="${k}">${WORK_MODES.map((m) => `<option value="${m}" ${p.position[k] === m ? "selected" : ""}>${m || "—"}</option>`).join("")}</select></div>`;
        return `<div class="fld"><label for="${id}">${esc(lbl)}</label><input id="${id}" type="${type}" data-pos="${k}" value="${esc(p.position[k] || "")}" /></div>`;
      }).join("")}</div>
    </fieldset>`).join("");
  $$("#posForm [data-pos]").forEach((inp) => (inp.onchange = async () => {
    p.position[inp.dataset.pos] = inp.value.trim();
    p.name = [p.position.title, p.position.client].filter(Boolean).join(" · ") || p.name;
    persist();
    try { await api("POST", `/api/project/${p.id}/meta`, { position: p.position, name: p.name }); } catch {}
    renderEngHeader(p);
  }));
  renderIntake(p);
}
// A véglegesített brief a recruiter tulajdona: az AI-javaslatból indul, de a
// szerkesztett változat az, ami továbbmegy (keresés, megkeresés, ügyfél).
function ensureBriefFinal(p) {
  const o = p.intake || {};
  if (!p.brief_final) {
    p.brief_final = {
      text: o.reframed_brief || "",
      must_haves: [...(o.must_haves || [])],
      nice_to_haves: [...(o.nice_to_haves || [])],
      approved_at: null, edited: false,
    };
  }
  return p.brief_final;
}
function briefIsEdited(p) {
  const b = p.brief_final, o = p.intake || {};
  if (!b) return false;
  return b.text !== (o.reframed_brief || "")
    || (b.must_haves || []).join("|") !== (o.must_haves || []).join("|")
    || (b.nice_to_haves || []).join("|") !== (o.nice_to_haves || []).join("|");
}
function finalBriefText(p) { return (p.brief_final && p.brief_final.text) || (p.intake && p.intake.reframed_brief) || ""; }
// A szerkesztőmező tartalmát minden újrarender előtt visszamentjük.
function syncBriefText(p) {
  const ta = $("#bfText");
  if (ta && p.brief_final) p.brief_final.text = ta.value;
}
function renderIntake(p) {
  const o = p.intake;
  const out = $("#intakeOut");
  if (!o) { out.innerHTML = `<div class="ov-empty sm">Még nincs elemzés. Illeszd be a briefet, és kattints a „Brief elemzése” gombra.</div>`; return; }
  const b = ensureBriefFinal(p);
  const approved = p.intake_review === "approved";
  const edited = briefIsEdited(p);
  out.innerHTML = `
    <div class="card bf-card">
      <h4>Véglegesített brief
        <span class="ai-status ${approved ? "ok" : ""}">${approved ? "Recruiter által véglegesítve" : "Vázlat — még nincs véglegesítve"}</span>
        ${edited ? evTag("inference","szerkesztve") : ""}
      </h4>
      <p class="card-d" style="margin-top:0">Ez a szöveg megy tovább a keresésbe, a megkeresésekbe és az ügyfél-egyeztetésbe. Szerkeszd szabadon, majd véglegesítsd.</p>
      <label class="sr-only" for="bfText">Véglegesített pozíció-összefoglaló</label><textarea id="bfText" class="brief bf-text" placeholder="A véglegesített pozíció-összefoglaló…">${esc(b.text)}</textarea>
      <div class="bf-lists">
        <div><div class="cov-label">Elengedhetetlen feltételek</div>${chipEditor("bfMust", b.must_haves, { placeholder: "Új feltétel…" })}</div>
        <div><div class="cov-label">Előnyt jelent</div>${chipEditor("bfNice", b.nice_to_haves, { placeholder: "Új előny…" })}</div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary" id="bfApprove">${approved ? "Módosítások mentése" : "Véglegesítés és jóváhagyás"}</button>
        <button class="btn" id="bfCopy">Másolás</button>
        <button class="btn btn-ghost" id="bfReset" title="Az AI eredeti javaslatának visszaállítása">Vissza az AI-javaslathoz</button>
      </div>
      ${approved && b.approved_at ? `<div class="card-d">Véglegesítve: ${esc(String(b.approved_at).slice(0, 16).replace("T", " "))}${edited ? " · a recruiter módosította az AI-javaslatot" : ""}</div>` : ""}
    </div>
    ${F.clarif(o).length ? `<div class="card card-clarif"><h4>Tisztázandó pontok ${evTag("assume")}</h4>
      <p class="card-d">Ezeket vidd vissza a hiring managerhez — a brief ezekre nem ad választ.</p>
      ${F.clarif(o).map((f) => `<div class="flag">${esc(f)}</div>`).join("")}</div>` : ""}
    ${F.inferred(o).length ? `<div class="card"><h4>Feltételezett további igények ${evTag("assume")}</h4>${list(F.inferred(o))}</div>` : ""}
    ${(o.search_hypotheses || []).length ? `<div class="card"><h4>Keresési hipotézisek ${evTag("inference")}</h4>${list(o.search_hypotheses)}</div>` : ""}
    <details class="card card-orig" id="aiOrig"${detailsOpen("aiOrig")}>
      <summary><h4>Az AI eredeti javaslata ${demoTag(o)}</h4><span class="card-d">— összevetéshez</span></summary>
      <p class="lead">${esc(o.reframed_brief)}</p>
      <div class="cov-label" style="margin-top:10px">Elengedhetetlen feltételek</div>${list(o.must_haves)}
      <div class="cov-label" style="margin-top:10px">Előnyt jelent</div>${chips(o.nice_to_haves)}
    </details>
  `;
  wireDetails("aiOrig");
  $("#bfText").oninput = () => { b.text = $("#bfText").value; };
  $("#bfText").onchange = () => { b.text = $("#bfText").value; persist(); };
  wireChipEditor("bfMust",
    (vals) => { syncBriefText(p); addUnique(b.must_haves, vals); afterChipEdit(renderIntake, p, "bfMust"); },
    (i) => { syncBriefText(p); b.must_haves.splice(i, 1); afterChipEdit(renderIntake, p, "bfMust"); });
  wireChipEditor("bfNice",
    (vals) => { syncBriefText(p); addUnique(b.nice_to_haves, vals); afterChipEdit(renderIntake, p, "bfNice"); },
    (i) => { syncBriefText(p); b.nice_to_haves.splice(i, 1); afterChipEdit(renderIntake, p, "bfNice"); });
  $("#bfApprove").onclick = () => {
    syncBriefText(p);
    if (!b.text.trim()) return toast("A véglegesített brief nem lehet üres.");
    b.approved_at = new Date().toISOString();
    b.edited = briefIsEdited(p);
    p.intake_review = "approved";
    persist();
    renderIntake(p);
    renderEngHeader(p);
    toast(b.edited ? "Brief véglegesítve a te módosításaiddal." : "Brief véglegesítve.");
  };
  $("#bfCopy").onclick = () => {
    syncBriefText(p);
    const txt = [b.text, "", "Elengedhetetlen: " + (b.must_haves || []).join("; "), "Előnyt jelent: " + (b.nice_to_haves || []).join("; ")].join("\n");
    navigator.clipboard.writeText(txt);
    toast("Véglegesített brief a vágólapon.");
  };
  $("#bfReset").onclick = () => {
    if (!confirm("Biztosan visszaállítod az AI eredeti javaslatát? A kézi módosításaid elvesznek.")) return;
    p.brief_final = null;
    p.intake_review = null;
    ensureBriefFinal(p);
    persist();
    renderIntake(p);
    toast("Visszaállítva az AI-javaslatra.");
  };
}

// ── CÉLPIAC ─────────────────────────────────────────────────────────────
function renderCelpiac(p) {
  renderQuery(p);
  renderExclusions(p);
  renderTalent(p);
  renderStrategyChat(p);
  $("#discoverNote").innerHTML = p.discover_note ? `<div class="note">${esc(p.discover_note)}</div>` : "";
  // Vezetett lépcső: a térkép a terv után, a kutatás a térkép után élesedik.
  // A függés eddig is létezett, csak nem látszott — négy egyenrangú gomb volt.
  const hasBrief = !!p.intake, hasPlan = !!p.query, hasMap = !!p.talent_map;
  const qb = $("#queryBtn");
  if (qb) { qb.textContent = hasPlan ? "Keresési terv frissítése" : "Keresési terv készítése"; qb.disabled = !hasBrief; }
  const tb = $("#talentBtn");
  if (tb) { tb.textContent = hasMap ? "Célpiac-térkép frissítése" : "Célpiac-térkép készítése"; tb.disabled = !hasPlan; }
  const db = $("#discoverBtn");
  if (db) db.disabled = !hasPlan;
  $("#stepPlan").className = "stepc" + (hasPlan ? " done" : hasBrief ? " cur" : " lock");
  $("#stepMap").className = "stepc" + (hasMap ? " done" : hasPlan ? " cur" : " lock");
  $("#stepDisc").className = "stepc" + ((p.candidates || []).length ? " done" : hasPlan ? " cur" : " lock");
  $("#stepMapNote").textContent = hasPlan
    ? (hasMap ? `${((p.talent_map || {}).target_companies || []).length} célcég · ${((p.talent_map || {}).competitor_clusters || []).length} klaszter`
              : "Célcégek, versenytárs-klaszterek, közösségek.")
    : "Előbb keresési terv kell.";
  $("#stepDiscNote").textContent = hasPlan
    ? ((p.candidates || []).length ? `${(p.candidates || []).length} találat · ${activeCandidates(p).length} a merítésben` : "A terv alapján keresi meg az embereket.")
    : "Előbb keresési terv kell.";
  if (!hasBrief && !hasPlan) {
    $("#queryOut").innerHTML = `<div class="dep-note"><span>A keresési tervhez előbb elemezd a briefet.</span><button class="btn" id="depToPoz">Brief és pozíció</button></div>`;
    const b = $("#depToPoz"); if (b) b.onclick = () => showView("pozicio");
  }
}
// A terv minden kategóriája szerkeszthető: hozzáadás és elvétel egyaránt.
function renderQuery(p) {
  const o = p.query;
  const out = $("#queryOut");
  if (!o) { if (p.intake) out.innerHTML = ""; return; }
  const edited = !!o._edited_by_recruiter;
  out.innerHTML = `
    <div class="card">
      <h4>Keresési terv ${demoTag(o)} ${edited ? `<span class="ai-status ok">Recruiter által szerkesztve</span>` : `<span class="ai-status">AI-javaslat — szerkeszthető</span>`}</h4>
      <p class="card-d" style="margin-top:0">A kategóriákhoz bármikor hozzáadhatsz vagy elvehetsz belőlük — a frissítés nem törli a kézi elemeidet.</p>
      <div class="cov-label" style="margin-top:10px">Célpozíciók</div>${chipEditor("qTitles", o.target_titles, { placeholder: "Új célpozíció…" })}
      <div class="cov-label" style="margin-top:12px">Célcégek</div>${chipEditor("qCompanies", o.target_companies, { placeholder: "Új célcég…" })}
      <div class="cov-label" style="margin-top:12px">Kulcs-szinonimák</div>${chipEditor("qSyn", o.synonyms, { placeholder: "Új szinonima…" })}
      <details class="or-why" id="qDetails"${detailsOpen("qDetails")} style="margin-top:12px"><summary>Keresési lekérdezések (szerkeszthető)</summary>
        <div class="cov-label" style="margin-top:8px">Boolean / X-ray lekérdezések</div>
        ${(o.boolean_queries || []).map((q, i) => `<div class="q-row"><div class="q-plat">${esc(q.platform || "egyéb")}</div><textarea class="q-code q-edit" data-qi="${i}" rows="2">${esc(q.query || "")}</textarea><button class="btn ed-x-btn" data-qrm="${i}" title="Lekérdezés törlése">×</button></div>`).join("")
          || `<div class="ed-empty">— még nincs lekérdezés —</div>`}
        <div class="ed-add q-add"><label class="sr-only" for="qBoolNew">Új boolean lekérdezés</label><input class="ed-in" id="qBoolNew" placeholder="Új boolean lekérdezés…" /><button class="btn" id="qBoolAdd" aria-label="Boolean lekérdezés hozzáadása">+</button></div>
        <div class="cov-label" style="margin-top:14px">Webes kereső-lekérdezések</div>
        ${chipEditor("qWeb", o.firecrawl_search_queries, { placeholder: "Új webes lekérdezés…" })}
      </details>
    </div>`;
  wireDetails("qDetails");
  const touch = () => { o._edited_by_recruiter = true; };
  // Minden kategória ugyanazt a szerződést kapja: hozzáadás + elvétel, és az
  // elvétel emlékezetes (a frissítés nem hozza vissza).
  const wireQ = (id, field) => wireChipEditor(id,
    (v) => { touch(); o[field] = o[field] || []; addUnique(o[field], v); v.forEach((x) => unnoteRemoval(o, field, x)); afterChipEdit(renderCelpiac, p, id); },
    (i) => { touch(); noteRemoval(o, field, (o[field] || [])[i]); o[field].splice(i, 1); afterChipEdit(renderCelpiac, p, id); });
  wireQ("qTitles", "target_titles");
  wireQ("qCompanies", "target_companies");
  wireQ("qSyn", "synonyms");
  wireQ("qWeb", "firecrawl_search_queries");
  $$("#queryOut .q-edit").forEach((ta) => (ta.onchange = () => { touch(); o.boolean_queries[Number(ta.dataset.qi)].query = ta.value; persist(); }));
  $$("#queryOut [data-qrm]").forEach((b) => (b.onclick = () => {
    touch();
    const i = Number(b.dataset.qrm);
    noteRemoval(o, "boolean_queries", (o.boolean_queries[i] || {}).query);
    o.boolean_queries.splice(i, 1);
    persist();
    renderCelpiac(p);
  }));
  const qAdd = $("#qBoolAdd");
  if (qAdd) qAdd.onclick = () => {
    const v = $("#qBoolNew").value.trim();
    if (!v) return;
    touch();
    o.boolean_queries = o.boolean_queries || [];
    o.boolean_queries.push({ platform: "egyéni", query: v });
    persist();
    renderCelpiac(p);
  };
}

// ── Kizárt cégek és jelöltek (off-limits) ───────────────────────────────
function renderExclusions(p) {
  const out = $("#exclOut");
  if (!out) return;
  if (!p.query && !(p.candidates || []).length) { out.innerHTML = ""; return; }
  const ex = p.exclusions;
  const client = (p.position || {}).client;
  const excl = excludedCandidates(p);
  const byKind = {};
  excl.forEach((c) => { const k = (exclusionFor(p, c) || {}).kind || "manual"; byKind[k] = (byKind[k] || 0) + 1; });
  const kindLbl = { client_current: "az ügyfélnél dolgozik", client_alumni: "volt ügyfél-munkatárs", offlimits: "off-limits cég", offlimits_past: "off-limits múlt", manual: "kézzel kizárva" };
  const sum = Object.entries(byKind).map(([k, v]) => `${v} ${kindLbl[k] || k}`).join(" · ");
  out.innerHTML = `
    <div class="card excl-card">
      <h4>Kizárás a merítésből ${excl.length ? `<span class="cov-flag">${excl.length} jelölt kiszűrve</span>` : `<span class="cov-ok">nincs ütközés</span>`}</h4>
      <p class="card-d" style="margin-top:0">${client
        ? `Az ügyfél (<b>${esc(client)}</b>) jelenlegi és volt munkatársai nem kerülnek a jelöltlistára — őket a hiring manager ismeri. A cégnév-egyezés a leányvállalati és rövidített alakokat is felismeri.`
        : `Add meg az ügyfél nevét a <b>Pozíció és brief</b> nézetben, hogy a saját munkatársai automatikusan kimaradjanak.`}</p>
      ${sum ? `<div class="excl-sum">${esc(sum)}</div>` : ""}
      <div class="cov-label" style="margin-top:12px">További kizárt cégek (off-limits)</div>
      ${chipEditor("exCos", ex.companies, { cls: "bad", placeholder: "pl. testvércég, másik ügyfél…", empty: "— nincs további kizárt cég —" })}
      ${(ex.client_aliases || []).length || client ? `<div class="cov-label" style="margin-top:12px">Az ügyfél további cégnevei</div>${chipEditor("exAlias", ex.client_aliases, { placeholder: "pl. leányvállalat neve…", empty: "— nincs megadva —" })}` : ""}
      <label class="excl-toggle"><input type="checkbox" id="exAlumni" ${ex.allow_alumni ? "checked" : ""} />
        <span>A volt ügyfél-munkatársak (alumni) jelenjenek meg a listán — jelöléssel, ha szándékosan visszacsábítanátok valakit</span></label>
      ${excl.length ? `<div class="row" style="margin-top:10px"><button class="btn" id="exShow">Kizárt jelöltek megnyitása (${excl.length})</button></div>` : ""}
    </div>`;
  wireChipEditor("exCos",
    (v) => { addUnique(ex.companies, v); afterChipEdit(renderCelpiac, p, "exCos"); },
    (i) => { ex.companies.splice(i, 1); afterChipEdit(renderCelpiac, p, "exCos"); });
  wireChipEditor("exAlias",
    (v) => { addUnique(ex.client_aliases, v); afterChipEdit(renderCelpiac, p, "exAlias"); },
    (i) => { ex.client_aliases.splice(i, 1); afterChipEdit(renderCelpiac, p, "exAlias"); });
  const al = $("#exAlumni");
  if (al) al.onchange = () => { ex.allow_alumni = al.checked; persist(); renderCelpiac(p); toast(al.checked ? "Az alumni jelöltek megjelennek a listán." : "Az alumni jelöltek kikerültek a listáról."); };
  const sh = $("#exShow");
  if (sh) sh.onclick = () => { state.openExcluded = true; showView("jeloltek"); };
}

function renderTalent(p) {
  const o = p.talent_map;
  const out = $("#talentOut");
  if (!o) { out.innerHTML = ""; return; }
  const edited = !!o._edited_by_recruiter;
  const touch = () => { o._edited_by_recruiter = true; };
  out.innerHTML = `<div class="card"><h4>Célpiac-térkép ${demoTag(o)} ${edited ? `<span class="ai-status ok">Recruiter által szerkesztve</span>` : ""}</h4>
    <div class="cov-label">Célcégek</div>
    ${(o.target_companies || []).map((c, i) => `<div class="tm-row"><div><span class="rank-name">${esc(c.name)}</span>${c.why ? ` — <span class="crow-meta">${esc(c.why)}</span>` : ""}${(c.likely_roles || []).length ? chips(c.likely_roles) : ""}</div><button class="btn ed-x-btn" data-tmrm="${i}" title="Eltávolítás">×</button></div>`).join("")
      || `<div class="ed-empty">— még nincs célcég —</div>`}
    <div class="ed-add q-add"><label class="sr-only" for="tmNewName">Célcég neve</label><input class="ed-in" id="tmNewName" placeholder="Célcég neve…" /><label class="sr-only" for="tmNewWhy">Miért releváns</label><input class="ed-in" id="tmNewWhy" placeholder="Miért releváns? (opcionális)" /><button class="btn" id="tmAdd" aria-label="Célcég hozzáadása">+</button></div>
    ${(o.competitor_clusters || []).length || true ? `<div class="cov-label" style="margin-top:14px">Versenytárs-klaszterek</div>${chipEditor("tmClusters", o.competitor_clusters, { placeholder: "Új klaszter…" })}` : ""}
    <div class="cov-label" style="margin-top:12px">Közösségek, rendezvények</div>${chipEditor("tmGather", o.where_they_gather, { placeholder: "Új közösség / rendezvény…" })}
  </div>`;
  $$("#talentOut [data-tmrm]").forEach((b) => (b.onclick = () => { touch(); o.target_companies.splice(Number(b.dataset.tmrm), 1); persist(); renderCelpiac(p); }));
  const add = $("#tmAdd");
  if (add) add.onclick = () => {
    const name = $("#tmNewName").value.trim();
    if (!name) return toast("Adj meg cégnevet.");
    touch();
    o.target_companies = o.target_companies || [];
    o.target_companies.push({ name, why: $("#tmNewWhy").value.trim() || "A recruiter vette fel.", likely_roles: [] });
    persist();
    renderCelpiac(p);
  };
  wireChipEditor("tmClusters",
    (v) => { touch(); addUnique(o.competitor_clusters = o.competitor_clusters || [], v); afterChipEdit(renderCelpiac, p, "tmClusters"); },
    (i) => { touch(); o.competitor_clusters.splice(i, 1); afterChipEdit(renderCelpiac, p, "tmClusters"); });
  wireChipEditor("tmGather",
    (v) => { touch(); addUnique(o.where_they_gather = o.where_they_gather || [], v); afterChipEdit(renderCelpiac, p, "tmGather"); },
    (i) => { touch(); o.where_they_gather.splice(i, 1); afterChipEdit(renderCelpiac, p, "tmGather"); });
}

/* ── STRATÉGIA-ASSZISZTENS ───────────────────────────────────────────────
   Szűk hatókörű chat: a rendszer-promptja szerint kizárólag a keresési tervet
   és a célpiac-térképet szerkeszti. Nem „beszélget” — műveleteket hajt végre,
   tételesen visszajelzi őket, és minden lépés visszavonható.               */
const STRAT_QUICK = [
  "Milyen célcégeket javasolsz még?",
  "Adj hozzá a célpozíciókhoz: Backend Architect, Head of Platform",
  "Vedd ki a szinonimák közül az SRE-t",
  "Zárd ki: (az ügyfél leányvállalata)",
  "Készíts célpiac-térképet",
];
function strategyList(p, target, field) {
  if (target === "query") { p.query = p.query || {}; return (p.query[field] = p.query[field] || []); }
  if (target === "map") { p.talent_map = p.talent_map || {}; return (p.talent_map[field] = p.talent_map[field] || []); }
  if (target === "exclusions") { return (p.exclusions[field] = p.exclusions[field] || []); }
  return [];
}
function sameStratVal(a, b) { return normVal(a) === normVal(b); }
/* A kézi TÖRLÉS is szerkesztés: ha a recruiter kivett egy kategóriát, a terv
   frissítése nem hozhatja vissza csendben. Ezt tartja nyilván a _removed. */
function noteRemoval(q, field, value) {
  if (!q) return;
  q._removed = q._removed || {};
  const s = (q._removed[field] = q._removed[field] || []);
  if (!s.some((x) => sameStratVal(x, value))) s.push(normVal(value));
}
function unnoteRemoval(q, field, value) {
  const s = q && q._removed && q._removed[field];
  if (!s) return;
  const i = s.findIndex((x) => sameStratVal(x, value));
  if (i >= 0) s.splice(i, 1);
}
function wasRemoved(q, field, value) {
  const s = q && q._removed && q._removed[field];
  return !!(s && s.some((x) => sameStratVal(x, value)));
}
// invert=true → a művelet visszavonása. "generate" esetén a hívó futtatja az endpointot.
function applyStratAction(p, a, invert) {
  const op = invert ? (a.op === "add" ? "remove" : a.op === "remove" ? "add" : a.op) : a.op;
  if (op === "generate") return invert ? null : a.target;
  const arr = strategyList(p, a.target, a.field);
  if (op === "add") {
    if (!arr.some((x) => sameStratVal(x, a.value))) arr.push(a.value);
    if (a.target === "query") unnoteRemoval(p.query, a.field, a.value);
  } else if (op === "remove") {
    const i = arr.findIndex((x) => sameStratVal(x, a.value));
    if (i >= 0) arr.splice(i, 1);
    if (a.target === "query") noteRemoval(p.query, a.field, a.value);
  }
  if (a.target === "query" && p.query) p.query._edited_by_recruiter = true;
  if (a.target === "map" && p.talent_map) p.talent_map._edited_by_recruiter = true;
  return null;
}
function actionChip(a) {
  const sign = a.op === "remove" ? "−" : a.op === "generate" ? "⟳" : "+";
  const cls = a.op === "remove" ? "rm" : a.op === "generate" ? "gen" : "add";
  return `<span class="chat-act ${cls}">${sign} ${esc(a.label || "")}</span>`;
}
function renderStrategyChat(p) {
  const box = $("#stratChat");
  if (!box) return;
  const keep = $("#chatIn") ? $("#chatIn").value : "";   // a félig begépelt üzenet nem veszhet el
  const log = p.strategy_chat || [];
  box.innerHTML = `<section class="substage">
    <div class="stage-head"><h2>Stratégia-asszisztens</h2>
      <p class="stage-sub">Írd le szövegesen, mit változtasson a keresési terven vagy a célpiac-térképen. Minden módosítás tételes és visszavonható — az asszisztens csak ehhez a két dologhoz nyúlhat.</p></div>
    <details class="or-why" id="sysPromptBox"${detailsOpen("sysPromptBox")}><summary>Rendszer-prompt — mit tud és mit nem</summary>
      <pre class="sys-prompt" id="sysPromptTxt">${esc(p.strategy_system_prompt || "Betöltés…")}</pre></details>
    <div class="chat-log" id="chatLog">${log.length ? log.map((m, i) => {
      if (m.role === "user") return `<div class="chat-msg user">${esc(m.text)}</div>`;
      const acts = (m.actions || []).length ? `<div class="chat-acts">${m.actions.map(actionChip).join("")}</div>` : "";
      // Az alkalmazott javaslat már a művelet-chipek közt van — itt csak a maradék.
      const props = (m.proposals || []).map((x, j) => ({ x, j })).filter((o) => !o.x.applied);
      const propHtml = props.length
        ? `<div class="chat-props">${props.map((o) => `<button class="ck-mini chat-prop" data-mi="${i}" data-pi="${o.j}">+ ${esc(o.x.label)}</button>`).join("")}</div>` : "";
      const undo = (m.actions || []).length && !m.undone
        ? `<button class="btn btn-ghost chat-undo" data-mi="${i}">↺ Visszavonás</button>` : "";
      return `<div class="chat-msg bot${m.undone ? " undone" : ""}"><div>${esc(m.text)}</div>${acts}${propHtml}
        ${m.undone ? `<div class="chat-undone-lbl">visszavonva</div>` : undo}</div>`;
    }).join("") : `<div class="chat-empty">Például: „Adj hozzá a célcégekhez: (nemzetközi PSP D)” · „Vedd ki a célpozíciók közül a Tech Lead-et” · „Milyen szinonimákat javasolsz?”</div>`}</div>
    <div class="chat-quick">${STRAT_QUICK.map((q) => `<button class="ck-mini chat-q">${esc(q)}</button>`).join("")}</div>
    <div class="row" style="margin-top:10px">
      <label class="sr-only" for="chatIn">Üzenet a stratégia-asszisztensnek</label><input id="chatIn" class="brief-line" placeholder="Mit módosítsak a stratégián?" autocomplete="off" />
      <button id="chatSend" class="btn btn-primary">Küldés</button>
      ${log.length ? `<button id="chatClear" class="btn btn-ghost">Előzmény törlése</button>` : ""}
    </div>
  </section>`;
  wireDetails("sysPromptBox");
  if (keep) $("#chatIn").value = keep;
  const logEl = $("#chatLog");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  const send = () => {
    const v = $("#chatIn").value.trim();
    if (!v) return;
    $("#chatIn").value = "";
    sendStrategyChat(p, v);
  };
  $("#chatSend").onclick = send;
  $("#chatIn").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } };
  $$("#stratChat .chat-q").forEach((b) => (b.onclick = () => sendStrategyChat(p, b.textContent)));
  $$("#stratChat .chat-undo").forEach((b) => (b.onclick = () => undoStratEntry(p, Number(b.dataset.mi))));
  $$("#stratChat .chat-prop").forEach((b) => (b.onclick = () => applyProposal(p, Number(b.dataset.mi), Number(b.dataset.pi))));
  const cl = $("#chatClear");
  if (cl) cl.onclick = () => { p.strategy_chat = []; persist(); renderCelpiac(p); };
  // A rendszer-prompt a szerverről jön (mint élesben) — első kinyitáskor kérjük le.
  const sp = $("#sysPromptBox");
  const loadSysPrompt = async () => {
    if (!sp || !sp.open || p.strategy_system_prompt) return;
    try {
      const r = await api("POST", `/api/project/${p.id}/strategy-chat`, { message: "" });
      p.strategy_system_prompt = r.system_prompt || "—";
      persist();
      const t = $("#sysPromptTxt");
      if (t) t.textContent = p.strategy_system_prompt;
    } catch (e) { /* a demóban nem blokkoló */ }
  };
  if (sp) { const prev = sp.ontoggle; sp.ontoggle = () => { if (prev) prev(); loadSysPrompt(); }; loadSysPrompt(); }
}
async function sendStrategyChat(p, msg) {
  p.strategy_chat = p.strategy_chat || [];
  p.strategy_chat.push({ role: "user", text: msg, ts: new Date().toISOString() });
  persist();
  renderStrategyChat(p);
  const btn = $("#chatSend");   // az újrarender után kell lekérdezni
  await withLoading(btn, async (signal) => {
    const res = await api("POST", `/api/project/${p.id}/strategy-chat`, { message: msg }, { signal });
    if (res.system_prompt) p.strategy_system_prompt = res.system_prompt;
    const entry = { role: "assistant", text: res.reply || "", actions: [], proposals: (res.proposals || []).map((x) => ({ ...x, applied: false })), ts: new Date().toISOString() };
    for (const a of res.actions || []) {
      const gen = applyStratAction(p, a, false);
      if (gen === "map") p.talent_map = await api("POST", `/api/project/${p.id}/talent-map`);
      if (gen === "query") { const q = await api("POST", `/api/project/${p.id}/query`); p.query = mergeQueryPlan(p.query, q); }
      entry.actions.push(a);
    }
    p.strategy_chat.push(entry);
    persist();
    renderCelpiac(p);
    if (entry.actions.length) toast(`${entry.actions.length} módosítás alkalmazva a stratégián.`);
  }).catch(() => { renderStrategyChat(p); });
}
function undoStratEntry(p, i) {
  const m = (p.strategy_chat || [])[i];
  if (!m || m.undone) return;
  [...(m.actions || [])].reverse().forEach((a) => applyStratAction(p, a, true));
  (m.proposals || []).forEach((x) => (x.applied = false));
  m.undone = true;
  persist();
  renderCelpiac(p);
  toast("Módosítás visszavonva.");
}
function applyProposal(p, mi, pi) {
  const m = (p.strategy_chat || [])[mi];
  const prop = m && (m.proposals || [])[pi];
  if (!prop || prop.applied) return;
  applyStratAction(p, prop, false);
  prop.applied = true;
  if (m.undone) {
    // Visszavont bejegyzésbe nem írunk vissza — külön, önállóan visszavonható lépés lesz.
    p.strategy_chat.push({ role: "assistant", text: `Alkalmaztam a javaslatot: ${prop.label}`, actions: [prop], proposals: [], ts: new Date().toISOString() });
  } else {
    m.actions = m.actions || [];
    m.actions.push(prop);
  }
  persist();
  renderCelpiac(p);
  toast(`Hozzáadva: ${prop.label}`);
}
// Új AI-javaslat egyesítése a meglévő (kézzel szerkesztett) tervvel:
// a kézi hozzáadások megmaradnak, a kézi törlések nem jönnek vissza.
function mergeQueryPlan(oldQ, newQ) {
  if (!oldQ) return newQ;
  const out = { ...newQ };
  ["target_titles", "target_companies", "synonyms", "firecrawl_search_queries", "exclude_companies"].forEach((k) => {
    out[k] = (newQ[k] || []).filter((v) => !wasRemoved(oldQ, k, v));
    addUnique(out[k], oldQ[k] || []);
  });
  out.boolean_queries = (newQ.boolean_queries || []).filter((q) => !wasRemoved(oldQ, "boolean_queries", q.query));
  (oldQ.boolean_queries || []).forEach((q) => { if (!out.boolean_queries.some((x) => x.query === q.query)) out.boolean_queries.push(q); });
  out._edited_by_recruiter = !!oldQ._edited_by_recruiter;
  out._removed = oldQ._removed;
  return out;
}

// ── JELÖLTEK ────────────────────────────────────────────────────────────
function candStateChips(p, c) {
  const s = orState(p, c.id);
  const bits = [];
  if (c.is_new) bits.push(`<span class="new-chip">Új</span>`);
  if (s.replied) bits.push(sentiChip(s.sentiment));
  else if (s.sent) bits.push(`<span class="chip good">kiküldve</span>`);
  else if (s.hasDraft) bits.push(`<span class="chip">${s.reviewed ? "vázlat jóváhagyva" : "vázlat kész"}</span>`);
  else if (s.hasAttr) bits.push(`<span class="chip warn">nincs vázlat</span>`);
  return bits.join("");
}
// A jelölt következő lépése — az állapot-létra egyetlen címkéje.
function candNext(p, c) { return STAGE_LABEL[candStage(p, c)]; }
/* ── JELÖLTEK: tábla és lista ────────────────────────────────────────────
   Egy lista, öt oszlop. Az oszlopok maguk a lépések — a megkeresés állapotai
   nem külön képernyőn élnek, hanem itt, ahol a jelölt is.                  */
const BOARD_COLS = [
  ["rangsorolatlan", "Rangsorolatlan", "Állíts prioritást, vagy zárd ki"],
  ["elokeszites", "Előkészítés", "Megközelítési terv és üzenetvázlat"],
  ["jovahagyasra", "Jóváhagyás és küldés", "Ellenőrzés, majd a kiküldés rögzítése"],
  ["kikuldve", "Kiküldve", "Válaszra vár"],
  ["valaszolt", "Válaszolt", "Innen megy tovább interjúra"],
];
// Keskeny képernyőn a vízszintes tábla nem használható: a felhasználó
// beállítása megmarad, de a tényleges elrendezés lista lesz.
const NARROW = "(max-width: 900px)";
function isNarrow() { return typeof matchMedia === "function" && matchMedia(NARROW).matches; }
function effectiveCandView() { return isNarrow() ? "list" : (state.candView === "list" ? "list" : "board"); }
const strongCount = (x) => (x.signals || []).filter((s) => s.strength === "erős").length;

// A szűrők mindkét elrendezésre ugyanúgy hatnak. Az „állapot” szűrő csak
// listanézetben jelenik meg — a táblán az oszlop maga a szűrő.
function candMatches(p, x, f, withState) {
  if (f.q && !`${x.name} ${x.headline} ${x.current_company} ${x.location}`.toLowerCase().includes(f.q)) return false;
  const t = effTier(p, x.id);
  if (f.prio === "none" && t) return false;
  if (f.prio && f.prio !== "none" && t !== f.prio) return false;
  if (withState && f.state) {
    const s = orState(p, x.id);
    if (f.state === "new" && !x.is_new) return false;
    if (f.state === "noplan" && s.hasAttr) return false;
    if (f.state === "nodraft" && (s.hasDraft || !s.hasAttr)) return false;
    if (f.state === "sent" && !s.sent) return false;
    if (f.state === "replied" && !s.replied) return false;
  }
  return true;
}
// A prioritás-választó minden opciója a teljes címkét viseli, nem a puszta
// betűt: a „D" önmagában nem mondja meg, hogy „most nem javasolt".
function prioOptions(t) {
  return `<option value="" ${!t ? "selected" : ""}>— nincs</option>` +
    ["A", "B", "C", "D"].map((k) => `<option value="${k}" ${t === k ? "selected" : ""}>${esc(TIER_LABEL[k])}</option>`).join("");
}
/* A kártya korábban egy 5 opciós <select>-tel kezdődött, az ember neve fölött —
   az adminisztratív vezérlő rangsorolta felül a jelöltet. Ráadásul a kártya
   role="button" volt, benne egy <select>-tel: interaktív elem gomb belsejében,
   érvénytelen ARIA, és az aria-label elnyomta a headline-t és a jeleket.
   Most a név a belépési pont (saját gomb), a besorolás a lábban ül. */
function candCardHtml(p, x) {
  const t = effTier(p, x.id);
  const ov = p.priority_overrides[x.id];
  return `<div class="bcard tier-${t || "none"}" data-id="${esc(x.id)}">
    <button class="bcard-open" data-id="${esc(x.id)}">
      <span class="bcard-name">${esc(x.name)}${x.is_new ? ` <span class="new-chip">Új</span>` : ""}</span>
      <span class="bcard-meta">${esc(x.headline || "")}</span>
      <span class="bcard-meta dim">${esc([x.current_company, x.location].filter(Boolean).join(" · "))}</span>
      <span class="bcard-chips">${candStateChips(p, x)}<span class="chip">${strongCount(x)} erős jel</span></span>
      <span class="bcard-next">${esc(candNext(p, x))}</span>
    </button>
    <div class="bcard-foot">
      <span class="bcard-tier t-${t || "none"}" aria-hidden="true">${t || "—"}</span>
      <label class="sr-only" for="prio-b-${esc(x.id)}">${esc(x.name)} prioritása</label>
      <select class="prio-sel bcard-prio" id="prio-b-${esc(x.id)}" data-id="${esc(x.id)}">${prioOptions(t)}</select>
      ${ov ? `<span class="bcard-ov" title="A recruiter állította be">kézzel</span>` : ""}
    </div>
  </div>`;
}
function candRowHtml(p, x) {
  const t = effTier(p, x.id);
  const ov = p.priority_overrides[x.id];
  return `<div class="crow tier-${t || "none"}" data-id="${esc(x.id)}">
    <div class="crow-prio">
      <label class="sr-only" for="prio-l-${esc(x.id)}">${esc(x.name)} prioritása</label>
      <select class="prio-sel" id="prio-l-${esc(x.id)}" data-id="${esc(x.id)}">${prioOptions(t)}</select>
    </div>
    <div><div class="crow-name">${esc(x.name)}</div><div class="crow-head">${esc(x.headline || "")}</div></div>
    <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}</div>
    <div class="crow-meta">${srcLabel(x.source_type)}<br><span class="mut">${strongCount(x)} erős jel</span>${ov ? `<br><span class="mut">kézzel állítva</span>` : ""}</div>
    <div class="crow-state">${candStateChips(p, x)}<div class="mut" style="margin-top:3px">Következő: ${candNext(p, x)}</div></div>
    <button class="btn crow-open" data-id="${esc(x.id)}">Részletek</button>
  </div>`;
}
function renderCandidatesView(p) {
  const v = $("#view-jeloltek");
  const c = p.candidates || [];
  if (!c.length) {
    v.innerHTML = `<div class="stage"><div class="stage-head"><h2>Jelöltek</h2></div>
      <div class="dep-note"><span>Még nincs felkutatott jelölt. A jelöltkutatás a Célpiac nézetből indítható.</span><button class="btn btn-primary" id="depToCel">Célpiac</button></div></div>`;
    $("#depToCel").onclick = () => showView("celpiac");
    return;
  }
  const f = state.candFilter;
  const isBoard = effectiveCandView() === "board";
  const act = activeCandidates(p), exc = excludedCandidates(p);
  const shown = act.filter((x) => candMatches(p, x, f, !isBoard));

  // A vödrök a szűrt halmazból épülnek — amit nem látsz, azt nem is számoljuk.
  const cols = {}; BOARD_COLS.forEach(([k]) => (cols[k] = []));
  const watch = [];
  shown.forEach((x) => {
    const b = STAGE_BUCKET[candStage(p, x)];
    if (b === "figyelolista") watch.push(x);
    else if (cols[b]) cols[b].push(x);
  });
  const order = (x) => { const t = effTier(p, x.id); return { A: 0, B: 1, C: 2, D: 3 }[t] ?? 4; };
  const bySignal = (a, b) => order(a) - order(b) || strongCount(b) - strongCount(a);
  Object.values(cols).forEach((arr) => arr.sort(bySignal));
  watch.sort(bySignal);

  const rankNote = p.ranking ? "" : `<div class="dep-note"><span>${act.length} jelölt még prioritás nélkül. A javaslatot te bírálhatod felül.</span><button class="btn btn-primary" id="rankBtn2">Prioritási javaslat készítése</button></div>`;

  const board = `<div class="board" id="candBoard">${BOARD_COLS.map(([k, name, hint]) => `
    <section class="bcol" data-col="${k}" aria-label="${esc(name)}: ${cols[k].length} jelölt">
      <div class="bcol-head"><span class="bcol-name">${esc(name)}</span><span class="bcol-num">${cols[k].length}</span></div>
      <div class="bcol-rule"></div>
      <div class="bcol-body">${cols[k].map((x) => candCardHtml(p, x)).join("")
        || `<div class="bcol-empty">${esc(hint)}</div>`}</div>
    </section>`).join("")}</div>`;

  const listSections = BOARD_COLS.map(([k, name]) => cols[k].length ? `
    <details class="lgroup" open>
      <summary><span class="lgroup-name">${esc(name)}</span><span class="lgroup-num">${cols[k].length}</span></summary>
      <div class="lgroup-body">${cols[k].map((x) => candRowHtml(p, x)).join("")}</div>
    </details>` : "").join("");
  const list = `<div id="candRows" class="clist">${listSections || `<div class="ov-empty sm">Nincs a szűrőknek megfelelő jelölt.</div>`}</div>`;

  v.innerHTML = `<div class="stage">
    <div class="stage-head"><h2>Jelöltek</h2>
      <p class="stage-sub">${act.length} jelölt a merítésben${exc.length ? ` · ${exc.length} kizárva` : ""} · a prioritás a lista tulajdonsága — az AI-javaslatot bármikor felülírhatod.</p></div>
    ${exc.length ? `<div class="excl-banner"><span><b>${exc.length} jelölt nem került a listára.</b> Az ügyfél jelenlegi vagy volt munkatársai, illetve off-limits cégnél dolgozók — őket a hiring manager ismeri.</span><button class="btn" id="candExShow">Megnézem</button></div>` : ""}
    <div class="cand-toolbar">
      ${isNarrow() ? "" : `<div class="viewtog" role="group" aria-label="Elrendezés">
        <button class="filter-pill${isBoard ? " active" : ""}" data-cv="board" aria-pressed="${isBoard}">Tábla</button>
        <button class="filter-pill${isBoard ? "" : " active"}" data-cv="list" aria-pressed="${!isBoard}">Lista</button>
      </div>`}
      ${p.ranking ? `<button class="btn" id="rankBtn">Prioritási javaslat frissítése</button>` : ""}
      <select id="fPrio" aria-label="Prioritás szűrő"><option value="">prioritás: mind</option>${["A", "B", "C", "D"].map((k) => `<option value="${k}" ${f.prio === k ? "selected" : ""}>${k}</option>`).join("")}<option value="none" ${f.prio === "none" ? "selected" : ""}>nincs prioritás</option></select>
      ${isBoard ? "" : `<select id="fState" aria-label="Állapot szűrő"><option value="">állapot: mind</option><option value="new" ${f.state === "new" ? "selected" : ""}>új</option><option value="noplan" ${f.state === "noplan" ? "selected" : ""}>nincs terv</option><option value="nodraft" ${f.state === "nodraft" ? "selected" : ""}>nincs vázlat</option><option value="sent" ${f.state === "sent" ? "selected" : ""}>kiküldve</option><option value="replied" ${f.state === "replied" ? "selected" : ""}>válaszolt</option></select>`}
      <span class="mut" style="font-size:12px">${shown.length}/${act.length} látható</span>
    </div>
    <div id="rankSlot">${rankNote}</div>
    ${p.ranking && p.ranking.note ? `<div class="card-d" style="margin:6px 0 2px">${esc(p.ranking.note)} ${demoTag(p.ranking)}</div>` : ""}
    ${isBoard ? board : list}

    ${watch.length ? `<details class="lane" id="watchLane">
      <summary><b>Figyelőlista</b> — C és D prioritás, nem a mostani körben <span class="lane-num">${watch.length}</span></summary>
      <div class="lane-body" id="watchRows">${watch.map((x) => candRowHtml(p, x)).join("")}</div>
      <div class="note">A megkeresés-állapotuk itt is látszik: ha valakit már megkerestél, majd hátrasoroltál, nem tűnik el nyomtalanul.</div>
    </details>` : ""}

    ${exc.length ? `<details class="excl-details lane" id="exclDetails" ${state.openExcluded ? "open" : ""}>
      <summary>Kizárva a merítésből — indoklással, bármikor visszahozható <span class="lane-num">${exc.length}</span></summary>
      <div id="exclRows">${exc.map((x) => {
        const e = exclusionFor(p, x) || {};
        return `<div class="crow crow-excl" data-id="${esc(x.id)}">
          <span class="excl-tag">${esc(e.label || "kizárva")}</span>
          <div><div class="crow-name">${esc(x.name)}</div><div class="crow-head">${esc(x.headline || "")}</div></div>
          <div class="crow-meta">${esc(x.current_company || "")}${x.location ? "<br>" + esc(x.location) : ""}</div>
          <div class="crow-meta excl-reason">${esc(e.detail || "")}</div>
          <button class="btn excl-back" data-id="${esc(x.id)}" title="Visszahozás a merítésbe">Mégis bevonom</button>
        </div>`;
      }).join("")}</div>
      <div class="note">A kizárás nem törlés: a találat megmarad, csak nem kerül a munkalistára és a megkeresésekbe. A szabályokat a <b>Célpiac</b> nézetben állíthatod.</div>
    </details>` : ""}
  </div>`;

  if (state.openExcluded) {
    state.openExcluded = false;
    const d0 = $("#exclDetails");
    if (d0) setTimeout(() => d0.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }
  $$(".viewtog .filter-pill").forEach((b) => (b.onclick = () => {
    state.candView = b.dataset.cv;
    saveUi();
    renderCandidatesView(p);
  }));
  const exBtn = $("#candExShow");
  if (exBtn) exBtn.onclick = () => {
    const d = $("#exclDetails");
    if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  $$("#exclRows .excl-back").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    setCandExclusion(p, b.dataset.id, "include", "A recruiter szándékosan bevonta.");
    state.openExcluded = true;
    renderCandidatesView(p);
    toast("Jelölt visszahozva a merítésbe.");
  }));
  $$("#exclRows .crow-excl").forEach((r) => (r.onclick = () => openPanel(r.dataset.id)));
  const rb = $("#rankBtn") || $("#rankBtn2");
  if (rb) rb.onclick = (e) => runRank(e.target, p);
  $$("#view-jeloltek .prio-sel").forEach((sel) => {
    sel.onclick = (e) => e.stopPropagation();
    sel.onkeydown = (e) => e.stopPropagation();
    sel.onchange = () => {
      const id = sel.dataset.id;
      if (sel.value) p.priority_overrides[id] = sel.value;
      else delete p.priority_overrides[id];
      persist();
      // A teljes tábla újraépül, ezért a vízszintes görgetés eddig minden
      // egyes besorolásnál nullára ugrott — balról jobbra triázsolni így
      // fizikailag lehetetlen volt. Megjegyezzük és visszaállítjuk.
      const b = $("#candBoard");
      const sx = b ? b.scrollLeft : 0;
      renderCandidatesView(p);
      const b2 = $("#candBoard");
      if (b2) b2.scrollLeft = sx;
      const again = $("#prio-b-" + CSS.escape(id)) || $("#prio-l-" + CSS.escape(id));
      if (again) again.focus();
    };
  });
  $$("#view-jeloltek .crow-open").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openPanel(b.dataset.id); }));
  $$("#candRows .crow, #watchRows .crow").forEach((r) => (r.onclick = () => openPanel(r.dataset.id)));
  $$("#candBoard .bcard-open").forEach((b) => (b.onclick = () => openPanel(b.dataset.id)));
  const fp = $("#fPrio"), fs = $("#fState");
  const applyFilters = () => {
    state.candFilter.prio = fp ? fp.value : "";
    if (fs) state.candFilter.state = fs.value;
    renderCandidatesView(p);
  };
  if (fp) fp.onchange = applyFilters;
  if (fs) fs.onchange = applyFilters;
}

/* A rangsorolás a másik hosszú művelet, ami éles környezetben elbukott (500),
   és a bukás után a tábla pixelre ugyanaz maradt: a felhasználó nem tudta
   megkülönböztetni a hibát attól, hogy el sem indította. A skeleton és a
   hibakártya a rangsor-sávba kerül, közvetlenül a tábla fölé. */
function runRank(btn, p) {
  const pid = p.id;
  return withLoading(btn, async (signal) => {
    const r = await api("POST", `/api/project/${pid}/rank`, null, { signal });
    if (!stillOn(pid)) return;
    p.ranking = r;
    persist();
    renderCandidatesView(p);
    toast("Prioritási javaslat kész — ellenőrizd és igazítsd, ha kell.");
  }, {
    into: "#rankSlot",
    label: `${activeCandidates(p).length} jelölt rangsorolása`,
    retry: () => runRank($("#rankBtn") || $("#rankBtn2") || btn, p),
  }).catch(() => {});
}

// ── JELÖLT RÉSZLETES NÉZET (oldalsó panel) ──────────────────────────────
/* Két oldalsó fiók van: a jelöltpanel és a napló. Egyszerre csak az egyik
   lehet nyitva — a sötétítés és a görgetés-zár közös. */
function anyDrawerOpen() { return !!state.drawerId || state.notesOpen || state.moreOpen; }
function syncScrim() {
  const on = anyDrawerOpen();
  $("#scrim").classList.toggle("hidden", !on);
  document.body.classList.toggle("no-scroll", on);
}
/* Fókusz-visszaadás: a panelt megnyitó elemet megjegyezzük, és záráskor
   oda tesszük vissza a fókuszt. Enélkül a bezárás után a fókusz a <body>-ra
   esett vissza, és a billentyűzetes felhasználó elölről kezdhette a Tab-olást. */
function rememberFocus() {
  const a = document.activeElement;
  state.lastFocus = a && a !== document.body ? a : null;
}
function restoreFocus() {
  const a = state.lastFocus;
  state.lastFocus = null;
  if (a && document.contains(a) && a.offsetParent !== null) { try { a.focus(); } catch {} }
}
function openNotesDrawer() {
  if (!state.project) return;
  rememberFocus();
  closeDrawer();
  state.notesOpen = true;
  $("#notesDrawer").classList.remove("hidden");
  syncScrim();
  renderNotes(state.project);
  const h = $("#notesTitle"); if (h) h.focus();
}
function closeNotesDrawer() {
  if (!state.notesOpen) return;
  state.notesOpen = false;
  $("#notesDrawer").classList.add("hidden");
  syncScrim();
  restoreFocus();
}
const PANEL_TABS = [["profil", "Profil"], ["megkozelites", "Megközelítés"], ["uzenet", "Üzenet"], ["naplo", "Napló"]];
function openPanel(id, tab) {
  const p = state.project; if (!p) return;
  const c = candById(p, id); if (!c) return;
  const wasOpen = !!state.drawerId;
  if (!wasOpen) rememberFocus();
  state.drawerId = id;
  state.panelTab = PANEL_TABS.some(([k]) => k === tab) ? tab : "profil";
  if (c.is_new) { c.is_new = false; persist(); }
  closeSearchResults();
  closeNotesDrawer();
  $("#candDrawer").classList.remove("hidden");
  syncScrim();
  // A telefonos vissza-gomb a panelt zárja, ne a megbízást hagyja el.
  if (!wasOpen) { try { history.pushState({ jelPanel: id }, ""); } catch (e) {} }
  renderDrawer(p, c);
  const h = $("#candDrawerTitle"); if (h) h.focus();
}
function closeDrawer(fromPop) {
  if (!state.drawerId) return;
  state.drawerId = null;
  $("#candDrawer").classList.add("hidden");
  syncScrim();
  if (!fromPop && history.state && history.state.jelPanel) { try { history.back(); } catch (e) {} }
  restoreFocus();
}
// A régi név megmarad, hogy a hívási helyek egy helyen legyenek átvezethetők.
function openDrawer(id) { openPanel(id); }
function setPanelTab(tab) {
  const p = state.project; if (!p || !state.drawerId) return;
  const c = candById(p, state.drawerId); if (!c) return;
  // Fülváltás nem veszíthet el begépelt szöveget.
  if (state.panelTab === "uzenet") syncMessageDraft(p, state.drawerId);
  state.panelTab = tab;
  renderDrawer(p, c);
}
// Jelölt-idővonal: nem tárolunk külön eseménynaplót — a meglévő mezőkből áll össze.
function candTimeline(p, c) {
  const s = (p.outreach_status || {})[c.id] || {};
  const ev = [];
  if (s.reviewed_at) ev.push({ ts: s.reviewed_at, kind: "esemeny", note: "Üzenetvázlat jóváhagyva" });
  if (s.sent_at) ev.push({ ts: s.sent_at, kind: "esemeny", note: "Megkeresés kiküldve" });
  if (s.replied_at) ev.push({ ts: s.replied_at, kind: "esemeny", note: "Válasz érkezett — " + sentiLabel(s.sentiment) });
  (p.memory || []).forEach((m) => { if (m.candidate_id === c.id) ev.push(m); });
  ev.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
  return ev;
}
const NOTE_KIND_LABEL = { esemeny: "esemény", candidate: "jelölt", note: "megbízás" };
function renderNoteList(entries, opts) {
  opts = opts || {};
  if (!entries.length) return `<div class="ov-empty sm">${esc(opts.empty || "Még nincs bejegyzés.")}</div>`;
  return entries.map((e) => {
    const kind = NOTE_KIND_LABEL[e.kind] || NOTE_KIND_LABEL.note;
    const who = opts.candidateName && e.candidate_id ? `<b>${esc(opts.candidateName(e.candidate_id))}</b> — ` : "";
    return `<div class="note-row"><span class="note-kind${e.kind === "esemeny" ? " ev" : ""}">${esc(kind)}</span>
      <div class="note-body">${who}${esc(e.note)}<div class="note-ts">${esc(String(e.ts || "").slice(0, 16).replace("T", " "))}</div></div></div>`;
  }).join("");
}
function renderDrawer(p, c) {
  const ts = $("#drawerTask"); if (ts) ts.innerHTML = "";
  $("#candDrawerTitle").textContent = c.name || c.id;
  $("#candDrawerSub").textContent = [c.headline, c.current_company].filter(Boolean).join(" · ");
  const a = (p.assessments || {})[c.id];
  const at = (p.attraction || {})[c.id];
  const o = (p.outreach || {})[c.id];
  const s = orState(p, c.id);
  const t = effTier(p, c.id);
  const body = $("#candDrawerBody");
  const exc = exclusionFor(p, c);
  const man = (p.exclusions.candidates || {})[c.id];
  const tab = state.panelTab || "profil";

  // Fülek: a role="tab" eddig panel-asszociáció és nyílbillentyű nélkül állt,
  // ami rosszabb, mint a sima gomb — a képernyőolvasó fület ígért, de a
  // hozzá tartozó tartalmat nem lehetett megtalálni.
  const badge = { uzenet: o ? (s.sent ? "✓" : "•") : "", naplo: candTimeline(p, c).length || "" };
  $("#candTabs").innerHTML = PANEL_TABS.map(([k, lbl]) =>
    `<button class="tab${tab === k ? " on" : ""}" role="tab" id="ctab-${k}" aria-controls="candDrawerBody"
      aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" data-tab="${k}">${esc(lbl)}${badge[k] ? `<span class="tab-b">${esc(String(badge[k]))}</span>` : ""}</button>`).join("");
  body.setAttribute("role", "tabpanel");
  body.setAttribute("aria-labelledby", "ctab-" + tab);
  body.setAttribute("tabindex", "0");

  const banner = exc
    ? `<div class="excl-banner d"><div><b>${esc(exc.label)}</b><div class="crow-meta">${esc(exc.detail || "")}</div></div>
      <button class="btn" id="dExInclude">Mégis bevonom</button></div>`
    : man && man.state === "include"
      ? `<div class="excl-banner ok d"><div><b>Kizárás felülbírálva</b><div class="crow-meta">A recruiter szándékosan bevonta a merítésbe.</div></div>
      <button class="btn btn-ghost" id="dExRevert">Vissza a kizártakhoz</button></div>` : "";

  const panes = {
    profil: `
    <div class="d-sec"><h5>Profil</h5>
      <div class="crow-name">${esc(c.name)}</div>
      <div class="crow-head">${esc(c.headline || "")}</div>
      <div class="crow-meta" style="margin-top:4px">${[c.current_company, c.location].filter(Boolean).map(esc).join(" · ")}</div>
      ${(c.past_companies || []).length ? `<div class="crow-meta" style="margin-top:2px">Korábban: ${(c.past_companies || []).map(esc).join(" · ")}</div>` : ""}
      <div class="row" style="margin-top:8px">
        <label for="dPrio">Prioritás:</label>
        <select class="prio-sel" id="dPrio">${prioOptions(t)}</select>
      </div>
    </div>
    <div class="d-sec"><h5>Evidenciák és források ${evTag("fact")}</h5>
      ${(c.signals || []).map((sg) => `<div class="cand-sig"><span class="s">• ${esc(sg.signal)} <span class="chip ${sg.strength === "erős" ? "good" : sg.strength === "gyenge" ? "" : "warn"}">${esc(sg.strength || "")}</span></span></div>`).join("") || "<div class='mut'>Nincs rögzített jel.</div>"}
      <div class="prov" style="margin-top:6px">${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener">forrás ↗</a> · ` : ""}<span class="art14">Art. 14: ${esc(c.art14_status || "—")}</span> · ${srcLabel(c.source_type)}</div>
    </div>
    <div class="d-sec"><h5>Profil összegzése ${a ? demoTag(a) : ""}</h5>
      ${a ? `
        ${a.fit ? `<span class="chip ${String(a.fit).includes("nem") ? "crit" : a.fit === "erős" ? "good" : "warn"}">illeszkedés: ${esc(a.fit)}</span>` : ""}
        ${a.fit_reason ? `<p style="margin-top:6px">${esc(a.fit_reason)}</p>` : ""}
        ${F.summary(a) ? `<p><b>Összegzés:</b> ${esc(F.summary(a))} ${evTag("inference")}</p>` : ""}
        ${F.strength(a) ? `<p><b>Erősség:</b> ${esc(F.strength(a))}</p>` : ""}
        ${F.qclarify(a).length ? `<h5 style="margin-top:8px">A beszélgetésen tisztázandó</h5>${list(F.qclarify(a))}` : ""}
        ${(a.unknowns || []).length ? `<h5 style="margin-top:8px">Amit nem tudunk</h5>${a.unknowns.map((u) => `<div class="flag">? ${esc(u)}</div>`).join("")}` : ""}`
      : `<button class="btn" id="dAssess">Profil összegzése</button>`}
    </div>`,

    megkozelites: `
    <div class="d-sec"><h5>Megközelítési terv ${at ? demoTag(at) : ""}</h5>
      ${at ? renderAttractInner(at) : `<p class="card-d" style="margin-top:0">Mit érdemes mondani ennek az embernek, és miért — a jeleiből visszavezetve.</p><button class="btn btn-primary" id="dAttract">Megközelítési terv készítése</button>`}
    </div>
    ${at ? `<div class="d-sec"><h5>Következő lépés</h5>
      ${o ? `<p class="mut" style="font-size:12.5px">Az üzenetvázlat elkészült.</p><button class="btn" id="dGoMsg">Üzenet megnyitása</button>`
          : `<button class="btn btn-primary" id="dDraft">Üzenetvázlat készítése</button>`}</div>` : ""}`,

    uzenet: `<div id="orEditor"></div>`,

    naplo: `
    <div class="d-sec"><h5>Aktivitás</h5>
      <div class="crow-meta">Utolsó lépés: ${relTime(c.last_touched)}${s.sent ? " · kiküldve" : ""}${s.replied ? " · " + esc(sentiLabel(s.sentiment)) : ""}</div>
      <div class="row" style="margin-top:8px"><button class="btn" id="dTouch">Aktivitás rögzítése</button>
        ${!exc ? `<button class="btn btn-ghost" id="dExExclude" title="Kivétel a merítésből">Kizárom a merítésből</button>` : ""}</div>
      <div id="dExcludeForm"></div>
    </div>
    <div class="d-sec"><h5>Jegyzet hozzáadása</h5>
      <div class="row"><label class="sr-only" for="dNoteIn">Jegyzet a jelöltről</label><input id="dNoteIn" class="brief-line" placeholder="Mit érdemes tudni erről a jelöltről?" />
        <button class="btn btn-primary" id="dNoteSave">Mentés</button></div>
    </div>
    <div class="d-sec"><h5>Előzmény</h5>
      ${renderNoteList(candTimeline(p, c), { empty: "Még nincs esemény és jegyzet ennél a jelöltnél." })}
    </div>`,
  };
  body.innerHTML = banner + (panes[tab] || panes.profil);

  $$("#candTabs .tab").forEach((b, i, arr) => {
    b.onclick = () => setPanelTab(b.dataset.tab);
    b.onkeydown = (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -i : e.key === "End" ? arr.length - 1 - i : 0;
      if (!d) return;
      e.preventDefault();
      const n = arr[(i + d + arr.length) % arr.length];
      setPanelTab(n.dataset.tab);
      const moved = $("#candTabs .tab.on");
      if (moved) moved.focus();
    };
  });
  if (tab === "uzenet") renderMessageTab(p, c.id, $("#orEditor"));
  const dGo = $("#dGoMsg"); if (dGo) dGo.onclick = () => setPanelTab("uzenet");
  const nSave = $("#dNoteSave");
  if (nSave) nSave.onclick = () => {
    const note = $("#dNoteIn").value.trim();
    if (!note) return;
    p.memory = p.memory || [];
    p.memory.push({ ts: new Date().toISOString(), kind: "candidate", candidate_id: c.id, note });
    persist();
    renderDrawer(p, c);
    toast("Jegyzet mentve.");
  };
  const dInc = $("#dExInclude");
  if (dInc) dInc.onclick = () => { setCandExclusion(p, c.id, "include", "A recruiter szándékosan bevonta."); renderDrawer(p, c); render(state.view); toast("Jelölt bevonva a merítésbe."); };
  const dRev = $("#dExRevert");
  if (dRev) dRev.onclick = () => { setCandExclusion(p, c.id, null); renderDrawer(p, c); render(state.view); toast("Visszaállítva az alapértelmezett kizárási szabály."); };
  // A natív prompt() stílustalan, nem fordítható, és több mobil/in-app
  // böngészőben blokkolt — az indoklás bekérése helyben történik.
  const dExc = $("#dExExclude");
  if (dExc) dExc.onclick = () => {
    const host = $("#dExcludeForm");
    if (!host) return;
    host.innerHTML = `<div class="excl-ask">
      <label for="dExcReason">Miért zárod ki? Az indoklás a kizártak listáján is látszik.</label>
      <div class="row"><input id="dExcReason" class="brief-line" placeholder="pl. tavaly elutasított minket" />
        <button class="btn btn-primary" id="dExcOk">Kizárom</button>
        <button class="btn btn-ghost" id="dExcNo">Mégse</button></div>
    </div>`;
    const inp = $("#dExcReason");
    inp.focus();
    const go = () => {
      setCandExclusion(p, c.id, "exclude", inp.value.trim());
      // A jelölt nem tűnhet el nyomtalanul: nyitva mutatjuk, hova került.
      state.openExcluded = true;
      renderDrawer(p, c);
      render(state.view);
      toast("Jelölt kizárva a merítésből — a kizártak közt megtalálod.");
    };
    $("#dExcOk").onclick = go;
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } };
    $("#dExcNo").onclick = () => { host.innerHTML = ""; dExc.focus(); };
  };
  const dPr = $("#dPrio");
  if (dPr) dPr.onchange = (e) => {
    if (e.target.value) p.priority_overrides[c.id] = e.target.value;
    else delete p.priority_overrides[c.id];
    persist();
    renderDrawer(p, c);
    if (state.view === "jeloltek") renderCandidatesView(p);
  };
  // A panel műveletei is a teljes kezelést kapják: a várakozás és a hiba a
  // panel tetején, tartósan — nem egy elszálló buborékban.
  const panelTask = (btn, label, run, retry) => withLoading(btn, run, { into: "#drawerTask", label, retry }).catch(() => {});
  const dA = $("#dAssess");
  if (dA) dA.onclick = (e) => panelTask(e.target, "Profil összegzése", async (signal) => {
    const out = await api("POST", `/api/project/${p.id}/assess`, { candidateId: c.id }, { signal });
    p.assessments = p.assessments || {};
    p.assessments[c.id] = out;
    c.last_touched = new Date().toISOString();
    persist();
    renderDrawer(p, c);
  }, () => { const b = $("#dAssess"); if (b) b.click(); });
  const dAt = $("#dAttract");
  if (dAt) dAt.onclick = (e) => panelTask(e.target, "Megközelítési terv készítése", async (signal) => {
    const out = await api("POST", `/api/project/${p.id}/attract`, { candidateId: c.id }, { signal });
    p.attraction = p.attraction || {};
    p.attraction[c.id] = out;
    c.last_touched = new Date().toISOString();
    persist();
    renderDrawer(p, c);
  }, () => { const b = $("#dAttract"); if (b) b.click(); });
  const dD = $("#dDraft");
  if (dD) dD.onclick = (e) => panelTask(e.target, "Üzenetvázlat készítése", async (signal) => {
    const out = await api("POST", `/api/project/${p.id}/outreach`, { candidateId: c.id }, { signal });
    p.outreach = p.outreach || {};
    p.outreach[c.id] = out;
    c.last_touched = new Date().toISOString();
    persist();
    // A vázlat ott készül el, ahol dolgozol: a panel nyitva marad, csak fület vált.
    setPanelTab("uzenet");
    if (state.view === "jeloltek") render(state.view);
  }, () => { const b = $("#dDraft"); if (b) b.click(); });
  const dT = $("#dTouch");
  if (dT) dT.onclick = () => touchCand(c.id).then(() => renderDrawer(p, c));
}
function renderAttractInner(o) {
  const gr = o.grounded_read || {};
  const facts = (gr.known_facts || []).map((f) =>
    `<div class="driver"><div class="driver-h">${esc(f.fact || "")}</div>${f.from_signal ? `<div class="driver-e">🔗 ${esc(f.from_signal)}</div>` : ""}</div>`
  ).join("") || `<div class="mut" style="font-size:12px">Nincs a jelekből visszavezethető tény — ez önmagában jelzés.</div>`;
  const ideas = (o.attraction_ideas || []).slice().sort((a, b) => (a.rank || 9) - (b.rank || 9));
  const best = ideas[0];
  const rest = ideas.slice(1);
  return `
    <h5>Amit tudunk ${evTag("fact")}</h5>${facts}
    ${(gr.unknowns || []).length ? `<h5 style="margin-top:8px">Amit nem tudunk</h5>${gr.unknowns.map((u) => `<div class="flag">? ${esc(u)}</div>`).join("")}` : ""}
    ${gr.confidence ? `<div class="card-d">Bizonyosság: ${esc(gr.confidence)}</div>` : ""}
    <h5 style="margin-top:10px">Megközelítési javaslat ${evTag("assume")}</h5>
    ${best ? `<div class="idea idea-best"><div class="angle">${esc(best.angle || "")}</div>
      ${best.hook ? `<div class="attract-hook">Nyitómondat-ötlet: „${esc(best.hook)}”</div>` : ""}
      ${best.why_might_work ? `<div class="driver-e">Miért működhet: ${esc(best.why_might_work)}</div>` : ""}</div>` : ""}
    ${rest.length ? `<div style="margin-top:6px">${rest.map((i) => `<div class="driver"><div class="driver-h">#${i.rank || "?"} — ${esc(i.angle || "")}</div>${i.why_might_work ? `<div class="driver-e">${esc(i.why_might_work)}</div>` : ""}</div>`).join("")}</div>` : ""}
    ${o.channel ? `<h5 style="margin-top:8px">Csatorna</h5><p style="font-size:12.5px">${esc(o.channel)}</p>` : ""}
    ${o.timing ? `<h5 style="margin-top:6px">Miért lehet időszerű</h5><p style="font-size:12.5px">${esc(o.timing)}</p>` : ""}
    ${(o.risks || []).length ? `<h5 style="margin-top:6px">Kerülendő megközelítések</h5>${o.risks.map((r) => `<div class="flag">${esc(r)}</div>`).join("")}` : ""}
    ${gr._stripped_ungrounded ? `<div class="card-d" style="margin-top:6px">🛡️ ${gr._stripped_ungrounded} nem-visszavezethető állítás automatikusan kiszűrve (evidencia-földelés).</div>` : ""}`;
}

// ── MEGKERESÉS-VÁZLAT ───────────────────────────────────────────────────
async function makeDraft(p, id, btn) {
  return withLoading(btn, async (signal) => {
    if (!(p.attraction || {})[id]) {
      const at = await api("POST", `/api/project/${p.id}/attract`, { candidateId: id }, { signal });
      p.attraction = p.attraction || {};
      p.attraction[id] = at;
    }
    const out = await api("POST", `/api/project/${p.id}/outreach`, { candidateId: id }, { signal });
    p.outreach = p.outreach || {};
    p.outreach[id] = out;
    const cd = candById(p, id); if (cd) cd.last_touched = new Date().toISOString();
    persist();
    openPanel(id, "uzenet");
  }, { into: "#drawerTask", label: "Megközelítési terv és üzenetvázlat készítése", retry: () => makeDraft(p, id, btn) }).catch(() => {});
}
// Az üzenet fül tartalma. Ugyanaz a szerkesztő, mint korábban — csak ott van,
// ahol a jelölt többi adata is.
function renderMessageTab(p, id, box) {
  if (!box) return;
  const o = (p.outreach || {})[id];
  const c = candById(p, id) || {};
  const s = orState(p, id);
  const at = (p.attraction || {})[id];
  if (!o) {
    box.innerHTML = `<div class="d-sec"><h5>Üzenetvázlat</h5>
      <p class="card-d" style="margin-top:0">${at
        ? "A megközelítési terv megvan — ebből készül a vázlat, amit te ellenőrzöl és a saját csatornádon küldesz ki."
        : "Vázlat előtt megközelítési terv kell: abból tudja az elemzés, mit érdemes mondani ennek az embernek."}</p>
      <button class="btn btn-primary" id="msgMake">${at ? "Üzenetvázlat készítése" : "Megközelítési terv és vázlat készítése"}</button>
    </div>`;
    const mk = $("#msgMake");
    if (mk) mk.onclick = (e) => makeDraft(p, id, e.target);
    return;
  }
  box.innerHTML = `<div class="or-editor in-panel">
    <div class="ck-sec-head"><h3>Üzenetvázlat ${demoTag(o)} ${aiTag(s.reviewed || s.sent)}</h3>
      <span class="ck-sec-note">${esc(o.channel || "")}${o.language ? " · " + esc(o.language) : ""}</span></div>
    <label class="sr-only" for="orSubj">Üzenet tárgya</label><input class="subj" id="orSubj" value="${esc(o.subject || "")}" placeholder="Tárgy" />
    <label class="sr-only" for="orBody">Üzenet szövege</label><textarea class="body" id="orBody">${esc(o.body || "")}</textarea>
    ${(o.why_this_works || []).length ? `<details class="or-why"><summary>A javaslat indoklása</summary>${list(o.why_this_works)}</details>` : ""}
    <div class="row" style="margin-top:12px">
      ${!s.reviewed && !s.sent ? `<button class="btn btn-primary" id="orApprove">Jóváhagyva ✓</button>` : ""}
      <button class="btn" id="orCopy">Másolás</button>
      ${!s.sent ? `<button class="btn" id="orSent">Kiküldés rögzítése</button>` : ""}
      ${s.sent && !s.replied ? `<span class="ck-mini-lbl">válasz:</span>
        <button class="ck-mini good" data-s="pozitív">pozitív</button>
        <button class="ck-mini warn" data-s="semleges">semleges</button>
        <button class="ck-mini bad" data-s="negatív">negatív</button>` : ""}
      ${s.sent ? `<button class="btn btn-ghost" id="orReset" title="állapot visszavonása">↺</button>` : ""}
      <button class="btn btn-ghost" id="orArt14">GDPR Art. 14 értesítő</button>
    </div>
    <div id="art14Slot"></div>
    <div class="note">A kiküldés a te csatornádon történik (e-mail, LinkedIn) — itt csak az állapotát rögzíted.</div>
  </div>`;
  // Újrarender után a háttérben lévő listát is frissítjük, de a panel marad.
  const refresh = () => {
    const c2 = candById(p, id);
    if (c2 && state.drawerId === id) renderDrawer(p, c2);
    if (state.view === "jeloltek" || state.view === "attekintes") render(state.view);
  };
  $("#orSubj").onchange = () => syncMessageDraft(p, id);
  $("#orBody").onchange = () => syncMessageDraft(p, id);
  const ap = $("#orApprove");
  if (ap) ap.onclick = async () => {
    syncMessageDraft(p, id);
    await setOrStatus(p, id, { status: "reviewed" });
    refresh();
    toast("Vázlat jóváhagyva.");
  };
  $("#orCopy").onclick = () => {
    navigator.clipboard.writeText(($("#orSubj").value ? $("#orSubj").value + "\n\n" : "") + $("#orBody").value);
    toast("Vágólapra másolva.");
  };
  const sb = $("#orSent");
  if (sb) sb.onclick = async () => {
    syncMessageDraft(p, id);
    await setOrStatus(p, id, { status: "sent" });
    refresh();
    toast("Kiküldés rögzítve.");
  };
  $$(".ck-mini", box).forEach((b) => (b.onclick = async () => {
    await setOrStatus(p, id, { sentiment: b.dataset.s });
    refresh();
  }));
  const rs = $("#orReset");
  if (rs) rs.onclick = async () => { await setOrStatus(p, id, { status: "reset" }); refresh(); };
  $("#orArt14").onclick = (e) => withLoading(e.target, async (signal) => {
    const a = await api("POST", `/api/project/${p.id}/art14`, { candidateId: id }, { signal });
    $("#art14Slot").innerHTML = `<div class="mail" style="margin-top:10px"><div class="mail-head"><span class="mail-subj">${esc(a.subject)}</span><span>${esc(a.must_send_within)}</span></div><div class="mail-body">${esc(a.body)}</div></div><div class="note">${esc(a.note)}</div>`;
  }, { into: "#drawerTask", label: "GDPR Art. 14 értesítő készítése" }).catch(() => {});
}
// A szerkesztőmező tartalma `change`-re (fókuszvesztéskor) mentődik. Fülváltásnál
// és újrarendernél ez nem mindig ér oda — ezért minden ilyen előtt kézzel mentünk.
function syncMessageDraft(p, id) {
  const subj = $("#orSubj"), body = $("#orBody");
  const o = (p.outreach || {})[id];
  if (!o || (!subj && !body)) return;
  if (subj) o.subject = subj.value;
  if (body) o.body = body.value;
  o.edited_by_recruiter = true;
  persist();
}
async function setOrStatus(p, id, body) {
  try {
    const r = await api("POST", `/api/project/${p.id}/outreach-status`, { candidateId: id, ...body });
    p.outreach_status = p.outreach_status || {};
    if (r.status) p.outreach_status[id] = r.status; else delete p.outreach_status[id];
    const cd = candById(p, id); if (cd) cd.last_touched = new Date().toISOString();
    persist();
  } catch (e) { const i = errorInfo(e); toast(i.title + " " + i.detail, true); }
}

// ── ÜGYFÉL ÉS INTERJÚ ───────────────────────────────────────────────────
// Az interjúterv a folyamat végén dolgozik: amíg nincs pozitív válasz,
// elmagyarázza, mire vár, ahelyett hogy üres képernyőt adna.
function renderInterviewView(p) {
  const gate = $("#interjuGate");
  if (gate) {
    gate.innerHTML = hasPositiveReply(p) ? "" :
      `<div class="dep-note"><span>Az interjúterv az első <b>pozitív</b> válasz után válik hasznossá — addig nem tudni, kivel készül. A negatív és a semleges válasz nem oldja fel.</span>
       <button class="btn btn-primary" id="gateToCand">Jelöltek</button></div>`;
    const g = $("#gateToCand");
    if (g) g.onclick = () => showView("jeloltek");
  }
  renderInterview(p.interview);
}
function renderAdvisory(o) {
  const out = $("#advisoryOut"); if (!out) return;
  if (!o) { out.innerHTML = ""; return; }
  out.innerHTML = `<div class="card"><h4>Egyeztetési javaslatok ${demoTag(o)}</h4>${list(o.talking_points)}
    ${F.meetPrep(o) ? `<h4 style="margin-top:8px">Felkészülés az egyeztetésre</h4><p>${esc(F.meetPrep(o))}</p>` : ""}
    ${(o.watch_outs || []).length ? `<h4 style="margin-top:8px">Kockázatok</h4>${chips(o.watch_outs, "warn")}` : ""}</div>`;
}
function renderInterview(o) {
  const out = $("#interviewOut"); if (!out) return;
  if (!o) { out.innerHTML = ""; return; }
  out.innerHTML = `<div class="card"><h4>Interjúterv ${demoTag(o)}</h4>
    ${(o.competency_questions || []).map((q) => `<div style="margin-bottom:10px"><div class="q-plat">${esc(q.competency)}</div><p style="margin:2px 0"><b>${esc(q.question)}</b></p><div class="driver-e">Erős válasz: ${esc(q.what_good_looks_like)}</div></div>`).join("")}
    ${F.ivSignals(o).length ? `<h4>Tisztázandó jelek</h4>${chips(F.ivSignals(o), "warn")}` : ""}</div>`;
}

// ── EREDMÉNYEK ──────────────────────────────────────────────────────────
function renderResults(p) {
  const v = $("#view-eredmenyek");
  // A számok az aktív merítésre vonatkoznak, ahogy a tölcsér is. Ez akkor
  // tér el a korábbitól, ha egy megkeresett jelöltet később kizárnak.
  const actIds = new Set(activeCandidates(p).map((c) => c.id));
  const vals = Object.keys(p.outreach_status || {}).filter((k) => actIds.has(k)).map((k) => p.outreach_status[k]);
  const sent = vals.filter((s) => s && s.sent_at).length;
  const replied = vals.filter((s) => s && s.replied).length;
  const positive = vals.filter((s) => s && s.replied && s.sentiment === "pozitív").length;
  const respRate = sent ? Math.round(replied / sent * 100) : null;
  const posRate = sent ? Math.round(positive / sent * 100) : null;
  const base = p.baseline_response_rate;
  const delta = (respRate != null && base != null) ? respRate - base : null;
  const age = daysSince(p.created_at);
  const shortDays = (p.first_shortlist_at && p.created_at) ? Math.floor((new Date(p.first_shortlist_at) - new Date(p.created_at)) / 86400000) : null;
  const inPipeline = pipelineRows(p).rows.length;
  /* A mérés ugyanazt a formát kapja, mint a márkajel és a tábla: szűkülő
     sávok futnak a korall döntési pontba. Eddig három csupasz egész szám állt
     ott, ahol a termék egész mérési érvének kellene lennie — most a lépcső
     maga mondja el, hol fogy el a merítés, és minden fokon ott a valódi
     hányad. A drafts→sent lépcső szándékosan látszik: a legnagyobb szivárgás
     általában a megírt, de soha ki nem küldött vázlat. */
  const fi = funnelInfo(p);
  const drafts = Object.keys(p.outreach || {}).filter((k) => actIds.has(k)).length;
  const chain = [
    { n: fi.felkutatva, lbl: "felkutatva", sub: "a merítésben" },
    { n: fi.prioritasos, lbl: "prioritásos", sub: "A vagy B besorolás" },
    { n: drafts, lbl: "vázlat kész", sub: "megírt megkeresés" },
    { n: sent, lbl: "kiküldve", sub: "te rögzítetted" },
    { n: replied, lbl: "válaszolt", sub: respRate == null ? "—" : respRate + "% a kiküldöttekből" },
  ];
  const max = Math.max(1, fi.felkutatva, drafts);
  const step = (s, i) => {
    const prev = i ? chain[i - 1].n : null;
    const drop = prev != null && prev > 0 ? Math.round((1 - s.n / prev) * 100) : null;
    return `<div class="rstep">
      <div class="rstep-n">${s.n}</div>
      <div class="rstep-track"><span class="rstep-bar" style="width:${Math.round(Math.min(1, s.n / max) * 100)}%;height:${13 - i * 2}px"></span></div>
      <div class="rstep-l">${esc(s.lbl)}</div>
      <div class="rstep-s">${esc(s.sub)}${drop != null && drop > 0 ? ` · −${drop}%` : ""}</div>
    </div>`;
  };
  v.innerHTML = `<div class="stage">
    <div class="stage-head"><h2>Eredmények</h2>
      <p class="stage-sub">A számok a te rögzítéseidből épülnek — a rendszer nem küld semmit, kitalált számot nem mutatunk.</p></div>

    <div class="rchain">${chain.map(step).join("")}
      <div class="rstep rstep-end">
        <div class="rstep-n acc">${positive}</div>
        <span class="fdot${positive ? " full" : ""}"></span>
        <div class="rstep-l">pozitív</div>
        <div class="rstep-s">${posRate == null ? "—" : posRate + "% a kiküldöttekből"}</div>
      </div>
    </div>
    ${sent === 0 ? `<div class="ov-empty sm" style="margin-top:14px">Amint rögzíted az első kiküldést, itt jelenik meg a válaszarány és az összevetés a korábbi gyakorlatoddal.</div>` : ""}

    <div class="res-grid" style="margin-top:20px">
      <div class="res-card"><div class="cov-label">Korábbi kézi válaszarány</div>
        <div class="proof-baseline-row">
          <label class="sr-only" for="resBaseline">Korábbi kézi válaszarány százalékban</label>
          <input id="resBaseline" class="brief-line" type="number" min="0" max="100" placeholder="%" value="${base == null ? "" : base}" style="max-width:100px"><button class="btn" id="resBaselineSave">Mentés</button></div>
        <div class="card-d">Ehhez méri magát a keresés (önbevallás vagy korábbi ATS-adat).${delta != null ? ` Eltérés most: <b class="${delta >= 0 ? "d-pos" : "d-neg"}">${delta >= 0 ? "+" : ""}${delta} százalékpont</b>.` : ""}</div>
      </div>
      <div class="res-card"><div class="cov-label">Idő az első shortlistig</div>
        ${shortDays != null ? `<div class="res-num" style="font-size:22px">${shortDays} nap</div><button class="btn btn-ghost" id="resShortClear" style="margin-top:6px">visszavonás</button>`
          : `<div class="res-sub" style="margin-top:4px">A megbízás ${age == null ? "?" : age} napja fut.</div><button class="btn" id="resShortDone" style="margin-top:8px">Shortlist kész — rögzítés</button>`}
      </div>
      <div class="res-card"><div class="res-num">${inPipeline}</div><div class="res-lbl">Folyamatban lévő jelölt</div><div class="res-sub">A/B prioritással${fi.kizart ? ` · ${fi.kizart} kizárva a merítésből` : ""}</div></div>
    </div>
  </div>`;
  $("#resBaselineSave").onclick = (e) => withLoading(e.target, async (signal) => {
    const r = await api("POST", `/api/project/${p.id}/baseline`, { rate: $("#resBaseline").value }, { signal });
    p.baseline_response_rate = r.baseline_response_rate;
    persist();
    renderResults(p);
    toast("Kiinduló érték mentve.");
  }).catch(() => {});
  const sd = $("#resShortDone");
  if (sd) sd.onclick = async () => {
    const r = await api("POST", `/api/project/${p.id}/shortlist-done`, {});
    p.first_shortlist_at = r.first_shortlist_at;
    persist();
    renderResults(p);
    toast("Shortlist-idő rögzítve.");
  };
  const sc = $("#resShortClear");
  if (sc) sc.onclick = async () => {
    await api("POST", `/api/project/${p.id}/shortlist-done`, { clear: true });
    p.first_shortlist_at = null;
    persist();
    renderResults(p);
  };
}

// ── JEGYZETEK ───────────────────────────────────────────────────────────
function renderNotes(p) {
  const v = $("#notesBody");
  if (!v) return;
  const cands = p.candidates || [];
  const f = renderNotes._filter || "";
  const mem = (p.memory || []).slice().reverse();
  const shown = f ? mem.filter((e) => (e.kind || "note") === f) : mem;
  const nameOf = (id) => (candById(p, id) || {}).name || id;
  const coach = (p.coach_notes || [])[(p.coach_notes || []).length - 1];
  v.innerHTML = `
    <div class="d-sec"><h5>Új jegyzet</h5>
      <div class="row">
        <label class="sr-only" for="noteKind">Jegyzet típusa</label><select id="noteKind"><option value="note">megbízás</option><option value="candidate">jelölt</option></select>
        <label class="sr-only" for="noteCand">Melyik jelölthöz</label><select id="noteCand" class="hidden">${cands.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:8px">
        <label class="sr-only" for="noteInput">Jegyzet szövege</label><input id="noteInput" class="brief-line" placeholder="Jegyzet…" />
        <button id="noteSave" class="btn btn-primary">Mentés</button>
      </div>
    </div>
    <div class="d-sec"><h5>Módszertani segítség</h5>
      <p class="card-d" style="margin-top:0">Írd le, hol tartasz vagy hol akadtál el — javaslatot kapsz a következő lépésre.</p>
      <div class="row"><label class="sr-only" for="coachCtx">Hol tartasz vagy hol akadtál el</label><input id="coachCtx" class="brief-line" placeholder="Mit csináltál / hol akadtál el? (opcionális)" />
        <button id="coachBtn" class="btn">Javaslat kérése</button></div>
      <div id="coachOut" class="out"></div>
    </div>
    <div class="d-sec"><h5>Előzmény
        <select id="noteFilter" aria-label="Előzmény szűrése" style="margin-left:auto"><option value="">minden</option><option value="note" ${f === "note" ? "selected" : ""}>megbízás</option><option value="candidate" ${f === "candidate" ? "selected" : ""}>jelölt</option></select>
      </h5>
      ${renderNoteList(shown, { candidateName: nameOf, empty: "Még nincs jegyzet ebben a megbízásban." })}
    </div>`;
  if (coach) renderCoach(coach);
  $("#noteKind").onchange = (e) => $("#noteCand").classList.toggle("hidden", e.target.value !== "candidate");
  $("#noteFilter").onchange = (e) => { renderNotes._filter = e.target.value; renderNotes(p); };
  $("#noteSave").onclick = () => {
    const note = $("#noteInput").value.trim();
    if (!note) return;
    const kind = $("#noteKind").value;
    p.memory = p.memory || [];
    p.memory.push({ ts: new Date().toISOString(), kind, candidate_id: kind === "candidate" ? $("#noteCand").value : undefined, note });
    persist();
    renderNotes(p);
    toast("Jegyzet mentve.");
  };
  $("#coachBtn").onclick = (e) => withLoading(e.target, async (signal) => {
    const out = await api("POST", `/api/project/${p.id}/coach`, { context: $("#coachCtx").value }, { signal });
    p.coach_notes = p.coach_notes || [];
    p.coach_notes.push({ ts: new Date().toISOString(), ...out });
    persist();
    renderCoach(out);
  }, { into: "#coachOut", label: "Módszertani javaslat kérése" }).catch(() => {});
}

// ── STATIKUS GOMBOK (pozíció / célpiac / ügyfél nézetek) ────────────────
$("#intakeBtn").onclick = (e) => needEngagement() && runIntake(e.target);
function runIntake(btn) {
  const p = state.project, pid = p.id;
  // Az újraelemzés felülírja a véglegesített briefet — kézi szerkesztésnél kérdezünk.
  if (p.brief_final && briefIsEdited(p) && !confirm("Már van szerkesztett véglegesített briefed. Az új elemzés felülírja. Folytatod?")) return;
  p.brief_raw = $("#briefInput").value;
  return withLoading(btn, async (signal) => {
    const out = await api("POST", `/api/project/${pid}/intake`, { brief: p.brief_raw }, { signal });
    if (!stillOn(pid)) return;
    p.intake = out;
    p.intake_review = null;
    p.brief_final = null;
    persist();
    renderIntake(p);
    toast("Elemzés kész — szerkeszd és véglegesítsd a briefet.");
  }, { into: "#intakeOut", label: "A brief elemzése", retry: () => runIntake(btn) }).catch(() => {});
}

$("#queryBtn").onclick = (e) => needEngagement() && runQuery(e.target);
function runQuery(btn) {
  const p = state.project, pid = p.id;
  return withLoading(btn, async (signal) => {
    const q = await api("POST", `/api/project/${pid}/query`, { brief: finalBriefText(p), must_haves: (p.brief_final || {}).must_haves }, { signal });
    if (!stillOn(pid)) return;
    const had = !!p.query;
    // A frissítés SOHA nem törli a kézzel felvett kategóriákat — egyesít.
    p.query = mergeQueryPlan(p.query, q);
    persist();
    renderCelpiac(p);
    renderEngHeader(p);
    toast(had ? "Keresési terv frissítve — a kézi módosításaid megmaradtak." : "Keresési terv elkészült — szerkeszd szabadon.");
  }, { into: "#queryOut", label: "Keresési terv készítése", retry: () => runQuery(btn) }).catch(() => {});
}

$("#queryResetBtn").onclick = (e) => needEngagement() && runQueryReset(e.target);
function runQueryReset(btn) {
  const p = state.project, pid = p.id;
  if (p.query && !confirm("Új terv nulláról: a kézzel felvett kategóriáid elvesznek. Folytatod?")) return;
  return withLoading(btn, async (signal) => {
    const q = await api("POST", `/api/project/${pid}/query`, { brief: finalBriefText(p) }, { signal });
    if (!stillOn(pid)) return;
    p.query = q;
    persist();
    renderCelpiac(p);
    renderEngHeader(p);
    toast("Új keresési terv készült.");
  }, { into: "#queryOut", label: "Új keresési terv készítése", retry: () => runQueryReset(btn) }).catch(() => {});
}

$("#talentBtn").onclick = (e) => needEngagement() && runTalent(e.target);
function runTalent(btn) {
  const p = state.project, pid = p.id;
  return withLoading(btn, async (signal) => {
    const t = await api("POST", `/api/project/${pid}/talent-map`, null, { signal });
    if (!stillOn(pid)) return;
    p.talent_map = t;
    persist();
    renderCelpiac(p);
    toast("Célpiac-térkép kész.");
  }, { into: "#talentOut", label: "Célpiac-térkép készítése", retry: () => runTalent(btn) }).catch(() => {});
}

/* A jelöltkutatás a leglassabb lépés, és a Vercel Hobby 60 mp-es plafonja
   alatt az „automatikus" élő keresés rendszeresen 504-et adott. A hibakártya
   ezért nemcsak megmondja az okot, hanem fel is kínálja az egyetlen működő
   kijáratot — ugyanazt, amit a README javasol: váltás mintaadatokra. */
$("#discoverBtn").onclick = (e) => needEngagement() && runDiscover(e.target);
function runDiscover(btn, forceSource) {
  const p = state.project, pid = p.id;
  const src = forceSource || $("#sourceSel").value;
  const wantsLive = src !== "synthetic" && state.status && state.status.reach_live;
  if (wantsLive && !(p.query && (p.query.firecrawl_search_queries || []).length)) {
    toast("Az élő kutatáshoz előbb készíts keresési tervet.", true);
    return;
  }
  if (forceSource) { const s = $("#sourceSel"); if (s) s.value = forceSource; }
  return withLoading(btn, async (signal) => {
    const out = await api("POST", `/api/project/${pid}/discover`, { source: src }, { signal });
    if (!stillOn(pid)) return;
    const existing = p.candidates || [];
    if (!existing.length) {
      p.candidates = out.candidates;
      p.discover_note = out.note;
    } else {
      // Új futtatás nem írja felül a korábbi listát: hozzáadás + jelölés.
      const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
      const seen = new Set(existing.map((c) => norm(c.name)));
      const ids = new Set(existing.map((c) => c.id));
      let added = 0, dup = 0;
      for (const n of out.candidates || []) {
        if (seen.has(norm(n.name))) { dup++; continue; }
        let id = n.id;
        if (ids.has(id)) { let i = 1; while (ids.has(`${id}-${i}`)) i++; id = `${id}-${i}`; }
        existing.push({ ...n, id, is_new: true });
        ids.add(id);
        seen.add(norm(n.name));
        added++;
      }
      p.candidates = existing;
      p.discover_note = `${out.note} · Új futtatás: ${added} új jelölt hozzáadva, ${dup} már ismert (nem írtuk felül).`;
    }
    p.discover_source = out.source;
    if (p.status === "Előkészítés") p.status = "Kutatás folyamatban";
    // Az ügyfél saját (volt) emberei nem kerülnek a listára — de nem is tűnnek el
    // nyomtalanul: külön sávra kerülnek, indoklással, visszahozhatóan.
    const blocked = excludedCandidates(p).length;
    if (blocked) p.discover_note += ` · ${blocked} találat kizárva a merítésből (ügyfél jelenlegi/volt munkatársa vagy off-limits cég).`;
    persist();
    toast(blocked
      ? `${(out.candidates || []).length} találat · ${blocked} kizárva (ügyfél saját emberei).`
      : `${(out.candidates || []).length} találat feldolgozva.`);
    showView("jeloltek");
  }, {
    into: "#discoverNote",
    label: src === "synthetic" ? "Jelöltkutatás mintaadatokon" : "Jelöltkutatás nyilvános webes forrásokon",
    retry: () => runDiscover(btn, src),
    alt: { label: "Váltás mintaadatokra", run: () => runDiscover(btn, "synthetic") },
  }).catch(() => {});
}

$("#advisoryBtn").onclick = (e) => needEngagement() && runAdvisory(e.target);
function runAdvisory(btn) {
  const p = state.project, pid = p.id;
  return withLoading(btn, async (signal) => {
    const a = await api("POST", `/api/project/${pid}/advisory`, null, { signal });
    if (!stillOn(pid)) return;
    p.advisory = a;
    persist();
    renderAdvisory(a);
    toast("Egyeztetési javaslatok készen.");
  }, { into: "#advisoryOut", label: "Egyeztetési javaslatok készítése", retry: () => runAdvisory(btn) }).catch(() => {});
}

$("#interviewBtn").onclick = (e) => needEngagement() && runInterview(e.target);
function runInterview(btn) {
  const p = state.project, pid = p.id;
  return withLoading(btn, async (signal) => {
    const iv = await api("POST", `/api/project/${pid}/interview`, null, { signal });
    if (!stillOn(pid)) return;
    p.interview = iv;
    persist();
    renderInterview(iv);
    toast("Interjúterv kész.");
  }, { into: "#interviewOut", label: "Interjúterv készítése", retry: () => runInterview(btn) }).catch(() => {});
}

// ── GLOBÁLIS ────────────────────────────────────────────────────────────
$("#newEngBtn").onclick = () => { if (state.view !== "home") closeEngagement(); openNewEngForm(); };
$("#candDrawerClose").onclick = () => closeDrawer();
$("#scrim").onclick = () => { closeDrawer(); closeNotesDrawer(); closeMoreSheet(); };
$("#notesClose").onclick = () => closeNotesDrawer();
$("#notesOpen").onclick = () => openNotesDrawer();
window.addEventListener("popstate", () => { if (state.drawerId) closeDrawer(true); });
// Eseménydelegálás: az oldalsáv újrarenderelése után is működik, és a
// későbbi navigációs elemek ingyen megkapják.
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-view]");
  if (!a) return;
  e.preventDefault();
  const v = a.dataset.view;
  if (v === "home") { closeEngagement(); return; }
  showView(v);
});

/* ── GLOBÁLIS KERESŐ ─────────────────────────────────────────────────────
   A gépelés nem visz el sehova. A Jelöltek nézetben helyben szűr, máshol
   találati listát nyit, és a találat a jelöltpanelt nyitja meg — a nézet
   marad, ahol voltál.                                                    */
function closeSearchResults() {
  const box = $("#searchResults");
  if (!box) return;
  box.classList.add("hidden");
  box.innerHTML = "";
  srActive = -1;
  const inp = $("#globalSearch");
  if (inp) { inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); }
}
function renderSearchResults(q) {
  const box = $("#searchResults");
  if (!box) return;
  if (!q || !state.project) return closeSearchResults();
  const p = state.project;
  const hits = (p.candidates || []).filter((x) =>
    `${x.name} ${x.headline} ${x.current_company} ${x.location}`.toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = hits.length
    ? hits.map((x, i) => {
        const t = effTier(p, x.id);
        return `<button class="sr-row" role="option" id="sr-${i}" aria-selected="false" tabindex="-1" data-id="${esc(x.id)}">
          <span class="sr-tier">${esc(t || "—")}</span>
          <span class="sr-main"><b>${esc(x.name)}</b><span class="sr-sub">${esc([x.headline, x.current_company].filter(Boolean).join(" · "))}</span></span>
          <span class="sr-next">${esc(candNext(p, x))}</span>
        </button>`;
      }).join("")
    : `<div class="sr-empty">Nincs találat erre: „${esc(q)}”</div>`;
  box.classList.remove("hidden");
  $("#globalSearch").setAttribute("aria-expanded", "true");
  srActive = -1;
  $$(".sr-row", box).forEach((b) => (b.onclick = () => openPanel(b.dataset.id)));
  announce(hits.length ? `${hits.length} találat` : "Nincs találat");
}
/* A kereső combobox-nak vallotta magát aria-activedescendant és nyílbillentyű
   nélkül: a felhasználó látta a nyolc találatot, de csak egérrel érte el. */
let srActive = -1;
function srMove(d) {
  const rows = $$("#searchResults .sr-row");
  if (!rows.length) return;
  rows.forEach((r) => r.setAttribute("aria-selected", "false"));
  srActive = (srActive + d + rows.length + (srActive < 0 && d < 0 ? 1 : 0)) % rows.length;
  const cur = rows[srActive];
  cur.setAttribute("aria-selected", "true");
  cur.scrollIntoView({ block: "nearest" });
  $("#globalSearch").setAttribute("aria-activedescendant", cur.id);
}
$("#globalSearch").oninput = (e) => {
  const q = e.target.value.trim().toLowerCase();
  state.candFilter.q = q;
  if (!state.project) return;
  if (state.view === "jeloltek") { closeSearchResults(); renderCandidatesView(state.project); }
  else renderSearchResults(q);
};
$("#globalSearch").onkeydown = (e) => {
  const open = !$("#searchResults").classList.contains("hidden");
  if (!open) return;
  if (e.key === "ArrowDown") { e.preventDefault(); srMove(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); srMove(-1); }
  else if (e.key === "Enter") {
    const rows = $$("#searchResults .sr-row");
    const cur = rows[srActive] || rows[0];
    if (cur) { e.preventDefault(); openPanel(cur.dataset.id); }
  }
};
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) closeSearchResults();
  // A ⋯ menü eddig nyitva maradt, ha máshova kattintottál — abszolút
  // pozicionálva, rá arra, ami alatta volt.
  $$("details.stepmenu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});
document.addEventListener("keydown", (e) => {
  // ⌘K, nem ⌘F. A ⌘F elrablása egy szövegsűrű képernyőn elvette a böngésző
  // find-in-page-ét, miközben a beépített kereső csak jelöltmezőkre illeszt —
  // a briefben, a tervben és az üzenetvázlatban nem talál semmit.
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && state.project) {
    e.preventDefault();
    $("#globalSearch").focus();
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j" && state.project) {
    e.preventDefault();
    state.notesOpen ? closeNotesDrawer() : openNotesDrawer();
  }
  if (e.key === "Escape") {
    const om = $$("details.stepmenu[open]");
    if (om.length) { om.forEach((d) => (d.open = false)); return; }
    if (!$("#searchResults").classList.contains("hidden")) closeSearchResults();
    else if (state.moreOpen) closeMoreSheet();
    else if (state.notesOpen) closeNotesDrawer();
    else closeDrawer();
  }
  // Fókuszcsapda: nyitott panelből a Tab ne szökjön ki a háttérbe.
  if (e.key === "Tab" && anyDrawerOpen()) {
    const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', state.drawerId ? $("#candDrawer") : $("#notesDrawer"))
      .filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// A tábla/lista váltás a képernyőmérettel is változhat — kövessük.
if (typeof matchMedia === "function") {
  const mq = matchMedia(NARROW);
  const onChange = () => { if (state.project && state.view === "jeloltek") renderCandidatesView(state.project); };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

// A címsor a navigáció forrása: megosztott link, könyvjelző és a Vissza gomb
// mind ugyanoda vezet. A böngésző-előzmény már nem csak a panelt zárja.
window.addEventListener("hashchange", () => {
  if (hashLock) return;
  const h = parseHash();
  if (!h) { if (state.projectId) closeEngagement(); return; }
  if (h.id !== state.projectId) { if (lsGet(h.id)) openEngagement(h.id, h.view); return; }
  if (h.view !== state.view) showView(h.view);
});

// Init — a link, aztán a legutóbbi állapot. A megosztott cím erősebb, mint az
// eltárolt nézet: ha valaki kap egy linket, azt kell látnia, amit küldtek neki.
(async () => {
  watchExternalWrites();
  await loadStatus();
  const ui = loadUi();
  if (ui.homeFilter) state.homeFilter = ui.homeFilter;
  if (ui.candView === "list" || ui.candView === "board") state.candView = ui.candView;
  const h = parseHash();
  if (h && lsGet(h.id)) openEngagement(h.id, h.view);
  else if (h) { toast("Ez a megbízás nem ebben a böngészőben van elmentve.", true); showView("home"); }
  else if (ui.projectId && lsGet(ui.projectId)) openEngagement(ui.projectId, ui.view && ui.view !== "home" ? ui.view : "attekintes");
  else showView("home");
})();
