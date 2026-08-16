import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

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
 * Arabic words for the volume units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * Arabic is the hardest language shipped here, and this file meets all three of
 * the reasons.
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on ONE axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Ukrainian has eight on two axes.
 * Taking لتر through all six:
 *
 * ```
 * zero   0            لتر         genitive singular
 * one    1            لتر         nominative singular
 * two    2            لتران       the DUAL — a suffix on the noun, not a
 *                                 separate word, and a category no other
 *                                 language shipped here has
 * few    3-10         لترات       plural
 * many   11-99        لترًا       accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    لتر         genitive singular
 *        fractions
 * ```
 *
 * `many` is not a plural — "١١ لترًا" is a singular noun in the accusative — and
 * `other`, where every fraction and every count-free conversion target lands
 * (ruling R5), is the genitive **singular**: "1.5 لتر", never "1.5 لترات". Those
 * are the two rows a table ported by renaming English columns gets wrong.
 * `zero`, `one` and `other` share one string on every unit here, because the
 * three differ only in a final short vowel Arabic does not write; repeating it
 * is correct, not a half-finished table.
 *
 * **2. The digits stay Latin.** `@smartput/core/locale/ar` pins `numberFormat:
 * { group: ",", decimal: "." }` — the `latn` numbering system, transcribed
 * rather than read from `Intl`, because the engine can only *emit* Latin digits
 * and pairing them with Arabic-Indic separators would produce `1٬234٫5`, a
 * hybrid nobody writes. Litres and millilitres are three orders of magnitude
 * apart, so the group separator is reached on the first conversion anyone tries;
 * "," is one `lex` reads back, which is why this vocabulary's own output
 * round-trips where Ukrainian's U+00A0-grouped output does not.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 لتران" holds the number first and the noun second exactly
 * as "2 litres" does, and the Unicode Bidirectional Algorithm is what puts the
 * number on the right at display time. **Nothing here is reversed and nothing
 * here should be** — swapping the parts would emit the noun before the number in
 * memory, which `parse` reads as a unit followed by a number, and
 * `parse(format(v)) === v` breaks.
 *
 * **`m3` carries no `forms`, exactly as `en` and `uk` carry none.** "متر مكعب"
 * is two words, `lex` ends a word token at the space, and the printer's spelled
 * path only ever emits something the parser can read back — so a form here would
 * hand completion text that fails to evaluate. It renders through `م³` instead,
 * which `arabic.renderQuantity` sets off from the number with a space rather
 * than tight against it, because an Arabic symbol is letters and a digit run
 * glued to letters is a boundary the bidi algorithm has to guess.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in an Arabic engine and
 * the micro path (`parseVolume`) cannot drift from it.
 *
 * `symbol` is Arabic where Arabic actually abbreviates — ل and مل are what a
 * bottle and a syringe print — and the spelled nominative singular where it does
 * not: غالون and باينت have no accepted Arabic abbreviation. The one-letter ل is
 * safe despite also being the preposition *li-*, because that preposition is
 * always written fused to the following word and so never reaches `lex` as a
 * token of its own; `arabic`'s suffix stripper floors at `minStem: 2` for the
 * matching reason, and `ar.ts` names ل among the symbols that floor protects.
 *
 * Like `en`, this file names `volume` by id string and never imports the kind,
 * which is what lets `@smartput/volume/locale/ar` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "ل", "لتر", "ليتر", "لتران", "لترات", `لتر${AN}`, "لترا"],
      symbol: "ل",
      forms: {
        zero: "لتر",
        one: "لتر",
        two: "لتران",
        few: "لترات",
        many: `لتر${AN}`,
        other: "لتر",
      },
    },
    // مليلتر with one lām is the spelling in ordinary use; ملليلتر doubles it to
    // mirror the geminate of "milli-" and ميليلتر transliterates the vowel
    // instead. All three are read, one is printed — recognition is many-to-one
    // and only generation has to choose.
    ml: {
      aliases: [
        ...alias("ml"),
        "مل",
        "مليلتر",
        "ملليلتر",
        "ميليلتر",
        "مليلتران",
        "مليلترات",
        `مليلتر${AN}`,
        "مليلترا",
      ],
      symbol: "مل",
      forms: {
        zero: "مليلتر",
        one: "مليلتر",
        two: "مليلتران",
        few: "مليلترات",
        many: `مليلتر${AN}`,
        other: "مليلتر",
      },
    },
    // The digit-3 spelling is what a keyboard without a superscript produces,
    // and both have to be listed: `normalize()` runs NFKC, which folds ³ to a
    // plain 3 before the lexer sees it, while `assertLocaleContract` looks the
    // *symbol* up in the alias index unfolded. One spelling would fail one of the
    // two paths. The two-word name متر مكعب is not
    // listed at all: `lex` ends a word token at the space, so it arrives as two
    // tokens and no single alias can claim it.
    m3: {
      aliases: [...alias("m3"), "م3", "م³"],
      symbol: "م³",
    },
    // جالون is the same word with the Egyptian jīm for the foreign /g/ — a
    // pronunciation difference written down, not a different unit.
    gal: {
      aliases: [
        ...alias("gal"),
        "غالون",
        "جالون",
        "غالونان",
        "غالونات",
        `غالون${AN}`,
        "غالونا",
      ],
      symbol: "غالون",
      forms: {
        zero: "غالون",
        one: "غالون",
        two: "غالونان",
        few: "غالونات",
        many: `غالون${AN}`,
        other: "غالون",
      },
    },
    // باينت is a transliteration and stays one: Arabic has no inherited measure
    // of this size to borrow a name from, so the noun takes the sound plural in
    // ـات and the ordinary dual, and every row is derivable.
    pint: {
      aliases: [
        ...alias("pint"),
        "باينت",
        "بينت",
        "باينتان",
        "باينتات",
        `باينت${AN}`,
        "باينتا",
      ],
      symbol: "باينت",
      forms: {
        zero: "باينت",
        one: "باينت",
        two: "باينتان",
        few: "باينتات",
        many: `باينت${AN}`,
        other: "باينت",
      },
    },
  },
});
