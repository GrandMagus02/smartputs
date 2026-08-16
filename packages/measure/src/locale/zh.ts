import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Chinese words for the typographic units — Simplified, mainland conventions,
 * which is what the bare tag `zh` means throughout this repo. Four of the six
 * print a Chinese word, and the two that do not are the two ICU refuses to hand
 * back whole.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot — Chinese marks number nowhere on a noun, and CLDR's
 * `Intl.PluralRules("zh")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit. **A one-row table is the correct answer
 * and not a stub**: it is `en`'s with the `"one"` row deleted, nothing renamed,
 * and it is the language rather than a translator stopping halfway.
 *
 * **像素 and 派卡 are cut in two by ICU, and that decides two of the six rows.**
 * Chinese writes no space between words, so `chinese.segment` — `Intl.Segmenter`
 * scoped to Han — is the only thing standing between a letter run and the alias
 * index, and ICU's Chinese dictionary is an approximation with holes in it. 像素
 * is not an obscure word (it is *the* word for a pixel, in every stylesheet and
 * every camera specification) and ICU still breaks it into 像 + 素; 派卡 and its
 * variant spelling 皮卡 go the same way. So 100像素 reaches `lex` as two word
 * tokens and dies in the parser, and neither word is listed even as an alias, on
 * the rule `@smartput/angle/locale/ja` states for ラジアン: an alias `lex` can
 * never produce is dead weight in the index, and completion would happily offer
 * it and hand the user text that fails to evaluate. `px` and `pc` therefore
 * carry no `forms` and render through their symbols, `100px` and `6pc`, which is
 * what a Chinese stylesheet and a Chinese typesetter write anyway and which
 * round-trips: a Latin run has no character of a declared script, so
 * `scriptSegmenter` returns it whole. `zh.test.ts` beside this file pins the ICU
 * cut directly, because a check on shape alone cannot see it —
 * `assertLocaleContract` reads the alias index and the analyzer chain, and never
 * the segmenter.
 *
 * **磅 is the point, and it collides with the pound on purpose.** A Chinese word
 * processor labels its font-size box 磅, and that is the word a Chinese designer
 * types for a typographic point; the same character is the pound in
 * `@smartput/mass/locale/zh`. An engine that installs both kinds gets two
 * readings and settles them by weight — which is exactly the state `measure` is
 * already in against `length`, whose 毫米 and 厘米 are the same two words this
 * table needs, and the reason `measure` sits outside `BUILTIN_KINDS` to begin
 * with. Dropping the word from either side would cost a real reading to avoid an
 * ambiguity Chinese itself has.
 *
 * 点 is the rejected alternative for the same unit, and it is rejected on
 * frequency. It is a correct name for a point (点数 is the point size of a
 * face), and it is also the character for an o'clock — 3点 is three in the
 * afternoon long before it is a three-point rule — so claiming it would put a
 * unit reading in front of every time anybody types. That is the judgement
 * `@smartput/angle/locale/ja` makes about 回, reached by the same route.
 *
 * **級 and 齿 have no equivalent trap here and are simply not units of this
 * kind.** Chinese phototypesetting inherited the Japanese 級 (a quarter of a
 * millimetre) through Hong Kong and Taiwan trade practice, and a quarter of a
 * millimetre is not a point, not a pica and not a pixel; this kind declares no
 * unit for it, so the word stays out rather than being bent onto the nearest
 * one, on the reasoning `@smartput/measure/locale/de` gives for the Cicero. A
 * `NoCandidateError` says "this engine does not know 級"; a 30 % error says
 * nothing at all.
 *
 * `symbol` is what Chinese itself writes: `mm` and `cm` are the SI
 * abbreviations, unchanged from the Latin on every Chinese ruler; `pt`, `pc` and
 * `px` are what a Chinese stylesheet contains, and inventing a hanzi short form
 * for any of them would be a word this file made up rather than one anybody
 * uses. The inch gets its spelled noun 英寸, because Chinese writes 27英寸 with
 * no abbreviation at all. R8 wants an explicit symbol on every unit, never an
 * invented one and never an unreadable one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a Chinese engine and
 * the micro path (`parseMeasure`) cannot drift from it.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its mm/cm aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/zh` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "英寸", "吋"],
      symbol: "英寸",
      forms: { other: "英寸" },
    },
    // 公厘 beside 公分 below, for the reason `@smartput/length/locale/zh` gives:
    // it is the Taiwanese name for the millimetre, it comes back from ICU
    // whole, and a table that reads one member of the 公- series and not the
    // next is inconsistent rather than selective. These two rows are the same
    // two words `length` carries, deliberately — this kind's mm and cm collide
    // with that kind's by design, which is why `measure` sits outside
    // `BUILTIN_KINDS` — so the two alias lists have to stay identical.
    mm: {
      aliases: [...alias("mm"), "毫米", "公厘"],
      symbol: "mm",
      forms: { other: "毫米" },
    },
    cm: {
      aliases: [...alias("cm"), "厘米", "公分"],
      symbol: "cm",
      forms: { other: "厘米" },
    },
    pt: {
      aliases: [...alias("pt"), "磅"],
      symbol: "磅",
      forms: { other: "磅" },
    },
    // The two units with no `forms` at all. See the doc comment above: ICU cuts
    // 派卡 into 派 + 卡 and 像素 into 像 + 素, so neither Chinese word can be read
    // back, and the Latin symbol — which is what a Chinese stylesheet writes — is
    // what is left.
    pc: {
      aliases: alias("pc"),
      symbol: "pc",
    },
    px: {
      aliases: alias("px"),
      symbol: "px",
    },
  },
});
