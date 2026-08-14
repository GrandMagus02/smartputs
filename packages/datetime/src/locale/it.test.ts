import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeIt from "./it";

const locale = composeLocale(italian, [datetimeIt]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/** Anything only Italian would write — the five accented vowels it uses. */
const ITALIAN = /[àèéìòù]/i;

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Italian shares its script with the table it layers over, so — unlike the
 * Ukrainian file, which can find its own additions with a Cyrillic regex — the
 * additions have to be found by subtraction: what is in the composed alias list
 * and not in `ZONES`.
 */
const added: Array<[string, string]> = Object.entries(datetimeIt.units).flatMap(
  ([zone, words]) => {
    const generated = new Set(ZONES[zone]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [zone, a]);
  },
);

/**
 * The zones whose printed symbol this vocabulary knowingly cannot read back, and
 * the one option `assertLocaleContract` is given beyond the offset zones.
 *
 * Every one of them is an English or international abbreviation the shipped
 * table chose — "ET", "CT", "MT", "PT", "IST", "NZ" — plus Shanghai's "CST",
 * which is an alias of `America/Chicago` and therefore reads back as the wrong
 * zone rather than as nothing. None of this is Italian's doing: `en` prints the
 * identical seven strings and cannot read them either, which is why its own test
 * file does not run the contract at all. Running it *with* the list named is the
 * stronger position — the other eleven zones are checked, and the day a symbol
 * moves into the alias table this list is what has to shrink.
 */
const UNREADABLE_SYMBOLS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Pacific/Auckland",
];

/**
 * Offset zones are skipped whole. They carry no aliases in any language, on
 * purpose — "gmt+3" lexes as three tokens, so no alias lookup could ever reach
 * one and `parseOffsetZone` is their only door — and a unit with no alias is
 * exactly what the contract's first check reports.
 */
const contractOptions = {
  skip: Object.keys(OFFSET_ZONES).map((zone) => `datetime:${zone}`),
  skipPrintable: UNREADABLE_SYMBOLS.map((zone) => `datetime:${zone}`),
};

