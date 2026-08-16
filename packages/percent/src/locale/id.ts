import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Indonesian words for the percent unit — the same one unit `en` next door names,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * alias map in `units.ts`, so "20 pct" keeps working in an Indonesian engine and the
 * micro path (`parsePercent`) cannot drift from it. The Indonesian spelling is
 * appended on top.
 *
 * **There is exactly one word to add, and adding it costs one line.** *Persen* is
 * the ordinary Indonesian noun, borrowed through Dutch and respelled to Indonesian
 * orthography, and it stands **after** its number — "20 persen" — which
 * is what makes it an alias at all. That is the whole difference between this file
 * and `@smartput/percent/locale/zh`, which adds nothing: Chinese puts 百分之 in front
 * of the count and no seam in this engine takes a prefix unit. Indonesian is
 * head-initial in a noun phrase but numeral-initial in a quantity, exactly like
 * English, so the word lands where an alias index can see it.
 *
 * **It is one line and not three, and that is the language rather than a short
 * list.** Indonesian has no grammatical plural: "1 persen" and "1000 persen" are the
 * same word, because nothing agrees with a numeral here — plurality is reduplication
 * ("buku-buku") or context, and neither survives a number. So where `en` needs
 * "percent"/"percents" and `nl` has to spell *procenten* out because its stripper
 * cannot reach it, this file has a single invariant form and no plural to declare.
 * `indonesian.analyze` is `[identity()]` alone, with no stripper behind it — the one
 * plausible Indonesian suffix rule, taking `-an` off, would turn *satuan* ("a unit")
 * into *satu* ("one"), a noun into a numeral — so a word not listed here is a word
 * that cannot be read at all. That makes the completeness of this list load-bearing
 * in a way it is not in German, and it is complete because there is one word.
 *
 * **"Perseratus" is deliberately not claimed.** It is the calque — *per* + *seratus*,
 * "per one hundred" — and it is a mathematical gloss rather than a word anyone
 * writes after a number; "20 perseratus" is not something a price tag, a news
 * report or a spreadsheet says. The engine reads "%" and "persen" for that meaning
 * already, so the entry would buy a spelling nobody types at the cost of an index
 * slot and a duplicate candidate at every keystroke.
 *
 * **"Persentase" is the concept, not the unit** — it is Indonesian for "percentage",
 * the name of the *ratio*, exactly as `nl` records for its own noun and `zh` for
 * 百分比 — and nobody writes "20 persentase". "Poin persen" (percentage point) is
 * two tokens *and* a different quantity: a rate moving from 2 % to 3 % rises by one
 * point and by fifty percent, so claiming it would answer a different question than
 * the one asked.
 *
 * **The `off` keyword is where this package feels a decision taken in the
 * language.** `@smartput/core/locale/id` claims no word for `off`, because Indonesian
 * states a discount with the noun *diskon*, which comes **first** — "diskon 20% dari
 * 50" — while `off` is an infix taking the percentage on its left and the base on
 * its right. There is no spelling the parser could accept, so the arithmetic stays
 * reachable through `-` and `%`, and `id.test.ts` pins that rather than leaving it to
 * be rediscovered.
 *
 * **No `forms`, exactly as `en`, `uk`, `nl` and `zh` carry none, and for `en`'s
 * reason.** Indonesian has a real, typeable word for this unit — the absence is not
 * "the language has nothing to say" — but the written form of a percentage is the
 * symbol: "20%" is what an Indonesian result line looks like as much as an English
 * one, and a `forms` table would spell every percentage anywhere in the engine's
 * output as a word. Under `id` the table that is being left out is **one row** rather
 * than `uk`'s eight, since `indonesian.selectForm` returns the constant `"other"` —
 * which makes this the cheapest place in the repo to have shipped one, and it is
 * still the wrong output. Recipe rule: where the `en` unit decided against word
 * forms, this file does not invent them. Reading "20 persen" still works, and answers
 * "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in every
 * language here, and Indonesian sets it tight against its number, because this
 * language declares no `renderQuantity` and `defaultRenderQuantity` closes a symbol
 * up. That is also what Indonesian typography does — "20%", not "20 %" — so the
 * default is the right template here and the sixth field `nl` and `de` spend to move
 * that space would buy nothing.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the kind,
 * which is what lets `@smartput/percent/locale/id` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // The one Indonesian word, and it is invariant: "1 persen" and "1000 persen"
        // are the same string, so there is no plural line under it the way there is
        // in `nl.ts`, the file this borrowing came through.
        "persen",
      ],
      symbol: "%",
    },
  },
});
