import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { CURRENCIES } from "@smartput/currency";
import { english as en } from "@smartput/locale-en";
import { number } from "@smartput/number";
// Through the package path, not "./en": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact
// that `./locale/en` was missing from it.
import moneyEn from "@smartput/rate/locale/en";
import { money } from "../money";
import { snapshot } from "../snapshot";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 });
const engine = createEngine({
  locales: [composeLocale(en, [moneyEn])],
  kinds: [number, money],
  rates,
});

test("covers every currency the kind declares", () => {
  const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
  expect(Object.keys(moneyEn.units).sort()).toEqual(units.sort());
  expect(moneyEn.locale).toBe("en");
  expect(moneyEn.kind).toBe("money");
});

test("every currency has aliases and a symbol (R8)", () => {
  for (const [unit, words] of Object.entries(moneyEn.units)) {
    expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    expect(words.symbol, `${unit} has no symbol`).toBeDefined();
  }
});

test("the kind itself carries no English word", () => {
  expect(JSON.stringify(money)).not.toMatch(/dollar|pound|yen|franc|zloty|hryvnia/i);
});

/**
 * The `typical` bands moved onto the kind (ruling R3) — a magnitude band is a
 * fact about a unit of account, not about English — and the vocabulary is
 * where the words stayed.
 */
test("typical bands are on the kind, not in the vocabulary", () => {
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect(money.typical?.[code]).toEqual(def.typical);
  }
  for (const words of Object.values(moneyEn.units)) {
    expect(words).not.toHaveProperty("typical");
  }
});

test("spelled-out currency names resolve", () => {
  expect(engine.evaluate("30 dollars").kind).toBe("money");
  expect(engine.evaluate("30 quid").formatted).toBe("£30.00");
});

test("the colloquial aliases fold in without replacing the table's", () => {
  expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
  expect(moneyEn.units.gbp?.aliases).toEqual([
    ...(CURRENCIES.gbp?.aliases ?? []),
    "quid",
    "sterling",
  ]);
  expect(moneyEn.units.usd?.aliases).toEqual([
    ...(CURRENCIES.usd?.aliases ?? []),
    "buck",
    "bucks",
  ]);
  // "euros" is already one of the table's own aliases, so folding the pack's
  // copy in must not double it — an alias indexed twice is a duplicate
  // candidate at every keystroke.
  expect(moneyEn.units.eur?.aliases).toEqual(CURRENCIES.eur?.aliases ?? []);
});

test("plural forms ride along where the table declares them", () => {
  expect(moneyEn.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  // CAD and AUD declare none — a two-word name is not a token the lexer can
  // take back, so omission is the honest answer (see `CurrencyDef.display`).
  expect(moneyEn.units.cad?.forms).toBeUndefined();
});
