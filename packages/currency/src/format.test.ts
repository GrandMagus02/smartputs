import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { CURRENCIES, minorUnitsOf, symbolOf } from "./currencies";
import { formatAmount } from "./format";

const d = (n: string) => new Decimal(n);

test("the scale is the currency's, and the default is two", () => {
  expect(minorUnitsOf("jpy")).toBe(0);
  expect(minorUnitsOf("USD")).toBe(2);
  // A code with no row is not a reason to refuse to print a number.
  expect(minorUnitsOf("vnd")).toBe(2);
});

test("an unknown code falls back to its uppercase self as the symbol", () => {
  expect(symbolOf("usd")).toBe("$");
  expect(symbolOf("vnd")).toBe("VND");
});

test("the minor unit is padded back on, which a Decimal cannot carry", () => {
  expect(formatAmount(d("30"), "usd")).toBe("$30.00");
  expect(formatAmount(d("30"), "jpy")).toBe("¥30");
  expect(formatAmount(d("0.5"), "eur")).toBe("€0.50");
});

test("the sign sits outside the symbol", () => {
  expect(formatAmount(d("-10"), "usd")).toBe("-$10.00");
});

/**
 * A small negative rounded to the minor unit lands on zero, and "-$0.00" reads
 * as a debt of nothing — worse than the zero it is.
 */
test("a negative that rounds to zero loses its sign", () => {
  expect(formatAmount(d("-0.001"), "usd")).toBe("$0.00");
});

test("the rounding mode decides the cent", () => {
  expect(formatAmount(d("2.345"), "usd")).toBe("$2.34");
  expect(formatAmount(d("2.345"), "usd", { rounding: Decimal.ROUND_HALF_UP })).toBe(
    "$2.35",
  );
});

test("the number formatter is injectable, because grouping is the locale's", () => {
  const grouped = formatAmount(d("1234567.5"), "usd", {
    formatNumber: (amount, opts) =>
      amount
        .toFixed(opts.minFractionDigits)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        // The grouping regex above also finds its way into the fraction; the
        // engine's own formatter does not, and this stand-in only has to prove
        // that the hook is called.
        .replace(/,(\d\d)$/, ".$1"),
  });
  expect(grouped.startsWith("$1,234,567")).toBe(true);
});

test("every shipped currency formats to its own symbol", () => {
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect(formatAmount(d("1"), code).startsWith(def.symbol)).toBe(true);
  }
});
