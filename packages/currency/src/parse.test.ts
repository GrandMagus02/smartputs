import { expect, test } from "bun:test";
import { CURRENCIES } from "./currencies";
import { type AmountError, isCurrency, parseAmount, parseCurrency } from "./parse";

test("every code, alias and display form resolves to its own row", () => {
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect(parseCurrency(code)).toBe(code);
    for (const alias of def.aliases) expect(parseCurrency(alias)).toBe(code);
    for (const word of Object.values(def.display ?? {})) {
      expect(parseCurrency(word)).toBe(code);
    }
  }
});

test("case and surrounding space do not matter", () => {
  expect(parseCurrency("  USD ")).toBe("usd");
  expect(parseCurrency("Dollars")).toBe("usd");
  expect(isCurrency("EUR")).toBe(true);
});

test("a word that is not a currency is null, not a guess", () => {
  for (const word of ["", "xyz", "dollarz", "kg", "30"]) {
    expect(parseCurrency(word)).toBeNull();
    expect(isCurrency(word)).toBe(false);
  }
});

/**
 * The pack in `@smartput/rate` is what teaches the engine "quid", and a parser
 * that knew it without the pack would disagree with an engine that had not been
 * given one. Asserted rather than commented, because it is a claim about a word
 * that is very easy to add here by accident.
 */
test("colloquial words that arrive with a locale pack are not known here", () => {
  for (const word of ["quid", "sterling", "buck", "bucks"]) {
    expect(parseCurrency(word)).toBeNull();
  }
});

test("amount and currency, in the order the engine reads them", () => {
  const parsed = parseAmount("30 usd");
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.amount).toBe(30);
  expect(parsed.currency).toBe("usd");
  expect(parsed.raw).toBe("30");
});

test("grouped, signed, fractional and exponent forms all read", () => {
  const cases: Array<[string, number, string]> = [
    ["1,250.50 dollars", 1250.5, "usd"],
    ["-4 eur", -4, "eur"],
    ["+0.005 usd", 0.005, "usd"],
    ["1e3 jpy", 1000, "jpy"],
    ["1200jpy", 1200, "jpy"],
  ];
  for (const [input, amount, currency] of cases) {
    const parsed = parseAmount(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(parsed.amount).toBe(amount);
    expect(parsed.currency).toBe(currency);
  }
});

/**
 * The grouping is stripped and nothing else is, so a caller who needs the cent
 * to be exact can rebuild it without re-reading the input.
 */
test("raw is the authored digits, ready for a Decimal", () => {
  const parsed = parseAmount("1,250.50 usd");
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.raw).toBe("1250.50");
});

test("each way of failing has its own code", () => {
  const cases: Array<[string, AmountError]> = [
    ["", "empty"],
    ["   ", "empty"],
    ["usd", "nan"],
    ["30", "missing-currency"],
    ["30 dollarz", "unknown-currency"],
    ["30 usd each", "trailing"],
  ];
  for (const [input, code] of cases) {
    const parsed = parseAmount(input);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) continue;
    expect(parsed.code).toBe(code);
  }
});

/**
 * `evaluate("usd 30")` throws, because a unit is written after its quantity.
 * Accepting it here would make this parser take strings the engine refuses,
 * which is the one direction the two must not differ in by default.
 */
test("currency before amount is refused, as the engine refuses it", () => {
  const parsed = parseAmount("usd 30");
  expect(parsed.ok).toBe(false);
});

test("symbols are off by default and read on request", () => {
  expect(parseAmount("$30").ok).toBe(false);

  const parsed = parseAmount("$30", { symbols: true });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.currency).toBe("usd");
  expect(parsed.amount).toBe(30);
});

test("a trailing symbol reads only when it is all that is left", () => {
  const ok = parseAmount("30 €", { symbols: true });
  expect(ok.ok).toBe(true);
  if (ok.ok) expect(ok.currency).toBe("eur");

  expect(parseAmount("30 € each", { symbols: true }).ok).toBe(false);
});

/**
 * `CA$` and `A$` both end in the symbol USD claims, so a shorter-first walk
 * would read "CA$30" as Canada's `CA` followed by thirty dollars — or, worse,
 * as USD with two letters of rubbish in front.
 */
test("a longer symbol wins over the shorter one it ends with", () => {
  for (const [input, code] of [
    ["CA$30", "cad"],
    ["A$30", "aud"],
    ["$30", "usd"],
  ] as const) {
    const parsed = parseAmount(input, { symbols: true });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.currency).toBe(code);
  }
});

test("an explicit word beats a leading symbol that disagrees", () => {
  const parsed = parseAmount("$30 eur", { symbols: true });
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.currency).toBe("eur");
});
