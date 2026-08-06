import { expect, test } from "bun:test";
import { createEngine, Decimal } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { CURRENCIES, formatAmount, parseAmount, parseCurrency } from "@smartput/currency";
import { number } from "@smartput/number";
import { money } from "./money";
import { snapshot } from "./snapshot";

/**
 * The split put currency recognition in one package and the `money` kind in
 * another, which creates exactly one new way to be wrong: the two could come to
 * disagree about the same string. `@smartput/currency` says so in prose — "a
 * parser that knew a word the engine had not been given would be the more
 * confusing of the two disagreements" — and prose is not enforcement.
 *
 * This file is the enforcement, and it lives here because this is the side of
 * the boundary that can see both. Only the currencies the shipped rate table
 * quotes are exercised for the *amount*: an unquoted one is a
 * `MissingRateError` before it is anything else, which is a fact about rates and
 * not about parsing, so those rows are asserted on the unit alone.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 170,
  CHF: 0.94,
  PLN: 4.28,
  UAH: 45.5,
  CAD: 1.5,
  AUD: 1.68,
  SEK: 11.2,
  NOK: 11.7,
  CZK: 24.8,
});
const engine = createEngine({ locales: [en], kinds: [number, money], rates });

test("every alias the engine reads, the parser reads to the same currency", () => {
  for (const [code, def] of Object.entries(CURRENCIES)) {
    for (const alias of def.aliases) {
      const evaluated = engine.evaluate(`30 ${alias}`);
      expect(evaluated.kind).toBe("money");
      expect(evaluated.value.unit).toBe(code);
      expect(parseCurrency(alias)).toBe(code);

      const parsed = parseAmount(`30 ${alias}`);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.currency).toBe(code);
    }
  }
});

/**
 * The kind's `format` hook is the guard-digit trim plus `formatAmount`. On a
 * value that never went through a rate the trim is a no-op, so the two have to
 * print the same string — and if the hook ever grows a second currency-shaped
 * decision, this is where it shows.
 */
test("the kind formats an unconverted amount exactly as formatAmount does", () => {
  for (const code of Object.keys(CURRENCIES)) {
    const evaluated = engine.evaluate(`30 ${code}`);
    expect(evaluated.formatted).toBe(formatAmount(new Decimal("30"), code));
  }
});

test("a currency the parser refuses is one the engine refuses too", () => {
  for (const word of ["dollarz", "xyz", "zzz"]) {
    expect(parseCurrency(word)).toBeNull();
    expect(() => engine.evaluate(`30 ${word}`)).toThrow();
  }
});
