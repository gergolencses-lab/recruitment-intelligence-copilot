# Oktatóvideó-szkriptek — javított narráció

> Forrás: [`FOLYAMAT.md`](./FOLYAMAT.md) lépés-szövegei, a [`HELP-FAQ-TERV.md`](./HELP-FAQ-TERV.md) súgó-horgonyaihoz kötve.
> Gyártás: képernyőfelvétel + ElevenLabs (ElevenCreative Studio). **Az ElevenLabs nem vesz fel képernyőt** — a felvétel a te géped dolga, az ElevenLabs a hangot, a feliratot és a lokalizációt adja hozzá.

**Időzítés-alap:** nyugodt magyar oktató-tempó ≈ **2,3 szó/másodperc**. A szkriptek ehhez vannak szabva; ha az ElevenLabs hosszabbra generálja, a Studio idővonalán a képet nyújtod, nem a szöveget vágod.

---

## 1. A videó-készlet

13 videó, összesen ~10,5 perc. Mindegyik önmagában is megáll — nem sorozat, hanem súgó-tartalom.

| ID | Cím | Hossz | Súgó-horgony | Prio |
|---|---|---|---|---|
| **V01** | Mi ez és hogyan működik — áttekintő | ~110 mp | — (nyitóoldal) | P0 |
| **V02** | Megbízás indítása és brief-elemzés | ~45 mp | `pozicio.elemzes` | P2 |
| **V03** | A véglegesített brief | ~45 mp | `pozicio.veglegesites` | **P0** |
| **V04** | Keresési terv | ~50 mp | `celpiac.terv` | **P0** |
| **V05** | Célpiac-térkép | ~30 mp | `celpiac.terkep` | P2 |
| **V06** | Kizárás a merítésből | ~50 mp | `celpiac.kizaras` | **P0** |
| **V07** | Stratégia-asszisztens | ~50 mp | `celpiac.asszisztens` | P1 |
| **V08** | Jelöltkutatás és adatforrás | ~55 mp | `celpiac.kutatas` + `celpiac.forras` | **P0** |
| **V09** | Prioritás és a jelölt-tábla | ~55 mp | `jeloltek.prioritas` + `jeloltek.tabla` | **P0** |
| **V10** | Megközelítési terv — tény és feltételezés | ~60 mp | `jelolt.megkozelites` | **P0** |
| **V11** | Üzenetvázlat és kiküldés | ~50 mp | `jelolt.uzenet` | **P0** |
| **V12** | GDPR Art. 14 értesítő | ~35 mp | `jelolt.art14` | **P0** |
| **V13** | Eredmények | ~40 mp | `eredmenyek.mutatok` | P1 |

**Ha csak hármat csinálsz:** V01, V10, V11. Az áttekintő megadja a keretet, a másik kettő azt a két dolgot magyarázza el, amit a felület magától nem tud: hogy a megközelítés feltételezés, és hogy a rendszer nem küld.

---

## 2. Felvételi előkészület

### Demó-megbízás

Használd a repóban lévő fixture-t: **`test-briefs/01-platform-engineer-budapest-startup.md`**.

| Mező | Érték |
|---|---|
| Pozíció | Senior Platform Engineer |
| Ügyfél | **Northloop** |
| Helyszín | Budapest |
| Munkavégzés | hibrid |
| Tapasztalati szint | Senior |
| Felelős | (a saját neved) |

A brief a fixture „📋 A brief" szakaszának szövege. Ez azért jó demó, mert **homályos a seniority és ellentmondásos a brief** — az elemzés így valódi tisztázandó pontokat talál, nem üres listát ad.

**Adatforrás: `mintaadatok`.** Két okból: az élő kutatás 20-40 másodperc (felvételen halott idő), és a minta determinisztikus, tehát újravehető ugyanazzal az eredménnyel.

### Amit a mintakészlet garantál a V06-hoz

A kizárás-videó azért működik, mert a minta szándékosan tartalmaz három ügyfélhez kötődő találatot:

