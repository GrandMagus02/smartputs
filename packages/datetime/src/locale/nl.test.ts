import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeNl from "./nl";

const locale = composeLocale(dutch, [datetimeNl]);
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
 * Derived by subtracting the zone table rather than by matching a script, which is
 * where Dutch differs from Ukrainian: `uk.test.ts` can find its own words with
 * `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and Dutch shares the Latin
 * one — "Calcutta" and "Kolkata" look alike to any regex.
 */
const added: Array<[string, string]> = Object.entries(datetimeNl.units).flatMap(
  ([zone, words]) => {
    const generated = new Set({ ...ZONES, ...OFFSET_ZONES }[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

describe("datetime nl vocabulary", () => {
  test("it targets Dutch and names its kind by id", () => {
    expect(datetimeNl.locale).toBe("nl");
    expect(datetimeNl.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeNl.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeNl.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three tokens,
      // so no alias lookup could ever reach it — `parseOffsetZone` is its only
      // door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is unit ids and signatures, so no word from any language may reach it. A script
  // regex is nearly useless here — Dutch is written in the same alphabet as the
  // zone ids, and its only non-ASCII letter is a trema — so this greps for the
  // words themselves.
  test("the kind itself carries no Dutch word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(/[ëïéèöü]/i);
    expect(source).not.toMatch(/wereldtijd|londen|parijs|berlijn|moskou|tokio/i);
    expect(source).not.toMatch(/duitsland|frankrijk|oekra|nieuwzeeland|calcutta/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk` and `de`: this file adds a layer, it does not replace one. A Dutch
    // engine still reads "15:00 in tokyo", because recognition is many-to-one.
    expect(datetimeNl.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeNl.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeNl.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeNl.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Dutch words come through beside them, deduped", () => {
    expect(datetimeNl.units["Asia/Tokyo"]?.aliases).toContain("tokio");
    expect(datetimeNl.units["Europe/London"]?.aliases).toContain("londen");
    for (const [zone, words] of Object.entries(datetimeNl.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // The decision this file takes that `uk` could not: Dutch shares the Latin
  // alphabet, so a zone whose Dutch name is spelled exactly as the table already
  // has it needs no entry — and adding one would be a duplicate alias, not a
  // translation. Chicago, Denver, Dubai's own city name, Sydney's, Auckland's and
  // Singapore are that case.
  test("a zone earns a Dutch word only where Dutch spells it differently", () => {
    for (const zone of ["America/Chicago", "America/Denver", "Asia/Singapore"]) {
      expect(
        added.filter(([z]) => z === zone),
        `${zone} was given a redundant word`,
      ).toEqual([]);
      // Still reachable, because the table's own word *is* the Dutch one.
      expect(engine.evaluate(`15:00 in ${zone.split("/")[1]}`).value?.unit).toBe(zone);
    }
    // And every zone whose Dutch name does differ got one. The three European
    // capitals are this language's largest single contribution: German next door had
    // none of them to add, because it spells London, Paris and Berlin the way the
    // table already does.
    for (const zone of [
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Moscow",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Pacific/Auckland",
    ]) {
      expect(
        added.some(([z]) => z === zone),
        `${zone} has no Dutch word`,
      ).toBe(true);
    }
  });

  test("satisfies the locale contract", () => {
    // Two waivers, and each costs an explanation.
    //
    // `skip` takes the offset zones, which carry no aliases by construction in
    // every language — "gmt+3" is three tokens and `parseOffsetZone` is their only
    // door — so the contract's "has no alias" check is asking for something that
    // must not exist.
    //
    // `skipPrintable` takes the named zones, and waives only the
    // print-and-read-back half: `datetime`'s format hook prints `zoneSymbol(zone)`
    // — "ET", "CT", "NZ" — which is not an alias of anything in `en` either,
    // because it is a display abbreviation and not a word. Every alias is still
    // asserted to resolve back to its own zone, which is the half that carries this
    // file.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so `dutch.selectForm`'s `other` category
    // is never reached through a fraction at all. A fractional count is added for
    // the same reason every other `nl` vocabulary adds one — except that here it
    // can only confirm the absence of a `forms` table, since a unit with none is
    // skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeNl.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Tokio's — and Dutch
    // has no second axis that could have said anything else either: `selectForm`
    // reads its slot and discards it, so "in Tokio" selects the same key "Tokio"
    // does. It still answers, because it is a function of the count and knows
    // nothing about which units have tables, and that is why the absence is asserted
    // rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      dutch.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(1, "conversion-target")).toBe("one");
    expect(key(undefined, "conversion-target")).toBe("other");
  });

  test("no Dutch word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route a
    // user takes: "in" is a Dutch conversion keyword, the zone is the right operand,
    // and a word that only reaches its unit via the language's penalised suffix
    // stripper still counts — a penalised reading is a reading, and the solver ranks
    // it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 in ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Dutch zone words", () => {
    // The same three sums `en.test.ts` pins, said in Dutch. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has no
    // English in it at all — which is also how Dutch writes it.
    expect(engine.evaluate("15:00 in Tokio").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in Japan").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in wereldtijd").formatted).toBe("2026-01-15 15:00 UTC");
    // Both of Dutch's `in` words reach a zone, because `nl.ts` lists them under one
    // keyword and a user picks between them by ear, not by meaning.
    expect(engine.evaluate("15:00 naar Londen").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 in Moskou").value?.unit).toBe("Europe/Moscow");
    // Lowercase as Dutch actually writes everything but a proper noun, and
    // capitalised as a proper noun is: this language capitalises no common noun,
    // which is the one German stress it does not share, and the index folds either
    // way.
    expect(engine.evaluate("15:00 in tokio").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 in Berlijn").value?.unit).toBe("Europe/Berlin");
    expect(engine.evaluate("15:00 in Parijs").value?.unit).toBe("Europe/Paris");
  });

  test("both spellings of the trema reach the same zone", () => {
    // A keyboard that cannot produce a trema is not a reason to lose a zone — the
    // same reason `nl-cardinals.ts` reads "tweeëntwintig" and "tweeentwintig"
    // alike. `normalize()`'s NFKC pass folds compatibility characters, not
    // diacritics, so nothing upstream collapses these two for us.
    expect(engine.evaluate("15:00 in Oekraïne").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 in Oekraine").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 in Australië").value?.unit).toBe("Australia/Sydney");
    expect(engine.evaluate("15:00 in Australie").value?.unit).toBe("Australia/Sydney");
  });

  test("the Latin aliases still read in a Dutch engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 in tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and an
    // engine that installed only Dutch simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeNl.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeNl.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 in gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // What a "round-trip" can and cannot mean for this kind, pinned rather than
  // fudged. A chain of conversions is the real round trip: the instant is the
  // value, the zone is only how it is written, so converting twice must land on the
  // same canonical the bare reading had.
  test("a conversion chain preserves the instant", () => {
    const bare = engine.evaluate("15:00");
    const chained = engine.evaluate("15:00 in Tokio naar Oekraïne");
    expect(chained.value?.unit).toBe("Europe/Kyiv");
    expect(chained.value?.canonical.toString()).toBe(
      bare.value?.canonical.toString() ?? "",
    );
  });

  // And the half that does *not* round-trip, recorded so it is not rediscovered:
  // this kind's formatted output is a display string, not an input, in every
  // language. "2026-01-16 00:00 JST" is a datetime followed by a bare zone word with
  // no conversion keyword between them, which is not a phrase the grammar has — `en`
  // cannot read its own output either, and nothing a vocabulary can reach changes
  // that.
  test("the formatted output is display, not input, in Dutch as in English", () => {
    const printed = engine.evaluate("15:00 in Tokio").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // Put a keyword back between them and it reads, which is what says the zone word
    // is fine and the *phrase* is what is missing.
    expect(engine.evaluate("2026-01-16 00:00 in JST").value?.unit).toBe("Asia/Tokyo");
  });

  // A Dutch date is written 15-01-2026 or 15.01.2026, and this engine reads
  // neither. The cause is not a missing alias: "." is Dutch's own *group*
  // separator, so those digits are ambiguous with a grouped number before any date
  // matcher is asked, and the matcher itself is chrono's English configuration.
  // Nothing a vocabulary can express fixes either half, so this is written down here
  // and reported against the kind rather than papered over.
  test("records that the Dutch date format does not parse", () => {
    expect(() => engine.evaluate("15.01.2026 15:00")).toThrow();
    expect(engine.evaluate("2026-01-15 15:00").formatted).toBe("2026-01-15 15:00 UTC");
  });
});
