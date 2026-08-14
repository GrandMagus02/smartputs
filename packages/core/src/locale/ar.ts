import type { Analyzer, Language } from "../types";
import { arabicSpeller, CARDINALS } from "./ar-cardinals";
import { defineLanguage } from "./define";
import { cardinalNumerals, identity, prefixStripper, suffixStripper } from "./helpers";
import { defaultRenderQuantity } from "./render";

/**
 * Short vowels, tanwīn, shadda, sukūn (U+064B–U+0652), the superscript alif
 * (U+0670) and the tatwīl (U+0640), which is a stretching mark rather than a
 * letter.
 *
 * None of them is written in ordinary Arabic prose — a newspaper, a search box
 * and a spreadsheet header all set كيلوغرام bare — but all of them appear in
 * text copied out of a dictionary, a textbook or a religious edition. They carry
 * no information a unit alias needs, so folding them away is lossless here in a
 * way it would not be in a general text pipeline.
 *
 * Escapes, not literals. Every character in this class is a combining mark that
 * renders *on top of* the letter before it, so written out it would be invisible
 * in source — and U+0640, which is not a mark at all but a horizontal stretch of
 * the baseline, is indistinguishable from a dash to a reader skimming the line.
 */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/**
 * The three hamza-bearing alifs (آ أ إ) and the alif maqṣūra (ى), folded to the
 * plain alif (ا) and to the dotted yāʾ (ي).
 *
 * This is the Arabic counterpart of Ukrainian's three apostrophes: one word,
 * several spellings, and no way to know which one a keyboard produced. The fold
 * runs one way only — it removes a hamza the user typed and can never invent one
 * they did not — so **a vocabulary whose alias contains أ, إ, آ or ى should
 * declare the plain-alif spelling beside it**, exactly as `ar-cardinals.ts`
 * declares both أربعة and اربعة. The analyzer closes the gap in the direction a
 * careful typist creates; only the vocabulary can close the other one.
 */
const HAMZA_ALIF = /[\u0622\u0623\u0625]/g;
const ALIF_MAQSURA = /\u0649/g;

/**
 * Orthography, not morphology — which is what makes it a `Language`'s business
 * rather than a `Vocabulary`'s. It maps a string to a string with no unit, no
 * kind and no meaning attached, the same test `de.ts` applies to its compound
 * heads.
 *
 * Offered at −1 rather than the strippers' −2: this is a spelling fold and not a
 * guess about morphology, so a reading it reaches should outrank one that had to
 * take a suffix off — but still lose to an exact alias, which is what the
 * negative sign is for.
 *
 * Returns nothing when the fold changes nothing, so an already-bare word does
 * not pay for a duplicate candidate that `identity()` has already produced.
 */
const orthography: Analyzer = (surface) => {
  const folded = surface
    .replace(DIACRITICS, "")
    .replace(HAMZA_ALIF, "ا")
    .replace(ALIF_MAQSURA, "ي");
  return folded === surface || folded.length === 0 ? [] : [{ form: folded, weight: -1 }];
};

const plural = new Intl.PluralRules("ar");

/**
 * The Arabic language: how Arabic is read and written, with no word for any unit
 * in it.
 *
 * Arabic is the hardest language in this set, and it is worth saying exactly
 * why, because two of the three reasons are invisible until something breaks.
 *
 * **1. Six plural categories, one of which is a dual.** `Intl.PluralRules("ar")`
 * declares `zero`, `one`, `two`, `few`, `many` and `other`, and Arabic uses
 * every one of them. No other language shipped here has more than four, and none
 * has a *dual* at all: كيلوغرامان is a form of the noun that means exactly two
 * of the thing, built by a suffix rather than by a separate word. A `forms`
 * table for Arabic therefore has six rows where English has two — see
 * `selectForm` below, which is the contract every Arabic `Vocabulary` keys off.
 *
 * **2. The digits.** Arabic has two numbering systems in live use: the Arabic-
 * Indic digits ٠١٢٣٤٥٦٧٨٩ (`arab`) and the European ones (`latn`). CLDR's answer
 * for "Arabic" depends on which Arabic you ask for — on this runtime bare `ar`
 * and `ar-AE` resolve to `latn`, `ar-EG`, `ar-SA`, `ar-JO` and `ar-IQ` to
 * `arab`, and the Maghreb (`ar-MA`, `ar-DZ`, `ar-TN`) to `latn` with *French*
 * separators — so `numberFormat` is the one field in this file that is
 * transcribed rather than read from the platform. See its own comment for the
 * measurement that forces it; it is the only such field in the repo, and the
 * decision is pinned from four sides in `ar.test.ts`.
 *
 * **3. Right-to-left, which is not this file's problem and must not become
 * one.** A JavaScript string is a sequence of characters in *logical* order:
 * first-read is first-in-the-string, whichever way the script runs. `"٥ كغ"`
 * holds the number first and the unit second exactly as `"5 kg"` does, and the
 * Unicode Bidirectional Algorithm — in the terminal, the browser, the text field
 * — is what puts the number on the right at display time. **So there is no
 * reversal anywhere in this file, and adding one would produce a string that is
 * wrong in memory and only looks right in one particular renderer.** Two
 * specific temptations, both declined:
 *
 * - Reversing the parts in `renderQuantity`. That would emit the unit before the
 *   number in logical order, which `parse` then reads as a unit followed by a
 *   number, and the round trip `parse(format(v)) === v` breaks.
 * - Wrapping the number in bidi isolates (U+2066…U+2069) so a Latin-digit run
 *   cannot be re-ordered by neighbouring text. These are invisible characters
 *   inside a string this engine must be able to read back; `normalize()` strips
 *   the zero-width family it knows about and these are not in it, so they would
 *   travel into the lexer. Isolation is the *display* layer's job, and a caller
 *   that needs it can wrap the finished string.
 */
