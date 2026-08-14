import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeAr from "./ar";
import datetimeEn from "./en";

const locale = composeLocale(arabic, [datetimeAr]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/** Arabic and Arabic Supplement, which is every letter this phase can write. */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Found by script rather than by subtracting the table, which is where Arabic
 * sides with Russian and not with German: a different script means "طوكيو" and
 * "tokyo" can never be confused for one another the way "Kalkutta" and "Kolkata"
 * can.
 */
const added: Array<[string, string]> = Object.entries(datetimeAr.units).flatMap(
  ([zone, words]) =>
    words.aliases.filter((a) => ARABIC.test(a)).map((a): [string, string] => [zone, a]),
);

describe("datetime ar vocabulary", () => {
  test("it targets Arabic and names its kind by id", () => {
    expect(datetimeAr.locale).toBe("ar");
    expect(datetimeAr.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeAr.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeAr.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      // An offset zone ships none in any language: "gmt+3" lexes as three tokens,
      // so no alias lookup could ever reach it — `parseOffsetZone` is its only
      // door.
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is unit ids and signatures, so no script but ASCII may reach it. Arabic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(datetime)).not.toMatch(ARABIC);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk` and `ru`: this file adds a layer, it does not replace one. An
    // Arabic engine still reads "15:00 في tokyo", because recognition is
    // many-to-one.
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeAr.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeAr.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Arabic words come through beside them, deduped", () => {
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases).toContain("طوكيو");
    expect(datetimeAr.units["Europe/Moscow"]?.aliases).toContain("موسكو");
    for (const [zone, words] of Object.entries(datetimeAr.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  test("every named zone got Arabic words, not just the ones `en` spells out", () => {
    // `en` adds a spelled-out name to twelve of the eighteen named zones and
    // leaves the rest to the table, which is affordable only because that table is
    // already English — and `de` can leave "Chicago" alone for the same reason.
    // Nothing in it is typeable on an Arabic layout, so a gap here is a zone an
    // Arabic speaker cannot reach at all.
    for (const zone of Object.keys(ZONES)) {
      expect(
        datetimeAr.units[zone]?.aliases.some((a) => ARABIC.test(a)),
        `${zone} has no Arabic word`,
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
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction*. A fractional
    // count is added for the same reason every other `ar` vocabulary adds one,
    // except that here it can only confirm the absence of a `forms` table, since a
    // unit with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and none could index one", () => {
    for (const [zone, words] of Object.entries(datetimeAr.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // Arabic would owe six keys per unit, the dual among them — and a zone is
    // never counted, so there is no طوكيوان to name. The case axis has nothing to
    // add either: the case a preposition governs is a final short vowel Arabic
    // does not write, so "في طوكيو" and "إلى طوكيو" are the same spelling and it
    // belongs in `aliases`. `selectForm` still answers, because it is a function of
    // the count and the slot and knows nothing about which units have tables,
    // which is why the absence is asserted rather than inferred.
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      arabic.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot,
      });
    expect(key(0, "after-number")).toBe("zero");
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("two");
    expect(key(5, "after-number")).toBe("few");
    expect(key(11, "after-number")).toBe("many");
    expect(key(1.5, "after-number")).toBe("other");
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it. In Arabic that
    // lands on the genitive singular, and the slot itself is inert.
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(key(2, "conversion-target")).toBe("two");
  });

  test("no Arabic word is claimed by two zones", () => {
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
    // a user takes: إلى is the Arabic `in` keyword, the zone is the right operand
    // of a conversion, and a word that only reaches its unit via the language's
    // penalised article stripper still counts — a penalised reading is a reading,
    // and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 إلى ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("an engine built from it reads Arabic zone words", () => {
    // The same three sums `en.test.ts` pins, said in Arabic. The clock is written
    // 24-hour because "3pm" is an English spelling of a time and this engine has
    // no English in it at all — which is also how an Arabic timetable writes it.
    // The digits are Latin because `arabic.numberFormat` is the `latn` system:
    // "١٥:٠٠" does not lex, and that is a core-level gap named in
    // `@smartput/core/locale/ar`, not something a word list can close.
    expect(engine.evaluate("15:00 إلى طوكيو").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 إلى اليابان").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 إلى غرينتش").formatted).toBe("2026-01-15 15:00 UTC");
    // All three of Arabic's `in` spellings reach a zone, because `ar.ts` lists
    // them under one keyword: إلى ("to"), its hamza-less spelling الى — which is
    // what most keyboards and most typists produce, and which `buildKeywords`
    // cannot derive because it matches keywords by exact folded string and never
    // runs one through `Language.analyze` — and في ("in").
    expect(engine.evaluate("15:00 في كييف").value?.unit).toBe("Europe/Kyiv");
    expect(engine.evaluate("15:00 الى موسكو").value?.unit).toBe("Europe/Moscow");
    // Arabic has no letter case, so there is no capitalised variant to test the
    // way `ru` tests "Токио" against "токио" — the index folds and there is
    // nothing to fold.
    expect(engine.evaluate("15:00 في نيويورك").formatted).toBe("2026-01-15 10:00 ET");
  });

  test("the article is written and the bare stem is listed beside it", () => {
    // The rows this vocabulary exists to get right. Arabic country names split
    // into two classes: اليابان، الصين، الهند، البرازيل، الإمارات take an
    // obligatory ال, while فرنسا، ألمانيا، أوكرانيا do not. The prefix stripper
    // recovers the first class at `weight: -2`, and it is penalised precisely so a
    // declared alias outranks a guess — so both spellings are listed.
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases).toContain("اليابان");
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases).toContain("يابان");
    expect(engine.evaluate("15:00 إلى الصين").value?.unit).toBe("Asia/Shanghai");
    expect(engine.evaluate("15:00 إلى صين").value?.unit).toBe("Asia/Shanghai");
    // And the hamza pairs, which the analyzer cannot supply: `arabic`'s
    // orthographic fold removes a hamza the user typed and can never invent one
    // they did not, so the plain-alif spelling has to be declared.
    expect(datetimeAr.units["Australia/Sydney"]?.aliases).toContain("أستراليا");
    expect(datetimeAr.units["Australia/Sydney"]?.aliases).toContain("استراليا");
    expect(engine.evaluate("15:00 إلى استراليا").value?.unit).toBe("Australia/Sydney");
    // Where Russian needs three case forms of every name — "в Києві" against "до
    // Києва" — Arabic needs none: the case its prepositions govern is a final
    // short vowel nobody writes, so طوكيو after إلى is spelled exactly like طوكيو
    // after في. That is the reading side of the same fact `arabic.selectForm`
    // cites when it declines a slot axis.
    expect(engine.evaluate("15:00 إلى طوكيو").value?.unit).toBe(
      engine.evaluate("15:00 في طوكيو").value?.unit,
    );
    expect(datetimeAr.units["Asia/Tokyo"]?.aliases.filter((a) => ARABIC.test(a))).toEqual(
      ["طوكيو", "اليابان", "يابان"],
    );
  });

  test("the two-token names are reached by a one-token stand-in", () => {
    // `lex` ends a word token at a space, so لوس أنجلوس and ساو باولو can never be
    // aliases. The zones are reached by a district, a state and a country instead
    // — the same trade `en` makes with "manhattan" and "hollywood".
    expect(engine.evaluate("15:00 إلى هوليوود").value?.unit).toBe("America/Los_Angeles");
    expect(engine.evaluate("15:00 إلى كاليفورنيا").value?.unit).toBe(
      "America/Los_Angeles",
    );
    expect(engine.evaluate("15:00 إلى البرازيل").value?.unit).toBe("America/Sao_Paulo");
    // And the one place Arabic is luckier than Cyrillic: it writes New York and
    // New Zealand as single tokens, where Russian has the hyphenated Нью-Йорк —
    // and a hyphen is the subtraction operator.
    expect(engine.evaluate("15:00 إلى نيويورك").value?.unit).toBe("America/New_York");
    expect(engine.evaluate("15:00 إلى نيوزيلندا").value?.unit).toBe("Pacific/Auckland");
  });

  test("the interrogative كيف is not claimed as a spelling of Kyiv", () => {
    // كييف is the city. كيف is Arabic for "how", one of the commonest words in the
    // language, and it is one edit away — so it is left out deliberately rather
    // than added for the typist who drops a yāʾ. Recorded as an assertion because
    // an alias that steals an interrogative reads as coverage.
    expect(datetimeAr.units["Europe/Kyiv"]?.aliases).toContain("كييف");
    expect(datetimeAr.units["Europe/Kyiv"]?.aliases).not.toContain("كيف");
  });

  test("the Latin aliases still read in an Arabic engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 في tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 في utc").formatted).toBe("2026-01-15 15:00 UTC");
    // And the `en` layer's own additions are not lost either, because they were
    // never this file's to lose: they live in `@smartput/datetime/locale/en`, and
    // an engine that installed only Arabic simply does not have them.
    expect(datetimeEn.units["Europe/Berlin"]?.aliases).toContain("germany");
    expect(datetimeAr.units["Europe/Berlin"]?.aliases).not.toContain("germany");
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimeAr.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 في gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // Right-to-left, asserted so a later reader does not "fix" it. The formatted
  // string is in *logical* order — date, then time, then the zone abbreviation —
  // and the Unicode Bidirectional Algorithm arranges it at display time. Bidi
  // isolates (U+2066–2069) are invisible characters `normalize()` does not strip,
  // so a "fix" that inserted them would travel straight into the lexer.
  test("the formatted string is logically ordered and carries no bidi controls", () => {
    const formatted = engine.evaluate("15:00 إلى طوكيو").formatted;
    expect(formatted).toBe("2026-01-16 00:00 JST");
    expect(formatted.indexOf("2026")).toBeLessThan(formatted.indexOf("JST"));
    expect(formatted).not.toMatch(/[‎‏⁦-⁩]/);
  });

  test("round-trips its own output, as far as this kind's output can", () => {
    // Every sibling `ar` vocabulary hands its formatted string straight back to
    // `evaluate` and gets the same value. This kind cannot, in any language, and
    // the shape of the failure is worth pinning rather than omitting: a formatted
    // datetime ends in `zoneSymbol(zone)`, and a date-time followed by a bare zone
    // word is not an expression the grammar has — a zone reaches a value through
    // the `in` keyword, never by sitting after it.
    const tokyo = engine.evaluate("15:00 إلى طوكيو");
    expect(tokyo.formatted).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(tokyo.formatted)).toThrow();
    // What does round-trip is the same line without that trailing abbreviation,
    // for a value in the engine's own zone — which is the whole of the printed
    // string that this vocabulary and the language between them decide. The
    // instant comes back identical, so nothing in the Arabic layer is lost on the
    // way out; only the zone label is, and it was never a word.
    const here = engine.evaluate("15:00");
    expect(here.formatted).toBe("2026-01-15 15:00 UTC");
    const again = engine.evaluate(here.formatted.replace(" UTC", ""));
    expect(again.value?.canonical.toString()).toBe(here.value?.canonical.toString());
    expect(again.value?.unit).toBe(here.value?.unit);
  });
});
