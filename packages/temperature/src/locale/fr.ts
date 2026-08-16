import { aliasesFor } from "@smartput/kind/aliases";
import type { Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The French spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * French adds exactly one word, and the shortness of the list is the finding
 * rather than a gap in it. Three of the four candidate nouns are already in the
 * shared table, spelled the way French spells them, and the fourth is a word
 * this file must not take:
 *
 *   `centigrades`  the plural of "centigrade", which French writes identically
 *                  to the English the table already holds — "degré centigrade"
 *                  was the official French name of the Celsius degree until 1948
 *                  and is still what a French speaker reaches for. Only the
 *                  plural is missing, and it is declared rather than left to
 *                  `fr.ts`'s suffix stripper: that stripper does recover it, by
 *                  taking the -s off at `weight: -2`, and a word this file knows
 *                  about should not arrive penalised. No accent is written on
 *                  either number — French spells "centigrade" with bare vowels
 *                  throughout, so unlike the Spanish file there is no accent-free
 *                  variant to declare beside an accented one.
 *
 * "celsius", "fahrenheit" and "kelvin" need nothing. All three are surnames, and
 * French quotes a surname rather than translating it; all three are already in
 * the table, spelled as French spells them. Nor is there a French plural to add
 * for two of them — "degrés Fahrenheit" leaves the surname invariable, and
 * "kelvin" does take an -s in French ("5 kelvins", it having become an ordinary
 * common noun) but the table already carries "kelvins" for the English plural,
 * which is the same string. Spanish had to declare "kelvines"; French would be
 * declaring a word that is already there.
 *
 * **"degré" and "degrés" are deliberately not claimed**, and that is the one
 * decision in this file worth arguing. They are the words a French speaker says
 * out loud for a temperature — "il fait trente degrés" — but "degré" is also
 * `@smartput/angle`'s French word for the angular degree, where it is the unit's
 * *own* name rather than a head noun waiting for a scale. Claiming it here would
 * make "90 degrés" ambiguous between a right angle and an unlivable afternoon in
 * every composed engine, to buy back a reading that is incomplete anyway: "30
 * degrés" alone does not say which scale, and the complete "30 degrés Celsius"
 * is three tokens, which no alias can span — the limit `phrase-analyzer.ts`
 * documents. `centigrades` carries the reading on its own and costs nothing.
 */
const FRENCH: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["centigrades"],
  f: [],
  k: [],
};

/**
 * French words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`
 * next door, because one package defines two kinds and a `Vocabulary` names
 * exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk`, `es` and `it`
 * carry none.** The decision was re-taken rather than inherited, and French
 * reaches it by a route of its own. `en`'s reason holds unchanged to begin with:
 * the written form a person uses is the symbol, and "20 °C" — space included —
 * is exactly what a French newspaper prints, so the symbol path is not a
 * compromise here but the correct French output. What French adds is that its
 * natural word form is unreachable for two separate reasons at once. The noun
 * French counts in this domain is "degré", and "centigrade" is an adjective
 * doing noun duty behind it, so the form that reads naturally is "20 degrés
 * Celsius" — three tokens, which `lex` can never hand to one analyzer, and whose
 * head noun this file has just declined to claim. So a `forms` table here could
 * only hold the symbol under a grammatical key, or a word the parser would then
 * refuse. Rule: where the `en` unit decided against word forms, this file does
 * not invent them.
 *
 * It is worth saying what French would have owed if it had: two rows, `one` and
 * `other`, with the boundary at two rather than at one — "1,5 degré Celsius" is
 * singular in French where English writes "1.5 degrees celsius". That row is the
 * one a table ported from English by renaming columns gets wrong, and it is
 * exercised here through `french.selectForm` in `fr.test.ts` even though no
 * table indexes it.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six: the renderer's no-symbol branch would fall through to
 * the bare unit key, so a unit that forgot its symbol would print "20 c". The
 * three symbols stay Latin, and French writes them exactly as `en` does — what
 * French changes is the space in front of them, and that is `fr.ts`'s
 * `renderQuantity`, not a vocabulary's business.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a French
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * French spelling is appended from the one `FRENCH` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback is written against, and
 * it is also what lets "20 C + 5 F" read its right operand as a difference.
 * Deriving both lists from the same two sources keeps them equal by construction
 * instead of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/fr` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureFr: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "fr",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...FRENCH.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...FRENCH.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...FRENCH.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "fr",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...FRENCH.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...FRENCH.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...FRENCH.k], symbol: "K" },
    },
  }),
];

export default temperatureFr;
