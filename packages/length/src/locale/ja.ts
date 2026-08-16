import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `es` and `de` next door make, kept here for
 * only the second of their two reasons — and that reason is enough on its own.
 *
 * Japanese's own conversion particles are を and から
 * (`@smartput/core/locale/ja`), so `in` is *not* a keyword token in an engine
 * that speaks only Japanese, and the first half of the English argument does
 * not apply. The second half does, and it is locale-blind by construction:
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale, so a Japanese entry for `in` would put the word
 * back in front of `@smartput/datetime`'s accept-gate — which refuses any
 * phrase whose words are *all* unit aliases — for any engine that also speaks
 * English or German, and make "in 3 days" an all-units phrase again.
 *
 * A Japanese reader types インチ, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Japanese words for the length units — the same eight `en`, `uk` and `de`
 * name, and all eight have words: Japanese writes every one of them out in
 * katakana.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot, because Japanese has no grammatical number: 一メートル and
 * 五メートル differ in the numeral and nowhere else, and neither a fraction nor
 * a conversion target moves the noun. CLDR agrees — `Intl.PluralRules("ja")`
 * declares the single category `"other"` — so rule 6's "exactly the keys
 * `selectForm` can produce" is one row. This table is `en`'s with the `"one"`
 * row deleted; nothing was renamed.
 *
 * **The four metric names are compounds, and Japanese builds them out of the
 * same prefixes English does** — ミリ, センチ, キロ in front of メートル — so
 * they look like the German compounds `compoundSplitter` exists for and are
 * nothing of the kind. There is no splitter in `japanese.analyze` and no need
 * for one: ICU returns ミリメートル, センチメートル and キロメートル whole
 * (measured, and pinned in `ja.test.ts`), so each reaches the alias index as
 * one token and is claimed by an exact entry at weight 0. Nothing has to
 * outrank a morpheme here, because nothing ever finds one.
 *
 * The bare clippings ミリ, センチ and キロ are deliberately **not** listed.
 * They are real Japanese — 三キロ走る is "run three kilometres" — but キロ is
 * already claimed by `@smartput/mass/locale/ja` for the kilogram, which is the
 * ambiguity a Japanese speaker resolves from context and the solver cannot; and
 * ミリ and センチ alone would collide with `@smartput/measure/locale/ja` in any
 * engine that installs both. Claiming half of a genuinely ambiguous clipping is
 * worse than claiming none of it, so the whole set stays out and the full
 * compounds carry the reading.
 *
 * `symbol` is the SI abbreviation on the four metric units, which is what
 * Japanese itself writes ("5 km", never a kana abbreviation), and the spelled
 * katakana noun on the four imperial ones. Japanese abbreviates none of those:
 * where a short form appears at all it is the English one, which `units.ts`
 * already registers as an alias — and for the inch that short form is `in`,
 * which this file has just reserved. R8 wants an explicit symbol on every unit,
 * never an unreadable one.
 *
 * The kanji unit characters 粍 (mm), 糎 (cm), 米 (m) and 粁 (km) are the
 * pre-war orthography and are left out on the same reasoning as the clippings,
 * only harder: 米 on its own is "rice" and "America" before it is ever a metre,
 * and a single common character claimed as a unit alias is a false reading
 * waiting for the first sentence that contains it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Japanese engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "ミリメートル"],
      symbol: "mm",
      forms: { other: "ミリメートル" },
    },
    cm: {
      aliases: [...alias("cm"), "センチメートル"],
      symbol: "cm",
      forms: { other: "センチメートル" },
    },
    m: {
      aliases: [...alias("m"), "メートル"],
      symbol: "m",
      forms: { other: "メートル" },
    },
    km: {
      aliases: [...alias("km"), "キロメートル"],
      symbol: "km",
      forms: { other: "キロメートル" },
    },
    // The unit whose English abbreviation this file reserved away. インチ is
    // both the word and the symbol, which is what Japanese writes for it: a
    // Japanese screen is 「27インチ」 and never 「27 in」.
    in: {
      aliases: [...alias("in"), "インチ"],
      symbol: "インチ",
      forms: { other: "インチ" },
    },
    ft: {
      aliases: [...alias("ft"), "フィート"],
      symbol: "フィート",
      forms: { other: "フィート" },
    },
    yd: {
      aliases: [...alias("yd"), "ヤード"],
      symbol: "ヤード",
      forms: { other: "ヤード" },
    },
    mi: {
      aliases: [...alias("mi"), "マイル"],
      symbol: "マイル",
      forms: { other: "マイル" },
    },
  },
});
