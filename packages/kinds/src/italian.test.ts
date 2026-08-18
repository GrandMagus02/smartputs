import { describe, expect, test } from "bun:test";
import {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  buildKeywords,
  composeLocale,
  createEngine,
  Decimal,
} from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { italian } from "@smartput/core/locale/it";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_IT from "./locale/it";
import BUILTIN_UK from "./locale/uk";

/**
 * The `it` barrel, checked as a barrel.
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
 * `german.test.ts` and `portuguese.test.ts` next door are this file's twins and
 * were its model; the three differ only where the languages do. Italian's own
 * grammar claims — the vowel-substituting plural, the invariant consonant-final
 * loanwords — live in the per-package suites, against the units they are claims
 * about. What is here instead are the facts that are properties of the
 * *language* and only observable once every kind is composed behind it: that
 * `selectForm` never hands a `forms` table a key it does not hold, that a
 * grouped number survives a round trip through a language whose group separator
 * is ".", and that Italian's connectives can be installed beside another
 * language's without either losing a word.
 */
const it = composeLocale(italian, BUILTIN_IT);

/**
 * `boolean`'s single unit is a sentinel with no word in any language: every
 * value of the kind prints through its own `format` hook ("true"/"false"), so
 * `@smartput/boolean` ships no vocabulary and no language can supply one. The
 * same skip, spelled the same way as `contract.test.ts`, `ukrainian.test.ts`,
 * `german.test.ts` and `portuguese.test.ts` spell it, so a second convention
 * does not appear beside the first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

describe("the Italian barrel", () => {
  /**
   * The barrel's own contract. A kind translated for fifteen packages and
   * forgotten for the sixteenth shows up here as an inequality and nowhere else
   * — which is the reason `locale/it.ts` is written to diff line-for-line
   * against `locale/en.ts` in the first place.
   */
  test("BUILTIN_IT covers exactly what BUILTIN_EN and BUILTIN_UK cover", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_IT)).toEqual(kinds(BUILTIN_EN));
    expect(kinds(BUILTIN_IT)).toEqual(kinds(BUILTIN_UK));
    // And every one of them is Italian: a file copied from `en` that kept
    // `locale: "en"` composes without complaint and then never matches at all,
    // because the registry is keyed by locale id before it is keyed by word.
    expect([...new Set(BUILTIN_IT.map((v) => v.locale))]).toEqual(["it"]);
  });

  /**
   * `composeLocale` is the only constructor of a `Locale`, and it is where a
   * duplicated kind or a vocabulary naming another language is refused. Calling
   * it at module scope already proves it does not throw; this pins the resulting
   * id, which is what `createEngine` matches an input against.
   */
  test("composes into a locale whose id is the language's", () => {
    expect(it.id).toBe("it");
    expect(it.vocabularies.length).toBe(BUILTIN_IT.length);
  });

  /**
   * The one axis, stated where every kind can be held to it at once.
   *
   * `Intl.PluralRules("it")` declares three categories and `italian.selectForm`
   * returns two: it folds CLDR's `many` into `other`. `many` is not a plural —
   * this runtime hands it back for an exact million and for nothing else, not
   * even 1.500.000 — because it exists for the compact register "un milione **di**
   * chilogrammi", which this engine never prints. The fold is the reason a
   * `forms` table in this language may hold exactly two rows, so it is asserted
   * here, at the values that provoke it, rather than left to be inferred from a
   * green suite.
   */
  test("selectForm returns two keys and no more", () => {
    const keys = new Set<string>();
    for (const count of [
      undefined,
      0,
      0.001,
      1,
      1.5,
      2,
      5,
      11,
      21,
      100,
      101,
      1000,
      1e6,
      1.5e6,
      2e6,
      1e9,
    ]) {
      for (const slot of ["bare", "after-number", "conversion-target"]) {
        keys.add(
          italian.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
    // `one` is exactly 1 and nothing else — Italian draws the line where English
    // does and not where Portuguese does, so 0 and 1,5 are both `other`.
    const key = (n: number) =>
      italian.selectForm({
        count: new Decimal(n),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      });
    expect(key(1)).toBe("one");
    expect(key(0)).toBe("other");
    expect(key(1.5)).toBe("other");
    // And the fold itself, at the exact value that provokes it and at the
    // neighbouring one that does not — which is what shows `many` is about a
    // whole million rather than about being large.
    expect(new Intl.PluralRules("it").select(1e6)).toBe("many");
    expect(new Intl.PluralRules("it").select(1.5e6)).toBe("other");
    expect(key(1e6)).toBe("other");
    // The slot is read and has no consequence: Italian nouns do not decline, so
    // "in grammi" is the word "5 grammi" already used.
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      expect(italian.selectForm({ kind: "mass", unit: "g", slot })).toBe("other");
    }
  });

  /**
   * The contract over the composed whole: every unit of every kind the locale
   * claims has words, every printed form is a readable alias, no two units of a
   * kind claim one surface, and every key `selectForm` can produce exists in the
   * table it will index.
   *
   * Run twice, the second time with counts the default sweep cannot reach. Those
   * defaults are all integers below a thousand, so `other` is only ever selected
   * through an ordinary plural; a fraction and a whole million are the two counts
   * that would separate this language from one whose grammar splits them off
   * (Ukrainian spells 1,5 with the genitive singular, a different word from its
   * plural), and a vocabulary written from an English template is only caught by
   * a count that is not an integer.
   */
  test("satisfies the locale contract over every built-in kind", () => {
    assertLocaleContract(it, BUILTIN_KINDS, SKIP_BOOLEAN);
    assertLocaleContract(it, BUILTIN_KINDS, {
      ...SKIP_BOOLEAN,
      counts: [0, 1, 1.5, 2, 21, 1000, 1e6, 1.5e6],
    });
  });

  /**
   * End to end, through the engine: the point is not the arithmetic (the kinds
   * own that) but that the words in this barrel are reachable from `evaluate`
   * once composed, in both directions — read an Italian word, print one.
   */
  test("reads and prints Italian through the engine", () => {
    const e = createEngine({ locales: [it], kinds: BUILTIN_KINDS });
    expect(e.evaluate("5 chilometri in metri").formatted).toBe("5.000 metri");
    // The other half of "da … a …", which `italian.keywords.in` also claims, so
    // the same conversion is written two ways and answers once.
    expect(e.evaluate("5 chilometri a metri").formatted).toBe("5.000 metri");
    // The plural class no suffix stripper can reach: "miglia" is not "migli"
    // plus an ending, it is "miglio" with its final vowel replaced — which is
    // why `locale/it.ts` ships a substitution table rather than a stripper.
    expect(e.evaluate("2 miglia").value?.unit).toBe("mi");
    expect(e.evaluate("3 once").value?.unit).toBe("oz");
    // The line Italian draws at exactly 1, printed rather than selected.
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 chilogrammi");
    expect(e.evaluate("0 grammi").formatted).toBe("0 grammi");
    // Italian welds its cardinals into one word, which is the whole reason
    // `it-cardinals.ts` exists instead of `cardinalNumerals`.
    expect(e.evaluate("duemilatrecento grammi").formatted).toBe("2.300 grammi");
    expect(e.evaluate("ventitré metri").formatted).toBe("23 metri");
  });

  /**
   * The round trip, over the separator that makes it interesting.
   *
   * Italian groups thousands with "." and marks the decimal with "," — the two
   * characters swapped from English — so its own printed output is the one input
   * an Italian engine is guaranteed to be handed and the one an English-shaped
   * lexer would read as a decimal point. Unlike Ukrainian's U+00A0 this needs no
   * accommodation in `lex`, because "." is an ordinary character that never folds
   * to a space; asserting it here is what would notice the day that stopped being
   * true, and the separator is read off CLDR rather than assumed so that a
   * runtime that disagreed would fail here rather than three assertions later.
   */
  test("round-trips its own grouped output", () => {
    const e = createEngine({ locales: [it], kinds: BUILTIN_KINDS });
    expect(new Intl.NumberFormat("it").formatToParts(1234567)[1]?.value).toBe(".");
    for (const input of [
      "2 kg in g",
      "1,5 t",
      "1234567 grammi",
      "1 ora in minuti",
      "2 libbre in grammi",
      "1500000 metri",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
    // Spelled out, so the grouping is visible in the assertion rather than only
    // in the round trip above.
    expect(e.evaluate("2 kg in g").formatted).toBe("2.000 grammi");
    expect(e.evaluate("1234567 grammi").formatted).toBe("1.234.567 grammi");
  });

  /**
   * Recognition is many-locale where generation is one (I6), so an engine that
   * reads Italian may be asked to read English and Ukrainian in the same breath
   * — and `buildKeywords` refuses on boot if two languages spell one surface as
   * two different operators. Italian claims four surfaces none of the other two
   * claims ("a", "di", "per", "diviso") and shares one with English ("in") under
   * the same meaning, which is the case that must collapse rather than conflict.
   * Asserted here because it is a property of the *set* of installed languages,
   * so no single-language suite is in a position to see it.
   */
  test("installs beside English and Ukrainian without a keyword conflict", () => {
    const keywords = buildKeywords([
      composeLocale(english, BUILTIN_EN),
      composeLocale(ukrainian, BUILTIN_UK),
      it,
    ]);
    expect(keywords.get("in")).toBe("in");
    expect(keywords.get("a")).toBe("in");
    expect(keywords.get("di")).toBe("of");
    expect(keywords.get("per")).toBe("times");
    expect(keywords.get("diviso")).toBe("over");
    // English keeps every word it claimed; the fold added to the table rather
    // than overwriting it.
    expect(keywords.get("to")).toBe("in");
    expect(keywords.get("of")).toBe("of");
  });
});
