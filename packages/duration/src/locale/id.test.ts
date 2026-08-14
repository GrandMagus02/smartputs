import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationId from "./id";

const locale = () => composeLocale(indonesian, [durationId]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "duration", unit: "h", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot,
      }),
    ),
  ]),
);

describe("duration id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every noun carries a capital) does not transfer either, since
  // Indonesian capitalises no common noun. So the words themselves are the
  // check, and here they have real teeth: unlike `@smartput/datasize`'s
  // borrowed nouns, all six of these are native Indonesian and none of them
  // could reach the kind by accident. The kind is ratios, unit ids and magnitude
  // bands, and no Indonesian word may appear in it.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(duration)).not.toMatch(
      /milidetik|\bdetik\b|\bmenit\b|\bjam\b|\bhari\b|\bminggu\b|\bdtk\b|\bmnt\b/i,
    );
  });

  test("`indonesian` asks for exactly one key, and every unit fills exactly it", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: `selectForm` is the constant `() => "other"` because Indonesian
    // has no grammatical plural, no gender and no case. This is the kind where
    // that is worth stating loudest — time words are where Dutch's number axis
    // comes alive (*uur* invariant, *dag* marked) and where Ukrainian needs four
    // rows plus a case axis. The sweep includes a count-free call (R5) and 1e6,
    // so a CLDR `many` row would surface here rather than at a user. Rule 6
    // wants exactly this set: one row, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(durationId.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}`).toEqual(["other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it. What this catches
    // is the other thing — a printed word reachable only through an analyzer, by
    // accident rather than by declaration. Indonesian cannot afford that gap at
    // all: `indonesian.analyze` is `[identity()]` and nothing else, so there is
    // no stripper to rescue a form this file forgot to list, and every row below
    // had to be written into `aliases` by hand.
    for (const [unit, words] of Object.entries(durationId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
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
    // fraction takes. Indonesian folds it into `other` along with everything
    // else — `selectForm`'s decision rather than arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no unit is marked, in the kind where every other language has one", () => {
    // The substance of a one-key table. Dutch's file next door has to argue
    // which of these six is invariant and which is marked, and gets three
    // different answers; Indonesian gets one answer six times, and the assertion
    // worth making is that the axis is genuinely absent rather than merely
    // unexercised by the units chosen.
    for (const unit of ["ms", "s", "min", "h", "d", "wk"]) {
      const one = word(unit, 1);
      expect(word(unit, 0), unit).toBe(one);
      expect(word(unit, 2), unit).toBe(one);
      expect(word(unit, 1.5), unit).toBe(one);
      expect(word(unit, 1_000_000), unit).toBe(one);
      // A conversion target carries no count and every language must still
      // answer (R5); the slot changes nothing, because there is no case for a
      // preposition to govern — "dalam menit" holds the word "dua menit" holds.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(one);
    }
    expect(word("h", 2)).toBe("jam");
    expect(word("d", 2)).toBe("hari");
    expect(word("wk", 2)).toBe("minggu");
  });

  test('"min" is typeable here where Dutch has to give it up', () => {
    // The dependency the doc comment names, asserted rather than trusted.
    // `@smartput/duration/locale/nl` loses the SI symbol for the minute because
    // *min* is Dutch's own `minus` keyword and `parse/lex.ts` emits a keyword
    // token before any alias index is consulted. Indonesian spells subtraction
    // "kurang", so the string is free and "5 min" parses as a quantity.
    expect(engine.evaluate("5 min").formatted).toBe("5 menit");
    expect(engine.evaluate("10 menit kurang 4 menit").formatted).toBe("6 menit");
  });

  test("an engine built from it reads and writes Indonesian duration", () => {
    expect(engine.evaluate("1 jam").formatted).toBe("1 jam");
    expect(engine.evaluate("2 jam").formatted).toBe("2 jam");
    // The clipped spellings a cramped Indonesian interface prints — read, and
    // answered with the full word, because recognition is many-to-one (I6)
    // while generation stays one.
    expect(engine.evaluate("20 mnt").formatted).toBe("20 menit");
    expect(engine.evaluate("30 dtk").formatted).toBe("30 detik");
    // The international abbreviations still read, from `units.ts`.
    expect(engine.evaluate("2 h").formatted).toBe("2 jam");
    expect(engine.evaluate("3 d").formatted).toBe("3 hari");
    // Conversions, with both particles the language lists under `in`.
    expect(engine.evaluate("2 jam dalam menit").formatted).toBe("120 menit");
    expect(engine.evaluate("2 jam ke menit").formatted).toBe("120 menit");
    expect(engine.evaluate("3 minggu dalam hari").formatted).toBe("21 hari");
    // A sum landing on a fraction, in both spellings of addition. Written with a
    // comma on purpose: "1.5" is fifteen hundred here, so a test spelled with a
    // full stop would be exercising the group separator — which the row below
    // exercises deliberately instead.
    expect(engine.evaluate("1 jam + 30 menit").formatted).toBe("1,5 jam");
    expect(engine.evaluate("1 jam tambah 30 menit").formatted).toBe("1,5 jam");
    // The remaining two word operators the language claims.
    expect(engine.evaluate("3 jam kali 2").formatted).toBe("6 jam");
    expect(engine.evaluate("3 jam bagi 2").formatted).toBe("1,5 jam");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 detik").formatted).toBe("2.000 detik");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 jam",
      "1 jam tambah 30 menit",
      "2 jam dalam menit",
      "3 minggu dalam hari",
      "30 dtk",
      "2000 detik",
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
