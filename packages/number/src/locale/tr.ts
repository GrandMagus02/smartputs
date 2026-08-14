import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Turkish words for the number "units" — and, as in every sibling row of this
 * phase, the finding is that there are none.
 *
 * `en` reached that conclusion because a bare count is not a quantity of anything;
 * `uk` reached it again after checking that a second grammatical axis had nothing
 * here to inflect; `ja`, `zh` and `id` reached it a third way, through the
 * counter word that a bare number has no noun to choose. **Turkish reaches it by
 * that third route, and it is the strongest version of the argument in the repo,
 * because Turkish uses its counter after the numeral rather than before it** —
 * "beş tane", "beş adet" — which is exactly the position an alias index can see,
 * so unlike Chinese's prefixed 百分之 the word is not out of reach for a
 * structural reason. It is left out for a semantic one: *tane* is "piece" and
 * *adet* is "item", and both count discrete objects. Claiming either would assert
 * that every bare number this engine reads is a number *of things*, so "5 tane"
 * would answer 5 where the user asked about five apples and got a unit label
 * instead. The abstract nouns are *sayı* (a number) and *rakam* (a digit), which
 * are what English "number" and Ukrainian "одиниця" are, and nobody counts five
 * of those either.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays here untranslated. It is machinery rather
 * than a word a Turkish reader types: `formatNumber` emits `` `${raw}${unit}` ``
 * — "7,25one" — and strict `parseNumber` has to read that back in any locale, so
 * the alias is locale-free by construction.
 *
 * **It is live under `tr` where `en` shadows it, and Turkish gets there by a
 * route none of the other Latin-alphabet siblings took.** English's cardinal
 * parser claims the word "one" before the alias index is consulted, so
 * `en.test.ts` asserts that `1one` throws. Indonesian leaves the alias live by
 * shipping no `numerals` at all. Turkish **does** ship numerals — the shared
 * `cardinalNumerals` reads its table unmodified, which is a claim `@smartput/core`
 * makes about no other language here except Ukrainian — and the alias survives
 * anyway, because `CARDINALS` holds no Latin "one": the Turkish word is *bir*.
 * Two live tables in one alphabet that simply do not overlap.
 *
 * **The suffix stripper is the one thing that could have collided, and the floor
 * is what stops it.** `-e` is the Turkish dative, so a stripper with a low floor
 * would offer "on" as a stem of "one" — and *on* is Turkish for ten, sitting in
 * `CARDINALS.tens`. `@smartput/core/locale/tr` sets `minStem: 3`, so the strip is
 * refused before it is offered, and the numeral table is unreachable from here in
 * any case: `numerals` is handed the lexer's own words, never an analyzer's
 * forms. Both halves are pinned in `tr.test.ts`, because a reading of "1one" as
 * eleven would be a wrong answer with every character claimed.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit precisely so the renderer's no-symbol branch
 * stays unreachable, and `""` is the value `toLexeme` computed here. Turkish
 * *does* declare a `renderQuantity` — it spaces a bare symbol, "5 kg" rather than
 * English's "5kg" — and it is never reached for this unit, because `formatValue`
 * returns the bare number text on `NUMBER_KIND` before any symbol is read. The
 * space that override would have inserted is therefore invisible here, and
 * `tr.test.ts` says so rather than leaving the reader to wonder whether "7,25"
 * should have come back with a trailing blank.
 *
 * There are no `forms`. Under `tr` that is **one** row being left out rather than
 * `uk`'s eight: `turkish.selectForm` returns the constant `"other"` for every
 * count and every slot, because a counted Turkish noun is bare — "1 kilogram",
 * "5 kilogram", never "5 kilogramlar". The row would still be a fabrication, for
 * `en`'s reason: nothing renders a word for this unit.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});
