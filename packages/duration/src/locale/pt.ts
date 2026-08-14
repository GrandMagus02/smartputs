import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Portuguese words for the duration units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` is the Brazilian default, which is what the
 * platform resolves it to as well — group ".", decimal ",". A regional variant
 * would be a `Language` with an id of its own rather than a flag here, and not
 * one of the six words below varies across the Atlantic anyway.
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `duration` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parseDuration`) and the engine path
 * agree by construction — including the ambiguity that `"m"` is minutes here and
 * metres in `length`, which is the solver's to rank and not this file's to
 * remove.
 *
 * **Every unit inflects, and every one of them regularly**, which makes this the
 * plainest kind Portuguese has to translate: the language marks number and
 * nothing else on a unit noun, so two rows cover the whole paradigm exactly as
 * they do in English. Every noun here ends in a vowel, so every plural is the
 * plain -s the language's `suffixStripper` also folds; the -es allomorph
 * ("mar" → "mares") and the rewriting classes `pluralReplacer` exists for
 * ("barril" → "barris") never come up in this kind.
 *
 * **`dia` is the row worth stopping at, and it is worth it for what it is
 * *not*.** Like Spanish's `día` it ends in -a and is nevertheless masculine ("um
 * dia", "os dias") — a Greek loan that kept its gender through Latin. Unlike
 * Spanish's, it carries **no accent**: Portuguese stresses "di-a" as two
 * syllables with the stress on the penult, which is the default for a word
 * ending in -a and therefore unmarked. So where `es.ts` had to list "dia" and
 * "dias" beside "día" and "días" to survive a keyboard without diacritics, this
 * file lists one spelling and it is the correct one. The gender itself is
 * invisible to `forms`, and deliberately: see `@smartput/datasize/locale/pt` for
 * why gender is not an axis on `selectForm`. It is not invisible to the
 * *printer*, and this word is why — `portuguese.renderQuantity` names
 * "dia"/"dias" as its one lexical exception, since no ending tells them apart
 * from "caloria", which is feminine and scans identically. Without that entry a
 * spelled duration would print "uma dia".
 *
 * **Symbols are the SI abbreviations Portuguese already uses** — "ms", "s",
 * "min", "h", "d" — with one decision at the end of the list. Portuguese writes
 * the week as "sem.", with a full stop, and the full stop cannot ride inside a
 * unit token: it is this language's *group separator* (`Intl.NumberFormat("pt")`
 * gives group "."), so "2sem." would print a character the number lexer claims
 * and the alias index cannot. The dotless contraction "sem" is one letter run,
 * one token, and it is listed in `aliases` so the round trip closes — the same
 * trade `@smartput/duration/locale/es` makes for the same word and
 * `@smartput/power/locale/uk` makes for "к.с." → "кс", mechanical reasons rather
 * than opinions about orthography.
 *
 * That contraction is also the homograph in this file: "sem" is Portuguese for
 * "without". It is safe because it is not a keyword — `@smartput/core/locale/pt`
 * claims "em", "para", "de", "mais", "menos", "vezes", "por", "dividido",
 * "sobre" and "desconto", and the lexer consults that table before the alias
 * index — so the preposition never reaches this vocabulary at all, and "2 sem"
 * is two weeks in the only reading the engine can build.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "duration",
  units: {
    ms: {
      // "milissegundo" doubles the s, which is the Portuguese rule for a prefix
      // ending in a vowel joined to a stem beginning with one ("milissegundo",
      // "microssegundo"); the single-s spelling is what a Spanish or English
      // speaker types by habit, so it is read and never printed.
      aliases: [
        ...alias("ms"),
        "milissegundo",
        "milissegundos",
        "milisegundo",
        "milisegundos",
      ],
      symbol: "ms",
      forms: { one: "milissegundo", other: "milissegundos" },
    },
    s: {
      // "seg" is the clipped form a Portuguese writer uses as readily as the
      // symbol, and no stripper derives it from "s" — `minStem: 2` would refuse
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
      // "hr"/"hrs" arrive from `units.ts`; the Portuguese contraction is "h"
      // alone, which is already there too.
      aliases: [...alias("h"), "hora", "horas"],
      symbol: "h",
      forms: { one: "hora", other: "horas" },
    },
    d: {
      aliases: [...alias("d"), "dia", "dias"],
      symbol: "d",
      forms: { one: "dia", other: "dias" },
    },
    wk: {
      aliases: [...alias("wk"), "sem", "semana", "semanas"],
      symbol: "sem",
      forms: { one: "semana", other: "semanas" },
    },
  },
});