| Név | Helyzet | Mit demonstrál |
|---|---|---|
| **Deák Zsófia** | jelenleg a Northloopnál | jelenlegi munkatárs → kemény kizárás |
| **Rácz Ábel** | korábban a Northloopnál | alumni → puha kizárás, kapcsolóval feloldható |
| **Halász Petra** | „Northloop Technologies" | leányvállalati cégnév-alak felismerése |

Ezt a hármat név szerint mutasd meg — ettől lesz hihető, hogy a szabály tényleg működik.

### Képernyő

- **1920×1080**, böngésző teljes képernyőn, könyvjelzősáv **ki**, egyéb fül **ki**.
- Rendszer-értesítések **ki**. Kurzor-kiemelés **be** (Screen Studio / Loom).
- Zoomolj rá a releváns kártyára — 1080p-ben a 13px-es szövegek olvashatatlanok mobilon.
- **Ne legyen a képen:** valódi ügyfél- vagy jelöltnév, saját e-mail-cím, API-kulcs, a böngésző profilképe.
- A kattintás után **várj fél másodpercet**, mielőtt továbbmész — vágásnál kell a levegő.

---

## 3. ElevenLabs-munkamenet

### Lépés-videók (V02–V13)

1. **Studio** → `elevenlabs.io/app/studio` → **Upload** → húzd be a képernyőfelvételt (.mp4). Videófájlnál automatikusan a videó-elrendezés nyílik idővonallal.
2. Vagy a **Get started** sorból: **Add voiceover** — feltöltés → hang → felirat, egy varázslóban.
3. **Narráció:** illeszd be a szkript narráció-oszlopát a narráció-sávra. Mondatonként tudod időzíteni — ehhez van a szkriptekben másodperc-oszlop.
4. **Felirat:** **Add captions** vagy a felirat-sáv. Magyar oktatóvideónál a felirat **nem opcionális** — némán, telefonon nézik.
5. **Export:** videóként. **Vízjel van Free és Starter csomagon** — Creator-tól felfelé nincs.

### Áttekintő (V01)

Két út:

