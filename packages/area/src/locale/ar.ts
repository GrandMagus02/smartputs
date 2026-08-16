import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

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
 * Arabic words for the area units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * Arabic is the hardest language shipped here, and this file meets all three of
 * the reasons.
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on ONE axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Ukrainian has eight on two axes.
 * Taking هكتار through all six:
 *
 * ```
 * zero   0            هكتار        genitive singular
 * one    1            هكتار        nominative singular
 * two    2            هكتاران      the DUAL — a suffix on the noun, not a
 *                                  separate word, and a category no other
 *                                  language shipped here has
 * few    3-10         هكتارات      plural
 * many   11-99        هكتارًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    هكتار        genitive singular
 *        fractions
 * ```
 *
 * `many` is not a plural — "١١ هكتارًا" is a singular noun in the accusative —
 * and `other`, where every fraction and every count-free conversion target lands
 * (ruling R5), is the genitive **singular**: "1.5 هكتار", never "1.5 هكتارات".
 * `zero`, `one` and `other` share one string, because the three differ only in a
 * final short vowel Arabic does not write; repeating it is correct.
 *
 * **2. The digits stay Latin.** `@smartput/core/locale/ar` pins `numberFormat:
 * { group: ",", decimal: "." }` — the `latn` numbering system, transcribed
 * rather than read from `Intl`, because the engine can only *emit* Latin digits
 * and pairing them with Arabic-Indic separators would produce `1٬234٫5`, a
 * hybrid nobody writes. That matters here more than in most kinds: an area
 * conversion groups almost immediately (a hectare is 10,000 m²), and "," is a
 * separator `lex` can read back where Ukrainian's U+00A0 is not.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 هكتاران" holds the number first and the noun second
 * exactly as "2 hectares" does, and the Unicode Bidirectional Algorithm is what
 * puts the number on the right at display time. **Nothing here is reversed and
 * nothing here should be** — swapping the parts would emit the noun before the
 * number in memory, which `parse` reads as a unit followed by a number, and
 * `parse(format(v)) === v` breaks. The superscript symbols below are the same
 * kind of trap seen from the other side: `م²` is م then ², in that order, and it
 * only *looks* mirrored.
 *
 * **`م²`, `سم²` and `كم²` carry no `forms`, exactly as `en` and `uk` carry
 * none.** The reason is the same in all three languages: "متر مربع" is two
 * words, `lex` ends a word token at the space, and the printer's spelled path
 * only ever emits something the parser can read back — so a form here would hand
 * completion text that fails to evaluate. They render through their symbol
 * instead, which `arabic.renderQuantity` sets off from the number with a space
 * (`3 م²`) rather than tight against it, because an Arabic symbol is letters and
 * a digit run glued to letters is a boundary the bidi algorithm has to guess.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in an Arabic engine and
 * the micro path (`parseArea`) cannot drift from it.
 *
 * Like `en`, this file names `area` by id string and never imports the kind,
 * which is what lets `@smartput/area/locale/ar` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "area",
  units: {
    // Arabic writes the squared units with Arabic stems and the same `²`, and
    // the digit-2 spellings are what a keyboard without a superscript produces.
    // Both are listed, and both have to be: `normalize()` runs NFKC, which folds
    // ² to a plain 2 before the lexer ever sees it, while `assertLocaleContract`
    // looks the *symbol* up in the alias index unfolded. One spelling would fail
    // one of the two paths.
    m2: { aliases: [...alias("m2"), "م2", "م²"], symbol: "م²" },
    cm2: { aliases: [...alias("cm2"), "سم2", "سم²"], symbol: "سم²" },
    km2: { aliases: [...alias("km2"), "كم2", "كم²"], symbol: "كم²" },
    // No Arabic abbreviation for the hectare has any currency — it is written
    // out, on a deed as in a newspaper — so the symbol is the nominative
    // singular, the same choice `en` makes for `acre`. R8 wants an explicit
    // symbol on every unit, not an invented one.
    hectare: {
      aliases: [
        ...alias("hectare"),
        "هكتار",
        "هكتاران",
        "هكتارات",
        `هكتار${AN}`,
        "هكتارا",
      ],
      symbol: "هكتار",
      forms: {
        zero: "هكتار",
        one: "هكتار",
        two: "هكتاران",
        few: "هكتارات",
        many: `هكتار${AN}`,
        other: "هكتار",
      },
    },
    // أكر is the transliteration of the acre and the name this unit is filed
    // under in Arabic reference works. فدان is deliberately NOT listed: it is a
    // real Arabic land measure of its own — the Egyptian feddan, 4,200.83 m²
    // against the acre's 4,046.86 — so claiming it here would silently answer a
    // different question by about four per cent. The same reasoning keeps أوقية
    // out of `@smartput/mass/locale/ar`.
    //
    // Both hamza spellings are listed: `arabic`'s orthographic fold deletes a
    // hamza the user typed and can never invent one they did not, so a
    // plain-alif typist reaches nothing unless اكر is here beside أكر.
    acre: {
      aliases: [
        ...alias("acre"),
        "أكر",
        "اكر",
        "أكران",
        "اكران",
        "أكرات",
        "اكرات",
        `أكر${AN}`,
        "أكرا",
        "اكرا",
      ],
      symbol: "أكر",
      forms: {
        zero: "أكر",
        one: "أكر",
        two: "أكران",
        few: "أكرات",
        many: `أكر${AN}`,
        other: "أكر",
      },
    },
  },
});
