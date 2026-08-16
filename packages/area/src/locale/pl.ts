import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Polish words for the area units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Polish engine and
 * the micro path (`parseArea`) cannot drift from it. The Polish spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised (weight -2) precisely so an exact entry here
 * outranks anything it guesses. Every string this file *prints* is therefore
 * also a string it reads: the locative singulars "hektarze" and "akrze" are
 * listed because no suffix rule recovers them at all — the r→rz alternation
 * leaves a stem spelled differently from the one the aliases are built on.
 *
 * **`m2`, `cm2`, `km2` carry no `forms`, exactly as `en` carries none, and for
 * exactly the same reason.** Polish names them "metr kwadratowy", "centymetr
 * kwadratowy", "kilometr kwadratowy" — two words each, and the printer's spelled
 * path only ever emits a word the parser can read back, so a form here would
 * hand completion text that fails to evaluate. (`assertLocaleContract` says so
 * itself: a printed surface containing a space is refused outright, because
 * `lex` ends a word token at the space and no analyzer is ever handed the whole
 * phrase.) They render through the symbol instead — and in Polish that is a
 * *spaced* "3 m²", because `polish.renderQuantity` follows PN-EN ISO 80000
 * rather than the default template's tight `3m²`.
 *
 * The squared units get no Polish aliases either, and that is an observation
 * rather than an omission: Poland writes `m²` and `m2` with the same characters
 * the alias map already carries. There is nothing to append the way a Cyrillic
 * vocabulary appends `м²`.
 *
 * Eight `forms` keys on the two units Polish genuinely declines, because
 * `polish.selectForm` keys on `` `${case}-${category}` ``: case from the slot
 * (locative after `w`, which is what the preposition governs), category from
 * CLDR's four. Two rows are worth naming. `nom-many` is the 0/5–21/teens row and
 * it reaches **21** — "21 hektarów", where Ukrainian's same count takes a
 * nominative singular — and `nom-other` is the *fractional* row, genitive
 * **singular**: "1,5 hektara", never "1,5 hektarów". `loc-other` is the
 * count-free conversion target ("w hektarach"), a different word from
 * `nom-other` and reached from the opposite direction.
 *
 * Both declined units are masculine hard stems, so `symbol` follows the same
 * rule as everywhere else: `ha` is what Poland actually abbreviates the hectare
 * to, and `akr` has no abbreviation at all, so its symbol is the spelled
 * nominative singular — the same choice `en` makes for `acre`. R8 wants an
 * explicit symbol on every unit, not an invented one.
 *
 * Like `en`, this file names `area` by id string and never imports the kind,
 * which is what lets `@smartput/area/locale/pl` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "area",
  units: {
    m2: { aliases: alias("m2"), symbol: "m²" },
    cm2: { aliases: alias("cm2"), symbol: "cm²" },
    km2: { aliases: alias("km2"), symbol: "km²" },
    hectare: {
      aliases: [
        ...alias("hectare"),
        "hektar",
        "hektara",
        "hektarowi",
        "hektarze",
        "hektarem",
        "hektary",
        "hektarów",
        "hektarom",
        "hektarach",
        "hektarami",
      ],
      symbol: "ha",
      forms: {
        "nom-one": "hektar",
        "nom-few": "hektary",
        "nom-many": "hektarów",
        "nom-other": "hektara",
        "loc-one": "hektarze",
        "loc-few": "hektarach",
        "loc-many": "hektarach",
        "loc-other": "hektarach",
      },
    },
    acre: {
      aliases: [
        ...alias("acre"),
        "akr",
        "akra",
        "akrowi",
        "akrze",
        "akrem",
        "akry",
        "akrów",
        "akrom",
        "akrach",
        "akrami",
      ],
      symbol: "akr",
      forms: {
        "nom-one": "akr",
        "nom-few": "akry",
        "nom-many": "akrów",
        "nom-other": "akra",
        "loc-one": "akrze",
        "loc-few": "akrach",
        "loc-many": "akrach",
        "loc-other": "akrach",
      },
    },
  },
});
