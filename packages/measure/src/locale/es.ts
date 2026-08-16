import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Spanish words for the typographic units — the same six `en` and `uk` next
 * door name, with the same answer to "does this unit have words at all?": all
 * six do.
 *
 * **Two `forms` keys, not eight.** `spanish.selectForm` returns a bare CLDR
 * plural category: `one` for a count of exactly 1, `other` for everything else —
 * 0, a fraction, a missing count (ruling R5), and the multiples of a million
 * CLDR files under `many`, which the language folds in because this engine never
 * prints compact notation. Spanish inflects a unit noun for number and nothing
 * else, so this is the two-row English shape rather than Ukrainian's grid.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so `72 pt` keeps working in a Spanish engine
 * and the micro path (`parseMeasure`) cannot drift from it. The Spanish
 * spellings are appended, singular and plural both, because every string this
 * file *prints* has to be a string it reads.
 *
 * `píxel` is the entry that needs more than a plural rule, and it needs it
 * twice over. Its plural moves the written accent — `píxel` → `píxeles`,
 * because the stress stays on the same syllable while the word grows past the
 * shape that needs the acute — so no suffix rule gets from one to the other,
 * and both are declared. Beside them sit the accent-free spellings a keyboard
 * without dead keys produces: NFKC folding leaves a precomposed `í` as `í`
 * rather than stripping it, so `pixeles` is a different string to the alias
 * index and is declared rather than hoped for, exactly as `es.ts` declares
 * "mas" beside "más" in its own keyword table. The accent-free singular needs
 * no entry of its own: "pixel" is already in `units.ts` as the English name,
 * and one string in the index serves both languages. `milímetro` and
 * `centímetro` get twins of their own for the same reason `píxeles` does;
 * `punto` and `pica` carry no accent and need none.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what a
 * Spanish designer writes in a stylesheet, and inventing `pnt` or `píx` would
 * be a word this file made up rather than one anybody types. `mm` and `cm` are
 * the international abbreviations Spanish itself prints. The inch gets its
 * noun, because Spanish has no abbreviation of its own for it and the short
 * form that appears is the English `in` — which is core's conversion keyword,
 * so `lex` would emit a keyword token for it and no alias index could claim it
 * anyway. That is the same choice `@smartput/length/locale/es` makes for the
 * same unit, and every symbol here is also an alias, which is what
 * `assertLocaleContract` checks: a printed string the engine cannot read back
 * is the failure.
 *
 * Like `en` and `uk`, this file names `measure` by **id string** and never
 * imports the kind. `composeLocale` is where the two halves meet — and, as
 * there, a caller has to ask for this vocabulary by name: `measure` is outside
 * `BUILTIN_KINDS` because its `mm`/`cm` aliases collide with `length`, so it is
 * absent from `@smartput/kinds/locale/es` for exactly the reason the kind is
 * absent from the roster.
 */
export default defineVocabulary({
  locale: "es",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "pulgada", "pulgadas"],
      symbol: "pulgada",
      forms: { one: "pulgada", other: "pulgadas" },
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
      aliases: [...alias("pt"), "punto", "puntos"],
      symbol: "pt",
      forms: { one: "punto", other: "puntos" },
    },
    // The typographic pica, spelled as in English and pluralised the Spanish
    // way — which is the same `-s`, so both spellings arrive from `units.ts`
    // already and this unit adds no alias of its own. The `forms` rows are what
    // make the Spanish printer say them; a second copy in `aliases` would be
    // one word claimed twice.
    pc: {
      aliases: [...alias("pc")],
      symbol: "pc",
      forms: { one: "pica", other: "picas" },
    },
    px: {
      aliases: [...alias("px"), "píxel", "píxeles", "pixeles"],
      symbol: "px",
      forms: { one: "píxel", other: "píxeles" },
    },
  },
});
