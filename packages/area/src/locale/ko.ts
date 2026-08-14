import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Korean words for the area units — the same five `en`, `uk` and `ja` name, and
 * **the same answer `ja` and `de` give** to the question the squared units
 * pose: all five carry `forms`.
 *
 * **The squared units are printable here, where `en` and `uk` refuse them.**
 * Their reason was never that the unit is unspeakable; it was that the spoken
 * name is a *phrase* — "square metres", "квадратних метрів" — and `lex` ends a
 * word token at a space, so no single analyzer is ever handed the whole thing.
 * A printed phrase is text the parser cannot read back, and
 * `assertLocaleContract` fails it by name. Korean writes the same concept as
 * one word, 제곱미터, with no space in it: the prefix 제곱- ("squared") is bound,
 * exactly as German's Quadrat- is, so Korean reaches the same place German does
 * by compounding rather than by separating.
 *
 * **And unlike Japanese, that costs no measurement — which is the assumption a
 * reader arriving from `ja.ts` or `zh.ts` will wrongly carry over.**
 * `@smartput/area/locale/ja` had to prove that ICU returns 平方メートル whole,
 * because Japanese puts no space between words at all and the segmenter is the
 * only thing between a letter run and the alias index; the same measurement in
 * the same package cost `@smartput/angle/locale/ja` a printed word. Korean has
 * had 띄어쓰기 since the 1896 독립신문, `lex` has already cut at every space, and
 * `korean` declares no `segment` for that reason. ICU still runs over each
 * letter run as the lexer's default and has no Korean dictionary behind it, so
 * it never cuts inside a Hangul run — 제곱센티미터 comes back whole because
 * there is nothing in ICU that could cut it. `ko.test.ts` pins that anyway,
 * since it is the fact three of these five units are printable on.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot — a Korean noun marks number nowhere, the pragmatic 들 is never attached
 * to a measured quantity, and CLDR's `Intl.PluralRules("ko")` declares the
 * single category `"other"` — so rule 6's closed key set is one row per unit.
 * This table is `en`'s with the `"one"` row deleted; nothing was renamed.
 *
 * `symbol` is what Korean itself writes. The three squared units keep the SI
 * superscripts, which a Korean page sets exactly as an English one does and
 * which `units.ts` already registers as aliases; `ha` is the hectare's
 * international abbreviation and is what Korean agricultural writing uses; and
 * the acre gets its spelled Hangul noun, because Korean has no short form for a
 * unit it only ever meets in translation. R8 wants an explicit symbol on every
 * unit, never an invented one.
 *
 * 평방미터 and 평 are the two words a Korean estate agent actually writes, and
 * only the first of them is here. 평방미터 is a *spelling* of the square metre —
 * same unit, the older Sino-Korean calque of the same 平方 that Japanese still
 * uses — so it is listed as an alias, though never printed: 제곱미터 is the
 * form that pairs with 제곱센티미터 and 제곱킬로미터, it is the one the 표준
 * orthography prescribes, and a table that printed one of the three in a
 * different register would read as an accident. 평 is a **different unit** —
 * 3.3058 m², the traditional measure a Korean flat is still advertised in, and
 * the same unit Japanese calls 坪 — and this kind has no unit for it to resolve
 * to, so it stays out entirely rather than being approximated, on the same
 * reasoning that keeps `Cicero` out of `@smartput/measure/locale/de`. It is one
 * syllable besides, and one of the commonest in the language.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Korean engine and
 * the micro path (`parseArea`) cannot drift from it. That map already carries
 * the superscript spellings `m²`, `cm²` and `km²`, which Korean writes
 * unchanged.
 *
 * Like `en`, this file names `area` by **id string** and never imports the
 * kind, which is what lets `@smartput/area/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "area",
  units: {
    m2: {
      aliases: [...alias("m2"), "제곱미터", "평방미터"],
      symbol: "m²",
      forms: { other: "제곱미터" },
    },
    cm2: {
      aliases: [...alias("cm2"), "제곱센티미터", "평방센티미터"],
      symbol: "cm²",
      forms: { other: "제곱센티미터" },
    },
    km2: {
      aliases: [...alias("km2"), "제곱킬로미터", "평방킬로미터"],
      symbol: "km²",
      forms: { other: "제곱킬로미터" },
    },
    hectare: {
      aliases: [...alias("hectare"), "헥타르"],
      symbol: "ha",
      forms: { other: "헥타르" },
    },
    acre: {
      aliases: [...alias("acre"), "에이커"],
      symbol: "에이커",
      forms: { other: "에이커" },
    },
  },
});
