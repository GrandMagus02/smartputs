import type { Language } from "../types";
import { defineLanguage } from "./define";
import { compoundSplitter, identity, suffixStripper } from "./helpers";
import { dutchNumerals, dutchSpeller } from "./nl-cardinals";
import { defaultRenderQuantity } from "./render";

/**
 * The nouns a Dutch measurement compound may end in.
 *
 * **This is morphology, not vocabulary, and the distinction is what allows it
 * into a `Language` at all.** A `Vocabulary` maps a word to a unit id inside a
 * kind, with a symbol and a `forms` table; this is a flat list of strings with
 * no unit, no kind and no meaning attached. It says only *where a Dutch compound
 * may be cut* — a Germanic compound is right-headed, so its last element says
 * what the word is a kind of — and every question about what the resulting
 * string denotes is answered by the alias index, built from vocabularies this
 * file has never seen. Drop `@smartput/mass/locale/nl` from an engine and `gram`
 * below still splits and simply resolves to nothing.
 *
 * **Inflected heads are listed separately**, because the analyzer chain does not
 * iterate: `createAnalyzerChain` runs every analyzer over the same original
 * surface and pools the results, so the `-s` that `suffixStripper` would take
 * off `vierkantemeters` never reaches the splitter. `meters` is therefore a head
 * in its own right.
 *
 * **Four heads deliberately left out**, each because the cost is a real Dutch
 * word rather than a hypothetical one:
 *
 * - `dag`. All seven weekday names end in it — *maandag*, *dinsdag*, *woensdag*,
 *   *donderdag*, *vrijdag*, *zaterdag*, *zondag* — so a head list containing it
 *   reads every one of them as a count of days. This is German's `tag` problem
 *   in the same family, and it survives translation intact.
 * - `uur`. Dutch has a large `-tuur`/`-uur` class of ordinary abstract nouns:
 *   *natuur*, *cultuur*, *structuur*, *temperatuur*, *literatuur*, *avontuur*.
 *   Listing the hour turns all of them into durations.
 * - `voet` and `duim`. Both are body parts before they are units (*klompvoet*,
 *   and *duim* is the everyday word for a thumb), and neither forms a productive
 *   measurement compound in Dutch, so the head would only ever cost.
 *
 * And two the German list leaves out that this one keeps, because the objection
 * to them **does not translate**:
 *
 * - `bar`. German excludes it because `-bar` is its productive adjective suffix
 *   (*sichtbar*, *brauchbar*). Dutch spells that same suffix `-baar`, with a
 *   long vowel — *zichtbaar*, *bruikbaar* — so it does not end in `bar` at all
 *   and the collision German is avoiding cannot occur here.
 * - `graad`. German excludes `grad` because of *Belgrad*, *Leningrad* and the
 *   row of `-grad` place names. Dutch writes the unit with a long vowel and
 *   those names without one, so they do not collide either. What it does cost is
 *   *breedtegraad* and *lengtegraad*, latitude and longitude — and those are
 *   degrees of arc, so reading them as degrees is very nearly right.
 *
 * `gram` is kept despite ending *diagram* and *telegram*, for the reason German
 * keeps `gramm`: Dutch never writes "kilo gram" apart, so without this head
 * every mass compound in the language is unreadable. The cost is bounded — a
 * split is only ever consulted for a token standing where a unit goes, and it is
 * offered at `compoundSplitter`'s penalty, so any exact alias outranks it.
 * `ton` is kept on the same footing: it ends *karton*, but `minPart: 3` already
 * blocks *beton*, whose head is two letters.
 */
const COMPOUND_HEADS = [
  // Length. Dutch measure nouns are invariant after a numeral ("tien meter",
  // never "tien meters"), so the `-s` forms below are the *counted* plurals a
  // reader writes anyway rather than required ones.
  "meter",
  "meters",
  "mijl",
  "mijlen",
  // Volume and mass.
  "liter",
  "liters",
  "gram",
  "grammen",
  "ton",
  "tonnen",
  // Time. `dag` and `uur` are the two absent from this group; see above.
  "seconde",
  "seconden",
  "minuut",
  "minuten",
  "week",
  "weken",
  "maand",
  "maanden",
  "jaar",
  "jaren",
  // Data. Loanwords, so they take the English `-s` plural, which is exactly why
  // each is listed twice rather than left to `suffixStripper`.
  "byte",
  "bytes",
  "bit",
  "bits",
  // Electrical, energy, pressure, frequency and angle. All invariant after a
  // numeral ("twee watt", never "twee watts"), so each is a single entry —
  // except the two that are ordinary `-e` nouns and take `-n`, and `ampère`,
  // whose accent survives in careful Dutch and vanishes in the rest.
  "watt",
  "volt",
  "ampère",
  "ampere",
  "joule",
  "hertz",
  "newton",
  "pascal",
  "bar",
  "graad",
  "graden",
  "calorie",
  "calorieën",
];

