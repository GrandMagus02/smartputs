import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Polish words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — and the one thing that differs is the only thing that is allowed
 * to: how many keys a `forms` table has. English needs two because
 * `Intl.PluralRules("en")` has two categories. Polish needs eight, because
 * `polish.selectForm` composes a grammatical case with a plural category and an
 * angle word inflects for both.
 *
 * The eight keys, and why each is a different word rather than a stem plus a
 * rule the engine could have applied itself:
 *
 * ```
 * nom-one    1              "1 stopień"       nominative singular
 * nom-few    2, 3, 4, 22    "2 stopnie"       nominative plural
 * nom-many   0, 5-21, 12-14 "5 stopni"        genitive plural
 * nom-other  1,5            "1,5 stopnia"     genitive SINGULAR, not a plural
 * loc-one    1              "w 1 stopniu"     locative singular
 * loc-few    2, 3, 4        "w 2 stopniach"   locative plural
 * loc-many   5-21           "w 5 stopniach"   locative plural
 * loc-other  no count       "w stopniach"     locative plural
 * ```
 *
 * `nom-many` is the row to read against `uk.ts` next door, because the two
 * languages disagree about where it starts and stops. Polish counts **21** here
 * — "21 stopni", genitive plural — where Ukrainian counts it as a singular ("21
 * градус"), and every -1 above twenty goes the same way. A table ported across
 * the two prints a nominative singular at 21, 101 and 1001, which reads as a
 * typo rather than as a bug.
 *
 * `nom-other` is the row worth reading twice: it is the *fractional* category,
 * and in Polish a fraction governs the genitive singular. "1,5 stopni" is wrong
 * and no test in this repo would notice, because a round trip reparses both
 * spellings to the same number. `loc-other` is a different word again — a
 * conversion target names a unit with no magnitude attached to it ("1 obrót w
 * stopniach" has nothing to count degrees by), so the count is absent and the
 * case is still the locative `w` governs.
 *
 * The four units are four paradigms, not one with the stem swapped:
 *
 *   `radian` is the plain masculine hard stem — genitive singular in -a,
 *   nominative plural in -y, genitive plural in -ów, locative singular in -ie.
 *
 *   `stopień` is a soft masculine with a *mobile e*: the vowel of the last
 *   syllable disappears in every oblique form, so the stem is `stopni-` and not
 *   `stopień-`. Its genitive plural is the bare soft `stopni`, its nominative
 *   plural `stopnie`, its locative singular `stopniu`. No suffix rule can
 *   produce any of them from the nominative, which is why they are all listed.
 *
 *   `grad` is hard, so it takes -a/-y/-ów like `radian`, and it is a homograph:
 *   the weather noun `grad` (hail) exists and takes -u in the genitive singular.
 *   Units of measure take -a in Polish — `metra`, `grama`, `wolta` — so the unit
 *   is `grada` and the hail is `gradu`, and this file records the unit. `gon` is
 *   the same unit's other Polish name and is declined beside it, as an alias
 *   only: two printed names for one unit would make the printer's choice
 *   arbitrary.
 *
 *   `obrót` has both an ó→o alternation in the stem *and* a genitive singular in
 *   **-u** rather than -a — "1,5 obrotu", not "1,5 obrota" — which is the one
 *   place in this package where the genitive-singular rule the other three units
 *   follow does not hold. Its locative singular adds t→ć on top: `obrocie`.
 *
 * Aliases are the Latin ones from `units.ts` — a Polish keyboard types "2 rad"
 * as readily as "2 radiany" — with the Polish spellings appended in every
 * inflected form a reader might actually type. This list is what the analyzer
 * falls back *from*: `polish`'s suffix stripper only has to catch the forms
 * nobody thought to write down here, and it catches none of the alternating ones
 * at all.
 *
 * Symbols are the ones Polish genuinely uses: `rad`, `°`, `grad`, and `obr` (the
 * `obr` of "obr./min"), each also listed as an alias so a printed symbol reads
 * back.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "angle",
  units: {
    rad: {
      aliases: [
        ...alias("rad"),
        "radiana",
        "radianowi",
        "radianie",
        "radianem",
        "radiany",
        "radianów",
        "radianom",
        "radianach",
        "radianami",
      ],
      symbol: "rad",
      forms: {
        "nom-one": "radian",
        "nom-few": "radiany",
        "nom-many": "radianów",
        "nom-other": "radiana",
        "loc-one": "radianie",
        "loc-few": "radianach",
        "loc-many": "radianach",
        "loc-other": "radianach",
      },
    },
    deg: {
      aliases: [
        ...alias("deg"),
        // "°" and not a letter abbreviation: Polish writes "90°", and the only
        // written short form for an angular degree is the sign. `st.` would be
        // the letter abbreviation, and it is claimed by nothing here precisely
        // because it is also the abbreviation for half a dozen other words.
        "°",
        "stopień",
        "stopnia",
        "stopniowi",
        "stopniu",
        "stopniem",
        "stopnie",
        "stopni",
        "stopniom",
        "stopniach",
        "stopniami",
      ],
      symbol: "°",
      forms: {
        "nom-one": "stopień",
        "nom-few": "stopnie",
        "nom-many": "stopni",
        "nom-other": "stopnia",
        "loc-one": "stopniu",
        "loc-few": "stopniach",
        "loc-many": "stopniach",
        "loc-other": "stopniach",
      },
    },
    grad: {
      aliases: [
        ...alias("grad"),
        "grada",
        "gradowi",
        "gradzie",
        "gradem",
        "grady",
        "gradów",
        "gradom",
        "gradach",
        "gradami",
        // The same unit's other Polish name, read but never printed.
        "gona",
        "gonowi",
        "gonie",
        "gonem",
        "gony",
        "gonów",
        "gonom",
        "gonach",
        "gonami",
      ],
      symbol: "grad",
      forms: {
        "nom-one": "grad",
        "nom-few": "grady",
        "nom-many": "gradów",
        "nom-other": "grada",
        "loc-one": "gradzie",
        "loc-few": "gradach",
        "loc-many": "gradach",
        "loc-other": "gradach",
      },
    },
    turn: {
      aliases: [
        ...alias("turn"),
        "obr",
        "obrót",
        "obrotu",
        "obrotowi",
        "obrocie",
        "obrotem",
        "obroty",
        "obrotów",
        "obrotom",
        "obrotach",
        "obrotami",
      ],
      symbol: "obr",
      forms: {
        "nom-one": "obrót",
        "nom-few": "obroty",
        "nom-many": "obrotów",
        // Genitive singular in -u, against the -a the other three units take.
        // `obrót` is one of the masculines that declines that way, so "1,5
        // obrotu" — and the ó of the nominative is gone from every oblique form,
        // which is why not one of them is reachable by stripping a suffix.
        "nom-other": "obrotu",
        "loc-one": "obrocie",
        "loc-few": "obrotach",
        "loc-many": "obrotach",
        "loc-other": "obrotach",
      },
    },
  },
});
