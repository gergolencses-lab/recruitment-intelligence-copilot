# JEL — Explainer videósorozat (illusztrált/animált gyártás)

> Ez a `VIDEO-SZKRIPTEK.md` **alternatívája**, nem felváltása: az ott leírt 13 videó **képernyőfelvétel**-alapú (a valódi appot mutatja); ez a dokumentum egy **illusztrált/animált** gyártási irányt ír le, ElevenLabs Flows-szal — 8 videóra összevonva. Válaszd azt, amelyik jobban illik a céljaidhoz, vagy vidd párhuzamosan mindkettőt (pl. az áttekintő illusztrált, a lépésenkéntiek screen-recorded).

---

## 1. Kreatív brief

**Cél:** megmutatni, mit csinál a JEL és miért lehet rá bízni a keresést — anélkül, hogy dokumentációt kellene olvasni. Nem marketing, hanem gyors megértés.

**Célközönség:** recruiterek / HR-szakemberek, akik most ismerkednek az eszközzel. Nem technikai közönség.

**Hangnem:** tárgyszerű, magyarázó, nem lelkendező. Nincs felkiáltójel, nincs „forradalmi", nincs „egyszerűen zseniális". Ha valamit a rendszer nem tud vagy nem csinál, azt is kimondjuk.

**Formátum:** 8 rövid videó, egyenként 45–85 mp, összesen kb. 9 perc. Illusztrált/animált (nem képernyőfelvétel) — geometrikus, lapos stílus, 1 semleges szilhuett-figura, kizárólag a JEL 4 brand-színe.

**Gyártás:** ElevenLabs Flows (styleframe + motion-prompt node-ok a vizuálhoz) → ElevenCreative Studio (magyar narráció, felirat, vágás, export).

**Amit mindenképp át kell adni:**
- minden AI-kimenet javaslat — a döntés a recruiteré
- a rendszer szétválasztja a tényt (forrásból igazolt) a feltételezéstől
- a rendszer soha nem küld üzenetet
- senki nem esik ki némán a rangsorból — a gyenge jelölt is megjelenik, indoklással

**Kerülendő:** technikai/fejlesztői szóhasználat; marketing-túlzás; bármilyen brand-asset (logó) AI-generálásra bízása — az utólag, valódi fájlként kerül a vágásba (lásd 4. pont).

---

## 2. Gyártási megjegyzések

### Nyelv — TTS-modell kötelező váltás

Az ElevenLabs **alapértelmezett** modellje (Multilingual v2) **nem támogatja a magyart** — a 29 nyelve közt nincs ott. A Text to Speech node-ban válts az alábbiak egyikére:

| Modell | Magyar? |
|---|---|
| Multilingual v2 (alapértelmezett) | ❌ |
| **Eleven v3** | ✅ — legjobb minőség, ezt javasoljuk |
| Flash v2.5 | ✅ — gyorsabb, olcsóbb |
| Turbo v2.5 | ✅ |

Nincs külön „nyelv" legördülő — a modell a beírt szövegből automatikusan felismeri a nyelvet. Válassz emellett lehetőleg magyarra optimalizált hangot a Voice Library-ből (szűrhető nyelv szerint) — a kiejtés és a hangsúly így jobb lesz, mint egy angolra hangolt hangnál.

### Logó és brand-elem — ne a generálásra bízd

Egy kép/videó-generáló modell (GPT Image 2, Seedance stb.) **nem ismeri a JEL márkát** — sosem volt a tanítóadatában. Ha a promptba írod, hogy „JEL-logó", a modell kitalál valamit, és 8 külön generálás nem fog pixelre ugyanazt kihozni. **A tényleges logót utólag, a Studio idővonalán, valódi PNG/SVG overlayként told be** — ne a videó-generálás promptjába.

---

## 3. Közös vizuális alap (minden videóhoz, változatlanul)

Lapos, geometrikus, minimalista illusztráció — nem fotorealisztikus, nincs textúra/grain. Egyetlen visszatérő figura: egyszerű, arctalan, semleges szilhuett (mint egy piktogram-ember), nem/kor/etnicitás nélkül. Kizárólag ez a 4 szín:

