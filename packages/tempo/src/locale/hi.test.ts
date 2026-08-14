import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationHi from "@smartput/duration/locale/hi";
import { tempo } from "../index";
import tempoHi from "./hi";

const hi = () => composeLocale(hindi, [tempoHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [tempo] });

/**
 * हर्ट्ज़, with the nukta as an escape — the same way `hi.ts` builds it, and for
 * the same reason: a literal U+093C renders underneath the letter before it and
 * is one careless retype away from vanishing, which would silently turn every
 * expectation below into an assertion about the nukta-less alias instead.
 */
const HERTZ = "\u0939\u0930\u094D\u091F\u094D\u091C\u093C";

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis, which is what makes `hz`'s table below two rows.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "tempo", unit: "hz", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "tempo", unit: "hz", slot }),
      ),
    ]),
  ),
].sort();

describe("tempo hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the words: the kind is two ratios, two
    // unit ids, magnitude bands and the reciprocal bridge to `duration`, so any
    // character from a script no ratio could contain is the failure.
    expect(JSON.stringify(tempo)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    // The contract `hz`'s table keys off, asserted before anything indexes it.
    // Two, where Arabic has six and Ukrainian has eight on two axes —
    // `@smartput/core/locale/hi` rejected an oblique-case axis on purpose,
    // because the direct and oblique singular of a consonant-final masculine
    // loanword are the same word.
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("only `hz` declares written forms", () => {
    // The ruling `en.ts` records: "बीट प्रति मिनट" is three words and
    // "बीट/मिनट" carries a slash, so neither lexes back as one unit token and a
    // forms table for either would be unreachable prose.
    expect(tempoHi.units.bpm?.forms, "bpm declares a form").toBeUndefined();
    expect(Object.keys(tempoHi.units.hz?.forms ?? {}).sort()).toEqual(KEYS);
  });

  test("both symbols are one token, because tempo has no arithmetic to fall back on", () => {
    // The argument `@smartput/tempo/locale/uk` spells out, restated for Hindi.
    // `energy` survives a compound symbol by making the arithmetic true
    // ("किलोवाट·घंटा" is power × duration) and `speed` by the same trick with a
    // slash. Tempo's canonical *is* beats per minute: there is no "beat" kind for
    // बीट to be a quantity of, and `index.ts` declares only the two reciprocal
    // `in` bridges and no `/` at all. So an operator in either symbol would have
    // nothing to compute and the printed tempo would throw on its own output.
    for (const [unit, words] of Object.entries(tempoHi.units)) {
      const symbol = words.symbol as string;
      expect(symbol, `${unit}'s symbol holds an operator character`).not.toMatch(
        /[/*+\-·×⋅]/,
      );
      expect(symbol, `${unit}'s symbol is more than one token`).not.toMatch(/[\s.]/u);
      expect(
        words.aliases,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. A word the printer emits should
    // never come back through the penalised path.
    for (const [unit, words] of Object.entries(tempoHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("the hertz ships with a decomposed nukta", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and ज़ is a Unicode composition *exclusion*: NFKC decomposes U+095B into ज
    // plus the nukta U+093C. A table written with the precomposed character tests
    // green against direct calls on this object and is unreachable through the
    // engine — the worst shape a bug can take, and here it would be doubly quiet,
    // because the nukta-less हर्ट्ज is a listed alias that would keep every
    // equality in the file true. Stated as codepoints so the assertion cannot be
    // satisfied by a character that merely looks right.
    const symbol = tempoHi.units.hz?.symbol ?? "";
    expect([...symbol].map((c) => c.codePointAt(0))).toEqual([
      0x939, 0x930, 0x94d, 0x91f, 0x94d, 0x91c, 0x93c,
    ]);
    for (const [unit, words] of Object.entries(tempoHi.units)) {
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
    expect(() => assertLocaleContract(hi(), [tempo])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [tempo], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. हर्ट्ज़ spells both
    // rows alike, because a Hindi measure noun stays in the direct singular after
    // a numeral — English reaches the same one word by a different route (hertz
    // is its own plural) and Arabic declines it outright, which is why this is
    // stated against the language rather than left to the formatter.
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "tempo",
        unit: "hz",
        slot: "bare",
      });
    expect([key(0), key(0.5), key(1), key(1.5)]).toEqual(["one", "one", "one", "other"]);
    expect(word("hz", 0)).toBe(HERTZ);
    expect(word("hz", 1.5)).toBe(HERTZ);
    // The slot is inert too: Hindi's axis is the count alone, and a count-free
    // conversion target (ruling R5) lands on `other`.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("hz", count, "conversion-target")).toBe(
        word("hz", count, "bare") as string,
      );
    }
    expect(word("hz", undefined)).toBe(HERTZ);
  });

  test("an engine built from it reads and writes Hindi tempo", () => {
    const e = engine();
    // The plain quantity, with a space between number and symbol:
    // `hindi.renderQuantity` sets a Devanagari symbol off from the number where
    // the default template sets it tight, branching on the script of the symbol.
    expect(e.evaluate("120 बीपीएम").formatted).toBe("120 बीपीएम");
    expect(e.evaluate(`2 ${HERTZ}`).formatted).toBe(`2 ${HERTZ}`);
    // The nukta-less spelling, which a keyboard without a nukta key produces: read
    // and answered with the spelling that has one.
    expect(e.evaluate("1 हर्ट्ज को बीपीएम").formatted).toBe("60 बीपीएम");
    // बीट standing for the whole abbreviation, by the same elision that lets
    // English "bpm" be typed for a tempo. Read, never printed.
    expect(e.evaluate("90 बीट").formatted).toBe("90 बीपीएम");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`.
    expect(e.evaluate(`120 बीपीएम में ${HERTZ}`).formatted).toBe(`2 ${HERTZ}`);
    expect(e.evaluate(`120 बीपीएम को ${HERTZ}`).formatted).toBe(`2 ${HERTZ}`);
    expect(e.evaluate(`120 बीपीएम से ${HERTZ}`).formatted).toBe(`2 ${HERTZ}`);
    // A sum, written with the arithmetic noun जोड़, which Hindi reads infix ("दस
    // जोड़ पाँच") even though a full sentence puts the operator last.
    expect(e.evaluate("60 बीपीएम जोड़ 30 बीपीएम").formatted).toBe("90 बीपीएम");
    // Zero and the two fractions, which is where Hindi's plural boundary sits and
    // where the printed word does not move because a measure noun does not count.
    expect(e.evaluate(`0 ${HERTZ}`).formatted).toBe(`0 ${HERTZ}`);
    expect(e.evaluate(`0.5 ${HERTZ}`).formatted).toBe(`0.5 ${HERTZ}`);
    expect(e.evaluate(`1.5 ${HERTZ}`).formatted).toBe(`1.5 ${HERTZ}`);
    // A cardinal read through `hindi.numerals`, whose scales are सौ, हज़ार, लाख
    // and करोड़ — the last two being the ones English has no word for.
    expect(e.evaluate("एक सौ बीस बीपीएम").formatted).toBe("120 बीपीएम");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("120 bpm").formatted).toBe("120 बीपीएम");
    expect(e.evaluate("2 hertz").formatted).toBe(`2 ${HERTZ}`);
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate(`20000 ${HERTZ} में बीपीएम`).formatted).toBe(
      "1,200,000 बीपीएम",
    );
    expect(new Intl.NumberFormat("hi").format(1_200_000)).toBe("12,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce.
    expect(engine().evaluate("12,00,000 बीपीएम").formatted).toBe("1,200,000 बीपीएम");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "120 बीपीएम",
      `2 ${HERTZ}`,
      `0.5 ${HERTZ}`,
      `1.5 ${HERTZ}`,
      "1 हर्ट्ज को बीपीएम",
      `120 बीपीएम में ${HERTZ}`,
      "60 बीपीएम जोड़ 30 बीपीएम",
      "120 bpm",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the reciprocal bridge speaks Hindi on both sides", () => {
    // `index.ts` declares `in | tempo | duration` and its inverse, and neither
    // names a language: a tempo converted into a duration is the period of one
    // beat. It is asserted here because the bridge is the only route by which
    // this kind's units meet another vocabulary's, and the postposition that
    // drives it is Hindi's.
    const wired = createEngine({
      locales: [composeLocale(hindi, [tempoHi, durationHi])],
      kinds: [tempo, duration],
    });
    expect(wired.evaluate("120 बीपीएम में सेकंड").formatted).toBe("0.5 सेकंड");
    expect(wired.evaluate("120 बीपीएम को मिलीसेकंड").formatted).toBe("500 मिलीसेकंड");
    expect(wired.evaluate("0.5 सेकंड में बीपीएम").formatted).toBe("120 बीपीएम");
  });
});
