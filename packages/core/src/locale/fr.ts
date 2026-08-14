import type { Language } from "../types";
import { defineLanguage } from "./define";
import { CARDINALS, frenchNumerals, frenchSpeller } from "./fr-cardinals";
import { identity, suffixStripper } from "./helpers";

const plural = new Intl.PluralRules("fr");

/**
 * The French language: how French is read and written, with no word for any
 * unit in it.
 *
 * `fr` is the bare tag and means what CLDR means by it — metropolitan French
 * conventions, which is what `Intl.NumberFormat("fr")` and
 * `Intl.PluralRules("fr")` answer for below. Belgian and Swiss French say
 * septante and nonante where this file's speller writes soixante-dix and
 * quatre-vingt-dix; those are `fr-BE` and `fr-CH`, and a file of their own if
 * anyone ever wants them, not a fork of this one.
 *
 * Three things French does that neither shipped language did:
 *
 * **A group separator that is invisible *and* narrow.** This runtime's
 * `Intl.NumberFormat("fr")` groups with U+202F NARROW NO-BREAK SPACE and marks
 * the decimal with ",". Ukrainian already made the point that a whitespace
 * separator has to survive its own round trip — `normalize()` folds every `\s`
 * run to one plain space before `lex()` ever sees it, so a formatter's
 * "2\u202F000" arrives back as "2 000" — and `parseNumber` and `lex` both
 * handle that, the first by skipping U+202F unconditionally and the second by
 * its three-digit lookahead. What French adds is that the character is a
 * *different* one from Ukrainian's U+00A0, so an implementation that had
 * quietly hardcoded the non-breaking space rather than reading the separator
 * back from CLDR would pass every Ukrainian test and lose every French group.
 * `fr.test.ts` pins the codepoint for exactly that reason.
 *
 * **A plural boundary that is not English's.** French puts the singular on
 * everything below two: 0 and 1 both select `one` — "zéro kilogramme", "un
 * kilogramme" — and so does every fraction under two, which is why "1,5
 * kilogramme" is singular where English writes "1.5 kilograms". A vocabulary
 * ported from the English tables by renaming the columns gets every one of
 * those rows wrong.
 *
 * **Elision, which the lexer settles rather than this file.** French drops the
 * vowel of "de" before another vowel and writes the two as one word: "d'un",
 * "d'une". `lex` treats an apostrophe *between two letters* as part of the word
 * (the rule Ukrainian's п'ять needed), so "d'un" arrives as the single word
 * token `d'un` and a keyword entry for "d'" could never match it. Declaring one
 * would be a dead entry that looks like coverage, so `of` lists "de" and stops
 * there — the elided form only ever appears in front of a noun phrase, and this
 * grammar's `of` is always followed by a number or a quantity, where "de"
 * stands unelided.
 */