- mélykék `#263653` — figura és fő felületek
- menta `#20CFA8` — AI-javaslat, pozitív jelzés
- korall `#FF5A5F` — döntési pont, kiemelés (csak apró akcentusként)
- meleg törtfehér `#F6F4EF` — háttér

Sok negatív tér, egyszerű ikonikus tárgyak (dokumentum, nagyító, lista, buborék, pipa) — **nincs UI-elem, nincs felirat a képen**. Kompozíció 16:9.

**Mozgás minden shot-nál:** kövesse a 12 animációs alapelvet (anticipation, squash & stretch, follow-through stb.), szerves, **nem hurkolt (no loop)**, kb. 3–5 másodperces szegmensenként.

---

## 4. A 8 videó

### 1 · Áttekintő — ~70s · P0
**Narráció**
A JEL egy munkatér senior tech pozíciók kereséséhez: a nyers hiring manager-brieftől a rögzített válaszig vezet végig — minden lépésnél nálad marad a döntés. Egy megbízás egy ügyfél egy konkrét pozíciója. Beilleszted a briefet, az elemzés javaslatot ad, te véglegesíted — ez a változat megy tovább. A rendszer prioritást javasol, megközelítési tervet ír, üzenetvázlatot ad — és szétválasztja azt, amit a jelöltről forrásból tudunk, attól, amit csak feltételez. Üzenetet nem küld, jelöltet nem utasít el automatikusan, kitalált tényt nem állít. A végén mérhető eredmény: hány megkeresés ment ki, hányan válaszoltak, és ebből hányan pozitívan.

**Videó-prompt**
- *Jelenet 1:* a figura egy dokumentumot néz, mellette apró, szórt jelzés-pontok jelennek meg (különböző forrásokból érkező információ). *Mozgás:* a pontok lassan egy irányba sodródnak, mintha rendeződnének.
- *Jelenet 2:* a figura egy nagy pipát rajzol egy listára. *Mozgás:* a lista elemei sorban, pattogó ütemben pipálódnak ki menta színnel.
- *Jelenet 3:* a figura mérleget tart — egyik serpenyőben egy dokumentum-ikon (tény), másikban egy felhő-ikon (feltételezés). *Mozgás:* a mérleg finoman ingadozik, egyensúlyba áll.
- *Jelenet 4:* a figura egy grafikont mutat, ami nő. *Mozgás:* az oszlopok/vonal balról jobbra épül fel.

---

### 2 · Brief és pozíció — ~65s · P0
**Narráció**
Egy új megbízás két lépés: először a pozíció és az ügyfél — ez utóbbi kulcsfontosságú, mert vezérli a kizárási szabályt is. Utána jön a nyers brief, pontosan úgy, ahogy a hiring managertől kaptad. Az elemzés szétszedi: elengedhetetlen feltételek, előnyök, tisztázandó pontok — ezek a hiring managernek szóló kérdések —, és feltételezett igények, amiket neked kell ellenőrizned. Az eredmény egyelőre javaslat. A véglegesített brief a tiéd: szerkeszted, és amikor jóváhagyod, ez lesz a hivatkozási alap — erre épül a keresés, a megkeresés és az ügyfél-egyeztetés.

**Videó-prompt**
- *Jelenet 1:* egy boríték/dokumentum landol a figura kezében. *Mozgás:* a figura kibontja, a papír szétnyílik.
- *Jelenet 2:* a dokumentumból apró ikonok válnak szét — pipa (elengedhetetlen), csillag (előny), kérdőjel (tisztázandó), felhő (feltételezés). *Mozgás:* négy irányba szóródnak szét, majd rendezett oszlopokba állnak.
- *Jelenet 3:* a figura egy ceruzával aláhúz/átír egy sort a dokumentumon, majd egy nagy pipát rajzol rá. *Mozgás:* a dokumentum keretét menta fény veszi körbe (jóváhagyva).

---

