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
};
