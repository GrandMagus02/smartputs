import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationEs from "./es";

const locale = () => composeLocale(spanish, [durationEs]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "duration", unit: "h", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot,
      }),
    ),
  ]),
);

describe("duration es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Spanish cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words themselves are the check: the
  // kind is ratios, unit ids and magnitude bands, and none of the six Spanish
  // nouns may appear anywhere in it.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(duration)).not.toMatch(
      /milisegundo|segundo|minuto|hora|d[íi]a|semana/i,
    );
  });

  test("`spanish` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, which `selectForm` folds into `other`
    // because this engine never prints compact notation. 1e6 is in the sweep
    // above so the fold is sampled here rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(durationEs.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does: `buildRegistry`
    // lowercases an alias before indexing it and `assertLocaleContract` looks a
    // printed surface up the same way, so "d" covers "D" and a symbol never has
    // to be listed twice. What this catches is the other thing — a printed word
    // reachable only through `spanish`'s suffix stripper, at its -2 penalty, so
    // by accident rather than by declaration. "días" is exactly that shape: the
    // stripper would find "día" from it, and the vocabulary lists it anyway.
    for (const [unit, words] of Object.entries(durationEs.units)) {
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
    // fraction takes. Spanish folds it into `other`, the row 2 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and only 1 is singular", () => {
    expect(word("h", 1)).toBe("hora");
    expect(word("h", 2)).toBe("horas");
    expect(word("h", 0)).toBe("horas");
    // 21 stays plural in Spanish where Ukrainian makes it singular, and a
    // fraction is plural too — the two counts a hand-written plural rule
    // borrowed from another language gets wrong.
    expect(word("h", 21)).toBe("horas");
    expect(word("h", 1.5)).toBe("horas");
    // A conversion target carries no count and every language must still answer
    // (R5). Spanish answers with the plural, which is how "2 h en minutos" is
    // written.
    expect(word("min", undefined, "conversion-target")).toBe("minutos");
    // The accented row, in both numbers: the acute survives pluralisation.
    expect(word("d", 1)).toBe("día");
    expect(word("d", 2)).toBe("días");
  });

  test("an engine built from it reads and writes Spanish duration", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 hora").formatted).toBe("1 hora");
    expect(engine.evaluate("2 horas").formatted).toBe("2 horas");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma throughout on purpose: "1.5" is not a Spanish
    // number, since the full stop is this language's group separator.
    expect(engine.evaluate("1 h + 30 min").formatted).toBe("1,5 horas");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 h en minutos").formatted).toBe("120 minutos");
    expect(engine.evaluate("2 h a minutos").formatted).toBe("120 minutos");
    // Latin abbreviations still read: a Spanish speaker types "h" and "min",
    // and the aliases derive from `units.ts` before the Spanish nouns are
    // appended to them.
    expect(engine.evaluate("2 h").formatted).toBe("2 horas");
    expect(engine.evaluate("90 seg").formatted).toBe("90 segundos");
    // The accented unit, typed both ways: with the acute a Spanish keyboard
    // produces, and without it, since NFKC folds neither into the other.
    expect(engine.evaluate("2 días").formatted).toBe("2 días");
    expect(engine.evaluate("2 dias").formatted).toBe("2 días");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`. "2.000"
    // is two thousand seconds and not two of them, which is the whole reason
    // this locale's tests never write "1.5".
    expect(engine.evaluate("2000 s").formatted).toBe("2.000 segundos");
    // The week, whose symbol had to lose the full stop Spanish writes it with.
    expect(engine.evaluate("3 semanas en días").formatted).toBe("21 días");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 h + 30 min",
      "2 h en minutos",
      "2 dias",
      "3 semanas en días",
      "2000 s",
      "1 hora",
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
