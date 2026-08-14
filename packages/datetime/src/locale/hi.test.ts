import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";
import datetimeHi from "./hi";

const locale = composeLocale(hindi, [datetimeHi]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/** Devanagari, which is every letter this vocabulary writes. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Found by script rather than by subtracting the table, which is where Hindi
 * sides with Russian and Arabic and not with German: a different script means
 * "टोक्यो" and "tokyo" can never be confused for one another the way "Kalkutta"
 * and "Kolkata" can.
 */
const added: Array<[string, string]> = Object.entries(datetimeHi.units).flatMap(
  ([zone, words]) =>
    words.aliases
      .filter((a) => DEVANAGARI.test(a))
      .map((a): [string, string] => [zone, a]),
);

describe("datetime hi vocabulary", () => {
  test("it targets Hindi and names its kind by id", () => {
    expect(datetimeHi.locale).toBe("hi");
    expect(datetimeHi.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeHi.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeHi.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three tokens,
      // so no alias lookup could ever reach it — `parseOffsetZone` is its only
      // door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is unit ids and signatures, so no script but ASCII may reach it. Devanagari
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Hindi word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(DEVANAGARI);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk`, `ru` and `ar`: this file adds a layer, it does not replace one.
    // A Hindi engine still reads "15:00 में tokyo", because recognition is
    // many-to-one.
    expect(datetimeHi.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeHi.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeHi.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeHi.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Hindi words come through beside them, deduped", () => {
    expect(datetimeHi.units["Asia/Tokyo"]?.aliases).toContain("टोक्यो");
    expect(datetimeHi.units["Asia/Kolkata"]?.aliases).toContain("भारत");
    for (const [zone, words] of Object.entries(datetimeHi.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Hindi words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table is
    // already English — and `de` can leave "Chicago" alone for the same reason.
    // Nothing in it is typeable on a Devanagari layout, so a gap here is a zone a
    // Hindi speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeHi.units[zone]?.aliases.some((a) => DEVANAGARI.test(a)),
        `${zone} has no Hindi word`,
      ).toBe(true);
    }
  });

  // The trap that would make every table test in this file green while the words
  // stayed unreachable: ज़, ड़ and फ़ are Unicode composition *exclusions*, so
  // NFKC — which `normalize()` applies before a word reaches the resolver —
  // decomposes U+095B/U+095C/U+095E into a bare consonant plus U+093C. A name
  // written with a precomposed character would never match what a user typed.
  test("every word it adds survives NFKC unchanged", () => {
    expect(added.filter(([, alias]) => alias.normalize("NFKC") !== alias)).toEqual([]);
    // And the nukta-less twins beside them, which no normalization will ever
    // produce from the nukta-bearing form: ज and ज़ are different letters.
    expect(datetimeHi.units["America/Sao_Paulo"]?.aliases).toContain("ब्राज़ील");
    expect(datetimeHi.units["America/Sao_Paulo"]?.aliases).toContain("ब्राजील");
    expect(datetimeHi.units["Europe/Paris"]?.aliases).toContain("फ़्रांस");
    expect(datetimeHi.units["Europe/Paris"]?.aliases).toContain("फ्रांस");
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
    // print-and-read-back half: `datetime`'s format hook prints
    // `zoneSymbol(zone)` — "IST", "ET", "NZ" — which is not an alias of anything
    // in `en` either, because it is a display abbreviation and not a word. Every
    // alias is still asserted to resolve back to its own zone, which is the half
    // that carries this file.
    const opts = {
      skip: Object.keys(OFFSET_ZONES).map((z) => `datetime:${z}`),
      skipPrintable: Object.keys(ZONES).map((z) => `datetime:${z}`),
    };
    expect(() => assertLocaleContract(locale, [datetime], opts)).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and in
    // Hindi a fraction below 1 lands on the *singular*, which is the boundary
    // English does not have. A fractional count is added for the same reason every
    // other `hi` vocabulary adds one, except that here it can only confirm the
    // absence of a `forms` table, since a unit with none is skipped before any key
    // is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 0.5, 1, 1.5, 2, 5, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeHi.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A `forms` table exists so a *count* can pick a word, and a zone is never
    // counted: there is no such thing as two Tokyos. The case axis has nothing to
    // add either — Hindi's postpositions govern the oblique, and for these names
    // the oblique is the same word, so what a reader types belongs in `aliases`.
    // `selectForm` still answers, because it is a function of the count and the
    // slot and knows nothing about which units have tables, which is why the
    // absence is asserted rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      hindi.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    // The row a table ported from `en` gets wrong: Hindi's `one` is CLDR's `i = 0
    // or n = 1`, so 0 and 0.5 are singular where English puts 0 in `other`.
    expect(key(0, "after-number")).toBe("one");
    expect(key(0.5, "after-number")).toBe("one");
    expect(key(1, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(2, "after-number")).toBe("other");
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it. The slot itself is
    // inert in Hindi.
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(key(5, "conversion-target")).toBe(key(5, "after-number"));
  });

  test("no Hindi word is claimed by two zones", () => {
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
    // a user takes: में is the commonest of Hindi's three `in` keywords, the zone
    // is the right operand of a conversion, and a word that only reaches its unit
    // via the language's penalised suffix stripper still counts — a penalised
    // reading is a reading, and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 में ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Hindi zone words", () => {
    // The same three sums `en.test.ts` pins, said in Hindi. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has
    // no English in it at all — which is also how an Indian timetable writes it.
    // The digits are Latin because `lex` decides digit-ness with an ASCII range
    // test and १ is `\p{Nd}`: "१५:००" does not lex, and that is a core-level gap
    // named in `@smartput/core/locale/hi`, not something a word list can close.
    expect(engine.evaluate("15:00 में टोक्यो").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 में जापान").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 में ग्रीनविच").formatted).toBe("2026-01-15 15:00 UTC");
    // All three of Hindi's `in` postpositions reach a zone, because `hi.ts` lists
    // them under one keyword. Each is the word a different phrasing puts in the
    // infix position: "…में" ("in …"), "…को …" (the accusative marker a full
    // sentence uses) and "…से …" ("from … to …", the heading over a conversion
    // table).
    expect(engine.evaluate("15:00 को कीव").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 से मॉस्को").value?.unit).toBe("Europe/Moscow");
    // Devanagari has no letter case, so there is no capitalised variant to test
    // the way `ru` tests "Токио" against "токио" — the index folds and there is
    // nothing to fold.
    expect(engine.evaluate("15:00 में न्यूयॉर्क").formatted).toBe("2026-01-15 10:00 ET");
  });

  // The row that matters most in this file, and the one no other language's copy
  // of it has: Asia/Kolkata is the home zone of the language this vocabulary is
  // written in, so "भारत में" is the commonest query the table will ever see. IST
  // is +05:30, one of the two half-hour offsets in the whole set, which is also
  // why it is worth asserting the arithmetic rather than only the unit.
  test("भारत reaches the home zone, half-hour offset and all", () => {
    expect(engine.evaluate("15:00 में भारत").formatted).toBe("2026-01-15 20:30 IST");
    expect(engine.evaluate("15:00 में दिल्ली").value?.unit).toBe("Asia/Kolkata");
    expect(engine.evaluate("15:00 में मुंबई").value?.unit).toBe("Asia/Kolkata");
    expect(engine.evaluate("15:00 में कोलकाता").value?.unit).toBe("Asia/Kolkata");
    // कलकत्ता is the older Devanagari name of the same city and still what a great
    // many people type; the stripper could never derive it from कोलकाता, so it is
    // declared.
    expect(engine.evaluate("15:00 में कलकत्ता").value?.unit).toBe("Asia/Kolkata");
  });

  test("the two-token names are reached by a one-token stand-in", () => {
    // `lex` ends a word token at a space, so लॉस एंजेलिस and साओ पाउलो can never
    // be aliases. The zones are reached by a district, a state and a country
    // instead — the same trade `en` makes with "manhattan" and "hollywood".
    expect(engine.evaluate("15:00 में हॉलीवुड").value?.unit).toBe("America/Los_Angeles");
    expect(engine.evaluate("15:00 में कैलिफ़ोर्निया").value?.unit).toBe("America/Los_Angeles");
    expect(engine.evaluate("15:00 में ब्राज़ील").value?.unit).toBe("America/Sao_Paulo");
    // And the places Hindi is luckier than Cyrillic: it writes New York and New
    // Zealand as single tokens, where Russian has the hyphenated Нью-Йорк — and a
    // hyphen is the subtraction operator.
    expect(engine.evaluate("15:00 में न्यूयॉर्क").value?.unit).toBe("America/New_York");
    expect(engine.evaluate("15:00 में न्यूज़ीलैंड").value?.unit).toBe("Pacific/Auckland");
  });

  // Where `uk` and `ru` need three forms of every place name because their `in`
  // keyword governs three different cases, Hindi needs one. Its postpositions
  // govern the oblique, and for these names the oblique is the same word: टोक्यो
  // ends in ो and दिल्ली in ी, neither of which is the ा that becomes े, and the
  // consonant-final ones have an oblique singular identical to their direct.
  // That is the reading side of the same fact `hindi.selectForm` cites when it
  // declines a case axis, so it belongs in this file as an assertion.
  test("all three postpositions take the same spelling of a name", () => {
    const unit = engine.evaluate("15:00 में टोक्यो").value?.unit;
    expect(engine.evaluate("15:00 को टोक्यो").value?.unit).toBe(unit);
    expect(engine.evaluate("15:00 से टोक्यो").value?.unit).toBe(unit);
    expect(
      datetimeHi.units["Asia/Tokyo"]?.aliases.filter((a) => DEVANAGARI.test(a)),
    ).toEqual(["टोक्यो", "जापान"]);
  });

  test("the Latin aliases still read in a Hindi engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 में tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 को utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and
    // an engine that installed only Hindi simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeHi.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeHi.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 में gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  });

  test("round-trips its own output, as far as this kind's output can", () => {
    // Every sibling `hi` vocabulary hands its formatted string straight back to
    // `evaluate` and gets the same value. This kind cannot, in any language, and
    // the shape of the failure is worth pinning rather than omitting: a formatted
    // datetime ends in `zoneSymbol(zone)`, and a date-time followed by a bare zone
    // word is not an expression the grammar has — a zone reaches a value through
    // the `in` keyword, never by sitting after it.
    const tokyo = engine.evaluate("15:00 में टोक्यो");
    expect(tokyo.formatted).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(tokyo.formatted)).toThrow();
    // What does round-trip is the same line without that trailing abbreviation,
    // for a value in the engine's own zone — which is the whole of the printed
    // string that this vocabulary and the language between them decide. The
    // instant comes back identical, so nothing in the Hindi layer is lost on the
    // way out; only the zone label is, and it was never a word.
    const here = engine.evaluate("15:00");
    expect(here.formatted).toBe("2026-01-15 15:00 UTC");
    const again = engine.evaluate(here.formatted.replace(" UTC", ""));
    expect(again.value?.canonical.toString()).toBe(here.value?.canonical.toString());
    expect(again.value?.unit).toBe(here.value?.unit);
  });
});
