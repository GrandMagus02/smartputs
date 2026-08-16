import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Chinese words for the volume units — Simplified, mainland conventions, which
 * is what the bare tag `zh` means throughout this repo. Four of the five print a
 * Chinese word, and the two units that decide it are not the ones `en` and `uk`
 * had trouble with.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot — Chinese marks number nowhere on a noun, and CLDR's
 * `Intl.PluralRules("zh")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit. **A one-row table is the correct answer
 * here and not a stub**: it is `en`'s with the `"one"` row deleted, nothing
 * renamed, and it is the language rather than a translator stopping halfway.
 *
 * **`m3` is printable here, where `en` and `uk` both refuse it.** Their reason
 * was never that the unit is unspeakable; it was that the spoken name is a
 * phrase — "cubic metres" — and `lex` ends a word token at a space, so no single
 * analyzer is ever handed the whole thing. Chinese writes 立方米 with no space in
 * it, so the reason does not apply. That claim is about ICU rather than about
 * orthography, though, and it was **measured before it was relied on**: Chinese
 * puts no space between words, so `chinese.segment` is the only thing standing
 * between a letter run and the alias index, and `Intl.Segmenter` returns 立方米
 * whole. `zh.test.ts` pins it.
 *
 * **`pint` is the unit that pays for that check.** Chinese for a pint is 品脱
 * and ICU cuts it into 品 + 脱 — a two-piece fallback break, the same shape it
 * gives 像素 in `@smartput/measure/locale/zh` — so 5品脱 reaches `lex` as two
 * word tokens and dies in the parser. The word is therefore not listed at all,
 * on the rule `@smartput/angle/locale/ja` states for ラジアン: an alias `lex` can
 * never produce is dead weight in the index, and completion would happily offer
 * it and hand the user text that fails to evaluate. `pint` carries no `forms`
 * and renders through its symbol, which round-trips because a Latin run has no
 * character of a declared script and `scriptSegmenter` returns it whole. That
 * symbol is the Latin word `units.ts` already registers rather than a Chinese
 * abbreviation, because Chinese has no abbreviation for a pint to borrow — R8
 * wants an explicit symbol on every unit, never an invented one, and never an
 * unreadable one.
 *
 * `symbol` is otherwise what Chinese itself writes: `l` and `ml` are the SI
 * abbreviations, used unchanged on every Chinese bottle and syringe, `m³` is the
 * superscript a Chinese page sets exactly as an English one does, and the gallon
 * gets its spelled noun 加仑 because Chinese has no short form for it either.
 *
 * **The traditional dry and liquid measures are absent.** 升 in this table is the
 * modern litre, which is what the character means in every contemporary
 * register; 斗 (10 市升) and 合 (a tenth of one) belong to the market system,
 * this kind declares no unit for them, and they stay out rather than being
 * approximated — the same judgement `@smartput/mass/locale/zh` makes about 斤 and
 * `@smartput/area/locale/zh` about 亩.
 *
 * 立米 is a different case and is here. It is not another unit but the colloquial
 * reading of the cubic metre — what a Chinese builder writes where an engineer
 * writes 立方米 — so it is listed as an alias and never printed, on the same
 * split `@smartput/area/locale/zh` makes for 平米.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Chinese engine and
 * the micro path (`parseVolume`) cannot drift from it.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/zh` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "volume",
  units: {
    // 公升 is the fuller name of the same unit — the one a Taiwanese label and a
    // Chinese fuel pump both use — and is read, never written: 升 is what pairs
    // with 毫升 below.
    l: {
      aliases: [...alias("l"), "升", "公升"],
      symbol: "l",
      forms: { other: "升" },
    },
    ml: {
      aliases: [...alias("ml"), "毫升"],
      symbol: "ml",
      forms: { other: "毫升" },
    },
    // The unit `en` and `uk` could not print. 立方米 is one token, it is listed
    // exactly below, and it round-trips — so a Chinese engine answers 1.5立方米
    // where an English one answers "1.5m³".
    m3: {
      aliases: [...alias("m3"), "立方米", "立米", "立方公尺"],
      symbol: "m³",
      forms: { other: "立方米" },
    },
    gal: {
      aliases: [...alias("gal"), "加仑"],
      symbol: "加仑",
      forms: { other: "加仑" },
    },
    // The one unit in this package with no `forms` at all. See the doc comment
    // above: ICU cuts 品脱 in two, so the Chinese word cannot be read back and
    // is not listed, and the symbol is what is left.
    pint: {
      aliases: alias("pint"),
      symbol: "pint",
    },
  },
});
