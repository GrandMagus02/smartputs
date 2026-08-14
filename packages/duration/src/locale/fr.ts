import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * French words for the duration units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". Belgian and Swiss French would be
 * `Language`s with ids of their own, and their divergence is in the *numerals*
 * (septante, nonante) rather than in any of the six nouns below, which are the
 * same word everywhere French is written.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `duration`
 * by **id string** rather than importing the kind: that is what lets this file
 * be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parseDuration`) and the engine path
 * agree by construction — including the ambiguity that `"m"` is minutes here and
 * metres in `length`, which is the solver's to rank and not this file's to
 * remove.
 *
 * **This is the plainest kind in the package set, and French makes it plainer
 * than Ukrainian does.** A French unit noun inflects for number and for nothing
 * else — no case, no gender agreement on the noun itself — so two rows cover
 * every unit's whole paradigm where Ukrainian needs eight. All six plurals are
 * the regular -s (`seconde` → `secondes`), and none of the -x nouns
 * `french.analyze` also strips (the -eau/-eu/-al class) occurs here.
 *
 * **What is not plain is the boundary.** `french.selectForm` returns "one" for 0,
 * for 1 and for every fraction below two, so "1,5 heure" and "0 jour" are
 * singular where English writes "1.5 hours" and "0 days". This kind is where a
 * user meets that most often — durations land on halves constantly — and it is
 * the row an English table ported by renaming its columns gets wrong, so
 * `fr.test.ts` asserts the printed string rather than only the key.
 *
 * **Two abbreviations were chosen against a shorter alternative, and one carries
 * a collision.**
 *
 * `j` is the French symbol for the day — it is what a French calendar, contract
 * or Gantt chart writes ("délai : 30 j"), where English writes "d" — and it
 * folds onto `energy`'s French joule symbol "J". That collision is real French
 * and is left standing rather than removed, for the reason `units.ts` already
 * gives about `"m"`: two kinds spelling one surface is a genuine ambiguity the
 * solver ranks over `Candidate`s carrying their own kind, not something a
 * vocabulary may resolve by refusing to say the word its language uses. It also
 * costs nothing in practice here, because this unit declares `forms` and the
 * renderer therefore prints "jours" rather than the symbol in every path but an
 * explicit `symbols: true`. The English "d", "day" and "days" arrive from
 * `units.ts` and stay readable beside it.
 *
 * `sem` is the week, and it loses a full stop on the way in. French writes the
 * contraction as "sem.", and the stop cannot ride inside a unit token — `lex`
 * builds a word out of letters plus trailing digits, so the "." ends it — which
 * would leave "2 sem." printing a character nothing can read back. The dotless
 * contraction is one letter run and one token. Same trade
 * `@smartput/duration/locale/es` makes for its own "sem." and
 * `@smartput/power/locale/uk` for "к.с." → "кс": a mechanical constraint, not an
 * opinion about orthography.
 *
 * `mn` is listed as an alias of the minute beside the SI "min". Both are written
 * in French — "min" is the SI symbol and what a recipe or a timetable prints,
 * "mn" is the older French contraction that survives in transport and broadcast
 * schedules — and recognition is many-to-one (I6), so both read while only "min"
 * is ever printed.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "duration",
  units: {
    ms: {
      aliases: [...alias("ms"), "milliseconde", "millisecondes"],
      symbol: "ms",
      forms: { one: "milliseconde", other: "millisecondes" },
    },
    s: {
      // "sec" and "secs" arrive from `units.ts` and are written in French too;
      // the French noun differs from the English one only by its final -e, and
      // no stripper derives one from the other — `suffixStripper` removes a
      // trailing -s or -x and nothing else.
      aliases: [...alias("s"), "seconde", "secondes"],
      symbol: "s",
      forms: { one: "seconde", other: "secondes" },
    },
    min: {
      // "minute" and "minutes" are already in `units.ts`: French and English
      // spell this one identically, so the only French word this row adds is
      // the contraction.
      aliases: [...alias("min"), "mn"],
      symbol: "min",
      forms: { one: "minute", other: "minutes" },
    },
    h: {
      aliases: [...alias("h"), "heure", "heures"],
      symbol: "h",
      forms: { one: "heure", other: "heures" },
    },
    d: {
      aliases: [...alias("d"), "j", "jour", "jours"],
      symbol: "j",
      forms: { one: "jour", other: "jours" },
    },
    wk: {
      aliases: [...alias("wk"), "sem", "semaine", "semaines"],
      symbol: "sem",
      forms: { one: "semaine", other: "semaines" },
    },
  },
});
