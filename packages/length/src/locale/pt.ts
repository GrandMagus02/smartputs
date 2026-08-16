import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `es` and `de` next door make, kept here for
 * `es`'s reason rather than `de`'s.
 *
 * Portuguese's own conversion keywords are `em` and `para`
 * (`@smartput/core/locale/pt`), so nothing about a Portuguese lexer would shadow
 * an `in` alias — it would be perfectly reachable in a pt-only engine. It stays
 * out anyway, because `registry.aliasIndex` is one flat map that
 * `MatchCtx.isUnitAlias` reads without consulting a locale: a Portuguese
 * vocabulary registering `in` would put it back in front of
 * `@smartput/datetime`'s accept-gate for any engine speaking both languages, and
 * "in 3 days" would read as an all-units phrase again. A Portuguese reader types
 * `polegada`, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Portuguese words for the length units — Brazilian under the bare `pt` tag,
 * which is this project's ruling and also what the platform does
 * (`Intl.NumberFormat("pt")` resolves to "." for groups and "," for the
 * decimal). Same eight units `en`, `uk`, `es` and `de` name, and the same answer
 * to "does this unit have words at all?": all eight do. Portuguese writes a
 * length out as readily as English does.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category, and folds CLDR's third Portuguese category — `many`, for the
 * whole multiples of a million — into `other`, because `many` is a fact about
 * the *numeral* ("1 milhão") rather than about the noun after it. Portuguese
 * inflects a unit noun for number and for nothing else: it has no case, so a
 * conversion target ("em metros") is spelled exactly like a bare quantity and
 * the slot axis German needs for its dative selects nothing here (rule 6).
 * Gender is real and splits this kind — `o metro`, `o pé`, `o quilômetro` are
 * masculine, `a polegada`, `a jarda`, `a milha` feminine — but it belongs to the
 * *noun*, never to the slot, so it selects nothing and is not a key. What gender
 * would change is the numeral in front ("uma polegada", "duas milhas"), and that
 * is handled one layer up, in `portuguese.renderQuantity` — the only call that
 * sees the spelled numeral and the noun at the same time. `spellPortuguese`
 * itself cannot: it is handed a magnitude and no unit at all, which is why it
 * writes the masculine and says so.
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 metro"), and
 * **1,5 selects `one`** as well — "1,5 metro", the exact opposite of English's
 * "1.5 metres". Both are pinned in `pt.test.ts` beside this file.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Portuguese engine
 * and the micro path (`parseLength`) cannot drift from it. The Portuguese
 * spellings are appended, singular and plural both, because every string this
 * file *prints* has to be a string it reads and a printed plural recovered only
 * by the language's penalised suffix stripper is a reading this vocabulary
 * should not be leaving to a guess.
 *
 * Beside each accented spelling sits its accent-free twin (`quilometro` next to
 * `quilômetro`). That is not redundancy: NFKC folding leaves a precomposed `ô`
 * as `ô` rather than decomposing and stripping it, so the two are different
 * strings to the alias index, and `@smartput/core/locale/pt-cardinals` declares
 * "tres" beside "três" for exactly this reason. The stripper cannot rescue them
 * either — it removes a suffix, and what changes here is a letter in the stem.
 *
 * **The one word Brazil and Portugal spell differently is `km`.** Brazil writes
 * `quilômetro` with a circumflex and Portugal `quilómetro` with an acute; the
 * bare `pt` tag is Brazilian, so the circumflex is what gets *printed* and both
 * are read. Everything else below is one spelling in both standards.
 *
 * Every plural here is the plain `-s` of a vowel-final noun — including `pé` →
 * `pés`, which is the vowel rule applied to a monosyllable and not the `-l` →
 * `-is` rewriting class `portuguese`'s own analyzer carries. That analyzer is
 * why `minStem` is 2 rather than Ukrainian's 3: `pés` leaves a one-character
 * stem under the stripper and is therefore *not* recoverable by it at all, which
 * is precisely why it is written out here.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Portuguese itself writes ("5 km", never "5 quilôm."), and the spelled
 * singular noun on the four imperial ones. Portuguese has no abbreviation of its
 * own for an inch, a foot, a yard or a mile: where a short form appears at all
 * it is the English one, which `units.ts` already registers as an alias, so
 * claiming it as the *Portuguese* symbol would buy nothing and would print
 * `36in` at a reader who wrote `polegadas` — and `in` is not even reachable
 * here, per the reservation above. Ukrainian, Spanish and German make the same
 * call for all four (R8 wants an explicit symbol, never an invented one).
 *
 * Like the others, this file names `length` by **id string** and never imports
 * the kind, which is what lets `@smartput/length/locale/pt` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "milímetro", "milímetros", "milimetro", "milimetros"],
      symbol: "mm",
      forms: { one: "milímetro", other: "milímetros" },
    },
    cm: {
      aliases: [...alias("cm"), "centímetro", "centímetros", "centimetro", "centimetros"],
      symbol: "cm",
      forms: { one: "centímetro", other: "centímetros" },
    },
    // The one metric unit whose Portuguese word carries no accent, so there is
    // no twin to declare: `metro` is stressed on the first syllable and
    // Portuguese writes no diacritic on a paroxytone ending in a vowel.
    m: {
      aliases: [...alias("m"), "metro", "metros"],
      symbol: "m",
      forms: { one: "metro", other: "metros" },
    },
    // Four spellings, three of which exist only to be read: the Brazilian
    // circumflex is printed, the European acute is understood, and the bare
    // `quilometro` is what a keyboard without dead keys produces. `kilômetro`
    // with a `k` is deliberately absent — it is a misspelling rather than a
    // variant, and `units.ts`'s `kilometer`/`kilometre` already catch the reader
    // who reaches for the international form.
    km: {
      aliases: [
        ...alias("km"),
        "quilômetro",
        "quilômetros",
        "quilómetro",
        "quilómetros",
        "quilometro",
        "quilometros",
      ],
      symbol: "km",
      forms: { one: "quilômetro", other: "quilômetros" },
    },
    in: {
      aliases: [...alias("in"), "polegada", "polegadas"],
      symbol: "polegada",
      forms: { one: "polegada", other: "polegadas" },
    },
    // Two characters and an accent: the shortest spelled unit noun in the
    // language, and the reason `portuguese` sets `minStem: 2` on both its
    // analyzers. Even so the plural is listed, because a stem of one character
    // is below that floor and the stripper would refuse it — `pés` is a word no
    // analyzer in this language can reach, only a declared alias can.
    //
    // `pe`/`pes` are the accent-free twins, on the same reasoning as
    // `quilometro` above. They are not Portuguese spellings of anything and are
    // never printed; they are what an unaccented keyboard produces, and one
    // character is short enough that leaving them out would send a reader to the
    // fuzzy matcher for a word they typed correctly in every respect but one.
    ft: {
      aliases: [...alias("ft"), "pé", "pés", "pe", "pes"],
      symbol: "pé",
      forms: { one: "pé", other: "pés" },
    },
    yd: {
      aliases: [...alias("yd"), "jarda", "jardas"],
      symbol: "jarda",
      forms: { one: "jarda", other: "jardas" },
    },
    mi: {
      aliases: [...alias("mi"), "milha", "milhas"],
      symbol: "milha",
      forms: { one: "milha", other: "milhas" },
    },
  },
});
