# 4×4 rács — mit tanultunk az éles futásokból

**Rács:** 4 szerep (marketing asszisztens, gyártásmérnök, vezetői asszisztens, bank
vezérigazgató) × 4 város (Budapest, Győr, Pécs, Székesfehérvár), teljes éles
láncon: `intakeReframe → queryBuild → discover`.

**Mérce:** öt kapu, cellánként. G1 rugalmasság · G2 vonzáskörzet · G3 földrajz
a lekérdezésben · G4 megtalálhatóság · G5 jelöltminőség. A bíró külön
Anthropic-hívást használ, hogy a mért kód módosítása ne mozdítsa el a mércét.

## r1 — kiindulás: 7/16

Kapubukások: G2=5 · G5=4 · G1=2 · G3=1 · **G4=0**.

A legfontosabb meglepetés a **G4=0**: a túlspecifikálás önmagában NEM hozott nulla
találatot. A hiba nem ott volt, ahol vártuk.

### Amit a bíró indoklásai kirajzoltak

1. **Ismert nagyváros a valódi ingázó-gyűrű helyett.** Győrhöz Sopront és
   Tatabányát sorolta fel, miközben Csorna, Pannonhalma, Tét, Abda kimaradt.
   Ez LLM-szaliencia-torzítás: azt nevezi meg, amit "ismer", nem azt, ami
   ténylegesen napi ingázást ad.

2. **Az ingázás iránya és a bérszint nem számított.** Székesfehérvárra egy
   asszisztensi szerephez Budapestet vette fel — de Székesfehérvárról Budapestre
   ingáznak, nem visszafelé, asszisztensi bérért. Ugyanez a várospár egy mérnöki
   szerepnél viszont helyes, sőt kötelező. **Ugyanaz a földrajz, szerepenként
   más ítélet** — ezt kellett a promptba beépíteni.

3. **A határ falként viselkedett.** Győr esetén a szlovák oldal (Dunaszerdahely,
   Komárno, Bratislava) indoklás nélkül maradt ki, holott a győri ipar alapvető
   utánpótlási csatornája. Egy korábbi kör "evidencia-alapú indok" követelménye
   itt túlkorrigált.

4. **A keresés álláshirdetéseket célzott jelöltek helyett.** A scrape-keret
   3–5/6 részét állásportálok vitték el (profession.hu, qjob.hu, facebook/jobs).
   Hirdetésből sosem lesz jelölt — a keresés önmagát üresítette ki. Emellett a
   szenioritási sáv sem volt megkötve: 450 ezres asszisztensi szerepre
   "Head of Marketing" jött vissza.

5. **A kibővítés a rossz mennyiséghez volt kötve.** A kapu a nyers
   TALÁLATSZÁMOT nézte, miközben a találatok nagy része nem személy. Egy 12
   találatos cella 1 jelölttel ért véget úgy, hogy a tág kör le sem futott.

## r2 — a javítások után (10/16 cella futott le, ld. lentebb)

Determinisztikus mutatók, a 10 összevethető cellán:

| mutató | r1 | r2 |
|---|---|---|
| álláshirdetés-scrape (elpazarolt keret) | 23 | **0** |
| jelöltek összesen | 118 | 130 |
| rugalmasság = várt érték | 9/10 | **10/10** |
| geo beépült a szűk lekérdezésbe | 10/10 | 10/10 |

A három legrosszabb cella helyreállt: marketing asszisztens Győr **2 → 13**,
Székesfehérvár **1 → 12**, Pécs **5 → 11**.

A megnevezett földrajzi hibák eltűntek: Győrnél megjelent Dunaszerdahely és
Komárno; a vezetői asszisztensnél a valódi gyűrű (Csorna, Kapuvár, Tét,
Pannonhalma) váltotta a távoli nagyvárosokat; Székesfehérvárnál a mérnöki
szerep megkapta Budapestet, az asszisztensi nem.

### Egy regresszió, amit a rács kapott el

A prompt-átírás után **8/10 cellából kiesett maga az anchor** a
catchment_places listából (r1-ben 16/16 rendben volt): a modell "az anchor
KÖRÜLI gyűrűként" kezdte érteni a listát. Javítva a prompt szövegében ÉS
determinisztikus guarddal (`ensureAnchorInScope`), mert a megbízás helyszíne
nem függhet prompt-fegyelemtől. A guardot a 8 valódi hibás kimeneten
visszajátszva mind a 8 helyreáll, a 2 helyes érintetlen marad.

## r3–r5 — szolgáltatóváltás OpenAI GPT-5.6 Terrára

| kör | pont | G1 | G2 | G3 | G4 | G5 |
|---|---|---|---|---|---|---|
| r1 (Claude Sonnet 5) | 7/16 | 2 | 5 | 1 | **0** | 4 |
| r3 (GPT-5.6 Terra)   | 6/16 | **0** | 7 | 1 | **7** | 2 |
| r4 (javítás után)    | 13/16 | 0 | 3 | 0 | 0 | 0 |
| r5 (javítás után)    | **14/16** | 0 | 2 | 0 | 0 | 0 |

