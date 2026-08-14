import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import durationTr from "@smartput/duration/locale/tr";
import { speed } from "../index";
import speedTr from "./tr";

const locale = () => composeLocale(turkish, [speedTr]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "speed",
          unit: "knot",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "speed", unit: "knot", slot }),
      ),
    ),
);

describe("speed tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters. The
  // word list is the assertion instead, with the six letters no English word
  // carries kept as a second net for anything added later.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(speed);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of ["sa", "mil", "kn", "deniz"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and only `knot` declares it", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // The decision `en.ts` records, restated because Turkish reaches it from the
    // other direction: this language's table would cost one row per unit and no
    // thought about number at all, and the three compounds still cannot have one
    // — "km/sa" carries a slash and "saatte kilometre" is two words, so neither
    // lexes back as a single unit token. Rule 6 is satisfied by an empty key set
    // for those three, not by one row of unreachable prose.
    expect(speedTr.units.mps?.forms).toBeUndefined();
    expect(speedTr.units.kph?.forms).toBeUndefined();
    expect(speedTr.units.mph?.forms).toBeUndefined();
    expect(Object.keys(speedTr.units.knot?.forms ?? {})).toEqual([...KEYS]);
  });

  // The property `assertLocaleContract` does not check for a word, and cannot
  // check at all for a symbol carrying an operator: "km/sa" is read as
  // arithmetic rather than by lookup, so the alias index has no opinion on it.
  // What is asserted here is the split itself — a printable string either holds
  // an operator, in which case it is a compound and the bridge test below owns
  // it, or it does not, in which case it must be one token and one of this
  // unit's own aliases.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(speedTr.units)) {
      const printable = [words.symbol as string, ...Object.values(words.forms ?? {})];
      const aliases = words.aliases.map((a) => a.toLocaleLowerCase("tr"));
      for (const surface of printable) {
        if (/[/*+\-·×⋅]/.test(surface)) {
          expect(surface, `${unit}'s compound "${surface}" is not a division`).toMatch(
            /^[^/]+\/[^/]+$/,
          );
          continue;
        }
        expect(surface, `${unit}'s "${surface}" is more than one token`).not.toMatch(
          /\s/u,
        );
        expect(aliases, `${unit}: "${surface}" is printed but not readable`).toContain(
          surface.toLocaleLowerCase("tr"),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [speed])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the three compounds leave the Turkish head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilometre" for kph here would give "5 kilometre" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The kind's own division bridge is the path Turkish gets instead, and the
    // hour half of it is `@smartput/duration`'s Turkish symbol rather than
    // anything this package names — which is the one line that would notice if
    // the two files ever disagreed on how Turkish abbreviates "saat".
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedTr.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Turkish head noun`).not.toMatch(
          /^(metre|kilometre|mil|saat)$/,
        );
      }
    }
    expect(durationTr.units.h?.symbol).toBe("sa");
    expect(speedTr.units.kph?.symbol).toBe("km/sa");
  });

  test("the counted noun never changes shape", () => {
    // The whole of Turkish number agreement, in four lines. English needs
    // "knot" and "knots"; Ukrainian needs four nominative rows and four
    // locative ones. Turkish needs one row, and 1, 5 and a fraction all print
    // it unchanged.
    expect(engine.evaluate("1 knot").formatted).toBe("1 knot");
    expect(engine.evaluate("5 knot").formatted).toBe("5 knot");
    expect(engine.evaluate("1,5 knot").formatted).toBe("1,5 knot");
    expect(engine.evaluate("21 knot").formatted).toBe("21 knot");
  });

  test("an engine built from it reads and writes Turkish speed", () => {
    // The one unit that prints as a word, and the three that print as the
    // Turkish compound — spaced, because `turkish.renderQuantity` sets a bare
    // symbol off from the number where English prints "100kph" tight.
    expect(engine.evaluate("5 knot").formatted).toBe("5 knot");
    expect(engine.evaluate("100 kph").formatted).toBe("100 km/sa");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mil/sa");
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    // "kn" is the maritime abbreviation Turkish uses unchanged, and it is an
    // alias so the symbol reads back even though the declared form means it
    // never reaches ordinary output.
    expect(engine.evaluate("5 kn").formatted).toBe("5 knot");
    // A conversion, written with each of the three words the language lists
    // under `in`.
    expect(engine.evaluate("10 knot çevir kph").formatted).toBe("18,52 km/sa");
    expect(engine.evaluate("10 knot cevir kph").formatted).toBe("18,52 km/sa");
    expect(engine.evaluate("10 knot to kph").formatted).toBe("18,52 km/sa");
    expect(engine.evaluate("37,04 kph to knot").formatted).toBe("20 knot");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish.
    expect(engine.evaluate("1 mps + 0,5 mps").formatted).toBe("1,5 m/s");
    expect(engine.evaluate("1 knot artı 0,5 knot").formatted).toBe("1,5 knot");
    // And the group separator, a full stop where English writes a comma.
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000 km/sa");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has, met here
    // through the Latin abbreviation rather than the Turkish word: "KMH" folds
    // to "kmh" untouched, but "MIL" would fold to "mıl" with a DOTLESS ı, and it
    // is `turkish`'s `caseFolds` analyzer — its penalised ASCII pass — that
    // brings the shouted spelling back to the dotted alias.
    expect("MPH".toLocaleLowerCase("tr")).toBe("mph");
    expect(engine.evaluate("5 KNOT").value.unit).toBe("knot");
    expect(engine.evaluate("5 KMH").value.unit).toBe("kph");
  });

  test("vowel harmony is the language's job, not this table's", () => {
    // Nothing below is an alias. Each is a case-marked Turkish word recovered by
    // `turkish`'s flat suffix stripper: "knot" ends in a back vowel, so the
    // dative is -a and never -e, and the locative hardens to -ta after the
    // voiceless t.
    for (const [surface, unit] of [
      ["knota", "knot"],
      ["knotta", "knot"],
      ["knottan", "knot"],
      ["knotlar", "knot"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which is an
    // operator character the lexer will not take back inside a unit word — that
    // compound resolves through `length ÷ duration` in an engine that installs
    // those kinds, and this one deliberately installs only `speed`.
    for (const input of ["5 knot", "1 knot artı 0,5 knot", "37,04 kph to knot", "5 kn"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
