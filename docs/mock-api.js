/* ─────────────────────────────────────────────────────────────
   mock-api.js — a RIC backend kliens-oldali helyettesítője.
   A statikus demóhoz (GitHub Pages / Artifact): nincs szerver, nincs
   API-kulcs. A window.fetch-et patcheli, és a /api/* hívásokat a
   demo-outputokból + szintetikus poolból szolgálja ki (in-memory store).
   A Knowledge Core persona NINCS benne — csak kész demo-eredmények.
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // ── Szintetikus jelölt-pool (senior tech / CEE) ──
  const POOL = [
    { name: "Bogdán Ádám", headline: "Staff Backend Engineer — payments, Go/Rust", current_company: "(régiós fintech scale-up)", location: "Budapest, HU", signals: [{ signal: "8+ év elosztott rendszerek, utolsó 3 év payments core", strength: "erős" }, { signal: "Konferencia-előadó (Craft Conf), skálázás-témában", strength: "közepes" }, { signal: "OSS: karbantart egy idempotency-key libet", strength: "közepes" }] },
    { name: "Nowak Katarzyna", headline: "Principal Platform Engineer — Kubernetes, SRE", current_company: "(lengyel unicorn)", location: "Kraków, PL", signals: [{ signal: "Platform-csapatot épített 0-ról 12 főre", strength: "erős" }, { signal: "CNCF meetup társszervező Krakkóban", strength: "közepes" }] },
    { name: "Varga Eszter", headline: "Senior ML Engineer — MLOps, forecasting", current_company: "(energetikai adatcég)", location: "Budapest, HU", signals: [{ signal: "Idősoros előrejelző pipeline productionben (villamosenergia)", strength: "erős" }, { signal: "PyData Budapest előadás feature-store témában", strength: "közepes" }] },
    { name: "Horák Tomáš", headline: "Engineering Manager — embedded / IoT", current_company: "(cseh ipari OEM)", location: "Brno, CZ", signals: [{ signal: "Firmware + felhő-kapcsolat, 20 fős szervezet", strength: "erős" }, { signal: "Korábban IC-ként RTOS-scheduler contribs", strength: "közepes" }] },
    { name: "Kovács Bence", headline: "Staff Frontend Engineer — design systems, React/TS", current_company: "(SaaS scale-up)", location: "Szeged/Remote, HU", signals: [{ signal: "Design-system libet vezet, 40 fejlesztő használja", strength: "erős" }, { signal: "Aktív tech-blog performancia-témában", strength: "közepes" }] },
    { name: "Ionescu Andrei", headline: "Senior Data Engineer — streaming, Kafka/Flink", current_company: "(román e-commerce)", location: "Cluj-Napoca, RO", signals: [{ signal: "Valós idejű pipeline 2M event/perc", strength: "erős" }, { signal: "Meetup-előadó stream processing témában", strength: "közepes" }] },
    { name: "Szabó Réka", headline: "Principal Security Engineer — appsec, cloud", current_company: "(régiós bank tech-leánya)", location: "Budapest, HU", signals: [{ signal: "Threat-modeling programot vezetett be", strength: "erős" }, { signal: "CVE-jelentések, felelős disclosure track", strength: "közepes" }] },
    { name: "Wójcik Marek", headline: "Staff Engineer — distributed databases", current_company: "(infra startup)", location: "Warsaw/Remote, PL", signals: [{ signal: "Consensus/replikáció mély szakértelem", strength: "erős" }, { signal: "OSS commitok egy elosztott KV-store-ba", strength: "erős" }] },
    { name: "Tóth Gergely", headline: "Senior Site Reliability Engineer — observability", current_company: "(telco digital unit)", location: "Budapest, HU", signals: [{ signal: "SLO-kultúrát honosított meg 6 csapatnál", strength: "erős" }, { signal: "OpenTelemetry contributor", strength: "közepes" }] },
    { name: "Novák Lucia", headline: "Engineering Lead — fintech mobile", current_company: "(szlovák neobank)", location: "Bratislava, SK", signals: [{ signal: "iOS+Android csapat, 0-1 termékindítás", strength: "erős" }, { signal: "Női tech-mentorprogram szervezője", strength: "közepes" }] },
    { name: "Farkas Dániel", headline: "Senior Backend Engineer — event-sourcing, .NET", current_company: "(logisztikai SaaS)", location: "Debrecen/Remote, HU", signals: [{ signal: "CQRS/event-sourcing productionben 4 éve", strength: "erős" }] },
    { name: "Popescu Maria", headline: "Staff Data Scientist — pricing, optimization", current_company: "(marketplace)", location: "Bucharest, RO", signals: [{ signal: "Dinamikus árazó modell, mért árbevétel-hatás", strength: "erős" }, { signal: "Kaggle Grandmaster", strength: "közepes" }] },
    { name: "Kiss Márton", headline: "Principal Engineer — cloud cost & FinOps tooling", current_company: "(régiós ISV)", location: "Budapest/Remote, HU", signals: [{ signal: "Belső FinOps-platform, 7-jegyű megtakarítás", strength: "erős" }] },
    { name: "Svoboda Petr", headline: "Senior Full-stack — healthtech", current_company: "(cseh healthtech)", location: "Prague, CZ", signals: [{ signal: "Szabályozott környezet (orvostech) szoftver", strength: "erős" }, { signal: "Konferencia-előadás compliance-by-design témában", strength: "közepes" }] },
  ];
  function synthPool() {
    return POOL.map((c, i) => ({
      ...c, id: `syn-${String(i + 1).padStart(3, "0")}`, synthetic: true, source_url: null,
      source_type: "synthetic", art14_status: "n/a (szintetikus)", is_person: true,
      provenance: { method: "synthetic-pool", query: null, fetched_at: new Date().toISOString() },
    }));
  }

  // ── Demo-outputok (a senior agy kimeneti FORMÁJA) ──
  const demo = {
    intakeReframe: () => ({ _demo: true, reframed_brief: "Nem 'senior Java fejlesztőt' kerestek — hanem valakit, aki egy skálázódó payments core-t stabilan tud tartani növekvő terhelés alatt, és mellé csapatot is emel. A nyelv másodlagos, a rendszergondolkodás az elsődleges.", must_haves: ["Bizonyított elosztott-rendszer tapasztalat production terhelésen", "Volt már 'on-call' felelőssége éles pénzügyi rendszerért", "Mentorált/emelt más mérnököket"], nice_to_haves: ["Payments/fintech domain", "Go vagy Rust", "OSS-jelenlét"], bad_brief_flags: ["A '10+ év Java' fölösleges szűkítés — kizár erős poliglott mérnököket.", "A brief 'egyedül vigye a rendszert' + 'csapatépítés' — ez két külön szerep; tisztázni kell a hiring managerrel."], hidden_requirements: ["Valójában egy tech-lead kell, nem tiszta IC — a HM a 'senior' szót lead helyett használja."], search_hypotheses: ["Régiós fintech scale-upök payments-csapatai", "Craft Conf / infra-meetup előadók", "OSS: idempotency / distributed-tx libek karbantartói"] }),
    queryBuild: () => ({ _demo: true, boolean_queries: [{ platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' }, { platform: "github", query: 'site:github.com payments idempotency location:Hungary OR location:Poland' }, { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' }], firecrawl_search_queries: ["site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw", "site:github.com senior backend engineer payments idempotency Hungary OR Poland", "craft conf speaker distributed systems payments CEE", "principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in"], target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"], target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"], synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"] }),
    talentMap: () => ({ _demo: true, target_companies: [{ name: "(régiós fintech A)", why: "Payments core, ismert magas terhelés", likely_roles: ["Staff BE", "SRE"], url_guess: null }, { name: "(neobank B)", why: "Skálázódó mobil+backend, friss tőkebevonás → mozgásban a piac", likely_roles: ["Tech Lead"], url_guess: null }, { name: "(infra startup C)", why: "Elosztott DB szakértelem koncentrálódik", likely_roles: ["Staff Engineer"], url_guess: null }], competitor_clusters: ["Payments PSP-k", "Neobankok", "B2B fintech infra"], where_they_gather: ["Craft Conf", "CNCF/K8s meetupok (Krakkó, Bp)", "PyData", "belső platform-guildök"] }),
    profileAssess: (input) => ({ _demo: true, candidate_id: input && input.candidate_id, seniority_read: "Valódi staff-szint: nem csak kódol, hanem rendszer-szintű döntéseket hoz és másokat emel. A payments-terhelés kezelése éles felelősség volt, nem hobbi.", fit_signals: [{ signal: "Payments core productionben 3 év", strength: "erős", evidence: "headline + konferencia-téma" }, { signal: "OSS idempotency-lib karbantartás", strength: "közepes", evidence: "GitHub" }, { signal: "Craft Conf előadás skálázásról", strength: "közepes", evidence: "publikus program" }], gaps_to_explore: ["Vezetett-e formálisan csapatot, vagy csak technikai lead volt? — beszélgetésben tisztázni.", "Mennyire volt on-call felelőssége? — nem kizáró, feltárandó."], standout: "A kombináció ritka: mély elosztott-rendszer + valós payments-tét + közösségi láthatóság.", evidence: ["headline", "GitHub", "konferencia-program"], note: "Ez NEM screening-döntés. Az üldözés inputja: hol erős, mit kell a beszélgetésben feltárni." }),
    rankTargets: (input) => { const cands = (input && input.candidates) || []; return { _demo: true, ranked: cands.map((c, i) => ({ candidate_id: c.id, name: c.name, pursue_priority: i + 1, tier: i < 3 ? "A — most üldözd" : i < 7 ? "B — párhuzamos" : "C — melegen tartsd", rationale: i < 3 ? "Legerősebb evidencia + legjobb elérhetőség; itt a legmagasabb a válasz-esély." : "Erős jel, de vagy gyengébb elérhetőség, vagy kevesebb megerősítő forrás — tartsd a pipeline-ban.", evidence: (c.signals || []).slice(0, 2).map((s) => s.signal) })), note: "Ez ÜLDÖZÉSI prioritás, NEM elutasítás. Senki nem esik ki — mindenki kap helyet a sorban." }; },
    attractionStrategy: (input) => ({ _demo: true, candidate_id: input && input.candidate_id, what_moves_them: [{ driver: "Technikai tét és tulajdon", evidence: "OSS-karbantartás + konferencia = szereti, ha a munkája látszik és számít", confidence: "közepes" }, { driver: "Scope-emelés (IC→lead átmenet)", evidence: "staff-szint, de nincs jel formális vezetésről → itt lehet neki új szint", confidence: "közepes" }, { driver: "Menekülés a láthatatlan karbantartó-munkától", evidence: "feltételezés — sok senior beragad legacy-be", confidence: "alacsony" }], angle: "Ne 'állást' kínálj neki, hanem TÉTET: 'a payments core, ami eldönti, hogy a cég skálázódik-e — a tiéd, és mellé csapat, amit te formálsz.' Ez a scope + tulajdon üzenet.", hook: "Egy mondat, ami a saját munkájára reflektál: 'Láttam a Craft-előadásod az idempotenciáról — pont ilyen fejjel keresünk valakit, aki nem beáll egy rendszerbe, hanem eldönti, milyen legyen.'", timing: "Most: friss tőkebevonás után a régiós fintechek mozgásban vannak, a 'mit építesz a következő 2 évben' kérdés nyitott. Ne várj a Q4-ig.", offer_levers: ["Staff→lead scope tisztán kiírva (nem homályos ígéret)", "Architektúra-döntési jog az első naptól", "Remote-first, aszinkron kultúra", "Konferencia/OSS-idő intézményesítve (a láthatóságot, amit szeret)"], channel: "Első kör NE LinkedIn-InMail (zajos). Ha van közös ismerős vagy a konferencia-Q&A-ból warm szál → azon. Másodlagos: személyes, rövid e-mail, ami a munkájára reflektál.", risks: ["Ha sablonos megkeresést kap, azonnal kiesik a figyelme — a személyre szabás NEM opció.", "Ha a scope-ígéret üresnek hat, egy senior azonnal átlát rajta."], evidence: ["konferencia-előadás", "OSS-profil", "seniority-jelek"], confidence: "közepes — a driverek egy része feltételezés; az első beszélgetés validálja." }),
    outreachDraft: (input) => ({ _demo: true, candidate_id: input && input.candidate_id, language: "en", channel: "warm email / referral", subject: "Your idempotency talk — and a payments core that needs your head", body: "Hi Ádám,\n\nI caught your Craft Conf talk on idempotency keys — the part about partial failures was exactly the kind of thinking most teams skip.\n\nI'm helping a payments team that's at the point where the core either scales or breaks. They don't want someone to *maintain* it — they want someone to decide what it should be, and build the team around it. Staff-to-lead scope, architecture ownership from day one, remote-first.\n\nNot a pitch, just a question: is 'the payments core is yours' the kind of problem you'd want to hear more about?\n\n— [név]", why_this_works: ["Az első mondat a SAJÁT munkájára reflektál (nem sablon).", "A tétet kínálja, nem az állást.", "Alacsony súrlódású zárás: egy kérdés, nem egy CV-kérés."], note: "Ez DRAFT — a recruiter nézi át és küldi. A rendszer nem küld semmit." }),
    clientAdvisory: () => ({ _demo: true, talking_points: ["A '10+ év Java' feltétel kizár erős jelölteket — javasold a nyelv-agnosztikus szűrést.", "Amit leírtatok, az valójában tech-lead, nem tiszta IC — igazítsuk a szintet és a bérsávot.", "A piac mozgásban: ha 3 hétnél tovább vársz a döntéssel, a top jelölt elmegy máshova."], seniority_framing: "A hiring manager felé úgy pozicionáld magad, mint aki a PIACOT ismeri, nem aki CV-t tol: hozz 2 konkrét piaci jelet (bérszint, elérhetőség), és egy kockázatot, amit ő nem lát.", watch_outs: ["Túl hosszú folyamat", "Homályos scope", "Alulárazott sáv a régiós szinthez képest"] }),
    interviewIntel: () => ({ _demo: true, competency_questions: [{ competency: "Elosztott rendszerek", question: "Mesélj egy partial-failure esetről a payments-ben — hogyan vetted észre, mit tettél?", what_good_looks_like: "Konkrét eset, mérés, trade-off, nem tankönyv." }, { competency: "Vezetés/emelés", question: "Volt, akit te emeltél a következő szintre? Hogyan?", what_good_looks_like: "Nevesített példa, konkrét lépések, nem 'segítettem a csapatnak'." }, { competency: "Rendszer-döntés", question: "Egy architektúra-döntés, amit ma másképp hoznál meg — miért?", what_good_looks_like: "Önreflexió + tanulás, nem védekezés." }], red_flags_to_probe: ["Csak 'mi' nyelv, sose 'én' a felelősségnél", "Nem tud mérést mondani a hatásához"] }),
    recruitmentCoach: () => ({ _demo: true, what_a_senior_would_do: "Egy senior nem a briefből indul, hanem megtámadja: 'miért pont Java?' és 'IC vagy lead?'. Te most a briefet végrehajtottad — a következő szinten a briefet jobbá teszed, mielőtt keresel.", one_lever_now: "A megkeresésednél mindig kösd az első mondatot a jelölt SAJÁT munkájához — ez egyedül megduplázza a válaszarányt.", skill_focus: "Reframe-készség: a rossz brief kiszúrása és tisztázása a hiring managerrel.", encouragement: "A discovery-listád jó — a jelöltek relevánsak. A következő ugrás a személyre szabott elcsábításban van." }),
  };

  function art14(candidate, controller) {
    const c = controller || {};
    const name = c.name || "[ADATKEZELŐ CÉG NEVE]";
    const contact = c.contact || "[adatvédelmi kapcsolat e-mail]";
    const src = (candidate && (candidate.source_url || candidate.source_type)) || "publikusan elérhető szakmai forrás";
    const cand = (candidate && candidate.name) || "[jelölt neve]";
    return { _template: true, subject: "Adatkezelési tájékoztató – kapcsolatfelvétel toborzási céllal (GDPR 14. cikk)", must_send_within: "1 hónap a megszerzéstől, vagy az első kapcsolatfelvételkor", legal_basis: "jogos érdek (GDPR 6(1)f) + dokumentált LIA", body: `Tisztelt ${cand}!\n\nAz alábbi tájékoztatót a GDPR 14. cikke alapján küldjük, mert az Ön szakmai adatait toborzási céllal kezeljük.\n\n1) Adatkezelő: ${name}. Kapcsolat: ${contact}.\n2) Milyen adatot kezelünk: kizárólag szerep-releváns, publikus szakmai adatokat.\n3) Az adatok forrása: ${src} (publikusan elérhető információ).\n4) Cél és jogalap: potenciális álláslehetőséggel kapcsolatos megkeresés; jogos érdek (GDPR 6(1)f).\n5) Tárolás: a projekt lezárásáig, illetve az Ön tiltakozásáig.\n6) Jogai: hozzáférés, helyesbítés, törlés, korlátozás, hordozhatóság, TILTAKOZÁS. Panasz: NAIH.\n7) Ha nem kíván megkereséseket kapni, egy válaszban jelezze, és töröljük.\n\nÜdvözlettel,\n${name}`, note: "Sablon. Kiküldés előtt töltsd ki a cégadatokat és a LIA-t. Jogász-review a skálázás előtt." };
  }

  // ── In-memory projekt-store ──
  const STORE = {};
  function emptyProject(id, name) {
    return { id, name: name || id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), brief_raw: "", intake: null, query: null, candidates: [], talent_map: null, assessments: {}, ranking: null, attraction: {}, outreach: {}, outreach_status: {}, baseline_response_rate: null, first_shortlist_at: null, pilot: { cooling_days: 7, mono_source_threshold: 0.7 }, advisory: null, interview: null, coach_notes: [], memory: [], interactions: [] };
  }
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  function seed() {
    const p = emptyProject("acme-staff-be", "Acme Staff BE");
    p.brief_raw = "Senior Java fejlesztő, 10+ év, aki egyedül viszi a payments rendszerünket, de csapatot is épít. Budapest, hibrid.";
    p.intake = demo.intakeReframe();
    p.query = demo.queryBuild();
    p.candidates = synthPool();
    p.discover_source = "synthetic";
    p.discover_note = "Szintetikus pool (senior tech / CEE) — statikus demo. Élő discovery-hoz Firecrawl-kulcs kell a helyi futtatásnál.";
    p.created_at = daysAgo(6);
    p.ranking = demo.rankTargets({ candidates: p.candidates });
    p.assessments["syn-001"] = demo.profileAssess({ candidate_id: "syn-001" });
    ["syn-001", "syn-002", "syn-003", "syn-004", "syn-006"].forEach((id) => (p.attraction[id] = demo.attractionStrategy({ candidate_id: id })));
    ["syn-001", "syn-002"].forEach((id) => (p.outreach[id] = demo.outreachDraft({ candidate_id: id })));
    p.outreach_status["syn-002"] = { sent_at: daysAgo(3), replied: true, replied_at: daysAgo(2), sentiment: "pozitív" };
    p.outreach_status["syn-001"] = { sent_at: daysAgo(1) };
    p.baseline_response_rate = 8;
    // last_touched: az aktívan mozgatottak frissek, kettő már hűl
    const touch = { "syn-001": 1, "syn-002": 2, "syn-003": 1, "syn-004": 11, "syn-006": 14 };
    p.candidates.forEach((c) => { if (touch[c.id] != null) c.last_touched = daysAgo(touch[c.id]); });
    p.talent_map = demo.talentMap();
    p.advisory = demo.clientAdvisory();
    STORE[p.id] = p;
  }
  seed();

  function listProjects() {
    return Object.values(STORE).map((p) => ({ id: p.id, name: p.name, updated_at: p.updated_at, candidates: (p.candidates || []).length, has_brief: !!p.intake })).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }

  // ── Router ──
  function route(method, path, body) {
    const parts = path.replace(/^\/api\/?/, "").split("/");
    if (path === "/api/status") return { brain: false, reach_live: false, model: "claude-sonnet-5 (statikus demo)", knowledge_version: "kc-2026-07-19.v1", mode: "demo" };
    if (path === "/api/projects") return listProjects();
    if (path === "/api/project" && method === "POST") { const id = body.id; if (!STORE[id]) STORE[id] = emptyProject(id, body.name); return STORE[id]; }

    // /api/project/:id/...
    if (parts[0] === "project" && parts[1]) {
      const id = decodeURIComponent(parts[1]); const p = STORE[id];
      const action = parts[2];
      if (!p) return { __status: 404, error: "Nincs ilyen projekt: " + id };
      const cand = (cid) => (p.candidates || []).find((c) => c.id === cid);
      if (!action) return p;
      if (action === "intake") { p.brief_raw = body.brief || ""; p.intake = demo.intakeReframe(); return p.intake; }
      if (action === "query") { p.query = demo.queryBuild(); return p.query; }
      if (action === "discover") { p.candidates = synthPool(); p.discover_source = "synthetic"; p.discover_note = "Szintetikus pool (senior tech / CEE) — statikus demo, nincs élő scraping."; return { source: "synthetic", candidates: p.candidates, note: p.discover_note }; }
      if (action === "talent-map") { p.talent_map = demo.talentMap(); return p.talent_map; }
      const touch = (id) => { const cd = cand(id); if (cd) cd.last_touched = new Date().toISOString(); };
      if (action === "assess") { const o = demo.profileAssess({ candidate_id: body.candidateId }); p.assessments[body.candidateId] = o; touch(body.candidateId); return o; }
      if (action === "rank") { p.ranking = demo.rankTargets({ candidates: p.candidates }); return p.ranking; }
      if (action === "attract") { const o = demo.attractionStrategy({ candidate_id: body.candidateId }); p.attraction[body.candidateId] = o; touch(body.candidateId); return o; }
      if (action === "outreach") { const o = demo.outreachDraft({ candidate_id: body.candidateId }); p.outreach[body.candidateId] = o; touch(body.candidateId); return o; }
      if (action === "touch") { touch(body.candidateId); return { ok: true }; }
      if (action === "outreach-status") {
        const id = body.candidateId, cur = p.outreach_status[id] || {};
        if (body.status === "reset") { delete p.outreach_status[id]; return { ok: true, status: null }; }
        if (body.status === "sent") cur.sent_at = cur.sent_at || new Date().toISOString();
        if (body.sentiment) { cur.replied = true; cur.replied_at = new Date().toISOString(); cur.sentiment = body.sentiment; }
        p.outreach_status[id] = cur; touch(id); return { ok: true, status: cur };
      }
      if (action === "baseline") { const r = Number(body.rate); p.baseline_response_rate = isFinite(r) ? r : null; return { ok: true, baseline_response_rate: p.baseline_response_rate }; }
      if (action === "shortlist-done") { p.first_shortlist_at = body.clear ? null : (p.first_shortlist_at || new Date().toISOString()); return { ok: true, first_shortlist_at: p.first_shortlist_at }; }
      if (action === "advisory") { p.advisory = demo.clientAdvisory(); return p.advisory; }
      if (action === "interview") { p.interview = demo.interviewIntel(); return p.interview; }
      if (action === "coach") { const o = demo.recruitmentCoach(); p.coach_notes.push({ ts: new Date().toISOString(), ...o }); return o; }
      if (action === "art14") { return art14(cand(body.candidateId), body.controller); }
      if (action === "memory" && method === "POST") { const e = { ts: new Date().toISOString(), kind: body.kind || "note", note: body.note }; p.memory.push(e); return e; }
      if (action === "memory") return { project: { id: p.id, name: p.name, updated_at: p.updated_at }, intake: p.intake, candidates: (p.candidates || []).length, memory: p.memory || [], interactions: p.interactions || [] };
    }
    return { __status: 404, error: "mock: ismeretlen útvonal " + path };
  }

  // ── fetch patch ──
  const orig = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    const u = typeof url === "string" ? url : (url && url.url) || "";
    const path = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (path.indexOf("/api") === 0) {
      try {
        const method = (opts && opts.method) || "GET";
        const bodyObj = opts && opts.body ? JSON.parse(opts.body) : {};
        const data = route(method, path, bodyObj);
        const status = data && data.__status ? data.__status : 200;
        if (data && data.__status) delete data.__status;
        return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
      } catch (e) {
        return Promise.resolve(new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers: { "Content-Type": "application/json" } }));
      }
    }
    return orig ? orig(url, opts) : Promise.reject(new Error("no fetch"));
  };
})();
