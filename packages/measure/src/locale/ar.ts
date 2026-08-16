import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

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
 * Arabic words for the typographic units — the same six `en` next door names,
 * with the same answer to "does this unit have words at all?". All six do.
 *
 * Arabic is the hardest language shipped here, and typography happens to carry
 * one paradigm no other package in this set has: a loanword that does not
 * inflect at all (see `pc` below).
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on ONE axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Ukrainian has eight on two axes.
 * Taking بكسل through all six:
 *
 * ```
 * zero   0            بكسل        genitive singular
 * one    1            بكسل        nominative singular
 * two    2            بكسلان      the DUAL — a suffix on the noun, not a
 *                                 separate word, and a category no other
 *                                 language shipped here has
 * few    3-10         بكسلات      plural
 * many   11-99        بكسلًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    بكسل        genitive singular
 *        fractions
 * ```
 *
 * `many` is not a plural — "٩٦ بكسلًا" is a singular noun in the accusative —
 * and `other`, where every fraction and every count-free conversion target lands
 * (ruling R5), is the genitive **singular**. `zero`, `one` and `other` share one
 * string on every unit here, because the three differ only in a final short
 * vowel Arabic does not write; repeating it is correct, not a half-finished
 * table. On the two ة nouns (بوصة, نقطة) `many` joins them, for a reason spelled
 * out on `pt` below.
 *
 * A pixel count is where the `many` row earns its place: 96, the dpi this kind
 * defaults to, is in the 11-99 band, so "١ بوصة" converts to "96 بكسلًا" and a
 * table that had put a plural there would print "96 بكسلات" at every reader.
 *
 * **2. The digits stay Latin.** `@smartput/core/locale/ar` pins `numberFormat:
 * { group: ",", decimal: "." }` — the `latn` numbering system, transcribed
 * rather than read from `Intl`, because the engine can only *emit* Latin digits
 * and pairing them with Arabic-Indic separators would produce `1٬234٫5`, a
 * hybrid nobody writes. `ar.ts` carries the measurement.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 بوصتان" holds the number first and the noun second exactly
 * as "2 inches" does, and the Unicode Bidirectional Algorithm is what puts the
 * number on the right at display time. **Nothing here is reversed and nothing
 * here should be** — swapping the parts would emit the noun before the number in
 * memory, which `parse` reads as a unit followed by a number, and
 * `parse(format(v)) === v` breaks. That applies to the Latin symbols below too:
 * `12 pt` is the digits then the letters, and a bidi-aware terminal showing it
 * otherwise is doing display, not storage.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in an Arabic engine and
 * the micro path (`parseMeasure`) cannot drift from it.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what an Arabic
 * designer writes in a stylesheet, and inventing an Arabic abbreviation would be
 * a word this file made up rather than one anybody types. The metric two get
 * their conventional Arabic abbreviations and the inch gets its noun, the same
 * choice `@smartput/length/locale/ar` makes for the same reason. Every symbol
 * here is also an alias, which is what `assertLocaleContract` checks: a printed
 * string the engine cannot read back is the failure.
 *
 * Like `en`, this file names `measure` by id string and never imports the kind.
 * `composeLocale` is where the two halves meet — and, as there, a caller has to
 * ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS` because
 * its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/ar` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "measure",
  units: {
    // Feminine, ending in tāʾ marbūṭa, and that changes the shape of the table
    // rather than the stem inside it — the same entry `@smartput/length` gives
    // its `in`, because it is the same word for the same unit. The dual replaces
    // the ة (بوصتان), which no suffix strip undoes, and the accusative takes no
    // alif, so `many` is spelled exactly like the singular.
    inch: {
      aliases: [
        ...alias("inch"),
        "بوصة",
        "بوصتان",
        "بوصات",
        "إنش",
        "انش",
        "إنشات",
        "انشات",
      ],
      symbol: "بوصة",
      forms: {
        zero: "بوصة",
        one: "بوصة",
        two: "بوصتان",
        few: "بوصات",
        many: "بوصة",
        other: "بوصة",
      },
    },
    mm: {
      aliases: [
        ...alias("mm"),
        "مم",
        "ملم",
        "مليمتر",
        "ملليمتر",
        "ميليمتر",
        "مليمتران",
        "مليمترات",
        `مليمتر${AN}`,
        "مليمترا",
      ],
      symbol: "مم",
      forms: {
        zero: "مليمتر",
        one: "مليمتر",
        two: "مليمتران",
        few: "مليمترات",
        many: `مليمتر${AN}`,
        other: "مليمتر",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "سم",
        "سنتيمتر",
        "سنتمتر",
        "سنتيمتران",
        "سنتيمترات",
        `سنتيمتر${AN}`,
        "سنتيمترا",
      ],
      symbol: "سم",
      forms: {
        zero: "سنتيمتر",
        one: "سنتيمتر",
        two: "سنتيمتران",
        few: "سنتيمترات",
        many: `سنتيمتر${AN}`,
        other: "سنتيمتر",
      },
    },
    // The second ة noun, and the one whose 3-10 row is a BROKEN plural: نقطة
    // pluralizes to نقاط by re-arranging the stem, not by suffixing it, so no
    // ending rule in the analyzer chain produces it and it is listed as an alias
    // of necessity. Its dual replaces the ة (نقطتان) for the same reason, and its
    // accusative writes no alif — the tanwīn on a ة is a bare mark ordinary prose
    // leaves off — so the `many` row is spelled like the singular.
    pt: {
      aliases: [...alias("pt"), "نقطة", "نقطتان", "نقاط", "نقطات"],
      symbol: "pt",
      forms: {
        zero: "نقطة",
        one: "نقطة",
        two: "نقطتان",
        few: "نقاط",
        many: "نقطة",
        other: "نقطة",
      },
    },
    /**
     * The invariable one, and the only unit in this set whose six rows are one
     * string for a reason that is not "the difference is an unwritten vowel".
     *
     * بيكا ends in a bare alif. Arabic *can* inflect such a loanword — the
     * pattern exists, سينما gives سينمات — but the pica is a term of art that
     * appears in Arabic typography almost only in the singular and in Latin
     * script, and the derivable dual بيكاوان is a form no Arabic designer has
     * ever written. Printing one would be inventing a word rather than
     * translating one, which is the line R8 draws for symbols and the same line
     * holds for `forms`.
     *
     * So all six rows are بيكا, and the derivable plurals are listed as aliases
     * instead: read but never printed, which is the ordinary asymmetry —
     * recognition is many-to-one and only generation has to choose.
     */
    pc: {
      aliases: [...alias("pc"), "بيكا", "بيكات", "بيكاوان", "بيكاوات"],
      symbol: "pc",
      forms: {
        zero: "بيكا",
        one: "بيكا",
        two: "بيكا",
        few: "بيكا",
        many: "بيكا",
        other: "بيكا",
      },
    },
    px: {
      aliases: [
        ...alias("px"),
        "بكسل",
        "بيكسل",
        "بكسلان",
        "بكسلات",
        `بكسل${AN}`,
        "بكسلا",
      ],
      symbol: "px",
      forms: {
        zero: "بكسل",
        one: "بكسل",
        two: "بكسلان",
        few: "بكسلات",
        many: `بكسل${AN}`,
        other: "بكسل",
      },
    },
  },
});
