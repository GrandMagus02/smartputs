import { expect, test } from "bun:test";
import { CURRENCIES } from "./currencies";
import { currencyVocabulary } from "./lexicon";

test("every currency gets an entry, and the keys are the table's", () => {
  const vocab = currencyVocabulary();
  expect(Object.keys(vocab.units)).toEqual(Object.keys(CURRENCIES));
});

test("it names the money kind by id and defaults to English", () => {
  expect(currencyVocabulary().locale).toBe("en");
  expect(currencyVocabulary().kind).toBe("money");
  expect(currencyVocabulary("uk").locale).toBe("uk");
});

test("aliases and symbol are carried through unchanged", () => {
  const vocab = currencyVocabulary();
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect(vocab.units[code]?.aliases).toEqual(def.aliases);
    expect(vocab.units[code]?.symbol).toBe(def.symbol);
  }
});

/**
 * The magnitude band completion scores against is not language, so it stayed
 * on the kind (ruling R3) and never enters a vocabulary. `CurrencyDef` is
 * still where it is written down — `@smartput/rate`'s `money.ts` reads it from
 * the same table this loop reads the words from.
 */
test("the typical band does not come along", () => {
  for (const words of Object.values(currencyVocabulary().units)) {
    expect(words).not.toHaveProperty("typical");
  }
});

/**
 * `forms` is what completion inserts, and an absent key and a key set to
 * `undefined` are different things to `exactOptionalPropertyTypes`. CAD and
 * AUD declare no display forms — see `CurrencyDef` for why.
 */
test("forms is present exactly where the table declares a display", () => {
  const vocab = currencyVocabulary();
  for (const [code, def] of Object.entries(CURRENCIES)) {
    expect("forms" in (vocab.units[code] as object)).toBe(def.display !== undefined);
    if (def.display !== undefined) expect(vocab.units[code]?.forms).toEqual(def.display);
  }
});

test("a fresh object each call, so a consumer cannot mutate the next one", () => {
  const first = currencyVocabulary();
  expect(currencyVocabulary()).not.toBe(first);
});

/**
 * Frozen at its definition site like every other public artifact — and the
 * table it was generated from is *not*, because freezing `CURRENCIES`' own
 * arrays through it would immobilise an export this module only reads.
 */
test("the vocabulary is deep-frozen and the source table is not", () => {
  const vocab = currencyVocabulary();
  expect(Object.isFrozen(vocab)).toBe(true);
  expect(Object.isFrozen(vocab.units.usd)).toBe(true);
  expect(Object.isFrozen(vocab.units.usd?.aliases)).toBe(true);
  expect(Object.isFrozen(CURRENCIES.usd?.aliases)).toBe(false);
});
