// A 4×4 földrajzi/specifikációs értékelő-rács bemenetei.
//
// A négy szerep szándékosan a földrajzi rugalmasság teljes skáláját feszíti ki:
// két bőséges helyi kínálatú támogató szerep (tight), egy szakértői IC-szerep
// (moderate) és egy valódi felsővezetői keresés (loose). A briefek részletessége
// is szándékosan eltér — a "túlspecifikált brief" és a "csak-elég-jó brief"
// egyaránt szerepel a mintában.

export const ROLES = [
  {
    key: "marketing-asszisztens",
    label: "Marketing asszisztens",
    // Szándékosan VÉKONY brief: a hiring manager nem írt le mindent.
    // Ezt teszteli az 1b) probléma: az elégséges brief is működjön.
    expected_elasticity: "tight",
    elasticity_tolerance: ["tight"],
    position: {
      title: "Marketing asszisztens",
      client: "",
      location: null, // a rács tölti ki
      work_mode: "helyszíni",
      seniority: "belépő",
      owner: "Kovács Anna",
    },
    brief: `Keresünk egy marketing asszisztenst a marketing csapat mellé. Napi feladat a közösségi média posztok ütemezése, a hírlevél összeállítása, rendezvényeken a standdal kapcsolatos szervezés, és a marketinges anyagok adminisztrációja. Kell hozzá jó helyesírás és igényes fogalmazás magyarul, Canva vagy hasonló alapszintű ismerete. Angol nyelvtudás előny.

Pályakezdőt is elfogadunk, ha van gyakornoki tapasztalata. Bruttó 450-550 ezer forint körül tudunk fizetni. Fontos, hogy bejárjon az irodába, mert a csapat együtt dolgozik.`,
  },

  {
    key: "gyartasmernok",
    label: "Gyártásmérnök",
    // Szándékosan TÚLSPECIFIKÁLT brief: a hiring manager mindent must-have-ként
    // írt le. Ezt teszteli az 1) probléma: a szűk kör ne szűküljön nullára.
    expected_elasticity: "moderate",
    elasticity_tolerance: ["moderate"],
    position: {
      title: "Gyártásmérnök (folyamatfejlesztés)",
      client: "",
      location: null,
      work_mode: "helyszíni",
      seniority: "senior",
      owner: "Nagy Tamás",
    },
    brief: `Gyártásmérnököt keresünk a présüzem és a hegesztő sorok folyamatfejlesztésére. Elvárások: gépészmérnök vagy mechatronikai mérnök MSc diploma; minimum 5 év autóipari gyártási tapasztalat Tier-1 beszállítónál; IATF 16949 rendszerben szerzett gyakorlat; APQP, PPAP, FMEA és MSA dokumentációk önálló készítése; Six Sigma Green Belt minősítés; lean gyártási eszközök (VSM, SMED, Kaizen) gyakorlati alkalmazása; CATIA V5 vagy Siemens NX ismeret; SAP PP modul napi szintű használata; folyékony angol tárgyalóképes szint ÉS német középfok; tapasztalat robotcellák (KUKA vagy FANUC) programozásának felügyeletében; statisztikai folyamatszabályozás (SPC) Minitab-bal.

Az illetőnek képesnek kell lennie a német anyavállalattal önállóan egyeztetni, és havonta 1-2 alkalommal kiutazni. Azonnali kezdés, 3 műszakos üzem melletti nappali munkarend.`,
  },

  {
    key: "vezetoi-asszisztens",
    label: "Vezetői asszisztens",
    expected_elasticity: "tight",
    elasticity_tolerance: ["tight"],
    position: {
      title: "Vezetői asszisztens (ügyvezetői)",
      client: "",
      location: null,
      work_mode: "helyszíni",
      seniority: "közép",
      owner: "Szabó Judit",
    },
    brief: `Az ügyvezető mellé keresünk vezetői asszisztenst. Feladatok: naptárkezelés és utazásszervezés, ügyvezetői levelezés szűrése, testületi ülések előkészítése és emlékeztetők vezetése, bizalmas dokumentumok kezelése, kisebb belső projektek koordinálása, vendégek fogadása.

Elvárás: legalább 3 év asszisztensi vagy irodavezetői tapasztalat, tárgyalóképes angol, magabiztos Office-használat, diszkréció. Az ügyvezető sokat utazik, ezért rugalmasság kell. A pozíció teljes egészében irodai jelenlétet igényel, mert napi fizikai kapcsolattartás a feladat lényege.`,
  },

  {
    key: "bank-vezerigazgato",
    label: "Bank vezérigazgató",
    expected_elasticity: "loose",
    elasticity_tolerance: ["loose"],
    position: {
      title: "Vezérigazgató (bank)",
      client: "",
      location: null,
      work_mode: "helyszíni",
      seniority: "C-szint",
      owner: "Igazgatóság",
    },
    brief: `Egy közepes méretű, hazai tulajdonú kereskedelmi bank vezérigazgatói pozíciójára keresünk jelöltet. A bank mérlegfőösszege 400 milliárd forint körüli, elsősorban vállalati és agrárfinanszírozásban erős, 40 fiókkal.

Az új vezérigazgató feladata a digitális transzformáció végigvitele, a lakossági üzletág újrapozicionálása, és a tulajdonosi kör által kitűzött tőkearányos megtérülési cél elérése három éven belül.

Elvárás: minimum 10 év bankszektorban szerzett felsővezetői tapasztalat, ebből legalább 5 év igazgatósági vagy közvetlen vezérigazgató-helyettesi szinten; MNB alkalmassági követelményeinek való megfelelés; bizonyított eredmény digitális banki transzformációban; erős kockázatkezelési szemlélet. Nemzetközi banki tapasztalat előny.`,
  },
];

// Öt várost neveztél meg, de a rács 4×4 = 16 keresés. A négy kiválasztott város
// négy KÜLÖNBÖZŐ földrajzi archetípust képvisel — Szeged Pécsre nagyon hasonló
// eset (elszigetelt, határközeli regionális központ), ezért ő maradt ki:
//   Budapest         — főváros, önmagában teljes munkaerőpiac
//   Győr             — határ menti, valódi határon-átnyúló ingázással (SK/AT)
//   Pécs             — elszigetelt déli központ, gyenge vonzáskörzettel
//   Székesfehérvár   — Budapest árnyékában: a legnehezebb rugalmassági teszt
export const CITIES = [
  { key: "budapest", name: "Budapest" },
  { key: "gyor", name: "Győr" },
  { key: "pecs", name: "Pécs" },
  { key: "szekesfehervar", name: "Székesfehérvár" },
];

export function cells() {
  const out = [];
  for (const role of ROLES) {
    for (const city of CITIES) {
      out.push({
        id: `${role.key}__${city.key}`,
        role,
        city,
        position: { ...role.position, location: city.name },
      });
    }
  }
  return out;
}
