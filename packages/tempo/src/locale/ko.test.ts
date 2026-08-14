import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoKo from "./ko";

const locale = () => composeLocale(korean, [tempoKo]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "tempo",
          unit: "hz",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(SLOTS.map((slot) => korean.selectForm({ kind: "tempo", unit: "hz", slot }))),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("tempo ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is two
    // ratios, two unit ids, the magnitude bands and one reciprocal bridge, so
    // any Hangul syllable reaching it is the failure.
    expect(JSON.stringify(tempo)).not.toMatch(HANGUL);
  });

  test("only `hz` declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants
    // exactly this set, no more and no fewer. English needed two rows holding
    // the same word because "hertz" is its own plural; Korean needs one because
    // there is no plural to hold.
    expect([...KEYS]).toEqual(["other"]);
    expect(Object.keys(tempoKo.units.hz?.forms ?? {})).toEqual([...KEYS]);
    // 「분당 박수」 puts the rate word before the number, where no unit label can
    // be bound, so `bpm` prints the Latin abbreviation Korea writes anyway.
    expect(tempoKo.units.bpm?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // two identical rows and Ukrainian needs eight; Korean needs one word, and
    // the count-free conversion target takes the same one.
    expect(word("hz", 1)).toBe("헤르츠");
    expect(word("hz", 60)).toBe("헤르츠");
    expect(word("hz", 1.5)).toBe("헤르츠");
    expect(word("hz", undefined, "conversion-target")).toBe("헤르츠");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(tempoKo.units)) {
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

  test("`bpm` claims no Korean word, and names which two it refused", () => {
    // Every other `ko` vocabulary in this repo appends Hangul aliases; this unit
    // appends none, and the two candidates are refused on the flat alias index
    // rather than on doubt about the usage. 박 is the beat counter and also the
    // counter for nights away (「2박 3일」), and 비트 is the loanword for a
    // musical beat and is already `@smartput/datarate`'s word for a bit — which
    // the `@smartput/kinds` barrel installs beside this kind.
    const claimed = Object.values(tempoKo.units).flatMap((w) => [...w.aliases]);
    for (const word of ["박", "박자", "비트"]) {
      expect(claimed, `"${word}" is claimed`).not.toContain(word);
    }
    // 헤르츠 is claimed, and no segmenter had to be consulted to establish that
    // it survives — the difference between this file and `ja.ts` next door.
    expect(korean.segment).toBeUndefined();
    expect(claimed).toContain("헤르츠");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean tempo", () => {
    // Nothing between the number and the label on either branch, word or symbol:
    // `korean.renderQuantity` closes the gap everywhere, which is 한글 맞춤법
    // §43's proviso for a unit after Arabic numerals.
    expect(engine.evaluate("120 bpm").formatted).toBe("120bpm");
    expect(engine.evaluate("50헤르츠").formatted).toBe("50헤르츠");
    expect(engine.evaluate("1.5헤르츠").formatted).toBe("1.5헤르츠");
    // Latin in, Hangul out: the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("2 hz").formatted).toBe("2헤르츠");
    // A conversion in each direction. The source particle sits on a Latin stem,
    // where it reaches the parser as its own token; the target particle is glued
    // to the Hangul word, where the euphonic conditional decides its shape —
    // 헤르츠 ends in an open syllable, so 로 is grammatical and 으로 is not.
    expect(engine.evaluate("2hz를 bpm").formatted).toBe("120bpm");
    expect(engine.evaluate("60bpm를 헤르츠로").formatted).toBe("1헤르츠");
    expect(() => engine.evaluate("60bpm를 헤르츠으로")).toThrow();
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1헤르츠 + 30bpm").formatted).toBe("1.5헤르츠");
    // The Sino-Korean numerals: 육십 is sixty, parsed by `koreanNumerals` and not
    // by any digit rule. The space before the unit is not optional — a numeral
    // written up against its unit is one letter run and therefore one word
    // token, which is a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("육십 헤르츠").formatted).toBe("60헤르츠");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "50헤르츠",
      "1.5헤르츠",
      "2hz를 bpm",
      "60bpm를 헤르츠로",
      "1헤르츠 + 30bpm",
      "육십 헤르츠",
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