### 3 · Célpiac: terv, térkép, asszisztens — ~85s · P0
**Narráció**
A keresési terv adja a kutatás alapját: célpozíciók, célcégek, szinonimák és a lekérdezések. Minden kategóriához hozzáadhatsz és elvehetsz — a frissítés egyesít, nem töröl: a kézzel felvett elemeid megmaradnak, amit kivettél, az nem jön vissza csendben. A célpiac-térkép azt mutatja, hol dolgoznak ezek az emberek: célcégek indoklással, és hogy hol találkoznak — közösségek, konferenciák. Ha inkább leírnád, mit szeretnél: a stratégia-asszisztens szövegesen szerkeszti mindkettőt, tételesen és visszavonhatóan — jelöltet nem értékel, üzenetet nem ír.

**Videó-prompt**
- *Jelenet 1:* a figura egy nagyítót tart egy térkép fölé, apró pontok (célcégek) jelennek meg rajta. *Mozgás:* a nagyító végigsiklik, a pontok egyenként felvillannak mentazöldben.
- *Jelenet 2:* egy pont köré vonalak rajzolódnak (miért releváns), majd épületke-ikon jelenik meg. *Mozgás:* a vonalak szerves ívben nőnek ki a pontból.
- *Jelenet 3:* a figura egy buborékba beszél, a buborékból apró chip-ek (kategóriák) pattannak ki és rendeződnek listává. *Mozgás:* pattogó, játékos ritmus — hozzáadás/elvétel érzete.

---

### 4 · Jelöltkutatás és kizárás — ~75s · P0
**Narráció**
A kutatás a keresési terv webes lekérdezéseivel dolgozik: nyilvános forrásokat vizsgál, jellemzően húsz-negyven másodpercig. Nincs belépett LinkedIn-hozzáférés — a mélységet a szabadon elérhető oldalak adják. A találatokból normalizált jelölt-rekord lesz: jelek, forráshivatkozás, GDPR-státusz. Ami automatikusan kimarad: az ügyfél jelenlegi és volt munkatársai, és minden off-limits cég — de ez nem törlés: a találat megmarad, indoklással, egy kattintással visszahozható. A szabályokat te állítod.

**Videó-prompt**
- *Jelenet 1:* a nagyító a törtfehér háttéren apró szilhuett-alakokat gyűjt be egy tölcsérbe. *Mozgás:* az alakok szétszórtan jelennek meg, majd a tölcsér felé sodródnak.
- *Jelenet 2:* néhány alak köré korall keret rajzolódik, és kiválik a fő csoportból egy külön sávba. *Mozgás:* lassú, tiszteletteljes kiemelés (nem eltűnés) — a keret pulzál egyet.
- *Jelenet 3:* a kiemelt alak mellett egy kis „vissza" nyíl-ikon jelenik meg. *Mozgás:* az alak finoman visszahúzódik a fő csoport felé, ha a nyíl aktiválódik.

---

### 5 · Prioritás és jelölt-tábla — ~60s · P0
**Narráció**
A rendszer A, B, C vagy D prioritást javasol — mindegyik mellett rövid indoklás. A gyengébb jelölt sem tűnik el: megkapja a D-t, indoklással, a figyelőlistán marad — senki nem eshet ki némán. A javaslatot bármikor felülírhatod, a te beállításod győz. A jelölt-tábla öt oszlopa maga a folyamat: rangsorolatlan, előkészítés, jóváhagyás és küldés, kiküldve, válaszolt — egy jelölt mindig pontosan egy oszlopban van.

**Videó-prompt**
- *Jelenet 1:* négy alak sorba áll, mindegyik fölött egy betű lebeg (A/B/C/D) eltérő méretű mentazöld glóriával. *Mozgás:* a betűk egymás után jelennek meg, könnyű pattanással.
- *Jelenet 2:* egy kéz-ikon áthúz egy betűt B-ről A-ra. *Mozgás:* a glória-szín azonnal frissül, apró korall csillanás jelzi a kézi felülírást.
- *Jelenet 3:* öt függőleges sáv (oszlop) jelenik meg, az alakok balról jobbra vándorolnak rajtuk. *Mozgás:* egyenletes, szalagszerű mozgás, mint egy futószalag.

---

