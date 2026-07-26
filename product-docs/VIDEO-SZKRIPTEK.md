# Oktatóvideó-szkriptek

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
| 0–8 | Avatar vagy JEL-logó, majd a `folyamatabra.html` teljes nézete | A JEL egy munkatér senior tech pozíciók kereséséhez. A nyers hiring manager-brieftől a rögzített válaszig vezet végig — és minden lépésnél nálad marad a döntés. |
| 8–22 | Zoom a „Belépés" sávra, majd egy megbízás-kártyára | Egy megbízás egy ügyfél egy konkrét pozíciója. Ha ugyanaz az ügyfél két pozíciót keres, az két megbízás — külön brieffel, külön jelöltekkel, külön eredménnyel. |
| 22–40 | Az 1. fázis-sáv, kártyák sorban kiemelve | Az első fázis arról szól, mit keresünk. Beilleszted a briefet, az elemzés javaslatot ad, te véglegesíted — és innentől a te változatod megy tovább. Erre épül a keresési terv és a jelöltkutatás. |
| 40–58 | A 2. fázis-sáv, majd a jelölt-tábla oszlopai | A második fázisban kiderül, kivel beszélünk. A rendszer prioritást javasol, megközelítési tervet ír, üzenetvázlatot ad — a tábla öt oszlopa pedig mindig megmutatja, hol tart egy jelölt. |
| 58–74 | Zoom a „Megközelítési terv" kártyára, a „tény / feltételezés" jelölésre | Ami a legfontosabb: a rendszer szétválasztja azt, amit a jelöltről forrásból tudunk, attól, amit csak feltételez. A megközelítési ötlet hipotézis, és ezt ki is mondja. |
| 74–90 | „Amit a rendszer tudatosan NEM csinál" blokk | Üzenetet nem küld — azt te teszed a saját csatornádon. Jelöltet nem utasít el automatikusan. És kitalált tényt nem állít: amit nem lehet forrásra visszavezetni, azt kiszűri. |
| 90–110 | A 3. fázis-sáv, majd az Eredmények nézet | A végén mérhető eredmény: hány megkeresés ment ki, hányan válaszoltak, és ebből hányan pozitívan — a saját korábbi számaidhoz mérve. Ennyi. A többit lépésenként mutatjuk meg. |

**Felirat-kiemelés:** „egy megbízás = egy ügyfél egy pozíciója" · „a te változatod megy tovább" · „a rendszer nem küld"

---

### V02 · Megbízás indítása és brief-elemzés
**~45 mp** · `pozicio.elemzes`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | „Új megbízás" gomb → 1/2 űrlap kitöltése (Northloop, Senior Platform Engineer) | Egy új megbízás két lépés. Először az alapadatok: a pozíció és az ügyfél kötelező, a többi kitölthető később. |
| 10–18 | Kurzor az „Ügyfél" mezőn, rövid megállás | Az ügyfél neve itt nem formalitás. Ez vezérli később a kizárási szabályt, és negatív szűrőként bekerül a keresési lekérdezésekbe. |
| 18–28 | 2/2 lépés: a fixture-brief beillesztése → „Megbízás létrehozása" → „Brief elemzése" | Utána jön a nyers brief — pontosan úgy, ahogy a hiring managertől kaptad. Nem kell tisztítani. |
| 28–45 | Az elemzés kimenete: tisztázandó pontok és feltételezett igények blokk | Az elemzés szétszedi: elengedhetetlen feltételek, előnyök, tisztázandó pontok, feltételezett igények. A tisztázandó pont a hiring managernek szóló kérdés — ellentmondás vagy hiány a briefben. A feltételezett igény viszont a rendszer saját találgatása, ezt neked kell ellenőrizned. |

**Felirat-kiemelés:** „az ügyfél neve vezérli a kizárást" · „tisztázandó pont ≠ feltételezett igény"

---

### V03 · A véglegesített brief
**~45 mp** · `pozicio.veglegesites` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | A „Véglegesített brief" kártya, „Vázlat — még nincs véglegesítve" státusszal | Az elemzés eredménye javaslat. A véglegesített brief viszont a tiéd — és ez az, ami továbbmegy. |
| 10–22 | Szerkesztés a szövegmezőben: egy mondat átírása; egy must-have chip törlése, egy hozzáadása | Írd át a szöveget, vegyél el feltételt, tegyél hozzá. Az AI eredeti javaslata alatta megmarad, ha össze akarod hasonlítani. |
| 22–34 | „Véglegesítés és jóváhagyás" → a státusz átvált, megjelenik a „szerkesztve" jelölés | Amikor jóváhagyod, ez lesz a hivatkozási alap. Erre épül a keresési terv, a megkeresések és az ügyfél-egyeztetés — nem az AI eredeti kimenetére. |
| 34–45 | Vissza az Áttekintésre, ahol a véglegesített brief jelenik meg | Itt válik el a javaslat a döntéstől. A rendszernek lehet határozott véleménye — a felelősség attól még a tiéd marad. |

