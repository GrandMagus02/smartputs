import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Chinese words for the power units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. The kind next door names no language at all: five
 * ratios, five unit ids and the magnitude bands `typical` records. This file
 * names `power` by **id string** rather than importing the kind, so
 * `@smartput/power/locale/zh` links no ratio table; `composeLocale` is where the
 * two halves meet.
 *
 * **One form key.** `chinese.selectForm` returns the constant `"other"` for every
 * count and every slot — Chinese marks number nowhere on a noun, and CLDR agrees
 * (`Intl.PluralRules("zh")` declares the single category `other`) — so a `forms`
 * table here is one row per unit. One row is the correct and finished answer for
 * this language and never a stub: there is no second grammatical category for a
 * second row to hold.
 *
 * **The two ends of this table reach opposite answers about that row, and both
 * are measurements rather than preferences.** Chinese is unspaced, so
 * `chinese.segment` hands every letter run to `Intl.Segmenter`, and its
 * dictionary holds some of these words together and not others:
 *
 * ```
 * 瓦   → ["瓦"]      瓦特 → ["瓦特"]      千瓦 → ["千瓦"]
 * 兆瓦 → ["兆", "瓦"]  吉瓦 → ["吉", "瓦"]   马力 → ["马力"]
 * ```
 *
 * The watt family fails on its top two. 「1.5兆瓦」 would print and then reach the
 * resolver as 兆 + 瓦 — two tokens, of which the first is `@smartput/datasize`'s
 * colloquial megabyte and the second would read as 1.5 *watts* if anything read
 * it at all. The rule this repo's unspaced vocabularies follow is by family
 * rather than by unit — a family spells itself out only when every member of it
 * survives — and this one does not, so all four print the SI symbol: "W", "kW",
 * "MW", "GW", which is what a Chinese nameplate or grid report prints anyway.
 * The three readable spellings stay in `aliases`, where 「60瓦」 and 「500千瓦」
 * are understood but never emitted; 兆瓦 and 吉瓦 are absent from `aliases` as
 * well, because an alias the lexer can never hand to the index is dead weight
 * rather than documentation. `zh.test.ts` re-runs the six splits, so a dictionary
 * update that learns 兆瓦 surfaces as a failing test rather than as a silent gap.
 *
 * 千瓦 surviving whole is the one that had to be checked rather than assumed, and
 * it is the difference between an alias and a disaster: 千 is `zh-cardinals.ts`'s
 * scale word for a thousand, so had ICU cut this the way it cuts `energy`'s 千焦,
 * 「5千瓦」 would lex as 5 followed by the *number* 1000 followed by a stray 瓦.
 *
 * `hp` reaches the other answer, and it is the one unit in the package that
 * prints a Chinese word. 马力 — literally horse-power — comes back from the
 * segmenter whole, is a family of one so no sibling can break it, and is what a
 * Chinese car review and a Chinese spec sheet both write. So it takes the
 * one-row `forms` table and 「150马力」 is what comes out.
 *
 * Its `symbol` stays the Latin "hp", where `ja.ts` next door made 馬力 the symbol
 * and shipped no form at all. The two files diverge deliberately: R8 asks for the
 * abbreviation the language actually writes, and Chinese does write "hp" on a
 * spec sheet beside 马力, so there is a real abbreviation here to record where
 * Japanese had none and had to let one string do both jobs. The symbol never
 * reaches output — a form outranks a symbol in `renderQuantity` — and it stays
 * readable because `aliasesFor` already lists it. "PS", the German-derived
 * spelling that is also common on Chinese car pages, is left out: it is a
 * coinage over what `units.ts` declares rather than a reading of it.
 *
 * That is the trade `uk.ts` had to argue itself into and Chinese gets for free:
 * Ukrainian's 「кінська сила」 is two inflected words the lexer splits, so that
 * file had to abandon a `forms` table for the contraction "кс". Chinese never had
 * a phrase to lose.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, which keeps the micro path (`parsePower`) and the
 * engine path agreeing by construction, and append the Chinese ones. Nobody
 * switches input mode to type a unit: 「60瓦」 and "60 w" are the same sentence.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "power",
  units: {
    w: { aliases: [...alias("w"), "瓦特", "瓦"], symbol: "W" },
    // 千瓦 survives ICU whole, which is what makes it an alias rather than a
    // trap: a cut here would strand 千, the scale word for a thousand, and
    // 「5千瓦」 would lex as 5 then the number 1000.
    kw: { aliases: [...alias("kw"), "千瓦"], symbol: "kW" },
    // 兆瓦 and 吉瓦 are the two ICU takes apart, so the watt family prints
    // symbols throughout rather than spelling three of its four members.
    mw: { aliases: alias("mw"), symbol: "MW" },
    gw: { aliases: alias("gw"), symbol: "GW" },
    hp: { aliases: [...alias("hp"), "马力"], symbol: "hp", forms: { other: "马力" } },
  },
});
