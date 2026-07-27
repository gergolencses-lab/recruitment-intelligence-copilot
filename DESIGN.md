# DESIGN.md — JEL

A szállított felület design-nyelve. Ez az igazság-forrás; ha a kód és ez a
dokumentum eltér, valamelyiket javítani kell. (A `design-ref/DESIGN-TOKENS.md`
történeti forrás — anti-referencia, nem minta.)

**Felület:** `app/public/` (élő: Vercel) · `docs/` ugyanaz mock-API-val.
**Mód:** Operate — a látogató elvégez egy feladatot. A scanability, a
konzisztencia és a valódi használati helyzet előbbre való, mint a kifejezés.
A márka a pontos részletekben él.

---

## 1. A motívum

**Szűkülő sávok egy korall pontba.** Ez a márkajel maga, és ez az egyetlen
formai gondolat, amit a felület ismétel — négy léptékben:

| Hol | Mit mond |
|---|---|
| **Tölcsér** a megbízás-fejlécben (`.funnel`) | felkutatva → prioritásos → megkeresve → válaszolt → **pozitív**. A sávok magassága 11→9→7→5px-en lép le az adattól függetlenül: a forma akkor is szűkül, ha a számok nem. |
| **Jelölttábla** oszlopvonala (`.bcol-rule`) | 100/84/68/52/38% szélesség; az utolsó oszlopban korallra vált. Az öt oszlop maga az állapotlétra. |
| **Eredmények lépcső** (`.rchain`) | ugyanaz teljes léptékben, lépésenkénti lemorzsolódás-százalékkal — itt derül ki, hol szivárog a folyamat. |
| **Várakozás-jelző** (`.task-funnel`) | ugyanaz a négy sáv, egymás után gyulladva, a korall pontba futva. |

**Szabály: korall = döntési pont.** Sehol máshol. A fülkiválasztás nem döntés,
ezért a `.tab.on` menta. Ami fogy, az keskenyedik; ahol dönteni kell, ott
korall pont van.

## 2. Színek

Tokenek a `app/public/styles.css` `:root`-jában. Minden szövegszín átmegy a
WCAG AA-n (4.5:1) a saját hátterén — ez ellenőrzött, nem szándék.

| Token | Érték | Szerep |
|---|---|---|
| `--navy` | `#263653` | oldalsáv, alsó navigáció |
| `--bg` / `--surface` | `#F6F4EF` / `#fff` | meleg törtfehér lap, fehér kártya |
| `--accent-bright` / `--accent` | `#20CFA8` / `#1DBF9C` | menta kitöltés, keret — **nem szövegszín** |
| `--accent-ink` / `--accent-ink-2` | `#0B7D66` / `#0A705B` | olvasható menta szöveg fehéren / menta tinten |
| `--coral` / `--coral-ink` | `#FF5A5F` / `#C22F35` | döntési pont / olvasható korall szöveg |
| `--mut` / `--mut-2` | `#555E72` / `#5D6678` | másodlagos / harmadlagos szöveg (6.50 és 5.77:1) |
| `--good` `--warn` `--bad` | `#0A7A5F` `#8A5C0F` `#B92E32` | saját tint-háttéren 4.6–5.2:1 |
| `--focus` / `--focus-dark` | `#0B7D66` / `#20CFA8` | fókuszgyűrű világos / navy felületen |

**Sötét felületen** a másodlagos szöveg fehér alfája sosem megy `.58` alá
(5.24:1). A `.35–.42` tartomány tiltott — ott volt korábban a fázisfejléc,
azaz a tájékozódás elsődleges eszköze volt a legolvashatatlanabb elem.

**A szín önmagában sosem hordoz jelentést.** A besorolás betűvel is megjelenik
(`.bcard-tier` A/B/C/D), a kizárás címkével, az evidencia-eredet formával.

## 3. Evidencia-eredet — a termék tézise

Három állapot, és a **forma** hordozza a bizonyosságot, nem csak a szín
(`evTag()` → `.ev-fact` / `.ev-inference` / `.ev-assume`):

- **Forrással igazolt** — tömör jelölő
- **Következtetés** — körvonalas jelölő
- **Ellenőrizendő feltételezés** — szaggatott körvonalas jelölő

Ugyanaz a logika, mint a tölcséré: ahogy csökken a biztos, úgy fogy az anyag.
Fekete-fehér nyomtatásban és színvakon is olvasható.

Mellette az `aiTag()`: minden AI-artefaktum `AI-javaslat — még nincs
ellenőrizve`, amíg ember jóvá nem hagyja.

## 4. Tipográfia

Nyolc lépcső, **11px padlóval** — ami alatta van, azt nem olvassa el senki,
tehát nem is létezik. (Korábban 24 méret élt hét fél-pixeles értékkel, 9,5px-es
aljjal.)

`--fs-xs 11` · `--fs-sm 12` · `--fs-ui 13` · `--fs-md 14` (törzs) ·
`--fs-lg 16` · `--fs-xl 19` · `--fs-2xl 24` · számok: `17 / 22 / 30`

