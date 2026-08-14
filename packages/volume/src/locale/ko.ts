import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Korean words for the volume units — the same five `en`, `uk` and `ja` name,
 * and **the same answer `ja` and `de` give** to the one question that divides
 * them: all five carry `forms`, `m3` included.
 *
 * **`m3` is printable here, where `en` and `uk` both refuse it.** Their reason
 * was never that the unit is unspeakable; it was that the spoken name is a
 * phrase — "cubic metres", "кубічних метрів" — and `lex` ends a word token at a
 * space, so no single analyzer is ever handed the whole thing. A printed phrase
 * is text the parser cannot read back, and `assertLocaleContract` fails it by
 * name. Korean writes 세제곱미터 as one word: 세제곱- ("cubed") is a bound
 * prefix, exactly as German's Kubik- is, so Korean reaches the same place
 * German does by compounding rather than by separating.
 *
 * **And unlike Japanese, that costs no measurement — the assumption a reader
 * arriving from `ja.ts` or `zh.ts` will wrongly carry over.**
 * `@smartput/volume/locale/ja` had to prove ICU returns 立方メートル whole,
 * because Japanese puts no space between words at all and the segmenter is the
 * only thing between a letter run and the alias index; the same measurement in
 * `@smartput/angle/locale/ja` cost that file a printed word. Korean has had
 * 띄어쓰기 since the 1896 독립신문, `lex` has already cut at every space, and
 * `korean` declares no `segment` for that reason. ICU still runs over each
 * letter run as the lexer's default and has no Korean dictionary behind it, so
 * it never cuts inside a Hangul run — 세제곱미터 comes back whole because there
 * is nothing in ICU that could cut it. `ko.test.ts` pins that anyway, since it
 * is the fact this unit's printability rests on.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot — a Korean noun marks number nowhere, the pragmatic 들 is never attached
 * to a measured quantity, and CLDR's `Intl.PluralRules("ko")` declares the
 * single category `"other"` — so rule 6's closed key set is one row per unit.
 * This table is `en`'s with the `"one"` row deleted; nothing was renamed.
 *
 * `symbol` is what Korean itself writes: `l` and `ml` are the SI abbreviations,
 * used unchanged, `m³` is the superscript a Korean page sets exactly as an
 * English one does, and the two imperial units get their spelled Hangul nouns
 * because Korean has no short form for either — 갤런 and 파인트 appear only in
 * translation, and the English `gal` that `units.ts` already registers is not
 * the *Korean* abbreviation for anything.
 *
 * ℓ and ㎖ are the two characters a Korean carton is actually printed with, and
 * neither is listed — for a mechanical reason rather than an editorial one.
 * `normalize()` runs NFKC before anything else sees the input, and NFKC maps ℓ
 * to "l" and ㎖ to "ml", so a label that writes either is already reading as the
 * Latin alias `units.ts` declares. An entry here would be a key the lexer can
 * never deliver, and a `symbol` of ℓ would be a printed string the alias index
 * has no folded form of. R8 wants an explicit symbol on every unit, never an
 * invented or unreachable one.
 *
 * 입방미터 is the older Sino-Korean calque of the same unit — the same 立方 that
 * Japanese still uses — so it is listed as an alias and never printed, on the
 * same split `@smartput/area/locale/ko` makes for 평방미터: 세제곱미터 is what
 * the 표준 orthography prescribes and what pairs with the rest of the metric
 * table. The traditional 되 and 말 are **different units** (1.8039 ℓ and
 * 18.039 ℓ, the measures rice and grain were sold in, and the same pair
 * Japanese calls 升 and 斗) and this kind has no unit for them to resolve to, so
 * they stay out entirely rather than being approximated — 말 has a second
 * reason on top, being one syllable and one of the commonest words in the
 * language.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Korean engine and
 * the micro path (`parseVolume`) cannot drift from it.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "리터"],
      symbol: "l",
      forms: { other: "리터" },
    },
    ml: {
      aliases: [...alias("ml"), "밀리리터"],
      symbol: "ml",
      forms: { other: "밀리리터" },
    },
    // The unit `en` and `uk` could not print. 세제곱미터 is one token, it is
    // listed exactly below, and it round-trips — so a Korean engine answers
    // 1.5세제곱미터 where an English one answers "1.5m³".
    m3: {
      aliases: [...alias("m3"), "세제곱미터", "입방미터"],
      symbol: "m³",
      forms: { other: "세제곱미터" },
    },
    gal: {
      aliases: [...alias("gal"), "갤런"],
      symbol: "갤런",
      forms: { other: "갤런" },
    },
    pint: {
      aliases: [...alias("pint"), "파인트"],
      symbol: "파인트",
      forms: { other: "파인트" },
    },
  },
});
