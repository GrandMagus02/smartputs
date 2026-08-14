import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeTr from "./tr";

const locale = composeLocale(turkish, [datetimeTr]);
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
 * Derived by subtracting the zone table rather than by matching a script — the
 * only route available here. Turkish is written in Latin letters, and although
 * some of its words carry a diacritic the zone ids do not, most do not:
 * "kaliforniya" and "kolkata" look alike to any character class.
 */
const added: Array<[string, string]> = Object.entries(datetimeTr.units).flatMap(
  ([zone, words]) => {
    const generated = new Set({ ...ZONES, ...OFFSET_ZONES }[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

describe("datetime tr vocabulary", () => {
  test("it targets Turkish and names its kind by id", () => {
    expect(datetimeTr.locale).toBe("tr");
    expect(datetimeTr.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeTr.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeTr.units)) {
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
  // script regex is nearly useless here — Turkish is Latin, the same characters
  // the zone ids are written in — so this greps for the words themselves.
  test("the kind itself carries no Turkish word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(
      /ingiltere|fransa|almanya|japonya|ukrayna|rusya|brezilya/i,
    );
    expect(source).not.toMatch(/londra|moskova|kalküta|kalkuta|kaliforniya|singapur/i);
    expect(source).not.toMatch(/türkiye|turkiye|istanbul|evrensel/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk`, `de` and `nl`: this file adds a layer, it does not replace one.
    // A Turkish engine still reads "15:00 to tokyo", because recognition is
    // many-to-one and generation is one (design decision I6).
    expect(datetimeTr.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeTr.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeTr.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeTr.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Turkish words come through beside them, deduped", () => {
    expect(datetimeTr.units["Asia/Tokyo"]?.aliases).toContain("japonya");
    expect(datetimeTr.units["Europe/London"]?.aliases).toContain("londra");
    for (const [zone, words] of Object.entries(datetimeTr.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // The decision this file takes that `uk` could not: Turkish shares the Latin
  // alphabet, so a zone whose Turkish name is spelled exactly as the table
  // already has it needs no entry — and adding one would be a duplicate alias,
  // not a translation.
  test("a zone earns a Turkish word only where Turkish differs", () => {
    for (const zone of ["America/Chicago", "America/Denver", "Asia/Dubai"]) {
      expect(
        added.filter(([z]) => z === zone),
        `${zone} was given a redundant word`,
      ).toEqual([]);
      // Still reachable, because the table's own word *is* the Turkish one.
      expect(engine.evaluate(`15:00 çevir ${zone.split("/")[1]}`).value?.unit).toBe(zone);
    }
    // And every zone whose Turkish name does differ got one. The list is unusually
    // long for a Latin-alphabet language, because the 1928 alphabet reform made
    // spelling phonemic and applied that to toponyms: London → Londra, Moscow →
    // Moskova, Calcutta → Kalküta, Sydney → Sidney, Singapore → Singapur.
    for (const zone of [
      "UTC",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Kyiv",
      "Europe/Moscow",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Asia/Singapore",
      "Australia/Sydney",
      "America/Sao_Paulo",
      "America/Los_Angeles",
    ]) {
      expect(
        added.some(([z]) => z === zone),
        `${zone} has no Turkish word`,
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
    // asserted to resolve back to its own zone, which is the half that carries
    // this file.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `tr` a fraction cannot select a different key — there
    // is only one — and here it can only confirm the absence of a `forms` table
    // besides, since a unit with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeTr.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A zone is never counted — there is no such thing as two Japonyas — and
    // `turkish.selectForm` is the constant `"other"`, so a bare quantity, a
    // conversion target and a count-free call are one key. It still answers,
    // because it knows nothing about which units have tables, and that is why the
    // absence is asserted rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      turkish.selectForm({
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
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
  });

  // The second axis this language genuinely has and `@smartput/core/locale/tr`
  // rejected, on the kind where it would have been most tempting. Turkish marks
  // location with the locative and a conversion target with the dative, so a
  // slot-keyed `forms` table could in principle have printed the inflected zone
  // name — but a proper noun takes its suffix after an **apostrophe**, and an
  // apostrophe is punctuation no `forms` cell survives being read back through.
  //
  // Reading it is a different question from printing it, and the two used to be
  // conflated here: this test asserted that "Japonya'da" *throws*, which pinned
  // a gap rather than a decision. `turkish`'s `APOSTROPHE_STRIPPER` closes it —
  // the apostrophe-suffixed forms are the ones a Turkish sentence actually
  // contains, and they now resolve to the same zone the bare word does, at the
  // stripper's −2. What stays true is the half the rejection was about: no
  // `forms` cell can *hold* "Japonya'da", so nothing prints it.
  test("an inflected zone name is read, and still cannot be printed", () => {
    expect(engine.evaluate("15:00 çevir Japonya").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 çevir Japonya'da").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 çevir Tokyo'ya").value?.unit).toBe("Asia/Tokyo");
    // The printing half, unchanged: no unit in this vocabulary declares a
    // `forms` table, so there is no cell an apostrophe could have gone in.
    for (const words of Object.values(datetimeTr.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("no Turkish word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route
    // a user takes: "çevir" is the Turkish conversion verb and the zone is the
    // right operand.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 çevir ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Turkish zone words", () => {
    // The same three sums `en.test.ts` pins, said in Turkish. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has
    // no English in it at all — which is also how Turkish writes it.
    expect(engine.evaluate("15:00 çevir Japonya").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 çevir evrensel").formatted).toBe(
      "2026-01-15 15:00 UTC",
    );
    // Every one of this language's conversion keywords reaches a zone: the verb in
    // its correct and its ASCII spelling, and English's "to" folded into the same
    // entry by `buildKeywords`.
    expect(engine.evaluate("15:00 çevir İngiltere").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 cevir Fransa").value?.unit).toBe("Europe/Paris");
    expect(engine.evaluate("15:00 to Almanya").value?.unit).toBe("Europe/Berlin");
    // The country words, which are half this file's bulk: each comes through
    // French or Italian rather than English, which is why none was already in the
    // table.
    expect(engine.evaluate("15:00 çevir Ukrayna").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 çevir Rusya").value?.unit).toBe("Europe/Moscow");
    expect(engine.evaluate("15:00 çevir Brezilya").value?.unit).toBe("America/Sao_Paulo");
    expect(engine.evaluate("15:00 çevir Hindistan").value?.unit).toBe("Asia/Kolkata");
    // And the respelled city names, which are the other half and are what makes
    // this file longer than a Dutch or Indonesian one. The English spelling the
    // table carries keeps working beside each.
    expect(engine.evaluate("15:00 çevir Londra").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 çevir london").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 çevir Moskova").value?.unit).toBe("Europe/Moscow");
    expect(engine.evaluate("15:00 çevir Singapur").value?.unit).toBe("Asia/Singapore");
    expect(engine.evaluate("15:00 çevir Sidney").value?.unit).toBe("Australia/Sydney");
    // Lowercase as a search box produces it, capitalised as Turkish writes a
    // proper noun, and in the all-caps a heading is set in — the last of which
    // reaches the alias only through `@smartput/core/locale/tr`'s two-way i fold.
    expect(engine.evaluate("15:00 çevir japonya").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 çevir JAPONYA").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 çevir İNGİLTERE").value?.unit).toBe("Europe/London");
    expect(engine.evaluate("15:00 çevir INGILTERE").value?.unit).toBe("Europe/London");
  });

  // Where a Turkish word carries a letter an ASCII keyboard lacks, the plain
  // spelling is listed beside it — `tr-cardinals.ts`'s rule, which lists "uc"
  // beside "üç" — but only where the plain spelling is not already another word.
  // The two entries that make the rule visible are here.
  test("kalkuta is listed beside kalküta, and cin is not listed beside çin", () => {
    expect(datetimeTr.units["Asia/Kolkata"]?.aliases).toContain("kalküta");
    expect(datetimeTr.units["Asia/Kolkata"]?.aliases).toContain("kalkuta");
    expect(engine.evaluate("15:00 çevir kalkuta").value?.unit).toBe("Asia/Kolkata");
    // *Cin* is the ordinary noun for a jinn, so claiming it would turn a sentence
    // about a spirit into a time zone. The word itself still reads with its
    // cedilla, in any case.
    expect(datetimeTr.units["Asia/Shanghai"]?.aliases).toContain("çin");
    expect(datetimeTr.units["Asia/Shanghai"]?.aliases).not.toContain("cin");
    expect(engine.evaluate("15:00 çevir Çin").value?.unit).toBe("Asia/Shanghai");
    expect(engine.evaluate("15:00 çevir ÇİN").value?.unit).toBe("Asia/Shanghai");
    expect(() => engine.evaluate("15:00 çevir cin")).toThrow();
  });

  // The finding this package hands upstream, written as an assertion so it fails
  // the day it is fixed instead of staying as a stale comment. The zone every
  // Turkish reader is in — Europe/Istanbul — is not in `ZONES`, so there is no
  // unit id for this vocabulary to name. The temptation to point it at
  // Europe/Moscow is unusually strong: Turkey has kept UTC+03:00 year round since
  // 2016, so the alias would print the right number while answering a question
  // about one country with a fact about another.
  test("records that Europe/Istanbul has no unit to name", () => {
    expect(Object.keys(ZONES)).not.toContain("Europe/Istanbul");
    expect(Object.keys(datetimeTr.units)).not.toContain("Europe/Istanbul");
    for (const [, alias] of added) {
      expect(["istanbul", "ankara", "türkiye", "turkiye", "tsi"]).not.toContain(alias);
    }
    expect(() => engine.evaluate("15:00 çevir istanbul")).toThrow();
    expect(() => engine.evaluate("15:00 çevir türkiye")).toThrow();
    // The offset that makes the shortcut tempting, and the reason it is still
    // wrong: it is Moscow's zone, and Moscow is the one that would move.
    expect(engine.evaluate("15:00 çevir Moskova").formatted).toBe("2026-01-15 18:00 MSK");
  });

  // Two zones this file gives nothing, each worth an assertion rather than a
  // silence. "Yeni Zelanda" and "Birleşik Arap Emirlikleri" are multi-token names,
  // and Turkish does not close either up; the bare "Emirlikler" is the plural
  // common noun "emirates" and names no country on its own. Both zones stay
  // reachable by the city name the table already carries, spelled as Turkish
  // spells it.
  test("New Zealand and the UAE stay reachable only by their city names", () => {
    expect(added.filter(([z]) => z === "Pacific/Auckland")).toEqual([]);
    expect(added.filter(([z]) => z === "Asia/Dubai")).toEqual([]);
    expect(engine.evaluate("15:00 çevir Auckland").value?.unit).toBe("Pacific/Auckland");
    expect(engine.evaluate("15:00 çevir Dubai").value?.unit).toBe("Asia/Dubai");
    expect(() => engine.evaluate("15:00 çevir zelanda")).toThrow();
    expect(() => engine.evaluate("15:00 çevir emirlikler")).toThrow();
  });

  test("the Latin aliases still read in a Turkish engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 çevir tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 çevir utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and
    // an engine that installed only Turkish simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeTr.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeTr.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 çevir gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // What a "round-trip" can and cannot mean for this kind, pinned rather than
  // fudged. A chain of conversions is the real round trip: the instant is the
  // value, the zone is only how it is written, so converting twice must land on
  // the same canonical the bare reading had.
  test("a conversion chain preserves the instant", () => {
    const bare = engine.evaluate("15:00");
    const chained = engine.evaluate("15:00 çevir Japonya çevir Ukrayna");
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
  test("the formatted output is display, not input, in Turkish as in English", () => {
    const printed = engine.evaluate("15:00 çevir Japonya").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // Put a keyword back between them and it reads, which is what says the zone
    // word is fine and the *phrase* is what is missing.
    expect(engine.evaluate("2026-01-16 00:00 çevir JST").value?.unit).toBe("Asia/Tokyo");
  });

  // A Turkish date is written 15.01.2026 or 15/01/2026. This engine reads
  // neither, and the cause is not a missing alias: "." is Turkish's own *group*
  // separator, so those digits are ambiguous with a grouped number before any
  // date matcher is asked, and the matcher itself is chrono's English
  // configuration. Nothing a vocabulary can express fixes either half, so this is
  // written down here and reported against the kind rather than papered over —
  // the same finding `nl.test.ts` and `id.test.ts` record from languages that
  // share Turkish's separators exactly.
  test("records that the Turkish date format does not parse", () => {
    expect(() => engine.evaluate("15.01.2026 15:00")).toThrow();
    expect(engine.evaluate("2026-01-15 15:00").formatted).toBe("2026-01-15 15:00 UTC");
  });
});
