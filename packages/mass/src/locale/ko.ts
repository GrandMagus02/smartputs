import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Korean words for the mass units — the same six `en`, `uk` and `ja` name, and
 * all six have words: Korean writes every one of them out in Hangul.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot, because a Korean noun marks number nowhere: 일 킬로그램 and 오 킬로그램
 * differ in the numeral and nowhere else, and 1.5 does not move the noun
 * either. The suffix 들 exists but is pragmatic rather than grammatical — it is
 * optional wherever it is possible at all and is never attached to a measured
 * quantity, so 킬로그램들 is not Korean. CLDR agrees and says so in a form a
 * test can assert: `Intl.PluralRules("ko")` declares the single category
 * `"other"`. This table is `en`'s with the `"one"` row deleted; nothing was
 * renamed, which is the point of `selectForm` returning CLDR's generic name
 * rather than one Korean invented for itself.
 *
 * **Korean is spaced, so nothing here depends on a segmenter — and that is the
 * one thing a reader arriving from `ja.ts` or `zh.ts` next door will assume
 * wrongly.** Those two files had to measure every katakana and every Han word
 * against `Intl.Segmenter`, because Japanese and Chinese put no space between
 * words and a whole phrase arrives as one letter run; `@smartput/angle/locale/ja`
 * cannot print the word for a radian at all, since ICU cuts ラジアン into
 * ラジ + アン. Korean has had 띄어쓰기 since the 1896 독립신문, `lex` has already
 * cut at every space, and `korean` declares no `segment` for that reason. ICU
 * still runs over each letter run as the lexer's default, and it has no Korean
 * dictionary behind it: 킬로그램 comes back whole and so does 킬로그램을, particle
 * and all. `ko.test.ts` beside this file pins both, because the second fact is
 * what the analyzer depends on and the first is what the printed forms depend
 * on.
 *
 * **What Korean needs instead of segmentation is `korean.analyze`.** Its
 * particles are *bound*: 킬로그램을 ("kilograms", accusative) and 그램으로
 * ("into grams") are one orthographic word each, so the morphology arrives
 * inside the token rather than beside it, and `particleStripper` in
 * `@smartput/core/locale/ko` is the only reason either is ever recognised as a
 * unit. Nothing in this file has to help it: a Korean noun does not inflect, so
 * every Hangul name below is the word itself in every position, and the
 * stripper's job is peeling a separate morpheme off rather than undoing an
 * ending. Every form this file prints is therefore also a form it reads
 * outright, at weight 0, with no penalised path involved (rule 5).
 *
 * **`symbol` is the Latin SI abbreviation on the four metric units, because
 * that is what Korean itself writes.** A Korean spec sheet sets 5 kg exactly as
 * an English one does; there is no Hangul short form for a kilogram, and
 * inventing 킬 would be a word this file made up. The two imperial units get
 * their spelled Hangul nouns instead, on `ja`'s reasoning: Korean abbreviates
 * neither, `oz` and `lb` appear only on imported packaging, and `units.ts`
 * already registers those two as aliases — claiming one as the *Korean* symbol
 * would print `2oz` at a reader who wrote 온스. R8 wants an explicit symbol on
 * every unit, never an invented one.
 *
 * The typographic variants ㎏, ㎎ and ㎍ are deliberately **not** listed, and
 * the reason is mechanical rather than editorial: `normalize()` runs NFKC
 * before anything else sees the input, and NFKC maps ㎏ to "kg" and ㎎ to "mg".
 * A Korean label that writes the squared character is therefore already reading
 * as the Latin alias `units.ts` declares, and an entry for it here would be a
 * key the lexer can never deliver.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Korean engine and
 * the micro path (`parseMass`) cannot drift from it.
 *
 * Like `en`, this file names `mass` by **id string** and never imports the
 * kind, which is what lets `@smartput/mass/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "밀리그램"],
      symbol: "mg",
      forms: { other: "밀리그램" },
    },
    g: {
      aliases: [...alias("g"), "그램"],
      symbol: "g",
      forms: { other: "그램" },
    },
    // 킬로 is the colloquial clipping and it is listed for the same reason
    // `units.ts` lists the English "kilo" and `ja.ts` lists キロ: people type
    // it, and 3킬로 나가다 is ordinary Korean for "weighs three kilos". It is
    // genuinely ambiguous — a Korean speaker says 킬로 for a kilometre as
    // readily as for a kilogram — and this file claims it for the kilogram
    // alone, exactly as the English alias map already does; claiming it in
    // `@smartput/length/locale/ko` as well would put two readings of one
    // clipping in front of the solver with nothing to separate them.
    //
    // It is also the word that shows why `particleStripper` has no `minStem`
    // and needs none. The stripper sees a 로 at the end of 킬로 and offers 킬,
    // which is not a unit, not an alias and not anything else — the resolver
    // keeps only forms that hit the index, so a junk stem costs a lookup and
    // nothing more. A stem floor high enough to suppress it would take 도, 톤
    // and 초 with it.
    kg: {
      aliases: [...alias("kg"), "킬로그램", "킬로"],
      symbol: "kg",
      forms: { other: "킬로그램" },
    },
    t: {
      aliases: [...alias("t"), "톤"],
      symbol: "t",
      forms: { other: "톤" },
    },
    // The two imperial units, and the two whose symbol is the spelled noun.
    oz: {
      aliases: [...alias("oz"), "온스"],
      symbol: "온스",
      forms: { other: "온스" },
    },
    lb: {
      aliases: [...alias("lb"), "파운드"],
      symbol: "파운드",
      forms: { other: "파운드" },
    },
  },
});
