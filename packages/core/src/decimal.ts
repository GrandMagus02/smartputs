import DecimalJs from "decimal.js";

DecimalJs.set({ precision: 28, toExpNeg: -21, toExpPos: 40 });

export const Decimal = DecimalJs;
export type Decimal = DecimalJs;