### 6 · Megközelítési terv — tény és feltételezés — ~65s · P0
**Narráció**
A megközelítési terv két élesen elválasztott részből áll. Az első az, amit a jelöltről biztosan tudunk — minden állítás mellett ott a forrás. Amit nem tudunk — motiváció, fizetés, elégedettség —, az külön listán szerepel; ezt a rendszer nem találja ki. A második rész három megközelítési ötlet, rangsorolva — a legerősebbhez konkrét nyitómondat-javaslat is tartozik. Ezek szükségszerűen feltételezések — a rendszer ezt kimondja, nem álcázza biztos állításnak. Ha mégis becsúszna egy nem forrásra visszavezethető tény, egy ellenőrzés kiszűri.

**Videó-prompt**
- *Jelenet 1:* a kép középen kettéválik: bal oldalon egy szilárd, mentazöld körvonalú dokumentum-ikon (tény), jobb oldalon egy szaggatott körvonalú, halványabb felhő-ikon (feltételezés). *Mozgás:* a két oldal ellentétes ütemben lélegzik.
- *Jelenet 2:* a tény-oldalon egy vékony vonal köti össze az ikont egy apró forrás-jelzéssel (láncszem-ikon). *Mozgás:* a vonal kirajzolódik, majd megvilágosodik.
- *Jelenet 3:* a feltételezés-oldalon három buborék jelenik meg egymás alatt, a legfelső korall kerettel kiemelve. *Mozgás:* a legfelső buborék enyhén megnő, a másik kettő halványabb marad.

---

### 7 · Üzenetvázlat, kiküldés és GDPR — ~80s · P0
**Narráció**
A jóváhagyott megközelítésből személyre szabott üzenetvázlat készül — az első mondat a jelölt saját munkájához kapcsolódik. Szerkeszted, jóváhagyod, kimásolod: a rendszer soha nem küld semmit, a kiküldés a te csatornádon történik. Itt csak azt rögzíted, hogy megtörtént, és később a választ. Egy dolog fontos: ha publikus forrásból kutatsz jelöltet, adatkezelővé válsz, a GDPR tizennegyedik cikke tájékoztatási kötelezettséget ír elő. Kész sablon jön: adatkezelő, milyen adat, honnan, milyen jogalapon. Ez sablon, nem jogi tanács — jogásszal átnézetendő. A határidő egy hónap, vagy az első kapcsolatfelvétel, amelyik hamarabb van.

**Videó-prompt**
- *Jelenet 1:* egy levél-ikon formálódik a figura kezében, apró mentazöld ceruza-ikon szerkeszti. *Mozgás:* a levél lezáródik, pipa jelenik meg rajta.
- *Jelenet 2:* a levél elindul a figura kezéből kifelé a kereten túlra. *Mozgás:* a levél a képkeret szélén eltűnik, majd egy visszaigazoló pipa villan a figura mellett.
- *Jelenet 3:* egy pajzs-ikon jelenik meg, benne apró dokumentum-sorok. *Mozgás:* a pajzs finoman felfénylik korall szegéllyel, egy órahomok-ikon pörög mellette.

---

### 8 · Eredmények — ~45s · P1
**Narráció**
Az eredményeknél három szám számít: hány megkeresés ment ki, hányan válaszoltak, és ebből hányan pozitívan. A válaszarány és a pozitív arány szándékosan külön mutató — az elutasítás is válasz, ami igazán számít, hány beszélgetés indul el. Ha megadod a saját korábbi válaszarányodat, a rendszer ehhez méri magát. Minden szám a te rögzítéseidből épül.

**Videó-prompt**
- *Jelenet 1:* három egyszerű számláló-ikon (körvonal-számjegyek) jelenik meg egymás mellett. *Mozgás:* mindegyik alulról felpörögve éri el a végértékét.
- *Jelenet 2:* a harmadik számláló köré korall glória rajzolódik (pozitív arány kiemelése). *Mozgás:* finom pulzálás.
- *Jelenet 3:* egy kis mérce/skála jelenik meg egy korábbi és egy jelenlegi ponttal. *Mozgás:* a jelenlegi pont a korábbi fölé csúszik, a köztük lévő szakasz mentazölddel kitöltődik.
