import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Portuguese words for the typographic units — Brazilian under the bare `pt`
 * tag, which is this project's ruling and also what the platform does
 * (`Intl.NumberFormat("pt")` resolves to "." for groups and "," for the
 * decimal). The same six units `en`, `uk` and `es` next door name, with the same
 * answer to "does this unit have words at all?": all six do.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category, and folds CLDR's third Portuguese category — `many`, for the
 * whole multiples of a million — into `other`, because `many` is a fact about
 * the *numeral* ("1 milhão de pixels") rather than about the noun after it.
 * Portuguese inflects a unit noun for number and for nothing else: it has no
 * case, so a conversion target ("em pontos") is spelled exactly like a bare
 * quantity and the slot axis Ukrainian and German need selects nothing here
 * (rule 6).
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 ponto"), and
 * **1,5 selects `one`** as well. The second one matters more here than in any
 * other kind in this batch, because typographic arithmetic lands on fractions
 * constantly: "1 polegada - 12 pontos" is 0,8333… of an inch, whose integer part
 * is 0, so Portuguese writes it **"0,8333… polegada"** — singular, where English
 * writes "inches". `pt.test.ts` beside this file pins exactly that string.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so `72 pt` keeps working in a Portuguese
 * engine and the micro path (`parseMeasure`) cannot drift from it. The
 * Portuguese spellings are appended, singular and plural both, because every
 * string this file *prints* has to be a string it reads.
 *
 * Beside each accented spelling sits its accent-free twin (`milimetro` next to
 * `milímetro`). That is not redundancy: NFKC folding leaves a precomposed `í` as
 * `í` rather than decomposing and stripping it, so the two are different strings
 * to the alias index, and `@smartput/core/locale/pt-cardinals` declares "tres"
 * beside "três" for exactly this reason. The stripper cannot rescue them either
 * — it removes a suffix, and what changes here is a letter in the stem. `ponto`
 * and `polegada` carry no accent and need no twin.
 *
 * Two entries are decisions rather than translations:
 *
 *   **`pc` prints `paica`.** That is the Brazilian typographic term for the
 *   twelve-point measure; `pica` is the international spelling and arrives
 *   already registered from `units.ts`, so it reads without an entry here. Both
 *   are understood and the Brazilian one is written, which is what the bare `pt`
 *   tag means throughout this repo.
 *
 *   **`px` prints `pixels`, not `píxeis`.** Brazil writes the loanword with the
 *   English `-s` plural and no accent — that pair is already in `units.ts` as the
 *   English name, so the printed forms cost this file no alias at all. Portugal
 *   writes `píxel` → `píxeis`, which is the `-l` → `-is` rewriting class
 *   `portuguese`'s own analyzer carries; both spellings are listed so a European
 *   reader is understood, along with the accent-free `pixeis`, and neither is
 *   printed.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what a
 * Brazilian designer writes in a stylesheet, and inventing `pnt` or `pca` would
 * be a word this file made up rather than one anybody types. `mm` and `cm` are
 * the international abbreviations Portuguese itself prints. The inch gets its
 * noun, because Portuguese has no abbreviation of its own for it and the short
 * form that appears is the English `in` — which is core's conversion keyword, so
 * `lex` would emit a keyword token for it and no alias index could claim it
 * anyway. That is the same choice `@smartput/length/locale/pt` makes for the
 * same unit, and every symbol here is also an alias, which is what
 * `assertLocaleContract` checks: a printed string the engine cannot read back is
 * the failure.
 *
 * Like the others, this file names `measure` by **id string** and never imports
 * the kind. `composeLocale` is where the two halves meet — and, as there, a
 * caller has to ask for this vocabulary by name: `measure` is outside
 * `BUILTIN_KINDS` because its `mm`/`cm` aliases collide with `length`, so it is
 * absent from `@smartput/kinds/locale/pt` for exactly the reason the kind is
 * absent from the roster.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "polegada", "polegadas"],
      symbol: "polegada",
      forms: { one: "polegada", other: "polegadas" },
    },
    mm: {
      aliases: [...alias("mm"), "milímetro", "milímetros", "milimetro", "milimetros"],
      symbol: "mm",
      forms: { one: "milímetro", other: "milímetros" },
    },
    cm: {
      aliases: [...alias("cm"), "centímetro", "centímetros", "centimetro", "centimetros"],
      symbol: "cm",
      forms: { one: "centímetro", other: "centímetros" },
    },
    pt: {
      aliases: [...alias("pt"), "ponto", "pontos"],
      symbol: "pt",
      forms: { one: "ponto", other: "pontos" },
    },
    // `pica`/`picas` arrive from `units.ts` and stay readable; `paica` is the
    // Brazilian spelling and is what the printer says.
    pc: {
      aliases: [...alias("pc"), "paica", "paicas"],
      symbol: "pc",
      forms: { one: "paica", other: "paicas" },
    },
    // `pixel`/`pixels` come from `units.ts` — the English name is also the
    // Brazilian one — so only the European spellings are added, for reading.
    px: {
      aliases: [...alias("px"), "píxel", "píxeis", "pixeis"],
      symbol: "px",
      forms: { one: "pixel", other: "pixels" },
    },
  },
});
