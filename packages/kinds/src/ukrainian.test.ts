import { describe, expect, test } from "bun:test";
import {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  composeLocale,
  createEngine,
  type Locale,
} from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";

/**
 * Ukrainian, as proof (spec §8).
 *
 * The point of the language is not that the repo speaks two languages; it is
 * that Ukrainian grammar needs two axes where English needs one — case *and*
 * number — so `ukrainian.selectForm` returns `` `${case}-${category}` `` and a
 * unit's `forms` table carries eight keys instead of two. A design that only
 * ever ran against English could have shipped a one-dimensional `display`
 * string and looked finished. The fourth row below is the one that would have
 * had nowhere to live.
 *
 * Everything here is asserted through `createEngine`, not against a vocabulary
 * table, because the claim is about the whole path: read Ukrainian, choose a
 * form key from the slot and the count, index the words, print. The per-package
 * `locale/uk.test.ts` files check each vocabulary against its own `units.ts`;
 * this checks the sixteen of them at once, wired the way a consumer wires them.
 */
const uk = composeLocale(ukrainian, BUILTIN_UK);
const en = composeLocale(english, BUILTIN_EN);

const engineFor = (locale: Locale) =>
  createEngine({ locales: [locale], kinds: BUILTIN_KINDS });

/**
 * `boolean`'s single unit is a sentinel with no word in any language, and that
 * is the design rather than an omission: every value of the kind prints through
 * its own `format` hook ("true"/"false"), the unit id never reaches a user, and
 * `@smartput/boolean` ships no vocabulary at all. `contract.test.ts` next door
 * passes exactly this for English; the same skip, spelled the same way, so a
 * second convention does not appear beside the first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

/**
 * English's one printed string English cannot read: `length:in`'s symbol is
 * "in", core's conversion keyword, which `lex` emits as a keyword token and
 * which `@smartput/length/locale/en` therefore drops from `aliases` on purpose.
 * `contract.test.ts` carries the full reasoning beside the describe that pins
 * the keyword collision; the waiver is repeated here rather than folded into
 * `SKIP_BOOLEAN` because Ukrainian needs no such waiver — its inch is "дюйм",
 * an alias, symbol and `forms` entry at once.
 */
const EN_ONLY = { ...SKIP_BOOLEAN, skipPrintable: ["length:in"] } as const;

