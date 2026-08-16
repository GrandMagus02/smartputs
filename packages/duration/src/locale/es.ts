import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Spanish words for the duration units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag here, and none of the six words below varies by region anyway.
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
 * **Every unit inflects, and every one of them regularly**, which is why this
 * kind is the plainest of the seven: Spanish marks number and nothing else on a
 * unit noun, so two rows cover the whole paradigm exactly as they do in English.
 * The plural is -s after a vowel throughout (`minuto` → `minutos`, `hora` →
 * `horas`); no unit here ends in a consonant, so the -es allomorph
 * `spanish.analyze` also strips never comes up.
 *
 * **`día` is the row worth stopping at.** It ends in -a and is nevertheless
 * masculine ("un día", "los días") — a Greek loan that kept its gender through
 * Latin — and it carries an acute that survives into the plural, because the
 * stress stays on the same syllable and the hiatus still needs marking. That
 * accent is why the unaccented spellings are listed beside the correct ones:
 * NFKC folding leaves a precomposed í as í rather than stripping the diacritic,
 * so "dia" and "dias" are different strings from "día" and "días" and a keyboard
 * without accents would otherwise reach nothing. The language's own `keywords`
 * table makes the same move for "más"/"mas". The gender itself is invisible to
 * `forms`, and deliberately: see `@smartput/datasize/locale/es` for why no
 * gender axis is added when nothing downstream could agree with it.
 *
 * **Symbols are the SI abbreviations Spanish already uses** — "ms", "s", "min",
 * "h", "d" — with one decision at the end of the list. Spanish writes the week
 * as "sem.", with a full stop, and the full stop cannot ride inside a unit
 * token: it is this language's *group separator* (`Intl.NumberFormat("es")`
 * gives group "."), so "2sem." would print a character the number lexer claims
 * and the alias index cannot. The dotless contraction "sem" is one letter run,
 * one token, and it is listed in `aliases` so the round trip closes — the same
 * trade `@smartput/power/locale/uk` makes for "к.с." → "кс", and for the same
 * mechanical reason rather than an opinion about orthography.
 */
export default defineVocabulary({
  locale: "es",
  kind: "duration",
  units: {
    ms: {
      aliases: [...alias("ms"), "milisegundo", "milisegundos"],
      symbol: "ms",
      forms: { one: "milisegundo", other: "milisegundos" },
    },
    s: {
      // "seg" is the clipped form a Spanish writer uses as readily as the
      // symbol, and no stripper derives it from "s" — `minStem: 3` would refuse
      // to touch a stem that short in either direction.
      aliases: [...alias("s"), "seg", "segundo", "segundos"],
      symbol: "s",
      forms: { one: "segundo", other: "segundos" },
    },
    min: {
      aliases: [...alias("min"), "minuto", "minutos"],
      symbol: "min",
      forms: { one: "minuto", other: "minutos" },
    },
    h: {
      // "hr"/"hrs" arrive from `units.ts`; the Spanish contraction is "h" alone,
      // which is already there too.
      aliases: [...alias("h"), "hora", "horas"],
      symbol: "h",
      forms: { one: "hora", other: "horas" },
    },
    d: {
      aliases: [...alias("d"), "día", "días", "dia", "dias"],
      symbol: "d",
      forms: { one: "día", other: "días" },
    },
    wk: {
      aliases: [...alias("wk"), "sem", "semana", "semanas"],
      symbol: "sem",
      forms: { one: "semana", other: "semanas" },
    },
  },
});
