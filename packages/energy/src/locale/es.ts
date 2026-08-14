import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Spanish words for the energy units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's. That default decides one word
 * in this file and is named where it does (see `j` below); everywhere else the
 * Spanish is the same on both sides of the Atlantic.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `energy` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the four power/duration/energy
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it, so the micro path
 * (`parseEnergy`) and the engine path agree by construction.
 *
 * **`julio`, and the homograph it costs.** The RAE's name for the joule is
 * `julio` — the same string as the month of July, and the collision is real
 * Spanish rather than a modelling accident. It is safe here for the reason the
 * model makes recognition many-to-one (I6): a `Candidate` carries its kind, so
 * an energy reading and a date reading of the same surface are two candidates
 * the solver ranks, not one entry that overwrites the other; and the alias index
 * is consulted only after a kind's `literals` have had their say, which is where
 * a Spanish date would be claimed. `joule` and `joules` are listed beside it
 * because that is the spelling most of Latin America writes and because the SI
 * brochure's own Spanish edition uses it — recognition takes both, generation
 * prints the RAE's word, and switching which one is printed is a one-line edit
 * in `forms` the day a `es-419` language exists to want it.
 *
 * **The watt-hour family carries no `forms`**, which is the ruling `en.ts`
 * records and Spanish restates without change: "kilovatio-hora" is written with
 * a hyphen and "kilovatio hora" without one, and both fail the same test —
 * `parse/lex.ts` reads "-" as subtraction and ends a word token at a space, so
 * neither shape can lex back as a single unit. Absent forms keep the renderer on
 * the symbol, so a Spanish energy prints "5kWh". Unlike the Ukrainian file next
 * door, no interpunct spelling is listed even as documentation: Spanish writes
 * this family with the hyphen, not with "·", so there is no orthographic form
 * for the `* | power | duration` bridge to rescue.
 *
 * **Symbols are SI's, cased as SI cases them** — "J", "kJ", "MJ", "Wh", "kWh",
 * "MWh", "cal", "kcal" — where `en.ts` leaves them flat. Nothing is risked by
 * the capitals: `buildRegistry` folds case before indexing and
 * `assertLocaleContract` looks a printed surface up folded, so "MWh" and the
 * derived alias "mwh" are one key. The capital is worth having because Spanish
 * prints it: a Spanish electricity bill says kWh, never kwh.
 *
 * **Accents are declared twice, never stripped.** NFKC folding leaves a
 * precomposed í as í, so "caloría" and "caloria" are different strings and a
 * keyboard without accents reaches nothing unless the unaccented spelling is
 * listed. The language's own `keywords` table makes the same move for
 * "más"/"mas". Only the *accented* spelling is ever printed.
 */
export default defineVocabulary({
  locale: "es",
  kind: "energy",
  units: {
    j: {
      aliases: [...alias("j"), "julio", "julios"],
      symbol: "J",
      forms: { one: "julio", other: "julios" },
    },
    kj: {
      aliases: [...alias("kj"), "kilojulio", "kilojulios"],
      symbol: "kJ",
      forms: { one: "kilojulio", other: "kilojulios" },
    },
    mj: {
      aliases: [...alias("mj"), "megajulio", "megajulios"],
      symbol: "MJ",
      forms: { one: "megajulio", other: "megajulios" },
    },
    wh: { aliases: alias("wh"), symbol: "Wh" },
    kwh: { aliases: alias("kwh"), symbol: "kWh" },
    mwh: { aliases: alias("mwh"), symbol: "MWh" },
    cal: {
      // "caloría" is feminine ("una caloría", "las calorías") where "julio" is
      // masculine. That difference is invisible to `forms`, and deliberately:
      // gender surfaces on the number word, and `spellSpanish` is handed a
      // magnitude and nothing else — see `@smartput/datasize/locale/es` for the
      // full argument against an axis nothing downstream could read.
      aliases: [...alias("cal"), "caloría", "calorías", "caloria", "calorias"],
      symbol: "cal",
      forms: { one: "caloría", other: "calorías" },
    },
    kcal: {
      aliases: [
        ...alias("kcal"),
        "kilocaloría",
        "kilocalorías",
        "kilocaloria",
        "kilocalorias",
      ],
      symbol: "kcal",
      forms: { one: "kilocaloría", other: "kilocalorías" },
    },
    btu: {
      // A borrowed initialism, and Spanish leaves those invariant: "1 BTU",
      // "5 BTU", never "5 BTUs". Both rows carry the same string, and the table
      // is present rather than omitted because it is what puts a space between
      // the number and the label — the symbol branch of `defaultRenderQuantity`
      // sets them tight, so dropping `forms` here would print "5BTU".
      //
      // No Spanish expansion is registered. "unidad térmica británica" is four
      // words, which no unit token can be, and the initialism for it is not
      // settled — "UTB" appears in translated datasheets and nowhere a Spanish
      // engineer would type it — so nothing is guessed at.
      aliases: alias("btu"),
      symbol: "BTU",
      forms: { one: "BTU", other: "BTU" },
    },
  },
});
