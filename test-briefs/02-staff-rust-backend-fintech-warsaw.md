# 2. Staff Backend Engineer (Rust) — Kvanta Pay (fiktív), Warsaw / remote CEE

> **Teszt-fixture** · fiktív, market-realista brief. Valós piaci alap: *dock.financial — Rust Backend Engineer* ([careers](https://dock.financial/en/careers/456168)); *RustJobs.dev*; Rust-in-fintech trend, Warsaw fintech hub.
> **Nyelv:** angol.
> **Csavar:** *unikornis-kombó + belső ellentmondás.* „5+ év production Rust" egy olyan piacon, ahol a Rust-in-payments még fiatal → az intake-nek jeleznie kell a szűk poolt és a túlspecifikált követelményt; a no-reject rankingnek pedig imperfekt, de erős jelölteket is rangsorolnia kell.

---

## 📋 A brief — ezt másold az Intake mezőbe

**Company:** Kvanta Pay — Series B payments infrastructure company (card issuing + real-time ledger), HQ Warsaw, ~90 people. Hybrid: 3 days/week in our Wola office, no full-remote.

**Role:** Staff Backend Engineer, Ledger & Money Movement.

We are rebuilding our core ledger in **Rust** for correctness and latency. This is the beating heart of the company — every transaction flows through it. We need a staff-level engineer who has *done this before*.

**You will:**
- own the design of a horizontally-scalable, strongly-consistent ledger (event-sourced, exactly-once semantics)
- push p99 write latency under 10ms at 20k TPS
- work across the stack — mostly Rust, but you'll also touch our TypeScript admin frontend when needed
- be on-call for the money-movement path (highest severity tier)
- mentor 4 mid-level engineers and set the technical direction for the domain

**Must-haves:**
- 5+ years of **production Rust** (not hobby projects)
- deep distributed-systems background: consensus, CRDTs or similar, idempotency, sagas
- payments or core-banking domain experience (ledgers, double-entry, reconciliation)
- track record operating systems at scale with hard correctness guarantees
- strong on Postgres internals, Kafka, and observability

**Nice-to-haves:**
- formal methods (TLA+), fintech regulatory exposure (PSD2), and open-source Rust contributions

**Comp:** 30–42k PLN/month B2B depending on seniority. Equity. We move fast and expect the same.

We've been searching for 4 months and only met 2 people who fit. We're getting impatient.

---

## 🧪 Teszt-jegyzet (Gergőnek — ne másold be)

- **Mit kéne az intake-nek elkapnia:** a „5+ év *production* Rust" + payments + distributed + „also do frontend" egy **unikornis-kombó** — a Rust production-payments pool globálisan pár száz fő. Rossz-brief-jel: a „4 hónapja keresünk, 2 embert találtunk" épp a túlspecifikáció tünete. Rejtett igény: valószínűleg egy **erős distributed-systems mérnök** kell, akit *átképeznek* Rustra (C++/Go háttérrel), nem a lehetetlen tökéletes match.
- **Discover-elvárás:** Rust + fintech/ledger jelek, de a talent-mapnek adjacens poolt is (C++/Go distributed, exactly-once, event-sourcing) fel kell hoznia. On-site Wola-kényszer vs. remote-Rust-piac feszültség.
- **Attract-elvárás:** a horog a **probléma izgalma** (zöldmezős ledger, 10ms/20k TPS, formal methods), nem a comp. A no-reject miatt az imperfekt (4 év Rust vagy Rust-hobби + erős C++) jelölteket is „hogyan szerezd meg" logikával kell kezelni.
- **Piaci horgony:** Rust fintech Warsaw B2B ~28–42k PLN/hó; a régió olcsóbb SF-hez képest ($55–75k vs $130–160k).
