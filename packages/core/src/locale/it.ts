import type { AnalyzedForm, Analyzer, Language, QuantityParts } from "../types";
import { defineLanguage } from "./define";
import { identity } from "./helpers";
import { italianNumerals, italianSpeller } from "./it-cardinals";
import { defaultRenderQuantity } from "./render";

const plural = new Intl.PluralRules("it");

/**
 * The Italian plural, folded backwards.
 *
 * `suffixStripper` cannot express this language, and that is the first thing an
 * Italian reader has to be told. English and German mark a plural by *adding* —
 * "metre" → "metres", "Meile" → "Meilen" — so removing the addition recovers
 * the lemma, and `suffixStripper` removes. Italian marks it by *substituting*
 * the final vowel: chilogrammo → chilogrammi, tonnellata → tonnellate,
 * mese → mesi. Strip the "i" off "chilogrammi" and the result is "chilogramm",
 * a stem no vocabulary lists and none should: an alias table holds words.
 *
 * So the fallback is a substitution table, one row per inflectional class, each
 * row written as (ending seen, ending the lemma has):
 *
 *   chi → co   franchi     → franco     velar kept before the plural -i, and
 *   ghi → go   laghi       → lago       spelled with the h that keeps it hard
 *   che → ca   piche       → pica       the same velar, feminine: -a → -e takes
 *   ghe → ga   righe       → riga       the same h for the same reason
 *   ce  → cia  once        → oncia      palatal feminine: -cia loses its i
 *   ge  → gia  logge       → loggia     before -e, and gets it back here
 *   i   → io   millenni    → millennio  masculine in -io, whose plural is one i
 *   i   → o    metri       → metro      the ordinary masculine
 *   i   → e    mesi        → mese       the third class, either gender
 *   e   → a    tonnellate  → tonnellata the ordinary feminine
 *   a   → o    miglia      → miglio     the small irregular class (miglio,
 *                                       paio, migliaio) whose plural is in -a
 *
 * Several rows fire at once on the same word and that is intended: the chain
 * pools every form any analyzer produced and the alias index decides which one
 * exists, so "metri" offers "metrio", "metro" and "metre" and only the second
 * is a word anyone listed. Producing a lemma nobody lists costs a map lookup
 * and nothing else.
 *
 * What is deliberately *not* here is the invariant class, which is most of the
 * scientific vocabulary: unità, città, caffè are invariant because they end in
 * a stressed vowel, and watt, bar, joule because they are loanwords. Those need
 * no row — `identity()` already offers them unchanged, and a rule that fired on
 * them would only manufacture words Italian does not have.
 *
 * `minStem: 2` rather than Ukrainian's 3, and the two-letter symbols are the
 * reason for both numbers. Italian abbreviations that end in a fold-triggering
 * vowel are all two characters — "ha", "Pa", "mi" — so a floor of 2 leaves
 * every one of them whole (their stems are a single letter) while still
 * reaching "once" → "oncia", whose stem is exactly two. A floor of 3 would lose
 * the ounce; a floor of 1 would shred the hectare.
 *
 * `weight: -2` is the penalty `en` and `uk` both use, so an exactly listed
 * alias always outranks a folded one.
 */
const PLURAL_FOLDS: readonly (readonly [string, string])[] = [
  ["chi", "co"],
  ["ghi", "go"],
  // The feminine half of the velar class, and it is here because its masculine
  // half above is: `-ca` and `-ga` insert exactly the same h before the plural
  // ending that `-co` and `-go` do (barca → barche, riga → righe, pica →
  // piche), so a table that folds `franchi` back to `franco` and leaves `piche`
  // at `picha` is not describing two classes, it is describing one class twice
  // and getting it right once. `measure`'s pica is the unit this reaches today;
  // the rows exist because the class is regular, not because of that one word.
  ["che", "ca"],
  ["ghe", "ga"],
  ["ce", "cia"],
  ["ge", "gia"],
  ["i", "io"],
  ["i", "o"],
  ["i", "e"],
  ["e", "a"],
  ["a", "o"],
];