const plural = new Intl.PluralRules("nl");

/**
 * The Dutch language: how Dutch is read and written, with no word for any unit
 * in it.
 *
 * Dutch is German's near neighbour and the interesting part is where it stops
 * being one. It shares the stress that made German worth shipping — the
 * unsegmentable compound — and pointedly does **not** share the other two:
 *
 * **Compounding, yes.** `kilometer`, `vierkantemeter`, `kubiekemeter` and
 * `bandmeter` are single tokens the lexer cannot cut and no vocabulary can
 * enumerate, so `compoundSplitter` is as load-bearing here as it is in `de.ts`.
 *
 * **Capitals, no — and this is the German stress Dutch does not share.** Dutch
 * capitalises no noun. A unit word is lowercase in running text, in a search box
 * and in a printed result alike, so the case path `third-language.test.ts` had
 * to prove for German is simply not exercised by this language. Saying so out
 * loud matters because the two languages otherwise look interchangeable, and a
 * reader who assumes German's rules carry over will write a vocabulary of
 * capitalised nouns that no Dutch reader would type.
 *
 * **A second grammatical axis, no.** Modern Dutch has no case system left on
 * common nouns: `in`, `naar` and `van` govern nothing, so a conversion target
 * looks exactly like a bare quantity. `selectForm` therefore returns the plain
 * CLDR category, and the key set is English's two — see the comment on it, which
 * is the contract every Dutch `Vocabulary` keys its `forms` table off.
 *
 * What Dutch does bring that neither German nor English does is a plural rule
 * that measure nouns opt out of: "tien meter", "vijf kilo", "twee liter" and
 * "drie jaar" are all singular after a numeral, while "twee minuten" and "drie
 * weken" are not. That is a vocabulary's problem rather than a language's, but
 * it is why a `forms` table here will often write the same word twice and
 * occasionally must not.
 */
