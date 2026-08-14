import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimePl from "./pl";

const locale = composeLocale(polish, [datetimePl]);
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
 * is where Polish sides with German and not with Ukrainian: `uk.test.ts` can
 * find its own words with `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet,
 * and Polish shares the Latin one — "Kalkuta" and "Kolkata" look alike to any
 * regex, and "denverze" carries no diacritic at all.
 */
const added: Array<[string, string]> = Object.entries(datetimePl.units).flatMap(
  ([zone, words]) => {
    const generated = new Set({ ...ZONES, ...OFFSET_ZONES }[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

describe("datetime pl vocabulary", () => {
  test("it targets Polish and names its kind by id", () => {
    expect(datetimePl.locale).toBe("pl");
    expect(datetimePl.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimePl.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimePl.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three tokens,
      // so no alias lookup could ever reach it — `parseOffsetZone` is its only
      // door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so no word from any language may reach it. A
  // script regex is nearly useless here — Polish is written in the same alphabet
  // as the zone ids — so this greps for the words themselves, diacritics
  // included.
  test("the kind itself carries no Polish word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(/[ąćęłńóśźż]/i);
    expect(source).not.toMatch(/kijów|moskwa|paryż|pekin|kalkuta|szanghaj/i);
    expect(source).not.toMatch(/niemcy|francja|chiny|japonia|zelandia|greenwich/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `de` and `uk`: this file adds a layer, it does not replace one. A
    // Polish engine still reads "15:00 w tokyo", because recognition is
    // many-to-one.
    expect(datetimePl.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimePl.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimePl.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimePl.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Polish words come through beside them, deduped", () => {
    expect(datetimePl.units["Asia/Tokyo"]?.aliases).toContain("tokio");
    expect(datetimePl.units["Europe/Kyiv"]?.aliases).toContain("kijów");
    for (const [zone, words] of Object.entries(datetimePl.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // The rule this file follows, which is neither `de`'s nor `uk`'s. German can
  // leave a name it spells identically to the zone table; Polish cannot always,
  // because Polish declines — so a zone earns an entry where the name is spelled
  // differently, where the one-token word is the country, *or* where the name
  // takes case endings the table's nominative does not cover.
  test("a zone earns a Polish word where the name differs or declines", () => {
    // Chicago is the one named zone with no Polish line at all: Polish spells it
    // exactly as the table does and does not decline it, so an entry would be a
    // duplicate alias rather than a translation.
    expect(added.filter(([z]) => z === "America/Chicago")).toEqual([]);
    // Still reachable, because the table's own word *is* the Polish one — and so
    // is Delhi, the other indeclinable borrowing, which is why its zone's line
    // spells Kalkuta and Mumbaj and leaves "delhi" alone.
    expect(engine.evaluate("15:00 w chicago").value?.unit).toBe("America/Chicago");
    expect(engine.evaluate("15:00 w delhi").value?.unit).toBe("Asia/Kolkata");
    expect(added.some(([, alias]) => alias === "delhi")).toBe(false);
    // Denver and Auckland are the Polish-only case: the table already spells the
    // nominative, and Polish still needs the oblique forms, because the locative
    // runs r→rz and d→dz respectively and no suffix rule reaches back over an
    // alternation.
    expect(datetimePl.units["America/Denver"]?.aliases).toContain("denverze");
    expect(datetimePl.units["Pacific/Auckland"]?.aliases).toContain("aucklandzie");
    // And every zone whose Polish name does differ got one.
    for (const zone of [
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Singapore",
      "Europe/Kyiv",
      "Europe/Moscow",
      "Europe/Paris",
      "Europe/London",
    ]) {
      expect(
        added.some(([z]) => z === zone),
        `${zone} has no Polish word`,
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
    // `zoneSymbol(zone)` — "ET", "MSK", "NZ" — which is not an alias of anything
    // in `en` either, because it is a display abbreviation and not a word. Every
    // alias is still asserted to resolve back to its own zone, which is the half
    // that carries this file.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so `polish.selectForm`'s `other`
    // category — the fractional row, "1,5 kilograma" in a kind that has words to
    // inflect — is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `pl` vocabulary adds one, except that
    // here it can only confirm the absence of a `forms` table, since a unit with
    // none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimePl.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Tokio — and the
    // case axis has nothing to add either: "w Kijowie" is a spelling a reader
    // types, so it belongs in `aliases`, not in a table only the printer reads.
    // `selectForm` still answers, because it is a function of the slot and the
    // count and knows nothing about which units have tables, and that is why the
    // absence is asserted rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      polish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(1.5, "after-number")).toBe("nom-other");
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it. This kind reaches
    // that key on every single conversion it performs and indexes nothing with
    // it.
    expect(key(undefined, "conversion-target")).toBe("loc-other");
  });

  test("no Polish word is claimed by two zones", () => {
    // What `assertLocaleContract` cannot see for this kind even with the waivers
    // above: a word claimed by two units of one kind has no reading, because no
    // context the engine has can separate them.
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route
    // a user takes: "w" is the Polish `in` keyword, the zone is the right operand
    // of a conversion, and a word that only reaches its unit via the language's
    // penalised suffix stripper still counts — a penalised reading is a reading,
    // and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 w ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Polish zone words", () => {
    // The same three sums `en.test.ts` pins, said in Polish. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has
    // no English in it at all — which is also how Polish writes it.
    expect(engine.evaluate("15:00 w Tokio").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 w Japonii").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 w Greenwich").formatted).toBe("2026-01-15 15:00 UTC");
    // All four of Polish's `in` spellings reach a zone, because `pl.ts` lists them
    // under one keyword. "we" is the euphonic variant of "w" before a consonant
    // cluster — the choice is about sound, not meaning — and "do" takes the
    // genitive where "w" takes the locative, which is why both forms are listed.
    expect(engine.evaluate("15:00 do Kijowa").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 na Ukrainie").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 we Francji").value?.unit).toBe("Europe/Paris");
    // Capitalised as prose writes a proper noun, and lowercase as a search box
    // does: analyzers are handed the surface exactly as typed and the index folds,
    // so both reach the same reading.
    expect(engine.evaluate("15:00 w tokio").value?.unit).toBe("Asia/Tokyo");
  });

  test("the cases the conversion keyword governs are all listed", () => {
    // The rows this vocabulary exists to get right, and the reason a Latin-script
    // language still needed a full layer. "w Kijowie" is the locative, "do
    // Kijowa" the genitive, and neither is recoverable from the other: Kijów runs
    // the ó/o alternation on its closed syllable, so the stripper reduces
    // "Kijowie" to "Kijow" and the index holds "kijów".
    expect(datetimePl.units["Europe/Kyiv"]?.aliases).toContain("kijowie");
    expect(datetimePl.units["Europe/Kyiv"]?.aliases).toContain("kijowa");
    expect(engine.evaluate("15:00 w Kijowie").formatted).toBe("2026-01-15 17:00 Kyiv");
    expect(engine.evaluate("15:00 do Kijowa").formatted).toBe("2026-01-15 17:00 Kyiv");
    expect(engine.evaluate("15:00 w Moskwie").formatted).toBe("2026-01-15 18:00 MSK");
    // The locative that runs t→c, which nothing could strip its way back to.
    expect(engine.evaluate("15:00 w Kalkucie").value?.unit).toBe("Asia/Kolkata");
    // A country that is grammatically plural, so its cases are plural ones: "w
    // Niemczech" is a locative plural with its own c→cz.
    expect(engine.evaluate("15:00 w Niemczech").value?.unit).toBe("Europe/Berlin");
    // Indeclinable names appear once and that is not an omission: "Tokio" is the
    // same word in every case Polish has.
    const table = new Set(ZONES["Asia/Tokyo"]?.aliases ?? []);
    expect(datetimePl.units["Asia/Tokyo"]?.aliases.filter((a) => !table.has(a))).toEqual([
      "tokio",
      "japonia",
      "japonii",
    ]);
  });

  test("the Latin aliases still read in a Polish engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 w tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 w utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and
    // an engine that installed only Polish simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimePl.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimePl.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 w gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  test("round-trips its own output, as far as this kind's output can", () => {
    // Every sibling `pl` vocabulary hands its formatted string straight back to
    // `evaluate` and gets the same value. This kind cannot, in any language, and
    // the shape of the failure is worth pinning rather than omitting: a formatted
    // datetime ends in `zoneSymbol(zone)`, and a date-time followed by a bare zone
    // word is not an expression the grammar has — a zone reaches a value through
    // the `in` keyword, never by sitting after it.
    const tokyo = engine.evaluate("15:00 w Tokio");
    expect(tokyo.formatted).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(tokyo.formatted)).toThrow();
    // What does round-trip is the same line without that trailing abbreviation,
    // for a value in the engine's own zone — which is the whole of the printed
    // string that this vocabulary and the language between them decide. The
    // instant comes back identical, so nothing in the Polish layer is lost on the
    // way out; only the zone label is, and it was never a word.
    const here = engine.evaluate("15:00");
    expect(here.formatted).toBe("2026-01-15 15:00 UTC");
    const again = engine.evaluate(here.formatted.replace(" UTC", ""));
    expect(again.value?.canonical.toString()).toBe(here.value?.canonical.toString());
    expect(again.value?.unit).toBe(here.value?.unit);
  });
});
