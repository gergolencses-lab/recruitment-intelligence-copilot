// Demo-mód: realisztikus HU minta-outputok, ha nincs ANTHROPIC_API_KEY.
// Ezek mutatják az éles kimenetek FORMÁJÁT és színvonalát.
// A UI jelöli, hogy minta-adat. Kulcs megadásakor minden élőben generálódik.

export const demo = {
  intakeReframe: (input) => ({
    _demo: true,
    reframed_brief:
      "Nem 'senior Java fejlesztőt' kerestek — hanem valakit, aki egy skálázódó payments core-t stabilan tud tartani növekvő terhelés alatt, és mellé csapatot is emel. A nyelv másodlagos, a rendszergondolkodás az elsődleges.",
    must_haves: [
      "Bizonyított elosztott-rendszer tapasztalat production terhelésen",
      "Volt már 'on-call' felelőssége éles pénzügyi rendszerért",
      "Mentorált/emelt más mérnököket",
    ],
    nice_to_haves: ["Payments/fintech domain", "Go vagy Rust", "OSS-jelenlét"],
    clarification_points: [
      "A '10+ év Java' fölösleges szűkítés — kizár erős poliglott mérnököket.",
      "A brief 'egyedül vigye a rendszert' + 'csapatépítés' — ez két külön szerep; tisztázni kell a hiring managerrel.",
    ],
    inferred_requirements: [
      "A briefből következtetve valószínűleg tech-lead kell, nem tiszta IC — a 'senior' szó itt lead-szerepet takarhat. Egyeztetendő.",
    ],
    search_hypotheses: [
      "Régiós fintech scale-upök payments-csapatai",
      "Craft Conf / infra-meetup előadók",
      "OSS: idempotency / distributed-tx libek karbantartói",
    ],
  }),

  // Az ügyfél kizárása a TERV része, nem utólagos szűrés — a demó-kimenet is
  // így néz ki, hogy a szabály ugyanaz legyen kulccsal és kulcs nélkül.
  queryBuild: (input) => {
    const client = (input && input.client) || "";
    const neg = client ? ` -"${client}"` : "";
    return {
      _demo: true,
      boolean_queries: [
        { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' + neg },
        { platform: "github", query: "site:github.com payments idempotency location:Hungary OR location:Poland" + neg },
        { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' + neg },
      ],
      firecrawl_search_queries: [
        "site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw" + neg,
        "site:github.com senior backend engineer payments idempotency Hungary OR Poland" + neg,
        "craft conf speaker distributed systems payments CEE",
        "principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in" + neg,
      ],
      target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
      target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
      synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
      exclude_companies: client ? [client] : [],
      exclusion_note: client
        ? `Az ügyfél (${client}) jelenlegi és volt munkatársai nem kerülnek a merítésbe — őket a hiring manager amúgy is ismeri.`
        : "Add meg az ügyfél nevét a pozícióadatoknál, hogy a saját munkatársai automatikusan kimaradjanak.",
    };
  },

  talentMap: (input) => ({
    _demo: true,
    target_companies: [
      { name: "(régiós fintech A)", why: "Payments core, ismert magas terhelés", likely_roles: ["Staff BE", "SRE"], url_guess: null },
      { name: "(neobank B)", why: "Skálázódó mobil+backend, friss tőkebevonás → mozgásban a piac", likely_roles: ["Tech Lead"], url_guess: null },
      { name: "(infra startup C)", why: "Elosztott DB szakértelem koncentrálódik", likely_roles: ["Staff Engineer"], url_guess: null },
    ],
    competitor_clusters: ["Payments PSP-k", "Neobankok", "B2B fintech infra"],
    where_they_gather: ["Craft Conf", "CNCF/K8s meetupok (Krakkó, Bp)", "PyData", "belső platform-guildök"],
  }),

  profileAssess: (input) => ({
    _demo: true,
    candidate_id: input && input.candidate_id,
    fit: "erős",
    fit_reason:
      "A jelek payments-core productiont és OSS-karbantartást mutatnak — a szerep magja lefedve. A formális vezetés nyitott kérdés, de nem kizáró.",
    profile_summary:
      "A jelek staff-szintre utalnak: rendszer-szintű döntések, mások emelése. A payments-terhelés éles felelősség volt, nem hobbi.",
    role_relevant_signals: [
      { signal: "Payments core productionben 3 év", strength: "erős", evidence: "headline + konferencia-téma" },
      { signal: "OSS idempotency-lib karbantartás", strength: "közepes", evidence: "GitHub" },
      { signal: "Craft Conf előadás skálázásról", strength: "közepes", evidence: "publikus program" },
    ],
    questions_to_clarify: [
      "Vezetett-e formálisan csapatot, vagy technikai lead volt? — a beszélgetésen tisztázandó.",
      "Mennyire volt on-call felelőssége?",
    ],
    unknowns: ["Jelenlegi elégedettsége / vált-e szívesen", "Fizetési elvárás", "Remote vs. iroda preferencia"],
    key_strength: "Ritka kombináció: mély elosztott-rendszer tapasztalat + valós payments-felelősség + közösségi láthatóság.",
    evidence: ["headline", "GitHub", "konferencia-program"],
  }),

  rankTargets: (input) => {
    const cands = (input && input.candidates) || [];
    const n = cands.length;
    return {
      _demo: true,
      ranked: cands.map((c, i) => ({
        candidate_id: c.id,
        name: c.name,
        contact_priority: i + 1,
        tier:
          i < 3 ? "A — elsőként keresd meg"
          : i < 7 ? "B — következő kör"
          : i < n - 2 ? "C — figyelőlista"
          : "D — most nem javasolt",
        rationale:
          i < 3 ? "Legerősebb evidencia + jó elérhetőség; itt a legmagasabb a válasz-esély."
          : i < n - 2 ? "Erős jel, de gyengébb elérhetőség vagy kevesebb megerősítő forrás."
          : "A jelek gyengék vagy szerep-irrelevánsak — most nem javasolt megkeresni.",
        evidence: (c.signals || []).slice(0, 1).map((s) => s.signal),
      })),
      note: "Prioritási javaslat evidencia alapján — a recruiter felülbírálhatja.",
    };
  },

  attractionStrategy: (input) => ({
    _demo: true,
    candidate_id: input && input.candidate_id,
    grounded_read: {
      known_facts: [
        { fact: "Payments core rendszert vitt productionben", from_signal: "Payments core productionben 3 év" },
        { fact: "Nyílt forrású idempotency-libet tart karban", from_signal: "OSS idempotency-lib karbantartás" },
        { fact: "Konferencián adott elő skálázásról", from_signal: "Craft Conf előadás skálázásról" },
      ],
      unknowns: ["Mi motiválja (pénz / scope / tech) — nem tudjuk", "Mennyire elégedett a jelenlegi helyén", "Nyitott-e váltásra"],
      confidence: "közepes",
    },
    attraction_ideas: [
      {
        rank: 1,
        angle: "A szakmai kihívás és a hatáskör: a payments core, amelynek architektúrájáról ő dönthet, és a csapat, amelyet köré építhet.",
        hook: "A munkájára reflektálva: 'Láttam a skálázás-előadásod — olyan embert keresünk, aki eldönti, milyen legyen a rendszer, nem csak beáll egy meglévőbe.'",
        why_might_work: "A földelt jelek (OSS + konferencia) arra utalnak, fontos neki, hogy a munkája látható legyen és számítson — a hatáskör-üzenet erre épít. Feltételezés: a motiváció nem megerősített.",
        speculative: true,
      },
      { rank: 2, angle: "IC→lead hatáskör-bővülés, ha váltáskész.", why_might_work: "Staff-jel van, formális vezetésre nincs — lehet neki új szint. Feltételezés.", speculative: true },
      { rank: 3, angle: "Zöldmezős rendszer a legacy-karbantartás helyett.", why_might_work: "Gyakori senior-motiváció, de erre konkrét jel nincs — a leggyengébb hipotézis.", speculative: true },
    ],
    recommended: 1,
    channel: "Első kör ne LinkedIn-InMail legyen (zajos). Ha van közös ismerős vagy kapcsolódás a konferencia-Q&A-ból → azon. Másodlagos: rövid, személyes e-mail, ami a munkájára reflektál.",
    timing: "A friss régiós tőkebevonások után sok seniornál nyitott kérdés a 'mit építek a következő 2 évben' — ez most időszerűvé teheti a megkeresést.",
    risks: ["Sablonos megkeresés → azonnal elveszíti a figyelmét.", "Megalapozatlan hatáskör-ígéret — egy tapasztalt jelölt azonnal átlátja."],
  }),

  outreachDraft: (input) => ({
    _demo: true,
    candidate_id: input && input.candidate_id,
    language: "en",
    channel: "warm email / referral",
    subject: "Your idempotency talk — and a payments core that needs an owner",
    body:
      "Hi Ádám,\n\nI caught your Craft Conf talk on idempotency keys — the part about partial failures was exactly the kind of thinking most teams skip.\n\nI'm helping a payments team that's at the point where the core either scales or breaks. They don't want someone to *maintain* it — they want someone to decide what it should be, and build the team around it. Staff-to-lead scope, architecture ownership from day one, remote-first.\n\nNot a pitch, just a question: is 'the payments core is yours' the kind of problem you'd want to hear more about?\n\n— [név]",
    why_this_works: [
      "Az első mondat a SAJÁT munkájára reflektál (nem sablon).",
      "A szakmai kihívást és a hatáskört mutatja be, nem csak a pozíciót.",
      "Alacsony súrlódású zárás: egy kérdés, nem egy CV-kérés.",
    ],
    note: "Vázlat — a recruiter ellenőrzi és küldi. A rendszer nem küld semmit.",
  }),

  clientAdvisory: (input) => ({
    _demo: true,
    talking_points: [
      "A '10+ év Java' feltétel kizár erős jelölteket — javasold a nyelv-agnosztikus szűrést.",
      "Amit leírtatok, az valójában tech-lead, nem tiszta IC — igazítsuk a szintet és a bérsávot.",
      "A piac mozgásban: ha 3 hétnél tovább vársz a döntéssel, a top jelölt elmegy máshova.",
    ],
    meeting_preparation:
      "Az egyeztetésre vigyél 2 konkrét piaci adatot (bérszint, elérhetőség) és egy kockázatot, amit a hiring manager még nem lát — így a beszélgetés a piacról szól, nem a CV-kről.",
    watch_outs: ["Túl hosszú folyamat", "Homályos hatáskör", "Alulárazott sáv a régiós szinthez képest"],
  }),

  interviewIntel: (input) => ({
    _demo: true,
    competency_questions: [
      { competency: "Elosztott rendszerek", question: "Mesélj egy partial-failure esetről a payments-ben — hogyan vetted észre, mit tettél?", what_good_looks_like: "Konkrét eset, mérés, trade-off, nem tankönyv." },
      { competency: "Vezetés/emelés", question: "Volt, akit te emeltél a következő szintre? Hogyan?", what_good_looks_like: "Nevesített példa, konkrét lépések, nem 'segítettem a csapatnak'." },
      { competency: "Rendszer-döntés", question: "Egy architektúra-döntés, amit ma másképp hoznál meg — miért?", what_good_looks_like: "Önreflexió + tanulás, nem védekezés." },
    ],
    signals_to_clarify: ["Csak 'mi' nyelv, sose 'én' a felelősségnél", "Nem tud mérést mondani a hatásához"],
  }),

  recruitmentCoach: (input) => ({
    _demo: true,
    recommended_approach:
      "Ne a briefből indulj, hanem tisztázd: 'miért pont Java?' és 'IC vagy lead?'. A brief végrehajtása helyett a brief pontosítása hozza a legtöbb értéket — mielőtt keresel.",
    one_lever_now: "A megkeresésnél mindig kösd az első mondatot a jelölt saját munkájához — ez önmagában érdemben emeli a válaszarányt.",
    skill_focus: "Brief-tisztázás: az ellentmondások kiszúrása és egyeztetése a hiring managerrel.",
    encouragement: "A jelöltlistád releváns — a következő lépés a személyre szabott megkeresésben van.",
  }),

  strategyChat: (input) => strategyChatDemo(input),
};

// ── Stratégia-asszisztens demo-fallback ────────────────────────────────
// Élesben ezt egy Claude-hívás végzi (core/capabilities.js → strategyChat).
// Kulcs nélkül szándék-felismerés fut: ugyanaz a szerződés (reply + actions +
// proposals), hogy a felület viselkedése ne térjen el a két módban.
const fold = (x) => String(x == null ? "" : x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Sorrend számít: a szűkebb kulcsszó előzi a tágabbat („kizárt cégek” a „cégek”-et).
const CHAT_FIELDS = [
  { target: "exclusions", field: "companies", label: "kizárt cégek", kws: ["kizart ceg", "kizart", "off limits", "offlimits", "off-limits", "tiltolista", "tilto lista", "blacklist"] },
  { target: "map", field: "target_companies", label: "célpiac-térkép cégei", kws: ["terkep", "talent map", "celpiac terkep"] },
  { target: "map", field: "competitor_clusters", label: "versenytárs-klaszterek", kws: ["klaszter", "versenytars", "cluster", "szegmens"] },
  { target: "map", field: "where_they_gather", label: "közösségek és rendezvények", kws: ["kozosseg", "rendezveny", "meetup", "konferencia", "esemeny", "community"] },
  { target: "query", field: "target_titles", label: "célpozíciók", kws: ["celpozicio", "pozicio", "titulus", "job title", "szerepkor", "title"] },
  { target: "query", field: "synonyms", label: "kulcs-szinonimák", kws: ["szinonima", "kulcsszo", "kulcs szo", "kifejezes", "keyword"] },
  { target: "query", field: "boolean_queries", label: "boolean lekérdezések", kws: ["boolean", "xray", "x-ray", "x ray"] },
  { target: "query", field: "firecrawl_search_queries", label: "webes kereső-lekérdezések", kws: ["webes lekerdezes", "kereso lekerdezes", "firecrawl", "web query"] },
  { target: "query", field: "target_companies", label: "célcégek", kws: ["celceg", "cel ceg", "ceget", "cegek", "ceg", "company", "companies", "munkaltato"] },
];
const RM_KWS = ["vedd ki", "vedd le", "szedd ki", "torold", "torol", "tavolits", "tavolitsd", "ne legyen", "hagyd ki", "kivesz", "remove", "delete", "vegyel ki", "vegyuk ki"];
const ADD_KWS = ["adj hozza", "add hozza", "adjatok", "vedd fel", "vegyuk fel", "vegyel fel", "bovitsd", "bovits", "egeszitsd", "tegyel hozza", "tedd hozza", "irj be", "sorolj fel", "add "];
const EXCL_KWS = ["zard ki", "zarjuk ki", "kizar", "ne keress", "tiltsd", "tilts", "off limits", "offlimits", "off-limits"];
const ASK_KWS = ["javasol", "javaslat", "milyen", "mit ajanl", "otlet", "adnal", "tudsz ajanlani", "?"];
const HELP_KWS = ["mit tudsz", "segitseg", "mire vagy kepes", "help", "hogyan mukod"];

const SUGGESTIONS = {
  "query:target_companies": ["(nemzetközi PSP D)", "(kártyakibocsátó platform E)", "(B2B fintech infra F)", "(treasury/ledger SaaS G)"],
  "query:target_titles": ["Backend Architect", "Head of Platform", "Senior Staff Engineer", "Payments Domain Lead"],
  "query:synonyms": ["idempotency", "ledger", "double-entry", "PCI DSS", "reconciliation", "high-availability"],
  "query:boolean_queries": ['site:linkedin.com/in ("payments platform" OR "billing platform") ("staff" OR "principal") (Budapest OR Prague)'],
  "query:firecrawl_search_queries": ["fintech engineering blog payments architecture CEE 2025"],
  "exclusions:companies": ["(az ügyfél leányvállalata)", "(közös tulajdonú testvércég)"],
  "map:target_companies": ["(nemzetközi PSP D)", "(kártyakibocsátó platform E)", "(treasury/ledger SaaS G)"],
  "map:competitor_clusters": ["Kártyakibocsátók", "Treasury/ledger SaaS", "Fizetési orchestrátorok"],
  "map:where_they_gather": ["FinTech meetup Budapest", "KubeCon EU", "Rust/Go Budapest meetup"],
};

const valOf = (x) => (x && typeof x === "object" ? x.name || x.query || "" : String(x == null ? "" : x));

function detectField(t) {
  for (const f of CHAT_FIELDS) for (const k of f.kws) if (t.indexOf(k) >= 0) return f;
  return null;
}
function currentList(state, target, field) {
  if (target === "query") return (state.query && state.query[field]) || [];
  if (target === "map") return (state.talentMap && state.talentMap[field]) || [];
  if (target === "exclusions") return (state.exclusions && state.exclusions[field]) || [];
  return [];
}
function cleanTok(x) {
  let t = String(x || "").replace(/^[\s\-–—•*"'„”]+|[\s.!?"'„”]+$/g, "").trim();
  t = t.replace(/^(a|az|és|meg|valamint|the)\s+/i, "").trim();
  if (t.length < 2) return "";
  if (RM_KWS.concat(ADD_KWS, EXCL_KWS).some((k) => fold(t) === k.trim())) return "";
  return t;
}
function extractValues(raw) {
  let s = String(raw || "");
  const quoted = s.match(/[„"'”]([^„"'”]{2,80})[„"'”]/g);
  if (quoted && quoted.length) return quoted.map((q) => cleanTok(q.replace(/[„"'”]/g, ""))).filter(Boolean);
  const i = s.search(/[:：]/);
  if (i >= 0) s = s.slice(i + 1);
  else {
    let f = fold(s);
    const kill = RM_KWS.concat(ADD_KWS, EXCL_KWS).concat(CHAT_FIELDS.reduce((a, x) => a.concat(x.kws), []));
    kill.sort((a, b) => b.length - a.length);
    for (const k of kill) {
      const at = f.indexOf(k);
      if (at >= 0) { s = s.slice(0, at) + " " + s.slice(at + k.length); f = fold(s); }
    }
    s = s.replace(/\b(kozott|kozul|kozze|hoz|hez|ba|be|ra|re|tol|bol)\b/gi, " ");
  }
  return s.split(/,|;|\bés\b|\band\b|\bvalamint\b|\billetve\b/i).map(cleanTok).filter(Boolean).slice(0, 8);
}
// Ragos alak, kis-nagybetű, részleges egyezés is találjon.
function findExisting(list, token) {
  const t = fold(token);
  if (!t) return null;
  let hit = list.find((x) => fold(valOf(x)) === t);
  if (hit !== undefined) return hit;
  hit = list.find((x) => { const v = fold(valOf(x)); return v.length > 2 && (t.indexOf(v) >= 0 || v.indexOf(t) >= 0); });
  return hit === undefined ? null : hit;
}

export function strategyChatDemo(input) {
  const state = input || {};
  const raw = String(state.message || "").trim();
  const t = fold(raw);
  const R = (reply, actions, proposals) => ({ _demo: true, reply, actions: actions || [], proposals: proposals || [] });

  if (!raw) return R("Írd le, mit módosítsak a keresési terven vagy a célpiac-térképen.");
  if (/(jelolt|candidate)\w*\s*(ertekel|pontoz|rangsor)|irj (egy )?(uzenet|megkeres|emailt|levelet)|outreach szoveg|brief elemz/.test(t)) {
    return R("Ez kívül esik a hatókörömön — én a keresési tervet és a célpiac-térképet szerkesztem. Jelölt-értékeléshez a Jelöltek, üzenetvázlathoz a Megkeresések, briefhez a Pozíció és brief nézet való.");
  }
  if (HELP_KWS.some((k) => t.indexOf(k) >= 0)) {
    return R("A keresési terv és a célpiac-térkép szerkesztése a dolgom. Például: „Adj hozzá a célcégekhez: (nemzetközi PSP D)” · „Vedd ki a szinonimák közül az SRE-t” · „Zárd ki az ügyfél leányvállalatát” · „Milyen célpozíciókat javasolsz még?”");
  }

  const isExcl = EXCL_KWS.some((k) => t.indexOf(k) >= 0);
  const isRm = !isExcl && RM_KWS.some((k) => t.indexOf(k) >= 0);
  let f = detectField(t);
  if (isExcl) f = CHAT_FIELDS[0];
  const asks = ASK_KWS.some((k) => t.indexOf(k) >= 0);

  if (!f) {
    return R("Nem tudtam eldönteni, melyik listát módosítsam. Nevezd meg: célcégek, célpozíciók, kulcs-szinonimák, kizárt cégek, versenytárs-klaszterek, közösségek, boolean lekérdezések, vagy a célpiac-térkép cégei.");
  }

  const key = f.target + ":" + f.field;
  const list = currentList(state, f.target, f.field);
  const values = extractValues(raw);

  // Kérdés vagy nincs kinyerhető érték → javaslat, nem végrehajtás.
  if ((asks && !isRm && !isExcl) || !values.length) {
    const have = new Set(list.map((x) => fold(valOf(x))));
    const pool = (SUGGESTIONS[key] || []).filter((x) => !have.has(fold(x)));
    if (!pool.length) {
      return R("Erre a listára most nincs olyan javaslatom, ami ne szerepelne már benne. Írd be konkrétan, mit vegyek fel — például „" + f.label + ": …”.");
    }
    return R(
      "Ezeket javaslom a(z) " + f.label + " listához. Egyenként alkalmazhatod — magamtól nem írom felül a tervedet.",
      [],
      pool.slice(0, 4).map((v) => ({ op: isRm ? "remove" : "add", target: f.target, field: f.field, value: v, label: v }))
    );
  }

  const actions = [], skipped = [];
  for (const v of values) {
    if (isRm) {
      const hit = findExisting(list, v);
      if (hit == null) { skipped.push(v); continue; }
      actions.push({ op: "remove", target: f.target, field: f.field, value: hit, label: valOf(hit) });
    } else {
      if (findExisting(list, v) != null) { skipped.push(v); continue; }
      const val = f.target === "map" && f.field === "target_companies"
        ? { name: v, why: "A recruiter vette fel a stratégia-asszisztensen keresztül.", likely_roles: [] }
        : v;
      actions.push({ op: "add", target: f.target, field: f.field, value: val, label: v });
    }
  }
  if (!actions.length) {
    return R((isRm ? "Nem találtam a listában: " : "Már szerepel a listában: ") + skipped.join(", ") + ". A(z) " + f.label + " így változatlan.");
  }
  const verb = isRm ? "Kivettem" : isExcl ? "Kizártam" : "Felvettem";
  let reply = verb + " a(z) " + f.label + " közül/közé: " + actions.map((a) => a.label).join(", ") + ".";
  if (skipped.length) reply += " Kihagytam (" + (isRm ? "nem találtam" : "már szerepelt") + "): " + skipped.join(", ") + ".";
  if (isExcl) reply += " A kizárt cégek jelenlegi és volt munkatársai nem kerülnek a jelöltlistára.";
  return R(reply, actions);
}
