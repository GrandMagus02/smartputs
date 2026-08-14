import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * French words for the typographic units — the same six `en`, `uk` and `es`
 * next door name, with the same answer to "does this unit have words at all?":
 * all six do.
 *
 * **Two `forms` keys, and the boundary between them is not English's.**
 * `french.selectForm` returns `one` or `other`, but French puts the singular on
 * everything below two: 0 is `one` ("zéro pixel"), 1 is `one`, and every
 * fraction under two is `one` as well — "1,5 point", where English writes "1.5
 * points". That row is not hypothetical in this kind: a pixel is 1/96 of an
 * inch by default, so almost every conversion out of `px` lands on a fraction,
 * and half of those land below two. `other` starts at 2 and also covers the
 * count-free conversion target (ruling R5), which is what French grammar wants
 * anyway: "1 pouce en points" names the target in the plural. CLDR's third
 * French category is folded into `other` by `fr.ts` because it governs a
 * compact scale word and never the noun beside it, so a third row here would be
 * a word no count could ever select (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so "72 pt" keeps working in a French engine
 * and the micro path (`parseMeasure`) cannot drift from it. That reuse covers
 * half the file outright: `point`, `pica` and `pixel` are spelled identically in
 * French and take the same plain `-s`, so both numbers of each are already in
 * the index and those three entries add no alias of their own — the `forms`
 * rows are what make the French printer say them, and a second copy in
 * `aliases` would be one word claimed twice.
 *
 * The three metric spellings that *are* appended come with their accent-free
 * twins for free rather than by hand, which is unusual enough to name: British
 * English spells `millimetre` and `centimetre` the French way minus the grave,
 * so `units.ts` already holds exactly the strings a French keyboard without
 * dead keys produces. NFKC folding leaves a precomposed `è` as `è` rather than
 * stripping it, so those twins are genuinely different strings to the alias
 * index — `@smartput/length/locale/es` and `@smartput/volume/locale/es` both
 * declare theirs by hand — and here the borrowing has already declared them.
 *
 * The three typographic symbols stay Latin: `pt`, `pc` and `px` are what a
 * French designer writes in a stylesheet, and inventing "po" or "px." would be
 * a word this file made up rather than one anybody types. `mm` and `cm` are the
 * international abbreviations French itself prints. The inch gets its noun,
 * because French has no abbreviation of its own for it and the short form that
 * appears is the English `in` — which is core's conversion keyword in English,
 * so `lex` emits a keyword token for it and no alias index could claim it
 * anyway. That is the same choice `@smartput/length/locale/fr` makes for the
 * same unit, and every symbol here is also an alias, which is what
 * `assertLocaleContract` checks: a printed string the engine cannot read back
 * is the failure.
 *
 * Like `en`, `uk` and `es`, this file names `measure` by **id string** and
 * never imports the kind. `composeLocale` is where the two halves meet — and,
 * as there, a caller has to ask for this vocabulary by name: `measure` is
 * outside `BUILTIN_KINDS` because its `mm`/`cm` aliases collide with `length`,
 * so it is absent from `@smartput/kinds/locale/fr` for exactly the reason the
 * kind is absent from the roster.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "pouce", "pouces"],
      symbol: "pouce",
      forms: { one: "pouce", other: "pouces" },
    },
    mm: {
      aliases: [...alias("mm"), "millimètre", "millimètres"],
      symbol: "mm",
      forms: { one: "millimètre", other: "millimètres" },
    },
    cm: {
      aliases: [...alias("cm"), "centimètre", "centimètres"],
      symbol: "cm",
      forms: { one: "centimètre", other: "centimètres" },
    },
    pt: {
      aliases: [...alias("pt")],
      symbol: "pt",
      forms: { one: "point", other: "points" },
    },
    pc: {
      aliases: [...alias("pc")],
      symbol: "pc",
      forms: { one: "pica", other: "picas" },
    },
    px: {
      aliases: [...alias("px")],
      symbol: "px",
      forms: { one: "pixel", other: "pixels" },
    },
  },
});
