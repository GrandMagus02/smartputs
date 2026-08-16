import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Ukrainian words for the angle units.
 *
 * The shape is `en.ts`'s exactly — same kind id named by **string**, same
 * explicit `symbol` on every unit (ruling R8), same four units with a `forms`
 * table each — and the one thing that differs is the only thing that is allowed
 * to: how many keys a `forms` table has. English needs two because
 * `Intl.PluralRules("en")` has two categories. Ukrainian needs eight, because
 * `ukrainian.selectForm` composes a grammatical case with a plural category and
 * an angle word inflects for both.
 *
 * The eight keys, and why each is a different word rather than a stem plus a
 * rule the engine could have applied itself:
 *
 * ```
 * nom-one    1, 21, 101    "1 градус"        nominative singular
 * nom-few    2, 3, 4, 22   "2 градуси"       nominative plural
 * nom-many   0, 5-20, 100  "5 градусів"      genitive plural
 * nom-other  1,5           "1,5 градуса"     genitive SINGULAR, not a plural
 * loc-one    1             "в 1 градусі"     locative singular
 * loc-few    2, 3, 4       "в 2 градусах"    locative plural
 * loc-many   5-20          "в 5 градусах"    locative plural
 * loc-other  no count      "в градусах"      locative plural
 * ```
 *
 * `nom-other` is the row worth reading twice: it is the *fractional* category,
 * and in Ukrainian a fraction governs the genitive singular. "1,5 градусів" is
 * wrong and no test in this repo would notice, because a round-trip reparses
 * both spellings to the same number.
 *
 * `loc-other` is the row the old one-dimensional `display` table could not
 * express at all: a conversion target names a unit with no magnitude attached
 * to it ("1 оберт в градусах" has nothing to count degrees by), so the count is
 * absent and the case still has to be locative — that is what `в` governs.
 *
 * Aliases are the Latin ones from `units.ts` — a Ukrainian keyboard types
 * "2 rad" as readily as "2 рад" — with the Cyrillic spellings appended in every
 * inflected form a reader might actually type. This list is what the analyzer
 * falls back *from*: `ukrainian`'s suffix stripper only has to catch the forms
 * nobody thought to write down here.
 *
 * Symbols are the ones Ukrainian genuinely uses: `рад`, `°`, `град`, `об` (the
 * `об` of "об/хв"), each also listed as an alias so a printed symbol reads back.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "angle",
  units: {
    rad: {
      aliases: [
        ...alias("rad"),
        "рад",
        "радіан",
        "радіана",
        "радіани",
        "радіанів",
        "радіанам",
        "радіані",
        "радіанах",
      ],
      symbol: "рад",
      forms: {
        "nom-one": "радіан",
        "nom-few": "радіани",
        "nom-many": "радіанів",
        "nom-other": "радіана",
        "loc-one": "радіані",
        "loc-few": "радіанах",
        "loc-many": "радіанах",
        "loc-other": "радіанах",
      },
    },
    deg: {
      aliases: [
        ...alias("deg"),
        "°",
        "градус",
        "градуса",
        "градуси",
        "градусів",
        "градусам",
        "градусі",
        "градусах",
      ],
      // "°" and not a letter abbreviation: Ukrainian writes "90°", and the only
      // written short form for an angular degree is the sign. `град.` would be
      // the letter abbreviation, and it is exactly the string `grad` claims
      // below — a symbol nobody could read twice.
      symbol: "°",
      forms: {
        "nom-one": "градус",
        "nom-few": "градуси",
        "nom-many": "градусів",
        "nom-other": "градуса",
        "loc-one": "градусі",
        "loc-few": "градусах",
        "loc-many": "градусах",
        "loc-other": "градусах",
      },
    },
    grad: {
      aliases: [
        ...alias("grad"),
        "град",
        "града",
        "гради",
        "градів",
        "градам",
        "граді",
        "градах",
        "гон",
        "гона",
        "гони",
        "гонів",
        "гонам",
        "гоні",
        "гонах",
      ],
      symbol: "град",
      forms: {
        "nom-one": "град",
        "nom-few": "гради",
        "nom-many": "градів",
        "nom-other": "града",
        "loc-one": "граді",
        "loc-few": "градах",
        "loc-many": "градах",
        "loc-other": "градах",
      },
    },
    turn: {
      aliases: [
        ...alias("turn"),
        "об",
        "оберт",
        "оберта",
        "оберту",
        "оберти",
        "обертів",
        "обертам",
        "оберті",
        "обертах",
        "обертання",
      ],
      symbol: "об",
      forms: {
        "nom-one": "оберт",
        "nom-few": "оберти",
        "nom-many": "обертів",
        // Genitive singular. Dictionaries list the abstract noun as "оберт, -у",
        // but as a *counted* unit of rotation it takes the -а every unit of
        // measure takes ("метра", "грама", "градуса"), so "1,5 оберта". Both
        // spellings are aliases above, so either reads back whichever a user
        // types.
        "nom-other": "оберта",
        "loc-one": "оберті",
        "loc-few": "обертах",
        "loc-many": "обертах",
        "loc-other": "обертах",
      },
    },
  },
});
