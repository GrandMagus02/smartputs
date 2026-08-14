import { describe, expect, test } from "bun:test";
import { BOOLEAN_KIND, BOOLEAN_UNIT, composeLocale, createEngine } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_JA from "./locale/ja";
import BUILTIN_UK from "./locale/uk";

/**
 * The `ja` barrel, checked as a barrel.
 *
 * Every vocabulary in it already has its own suite next to its own `units.ts`,
 * and those suites are where a wrong katakana name or a missing symbol is
 * caught. What no per-package suite can see is the shape of the *list*: a
 * vocabulary that was never written, or written and never imported here, is
 * invisible to every check that only visits the kinds a locale claims — hand
 * `assertLocaleContract` a locale covering fourteen kinds and it will pass,
 * cheerfully, over fourteen kinds. So the first test below counts, and the rest
 * exercise the composed whole the way a consumer wires it.
 *
 * `german.test.ts` next door is the same file for German and was the model for
 * this one. What Japanese adds to it is the second half: German's hazards are
 * grammatical and are asserted per package, while Japanese's are *lexical* —
 * the language is unspaced, so `Intl.Segmenter` decides where the words in a
 * run are, and a name ICU cuts in two can be printed and never read back. That
 * is a property of the composed engine and of nothing smaller, so it is checked
 * here: every ja vocabulary's own output, fed straight back in.
 */
const ja = composeLocale(japanese, BUILTIN_JA);

/**
 * `boolean`'s single unit is a sentinel with no word in any language: every
 * value of the kind prints through its own `format` hook ("true"/"false"), so
 * `@smartput/boolean` ships no vocabulary and no language can supply one. The
 * same skip, spelled the same way as `contract.test.ts` and `german.test.ts`
 * spell it, so a second convention does not appear beside the first.
 */
