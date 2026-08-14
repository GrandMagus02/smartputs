import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [...BUILTIN_UK, datetimeUk])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

const CYRILLIC = /[Ѐ-ӿ]/;

/** Every word this vocabulary adds on top of the generated table, by zone. */
const added: Array<[string, string]> = Object.entries(datetimeUk.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => CYRILLIC.test(a)).map((a): [string, string] => [zone, a]),
);

describe("datetime uk vocabulary", () => {
  test("it targets Ukrainian and names its kind by id", () => {
    expect(datetimeUk.locale).toBe("uk");
    expect(datetimeUk.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeUk.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeUk.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in either language: "gmt+3" lexes as three
      // tokens, so no alias lookup could ever reach it — `parseOffsetZone` is
      // its only door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so no script but ASCII may reach it.
  // Cyrillic anywhere in the descriptor would mean a translation had leaked
  // into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(CYRILLIC);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as
    // in `en`: this file adds a layer, it does not replace one. A Ukrainian
    // engine still reads "15:00 в tokyo", because recognition is many-to-one.
    expect(datetimeUk.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeUk.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeUk.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeUk.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Ukrainian words come through beside them, deduped", () => {
    expect(datetimeUk.units["Asia/Tokyo"]?.aliases).toContain("токіо");
    expect(datetimeUk.units["Europe/Kyiv"]?.aliases).toContain("київ");
    for (const [zone, words] of Object.entries(datetimeUk.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Ukrainian words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table
    // is already English. Nothing in it is typeable on a Ukrainian layout, so a
    // gap here is a zone a Ukrainian speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeUk.units[zone]?.aliases.some((a) => CYRILLIC.test(a)),
        `${zone} has no Ukrainian word`,
      ).toBe(true);
    }
  });

  // `assertLocaleContract` is the check this stands in for, and it cannot be
  // run against this kind in any language: it asserts that every string a unit
  // can *print* is readable back, and `datetime`'s format hook prints
  // `zoneSymbol(zone)` — "ET", "NZ", "UTC" for the offset at zero — none of
  // which is an alias of anything, in `en` either. What the contract would
  // still have caught is the half below: a word claimed by two units of one
  // kind has no reading, because no context the engine has can separate them.
  test("no Ukrainian word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the
    // route a user takes: "у" is the Ukrainian `in` keyword, the zone is the
    // right operand of a conversion, and a word that only reaches its unit via
    // the language's penalised suffix stripper still counts — a penalised
    // reading is a reading, and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 у ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Ukrainian zone words", () => {
    // The same three sums `en.test.ts` pins, said in Ukrainian. The clock is
    // written 24-hour because "3pm" is an English spelling of a time and this
    // engine has no English in it at all.
    expect(engine.evaluate("15:00 в токіо").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 у Японії").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 у Гринвічі").formatted).toBe("2026-01-15 15:00 UTC");
    // "до" is the third Ukrainian spelling of `in` — the "into" of a conversion
    // — and a zone has to be reachable through all of them.
    expect(engine.evaluate("15:00 до Японії").value?.unit).toBe("Asia/Tokyo");
  });

  test("the Latin aliases still read in a Ukrainian engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6):
    // the format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 в tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 в utc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  test("both cases the conversion keyword governs are listed", () => {
    // The rows this vocabulary exists to get right. Ukrainian spells `in` three
    // ways and they do not agree on a case: `в`/`у` take the locative ("у
    // Києві"), `до` takes the genitive ("до Києва"). Both are listed, because
    // the stripper cannot recover either — dropping the ending from "Києві"
    // gives "Києв", a string in no index, since the nominative "Київ" has an
    // о/і alternation the stripper knows nothing about.
    expect(datetimeUk.units["Europe/Kyiv"]?.aliases).toContain("києві");
    expect(datetimeUk.units["Europe/Kyiv"]?.aliases).toContain("києва");
    expect(engine.evaluate("15:00 у Києві").formatted).toBe("2026-01-15 17:00 Kyiv");
    expect(engine.evaluate("15:00 до Києва").formatted).toBe("2026-01-15 17:00 Kyiv");
    // Indeclinable names appear once and that is not an omission: "Токіо" is
    // the same word in every case Ukrainian has.
    expect(
      datetimeUk.units["Asia/Tokyo"]?.aliases.filter((a) => CYRILLIC.test(a)),
    ).toEqual(["токіо", "японія", "японії"]);
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way:
    // an offset is not a word, so there is nothing to translate.
    expect(datetimeUk.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 в gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });
});
