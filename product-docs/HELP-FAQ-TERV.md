# Súgó és GYIK — terv

> Mire épül: [`FOLYAMAT.md`](./FOLYAMAT.md) (a folyamat igazság-forrása). Ez a dokumentum azt írja le, **hogyan kerül ebből súgó a felületre** — hol, milyen interakcióval, milyen szöveggel, és hogyan épül fel a GYIK.
> A 4. és 5. fejezet szövegei **másolásra készek**: egy az egyben átemelhetők a kódba.

---

## 1. Alapelvek

1. **Kérésre, nem tolakodva.** Semmi nem nyílik ki magától. Nincs bevezető túra, nincs coach mark, nincs „új!” pötty. Aki tudja, mit csinál, ne lássa a súgót.
2. **Nem minden tile-ra.** Súgó oda kerül, ahol a felirat nem mondja el a lényeget: **döntési szabályok**, **hatókör-korlátok**, **jogi következmény**, **nem nyilvánvaló mellékhatás**. Ahol a gomb felirata a teljes igazság („Export”, „Másolás”), ott nincs `?`.
3. **Két hosszúság.** A `?` egy rövid, helyben olvasható panelt nyit (kb. 60-90 szó). Aki többet akar, egy kattintással a GYIK megfelelő szekciójában landol.
4. **Nem blokkol.** A súgó-panel nem modális: mögötte látszik a képernyő, amiről szól. Kattints mellé vagy Esc, és eltűnik.
5. **Egy igazság-forrás.** A szövegek egyetlen `HELP` regiszterben élnek, nem a markupban szétszórva. Ha egy lépés viselkedése változik, egy helyen kell átírni.
6. **Ugyanaz a hang, mint a terméké.** Tárgyszerű, magyar üzleti nyelv. A súgó nem magyaráz mentegetőzve és nem ad el.

---

## 2. Interakciós modell

### 2.1 Az affordancia

Egy 15px-es, körbe zárt `?` közvetlenül a szekció- vagy kártyacím **után**, ugyanabban a sorban.
Alap: `--mut` színű, 1px kerettel. Hover/fókusz: menta keret + `--accent-ink` szöveg. Nyitva: menta kitöltés.
Sosem hangsúlyosabb, mint maga a cím.

```
Keresési terv ⟨?⟩   AI-javaslat — szerkeszthető
────────────────────────────────────────────────
```

### 2.2 Megnyitás és bezárás

| Esemény | Viselkedés |
|---|---|
| kattintás a `?`-re | popover nyílik a gomb alatt, balra igazítva; ha nem fér le, fölé kerül |
| másik `?` | az előző bezárul, az új nyílik (egyszerre egy) |
| kattintás a panelen kívülre | bezár |
| `Esc` | bezár, a fókusz visszaáll a `?`-re |
| görgetés / nézetváltás | bezár |
| `<900px` képernyő | ugyanaz a tartalom **alsó lapként** nyílik (a meglévő `#moreSheet` mintája) |

Fókuszkezelés: a panel megnyitásakor a fókusz a panel címére kerül, `role="dialog"` + `aria-labelledby`. A `?` gomb `aria-expanded` állapotot tart.

### 2.3 A panel felépítése

```
┌──────────────────────────────────────────┐
│ Keresési terv                         ✕ │   ← cím
├──────────────────────────────────────────┤
│ Ez adja a kutatás alapját: célpozíciók,  │   ← MI EZ (1-2 mondat)
│ célcégek, szinonimák és a lekérdezések.  │
│                                          │
│ • Minden kategóriához adhatsz hozzá…     │   ← HOGYAN HASZNÁLD (2-4 pont)
│ • A frissítés egyesít, nem töröl.        │
│                                          │
│ ⓘ A kézzel kivett elemeket megjegyzi:    │   ← MIÉRT ÍGY (opcionális,
│   az újragenerálás nem hozza vissza.     │      csak a nem nyilvánvalókra)
├──────────────────────────────────────────┤
│ Minden kérdés a kutatásról →             │   ← GYIK-horgony
└──────────────────────────────────────────┘
```

A „Miért így” blokk az, ami **eladja a terméket**: ott mondjuk el, hogy egy döntés szándékos, nem véletlen. Csak ott jelenjen meg, ahol tényleg van mit megvédeni — ha minden panelen ott van, elveszti a súlyát.

---

## 3. Hol legyen súgó — és hol ne

### 3.1 Ahol legyen

Prioritással, hogy fázisokban is bevezethető legyen. **P0 = e nélkül a felület félreérthető.**

