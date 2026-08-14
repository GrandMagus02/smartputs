import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Polish words for the datarate units.
 *
 * Named beside `en.ts` and shaped exactly like it, down to naming `datarate` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and `ru.ts`
 * and `de.ts` restate. A written-out Polish rate is "megabitów na sekundę" —
 * three words, and the middle one is a keyword this language claims for `in` —
 * or "Mb/s", which carries an operator character. `parse/lex.ts` builds a unit
 * word out of letters plus trailing digits, so a space ends the token and "/"
 * ends it too; neither shape can lex back as one unit, and a `forms` table here
 * would be eight keys of prose no input could ever reach.
 *
 * That absence is why this file has no case axis at all even though
 * `polish.selectForm` offers one. It is the right answer rather than a
 * shortfall: the eight-key table exists for units Polish *writes out*, and this
 * kind has none. What the absence costs is smaller in Polish than in Russian,
 * because `polish.renderQuantity` sets a symbol off from the number with a
 * space (PN-EN ISO 80000) rather than tight against it — so a Polish datarate
 * prints "100 Mbit" where the Russian one prints "100Мбит".
 *
 * **Symbols, and the correctness this file trades away.** The typographically
 * correct Polish symbols are "b/s", "kb/s", "Mb/s", "Gb/s", "Tb/s" — or, spelled
 * with the unit name rather than its initial, "bit/s" and "Mbit/s". None of them
 * can be read back: "/" is always division (`parse/lex.ts`), so "100 Mbit/s"
 * reaches the resolver as `datarate ÷ duration`, a signature no kind declares
 * and none should, since dividing a rate by a time is not a rate. The elided
 * forms below are what ship instead:
 *
 *   bit   kbit   Mbit   Gbit   Tbit
 *
 * Losing the "/s" is a real loss — "100 Mbit" states a count of megabits where
 * "100 Mbit/s" states a rate — and what it buys is that every string this
 * vocabulary can print is a string it can read. The colloquial elision a Polish
 * speaker already makes ("mam sto megabitów", "mam sto mega") is what recovers
 * the missing per-second, exactly as it does in German and Russian next door.
 *
 * The road not taken was listing "Mbit/s" as an alias as well. It would look
 * like a fix and be dead weight: no alias containing an operator character can
 * ever be lexed as a single token, however many times it is written down.
 *
 * The bit-based spellings are also what keeps this kind out of
 * `@smartput/datasize`'s way. "kB"/"MB" are byte symbols and that package's
 * Polish vocabulary claims them; the alias index is one flat map with no kind in
 * the key, so a "Mb"/"MB" pair here would fold to one entry and hand "100 MB"
 * two readings in the `@smartput/kinds` barrel. Writing the unit name out —
 * "Mbit" — is both the commoner Polish spelling and the one that cannot collide.
 *
 * Prefix casing is SI's and not decoration: kilo is lowercase ("kbit", as "kg"
 * and "km" are), mega and up are capital ("Mbit", "Gbit", "Tbit"). The uppercase
 * "Kbit" seen in consumer software is the exception, not the rule this file
 * follows.
 *
 * **Aliases.** The Latin set is reused from `units.ts` through `aliasesFor`
 * rather than retyped — a Polish speaker types "100 mbps" as readily as
 * "100 megabitów", and deriving them keeps the micro path (`parseDatarate`) and
 * the engine path agreeing by construction — and the Polish spellings are
 * appended to it. They are slash-free by necessity and inflected on purpose: a
 * vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, so the forms a reader actually types after a numeral are listed
 * rather than left to a penalised guess.
 *
 * The inflections are the ordinary masculine hard-stem paradigm, and the one row
 * worth naming is the genitive plural. Polish takes the full **-ów** ending
 * there — "5 bitów", "100 megabitów" — where Russian's measure nouns take a bare
 * counting form ("5 мегабит"). A Polish table ported from `ru.ts` by
 * transliteration would drop that ending and print a word Polish does not have.
 * Nothing here prints either, since the kind declares no forms at all, but the
 * ending is what a reader types and so it is what the aliases carry.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bita", "bity", "bitów", "bitach", "bitami"],
      symbol: "bit",
    },
    kbps: {
      aliases: [
        ...alias("kbps"),
        "kbit",
        "kilobit",
        "kilobita",
        "kilobity",
        "kilobitów",
        "kilobitach",
      ],
      symbol: "kbit",
    },
    mbps: {
      // "mega" alone is the colloquial Polish noun for a megabit per second —
      // "mam sto mega" is how a connection is spoken about — and it is listed
      // for the same many-to-one reason the inflections are. It is read-only:
      // generation stays on the symbol, because there is no `forms` table for a
      // colloquialism to be selected out of.
      aliases: [
        ...alias("mbps"),
        "mbit",
        "megabit",
        "megabita",
        "megabity",
        "megabitów",
        "megabitach",
        "mega",
      ],
      symbol: "Mbit",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "gbit",
        "gigabit",
        "gigabita",
        "gigabity",
        "gigabitów",
        "gigabitach",
        "giga",
      ],
      symbol: "Gbit",
    },
    tbps: {
      aliases: [
        ...alias("tbps"),
        "tbit",
        "terabit",
        "terabita",
        "terabity",
        "terabitów",
        "terabitach",
      ],
      symbol: "Tbit",
    },
  },
});
