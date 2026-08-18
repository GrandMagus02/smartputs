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
 * Indonesian words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `nl.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **This file adds no word at all, and that is the finding rather than an unfinished
 * translation.** `@smartput/percent/locale/zh` is the only sibling in the same
 * position, and it got there a different way — Chinese puts its unit in front of the
 * count, so nothing it could say fits through an alias. Here every Indonesian word
 * for a temperature scale is either already in the Latin table or is a phrase, and
 * the four paragraphs below argue each one.
 *
 * **The three scale names are already typeable, and the reason is spelling reform
 * rather than the alphabet.** Sharing the Latin script is only half of it — `nl`
 * shares it too and still has *celsiusgraad* to declare. Indonesian's 1972
 * orthography (EYD) respells borrowed words to match pronunciation, and for these
 * three it lands on exactly the letters the unit table already carries: *Celsius*,
 * *Fahrenheit* and *Kelvin* are written just so. So the Latin half of this package
 * is already what an Indonesian reader types, and only what Indonesian spells
 * *differently* could have earned a line.
 *
 * **The one word that would is *derajat*, and it cannot be claimed.** It is the
 * Indonesian for "degree" and it goes **before** the scale name — "20 derajat
 * Celsius" — which is two word tokens, and `lex` ends a word token at a space, so no
 * alias can claim the phrase and no analyzer can reassemble it. That is `en`'s own
 * argument about "20 degrees celsius", arriving intact in a second language.
 * Indonesian sharpens it twice: this language does **not** compound, so there is no
 * *celsiusderajat* to enumerate the way Dutch enumerates *celsiusgraad* — a modifier
 * stands apart from its head as its own word, always — and the Dutch escape hatch
 * therefore does not exist here at all. And the bare *derajat* would be
 * `@smartput/angle`'s word in this language anyway: "45 derajat" is a slope at least
 * as often as a temperature, which is exactly why `nl.ts` leaves *graad* unclaimed,
 * and there is no context either kind could offer to separate them.
 *
 * **There is no *derajat Kelvin*, and that is SI rather than an omission.** The
 * kelvin is not a degree — SI dropped "degree Kelvin" in 1967 — so `k` has nothing
 * to add beyond what the Latin table already carries, where "kelvin" and its plural
 * "kelvins" are both listed. That plural is English and is left standing because it
 * reads and never prints; Indonesian has no plural of its own to put beside it, since
 * nothing in this language agrees with a numeral.
 *
 * **"Selsius" is the one respelling worth pausing over, and it is declined twice
 * over.** Indonesian orthography would ordinarily write a borrowed /s/ before a
 * front vowel as *s*, and the form does turn up in casual writing — but KBBI, the
 * standard dictionary, keeps *Celsius*, exactly as it keeps *Fahrenheit*. An eponym
 * is a person's name and this language does not respell those, so listing *selsius*
 * would enter a misspelling as though it were a translation. The second reason is
 * the decisive one and was measured rather than assumed: **"20 selsius" already
 * reads as 20 °C**, through the resolver's fuzzy correction — one substitution from
 * a listed alias, scored with a `FuzzyMatch` penalty and reported on the candidate
 * — so an entry here would buy a spelling the engine reaches anyway, at the price of
 * an exact-match alias that outranks the correction and hides that it was one.
 * `id.test.ts` pins the reading *and* the penalty, so if fuzzy matching ever
 * tightens, the gap fails loudly here instead of going quiet.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk`, `nl` and `zh` carry
 * none — and `en`'s reasoning holds here without amendment.** That reasoning is that
 * the written form of this unit is the symbol, and that the spelled phrase is a
 * phrase. Indonesian confirms both halves and adds a third: even if "derajat celsius"
 * were one token, no count could move it, because `indonesian.selectForm` returns the
 * constant `"other"` for every count and every slot. So the table being left out here
 * is one row per unit rather than `uk`'s eight — the cheapest a `forms` table can
 * possibly be — and it is still the wrong output, which is the strongest form the
 * "the symbol is the written form" argument can take anywhere in this repo.
 *
 * What that means concretely is that `indonesian.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so this
 * package exercises none of the grammar, and `id.test.ts` says so rather than
 * manufacturing an assertion that looks like it does. `symbol` carries the entire
 * output, which is precisely why R8 wants it explicit on all six.
 *
 * **The symbol is set tight against its number, and that is the one visible
 * difference from `nl` and `de`.** Those two spend a `renderQuantity` to write
 * "20 °C" with the SI space; `@smartput/core/locale/id` declares none and records
 * why — the default template's tight branch is reached only where a unit has neither
 * a `form` nor an `alias` to print, which for a translated vocabulary is almost
 * nowhere, so a sixth field would buy one space in one place. This package is that
 * place: with no `forms` on any unit the tight branch really is reached, and the
 * output is "20°C". That is what Indonesian writing does with a degree sign anyway —
 * the space is a convention SI recommends and Indonesian style does not enforce — so
 * the default template is right here rather than a cost being absorbed.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * shared `ALIAS` map in `units.ts`, so "212 F" keeps working in an Indonesian engine
 * and the micro path (`parseTemperature`) cannot drift from it.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds is
 * the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is also what
 * lets "20 C + 5 F" read its right operand as a difference. Deriving both lists from
 * the same map keeps them equal by construction instead of by proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which is
 * what lets `@smartput/temperature/locale/id` be imported without linking the ratio
 * tables. `composeLocale` is where the two halves meet.
 */
const temperatureId: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "id",
    kind: "temperature",
    units: {
      c: { aliases: alias("c"), symbol: "°C", tight: true },
      f: { aliases: alias("f"), symbol: "°F", tight: true },
      k: { aliases: alias("k"), symbol: "K", tight: true },
    },
  }),
  defineVocabulary({
    locale: "id",
    kind: "tempdelta",
    units: {
      c: { aliases: deltaAlias("c"), symbol: "°C", tight: true },
      f: { aliases: deltaAlias("f"), symbol: "°F", tight: true },
      k: { aliases: deltaAlias("k"), symbol: "K", tight: true },
    },
  }),
];

export default temperatureId;
