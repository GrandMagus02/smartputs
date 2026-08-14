import type { Language } from "../types";
import { defineLanguage } from "./define";
import { cardinalNumerals, cardinalSpeller, identity, suffixStripper } from "./helpers";
import { CARDINALS, SPELLING } from "./hi-cardinals";

const plural = new Intl.PluralRules("hi");

/**
 * A Devanagari character, used to decide whether a symbol is a word.
 *
 * `Script=Devanagari` and not `Script_Extensions`: the extension set drags in
 * the danda, the digits and a handful of marks shared with every other Brahmic
 * script, and this test only has to answer "is this abbreviation set in Hindi
 * letters or in Latin ones". Hoisted so the regex is compiled once rather than
 * per rendered quantity.
 */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/**
 * The Hindi language: how Hindi is read and written, with no word for any unit
 * in it.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Both halves of that are
 * decisions and both are pinned in `hi.test.ts` — see `numberFormat` below for
 * the digits and the paragraph after it for the grouping.
 *
 * **Grouping is the thing about Hindi this file exists to get right.** Every
 * other language in this directory groups digits in periods of three, so
 * "separator" and "period" are interchangeable words there and nothing notices.
 * `Intl.NumberFormat("hi")` uses the Indian system: the first group from the
 * right is three digits and every group after it is *two*, so a million is
 * written 10,00,000 and a crore 1,00,00,000. The separator is an ordinary comma
 * and the decimal an ordinary point — the same pair `en` uses — which is what
 * makes this easy to miss when only the symbols are checked.
 *
 * **Reading it costs nothing; writing it is a gap in core, reported here rather
 * than worked around.** `parseNumber` removes *every* occurrence of the group
 * character wherever it falls and never counts digits between them, so
 * "12,34,567.5" and "1,234,567.5" both reach `Decimal` as "1234567.5" — the
 * reader is grouping-agnostic by construction, and `hi.test.ts` pins that it
 * accepts a genuinely Indian-grouped string.
 *
 * The writer is not. `formatNumber` inserts the separator with a fixed
 * `/\B(?=(\d{3})+(?!\d))/g`, a period of exactly three, and `NumberFormatSpec`
 * — the only thing a language may hand it — carries a `group` character and a
 * `decimal` character and no grouping *rule* at all. So this engine prints
 * "1,234,567 ग्राम" where a Hindi page writes "12,34,567 ग्राम", and no field on
 * this object can change that. `hi.test.ts` pins both strings side by side so
 * the gap is a recorded fact rather than a surprise.
 *
 * What it does **not** break is the round trip, and that is worth separating
 * from the fidelity question because it is the property everything else rests
 * on: the engine reads its own output back byte for byte, because the string it
 * writes is grouped with the separator it reads. `hi.test.ts` asserts the round
 * trip through the real formatter as well as the Indian-grouped form the
 * formatter cannot yet produce, so the day core learns about grouping periods
 * the second assertion is already the regression test for it. The shape that
 * fix takes is a widening of `NumberFormatSpec` — a primary group size and a
 * repeating secondary one, `[3]` for English and `[3, 2]` for Hindi, derived
 * from `formatToParts` on the "intl" branch — which is a change to a shared
 * public type and therefore core's to make, not a language's.
 *
 * **The oblique case is not an axis here, and that is a choice.** Hindi nouns
 * inflect for a direct/oblique distinction that a postposition governs —
 * "किलोग्रामों में", never "किलोग्राम में", once the noun is plural — which is
 * the same shape that made `uk` and `ru` cross their plural category with a case
 * and return eight keys. Hindi does not get one, for a reason the two Slavic
 * languages could not claim: the unit nouns are almost all consonant-final
 * masculine loanwords (किलोग्राम, मीटर, ग्राम, लीटर, सेकंड), and for those the
 * direct and oblique singular are the *same word*. The axis would double every
 * `forms` table in the repo to record a distinction that shows up in one cell of
 * it. What Hindi actually needs from the oblique plural is the ability to *read*
 * it, and that is a suffix in the analyzer chain below, which costs one line and
 * no vocabulary anything.
 *
 * So `selectForm` returns CLDR's `"one" | "other"` and nothing else. A `forms`
 * table translated from `en` needs its two rows retranslated and no row added.
 *
 * Words for units are not here at all: they are `Vocabulary` tables beside the
 * kinds that declare the units, and they reach this object through
 * `composeLocale`.
 */
