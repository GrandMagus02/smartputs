import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationPt from "./pt";

const locale = () => composeLocale(portuguese, [durationPt]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "duration", unit: "h", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot,
      }),
    ),
  ]),
);

describe("duration pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Portuguese
  // cannot borrow it — the kind is already full of Latin letters, so a script
  // test would fail on its own unit ids — so the words themselves are the check:
  // the kind is ratios, unit ids and magnitude bands, and none of the six
  // Portuguese nouns may appear anywhere in it.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(duration)).not.toMatch(
      /miliss?egundo|segundo|minuto|hora|\bdia\b|semana/i,
    );
  });

  test("`portuguese` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: one axis, two rows, and no slot
    // dimension — "em minutos" is spelled like a bare quantity. `other` also
    // absorbs CLDR's third Portuguese category `many`, which `Intl` really
    // returns at 1e6 and its multiples and which is a fact about the numeral
    // ("1 milhão") rather than about the noun. 1e6 is in the sweep above so that
    // fold is sampled here rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(durationPt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it and
    // `assertLocaleContract` looks a printed surface up the same way. What this
    // catches is the other thing — a printed word reachable only through
    // `portuguese`'s suffix stripper, at its -2 penalty, so by accident rather
    // than by declaration. Every plural below is listed rather than left to it.
    for (const [unit, words] of Object.entries(durationPt.units)) {
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
    // fraction takes. Portuguese sends it to `one` — "1,5 hora" — which is the
    // opposite of English and Spanish, and is exactly the row a translator
    // copying either of those would leave unreachable.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and the singular reaches past 1", () => {
    expect(word("h", 1)).toBe("hora");
    expect(word("h", 2)).toBe("horas");
    // CLDR's Portuguese rule is `i = 0..1`: the integer part decides, so 0 and
    // 1,5 both take the singular. "0 hora" and "1,5 hora" are the two rows a
    // translator borrowing an English or Spanish intuition writes as plurals.
    expect(word("h", 0)).toBe("hora");
    expect(word("h", 1.5)).toBe("hora");
    // 21 stays plural in Portuguese where Ukrainian makes it singular.
    expect(word("h", 21)).toBe("horas");
    // A conversion target carries no count and every language must still answer
    // (R5). Portuguese answers with the plural, which is how "2 h em minutos" is
    // written.
    expect(word("min", undefined, "conversion-target")).toBe("minutos");
    // The unaccented row: unlike Spanish's "día", the Portuguese word is spelled
    // without a diacritic in both numbers, so there is nothing to list twice.
    expect(word("d", 1)).toBe("dia");
    expect(word("d", 2)).toBe("dias");
  });

  test("an engine built from it reads and writes Portuguese duration", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 hora").formatted).toBe("1 hora");
    expect(engine.evaluate("2 horas").formatted).toBe("2 horas");
    // A sum landing on a fraction, which is where the decimal comma shows — and
    // where the noun stays singular, which is the Portuguese rule this locale
    // exists to get right. Written with a comma throughout on purpose: "1.5" is
    // not a Portuguese number, since the full stop is the group separator.
    expect(engine.evaluate("1 h + 30 min").formatted).toBe("1,5 hora");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 h em minutos").formatted).toBe("120 minutos");
    expect(engine.evaluate("2 h para minutos").formatted).toBe("120 minutos");
    // Latin abbreviations still read: a Portuguese speaker types "h" and "min",
    // and the aliases derive from `units.ts` before the Portuguese nouns are
    // appended to them.
    expect(engine.evaluate("2 h").formatted).toBe("2 horas");
    expect(engine.evaluate("90 seg").formatted).toBe("90 segundos");
    // The doubled s, and the single-s spelling that is read but never printed.
    expect(engine.evaluate("250 milissegundos").formatted).toBe("250 milissegundos");
    expect(engine.evaluate("250 milisegundos").formatted).toBe("250 milissegundos");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`. "2.000"
    // is two thousand seconds and not two of them, which is the whole reason
    // this locale's tests never write "1.5".
    expect(engine.evaluate("2000 s").formatted).toBe("2.000 segundos");
    // The week, whose symbol had to lose the full stop Portuguese writes it
    // with, and which is a homograph of the preposition "sem" — safe because the
    // keyword table does not claim that word.
    expect(engine.evaluate("3 semanas em dias").formatted).toBe("21 dias");
    expect(engine.evaluate("3 sem em dias").formatted).toBe("21 dias");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 h + 30 min",
      "2 h em minutos",
      "2 dias",
      "3 semanas em dias",
      "2000 s",
      "1 hora",
      "250 milissegundos",
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