| # | Horgony-ID | Hol (elem) | Prio | Miért kell |
|---|---|---|---|---|
| 1 | `pozicio.veglegesites` | „Véglegesített brief” kártyacím | **P0** | itt válik el a javaslat a döntéstől — a legfontosabb, és a legkevésbé nyilvánvaló |
| 2 | `celpiac.terv` | „Keresési terv” kártyacím | **P0** | a szerkeszthetőség és az egyesítő frissítés nem látszik |
| 3 | `celpiac.kutatas` | ③ KUTATÁS lépés-kártya | **P0** | mit scrapel és mit nem — jogi és elvárás-kérdés |
| 4 | `celpiac.kizaras` | „Kizárás a merítésből” kártyacím | **P0** | jelöltek „tűnnek el” — magyarázat nélkül hibának látszik |
| 5 | `jeloltek.prioritas` | prioritási javaslat gomb melletti sor | **P0** | mit jelent A/B/C/D, és hogy felülírható |
| 6 | `jelolt.megkozelites` | „Megközelítési terv” panel-cím | **P0** | a tény/feltételezés szétválasztás a termék lényege |
| 7 | `jelolt.uzenet` | „Üzenetvázlat” panel-cím | **P0** | „küld-e a rendszer?” — a leggyakoribb félreértés |
| 8 | `jelolt.art14` | „GDPR Art. 14 értesítő” gomb | **P0** | jogi kötelezettség, nem opcionális extra |
| 9 | `attekintes.next` | „Következő teendő” blokk | P1 | honnan jön a javaslat, és hogy nem kényszerít |
| 10 | `attekintes.lefedettseg` | „Keresési lefedettség” kártyacím | P1 | a 70%-os küszöb és a célcég-lefedettség nem magától értetődő |
| 11 | `celpiac.asszisztens` | „Stratégia-asszisztens” szekciócím | P1 | hatókör-korlát: mit tud és mit nem |
| 12 | `celpiac.forras` | forrás-választó (`auto / élő / minta`) | P1 | mikor melyiket, és miért lassabb az élő |
| 13 | `jeloltek.tabla` | Jelöltek szekciócím | P1 | mit jelent az öt oszlop és a két sáv |
| 14 | `interju.zar` | interjúterv zárolási sáv | P1 | miért zárt, és mi oldja fel |
| 15 | `eredmenyek.mutatok` | „Eredmények” szekciócím | P1 | miért külön a pozitív arány, honnan jönnek a számok |
| 16 | `pozicio.elemzes` | „Brief” kártyacím | P2 | mit ad vissza az elemzés |
| 17 | `celpiac.terkep` | ② TÉRKÉP lépés-kártya | P2 | terv vs. térkép különbsége |
| 18 | `jelolt.profil` | „Profil összegzése” blokkcím | P2 | mit jelent a „nem fit”, és hogy nem automatikus elutasítás |
| 19 | `global.mod` | módjelző badge-ek (oldalsáv + fejléc) | P2 | AI elérhető / Bemutató mód, élő / minta |
| 20 | `global.tarolas` | oldalsáv lábléc szövege | P2 | hol vannak az adataim, mi veszhet el |

### 3.2 Ahol tudatosan ne legyen

| Elem | Miért nem |
|---|---|
| Pozícióadatok mezői | a címke a teljes magyarázat |
| Export gomb | a felirat elmondja |
| Státusz-választó | önmagát magyarázza |
| Napló / jegyzet mezők | triviális |
| Szűrő-pillek, kereső | azonnali visszajelzés van rá |
| Új megbízás űrlap | már van rajta segédszöveg (`step-note`) |
| Ügyfél-egyeztetés | a `stage-sub` alcím már pontosan ezt mondja el |

**Szabály a jövőre:** ha egy tile-hoz súgó kell, először azt kérdezd meg, nem a **felirat** rossz-e. A `?` nem pótolja a rossz címkét.

---

## 4. Súgó-tartalom — másolásra kész

Adatszerkezet (egyetlen objektum a frontendben):

```js
const HELP = {
  "<horgony-id>": {
    title: "…",          // a panel címe
    what:  "…",          // 1-2 mondat: mit csinál ez
    how:   ["…", "…"],   // 2-4 pont: hogyan használd
    why:   "…",          // opcionális: miért így működik
    faq:   "<szekció>",  // GYIK-horgony a lábléchez
  },
};
```

### P0 — az első körben

**`pozicio.veglegesites` — Véglegesített brief**
- **what:** Az AI-javaslatból indul, de a te szerkesztett változatod az, ami továbbmegy a keresésbe, a megkeresésekbe és az ügyfél-egyeztetésbe.
- **how:**
  - Írd át a szöveget és a két feltétel-listát szabadon.
  - A „Véglegesítés és jóváhagyás” rögzíti — innentől ez a hivatkozási alap.
  - Az AI eredeti javaslata alatta megmarad, összehasonlításra.
- **why:** Itt válik el a javaslat a döntéstől. A rendszernek lehet határozott véleménye, de a felelősség és az utolsó szó a tiéd.
- **faq:** `brief`