function pluralFold(opts: { minStem: number; weight: number }): Analyzer {
  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const [ending, lemma] of PLURAL_FOLDS) {
      if (!surface.endsWith(ending)) continue;
      const stem = surface.slice(0, surface.length - ending.length);
      if (stem.length < opts.minStem) continue;
      out.push({ form: `${stem}${lemma}`, weight: opts.weight });
    }
    return out;
  };
}

/**
 * The word `italianSpeller` writes for a standalone 1, and the three forms
 * Italian puts in front of a noun instead of it.
 *
 * Italian never says "uno metro". The numeral 1 is the indefinite article as
 * well, and it takes the article's shape the moment a noun follows it:
 * masculine "un metro", feminine "una tonnellata", feminine-before-a-vowel
 * "un'ora". The bare "uno" survives only where nothing follows — "quanti ne
 * vuoi? uno" — and in the one masculine environment named at `KEEPS_UNO`
 * below.
 *
 * `italianSpeller` cannot choose between them, and that is not an oversight in
 * it: a `NumeralSpeller` is handed a magnitude and nothing else, so it has no
 * noun to agree with and writes the citation form. It already apocopates in the
 * one place it *can* see a noun — "un milione", never "uno milione" — because
 * that noun is one of its own scale words. The unit noun is visible here and
 * nowhere else, which is why the correction lives at this seam. `es.ts` reaches
 * the identical conclusion for Spanish's "un"/"una" and states it at length.
 */
const ONE_ALONE = "uno";
const ONE_MASCULINE = "un";
const ONE_FEMININE = "una";
/**
 * Elided, so it is written *against* the noun: "un'ora", never "un' ora".
 *
 * This is the one string in this file that `Printer`'s spelled output cannot
 * read back, and the cost is stated here rather than discovered. `parse/lex.ts`
 * counts the apostrophe as a word character, so "un'ora" arrives as a single
 * word token that matches no alias and the whole quantity fails to parse. The
 * alternative was to leave the vowel in — "una ora", "una oncia" — which every
 * Italian reader would mark as an error, since elision in front of a vowel is
 * obligatory here rather than stylistic.
 *
 * Correct Italian wins, on the ground that this is the *spelled* path only:
 * `PrintOptions.spelled` already documents that it breaks the round trip in
 * whatever way its words cannot lex back, and the ordinary `formatValue` output
 * this file leaves untouched ("1 ora") reads back exactly as it always did.
 * `es.ts` decides the mirror-image case the other way — it declines to write
 * the "de" of "un millón **de** metros" — and the two are not in conflict: the
 * Spanish string would have been read as a *different* expression and answered
 * with a wrong-shaped error, where this one is simply not read at all.
 */
const ONE_FEMININE_ELIDED = "un'";

/**
 * The masculine onsets that keep the full "uno" — Italian's *s impura* and the
 * rest of the environment that takes "lo" rather than "il".
 *
 * s + consonant (uno studente), z (uno zloty), x, gn, pn, ps, and semiconsonantal
 * i or y before a vowel (uno iodio, uno yen). Everything else, vowels included,
 * takes the apocopated "un": "un ettaro", "un anno", "un metro".
 *
 * The h after an s counts as the consonant it is written as, not as the mute
 * letter it is elsewhere: "uno shampoo", because "sh" is *s impura* like "st"
 * and "sp". A mute h that opens the word behaves as the vowel behind it does,
 * which is why "hertz" takes "un" and not "uno" — the two h's are read by
 * different halves of this expression on purpose.
 *
 * Only two of these are reachable from a vocabulary in this repo today — the
 * zloty and the yen, both in `@smartput/rate/locale/it` — and the rule is
 * written whole anyway, because it is one rule of the language rather than two
 * facts about two currencies, and a translator adding "stadio" or "psi" would
 * otherwise have to rediscover it.
 */
