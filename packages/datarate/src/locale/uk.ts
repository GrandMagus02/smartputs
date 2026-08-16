import { aliasesFor, defineVocabulary } from "@smartput/kind";
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
 * symbol, so a Ukrainian datarate prints "100Мбіт" — the same tight shape
 * English prints "100mbps" through.
 *
 * **Symbols, and the correctness this file trades away.** The orthographically
 * correct Ukrainian symbols are "біт/с", "кбіт/с", "Мбіт/с", "Гбіт/с",
 * "Тбіт/с", and those are what this file used to emit. They cannot be read
 * back, and the elided forms below are what replaced them:
 *
 *   біт   кбіт   Мбіт   Гбіт   Тбіт
 *
 * The "/с" is gone, and losing it is a real loss: "100Мбіт" states a count of
 * megabits where "100Мбіт/с" states a rate, and only the colloquial elision a
 * Ukrainian speaker already makes ("у мене сто мегабіт") recovers the missing
 * per-second. What it buys is that every string this vocabulary can print is a
 * string it can read — the property `assertLocaleContract` does not check,
 * because it checks that every *alias* resolves and never that every *emitted
 * form* does.
 *
 * Why the compound cannot be rescued the way English rescues "m/s". English
 * `speed:mps` prints "1m/s" and re-reads it not because "m/s" is an alias — it
 * is not — but because "/" lexes as an operator and `length ÷ duration` has a
 * registered signature that computes a speed. Ukrainian `energy:kwh` prints
 * "кВт·год" and re-reads it the same way, through `* | power | duration`.
 * "Мбіт/с" has no such route, and the reason is a fact about `datasize`: its
 * canonical unit is the **byte** (`units.ts` ratio `b: "1"`, aliases "byte",
 * "bytes"), and it declares no bit unit at all. So the bare bit-words cannot be
 * handed to `datasize` the way this repo's own division bridge would need —
 * "1 біт" registered against `datasize` would mean one *byte*, wrong by the
 * factor of 8 that `index.ts`'s bridges write out explicitly. Left where they
 * belong, on this kind, "Мбіт/с" lexes as `datarate ÷ duration`, a signature
 * that does not exist and should not: dividing a rate by a time is not a rate.
 *
 * The road not taken was adding "Мбіт/с" to the alias list. It would look like
 * a fix and be dead weight: "/" is always an operator (`parse/lex.ts`), so no
 * alias containing one can ever be lexed as a single token.
 *
 * Prefix casing is still SI's, not decoration — kilo is lowercase ("кбіт", as
 * "кг" and "км" are), mega and up are capital ("Мбіт", "Гбіт", "Тбіт"). The
 * uppercase "Кбіт" seen in consumer software is the exception, not the rule
 * this file follows.
 *
 * **Aliases.** The Latin set is reused from `units.ts` rather than retyped —
 * a Ukrainian speaker types "100 mbps" as readily as "100 Мбіт" — and the
 * Cyrillic spellings are appended to it. They are slash-free by necessity
 * (see above) and inflected on purpose: the vocabulary is what the analyzer
 * falls back *from*, not a stem list, so the genitive plural a reader actually
 * types after a numeral ("5 мегабітів") is listed rather than left to the
 * language's suffix stripper. Every symbol above is drawn from this list rather
 * than invented beside it — that is the whole mechanism by which the printed
 * output parses, and `uk.test.ts` asserts it unit by unit.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "біт", "біта", "біти", "бітів", "бітах"],
      symbol: "біт",
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
      symbol: "кбіт",
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
      symbol: "Мбіт",
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
      symbol: "Гбіт",
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
      symbol: "Тбіт",
    },
  },
});
