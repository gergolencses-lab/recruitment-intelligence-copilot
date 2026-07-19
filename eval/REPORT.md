# RIC kiértékelési riport — 5 brief mint diszkrimináló teszt

**Dátum:** 2026-07-19 · **Modell:** claude-sonnet-5 · **Mód:** éles (Agy + Firecrawl) · **Intake stabilitás:** N=3
**Módszer:** `eval/run.mjs` (headless lánc + nyers-modell abláció) → `eval/judge.mjs` (vak bíró + adverzariális szkeptikus) → emberi verifikáció (a fabrikációs találatokat kézzel ellenőriztem).

---

## TL;DR

A rendszer **erős ott, ahol gondolkodni kell** (a brief-csapdákat megbízhatóan elkapja), és **gyenge ott, ahol tényt kell tisztelnie** (kitalál a jelöltekről, és a publikus-web felkutatás zajt hoz a nehéz szerepeknél). Két igazolt, komoly találat + egy robusztussági rés + egy kényelmetlen stratégiai tanulság.

1. 🟢 **Csapda-elkapás: erős.** 15/18 vak-bíró kritérium; az intake reframe pontos és stabil (3/3).
2. 🔴 **Attract = kitalál + túlmagabiztos** (P0). Az „elcsábítás" tényeket gyárt a jelöltről (a #3-nál 6 kitalált tény egy emberről, akiről 1 adatunk van), és „közepes" konfidenciát ír, amikor „alacsony" lenne. **Ez az, ami Zitát kínos helyzetbe hozná.**
3. 🔴 **Élő reach = zaj a nehéz szerepeknél** (P0). A #2 (Rust) 3 „jelöltjéből" 2 nem is ember (GitHub-repo). A szintetikus pool viszi a demót.
4. 🟠 **Robusztusság: néma bukás** (P1). A #5 rank egyetlen hibás JSON-tól elhalt, **retry nélkül** → az egész rangsor elveszett, a lánc csendben rossz jelöltre esett.
5. 🟡 **A persona az intake-nél nem veri a nyers promptot** (stratégiai). 4/5 megoldott ablációból 3-szor a nyers modellt választotta a vak bíró. A Knowledge Core értéke NEM az egyszeri reframe.

**Go/no-go:** demo-kész **vezetett-gondolkodó cockpitként**; **NEM kész** arra, hogy valós, scrape-elt emberről automatikusan megkeresőt írjon — előbb kell a P0 őszinteség-fix.

---

## Scorecard

| Brief (csapda) | Robusztus (auto) | Csapda-elkapás (rubrika) | Abláció (RIC vs nyers) | Fabrikált tény (attract) |
|---|---|---|---|---|
| **#1** homály (HU) | 🟢 no-reject ✔ · live ✔ · HU ✔ | 3/4 (nem szedi szét builder/üzemeltető) | **nyers** (clear) | 2 (igazolt) |
| **#2** unikornis (Rust, élő reach) | 🟢 no-reject ✔ · live ✔ | 3/4 (a hook közösségre épít, nem a problémára) | megoldatlan* | 5 |
| **#3** félrecímke (élő reach) | 🟢 no-reject ✔ · live ✔ | **4/4** | **nyers** (clear) | 6 (igazolt) |
| **#4** hype | 🟢 no-reject ✔ · live ✔ | 2/3 (nem nevesíti a valódi igényt) | **RIC** | 4 |
| **#5** ellentmondás | 🔴 **rank elhalt (JSON)** | 3/3 (advisory szétvágja a szerepet) | **nyers** (clear) | 3 |

\* #2 abláció megoldatlan, mert **a nyers modell baseline-ja maga is törött JSON-t adott** (95s) — ez adat: a JSON-törékenység modell-szintű, nem persona-hiba.

---

## Az 5 találat (részletesen)

### 1. 🔴 Attract: kitalál és túlmagabiztos — P0, ez a legfontosabb
A „no reject, only attract" filozófia árnyoldala materializálódott: hogy mindenkit vonzóvá tegyen, a stratégia **a brief ideálját rávetíti a jelöltre**, és nem létező tényeket állít róla. A legélesebb a #3-nál, ahol a jelöltről egyetlen jel ismert (egy publikus konferencia-deck), mégis ezt állítja:
- „fraud és pricing rendszerek alatt dolgozott" — nincs rá jel
- „staff-szintű döntési jogkör neki szánva" — a jelenlegi szerepéről (company: null) nincs adat
- „tudatos szakmai brand-építő" — egy slideshare-feltöltésből
- + a #1-nél: „konkrét, magas konfidenciájú fizetés/stádium-kockázat" — nincs jel fizetésről/cégméretről.