export const french: Language = defineLanguage({
  id: "fr",
  // Read from CLDR rather than transcribed, the same as `en` and `uk`. Pinning
  // the *output* of the "intl" branch (which `fr.test.ts` does) is not the same
  // as bypassing it: a language that writes down its own separators is a
  // language that can disagree with the platform.
  numberFormat: "intl",
  analyze: [
    identity(),
    // French marks the plural of a noun with -s, and with -x on the nouns in
    // -eau, -eu and -ou ("bateaux", "jeux", "bijoux"). None of those endings
    // occurs in a unit noun — "mètre", "gramme", "seconde", "litre", "pouce",
    // "nœud" all take -s — so -x is here for the words a vocabulary did not
    // think to list rather than for a unit anyone can name today. Both are
    // single characters and neither strips anything a French reader would call
    // a stem, which is why the pair is enough where Ukrainian needed ten
    // endings: French inflects nouns for number and nothing else.
    //
    // The class this pair deliberately does **not** reach is -al/-ail, which
    // pluralizes in -aux: "cheval" → "chevaux", "travail" → "travaux". That is
    // a rewrite of the last two letters and not a suffix at all, so no
    // `suffixStripper` entry can recover it — taking the -x off "chevaux"
    // yields "chevau", which is not a French word and is nobody's stem.
    // Declaring "aux" as a third suffix was the alternative and is worse than
    // useless: it would strip a *correct* singular's ending off any noun that
    // happened to end that way and hand the resolver rubbish at `weight: -2`.
    // Nothing is lost by the omission, because the only -al noun this repo has
    // any use for is "cheval-vapeur", which `@smartput/power/locale/fr`
    // declines to claim on separate grounds — it names the metric horsepower,
    // a different quantity from that kind's `hp`.
    //
    // `minStem: 3` keeps it off the two-letter symbols units are usually
    // written with — "kg", "cm", "km", "ml", "Wh" — where stripping a final
    // letter would hand the resolver a stem of one. `weight: -2` is the penalty
    // both built-ins use, so an exact alias always outranks a stripped one.
    suffixStripper({ suffixes: ["s", "x"], minStem: 3, weight: -2 }),
  ],
  numerals: frenchNumerals(CARDINALS),
  spell: frenchSpeller(CARDINALS),
  keywords: {
    // "en" is the ordinary conversion preposition — "1 kg en g", "convertir en
    // grammes" — and "vers" is the directional one a UI label reaches for
    // ("vers les grammes"). "à" was considered and left out: "de X à Y" is how
    // French writes a *range*, so claiming "à" as a conversion would put this
    // language in the way of a kind that reads intervals.
    in: ["en", "vers"],
    // Not "d'". See the elision note in this file's doc comment: `lex` keeps an
    // apostrophe between two letters inside the word, so "d'un" is one token
    // and a "d'" keyword would match nothing.
    of: ["de"],
    // "remise" is the noun a French price line carries, and it is claimed with
    // its limit stated rather than left to be discovered: the spelling this
    // keyword actually serves is "20 % remise 50", because `off` is a single
    // token that takes the percentage on its left and the base on its right.
    // The phrase French really writes is "20 % de remise sur 50", and that one
    // does *not* parse — "de" is already `of`, "sur" is claimed by nothing, and
    // the fold has no production for a keyword pair. So what is bought here is
    // a shape no French speaker types, in exchange for the arithmetic being
    // reachable by a word at all.
    //
    // `de`, `nl` and `it` weigh the same trade the other way and leave `off`
    // unclaimed, on the ground that a discount is a noun *plus a preposition*
    // in all three languages and the operator can carry only the noun. French
    // is in exactly that position, and the reason it still claims the word is
    // `pt`'s: the arithmetic stays reachable either way through "50 moins
    // 20 %", so the entry costs nothing it did not already cost, and "remise"
    // is not a word any other reading needs — no unit alias in the repo spells
    // it, which is the land-grab test `en` applies when it refuses "less" for
    // this same operator.
    //
    // One surface word and no more, as in `en`, `uk` and `pt`: "rabais" and
    // "réduction" are synonyms, and an operator that reads as a noun should not
    // be collecting them.
    off: ["remise"],
    plus: ["plus"],
    minus: ["moins"],
    // "3 fois 5" is the bare form and "multiplié par 5" the phrasal one, which
    // `foldWordOps` folds into a single operator by swallowing the `by`.
    times: ["fois", "multiplié"],
    over: ["divisé"],
    by: ["par"],
  },
  /**
   * "one" | "other", and nothing else — which is a decision, because
   * `Intl.PluralRules("fr")` on this runtime declares three categories.
   *
   * CLDR's third French category, `many`, fires on exact non-zero multiples of
   * a million written without a fraction: `select(1000000)` is `"many"` while
   * `select(1500000)` and `select(999999)` are `"other"`. It exists for compact
   * notation, where the word that agrees is the *scale word* — "1 million",
   * "2 millions" — and it says nothing about the noun beside it: French writes
   * "2 000 000 kilogrammes" with the same plural as "2 kilogrammes". A `forms`
   * table keyed by this function holds unit nouns, so honouring `many` would
   * mean asking every vocabulary in the repo for a third row that duplicates
   * `other` for every unit French has, and letting a vocabulary that forgot it
   * fall through on exactly one magnitude in a million.
   *
   * So `many` folds into `other` here, and the key set stays two. The rejected
   * alternative was returning the raw category and telling vocabularies to
   * declare all three: it costs 20 packages a dead row to describe a
   * distinction the nouns do not make, and the day a French *scale word* needs
   * agreement it will be a `renderQuantity` question — that word is not in a
   * unit's `forms` table at all.
   *
   * `count === undefined` is `other` by ruling R5, and it is the right answer
   * for French independently of the rule: a conversion target carries no
   * magnitude ("1 kg en grammes") and French names the target in the plural.
   */
  selectForm: ({ count }) => {
    if (count === undefined) return "other";
    return plural.select(count.toNumber()) === "one" ? "one" : "other";
  },
  /**
   * One space before the label, whatever kind of label it is.
   *
   * `defaultRenderQuantity` sets a symbol tight against the number ("5kg") and
   * spaces a word ("5 kilogrammes"). French typography spaces both: the space
   * before a unit symbol is the rule the SI brochure and every French style
   * guide state, and it is the same space French sets before "%" — "20 %", not
   * "20%". Collapsing the default's three branches into one is therefore not a
   * simplification of it but the whole of the difference.
   *
   * A plain space rather than the U+202F the typographer would set, and that is
   * a round-trip decision rather than a typographic one: `normalize()` folds
   * every whitespace character to a plain space before anything reads the
   * string back, so a narrow no-break space here would be a character the
   * engine destroys the moment it re-reads its own output — invisible in a
   * fixture, unretypable, and identical in effect. `gap` still wins where a
   * caller has resolved a separator of its own, so `Printer.spacing` keeps
   * overriding this the way it overrides the default.
   */
  renderQuantity: (p) =>
    `${p.number}${p.gap ?? " "}${p.form ?? p.alias ?? p.symbol ?? p.unit}`,
});

export default french;
