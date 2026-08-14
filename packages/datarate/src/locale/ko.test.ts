import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateKo from "./ko";

const locale = () => composeLocale(korean, [datarateKo]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => korean.selectForm({ kind: "datarate", unit: "mbps", slot })),
    ),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

describe("datarate ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the point is that
    // the kind holds ratios, unit ids, magnitude bands and four bridge
    // signatures and no language at all, so any Hangul syllable reaching it is
    // the failure.
    expect(JSON.stringify(datarate)).not.toMatch(HANGUL);
  });

  test("`korean` can ask for exactly one key, and no unit declares any", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: Korean marks number nowhere on a noun, so every count and every
    // slot — the fractional 1.5 and the count-free conversion target included —
    // come back "other". Rule 6 wants a `forms` table to hold exactly that set.
    expect([...KEYS]).toEqual(["other"]);
    // And this kind holds none, which is `en.ts`'s ruling and `ja.ts`'s: a rate
    // is a compound in every language here, and in Korean it is worse than a
    // compound — 「초당 메가비트」 puts the rate word *before* the number, where
    // no unit label can be bound at all.
    for (const [unit, words] of Object.entries(datarateKo.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datarateKo.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("no segmenter stands between these words and the index", () => {
    // The measurement `ja.ts` and `zh.ts` each spend a paragraph on, and its
    // Korean answer: there is nothing to measure. Korean is spaced, `lex` has
    // already cut at every space, and `korean.segment` is undefined — so a
    // Hangul compound written as one word reaches the alias index as one token
    // by construction. This is why the whole 비트 family is claimable here while
    // `ja.ts` next door may claim only ビット and メガビット.
    expect(korean.segment).toBeUndefined();
    // And the fact behind that decision, since a reader will want it checked
    // rather than asserted: ICU has no Korean dictionary, so it would invent no
    // breaks even if a segmenter were installed.
    const icu = new Intl.Segmenter("ko", { granularity: "word" });
    for (const word of ["킬로비트", "기가비트", "테라비트"]) {
      expect([...icu.segment(word)].map((s) => s.segment)).toEqual([word]);
    }
  });

  test("the bare SI prefixes are left unclaimed, and on purpose", () => {
    // 「100메가」 for a hundred megabits per second is the commonest colloquial
    // Korean there is for a link rate — and 「500기가」 is a file size just as
    // readily. The alias index is one flat map with no kind in the key, and
    // `@smartput/datasize`'s `ko.ts` claims 기가바이트 in it, so a bare prefix
    // would be a reading this vocabulary cannot make. The full compound is
    // unambiguous and is what is listed.
    const claimed = Object.values(datarateKo.units).flatMap((w) => [...w.aliases]);
    for (const word of ["메가", "기가", "테라", "킬로"]) {
      expect(claimed, `bare prefix "${word}" is claimed`).not.toContain(word);
    }
    expect(claimed).toContain("메가비트");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean datarate", () => {
    // Hangul in, Latin symbol out, and nothing between the number and the
    // label: `korean.renderQuantity` closes the gap on every branch, which is
    // 한글 맞춤법 §43's proviso for a unit after Arabic numerals.
    expect(engine.evaluate("100메가비트").formatted).toBe("100Mbps");
    expect(engine.evaluate("2비트").formatted).toBe("2bps");
    // The whole family, including the three `ja.ts` had to refuse.
    expect(engine.evaluate("4킬로비트").formatted).toBe("4kbps");
    expect(engine.evaluate("3테라비트").formatted).toBe("3Tbps");
    // Latin in, and the same out — a Korean engineer types "5 mbps" as readily
    // as anything, which is why `aliasesFor` keeps the Latin set.
    expect(engine.evaluate("5 mbps").formatted).toBe("5Mbps");
    // A conversion. The source particle 를 is claimed under `in` and lands
    // where an infix operator goes, because Korean is head-final; it reaches the
    // parser as a token of its own only because the stem in front of it is
    // Latin, which is the seam the language file reports as core's to widen.
    expect(engine.evaluate("2gbps를 mbps").formatted).toBe("2,000Mbps");
    // And the *target* particle, which is the euphonic conditional doing real
    // work: 메가비트 ends in an open syllable, so 로 is the grammatical shape
    // and `particleStripper` peels it back to the unit.
    expect(engine.evaluate("2gbps를 메가비트로").formatted).toBe("2,000Mbps");
    // The ungrammatical spelling is refused rather than quietly accepted — a
    // flat suffix list would have stripped it.
    expect(() => engine.evaluate("2gbps를 메가비트으로")).toThrow();
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1.5Mbps");
    // The Sino-Korean numerals, this language's other unusual half: 오백 is five
    // hundred, parsed by `koreanNumerals` and not by any digit rule. The space
    // is not optional — a numeral written up against its unit is one letter run
    // and therefore one word token, which is a limitation of `lex` rather than
    // of this vocabulary.
    expect(engine.evaluate("오백 메가비트").formatted).toBe("500Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100메가비트",
      "2비트",
      "3테라비트",
      "2gbps를 메가비트로",
      "1 mbps + 500 kbps",
      "오백 메가비트",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
