import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationHi from "@smartput/duration/locale/hi";
import { power } from "@smartput/power";
import powerHi from "@smartput/power/locale/hi";
import { energy } from "../index";
import energyHi from "./hi";

const hi = () => composeLocale(hindi, [energyHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [energy] });

/** The units whose name is a compound Hindi cannot write as one token. */
const WATT_HOURS = ["wh", "kwh", "mwh"] as const;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis, which is what makes the tables below two rows.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "energy", unit: "kj", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "energy", unit: "kj", slot }),
      ),
    ]),
  ),
].sort();

describe("energy hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the nouns: the kind is ratios, unit
    // ids, magnitude bands and the four power/duration/energy signatures, so any
    // character from a script no ratio could contain is the failure.
    expect(JSON.stringify(energy)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    // The contract this whole file keys off, asserted before anything indexes a
    // table with it. Two, where Arabic has six and Ukrainian has eight on two
    // axes — `@smartput/core/locale/hi` rejected an oblique-case axis on purpose,
    // because the direct and oblique singular of a consonant-final masculine
    // loanword are the same word.
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit carries exactly that key set, or none at all", () => {
    // The watt-hour family is the exception `en.ts` records and every
    // translation restates: its Hindi name is a compound ("किलोवाट-घंटा") that
    // `lex` splits at the space or the hyphen, so there is no token to put in a
    // table. Every other unit carries both rows and nothing else.
    for (const [unit, words] of Object.entries(energyHi.units)) {
      if ((WATT_HOURS as readonly string[]).includes(unit)) {
        expect(words.forms, `${unit} declares a form`).toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. A word the printer emits should
    // never come back through the penalised path.
    for (const [unit, words] of Object.entries(energyHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      // The symbol too, including the three that can never match as aliases —
      // they are listed as documentation of what the printer emits, exactly as
      // `uk.ts` and `ar.ts` list theirs, and this is the assertion that keeps
      // that promise honest.
      expect(words.aliases, `${unit} prints a symbol it does not list`).toContain(
        words.symbol as string,
      );
    }
  });

  test("the watt-hour symbols carry the interpunct, and nothing else does", () => {
    // U+00B7 is the SI multiplication sign and `lex` reads it as a spelling of
    // `*`, which is what makes "किलोवाट·घंटा" re-read as power × duration rather
    // than fail as an unknown word. Every other symbol here has to be one token,
    // because no signature could compute it back.
    for (const [unit, words] of Object.entries(energyHi.units)) {
      const symbol = words.symbol as string;
      if ((WATT_HOURS as readonly string[]).includes(unit)) {
        expect(symbol, `${unit} lost its interpunct`).toContain("·");
        continue;
      }
      expect(symbol, `${unit}'s symbol holds an operator character`).not.toMatch(
        /[/*+\-·×⋅]/,
      );
      expect(symbol, `${unit}'s symbol is more than one token`).not.toMatch(/\s/u);
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has a trap in it: ड़, ज़ and फ़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B/U+095E into a consonant plus
    // the nukta U+093C. A table written with a precomposed character tests green
    // against direct calls on this object and is unreachable through the engine.
    // Nothing here carries a nukta today; the assertion is what stops one
    // arriving precomposed.
    for (const [unit, words] of Object.entries(energyHi.units)) {
      for (const s of [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [energy])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [energy], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. The words agree on
    // this kind, which is exactly why the boundary is stated against the language
    // rather than left to the formatter — `@smartput/duration/locale/hi` is where
    // the same two keys select two different words.
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "energy",
        unit: "kj",
        slot: "bare",
      });
    expect([key(0), key(0.5), key(1), key(1.5)]).toEqual(["one", "one", "one", "other"]);
    expect(word("kj", 0)).toBe("किलोजूल");
    expect(word("kj", 1.5)).toBe("किलोजूल");
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table. A unit noun after a numeral stays in the direct
    // singular — "पाँच किलोजूल", never "पाँच किलोजूलें" — so the two rows agree on
    // every unit that has them, कैलोरी included: it is feminine and ī-final and
    // would take कैलोरियाँ if the measure-noun rule did not outrank the gender
    // rule.
    for (const unit of Object.keys(energyHi.units)) {
      if ((WATT_HOURS as readonly string[]).includes(unit)) continue;
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("cal", 5)).toBe("कैलोरी");
    expect(word("btu", 1)).toBe("बीटीयू");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("kj", count, "conversion-target")).toBe(
        word("kj", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("kj", undefined)).toBe("किलोजूल");
  });

  test("an engine built from it reads and writes Hindi energy", () => {
    const e = engine();
    expect(e.evaluate("5 किलोजूल").formatted).toBe("5 किलोजूल");
    expect(e.evaluate("500 कैलोरी").formatted).toBe("500 कैलोरी");
    expect(e.evaluate("18000 बीटीयू").formatted).toBe("18,000 बीटीयू");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question.
    expect(e.evaluate("2 किलोकैलोरी में कैलोरी").formatted).toBe("2,000 कैलोरी");
    expect(e.evaluate("1 मेगाजूल को किलोजूल").formatted).toBe("1,000 किलोजूल");
    expect(e.evaluate("1 मेगाजूल से किलोजूल").formatted).toBe("1,000 किलोजूल");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and the word is the one 1 takes.
    expect(e.evaluate("1 किलोजूल जोड़ 500 जूल").formatted).toBe("1.5 किलोजूल");
    // Zero, which is Hindi's singular row where English would use its plural.
    expect(e.evaluate("0 जूल").formatted).toBe("0 जूल");
    // A cardinal read through `hindi.numerals`, including लाख — the scale English
    // has no word for, and the reason `hi-cardinals.ts` is not a translation of
    // `en`'s table.
    expect(e.evaluate("पाँच किलोजूल").formatted).toBe("5 किलोजूल");
    expect(e.evaluate("एक लाख जूल को किलोजूल").formatted).toBe("100 किलोजूल");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. `kwh` prints the interpunct compound,
    // which needs no alias of its own because the arithmetic in it is true —
    // see the bridge test below.
    expect(e.evaluate("1 kwh को मेगाजूल").formatted).toBe("3.6 मेगाजूल");
    expect(e.evaluate("1 kwh").formatted).toBe("1 किलोवाट·घंटा");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 मेगाजूल को जूल").formatted).toBe("1,000,000 जूल");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 जूल").formatted).toBe("1,000,000 जूल");
  });

  test("what it prints, it reads back", () => {
    // Every unit but the watt-hour family, whose symbol is arithmetic rather than
    // a word and needs both operand kinds installed — the bridge test below is
    // where that reads back.
    const e = engine();
    for (const input of [
      "5 किलोजूल",
      "1 किलोजूल जोड़ 500 जूल",
      "2 किलोकैलोरी में कैलोरी",
      "1 मेगाजूल को किलोजूल",
      "18000 बीटीयू",
      "500 कैलोरी",
      "0 जूल",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the compound Hindi writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than trusted:
    // "किलोवाट·घंटा" needs no alias here because it is already a power times a
    // duration, and `energy.ops` names both operands by id string. This is why
    // the watt-hour family can print a compound at all, and it is also why that
    // compound is spelled with U+00B7 rather than the hyphen Hindi print uses —
    // the interpunct is the one character that is both correct notation and an
    // operator the lexer knows.
    const wired = createEngine({
      locales: [composeLocale(hindi, [energyHi, powerHi, durationHi])],
      kinds: [energy, power, duration],
    });
    const bridged = wired.evaluate("5 किलोवाट·घंटा");
    expect(bridged.kind).toBe("energy");
    expect(bridged.value?.canonical.toString()).toBe("18000000");
    expect(wired.evaluate("2 किलोवाट·घंटा में मेगाजूल").formatted).toBe("7.2 मेगाजूल");
    // And the printed symbol re-read: the engine's own output, back in.
    const printed = wired.evaluate("1 kwh").formatted;
    expect(printed).toBe("1 किलोवाट·घंटा");
    expect(wired.evaluate(printed).value?.canonical.toString()).toBe("3600000");
    // The spaced spelling Hindi print actually uses is *not* readable, and that
    // is the reason the interpunct is there rather than a decoration: `lex` ends
    // a word token at the space, so the two words arrive as a power followed by a
    // stray duration with no operator between them.
    expect(() => wired.evaluate("1 किलोवाट घंटा")).toThrow();
  });
});
