import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Japanese words for the mass units — the same six `en` and `uk` name, and all
 * six have words: Japanese writes every one of them out in katakana.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot, because Japanese has no grammatical number at all: 一キログラム
 * and 五キログラム differ in the numeral and nowhere else, and 1.5 does not move
 * the noun either. CLDR agrees — `Intl.PluralRules("ja")` declares the single
 * category `"other"` — so rule 6's "exactly the keys `selectForm` can produce"
 * is satisfied by one row. This table is `en`'s with the `"one"` row deleted;
 * nothing was renamed. That is the mirror image of Ukrainian's eight and of
 * German's four, and it is the language rather than a table stopping halfway.
 *
 * **Katakana names beside the SI symbols, both of them real Japanese.** A
 * Japanese page writes 5kg exactly as an English one does, and 5キログラム the
 * same way — the loanword and the symbol are two registers of the same
 * language, not a translation and an original. So `symbol` is the SI
 * abbreviation on the four metric units, which is what Japanese itself writes
 * ("5 kg", never a kana abbreviation), and the spelled katakana noun on the two
 * imperial ones: Japanese has no short form for an ounce or a pound at all, and
 * `oz`/`lb` appear only in imported packaging. R8 wants an explicit symbol on
 * every unit, never an invented one.
 *
 * **Every katakana name here survives segmentation, which had to be measured
 * rather than assumed.** Japanese puts no space between words, so
 * `japanese.segment` hands each letter run to ICU and a unit word only reaches
 * the alias index if ICU returns it whole. All six do
 * (`ミリグラム|グラム|キログラム|トン|オンス|ポンド`), and `ja.test.ts` beside
 * this file pins that — the check is not ceremonial, because ICU's dictionary
 * does cut some perfectly ordinary loanwords in two, and
 * `@smartput/angle/locale/ja` had to give up printing one for exactly that
 * reason.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Japanese engine and
 * the micro path (`parseMass`) cannot drift from it. There is no case ending to
 * list beside them and no plural to list beside them — `japanese.analyze` is
 * `identity()` alone, and the reason is that a Japanese noun has nothing for a
 * suffix stripper to remove. So every alias here is a word somebody types, and
 * every form this file prints is one of them (rule 5).
 *
 * Like `en`, this file names `mass` by **id string** and never imports the
 * kind, which is what lets `@smartput/mass/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "ミリグラム"],
      symbol: "mg",
      forms: { other: "ミリグラム" },
    },
    g: {
      aliases: [...alias("g"), "グラム"],
      symbol: "g",
      forms: { other: "グラム" },
    },
    // キロ is the colloquial clipping and it is listed here for the same reason
    // `units.ts` lists the English "kilo": people type it. It is genuinely
    // ambiguous in Japanese — a Japanese speaker says キロ for a kilometre as
    // readily as for a kilogram — and this file claims it for the kilogram
    // alone, exactly as the English alias map already does. The alternative,
    // claiming it in `@smartput/length/locale/ja` as well, would put two
    // readings of one clipping in front of the solver with nothing to separate
    // them; leaving the harder half unclaimed is the honest half-answer.
    kg: {
      aliases: [...alias("kg"), "キログラム", "キロ"],
      symbol: "kg",
      forms: { other: "キログラム" },
    },
    t: {
      aliases: [...alias("t"), "トン"],
      symbol: "t",
      forms: { other: "トン" },
    },
    // The two imperial units, and the two whose symbol is the spelled noun.
    // Japanese has no abbreviation for either: where a short form appears at all
    // it is the English `oz`/`lb`, which `units.ts` already registers as
    // aliases, so claiming one as the *Japanese* symbol would print `2oz` at a
    // reader who wrote オンス.
    oz: {
      aliases: [...alias("oz"), "オンス"],
      symbol: "オンス",
      forms: { other: "オンス" },
    },
    lb: {
      aliases: [...alias("lb"), "ポンド"],
      symbol: "ポンド",
      forms: { other: "ポンド" },
    },
  },
});