**`celpiac.terv` — Keresési terv**
- **what:** Ez adja a kutatás alapját: célpozíciók, célcégek, kulcs-szinonimák és a lekérdezések, amikkel a rendszer keres.
- **how:**
  - Minden kategóriához adhatsz hozzá és vehetsz el belőle.
  - A „frissítés” egyesít: a kézzel felvett elemeid megmaradnak.
  - Az „Új terv nulláról” viszont mindent elvet — ezt kérdezi is.
- **why:** Amit kézzel kivettél, azt a rendszer megjegyzi, és egy újragenerálás nem hozza vissza csendben.
- **faq:** `kutatas`

**`celpiac.kutatas` — Jelöltkutatás**
- **what:** A terv webes lekérdezéseivel keres a nyilvános weben, majd a ténylegesen elérhető oldalakat mélyebben kiolvassa, és jelölt-rekordokká alakítja — jelekkel és forrás-hivatkozással.
- **how:**
  - Előbb keresési terv kell; a gomb addig inaktív.
  - Az ismételt futtatás nem írja felül a listát: hozzáad, „Új” jelöléssel.
  - A névre egyező duplikátumok kimaradnak.
- **why:** Nincs belépett LinkedIn-scraping. A LinkedIn-találatok a keresőből jönnek, a profil auth-fal mögött van — a mélységet a GitHub, cég-oldalak, konferencia-biók és blogok adják.
- **faq:** `kutatas`

**`celpiac.kizaras` — Kizárás a merítésből**
- **what:** Az ügyfél jelenlegi és volt munkatársai nem kerülnek a jelöltlistára — őket a hiring manager amúgy is ismeri.
- **how:**
  - A cégnév-egyezés a rövidített és leányvállalati alakokat is felismeri.
  - Vehetsz fel további off-limits cégeket és az ügyfél más cégneveit.
  - Az alumnikat egy kapcsolóval visszaengedheted a listára.
- **why:** A kizárás nem törlés: a találat megmarad indoklással, külön sávon, és egy kattintással visszahozható.
- **faq:** `kizaras`

**`jeloltek.prioritas` — Prioritási javaslat**
- **what:** Javaslat arra, kivel érdemes először felvenni a kapcsolatot: A — elsőként, B — következő kör, C — figyelőlista, D — most nem javasolt.
- **how:**
  - A prioritást bármelyik jelöltnél felülírhatod; a te beállításod győz.
  - A C és D jelöltek a Figyelőlista sávba kerülnek, nem tűnnek el.
  - Új jelöltek után futtasd újra.
- **why:** Minden jelölt megjelenik a rangsorban, akkor is, ha a javaslat elutasító. A gyenge jelölt nem esik ki némán — indoklással kap D-t.
- **faq:** `jeloltek`

**`jelolt.megkozelites` — Megközelítési terv**
- **what:** Két élesen elválasztott rész: amit a jelöltről a jeleiből **biztosan tudunk**, és három **feltételezésen alapuló** megközelítési ötlet, rangsorolva.
- **how:**
  - Az „Amit tudunk” minden állítása mellett ott a jel, amiből ered.
  - A legerősebb ötlet nyitómondat-javaslattal jön; kettő röviden.
  - Nézd meg a „Kerülendő megközelítések” blokkot is.
- **why:** A jelölt motivációit nem ismerjük, tehát a megközelítés hipotézis — ezt a rendszer kimondja. Amit nem lehet a jelöltek jeleire visszavezetni, azt automatikusan kiszűri, és jelzi, hányat dobott.
- **faq:** `megkereses`

**`jelolt.uzenet` — Üzenetvázlat**
- **what:** A megközelítési tervből személyre szabott üzenetvázlat: az első mondat a jelölt saját munkájához kapcsolódik.
- **how:**
  - Szerkeszd, majd „Jóváhagyva” — így látod később, mi ment át ellenőrzésen.
  - Másold ki, és küldd a saját csatornádon.
  - Utána rögzítsd a kiküldést és a választ (pozitív / semleges / negatív).
- **why:** **A rendszer soha nem küld semmit.** Itt csak az állapotot tartod nyilván — az automatizált kiküldés az, ami tömegessé és megkülönböztethetetlenné teszi a megkereséseket.
- **faq:** `megkereses`

**`jelolt.art14` — GDPR Art. 14 értesítő**
- **what:** Ha publikus forrásból kutatsz jelöltet, adatkezelővé válsz, és a GDPR 14. cikke szerint tájékoztatnod kell az érintettet. Ez a gomb kész sablont ad.
- **how:**
  - Töltsd ki az adatkezelő cégadatait és a kapcsolattartót.
  - Küldd a megszerzéstől számított 1 hónapon belül, vagy az első kapcsolatfelvételkor.
  - A jelölt profilján a státusz mutatja, hol tartasz.
