import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Spanish words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — because the one thing a language is allowed to change here is
 * how many keys a `forms` table has, and Spanish needs the same two English
 * does. `spanish.selectForm` returns a bare CLDR plural category: `one` for a
 * count of exactly 1, `other` for everything else — 0, a fraction, a missing
 * count (ruling R5), and the multiples of a million CLDR files under `many`,
 * which the language folds into `other` because this engine never prints
 * compact notation. Ukrainian next door needs eight keys because it composes a
 * grammatical case with a plural category; Spanish composes nothing, so a third
 * row here would be a word no count could ever select (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts` — "2 rad" and "1 rev" keep working in a
 * Spanish engine, and `gon`, which `units.ts` already sends to `grad`, is the
 * international name Spanish also uses. The Spanish spellings are appended,
 * singular and plural both, because every string this file *prints* has to be a
 * string it reads.
 *
 * Two of the four need more than a plural rule:
 *
 *   `radián` → `radianes` and `gradián` → `gradianes` move the written accent.
 *   The stress does not move; the acute is only written where the general rule
 *   would put it elsewhere, so it appears on the singular and vanishes on the
 *   plural. The suffix stripper cannot bridge that — stripping "es" from
 *   "radianes" yields "radian", a third string again, and NFKC folding leaves a
 *   precomposed `á` as `á` rather than stripping it. Both accented spellings
 *   are therefore declared; the accent-free stems need no entry of their own,
 *   because "radian" and "gradian" are already in `units.ts` as the English
 *   names and one string in the index serves both languages.
 *
 *   `turn` has two Spanish names, and they are not synonyms of each other in
 *   register: `vuelta` is what a person says ("dos vueltas completas") and
 *   `revolución` is what a machine's datasheet says ("revoluciones por
 *   minuto"). Both are read; `vuelta` is what is printed, because the printer
 *   has to pick one and the everyday word is the one an unqualified number is
 *   most likely to have meant.
 *
 * Symbols are the ones Spanish genuinely writes. `rad` and `gon` are the
 * international symbols, used unchanged. `°` is the only written short form for
 * an angular degree in any language that uses the Latin script, and it is
 * listed as an alias too so a printed `90°` reads back. `vuelta` is the noun:
 * Spanish's own clipping is "rev." with a period, and `lex` ends a word token at
 * the period, so the abbreviation would print a string the engine could not
 * read — R8 wants an explicit symbol, never an invented one, and the bare
 * `rev` in `units.ts` is English's clipping doing alias duty rather than
 * Spanish's symbol.
 */
export default defineVocabulary({
  locale: "es",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "radián", "radianes"],
      symbol: "rad",
      forms: { one: "radián", other: "radianes" },
    },
    deg: {
      aliases: [...alias("deg"), "°", "grado", "grados"],
      symbol: "°",
      tight: true,
      forms: { one: "grado", other: "grados" },
    },
    // `gon`/`gones` is the SI-adjacent name and comes half-registered already:
    // `units.ts` sends "gon" here for English, and the Spanish plural is added
    // beside it. `gradián` is the borrowed name, and both are read.
    grad: {
      aliases: [...alias("grad"), "gradián", "gradianes", "gones"],
      symbol: "gon",
      forms: { one: "gradián", other: "gradianes" },
    },
    turn: {
      aliases: [
        ...alias("turn"),
        "vuelta",
        "vueltas",
        "revolución",
        "revoluciones",
        "revolucion",
      ],
      symbol: "vuelta",
      forms: { one: "vuelta", other: "vueltas" },
    },
  },
});