**Felirat-kiemelés:** „a te változatod megy tovább" · „javaslat ≠ döntés"

---

### V04 · Keresési terv
**~50 mp** · `celpiac.terv` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Célpiac nézet, ① TERV kártya → „Keresési terv készítése" | A keresési terv adja a kutatás alapját: célpozíciók, célcégek, kulcs-szinonimák és a lekérdezések, amikkel a rendszer keres. |
| 10–24 | Célpozíciókhoz hozzáadás, célcégek közül egy törlése | Minden kategóriához adhatsz hozzá, és bármit elvehetsz. Ez nem végleges kimenet, hanem közös munkadarab. |
| 24–38 | „Keresési terv frissítése" → a kézi elem megmarad, a törölt nem jön vissza | És itt jön a lényeg: a frissítés egyesít, nem töröl. A kézzel felvett elemeid megmaradnak — amit pedig kivettél, azt a rendszer megjegyzi, és nem hozza vissza csendben. |
| 38–50 | A „Keresési lekérdezések" blokk lenyitása | A tényleges lekérdezések is szerkeszthetők. Ha tiszta lapot akarsz, arra van az „Új terv nulláról" — az viszont mindent elvet, és rá is kérdez. |

**Felirat-kiemelés:** „a frissítés egyesít, nem töröl" · „a kézi törlést megjegyzi"

---

### V05 · Célpiac-térkép
**~30 mp** · `celpiac.terkep`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | ② TÉRKÉP kártya → „Célpiac-térkép készítése" | A keresési terv azt mondja meg, hogyan keresünk. A célpiac-térkép azt, hogy hol. |
| 10–22 | A célcég-lista indoklásokkal, klaszterek, közösségek | Célcégek indoklással és valószínű szerepekkel, versenytárs-klaszterek, és hogy hol találkoznak ezek az emberek — közösségek, konferenciák. Kézzel is felvehetsz céget. |
| 22–30 | Váltás az Áttekintésre, a „Célcég-lefedettség" sorra | A térkép később is dolgozik: ebből számolja a rendszer, hány célcéget érintett már a merítésed. |

---

### V06 · Kizárás a merítésből
**~50 mp** · `celpiac.kizaras` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Jelöltek nézet a kutatás után, a „…jelölt nem került a listára" sáv | A merítésből automatikusan kimaradnak azok, akiket a hiring manager amúgy is ismer: az ügyfél jelenlegi és volt munkatársai. |
| 10–24 | A „Kizárva a merítésből" sáv kinyitása — **Deák Zsófia**, **Rácz Ábel**, **Halász Petra** sorai, az indoklásokkal | Itt van mind a három eset. Aki most a Northloopnál dolgozik. Aki korábban ott dolgozott. És aki a Northloop Technologiesnál — a cégnév-egyezés a leányvállalati és rövidített alakokat is felismeri. |
| 24–36 | Kurzor a „Mégis bevonom" gombon, majd kattintás, a jelölt visszakerül | És ami legalább ennyire fontos: a kizárás nem törlés. A találat megmarad, indoklással, és egy kattintással visszahozod. |
| 36–50 | Célpiac nézet, kizárás-kártya: off-limits cég hozzáadása, alumni-kapcsoló | A szabályokat itt állítod: felvehetsz további off-limits cégeket, megadhatod az ügyfél más cégneveit, és ha szándékosan visszacsábítanátok volt munkatársakat, egy kapcsolóval visszaengeded az alumnikat. |

**Felirat-kiemelés:** „a kizárás nem törlés" · „egy kattintással visszahozható"

---