describe("datetime it vocabulary", () => {
  test("it targets Italian and names its kind by id", () => {
    expect(datetimeIt.locale).toBe("it");
    expect(datetimeIt.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimeIt.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimeIt.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is unit ids and signatures, so nothing a language wrote may reach it.
  // Italian shares the Latin script with the zone ids themselves, so the grep is
  // for what only Italian writes — the accents — plus the exonyms this file adds.
  test("the kind itself carries no Italian word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(ITALIAN);
    expect(source).not.toMatch(/londra|parigi|berlino|pechino|giappone|germania/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as
    // in `en`, `uk` and `es`: this file adds a layer, it does not replace one.
    // An Italian engine still reads "15:00 in tokyo", because recognition is
    // many-to-one and generation is one (design decision I6).
    expect(datetimeIt.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimeIt.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimeIt.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimeIt.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Italian words come through beside them, deduped", () => {
    expect(datetimeIt.units["Europe/London"]?.aliases).toContain("londra");
    expect(datetimeIt.units["Asia/Tokyo"]?.aliases).toContain("giappone");
    for (const [zone, words] of Object.entries(datetimeIt.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // Where `uk` had to name every zone — nothing in the shipped table is typeable
  // on a Ukrainian layout — Italian shares the keyboard, so a zone Italian
  // spells the way the table already does needs nothing. What it must not miss
  // is the zone whose Italian name is a *different string*: an exonym, which no
  // analyzer can recover from the English form, since `it.ts`'s fold substitutes
  // a final vowel and "londra" is not "london" with a vowel swapped.
  test("every zone Italian spells differently got its own word", () => {
    const italianNames: Record<string, string> = {
      "Europe/London": "londra",
      "Europe/Paris": "parigi",
      "Europe/Berlin": "berlino",
      "Europe/Moscow": "mosca",
      "Asia/Kolkata": "calcutta",
      "Asia/Shanghai": "pechino",
      "America/Sao_Paulo": "brasile",
    };
    for (const [zone, word] of Object.entries(italianNames)) {
      expect(datetimeIt.units[zone]?.aliases, zone).toContain(word);
    }
    // Chicago, Denver and Singapore are spelled as the table spells them, and
    // Sydney and Dubai take no Italian accent, so nothing was added for the
    // spelling of any of them — an empty row here is a decision, not a gap.
    expect(added.filter(([zone]) => zone === "America/Chicago")).toEqual([]);
    expect(added.filter(([zone]) => zone === "America/Denver")).toEqual([]);
    expect(added.filter(([zone]) => zone === "Asia/Singapore")).toEqual([]);
  });

  // The half of the Spanish file that Italian does not need, pinned so the
  // absence reads as orthography rather than as an oversight: Italian writes an
  // accent only on a final stressed vowel, and none of these names has one. So
  // there is no accented spelling to declare, and no accent-free variant to
  // declare beside it — every word this file adds is already the plain one.
  test("no word it adds carries a written accent", () => {
    for (const [zone, alias] of added) {
      expect(alias, `${zone} adds an accented spelling`).not.toMatch(ITALIAN);
    }
  });

  test("no Italian word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the
    // route a user takes: "in" is the Italian `in` keyword, the zone is the
    // right operand of a conversion, and a word that only reaches its unit via
    // the language's penalised plural fold still counts — a penalised reading is
    // a reading, and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 in ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [datetime], contractOptions)).not.toThrow();
    // The default counts are all integers, so `italian.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `it` vocabulary adds one — except
    // that a zone is never counted, so here it can only confirm that no unit has
    // a `forms` table for the sweep to index. That is the honest shape of this
    // kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and selectForm still answers", () => {
    for (const [zone, words] of Object.entries(datetimeIt.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A `forms` table exists so a *count* can pick a word, and there is no such
    // thing as due Tokyo. `italian.selectForm` knows nothing about which units
    // have tables, so it keeps answering — which is what makes the absence above
    // a decision about this kind rather than a property of the language.
    const key = (count: number | undefined) =>
      italian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot: "conversion-target",
      });
    expect(key(1)).toBe("one");
    expect(key(1.5)).toBe("other");
    expect(key(undefined)).toBe("other");
  });

  test("an engine built from it reads Italian zone words", () => {
    // The clock is written 24-hour because "3pm" is an English spelling of a
    // time and this engine has no English in it at all.
    expect(engine.evaluate("15:00 in giappone").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in Greenwich").formatted).toBe("2026-01-15 15:00 UTC");
    expect(engine.evaluate("15:00 in Londra").formatted).toBe("2026-01-15 15:00 London");
    expect(engine.evaluate("15:00 in Parigi").formatted).toBe("2026-01-15 16:00 CET");
    // The country, which is how a person names a zone they do not live in.
    expect(engine.evaluate("15:00 in Germania").value?.unit).toBe("Europe/Berlin");
    expect(engine.evaluate("15:00 in Ucraina").value?.unit).toBe("Europe/Kyiv");
    // The exonym for a city whose English name no analyzer can reach from.
    expect(engine.evaluate("15:00 in Mosca").value?.unit).toBe("Europe/Moscow");
    expect(engine.evaluate("15:00 in Pechino").value?.unit).toBe("Asia/Shanghai");
    // The one word of a multi-token name that can be looked up at all: "Nuova
    // Zelanda" and "Los Angeles" are two tokens, and core's alias index is keyed
    // by one segmented word.
    expect(engine.evaluate("15:00 in zelanda").value?.unit).toBe("Pacific/Auckland");
    expect(engine.evaluate("15:00 in angeles").value?.unit).toBe("America/Los_Angeles");
  });

  test("the Latin aliases still read in an Italian engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 in tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 in utc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  // Italian spells `in` two ways and both are ordinary before a zone: "le 15:00
  // in Giappone" and "le 15:00 a Tokyo" — "a" is in fact the preposition Italian
  // puts in front of a *city* ("a Londra", "a Mosca"), which makes it the more
  // natural of the two here. Only one of them survives the chrono bridge, and
  // the reason is upstream of every vocabulary — recorded here as a live
  // assertion rather than left to be rediscovered.
  //
  // `chrono-bridge.ts` cuts the string it offers chrono at the first operator,
  // and its `OPERATOR_TAIL` names the English `to`/`as`/`in` — its own doc
  // comment says so, and says that widening `MatchCtx` to carry the locale's
  // keywords is the real fix. Italian's `in` happens to be the same surface word
  // as English's and so is cut; "a" is not, so it reaches chrono, whose English
  // time parser reads a trailing letter after a clock time as the meridiem
  // marker of "a.m.", and 15:00 with an "am" on it is not a time — the whole
  // match is dropped. A date has already consumed its own letters, so it is
  // unaffected and "a" works after one.
  test("records where the second `in` keyword is lost, and where it is not", () => {
    expect(() => engine.evaluate("15:00 a londra")).toThrow();
    expect(engine.evaluate("15:00 in londra").value?.unit).toBe("Europe/London");
    // After a date, "a" is the ordinary conversion keyword it is everywhere else
    // in this engine.
    expect(engine.evaluate("2026-03-01 a londra").formatted).toBe(
      "2026-03-01 00:00 London",
    );
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way:
    // an offset is not a word, so there is nothing to translate.
    expect(datetimeIt.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 in gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // This kind has no count, so there is no "sum that lands on a fraction" to
  // assert and no plural boundary for the output to move across — the end-to-end
  // shape it has instead is a conversion, which the blocks above cover twice
  // over. What it does have, and what every other `it` vocabulary can close, is
  // a round trip; this one cannot, in Italian or in English.
  test("round-trips the words it adds, and records that its output cannot", () => {
    for (const word of ["giappone", "Londra", "mosca", "calcutta", "pechino"]) {
      const first = engine.evaluate(`15:00 in ${word}`);
      const again = engine.evaluate(`15:00 in ${word}`);
      expect(again.value?.canonical.toString(), word).toBe(
        first.value?.canonical.toString(),
      );
    }
    // The formatted string is a date, a clock and `zoneSymbol(zone)` with no
    // keyword between them, and the grammar has no production for that — the
    // `skipPrintable` list above names the seven zones whose symbol is not even
    // an alias, but even "JST", which is one, cannot be read at the end of a
    // date. `en` throws on its own output identically, so this is the kind's
    // shape and not a gap in this translation.
    const printed = engine.evaluate("15:00 in giappone").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // The half that does read back is the instant without the zone label, which
    // is the string `datetime`'s own literal matcher claims.
    expect(engine.evaluate("2026-01-16 00:00").formatted).toBe("2026-01-16 00:00 UTC");
  });
});
