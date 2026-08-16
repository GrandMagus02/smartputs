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
 * The Italian spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * Italian adds exactly one word, and the shortness of the list is the finding
 * rather than a gap in it:
 *
 *   `centigrado`  the everyday name of the Celsius scale, and the word an
 *   `centigradi`  Italian weather report uses — "trenta gradi centigradi". The
 *                 table's own English "centigrade" is a *different string*, and
 *                 no analyzer bridges the two: `it.ts`'s plural fold substitutes
 *                 a final vowel, it does not add or remove a "e". The plural is
 *                 declared beside the singular even though the `i → o` row does
 *                 recover it, because that row costs `weight: -2` and a form
 *                 this file knows about should not arrive penalised. No accent
 *                 is written on either — Italian stresses "centigrado" on the
 *                 antepenult, where the general rule already puts it, so unlike
 *                 Spanish's "centígrado" there is no accent-free variant to
 *                 declare beside it.
 *
 * The other two scales need nothing. "celsius", "fahrenheit" and "kelvin" are
 * surnames, and Italian quotes a surname rather than translating it — all three
 * are already in the table, spelled the way Italian spells them. Nor is there an
 * Italian plural to add for any of them: "kelvin" is a loanword ending in a
 * consonant, and Italian's invariant class covers exactly that ("5 kelvin",
 * "due watt", "tre bar"), which is why `it.ts` ships no fold row for it and why
 * this file does not invent "kelvini". Spanish had to declare "kelvines"; Italian
 * would be manufacturing a word the language does not have.
 *
 * **"grado" and "gradi" are deliberately not claimed**, and that is the one
 * decision in this file worth arguing. They are the words an Italian speaker
 * says out loud for a temperature — but "grado" is also `@smartput/angle`'s
 * Italian word for the angular degree, where it is the unit's *own* name rather
 * than a head noun waiting for a scale. Claiming it here would make "90 gradi"
 * ambiguous between a right angle and a summer afternoon in every composed
 * engine, to buy back a reading that is incomplete anyway: "30 gradi" alone does
 * not say which scale, and "30 gradi centigradi" is three tokens, which no alias
 * can span. `centigradi` carries the reading on its own and costs nothing.
 */
const ITALIAN: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["centigrado", "centigradi"],
  f: [],
  k: [],
};

/**
 * Italian words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`
 * next door, because one package defines two kinds and a `Vocabulary` names
 * exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk` and `es` carry
 * none.** The decision was re-taken rather than inherited, and Italian reaches
 * it by a route of its own. `en`'s reason holds unchanged to begin with: the
 * written form a person uses is the symbol — "20 °C" is what an Italian
 * newspaper prints, down to the Latin letters. What Italian adds is that its
 * only natural word form is unreachable for two separate reasons at once. The
 * noun Italian counts in this domain is "grado", and "centigrado" is an
 * adjective doing noun duty behind it, so the form that reads naturally is "20
 * gradi centigradi" — three tokens, which `lex` can never hand to one analyzer,
 * and whose head noun this file has just declined to claim. Kelvin has no word
 * form to give either, being invariant. So a `forms` table here could only hold
 * the symbol under a grammatical key, or a word the parser would then refuse.
 * Rule: where the `en` unit decided against word forms, this file does not
 * invent them.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six: the renderer's no-symbol branch joins number and unit
 * *with* a space, so a unit that forgot its symbol would silently move a byte.
 * The three symbols stay Latin, and Italian writes them exactly as `en` does.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in an Italian
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Italian spellings are appended from the one `ITALIAN` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/it` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureIt: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "it",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...ITALIAN.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...ITALIAN.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...ITALIAN.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "it",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...ITALIAN.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...ITALIAN.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...ITALIAN.k], symbol: "K" },
    },
  }),
];

export default temperatureIt;
