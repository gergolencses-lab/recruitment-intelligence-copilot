# 🎯 Recruitment Intelligence Copilot (RIC)

> **Egy közös mag, két felület.** Web-app (Surface A) + MCP-plugin (Surface B), ugyanarra a Capability API-ra kötve.
> Fejvadász-copilot senior tech / CEE szerepekre. Termék-filozófia: **„no reject, only attract".**

Ez egy **futtatható pilot** — nem mockup. Kulcs nélkül azonnal elindul (demo-mód, realisztikus HU minta-outputokkal); `ANTHROPIC_API_KEY` + `FIRECRAWL_API_KEY` megadásával **élesben** gondolkodik és **élő publikus-web scrapinget** végez.

---

## 🌐 Kipróbálható élesben (publikus link)

> **▶ Élő demo:** _<ide kerül a Render-URL az első telepítés után>_

Bárki megnyithatja és valós keresést futtathat rajta. A backend a Renderen fut, a titkos kulcsok a Render env-változóiban élnek — sosem a repóban. (Ingyenes terv: ~15 perc tétlenség után elalszik, az első kérés ~50 mp hidegindítás, utána gyors.)

### Telepítés Renderre — ~5 perc, egyszeri (Lencsés Gergő lépései)

1. Menj a **[render.com](https://render.com)** oldalra → **Sign in with GitHub** (engedélyezd a privát repo elérését).
2. **New → Blueprint** → válaszd a `recruitment-intelligence-copilot` repót. A Render beolvassa a `render.yaml`-t.
3. Amikor bekéri a **titkos env-változókat**, illeszd be:
   - `ANTHROPIC_API_KEY` → az `sk-ant-…` kulcsod
   - `FIRECRAWL_API_KEY` → az `fc-…` kulcsod
4. **Apply / Create** → a Render buildel és elindítja. Kész, amikor a `/api/status` zöld.
5. Másold a kapott URL-t (`https://recruitment-intelligence-copilot.onrender.com`) ide a README tetejére, és oszd meg akivel akarod.

_Alternatíva:_ [Railway](https://railway.app) vagy [Fly.io](https://fly.io) ugyanígy elviszi — mindkettő olvassa a `package.json` `start` scriptjét.

---

## 🚀 Gyorsindítás lokálisan (2 perc)

```bash
cd "recruitment-intelligence-copilot"
npm install
cp .env.example .env        # (opcionális) töltsd ki a kulcsokat az éles módhoz
npm run app                 # → http://localhost:5178
```

Nyisd meg a böngészőben: **http://localhost:5178**
Hozz létre egy projektet (bal oldalt), illeszd be egy brief-et, és menj végig a vezetett íven:
**Intake → Discover → Rank → ⭐ Attract → Advisory/Interjú → Coach.**

Az MCP-felülethez (a saját AI-eszkzödbe):

```bash
npm run mcp                 # stdio MCP szerver
```

---

## 🟢 Éles mód vs 🟡 Demo mód

| | Nincs kulcs (demo) | Kulccsal (éles) |
|---|---|---|
| **🧠 Agy** (ítélet, elcsábítás, coach) | realisztikus HU minta-outputok | élő Claude (`ANTHROPIC_API_KEY`) |
| **📡 Elérés** (discovery) | 14-fős szintetikus senior-tech-CEE pool | élő Firecrawl publikus-web keresés + scraping (`FIRECRAWL_API_KEY`) |

A felület tetején a badge mindig mutatja, épp melyik módban futsz. **Kulcsot csak a `.env`-be** — sosem a kódba, sosem a kliensbe.

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

## 🧭 „No reject, only attract" — kőbe vésve

A rendszer **soha nem hoz hátrányos döntést a jelöltre.** Nincs „elutasít", „nem alkalmas", „kiszűr".
- `profile_assess` = az üldözés inputja (hol erős, mit tárj fel), nem screening.
- `rank_targets` = üldözési prioritás (A/B/C), **senki nem esik ki** — ezt a `core/guardrails.js` kódban is kikényszeríti.
- `attraction_strategy` = a jelöltet **előnyben részesíti** (udvarol neki), nem sújtja.

Ez veszi le a legnehezebb **AI Act / GDPR Art. 22** terhet (a veszélyzóna a *hátrányos automata döntés*). A scraping viszont **adatkezelővé** tesz → `art14_notice` generátor + provenance-tárolás a beépített válasz.

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
  knowledge/persona.js   🔒 a senior fejvadász elméje (prompt-cache-elt, IP)
  capabilities.js        a 11 képesség (App + MCP közös)
  reach/                 Reach Engine: firecrawl + szintetikus + normalize
  guardrails.js          no-reject + PII-minimalizálás (kódban kikényszerítve)
  store.js  audit.js  art14.js  llm.js  demo.js  config.js
app/                     Surface A — Express + statikus UI (public/)
mcp/                     Surface B — MCP stdio szerver (14 tool)
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
- **Eval-kapu:** golden set (15-30 valós eset) + rubrika, hogy az elcsábítás **mérhetően verje** a vanilla ChatGPT-t.
- **Jogi keményítés:** HU/EU adatvédelmi + AI-Act jogász a skálázás előtt; LIA dokumentálás.
- **Mérés:** elcsábítás pozitív-válasz arány A/B (a pilot elsődleges metrikája).

---

*Model default: `claude-sonnet-5` (állítható a `.env`-ben — `claude-fable-5` a legerősebb ítélethez). Knowledge Core verzió: `kc-2026-07-19.v1`.*
