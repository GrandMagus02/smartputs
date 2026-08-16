import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `es`, `de` and `ja` next door make, kept
 * here for only the second of their two reasons — and that reason is enough on
 * its own.
 *
 * Korean's own conversion words are the particles 을, 를 and 에서
 * (`@smartput/core/locale/ko`), so `in` is *not* a keyword token in an engine
 * that speaks only Korean, and the first half of the English argument does not
 * apply. The second half does, and it is locale-blind by construction:
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale, so a Korean entry for `in` would put the word
 * back in front of `@smartput/datetime`'s accept-gate — which refuses any
 * phrase whose words are *all* unit aliases — for any engine that also speaks
 * English or German, and make "in 3 days" an all-units phrase again.
 *
 * A Korean reader types 인치, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Korean words for the length units — the same eight `en`, `uk` and `ja` name,
 * and all eight have words: Korean writes every one of them out in Hangul.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot, because a Korean noun marks number nowhere: 일 미터 and 오 미터 differ
 * in the numeral and nowhere else, and neither a fraction nor a conversion
 * target moves the noun. The suffix 들 is pragmatic rather than grammatical and
 * is never attached to a measured quantity — 미터들 is not Korean — and CLDR
 * agrees, `Intl.PluralRules("ko")` declaring the single category `"other"`. So
 * rule 6's closed key set is one row per unit. This table is `en`'s with the
 * `"one"` row deleted; nothing was renamed.
 *
 * **Korean is spaced, so nothing here depends on a segmenter — the assumption a
 * reader arriving from `ja.ts` or `zh.ts` will wrongly carry over.** Those two
 * had to measure every name against `Intl.Segmenter` because their languages
 * put no space between words at all, and `@smartput/angle/locale/ja` lost a
 * printed word to it (ICU cuts ラジアン into ラジ + アン). Korean has had
 * 띄어쓰기 since the 1896 독립신문 and `lex` has already cut at every space, so
 * `korean` declares no `segment`. ICU still runs over each letter run as the
 * lexer's default and has no Korean dictionary behind it, so it never cuts
 * inside a Hangul run: 킬로미터 and 킬로미터를 alike come back whole.
 * `ko.test.ts` beside this file pins both.
 *
 * **The four metric names are compounds built out of the same prefixes English
 * uses** — 밀리, 센티, 킬로 in front of 미터 — so they look like the German
 * compounds `compoundSplitter` exists for and are nothing of the kind. There is
 * no splitter in `korean.analyze` and no need for one: each compound reaches
 * the alias index as one token and is claimed by an exact entry at weight 0.
 * Nothing has to outrank a morpheme here, because nothing ever finds one.
 *
 * The bare clippings 밀리, 센티 and 킬로 are deliberately **not** listed, on
 * `ja`'s reasoning and for `ja`'s reasons. They are real Korean — 3킬로 걷다 is
 * "walk three kilometres" — but 킬로 is already claimed by
 * `@smartput/mass/locale/ko` for the kilogram, which is the ambiguity a Korean
 * speaker resolves from context and the solver cannot; and 밀리 and 센티 alone
 * would collide with `@smartput/measure/locale/ko` in any engine that installs
 * both. Claiming half of a genuinely ambiguous clipping is worse than claiming
 * none of it, so the whole set stays out and the full compounds carry the
 * reading.
 *
 * **`symbol` is the Latin SI abbreviation on the four metric units, because
 * that is what Korean itself writes**, and the spelled Hangul noun on the four
 * imperial ones, because Korean abbreviates none of those. Where a short form
 * for a foot or a mile appears at all it is the English one, which `units.ts`
 * already registers as an alias — and for the inch that short form is `in`,
 * which this file has just reserved. The typographic variants ㎜, ㎝ and ㎞ are
 * not listed either, for a mechanical reason rather than an editorial one:
 * `normalize()` runs NFKC before anything else sees the input, and NFKC maps ㎞
 * to "km", so a Korean page that sets the squared character is already reading
 * as the Latin alias and an entry here would be a key the lexer can never
 * deliver. R8 wants an explicit symbol on every unit, never an invented or
 * unreachable one.
 *
 * 자, 척 and 리 — the traditional 척관법 measures still heard for a room's size
 * or a distance in a proverb — are **different units** (0.303 m, 0.303 m and
 * 393 m), and this kind has no unit for them to resolve to, so they stay out
 * entirely rather than being approximated onto the nearest metric neighbour.
 * That is the same call `@smartput/measure/locale/de` makes for the Cicero, and
 * 리 has a second reason on top: one syllable, and one of the commonest in the
 * language.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Korean engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "밀리미터"],
      symbol: "mm",
      forms: { other: "밀리미터" },
    },
    cm: {
      aliases: [...alias("cm"), "센티미터"],
      symbol: "cm",
      forms: { other: "센티미터" },
    },
    m: {
      aliases: [...alias("m"), "미터"],
      symbol: "m",
      forms: { other: "미터" },
    },
    km: {
      aliases: [...alias("km"), "킬로미터"],
      symbol: "km",
      forms: { other: "킬로미터" },
    },
    // The unit whose English abbreviation this file reserved away. 인치 is both
    // the word and the symbol, which is what Korean writes for it: a Korean
    // screen is 27인치 and never 27 in.
    in: {
      aliases: [...alias("in"), "인치"],
      symbol: "인치",
      forms: { other: "인치" },
    },
    ft: {
      aliases: [...alias("ft"), "피트"],
      symbol: "피트",
      forms: { other: "피트" },
    },
    yd: {
      aliases: [...alias("yd"), "야드"],
      symbol: "야드",
      forms: { other: "야드" },
    },
    mi: {
      aliases: [...alias("mi"), "마일"],
      symbol: "마일",
      forms: { other: "마일" },
    },
  },
});
