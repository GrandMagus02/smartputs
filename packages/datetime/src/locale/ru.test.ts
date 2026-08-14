import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeRu from "./ru";

const locale = composeLocale(russian, [datetimeRu]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Found by script rather than by subtracting the table, which is where Russian
 * sides with Ukrainian and not with German: Cyrillic is a different alphabet, so
 * "Токио" and "tokyo" can never be confused for one another the way "Kalkutta"
 * and "Kolkata" can.
 */
const added: Array<[string, string]> = Object.entries(datetimeRu.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => CYRILLIC.test(a)).map((a): [string, string] => [zone, a]),
);

describe("datetime ru vocabulary", () => {
  test("it targets Russian and names its kind by id", () => {
    expect(datetimeRu.locale).toBe("ru");
    expect(datetimeRu.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeRu.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeRu.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three
      // tokens, so no alias lookup could ever reach it — `parseOffsetZone` is
      // its only door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so no script but ASCII may reach it.
  // Cyrillic anywhere in the descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(CYRILLIC);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as
    // in `en` and `uk`: this file adds a layer, it does not replace one. A
    // Russian engine still reads "15:00 в tokyo", because recognition is
    // many-to-one.
    expect(datetimeRu.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeRu.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeRu.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeRu.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Russian words come through beside them, deduped", () => {
    expect(datetimeRu.units["Asia/Tokyo"]?.aliases).toContain("токио");
    expect(datetimeRu.units["Europe/Moscow"]?.aliases).toContain("москва");
    for (const [zone, words] of Object.entries(datetimeRu.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Russian words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table
    // is already English — and `de` can leave "Chicago" alone for the same
    // reason. Nothing in it is typeable on a Russian layout, so a gap here is a
    // zone a Russian speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeRu.units[zone]?.aliases.some((a) => CYRILLIC.test(a)),
        `${zone} has no Russian word`,
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
    // The default counts are all integers, so `russian.selectForm`'s `other`
    // category — the fractional row, "1,5 килограмма" in a kind that has words to
    // inflect — is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `ru` vocabulary adds one, except that
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
    for (const [zone, words] of Object.entries(datetimeRu.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Токио — and the
    // case axis has nothing to add either: "в Киеве" is a spelling a reader
    // types, so it belongs in `aliases`, not in a table only the printer reads.
    // `selectForm` still answers, because it is a function of the slot and the
    // count and knows nothing about which units have tables, and that is why the
    // absence is asserted rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      russian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(1.5, "after-number")).toBe("nom-other");
    // Ruling R5: a conversion target has no count, and the category CLDR
    // requires every locale to define as its generic one answers for it.
    expect(key(undefined, "conversion-target")).toBe("loc-other");
  });

  test("no Russian word is claimed by two zones", () => {
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
    // Through the engine rather than against the table, because that is the
    // route a user takes: "в" is the Russian `in` keyword, the zone is the right
    // operand of a conversion, and a word that only reaches its unit via the
    // language's penalised suffix stripper still counts — a penalised reading is
    // a reading, and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 в ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Russian zone words", () => {
    // The same three sums `en.test.ts` pins, said in Russian. The clock is
    // written 24-hour because "3pm" is an English spelling of a time and this
    // engine has no English in it at all — which is also how Russian writes it.
    expect(engine.evaluate("15:00 в Токио").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 в Японии").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 в Гринвиче").formatted).toBe("2026-01-15 15:00 UTC");
    // All three of Russian's `in` words reach a zone, because `ru.ts` lists them
    // under one keyword. "у" is the odd one — `ru.ts` claims it openly for
    // recognition only, since "у Москвы" is not how a Russian would phrase a
    // conversion — and a zone has to be reachable through it all the same.
    expect(engine.evaluate("15:00 до Киева").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 у Москвы").value?.unit).toBe("Europe/Moscow");
    // Capitalised as prose writes a proper noun, and lowercase as a search box
    // does: analyzers are handed the surface exactly as typed and the index
    // folds, so both reach the same reading.
    expect(engine.evaluate("15:00 в токио").value?.unit).toBe("Asia/Tokyo");
  });

  test("both cases the conversion keyword governs are listed", () => {
    // The rows this vocabulary exists to get right. Russian spells `in` three
    // ways and they do not agree on a case: "в" takes the prepositional ("в
    // Киеве"), "до" and "у" take the genitive ("до Киева"). Both are listed
    // rather than left to the suffix stripper, which is penalised and which
    // cannot recover either form of "Москва" at all — "Москвы" and "Москве" both
    // strip to "москв", a string in no index.
    expect(datetimeRu.units["Europe/Kyiv"]?.aliases).toContain("киеве");
    expect(datetimeRu.units["Europe/Kyiv"]?.aliases).toContain("киева");
    expect(engine.evaluate("15:00 в Киеве").formatted).toBe("2026-01-15 17:00 Kyiv");
    expect(engine.evaluate("15:00 до Киева").formatted).toBe("2026-01-15 17:00 Kyiv");
    expect(engine.evaluate("15:00 в Москве").formatted).toBe("2026-01-15 18:00 MSK");
    // Indeclinable names appear once and that is not an omission: "Токио" is the
    // same word in every case Russian has.
    expect(
      datetimeRu.units["Asia/Tokyo"]?.aliases.filter((a) => CYRILLIC.test(a)),
    ).toEqual(["токио", "япония", "японии"]);
  });

  test("the Latin aliases still read in a Russian engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 в tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 в utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and
    // an engine that installed only Russian simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeRu.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way:
    // an offset is not a word, so there is nothing to translate.
    expect(datetimeRu.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 в gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  test("round-trips its own output, as far as this kind's output can", () => {
    // Every sibling `ru` vocabulary hands its formatted string straight back to
    // `evaluate` and gets the same value. This kind cannot, in any language, and
    // the shape of the failure is worth pinning rather than omitting: a formatted
    // datetime ends in `zoneSymbol(zone)`, and a date-time followed by a bare
    // zone word is not an expression the grammar has — a zone reaches a value
    // through the `in` keyword, never by sitting after it.
    const tokyo = engine.evaluate("15:00 в Токио");
    expect(tokyo.formatted).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(tokyo.formatted)).toThrow();
    // What does round-trip is the same line without that trailing abbreviation,
    // for a value in the engine's own zone — which is the whole of the printed
    // string that this vocabulary and the language between them decide. The
    // instant comes back identical, so nothing in the Russian layer is lost on
    // the way out; only the zone label is, and it was never a word.
    const here = engine.evaluate("15:00");
    expect(here.formatted).toBe("2026-01-15 15:00 UTC");
    const again = engine.evaluate(here.formatted.replace(" UTC", ""));
    expect(again.value?.canonical.toString()).toBe(here.value?.canonical.toString());
    expect(again.value?.unit).toBe(here.value?.unit);
  });

  // Auckland is the one zone whose symbol is not also a generated alias, so a
  // translation that adds only Cyrillic silently loses the round trip: with
  // `symbols: true` the printer emits "NZ" and the reader rejects it. `en`
  // reaches it through its own spelled-out list and `de` calls the same case out
  // by name; this pins it for `ru` so it cannot regress back.
  test("every printable symbol is an alias of the unit that prints it", () => {
    const unreadable: string[] = [];
    for (const [zone, words] of Object.entries(datetimeRu.units)) {
      const symbol = words.symbol;
      if (symbol === undefined || symbol.trim() === "") continue;
      if (words.aliases.length === 0) continue; // an offset zone has no door here
      const listed = words.aliases.some(
        (a) => a.toLocaleLowerCase("ru") === symbol.toLocaleLowerCase("ru"),
      );
      if (!listed) unreadable.push(`${zone} prints ${symbol}`);
    }
    // The five that fail in `en` too are the kind's own, not this translation's.
    expect(unreadable).toEqual([
      "America/New_York prints ET",
      "America/Chicago prints CT",
      "America/Denver prints MT",
      "America/Los_Angeles prints PT",
      "Asia/Kolkata prints IST",
      "Asia/Shanghai prints CST",
    ]);
    expect(datetimeRu.units["Pacific/Auckland"]?.aliases).toContain("nz");
  });
});
