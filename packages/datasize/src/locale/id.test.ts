import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeId from "./id";

const locale = () => composeLocale(indonesian, [datasizeId]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "datasize", unit: "gb", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "gb",
        slot,
      }),
    ),
  ]),
);

describe("datasize id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // can borrow no more than Dutch can: the kind is already full of Latin
  // letters. German's substitute — every noun carries a capital — does not
  // transfer either, since Indonesian capitalises no common noun. So the words
  // are the check. The nine Indonesian nouns are English's nine, borrowed
  // unadapted, so what this asserts is that the *kind* names none of them: it is
  // ratios, unit ids and magnitude bands, and "kilobyte" is bound in `units.ts`
  // as an alias, which is the other half of the same separation.
  test("the kind itself carries no Indonesian word", () => {
    const descriptor = JSON.stringify(datasize);
    for (const word_ of [
      "byte",
      "kilobyte",
      "megabyte",
      "gigabyte",
      "kibibyte",
      "bita",
    ]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}s?\\b`, "i"),
      );
    }
  });

  test("`indonesian` asks for exactly one key, and every unit fills exactly it", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: `selectForm` is the constant `() => "other"`, because Indonesian
    // has no grammatical plural, no gender and no case, so a fraction, a zero, a
    // million and a count-free conversion target (R5) all take one noun. The
    // sweep includes 1e6 so that a CLDR `many` row, if this locale ever declared
    // one, would surface here rather than at a user. Rule 6 wants a `forms`
    // table holding exactly this set — one row, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(datasizeId.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}`).toEqual(["other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so the SI capital
    // in "MB" meets the derived lowercase "mb" and a symbol never has to be
    // listed twice. What this catches is the other thing — a printed word
    // reachable only through an analyzer, by accident rather than declaration.
    // Indonesian cannot afford that gap at all: `indonesian.analyze` is
    // `[identity()]` and nothing else, so there is no stripper to rescue a form
    // this file forgot to list.
    for (const [unit, words] of Object.entries(datasizeId.units)) {
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
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Indonesian folds it into `other` along with everything
    // else — which is `selectForm`'s decision rather than arithmetic, so it is
    // sampled and not assumed.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the noun is invariant across every count and every slot", () => {
    // The substance of a one-key table, written out so the claim is measured
    // rather than restated. A Dutch or German file has to argue which of its
    // units is invariant and which is marked; Indonesian has no marked unit
    // anywhere in the language, so the interesting assertion is that the axis is
    // genuinely absent rather than merely unused by this kind.
    expect(word("gb", 1)).toBe("gigabyte");
    expect(word("gb", 2)).toBe("gigabyte");
    expect(word("gb", 0)).toBe("gigabyte");
    expect(word("gb", 1.5)).toBe("gigabyte");
    expect(word("gb", 1_000_000)).toBe("gigabyte");
    // A conversion target carries no count and every language must still answer
    // (R5); the slot changes nothing, because there is no case for a preposition
    // to govern — "dalam gigabyte" holds the word a bare quantity holds.
    expect(word("gb", undefined, "conversion-target")).toBe("gigabyte");
    expect(word("kib", 2, "conversion-target")).toBe(word("kib", 2));
  });

  test("`bita` is read at the byte and claimed nowhere else", () => {
    // The one Indonesian word this file adds, and the boundary drawn around it.
    // KBBI lists the simplex; the prefixed derivations are not in the dictionary
    // and would be claimed on one source's authority, so they are absent — and
    // rule 5 keeps *bita* out of the printed column too, because the word an
    // Indonesian actually writes for this unit is the borrowed one.
    expect(engine.evaluate("512 bita").value.unit).toBe("b");
    expect(engine.evaluate("512 bita").formatted).toBe("512 byte");
    const claimed = Object.values(datasizeId.units).flatMap((w) =>
      w.aliases.map((a) => a.toLowerCase()),
    );
    for (const w of ["kilobita", "megabita", "gigabita", "terabita", "kibibita"]) {
      expect(claimed, `"${w}" is claimed on one source's authority`).not.toContain(w);
    }
  });

  test("an engine built from it reads and writes Indonesian datasize", () => {
    expect(engine.evaluate("1 gigabyte").formatted).toBe("1 gigabyte");
    expect(engine.evaluate("20 gigabyte").formatted).toBe("20 gigabyte");
    // The English plural still reads — recognition is many-to-one (I6) while
    // generation stays the single invariant noun — and it arrives free from
    // `units.ts` rather than from any Indonesian addition.
    expect(engine.evaluate("20 gigabytes").formatted).toBe("20 gigabyte");
    expect(engine.evaluate("20 gb").formatted).toBe("20 gigabyte");
    // Conversions, with both particles the language lists under `in`: "dalam"
    // is "in" and "ke" the directional "to". The group separator is a full stop,
    // the exact inverse of English, so "1.024" is one thousand and twenty-four.
    expect(engine.evaluate("1 gb dalam mb").formatted).toBe("1.000 megabyte");
    expect(engine.evaluate("1 kib ke bita").formatted).toBe("1.024 byte");
    // The decimal and binary families are different units, which is what the
    // `k`/`Ki` symbol contrast is load-bearing for.
    expect(engine.evaluate("1 kb ke bita").formatted).toBe("1.000 byte");
    // A sum landing on a fraction, in both spellings of addition — the symbol
    // and the Indonesian word "tambah". Written with a comma on purpose: "1.5"
    // is fifteen hundred here, so a test spelled with a full stop would be
    // exercising the group separator instead.
    expect(engine.evaluate("1 gb + 500 mb").formatted).toBe("1,5 gigabyte");
    expect(engine.evaluate("1 gb tambah 500 mb").formatted).toBe("1,5 gigabyte");
    // And the other three word operators the language claims.
    expect(engine.evaluate("2 gb kurang 500 mb").formatted).toBe("1,5 gigabyte");
    expect(engine.evaluate("3 gb kali 2").formatted).toBe("6 gigabyte");
    expect(engine.evaluate("3 gb bagi 2").formatted).toBe("1,5 gigabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "20 gigabyte",
      "1 gb dalam mb",
      "1 kib ke bita",
      "1 gb tambah 500 mb",
      "512 bita",
      "2000 mb",
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
