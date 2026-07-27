# Design tokens — Meridian "Reports and Analytics" (TÖRTÉNETI FORRÁS)

> ⚠️ **Ez a dokumentum már NEM az igazság-forrás.** A JEL élő design-nyelvét a
> [`DESIGN.md`](../DESIGN.md) írja le; a tokenek a `app/public/styles.css`
> `:root` blokkjában élnek.
>
> Ez a fájl annak a healthcare-dashboard sablonnak a kivonata, amiből a
> felület első váza származott. Megőrizzük, mert megmagyarázza, honnan jöttek
> bizonyos méretek — de **anti-referenciaként**, nem mintaként: a 2026-07-27-i
> design-átvizsgálás azt találta, hogy a váz méretei egy az egyben átjöttek
> (sidebar 232px, nav item 9px/11 gap/13.5px, topbar 13px 32px, search pill
> 320px + ⌘F chip, oldalcím 24/700/-0.01em), miközben a stíluslap ~28%-a
> olyan Meridian-komponenst írt le, amit semmilyen kódút nem bocsátott ki.
>
> **Az alábbi „RIC-adaptáció" fejezet soha nem épült meg** (fél-donut gauge,
> stepped vonal, radar, sűrű oszlopok). A helyére a tölcsér-motívum került:
> szűkülő menta sávok egy korall döntési pontba — lásd `DESIGN.md`. A hozzá
> tartozó holt CSS (`.kpi-*`, `.chart-*`, `.gauge-*`, `.radar-*`, `.bars`,
> `.ck-status*`, `.proof-*`, `.act-*`, `.stuck-*`) 2026-07-27-én törölve lett.

A `Healthcare Reports Dashboard.dc.html`-ből kinyert design-nyelv.

## Paletta (oklch)
| Szerep | Érték |
|---|---|
| Page bg | `oklch(0.97 0.004 260)` |
| Surface (kártya) | `#fff` |
| Accent (indigó) | `oklch(0.55 0.18 264)` |
| Accent hover/dark | `oklch(0.45 0.19 264)` / `oklch(0.4 0.15 264)` |
| Accent soft (aktív nav pill bg) | `oklch(0.94 0.03 264)` |
| Selection | `oklch(0.9 0.06 264)` |
| Border (kártya) | `oklch(0.92 0.008 260)` |
| Border (sidebar) | `oklch(0.91 0.008 260)` |
| Border (input/gomb) | `oklch(0.88 0.008 260)` |
| Divider | `oklch(0.9–0.93 0.008 260)` |
| Ink 1 (cím) | `oklch(0.2 0.02 260)` / `0.22` / `0.25` |
| Ink 2 (másodlagos) | `oklch(0.45 0.02 260)` / `0.5 0.01` |
| Muted | `oklch(0.55 0.01 260)` / `0.6 0.01` / `0.65 0.01` |
| Nav dot inaktív | `oklch(0.75 0.01 260)` |
| Delta zöld (pozitív) | text `oklch(0.55 0.15 150)`, bg `oklch(0.94 0.04 150)` |
| Delta narancs | text `oklch(0.6 0.16 30)`, bg `oklch(0.95 0.04 40)` |
| Tooltip sötét | bg `oklch(0.22 0.02 260)`, muted `oklch(0.75 0.01 260)` |

**Kategorikus chart-paletta (donut/gauge, 5 szegmens):**
`oklch(0.55 0.18 264)`, `oklch(0.58 0.15 235)`, `oklch(0.6 0.14 205)`, `oklch(0.62 0.13 175)`, `oklch(0.64 0.12 150)`

**KPI ikon-chip tintek (soft bg / dot):**
- indigó: `oklch(0.93 0.04 264)` / `oklch(0.55 0.18 264)`
- kék: `oklch(0.93 0.035 235)` / `oklch(0.58 0.15 235)`
- cián: `oklch(0.93 0.035 205)` / `oklch(0.6 0.14 205)`
- zöld: `oklch(0.93 0.035 150)` / `oklch(0.6 0.13 150)`

