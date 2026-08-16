import Decimal from "decimal.js";
import { DECIMAL_BRAND } from "./brand";

Decimal.set({ precision: 28, toExpNeg: -21, toExpPos: 40 });

// Stamped on the prototype, once, next to the precision configuration and for
// the same reason: both are things every Decimal in the repo must be true of,
// and the only place that can be guaranteed is the module that owns the class.
//
// The brand exists so `freeze.ts` can recognise a Decimal without importing
// one — see `brand.ts`. Living on the prototype rather than on each instance
// means it costs nothing per `new Decimal(...)`, and the lookup that reads it
// is one step up a prototype chain that `instanceof` was already walking.
(Decimal.prototype as unknown as Record<symbol, boolean>)[DECIMAL_BRAND] = true;

export { Decimal };
