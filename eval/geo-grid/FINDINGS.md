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

## Nyitott pont

Az r2 **minőségi** kapui (G2/G4/G5) nincsenek leértékelve: az Anthropic-kulcs
elérte a beállított költségkeretét (`You will regain access on 2026-09-01`), így
6 cella nem futott le, és a bíró sem tudott lefutni. A fenti r2-állítások ezért
kizárólag determinisztikus mérésekre és a nyers kimenetek kézi olvasására
támaszkodnak — **r2-re pontszám nincs kimondva**.
