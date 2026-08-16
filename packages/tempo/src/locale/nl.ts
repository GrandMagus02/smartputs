import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Dutch words for the tempo units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. Shaped exactly like
 * `en.ts`, `de.ts` and `uk.ts` beside it, down to naming `tempo` by **id
 * string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the reciprocal bridge to
 * `duration`, and it is the seam `composeLocale` closes. `aliases` still derives
 * the Latin set from `units.ts` — a Dutch musician types "120 bpm" and nothing
 * else — and the Dutch spellings are appended.
 *
 * **`bpm` keeps no `forms`, and Dutch has no escape from that either.** `en.ts`
 * refuses them because "beats per minute" is a compound the lexer cannot read
 * back; a Germanic language's usual answer is to close the compound up, and
 * `@smartput/energy/locale/nl` prints `kilowattuur` on exactly that strength. It
 * does not work here, because the Dutch phrase is a prepositional one and not a
 * compound at all: "slagen per minuut", three words, where `kilowatt` + `uur`
 * was two nouns that could be glued. `parse/lex.ts` builds a unit word out of
 * letters plus trailing digits, so the space ends the token however the phrase
 * is spelled. Absent forms keep the renderer on the symbol.
 *
 * **The symbol is "bpm", and the abbreviation a Dutch metronome prints is not.**
 * That is "s/min" — slagen per minuut — and it carries "/", which lexes as
 * division, so "120 s/min" would reach the resolver as `tempo ÷ duration`, a
 * signature no kind declares and none should. `energy` and `speed` survive that
 * same shape by making the arithmetic true ("km/u" computes as length ÷
 * duration); the escape is closed here because tempo's canonical *is* beats per
 * minute — there is no "beat" kind for `s` to be a quantity of, and `index.ts`
 * declares only the two reciprocal `in` bridges, no `/` at all. It is doubly
 * closed in Dutch, in fact: `s` is already the second, and `min` is `dutch`'s
 * own `minus` keyword, so neither half of that abbreviation is free.
 *
 * So the requirement collapses to one line: the symbol must be a single token
 * that is already an alias. "bpm" is what a Dutch music forum writes, and it is
 * the only spelling that is both. `slagen` stays alongside it as a second way
 * *in* — the numerator of the abbreviation standing for the whole of it, by the
 * same elision that lets English "bpm" be typed for a tempo — but only "bpm"
 * also comes back out. Both numbers are listed, because *slag* is a count noun
 * with a real `-en` plural and `dutch` refuses to strip `en`.
 *
 * **`hz` declares both keys, and both hold `hertz`.** `dutch.selectForm` answers
 * the bare CLDR plural category over a single axis — `slot` is read and
 * discarded, because modern Dutch has no case marking left on common nouns — so
 * where `de.ts` writes four identical rows this writes two. *Hertz* is an eponym
 * used as a measure noun, and Dutch holds a unit of measure in the singular
 * after a numeral ("vijftig hertz", exactly as "vijftig watt" and "tien meter"),
 * so there is no second form of it to write. Two identical rows are the answer
 * here and not a table that stopped halfway; where the same claim would be
 * vacuous is a file in which *every* unit behaved that way, and
 * `@smartput/duration`'s Dutch *dag* and *dagen* — one package over, in the kind
 * this one bridges to — is the counter-example. This is also where Dutch and
 * English coincide by accident and for different reasons: English needed two
 * rows both spelled "hertz" because the noun is its own plural, Dutch because
 * the noun is a measure noun.
 *
 * The symbol `Hz` is SI's and is what Dutch writes; its capital is the initial
 * of Hertz the person rather than the noun capital German's file carries, and it
 * folds onto the derived alias `hz`, which is the mechanism by which a
 * `symbols: true` print parses back.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "slag", "slagen"],
      symbol: "bpm",
    },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { one: "hertz", other: "hertz" },
    },
  },
});
