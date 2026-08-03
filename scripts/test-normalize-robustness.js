// Egységteszt: coerceGeoFit — determinisztikus, API-hívás és környezeti ág nélkül.
import { coerceGeoFit } from "../core/reach/normalize.js";

function ok(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) process.exitCode = 1;
}

ok("coerceGeoFit: valid value 'in_scope' passes through", coerceGeoFit("in_scope") === "in_scope");
ok("coerceGeoFit: valid value 'adjacent' passes through", coerceGeoFit("adjacent") === "adjacent");
ok("coerceGeoFit: valid value 'out_of_scope' passes through", coerceGeoFit("out_of_scope") === "out_of_scope");
ok("coerceGeoFit: valid value 'unknown' passes through", coerceGeoFit("unknown") === "unknown");
ok("coerceGeoFit: invalid/out-of-schema string (the actual live failure observed, 'unclear') coerces to null", coerceGeoFit("unclear") === null);
ok("coerceGeoFit: undefined coerces to null", coerceGeoFit(undefined) === null);
ok("coerceGeoFit: null stays null", coerceGeoFit(null) === null);

console.log("\nnormalize robusztusság-teszt kész.");
