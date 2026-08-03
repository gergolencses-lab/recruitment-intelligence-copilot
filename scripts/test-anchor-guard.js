// Egységteszt: az anchor sosem eshet ki a vonzáskörzetből (nincs élő API-hívás).
//
// Valós regresszió rögzítése: egy prompt-változat után a 10 lefutott cellából
// 8-ban kimaradt a megbízás helyszíne a catchment_places listából, mert a modell
// "az anchor körüli gyűrűként" értette a listát. A prompt ezt tiltja; ez a
// guard garantálja, hogy a hiba akkor se jusson ki, ha a modell mégis kihagyja.
import { ensureAnchorInScope } from "../core/capabilities.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

const places = (g) => g.catchment_places.map((p) => p.place);

// 1) A valódi hibaeset: Győr anchor, de a lista csak a gyűrűt tartalmazza.
const missing = ensureAnchorInScope(
  {
    search_elasticity: "moderate",
    anchor: "Győr",
    catchment_places: [
      { place: "Mosonmagyaróvár", country: "Magyarország", cross_border: false },
      { place: "Komárno", country: "Szlovákia", cross_border: true },
    ],
  },
  "Győr"
);
ok("hiányzó anchor pótolva", places(missing).includes("Győr"));
ok("a pótolt anchor az ELSŐ elem", places(missing)[0] === "Győr");
ok("a meglévő helyek megmaradnak", places(missing).includes("Mosonmagyaróvár") && places(missing).includes("Komárno"));
ok("a pótlás jelölve van", missing.catchment_places[0].note.includes("automatikusan"));

// 2) Ha már benne van, ne duplázzunk.
const present = ensureAnchorInScope(
  { anchor: "Pécs", catchment_places: [{ place: "Pécs" }, { place: "Komló" }] },
  "Pécs"
);
ok("meglévő anchor nem duplázódik", places(present).filter((p) => p === "Pécs").length === 1);

// 3) Ékezet- és kisbetű-érzéketlen egyezés.
const accent = ensureAnchorInScope(
  { anchor: "Székesfehérvár", catchment_places: [{ place: "szekesfehervar" }, { place: "Mór" }] },
  "Székesfehérvár"
);
ok("ékezet/kisbetű eltérés esetén sem duplázunk", accent.catchment_places.length === 2);

// 4) Összevont mező ("A / B / C") is egyezésnek számít.
const combined = ensureAnchorInScope(
  { anchor: "Gyál", catchment_places: [{ place: "Gyál / Dunaharaszti / Szigetszentmiklós" }] },
  "Gyál"
);
ok("összevont helymezőben felismert anchor nem duplázódik", combined.catchment_places.length === 1);

// 5) Az anchor mező is kitöltődik, ha a modell elhagyta.
const noAnchorField = ensureAnchorInScope({ catchment_places: [{ place: "Budapest" }] }, "Budapest");
ok("hiányzó anchor mező kitöltve", noAnchorField.anchor === "Budapest");

// 6) Degenerált bemenetek nem dobnak.
ok("null geo_scope változatlanul visszajön", ensureAnchorInScope(null, "Győr") === null);
ok("üres location esetén nincs módosítás", ensureAnchorInScope({ catchment_places: [] }, "").catchment_places.length === 0);
ok("hiányzó catchment_places tömbként pótlódik", ensureAnchorInScope({ anchor: "Szeged" }, "Szeged").catchment_places.length === 1);

console.log("\nAnchor-guard teszt kész.");
