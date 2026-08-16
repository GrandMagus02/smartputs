import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Polish words for the tempo units.
 *
 * Shaped exactly like `en.ts` beside it, down to naming `tempo` by **id string**
 * rather than importing the kind: that is what lets this file be imported
 * without linking the ratio table or the reciprocal bridge to `duration`, and it
 * is the seam `composeLocale` closes. `aliases` still derives the Latin set from
 * `units.ts` — a Polish speaker types "120 bpm" as readily as "120 herców" — and
 * the Polish spellings are appended.
 *
 * **`bpm` keeps no `forms`, for the same reason twice over.** `en.ts` refuses
 * them because "beats per minute" is a compound the lexer cannot read back; the
 * Polish phrase is "uderzeń na minutę", three words, and the middle one is this
 * language's `in` keyword. A `forms` table here would be eight keys of prose no
 * input could reach — and the word in the middle of it would arrive as an
 * operator even if the lexer joined the rest. Absent forms keep the renderer on
 * the symbol, so a Polish tempo prints "120 bpm", spaced rather than tight
 * because `polish.renderQuantity` sets a symbol off from its number as PN-EN ISO
 * 80000 asks.
 *
 * **`hz` declares all eight**, where `en.ts` needed two identical ones. This is
 * the whole argument for a language-defined form key in two units' worth of
 * space: English "hertz" is its own plural, so one word covered every count,
 * while Polish needs four numbers in the nominative and a locative on top of
 * them. Three of those rows are worth naming, and each is a place a Slavic
 * neighbour's table would have been wrong:
 *
 *   `nom-few`   "2 herce"   a real nominative **plural**. Russian writes a
 *                           genitive singular in the same cell ("2 герца") and
 *                           Ukrainian a nominative plural ("2 герци"); only the
 *                           Ukrainian one is the same *kind* of cell as this.
 *   `nom-many`  "5 herców"  the genitive plural with its -ów ending **on**.
 *                           Russian and Ukrainian give units named after people
 *                           a zero-ending counting form ("5 герц", "5 герц") and
 *                           Polish has no such rule, so `nom-one` and `nom-many`
 *                           are different words here where they are identical
 *                           there. It also reaches **21**: "dwadzieścia jeden
 *                           herców", where both neighbours agree 21 with the
 *                           singular.
 *   `nom-other` "1,5 herca" the fractional row, a genitive **singular**, and the
 *                           one cell no integer count can reach. CLDR's name for
 *                           the category sounds like a plural, which is why it
 *                           gets written as one.
 *
 * The `loc-*` rows are the locative case, because "w" governs it — "w 5
 * hercach", never "w 5 herców" — and `loc-other` is the count-free conversion
 * target ("120 bpm w hercach"). It is not the same word as `nom-other`: that one
 * is a genitive singular reached only by a fraction, this one a locative plural
 * reached only without a count at all. `loc-one` is "hercu" rather than a
 * softened -e, because `herc` has a soft stem already and takes -u there.
 *
 * **Symbols.** "Hz" is the SI symbol and is what Polish writes; it case-folds
 * onto the derived alias "hz", which is the mechanism by which a `symbols: true`
 * print parses back. `bpm`'s symbol is "bpm", and that choice gave something up.
 * "ud./min" is the abbreviation printed on a Polish metronome and the one a
 * Polish reader expects to see, but it cannot be a symbol here, and the reason
 * is the lexer rather than an opinion about Polish. It carries both a dot and a
 * "/" — the dot ends a word token and the slash lexes as division — so
 * "120 ud./min" reaches the engine as tempo ÷ duration, a signature no kind
 * declares, and the printed tempo throws instead of reading back.
 *
 * `energy` and `datarate` survive that same shape by making the arithmetic true:
 * a kilowatt-hour computes as power × duration. That escape is closed here,
 * because tempo's canonical *is* beats per minute — there is no "beat" kind for
 * "ud" to be a quantity of, and `index.ts` declares only the two reciprocal `in`
 * bridges, no `/` at all. So the division has nothing to compute and the
 * requirement collapses to one line: the symbol must be a single token that is
 * already an alias. "bpm" is what a Polish music forum writes, and it is the
 * only spelling that is both. "ud./min" is absent from this file entirely rather
 * than demoted to an alias, since a dot and a slash are just as unreadable
 * there.
 *
 * The Polish aliases are inflected on purpose — the vocabulary is what the
 * language's suffix stripper falls back *from*, not a stem list, so the genitive
 * plural a reader actually types after a numeral is listed rather than guessed
 * at. Every one of `hz`'s eight `forms` values is in that list, the locative
 * singular "hercu" included: a form the printer can emit is a form the parser
 * must read back at full weight, not one the stripper happens to recover with a
 * `-2` penalty. "ud" and the inflections of "uderzenie" stay alongside "bpm" as
 * a second way in — the numerator of the abbreviation standing for the whole of
 * it, by the same elision that lets `datarate`'s "megabit" be typed for a rate —
 * but only "bpm" also comes back out.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [
        ...alias("bpm"),
        "ud",
        "uderzenie",
        "uderzenia",
        "uderzeń",
        "uderzeniach",
      ],
      symbol: "bpm",
    },
    hz: {
      aliases: [
        ...alias("hz"),
        "herc",
        "herca",
        "hercowi",
        "hercu",
        "hercem",
        "herce",
        "herców",
        "hercom",
        "hercach",
        "hercami",
      ],
      symbol: "Hz",
      forms: {
        "nom-one": "herc",
        "nom-few": "herce",
        "nom-many": "herców",
        "nom-other": "herca",
        "loc-one": "hercu",
        "loc-few": "hercach",
        "loc-many": "hercach",
        "loc-other": "hercach",
      },
    },
  },
});
