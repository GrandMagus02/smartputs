import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Chinese words for the energy units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. The kind next door names no language at all: ratios,
 * unit ids, magnitude bands and the four power/duration/energy signatures. This
 * file names `energy` by **id string** rather than importing the kind, so
 * `@smartput/energy/locale/zh` links no ratio table, and `composeLocale` is where
 * the two halves meet.
 *
 * **One form key.** `chinese.selectForm` returns the constant `"other"` for every
 * count and every slot: Chinese marks number nowhere on a noun — 一卡路里 and
 * 五卡路里 differ in the numeral and nowhere else — and CLDR agrees
 * (`Intl.PluralRules("zh")` declares the single category `other`). A one-row
 * `forms` table is the correct and finished answer for this language, not a stub
 * someone should come back and fill in; a table translated from `en.ts` needs no
 * key renamed, it needs its `"one"` row deleted.
 *
 * **Which units get that row is decided by ICU, and the measurement is the
 * interesting part of this file.** Chinese is unspaced, so `chinese.segment`
 * hands every letter run to `Intl.Segmenter`, and its dictionary holds some of
 * these words together and not others:
 *
 * ```
 * 焦     → ["焦"]          焦耳   → ["焦耳"]        千焦 → ["千", "焦"]
 * 兆焦   → ["兆", "焦"]     卡     → ["卡"]          卡路里 → ["卡路里"]
 * 千卡   → ["千卡"]         大卡   → ["大", "卡"]     瓦时 → ["瓦", "时"]
 * 千瓦时 → ["千瓦", "时"]    兆瓦时 → ["兆", "瓦", "时"]  英热单位 → ["英", "热", "单位"]
 * ```
 *
 * A `forms` entry the segmenter breaks is a string the printer emits and the
 * parser cannot take back, which is precisely the failure §9 exists to prevent —
 * and the one `assertLocaleContract` cannot catch on its own, since it consults
 * the alias index and the alias index never sees the segmenter. In Chinese the
 * damage is worse than a merely unreadable fragment: three of these words begin
 * with 千, which `zh-cardinals.ts` declares as the scale word for a thousand, so
 * 「5千焦」 would not fail to resolve — it would lex as 5 followed by the *number*
 * 1000 followed by a stray 焦.
 *
 * **The rule this file follows is therefore by family, not by unit: a family
 * spells itself out only when every member of it survives.**
 *
 * The joule family does not. 焦 and 焦耳 come back whole and 千焦 and 兆焦 do not,
 * so all three print the SI symbol — "J", "kJ", "MJ" — rather than 「5焦耳」
 * standing beside 「5kJ」. One kind printing two registers for one quantity is a
 * worse reading experience than a kind printing the symbol a Chinese datasheet
 * uses anyway, and it would leave the register hostage to an ICU dictionary
 * update. The two readable words stay in `aliases`, where 「5焦耳」 is understood
 * but never emitted; 千焦 and 兆焦 are absent from `aliases` too, because an alias
 * the lexer can never hand to the index is dead weight rather than documentation.
 *
 * The calorie family does survive, every member of it, so that is the family this
 * vocabulary spells — 「200卡路里」, 「500千卡」. It is also the family a Chinese
 * reader actually meets in words rather than in symbols, on the back of every
 * packet of food in the country. 大卡 — the everyday spoken word for the food
 * kilocalorie — is the one member ICU takes apart (大 + 卡), so it is left out
 * entirely rather than listed as an alias that could never be reached; 千卡 is the
 * printed standard on the nutrition panel and is what this file both reads and
 * writes. The asymmetry between 卡路里 and 千卡 is Chinese and not an oversight:
 * 千卡路里 is not a word anyone writes, so the prefixed unit takes the short stem
 * while the base unit takes the long one.
 *
 * The watt-hour family lands where `en.ts` had already put it for its own reason
 * ("watt hour" is a compound English cannot read back). Chinese has the same
 * trouble and one more: 瓦时 and 兆瓦时 are cut at the 时, and even 千瓦时 —
 * which China writes constantly, since electricity is billed in it and the
 * colloquial name for it is 度 — comes back as 千瓦 + 时, where 千瓦 is
 * `@smartput/power`'s kilowatt. So the family prints "Wh", "kWh" and "MWh", which
 * is what a Chinese electricity bill prints beside 度 anyway. Chinese gets a
 * cleaner symbol here than Ukrainian does: `uk.ts` must write "кВт·год" with the
 * SI interpunct, which the lexer reads as multiplication and which only re-reads
 * because `* | power | duration` exists, while "kWh" is a single Latin run that
 * lexes as one word token and round-trips by lookup with no arithmetic involved.
 *
 * 度 is deliberately not claimed for `kwh`, tempting as it is. It is the measure
 * word for degrees, for temperature and for angle all at once, and claiming it
 * here would give 「30度」 — which is a summer afternoon in Beijing before it is
 * ever an electricity bill — a reading in this kind.
 *
 * **`btu` keeps the Latin symbol and gets no Chinese alias.** 英热单位 is a
 * technical gloss rather than something anyone types, and ICU cuts it into three
 * pieces regardless.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, which keeps the micro path (`parseEnergy`) and the
 * engine path agreeing by construction, and append the Chinese ones. Nobody
 * switches input mode to type a unit: 「200千卡」 and "200 kcal" are the same
 * sentence and a `zh` engine has to take both.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "energy",
  units: {
    // 焦 and 焦耳 are readable and their prefixed siblings are not (ICU cuts
    // 千焦 into 千 + 焦, where the 千 then reads as the number 1000), so the
    // words are aliases here and never printed forms: spelling the base unit
    // while abbreviating kilo- and mega- would print two registers for one
    // quantity.
    j: { aliases: [...alias("j"), "焦耳", "焦"], symbol: "J" },
    kj: { aliases: alias("kj"), symbol: "kJ" },
    mj: { aliases: alias("mj"), symbol: "MJ" },
    wh: { aliases: alias("wh"), symbol: "Wh" },
    // 千瓦时 is cut into 千瓦 + 时, and 千瓦 is `power`'s kilowatt — so the word
    // China bills its electricity in cannot be claimed here at all.
    kwh: { aliases: alias("kwh"), symbol: "kWh" },
    mwh: { aliases: alias("mwh"), symbol: "MWh" },
    cal: {
      aliases: [...alias("cal"), "卡路里", "卡"],
      symbol: "cal",
      forms: { other: "卡路里" },
    },
    // 千卡 and not 大卡: both are the food kilocalorie, but ICU cuts 大卡 into
    // 大 + 卡 while 千卡 comes back whole, and 千卡 is what the nutrition panel
    // prints. 千卡路里 is not a word, which is why the prefixed unit takes the
    // short stem where the base unit takes the long one.
    kcal: {
      aliases: [...alias("kcal"), "千卡"],
      symbol: "kcal",
      forms: { other: "千卡" },
    },
    btu: { aliases: alias("btu"), symbol: "BTU" },
  },
});
