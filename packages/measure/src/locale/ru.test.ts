import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureRu from "./ru";

const engine = createEngine({
  locales: [composeLocale(russian, [measureRu])],
  kinds: [measure],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = russian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureRu.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

describe("measure ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(measure)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries exactly the eight keys Russian can ask for", () => {
    for (const [unit, words] of Object.entries(measureRu.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(EIGHT_KEYS);
    }
  });

  // A printed form that is not a listed alias still round-trips, because
  // `russian`'s suffix stripper recovers it — at `weight: -2`. Asserting the
  // containment is what keeps the two halves of a unit's entry, what it writes
  // and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(measureRu.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    assertLocaleContract(composeLocale(russian, [measureRu]), [measure]);
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Russian spells with a genitive *singular*. 1.5 is added
    // so `nom-other` and `loc-other` are actually sampled.
    assertLocaleContract(composeLocale(russian, [measureRu]), [measure], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("the three paradigms are three different decisions", () => {
    // Hard-stem masculine. The 2/3/4 row is a genitive singular, so it agrees
    // with the fractional row and not with the nominative singular — the reverse
    // of Ukrainian's grouping next door.
    expect(word("pt", 1)).toBe("пункт");
    expect(word("pt", 2)).toBe("пункта");
    expect(word("pt", 5)).toBe("пунктов");
    expect(word("pt", 1.5)).toBe("пункта");
    // Soft-stem masculine: the genitive plural is `-ей`, not the hard `-ов`
    // above, and the nominative plural is `-и` on a soft stem.
    expect(word("px", 2)).toBe("пикселя");
    expect(word("px", 5)).toBe("пикселей");
    // Feminine: the nominative plural and the genitive singular coincide, and
    // the genitive plural is the bare stem rather than any ending at all.
    expect(word("pc", 2)).toBe("пики");
    expect(word("pc", 1.5)).toBe("пики");
    expect(word("pc", 5)).toBe("пик");
  });

  test("a conversion target is prepositional, and `пика` does not alternate", () => {
    expect(word("pt", 1, "conversion-target")).toBe("пункте");
    expect(word("pt", undefined, "conversion-target")).toBe("пунктах");
    // The cell a port of `uk.ts` gets wrong: Ukrainian's `піка` takes к→ц in the
    // locative singular (`піці`) and Russian's `пика` does not — "в 1 пике".
    expect(word("pc", 1, "conversion-target")).toBe("пике");
  });

  test("an engine built from it reads and writes Russian typography", () => {
    expect(engine.evaluate("1 дюйм в пунктах").formatted).toBe("72 пункта");
    expect(engine.evaluate("72 пункта в дюймах").formatted).toBe("1 дюйм");
    expect(engine.evaluate("1 дюйм в пикселях").formatted).toBe("96 пикселей");
    // Latin aliases still read: a designer types `pt` whatever the keyboard is.
    expect(engine.evaluate("6 pc в дюймах").formatted).toBe("1 дюйм");
    // A fraction takes the genitive singular, not a plural.
    expect(engine.evaluate("1 дюйм - 12 пунктов").formatted).toBe("0,8333 дюйма");
  });

  test("round-trips its own output", () => {
    for (const input of [
      "1 дюйм в пунктах",
      "1 дюйм в пикселях",
      "6 pc в дюймах",
      "5 пик",
      "1,5 пункта",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