- **why:** Sablon, nem jogi tanács. A dokumentált érdekmérlegelést ki kell tölteni, és skálázás előtt jogásszal átnézetni.
- **faq:** `jog`

### P1 — a második körben

**`attekintes.next` — Következő teendő**
- **what:** Megbízásonként egyetlen kiemelt lépés, alatta a legfeljebb öt elakadt jelölt, mindegyik egy kattintással elintézhető.
- **how:**
  - A javaslat automatikusan frissül, ahogy haladsz.
  - Nyugodtan hagyd figyelmen kívül — a felület nem kényszerít sorrendet.
- **why:** Szabálysor dönti el, nem hangulat: az első illeszkedő szabály nyer, a brieftől a válaszok rögzítéséig.
- **faq:** `alapok`

**`attekintes.lefedettseg` — Keresési lefedettség**
- **what:** Két kérdésre válaszol: egy forrásból jön-e szinte minden jelölt, és hány célcég maradt érintetlenül.
- **how:**
  - Ha a jelöltek 70%-a egy forrásból jön, ez vakfoltot jelez — bővítsd más forrással.
  - Az érintetlen célcégeket a célpiac-térképhez méri.
- **why:** Egy 40 fős lista egyetlen forrásból kevesebbet ér, mint egy 15 fős négyből. A merítés minőségét nem a darabszám mutatja.
- **faq:** `kutatas`

**`celpiac.asszisztens` — Stratégia-asszisztens**
- **what:** Szövegesen mondod meg, mit változtasson a keresési terven vagy a célpiac-térképen; minden módosítás tételes és visszavonható.
- **how:**
  - Ha utasítasz, végrehajtja; ha kérdezel, javaslatokat ad, amiket egyenként alkalmazol.
  - A „↺ Visszavonás” a teljes bejegyzést visszaállítja.
  - A rendszer-prompt megnyitható — ott látod, mit tud és mit nem.
- **why:** Szándékosan szűk hatókör: csak a tervhez és a térképhez nyúlhat. Jelöltet nem értékel és üzenetet nem ír — ez teszi ellenőrizhetővé.
- **faq:** `kutatas`

**`celpiac.forras` — Adatforrás**
- **what:** Megválaszthatod, honnan jöjjenek a jelöltek: automatikus, élő nyilvános webes források, vagy mintaadatok.
- **how:**
  - **automatikus** — élőt használ, ha van hozzá kulcs, különben mintát.
  - **élő** — valós keresés, jellemzően 20-40 másodperc.
  - **mintaadatok** — 14 fős, nem valós készlet; bemutatóhoz és próbához.
- **faq:** `kutatas`

**`jeloltek.tabla` — Jelölt-tábla**
- **what:** Az öt oszlop maga a folyamat: Rangsorolatlan → Előkészítés → Jóváhagyás és küldés → Kiküldve → Válaszolt. Egy jelölt mindig pontosan egy oszlopban van.
- **how:**
  - A kártya alján mindig ott a jelölt következő lépése.
  - A prioritás a kártyán is átállítható.
  - A Figyelőlista (C/D) és a Kizárva sáv alul, összecsukva.
- **faq:** `jeloltek`

**`interju.zar` — Miért zárt az interjúterv**
- **what:** Az interjúterv az első **pozitív** válasz után nyílik meg. A negatív és a semleges válasz nem oldja fel.
- **why:** Amíg nincs pozitív válasz, nem tudni, kivel készül az interjú — a terv találgatás lenne.
- **faq:** `alapok`

**`eredmenyek.mutatok` — Eredmények**
- **what:** A számok kizárólag a te rögzítéseidből épülnek: a kiküldésekből és a beérkező válaszokból.
- **how:**
  - Add meg a korábbi kézi válaszarányodat — ehhez méri magát a keresés.
  - A „Shortlist kész” gomb rögzíti az első shortlistig eltelt időt.
- **why:** A válaszarány és a pozitív arány külön mutató: az elutasítás is válasz. Ami számít, hány beszélgetés indul.
- **faq:** `meres`

### P2 — ha marad idő

**`pozicio.elemzes` — Brief elemzése**
- **what:** A nyers briefből javasolt pozíció-összefoglalót készít, és szétszedi feltételekre, tisztázandó pontokra és feltételezett igényekre.
- **how:**
  - A „tisztázandó pontok” a hiring managernek szóló kérdések.
  - A „feltételezett igények” a rendszer saját találgatásai — ellenőrizd őket.
- **faq:** `brief`

**`celpiac.terkep` — Célpiac-térkép**
- **what:** Megmutatja, hol dolgoznak a szerephez illő emberek: célcégek indoklással, versenytárs-klaszterek, és hol találkoznak.
- **how:**
  - A keresési terv után élesedik, mert abból dolgozik.
  - Kézzel is felvehetsz céget és közösséget.
  - Ez adja a célcég-lefedettség alapját az Áttekintésen.