export const arabic: Language = defineLanguage({
  id: "ar",
  /**
   * Transcribed, and the only language in this repo that does not take the
   * `"intl"` branch. The reason is not a disagreement with CLDR about how Arabic
   * writes numbers — it is that **this engine can only emit Latin digits**, so
   * pairing them with the Arabic-Indic separators would produce a script neither
   * convention uses.
   *
   * Three places make that true, none of them reachable from a `Language`:
   * `formatNumber` builds its output from `Decimal.toFixed()`, which is ASCII;
   * `parseNumber` tests the cleaned text against `/^-?\d*\.?\d+$/`, and `\d` in
   * JavaScript is ASCII even under `/u`; and `lex`'s own `isDigit` is a `c >=
   * "0" && c <= "9"` range check. So `lex("٥ كغ")` today returns **one token**,
   * the word — the digit is not a number, is not a letter, and falls through to
   * the "unrecognized character: skip it" branch. `ar.test.ts` pins that
   * behaviour rather than describing it.
   *
   * Given that, the choice between the two numbering systems is really a choice
   * between two failures:
   *
   * - **`arab`** (what `Intl.NumberFormat("ar-EG")` gives): group U+066C, decimal
   *   U+066B. Printed output becomes `1٬234٫5` — Latin digits with Arabic-Indic
   *   separators, a hybrid nobody writes — and input written in real Arabic-Indic
   *   digits still does not parse, because the digits were never the separators'
   *   problem.
   * - **`latn`** (`Intl.NumberFormat("ar-u-nu-latn")`, and what bare `ar` happens
   *   to resolve to on this runtime): group ",", decimal ".". Output is
   *   internally consistent, round-trips through `parse`, and matches what an
   *   Arabic speaker types on a Latin keyboard — which is what a search box
   *   receives.
   *
   * `latn` wins on every axis, so it is written out here instead of being left
   * to `Intl.NumberFormat("ar")`. Taking the `"intl"` branch would give the same
   * two characters *today* and silently give the `arab` pair the day CLDR revises
   * the default for the bare tag, which it has done before in this exact
   * direction. `ar.test.ts` asserts these values equal what `ar-u-nu-latn`
   * produces, so the transcription cannot quietly stop matching the numbering
   * system it claims to be.
   *
   * What this does **not** do is make Arabic-Indic input readable. That needs a
   * digit-folding seam in `normalize()` or `lex`, which is core's to add and not
   * a language's — a `Language` has no hook that sees a digit.
   */
  numberFormat: { group: ",", decimal: "." },
  analyze: [
    // Required, not decorative: `createResolver` reaches an alias only through
    // the forms some analyzer produced, so a chain without this cannot reach its
    // own vocabulary at all.
    identity(),
    orthography,
    /**
     * The definite article and the one-letter particles that fuse to it.
     *
     * Arabic writes ال attached to the noun — الكيلوغرام is "the kilogram" as a
     * single token — and prefixes the prepositions and conjunctions to that
     * again: بالكيلوغرام (in kilograms), للكيلوغرام (for the kilogram, where ل +
     * ال contracts to لل), والكيلوغرام (and the kilogram). None of these is a
     * separate word the lexer could split off, which is why this is a stripper
     * and not a keyword.
     *
     * `minStem: 3` keeps the article off the two-letter symbols Arabic writes
     * units with (كغ، سم، كم، مل): nobody writes الكغ, so a floor that protects
     * them costs nothing. It also keeps ال off ordinary short words that merely
     * begin with those letters.
     *
     * Left out: the bare particles و, ب, ل, ف and ك on their own. Each is a
     * single letter, so stripping one from a four-letter word leaves three
     * letters of a different word, and Arabic function words beginning with them
     * are everywhere. The article is safe because it is two letters *and*
     * because a word starting with ال is very nearly always a definite noun.
     */
    prefixStripper({
      prefixes: ["ال", "وال", "بال", "فال", "كال", "لل", "ولل"],
      minStem: 3,
      weight: -2,
    }),
    /**
     * The endings a counted Arabic noun actually takes, and nothing else:
     *
     *   ان   dual, nominative        كيلوغرامان -> كيلوغرام   (the `two` row)
     *   ين   dual, accusative/genitive كيلوغرامين -> كيلوغرام
     *   ات   sound feminine plural    كيلوغرامات -> كيلوغرام   (the `few` row)
     *   ون   sound masculine plural, nominative
     *   ًا   accusative singular with tanwīn  كيلوغرامًا -> كيلوغرام (`many`)
     *   ا    the same accusative with the tanwīn left unwritten, which is how
     *        it is typed nine times out of ten
     *
     * The tanwīn form is spelled here as the two codepoints U+064B U+0627, and
     * it is listed *even though* `orthography` above already deletes U+064B —
     * because `createAnalyzerChain` runs every analyzer over the same original
     * surface and pools the results, so no analyzer ever sees another's output.
     * A word that is both vocalised and inflected reaches neither stripper's
     * stem; that is the chain's documented behaviour (see `prefixStripper`), and
     * the cost is bounded because the vocabulary lists the printed forms itself.
     *
     * `minStem: 2` rather than the 3 used above, and the difference is load-
     * bearing in both directions. Arabic has real two-letter unit nouns — طن
     * (tonne) duals to طنان — so a floor of 3 would lose them; and a floor of 2
     * still makes it impossible to *manufacture* a one-letter stem, which is
     * what protects the one-letter symbols م، غ، ل، ث from being conjured out of
     * ordinary three-letter words.
     *
     * What this cannot do, stated for the vocabularies that will be written
     * against it: a **feminine** unit noun forms its dual by replacing the ة
     * rather than by appending — ثانية becomes ثانيتان — and no suffix strip
     * undoes a replacement. Those forms have to be listed as aliases, which the
     * "everything printed is also read" rule requires anyway. The same goes for
     * every broken plural (ثوانٍ, أيام, شهور): Arabic forms them by re-arranging
     * the stem, and there is no ending to take off.
     */
    suffixStripper({
      suffixes: ["ات", "ان", "ين", "ون", "\u064Bا", "ا"],
      minStem: 2,
      weight: -2,
    }),
  ],
  /**
   * The shared fold, over Arabic's own tables. Arabic spaces its numerals —
   * خمسة وعشرون is two words — so unlike German it needs no parser of its own;
   * unlike English it needs its own speller, because the units come first and
   * the conjunction is glued to the word after it. `ar-cardinals.ts` carries
   * both halves and the reasoning.
   */
  numerals: cardinalNumerals(CARDINALS),
  spell: arabicSpeller(),
  keywords: {
    /**
     * إلى is "to" and في is "in", the two prepositions a conversion is spoken
     * with: "١ كغ إلى غرام", "كم غرامًا في الكيلوغرام". الى is إلى with the hamza
     * dropped, which is what most keyboards and most typists produce; it is
     * declared as its own surface because `buildKeywords` matches keywords by
     * exact folded string and never runs them through `Language.analyze` — the
     * orthographic fold above cannot reach them.
     */
    in: ["إلى", "الى", "في"],
    // من is "of"/"from", and it is the word a percentage is stated with:
    // "٢٠٪ من ٥٠".
    of: ["من"],
    // No word claimed for `off`, for the reason `de.ts` gives about German:
    // Arabic states a discount as a noun plus a preposition — خصم ٢٠٪ من ٥٠ —
    // and the preposition it uses is من, which is already `of`. Claiming خصم as
    // a bare `off` would make "٢٠٪ خصم ٥٠" the one spelling that works, and
    // nobody writes it. The arithmetic stays reachable through `-` and `%`.
    plus: ["زائد"],
    minus: ["ناقص"],
    /**
     * ضرب, and deliberately not في.
     *
     * في is how Arabic actually says "times" — ٣ في ٤ is three times four — and
     * it is also the preposition of conversion, claimed under `in` above. One
     * surface cannot be two keywords: `buildKeywords` throws
     * `KeywordConflictError` on exactly that, and it is right to, because the
     * lexer would otherwise have to guess. Conversion is what this engine is
     * for and it has no second word for it, while multiplication has ضرب — an
     * unambiguous verbal noun that means nothing else here. So في stays `in`.
     */
    times: ["ضرب"],
    /**
     * قسمة/تقسيم is the verbal noun ("division") and على is the preposition that
     * follows it: ٦ قسمة على ٢. Split across `over` and `by` exactly as English
     * splits "divided by" and German "geteilt durch", so `foldWordOps` swallows
     * the pair into one operator.
     *
     * The cost is the same one both of those pay, stated rather than hidden: a
     * bare "٦ على ٢" does not parse, because a stray `by` fails at the parser.
     * Claiming على as `over` instead would make the fuller, commoner phrase emit
     * two division operators in a row, which fails on the input an Arabic writer
     * is likelier to produce.
     */
    over: ["قسمة", "تقسيم"],
    by: ["على"],
  },
  /**
   * **The key set is exactly the six CLDR categories**: `zero`, `one`, `two`,
   * `few`, `many`, `other`. That is the contract every Arabic `Vocabulary` keys
   * its `forms` table off, and it is closed — no more and no fewer.
   *
   * What each row is, in grammar rather than in arithmetic, because the names
   * are misleading if read as English number words. Taking كيلوغرام:
   *
   *   zero   0            صفر كيلوغرام     genitive singular
   *   one    1            كيلوغرام          nominative singular
   *   two    2            كيلوغرامان        the DUAL — a suffixed form, not a
   *                                         separate word, and unique to Arabic
   *                                         among the languages shipped here
   *   few    3–10         كيلوغرامات        plural
   *   many   11–99        كيلوغرامًا        accusative SINGULAR with tanwīn —
   *                                         the tamyīz. Not a plural at all,
   *                                         and the row a table ported by
   *                                         renaming English columns gets wrong
   *   other  100+, and    كيلوغرام          genitive singular
   *          every fraction
   *
   * So three of the six (`zero`, `one`, `other`) are the bare noun in unvocalised
   * writing and differ only in case endings nobody writes; a vocabulary that
   * repeats one string across those three rows is correct, not lazy. `two`,
   * `few` and `many` are genuinely three different strings.
   *
   * **One axis, unlike Ukrainian and German.** A second, slot-driven case axis
   * was considered and rejected: the case a preposition governs is marked by a
   * final short vowel (كيلوغرامٍ after إلى), and short vowels are not written in
   * ordinary Arabic — so `conversion-target` and `bare` would name the same
   * string in every row of every table, which is a second axis that costs six
   * more rows per unit and encodes nothing. The one case ending that *is*
   * written, the accusative ـًا, is already carried by `many`, which is exactly
   * why Arabic needs six categories where Ukrainian needs four.
   *
   * Ruling R5's row: a conversion target has no magnitude, and `other` is the
   * category CLDR requires every locale to define as its generic one. For Arabic
   * that lands on the genitive singular — "١ كغ إلى غرام", singular — which is
   * what Arabic says, and the opposite of French, where a bare target is plural.
   */
  selectForm: ({ count }) =>
    count === undefined ? "other" : plural.select(count.toNumber()),
  /**
   * `defaultRenderQuantity` with one change, the same one German makes: a symbol
   * is set off from the number by a space rather than tight against it. The SI
   * convention holds in Arabic typography — ٥ كغ, never ٥كغ — and Arabic unit
   * symbols are letters, so setting them tight against a digit would additionally
   * produce a run the bidi algorithm has to guess the boundaries of.
   *
   * The order of the parts is unchanged and must stay unchanged: number first,
   * label second, in logical order. See this file's header for why that is
   * already right-to-left and why reversing it would break both directions.
   */
  renderQuantity: (parts) =>
    parts.form === undefined && parts.alias === undefined && parts.symbol !== undefined
      ? `${parts.number}${parts.gap ?? " "}${parts.symbol}`
      : defaultRenderQuantity(parts),
});

export default arabic;
