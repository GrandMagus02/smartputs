import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) on the
 * final consonant, then the alif (U+0627) that carries it, in that codepoint
 * order. Written the way `@smartput/core/locale/ar` writes the same two
 * characters in its suffix stripper — U+064B renders *on top of* the letter
 * before it, so a literal is a smudge one careless retype away from vanishing,
 * and if it vanished the `many` row would silently become the `one` row.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — and the one thing that differs is the only thing allowed to: how
 * many keys a table has, and what each of them is.
 *
 * Arabic is the hardest language shipped here, for three reasons, and an angle
 * is a good place to meet all three.
 *
 * **1. Six keys, one of which is a DUAL.** `arabic.selectForm` returns exactly
 * the six CLDR categories on ONE axis — `zero`, `one`, `two`, `few`, `many`,
 * `other`. English needs two because `Intl.PluralRules("en")` has two categories;
 * Ukrainian needs eight because it composes a case with a category. Arabic needs
 * six on one axis, and the `two` row is a form of the noun no other language
 * here has: درجتان means precisely two degrees, built by a suffix rather than by
 * a separate word. Taking درجة through all six:
 *
 * ```
 * zero   0            درجة        genitive singular
 * one    1            درجة        nominative singular
 * two    2            درجتان      the DUAL — and on a ة noun it *replaces* the
 *                                 ة rather than appending, which no ending rule
 *                                 in the analyzer chain can undo
 * few    3-10         درجات       plural
 * many   11-99        درجة        accusative SINGULAR (tamyīz). On a ة noun the
 *                                 tanwīn is a bare mark ordinary prose leaves
 *                                 off, so this row is spelled like the singular
 * other  100+, all    درجة        genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ راديانًا" is a singular noun in the accusative,
 * which is why the masculine units below spell it with `AN`'s alif and درجة does
 * not spell it at all. And `other` — where every fraction lands, and where a
 * count-free conversion target lands (ruling R5) — is the genitive **singular**,
 * so "1.5 درجة" and never "1.5 درجات". That is the opposite of French, where a
 * bare conversion target is plural.
 *
 * `zero`, `one` and `other` hold the same string on every unit here, and on the
 * two ة nouns `many` joins them. That is correct, not a half-finished table: the
 * rows differ in case endings that are short vowels, and Arabic does not write
 * short vowels.
 *
 * **2. The digits stay Latin.** `@smartput/core/locale/ar` pins `numberFormat:
 * { group: ",", decimal: "." }` — the `latn` numbering system, transcribed
 * rather than read from `Intl`, because the engine can only *emit* Latin digits
 * and pairing them with Arabic-Indic separators would produce `1٬234٫5`, a
 * hybrid nobody writes. `ar.ts` carries the measurement.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 درجتان" holds the number first and the noun second exactly
 * as "2 degrees" does, and the Unicode Bidirectional Algorithm is what puts the
 * number on the right at display time. **Nothing here is reversed and nothing
 * here should be** — swapping the parts would emit the noun before the number in
 * memory, which `parse` reads as a unit followed by a number, and
 * `parse(format(v)) === v` breaks. The degree sign is the same trap seen from
 * the other side: `90°` is the digits then the sign, in that order, whatever a
 * bidi-aware terminal shows.
 *
 * Aliases are the Latin ones from `units.ts` — an Arabic keyboard types "2 rad"
 * as readily as "2 راديان" — with the Arabic spellings appended in every shape a
 * reader might type. Three groups of them are here because `arabic`'s analyzers
 * cannot reach them: the ة-duals (درجتان, دورتان), which replace a letter rather
 * than append one; the hamza spellings, because the orthographic fold deletes a
 * hamza the user typed and can never invent one they did not; and the bare
 * tamyīz spellings without the mark (راديانا), which the stripper does recover
 * but only at `weight: -2`.
 *
 * Like `en`, this file names `angle` by id string and never imports the kind,
 * which is what lets `@smartput/angle/locale/ar` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "angle",
  units: {
    rad: {
      aliases: [
        ...alias("rad"),
        "راد",
        "راديان",
        "راديانان",
        "راديانات",
        `راديان${AN}`,
        "راديانا",
      ],
      symbol: "راد",
      forms: {
        zero: "راديان",
        one: "راديان",
        two: "راديانان",
        few: "راديانات",
        many: `راديان${AN}`,
        other: "راديان",
      },
    },
    // "°" and not a letter abbreviation: Arabic writes "٩٠°" exactly as English
    // writes "90°", and the sign is the only short form an angular degree has.
    // It is listed as an alias too, because `lex` gives "°" a word token of its
    // own and a printed symbol has to read back.
    //
    // درجة is also the word for a temperature degree and for a rank or a step;
    // that is a fact about the Arabic word, not an ambiguity this file can
    // resolve, and the kind is what separates the readings.
    deg: {
      aliases: [...alias("deg"), "°", "درجة", "درجتان", "درجات"],
      symbol: "°",
      forms: {
        zero: "درجة",
        one: "درجة",
        two: "درجتان",
        few: "درجات",
        many: "درجة",
        other: "درجة",
      },
    },
    // غراد is the transliteration and غون the alternative name (the "gon" of
    // `units.ts`), both read; غراد is printed. Masculine and consonant-final, so
    // unlike درجة above it writes the accusative alif and its `many` row is a
    // visibly different string.
    grad: {
      aliases: [
        ...alias("grad"),
        "غراد",
        "جراد",
        "غون",
        "غرادان",
        "غرادات",
        `غراد${AN}`,
        "غرادا",
      ],
      symbol: "غراد",
      forms: {
        zero: "غراد",
        one: "غراد",
        two: "غرادان",
        few: "غرادات",
        many: `غراد${AN}`,
        other: "غراد",
      },
    },
    // The second ة noun, and the second table where four of six rows coincide.
    // لفة is the colloquial word for a turn and is read but not printed: دورة is
    // what a technical text sets (دورة/دقيقة is rpm), and a printer should emit
    // the register a reader expects back.
    turn: {
      aliases: [...alias("turn"), "دورة", "دورتان", "دورات", "لفة", "لفتان", "لفات"],
      symbol: "دورة",
      forms: {
        zero: "دورة",
        one: "دورة",
        two: "دورتان",
        few: "دورات",
        many: "دورة",
        other: "دورة",
      },
    },
  },
});
