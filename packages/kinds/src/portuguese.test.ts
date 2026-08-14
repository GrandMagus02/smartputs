import { describe, expect, test } from "bun:test";
import {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  composeLocale,
  createEngine,
  Decimal,
} from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_PT from "./locale/pt";
import BUILTIN_UK from "./locale/uk";

/**
 * The `pt` barrel, checked as a barrel.
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
 * `german.test.ts` next door is this file's twin and was its model; the two
 * differ only where the languages do. Portuguese's own grammar claims live in
 * the per-package suites, against the units they are claims about. What is here
 * instead is the pair of facts that are properties of the *language* and only
 * observable once every kind is composed behind it: that `selectForm` never
 * hands a `forms` table a key it does not hold, and that a grouped number
 * survives a round trip through a language whose group separator is "." —
 * the character English reserves for the decimal point.
 */
const pt = composeLocale(portuguese, BUILTIN_PT);

/**
 * `boolean`'s single unit is a sentinel with no word in any language: every
 * value of the kind prints through its own `format` hook ("true"/"false"), so
 * `@smartput/boolean` ships no vocabulary and no language can supply one. The
 * same skip, spelled the same way as `contract.test.ts`, `ukrainian.test.ts` and
 * `german.test.ts` spell it, so a second convention does not appear beside the
 * first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

describe("the Portuguese barrel", () => {
  /**
   * The barrel's own contract. A kind translated for fifteen packages and
   * forgotten for the sixteenth shows up here as an inequality and nowhere else
   * — which is the reason `locale/pt.ts` is written to diff line-for-line
   * against `locale/en.ts` in the first place.
   */
  test("BUILTIN_PT covers exactly what BUILTIN_EN and BUILTIN_UK cover", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_PT)).toEqual(kinds(BUILTIN_EN));
    expect(kinds(BUILTIN_PT)).toEqual(kinds(BUILTIN_UK));
    // And every one of them is Portuguese: a file copied from `en` that kept
    // `locale: "en"` composes without complaint and then never matches at all,
    // because the registry is keyed by locale id before it is keyed by word.
    expect([...new Set(BUILTIN_PT.map((v) => v.locale))]).toEqual(["pt"]);
  });

  /**
   * `composeLocale` is the only constructor of a `Locale`, and it is where a
   * duplicated kind or a vocabulary naming another language is refused. Calling
   * it at module scope already proves it does not throw; this pins the resulting
   * id, which is what `createEngine` matches an input against.
   */
  test("composes into a locale whose id is the language's", () => {
    expect(pt.id).toBe("pt");
    expect(pt.vocabularies.length).toBe(BUILTIN_PT.length);
  });

  /**
   * The one axis, stated where every kind can be held to it at once.
   *
   * `Intl.PluralRules("pt")` has three categories and `portuguese.selectForm`
   * returns two: it folds CLDR's `many` — which this runtime hands back for
   * every whole multiple of a million — into `other`, because that category is
   * about the *numeral* ("1 milhão" against "1 milhões") and never about the
   * noun after it. The fold is the reason a `forms` table in this language may
   * hold exactly two rows, so it is asserted before the contract run that
   * depends on it rather than left to be inferred from a green suite.
   */
  test("selectForm returns two keys and no more", () => {
    const keys = new Set<string>();
    for (const count of [
      undefined,
      0,
      0.5,
      1,
      1.5,
      2,
      5,
      11,
      21,
      100,
      1000,
      1e6,
      1.5e6,
      2e6,
      1e9,
    ]) {
      for (const slot of ["bare", "after-number", "conversion-target"]) {
        keys.add(
          portuguese.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
    // The two rows English speakers get wrong, both of them CLDR's `i = 0..1`:
    // zero and a half both count as `one` in Portuguese.
    const one = (n: number) =>
      portuguese.selectForm({
        count: new Decimal(n),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      });
    expect(one(0)).toBe("one");
    expect(one(1.5)).toBe("one");
    expect(one(2)).toBe("other");
    // And the fold itself, at the exact value that provokes it.
    expect(new Intl.PluralRules("pt").select(2e6)).toBe("many");
    expect(one(2e6)).toBe("other");
  });

  /**
   * The contract over the composed whole: every unit of every kind the locale
   * claims has words, every printed form is a readable alias, no two units of a
   * kind claim one surface, and every key `selectForm` can produce exists in the
   * table it will index.
   *
   * Run twice, the second time with a fractional count, because the default
   * counts are all integers and Portuguese's `one` reaches past them — 1,5 is
   * `one` here where it is `other` in English, so a vocabulary that wrote its
   * two rows from an English template is only caught by a count with a comma in
   * it.
   */
  test("satisfies the locale contract over every built-in kind", () => {
    assertLocaleContract(pt, BUILTIN_KINDS, SKIP_BOOLEAN);
    assertLocaleContract(pt, BUILTIN_KINDS, { ...SKIP_BOOLEAN, counts: [0.5, 1.5, 2e6] });
  });

  /**
   * End to end, through the engine: the point is not the arithmetic (the kinds
   * own that) but that the words in this barrel are reachable from `evaluate`
   * once composed, in both directions — read a Portuguese word, print one.
   */
  test("reads and prints Portuguese through the engine", () => {
    const e = createEngine({ locales: [pt], kinds: BUILTIN_KINDS });
    expect(e.evaluate("5 quilômetros em metros").formatted).toBe("5.000 metros");
    // The Brazilian spelling prints and the European one reads: "quilómetro"
    // with an acute is the same unit and never comes back out.
    expect(e.evaluate("2 quilómetros").formatted).toBe("2 quilômetros");
    // The plural class no suffix stripper can reach — "galões" is not "galõe"
    // plus an s — which is why `locale/pt.ts` ships an analyzer of its own.
    expect(e.evaluate("2 galões").value?.unit).toBe("gal");
    // Both sides of the boundary English puts in a different place: 1,5 is
    // singular in Portuguese, and so is 0.
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 quilograma");
    expect(e.evaluate("0 gramas").formatted).toBe("0 grama");
  });

  /**
   * The round trip, over the separator that makes it interesting.
   *
   * Portuguese groups thousands with "." and marks the decimal with "," — the
   * two characters swapped from English — so its own printed output is the one
   * input a Portuguese engine is guaranteed to be handed and the one an
   * English-shaped lexer would read as a decimal point. Unlike Ukrainian's
   * U+00A0 this needs no accommodation in `lex`, because "." is an ordinary
   * character that never folds to a space; asserting it here is what would
   * notice the day that stopped being true.
   */
  test("round-trips its own grouped output", () => {
    const e = createEngine({ locales: [pt], kinds: BUILTIN_KINDS });
    for (const input of ["2 kg em g", "1,5 t", "1234567 gramas", "1 hora em minutos"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
    // Spelled out, so the grouping is visible in the assertion rather than only
    // in the round trip above.
    expect(e.evaluate("2 kg em g").formatted).toBe("2.000 gramas");
    expect(e.evaluate("1234567 gramas").formatted).toBe("1.234.567 gramas");
  });
});
