import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { Slot } from "../types";
import { japanese } from "./ja";
import { numberSymbols } from "./number";

const form = (n?: number, slot: Slot = "bare") =>
  japanese.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and the count-free
    // row of ruling R5 is the absent one.
    ...(n === undefined ? {} : { count: new Decimal(n) }),
    kind: "mass",
    unit: "kg",
    slot,
  });

const spell = (n: number) => japanese.spell?.(new Decimal(n));
const read = (...words: string[]) => japanese.numerals?.(words);

describe("japanese", () => {
  test("has exactly one form key, for every count and every slot", () => {
    expect(japanese.id).toBe("ja");
    // The whole contract, written out rather than described: a vocabulary for
    // `ja` needs a `forms` table of one row, keyed "other", and there is no
    // count and no slot that can ask it for a second one. Japanese nouns do not
    // inflect for number — 一キログラム and 五キログラム differ in the numeral and
    // nowhere else — so the count column here is deliberately exhaustive of the
    // shapes that move `en` and `uk`: singular, the 2/5/22 boundaries Slavic
    // grammar cares about, a fraction, and zero.
    const keys = new Set(
      [0, 1, 1.5, 2, 5, 21, 22, 100, 2000].flatMap((n) => [
        form(n),
        form(n, "after-number"),
        form(n, "conversion-target"),
      ]),
    );
    expect([...keys]).toEqual(["other"]);
    // Ruling R5's row: a conversion target has no magnitude attached to it, and
    // must still name a key.
    expect(form(undefined, "conversion-target")).toBe("other");
    expect(form(undefined)).toBe("other");
  });

  test('CLDR agrees that "other" is the only category ja has', () => {
    // Why `selectForm` returns a constant instead of calling `Intl.PluralRules`
    // the way `en` and `uk` do. Pinned rather than trusted: if a runtime ever
    // gave `ja` a second category, this is the line that would say so.
    expect(new Intl.PluralRules("ja").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("takes its number symbols from CLDR", () => {
    // Both are visible ASCII here, unlike `uk`'s U+00A0 group separator, so
    // there is nothing to escape — and they are the same pair `en` produces,
    // which is exactly why this is pinned. A hand-written `NumberFormatSpec`
    // that happened to agree today would be indistinguishable from one that
    // stopped agreeing tomorrow.
    expect(numberSymbols(japanese)).toEqual({ group: ",", decimal: "." });
  });

  test("segments an unspaced run into words", () => {
    // The run `lex` would hand over for 「5キログラムをグラム」 once the digit is
    // taken off the front. Without a `segment` hook this is one letter run and
    // the unit, the particle and the target are one token.
    expect(japanese.segment?.("キログラムをグラム")).toEqual([
      "キログラム",
      "を",
      "グラム",
    ]);
    // Across scripts, and through the prolonged sound mark ー — which is
    // `Script=Common` and only reachable because `scriptSegmenter` guards on
    // `Script_Extensions`.
    //
    // ICU keeps 平方メートル whole rather than cutting at the script change, which
    // is what a unit vocabulary wants and is reported here as measured rather
    // than as intended: this helper repeats what ICU says and does not
    // second-guess it (see `scriptSegmenter`'s own comment on the Thai run it
    // gets one character wrong).
    expect(japanese.segment?.("メートルから平方メートル")).toEqual([
      "メートル",
      "から",
      "平方メートル",
    ]);
    // Scoped, not global: a Latin run has no character of a declared script and
    // is returned whole, so a Japanese engine reading "5 kg in grams" does not
    // have ICU re-break the English.
    expect(japanese.segment?.("kilograms")).toEqual(["kilograms"]);
  });

  test("reads kanji numerals across the word breaks ICU invents", () => {
    // The measured cuts, restated as the input this parser actually receives:
    // `Intl.Segmenter` returns 二十 + 二 for 二十二 and 千 + 五百 for 千五百, so a
    // parser that read one number per word would see 20 and stop.
    expect(read("二十", "二")).toEqual({ value: new Decimal(22), consumed: 2 });
    expect(read("千", "五百")).toEqual({ value: new Decimal(1500), consumed: 2 });
    // A bare scale means one: 十 is 10, not 0.
    expect(read("十")).toEqual({ value: new Decimal(10), consumed: 1 });
    expect(read("五")).toEqual({ value: new Decimal(5), consumed: 1 });
    // Myriad grouping, the thing the shared `cardinalNumerals` could not do:
    // 万 is 10⁴, so 十万 is a hundred thousand and not "ten myriad" spelled out
    // in thousands.
    expect(read("一万")).toEqual({ value: new Decimal(10_000), consumed: 1 });
    expect(read("十万")).toEqual({ value: new Decimal(100_000), consumed: 1 });
    expect(read("一億二千三百四十五万六千七百八十九")).toEqual({
      value: new Decimal(123_456_789),
      consumed: 1,
    });
    // The positional writing, one character per decimal place — how a year is
    // written. It has no scale characters at all, which is how it is told apart
    // from the additive reading.
    expect(read("二〇二五")).toEqual({ value: new Decimal(2025), consumed: 1 });
    // 零 is the word for zero; 〇 is the glyph that fills a place.
    expect(read("零")).toEqual({ value: new Decimal(0), consumed: 1 });
    // Claims a prefix and stops: the unit is not a numeral character.
    expect(read("五", "キログラム")).toEqual({ value: new Decimal(5), consumed: 1 });
    expect(read("キログラム")).toBeNull();
  });

  test("spells back through the same table", () => {
    expect(spell(22)).toBe("二十二");
    expect(spell(0)).toBe("零");
    expect(spell(10)).toBe("十");
    expect(spell(1500)).toBe("千五百");
    // The asymmetry that makes Japanese spelling non-obvious: the leading 一 is
    // dropped before 十/百/千 and kept before 万/億/兆. 10,000 is 一万, never 万.
    expect(spell(10_000)).toBe("一万");
    expect(spell(100_000)).toBe("十万");
    expect(spell(123_456_789)).toBe("一億二千三百四十五万六千七百八十九");
    // The three documented declines, mirroring `cardinalSpeller`'s.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(japanese.spell?.(new Decimal("10000000000000000"))).toBeNull();
  });

  test("round-trips every spelled value back through the parser", () => {
    // The property the one-table-two-directions arrangement exists to hold. The
    // sample deliberately crosses every boundary in the algorithm: the sub-myriad
    // scales, the 一-dropping rule, and both myriad closures.
    for (const n of [
      0, 1, 5, 10, 11, 20, 22, 99, 100, 105, 999, 1000, 1500, 9999, 10_000, 10_001,
      100_000, 123_456_789, 1_000_000_000_000,
    ]) {
      const written = spell(n);
      expect(written).not.toBeNull();
      expect(read(written as string)).toEqual({
        value: new Decimal(n),
        consumed: 1,
      });
    }
  });

  test("claims the source particles and nothing that marks a target", () => {
    // を and から attach to the left operand, so they land where an infix
    // operator goes. に and へ attach to the right one and would arrive after
    // it, where the parser leaves them unconsumed and throws — see the keyword
    // table's own comment.
    expect(japanese.keywords.in).toEqual(["を", "から"]);
    expect(japanese.keywords.in).not.toContain("に");
    expect(japanese.keywords.in).not.toContain("へ");
    // Head-final word order puts the base in front of the percentage in both
    // 「50の20%」 and 「50の20%引き」, which is the operand order this engine's
    // `of`/`off` cannot express. Declared absent rather than left to drift.
    expect(japanese.keywords.of).toBeUndefined();
    expect(japanese.keywords.off).toBeUndefined();
    expect(japanese.keywords.by).toBeUndefined();
    // Arithmetic is the fortunate exception: these verbs really are infix.
    expect(japanese.keywords.times).toContain("かける");
  });

  test("lists only the operator surfaces the segmenter can produce", () => {
    // A keyword is looked up by one *segmented* word, exactly as a unit alias
    // is, so a surface ICU cuts in two can never be matched however it is
    // spelled here. That is not a shape a contract test can see — the keyword
    // map never meets the segmenter — so it is measured directly.
    for (const words of Object.values(japanese.keywords)) {
      for (const word of words ?? []) {
        expect(japanese.segment?.(word), `${word} is cut by the segmenter`).toEqual([
          word,
        ]);
      }
    }
    // The one that had to be left out, pinned as the measurement rather than as
    // a comment: た and す are both words to ICU's dictionary, so たす — the
    // hiragana spelling of "plus", and the one a calculator is typed with —
    // never reaches the keyword map. The day ICU learns it, this assertion
    // fails and the surface can be listed beside 足す.
    expect(japanese.segment?.("たす")).toEqual(["た", "す"]);
    expect(japanese.keywords.plus).not.toContain("たす");
    // Its three siblings do survive, which is why they are listed.
    expect(japanese.keywords.minus).toContain("ひく");
    expect(japanese.keywords.times).toContain("かける");
    expect(japanese.keywords.over).toContain("わる");
  });

  test("sets a unit tight against its number", () => {
    const render = japanese.renderQuantity;
    expect(
      render?.({
        number: "5",
        form: "キログラム",
        symbol: "kg",
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("5キログラム");
    // A Latin symbol is set the same way — 5kg, exactly as an English page sets
    // it — where `defaultRenderQuantity` would have spaced the word branch.
    expect(
      render?.({ number: "5", symbol: "kg", kind: "mass", unit: "kg", slot: "bare" }),
    ).toBe("5kg");
    // The caller's own separator still wins: `Printer`'s `spacing` is a
    // typographic choice belonging to the caller, not to the language.
    expect(
      render?.({
        number: "5",
        form: "キログラム",
        gap: " ",
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("5 キログラム");
    // I10's degradation, for a half-translated vocabulary.
    expect(render?.({ number: "5", kind: "mass", unit: "kg", slot: "bare" })).toBe("5kg");
  });

  test("spaces the operator, spelled or symbolic", () => {
    const render = japanese.renderExpression;
    // 足す and not たす: `Printer` spells an operator with a word taken from
    // `keywords`, and たす is not one of them — ICU cuts it, so it could never
    // be read back (see "lists only the operator surfaces the segmenter can
    // produce"). A spelled form the parser cannot take is rule 5's failure.
    expect(render?.({ op: "+", left: "十", right: "五", word: "足す" })).toBe(
      "十 足す 五",
    );
    expect(render?.({ op: "+", left: "10", right: "5" })).toBe("10 + 5");
  });

  /**
   * Why the spelled branch above spaces rather than closing up, in the one form
   * that cannot go stale: the glued strings themselves, run back through
   * `segment` and through the digit rule `lex` applies to the end of a run.
   *
   * Both are properties of the lexer, not of Japanese — 十足す五 is what a
   * Japanese page would set — and both were live bugs in this file: `Printer`
   * emitted 十足す五 for `10 + 5` and 一ひく2.5 for `1 - 2.5`, and the same
   * engine refused each of them.
   */
  test("a glued operator verb is a word the lexer cannot give back", () => {
    // ICU's dictionary knows 十足 ("ten pairs") and 一足 ("one pair"), so the
    // verb's first character is swallowed by the numeral in front of it and
    // す is left stranded.
    expect(japanese.segment?.("十足す五")).toEqual(["十足", "す", "五"]);
    expect(japanese.segment?.("一足す五")).toEqual(["一足", "す", "五"]);
    // 八割 is "eighty percent", and 割る is `over`'s kanji spelling — the same
    // fusion, in a different verb, which is why no choice of verb escapes it.
    expect(japanese.segment?.("八割る五")).toEqual(["八割", "る", "五"]);
    // A numeral that does not form a compound with the verb's first character
    // glues fine, which is exactly why this could not be settled by trying one
    // example: 五足す五 works and 十足す五 does not, and only spacing every
    // spelled operator covers both.
    expect(japanese.segment?.("五足す五")).toEqual(["五", "足す", "五"]);
    // The other direction, and the one no choice of verb escapes: `lex` absorbs
    // the digits at the end of a letter run so that `m2` and `cm3` are single
    // unit words, so a right operand rendered in Arabic digits — every count
    // `spell` declines, so every non-integer — fuses into the verb from behind.
    // `2.5` is the whole reason the spelled branch cannot glue even when ICU
    // co-operates.
    expect(japanese.spell?.(new Decimal(2.5))).toBeNull();
  });
});