const KEEPS_UNO = /^(?:s(?![aeiouàèéìòóù])|[zx]|gn|pn|ps|[iy][aeiouàèéìòóù])/i;

/**
 * A feminine noun elides the article's vowel — but not in front of the
 * semiconsonantal i that `KEEPS_UNO` also singles out: it is "un'ora" and
 * "un'oncia", and "una iarda", because "iarda" opens with a glide rather than
 * with the vowel it is spelled with.
 */
const FEMININE_ELIDES = /^(?![iy][aeiouàèéìòóù])[aeiouàèéìòóù]/i;

/**
 * The measure compounds in *-ora*, which are masculine however they end.
 *
 * *wattora*, *chilowattora*, *megawattora* — and *amperora*, *voltamperora* and
 * anything else built the same way — are compounds of an invariant masculine
 * loanword with *ora*, and they take the gender of the compound and not of the
 * feminine *ora* inside it: *il* chilowattora, *un* chilowattora. Treccani lists
 * every one of them as `s. m. invar.`. The bare *ora* is of course feminine, so
 * the rule is a suffix strictly longer than the word itself.
 *
 * Written as a suffix rather than as the explicit list `es.ts` needs for *día*,
 * because unlike *día* this is a productive class rather than one lexical
 * exception: a translator adding the ampere-hour would otherwise have to
 * rediscover the same fact, and a list is only ever as long as the day it was
 * written. It also keeps this file free of any string that is a unit's word,
 * which is what `Language` is supposed to be — the Spanish file names "día"
 * outright and says it is the one place it does so.
 *
 * It cannot misfire on an ordinary Italian noun in *-ora* that *is* feminine
 * (*ancora*, *aurora*, *signora*), because nothing but a unit's own `forms`
 * entry ever reaches this function.
 */
const ORA = "ora";
const isOraCompound = (noun: string): boolean =>
  noun.length > ORA.length && noun.endsWith(ORA);

/**
 * Gender from the noun's own ending, which is a morphological rule and not a
 * per-unit table — `Language` may hold no word for any unit, and this holds
 * none: it is handed whatever noun a vocabulary printed and reads its ending.
 *
 * A singular Italian noun in -a is feminine (tonnellata, oncia, libbra, pinta,
 * caloria, ora, settimana, sterlina, iarda, pica) apart from the *-ora*
 * compounds above, and everything else printed by a vocabulary in this repo is
 * masculine — the -o class, the -e class (pollice, piede, gallone, radiante),
 * and the whole consonant-final invariant class (watt, byte, hertz, gon, pixel,
 * joule, euro, yen, zloty).
 *
 * The rule is asked only for the singular, and that is what makes it safe. It
 * is consulted from `agree` below, which fires only when the spelled magnitude
 * is exactly "uno" — so the noun beside it is always the `one` row of a `forms`
 * table. The plural in -a that would otherwise fool it, `miglio` → `miglia`,
 * can never be the word in question; nor can any of the masculines in -a that
 * Italian does have (il problema, il tema), since none is a unit.
 */
const isFeminine = (noun: string): boolean => noun.endsWith("a") && !isOraCompound(noun);

/**
 * Make a spelled magnitude agree with the noun it is about to stand in front of.
 *
 * A no-op unless the whole spelled number is the standalone "uno", which
 * happens for exactly one magnitude: 1. A compound ending in the same syllable
 * is deliberately left alone — "ventuno metri" and "centouno metri" are what
 * Italian writes, the truncated "ventun metri" being an option rather than the
 * rule, and the noun after them is plural anyway, so no gender is being agreed
 * with. "un milione" is untouched for a plainer reason: its last word is
 * "milione", so this never looks at it.
 *
 * Returns the joined string rather than a replacement numeral, because the
 * elided feminine decides the *space* as well as the word. That space is
 * grammar and not typography, so it overrides `gap` the way
 * `defaultRenderQuantity` overrides it for a symbol — a caller's `spacing`
 * option has no business putting "un' ora" on the page.
 */
