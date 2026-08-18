import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Portuguese words for the percent unit — the same one unit `en`, `uk`, `es` and
 * `de` name, and the same decision about whether it has word forms at all.
 *
 * Brazilian, under the bare `pt` tag, per this project's ruling; where Brazil and
 * Portugal spell the noun differently both spellings are listed, because
 * recognition is many-to-one and nothing here is ever printed.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Portuguese engine
 * and the micro path (`parsePercent`) cannot drift from it. The Portuguese
 * spellings are appended on top.
 *
 * **What Portuguese writes is "por cento", and it cannot be an alias.** Two
 * words, and a word token ends at a space, so no lookup can ever reach the pair —
 * that much this kind shares with `es`'s "por ciento" and `uk`'s "градус
 * Цельсія". What it shares with Spanish and not with Ukrainian is what happens to
 * the fragments: "por" is `portuguese.keywords.times` and "cento" is a declared
 * cardinal (100, the combining form of the hundred), so "20 por cento" does not
 * fail to parse — it parses as arithmetic and answers 2000. The collision is
 * inherited rather than chosen: `pt.ts` claims "por" as `times` because `es.ts`
 * already claims that surface for the same operation and `buildKeywords` refuses
 * two installed languages that disagree about one word. `pt.test.ts` pins the
 * wrong answer as a live assertion so the trade stays on the record.
 *
 * The single-token Portuguese words are all listed, and there are more of them
 * than Spanish has:
 *
 *   "porcento"      the univerbated spelling. Not the standard orthography —
 *                   dictionaries write "por cento" — but it is what is typed, and
 *                   it is the only single token that says the unit outright, so
 *                   leaving it out would mean no Portuguese *word* reached this
 *                   unit at all.
 *   "porcentagem"   the noun, Brazilian spelling, and what a conversion target is
 *                   typed with: "5 / 50 em porcentagem".
 *   "percentagem"   the same noun, European spelling. Both are current in Brazil.
 *   "percentual"    the noun Brazilian business writing prefers ("o percentual de
 *                   juros"), which is an adjective doing noun duty.
 *
 * Every plural is spelled out beside its singular, and that is not tidiness — it
 * is the one place in this package where Portuguese morphology bites. "-agem"
 * pluralizes to "-agens", the -m → -ns class, and `pt.ts` deliberately declares
 * no rule for it (its `pluralReplacer` comment says why: no unit noun in
 * Portuguese ends in -m, and a "-ns" row would hand the resolver a bad stem for
 * every nanosecond symbol). So "porcentagens" is reachable by nothing at all
 * unless it is written here. "percentuais" is the -l → -is class, which
 * `pluralReplacer` *does* handle — but at `weight: -2`, and a form this file
 * knows about should not arrive penalised.
 *
 * **No `forms`, exactly as `en`, `uk`, `es` and `de` carry none, and for `en`'s
 * reason.** Portuguese has an ordinary noun here and would owe only the two rows
 * `portuguese.selectForm` can produce, so this is not the `uk` case where eight
 * keys had to be invented — it is still the case that the written form of this
 * unit is the symbol. "20%" is what a percentage looks like in a Brazilian result
 * line, and a `forms` table would make every percentage anywhere in a Portuguese
 * engine's output read as a word. Reading "20 porcento" still works, and answers
 * "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in every
 * language that uses it, and the renderer's no-symbol branch joins number and
 * unit *without* a space, so a unit that forgot its symbol would move a byte
 * rather than fail. Portuguese sets it tight against the number — "20%", not the
 * spaced "20 %" German's `renderQuantity` produces — which is what Brazilian
 * typography writes and what the default template already does, so `pt.ts`
 * overrides nothing.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/pt` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        "porcento",
        "porcentagem",
        "porcentagens",
        "percentagem",
        "percentagens",
        "percentual",
        "percentuais",
      ],
      symbol: "%",
      tight: true,
    },
  },
});
