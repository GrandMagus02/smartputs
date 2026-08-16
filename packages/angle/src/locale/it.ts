import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Italian words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — because the one thing a language may change here is how many keys
 * a `forms` table has, and Italian needs the same two English does.
 * `italian.selectForm` returns `one` for an integer count of exactly 1 and
 * `other` for everything else: 0, a fraction, and a missing count (ruling R5).
 * `Intl.PluralRules("it")` declares a third category, `many`, which CLDR gives
 * to exact millions because Italian says "un milione **di** gradi"; the language
 * folds it into `other` once, centrally, because this engine prints "1.000.000
 * gradi" and the word there is the ordinary plural. Ukrainian next door needs
 * eight keys because it composes a grammatical case with a plural category;
 * Italian composes nothing — its nouns do not decline, so "in gradi" is the same
 * word as "5 gradi" — and a third row here would be a word no count could ever
 * select (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts` — "2 rad" and "1 rev" keep working in an
 * Italian engine. The Italian spellings are appended, singular and plural both,
 * because every string this file *prints* has to be a string it reads: Italian
 * **substitutes** the final vowel to make a plural instead of adding to it, so
 * `it.ts` can only fold one backwards through a substitution table at
 * `weight: -2`, and a word this file chose to print should not depend on a
 * guess.
 *
 * Three of the four need a note:
 *
 *   `radiante` → `radianti` is the third declension, the `-e → -i` class. It is
 *   spelled with the participial `-ante` where English has `-ian`, so neither
 *   the singular nor the plural is reachable from the English alias by any rule
 *   — both are declared.
 *
 *   `grad` prints **`gon`, invariant**, and that is the decision in this file.
 *   Italian's own name for the unit is "grado centesimale" — *two words*, and
 *   `lex` ends a word token at the space, so no analyzer is ever handed the
 *   phrase and no index could hold it, exactly as `@smartput/area` finds for
 *   "metro quadrato". What Italian actually writes for this unit is the
 *   international `gon`, a loanword in the invariant class `it.ts` names
 *   (`watt`, `bar`, `joule`): it ends in a consonant, so it has no final vowel
 *   to substitute and takes no plural at all — "5 gon", never "5 goni". So both
 *   `forms` rows hold the same string, which is not a redundant row but the
 *   language's actual answer, and inventing `goni` to fill the second would be
 *   manufacturing a word Italian does not have. The rows exist rather than being
 *   dropped for the printer's sake: a unit with no `forms` renders through the
 *   symbol branch, which sets number and symbol tight ("5gon"), and this is a
 *   word rather than a superscript.
 *
 *   `turn` has two Italian names and they differ in register, not in meaning:
 *   `giro` is what a person says ("due giri completi") and `rivoluzione` is what
 *   a machine's datasheet says ("rivoluzioni al minuto"). Both are read; `giro`
 *   is printed, because the printer has to pick one and the everyday word is the
 *   one an unqualified number is most likely to have meant. `es` reaches the
 *   same split with `vuelta`/`revolución`.
 *
 * Symbols are the ones Italian genuinely writes. `rad` and `gon` are the
 * international symbols, used unchanged. `°` is the only written short form for
 * an angular degree in any language that uses the Latin script, and it is listed
 * as an alias too so a printed `90°` reads back. `giro` is the noun: Italian's
 * own clipping is "giri/min" and "g" is already the gram, so there is no
 * abbreviation to take — and R8 wants an explicit symbol, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `angle` by **id string** and never
 * imports the kind, which is what lets `@smartput/angle/locale/it` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "radiante", "radianti"],
      symbol: "rad",
      forms: { one: "radiante", other: "radianti" },
    },
    deg: {
      aliases: [...alias("deg"), "°", "grado", "gradi"],
      symbol: "°",
      forms: { one: "grado", other: "gradi" },
    },
    grad: {
      aliases: [...alias("grad")],
      symbol: "gon",
      forms: { one: "gon", other: "gon" },
    },
    turn: {
      aliases: [...alias("turn"), "giro", "giri", "rivoluzione", "rivoluzioni"],
      symbol: "giro",
      forms: { one: "giro", other: "giri" },
    },
  },
});
