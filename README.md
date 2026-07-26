# JEL — Jelöltből jó döntés

> A termék neve **JEL** (korábban: Recruitment Intelligence). A jel három befutó vonala a különböző forrásokból érkező jeleket, a korall pont a tisztán kirajzolódó következő döntést jelenti. Vizuális nyelv: mélykék oldalsáv (`#263653`), menta akció (`#20CFA8`), korall döntési pont (`#FF5A5F`), meleg törtfehér háttér.

> **Egy közös mag, két felület.** Web-app (Surface A) + MCP-plugin (Surface B), ugyanarra a Capability API-ra kötve.
> AI-támogatott recruitment workspace senior tech / CEE szerepekre. Termék-filozófia: **evidencia-alapú őszinteség** — a jelöltről csak ellenőrzött tény, a megközelítési ötletek nyíltan jelölt feltételezések.
>
> A felület **megbízás-alapú**: egy megbízás = egy ügyfél egy konkrét pozíciója, saját metaadatokkal (pozíció, ügyfél, helyszín, munkavégzés, szint, felelős, státusz), feladatalapú nézetekkel (Áttekintés / Pozíció és brief / Célpiac / Jelöltek / Megkeresések / Ügyfél és interjú / Eredmények / Jegyzetek) és megbízásonként egy kiemelt következő teendővel.

Ez egy **futtatható pilot** — nem mockup. Kulcs nélkül azonnal elindul (demo-mód, realisztikus HU minta-outputokkal); `ANTHROPIC_API_KEY` + `FIRECRAWL_API_KEY` megadásával **élesben** gondolkodik és **élő publikus-web scrapinget** végez.

---

## 🌐 Kipróbálható élesben (publikus link — Vercel)

> **▶ Élő app (Vercel, élő Claude + webes kutatás):** **https://recruitment-intelligence-copilot.vercel.app**
> **▶ Statikus demo (GitHub Pages, mintaadatok, kulcs nélkül):** **https://gergolencses-lab.github.io/recruitment-intelligence-demo/** — a `docs/` tükörből publikálva a publikus [`recruitment-intelligence-demo`](https://github.com/gergolencses-lab/recruitment-intelligence-demo) repón át; frissítés: `scripts/publish-demo.sh`

Bárki megnyithatja és **valós Claude + Firecrawl** keresést futtathat rajta. A szerver a Vercelen fut serverless függvényként; a titkos kulcsok a Vercel env-változóiban élnek — **sosem a repóban, sosem a böngészőben.**

**Architektúra (miért működik ez serverless-en):** a szerver **állapotmentes** — nincs szerveroldali adatbázis. Minden projekt a **látogató saját böngészőjében** él (localStorage), és a művelethez elküldjük a szervernek, ami kiszámolja az eredményt és visszaadja. Így nulla plusz szolgáltatás kell, és minden látogató a saját munkáját látja. A Knowledge Core (`persona.js`) a szerveren marad, webről nem elérhető.

### Telepítés Vercelre — ~5 perc, egyszeri (Lencsés Gergő lépései)