describe("Ukrainian, as proof (spec §8)", () => {
  const engine = engineFor(uk);

  test.each([
    // 1 is CLDR's `one`: nominative singular, and the same word a bare unit is.
    ["1 кілограм", "1 кілограм"],
    // 2 is `few`: the nominative plural, which is not what 5 takes.
    ["2 кг", "2 кілограми"],
    // 5 is `many`: the genitive plural. English has no second plural to pick
    // between, which is why one `plural` string was enough for it and is not
    // enough here.
    ["5 кг", "5 кілограмів"],
    // The row the one-dimensional model could not express. Two things happen at
    // once: the conversion *target* is chosen with no count in hand — so
    // `selectForm` returns `loc-other`, the locative — and the *result* is
    // grouped with U+00A0, Ukrainian's thousands separator. The escape is
    // written out because a literal NBSP is invisible in source and silently
    // degrades to a plain space the moment someone retypes the line.
    ["2 кг в грамах", "2\u00A0000 грамів"],
    // A spelled numeral, read through `ukrainian.numerals`, then printed as
    // digits. 22 ends in 2, so CLDR calls it `few` and it takes the nominative
    // plural — the category follows the last digit, not the magnitude.
    ["двадцять два кг", "22 кілограми"],
  ])("%s -> %s", (input, expected) => {
    expect(engine.evaluate(input).formatted).toBe(expected);
  });

  /**
   * Spec §9's four checks, over the whole roster, once per language. It is not
   * one test per kind because that is not how the assertion reports: it collects
   * every problem across every unit and names them all in one message, so the
   * sixteenth vocabulary's gap is visible on the first run.
   *
   * Both languages, in one test, because the check that matters is symmetry — a
   * contract only English satisfies is a contract shaped around English.
   */
  test("both languages satisfy the contract", () => {
    expect(() => assertLocaleContract(uk, BUILTIN_KINDS, SKIP_BOOLEAN)).not.toThrow();
    expect(() => assertLocaleContract(en, BUILTIN_KINDS, EN_ONLY)).not.toThrow();
    // The default counts are every integer category and none of the fractional
    // one, so `nom-other`/`loc-other` — genitive *singular* in Ukrainian, the
    // row that is easiest to fill with a plural and hardest to notice — go
    // unsampled unless a fractional count is asked for by name.
    const counts = [0, 1, 2, 5, 11, 21, 100, 1000, 1.5];
    expect(() =>
      assertLocaleContract(uk, BUILTIN_KINDS, { ...SKIP_BOOLEAN, counts }),
    ).not.toThrow();
    expect(() =>
      assertLocaleContract(en, BUILTIN_KINDS, { ...EN_ONLY, counts }),
    ).not.toThrow();
  });

  /**
   * Independently per language: each engine is built from one locale and reads
   * only its own output back. A round trip that passed only because the other
   * language's aliases were also installed would prove nothing about either.
   *
   * The uk list keeps "2 кг в грамах" in it deliberately — its output carries
   * the U+00A0 group separator that `normalize()` folds to a plain space, so it
   * is the input a Ukrainian engine is guaranteed to be handed and the one it
   * was, until `lex` learned to read the folded separator back, unable to parse.
   */
  test("round-trips independently per language", () => {
    for (const [locale, inputs] of [
      [uk, ["5 кг", "2 кг в грамах", "1,5 кілограма"]],
      [en, ["5 kg", "2 kg in grams", "1.5 kilograms"]],
    ] as const) {
      const e = engineFor(locale);
      for (const input of inputs) {
        const label = `${locale.id}: ${input}`;
        const once = e.evaluate(input);
        const twice = e.evaluate(once.formatted);
        // `toFixed()`, not `toString()`: two Decimals equal in value can differ
        // in exponent notation, and it is the value that has to survive.
        expect(twice.value?.canonical.toFixed(), label).toBe(
          once.value?.canonical.toFixed(),
        );
        expect(twice.value?.unit, label).toBe(once.value?.unit);
      }
    }
  });

  /**
   * A printed product symbol reads back as the product it is — the acceptance
   * case for `parse/lex.ts` lexing the SI multiplication dot as `*`.
   *
   * "кВт·год" is `energy:kwh`'s Ukrainian symbol, so this is a string the engine
   * itself emits. It is not reachable as an alias and does not need to be: no
   * unit word can contain "·" (the lexer ends a word there), so what the
   * resolver receives is kilowatt, `*`, hour — and `@smartput/energy`'s
   * `* | power | duration` signature, the one that already answers "2 kw * 3 h",
   * answers this too. The same mechanism English has always relied on for
   * "m/s": that symbol is not an alias either, it re-reads because "/" is an
   * operator and length ÷ duration computes to a speed.
   *
   * The dot characters are escaped here for the reason the table escapes them —
   * U+00B7 is not distinguishable from "." in a test that claims it is not a
   * decimal point.
   */
  test("a printed product symbol reads back as the product it is", () => {
    const KWH = "\u043A\u0412\u0442"; // кВт
    const HOUR = "\u0433\u043E\u0434"; // год
    // 5 kW for an hour: 5000 W × 3600 s, in canonical joules.
    for (const dot of ["\u00B7", "\u00D7", "\u22C5"]) {
      const result = engine.evaluate(`5 ${KWH}${dot}${HOUR}`);
      expect(result.value?.kind, dot).toBe("energy");
      expect(result.value?.canonical.toFixed(), dot).toBe("18000000");
    }
    // Not a Ukrainian operator: the character is accepted in every language,
    // because a spec sheet pasted into an English engine carries it too.
    expect(engineFor(en).evaluate("2 \u00B7 3").formatted).toBe("6");
    // And a dot between two digits multiplies rather than pointing off a
    // decimal — in Ukrainian, whose decimal separator is ",", and in English,
    // whose is the ASCII "." this character is not.
    for (const locale of [uk, en]) {
      const one = engineFor(locale).evaluate("1\u00B75");
      expect(one.value?.canonical.toFixed(), locale.id).toBe("5");
    }
  });

  /**
   * The barrel's own contract, which nothing above would catch: a vocabulary
   * left out of `BUILTIN_UK` makes every check above pass over fifteen kinds
   * instead of sixteen and says nothing, because `assertLocaleContract` only
   * visits the kinds a locale claims.
   */
  test("BUILTIN_UK covers exactly what BUILTIN_EN covers", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_UK)).toEqual(kinds(BUILTIN_EN));
    // And every one of them is Ukrainian: a copied file that kept `locale: "en"`
    // composes without complaint and then never matches at all.
    expect([...new Set(BUILTIN_UK.map((v) => v.locale))]).toEqual(["uk"]);
  });

  /**
   * English is frozen (spec §11). `parity.test.ts` in core is the corpus-wide
   * net; this is the byte a reader of *this* file can check, so that a change
   * which moves English cannot look like a Ukrainian change that happened to
   * pass.
   */
  test("English output has not moved", () => {
    const e = engineFor(en);
    expect(e.evaluate("2 kg in grams").formatted).toBe("2,000 grams");
    expect(e.evaluate("1 kilogram").formatted).toBe("1 kilogram");
    expect(e.evaluate("5 kg").formatted).toBe("5 kilograms");
    expect(e.evaluate("twenty two kg").formatted).toBe("22 kilograms");
  });
});