- **Avatar-változat:** [Avatars](https://elevenlabs.io/avatars) — válassz egy állandó arcot (vagy tölts fel sajátot), és ugyanezt használd minden későbbi nyitóvideóhoz. Előny: a terméknek lesz egy visszatérő „arca". Vágásban a beszélőfej kicsi képben, mellette a folyamatábra.
- **Arc nélküli változat:** csak narráció a `folyamatabra.html` fölött — kamerázd végig a fázis-sávokat, a lépés-kártyák nyíljanak ki menet közben. Gyorsabb, és a márkához közelebb áll.

### Hang és stílus

- **Modell:** Eleven v3 (kifejezőbb), magyar hang. Tempó: nyugodt, nem lelkes.
- **A hang legyen olyan, mint a termék szövegei:** tárgyszerű, magyarázó, nem lelkendező.
- **Kerülendő a narrációban:** „forradalmi", „egyszerűen zseniális", „mindössze egy kattintás", felkiáltójel, „ugye milyen egyszerű". Ha a felület szövege nem így beszél, a videó se beszéljen így.
- **Ami viszont kell:** minden videó mondja ki, hol a döntési pont — „ezt te hagyod jóvá", „ezt bármikor felülírhatod".

---

## 4. A szkriptek

Az `mp` oszlop **kumulatív** — ott tartson a videó, amikor az adott mondat elhangzik.

---

### V01 · Mi ez és hogyan működik — áttekintő
**~110 mp** · nyitóoldal, súgó-fiók teteje, onboarding-levél

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–8 | Avatar vagy JEL-logó, majd a `folyamatabra.html` teljes nézete | A JEL senior technológiai pozíciók keresését támogató toborzói munkatér. A folyamat minden szakmai döntése nálad marad. |
| 8–22 | Zoom a „Belépés" sávra, majd egy megbízás-kártyára | Egy megbízás mindig egy ügyfél egy konkrét pozíciójához tartozik. Ha ugyanaz az ügyfél két pozícióra keres embert, az két külön megbízás, saját brieffel, jelölti körrel és eredményekkel. |
| 22–40 | Az 1. fázis-sáv, kártyák sorban kiemelve | Az első szakaszban pontosítjuk, kit és milyen feladatra keresünk. Beilleszted a pozícióbriefet, a rendszer rendezett javaslatot készít, te pedig ellenőrzöd és jóváhagyod. A további munka már erre a változatra épül. |
| 40–58 | A 2. fázis-sáv, majd a jelölt-tábla oszlopai | A következő szakaszban összeáll a jelölti kör. A rendszer prioritást és kapcsolatfelvételi megközelítést javasol, majd üzenetvázlatot készít. A jelölti tábla közben mindig mutatja, hol tart az adott személy. |
| 58–74 | Zoom a „Megközelítési terv" kártyára, a „tény / feltételezés" jelölésre | Fontos különbség, hogy a rendszer elválasztja az ellenőrizhető jelöltinformációkat a lehetséges motivációkra vonatkozó feltételezésektől. A kapcsolatfelvételi ötlet ezért javaslat, nem biztos állítás. |
| 74–90 | „Amit a rendszer tudatosan NEM csinál" blokk | A rendszer nem küld üzenetet, és nem hoz végleges kiválasztási döntést. A kapcsolatfelvétel előtt mindent te ellenőrzöl. A jelöltre vonatkozó tényállításokat pedig a rendelkezésre álló szakmai jelekhez köti. |
| 90–110 | A 3. fázis-sáv, majd az Eredmények nézet | Az eredményeknél külön látod a kiküldött megkereséseket, az összes választ és a pozitív válaszokat. Ezeket a saját korábbi válaszadási arányoddal is összevetheted. A következő videókban minden lépést külön bemutatunk. |

**Felirat-kiemelés:** „egy megbízás = egy ügyfél egy pozíciója" · „az ellenőrzött változat megy tovább" · „a JEL nem küld üzenetet"

---

### V02 · Megbízás indítása és brief-elemzés
**~45 mp** · `pozicio.elemzes`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | „Új megbízás" gomb → 1/2 űrlap kitöltése (Northloop, Senior Platform Engineer) | Az új megbízás rögzítése két lépésből áll. Először add meg a pozíciót és az ügyfelet. A többi alapadat később is pótolható. |
| 10–18 | Kurzor az „Ügyfél" mezőn, rövid megállás | Az ügyfél neve a keresést is befolyásolja. A rendszer ennek alapján különíti el az ügyfélhez tartozó találatokat. |
| 18–28 | 2/2 lépés: a fixture-brief beillesztése → „Megbízás létrehozása" → „Brief elemzése" | Ezután illeszd be a pozícióbriefet úgy, ahogyan a szakmai vezetőtől megkaptad. Előzetesen nem kell átszerkesztened. |
| 28–45 | Az elemzés kimenete: tisztázandó pontok és feltételezett igények blokk | A rendszer külön rendezi a feltétlen elvárásokat, az előnyt jelentő tapasztalatokat, a tisztázandó kérdéseket és az ellenőrzendő feltételezéseket. A tisztázandó kérdéseket a szakmai vezetővel érdemes megbeszélni. A feltételezéseket pedig neked kell megerősítened vagy elvetned. |

**Felirat-kiemelés:** „az ügyfél neve pontosítja a keresést" · „tisztázandó kérdés ≠ feltételezés"

---

### V03 · A véglegesített brief
**~45 mp** · `pozicio.veglegesites` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | A „Véglegesített brief" kártya, „Vázlat — még nincs véglegesítve" státusszal | Az elemzés eredménye még csak javaslat. A véglegesített brief az általad ellenőrzött változat, és a további munka már erre épül. |
| 10–22 | Szerkesztés a szövegmezőben: egy mondat átírása; egy must-have chip törlése, egy hozzáadása | Módosíthatod a szöveget, törölhetsz egy feltételt, vagy újat adhatsz hozzá. A rendszer eredeti javaslata összehasonlításként továbbra is látható marad. |
| 22–34 | „Véglegesítés és jóváhagyás" → a státusz átvált, megjelenik a „szerkesztve" jelölés | A jóváhagyás után ez lesz a keresési stratégia, a kapcsolatfelvétel és az ügyfél-egyeztetés közös hivatkozási alapja. Nem a rendszer eredeti javaslata, hanem a te végleges változatod. |
| 34–45 | Vissza az Áttekintésre, ahol a véglegesített brief jelenik meg | Ezen a ponton válik el egyértelműen a rendszer javaslata és a toborzó szakmai döntése. A jóváhagyás és a felelősség nálad marad. |

**Felirat-kiemelés:** „az ellenőrzött változat megy tovább" · „javaslat ≠ döntés"

---

### V04 · Keresési terv
**~50 mp** · `celpiac.terv` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Célpiac nézet, ① TERV kártya → „Keresési terv készítése" | A keresési stratégia határozza meg a jelöltkutatás irányát: a célpozíciókat, a célcégeket, a kapcsolódó szakmai kifejezéseket és a keresések szövegét. |
| 10–24 | Célpozíciókhoz hozzáadás, célcégek közül egy törlése | Bármelyik listát kiegészítheted vagy szűkítheted. Ez egy közösen alakítható munkadokumentum, nem változtatás nélkül elfogadandó rendszerkimenet. |
| 24–38 | „Keresési terv frissítése" → a kézi elem megmarad, a törölt nem jön vissza | Frissítéskor a rendszer megtartja a kézzel hozzáadott elemeket. A korábban eltávolított javaslatokat sem teszi vissza automatikusan, így a saját módosításaid nem vesznek el. |
| 38–50 | A „Keresési lekérdezések" blokk lenyitása | Magukat a kereséseket is szerkesztheted. Az „Új terv nulláról" lehetőséggel teljesen új javaslatot kérhetsz. Mivel ez elveti a korábbi módosításokat, a rendszer előtte megerősítést kér. |

**Felirat-kiemelés:** „a saját módosításaid megmaradnak" · „új tervnél megerősítést kér"

---

### V05 · Célpiac-térkép
**~30 mp** · `celpiac.terkep`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | ② TÉRKÉP kártya → „Célpiac-térkép készítése" | A keresési stratégia azt határozza meg, hogyan keresünk. A célpiaci áttekintés pedig azt mutatja meg, hol érdemes keresnünk. |
| 10–22 | A célcég-lista indoklásokkal, klaszterek, közösségek | Megjelennek a javasolt célcégek, a náluk várható releváns szerepek, a kapcsolódó vállalatcsoportok, valamint a szakmai közösségek és rendezvények. A listát kézzel is kiegészítheted. |
| 22–30 | Váltás az Áttekintésre, a „Célcég-lefedettség" sorra | Később ehhez a listához viszonyítja a kutatást, és jelzi, mely célcégekből van találat, illetve hol maradt hiány. |

---

### V06 · Kizárás a merítésből
**~50 mp** · `celpiac.kizaras` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Jelöltek nézet a kutatás után, a „…jelölt nem került a listára" sáv | A rendszer külön kezeli az ügyfél jelenlegi és korábbi munkatársait, mert őket a szakmai vezető jellemzően már ismeri. |
| 10–24 | A „Kizárva a merítésből" sáv kinyitása — **Deák Zsófia**, **Rácz Ábel**, **Halász Petra** sorai, az indoklásokkal | A példában három eset látható: jelenlegi munkatárs, korábbi munkatárs, valamint az ügyfél egy kapcsolódó cégnév alatt szereplő munkatársa. Mindegyik mellett megjelenik a kizárás indoka. |
| 24–36 | Kurzor a „Mégis bevonom" gombon, majd kattintás, a jelölt visszakerül | A kizárás nem jelent törlést. A találat külön listán, indoklással együtt megmarad, és a „Mégis bevonom" lehetőséggel visszahelyezhető a jelölti körbe. |
| 36–50 | Célpiac nézet, kizárás-kártya: off-limits cég hozzáadása, alumni-kapcsoló | Itt további kizárt cégeket és alternatív ügyfélneveket is megadhatsz. Azt is beállíthatod, hogy az ügyfél korábbi munkatársai bekerülhetnek-e a keresésbe. |

**Felirat-kiemelés:** „a kizárás nem törlés" · „egy kattintással visszahozható"

---

### V07 · Stratégia-asszisztens
**~50 mp** · `celpiac.asszisztens`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | A Stratégia-asszisztens szekció, a „Rendszer-prompt" blokk lenyitva | A Stratégia-asszisztens kizárólag a keresési terv és a célpiaci áttekintés módosításában segít. A lenyitható leírásban pontosan látható, mire használható. |
| 10–24 | Utasítás beírása: „Adj hozzá a célpozíciókhoz: Head of Platform" → a művelet-chip megjelenik | Egyértelmű utasítás esetén elvégzi a módosítást, majd tételesen megmutatja, mit adott hozzá vagy mit távolított el. |
| 24–36 | „↺ Visszavonás" kattintás, a módosítás visszaáll | Minden változtatás külön látható és visszavonható. Így a keresési stratégia módosításai végig ellenőrizhetők maradnak. |
| 36–50 | Kérdés beírása: „Milyen célcégeket javasolsz még?" → javaslat-chipek, egy alkalmazása | Ha kérdést teszel fel, a rendszer nem módosít automatikusan. Javaslatokat ad, amelyeket egyenként fogadhatsz el. Jelöltértékelést vagy üzenetírást ezen a felületen nem végez. |

**Felirat-kiemelés:** „minden módosítás visszavonható" · „kérdésre javasol, nem módosít"

---

### V08 · Jelöltkutatás és adatforrás
**~55 mp** · `celpiac.kutatas` + `celpiac.forras` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | ③ KUTATÁS kártya, a forrás-választó lenyitva | A jelöltkutatás a jóváhagyott keresési stratégiára épül. Amíg ez nem készült el, a kutatás nem indítható. |
| 10–24 | A három forrás-opció végigmutatása | Három mód közül választhatsz. Az élő keresés nyilvános forrásokat vizsgál, és általában húsz-negyven másodpercig tart. A mintaadatok nem valós személyek, ezért bemutatóhoz valók. Automatikus módban a rendszer az elérhető beállítás alapján választ. |
| 24–38 | Futtatás → a találati lista, egy jelölt megnyitása a jelek és a forrás-link mutatásával | A találatokból egységes jelölti profil készül. Láthatók rajta az értékeléshez használható szakmai jelek, az eredeti forrás és az adatvédelmi tájékoztatás állapota. |
| 38–55 | Vissza a listára, egy LinkedIn-forrású találat mellett megállás | A rendszer nem lép be zárt LinkedIn-profilokba, és nem használ álprofilt. A LinkedInhez kapcsolódó találatokból csak a keresőben nyilvánosan megjelenő információt használja. Részletesebb adatokat más nyilvános szakmai forrásokból, például fejlesztői oldalakról, vállalati bemutatkozásokból, konferencia-életrajzokból és szakmai blogokból gyűjt. |

**Felirat-kiemelés:** „nincs hozzáférés zárt LinkedIn-profilokhoz" · „az új futtatás hozzáad, nem ír felül"

---

### V09 · Prioritás és a jelölt-tábla
**~55 mp** · `jeloltek.prioritas` + `jeloltek.tabla` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | „Prioritási javaslat készítése" → a tábla feltöltődik A/B/C/D szerint | A rendszer A, B, C vagy D prioritást javasol. Az A és B a megkeresési sorrendet, a C a figyelőlistát, a D a nem javasolt jelölteket jelöli. |
| 12–26 | Görgetés a Figyelőlista sávra, egy D-jelölt indoklásának mutatása | Az alacsonyabb prioritású jelölt sem tűnik el a listából. A D kategóriában, az indoklással együtt továbbra is látható marad. Így minden feldolgozott jelöltről ellenőrizhető javaslat készül. |
| 26–38 | Prioritás átállítása a kártyán A-ról B-re, a „kézzel" jelölés megjelenése | A javasolt prioritást bármikor felülírhatod. Az általad beállított érték lesz érvényes, a felület pedig külön jelzi a kézi módosítást. |
| 38–55 | Vízszintes végigmutatás az öt oszlopon, majd zoom egy kártya aljára | A jelölti tábla öt fő állapotot mutat: rangsorolatlan, előkészítés alatt, jóváhagyásra vár, megkeresve és válaszolt. Egy jelölt egyszerre egy oszlopban szerepel, a kártyáján pedig mindig látható a következő feladat. |

**Felirat-kiemelés:** „minden jelölt látható marad" · „a kézi beállítás az érvényes"

---

### V10 · Megközelítési terv — tény és feltételezés
**~60 mp** · `jelolt.megkozelites` · **P0 — ez a legfontosabb videó**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Jelöltpanel → Megközelítés fül → „Megközelítési terv készítése" | A kapcsolatfelvételi megközelítés kétféle információt választ szét: az ellenőrizhető tényeket és a beszélgetésben tesztelendő feltételezéseket. |
| 10–26 | Az „Amit tudunk" blokk, zoom egy tényre és a mellette lévő jel-hivatkozásra | Az első rész kizárólag a jelöltről rendelkezésre álló szakmai jelekre épül. Minden állítás mellett látható, melyik információ támasztja alá. |
| 26–36 | Az „Amit nem tudunk" lista és a bizonyosság-jelzés | Külön listán jelenik meg az is, amit a forrásokból nem tudunk, például a jelölt motivációja, fizetési igénye vagy jelenlegi elégedettsége. |
| 36–52 | A „Megközelítési javaslat" blokk, az „Ellenőrizendő feltételezés" címkén megállás, majd a nyitómondat-ötlet | Ezután három lehetséges kapcsolatfelvételi irány következik, fontossági sorrendben. A legerősebbhez konkrét nyitómondat-javaslat is tartozik. Ezek nem biztos állítások a jelöltről, hanem ellenőrzésre váró szakmai feltételezések. |
| 52–60 | A „nem-visszavezethető állítás kiszűrve" sor, ha látszik; különben a „Kerülendő megközelítések" blokk | Beépített ellenőrzés távolítja el a szakmai jellel nem alátámasztott tényállításokat. A felület jelzi, ha történt ilyen szűrés. |

**Felirat-kiemelés:** „minden tény mellett látható az alátámasztás" · „a megközelítés ellenőrzendő feltételezés"

---

### V11 · Üzenetvázlat és kiküldés
**~50 mp** · `jelolt.uzenet` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Üzenet fül → „Üzenetvázlat készítése" → a kész vázlat, zoom az első mondatra | A jóváhagyott megközelítésből személyre szabott üzenetvázlat készül. A nyitómondat a jelölt egy konkrét szakmai jeléhez kapcsolódik, ezért nem általános sablonként hat. |
| 12–24 | Szerkesztés a szövegmezőben → „Jóváhagyva ✓" | Az üzenetet elküldés előtt szabadon szerkesztheted. A jóváhagyás rögzítésével később is látható, melyik változat kapott szakmai ellenőrzést. |
| 24–38 | „Másolás" → váltás egy e-mail-ablakra (vagy csak a gombra zoom) → vissza → „Kiküldés rögzítése" | A jóváhagyott szöveget kimásolod, majd a saját e-mail- vagy közösségi csatornádon küldöd el. A JEL nem küld üzenetet. A felületen csak a megtörtént kapcsolatfelvételt rögzíted. |
| 38–50 | A válasz-gombok: pozitív / semleges / negatív, egy megjelölése | A jelölt válaszát pozitív, semleges vagy negatív eredménnyel rögzítheted. Ezekből az adatokból készülnek az eredménymutatók, és az első pozitív válasz után válik elérhetővé az interjúterv. |

**Felirat-kiemelés:** „a JEL nem küld üzenetet" · „a kiküldés a te csatornádon történik"

---

### V12 · GDPR Art. 14 értesítő
**~35 mp** · `jelolt.art14` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Üzenet fül alja → „GDPR Art. 14 értesítő" gomb → a generált sablon | Ha a szervezet nyilvános forrásból gyűjtött jelöltadatokat kezel kiválasztási célra, adatvédelmi kötelezettségei keletkeznek. Ezek közé tartozhat a GDPR tizennegyedik cikke szerinti tájékoztatás. |
| 12–24 | Görgetés a sablonon: adatkezelő, adatok forrása, jogalap, jogok | A szerkeszthető minta tartalmazza az adatkezelő adatait, a kezelt adatok körét és forrását, az adatkezelés célját és jogalapját, valamint az érintett jogaira vonatkozó tájékoztatást. |
| 24–35 | A jelölt profilján a `pending_notice` státusz | A minta nem jogi tanács. A tájékoztatást főszabály szerint legkésőbb egy hónapon belül kell megadni. Korábbi kapcsolatfelvételnél a határidő az első kommunikáció időpontja. |

**Felirat-kiemelés:** „minta, nem jogi tanács" · „egy hónapon belül, vagy az első kommunikációkor"

---

### V13 · Eredmények
**~40 mp** · `eredmenyek.mutatok`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Eredmények nézet, a három felső mutató | Az eredményeknél három alapadat látható: a kiküldött megkeresések száma, a válaszadási arány és a pozitív válaszok aránya. |
| 12–24 | Zoom a „Pozitív válaszok aránya" kártyára | A válaszadási arány és a pozitív válaszok aránya külön mutató. Az elutasítás is válasznak számít, ezért a két érték együtt mutatja meg, hány érdemi beszélgetés indult el. |
| 24–40 | A „Korábbi kézi válaszarány" mező kitöltése → az eltérés megjelenik; majd a „Shortlist kész" gomb | Ha megadod a korábbi, kézi keresések válaszadási arányát, a felület összehasonlítja vele az aktuális eredményt. Minden mutató az általad rögzített kiküldésekből és válaszokból készül. |

**Felirat-kiemelés:** „az elutasítás is válasz" · „minden szám a te rögzítéseidből"

---

## 5. Angol verzió

Ne írj új szkriptet. A magyar videó kész, azt **duplikálod**:

1. Studio → **Get started** → **Create dub** → töltsd fel a kész magyar videót.
2. Forrásnyelv magyar, célnyelv angol, felirat bekapcsolva.
3. **Nézd át a szakszavakat.** A dubbing a „megbízás", „merítés", „megkeresés" és „jel" szavakat könnyen félrefordítja. A helyes megfelelők: *engagement*, *candidate pool*, *outreach*, *signal*.

Ha a szóhasználat nem stimmel, a dubbing helyett generáld újra a narrációt angol szkripttel a Studio narráció-sávján — a képet nem kell újravenni.

---

## 6. Hova kerülnek a videók

| Hol | Melyik |
|---|---|
| Súgó-popover lábléce | a horgonyhoz tartozó lépés-videó (`▶ Videó — 45 mp`) |
| GYIK-fiók teteje | V01 |
| README és `folyamatabra.html` | V01 |
| Onboarding-levél új felhasználónak | V01 + V03 + V10 |

**Beágyazás:** a videó ne a popoverben induljon el — a popover kicsi. A `▶` link nyisson új fülön egy videó-oldalt, vagy a `#faqDrawer`-ben egy nagyobb lejátszót. A súgó-popover szövege maradjon önmagában is teljes: a videó kiegészítés, nem helyettesítés.

---

## 7. Karbantartás

Ha egy lépés viselkedése változik, a sorrend: **`FOLYAMAT.md` → `HELP-FAQ-TERV.md` → itt a szkript → újrafelvétel.**

A képernyőfelvétel a legdrágább elem, ezért érdemes rövid, egy-témájú videókat tartani: egy felület-átalakítás így egy 45 másodperces klipet érvénytelenít, nem egy tízperceset.
