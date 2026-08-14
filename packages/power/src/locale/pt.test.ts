import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerPt from "./pt";

const locale = () => composeLocale(portuguese, [powerPt]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "power", unit: "w", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "power",
        unit: "w",
        slot,
      }),
    ),
  ]),
);

/** The four units that carry words, and the one that deliberately does not. */
const WORDED = ["w", "kw", "mw", "gw"];

describe("power pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Portuguese
  // cannot borrow it — the kind is already full of Latin letters, so a script
  // test would fail on its own unit ids — so the words are the check: the kind
  // is ratios, unit ids and magnitude bands, and no Portuguese noun may appear
  // in it. "cavalo" is in the list even though this file refuses to register it,
  // because the kind must not carry it either.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(power)).not.toMatch(/quilowatt|v[áa]tio|cavalo/i);
  });

  test("`portuguese` asks for exactly two keys, and every worded unit fills those", () => {
    // The contract the language author pinned: one axis, two rows, no slot
    // dimension. `one` covers 1 and — because CLDR's Portuguese rule is
    // `i = 0..1` — also 0 and 1,5; `other` covers everything else, including
    // CLDR's third Portuguese category `many`, which `Intl` really returns at
    // 1e6 and which `selectForm` folds away because it is a fact about the
    // numeral ("1 milhão") and not about the noun. 1e6 is in the sweep so the
    // fold is sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const unit of WORDED) {
      expect(Object.keys(powerPt.units[unit]?.forms ?? {}).sort(), unit).toEqual([
        "one",
        "other",
      ]);
    }
    // And `hp` fills neither, for the reason the vocabulary's doc comment gives:
    // "cavalo de força" is three words the lexer cannot read back as one token,
    // and every one-word Portuguese name for the quantity ("cavalo", "cv") names
    // the *metric* horsepower, which is a different number.
    expect(powerPt.units.hp?.forms, "hp declares a form").toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kW" be the symbol while "kw" is the alias. What this catches is
    // a printed word reachable only through `portuguese`'s suffix stripper, at
    // its -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(powerPt.units)) {
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

  test("no metric-horsepower word is registered anywhere in the table", () => {
    // The ruling that cost this file its most idiomatic word, asserted rather
    // than left in prose: `cv` is 735,49875 W and `units.ts` defines `hp` as
    // 745,69987158227022 W, so any of these spellings pointing at `hp` would
    // answer a question about one unit with the other's number.
    const every = Object.values(powerPt.units).flatMap((w) => [
      ...w.aliases,
      ...Object.values(w.forms ?? {}),
    ]);
    for (const banned of ["cv", "cavalo", "cavalos", "cavalo-vapor"]) {
      expect(
        every.map((a) => a.toLowerCase()),
        `"${banned}" is registered`,
      ).not.toContain(banned);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Portuguese sends it to `one` rather than `other` — the
    // opposite of English and Spanish — so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and the singular reaches past 1", () => {
    expect(word("w", 1)).toBe("watt");
    expect(word("w", 2)).toBe("watts");
    // The integer part decides, so 0 and 1,5 are singular — the two rows a
    // translator borrowing an English or Spanish intuition writes as plurals.
    expect(word("w", 0)).toBe("watt");
    expect(word("w", 1.5)).toBe("watt");
    // 21 stays plural in Portuguese where Ukrainian makes it singular.
    expect(word("w", 21)).toBe("watts");
    // The q-prefixed row, in both numbers.
    expect(word("kw", 1)).toBe("quilowatt");
    expect(word("kw", 2)).toBe("quilowatts");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("w", undefined, "conversion-target")).toBe("watts");
    // And the unit that answers nothing at all, on purpose.
    expect(word("hp", 2)).toBeUndefined();
  });

  test("an engine built from it reads and writes Portuguese power", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 watt").formatted).toBe("1 watt");
    expect(engine.evaluate("2 watts").formatted).toBe("2 watts");
    // The European word reads and the Brazilian one prints — many-to-one
    // recognition (I6) with a single generation.
    expect(engine.evaluate("2 vátios").formatted).toBe("2 watts");
    expect(engine.evaluate("2 vatios").formatted).toBe("2 watts");
    // The k-spelling reads, the q-spelling prints.
    expect(engine.evaluate("3 kilowatts").formatted).toBe("3 quilowatts");
    expect(engine.evaluate("3 quilowatts").formatted).toBe("3 quilowatts");
    // A sum landing on a fraction, which is where the decimal comma shows and
    // where the noun stays singular. Written with a comma on purpose: "1.5" is
    // not a Portuguese number, since the full stop is the group separator.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 quilowatt");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 kw em watts").formatted).toBe("2.000 watts");
    expect(engine.evaluate("2 kw para watts").formatted).toBe("2.000 watts");
    // `hp` prints its symbol tight against the number, because it has no forms
    // to print instead.
    expect(engine.evaluate("150 hp").formatted).toBe("150hp");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kw + 500 w",
      "2 kw em watts",
      "3 kilowatts",
      "2 vátios",
      "150 hp",
      "1 watt",
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