const agree = (parts: QuantityParts, noun: string): string => {
  if (parts.number !== ONE_ALONE) return defaultRenderQuantity(parts);
  if (isFeminine(noun)) {
    return FEMININE_ELIDES.test(noun)
      ? `${ONE_FEMININE_ELIDED}${noun}`
      : defaultRenderQuantity({ ...parts, number: ONE_FEMININE });
  }
  const number = KEEPS_UNO.test(noun) ? ONE_ALONE : ONE_MASCULINE;
  return defaultRenderQuantity({ ...parts, number });
};

/**
 * `defaultRenderQuantity`, with the one thing Italian assembles differently:
 * the numeral 1 agrees with the noun it counts.
 *
 * Guarded on `parts.form`, so this reaches only a quantity a vocabulary gave a
 * *word* to. A symbol ("1 kg") and a bare alias are left exactly as every other
 * language renders them, and so is every magnitude printed as digits — the
 * ordinary `formatValue` path hands this function "1", never "uno", so its
 * output is unchanged byte for byte and only `Printer`'s `spelled` mode can
 * reach the rewrite.
 *
 * Everything else is delegated, `gap` included, so `Printer`'s `spacing` option
 * and `formatValue`'s tight symbols keep behaving as they do everywhere else.
 */
const renderItalianQuantity = (parts: QuantityParts): string => {
  const noun = parts.form;
  return noun === undefined ? defaultRenderQuantity(parts) : agree(parts, noun);
};

