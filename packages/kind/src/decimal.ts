import Decimal from "decimal.js";

Decimal.set({ precision: 28, toExpNeg: -21, toExpPos: 40 });

export { Decimal };
