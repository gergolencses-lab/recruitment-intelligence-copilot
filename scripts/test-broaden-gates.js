// Egységteszt: a kibővítés két kapuja + az álláshirdetés-szűrő (nincs élő API-hívás).
//
// A mért hiba, amit ez rögzít: a kibővítés a NYERS TALÁLATSZÁMHOZ volt kötve,
// miközben a találatok nagy része nem személy. Így 12-13 találatos cellák
// 1-2 jelölttel értek véget anélkül, hogy a tág kör egyáltalán lefutott volna.
import { shouldBroadenOnHits, shouldBroadenOnCandidates } from "../core/reach/reachEngine.js";
import { isJobAdUrl } from "../core/reach/firecrawlReach.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

// ── Előkapu: nyers találatszám ────────────────────────────────────────
ok("előkapu: kevés nyers találat + van tág kör → bővít",
  shouldBroadenOnHits({ hitCount: 3, hasBroad: true, threshold: 6 }) === true);
ok("előkapu: pont a küszöbön (6 < 6 hamis) → NEM bővít",
  shouldBroadenOnHits({ hitCount: 6, hasBroad: true, threshold: 6 }) === false);
ok("előkapu: küszöb alatt eggyel → bővít",
  shouldBroadenOnHits({ hitCount: 5, hasBroad: true, threshold: 6 }) === true);
ok("előkapu: nincs tág kör → sosem bővít",
  shouldBroadenOnHits({ hitCount: 0, hasBroad: false, threshold: 6 }) === false);

// ── Valódi kapu: használható jelöltszám ───────────────────────────────
// Ez a regressziós eset: a Székesfehérvár-cella 12 nyers találattal ÁTMENT az
// előkapun, majd 1 jelölttel ért véget. A jelölt-kapunak itt kell elsülnie.
ok("jelölt-kapu: 12 találat ÁTMEGY az előkapun, de 1 jelölt → mégis bővít",
  shouldBroadenOnHits({ hitCount: 12, hasBroad: true, threshold: 6 }) === false &&
  shouldBroadenOnCandidates({ personCount: 1, alreadyBroadened: false, hasBroad: true, minCandidates: 6 }) === true);
ok("jelölt-kapu: elég jelölt → nem bővít",
  shouldBroadenOnCandidates({ personCount: 9, alreadyBroadened: false, hasBroad: true, minCandidates: 6 }) === false);
ok("jelölt-kapu: pont a küszöbön (6 < 6 hamis) → nem bővít",
  shouldBroadenOnCandidates({ personCount: 6, alreadyBroadened: false, hasBroad: true, minCandidates: 6 }) === false);
ok("jelölt-kapu: már bővítettünk → nem bővít újra (nincs dupla költés)",
  shouldBroadenOnCandidates({ personCount: 0, alreadyBroadened: true, hasBroad: true, minCandidates: 6 }) === false);
ok("jelölt-kapu: nincs tág kör → nem bővít",
  shouldBroadenOnCandidates({ personCount: 0, alreadyBroadened: false, hasBroad: false, minCandidates: 6 }) === false);

// ── Álláshirdetés-szűrő ───────────────────────────────────────────────
// Ezek a valódi r1-futásból kiszedett URL-ek, amelyek a scrape-keretet ették.
const ADS = [
  "https://qjob.hu/szekesfehervar/pro/online-marketing-asszisztens",
  "https://www.profession.hu/allasok/szekesfehervar/1,0,30,marketing",
  "https://www.facebook.com/jobs/valami",
  "https://www.linkedin.com/jobs/view/123456",
  "https://cvonline.hu/allas/marketing-asszisztens",
];
const PEOPLE = [
  "https://hu.linkedin.com/in/peter-baracska-a8976088",
  "https://www.linkedin.com/in/janoskrnak",
  "https://github.com/valaki",
  "https://www.mycompany.hu/rolunk/vezetoseg",
];
ok("álláshirdetés-szűrő: minden valódi hirdetés-URL kiszűrve", ADS.every(isJobAdUrl));
ok("álláshirdetés-szűrő: egyetlen valódi személy-URL sem esik áldozatul", PEOPLE.every((u) => !isJobAdUrl(u)));
ok("álláshirdetés-szűrő: a /in/ profil és a /jobs/ hirdetés elkülönül ugyanazon a domainen",
  isJobAdUrl("https://www.linkedin.com/jobs/view/1") === true &&
  isJobAdUrl("https://www.linkedin.com/in/valaki") === false);

console.log("\nKibővítés-kapu teszt kész.");
