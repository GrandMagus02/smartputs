import { aliasesFor, defineVocabulary } from "@smartput/core";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * German words for the percent unit — the same one unit `en` next door names,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a German engine and
 * the micro path (`parsePercent`) cannot drift from it. The German spellings are
 * appended on top.
 *
 * **The German paradigm, and which cells are here.** "Prozent" is a neuter noun,
 * and like every German measure noun of neuter or masculine gender it stays
 * *uninflected* after a cardinal: "5 Prozent", never "5 Prozente". The plural
 * "die Prozente" is the free noun — "die Prozente addieren sich" — and the
 * dative plural "Prozenten" is the form a conversion is spoken with, since
 * German's `in` governs the dative when it answers *wo*: "in Prozenten
 * ausgedrückt". All three are listed, because all three get typed and the aliases
 * are the *input* surface — nothing about them is a claim about how output is
 * spelled.
 *
 * The genitive singular is not listed and is not missing: "Prozents" loses its
 * -s to `german.analyze`'s suffix stripper and lands on "prozent", and the
 * variant "Prozentes" loses the same -s and lands on "prozente", which is listed
 * above. A vocabulary is what the stripper falls back *from*, so the forms it
 * genuinely cannot reach are the ones that earn a line — and here it reaches
 * both.
 *
 * **"Prozentpunkt" is deliberately not claimed.** A percentage point is a
 * different quantity from a percentage — a rate moving from 2 % to 3 % rises by
 * one point and by fifty percent — so claiming the word here would answer a
 * different question than the one asked. It is a compound German would happily
 * split (`compoundSplitter`'s heads are in the language, and "prozent" is not one
 * of them, precisely so that this does not happen by accident).
 *
 * **No `forms`, exactly as `en` and `uk` carry none.** German really does
 * decline "Prozent" — the dative plural above is a live form — so the absence is
 * not "the language has no word". It is `en`'s own reason: the written form of
 * this unit is the symbol. What German adds is that its symbol is written with a
 * *space* before it — "20 %", per DIN 5008 — and that is exactly what comes out,
 * because `german.renderQuantity` overrides the default template to set a symbol
 * off from the number rather than tight against it. So the one thing a `forms`
 * table could have bought here (a spelled-out unit that looks like German) is
 * already bought by the language, in the notation a German reader expects.
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in
 * every language here, and the renderer's no-symbol branch would fall through to
 * the unit key rather than fail.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/de` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // Nominative/accusative singular — and the form that stands after every
        // cardinal, because a neuter measure noun does not inflect there.
        "prozent",
        // The free plural, "die Prozente".
        "prozente",
        // The dative plural, which is what "in Prozenten" is.
        "prozenten",
      ],
      symbol: "%",
    },
  },
});
