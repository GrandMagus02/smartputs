import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Polish words for the mass units — the same six units `en` next door names,
 * and the same per-unit decision: all six are nouns a Polish speaker writes
 * out, so all six carry `forms`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Polish engine and
 * the micro path (`parseMass`) cannot drift from it. The Polish spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised (weight -2) precisely so an exact entry here
 * outranks anything it guesses. Every string this file *prints* is therefore
 * also a string it reads: the locative singulars ("kilogramie", "funcie") are
 * listed even though the `ie` suffix rule would recover the first of them,
 * because a word the printer emits should never come back through the penalised
 * path — and "funcie" is not recoverable by any suffix rule at all, since the
 * stem it belongs to is spelled `funt`.
 *
 * Eight `forms` keys per unit, because `polish.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. The key set is shaped like `uk`'s and `ru`'s, and **that is the trap**,
 * because the cells behind it are not filled the same way:
 *
 *   `nom-few`   the 2/3/4 row      "2 kilogramy" — nominative plural, as in
 *                                  Ukrainian and unlike Russian, whose same row
 *                                  is a genitive singular.
 *   `nom-many`  the 0/5-21/teens   "5 kilogramów" — genitive plural, and the row
 *                                  that reaches **21**. Polish counts "21
 *                                  kilogramów" where Ukrainian counts "21
 *                                  кілограм": every -1 above twenty is `many`
 *                                  here and `one` there. A table ported from
 *                                  `uk.ts` prints the nominative singular at 21,
 *                                  101 and 1001, which reads as a typo rather
 *                                  than as a bug.
 *   `nom-other` the *fractional*   "1,5 kilograma" — genitive **singular**, not
 *                                  a plural at all. Writing a plural here prints
 *                                  "1,5 kilogramów", which no test in this repo
 *                                  would catch on shape alone.
 *   `loc-other` the count-free conversion target, "w gramach" — locative plural,
 *                                  which is what `w` governs ("w 5 kilogramach",
 *                                  never "w 5 kilogramów"). It holds a
 *                                  *different word* from `nom-other` above,
 *                                  because the two rows are reached from
 *                                  opposite directions: a fraction with a count
 *                                  and a target without one.
 *
 * Gender drives the endings, and this kind happens to carry both. `mg`, `g`,
 * `kg` and `funt` are masculine hard stems: genitive singular in -a (the
 * fractional row), nominative plural in -y, genitive plural in **-ów**.
 * `tona` and `uncja` are feminine, and their genitive plural has *no ending at
 * all* — "5 ton" is the bare stem, "5 uncji" the soft-stem -i — which is the one
 * form nothing can strip its way to, so it has to be listed as an alias or the
 * printer emits a word it cannot read back.
 *
 * The consonant alternations are the other reason the six tables below are not
 * one table with the stem swapped. `funt` takes t→ć before the locative -e and
 * comes out `funcie`; `tona` takes n→ń and comes out `tonie`; `uncja` is a -ja
 * feminine, so its genitive singular, its genitive plural and its locative
 * singular all collapse onto one spelling, `uncji`, for three different reasons.
 *
 * `symbol` is Polish where Polish actually abbreviates (`mg`, `g`, `kg`, `t`,
 * which are the SI symbols and identical to English's) and the spelled
 * nominative singular where it does not: `uncja` and `funt` have no accepted
 * Polish abbreviation, which is the same choice `en` makes for units it writes
 * out. R8 wants an explicit symbol on every unit, not an invented one.
 *
 * Like `en`, this file names `mass` by id string and never imports the kind,
 * which is what lets `@smartput/mass/locale/pl` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "mass",
  units: {
    mg: {
      aliases: [
        ...alias("mg"),
        "miligram",
        "miligrama",
        "miligramowi",
        "miligramie",
        "miligramem",
        "miligramy",
        "miligramów",
        "miligramom",
        "miligramach",
        "miligramami",
      ],
      symbol: "mg",
      forms: {
        "nom-one": "miligram",
        "nom-few": "miligramy",
        "nom-many": "miligramów",
        "nom-other": "miligrama",
        "loc-one": "miligramie",
        "loc-few": "miligramach",
        "loc-many": "miligramach",
        "loc-other": "miligramach",
      },
    },
    g: {
      aliases: [
        ...alias("g"),
        "gram",
        "grama",
        "gramowi",
        "gramie",
        "gramem",
        "gramy",
        "gramów",
        "gramom",
        "gramach",
        "gramami",
      ],
      symbol: "g",
      forms: {
        "nom-one": "gram",
        "nom-few": "gramy",
        "nom-many": "gramów",
        "nom-other": "grama",
        "loc-one": "gramie",
        "loc-few": "gramach",
        "loc-many": "gramach",
        "loc-other": "gramach",
      },
    },
    kg: {
      // "kilo" is the colloquial clipping, indeclinable in Polish exactly as it
      // is in Ukrainian and Russian, and it is listed for the same reason
      // `units.ts` lists "kilo": people type it.
      aliases: [
        ...alias("kg"),
        "kilogram",
        "kilograma",
        "kilogramowi",
        "kilogramie",
        "kilogramem",
        "kilogramy",
        "kilogramów",
        "kilogramom",
        "kilogramach",
        "kilogramami",
      ],
      symbol: "kg",
      forms: {
        "nom-one": "kilogram",
        "nom-few": "kilogramy",
        "nom-many": "kilogramów",
        "nom-other": "kilograma",
        "loc-one": "kilogramie",
        "loc-few": "kilogramach",
        "loc-many": "kilogramach",
        "loc-other": "kilogramach",
      },
    },
    // Feminine hard stem, so every ending differs from the three grams above.
    // The genitive plural is the **bare stem** — "5 ton", no suffix where the
    // masculines take -ów — and the fractional row is "1,5 tony", the genitive
    // singular, which is spelled identically to the 2/3/4 row and identical for
    // a different reason: there it is a nominative plural, here a genitive
    // singular after a fraction.
    t: {
      aliases: [
        ...alias("t"),
        "tona",
        "tony",
        "tonie",
        "tonę",
        "toną",
        "ton",
        "tonom",
        "tonach",
        "tonami",
      ],
      symbol: "t",
      forms: {
        "nom-one": "tona",
        "nom-few": "tony",
        "nom-many": "ton",
        "nom-other": "tony",
        "loc-one": "tonie",
        "loc-few": "tonach",
        "loc-many": "tonach",
        "loc-other": "tonach",
      },
    },
    // Feminine in -ja, the paradigm where the genitive singular, the genitive
    // plural and the locative singular all land on "uncji" — three
    // grammatically distinct cells sharing one spelling, so "1,5 uncji", "5
    // uncji" and "w 1 uncji" are the same string three times over. The
    // nominative plural is the one cell that breaks out of it: "2 uncje".
    oz: {
      aliases: [
        ...alias("oz"),
        "uncja",
        "uncji",
        "uncję",
        "uncją",
        "uncje",
        "uncjom",
        "uncjach",
        "uncjami",
      ],
      symbol: "uncja",
      forms: {
        "nom-one": "uncja",
        "nom-few": "uncje",
        "nom-many": "uncji",
        "nom-other": "uncji",
        "loc-one": "uncji",
        "loc-few": "uncjach",
        "loc-many": "uncjach",
        "loc-other": "uncjach",
      },
    },
    // The t→ć alternation before the locative -e: `funt` becomes `funcie`, a
    // form no suffix rule in `polish.analyze` can reach, because stripping "ie"
    // off it leaves "func" and not "funt". It is listed as an alias for exactly
    // that reason — the printer emits it for "w 1 funcie".
    lb: {
      aliases: [
        ...alias("lb"),
        "funt",
        "funta",
        "funtowi",
        "funcie",
        "funtem",
        "funty",
        "funtów",
        "funtom",
        "funtach",
        "funtami",
      ],
      symbol: "funt",
      forms: {
        "nom-one": "funt",
        "nom-few": "funty",
        "nom-many": "funtów",
        "nom-other": "funta",
        "loc-one": "funcie",
        "loc-few": "funtach",
        "loc-many": "funtach",
        "loc-other": "funtach",
      },
    },
  },
});
