import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * French words for the datarate units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". Belgian and Swiss French are `fr-BE` and
 * `fr-CH`, `Language`s with ids of their own rather than a flag on a vocabulary,
 * and nothing in this table varies by region anyway: "mégabit" is the same word
 * in Lille, Liège, Lausanne and Laval.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `datarate`
 * by **id string** rather than importing the kind: that is what lets this file
 * be imported without linking the ratio table or the four bridge signatures, and
 * it is the seam `composeLocale` closes. `aliases` derives the Latin set from
 * `units.ts` rather than retyping it — a French speaker types "100 mbps" as
 * readily as "100 mégabits" — and the French spellings are appended to it.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * French states with the same bluntness Spanish does, through the same accident.
 * The written French rate is "mégabits par seconde": three words, and the middle
 * one is already this language's `by` keyword — `french.keywords.by` is `["par"]`,
 * because "multiplié par 5" is how French says the phrasal times. So a `forms`
 * table here would not merely be prose `parse/lex.ts` cannot reach (a unit word
 * is letters plus trailing digits, so the first space ends the token regardless):
 * its second token would be swallowed by `foldWordOps` as an operator. Absent
 * forms keep the renderer on the symbol.
 *
 * What French changes about that outcome is only the spacing, and it comes from
 * the language rather than from here: `french.renderQuantity` sets one space
 * before every label, symbol or word alike, where `defaultRenderQuantity` sets a
 * symbol tight. So this kind prints "100 Mbps" where English prints "100mbps"
 * and Ukrainian "100Мбіт" — the same absent-forms shape, spaced the way a French
 * typographer spaces "20 %" and "12 °C".
 *
 * **Symbols, and the two slashes that cannot be one.** The typographically
 * correct French symbols are "Mbit/s" (the SI-shaped one, which the French
 * standards bodies write) and "Mo/s" for the byte rate; neither is available.
 * "/" lexes as division, so "100 Mbit/s" would reach the resolver as
 * `datarate ÷ duration`, a signature no kind declares and none should — dividing
 * a rate by a time is not a rate. The escape `energy` sometimes has (making the
 * arithmetic true, as "kWh" does through `* | power | duration`) is closed here
 * for the reason `units.ts` writes out: `datasize`'s canonical is the **octet**
 * and this kind's numerator is the bit, off by the factor of 8 that `index.ts`
 * states explicitly. Registering "Mbit/s" as an alias would look like a fix and
 * be dead weight, since no alias containing an operator character can ever be
 * lexed as one token.
 *
 * What French gets instead is "Mbps", the letter run a French ISP prints on a
 * *contrat* and a French forum writes without translating. The casing is SI's
 * rather than English's flat lowercase — kilo lowercase, mega and up capital —
 * because that is how French writes prefixes, and nothing is risked by it: the
 * alias index folds case before lookup, so "Mbps" and the derived alias "mbps"
 * are one key and every symbol below reads back as its own unit by construction.
 *
 * **Aliases.** The French nouns are listed in both numbers rather than left to
 * `french.analyze`'s `suffixStripper`: the stripper is what a vocabulary falls
 * back *from*, not a substitute for one, and a form reachable only through its
 * `-2` penalty reads back by accident. The accented spellings are listed twice,
 * accented and bare, because NFKC leaves a precomposed é as é rather than
 * stripping the diacritic — "megabit" and "mégabit" are different strings, and a
 * French keyboard is not the only keyboard a French speaker uses.
 *
 * **"méga" and "giga" standing alone** are the colloquial French nouns for these
 * rates — "j'ai la fibre, cinq cents méga" is how the number is spoken, and the
 * per-second half is elided exactly as Ukrainian elides it in "у мене сто
 * мегабіт". They are listed because recognition is many-to-one (I6); generation
 * stays on the single symbol above. Only the bit prefixes people actually clip
 * this way get the treatment: nobody says "cinq téra" about a connection.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bits"],
      symbol: "bps",
    },
    kbps: {
      aliases: [...alias("kbps"), "kbit", "kilobit", "kilobits"],
      symbol: "kbps",
    },
    mbps: {
      aliases: [
        ...alias("mbps"),
        "mbit",
        "mégabit",
        "mégabits",
        "megabit",
        "megabits",
        "méga",
        "mégas",
        "mega",
        "megas",
      ],
      symbol: "Mbps",
    },
    gbps: {
      aliases: [...alias("gbps"), "gbit", "gigabit", "gigabits", "giga", "gigas"],
      symbol: "Gbps",
    },
    tbps: {
      // "térabit" carries the accent French gives the prefix (téra-, as in
      // "téraoctet"), and the bare spelling is listed beside it for the same
      // NFKC reason as "mégabit". No clipped form: a connection is never
      // measured in téras.
      aliases: [...alias("tbps"), "tbit", "térabit", "térabits", "terabit", "terabits"],
      symbol: "Tbps",
    },
  },
});