- **faq:** `kutatas`

**`jelolt.profil` — Profil összegzése**
- **what:** Őszinte illeszkedés-ítélet (erős / közepes / gyenge / nem fit) indoklással, plusz egy lista arról, amit a jelekből **nem** tudunk.
- **why:** A „nem fit” nem automatikus elutasítás: a döntés a tiéd, a rendszer csak kimondja, amit az evidencia alátámaszt.
- **faq:** `jeloltek`

**`global.mod` — Milyen módban futsz**
- **what:** A két jelző mutatja, hogy élő elemzés fut-e (AI elérhető) vagy minta-kimenet (Bemutató mód), és hogy élő webes forrásból vagy mintaadatból dolgozol.
- **how:** Bemutató módban a kimeneteken `MINTA` címke van — ezek realisztikus, de nem valós eredmények.
- **faq:** `alapok`

**`global.tarolas` — Hol vannak az adataim**
- **what:** A megbízásaid ebben a böngészőben tárolódnak; a szerver nem tárol megbízás-adatot.
- **how:**
  - Másik gépen vagy böngészőben nem látod őket.
  - A böngészőadatok törlése végleg törli a megbízást.
  - A fejléc **Export** gombja teljes mentést ad JSON-ban.
- **faq:** `adat`

---

## 5. GYIK

### 5.1 Hol él

- **Belépés:** az oldalsáv láblécében egy „Súgó és GYIK” sor, keskeny képernyőn a `⋯ Több` lapon; és minden súgó-panel láblécéből.
- **Forma:** jobb oldali fiók (a `#notesDrawer` mintájára), nem külön oldal — így nem veszted el, hol jártál.
- **Kereső:** egy mező felül, ami élőben szűri a kérdéseket (kérdés + válasz szövegére).
- **Szekciók:** `<details>` blokkok; a súgó-panelből érkezve a megfelelő szekció nyitva és odagörgetve nyílik.

### 5.2 Tartalom

#### Alapok

**Mi ez, egy mondatban?**
Munkatér senior tech pozíciók kereséséhez: a nyers hiring manager-brieftől a rögzített válaszig vezet végig, minden lépésnél javaslattal — a döntés a tiéd.

**Mi az a „megbízás”?**
Egy megbízás = egy ügyfél egy konkrét pozíciója, saját briefjével, keresési tervével, jelöltjeivel és eredményeivel. Nem általános projekt: ha ugyanaz az ügyfél két pozíciót keres, az két megbízás.

**Kell sorrendben haladnom?**
Nem, de van néhány valódi függés: a célpiac-térképhez és a kutatáshoz keresési terv kell, a keresési tervhez brief-elemzés, az interjútervhez pedig egy pozitív válasz. Minden más szabadon sorrendezhető — az „Következő teendő” csak javasol.

**Mit jelent az „AI elérhető” és a „Bemutató mód”?**
AI elérhető: az elemzések élő modellel futnak. Bemutató mód: nincs API-kulcs beállítva, ezért realisztikus, de előre elkészített minta-kimenetet kapsz. A módot az oldalsáv és a fejléc mindig mutatja.

**Mit jelent a `MINTA` címke egy kimeneten?**
Azt, hogy az adott blokk bemutató módban készült, nem élő elemzésből. Tartalmilag realisztikus, de nem a te briefedre adott valódi válasz.

**Miért zárt az Interjúterv?**
Az első **pozitív** válaszig zárva van, mert addig nem tudni, kivel készül az interjú. A negatív és a semleges válasz nem oldja fel.

#### Adat és biztonság

**Hol tárolódnak a megbízásaim?**
Kizárólag ebben a böngészőben. A szerver állapotmentes: minden művelethez elküldjük neki az aktuális állapotot, ő kiszámolja az eredményt, és nem tárol semmit.

**Elveszhet az adatom?**
Igen, ha törlöd a böngésző adatait, privát ablakot használsz, vagy másik gépre ülsz. Amit meg akarsz tartani, azt exportáld: a megbízás fejlécében az **Export** teljes JSON-mentést ad.

**Miért nem látom a megbízásomat a másik gépemen?**
Mert a böngésződben él, nem szerveren. Vidd át exporttal, vagy hozd létre újra a másik gépen.

**Látja bárki más az adataimat?**
A megbízás tartalmát nem — az nem hagyja el a böngésződet, csak a művelet idejére. Ha viszont megosztod a nyilvános demó linkjét, az azon futó műveletek a link tulajdonosának API-kulcsait használják.

**„A böngésző tárhelye megtelt” — mit tegyek?**
Exportáld, majd töröld a régi, lezárt megbízásokat. A tárhely böngészőnként korlátos, sok jelölttel és sok generált kimenettel elérhető a plafon.

#### Brief és pozíció

