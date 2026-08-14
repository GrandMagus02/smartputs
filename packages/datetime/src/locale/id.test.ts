import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeId from "./id";

const locale = composeLocale(indonesian, [datetimeId]);
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
 * Derived by subtracting the zone table rather than by matching a script — the only
 * route available here, and a stricter constraint than Dutch's: Indonesian is written
 * in *unaccented* Latin, so it has not even a trema to grep for, and "Kalkuta" and
 * "kolkata" look alike to any character class.
 */
const added: Array<[string, string]> = Object.entries(datetimeId.units).flatMap(
  ([zone, words]) => {
    const generated = new Set({ ...ZONES, ...OFFSET_ZONES }[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

describe("datetime id vocabulary", () => {
  test("it targets Indonesian and names its kind by id", () => {
    expect(datetimeId.locale).toBe("id");
    expect(datetimeId.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeId.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeId.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three tokens, so
      // no alias lookup could ever reach it — `parseOffsetZone` is its only door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind is
  // unit ids and signatures, so no word from any language may reach it. A script
  // regex is useless here — Indonesian is unaccented Latin, the same characters the
  // zone ids are written in — so this greps for the words themselves.
  test("the kind itself carries no Indonesian word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(/inggris|prancis|jerman|jepang|ukraina|rusia|brasil/i);
    expect(source).not.toMatch(/singapura|moskwa|kalkuta|kalifornia|tiongkok|emirat/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk`, `de` and `nl`: this file adds a layer, it does not replace one. An
    // Indonesian engine still reads "15:00 ke tokyo", because recognition is
    // many-to-one and generation is one (design decision I6).
    expect(datetimeId.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeId.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeId.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeId.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Indonesian words come through beside them, deduped", () => {
    expect(datetimeId.units["Asia/Tokyo"]?.aliases).toContain("jepang");
    expect(datetimeId.units["Asia/Singapore"]?.aliases).toContain("singapura");
    for (const [zone, words] of Object.entries(datetimeId.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // The decision this file takes that `uk` could not: Indonesian shares the Latin
  // alphabet, so a zone whose Indonesian name is spelled exactly as the table already
  // has it needs no entry — and adding one would be a duplicate alias, not a
  // translation.
  test("a zone earns an Indonesian word only where Indonesian differs", () => {
    for (const zone of ["America/Chicago", "America/Denver"]) {
      expect(
        added.filter(([z]) => z === zone),
        `${zone} was given a redundant word`,
      ).toEqual([]);
      // Still reachable, because the table's own word *is* the Indonesian one.
      expect(engine.evaluate(`15:00 ke ${zone.split("/")[1]}`).value?.unit).toBe(zone);
    }
    // And every zone whose Indonesian name does differ got one. The list is mostly
    // *countries*, which is this language's largest single contribution here:
    // Indonesian country names come through Dutch and Portuguese rather than English,
    // and each of them is a single token.
    for (const zone of [
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Kyiv",
      "Europe/Moscow",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Asia/Singapore",
      "America/Sao_Paulo",
    ]) {
      expect(
        added.some(([z]) => z === zone),
        `${zone} has no Indonesian word`,
      ).toBe(true);
    }
  });

  test("satisfies the locale contract", () => {
    // Two waivers, and each costs an explanation.
    //
    // `skip` takes the offset zones, which carry no aliases by construction in every
    // language — "gmt+3" is three tokens and `parseOffsetZone` is their only door —
    // so the contract's "has no alias" check is asking for something that must not
    // exist.
    //
    // `skipPrintable` takes the named zones, and waives only the print-and-read-back
    // half: `datetime`'s format hook prints `zoneSymbol(zone)` — "ET", "CT", "NZ" —
    // which is not an alias of anything in `en` either, because it is a display
    // abbreviation and not a word. Every alias is still asserted to resolve back to
    // its own zone, which is the half that carries this file.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so they never reach a fractional reading at
    // all. Under `id` a fraction cannot select a different key — there is only one —
    // and here it can only confirm the absence of a `forms` table besides, since a
    // unit with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeId.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Jakartas — and
    // Indonesian has no axis at all that could have said anything else: `selectForm`
    // is the constant `"other"`, so a bare quantity, a conversion target and a
    // count-free call are one key. It still answers, because it knows nothing about
    // which units have tables, and that is why the absence is asserted rather than
    // inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      indonesian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect([
      ...new Set([
        key(1, "after-number"),
        key(1, "conversion-target"),
        key(undefined, "conversion-target"),
      ]),
    ]).toEqual(["other"]);
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("no Indonesian word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route a
    // user takes: "ke" is an Indonesian conversion keyword and the zone is the right
    // operand. It matters more here than in a language with a stripper — this one has
    // none, so a word not listed is unreachable rather than merely penalised.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 ke ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Indonesian zone words", () => {
    // The same three sums `en.test.ts` pins, said in Indonesian. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has no
    // English in it at all — which is also how Indonesian writes it.
    expect(engine.evaluate("15:00 ke Jepang").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 dalam universal").formatted).toBe(
      "2026-01-15 15:00 UTC",
    );
    // Both of this language's `in` words reach a zone, because `id.ts` lists them
    // under one keyword and a user picks between them by ear: "ke" is the directional
    // "to" and "dalam" is "in".
    expect(engine.evaluate("15:00 ke Inggris").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 dalam Prancis").value?.unit).toBe("Europe/Paris");
    // The country words, which are this file's bulk. Every one comes through Dutch or
    // Portuguese rather than English, which is why none of them was already in the
    // table.
    expect(engine.evaluate("15:00 ke Jerman").value?.unit).toBe("Europe/Berlin");
    expect(engine.evaluate("15:00 ke Ukraina").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 ke Rusia").value?.unit).toBe("Europe/Moscow");
    expect(engine.evaluate("15:00 ke Brasil").value?.unit).toBe("America/Sao_Paulo");
    // The one city name Indonesian genuinely spells its own way, beside the English
    // spelling the table already carries.
    expect(engine.evaluate("15:00 ke Singapura").value?.unit).toBe("Asia/Singapore");
    expect(engine.evaluate("15:00 ke singapore").value?.unit).toBe("Asia/Singapore");
    // Lowercase as a search box produces it and capitalised as Indonesian writes a
    // proper noun: the index folds either way.
    expect(engine.evaluate("15:00 ke jepang").value?.unit).toBe("Asia/Tokyo");
  });

  // Where Indonesian has two current spellings, both are listed — and the reason is
  // this language's analyzer chain rather than politeness to the reader.
  // `indonesian.analyze` is a bare `identity()` with no stripper behind it, so an
  // unlisted variant is unreachable rather than penalised, which makes enumerating
  // variants Indonesian's job in a way it is not German's.
  test("both current spellings of a name reach the same zone", () => {
    expect(indonesian.analyze?.length).toBe(1);
    // Moscow: "Moskwa" transliterates the Russian, "Moskow" is the press spelling.
    expect(engine.evaluate("15:00 ke Moskwa").value?.unit).toBe("Europe/Moscow");
    expect(engine.evaluate("15:00 ke Moskow").value?.unit).toBe("Europe/Moscow");
    // China: "Tiongkok" is the name Indonesian officially adopted in 2014, "Cina" the
    // older one still in wide use — neither obsolete, so both read.
    expect(engine.evaluate("15:00 ke Tiongkok").value?.unit).toBe("Asia/Shanghai");
    expect(engine.evaluate("15:00 ke Cina").value?.unit).toBe("Asia/Shanghai");
    // France: "Prancis" is the standard spelling, "Perancis" the older one.
    expect(engine.evaluate("15:00 ke Perancis").value?.unit).toBe("Europe/Paris");
  });

  // The finding this package hands upstream, written as an assertion so it fails the
  // day it is fixed instead of staying as a stale comment. The zone seven of every ten
  // Indonesians live in — WIB, Asia/Jakarta — is not in `ZONES`, so there is no unit
  // id for this vocabulary to name: a `Vocabulary` may only name units the kind
  // declares. Pointing "jakarta" at Asia/Singapore would be wrong twice over, since
  // Singapore is UTC+08:00 and Jakarta is +07:00.
  test("records that Asia/Jakarta has no unit to name", () => {
    expect(Object.keys(ZONES)).not.toContain("Asia/Jakarta");
    expect(Object.keys(datetimeId.units)).not.toContain("Asia/Jakarta");
    for (const [, alias] of added) {
      expect(["jakarta", "wib", "wita", "wit"]).not.toContain(alias);
    }
    expect(() => engine.evaluate("15:00 ke jakarta")).toThrow();
    expect(() => engine.evaluate("15:00 ke wib")).toThrow();
  });

  // Pacific/Auckland is the one named zone this file gives nothing, and it is worth an
  // assertion rather than a silence. "Selandia Baru" is two tokens; Indonesian does
  // not compound, so unlike Dutch — which lists the closed-up *nieuwzeeland* as a
  // read-only concession to a search box — there is no single-token spelling anyone
  // would type even by accident. "Auckland" is already in the table, spelled the way
  // Indonesian spells it.
  test("New Zealand stays reachable only by its city name", () => {
    expect(added.filter(([z]) => z === "Pacific/Auckland")).toEqual([]);
    expect(engine.evaluate("15:00 ke Auckland").value?.unit).toBe("Pacific/Auckland");
    expect(() => engine.evaluate("15:00 ke selandia")).toThrow();
  });

  test("the Latin aliases still read in an Indonesian engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 ke tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 ke utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were never
    // this file's to lose: they live in `@smartput/datetime/locale/en`, and an engine
    // that installed only Indonesian simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeId.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeId.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 ke gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // What a "round-trip" can and cannot mean for this kind, pinned rather than fudged.
  // A chain of conversions is the real round trip: the instant is the value, the zone
  // is only how it is written, so converting twice must land on the same canonical the
  // bare reading had.
  test("a conversion chain preserves the instant", () => {
    const bare = engine.evaluate("15:00");
    const chained = engine.evaluate("15:00 ke Jepang dalam Ukraina");
    expect(chained.value?.unit).toBe("Europe/Kyiv");
    expect(chained.value?.canonical.toString()).toBe(
      bare.value?.canonical.toString() ?? "",
    );
  });

  // And the half that does *not* round-trip, recorded so it is not rediscovered: this
  // kind's formatted output is a display string, not an input, in every language.
  // "2026-01-16 00:00 JST" is a datetime followed by a bare zone word with no
  // conversion keyword between them, which is not a phrase the grammar has — `en`
  // cannot read its own output either, and nothing a vocabulary can reach changes
  // that.
  test("the formatted output is display, not input, in Indonesian as in English", () => {
    const printed = engine.evaluate("15:00 ke Jepang").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // Put a keyword back between them and it reads, which is what says the zone word
    // is fine and the *phrase* is what is missing.
    expect(engine.evaluate("2026-01-16 00:00 ke JST").value?.unit).toBe("Asia/Tokyo");
  });

  // An Indonesian date is written 15/01/2026 or 15-01-2026, and a dotted 15.01.2026
  // turns up too. This engine reads none of them, and the cause is not a missing
  // alias: "." is Indonesian's own *group* separator, so those digits are ambiguous
  // with a grouped number before any date matcher is asked, and the matcher itself is
  // chrono's English configuration. Nothing a vocabulary can express fixes either
  // half, so this is written down here and reported against the kind rather than
  // papered over — the same finding `nl.test.ts` records, arrived at from a language
  // that shares Dutch's separators exactly.
  test("records that the Indonesian date format does not parse", () => {
    expect(() => engine.evaluate("15.01.2026 15:00")).toThrow();
    expect(engine.evaluate("2026-01-15 15:00").formatted).toBe("2026-01-15 15:00 UTC");
  });
});
