import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerEs from "./es";

const locale = () => composeLocale(spanish, [powerEs]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "power", unit: "w", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({ count: new Decimal(count), kind: "power", unit: "w", slot }),
    ),
  ]),
);

describe("power es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Spanish cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // ratios, unit ids and magnitude bands, and no Spanish noun may appear in it.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(power)).not.toMatch(/vatio|caballo/i);
  });

  test("`spanish` asks for exactly two keys, and every worded unit fills those", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const unit of ["w", "kw", "mw", "gw"]) {
      expect(Object.keys(powerEs.units[unit]?.forms ?? {}).sort(), unit).toEqual([
        "one",
        "other",
      ]);
    }
    // `hp` fills neither, and the reason is the lexer rather than a gap: the
    // honest Spanish expansion "caballo de fuerza" is three words, and a word
    // token ends at a space, so the table could be printed and never read back.
    expect(powerEs.units.hp?.forms).toBeUndefined();
  });

  // The ruling this file exists to record, asserted rather than left in prose.
  // The Spanish word for this quantity names the *metric* horsepower — caballo
  // de vapor, 735,49875 W — and `units.ts` defines `hp` as the mechanical one,
  // 745,69987158227022 W. Registering "cv" or "caballos" here would answer a
  // question about one unit with the other, wrong by 1,4 %: small enough to
  // read as rounding, which is exactly why it needs a test rather than a
  // comment. A `cv` unit is `units.ts`'s business, and that file is the kind's
  // language-free half.
  test("no alias claims the metric horsepower for the mechanical one", () => {
    for (const alias of powerEs.units.hp?.aliases ?? []) {
      expect(alias, `hp claims "${alias}"`).not.toMatch(/^(cv|caballos?)$/i);
    }
    expect(() => engine.evaluate("150 cv")).toThrow();
    // And the ratio the alias would have misrepresented, so the 1,4 % is on the
    // record as a number rather than as a claim.
    expect(engine.evaluate("1 hp en w").value?.canonical.toString()).toBe(
      "745.69987158227022",
    );
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kW" be the symbol while "kw" is the alias. What this catches is
    // a printed word reachable only through `spanish`'s suffix stripper, at its
    // -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(powerEs.units)) {
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
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Spanish folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and only 1 is singular", () => {
    expect(word("w", 1)).toBe("vatio");
    expect(word("w", 2)).toBe("vatios");
    expect(word("w", 0)).toBe("vatios");
    // 21 stays plural in Spanish where Ukrainian makes it singular, and a
    // fraction is plural too.
    expect(word("w", 21)).toBe("vatios");
    expect(word("w", 1.5)).toBe("vatios");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("kw", undefined, "conversion-target")).toBe("kilovatios");
  });

  test("an engine built from it reads and writes Spanish power", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 vatio").formatted).toBe("1 vatio");
    expect(engine.evaluate("2 vatios").formatted).toBe("2 vatios");
    // The SI-brochure spelling reads and the RAE's spelling prints.
    expect(engine.evaluate("2 watts").formatted).toBe("2 vatios");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma throughout: "1.5" is not a Spanish number, since the
    // full stop is this language's group separator.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 kilovatios");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 kw en vatios").formatted).toBe("2.000 vatios");
    expect(engine.evaluate("2 kw a vatios").formatted).toBe("2.000 vatios");
    // `hp` prints its symbol tight against the number, because it has no forms
    // to print instead — the visible cost of the ruling above.
    expect(engine.evaluate("150 hp").formatted).toBe("150 hp");
    expect(engine.evaluate("1 gw en megavatios").formatted).toBe("1.000 megavatios");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kw + 500 w",
      "2 kw en vatios",
      "150 hp",
      "1 gw en megavatios",
      "1 vatio",
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