**Mit csinál pontosan a „Brief elemzése”?**
Javasolt pozíció-összefoglalót ad, és szétszedi: elengedhetetlen feltételek, előnyt jelent, tisztázandó pontok, feltételezett igények, keresési hipotézisek. Minden kimenet javaslat, amit te ellenőrzöl.

**Mi a különbség az AI-javaslat és a véglegesített brief között?**
A javaslat az elemzés nyers kimenete. A véglegesített brief a te szerkesztett, jóváhagyott változatod — és **ez** megy tovább a keresésbe, a megkeresésekbe és az ügyfél-egyeztetésbe.

**Mi történik, ha újra lefuttatom az elemzést?**
Felülírja a véglegesített briefet. Ha már szerkesztetted, a rendszer rákérdez, mielőtt folytatná.

**Mi a különbség a „tisztázandó pont” és a „feltételezett igény” között?**
A tisztázandó pont a hiring managernek szóló kérdés: ellentmondás, hiány vagy fölösleges megkötés a briefben. A feltételezett igény a rendszer saját következtetése arról, mit akarhatnak még — ezt ellenőrizni kell, nem tényként kezelni.

#### Célpiac és kutatás

**Mi a különbség a keresési terv és a célpiac-térkép között?**
A terv **hogyan keresünk**: lekérdezések, célpozíciók, szinonimák. A térkép **hol keresünk**: célcégek indoklással, versenytárs-klaszterek, közösségek. A térkép a tervből épül.

**Ha frissítem a tervet, elveszik a kézi módosításom?**
Nem. A frissítés egyesít: a kézzel felvett elemeid megmaradnak, és amit kézzel kivettél, azt nem hozza vissza. Ha tényleg tiszta lapot akarsz, az „Új terv nulláról” pont ezt csinálja — és rákérdez.

**Scrapeli a rendszer a LinkedIn-t?**
Nem — nincs belépett vagy fake-account hozzáférés. A LinkedIn-URL-ek a nyilvános keresőből jönnek, és mivel a profil-oldal jellemzően auth-fal mögött van, onnan csak a kereső-snippet marad. A valódi mélységet a szabadon elérhető források adják: GitHub, cég-oldalak, konferencia-biók, blogok, személyes oldalak.

**Miért tart ilyen sokáig az élő kutatás?**
Mert valódi keresés és több oldal letöltése történik — jellemzően 20-40 másodperc. Ha kifutna az időből, válts `mintaadatok` forrásra, vagy szűkítsd a lekérdezéseket.

**Miért nem indul a jelöltkutatás?**
Mert még nincs keresési terv — abból jönnek a webes lekérdezések. Készítsd el a tervet, és a gomb élesedik.

**Mik a „mintaadatok”?**
Egy 14 fős, senior tech / CEE profilokból álló minta-készlet. **Nem valós személyek** — bemutatóhoz és a folyamat kipróbálásához való.

**Újra lefuttatom a kutatást — felülírja a listámat?**
Nem. Az új találatok hozzáadódnak „Új” jelöléssel, a névre egyező duplikátumok kimaradnak, a meglévő jelöltek adatai érintetlenek.

**Mit jelent a „keresési lefedettség” figyelmeztetés?**
Kettőt jelezhet. Ha a jelöltek legalább 70%-a egy forrásból jön, a merítés egyoldalú. Ha maradtak érintetlen célcégek, azokra még érdemes kutatni, mielőtt lezárnád a listát.

#### Kizárás

**Miért nem látom a listán azt, aki az ügyfélnél dolgozik?**
Mert az ügyfél jelenlegi és volt munkatársai automatikusan kimaradnak a merítésből — őket a hiring manager ismeri, és ha bekerülnek a listába, az az egész merítés hitelét viszi.

**Honnan tudja, hogy egy cég az ügyfél leányvállalata?**
Normalizált cégnév-egyezésből: leveszi a jogi utótagokat és a szokásos toldalékokat, majd token-szinten hasonlít. Amit nem ismer fel, azt kézzel add hozzá az „ügyfél további cégnevei” listához.

**Vissza tudok hozni valakit?**
Igen. A Kizárva sávban minden találat megmarad indoklással, és a „Mégis bevonom” gomb visszateszi a merítésbe. A kizárás sosem törlés.

**Mire jó az alumni-kapcsoló?**
Arra, ha szándékosan vissza akartok csábítani volt munkatársakat. Bekapcsolva a volt ügyfél-munkatársak megjelennek a listán — jelöléssel, hogy tudd, kikről van szó.

#### Jelöltek és prioritás

**Honnan jön az A / B / C / D?**
Az elemzés a jelölt jeleiből és a szerep-kontextusból ad prioritási javaslatot, rövid indoklással. A besorolás javaslat, nem ítélet.

**Felülírhatom?**
Igen, bármelyik jelöltnél, a kártyán vagy a panelen. A te beállításod győz az AI-javaslat felett, és a felület jelzi, hogy kézzel állítottad.