## Tipográfia
- Család: `"Helvetica Neue",Helvetica,Arial,sans-serif`; `-webkit-font-smoothing:antialiased`
- Oldalcím 24/700/-0.01em · Kártyacím 14/700 · KPI-szám 26/700 · másodszám 22/700
- Body 13.5 · kis szövegek 13/12/11.5/11 · szekció-label 10.5/700/0.08em/uppercase/`oklch(0.6 0.01 260)`

## Layout
- **Sidebar** 232px, `#fff`, border-right, padding 22px 16px, flex column. Logo (32px accent négyzet radius 9). Szekciók (GENERAL/SERVICE/UTILITY) 10.5px label. Nav item: padding 9px 8px, radius 8, gap 11, 6px dot; **aktív**: bg accent-soft, text `oklch(0.4 0.15 264)`, weight 600, dot accent. UTILITY a `margin-top:auto`-val alul.
- **Topbar** padding 14px 32px, border-bottom, `#fff`. Bal: search pill (bg `oklch(0.96 0.005 260)`, radius 9, padding 9px 14px, width 300, `⌘ F` chip). Jobb: "Share", 1px divider, avatar 32px accent kör + név/email.
- **Content** padding 28px 32px 48px, gap 22, flex column.
- **Header** cím+subtitle bal · jobb: outline pill ("Monthly ▾") + primary "Export" (accent, radius 8, padding 8px 16, weight 600).
- **KPI grid** `repeat(4,1fr)` gap 18. Kártya: `#fff`, 1px border `oklch(0.92 0.008 260)`, radius 12, padding 18px 20. Ikon-chip 34px radius 9 soft-tint + 12px dot; cím 13/600 + subtitle 11; szám 26/700 + delta-badge (11.5/700, pill radius 5 padding 2px 6); leírás 11.5 muted.
- **Chart-kártyák** `#fff`, border, radius 12, padding 20; cím 14/700 + subtitle 11.5. Sor1 grid `1fr 1.7fr`, Sor2 `1.7fr 1fr`, gap 18.

## Chart-matek (a DCLogic renderVals-ból, portolandó)
**Fél-donut gauge** — viewBox `0 0 220 128`, cx110 cy110 r88, 5 szegmens 180°-on, gap 2.4°, `stroke-width:22`, `stroke-linecap:butt`. Középen "Total" + nagy szám. Polar: `x=cx+r*cos(deg*π/180)`, `y=cy+r*sin(...)`; szegmens `M start A r r 0 0 1 end`, indul 180°-tól.

**Vonaldiagram (stepped)** — viewBox `0 0 500 190`, padL30 padR10 top12 bottom30, max=adathoz. Lépcsős: `M p0; for i: L x[i] y[i-1]; L x[i] y[i]`. Gridvonalak `oklch(0.94 0.006 260)`, vonal `oklch(0.55 0.18 264)` sw2. Sötét tooltip box.

**Sűrű oszlopok** — flex, `align-items:flex-end`, height 110px, gap 2px, bar `flex:1;min-width:2px;height:{h}%;border-radius:2px 2px 0 0`. Hue-gradient `264 → 44`. Alatta legend grid 3-col dot+érték.

**Radar** — viewBox `0 0 220 220`, rcx110 rcy110 R78, 5 tengely `-90 + i*72`, gyűrűk `.33/.66/1`, két poligon: A (accent fill `/0.18` stroke accent sw2), B (szürke). Tengely-label R+20, anchor a pozíció szerint.

## RIC-adaptáció (Reports → Recruitment)
- **KPI-k:** Felkutatott jelöltek · „A" prioritás (most üldözd) · Elcsábítási tervek · Outreach draftok. Delta-badge: kontextuális (pl. erős jelek aránya, forrás).
- **Gauge:** jelöltek forrás szerint (linkedin/github/synthetic/web…). Közép = összes.
- **Vonal:** üldözési tölcsér (Felkutatva→Értékelve→A-priorit.→Elcsábítva→Outreach), csökkenő.
- **Oszlopok:** jelöltenkénti jel-erősség pontszám, tier szerint színezve (A/B/C).
- **Radar:** pool-profil vs benchmark — tengelyek: Seniority-jel, Forrás-diverzitás, Evidencia-erő, Üldözés-készültség, Elérhetőség.
