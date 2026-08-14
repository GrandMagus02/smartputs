import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Dutch words for the duration units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. The shape is `en.ts`'s
 * unit for unit — the same `kind` id string (never an import of the kind),
 * `aliases` derived from `units.ts` rather than retyped, an explicit `symbol`
 * everywhere (ruling R8) — and what differs is the `forms` table.
 *
 * **Two keys, on one axis, and lowercase.** `dutch.selectForm` answers the bare
 * CLDR plural category: `slot` is read and discarded, because modern Dutch has
 * no case marking left on common nouns, so "in twee uur" and "twee uur" hold the
 * same word. That is the substantive difference from `de.ts` next door, whose
 * four keys carry a dative axis, and it is joined by the other one — Dutch
 * capitalises no noun, so every form below is lowercase where German's is not.
 *
 * **This kind is where Dutch's plural rule is actually interesting, and it is
 * the reason this file is worth reading rather than skimming.** Dutch holds a
 * unit of *measure* in the singular after a numeral — "tien meter", "vijf kilo",
 * "drie jaar" — and two of the six units here obey that rule while four do not:
 *
 * ```
 * one          other
 * milliseconde milliseconden   marked: an -e noun, plural in -n
 * seconde      seconden        marked, likewise
 * minuut       minuten         marked, with open-syllable shortening (uu -> u)
 * uur          uur             INVARIANT: "twee uur", never "twee uren"
 * dag          dagen           marked
 * week         weken           marked, with the same vowel shortening
 * ```
 *
 * `uur` is the row a translator will "finish" and should not. "Het duurt twee
 * uur" is how a Dutch speaker states a two-hour span; *uren* exists and is
 * ordinary Dutch ("we wachtten uren"), but it is the indefinite plural of an
 * unmeasured quantity, not the form a numeral governs. Writing it in the `other`
 * row would print a shape no Dutch measurement uses — and no round-trip test can
 * see the difference, because both spellings read back to the same unit. It is
 * listed in `aliases` for exactly that reason: read, never written.
 *
 * `dag` and `week` are the counterweight, and they are why the invariance above
 * is a fact about *uur* rather than about Dutch time words in general: "drie
 * dagen" and "twee weken" are the only spellings, so a file that wrote one word
 * in both rows throughout would be wrong five times over. `@smartput/datasize`'s
 * Dutch file sits entirely on the invariant side; this one straddles the line,
 * which is what makes the two-key table here a live table rather than a
 * formality.
 *
 * **Aliases.** The Latin set is reused from `units.ts` rather than retyped — a
 * Dutch developer types "2 h" as readily as "2 uur" — and the Dutch spellings
 * are appended in both numbers. Written out rather than left to the language's
 * `suffixStripper`, and here that is not merely house style: `dutch` deliberately
 * does **not** strip `en`, because Dutch's main plural shortens an open syllable
 * (*uur* → *uren*, *minuut* → *minuten*, *week* → *weken*) so the stripped stem
 * is not the singular in precisely these cases. Nothing but an explicit alias
 * recovers "minuten".
 *
 * **`uur` and `dag` are aliases here even though `dutch` deliberately keeps both
 * out of its compound heads**, and the two facts do not conflict — they are
 * different mechanisms. `compoundSplitter` cuts an *unknown* word at a known
 * tail, so a head list containing `uur` would read *natuur*, *cultuur* and
 * *temperatuur* as counts of hours, and one containing `dag` would read all
 * seven weekday names as counts of days. The alias index matches a whole token
 * exactly, so listing "uur" claims "uur" and claims nothing else. `nl.test.ts`
 * pins both halves.
 *
 * **The symbol for the minute is "min", and this unit is the reason
 * `@smartput/core/locale/nl` spells its subtraction keyword "minus".** "Min" is
 * the ordinary Dutch word for subtraction — "tien min drie" — and claiming it
 * as a keyword is the obvious reading of the language. It is also the wrong
 * one, and this file is where the cost lands: `parse/lex.ts` turns a keyword
 * surface into a keyword token before any alias index is consulted, and
 * `buildKeywords` folds *every installed language's* connectives into the one
 * table the lexer consults. So a Dutch `minus: ["min"]` does not merely make "5
 * min" unreadable in Dutch; it makes it unreadable in English too, in any engine
 * that installs both — and it splits this package's own micro path from the
 * engine path, since `parseDuration("5 min")` never lexes a keyword and goes on
 * answering five minutes. `min` is a language-neutral alias out of `units.ts`,
 * not a Dutch word this file could choose to drop, which is what makes the
 * collision the *language's* problem to move rather than this table's. The
 * language moved; see the comment on `minus` there for the full argument.
 *
 * So the symbol stays "min" — R8 says use the abbreviation the language actually
 * writes and never invent one, and "min" *is* what Dutch writes — and unlike
 * English `length:in`, whose symbol collides with core's own non-negotiable
 * conversion keyword and therefore needs `skipPrintable`, nothing here has to be
 * waived: "5 min" parses, "1 uur naar min" converts, and ordinary output is "90
 * minuten" because this unit declares `forms` and `formatValue` prefers a word.
 *
 * The other five symbols are what Dutch writes and are each already a derived
 * alias, so the printed symbol parses back by construction: `ms`, `s`, `d` and
 * `wk` are shared with English, and `u` is the Dutch one — "om 14 u 30", "3 u
 * 45" — where German writes `h`. It is homographic with the polite pronoun *u*,
 * which costs nothing here: a pronoun never stands where a unit label goes, and
 * `dutch` claims no keyword for it. The international `h` stays readable beside
 * it, from `units.ts`.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "duration",
  units: {
    // The two `-e` nouns. Their plural is a bare `-n`, which is the one Dutch
    // plural `dutch`'s `suffixStripper` does list — and they are written out
    // anyway, because rule 5 wants a printed form to be a declared alias rather
    // than one recovered at the stripper's −2.
    ms: {
      aliases: [...alias("ms"), "milliseconde", "milliseconden"],
      symbol: "ms",
      forms: { one: "milliseconde", other: "milliseconden" },
    },
    s: {
      aliases: [...alias("s"), "seconde", "seconden"],
      symbol: "s",
      forms: { one: "seconde", other: "seconden" },
    },
    // Open-syllable shortening: the doubled vowel of the singular becomes single
    // when a syllable is added, so *minuut* → *minuten* and not *minuuten*. This
    // is the exact rule that made `dutch` refuse to strip `en`, since the stem
    // left behind ("minut") is not a word.
    min: {
      aliases: [...alias("min"), "minuut", "minuten"],
      symbol: "min",
      forms: { one: "minuut", other: "minuten" },
    },
    // The invariant one. Both rows are "uur" because a numeral governs the
    // singular of a measure noun; "uren" is listed as an alias so the indefinite
    // plural a reader may type is understood, and it is never printed.
    h: {
      aliases: [...alias("h"), "u", "uur", "uren"],
      symbol: "u",
      forms: { one: "uur", other: "uur" },
    },
    d: {
      aliases: [...alias("d"), "dag", "dagen"],
      symbol: "d",
      forms: { one: "dag", other: "dagen" },
    },
    wk: {
      aliases: [...alias("wk"), "weken"],
      symbol: "wk",
      forms: { one: "week", other: "weken" },
    },
  },
});
