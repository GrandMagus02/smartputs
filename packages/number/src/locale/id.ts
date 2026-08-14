import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Indonesian words for the number "units" — and, as in every sibling row of this
 * phase, the interesting result is that there are none.
 *
 * `en` reached the no-words conclusion because a bare count is not a quantity of
 * anything; `uk` reached it again after checking that a second grammatical axis had
 * nothing here to inflect; `ja` and `zh` reached it a third way, through the
 * counter/measure word that a bare number has no noun to choose. Indonesian reaches
 * it by that third route as well, and the construction is the same one under a
 * different name: this language has **classifiers** — *buah* for objects, *orang*
 * for people, *ekor* for animals, *batang* for long thin things — and "lima buah"
 * is five *of something round or inanimate*, never five in the abstract. Which
 * classifier is right depends on the noun and not on the number, so a count with no
 * noun behind it has none to take, and picking *buah* because it is the general one
 * would assert that every bare number in this engine counts discrete objects. The
 * abstract nouns are *angka* (a digit, a figure) and *bilangan* (a number in the
 * mathematical sense), which is exactly what English "number" and Ukrainian
 * "одиниця" are, and nobody counts five of those either.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused rather
 * than retyped, and it stays here untranslated. It is machinery rather than a word
 * an Indonesian reader types: `formatNumber` emits `` `${raw}${unit}` `` —
 * "7.25one" — and strict `parseNumber` has to read that back in any locale, so the
 * alias is locale-free by construction.
 *
 * **It is also *live* under `id` where it is dead under `en`, and for a reason
 * peculiar to this language.** English's cardinal parser claims the word "one"
 * before the alias index is consulted, so `en.test.ts` asserts that `1one` throws;
 * `chinese.numerals` reads Han only, so the alias is live under `zh` because nothing
 * Chinese collides with Latin letters. Indonesian *is* written in the Latin
 * alphabet and still does not shadow it, because `@smartput/core/locale/id` declares
 * **no `numerals` at all** — measured, not forgotten: Indonesian has two multiplying
 * morphemes below a thousand (*puluh* ×10, *ratus* ×100) where `cardinalNumerals`
 * flushes a group only at ≥1000, so the most charitable table reads "seratus dua
 * puluh lima" as 1025 where Indonesian says 125. A parser that returns the wrong
 * number with every word claimed is worse than no parser, so that file ships none
 * and records the measurement. The consequence lands here: this is the package where
 * a missing numeral fold is visible, since a bare arithmetic expression is its whole
 * input. "satu" and "dua puluh lima" do not parse, and `id.test.ts` pins that as a
 * gap rather than leaving it to be rediscovered as a bug.
 *
 * None of those words is listed as an alias to paper over it. An alias resolves to
 * the *unit* `one`, not to a magnitude — "dua puluh lima" would read as the number
 * 1 with a unit label, not as 25 — so listing a cardinal here would answer a
 * question nobody asked with a number nobody meant. The repair is an Indonesian
 * `NumeralParser` in `id-cardinals.ts`, which is a file rather than a change to this
 * one.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit precisely so the renderer's no-symbol branch stays
 * unreachable, and `""` is the value `toLexeme` computed here. Indonesian declares no
 * `renderQuantity`, so the default template applies and a symbol is set tight — which
 * for the empty string is the same string either way, and is never reached at all,
 * because `formatValue` returns the bare number text on `NUMBER_KIND` before any
 * symbol is read.
 *
 * There are no `forms`. Under `id` that is **one** row being left out rather than
 * eight, which is the floor `@smartput/core/locale/id` exists to demonstrate:
 * `indonesian.selectForm` returns the constant `"other"` for every count and every
 * slot, because nothing in this language agrees with a numeral — plurality is
 * reduplication ("buku-buku") or context, and neither survives a number. The row
 * would still be a fabrication, for `en`'s reason: nothing renders a word for this
 * unit.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "id",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});
