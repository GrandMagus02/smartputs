import { describe, expect, test } from "bun:test";
import { BOOLEAN_KIND, BOOLEAN_UNIT, composeLocale, createEngine } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_DE from "./locale/de";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";

/**
 * The `de` barrel, checked as a barrel.
 *
 * Every vocabulary in it already has its own suite next to its own `units.ts`,
 * and those suites are where a wrong plural or a missing symbol is caught. What
 * no per-package suite can see is the shape of the *list*: a vocabulary that was
 * never written, or written and never imported here, is invisible to every check
 * that only visits the kinds a locale claims. `assertLocaleContract` is one of
 * those checks — hand it a locale covering fourteen kinds and it will pass,
 * cheerfully, over fourteen kinds. So the first test below counts, and the rest
 * exercise the composed whole the way a consumer wires it.
 *
 * `ukrainian.test.ts` next door is the deep proof of the two-axis machinery;
 * this file deliberately does not repeat it in German. German's own grammar
 * claims — Duden's Maßangabe rule, the dative plural -n on the -er stems — are
 * asserted per package, against the units they are claims about.
 */
const de = composeLocale(german, BUILTIN_DE);

/**
 * `boolean`'s single unit is a sentinel with no word in any language: every
 * value of the kind prints through its own `format` hook ("true"/"false"), so
 * `@smartput/boolean` ships no vocabulary and no language can supply one. The
 * same skip, spelled the same way as `contract.test.ts` and `ukrainian.test.ts`
 * spell it, so a second convention does not appear beside the first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

describe("the German barrel", () => {
  /**
   * The barrel's own contract. A kind translated for fourteen packages and
   * forgotten for the fifteenth shows up here as an inequality and nowhere else
   * — which is the reason `de.ts` is written to diff line-for-line against
   * `en.ts` and `uk.ts` in the first place.
   */
  test("BUILTIN_DE covers exactly what BUILTIN_EN and BUILTIN_UK cover", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_DE)).toEqual(kinds(BUILTIN_EN));
    expect(kinds(BUILTIN_DE)).toEqual(kinds(BUILTIN_UK));
    // And every one of them is German: a file copied from `en` that kept
    // `locale: "en"` composes without complaint and then never matches at all,
    // because the registry is keyed by locale id before it is keyed by word.
    expect([...new Set(BUILTIN_DE.map((v) => v.locale))]).toEqual(["de"]);
  });

  /**
   * `composeLocale` is the only constructor of a `Locale`, and it is where a
   * duplicated kind or a vocabulary naming a kind that no package defines is
   * refused. Calling it at module scope already proves it does not throw; this
   * pins the resulting id, which is what `createEngine` matches an input
   * against.
   */
  test("composes into a locale whose id is the language's", () => {
    expect(de.id).toBe("de");
    expect(de.vocabularies.length).toBe(BUILTIN_DE.length);
  });

  /**
   * The contract over the composed whole: every unit of every kind the locale
   * claims has words, every printed form is a readable alias, no two units of a
   * kind claim one surface. Run twice, the second time with a fractional count,
   * because German's number axis only moves on the feminine units and 1.5 is
   * the count that separates `selectForm`'s "one" from its "other" in the
   * places `Intl.PluralRules` would not.
   */
  test("satisfies the locale contract over every built-in kind", () => {
    assertLocaleContract(de, BUILTIN_KINDS, SKIP_BOOLEAN);
    assertLocaleContract(de, BUILTIN_KINDS, { ...SKIP_BOOLEAN, counts: [1.5] });
  });

  /**
   * End to end, through the engine, one line per package half: the point is not
   * the arithmetic (the kinds own that) but that the words in this barrel are
   * reachable from `evaluate` once composed, in both directions — read a German
   * word, print a German word.
   */
  test("reads and prints German through the engine", () => {
    const e = createEngine({ locales: [de], kinds: BUILTIN_KINDS });
    // Masculine -er stem: uninflected after a numeral, dative plural in -n.
    expect(e.evaluate("5 Kilometer in Meter").formatted).toBe("5.000 Meter");
    // Neuter measure noun: one string for all four form keys.
    expect(e.evaluate("2 Kilogramm in Gramm").formatted).toBe("2.000 Gramm");
    // Feminine: the one class whose number axis is live.
    expect(e.evaluate("2 Meilen in Kilometer").value?.kind).toBe("length");
  });
});