export const hindi: Language = defineLanguage({
  id: "hi",
  /**
   * Read from CLDR rather than transcribed, the same as every other language
   * here: this runtime's `Intl.NumberFormat("hi")` groups with "," and marks the
   * decimal with ".", and `hi.test.ts` pins both. Pinning the *output* of the
   * "intl" branch is different from bypassing it — a language that transcribes
   * separators it believes it knows is a language that can silently disagree
   * with the platform, and here it would also have had to transcribe a grouping
   * *rule*, which `NumberFormatSpec` cannot express at all.
   *
   * **Devanagari digits are not claimed, and the reason is not that they do not
   * matter.** १२३ is a real way to write 123 — `Intl.NumberFormat("hi", {
   * numberingSystem: "deva" })` formats 12,34,567.5 as १२,३४,५६७.५, and
   * `hi.test.ts` pins that too, because the alternative deserves to be visible.
   * Three things stand between it and this file:
   *
   * - CLDR's own default numbering system for the bare `hi` tag is `latn`, not
   *   `deva` (`resolvedOptions().numberingSystem`, asserted in the test). A
   *   Hindi page writes 1,00,000. Choosing `deva` here would mean disagreeing
   *   with the platform about the language, which is the exact failure mode the
   *   "intl" branch exists to prevent.
   * - NFKC does not fold Devanagari digits onto ASCII ones — they are distinct
   *   characters, not compatibility variants — so nothing upstream converts
   *   them, and nothing downstream would.
   * - A language could not claim them from here even if it wanted to.
   *   `numberFormat` names a group and a decimal separator and has no field for
   *   a digit set; `lex` decides what a digit is with an ASCII range test and
   *   what a word is with `\p{L}`, and १ is `\p{Nd}` — so a Devanagari digit is
   *   neither, and is skipped as an unrecognized character before `numerals` or
   *   `analyze` could ever see it. Reading them is a change to core's
   *   language-free half, which is reported rather than faked here: the shape it
   *   would take is a digit-folding pass in the normalizer, beside the one that
   *   already folds whitespace, so that every language gains every numbering
   *   system at once instead of fifteen languages each claiming their own.
   */
  numberFormat: "intl",
  // No `segment` hook, which for a non-Latin script is worth saying explicitly
  // rather than leaving as an absence.
  //
  // Devanagari is not an unspaced script. Hindi puts a space between every word
  // exactly as English does — "पाँच किलोग्राम को ग्राम में" is five words with
  // four spaces — so `lex`'s own letter-run split has already done the work that
  // `scriptSegmenter` does for `ja` and `zh`. Installing one here would hand ICU
  // a run it would return unchanged, at the cost of a segmenter per keystroke.
  //
  // The postpositions are the reason this could look otherwise: को, में, से and
  // का attach to the noun the way a case ending would in Russian, and a reader
  // coming from `ru` might expect them fused. They are not — Hindi writes them
  // as separate words, which is also why they can be `keywords` below instead of
  // suffixes.
  //
  // What Devanagari *did* need was in `lex`, not here, and it is the one change
  // outside this file that Hindi required. A letter run was built out of `\p{L}`
  // alone, and an abugida writes its vowels as combining marks (`\p{M}`) hung on
  // the consonants — so किलोग्राम lexed as the bare consonant क and `1
  // किलोग्राम` reported `Unknown unit "क"`. `lex` now continues a run through a
  // mark (never starts one on it), which is strictly additive and is what makes
  // every Indic, Thai, Khmer and Ethiopic script reachable at all. `hi.test.ts`
  // pins it end to end, because it is the difference between this language
  // reading Hindi and merely describing it.
  analyze: [
    // Required, not decorative: the resolver reaches an alias only through a
    // form some analyzer produced, so a chain without `identity()` cannot read
    // its own vocabulary.
    identity(),
    // Hindi noun morphology is thin compared with the Slavic languages here, and
    // the fallback stripper is thin to match. Each suffix is one ending a unit
    // noun genuinely takes:
    //
    //   ों  oblique plural, every gender   किलोग्रामों में → किलोग्राम
    //                                      This is the one that earns the
    //                                      analyzer its place: it is what a
    //                                      plural noun becomes in front of a
    //                                      postposition, so it is precisely the
    //                                      form the `in` keywords below put a
    //                                      unit into.
    //   ें  direct plural, cons.-final fem. रातें → रात
    //   एँ  direct plural, ा-final fem.    मात्राएँ → मात्रा
    //   एं  the same ending with an        मात्राएं → मात्रा
    //       anusvara instead of a
    //       chandrabindu; both keyboards
    //       are in use and NFKC folds
    //       neither onto the other
    //   े   direct plural, ा-final masc.   रुपये → रुपय
    //
    // The last row produces a *stem* rather than a lemma, and so does ों on a
    // ा-final noun (कमरों → कमर). That is acceptable for the same reason it is
    // acceptable in `ru`: Hindi marks these by substituting the final vowel and
    // a stripper only removes. This is the fallback, not the vocabulary — a
    // `Vocabulary` lists the forms a reader is expected to type, and the
    // stripper catches what it did not think to list.
    //
    // The chandrabindu-after-matra spelling of the feminine plural (ेँ, as in
    // रातेँ) is deliberately left out: the anusvara form is what modern
    // typesetting and every input method produce, and a fifth ending that fires
    // on nothing is a lookup per word for no reading.
    //
    // `minStem: 3` keeps it away from the short Devanagari abbreviations Hindi
    // units are written with — किग्रा, मी, ग्रा, से.मी. — measured in UTF-16
    // units, which is what `suffixStripper` counts, so a two-letter
    // consonant-plus-matra abbreviation like मी is length 2 and out of reach
    // even before the suffix list is consulted. `weight: -2` is the penalty `en`,
    // `uk` and `ru` all use, so an exactly listed alias always outranks a
    // stripped one.
    suffixStripper({
      suffixes: ["ों", "एँ", "एं", "ें", "े"],
      minStem: 3,
      weight: -2,
    }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  // `SPELLING` is `CARDINALS` with the synonyms filtered out, derived from it by
  // a function rather than written twice. See `hi-cardinals.ts`: the reading
  // direction must accept हज़ार *and* हजार, and the writing direction must never
  // emit the second.
  spell: cardinalSpeller(SPELLING),
  keywords: {
    /**
     * Three postpositions, all of which land where an infix operator goes, and
     * that is the whole test they had to pass.
     *
     * Hindi is head-final, so a postposition attaches to the end of the phrase
     * it governs — the same problem `ja` documents for を and に. The engine
     * reads `in` as an infix between a source and a target, so a Hindi
     * postposition is usable exactly when it sits on the *left* operand:
     *
     *   में  "एक किलोग्राम में कितने ग्राम" — "in one kilogram, how many
     *        grams". The postposition follows the source and precedes the
     *        target, which is the infix position, and this is the commonest way
     *        a Hindi speaker asks a conversion question at all.
     *   को   "पाँच किलोग्राम को ग्राम" — the accusative/dative marker, and the
     *        one a full sentence uses: "…को ग्राम में बदलिए" ("convert … into
     *        grams").
     *   से   "किलोग्राम से ग्राम" — "from kilograms to grams", the heading over
     *        every conversion table printed in Hindi.
     *
     * The full sentence "पाँच किलोग्राम को ग्राम में बदलिए" puts *both* को and
     * में in the input, and only को is in the infix position; में then arrives
     * after the target, where the parser leaves it unconsumed and fails, exactly
     * as a trailing "as" does in English. That is a known limit of an infix `in`
     * and not something a keyword table can fix — see `ja`'s note on the same
     * point.
     *
     * का (the genitive, "50 का 20%") is deliberately absent. It is the word
     * Hindi uses for `of`, and it puts the base first and the percentage second,
     * where this engine's `of` wants them the other way round. A keyword table
     * cannot swap operands; percentage arithmetic in Hindi word order needs an
     * `OpSignature` of its own, which is a change to a kind and is reported
     * rather than faked here. `off` is absent for the matching reason: Hindi
     * says "50 पर 20% छूट", where the operator is the noun छूट ("discount")
     * sitting after both operands.
     */
    in: ["में", "को", "से"],
    /**
     * The four arithmetic words, and they are nouns rather than verbs on
     * purpose.
     *
     * Hindi states an operation as "<left> को <right> से गुणा कीजिए" — operands
     * first, operator last, which is head-final and unparseable as an infix. But
     * the bare operator noun is *also* used infix, and that is how arithmetic is
     * read aloud and written in a schoolbook or a calculator: "दस जोड़ पाँच",
     * "दस घटा पाँच", "पाँच गुणा तीन", "दस भाग दो". Those four words are what is
     * claimed here.
     *
     * `by` is not claimed, and the reason is mechanical rather than lexical.
     * `by` exists so that a two-word operator ("divided by", "разделить на")
     * folds into one, and `foldWordOps` looks for it *after* the operator word.
     * Hindi's companion particle is से and it comes *before*: "दो से भाग".
     * There is nothing after गुणा or भाग for the fold to swallow, so a `by` entry
     * could only ever match in a position Hindi does not write — and से is
     * already claimed above, where it does real work.
     *
     * जोड़ is declared twice, once without its nukta, and it is the only one of
     * the four that needs a twin: ड़ is a Unicode composition exclusion, so NFKC
     * settles the *encoding* of the mark, but nothing ever supplies a mark that
     * was never typed, and "जोड" is what a keyboard without a nukta key
     * produces. That matters more for a keyword than for a unit word.
     * `buildKeywords` is an exact map consulted before the alias index, and the
     * keyword fold has no fuzzy path and no penalised second chance the way an
     * alias does — so an unlisted spelling of an operator is not a demoted
     * reading, it is a hard parse failure ("दस जोड पाँच" threw `Unknown unit
     * "जोड"`). This is the same pairing `hi-cardinals.ts` makes for हज़ार/हजार
     * and करोड़/करोड, and the vocabularies make for फ़ीसदी/फीसदी. घटा, गुणा and
     * भाग carry no nukta and need no twin.
     */
    plus: ["जोड़", "जोड"],
    minus: ["घटा"],
    times: ["गुणा"],
    over: ["भाग"],
  },
  /**
   * `"one" | "other"` — CLDR's two categories, and the full key set a Hindi
   * `forms` table needs. See the class comment above for why there is no case
   * axis crossed with them.
   *
   * The boundary is not where an English speaker expects it, and it is the one
   * thing a translator will get wrong. Hindi's `one` is `i = 0 or n = 1`: it
   * covers 0 and every fraction below 1 as well as 1 itself, so 0, 0.5 and 1 all
   * take the singular ("आधा किलोग्राम") while 1.5 and 2 take `other`. English
   * puts 0 in `other` and Hindi does not, so a table ported from `en` by
   * translating two rows in place will read correctly and print the wrong row
   * for zero. `hi.test.ts` pins every count that moves the answer.
   *
   * A count-free conversion target answers `"other"` (ruling R5) — CLDR's
   * generic category, and the row every vocabulary in this repo already writes
   * for that case.
   */
  selectForm: ({ count }) =>
    count === undefined ? "other" : plural.select(count.toNumber()),
  /**
   * The default template, with one branch changed: a Devanagari symbol is set
   * off from the number by a space, a Latin one is not.
   *
   * `defaultRenderQuantity` spaces a word and closes up a symbol, on the
   * English convention that "1.5 kilograms" takes a space and "1.5kg" does not.
   * The first half of that is right for Hindi and the second half is only right
   * for half of Hindi's symbols. R8 asks each unit for the abbreviation the
   * language actually uses, and Hindi has two registers side by side: किग्रा,
   * मी and ग्रा in Devanagari, and kg, m and g in Latin in any technical
   * document. Devanagari sets an abbreviation as a word — "5 किग्रा", never
   * "5किग्रा", which reads as a single unbroken run — while a Latin symbol in a
   * Hindi sentence keeps the tight spacing it has everywhere else.
   *
   * So the branch is chosen by the script of the symbol rather than by the
   * language, which is what makes it correct for a vocabulary that mixes the two
   * registers across its units, as a real one will.
   *
   * Everything else is the default's, unchanged: the label precedence (a word,
   * then a symbol, then I10's degradation to the bare unit key for a
   * half-translated vocabulary), and `gap` still winning outright when the
   * caller has resolved a separator of its own — `Printer`'s `spacing` is a
   * typographic choice belonging to the caller, not to the language.
   */
  renderQuantity: (p) => {
    const word = p.form ?? p.alias;
    if (word !== undefined) return `${p.number}${p.gap ?? " "}${word}`;
    if (p.symbol !== undefined) {
      const gap = p.gap ?? (DEVANAGARI.test(p.symbol) ? " " : "");
      return `${p.number}${gap}${p.symbol}`;
    }
    return `${p.number}${p.gap ?? " "}${p.unit}`;
  },
});

export default hindi;
