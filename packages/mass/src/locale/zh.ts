import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Chinese words for the mass units — Simplified, mainland conventions, which is
 * what the bare tag `zh` means everywhere in this repo (`@smartput/core/locale/zh`
 * says so at length: CLDR resolves the bare tag to Simplified, and a Traditional
 * table would be `zh-Hant` and a file of its own rather than a fork of this one).
 * All six units the kind declares have Chinese words, and all six print them.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot, because Chinese marks number nowhere on a noun: 一克 and 五克 and
 * 一百万克 are the same character, and 1.5 does not move it either. CLDR agrees —
 * `Intl.PluralRules("zh").resolvedOptions().pluralCategories` is the
 * single-element `["other"]`, which `zh.test.ts` pins beside the key set. **A
 * one-row table is the correct answer here and not a stub anyone should come
 * back and finish**: rule 6 asks for exactly the keys `selectForm` can produce,
 * and `selectForm` can produce exactly one. This table is `en`'s with the
 * `"one"` row deleted; nothing was renamed. Against Ukrainian's eight keys it is
 * the mirror image, and it is the language rather than a translator stopping
 * halfway.
 *
 * **Chinese sets no space between the number and the unit**, so this vocabulary
 * is read and written as 5千克 and never 5 千克 — `chinese.renderQuantity`
 * closes the gap on every branch, words and Latin symbols alike, and the engine
 * tests below the table assert the tight string.
 *
 * **The standard names are printed and the colloquial ones are read.** 千克 is
 * the GB (national standard) name for the kilogram and pairs with 毫克 and 克,
 * which have no colloquial variant at all; 公斤 is what a market stall and half
 * of ordinary speech use for the same unit, so it is an alias and never a
 * printed form. The same split gives 克 the Taiwanese 公克 and 吨 the fuller
 * 公吨. Printing whichever member of a pair happened to be typed would make the
 * engine's answer depend on the question's register, and one printed register
 * per kind is what keeps 500克 reading as the same table that wrote 1.5千克.
 *
 * **Every printed word survives segmentation, and that had to be measured.**
 * Chinese puts no space between words, so `chinese.segment` — `Intl.Segmenter`
 * scoped to Han — is the *only* thing standing between a letter run and the
 * alias index: a word ICU's dictionary does not know is cut in two, reaches
 * `lex` as two word tokens, and can never be read back however well it is
 * spelled. All six words here come back whole (毫克, 克, 千克, 吨, 盎司, 磅) and
 * `zh.test.ts` pins each one. The check is not ceremonial: ICU cuts 品脱 into
 * 品 + 脱 and 像素 into 像 + 素, which is why `@smartput/volume/locale/zh` cannot
 * print the word for a pint and `@smartput/measure/locale/zh` cannot print the
 * word for a pixel.
 *
 * `symbol` is the SI abbreviation on the four metric units, because that is what
 * Chinese itself writes — a Chinese food label reads 500g and a Chinese
 * pharmacy 5mg, unchanged from the Latin — and the spelled noun on the two
 * imperial ones, 盎司 and 磅, which Chinese does not abbreviate at all. Ruling R8
 * wants an explicit symbol on every unit, never an invented one, and there is no
 * Chinese short form for an ounce to invent.
 *
 * **Two traditional units of mass are deliberately absent**, on the reasoning
 * `@smartput/area/locale/ja` gives for 坪. 斤 (the market catty, exactly 500 g
 * since the 1959 reform) and 两 (the tael, a tenth of it) are units people
 * genuinely weigh in, and this kind declares no unit for either — so claiming
 * them would mean bending them onto the nearest ratio and answering a 10 %
 * question with a 0 % error message. A `NoCandidateError` says "this engine does
 * not know 斤"; a silent 500 g says nothing at all. 两 is doubly spoken for:
 * `@smartput/core/locale/zh-cardinals` declares it as the *counting two* (两公斤
 * is how two kilograms is said), and `foldNumerals` turns a standalone numeral
 * word into a number token before any vocabulary is consulted, so a mass entry
 * for it could never be reached. That trade was checked against this exact table
 * before it was taken, and `@smartput/core/locale/zh.test.ts` pins it so a kind
 * that later adds a tael trips over the collision instead of losing to it
 * silently.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Chinese engine and
 * the micro path (`parseMass`) cannot drift from it. There is no case ending to
 * list beside them and no plural — `chinese.analyze` is `identity()` alone,
 * because a Chinese noun has nothing for a suffix stripper to remove and a
 * stripper would be actively wrong here: one character off 千克 leaves 克, which
 * is a different unit of this very kind. So every alias below is a word somebody
 * types, and every form this file prints is one of them (rule 5).
 *
 * Like `en`, this file names `mass` by **id string** and never imports the kind,
 * which is what lets `@smartput/mass/locale/zh` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "毫克"],
      symbol: "mg",
      forms: { other: "毫克" },
    },
    g: {
      aliases: [...alias("g"), "克", "公克"],
      symbol: "g",
      forms: { other: "克" },
    },
    // 公斤 is the everyday word and 千克 the standard one, and they are the same
    // unit rather than two registers of different precision — unlike
    // `@smartput/length/locale/zh`, where the everyday 公里 beat the standard
    // 千米 on frequency. Here the standard name wins because 千克 is what the
    // rest of this table looks like: 毫克 and 克 have no 公- form, so printing
    // 公斤 beside them would put one row of the six in a register of its own.
    kg: {
      aliases: [...alias("kg"), "千克", "公斤"],
      symbol: "kg",
      forms: { other: "千克" },
    },
    t: {
      aliases: [...alias("t"), "吨", "公吨"],
      symbol: "t",
      forms: { other: "吨" },
    },
    // The two imperial units, and the two whose symbol is the spelled noun.
    // Chinese abbreviates neither: where a short form appears at all it is the
    // English oz/lb, which `units.ts` already registers as aliases, so claiming
    // one as the *Chinese* symbol would print 2oz at a reader who wrote 盎司.
    oz: {
      aliases: [...alias("oz"), "盎司"],
      symbol: "盎司",
      forms: { other: "盎司" },
    },
    // 磅 is also what a Chinese word processor calls a typographic point, which
    // `@smartput/measure/locale/zh` prints for `pt`. The two kinds collide in an
    // engine that installs both — exactly as `measure`'s mm and cm already
    // collide with `length`'s, which is why `measure` is outside `BUILTIN_KINDS`
    // — and the solver settles it by weight. Dropping the word from either side
    // would cost a real reading to avoid an ambiguity Chinese itself has.
    lb: {
      aliases: [...alias("lb"), "磅"],
      symbol: "磅",
      forms: { other: "磅" },
    },
  },
});
