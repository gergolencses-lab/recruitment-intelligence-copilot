// Demo-mód: realisztikus HU minta-outputok, ha nincs ANTHROPIC_API_KEY.
// Ezek mutatják a "senior agy" kimeneti FORMÁJÁT és színvonalát élesben.
// A UI jelöli, hogy demo-adat. Kulcs megadásakor minden élőben generálódik.

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
    bad_brief_flags: [
      "A '10+ év Java' fölösleges szűkítés — kizár erős poliglott mérnököket.",
      "A brief 'egyedül vigye a rendszert' + 'csapatépítés' — ez két külön szerep; tisztázni kell a hiring managerrel.",
    ],
    hidden_requirements: [
      "Valójában egy tech-lead kell, nem tiszta IC — a HM a 'senior' szót lead helyett használja.",
    ],
    search_hypotheses: [
      "Régiós fintech scale-upök payments-csapatai",
      "Craft Conf / infra-meetup előadók",
      "OSS: idempotency / distributed-tx libek karbantartói",
    ],
  }),

  queryBuild: (input) => ({
    _demo: true,
    boolean_queries: [
      { platform: "linkedin-xray", query: 'site:linkedin.com/in ("staff engineer" OR "principal engineer" OR "tech lead") payments (Go OR Rust OR Java) (Budapest OR Warsaw OR Prague OR remote)' },
      { platform: "github", query: 'site:github.com payments idempotency location:Hungary OR location:Poland' },
      { platform: "google", query: '"craft conf" OR "pycon" speaker distributed systems payments 2024 2025' },
    ],
    firecrawl_search_queries: [
      'site:linkedin.com/in staff engineer payments Go Rust Budapest OR Warsaw',
      'site:github.com senior backend engineer payments idempotency Hungary OR Poland',
      'craft conf speaker distributed systems payments CEE',
      'principal platform engineer Kubernetes SRE Krakow OR Prague site:linkedin.com/in',
    ],
    target_companies: ["(régiós fintechek)", "(neobankok)", "(payment PSP-k)", "(infra startupok)"],
    target_titles: ["Staff Engineer", "Principal Engineer", "Tech Lead", "Engineering Manager (hands-on)"],
    synonyms: ["distributed systems", "payments core", "high-throughput", "event-sourcing", "SRE"],
  }),

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
    seniority_read:
      "Valódi staff-szint: rendszer-szintű döntéseket hoz és másokat emel. A payments-terhelés éles felelősség volt, nem hobbi.",
    fit_signals: [
      { signal: "Payments core productionben 3 év", strength: "erős", evidence: "headline + konferencia-téma" },
      { signal: "OSS idempotency-lib karbantartás", strength: "közepes", evidence: "GitHub" },
      { signal: "Craft Conf előadás skálázásról", strength: "közepes", evidence: "publikus program" },
    ],
    gaps_to_explore: [
      "Vezetett-e formálisan csapatot, vagy technikai lead volt? — beszélgetésben tisztázni.",
      "Mennyire volt on-call felelőssége?",
    ],
    unknowns: ["Jelenlegi elégedettsége / vált-e szívesen", "Fizetési elvárás", "Remote vs. iroda preferencia"],
    standout: "Ritka kombináció: mély elosztott-rendszer + valós payments-tét + közösségi láthatóság.",
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
        pursue_priority: i + 1,
        tier:
          i < 3 ? "A — most üldözd"
          : i < 7 ? "B — párhuzamos"
          : i < n - 2 ? "C — melegen tartsd"
          : "D — nem éri meg",
        rationale:
          i < 3 ? "Legerősebb evidencia + jó elérhetőség; itt a legmagasabb a válasz-esély."
          : i < n - 2 ? "Erős jel, de gyengébb elérhetőség vagy kevesebb megerősítő forrás."
          : "A jelek gyengék vagy szerep-irrelevánsak — jelenleg nem éri meg üldözni.",
        evidence: (c.signals || []).slice(0, 1).map((s) => s.signal),
      })),
      note: "Őszinte üldözési prioritás — a D-tier evidencia alapján jelenleg nem éri meg.",
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
        angle: "Tét, nem állás: 'a payments core, ami eldönti, hogy a cég skálázódik-e — a tiéd, és a csapat, amit köré formálsz.'",
        hook: "A munkájára reflektálva: 'Láttam a skálázás-előadásod — pont ilyen fejjel keresünk valakit, aki eldönti, milyen legyen a rendszer, nem beáll egybe.'",
        why_might_work: "A grounded jelek (OSS + konferencia) azt mutatják, szereti, ha a munkája látszik és számít — a scope+tulajdon üzenet erre épít. Spekuláció: a motiváció feltételezett.",
        speculative: true,
      },
      { rank: 2, angle: "IC→lead scope-emelés, ha váltáskész.", why_might_work: "Staff-jel van, formális vezetésre nincs — lehet neki új szint. Spekulatív.", speculative: true },
      { rank: 3, angle: "Menekülés a láthatatlan legacy-karbantartástól egy zöldmezős rendszerbe.", why_might_work: "Gyakori senior-frusztráció, de erre KONKRÉT jel nincs — a leggyengébb hipotézis.", speculative: true },
    ],
    recommended: 1,
    channel: "Első kör NE LinkedIn-InMail (zajos). Ha van közös ismerős vagy warm szál a konferencia-Q&A-ból → azon. Másodlagos: rövid, személyes e-mail, ami a munkájára reflektál.",
    timing: "Most: friss régiós tőkebevonások után a 'mit építesz a következő 2 évben' kérdés nyitott.",
    risks: ["Sablonos megkeresés → azonnal kiesik a figyelme.", "Üres scope-ígéretet egy senior azonnal átlát."],
  }),

  outreachDraft: (input) => ({
    _demo: true,
    candidate_id: input && input.candidate_id,
    language: "en",
    channel: "warm email / referral",
    subject: "Your idempotency talk — and a payments core that needs your head",
    body:
      "Hi Ádám,\n\nI caught your Craft Conf talk on idempotency keys — the part about partial failures was exactly the kind of thinking most teams skip.\n\nI'm helping a payments team that's at the point where the core either scales or breaks. They don't want someone to *maintain* it — they want someone to decide what it should be, and build the team around it. Staff-to-lead scope, architecture ownership from day one, remote-first.\n\nNot a pitch, just a question: is 'the payments core is yours' the kind of problem you'd want to hear more about?\n\n— [név]",
    why_this_works: [
      "Az első mondat a SAJÁT munkájára reflektál (nem sablon).",
      "A tétet kínálja, nem az állást.",
      "Alacsony súrlódású zárás: egy kérdés, nem egy CV-kérés.",
    ],
    note: "Ez DRAFT — a recruiter nézi át és küldi. A rendszer nem küld semmit.",
  }),

  clientAdvisory: (input) => ({
    _demo: true,
    talking_points: [
      "A '10+ év Java' feltétel kizár erős jelölteket — javasold a nyelv-agnosztikus szűrést.",
      "Amit leírtatok, az valójában tech-lead, nem tiszta IC — igazítsuk a szintet és a bérsávot.",
      "A piac mozgásban: ha 3 hétnél tovább vársz a döntéssel, a top jelölt elmegy máshova.",
    ],
    seniority_framing:
      "A hiring manager felé úgy pozicionáld magad, mint aki a PIACOT ismeri, nem aki CV-t tol: hozz 2 konkrét piaci jelet (bérszint, elérhetőség), és egy kockázatot, amit ő nem lát.",
    watch_outs: ["Túl hosszú folyamat", "Homályos scope", "Alulárazott sáv a régiós szinthez képest"],
  }),

  interviewIntel: (input) => ({
    _demo: true,
    competency_questions: [
      { competency: "Elosztott rendszerek", question: "Mesélj egy partial-failure esetről a payments-ben — hogyan vetted észre, mit tettél?", what_good_looks_like: "Konkrét eset, mérés, trade-off, nem tankönyv." },
      { competency: "Vezetés/emelés", question: "Volt, akit te emeltél a következő szintre? Hogyan?", what_good_looks_like: "Nevesített példa, konkrét lépések, nem 'segítettem a csapatnak'." },
      { competency: "Rendszer-döntés", question: "Egy architektúra-döntés, amit ma másképp hoznál meg — miért?", what_good_looks_like: "Önreflexió + tanulás, nem védekezés." },
    ],
    red_flags_to_probe: ["Csak 'mi' nyelv, sose 'én' a felelősségnél", "Nem tud mérést mondani a hatásához"],
  }),

  recruitmentCoach: (input) => ({
    _demo: true,
    what_a_senior_would_do:
      "Egy senior nem a briefből indul, hanem megtámadja: 'miért pont Java?' és 'IC vagy lead?'. Te most a briefet végrehajtottad — a következő szinten a briefet jobbá teszed, mielőtt keresel.",
    one_lever_now: "A megkeresésednél mindig kösd az első mondatot a jelölt SAJÁT munkájához — ez egyedül megduplázza a válaszarányt.",
    skill_focus: "Reframe-készség: a rossz brief kiszúrása és tisztázása a hiring managerrel.",
    encouragement: "A discovery-listád jó — a jelöltek relevánsak. A következő ugrás a személyre szabott elcsábításban van.",
  }),
};