**Kalibráció is rossz:** a top-szintű `confidence` „közepes", miközben az evidencia egyetlen adatpont → „alacsony" lenne. `grounded=false, calibrated=false` (#1, #3, kézzel igazolva). Minél véknyabb a valós jelölt (Firecrawl), annál több a kitaláció.

### 2. 🔴 Élő reach: zaj a nehéz szerepeknél — P0
A #2 (senior Rust/payments) élő Firecrawl-felkutatása **4 találatból 3 „jelöltet"** adott, amiből **2 nem ember**: egy `dotfiles/emacs.d` repo és egy `vim-golf-challenges` repo — átcsúsztak az `is_person` szűrőn. A 3. egy valódi ember (Rust Warsaw meetup-szervező), de közösségi profil, nem bizonyított staff-mérnök. **Ok:** a senior passzív jelöltek LinkedInen vannak (amit belépve nem scrape-elünk); a publikus web repo-kat és cikkeket indexel, nem embereket. A #3 jobb volt (9 jelölt), de ott is vegyes.

### 3. 🟠 Robusztusság: néma bukás a #5 ranknél — P1
A #5 rank `Expected ',' ... position 2839` JSON-hibától elhalt. A `parseJson` nem tudta menteni, **nincs retry**, így a teljes rangsor elveszett — és a lánc **csendben** a `candidates[0]`-ra esett vissza attracthez (nem a valódi topra). A UI ezt nem jelezné. (Ugyanez a törékenység a #2 nyers-baseline-t is megölte → nem persona-specifikus, hanem a JSON-kezelés hiánya.)

### 4. 🟢 Csapda-elkapás: ez a győztes — a rendszer erőssége
Az intake reframe pontos és **stabil** (mind az 5 brief 3/3 konzisztens). Kiemelkedő a #3 (félrecímke), ahol pont az ellenkezőjét vártam: *„Ez nem Data Engineer szerep, hanem staff-szintű backend/distributed pozíció álcázva… a cím maga a probléma: analytics-engineer jelölteket vonz."* — és a talent-map is streaming/distributed felé térképez (Bolt → Streaming Infrastructure Engineer), nem analytics felé. **A hipotézisemet (itt bukik) az eval megcáfolta.** A #5-nél az advisory helyesen javasolja a szerep kettévágását (EM vs Staff-IC). Konkrét misszek: #1 nem mondja ki explicit a builder-vs-üzemeltető kettéválást; #4 nem nevesíti a hype alatti valódi igényt.

### 5. 🟡 Abláció: a persona nem veri a jó promptot az intake-nél — stratégiai
Vak bíró, ugyanaz a modell, csak intake, n=1. **4/5 megoldott: 3× a nyers modell nyert (clear), 1× a RIC (#4), 1 megoldatlan.** A bíró indoka rendre: a nyers baseline *több* bad-brief-jelet és konkrétabb must-have-eket adott. **Következtetés:** a Knowledge Core értéke NEM az egyszeri reframe — egy jól megírt, szándék-illesztett prompt ugyanoda ér. *Fontos árnyalat:* az abláció CSAK az intake-et méri; a RIC valódi differenciátora a **lánc** (evidencia-kötött discover→rank→attract), a **no-reject fegyelem** és a **termék-felület** — ezt az abláció nem teszteli.

---

## Amit tanultunk (tengelyenként)

- **Robusztusság:** minden élesben megy; a no-reject *szándéka* tart, de a *mechanizmus* törékeny (egy rossz JSON = néma teljes bukás).
- **Csapda-elkapás:** az intake a legerősebb capability — megbízható és stabil. Ez a termék „gondolkodó" magja, és működik.
- **Őszinteség:** a legveszélyesebb viselkedés az attract-fabrikáció + túl-konfidencia — a rendszer a saját 1. alapelvét (evidencia-alapúság) sérti meg, épp a „szíve" funkcióban.
- **Reach:** a publikus-web felkutatás a leggyengébb láncszem a nehéz szerepeknél; a demót a szintetikus pool tartja el.
- **IP-ROI:** a persona az intake-nél túl van mérnökölve; a Knowledge Core-t oda kell tenni, ahol tényleg differenciál (attract-fegyelem, lánc-evidencia, no-reject enforcement).

---

## Fix-backlog (priorizált)

**P0 — őszinteség / biztonság (az attract előtt ne menjen éles emberre):**
1. `attractionStrategy`: tiltsd a jelölt-specifikus tények kitalálását — minden `driver`/`evidence` KÖTELEZŐEN a jelölt tényleges `signals[]`-ára hivatkozzon. Új guardrail: `assertEvidenceGrounded(attract, candidate.signals)` (az `assertNoReject` mintájára), ami jelöli/kivágja a nem-visszavezethető állításokat.
2. Kalibráció: ha a jelöltnek ≤1 jele van vagy egyforrású/közösségi, a `confidence` KÉNYSZERÍTETTEN „alacsony". A top-szintű konfidencia legyen az evidencia-erő függvénye, ne a modell szeszélye.

**P0 — reach:**
3. Erősítsd az `is_person` szűrőt a `normalize.js`-ben (repo/dotfiles/archive/challenge URL → nem ember). Ha a felkutatás < N valódi embert vagy főleg nem-személyt hoz, a rendszer **jelezze** („gyér publikus-web lefedettség ehhez a szerephez"), ne prezentáljon zajt jelöltként.

**P1 — robusztusság:**
4. `think()`: 1× retry JSON-parse-hibára + erősebb JSON-mentés. A rank/összes lépés **hibáját jelezd a UI-ban**, ne ess csendben `candidates[0]`-ra.

**P2 — minőség:**
5. #1: az intake mondja ki explicit a builder-vs-üzemeltető kettéválást. #4: nevesítse a hype alatti valódi igényt.

**P3 — stratégiai:**
6. Az intake-persona túl-mérnökölt egy jó prompthoz képest → az IP-energiát a differenciátorokra (attract-fegyelem, lánc, no-reject) allokáld.

---

## Go / No-go (Zitához)

| Capability | Állapot | Verdikt |
|---|---|---|
| Intake / query / talent-map | erős, stabil | 🟢 demo-kész |
| Rank | működik, de néma bukás-mód | 🟠 retry kell, mielőtt támaszkodsz rá |
| **Attract** | tényeket talál ki, túl-konfidens | 🔴 **NEM** mehet éles emberre a P0-fix előtt |
| Élő reach | zaj a nehéz szerepeknél | 🟠 szintetikus demóra jó, éles hard-role-ra nem |

**Összegzés:** demo-kész **vezetett-gondolkodó eszközként** (intake→térkép→rangsor). Ami még NEM: „bízd rá a megkeresőt, amit egy valós scrape-elt emberről ír" — előbb az attract-őszinteség guardrail.

---

## Spot-check Gergőnek (az emberi orákulum — nézd meg ezt a 2-t)

1. **`eval/results/03/attract-top.json`** — olvasd el a 6 kitalált tényt egy valós Firecrawl-jelöltről (akiről 1 deck az összes adat). **Kérdés:** ha erre építve mennél ki megkeresővel, kínos lenne? Ez a legdiagnosztikusabb.
2. **#1 abláció:** `eval/results/01/intake-runs.json` (RIC) vs `eval/results/01/baseline-intake.json` (nyers) — érezd meg, tényleg hozzátesz-e a persona a sima prompthoz.

---

## Módszertani fenntartások (őszintén)

- **Saját házi kockázat:** én írtam a personát, a briefeket ÉS az elvárásokat. Ellensúly: vak bíró + adverzariális szkeptikus (a fabrikációkat kézzel igazoltam #1/#3-on) + az abláció vak. De a bíró ugyanaz a modellcsalád (self-preference lehet).
- **Abláció:** csak intake, n=1, 4/5 megoldott. Irányadó, nem végleges. A lánc/termék-differenciátort nem méri.
- **Saját bíró-hibák (javítva):** a bíró max_tokens-e először csonkolt (#2/#4 abláció) → felvittem; a #2 nyers-baseline JSON-ja korrupt maradt → megoldatlan, de maga is adat.