### V07 · Stratégia-asszisztens
**~50 mp** · `celpiac.asszisztens`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | A Stratégia-asszisztens szekció, a „Rendszer-prompt" blokk lenyitva | Ez nem általános chat. Egyetlen dolgot csinál: szerkeszti a keresési tervet és a célpiac-térképet. A rendszer-promptja megnyitható — ott látod, mit tud és mit nem. |
| 10–24 | Utasítás beírása: „Adj hozzá a célpozíciókhoz: Head of Platform" → a művelet-chip megjelenik | Ha utasítasz, végrehajtja, és tételesen visszajelzi, mit tett. |
| 24–36 | „↺ Visszavonás" kattintás, a módosítás visszaáll | Minden lépés visszavonható. Nem kell megbíznod benne ahhoz, hogy használd. |
| 36–50 | Kérdés beírása: „Milyen célcégeket javasolsz még?" → javaslat-chipek, egy alkalmazása | Ha kérdezel, magától nem nyúl semmihez: javaslatokat ad, és te alkalmazod őket egyenként. Jelöltet nem értékel és üzenetet nem ír — arra átirányít. |

**Felirat-kiemelés:** „minden módosítás visszavonható" · „kérdésre javasol, nem csinál"

---

### V08 · Jelöltkutatás és adatforrás
**~55 mp** · `celpiac.kutatas` + `celpiac.forras` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | ③ KUTATÁS kártya, a forrás-választó lenyitva | A kutatás a keresési terv webes lekérdezéseivel dolgozik. Előbb terv kell — addig a gomb inaktív. |
| 10–24 | A három forrás-opció végigmutatása | Három forrás közül választhatsz. Az élő valódi keresés a nyilvános weben, jellemzően húsz-negyven másodperc. A mintaadatok egy tizennégy fős készlet — nem valós személyek, bemutatóhoz. Az automatikus élőt használ, ha van hozzá kulcs. |
| 24–38 | Futtatás → a találati lista, egy jelölt megnyitása a jelek és a forrás-link mutatásával | A találatokból normalizált jelölt-rekord lesz: jelek, forrás-hivatkozás, és GDPR-státusz. Minden állításnál látod, honnan jön. |
| 38–55 | Vissza a listára, egy LinkedIn-forrású találat mellett megállás | Egy dolgot fontos tudni: nincs belépett LinkedIn-scraping. A LinkedIn-találatok a keresőből jönnek, a profil-oldal bejelentkezés mögött van — onnan csak a kereső-kivonat marad. A valódi mélységet a szabadon elérhető források adják: GitHub, cég-oldalak, konferencia-biók, blogok. |

**Felirat-kiemelés:** „nincs belépett LinkedIn-scraping" · „az ismételt futtatás hozzáad, nem ír felül"

---

### V09 · Prioritás és a jelölt-tábla
**~55 mp** · `jeloltek.prioritas` + `jeloltek.tabla` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | „Prioritási javaslat készítése" → a tábla feltöltődik A/B/C/D szerint | A rendszer prioritást javasol: A — elsőként keresd meg, B — következő kör, C — figyelőlista, D — most nem javasolt. Mindegyik mellett rövid indoklás. |
| 12–26 | Görgetés a Figyelőlista sávra, egy D-jelölt indoklásának mutatása | A gyenge jelölt nem tűnik el. Megkapja a D-t, indoklással, és a figyelőlistán marad. Ez szándékos: ha valaki némán kiesne, a lista nem lenne elszámoltatható. |
| 26–38 | Prioritás átállítása a kártyán A-ról B-re, a „kézzel" jelölés megjelenése | A javaslatot bármikor felülírod. A te beállításod győz, és a felület jelzi, hogy kézzel állítottad. |
| 38–55 | Vízszintes végigmutatás az öt oszlopon, majd zoom egy kártya aljára | A tábla öt oszlopa maga a folyamat: rangsorolatlan, előkészítés, jóváhagyás és küldés, kiküldve, válaszolt. Egy jelölt mindig pontosan egy oszlopban van, és a kártya alján ott a következő lépése. |

**Felirat-kiemelés:** „senki nem esik ki némán" · „a te beállításod győz"

---