export const dutch: Language = defineLanguage({
  id: "nl",
  /**
   * Read from CLDR rather than transcribed, the same as every language here.
   * This runtime's `Intl.NumberFormat("nl")` groups with "." and marks the
   * decimal with "," — German's pair, and the exact inverse of English's — and
   * `nl.test.ts` pins both. Pinning the *output* of the "intl" branch is not the
   * same as bypassing it: a language that transcribes its own separators is a
   * language that can disagree with the platform, which is the whole failure
   * mode being avoided.
   */
  numberFormat: "intl",
  analyze: [
    // Required, not decorative. `createResolver` looks a surface up only through
    // the forms some analyzer produced — there is no unconditional lookup of the
    // raw word — so a Dutch chain without `identity()` cannot reach its own
    // aliases, and `kilometer` silently reads as the splitter's `meter`.
    // `third-language.test.ts` measures that exact failure.
    identity(),
    compoundSplitter({ vocabulary: COMPOUND_HEADS, minPart: 3 }),
    /**
     * The endings a Dutch unit noun actually takes, and **not** the one it looks
     * like it should.
     *
     *   s   the plural of every measure loanword, and the commonest of all here
     *       meters -> meter, bytes -> byte, kilometers -> kilometer
     *   's  the plural of a noun ending in a single vowel, which Dutch writes
     *       with an apostrophe so the vowel stays long
     *       kilo's -> kilo, euro's -> euro
     *   n   the plural of an `-e` noun, where the `-en` plural really is a bare
     *       `-n`
     *       seconden -> seconde, calorieën -> calorieë (harmless: no such alias)
     *
     * **`en` is deliberately absent, and that is a Dutch-specific finding rather
     * than an oversight.** Dutch's main plural looks like a suffix and is not
     * one: it triggers open-syllable shortening (*jaar* → *jaren*, *uur* →
     * *uren*, *minuut* → *minuten*) or consonant doubling (*ton* → *tonnen*,
     * *gram* → *grammen*) in essentially every native measure noun. Stripping
     * `en` from those yields *jar*, *ur*, *minut*, *tonn*, *gramm* — a stem that
     * is not the singular in exactly the cases the rule would be needed for, and
     * a penalised near-miss is worse than nothing because it competes. Those
     * plurals are listed as compound heads above and belong in a vocabulary's
     * `aliases`, which is where a form a reader will actually type belongs.
     *
     * `minStem: 3` keeps the stripper away from the two-letter symbols Dutch
     * writes units with (kg, cm, km, ml), and `weight: -2` is the penalty `en`,
     * `uk` and `de` all use, so an exact alias always outranks a stripped one.
     */
    suffixStripper({ suffixes: ["s", "'s", "n"], minStem: 3, weight: -2 }),
  ],
  /**
   * Dutch's own, rather than the shared `cardinalNumerals`. Dutch writes every
   * numeral below a million as a single token — `eenentwintig`,
   * `driehonderdvijfenveertigduizendzeshonderdachtenzeventig` — and the shared
   * helper models a numeral as a run of words. `third-language.test.ts` pinned
   * that limit against German and concluded that a compounding language ships
   * its own; see `nl-cardinals.ts`, which is that, over one table read in both
   * directions, and which also explains why German's own decomposer cannot
   * simply be re-pointed at Dutch words.
   */
  numerals: dutchNumerals(),
  spell: dutchSpeller(),
  keywords: {
    // "in" is English's and German's "in", the same surface under the same
    // `Keyword`, so `buildKeywords` folds the three into one entry rather than
    // refusing them. "naar" is the directional preposition a conversion is
    // spoken with: "1 km naar meter".
    in: ["in", "naar"],
    of: ["van"],
    // No word claimed for `off`, and that is a decision rather than an omission
    // — the same one German makes, for the same structural reason. Dutch states
    // a discount as a noun plus a preposition ("20% korting op 50"), and `off`
    // is a single-token keyword with no way to carry the "op". Claiming
    // "korting" alone would make "20% korting 50" the one spelling that works,
    // which is a phrase no Dutch speaker writes; the arithmetic itself stays
    // reachable through `-` and `%`.
    plus: ["plus"],
    /**
     * "minus", and **not** the commoner "min" — a forced choice rather than a
     * preferred one, and the one place this table gives up the most idiomatic
     * Dutch word on purpose.
     *
     * "Min" is what a Dutch speaker says for subtraction: "tien min drie". It is
     * also the SI symbol for the minute, which `@smartput/duration`'s `units.ts`
     * ships as a **language-neutral** alias — a surface every locale is expected
     * to read, in the same way "kg" is. Claiming it here does not cost Dutch one
     * spelling of one unit; it costs three things, each larger than the last:
     *
     * - `lex` turns a keyword surface into a keyword token before any alias
     *   index is consulted, so "5 min" and "1 uur naar min" stop parsing at all.
     * - `buildKeywords` folds *every installed language's* connectives into one
     *   table, and the lexer consults that one table. So an engine that installs
     *   this language beside `en` loses "5 min" **in English too**. A language
     *   may not make another language's input unreadable, and this is the only
     *   way in the model that it can.
     * - It splits the micro path from the engine path, which is the exact drift
     *   deriving aliases from `units.ts` exists to prevent:
     *   `parseDuration("5 min")` keeps answering five minutes while
     *   `evaluate("5 min")` refuses.
     *
     * "Minus" is ordinary Dutch for the same operator — it is the word a Dutch
     * text reaches for in front of a magnitude, "minus vijf graden" — and it
     * collides with nothing in any installed vocabulary. Every other language
     * here spells this connective out for the same reason (`minus`, `мінус`), so
     * the fix is also the convention. "-" was never at risk either way, which is
     * what bounds the cost to one spelling of one operator.
     */
    minus: ["minus"],
    // "maal" is the arithmetic word and "keer" is the spoken one — "drie maal
    // vier" on a worksheet, "drie keer vier" everywhere else. Both are bare
    // multipliers needing no particle after them, so both are `times`. This is
    // not the synonym-collecting `en.ts` warns against under `off`: that warning
    // is about an operator that reads as a preposition, and neither of these is
    // a preposition in any other reading.
    times: ["maal", "keer"],
    // "gedeeld door" is one operator, split the way English's "divided by" is:
    // the participle is the `over` and the preposition after it is the `by` that
    // `foldWordOps` swallows into the same token.
    //
    // The cost, stated rather than hidden: a bare "10 door 2" does not parse,
    // because "door" is a `by` and a stray `by` fails at the parser. Claiming
    // "door" as `over` instead was rejected for the reason German rejects it for
    // "durch" — it makes the commoner, fully spelled "gedeeld door" emit two
    // division operators in a row. English pays exactly this cost for "10 by 2".
    over: ["gedeeld"],
    by: ["door"],
  },
  /**
   * One axis: the CLDR plural category, and nothing else. `Intl.PluralRules("nl")`
   * declares exactly two, so **the key set is exactly `one` and `other`** — the
   * contract every Dutch `Vocabulary` keys its `forms` table off, and it is
   * closed at two, which is what `assertLocaleContract`'s fourth check asserts.
   *
   * `slot` is read and discarded, which is the substantive difference from
   * `de.ts` and the reason this is written out rather than left implicit. German
   * adds a case axis because `in` governs the dative there; Dutch lost its case
   * marking on common nouns centuries ago, so `in`, `naar` and `van` govern
   * nothing and a conversion target is spelled exactly like a bare quantity.
   * Adding a `dat-`/`nom-` axis here would double every table in the language to
   * hold two copies of one word.
   *
   * Zero takes `other` ("0 kilometer" — Dutch marks it like any other non-one),
   * as does every fraction, which is why "1,5 meter" and "7 meter" select the
   * same row.
   *
   * **The fraction row is a real plural in Dutch, and that is worth checking
   * rather than assuming**, because it is not in every language: Ukrainian sends
   * a fraction to a genitive *singular*, so a table that wrote a plural there
   * printed a word Ukrainian does not use. Dutch has no such row. A counted noun
   * after a decimal above one is plainly plural — "2,5 dagen", "3,5 graden",
   * "1,5 knopen" — and a measure noun is invariant there for the same reason it
   * is invariant after "tien", so both kinds of table are already right.
   *
   * The one place CLDR is coarser than careful Dutch is a fraction *below* one,
   * where an edited text writes the singular ("0,5 seconde", "0,3 graad") and
   * `Intl.PluralRules("nl")` still answers `other`. It is left alone rather than
   * special-cased: the split is not categorical — "0,5 seconden" is ordinary
   * written Dutch too — and a hand-rolled rule here would be this language
   * disagreeing with the platform, which is the failure mode `numberFormat:
   * "intl"` above is chosen to avoid.
   */
  selectForm: ({ count }) =>
    // Ruling R5: a conversion target has no magnitude to agree with, and `other`
    // is the category CLDR requires every locale to define as its generic one.
    // It is also the form Dutch itself wants in that position, which is the
    // check that matters and not the fallback: a conversion target is named in
    // the plural — "omrekenen naar minuten", "1 uur in seconden", "een hoek in
    // graden" — never with the bare singular. So `other` is a decision here and
    // not the default landing on its feet.
    count === undefined ? "other" : plural.select(count.toNumber()),
  /**
   * `defaultRenderQuantity` with one change: a symbol is set off from the number
   * by a space rather than tight against it.
   *
   * That is the SI convention, which Dutch typography follows as strictly as
   * German does — "5 kg", never "5kg" — and it is the one place the default
   * template, written for English's tight `5kg`, says something wrong about this
   * language. The word branch is untouched because it already spaces, and `gap`
   * still wins wherever the caller resolved a separator of its own, so
   * `Printer`'s `spacing` option reaches through here exactly as it does through
   * the default.
   *
   * **The one Dutch symbol this rule is wrong about is the plane-angle degree,
   * and it is left alone on purpose.** SI writes "90°" tight and so does Dutch,
   * against the "20 °C" that is spaced — so the exception is the whole symbol
   * `°` and not the character, since `@smartput/temperature/locale/nl` needs its
   * space. It is not carved out here because nothing would reach the carve-out:
   * `@smartput/angle/locale/nl` declares `forms`, so `formatValue` prints
   * "90 graden" and never consults the symbol, and the only caller that does —
   * `Printer` under `symbols: true` — resolves the separator itself from its own
   * `spacing` option and hands it over as `gap`, which wins here by design.
   * "90 °" out of that mode is `Printer.spacing`'s doing and is English's answer
   * for "20 %" too; a branch in this language could not change it, and an
   * unreachable one asserting otherwise would be worse than the note.
   */
  renderQuantity: (parts) =>
    parts.form === undefined && parts.alias === undefined && parts.symbol !== undefined
      ? `${parts.number}${parts.gap ?? " "}${parts.symbol}`
      : defaultRenderQuantity(parts),
});

export default dutch;
