import { aliasesFor, defineVocabulary, type Vocabulary } from "@smartput/core";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The Turkish spellings, by unit, in one place so both kinds are given the same
 * list by construction rather than by proofreading.
 *
 * **One word, and it is here because Turkish respells it rather than because
 * Turkish translates it.** The three scale names are eponyms — Celsius,
 * Fahrenheit, Kelvin — and Turkish orthography, which otherwise respells
 * borrowings to match pronunciation, keeps a person's name as its owner wrote it:
 * TDK's dictionary has *Celsius* and *Fahrenheit* with their original letters, so
 * `c` and `f` are already typeable exactly as the Latin table carries them.
 * *Santigrat* is the exception, and it is not a name: it is the common noun
 * *centigrade*, so it goes through the respelling machinery like any other
 * loanword — c → s before a front vowel, the final *de* devoiced to *t* — and
 * comes out as letters the table does not have. The table already lists
 * "centigrade" for the same meaning, which is what makes this a line earned by a
 * different spelling and not a synonym invented for one.
 *
 * **`k` and `f` add nothing, and each absence has its own reason.** The kelvin is
 * not a degree — SI dropped "degree Kelvin" in 1967 — and Turkish writes it
 * *kelvin*, which the table has. Fahrenheit turns up in Turkish writing as
 * *Fahrenhayt* now and then, but that is one person transcribing a surname rather
 * than a form the language has taken in: TDK keeps *Fahrenheit*, and an eponym is
 * exactly what Turkish orthography does **not** respell. The resolver does not
 * read it either — two substitutions is past the correction budget — but it does
 * *suggest* it, "Unknown unit "fahrenhayt". Did you mean: fahrenheit?", which is
 * the right answer for a misspelling and the wrong one for a translation.
 * `tr.test.ts` pins that, so if the budget ever widens, the decision is
 * revisited on a failing test rather than by memory.
 *
 * **The second entry is a case form, and it is here because Turkish changes the
 * *stem* and not only the ending.** `@smartput/core/locale/tr` enumerates every
 * harmonic variant of every suffix, which is all a flat `suffixStripper` can do
 * about vowel harmony, and it is enough for the locative and the ablative:
 * "santigratta" and "santigrattan" both strip cleanly back to *santigrat*. The
 * dative does not, because a final voiceless stop **voices** before a
 * vowel-initial suffix — *santigrat* + `-a` is "santigrada", with a `d` — so the
 * word the stripper would have to produce is not a suffix shorter than the input,
 * it is a different string. No suffix list can undo that; only a vocabulary can,
 * and that is what this line is. The dative is worth the line rather than being
 * left as a gap because it is the case Turkish puts a **conversion target** in:
 * "300 K çevir santigrada" is the ordinary way to ask. The accusative
 * (*santigradı*) and the genitive (*santigradın*) soften the same way and are not
 * listed, because neither stands where a unit stands; what becomes of them is
 * measured rather than assumed, and it is not the same answer for both. The
 * accusative is one substitution away from the listed dative, so the resolver
 * corrects it and reads it at a `FuzzyMatch` penalty. The genitive is two, and is
 * refused with a suggestion. `tr.test.ts` pins each, so the day the correction
 * budget moves, this decision comes back on a failing test rather than by
 * memory.
 *
 * **The word Turkish most obviously wants is *derece*, and it cannot be
 * claimed** — for `en`'s reason and then for two of its own. `en` records that
 * "20 degrees celsius" does not parse because a unit word is one token and `lex`
 * ends a word token at a space. Turkish says it two ways and both are phrases:
 * "20 santigrat derece" (modifier then head) and "20 Celsius derecesi" (head then
 * possessive). The second is the sharper case, because the head carries a
 * **suffix** in it — *derece* + `-si` — so even a compound splitter of the kind
 * `de` uses would have to undo agglutination before it found a word to look up,
 * and Turkish does not close the phrase up the way Dutch closes *celsiusgraad*.
 * And the bare *derece* is `@smartput/angle`'s word in this language just as
 * *graad* and *derajat* are in theirs: "45 derece" is a slope at least as often
 * as a temperature, and no context either kind could offer separates them.
 */
const TURKISH: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  // The one respelled common noun, and the one case form a suffix list cannot
  // reach back from; see above. Both are listed for both kinds, because the two
  // kinds answering to identical words is what lets "20 C + 5 F" read its right
  // operand as a difference.
  c: ["santigrat", "santigrada"],
  f: [],
  k: [],
};

/**
 * Turkish words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `de.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk`, `nl`, `zh` and
 * `id` carry none, and `en`'s reasoning holds here without amendment.** That
 * reasoning is that the written form of this unit is the symbol — "20 °C" is what
 * a Turkish weather report prints as much as an English one — and that the
 * spelled phrase is a phrase. Turkish confirms both halves and adds a third:
 * even if "santigrat derece" were one token, no count could move it, because
 * `turkish.selectForm` returns the constant `"other"` for every count and every
 * slot. A counted Turkish noun is bare — "1 kilogram", "5 kilogram", never
 * "5 kilogramlar" — so the table being left out here is one row per unit rather
 * than `uk`'s eight, which is the cheapest a `forms` table can be, and it is
 * still the wrong output.
 *
 * What that means concretely is that `turkish.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so this
 * package exercises none of the grammar, and `tr.test.ts` says so rather than
 * manufacturing an assertion that looks like it does. `symbol` carries the entire
 * output, which is precisely why R8 wants it explicit on all six.
 *
 * **The symbol is set off by a space, and that comes from the language rather
 * than from this file.** `@smartput/core/locale/tr` declares a `renderQuantity`
 * that spaces a bare symbol — the same override German makes, and for the same
 * reason: TSE follows SI and writes "20 °C", never English's tight "20°C". This
 * package is the one place that override is visible for this language, since with
 * no `forms` on any unit the default template's tight branch is exactly the
 * branch these units take.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Turkish
 * engine and the micro path (`parseTemperature`) cannot drift from it. Both kinds
 * are given the identical list, and — as in `en` — that is load-bearing rather
 * than tidy: every temperature alias resolving to two kinds is the case
 * `print/unit-word.ts`'s ambiguity fallback exists for, and it is also what lets
 * "20 C + 5 F" read its right operand as a difference.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which
 * is what lets `@smartput/temperature/locale/tr` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureTr: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "tr",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...TURKISH.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...TURKISH.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...TURKISH.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "tr",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...TURKISH.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...TURKISH.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...TURKISH.k], symbol: "K" },
    },
  }),
];

export default temperatureTr;