### V10 · Megközelítési terv — tény és feltételezés
**~60 mp** · `jelolt.megkozelites` · **P0 — ez a legfontosabb videó**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–10 | Jelöltpanel → Megközelítés fül → „Megközelítési terv készítése" | Ez a videó arról szól, amit a felület magától nehezen mond el: hogy a rendszer szétválasztja a tényt a feltételezéstől. |
| 10–26 | Az „Amit tudunk" blokk, zoom egy tényre és a mellette lévő jel-hivatkozásra | Az első rész az, amit a jelöltről biztosan tudunk. Minden állítás mellett ott a jel, amiből származik. Ha nincs mellette forrás, nem kerül ide. |
| 26–36 | Az „Amit nem tudunk" lista és a bizonyosság-jelzés | Alatta pedig az, amit nem tudunk: a motivációja, a fizetése, hogy elégedett-e most. Ezt a rendszer nem találja ki. |
| 36–52 | A „Megközelítési javaslat" blokk, az „Ellenőrizendő feltételezés" címkén megállás, majd a nyitómondat-ötlet | A második rész három megközelítési ötlet, rangsorolva — a legerősebb konkrét nyitómondat-javaslattal. Ezek szükségszerűen feltételezések: a jelölt motivációját nem ismerjük. A rendszer ezt kimondja, nem álcázza magabiztos állításnak. |
| 52–60 | A „nem-visszavezethető állítás kiszűrve" sor, ha látszik; különben a „Kerülendő megközelítések" blokk | És ha az elemzés mégis írna olyan tényt, amit nem lehet a jelölt jeleire visszavezetni, azt egy ellenőrzés utólag kiszedi — és megmondja, hányat dobott. |

**Felirat-kiemelés:** „minden tény mellett ott a forrás" · „a megközelítés hipotézis — és ezt ki is mondja"

---

### V11 · Üzenetvázlat és kiküldés
**~50 mp** · `jelolt.uzenet` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Üzenet fül → „Üzenetvázlat készítése" → a kész vázlat, zoom az első mondatra | A megközelítési tervből személyre szabott üzenetvázlat lesz. Az első mondat a jelölt saját munkájához kapcsolódik — ez az, ami elválasztja a sablonlevéltől. |
| 12–24 | Szerkesztés a szövegmezőben → „Jóváhagyva ✓" | Szerkeszd szabadon, aztán hagyd jóvá. Így később is látod, melyik vázlat ment át ellenőrzésen. |
| 24–38 | „Másolás" → váltás egy e-mail-ablakra (vagy csak a gombra zoom) → vissza → „Kiküldés rögzítése" | Aztán kimásolod, és a saját csatornádon küldöd el. **A rendszer soha nem küld semmit.** Itt csak rögzíted, hogy kiment. |
| 38–50 | A válasz-gombok: pozitív / semleges / negatív, egy megjelölése | Amikor megjön a válasz, itt jelölöd — pozitív, semleges vagy negatív. Ebből épülnek később az eredmények, és az első pozitív válasz nyitja meg az interjútervet. |

**Felirat-kiemelés:** „a rendszer soha nem küld" · „a kiküldés a te csatornádon"

---

### V12 · GDPR Art. 14 értesítő
**~35 mp** · `jelolt.art14` · **P0**

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Üzenet fül alja → „GDPR Art. 14 értesítő" gomb → a generált sablon | Ha publikus forrásból kutatsz jelöltet, adatkezelővé válsz. A GDPR tizennegyedik cikke ilyenkor tájékoztatási kötelezettséget ír elő. |
| 12–24 | Görgetés a sablonon: adatkezelő, adatok forrása, jogalap, jogok | A sablon végigmegy a kötelező pontokon: ki az adatkezelő, milyen adatot kezel, honnan szerezte, milyen célból és milyen jogalapon, és milyen jogai vannak az érintettnek. |
| 24–35 | A jelölt profilján a `pending_notice` státusz | A cégadatokat és az érdekmérlegelést neked kell kitöltened, és skálázás előtt jogásszal átnézetni — ez sablon, nem jogi tanács. A határidő a megszerzéstől számított egy hónap, vagy az első kapcsolatfelvétel. |

**Felirat-kiemelés:** „sablon, nem jogi tanács" · „1 hónap vagy az első kapcsolatfelvétel"

---

### V13 · Eredmények
**~40 mp** · `eredmenyek.mutatok`

| mp | Képernyőn | Narráció |
|---|---|---|
| 0–12 | Eredmények nézet, a három felső mutató | Három szám: hány megkeresés ment ki, hányan válaszoltak, és ebből hányan pozitívan. |
| 12–24 | Zoom a „Pozitív válaszok aránya" kártyára | A válaszarány és a pozitív arány szándékosan külön mutató. Az elutasítás is válasz — ami számít, hány beszélgetés indul el. |
| 24–40 | A „Korábbi kézi válaszarány" mező kitöltése → az eltérés megjelenik; majd a „Shortlist kész" gomb | Ha megadod a saját korábbi válaszarányodat, a rendszer ehhez méri magát, és kiírja az eltérést. Minden szám a te rögzítéseidből épül: a rendszer nem küld, tehát kitalált számot sem mutat. |

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
