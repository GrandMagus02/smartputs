import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimePt from "./pt";

const locale = composeLocale(portuguese, [datetimePt]);
const engine = createEngine({
  locales: [locale],
  kinds: [datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

/** Anything only Portuguese would write — the tilde and the rest of the accents. */
const PORTUGUESE = /[ãõáéíóúàâêôç]/i;

/**
 * Every word this vocabulary adds on top of the generated table, by zone.
 *
 * Portuguese shares its script with the table it layers over, so — unlike the
 * Ukrainian file, which can find its own additions with a Cyrillic regex — the
 * additions have to be found by subtraction: what is in the composed alias list
 * and not in `ZONES`.
 */
const added: Array<[string, string]> = Object.entries(datetimePt.units).flatMap(
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
 * Every one of them is an English or international abbreviation the shipped table
 * chose — "ET", "CT", "MT", "PT", "IST" — plus Shanghai's "CST", which is an
 * alias of `America/Chicago` and therefore reads back as the wrong zone rather
 * than as nothing. None of this is Portuguese's doing: `en` prints the identical
 * six strings and cannot read them either, which is why its own test file does
 * not run the contract at all. Running it *with* the list named is the stronger
 * position — the other twelve zones are checked, and the day a symbol moves into
 * the alias table this list is what has to shrink.
 *
 * `Pacific/Auckland` is the zone that has already left this list, and it is the
 * worked example of that last sentence. Its symbol is "NZ", which `en` reads
 * because `en` declares "nz" as an alias of its own — so the symmetry the
 * paragraph above claims was false for exactly one zone, and the fix was to
 * declare the alias here rather than to widen the waiver.
 */
const UNREADABLE_SYMBOLS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Shanghai",
];

/**
 * Offset zones are skipped whole. They carry no aliases in any language, on
 * purpose — "gmt+3" lexes as three tokens, so no alias lookup could ever reach one
 * and `parseOffsetZone` is their only door — and a unit with no alias is exactly
 * what the contract's first check reports.
 */
const contractOptions = {
  skip: Object.keys(OFFSET_ZONES).map((zone) => `datetime:${zone}`),
  skipPrintable: UNREADABLE_SYMBOLS.map((zone) => `datetime:${zone}`),
};

describe("datetime pt vocabulary", () => {
  test("it targets Portuguese and names its kind by id", () => {
    expect(datetimePt.locale).toBe("pt");
    expect(datetimePt.kind).toBe("datetime");
  });

  test("covers every unit the kind declares", () => {
    expect(Object.keys(datetimePt.units).sort()).toEqual(declared.sort());
  });

  test("every unit has a symbol, and every named zone has aliases (R8)", () => {
    for (const [unit, words] of Object.entries(datetimePt.units)) {
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
      if (unit in OFFSET_ZONES) continue;
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is unit ids and signatures, so nothing a language wrote may reach it.
  // Portuguese shares the Latin script with the zone ids themselves, so the grep
  // is for what only Portuguese writes — the accents — plus the exonyms this file
  // adds.
  test("the kind itself carries no Portuguese word", () => {
    const source = JSON.stringify(datetime);
    expect(source).not.toMatch(PORTUGUESE);
    expect(source).not.toMatch(/tóquio|toquio|londres|berlim|xangai|pequim|zelandia/i);
  });

  test("the generated half stays generated", () => {
    // The zone table's own words and symbol come through untouched, exactly as in
    // `en`, `uk` and `es`: this file adds a layer, it does not replace one. A
    // Portuguese engine still reads "15:00 em tokyo", because recognition is
    // many-to-one and generation is one (design decision I6).
    expect(datetimePt.units["Asia/Tokyo"]?.aliases).toContain("tokyo");
    expect(datetimePt.units["Asia/Tokyo"]?.aliases).toContain("jst");
    for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
      expect(datetimePt.units[zone]?.symbol, zone).toBe(def.symbol);
      for (const alias of def.aliases) {
        expect(datetimePt.units[zone]?.aliases, zone).toContain(alias);
      }
    }
  });

  test("the Portuguese words come through beside them, deduped", () => {
    expect(datetimePt.units["Asia/Tokyo"]?.aliases).toContain("tóquio");
    expect(datetimePt.units["Europe/London"]?.aliases).toContain("londres");
    for (const [zone, words] of Object.entries(datetimePt.units)) {
      expect(words.aliases.length, zone).toBe(new Set(words.aliases).size);
    }
  });

  // Where `uk` had to name every zone — nothing in the shipped table is typeable
  // on a Ukrainian layout — Portuguese shares the keyboard, so a zone it spells
  // the way the table already does needs nothing. What it must not miss is the
  // zone whose Portuguese name is a *different string*: an exonym or an accent,
  // neither of which any analyzer can recover from the English form.
  test("every zone Portuguese spells differently got its own word", () => {
    const portugueseNames: Record<string, string> = {
      "Europe/London": "londres",
      "Europe/Berlin": "berlim",
      "Europe/Moscow": "moscou",
      "Asia/Tokyo": "tóquio",
      "Asia/Kolkata": "calcutá",
      "Asia/Shanghai": "xangai",
      "Asia/Singapore": "singapura",
      "Pacific/Auckland": "zelândia",
    };
    for (const [zone, word] of Object.entries(portugueseNames)) {
      expect(datetimePt.units[zone]?.aliases, zone).toContain(word);
    }
    // Chicago and Denver are spelled as the table spells them, so nothing was
    // added for either — an empty row here is a decision, not a gap.
    expect(added.filter(([zone]) => zone === "America/Chicago")).toEqual([]);
    expect(added.filter(([zone]) => zone === "America/Denver")).toEqual([]);
  });

  // The Brazilian zone, which under the bare `pt` tag is the home zone and which
  // the shipped table leaves with a single abbreviation nobody types. This is the
  // one row where the tag changes what the file contains rather than only how a
  // number is punctuated.
  test("the home zone gets the words a Brazilian actually types", () => {
    expect(ZONES["America/Sao_Paulo"]?.aliases).toEqual(["brt"]);
    for (const word of ["brasil", "brasília", "brasilia", "sampa"]) {
      expect(datetimePt.units["America/Sao_Paulo"]?.aliases, word).toContain(word);
    }
    expect(engine.evaluate("15:00 em brasília").value?.unit).toBe("America/Sao_Paulo");
    expect(engine.evaluate("15:00 em sampa").value?.unit).toBe("America/Sao_Paulo");
  });

  // The accent is a different string to the alias index — NFKC folding leaves a
  // precomposed á as á rather than stripping it — so a Portuguese name that
  // carries one is unreachable from a keyboard without accents unless the bare
  // spelling is declared beside it. The tilde is the sharper case: no neighbouring
  // layout has it at all, so "japao" is what a user without a Portuguese keyboard
  // will type for "Japão".
  test("an accented name declares its accent-free spelling too", () => {
    for (const [accented, bare] of [
      ["tóquio", "toquio"],
      ["japão", "japao"],
      ["índia", "india"],
      ["zelândia", "zelandia"],
      ["ucrânia", "ucrania"],
    ] as const) {
      const zone = added.find(([, a]) => a === accented)?.[0];
      expect(zone, accented).toBeDefined();
      expect(datetimePt.units[zone ?? ""]?.aliases, bare).toContain(bare);
    }
    expect(engine.evaluate("15:00 em japao").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 em zelandia").value?.unit).toBe("Pacific/Auckland");
  });

  test("no Portuguese word is claimed by two zones", () => {
    const owner = new Map<string, string>();
    for (const [zone, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two zones`).toBeUndefined();
      owner.set(alias, zone);
    }
  });

  test("every word it adds resolves back to its own zone", () => {
    // Through the engine rather than against the table, because that is the route
    // a user takes: "em" is the Portuguese `in` keyword, the zone is the right
    // operand of a conversion, and a word that only reaches its unit via the
    // language's penalised suffix stripper still counts — a penalised reading is a
    // reading, and the solver ranks it against the alternatives.
    for (const [zone, alias] of added) {
      expect(engine.evaluate(`15:00 em ${alias}`).value?.unit, alias).toBe(zone);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [datetime], contractOptions)).not.toThrow();
    // The default counts are all integers, so a fractional count is never reached
    // at all. One is added for the same reason every other `pt` vocabulary adds one
    // — and in Portuguese it is the count that selects the *singular* row, the
    // opposite of English — except that a zone is never counted, so here it can
    // only confirm that no unit has a `forms` table for the sweep to index. That is
    // the honest shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [datetime], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("no unit declares forms, and selectForm still answers", () => {
    for (const [zone, words] of Object.entries(datetimePt.units)) {
      expect(words.forms, `${zone} declares forms`).toBeUndefined();
    }
    // A `forms` table exists so a *count* can pick a word, and there is no such
    // thing as two Tóquios. `portuguese.selectForm` knows nothing about which
    // units have tables, so it keeps answering — which is what makes the absence
    // above a decision about this kind rather than a property of the language.
    const key = (count: number | undefined) =>
      portuguese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "datetime",
        unit: "Asia/Tokyo",
        slot: "conversion-target",
      });
    expect(key(1)).toBe("one");
    // The Portuguese rows an English-speaking reader gets wrong: a fraction is
    // singular, a million is the folded `many`, and no count at all is `other`.
    expect(key(1.5)).toBe("one");
    expect(key(1_000_000)).toBe("other");
    expect(key(undefined)).toBe("other");
  });

  test("an engine built from it reads Portuguese zone words", () => {
    // The clock is written 24-hour because "3pm" is an English spelling of a time
    // and this engine has no English in it at all.
    expect(engine.evaluate("15:00 em tóquio").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 em Japão").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 em Greenwich").formatted).toBe("2026-01-15 15:00 UTC");
    expect(engine.evaluate("15:00 em Londres").formatted).toBe("2026-01-15 15:00 London");
    // The country, which is how a person names a zone they do not live in.
    expect(engine.evaluate("15:00 em Alemanha").value?.unit).toBe("Europe/Berlin");
    expect(engine.evaluate("15:00 em Ucrânia").value?.unit).toBe("Europe/Kyiv");
    // The two exonyms sharing one zone, neither reachable from the English form.
    expect(engine.evaluate("15:00 em xangai").value?.unit).toBe("Asia/Shanghai");
    expect(engine.evaluate("15:00 em pequim").value?.unit).toBe("Asia/Shanghai");
    // The one word of a multi-token name that can be looked up at all: "Nova
    // Zelândia" and "Los Angeles" are two tokens, and core's alias index is keyed
    // by one segmented word.
    expect(engine.evaluate("15:00 em zelândia").value?.unit).toBe("Pacific/Auckland");
    expect(engine.evaluate("15:00 em angeles").value?.unit).toBe("America/Los_Angeles");
  });

  test("the Latin aliases still read in a Portuguese engine", () => {
    // Recognition is many-to-one and generation is one (design decision I6): the
    // format locale decides what comes back, never what may be typed.
    expect(engine.evaluate("15:00 em tokyo").formatted).toBe("2026-01-16 00:00 JST");
    expect(engine.evaluate("15:00 em utc").formatted).toBe("2026-01-15 15:00 UTC");
  });

  // Portuguese spells `in` two ways and both are ordinary before a zone: "15:00 em
  // Tóquio" and "15:00 para Tóquio". Which of them survives the chrono bridge is
  // decided upstream of every vocabulary, and is recorded here as a live assertion
  // rather than left to be rediscovered.
  //
  // `chrono-bridge.ts` cuts the string it offers chrono at the first operator, and
  // its `OPERATOR_TAIL` names the English `to`/`as`/`in` — its own doc comment says
  // so, and says that widening `MatchCtx` to carry the locale's keywords is the
  // real fix. Portuguese is luckier than Spanish here: "para" is four letters and
  // is not a fragment of any English time spelling, where Spanish's one-letter "a"
  // was read by chrono as the meridiem marker of "a.m." and took the whole match
  // down with it.
  test("both `in` keywords reach a zone, where Spanish loses one of them", () => {
    expect(engine.evaluate("15:00 em tóquio").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("15:00 para tóquio").value?.unit).toBe("Asia/Tokyo");
    expect(engine.evaluate("2026-03-01 para tóquio").formatted).toBe(
      "2026-03-01 09:00 JST",
    );
  });

  test("offset zones stay reachable only through their own parser", () => {
    // Unchanged by translation, and the assertion is here to keep it that way: an
    // offset is not a word, so there is nothing to translate.
    expect(datetimePt.units["+03:00"]?.aliases).toEqual([]);
    expect(engine.evaluate("15:00 em gmt+3").formatted).toBe(
      "2026-01-15 18:00 UTC+03:00",
    );
  });

  // This kind has no count, so there is no "sum that lands on a fraction" to assert
  // and no plural boundary for the output to move across — the end-to-end shape it
  // has instead is a conversion, which the blocks above cover twice over. What it
  // does have, and what every other `pt` vocabulary can close, is a round trip;
  // this one cannot, in Portuguese or in English.
  test("round-trips the words it adds, and records that its output cannot", () => {
    for (const word of ["tóquio", "Japão", "Londres", "moscou", "brasília"]) {
      const first = engine.evaluate(`15:00 em ${word}`);
      const again = engine.evaluate(`15:00 em ${word}`);
      expect(again.value?.canonical.toString(), word).toBe(
        first.value?.canonical.toString(),
      );
    }
    // The formatted string is a date, a clock and `zoneSymbol(zone)` with no
    // keyword between them, and the grammar has no production for that — the
    // `skipPrintable` list above names the six zones whose symbol is not even an
    // alias, but even "JST", which is one, cannot be read at the end of a date.
    // `en` throws on its own output identically, so this is the kind's shape and
    // not a gap in this translation.
    const printed = engine.evaluate("15:00 em tóquio").formatted;
    expect(printed).toBe("2026-01-16 00:00 JST");
    expect(() => engine.evaluate(printed)).toThrow();
    // The half that does read back is the instant without the zone label, which is
    // the string `datetime`'s own literal matcher claims.
    expect(engine.evaluate("2026-01-16 00:00").formatted).toBe("2026-01-16 00:00 UTC");
  });
});
