import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Ukrainian words for the datarate units.
 *
 * Named beside `en.ts` and shaped exactly like it, down to naming `datarate` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes.
 *
 * **No `forms` on any unit**, the same ruling `en.ts` records and for a reason
 * Ukrainian makes even sharper. A written-out Ukrainian rate is
 * "мегабіт на секунду" — three words — or "Мбіт/с", which contains an operator
 * character. Neither can lex back as one unit token (`parse/lex.ts`: a unit word
 * is letters plus trailing digits), so a `forms` table here would be eight keys
 * of prose that no input could ever reach. Absent forms keep the renderer on the
 * symbol, so a Ukrainian datarate prints "100Мбіт/с" — the same tight shape
 * English prints "100mbps" through.
 *
 * **Symbols.** Ukrainian writes these itself rather than borrowing the Latin
 * abbreviation: "біт/с", "кбіт/с", "Мбіт/с", "Гбіт/с", "Тбіт/с". The prefix
 * casing is SI's, not decoration — kilo is lowercase ("кбіт/с", as "кг" and
 * "км" are), mega and up are capital ("Мбіт/с", "Гбіт/с", "Тбіт/с"). The
 * uppercase "Кбіт/с" seen in consumer software is the exception, not the rule
 * this file follows.
 *
 * **Aliases.** The Latin set is reused from `units.ts` rather than retyped —
 * a Ukrainian speaker types "100 mbps" as readily as "100 Мбіт" — and the
 * Cyrillic spellings are appended to it. They are slash-free by necessity
 * (see above) and inflected on purpose: the vocabulary is what the analyzer
 * falls back *from*, not a stem list, so the genitive plural a reader actually
 * types after a numeral ("5 мегабітів") is listed rather than left to the
 * language's suffix stripper. The bare prefix forms ("мбіт", "мегабіт") name a
 * count of megabits in strict Ukrainian and a rate only by the same elision
 * that lets English "mbps" mean megabits per second; `datasize` declares no bit
 * units at all in this repo, so nothing else claims those words.
 *
 * One thing this file cannot fix, recorded because it looks like a vocabulary
 * bug and is not: `engine.evaluate(engine.evaluate(x).formatted)` does not
 * survive a round trip in Ukrainian, for two reasons that both live in core.
 * The symbol carries "/", and Ukrainian groups thousands with U+00A0, which
 * `normalize()`'s NFKC pass folds to a plain space and the whitespace pass then
 * collapses — splitting "2 000" into two numbers. `uk.test.ts` pins both, so the
 * day either is fixed the pin fails and the ordinary round-trip replaces it.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "біт", "біта", "біти", "бітів", "бітах"],
      symbol: "біт/с",
    },
    kbps: {
      aliases: [
        ...alias("kbps"),
        "кбіт",
        "кілобіт",
        "кілобіта",
        "кілобіти",
        "кілобітів",
        "кілобітах",
      ],
      symbol: "кбіт/с",
    },
    mbps: {
      aliases: [
        ...alias("mbps"),
        "мбіт",
        "мегабіт",
        "мегабіта",
        "мегабіти",
        "мегабітів",
        "мегабітах",
      ],
      symbol: "Мбіт/с",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "гбіт",
        "гігабіт",
        "гігабіта",
        "гігабіти",
        "гігабітів",
        "гігабітах",
      ],
      symbol: "Гбіт/с",
    },
    tbps: {
      aliases: [
        ...alias("tbps"),
        "тбіт",
        "терабіт",
        "терабіта",
        "терабіти",
        "терабітів",
        "терабітах",
      ],
      symbol: "Тбіт/с",
    },
  },
});
