// 📡 Reach Engine — szintetikus fallback pool (senior tech / CEE).
// Akkor fut, ha nincs FIRECRAWL_API_KEY, vagy source=synthetic.
// Minden jelölt EGYÉRTELMŰEN szintetikus (synthetic:true), nem valós személy.

const POOL = [
  {
    name: "Bogdán Ádám",
    headline: "Staff Backend Engineer — payments, Go/Rust",
    current_company: "(régiós fintech scale-up)",
    location: "Budapest, HU",
    signals: [
      { signal: "8+ év elosztott rendszerek, utolsó 3 év payments core", strength: "erős" },
      { signal: "Konferencia-előadó (Craft Conf), skálázás-témában", strength: "közepes" },
      { signal: "OSS: karbantart egy idempotency-key libet", strength: "közepes" },
    ],
  },
  {
    name: "Nowak Katarzyna",
    headline: "Principal Platform Engineer — Kubernetes, SRE",
    current_company: "(lengyel unicorn)",
    location: "Kraków, PL",
    signals: [
      { signal: "Platform-csapatot épített 0-ról 12 főre", strength: "erős" },
      { signal: "CNCF meetup társszervező Krakkóban", strength: "közepes" },
    ],
  },
  {
    name: "Varga Eszter",
    headline: "Senior ML Engineer — MLOps, forecasting",
    current_company: "(energetikai adatcég)",
    location: "Budapest, HU",
    signals: [
      { signal: "Idősoros előrejelző pipeline productionben (villamosenergia)", strength: "erős" },
      { signal: "PyData Budapest előadás feature-store témában", strength: "közepes" },
    ],
  },
  {
    name: "Horák Tomáš",
    headline: "Engineering Manager — embedded / IoT",
    current_company: "(cseh ipari OEM)",
    location: "Brno, CZ",
    signals: [
      { signal: "Firmware + felhő-kapcsolat, 20 fős szervezet", strength: "erős" },
      { signal: "Korábban IC-ként RTOS-scheduler contribs", strength: "közepes" },
    ],
  },
  {
    name: "Kovács Bence",
    headline: "Staff Frontend Engineer — design systems, React/TS",
    current_company: "(SaaS scale-up)",
    location: "Szeged/Remote, HU",
    signals: [
      { signal: "Design-system libet vezet, 40 fejlesztő használja", strength: "erős" },
      { signal: "Aktív tech-blog performancia-témában", strength: "közepes" },
    ],
  },
  {
    name: "Ionescu Andrei",
    headline: "Senior Data Engineer — streaming, Kafka/Flink",
    current_company: "(román e-commerce)",
    location: "Cluj-Napoca, RO",
    signals: [
      { signal: "Valós idejű pipeline 2M event/perc", strength: "erős" },
      { signal: "Meetup-előadó stream processing témában", strength: "közepes" },
    ],
  },
  {
    name: "Szabó Réka",
    headline: "Principal Security Engineer — appsec, cloud",
    current_company: "(régiós bank tech-leánya)",
    location: "Budapest, HU",
    signals: [
      { signal: "Threat-modeling programot vezetett be", strength: "erős" },
      { signal: "CVE-jelentések, felelős disclosure track", strength: "közepes" },
    ],
  },
  {
    name: "Wójcik Marek",
    headline: "Staff Engineer — distributed databases",
    current_company: "(infra startup)",
    location: "Warsaw/Remote, PL",
    signals: [
      { signal: "Consensus/replikáció mély szakértelem", strength: "erős" },
      { signal: "OSS commitok egy elosztott KV-store-ba", strength: "erős" },
    ],
  },
  {
    name: "Tóth Gergely",
    headline: "Senior Site Reliability Engineer — observability",
    current_company: "(telco digital unit)",
    location: "Budapest, HU",
    signals: [
      { signal: "SLO-kultúrát honosított meg 6 csapatnál", strength: "erős" },
      { signal: "OpenTelemetry contributor", strength: "közepes" },
    ],
  },
  {
    name: "Novák Lucia",
    headline: "Engineering Lead — fintech mobile",
    current_company: "(szlovák neobank)",
    location: "Bratislava, SK",
    signals: [
      { signal: "iOS+Android csapat, 0-1 termékindítás", strength: "erős" },
      { signal: "Női tech-mentorprogram szervezője", strength: "közepes" },
    ],
  },
  {
    name: "Farkas Dániel",
    headline: "Senior Backend Engineer — event-sourcing, .NET",
    current_company: "(logisztikai SaaS)",
    location: "Debrecen/Remote, HU",
    signals: [
      { signal: "CQRS/event-sourcing productionben 4 éve", strength: "erős" },
    ],
  },
  {
    name: "Popescu Maria",
    headline: "Staff Data Scientist — pricing, optimization",
    current_company: "(marketplace)",
    location: "Bucharest, RO",
    signals: [
      { signal: "Dinamikus árazó modell, mért árbevétel-hatás", strength: "erős" },
      { signal: "Kaggle Grandmaster", strength: "közepes" },
    ],
  },
  {
    name: "Kiss Márton",
    headline: "Principal Engineer — cloud cost & FinOps tooling",
    current_company: "(régiós ISV)",
    location: "Budapest/Remote, HU",
    signals: [
      { signal: "Belső FinOps-platform, 7-jegyű megtakarítás", strength: "erős" },
    ],
  },
  {
    name: "Svoboda Petr",
    headline: "Senior Full-stack — healthtech",
    current_company: "(cseh healthtech)",
    location: "Prague, CZ",
    signals: [
      { signal: "Szabályozott környezet (orvostech) szoftver", strength: "erős" },
      { signal: "Konferencia-előadás compliance-by-design témában", strength: "közepes" },
    ],
  },
];

let seq = 0;
export async function gatherSynthetic() {
  seq = 0;
  return POOL.map((c) => {
    seq += 1;
    return {
      ...c,
      id: `syn-${String(seq).padStart(3, "0")}`,
      synthetic: true,
      source_url: null,
      source_type: "synthetic",
      art14_status: "n/a (szintetikus)",
      provenance: {
        method: "synthetic-pool",
        query: null,
        fetched_at: new Date().toISOString(),
      },
    };
  });
}
