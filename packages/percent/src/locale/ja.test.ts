import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentJa from "./ja";

const locale = composeLocale(japanese, [percentJa]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Anything only Japanese would write: hiragana, katakana and the two CJK
 * ideograph blocks a modern Japanese text draws on. A kanji is shared with
 * Chinese, so what this catches is "a CJK word leaked into the language-free
 * half" rather than "a *Japanese* word did" — the only claim a script test can
 * honestly make.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/u;

describe("percent ja vocabulary", () => {
  test("it targets Japanese and names its kind by id", () => {
    expect(percentJa.locale).toBe("ja");
    expect(percentJa.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no script but ASCII may reach it. Kana
  // or kanji in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Japanese word", () => {
    expect(JSON.stringify(percent)).not.toMatch(JAPANESE);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so "20 pct" keeps parsing under a Japanese format locale;
  // パーセント is appended on top. One word is the whole Japanese half, where
  // Ukrainian needed eighteen — Japanese nouns do not decline, so there is no
  // paradigm to spell out.
  test("the generated Latin aliases survive, with one Japanese word on top", () => {
    const aliases = percentJa.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    expect(aliases.filter((a) => JAPANESE.test(a))).toEqual(["パーセント"]);
  });

  // No `forms`, and for `en`'s reason rather than a grammatical one: the written
  // form of this unit is the symbol. Under `ja` the omission is a single row —
  // `japanese.selectForm` has exactly one answer — which makes it cheaper to
  // write than Ukrainian's eight and no more correct: 「20%」 is what a Japanese
  // result line carries, and a `forms` table would print 「20パーセント」 at every
  // percentage in the engine's output.
  test("no unit declares forms, and selectForm has one key it would need", () => {
    for (const words of Object.values(percentJa.units)) {
      expect(words.forms).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      japanese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(["other"]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `ja` a fraction cannot select a different key — there
    // is only one — so this call confirms the shape rather than a new row, and
    // running it keeps this vocabulary comparable with every sibling that does
    // move across the boundary.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese percentages", () => {
    const e = engine();
    // Read as a word, answered as a symbol, and set tight against the number
    // because `japanese.renderQuantity` closes the gap on every branch.
    expect(e.evaluate("20パーセント").formatted).toBe("20%");
    // The plural boundary, which in this language moves nothing at all: 1, 2 and
    // 5 take the identical noun, and the vocabulary has no word to print for any
    // of them anyway.
    expect(e.evaluate("1パーセント").formatted).toBe("1%");
    expect(e.evaluate("2パーセント").formatted).toBe("2%");
    expect(e.evaluate("5パーセント").formatted).toBe("5%");
    // The fractional row, and the grouped one. CLDR gives `ja` the same
    // separators as `en` — "." for the decimal, "," for the group — so unlike
    // Ukrainian's NBSP the grouped output reads straight back.
    expect(e.evaluate("1.5パーセント").formatted).toBe("1.5%");
    expect(e.evaluate("2000パーセント").formatted).toBe("2,000%");
    expect(e.evaluate("2,000%").formatted).toBe("2,000%");
    // A sum that lands on a fraction, through the division verb `ja.ts` lists.
    expect(e.evaluate("5パーセント 割る 2").formatted).toBe("2.5%");
    // Both scripts read: a Japanese engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. Recognition is many-to-one, generation is
    // one (design decision I6).
    expect(e.evaluate("50 pct").formatted).toBe("50%");
  });

  // `％` U+FF05 is what a Japanese IME produces from the `%` key, and it is read
  // without being listed: `normalize()` runs NFKC before a word reaches any
  // index, and NFKC folds the fullwidth form to the ASCII one. Asserted rather
  // than left in a comment, because the tempting "fix" is to add a dead alias
  // that reads as coverage.
  test("the fullwidth ％ reads through NFKC, not through an alias", () => {
    expect(percentJa.units["%"]?.aliases).not.toContain("％");
    expect(engine().evaluate("20％").formatted).toBe("20%");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind. を is the Japanese `in`
  // keyword, and it is a *postposition on the left operand*: it attaches to the
  // end of the phrase it governs, which is exactly where an infix operator goes.
  // Reaching the conversion-target slot through the word rather than through "%"
  // is what proves パーセント is indexed and not merely listed.
  test("reads a conversion into percent, through the source particle", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 / 50をパーセント").formatted).toBe("10%");
    expect(e.evaluate("5 / 50を%").formatted).toBe("10%");
    // から is the other spelling of `in` this language lists, and it means "from"
    // — it marks the source too, which is why both work as infix operators.
    expect(e.evaluate("1 割る 8からパーセント").formatted).toBe("12.5%");
  });

  // 割 is the Japanese word for a proportion and it is deliberately unclaimed:
  // 「3割」 is 30%, a *tenth* and not a hundredth, so it is a different unit with
  // a different ratio rather than a synonym. `percent` declares one unit, and a
  // vocabulary may only name units the kind declares — reported, not faked. The
  // live cost of that is worth pinning: 割 is already this language's `over`
  // keyword, so 「3割」 does not silently become 3%.
  test("割 is a tenth and is not claimed as a synonym for the hundredth", () => {
    expect(percentJa.units["%"]?.aliases).not.toContain("割");
    expect(japanese.keywords.over).toContain("割る");
    expect(() => engine().evaluate("3割")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20パーセント",
      "1.5パーセント",
      "2000パーセント",
      "5パーセント 割る 2",
      "50 pct",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
