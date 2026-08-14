import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationIt from "./it";

const locale = () => composeLocale(italian, [durationIt]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** Every key `italian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({
          count: new Decimal(count),
          kind: "duration",
          unit: "h",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({ kind: "duration", unit: "h", slot }),
      ),
    ),
);

describe("duration it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which Italian cannot borrow: the kind is already full of Latin letters
  // ("min", "wk"), so a script test would either pass vacuously or fail on the
  // unit ids themselves. The equivalent claim is that the words this file
  // introduces appear nowhere in the language-free half, which is six ratios,
  // six unit ids and the magnitude bands `typical` records.
  test("the kind itself carries no Italian word", () => {
    const descriptor = JSON.stringify(duration);
    for (const word of ["secondo", "minuto", "ora", "giorno", "settimana"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("every unit carries exactly the two keys `italian` can produce", () => {
    // The contract the language author pinned: `one` for a count of 1 and
    // `other` for everything else — 0, fractions, CLDR's `many` (folded away
    // because this engine never prints compact notation), and a conversion
    // target with no count at all. The slot is ignored throughout, Italian nouns
    // having no case, so a unit needs one column and not two.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(durationIt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s key set`).toEqual([
        "one",
        "other",
      ]);
    }
  });

  // Unlike every other kind in this batch, all six rows here genuinely inflect:
  // four masculine -o → -i and two feminine -a → -e. Pinned as a property so a
  // row that quietly loses its plural (or copies the singular into it, the shape
  // the invariant loanword kinds legitimately use) shows up here.
  test("every unit's two rows are two different Italian words", () => {
    for (const [unit, words] of Object.entries(durationIt.units)) {
      const forms = words.forms as Record<string, string>;
      expect(forms.other, `${unit} does not inflect`).not.toBe(forms.one);
      expect(forms.other, `${unit}'s plural is not an Italian one`).toMatch(/[ie]$/);
    }
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(durationIt.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      // The week is why this is asserted rather than assumed: "sett." is what
      // Italian writes and the stop is the group separator, so the symbol had to
      // lose it and then be listed as an alias to earn it back.
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      // Rule 5, the one that catches a printed form recovered only by the
      // penalised `pluralFold`: every word this table prints is listed outright.
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  // The cross-package ruling the vocabulary's doc comment records, pinned where
  // it can fail: "g" is `@smartput/mass`'s gram in an engine that installs both
  // kinds, and the alias index has no kind in its key, so the day is spelled "d".
  test("the day does not claim `g`", () => {
    const day = durationIt.units.d;
    expect(day?.symbol).toBe("d");
    expect(day?.aliases.map((a) => a.toLowerCase())).not.toContain("g");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Italian folds that into `other` like every other non-1
    // count, which is precisely the claim worth sampling rather than assuming:
    // if `selectForm` ever grows CLDR's third row, this notices before a user
    // does.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian duration", () => {
    // The singular and the plural are two different words here, which is what
    // makes this kind worth two rows at all.
    expect(engine.evaluate("1 ora").formatted).toBe("1 ora");
    expect(engine.evaluate("2 ore").formatted).toBe("2 ore");
    // The Italian numeral fold reaches the same values through welded words, and
    // "una" is the feminine spelling of 1 that "ora" would actually take.
    expect(engine.evaluate("una settimana").formatted).toBe("1 settimana");
    expect(engine.evaluate("ventiquattro ore").formatted).toBe("24 ore");
    // A conversion written with "in", the preposition the language lists first.
    expect(engine.evaluate("1 ora in minuti").formatted).toBe("60 minuti");
    // ...and with "a", the directional one listed beside it. The group separator
    // is a full stop, which is what `Intl.NumberFormat("it")` produces here:
    // "3.600" is three thousand six hundred seconds, not three.
    expect(engine.evaluate("1 ora a secondi").formatted).toBe("3.600 secondi");
    // The dotless week contraction, which is the whole reason it is an alias.
    expect(engine.evaluate("2 sett in giorni").formatted).toBe("14 giorni");
    // A sum landing on a fraction, where the decimal comma shows. Written with a
    // comma on purpose: "1.5" is not an Italian number, so a test spelled that
    // way would be exercising the group separator instead.
    expect(engine.evaluate("1 ora + 30 minuti").formatted).toBe("1,5 ore");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 ora più 30 minuti").formatted).toBe("1,5 ore");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 ora",
      "2 ore",
      "1 ora + 30 minuti",
      "1 ora in minuti",
      "2 sett in giorni",
      "1,5 giorni",
      "500 millisecondi",
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