Család: `"Avenir Next", Avenir, Futura, "Segoe UI", system-ui`.
Sormérték: leíró szöveg `max-width` 72–74ch.
Mobilon minden űrlapvezérlő 16px — alatta az iOS Safari ráközelít.

## 5. Térköz és forma

`--s1..--s7`: `4 6 8 12 16 22 32`. Radius: `--r-sm 6` · `--r 10` ·
`--r-lg 14` · `--r-pill`. Egy árnyék (`--shadow`), offsettel és lággyal.

**Rácsok mindig `minmax(0, 1fr)`**, sosem csupasz `1fr`. A csupasz `1fr`
minimuma `auto`, ezért egy hosszú chip-lista kitolja az oszlopot és a szomszéd
tartalma rárajzol a címkékre — pontosan ez történt a Pozícióadatok rácsban.

**Nincs színes bal szegély 1px fölött** kártyán, listasoron, kiemelésen.
A besorolást betűs jelvény mondja meg, a döntési pontot korall pötty
(`.next-inline::before`, `.flag::before`).

**Nincs kártya a kártyában.** Kártyán belüli szekció: `.substage` —
elválasztó vonal, nem újabb keret.

## 6. Állapotok

Minden hosszú művelet (20–60 mp) ugyanazt a szerződést kapja a
`withLoading(btn, fn, opts)`-on keresztül:

1. **Skeleton a cél-panelbe** (`opts.into`) a márkajel geometriájával, sima
   magyar lépéscímkével — nem egy 14px-es spinner a gombon.
2. **A gomb megtartja a feliratát**, mellé inline spinner. (A `color:transparent`
   tiltott: elveszi a gomb akadálymentes nevét pont a művelet közben.)
3. **Eltelt idő 5 mp után**, **Megszakítás** gomb `AbortController`-rel,
   55 mp-es saját timeout a platform 60 mp-es plafonja alatt.
4. **A hiba oda kerül, ahol az eredményt vártuk, és ott is marad** — tartós
   kártya, magyar ok, `Újrapróbálom`, és ahol van értelme, egy második kijárat
   (504 → *Váltás mintaadatokra*). Toast csak ott, ahol nincs cél-panel.
5. **Élő régió**: `#srLive` (`role=status`) minden visszajelzésre, `#srAlert`
   (`role=alert`) a hibákra.

**A vezérelv:** egy elbukott hatvan másodperces művelet soha nem lehet
megkülönböztethetetlen attól, hogy a felhasználó el sem indította.

Üres állapot: egyetlen hívás a képernyőn. Nulla megbízásnál nincs szűrősáv,
és az űrlap megnyitása elviszi az üres kártyát.

## 7. Akadálymentesség — nem opcionális

EU-s B2B toborzótermék: EAA / EN 301 549 hatály.

- Minden interaktív elemnek van akadálymentes neve (ellenőrizve: 0 névtelen
  mind a 7 nézeten, 4 panel-fülön és a naplóban).
- `:focus-visible` gyűrű ≥3:1-en minden fókuszálható elemen; navy felületen
  menta változat. **`outline:none` csak akkor, ha van egyenértékű pótlás** —
  a puszta keretszín-váltás nem az.
- Modális fiók: fókusz a címsorra nyitáskor (`tabindex="-1"`), vissza a
  nyitó elemre záráskor. **Csukott fiók `display:none`** — nem eltolás,
  különben bent marad a tab-sorrendben.
- Fülsáv: `role=tab` + `aria-controls` + `role=tabpanel` + roving tabindex +
  nyílbillentyűk. Panel nélküli `role=tablist` tiltott — rosszabb, mint a sima
  gomb. Ahol navigáció, ott `aria-current`, nem fül.
- Nincs interaktív elem `role="button"` belsejében.
- Natív `confirm()` visszafordíthatatlan műveletre igen; `prompt()` sosem —
  helyben kérdezünk.
- Érintési célpont 44×44 mobilon.
- `prefers-reduced-motion`: egyetlen blokk kapcsol le mindent.

## 8. Nyelv

Recruiter-magyar: *megbízás, merítés, off-limits, tölcsér, célpiac*.
A gombok a műveletüket nevezik meg. **A hibaüzenet magyarul mondja meg az okot
és a kijáratot** — nyers státuszkód (`HTTP 504`) sosem jut ki a felhasználóig.
A besorolás mindenhol a teljes címkét viseli (`D — most nem javasolt`), nem a
puszta betűt.

## 9. Amit a felület kifelé ad

A fejvadász deliverable-je egy dokumentum, amit a hiring manager elolvas —
nem egy JSON. Elsődleges export: **nyomtatható shortlist** (`exportShortlist`)
a tölcsérrel, az A/B jelöltekkel, az igazolt jelekkel, a tisztázandó
kérdésekkel és az „amit nem tudunk" tételekkel. Másodlagos: CSV, majd JSON.
