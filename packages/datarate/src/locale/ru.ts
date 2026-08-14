import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Russian words for the datarate units.
 *
 * Named beside `en.ts` and shaped exactly like it, down to naming `datarate` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes.
 *
 * **No `forms` on any unit**, the same ruling `en.ts` records and the same one
 * `uk.ts` restates. A written-out Russian rate is "мегабит в секунду" — three
 * words — or "Мбит/с", which carries an operator character. `parse/lex.ts`
 * builds a unit word out of letters plus trailing digits, so a space ends the
 * token and "/" ends it too; neither shape can lex back as one unit, and a
 * `forms` table here would be eight keys of prose no input could ever reach.
 * Absent forms keep the renderer on the symbol, so a Russian datarate prints
 * "100Мбит" — the same tight shape English prints "100mbps" through.
 *
 * That absence is why this file has no case axis to speak of even though
 * `russian.selectForm` offers one. It is the right answer rather than a
 * shortfall: the eight-key table exists for units Russian *writes out*, and
 * this kind has none.
 *
 * **Symbols, and the correctness this file trades away.** The orthographically
 * correct Russian symbols are "бит/с", "кбит/с", "Мбит/с", "Гбит/с", "Тбит/с".
 * They cannot be read back — "/" is always division (`parse/lex.ts`), so
 * "100Мбит/с" reaches the resolver as `datarate ÷ duration`, a signature no kind
 * declares and none should, since dividing a rate by a time is not a rate. The
 * elided forms below are what ship instead:
 *
 *   бит   кбит   Мбит   Гбит   Тбит
 *
 * Losing the "/с" is a real loss — "100Мбит" states a count of megabits where
 * "100Мбит/с" states a rate — and what it buys is that every string this
 * vocabulary can print is a string it can read. The colloquial elision a Russian
 * speaker already makes ("у меня сто мегабит") is what recovers the missing
 * per-second, exactly as it does in Ukrainian next door.
 *
 * The road not taken was listing "Мбит/с" as an alias as well. It would look
 * like a fix and be dead weight: no alias containing an operator character can
 * ever be lexed as a single token, however many times it is written down.
 *
 * Prefix casing is SI's and not decoration — kilo is lowercase ("кбит", as "кг"
 * and "км" are), mega and up are capital ("Мбит", "Гбит", "Тбит"). The
 * uppercase "Кбит" seen in consumer software is the exception, not the rule this
 * file follows.
 *
 * **Aliases.** The Latin set is reused from `units.ts` through `aliasesFor`
 * rather than retyped — a Russian speaker types "100 mbps" as readily as
 * "100 Мбит", and deriving them keeps the micro path (`parseDatarate`) and the
 * engine path agreeing by construction — and the Cyrillic spellings are appended
 * to it. They are slash-free by necessity and inflected on purpose: a vocabulary
 * is what the language's suffix stripper falls back *from*, not a stem list, so
 * the forms a reader actually types after a numeral are listed rather than left
 * to a penalised guess.
 *
 * The inflections are the masculine hard-stem paradigm, and the genitive plural
 * is the one row worth naming. "бит" is a measure noun, so its counting form
 * (счётная форма) after a numeral is the bare stem — "5 мегабит", not
 * "5 мегабитов" — the same rule that gives "5 ватт" and "5 герц". Both are
 * listed anyway, because recognition is many-to-one and "битов" is what a reader
 * who has not read Rosenthal will type; nothing here prints either, since the
 * kind declares no forms at all.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "бит", "бита", "биты", "битов", "битах"],
      symbol: "бит",
    },
    kbps: {
      aliases: [
        ...alias("kbps"),
        "кбит",
        "килобит",
        "килобита",
        "килобиты",
        "килобитов",
        "килобитах",
      ],
      symbol: "кбит",
    },
    mbps: {
      aliases: [
        ...alias("mbps"),
        "мбит",
        "мегабит",
        "мегабита",
        "мегабиты",
        "мегабитов",
        "мегабитах",
      ],
      symbol: "Мбит",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "гбит",
        "гигабит",
        "гигабита",
        "гигабиты",
        "гигабитов",
        "гигабитах",
      ],
      symbol: "Гбит",
    },
    tbps: {
      aliases: [
        ...alias("tbps"),
        "тбит",
        "терабит",
        "терабита",
        "терабиты",
        "терабитов",
        "терабитах",
      ],
      symbol: "Тбит",
    },
  },
});
