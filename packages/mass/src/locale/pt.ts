import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Portuguese words for the mass units — Brazilian under the bare `pt` tag, which
 * is this project's ruling and also what the platform does
 * (`Intl.NumberFormat("pt")` resolves to "." for groups and "," for the
 * decimal). The same six units `en`, `uk` and `es` next door name, and the same
 * per-unit decision: all six are nouns a Portuguese speaker writes out, so all
 * six carry `forms`.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category, and folds CLDR's third Portuguese category — `many`, for the
 * whole multiples of a million — into `other`, because `many` is a fact about
 * the *numeral* ("1 milhão de gramas") rather than about the noun after it, and
 * this engine never prints compact notation. Portuguese inflects a unit noun for
 * number and for nothing else: it has no case, so a conversion target ("em
 * gramas") is spelled exactly like a bare quantity and the slot axis Ukrainian
 * and German need selects nothing here (rule 6). Gender is real and splits this
 * kind down the middle — `o grama`, `o quilograma`, `o miligrama` masculine, `a
 * tonelada`, `a onça`, `a libra` feminine — but it belongs to the *noun*, never
 * to the slot, so it selects nothing and is not a key. What gender would change
 * is the numeral in front ("uma libra", "duzentas libras"), and that is handled
 * one layer up, in `portuguese.renderQuantity` — the only call that sees the
 * spelled numeral and the noun at the same time. This kind is the reason that
 * layer had to learn an exception: `grama`, `quilograma` and `miligrama` end in
 * -a and are **masculine** (the Greek -γραμμα class, "o grama" as in "o
 * programa"), so the morphological rule that makes every other -a noun feminine
 * would print "duzentas gramas" — the mistake half of Brazil makes — where
 * "duzentos gramas" is correct.
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 grama"), and
 * **1,5 selects `one`** as well — "1,5 quilograma", the exact opposite of
 * English's "1.5 kilograms". Both are pinned in `pt.test.ts` beside this file.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Portuguese engine
 * and the micro path (`parseMass`) cannot drift from it. That map's `kilo` and
 * `kilos` are worth a second look, because Portuguese spells the clipping with a
 * `qu` — `quilo`, `quilos` — so unlike Spanish, which gets its everyday word for
 * free from that map, this file has to declare both. They are the words a
 * Brazilian actually says at a market stall ("dois quilos de farinha"), so
 * leaving them to the `k` spelling would mean the commonest input in the
 * language reached the unit only by looking like English.
 *
 * The Portuguese spellings are appended, singular and plural both, because every
 * string this file *prints* has to be a string it reads and a printed plural
 * recovered only by the language's penalised suffix stripper is a reading this
 * vocabulary should not be leaving to a guess. Five of the six plurals are the
 * plain `-s` of a vowel-final noun; `onça` → `onças` is the same rule, and the
 * cedilla it carries is a spelling of the stem rather than a plural class, so
 * nothing here reaches for `portuguese`'s rewriting analyzer. What the cedilla
 * *does* need is an accent-free twin, on the same reasoning as `quilômetro` in
 * `@smartput/length/locale/pt`: NFKC leaves a precomposed `ç` alone, so "onca"
 * is a different string to the alias index and is declared rather than hoped for.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Portuguese itself prints on a scale or a label ("500 g", "1,2 t"), and
 * the spelled singular noun on the two imperial ones. `oz` and `lb` do appear in
 * Brazilian text, but as the English abbreviations they are — `units.ts` already
 * registers both as aliases, so reading them costs this file nothing, while
 * *printing* "8oz" at a reader who typed "onças" would be answering in another
 * language. Ukrainian and Spanish reach the same two symbols by the same
 * reasoning (R8 wants an explicit symbol, never an invented one).
 *
 * Like the others, this file names `mass` by **id string** and never imports the
 * kind, which is what lets `@smartput/mass/locale/pt` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "mass",
  units: {
    // One `l`, unlike English's "milligram": Portuguese borrowed the prefix as
    // `mili-` and doubles no consonant here.
    mg: {
      aliases: [...alias("mg"), "miligrama", "miligramas"],
      symbol: "mg",
      forms: { one: "miligrama", other: "miligramas" },
    },
    g: {
      aliases: [...alias("g"), "grama", "gramas"],
      symbol: "g",
      forms: { one: "grama", other: "gramas" },
    },
    kg: {
      // `quilo`/`quilos` is the Portuguese clipping and is declared here rather
      // than inherited: `units.ts` carries only the `k` spelling, which is
      // English's.
      aliases: [...alias("kg"), "quilograma", "quilogramas", "quilo", "quilos"],
      symbol: "kg",
      forms: { one: "quilograma", other: "quilogramas" },
    },
    t: {
      aliases: [...alias("t"), "tonelada", "toneladas"],
      symbol: "t",
      forms: { one: "tonelada", other: "toneladas" },
    },
    oz: {
      aliases: [...alias("oz"), "onça", "onças", "onca", "oncas"],
      symbol: "onça",
      forms: { one: "onça", other: "onças" },
    },
    lb: {
      aliases: [...alias("lb"), "libra", "libras"],
      symbol: "libra",
      forms: { one: "libra", other: "libras" },
    },
  },
});
