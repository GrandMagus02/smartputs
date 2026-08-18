import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationDe from "@smartput/duration/locale/de";
import { length } from "@smartput/length";
import lengthDe from "@smartput/length/locale/de";
import { speed } from "../index";
import speedDe from "./de";

const locale = () => composeLocale(german, [speedDe]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "speed",
          unit: "knot",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "speed", unit: "knot", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("speed de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which German cannot borrow: the kind is already full of Latin letters. What
  // German has instead is orthography — every German noun is capitalised, so a
  // German word reaching the language-free half arrives with a capital, and the
  // descriptor (ratios, unit ids, magnitude bands and one bridge signature
  // naming its operands by string) has none.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(speed);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const word_ of ["knoten", "kilometer", "meile", "stunde"]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}n?\\b`, "i"),
      );
    }
  });

  test("only `knot` declares written forms, and it declares exactly four", () => {
    // The decision `en.ts` records, restated for a language that closes most of
    // its compounds up and cannot close this one: "Kilometer pro Stunde" is
    // three words and "km/h" carries an operator, so neither lexes back as one
    // unit token and a forms table for them would be unreachable prose.
    expect(speedDe.units.mps?.forms).toBeUndefined();
    expect(speedDe.units.kph?.forms).toBeUndefined();
    expect(speedDe.units.mph?.forms).toBeUndefined();
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    expect(Object.keys(speedDe.units.knot?.forms ?? {}).sort()).toEqual([...KEYS].sort());
  });

  test("the three compounds leave the German head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilometer" for kph here would give "5 Kilometer" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed —
    // and `german`'s compound splitter would then put every `-meter` compound in
    // the language into both kinds too. The bridge below is what German gets
    // instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedDe.units[unit]?.aliases ?? []) {
        expect(
          ["meter", "kilometer", "meile", "meilen", "stunde", "stunden"],
          `${unit} claims a head noun that belongs to another kind`,
        ).not.toContain(alias.toLowerCase());
      }
    }
    expect(speedDe.units.knot?.aliases).toContain("knoten");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. A symbol carrying an operator is outside what any alias index can
    // decide — it re-reads as arithmetic, which the bridge test below measures —
    // so it is exempted here by the same rule the contract itself applies.
    for (const [unit, words] of Object.entries(speedDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      if (!/[/*+\-·×⋅]/.test(symbol)) {
        expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
          symbol.toLowerCase(),
        );
      }
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [speed])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`Knoten` is invariant across all four keys", () => {
    // An `-en` masculine: its plural equals its singular, and its dative plural
    // has nowhere to add German's `-n` to because the word already ends in one.
    // Four keys, one word, and the reason is the noun class rather than an
    // unfinished table — `@smartput/duration`'s `Tag` spends three words across
    // the same four keys.
    expect(word("knot", 1)).toBe("Knoten");
    expect(word("knot", 5)).toBe("Knoten");
    expect(word("knot", 1.5)).toBe("Knoten");
    expect(word("knot", 5, "conversion-target")).toBe("Knoten");
    expect(word("knot", undefined, "conversion-target")).toBe("Knoten");
  });

  test("an engine built from it reads and writes German speed", () => {
    expect(engine.evaluate("5 Knoten").formatted).toBe("5 Knoten");
    expect(engine.evaluate("1 Knoten").formatted).toBe("1 Knoten");
    // Case-folding, both directions: the alias index lowercases, so the capital
    // a German writes and the lowercase a search box gets are one key.
    expect(engine.evaluate("5 knoten").formatted).toBe("5 Knoten");
    expect(engine.evaluate("5 kn").formatted).toBe("5 Knoten");
    // The three compounds print on their symbol, spaced by
    // `german.renderQuantity` where English and Ukrainian both set a symbol
    // tight ("100kph", "100км/год") — DIN 1301-1 wants the gap.
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("100 kmh").formatted).toBe("100 km/h");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mph");
    // A conversion, with each of the three prepositions the language lists under
    // `in`.
    expect(engine.evaluate("10 Knoten in kmh").formatted).toBe("18,52 km/h");
    expect(engine.evaluate("37,04 kph nach Knoten").formatted).toBe("20 Knoten");
    expect(engine.evaluate("37,04 kph zu Knoten").formatted).toBe("20 Knoten");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German, so a
    // test spelled with a full stop would be exercising the group separator —
    // which the row below exercises deliberately instead.
    expect(engine.evaluate("1 Knoten + 0,5 Knoten").formatted).toBe("1,5 Knoten");
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000 km/h");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which the
    // lexer will not take back inside a unit word — it takes it as division
    // instead, which is what the bridge test below is for.
    for (const input of [
      "5 Knoten",
      "1 Knoten + 0,5 Knoten",
      "37,04 kph nach Knoten",
      "1,5 Knoten",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });

  test("the compound German writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/h" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is the
    // reason leaving "Kilometer" to `@smartput/length` costs German nothing —
    // and the German spelling of the phrase goes through the same door, since
    // "Stunde" is `@smartput/duration`'s word and the solidus is the operator.
    const wired = createEngine({
      locales: [composeLocale(german, [lengthDe, durationDe, speedDe])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / h");
    expect(bridged.kind).toBe("speed");
    // "kph" since spec §D: a derived result keeps the units the person wrote,
    // and (km, /, h) is exactly what the registry's derived-unit table calls
    // `kph`. The bridge is unchanged — `speed.ops` still names both operands by
    // id string and still returns `mps` — what moved is that returning the
    // canonical now reads as "the plugin declined to choose".
    expect(bridged.value.unit).toBe("kph");
    expect(wired.evaluate("100 Kilometer / Stunde").kind).toBe("speed");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 Kilometer / Stunde in kmh").formatted).toBe("100 km/h");
    expect(wired.evaluate("1852 Meter / Stunde in Knoten").formatted).toBe("1 Knoten");
  });
});
