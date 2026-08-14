import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationNl from "./nl";

const locale = () => composeLocale(dutch, [durationNl]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "duration", unit: "h", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot,
      }),
    ),
  ]),
);

describe("duration nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute does not transfer either, because it rests on every German noun
  // carrying a capital and Dutch capitalises none. So the words themselves are
  // the check: the kind is ratios, unit ids and magnitude bands, and none of the
  // six Dutch nouns may appear anywhere in it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(duration)).not.toMatch(
      /milliseconde|seconde|minuut|minuten|\buur\b|\buren\b|\bdag\b|\bdagen\b|\bweken\b/i,
    );
  });

  test("`dutch` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch lost its case marking on common nouns centuries ago — "in twee uur"
    // governs the same word "twee uur" does — so the dative axis `de.ts` needs
    // is absent here and the table is English-shaped. The sweep includes a
    // count-free call, because a conversion target has no magnitude to agree
    // with and must still answer (R5), and 1e6, so a CLDR `many` row would show
    // up here rather than at a user.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(durationNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so a symbol never
    // has to be listed twice. What this catches is the other thing — a printed
    // word reachable only through `dutch`'s suffix stripper, at its −2 penalty,
    // so by accident rather than by declaration. Every plural here is exactly
    // that shape and worse: `dutch` refuses to strip `en` at all, precisely
    // because "minuten" and "weken" shorten their stem, so nothing but the
    // explicit alias recovers them.
    for (const [unit, words] of Object.entries(durationNl.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
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
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Dutch folds it into `other`, the row 0 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the hour is invariant and the day is not", () => {
    // The whole substance of the Dutch table. A numeral governs the singular of
    // a measure noun, so "twee uur" is a two-hour span and *uren* — real Dutch,
    // but the indefinite plural of an unmeasured quantity — is never printed.
    expect(word("h", 1)).toBe("uur");
    expect(word("h", 2)).toBe("uur");
    expect(word("h", 0)).toBe("uur");
    expect(word("h", 1.5)).toBe("uur");
    // And the counterweight, without which the row above would be a table that
    // stopped halfway rather than a fact about the noun.
    expect(word("d", 1)).toBe("dag");
    expect(word("d", 2)).toBe("dagen");
    expect(word("wk", 1)).toBe("week");
    expect(word("wk", 2)).toBe("weken");
    // Open-syllable shortening, which is what makes these plurals unreachable
    // from a suffix stripper: the stem loses a vowel as the ending is added.
    expect(word("min", 1)).toBe("minuut");
    expect(word("min", 2)).toBe("minuten");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing at all — which
    // is the one-axis contract, stated as an assertion instead of a comment.
    expect(word("min", undefined, "conversion-target")).toBe("minuten");
    expect(word("d", 2, "conversion-target")).toBe(word("d", 2));
  });

  test("an engine built from it reads and writes Dutch duration", () => {
    // The invariant hour, both sides of the plural boundary.
    expect(engine.evaluate("1 uur").formatted).toBe("1 uur");
    expect(engine.evaluate("2 uur").formatted).toBe("2 uur");
    // "uren" reads and is answered with the invariant: recognition is
    // many-to-one (I6) while generation stays one.
    expect(engine.evaluate("2 uren").formatted).toBe("2 uur");
    // The Dutch abbreviation for the hour, which German writes "h" and Dutch
    // writes "u". The international "h" still reads, from `units.ts`.
    expect(engine.evaluate("2 u").formatted).toBe("2 uur");
    expect(engine.evaluate("2 h").formatted).toBe("2 uur");
    // The marked plurals.
    expect(engine.evaluate("3 dagen").formatted).toBe("3 dagen");
    expect(engine.evaluate("1 dag").formatted).toBe("1 dag");
    expect(engine.evaluate("90 seconden").formatted).toBe("90 seconden");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch, so a
    // test written with a full stop would be exercising the group separator —
    // which the row further down exercises deliberately instead.
    expect(engine.evaluate("1 u + 30 minuten").formatted).toBe("1,5 uur");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 uur in minuten").formatted).toBe("120 minuten");
    expect(engine.evaluate("2 uur naar minuten").formatted).toBe("120 minuten");
    expect(engine.evaluate("3 weken in dagen").formatted).toBe("21 dagen");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 s").formatted).toBe("2.000 seconden");
  });

  test('"min" is the minute and not the subtraction keyword', () => {
    // The regression this row exists to keep out. Dutch says "min" for
    // subtraction, so `dutch` claimed it as its `minus` keyword — and `lex`
    // emits a keyword token before any alias index is consulted, which made the
    // minute's SI symbol unreadable. `assertLocaleContract` passed the whole
    // time, because it asks the alias index rather than the lexer, which is
    // exactly why this row is written against the engine.
    //
    // The damage was never confined to Dutch: `buildKeywords` folds every
    // installed language's connectives into one table, so an engine speaking
    // English beside Dutch lost "5 min" as well. `nl.ts` spells the operator
    // "minus" for that reason.
    expect(engine.evaluate("5 min").formatted).toBe("5 minuten");
    expect(engine.evaluate("5 min").value.unit).toBe("min");
    expect(engine.evaluate("1 uur naar min").formatted).toBe("60 minuten");
    expect(engine.evaluate("10 minuten minus 4 minuten").formatted).toBe("6 minuten");
    // And the word path is unchanged: this unit declares `forms`, so
    // `formatValue` reaches for a word and never for the symbol.
    expect(engine.evaluate("5 minuut").formatted).toBe("5 minuten");
  });

  test("the compound splitter does not claim what the alias index does", () => {
    // `dutch` leaves `dag` and `uur` out of its compound heads, because a head
    // list containing them reads *maandag* as a count of days and *temperatuur*
    // as a count of hours. Listing them as aliases is a different mechanism —
    // whole-token, exact — so both stay reachable and neither compound is
    // claimed.
    expect(engine.evaluate("2 dagen").value.unit).toBe("d");
    expect(() => engine.evaluate("2 maandag")).toThrow();
    expect(() => engine.evaluate("2 temperatuur")).toThrow();
    // What the splitter does claim: the heads `dutch` does list. "week" is one,
    // so an unknown Dutch compound ending in it still lands on the week.
    expect(engine.evaluate("2 werkweek").value.unit).toBe("wk");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 uur",
      "1 u + 30 minuten",
      "2 uur in minuten",
      "3 weken in dagen",
      "90 seconden",
      "2000 s",
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
