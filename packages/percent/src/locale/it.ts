import { aliasesFor, defineVocabulary } from "@smartput/core";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Italian words for the percent unit — the same one unit `en`, `uk` and `es`
 * name, and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in an Italian engine
 * and the micro path (`parsePercent`) cannot drift from it. The Italian
 * spellings are appended on top.
 *
 * **What Italian writes is "per cento", and it cannot be an alias.** Two words,
 * and a word token ends at a space, so no lookup can ever reach the pair — that
 * much this kind shares with `uk`'s "градус Цельсія" and `es`'s "por ciento".
 * What it shares with Spanish and not with Ukrainian is what becomes of the
 * fragments: "per" is `italian.keywords.times` and "cento" is a declared scale
 * in `it-cardinals.ts` (100), so "20 per cento" does not fail to parse, it
 * parses as arithmetic and answers 2000. That is a genuine collision between a
 * unit phrase and an operator word, it is not resolvable inside a vocabulary —
 * "per" earns its keyword slot on "3 per 4", which is how Italian says
 * multiplication out loud and is far commoner — and `it.test.ts` pins the wrong
 * answer as a live assertion so the trade is on the record rather than
 * rediscovered.
 *
 * The three Italian words that *are* one token are all listed:
 *
 *   "percento"     the univerbated spelling. Prescriptive grammars still prefer
 *                  the two-word "per cento", but the fused form is ordinary in
 *                  running text and is the only single token that says the unit
 *                  outright, which makes it the one spelling that can be read.
 *   "percentuale"  the noun ("la percentuale"), feminine, and the word a
 *                  conversion target is typed with: "5 / 50 in percentuale".
 *   "percentuali"  its plural, listed rather than left to the plural fold — the
 *                  fold does reach it, since `it.ts`'s `i → e` row turns
 *                  "percentuali" back into "percentuale", but at `weight: -2`,
 *                  and a word this file knows about should not arrive penalised.
 *
 * **No `forms`, exactly as `en`, `uk` and `es` carry none, and for `en`'s
 * reason.** Italian has an ordinary noun here and would owe only two rows, so
 * this is not the `uk` case where eight keys had to be invented — it is still
 * the case that the written form of this unit is the symbol. "20%" is what a
 * percentage looks like in an Italian result line, and a `forms` table would
 * make every percentage anywhere in an Italian engine's output read as a word.
 * Reading "20 percento" still works, and answers "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in
 * every language that uses it, and the renderer's no-symbol branch joins number
 * and unit *without* a space, so a unit that forgot its symbol would move a byte
 * rather than fail.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/it` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "percent",
  units: {
    "%": {
      aliases: [...alias("%"), "percento", "percentuale", "percentuali"],
      symbol: "%",
    },
  },
});