### A legfontosabb tanulság: a modellváltás LELEPLEZTE a saját promptunk hibáját

A nyers összpontszám (7 vs 6) azt sugallta, hogy a két modell egyenrangú.
A kapuprofil viszont teljesen eltért: a GPT jobb a rugalmasságon (16/16) és a
jelöltminőségen, viszont a G4 (megtalálhatóság) **0-ról 7 bukásra ugrott**, és
három cellában a szűk kör NULLA nyers találatot adott.

Az ok a saját prompt-utasításunk volt: *"az elengedhetetlen feltételek
mindegyikét ÉSelve"*. A Claude ezt lazán értelmezte, a GPT szó szerint — és
egyetlen stringbe zsúfolt minősítést, két nyelvet, öt core toolt és a
földrajzot. Ilyen adatok egy nyilvános profilon együtt nem szerepelnek.

Ez pontosan az eredeti 1) probléma (túlspecifikált keresés), csak nem a
briefből jött, hanem tőlünk — és a Claude engedékenysége évekig elfedhette
volna. **Egy második modell olcsóbb hibakereső eszköz, mint amilyennek látszik.**

### Ami a 6/16 → 14/16 utat adta

1. Egy lekérdezés max 3-4 megkülönböztető feltételt ÉSel; a must_have-ek
   szét vannak osztva a lekérdezések között. A promptban kimondva: a cél az
   elég jó merítés, a végső szűrést a recruiter végzi.
2. A határátlépésre ugyanaz a bérszint-teszt vonatkozik, mint a nagyvárosokra
   (r3-ban Dunaszerdahely bekerült egy 450 ezres asszisztensi keresésbe).
3. A vonzáskörzeti gyűrű legyen teljes (4-7 hely, minden bevezető irányból),
   és a szerep ágazata szerint rangsorolva — ipari szerepnél a gyártási
   központok előbbre, mint az alvótelepülés-jellegű elővárosok.
4. Belső konzisztencia: ami a lekérdezésben helynévként szerepel, annak a
   catchment_places listán is ott kell lennie.

### Determinisztikus megerősítés (nem bírói vélemény)

A G4-javulást Firecrawl-mérések támasztják alá, nem az LLM ítélete:

| | r3 | r4 | r5 |
|---|---|---|---|
| szűk kör nulla találattal | 3/16 | 1/16 | **0/16** |
| átlagos nyers találat | 8,4 | 16,4 | 15,5 |
| kibővítésre szorult | 5 | 1 | 2 |

Emellett r3-tól kezdve **0 hiba és 0 újrapróbálkozás** minden körben (r2-ben
Anthropicon 19 retry volt) — a `response_format: json_object` kiiktatta a
malformed-JSON hibaosztályt, ami korábban a rankTargets-et vitte el.

### ⚠️ A 14/16 ÖNÉRTÉKELÉS

A bíró (`gpt-5.6-sol`) ugyanattól a szolgáltatótól való, mint a mért rendszer,
tehát a pontszám **felfelé torzíthat**. Két egymást követő bírófuttatás
ugyanazon az r5 adaton ugyanazt a 14/16-ot és ugyanazt a kapuprofilt adta
(G2=2), tehát a szám stabil — de a torzítás ettől még fennáll.

Független ellenőrzés a Claude-kulcs feloldása (2026-09-01) után:
`node eval/geo-grid/judge.mjs --run-id=r5 --provider=anthropic`
Ez ugyanazon a nyers adaton fut, újrafuttatás nélkül.

### Maradék 2 bukás (mindkettő gyártásmérnök, mindkettő G2)

A 3. javítás enyhén túlkorrigált: az ágazati rangsorolás rövidebb listákat
hozott (4 hely), és emiatt kimaradt egy-egy nagy merítési központ
(Budapest Székesfehérvár mellől, Tatabánya Budapest mellől). A következő
kör iránya: ágazati rangsor ÉS teljes gyűrű együtt, ne egymás rovására.

## Nyitott pont

Az r2 **minőségi** kapui (G2/G4/G5) nincsenek leértékelve: az Anthropic-kulcs
elérte a beállított költségkeretét (`You will regain access on 2026-09-01`), így
6 cella nem futott le, és a bíró sem tudott lefutni. **r2-re pontszám nincs
kimondva** — a munka innen OpenAI-ra váltott (ld. r3-r5).

### Deploy-blokkoló

Egy queryBuild **46,7 mp** GPT-5.6 Terrán `medium` gondolkodási szinten. A
`vercel.json` maxDuration **60 mp**, és a discover ezen felül még normalizál is.
Élesben ezért `OPENAI_REASONING_EFFORT=low` kell, vagy magasabb maxDuration —
a kapcsoló beépítve, de a production deploy előtt dönteni kell róla. Ezt a
hatást a rács nem méri, mert a lokális futtató 240 mp-et enged.