1. Menj a **[vercel.com](https://vercel.com)** oldalra → **Continue with GitHub** (engedélyezd a privát repo elérését).
2. **Add New… → Project** → válaszd a `recruitment-intelligence-copilot` repót → **Import**.
3. A **Environment Variables** résznél add meg a két titkos kulcsot:
   - `ANTHROPIC_API_KEY` → az `sk-ant-…` kulcsod
   - `FIRECRAWL_API_KEY` → az `fc-…` kulcsod
4. **Deploy.** A `vercel.json` mindent beállít (build- és route-szabályok). Kész, amikor a `/api/status` `mode:"live"`-ot ad.
5. Másold a kapott URL-t (`https://…vercel.app`) ide a README tetejére, és oszd meg akivel akarod.

> ⚠️ **Éles kulcsok publikusan:** bárki, akinek elküldöd a linket, a te API-kulcsaidat használja. Beépített **rate-limit** véd (40 művelet / IP / 15 perc), de érdemes költségkeretet állítani az Anthropic/Firecrawl fióknál. Burn-kulcshoz ideális.
>
> ⏱️ **Válaszidő:** az éles Claude-műveletek ~20-40 mp-esek (a `vercel.json` 60 mp-re állítja a függvény-limitet — ez a Hobby-max). Az élő webes jelöltkutatás a leglassabb; ha 60 mp-nél tovább tartana, válts `mintaadatok` forrásra a Célpiac nézetben, vagy tedd Pro-ra a projektet.

---

## 🚀 Gyorsindítás lokálisan (2 perc)

```bash
cd "recruitment-intelligence-copilot"
npm install
cp .env.example .env        # (opcionális) töltsd ki a kulcsokat az éles módhoz
npm run app                 # → http://localhost:5178
```

Nyisd meg a böngészőben: **http://localhost:5178**
Hozz létre egy megbízást (pozíció + ügyfél + alapadatok), illeszd be a briefet, és haladj a vezetett — de nem kényszerített — folyamaton:
**Brief elemzése → Célpiac és jelöltkutatás → Prioritások → Megközelítési terv és üzenetvázlat → Ügyfélegyeztetés / Interjúterv → Eredmények.**

Az MCP-felülethez (a saját AI-eszkzödbe):

```bash
npm run mcp                 # stdio MCP szerver
```

---

## 📘 A folyamat — mi mit csinál

- **[`product-docs/FOLYAMAT.md`](product-docs/FOLYAMAT.md)** — a folyamat igazság-forrása: folyamatábra (Mermaid), lépésenkénti leírás, és hogy melyik lépés miért így működik. Ha egy lépés viselkedése változik, itt kell először átírni.
- **[`product-docs/folyamatabra.html`](product-docs/folyamatabra.html)** — ugyanez vizuálisan, egy képernyőn, kattintható lépés-magyarázatokkal. Nyisd meg böngészőben; ügyfélbemutatóhoz és onboardinghoz készült.
- **[`product-docs/HELP-FAQ-TERV.md`](product-docs/HELP-FAQ-TERV.md)** — a felületi súgó (`?` gombok) és a GYIK terve: hol legyen segítség és hol ne, milyen interakcióval, teljes, másolásra kész szöveggel és implementációs vázlattal.

---

## 🟢 AI elérhető vs 🟡 Bemutató mód

| | Nincs kulcs (demo) | Kulccsal (éles) |
|---|---|---|
| **🧠 Elemzés** (értékelés, megközelítési terv, módszertani segítség) | realisztikus HU minta-outputok | élő Claude (`ANTHROPIC_API_KEY`) |
| **📡 Jelöltkutatás** | 14-fős minta-készlet (senior tech / CEE) | élő keresés nyilvánosan elérhető szakmai forrásokban (`FIRECRAWL_API_KEY`) |

A felület mindig mutatja, épp melyik módban futsz (AI elérhető / Bemutató mód, élő források / mintaadatok). **Kulcsot csak a `.env`-be** — sosem a kódba, sosem a kliensbe.

Kulcsok:
- **Anthropic** — https://console.anthropic.com → `ANTHROPIC_API_KEY`
- **Firecrawl** — https://www.firecrawl.dev → `FIRECRAWL_API_KEY` (Bearer, `fc-...`)

---

## 📡 A scraping — mit csinál és mit NEM (őszintén)

A Reach Engine **Firecrawl-alapú publikus-web discovery**:
- **Keresés:** célzott lekérdezések (site: operátorokkal) publikus profilokra — LinkedIn-URL-ek, GitHub, cég-oldalak, konferencia-programok, blogok.
- **Scrapelés:** a ténylegesen elérhető publikus oldalak (GitHub, cég-oldal, konferencia-bio, személyes site) mélyebb kiolvasása → AI-extrakció normalizált jelölt-rekordokba, **provenance + GDPR Art.14 státusz** mezőkkel.

**Amit tudatosan NEM csinál** (spec §11 + működési realitás):
- ❌ Nincs **belépett / fake-account LinkedIn-scraping.** A LinkedIn a hiQ-ügyet *szerződésszegésen* nyerte; a belépett scraping ToS-bukó, ban-kockázat, és egy pilotban fenntarthatatlan. A LinkedIn profil-oldal jellemzően auth-fal mögött van → onnan csak a kereső-snippet marad.
- A **valódi mélységet** ezért a scrapelhető publikus források adják.

A motor egy **tiszta interfész** (`core/reach/reachEngine.js`) mögött ül — ide csatolható be később a residential-proxy / identitás-pool bővítés vagy egy adat-vendor feed (spec §5), a felületek érintése nélkül.

---

## 🧭 Evidencia-alapú őszinteség — kőbe vésve

A legfontosabb szabály: a rendszer **a jelöltről csak ellenőrzött tényt állíthat** — amit a jeleiből (signals) evidenciálisan vissza lehet vezetni. Kitalált munkahely/szerep/motiváció TILOS.
- `profile_assess` = **őszinte fit-ítélet** (erős / közepes / gyenge / nem fit), evidenciára építve — a rendszer kimondhatja, ha valaki nem fit.
- `rank_targets` = őszinte prioritási javaslat (A — elsőként keresd meg / B — következő kör / C — figyelőlista / **D — most nem javasolt**). Elszámoltathatóság: mindenki megjelenik a rangsorban (nem esik ki némán), de a javaslat lehet elutasító — ezt a `core/guardrails.js` `assertRankingComplete` kényszeríti. A prioritást a recruiter a felületen felülbírálhatja.
- `attraction_strategy` = **két élesen elválasztott rész**: (1) *grounded read* — csak a jelekből visszavezethető tény, jel-hivatkozással + „amit nem tudunk" lista; (2) *approach ideas* — 3 **nyíltan feltételezés-alapú** megközelítési ötlet, összevetve (a legerősebb részletesen, kettő röviden). A `groundAttraction` guard kiszűri a nem-földelt állításokat.

A scraping **adatkezelővé** tesz → `art14_notice` generátor + provenance-tárolás a beépített válasz. Az őszinte fit-ítélet miatt a folyamat **emberi döntést** támogat (a recruiter dönt), nem automatizált elutasítást.

---

## 🏗️ Architektúra — egy mag, két felület

```
                 ┌──────────────────────────────┐
  Web App  ─────▶│                              │
 (Surface A)     │   core/  (KÖZÖS MAG)          │
                 │   ├─ capabilities.js          │──▶ Claude API (prompt-cache)
  MCP plugin ───▶│   ├─ knowledge/persona.js  🔒 │
 (Surface B)     │   ├─ reach/ (Firecrawl 📡)    │──▶ Firecrawl (publikus web)
                 │   ├─ guardrails.js (no-reject)│
                 │   ├─ store.js (projekt-siló)  │──▶ data/ (JSON, gitignore)
                 │   └─ audit.js (AI Act napló)  │
                 └──────────────────────────────┘
```

Az App és az MCP **kizárólag** a `core/index.js`-t importálja. A **Knowledge Core** (`persona.js` — a senior ítélet, az IP-moat) és a Reach-logika **szerver-oldalon marad**, sosem megy a kliensbe.

### Fájlszerkezet
```
core/
  knowledge/persona.js   🔒 a rendszer szakmai tudásbázisa (prompt-cache-elt, IP)
  capabilities.js        a 11 képesség (App + MCP közös)
  reach/                 Reach Engine: firecrawl + szintetikus + normalize
  guardrails.js          elszámoltathatóság + evidencia-földelés + PII-minimalizálás
  store.js  audit.js  art14.js  llm.js  demo.js  config.js
app/                     Surface A — Express + statikus UI (public/)
mcp/                     Surface B — MCP stdio szerver (14 tool)
product-docs/            folyamat-leírás, vizuális folyamatábra, súgó/GYIK-terv
scripts/                 smoke.js, test-mcp.js
```

---

## 🔌 MCP bekötése (Claude Desktop)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recruitment-copilot": {
      "command": "node",
      "args": ["/ABSZOLÚT/ÚT/recruitment-intelligence-copilot/mcp/server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "FIRECRAWL_API_KEY": "fc-..."
      }
    }
  }
}
```

Indítsd újra a Claude Desktop-ot. A 14 tool (`intake_reframe`, `discover_candidates`, `attraction_strategy`, …) megjelenik. A tudás + a scraping a szerveren marad; a kliens csak a tool-okat látja.

---

## ✅ Tesztelés

```bash
npm run smoke      # a mag végigfut demo-módban + guardrail-tesztek
node scripts/test-mcp.js   # az MCP-szerver 14 toolja felcsatlakozva
```

---

## 🗺️ Innen tovább (Fázis 2 — spec szerint)

- **Éles adat-tár:** JSON-store → Postgres + pgvector + **RLS** (tenant-izoláció).
- **Reach Engine ipari skálázás:** residential/ISP proxy + identitás-pool a `reachEngine` seam mögé; vagy vendor-feed párhuzam.
- **Eval-kapu:** golden set (15-30 valós eset) + rubrika, hogy a megközelítési javaslat **mérhetően verje** a vanilla ChatGPT-t.
- **Jogi keményítés:** HU/EU adatvédelmi + AI-Act jogász a skálázás előtt; LIA dokumentálás.
- **Mérés:** válaszadási arány és pozitív válaszok aránya külön mutatóként, A/B a korábbi kézi válaszaránnyal szemben (a pilot elsődleges metrikája).

---

*Model default: `claude-sonnet-5` (állítható a `.env`-ben — `claude-fable-5` a legerősebb ítélethez). Knowledge Core verzió: `kc-2026-07-19.v2`.*
