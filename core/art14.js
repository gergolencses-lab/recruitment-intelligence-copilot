// GDPR Art. 14 értesítő-generátor (scraping → adatkezelővé válsz, spec §11).
// Determinisztikus sablon — demo-módban is működik. A felkutatott jelöltet
// tájékoztatni kell: ki az adatkezelő, milyen adat, HONNAN, milyen célból, jogok.
import { audit } from "./audit.js";

export function art14Notice({ candidate, controller }, { projectId } = {}) {
  const c = controller || {};
  const name = c.name || "[ADATKEZELŐ CÉG NEVE]";
  const contact = c.contact || "[adatvédelmi kapcsolat e-mail]";
  const source = (candidate && (candidate.source_url || candidate.source_type)) || "publikusan elérhető szakmai forrás";
  const cand = (candidate && candidate.name) || "[jelölt neve]";

  audit({ capability: "art14Notice", projectId, input: { hasCandidate: !!candidate }, mode: "template" });

  const body = `Tisztelt ${cand}!

Az alábbi tájékoztatót a GDPR 14. cikke alapján küldjük, mert az Ön szakmai adatait toborzási céllal kezeljük.

1) Adatkezelő: ${name}. Kapcsolat: ${contact}.
2) Milyen adatot kezelünk: kizárólag szerep-releváns, publikus szakmai adatokat (név, jelenlegi/korábbi pozíció, szakmai jelek). Nem kezelünk különleges kategóriájú adatot.
3) Az adatok forrása: ${source} (publikusan elérhető információ).
4) A kezelés célja és jogalapja: potenciális álláslehetőséggel kapcsolatos megkeresés. Jogalap: jogos érdek (GDPR 6. cikk (1) f)), dokumentált érdekmérlegelés alapján.
5) Tárolás időtartama: az adott toborzási projekt lezárásáig, illetve az Ön tiltakozásáig.
6) Az Ön jogai: hozzáférés, helyesbítés, törlés, korlátozás, adathordozhatóság, valamint TILTAKOZÁS a jogos érdeken alapuló kezelés ellen — bármikor, indokolás nélkül. Panasszal a NAIH-hoz fordulhat.
7) Ha nem kíván megkereséseket kapni, egyetlen válaszban jelezze, és haladéktalanul töröljük az adatait.

Üdvözlettel,
${name}`;

  return {
    _template: true,
    subject: "Adatkezelési tájékoztató – kapcsolatfelvétel toborzási céllal (GDPR 14. cikk)",
    body,
    legal_basis: "jogos érdek (GDPR 6(1)f) + dokumentált LIA",
    must_send_within: "1 hónap a megszerzéstől, vagy az első kapcsolatfelvételkor",
    note: "Sablon. A tényleges kiküldés előtt az adatkezelő cégadatait és a LIA-t töltsd ki. Jogász-review a skálázás előtt (spec §11).",
  };
}