**Miért marad a listán az, akit a rendszer nem javasol?**
Mert minden jelöltnek meg kell jelennie a rangsorban — akkor is, ha a javaslat elutasító. A „D — most nem javasolt” indoklással jön, és a Figyelőlistán marad. Némán senki nem esik ki.

**Mit jelentenek a tábla oszlopai?**
Az öt oszlop a folyamat öt állapota: Rangsorolatlan (prioritás kell) → Előkészítés (terv és vázlat kell) → Jóváhagyás és küldés → Kiküldve (válaszra vár) → Válaszolt. Egy jelölt mindig pontosan egy oszlopban van.

**Mi a Figyelőlista?**
A C és D prioritású jelöltek gyűjtője: nem a mostani körben aktuálisak, de nem is tűnnek el. A megkeresés-állapotuk itt is látszik.

#### Megkeresés

**Küld a rendszer üzenetet a jelöltnek?**
**Nem, soha.** Vázlatot ír, amit te ellenőrzöl, kimásolsz, és a saját csatornádon (e-mail, LinkedIn) küldesz el. A felületen csak az állapotot rögzíted.

**Mi a különbség a megközelítési terv és az üzenetvázlat között?**
A megközelítési terv a **stratégia**: mit tudunk a jelöltről, mi lehet vonzó neki, mit kerüljünk. Az üzenetvázlat ebből született **konkrét szöveg**. A vázlat előtt mindig kell terv.

**Miért van szétválasztva az „Amit tudunk” és a „Megközelítési javaslat”?**
Mert az egyik forrásból igazolható tény, a másik feltételezés. A jelölt motivációit nem ismerjük — a rendszer ezt kimondja, ahelyett hogy magabiztos állításnak álcázná.

**Mit jelent a „🛡️ … nem-visszavezethető állítás automatikusan kiszűrve”?**
Azt, hogy az elemzés írt a jelöltről olyan „tényt”, amit nem lehetett egyetlen rögzített jelére sem visszavezetni, ezért a rendszer eltávolította. Ez a második védővonal a kitalált információ ellen.

**Mit jelentenek az üzenet-állapotok?**
„Jóváhagyva” = átment az ellenőrzéseden. „Kiküldés rögzítve” = te elküldted a saját csatornádon. „Válasz” = beérkezett, pozitív / semleges / negatív bontásban. Mindhárom a te rögzítésed — a rendszer nem tud róla máshonnan.

#### Jog és GDPR

**Kell Art. 14 értesítőt küldenem?**
Ha nem az érintettől szerezted az adatot — és a publikus webes kutatás ilyen —, akkor a GDPR 14. cikke tájékoztatási kötelezettséget ír elő. A határidő a megszerzéstől számított 1 hónap, vagy az első kapcsolatfelvétel, amelyik hamarabb jön.

**Mi a jogalap?**
Jogos érdek (GDPR 6. cikk (1) f), dokumentált érdekmérlegelés alapján. Az érdekmérlegelést neked kell elkészítened és megőrizned — a sablon erre emlékeztet, de nem pótolja.

**Mit jelent a „pending_notice” a jelölt profilján?**
Azt, hogy erről a jelöltről publikus forrásból gyűjtöttünk adatot, és az Art. 14 értesítő még nem ment ki. Az `n/a` azt jelenti, hogy az adott forrásnál ez nem értelmezhető.

**Kezel a rendszer különleges kategóriájú adatot?**
Nem, és aktívan szűri: ha egy kiolvasott szövegrészlet egészségi, vallási, etnikai, politikai vagy hasonló utalást tartalmaz, azt eltávolítja a rekordból.

**Ez jogi tanács?**
Nem. A generált értesítő sablon; a cégadatokat, az érdekmérlegelést és a folyamat egészét skálázás előtt jogásszal kell átnézetni.

#### Mérés

**Honnan jönnek az Eredmények számai?**
Kizárólag a te rögzítéseidből: hány megkeresést jelöltél kiküldöttnek, és hány válasz érkezett rá. A rendszer nem küld, tehát kitalált számot sem mutat.

**Miért külön mutató a pozitív arány?**
Mert az elutasítás is válasz. A válaszarány önmagában félrevezető — ami számít, hány beszélgetés indul el.

**Mi az a „korábbi kézi válaszarány”?**
A saját, korábbi válaszarányod százalékban (önbevallásból vagy ATS-adatból). Ehhez méri magát a keresés, és a felület kiírja az eltérést százalékpontban.

#### Hibaelhárítás

**„Elérted az ingyenes próbakeretet” — mit jelent?**
A nyilvános demón IP-nként korlátozott, hány költséges műveletet lehet futtatni egy 15 perces ablakban. Várj pár percet, vagy futtasd saját kulccsal.

