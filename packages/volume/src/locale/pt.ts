import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Portuguese words for the volume units — Brazilian under the bare `pt` tag,
 * which is this project's ruling and also what the platform does
 * (`Intl.NumberFormat("pt")` resolves to "." for groups and "," for the
 * decimal). The same five units `en`, `uk` and `es` next door name, and the same
 * per-unit decision about whether a unit has words at all.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category, and folds CLDR's third Portuguese category — `many`, for the
 * whole multiples of a million — into `other`, because `many` is a fact about
 * the *numeral* ("1 milhão de litros") rather than about the noun after it.
 * Portuguese inflects a unit noun for number and for nothing else: it has no
 * case, so a conversion target ("em litros") is spelled exactly like a bare
 * quantity and the slot axis Ukrainian and German need selects nothing here
 * (rule 6). Gender (masculine `o litro`, `o galão`; feminine `a pinta`) is a
 * property of the noun and selects nothing either.
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 litro"), and
 * **1,5 selects `one`** as well — "1,5 litro", the exact opposite of English's
 * "1.5 litres". Both are pinned in `pt.test.ts` beside this file.
 *
 * **`m3` carries no `forms`, exactly as `en`, `uk` and `es` carry none**, and in
 * Portuguese the reason is the sharp one Spanish has rather than the soft one
 * Ukrainian has: the name is "metro cúbico", *two* words. `lex` builds a word
 * token out of a run of letters, so a space ends it and no single analyzer is
 * ever handed the phrase — a two-word alias could never be reached by the index
 * that would have to hold it, and a two-word `form` would be text the printer
 * emits and the parser refuses (`assertLocaleContract` says exactly that).
 * Portuguese has no one-word colloquial name to fall back on the way Ukrainian
 * has "кубометр": Brazilian usage says "metro cúbico" or writes "m³", and
 * "cubo" means a shape. So `m3` reads and prints through `m³` alone.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Portuguese engine and
 * the micro path (`parseVolume`) cannot drift from it. The Portuguese spellings
 * are appended, singular and plural both, because every string this file
 * *prints* has to be a string it reads.
 *
 * `galão` is the entry this kind exists to demonstrate, and the reason
 * `@smartput/core/locale/pt` ships a `pluralReplacer` at all: `galão` → `galões`
 * *replaces* an ending rather than adding to one, and no amount of cutting turns
 * "galões" into "galão" — the plain suffix stripper structurally cannot reach
 * it. The language's rewriting analyzer does reach it, at a penalty, and both
 * spellings are declared here anyway, because a word this table prints should
 * never come back through a penalised guess (rule 5). The accent-free twins sit
 * beside them for the third reason: NFKC leaves a precomposed `ã`/`õ` alone, so
 * "galao" and "galoes" are different strings to the alias index.
 *
 * `pint` has two names and they belong to different centuries. `pinta` is the
 * transparent borrowing a Brazilian reader parses on sight, and `quartilho` is
 * the historical Portuguese measure a European text still uses for the same
 * thing. Both are read; `pinta` is what gets printed, because the printer has to
 * pick one and an unqualified number in a Brazilian engine is likelier to have
 * meant the borrowing.
 *
 * `symbol` is the international abbreviation where Portuguese itself abbreviates
 * (`l`, `ml`, `m³`) and the spelled singular noun where it does not. `gal` is the
 * English clipping riding in from `units.ts` — it stays an alias, so it reads —
 * but printing "3gal" at a reader who typed "galões" would be answering in
 * another language, and `pinta` has no abbreviation in any register. R8 wants an
 * explicit symbol on every unit, never an invented one.
 *
 * Like the others, this file names `volume` by **id string** and never imports
 * the kind, which is what lets `@smartput/volume/locale/pt` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "litro", "litros"],
      symbol: "l",
      forms: { one: "litro", other: "litros" },
    },
    // One `l` in the prefix, unlike English's "millilitre": Portuguese borrowed
    // it as `mili-` and doubles no consonant.
    ml: {
      aliases: [...alias("ml"), "mililitro", "mililitros"],
      symbol: "ml",
      forms: { one: "mililitro", other: "mililitros" },
    },
    m3: { aliases: [...alias("m3")], symbol: "m³" },
    gal: {
      aliases: [...alias("gal"), "galão", "galões", "galao", "galoes"],
      symbol: "galão",
      forms: { one: "galão", other: "galões" },
    },
    pint: {
      aliases: [...alias("pint"), "pinta", "pintas", "quartilho", "quartilhos"],
      symbol: "pinta",
      forms: { one: "pinta", other: "pintas" },
    },
  },
});