/**
 * The Italian language: how Italian is read and written, with no word for any
 * unit in it.
 *
 * Three things about it are worth reading before its vocabularies are written.
 *
 * **`selectForm` returns `"one"` or `"other"`, and nothing else.** That is two
 * keys per unit, the same shape `en` has, and it is a decision rather than the
 * default falling out. `Intl.PluralRules("it")` declares three categories —
 * `one`, `many`, `other` — and `many` is not a plural: CLDR gives it to exact
 * millions (1,000,000 but not 1,000,000.5, and not 1,500,000) because Italian
 * writes those compactly as "un milione **di** euro", where the noun takes a
 * preposition it does not otherwise take. This engine never prints a compact
 * million; it prints "1.000.000 chilogrammi", and the word there is the
 * ordinary plural. So `many` is folded into `other` here, once, rather than
 * every vocabulary in the repo carrying a third key that would hold the same
 * string as the second — and rather than the alternative, which is a vocabulary
 * forgetting the key it never sees in a test and rendering `1.000.000 kg` at a
 * user the first time someone weighs a train.
 *
 * **The slot is ignored.** Italian nouns do not inflect for case, so the word
 * after "in" is the word before it: "5 chilogrammi", "in chilogrammi". There is
 * no second axis to add, which is why this language keys on one where Ukrainian
 * keys on two and German on a different two. The parameter is still read from
 * `FormCtx` by the engine and simply has no consequence here.
 *
 * **Gender is real, and it is agreed at `renderQuantity` rather than at
 * `selectForm`.** Italian's unit nouns span both genders — `chilogrammo` and
 * `metro` masculine, `tonnellata` and `ora` feminine — but gender is a property
 * of the *noun*, not of the count or the slot, which are the only two things
 * `selectForm` is told. So it cannot be a `forms` key (rule 6: the key set must
 * be exactly what `selectForm` can produce), and a table keyed on it would be an
 * axis nothing indexes. Where it surfaces is the numeral in front — "un
 * chilogrammo" against "una tonnellata" against "un'ora" — and
 * `renderItalianQuantity` is the one call that sees the number and the noun at
 * the same time. `es.ts` reaches the same seam by the same argument.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const italian: Language = defineLanguage({
  id: "it",
  // From CLDR, the same as every other language in this repo: this runtime's
  // `Intl.NumberFormat("it")` groups with "." and marks the decimal with ",",
  // and `it.test.ts` pins both. Pinning the *output* of the "intl" branch is
  // not the same as transcribing the separators here — a language that
  // transcribes them is a language that can disagree with the platform.
  numberFormat: "intl",
  analyze: [
    // Required, not decorative: the resolver reaches an alias only through a
    // form some analyzer produced, so a chain without `identity()` cannot read
    // its own vocabulary — see `third-language.test.ts`'s
    // `a language's own aliases are not reachable without its own identity()`.
    identity(),
    pluralFold({ minStem: 2, weight: -2 }),
  ],
  // Italian welds its cardinals into one word ("ventidue", "duemilatrecento"),
  // which the shared `cardinalNumerals`/`cardinalSpeller` pair cannot express;
  // `it-cardinals.ts` says why at length and reads the same table in both
  // directions so the two halves still cannot drift.
  numerals: italianNumerals(),
  spell: italianSpeller(),
  keywords: {
    // "in" is the same surface word English uses for the same job, which
    // `buildKeywords` folds into one entry rather than treating as a conflict.
    // "a" is the other half of Italian's "da … a …" ("da metri a centimetri")
    // and reads alone in "converti 5 kg a grammi".
    in: ["in", "a"],
    // "20% di 50" — the partitive preposition, and the only word for it.
    of: ["di"],
    // `off` is deliberately unclaimed. Italian says "20% di sconto su 50",
    // where the operator is a noun phrase and not a word: "sconto" alone is
    // the noun "discount", and claiming it would make the perfectly ordinary
    // "sconto" in running text an operator that then demands two operands. A
    // percentage taken off a price is still expressible as "50 - 20% di 50";
    // `of` is claimed and that is the piece Italian actually has a word for.
    plus: ["più", "piu"],
    minus: ["meno"],
    // "due per tre fa sei" — "per" is how Italian says multiplication out
    // loud, and it needs no helper word to do it.
    //
    // It costs one phrase, and the phrase should be named here rather than
    // discovered: **"per cento" spelled as two words does not read**. `lex`
    // rewrites "per" into a `*` token before any analyzer or vocabulary sees
    // it, and "cento" is a cardinal `italianNumerals` claims, so "20 per cento
    // di 50" arrives at the parser as `20 * 100 of 50` and is refused. No
    // vocabulary can repair that — an alias is matched against a word token,
    // and by then there is no word token left. The univerbated spelling is
    // claimed instead: `@smartput/percent/locale/it` lists "percento", so "20
    // percento di 50" and "20% di 50" both answer 10. Dropping "per" from
    // `times` was the alternative and buys nothing — "per cento" would then be
    // two word tokens with no reading for the first, which fails the same way
    // — while costing Italian the only word it has for multiplication.
    times: ["per"],
    // "12 diviso 4". The rejected alternative was the fuller "12 diviso per
    // 4", which would need `by: ["per"]` — and a single surface cannot be two
    // keywords at once (`buildKeywords` throws, and rightly: the lexer would
    // have to guess). Between the two readings of "per", multiplication is the
    // one that stands on its own, so "per" is `times` and "diviso" is a
    // complete operator by itself. `by` is therefore unclaimed, and "diviso
    // per" is spelled "diviso".
    over: ["diviso"],
  },
  selectForm: ({ count }) => {
    if (count === undefined) return "other";
    // `many` collapses into `other` — see this object's doc comment. Written as
    // a fold of the CLDR answer rather than as a hand-written rule, so the
    // categories stay CLDR's and only the mapping is Italian's.
    const category = plural.select(count.toNumber());
    return category === "many" ? "other" : category;
  },
  // The one axis `selectForm` cannot carry, applied at the one call that sees
  // both halves of the agreement. See `renderItalianQuantity`.
  renderQuantity: renderItalianQuantity,
});

export default italian;
