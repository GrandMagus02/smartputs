import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerIt from "./it";

const locale = () => composeLocale(italian, [powerIt]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** The four units Italian has a word for; `hp` is deliberately symbol-only. */
const WORDED = ["w", "kw", "mw", "gw"] as const;

/** Every key `italian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "w",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({ kind: "power", unit: "w", slot }),
      ),
    ),
);

describe("power it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which Italian cannot borrow: the kind is already full of Latin letters
  // ("kw", "hp"), so a script test would either pass vacuously or fail on the
  // unit ids themselves. The equivalent claim is that the word this file
  // introduces appears nowhere in the language-free half, which is five ratios,
  // five unit ids and the magnitude bands `typical` records.
  test("the kind itself carries no Italian word", () => {
    expect(JSON.stringify(power)).not.toMatch(/\bchilowatt\b/i);
  });

  test("`italian` asks for exactly two keys, and every worded unit fills those", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const unit of WORDED) {
      expect(Object.keys(powerIt.units[unit]?.forms ?? {}).sort(), unit).toEqual([
        "one",
        "other",
      ]);
    }
    // And `hp` fills neither, for the ruling the vocabulary's doc comment
    // records: the Italian words for this quantity all name the metric
    // horsepower, which is a different number, and the honest expansion is three
    // words the lexer could never read back.
    expect(powerIt.units.hp?.forms).toBeUndefined();
  });

  // The trap this file exists to avoid, pinned where it can fail. "CV" is
  // 735,49875 W and `units.ts` defines `hp` as 745,69987158227022 W — about
  // 1,4 % apart, small enough to look like rounding and large enough to answer
  // the wrong question.
  test("no Italian word for the metric horsepower is registered", () => {
    for (const [unit, words] of Object.entries(powerIt.units)) {
      for (const word of words.aliases) {
        expect(word.toLowerCase(), `${unit} claims "${word}"`).not.toMatch(
          /^(cv|cavall[oi])$/,
        );
      }
    }
  });

  test("the invariant loanword is invariant in both rows", () => {
    for (const unit of WORDED) {
      const forms = powerIt.units[unit]?.forms as Record<string, string>;
      expect(forms.other, `${unit} inflects its loanword`).toBe(forms.one);
      expect(forms.one, `${unit} looks pluralised`).toMatch(/watt$/);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kW" be the symbol while "kw" is the alias. What this catches is
    // a printed word reachable only through `italian`'s `pluralFold`, at its -2
    // penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(powerIt.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Italian folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian power", () => {
    // The Italian prefix is printed where the international one is only read.
    expect(engine.evaluate("1 kw").formatted).toBe("1 chilowatt");
    expect(engine.evaluate("2 kilowatt").formatted).toBe("2 chilowatt");
    // Invariant: the same word at one and at two, which is the whole claim.
    expect(engine.evaluate("2 chilowatt").formatted).toBe("2 chilowatt");
    // The Italian numeral fold reaches the same value through a welded word.
    expect(engine.evaluate("cento watt").formatted).toBe("100 watt");
    // A conversion with "in", and the group separator that makes it worth
    // asserting: `Intl.NumberFormat("it")` groups with ".", so a kilowatt is
    // "1.000" watts and not one.
    expect(engine.evaluate("1 kw in w").formatted).toBe("1.000 watt");
    // ...and with "a", the directional preposition listed beside "in".
    expect(engine.evaluate("2 mw a kw").formatted).toBe("2.000 chilowatt");
    // A sum landing on a fraction, where the decimal comma shows. Written with a
    // comma on purpose: "1.5" is not an Italian number, so a test spelled that
    // way would be exercising the group separator instead.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 chilowatt");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 kw più 500 w").formatted).toBe("1,5 chilowatt");
    // `hp` has no words, so it stays on the symbol and is set tight.
    expect(engine.evaluate("150 hp").formatted).toBe("150hp");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kw",
      "2 chilowatt",
      "1 kw + 500 w",
      "1 kw in w",
      "1,5 megawatt",
      "150 hp",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
