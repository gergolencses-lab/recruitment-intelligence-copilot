# 3. Senior Data Engineer, Data Platform — Motio (fiktív), Tallinn / remote EU

> **Teszt-fixture** · fiktív, market-realista brief. Valós piaci alap: *Bolt — Senior Data Engineer, Data Platform (Compute)* ([bolt.eu/careers](https://bolt.eu/en/careers/positions/6964133002/)); *Wise — Senior Backend Engineer, ML/Data, Budapest*.
> **Nyelv:** angol.
> **Csavar:** *félrecímkézett szerep.* A titulus „Data Engineer" (SQL/dbt konnotáció), de a valódi munka **alacsony-latenciájú stream-feldolgozás és elosztott rendszerek** skálán. Az intake-nek le kell lepleznie, hogy ez inkább backend/streaming, mint klasszikus analytics-DE.

---

## 📋 A brief — ezt másold az Intake mezőbe

**Company:** Motio — mobility super-app (ride-hailing + micromobility + food), 8 markets, HQ Tallinn. Remote-friendly across EU time zones.

**Team:** Data Platform — Compute. We own the systems that turn raw event firehoses into the signals the whole company runs on: surge pricing, ETA prediction, driver-rider matching, and real-time fraud.

**Role:** Senior Data Engineer.

**What you'll do:**
- design and operate the streaming backbone that ingests **~4M events/sec** at peak
- build low-latency feature pipelines feeding real-time pricing and fraud models (end-to-end budget: <200ms)
- own our Kafka + Flink infrastructure; evolve it toward exactly-once, backpressure-safe processing
- expose self-serve, well-documented data products to 30+ product teams
- keep p99 fresh and the on-call pager quiet

**What we're looking for:**
- strong software engineering fundamentals (this is a backend-heavy role — you'll write a lot of JVM/Go, not just SQL)
- deep experience with stream processing (Flink, Kafka Streams, Spark Structured Streaming)
- distributed-systems intuition: partitioning, watermarking, state stores, consistency trade-offs
- comfort operating stateful services at scale (K8s, autoscaling, observability)
- data modeling for both real-time and batch consumers

**Nice-to-haves:**
- feature-store experience (Feast/Tecton), ML-adjacent work, mobility/marketplace domain

**Comp:** €70,000–95,000 gross/year + stock options, depending on level and location.

**Note from the hiring manager:** we keep getting dbt/warehouse analytics-engineer profiles. That's not this role. This is closer to backend distributed systems that happens to move data.

---

## 🧪 Teszt-jegyzet (Gergőnek — ne másold be)

- **Mit kéne az intake-nek elkapnia:** a „Data Engineer" titulus **félrevezető** — a must-have-ek (Flink/Kafka, exactly-once, watermarking, stateful services, JVM/Go) egy **streaming/distributed-systems backend** mérnököt írnak le. A rejtett igény: erős SWE-fundamentumok, nem SQL/dbt-analytics. A hiring manager saját megjegyzése („we keep getting dbt profiles") a félrecímkézés kész bizonyítéka — az intake-nek ezt reframe-elnie kell.
- **Discover-elvárás:** a talent-map ne „analytics engineer"-eket hozzon, hanem streaming/platform/backend jelűeket (Flink/Kafka/state stores). Adjacens titulusok: Streaming Platform Engineer, Backend Engineer (Data), SRE-Data.
- **Attract-elvárás:** a horog a **skála és a probléma** (4M event/sec, <200ms fraud/pricing), plusz remote-EU rugalmasság; a comp a régiós felső-közép sáv.
- **Piaci horgony:** észt/skálázó mobility ~€70–95k + opció (Bolt-szintű Data Platform).
