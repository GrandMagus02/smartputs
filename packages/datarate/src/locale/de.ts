import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * German words for the datarate units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. Nothing below is regional —
 * "Megabit" is the same word in Vienna and Zurich, and the one thing that does
 * vary between them (Switzerland's apostrophe group separator) is a property of
 * the `Language`, not of this table.
 *
 * Shaped exactly like `en.ts`, `uk.ts` and `es.ts` beside it, down to naming
 * `datarate` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four bridge
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it — a German speaker types
 * "100 mbps" as readily as "100 Megabit" — and the German spellings are appended
 * to it.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * German cannot escape either. German's usual way out of an English compound is
 * to close it up — `Kilowattstunde` is one word where "kilowatt hour" is two,
 * and `@smartput/energy/locale/de` takes exactly that route — but there is no
 * closed compound for a rate. What German writes is "Megabit pro Sekunde", three
 * words, and `parse/lex.ts` builds a unit word out of letters plus trailing
 * digits, so a space ends the token regardless. A `forms` table here would be
 * four keys of prose no input could reach. Absent forms keep the renderer on the
 * symbol.
 *
 * **What the symbol may not be.** The typographically correct German symbols are
 * "bit/s", "kbit/s", "Mbit/s", "Gbit/s" and "Tbit/s", and none of them can be
 * used: "/" lexes as division, so "100 Mbit/s" would reach the resolver as
 * `datarate ÷ duration` — a signature no kind declares and none should, since
 * dividing a rate by a time is not a rate. The escape `energy` sometimes has
 * (making the arithmetic true, as "kWh" does through `* | power | duration`) is
 * closed here for a reason that is a fact about `datasize`: its canonical is the
 * **byte** and this kind's numerator is the bit, off by the factor of 8 that
 * `index.ts` writes out explicitly.
 *
 * So the "/s" is elided, exactly as `uk.ts` elides it — "bit", "kbit", "Mbit",
 * "Gbit", "Tbit" — and that elision is one a German speaker already makes
 * ("ich habe hundert Megabit"). The loss is real and worth naming: "100 Mbit"
 * states a count of megabits where "100 Mbit/s" states a rate. What it buys is
 * that every string this vocabulary can print is a string it can read.
 *
 * Prefix casing is SI's rather than English's flat lowercase — kilo lowercase,
 * mega and up capital — because that is how German writes prefixes and because
 * the alias index folds case before lookup, so "Mbit" and the listed "mbit" are
 * one key and the symbol reads back by construction.
 *
 * **Aliases.** The German nouns are listed in both numbers. `Bit` is a neuter
 * loanword and behaves as a measure noun after a numeral, so the form a German
 * actually writes is the invariant "100 Megabit"; "Megabits" is listed beside it
 * because it is written too and recognition is many-to-one (I6) while generation
 * stays the single symbol above. The prefixed abbreviations `kbit`/`Mbit`/… are
 * listed in their own right rather than left to the language's
 * `compoundSplitter`: that helper offers `bit` out of `Megabit` at its −3
 * penalty, which is the *base* unit and off by a million, so the exact alias
 * that outranks it has to exist.
 */
export default defineVocabulary({
  locale: "de",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bits"],
      symbol: "bit",
    },
    kbps: {
      aliases: [...alias("kbps"), "kbit", "kbits", "kilobit", "kilobits"],
      symbol: "kbit",
    },
    mbps: {
      // "Mega" alone is the colloquial German noun for a megabit per second —
      // "hundert Mega" is how a connection is spoken about — and it is listed in
      // both numbers for the same many-to-one reason the nouns above are.
      aliases: [
        ...alias("mbps"),
        "mbit",
        "mbits",
        "megabit",
        "megabits",
        "mega",
        "megas",
      ],
      symbol: "Mbit",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "gbit",
        "gbits",
        "gigabit",
        "gigabits",
        "giga",
        "gigas",
      ],
      symbol: "Gbit",
    },
    tbps: {
      aliases: [...alias("tbps"), "tbit", "tbits", "terabit", "terabits"],
      symbol: "Tbit",
    },
  },
});
