import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Portuguese words for the angle units — Brazilian under the bare `pt` tag,
 * which is this project's ruling and also what the platform does
 * (`Intl.NumberFormat("pt")` resolves to "." for groups and "," for the
 * decimal). Nothing in this kind's four nouns differs between Brazil and
 * Portugal, so unlike `@smartput/core/locale/pt-cardinals` there is no second
 * spelling to declare anywhere below.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category and folds CLDR's third Portuguese category, `many`, into
 * `other` — `many` is a fact about the *numeral* ("1 milhão"), not about the
 * noun after it, and this engine never prints compact notation. Portuguese
 * inflects a unit noun for number and for nothing else: it has no case, so a
 * conversion target ("em graus") is spelled exactly like a bare quantity and
 * the slot axis Ukrainian and German need selects nothing here (rule 6).
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 grau"), and
 * **1,5 selects `one`** as well — "1,5 grau", the exact opposite of English's
 * "1.5 degrees". Both are pinned in `pt.test.ts` beside this file.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so "2 rad" and "1 rev" keep working in a
 * Portuguese engine and the micro path (`parseAngle`) cannot drift from it.
 * `gon`, which that map already sends to `grad`, is the international name
 * Portuguese uses too. The Portuguese spellings are appended, singular and
 * plural both, because every string this file *prints* has to be a string it
 * reads and a printed plural recovered only by the language's penalised suffix
 * stripper is a reading this vocabulary should not be leaving to a guess.
 *
 * Every plural here is the plain `-s` of a vowel-final noun, so none of them
 * needs `portuguese`'s rewriting analyzer — `grau` → `graus` looks like the
 * `-l` → `-is` class from a distance but is not one: the `u` is a vowel of the
 * diphthong and nothing is replaced. The one entry that *does* rewrite is
 * `revolução` → `revoluções` (the `-ão` class), and it is listed in full rather
 * than left to `pluralReplacer`, for the same reason as everything else here.
 *
 * `symbol` is the abbreviation Portuguese itself writes: `rad` and `gon` are
 * the international symbols, used unchanged, and `°` is the only written short
 * form for an angular degree in any Latin-script language — it is listed as an
 * alias too, so a printed `90°` is a string the index knows. `volta` is the
 * spelled noun, because Portuguese's own clipping is "rev." *with a period* and
 * `lex` ends a word token at the period, so the abbreviation would print
 * something the engine could not read back. R8 wants an explicit symbol on
 * every unit, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `angle` by **id string** and never
 * imports the kind, which is what lets `@smartput/angle/locale/pt` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "radiano", "radianos"],
      symbol: "rad",
      forms: { one: "radiano", other: "radianos" },
    },
    deg: {
      aliases: [...alias("deg"), "°", "grau", "graus"],
      symbol: "°",
      forms: { one: "grau", other: "graus" },
    },
    // Two names, and they are not the same register. `grado` is what the
    // Portuguese literature calls the centesimal degree, and `gradiano` is the
    // borrowing an English datasheet's translation produces. Both are read;
    // `grado` is printed, because it is the name the language settled on.
    //
    // Nothing here collides with `deg` above: "grado" and "grau" are two words,
    // and neither stems to the other under any rule `portuguese` declares.
    grad: {
      aliases: [...alias("grad"), "gons", "grado", "grados", "gradiano", "gradianos"],
      symbol: "gon",
      forms: { one: "grado", other: "grados" },
    },
    // `volta` is what a person says ("duas voltas completas") and `revolução`
    // what a motor's datasheet says ("rotações por minuto" is the commoner
    // Brazilian phrasing, but the noun in a conversion is `revolução`). Both
    // read; the printer has to pick one and picks the everyday word.
    //
    // The unaccented twins are declared rather than hoped for: NFKC folding
    // leaves a precomposed `ç`/`ã` alone rather than stripping them, so
    // "revolucao" is a different string to the alias index — the same move
    // `@smartput/core/locale/pt` makes for "milhao" beside "milhão".
    turn: {
      aliases: [
        ...alias("turn"),
        "volta",
        "voltas",
        "revolução",
        "revoluções",
        "revolucao",
        "revolucoes",
      ],
      symbol: "volta",
      forms: { one: "volta", other: "voltas" },
    },
  },
});