const SKIP_BOOLEAN = { skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`] } as const;

describe("the Japanese barrel", () => {
  test("BUILTIN_JA covers exactly what BUILTIN_EN and BUILTIN_UK cover", () => {
    const kinds = (vs: readonly { kind: string }[]) => vs.map((v) => v.kind).sort();
    expect(kinds(BUILTIN_JA)).toEqual(kinds(BUILTIN_EN));
    expect(kinds(BUILTIN_JA)).toEqual(kinds(BUILTIN_UK));
    // And every one of them is Japanese: a file copied from `en` that kept
    // `locale: "en"` composes without complaint and then never matches at all,
    // because the registry is keyed by locale id before it is keyed by word.
    expect([...new Set(BUILTIN_JA.map((v) => v.locale))]).toEqual(["ja"]);
  });

  test("composes into a locale whose id is the language's", () => {
    expect(ja.id).toBe("ja");
    expect(ja.vocabularies.length).toBe(BUILTIN_JA.length);
  });

  /**
   * The contract over the composed whole, run twice.
   *
   * The second run is the one the default counts never reach. Japanese has no
   * grammatical number — `japanese.selectForm` returns the constant `"other"`
   * — so no count can move it and a fractional count is, on the face of it, the
   * least interesting input there is. That is exactly why it is asserted: the
   * claim being made is that `selectForm` is total, and a language that
   * *derived* its answer from the count (by consulting `Intl.PluralRules`, say,
   * as `en` and `uk` do) would be one edit away from a key no table holds. The
   * slot list is widened past the three core names for the same reason —
   * `Slot` is an open union, and a language that branched on it would show up
   * here rather than at a keystroke.
   */
  test("satisfies the locale contract over every built-in kind", () => {
    assertLocaleContract(ja, BUILTIN_KINDS, SKIP_BOOLEAN);
    assertLocaleContract(ja, BUILTIN_KINDS, {
      ...SKIP_BOOLEAN,
      counts: [0.5, 1.5, 2.5, 0.001, 1_000_000.25],
      slots: ["bare", "after-number", "conversion-target", "invented-slot"],
    });
  });

  /**
   * Rule 6, over the whole barrel and in one direction the contract cannot
   * check: `assertLocaleContract` asks whether every key `selectForm` produces
   * *exists*, and says nothing about a key it does not produce. An extra row is
   * silent — it is never indexed, so it never prints and never fails — and it
   * is how a table translated from `en` keeps a `"one"` row that a reader will
   * later trust as evidence that Japanese has a singular.
   */
  test('every forms table is exactly one row, keyed "other"', () => {
    for (const v of BUILTIN_JA) {
      for (const [unit, words] of Object.entries(v.units)) {
        if (words.forms === undefined) continue;
        expect(Object.keys(words.forms), `${v.kind}:${unit}`).toEqual(["other"]);
      }
    }
  });

  /**
   * The containment `mass/src/locale/uk.test.ts` documents, over every kind at
   * once: a printed form that is not a listed alias can still round-trip, on
   * whatever a language's analyzer chain happens to recover — and `japanese`'s
   * chain is `identity()` alone, so for `ja` there is nothing to recover with
   * and the gap is fatal rather than merely penalised.
   */
  test("every form it prints is a form it lists", () => {
    for (const v of BUILTIN_JA) {
      for (const [unit, words] of Object.entries(v.units)) {
        for (const [key, form] of Object.entries(words.forms ?? {})) {
          expect(
            words.aliases,
            `${v.kind}:${unit} prints ${key}="${form}" but does not list it`,
          ).toContain(form);
        }
      }
    }
  });

  /**
   * The check that is Japanese's alone, and the reason several vocabularies in
   * this barrel carry no `forms` at all.
   *
   * `lex` builds one letter run out of an unspaced string and hands it to
   * `japanese.segment`, so a unit word only becomes a token — and only reaches
   * the alias index — if ICU returns it whole. ICU's dictionary is not
   * consistent about this (メガビット survives, ギガビット does not), it is not
   * something a vocabulary can reason its way to, and it can change under a
   * runtime upgrade. So every non-Latin alias in the barrel is re-measured
   * here: a dictionary that learns ギガビット shows up as a failing test in the
   * package that decided to do without it, and one that forgets キログラム
   * shows up here.
   */
  test("every Japanese alias survives the segmenter whole", () => {
    for (const v of BUILTIN_JA) {
      for (const [unit, words] of Object.entries(v.units)) {
        for (const alias of words.aliases) {
          // Only what `lex` would hand over as a single letter run. A symbol
          // like "m²" or "km/h" is broken up by the lexer itself and is the
          // evaluation test's business, not the segmenter's.
          if (!/^[\p{L}\p{M}]+$/u.test(alias)) continue;
          expect(japanese.segment?.(alias), `${v.kind}:${unit} alias ${alias}`).toEqual([
            alias,
          ]);
        }
      }
    }
  });

  /**
   * A kind is ratios, unit ids and magnitude bands (rule 2), so no Japanese
   * character may appear anywhere in one. The mirror of `ukrainian.test.ts`'s
   * Cyrillic check, over the three scripts Japanese is written in plus the
   * half-width katakana block, which is where a copy-paste from a Japanese page
   * would land before NFKC ever saw it.
   */
  test("no Japanese script leaked into any kind", () => {
    for (const kind of BUILTIN_KINDS) {
      expect(JSON.stringify(kind), kind.id).not.toMatch(/[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/u);
    }
  });

  describe("through the engine", () => {
    const engine = createEngine({ locales: [ja], kinds: BUILTIN_KINDS });

    test("reads and prints Japanese", () => {
      // Tight, both sides: `japanese.renderQuantity` sets no gap between the
      // number and the label, and `japanese.segment` finds the unit inside an
      // unspaced input.
      expect(engine.evaluate("5キログラムをグラム").formatted).toBe("5,000グラム");
      // から is the other source particle, and reads as the origin of a
      // conversion the way English "from … to" does.
      expect(engine.evaluate("100センチメートルからメートル").formatted).toBe(
        "1メートル",
      );
      // A kanji numeral, claimed by `japaneseNumerals` and not by any digit
      // rule, in front of a katakana unit — the two halves of the reading side
      // meeting in one input.
      expect(engine.evaluate("二十ノット").formatted).toBe("20ノット");
      // The grouping separator is CLDR's, and for `ja` it is a plain ASCII
      // comma — no U+00A0 to fold, unlike `uk`.
      expect(engine.evaluate("1234567グラム").formatted).toBe("1,234,567グラム");
    });

    /**
     * The whole barrel's output, fed straight back in.
     *
     * This is the check that catches a name ICU cuts in two, and it is the
     * reason it lives at the barrel rather than per package: several of these
     * vocabularies decline to print a Japanese word precisely because the
     * engine could not read it back, and "declined for a good reason" and
     * "forgot" are the same shape until something evaluates the output.
     *
     * A unit whose printed label is a *symbol carrying an operator* is left
     * out, exactly as `assertLocaleContract` leaves it out and for the same
     * reason: 「100km/h」 is a length over a duration to `lex`, so it is read by
     * arithmetic rather than by lookup, and the quantity that comes back is
     * equal but not identically labelled. Those are asserted in the packages
     * that own them.
     */
    test("every vocabulary reads its own printed output back", () => {
      const kinds = new Set(BUILTIN_KINDS.map((k) => k.id));
      for (const v of BUILTIN_JA) {
        if (!kinds.has(v.kind)) continue;
        // `tempdelta` shares every surface with `temperature` in every language
        // — 「1°C」 is a temperature, and a difference is only ever reached
        // through a signature ("20°C - 5°C"), never by typing a unit. So its
        // words cannot be probed by reading them, and the reading is correct
        // rather than wrong. `temperature` next to it exercises the same three
        // strings.
        if (v.kind === "tempdelta") continue;
        for (const [unit, words] of Object.entries(v.units)) {
          const label = words.forms?.other ?? words.symbol;
          if (label === undefined || label.trim() === "") continue;
          if (/[+\-*/]/.test(label)) continue;
          for (const count of ["1", "2.5", "1234567"]) {
            const where = `${v.kind}:${unit} at ${count}`;
            const first = engine.evaluate(`${count}${label}`);
            expect(`${first.value.kind}:${first.value.unit}`, where).toBe(
              `${v.kind}:${unit}`,
            );
            const again = engine.evaluate(first.formatted);
            expect(`${again.value.kind}:${again.value.unit}`, where).toBe(
              `${v.kind}:${unit}`,
            );
            expect(again.value.canonical.toString(), where).toBe(
              first.value.canonical.toString(),
            );
          }
        }
      }
    });

    /**
     * The arithmetic keywords, through the lexer rather than through the
     * keyword table — which is where all four of them were broken and the
     * table looked fine.
     *
     * A Japanese verb is only an operator if `segment` gives it back as a word
     * of its own, and the surrounding characters decide that: たす is cut into
     * た|す and is not listed at all, while 足す survives on its own and fuses
     * with the numeral in front of it (十足 is "ten pairs"). A space is what
     * makes every one of them reachable, which is why `japanese.renderExpression`
     * prints one.
     */
    test("the arithmetic verbs are operators", () => {
      expect(engine.evaluate("10 足す 5").formatted).toBe("15");
      expect(engine.evaluate("10 プラス 5").formatted).toBe("15");
      expect(engine.evaluate("10 ひく 5").formatted).toBe("5");
      expect(engine.evaluate("10 引く 5").formatted).toBe("5");
      expect(engine.evaluate("10 マイナス 5").formatted).toBe("5");
      expect(engine.evaluate("10 かける 5").formatted).toBe("50");
      expect(engine.evaluate("10 掛ける 5").formatted).toBe("50");
      expect(engine.evaluate("10 わる 5").formatted).toBe("2");
      expect(engine.evaluate("10 割る 5").formatted).toBe("2");
      // Spelled operands too, which is the shape `Printer` emits under
      // `spelled: true` and therefore the shape that has to read back.
      expect(engine.evaluate("十 足す 五").formatted).toBe("15");
      expect(engine.evaluate("千 グラム 足す 五百 グラム").formatted).toBe("1,500グラム");
    });
  });
});