**Nagyon lassú vagy időtúllépéssel elhal egy művelet.**
A leglassabb művelet az élő jelöltkutatás. Válts `mintaadatok` forrásra, csökkentsd a webes lekérdezések számát, vagy futtasd lokálisan, ahol nincs futásidő-korlát.

**Nem találom a Naplót.**
Az oldalsávban a „Napló megnyitása” gomb nyitja, billentyűvel `⌘J` (Windows: `Ctrl+J`). Keskeny képernyőn a `⋯ Több` lapon van.

**Eltűnt egy jelölt a listáról.**
Valószínűleg kizárási szabály fogta meg (ügyfél jelenlegi vagy volt munkatársa, off-limits cég), vagy C/D prioritást kapott. Nézd meg a Jelöltek nézet alján a Figyelőlista és a Kizárva sávot — mindkettő indoklással mutatja, ki hova került.

---

## 6. Implementációs vázlat

Nulla új függőség, a meglévő mintákra épül.

### 6.1 Érintett fájlok

| Fájl | Mit kap |
|---|---|
| `app/public/app.js` | `HELP` regiszter (~130 sor adat), `helpBtn(id)` renderelő, egy delegált klikk-kezelő, `openHelp/closeHelp`, `openFaq(anchor)`, `FAQ` adat (~160 sor), `renderFaq()` |
| `app/public/index.html` | egy `#helpPop` popover-konténer és egy `#faqDrawer` fiók a meglévő `#notesDrawer` mellé |
| `app/public/styles.css` | `.help-b`, `.help-pop`, `.help-pop-*`, `.faq-*` — kb. 70 sor, a meglévő tokenekkel |
| `docs/` | ugyanez a három fájl tükrözve (a statikus demó ebből publikál) |

### 6.2 Beillesztési minta

A `?` gomb egy sorral kerül a meglévő címekbe, a renderelő függvények érintése nélkül:

```js
function helpBtn(id) {
  const h = HELP[id];
  if (!h) return "";
  return `<button class="help-b" data-help="${id}" aria-expanded="false"
    aria-label="Súgó: ${esc(h.title)}" title="Mit csinál ez?">?</button>`;
}
```

Használat a meglévő markupban:

```js
// előtte
<h4>Keresési terv ${demoTag(o)} …</h4>
// utána
<h4>Keresési terv ${helpBtn("celpiac.terv")} ${demoTag(o)} …</h4>
```

Statikus címeknél (`index.html`) elég egyszer beírni a gombot; a delegált kezelő megtalálja:

```js
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-help]");
  if (b) { e.preventDefault(); return toggleHelp(b); }
  if (!e.target.closest(".help-pop")) closeHelp();
});
```

### 6.3 Amire figyelni kell

- **Újrarender:** a legtöbb nézet teljes `innerHTML`-t cserél. A popovert nyitáskor a `document.body`-ba tesszük, nem a kártyába, és nézetváltáskor bezárjuk — így nem tűnik el félúton.
- **Fiók-kizárás:** a jelöltpanel, a napló, a `⋯ Több` lap és a GYIK-fiók közül egyszerre csak egy lehet nyitva. A GYIK-ot fel kell venni az `anyDrawerOpen()` és a `syncScrim()` logikába, és az `Esc`-sorrendbe.
- **Fókuszcsapda:** a meglévő `Tab`-kezelő a `#candDrawer` és `#notesDrawer` közt választ — ki kell egészíteni a GYIK-fiókkal.
- **`docs/` tükör:** a statikus demó külön fájlkészlet. Ami nem kerül át, az a publikus demón nem látszik.
- **Nyelv:** a súgó magyar; ha később kell angol, a `HELP` és `FAQ` objektum kulcsonként duplázható, nem a markup.

### 6.4 Sorrend

1. **P0 súgó-horgonyok** (8 db) + a popover-mechanika. Ez önmagában értékes és fél nap.
2. **GYIK-fiók** kereső nélkül, a fenti tartalommal.
3. **P1 horgonyok** (7 db) + GYIK-kereső és mély-horgonyok.
4. **P2 horgonyok** (5 db), mobil alsó lap, `docs/` tükrözés.

---

## 7. Amit ne csináljunk

| Anti-minta | Miért nem |
|---|---|
| Bevezető túra / coach markok | egyszer nézik meg, utána útban van; a felület úgyis nem-lineáris |
| Tooltip hoverre | mobilon nincs hover, és a hosszú szöveg tooltipben olvashatatlan |
| `?` minden tile-on | ha mindenen ott van, semmit nem jelent — a fontosak elvesznek |
| Modális súgó | elfedi azt, amiről szól |
| „Miért így” minden panelen | a védekezés inflálódik; csak ott, ahol tényleg van szándékos, meglepő döntés |
| Súgó a rossz felirat pótlására | előbb a címkét javítsd |
