import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [measureId])],
    kinds: [measure],
  });

/** The only key `indonesian.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the words is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. `poin` and `inci` are bounded because
    // the English `point` and `inch` sit next to them in the alias map;
    // `piksel` and `sentimeter` are spelled in a way no English alias is.
    expect(JSON.stringify(measure)).not.toMatch(/\bpoin\b|\binci\b|piksel|sentimeter/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `indonesian.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). This is the kind where Dutch keeps a measure noun
    // singular (`12 punt`) and a counted one plural (`1920 pixels`) inside one
    // table set, so a sweep that produced two keys would be the interesting
    // failure.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          indonesian.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(measureId.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty.
    for (const [unit, words] of Object.entries(measureId.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("`pika` and `titik` are left unclaimed", () => {
    // `pika` is the spelling Indonesian orthography would produce for the pica,
    // and it is already the name of the eating disorder — the word a dictionary
    // lookup returns. `titik` is a dot or a full stop, not a unit of type. Both
    // are words Indonesian uses for something else, so both stay out and the
    // English spellings `units.ts` declares are what this kind is entered
    // through — `@smartput/measure/locale/nl`'s ruling about `cicero` arriving
    // from the other direction, where the near-synonym named a different *unit*
    // rather than a different thing.
    for (const words of Object.values(measureId.units)) {
      expect(words.aliases).not.toContain("pika");
      expect(words.aliases).not.toContain("titik");
    }
    const e = engine();
    expect(() => e.evaluate("2 pika")).toThrow();
    expect(e.evaluate("1 pica").value.unit).toBe("pc");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [measureId]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Indonesian that row is the same
    // word as every other row, where Dutch's `pixels` is a plural because a
    // pixel is counted.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [measureId]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // Dutch splits this kind in two — `12 punt` measured out, `1920 pixels`
    // counted — and Indonesian has no number axis for the split to live on.
    for (const unit of ["inch", "mm", "cm", "pt", "pc", "px"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("px", 1920)).toBe("piksel");
    expect(word("pt", 12)).toBe("poin");
    expect(word("inch", 1)).toBe("inci");
  });

  test("an engine built from it reads and writes Indonesian typography", () => {
    const e = engine();
    expect(e.evaluate("12 poin").formatted).toBe("12 poin");
    expect(e.evaluate("2,5 sentimeter").formatted).toBe("2,5 sentimeter");
    expect(e.evaluate("10 milimeter").formatted).toBe("10 milimeter");
    // The English spellings `units.ts` gives read, and answer in Indonesian.
    expect(e.evaluate("1 inch").formatted).toBe("1 inci");
    expect(e.evaluate("300 pixels").formatted).toBe("300 piksel");
    // Conversions through both keywords, including the one that reads the
    // kind's dynamic `px` ratio at the default 96 dpi.
    expect(e.evaluate("1 inci dalam poin").formatted).toBe("72 poin");
    expect(e.evaluate("72 pt ke inci").formatted).toBe("1 inci");
    expect(e.evaluate("1 inci dalam piksel").formatted).toBe("96 piksel");
    // Arithmetic landing on a fraction, with the decimal comma CLDR supplies,
    // and a grouped row with the group separator — the exact inverse of
    // English's pair.
    expect(e.evaluate("1 poin tambah 0,5 poin").formatted).toBe("1,5 poin");
    expect(e.evaluate("1920 piksel").formatted).toBe("1.920 piksel");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `id`
    // groups with "." and the lexer reads that back as a group separator, so
    // "1.920 piksel" is 1920 px and not 1.
    const e = engine();
    for (const input of [
      "1 poin tambah 0,5 poin",
      "1 inci dalam poin",
      "72 pt ke inci",
      "1920 piksel",
      "2,5 sentimeter",
      "1 pica",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
