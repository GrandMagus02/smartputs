import { expect, test } from "bun:test";
import type { UnitLexeme } from "@smartput/core";
import { CURRENCIES } from "./currencies";
import { currencyLexicon } from "./lexicon";

// `Lexicon` allows a bare alias array as well as the full lexeme, and this
// builder always emits the full one — narrowing here rather than asserting the
// shape row by row keeps the tests about the values.
const lexemeOf = (code: string): UnitLexeme => currencyLexicon()[code] as UnitLexeme;

test("every currency gets a lexeme, and the keys are the table's", () => {
  const lexicon = currencyLexicon();
  expect(Object.keys(lexicon)).toEqual(Object.keys(CURRENCIES));
});

test("aliases, symbol and typical band are carried through unchanged", () => {
  for (const [code, def] of Object.entries(CURRENCIES)) {
    const lexeme = lexemeOf(code);
    expect(lexeme.aliases).toEqual(def.aliases);
    expect(lexeme.symbol).toBe(def.symbol);
    expect(lexeme.typical).toEqual(def.typical);
  }
});

/**
 * `display` is what completion inserts, and an absent key and a key set to
 * `undefined` are different things to `exactOptionalPropertyTypes`. CAD and AUD
 * declare none — see `CurrencyDef` for why.
 */
test("display is present exactly where the table declares one", () => {
  const lexicon = currencyLexicon();
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect("display" in (lexicon[code] as object)).toBe(def.display !== undefined);
  }
});

test("a fresh object each call, so a consumer cannot mutate the next one", () => {
  const first = currencyLexicon();
  expect(currencyLexicon()).not.toBe(first);
});
