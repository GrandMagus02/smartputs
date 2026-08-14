import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeDe from "./de";
import datetimeEn from "./en";

const locale = composeLocale(german, [datetimeDe]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Derived by subtracting the zone table rather than by matching a script, which
 * is where German differs from Ukrainian: `uk.test.ts` can find its own words
 * with `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and German shares the
 * Latin one — "Kalkutta" and "Kolkata" look alike to any regex.
 */
const added: Array<[string, string]> = Object.entries(datetimeDe.units).flatMap(
  ([zone, words]) => {
    const generated = new Set({ ...ZONES, ...OFFSET_ZONES }[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

describe("datetime de vocabulary", () => {
  test("it targets German and names its kind by id", () => {
    expect(datetimeDe.locale).toBe("de");
    expect(datetimeDe.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeDe.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeDe.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three
      // tokens, so no alias lookup could ever reach it — `parseOffsetZone` is
      // its only door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so no word from any language may reach it.
  // A script regex is nearly useless here — German is written in the same
  // alphabet as the zone ids — so this greps for the words themselves, umlauts
  // and ß included.
  test("the kind itself carries no German word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(/[äöüß]/i);
    expect(source).not.toMatch(/weltzeit|kiew|moskau|tokio|peking|singapur/i);
    expect(source).not.toMatch(/deutschland|frankreich|neuseeland|kalkutta/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as
    // in `en` and `uk`: this file adds a layer, it does not replace one. A
    // German engine still reads "15:00 in tokyo", because recognition is
    // many-to-one.
    expect(datetimeDe.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeDe.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeDe.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeDe.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the German words come through beside them, deduped", () => {
    expect(datetimeDe.units["Asia/Tokyo"]?.aliases).toContain("tokio");
    expect(datetimeDe.units["Europe/Kyiv"]?.aliases).toContain("kiew");
    for (const [zone, words] of Object.entries(datetimeDe.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // The decision this file takes that `uk` could not: German shares the Latin
  // alphabet, so a zone whose German name is spelled exactly as the table
  // already has it needs no entry — and adding one would be a duplicate alias,
  // not a translation. Chicago, Denver, Dubai's own city name, London, Paris,
  // Berlin and Sydney are that case.
  test("a zone earns a German word only where German spells it differently", () => {
    for (const zone of ["America/Chicago", "America/Denver"]) {
      expect(
        added.filter(([z]) => z === zone),
        `${zone} was given a redundant word`,
      ).toEqual([]);
      // Still reachable, because the table's own word *is* the German one.
      expect(engine.evaluate(`15:00 in ${zone.split("/")[1]}`).value?.unit).toBe(zone);
    }
    // And every zone whose German name does differ got one.
    for (const zone of [
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Asia/Singapore",
      "Europe/Kyiv",
      "Europe/Moscow",
      "Pacific/Auckland",
    ]) {
      expect(
        added.some(([z]) => z === zone),
        `${zone} has no German word`,
      ).toBe(true);
    }
  });

  test("satisfies the locale contract", () => {
    // Two waivers, and each costs an explanation.
    //
    // `skip` takes the offset zones, which carry no aliases by construction in
    // every language — "gmt+3" is three tokens and `parseOffsetZone` is their
    // only door — so the contract's "has no alias" check is asking for something
    // that must not exist.
    //
    // `skipPrintable` takes the named zones, and waives only the
    // print-and-read-back half: `datetime`'s format hook prints
    // `zoneSymbol(zone)` — "ET", "CT", "NZ" — which is not an alias of anything
    // in `en` either, because it is a display abbreviation and not a word. Every
    // alias is still asserted to resolve back to its own zone, which is the half
    // that carries this file. `uk.test.ts` concluded the helper could not be run
    // against this kind at all; it can, with exactly these two waivers named.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so `german.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `de` vocabulary adds one — except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeDe.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Tokios — and
    // German's dative axis has nothing to say about a proper noun either: "in
    // Tokio" is the same word as "Tokio". `selectForm` still answers, because it
    // is a function of the slot and the count and knows nothing about which
    // units have tables, and that is why the absence is asserted rather than
    // inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      german.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(undefined, "conversion-target")).toBe("dat-other");
  });

  test("no German word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the
    // route a user takes: "in" is the German conversion keyword, the zone is the
    // right operand, and a word that only reaches its unit via the language's
    // penalised suffix stripper still counts — a penalised reading is a reading,
    // and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 in ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads German zone words", () => {
    // The same three sums `en.test.ts` pins, said in German. The clock is
    // written 24-hour because "3pm" is an English spelling of a time and this
    // engine has no English in it at all — which is also how German writes it.
    expect(engine.evaluate("15:00 in Tokio").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in Japan").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in Weltzeit").formatted).toBe("2026-01-15 15:00 UTC");
    // All three of German's `in` words reach a zone, because `de.ts` lists them
    // under one keyword and a user picks between them by ear, not by meaning.
    expect(engine.evaluate("15:00 nach Kiew").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 zu Moskau").value?.unit).toBe("Europe/Moscow");
    // Capitalised as German prose writes a noun, and lowercase as a search box
    // does: analyzers are handed the surface exactly as typed and the index
    // folds, so both reach the same reading.
    expect(engine.evaluate("15:00 in tokio").value?.unit).toBe("Asia/Tokyo");
  });

  test("both spellings of ß reach the same zone", () => {
    // Swiss German has no ß at all, and a keyboard that cannot produce one is
    // not a reason to lose a zone — the same reason `de-cardinals.ts` lists
    // "dreissig" beside "dreißig".
    expect(engine.evaluate("15:00 in Großbritannien").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 in Grossbritannien").value?.unit).toBe("Europe/London");
  });

  test("the Latin aliases still read in a German engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 in tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`,
    // and an engine that installed only German simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeDe.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way:
    // an offset is not a word, so there is nothing to translate.
    expect(datetimeDe.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 in gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // What a "round-trip" can and cannot mean for this kind, pinned rather than
  // fudged. A chain of conversions is the real round trip: the instant is the
  // value, the zone is only how it is written, so converting twice must land on
  // the same canonical the bare reading had.
  test("a conversion chain preserves the instant", () => {
    const bare = engine.evaluate("15:00");
    const chained = engine.evaluate("15:00 in Tokio nach Kiew");
    expect(chained.value?.unit).toBe("Europe/Kyiv");
    expect(chained.value?.canonical.toString()).toBe(
      bare.value?.canonical.toString() ?? "",
    );
  });

  // And the half that does *not* round-trip, recorded so it is not rediscovered:
  // this kind's formatted output is a display string, not an input, in every
  // language. "2026-01-16 00:00 JST" is a datetime followed by a bare zone word
  // with no conversion keyword between them, which is not a phrase the grammar
  // has — `en` cannot read its own output either, and nothing a vocabulary can
  // reach changes that.
  test("the formatted output is display, not input, in German as in English", () => {
    const printed = engine.evaluate("15:00 in Tokio").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // Put a keyword back between them and it reads, which is what says the zone
    // word is fine and the *phrase* is what is missing.
    expect(engine.evaluate("2026-01-16 00:00 in JST").value?.unit).toBe("Asia/Tokyo");
  });

  // A German date is written 15.01.2026, and this engine does not read it. The
  // cause is not a missing alias: "." is German's own *group* separator, so the
  // digits are ambiguous with a grouped number before any date matcher is asked,
  // and the matcher itself is chrono's English configuration. Nothing a
  // vocabulary can express fixes either half, so this is written down here and
  // reported against the kind rather than papered over.
  test("records that the German date format does not parse", () => {
    expect(() => engine.evaluate("15.01.2026 15:00")).toThrow();
    expect(engine.evaluate("2026-01-15 15:00").formatted).toBe("2026-01-15 15:00 UTC");
  });
});
