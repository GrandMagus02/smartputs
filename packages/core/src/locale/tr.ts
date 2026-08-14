import type { AnalyzedForm, Analyzer, Language, NumeralParser } from "../types";
import { defineLanguage } from "./define";
import { cardinalNumerals, identity, suffixStripper } from "./helpers";
import { defaultRenderQuantity } from "./render";
import { CARDINALS, turkishSpeller } from "./tr-cardinals";

/**
 * The case endings a Turkish unit noun takes, every harmonic variant spelled
 * out.
 *
 * **This list is long because `suffixStripper` is flat and Turkish is not.**
 * Every suffix in the language has two or four surface shapes, chosen by the
 * last vowel of the stem it lands on: the dative is `-e` after a front vowel and
 * `-a` after a back one (metre → metreye, kilogram → kilograma), the locative is
 * `-de`/`-da` (metrede, kilogramda), and the accusative and genitive run to four
 * (`-i`/`-ı`/`-u`/`-ü`). The stripper matches a fixed string against the end of a
 * word and knows nothing about vowels, so harmony cannot be expressed as a rule
 * here — it can only be enumerated. That is the honest shape for this helper:
 * the alternative is a Turkish-specific analyzer that re-derives harmony from
 * the stem it is about to produce, which is a phonology engine written to save
 * twenty strings.
 *
 * Two more alternations ride along and are enumerated the same way:
 *
 * - **Consonant hardening.** After a voiceless consonant the `d-` of the
 *   locative and ablative hardens to `t-`: "saatte", "kilowatta" — so `-te`,
 *   `-ta`, `-ten`, `-tan` are their own entries.
 * - **Buffer letters.** A stem ending in a vowel takes `-y-` before a
 *   vowel-initial suffix and `-n-` before the genitive: metre → metreye,
 *   metrenin. Those are `-ye`/`-ya`, `-yi`/`-yı`/`-yu`/`-yü`, `-nin`/`-nın`/
 *   `-nun`/`-nün`.
 *
 * The plural `-ler`/`-lar` is here even though a *counted* Turkish noun never
 * carries it — "5 kilogram", never "5 kilogramlar", which is the whole reason
 * `selectForm` below returns one key. The plural is what the noun looks like
 * when it is not being counted ("kilogramlar" in a table header, "metrelere" in
 * a sentence), and the case-marked plurals are listed beside it because the
 * chain does not iterate: `createAnalyzerChain` runs every analyzer over the
 * same original surface, so a `-ler` taken off by one pass is never offered to
 * another.
 *
 * This is a fallback for what a `Vocabulary` did not think to list, never a
 * substitute for listing it — ruling: a form the vocabulary *prints* must be one
 * of its own aliases, and reaching it only through this list is a bug the
 * printer's round-trip sweep is meant to catch.
 */
const SUFFIXES = [
  // Plural.
  "ler",
  "lar",
  // Dative: -e/-a, with the -y- buffer after a vowel-final stem.
  "e",
  "a",
  "ye",
  "ya",
  // Locative: -de/-da, hardened to -te/-ta after a voiceless consonant.
  "de",
  "da",
  "te",
  "ta",
  // Ablative: -den/-dan, hardened the same way.
  "den",
  "dan",
  "ten",
  "tan",
  // Accusative: four-way, with the -y- buffer.
  "i",
  "ı",
  "u",
  "ü",
  "yi",
  "yı",
  "yu",
  "yü",
  // Genitive: four-way, with the -n- buffer.
  "in",
  "ın",
  "un",
  "ün",
  "nin",
  "nın",
  "nun",
  "nün",
  // Plural plus case, in the combinations a printed unit word actually shows up
  // in. Agglutination is unbounded in principle — a Turkish noun can carry four
  // suffixes at once — and this stops at two on purpose: past that the strings
  // multiply faster than they are ever typed, and a word carrying three case
  // suffixes is not standing where a unit stands.
  "lere",
  "lara",
  "lerde",
  "larda",
  "lerden",
  "lardan",
  "leri",
  "ları",
  "lerin",
  "ların",
];

/**
 * The three apostrophes, and the same suffix list again behind each of them.
 *
 * **This is the other half of Turkish agglutination, and a flat list of bare
 * endings cannot see it.** Turkish orthography attaches a suffix directly to a
 * common noun ("kilograma") but separates it from an **abbreviation or a proper
 * noun with an apostrophe**: "5 kg'a çevir", "100 km'ye", "3 GB'ı", "Türkiye'de".
 * That is a spelling rule of the language rather than a typographic flourish —
 * TDK states it, and a Turkish text that wrote "kga" would be wrong — so
 * "kg'a" is a form a reader genuinely types and `lex` genuinely delivers whole:
 * `isInnerApostrophe` keeps an apostrophe between two letters inside the word
 * token, which it added for Ukrainian's "п'ять" and which serves this for free.
 *
 * Without these entries the whole family was unreachable. `"kg'a"` ends in `-a`,
 * so the bare list matched and produced the stem `"kg'"` — an apostrophe the
 * alias index has never held — while the word one character shorter resolved
 * fine. That is the worst shape a gap can have: the suffix list looked like it
 * fired.
 *
 * `minStem: 1` here against the bare list's 3, and the apostrophe is exactly
 * what makes the low floor safe. The floor above exists because six of the
 * endings are a single vowel and would shred a short symbol; nothing is shredded
 * here, because no Turkish stem contains an apostrophe, so this stripper can
 * only fire on a word that already announced a suffix boundary. A floor of 3
 * would refuse the two commonest symbols in the repo — "kg'a" leaves a stem of
 * two letters and "m'ye" one.
 *
 * Three spellings because `lex` accepts three (U+0027, U+2019, U+02BC) and
 * `normalize()` folds none of them into another — the same enumeration
 * `isInnerApostrophe` makes, for the same reason: a user types whichever their
 * keyboard offers, and a word processor offers the curly one.
 */
const APOSTROPHES = ["'", "’", "ʼ"];
const APOSTROPHE_STRIPPER = suffixStripper({
  suffixes: APOSTROPHES.flatMap((mark) => SUFFIXES.map((suffix) => mark + suffix)),
  minStem: 1,
  weight: -2,
});

/**
 * `minStem: 3`, and it is load-bearing rather than copied from `de`.
 *
 * Six of the suffixes above are a single vowel, so a low floor shreds short
 * symbols. Two letters are safe at any floor above 1 — a strip can leave at most
 * one letter of "kg" or "cm" — but *three*-letter symbols ending in a harmonic
 * vowel are not, and they are real: "psi" would strip to "ps", and "kva" to
 * "kv", which is the folded symbol for a kilovolt. A floor of 2 therefore reads
 * an apparent-power unit as a voltage. Three is the smallest floor that keeps
 * every symbol whole.
 *
 * What it costs, stated rather than hidden: "ay" (month) is two letters, so
 * "ayda" cannot be stripped back to it — the stem would be shorter than the
 * floor. A vocabulary that wants the inflected month lists it as an alias, which
 * is what a vocabulary is for.
 *
 * `weight: -2` is the penalty `en`, `uk` and `de` all use, so an exact alias
 * always outranks a stripped one.
 */
const STRIPPER = suffixStripper({ suffixes: SUFFIXES, minStem: 3, weight: -2 });

/**
 * The two ways a Turkish capital letter comes back down, written as explicit
 * character maps rather than as a call to `toLocaleLowerCase("tr")`.
 *
 * **This is the one thing about Turkish that no other language in this repo
 * has.** Case folding is language-neutral everywhere else — `parse/candidates.ts`
 * says so in as many words, having measured all 780 built-in alias keys folding
 * identically under `en` and `uk` — and Turkish is the language it names as the
 * one that breaks the measurement. The alphabet has four i's, not two: dotted
 * `İ`/`i` and dotless `I`/`ı` are separate letters, so `"KILOGRAM"` lowercases to
 * `"kılogram"` under `tr` and to `"kilogram"` under everything else.
 *
 * Why the fold cannot be locale-tagged here: an analyzer's form is folded *again*
 * downstream, by the resolver, under the **format** locale's id — not under this
 * language's. So a form this chain produced with Turkish rules is re-read with
 * whatever rules the engine happens to be writing in, and the two disagree on
 * exactly the letter that matters. Both maps below are therefore fixed points of
 * `toLowerCase()` *and* of `toLocaleLowerCase("tr")`, which makes the form the
 * chain hands out independent of who folds it next. (`"İ".toLowerCase()` is
 * worth noticing on its own: locale-neutrally it produces the two-code-point
 * `"i" + U+0307`, which matches no alias key anywhere. The map turns it into a
 * plain `"i"` before that can happen.)
 *
 * `TURKISH` is what a Turkish reader means: `İ → i`, `I → ı`. `ASCII` is what an
 * ASCII keyboard produced: every i-shaped letter collapses to plain `i`, so
 * "KILOGRAM" and "kılogram" both reach the alias "kilogram". They are offered at
 * different weights, below, because the second one discards a distinction the
 * language genuinely makes.
 */
const TURKISH_LOWER: Record<string, string> = { İ: "i", I: "ı" };
const ASCII_LOWER: Record<string, string> = { İ: "i", I: "i", ı: "i" };

const fold = (surface: string, table: Record<string, string>): string => {
  let out = "";
  for (const ch of surface) out += table[ch] ?? ch;
  return out.toLowerCase();
};

/**
 * The i-family folds, plus the suffix stripper run over each of them.
 *
 * The strippers are *reused* rather than re-declared: `STRIPPER` and
 * `APOSTROPHE_STRIPPER` are one list read twice each, so the case axis and the
 * morphology axis compose instead of multiplying the table. That matters because
 * the chain does not iterate — every analyzer sees the same original surface —
 * so without this an all-caps inflected word ("KİLOGRAMA", the way a heading is
 * set) would reach neither the fold nor the strip, and the two most Turkish
 * things about the input would cancel each other out. The apostrophe list is run
 * here for the sharper version of the same case: an abbreviation is the one word
 * class Turkish writes in capitals *and* the one it suffixes with an apostrophe,
 * so "GB'ı" needs both passes or neither reaches it.
 *
 * A fold that changes nothing emits nothing: for a word with no i-shaped letter
 * and no capital, both variants equal the surface `identity()` already offered
 * and this analyzer returns an empty array, which is the common path.
 */
const caseFolds = (): Analyzer => (surface, ctx) => {
  const out: AnalyzedForm[] = [];
  const seen = new Set([surface]);
  const variants: [string, number][] = [
    [fold(surface, TURKISH_LOWER), 0],
    // Penalised: collapsing ı into i is a spelling decision, not a case fold,
    // so it must never outrank a reading that respected the difference.
    [fold(surface, ASCII_LOWER), -1],
  ];
  for (const [folded, weight] of variants) {
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push({ form: folded, weight });
    for (const strip of [STRIPPER, APOSTROPHE_STRIPPER]) {
      for (const stripped of strip(folded, ctx)) {
        out.push({ ...stripped, weight: (stripped.weight ?? 0) + weight });
      }
    }
  }
  return out;
};

/**
 * The shared cardinal parser, run over the Turkish fold as well as over the
 * words as typed.
 *
 * `cardinalNumerals` folds each incoming word with the locale-neutral
 * `toLowerCase()` (see `locale/helpers.ts`), and that fold cannot reach a
 * Turkish table from a Turkish keyboard. Two shapes failed, and neither is an
 * edge case — both are how a heading, a form label and a price sign are written:
 *
 * - **`İ`.** `"BİR".toLowerCase()` is not `"bir"`. Locale-neutrally the dotted
 *   capital decomposes to `"i"` followed by U+0307 COMBINING DOT ABOVE, a
 *   two-code-point string that matches no key in any table — the same hazard the
 *   maps above are written to head off for unit words. Every numeral with an `i`
 *   in it was therefore unreadable in capitals: bir, iki, yedi, sekiz, yirmi,
 *   elli, bin, milyon, milyar, trilyon.
 * - **`I`.** `"ALTMIŞ".toLowerCase()` is `"altmiş"` with a *dotted* i, where the
 *   word is `altmış` with a dotless one. `CARDINALS` does carry a diacritic-free
 *   key beside each such word for the ASCII keyboard, but that key is `altmis`
 *   with a plain `s`, so it catches `"ALTMIS"` and not `"ALTMIŞ"` — the spelling
 *   of someone who has the Turkish letters but has pressed caps lock.
 *
 * The repair is the one `caseFolds` below applies to unit words, and it has to
 * be made separately here because a numeral never reaches the analyzer chain at
 * all: `numerals` is handed the lexer's own words. `TURKISH_LOWER` is what a
 * Turkish reader means by lowercasing, and under it both shapes land on the key
 * they were always meant to.
 *
 * **The words as typed are tried first, and their answer is kept whenever it
 * claims as much of the run.** That is what makes this strictly additive: an
 * ASCII keyboard's `"BIR"` still reads through the locale-neutral fold to `bir`,
 * where the Turkish fold would send it to `bır` and find nothing. The second
 * pass only ever adds reach, and only to runs the first pass could not finish.
 *
 * An ASCII pass (the `ASCII_LOWER` map) is deliberately *not* a third attempt.
 * It exists for unit words because a vocabulary spells a unit one way; a numeral
 * table spells each of its own words twice — `sıfır` beside `sifir`, `üç` beside
 * `uc` — so the diacritic-free reading is already a key, and the locale-neutral
 * first pass already lands on it.
 */
const turkishNumerals = (): NumeralParser => {
  const parse = cardinalNumerals(CARDINALS);
  return (words) => {
    const plain = parse(words);
    if (plain !== null && plain.consumed === words.length) return plain;
    const folded = parse(words.map((word) => fold(word, TURKISH_LOWER)));
    if (folded === null) return plain;
    if (plain === null || folded.consumed > plain.consumed) return folded;
    return plain;
  };
};

/**
 * Every surface handed in, plus the string each of them becomes when it is typed
 * in capitals on an **ASCII** keyboard and folded back down under Turkish rules.
 *
 * A keyword never reaches `caseFolds` either, and for a sharper reason than a
 * numeral does: `lex` folds the word token once, with
 * `toLocaleLowerCase(locale.id)`, and looks the result up in the map
 * `buildKeywords` built by folding these very surfaces the same way. There is no
 * analyzer anywhere between the two, so this list is the only place a Turkish
 * keyword can say what an all-caps spelling of it comes back down as.
 *
 * What it catches is exactly the dotless `ı`: `"CEVIR"` folds to `"cevır"` under
 * `tr`, so the diacritic-free spelling listed below for the ASCII keyboard was
 * reachable in lowercase and unreachable in capitals — the one keyboard that
 * needs it, shouting. `"ÇEVİR"`, the correct Turkish capitals, was never
 * affected and still folds straight onto `"çevir"`.
 *
 * Derived rather than typed out as four more entries, because the four are not
 * a fixed set: a keyword added later with an `i` or an `ı` in it needs the same
 * companion, and a list of literals is a list that silently stops covering the
 * next word. For a surface with no i-shaped letter the generated string equals
 * the surface and the `Set` drops it, which is most of them.
 */
const capsFolds = (...words: string[]): readonly string[] => [
  ...new Set(words.flatMap((w) => [w, w.toUpperCase().toLocaleLowerCase("tr")])),
];

/**
 * The Turkish language: how Turkish is read and written, with no word for any
 * unit in it.
 *
 * Three things Turkish stresses that no language shipped before it does:
 *
 * **Vowel harmony.** Turkish is agglutinative, and every suffix it agglutinates
 * has two or four surface shapes chosen by the last vowel of the stem —
 * "metreye" beside "kilograma", "metrede" beside "kilogramda". A flat suffix
 * list cannot express the rule, only its output, so `SUFFIXES` above enumerates
 * every harmonic variant and says why.
 *
 * **The dotted and dotless i.** `I` lowercases to `ı` in Turkish and to `i`
 * everywhere else, which makes case folding language-dependent for the first
 * time in this repo. Nothing in the chain below folds under a `tr` tag; see
 * `caseFolds` for what it does instead and why the obvious version is wrong.
 * The chain is not the only place it bites, and the other two are the ones a
 * reader will not think of, because neither is reached through an analyzer: a
 * *numeral* is handed the lexer's raw words (`turkishNumerals`) and a *keyword*
 * is looked up on a single fold of the token (`capsFolds`). All three are the
 * one problem, solved three times because there is no seam they share.
 *
 * **No agreement after a numeral.** "5 kilogram", never "5 kilogramlar" — the
 * noun is bare after a count, whatever the count is. So this is the first
 * language here whose `forms` table has exactly one row; see `selectForm`.
 */
export const turkish: Language = defineLanguage({
  id: "tr",
  /**
   * Read from CLDR rather than transcribed, the same as every language here.
   * This runtime's `Intl.NumberFormat("tr")` groups with "." and marks the
   * decimal with "," — the same pair as German, the inverse of English — and
   * `tr.test.ts` pins both. A language that transcribed its own separators is a
   * language that can disagree with the platform, which is the failure mode
   * `"intl"` exists to make impossible.
   */
  numberFormat: "intl",
  analyze: [
    // Required, not decorative. `createResolver` looks a surface up only through
    // the forms some analyzer produced — there is no unconditional lookup of the
    // raw word — so a chain without `identity()` cannot reach its own aliases,
    // and the failure is a wrong reading rather than an error.
    identity(),
    STRIPPER,
    // The same endings behind an apostrophe, which is how Turkish suffixes an
    // abbreviation: "5 kg'a", "100 km'ye". A separate analyzer rather than more
    // rows in `STRIPPER` because the two need different floors — see
    // `APOSTROPHE_STRIPPER`.
    APOSTROPHE_STRIPPER,
    caseFolds(),
  ],
  /**
   * The *shared* fold, unmodified, which is a claim worth making explicitly:
   * German and French both had to ship a parser of their own, and Turkish does
   * not. Its numerals are space-separated words in descending order with no
   * infix, no connective and no irregular teens, which is exactly the model
   * `NumeralParser` was cut for. Only the writing direction needed a Turkish
   * rule — "bin", not "bir bin" — so only `spell` is local. Both read the one
   * table in `tr-cardinals.ts`.
   *
   * The shared *fold* is not unmodified, and that is a different claim: see
   * `turkishNumerals`, which runs the shared parser a second time over the
   * Turkish lowercasing because the locale-neutral one turns "BİR" into
   * `"i" + U+0307` and "ALTMIŞ" into "altmiş". The grammar is the helper's; only
   * the letters are Turkish.
   */
  numerals: turkishNumerals(),
  spell: turkishSpeller(CARDINALS),
  keywords: {
    /**
     * Turkish marks the target of a conversion with the **dative suffix** —
     * "5 kilogramı grama çevir" — and a suffix is not a token, so `-e`/`-a`
     * cannot be a keyword. What can be is the verb it hangs off: "çevir"
     * (convert). Its diacritic-free spelling is listed beside it for the same
     * reason `tr-cardinals.ts` lists "uc" beside "üç": an ASCII keyboard is
     * common and both are unambiguous. "to" is English's word under the same
     * `Keyword`, so `buildKeywords` folds the two into one entry rather than
     * refusing them, and a bilingual engine reads either.
     *
     * "olarak" ("as", in "gram olarak") was considered and left out: it is a
     * postposition, so it follows its target rather than standing between the
     * operands, and the parser reads `left <keyword> right`.
     *
     * **What that leaves unreadable, stated rather than implied by the example
     * above.** Turkish is verb-final, so the sentence a Turk actually writes is
     * "5 kilogramı grama çevir" — both operands, then the verb — and the parser
     * wants the verb between them. Only "5 kilogram çevir gram" parses, which is
     * a word order nobody uses. Both nouns are read correctly (the strippers take
     * the accusative and the dative off), so the loss is the position of one
     * token and not the vocabulary; fixing it means a postfix reading in
     * `parse/`, which is core's grammar and not this language's table, and no
     * `Keyword` this file could claim would substitute for it.
     *
     * `capsFolds` is what makes the diacritic-free entry survive caps lock:
     * "CEVIR" folds to "cevır" under `tr`, and a keyword is matched on that fold
     * alone with no analyzer behind it.
     */
    in: capsFolds("çevir", "cevir", "to"),
    /**
     * `of`, `off` and `by` are claimed by nothing, and each absence is a
     * decision.
     *
     * `of` and `off` are suffixes in this language, not words: a percentage of a
     * base is "50'nin %20'si" (genitive, glued to the number with an
     * apostrophe) and a discount is "50 liradan %20 indirim" (ablative). There
     * is no free token standing where the engine needs one, and claiming the
     * bare noun "indirim" would make one unidiomatic word order the only one
     * that parses. The arithmetic stays reachable through `-` and `%`.
     *
     * `by` has nothing to do: "bölü" is already a complete operator, unlike
     * English's "divided by" or German's "geteilt durch", so there is no
     * particle for `foldWordOps` to swallow.
     */
    plus: capsFolds("artı", "arti"),
    minus: capsFolds("eksi"),
    /**
     * "çarpı" is the word read off a multiplication sign — "üç çarpı dört".
     * "kere" and "defa" are the spoken alternatives and are left out: both are
     * ordinary nouns meaning "occasion" ("üç kere gittim", "I went three
     * times"), so claiming them turns a sentence about how often something
     * happened into arithmetic.
     */
    times: capsFolds("çarpı", "carpi"),
    /**
     * "bölü" is the operator word, and "bolu" is its diacritic-free twin — the
     * one entry in this table that claims a surface Turkish already uses for
     * something else, so it is recorded rather than left to be discovered.
     *
     * **Bolu is a Turkish province and its capital**, about 180,000 people, and
     * a keyword claim is the strongest kind this engine makes: `lex` emits a
     * `keyword` token in place of the word, so nothing downstream ever sees
     * "bolu" as a word at all — not a unit alias, and not a name a `Completer`
     * or a `LiteralMatcher` could offer. `@smartput/datetime/locale/tr` states
     * the rule this violates ("only where the plain spelling is not already
     * another word") and applies it there by refusing "cin" for *Çin*.
     *
     * It is kept anyway, and the difference from "cin" is what "already another
     * word" means in each case. *Cin* is a common noun in everyday Turkish, so
     * the collision is with ordinary prose. *Bolu* is a proper noun that no kind
     * in this repo declares — `@smartput/geo` reads its gazetteer from GeoNames
     * at runtime rather than shipping one — so today the claim costs nothing,
     * while dropping it would cost the ASCII-keyboard spelling of the only
     * division word Turkish has. That balance flips the day a place kind ships a
     * bundled Turkish gazetteer, and the entry to reconsider then is this one.
     */
    over: capsFolds("bölü", "bolu"),
  },
  /**
   * **One key: `"other"`. That is the whole contract a Turkish `Vocabulary`
   * keys its `forms` table off — one row per unit, no more and no fewer.**
   *
   * Turkish does not agree a noun with the number in front of it. "1 kilogram",
   * "5 kilogram", "1,5 kilogram", "0 kilogram": the noun is bare every time, and
   * "5 kilogramlar" is not a plural, it is a mistake. `Intl.PluralRules("tr")`
   * does declare `one` and `other` — CLDR describes the *language*, not this
   * engine's question — and routing through it would produce a two-row table
   * whose two rows must always hold the same string. That is worse than useless:
   * every vocabulary would write each word twice, and a typo in the row that
   * only fires at count 1 would stay invisible until someone typed a 1.
   *
   * `"other"` rather than a Turkish-specific name because it is the key every
   * other language here already lands on when there is nothing to agree with
   * (ruling R5 — `en`'s `count === undefined ? "other"`), so a single-row table
   * written for Turkish is well-formed under any of them, and a translator
   * moving between languages meets one familiar word instead of a private one.
   *
   * **The rejected axis**, named because it is the one a reader will ask about:
   * a `conversion-target` case, the way `uk` and `de` both have one. Turkish
   * genuinely puts the target in the dative — "grama çevir" — but that ending is
   * mechanically derivable from the noun by vowel harmony, so every vocabulary
   * in the repo would carry a second row that no human judgement went into; and
   * when the target is written as a *symbol* rather than a word, Turkish glues
   * the ending on with an apostrophe ("kg'a"), which is punctuation the `forms`
   * table cannot reach. Two axes to serve one printer position, one of whose
   * halves the table cannot express, is a worse trade than one honest key.
   *
   * Note which direction that trade runs, because the two are not symmetrical:
   * this gives up *printing* the dative, never reading it. `STRIPPER` takes the
   * ending off a spelled target ("grama çevir") and `APOSTROPHE_STRIPPER` takes
   * it off an abbreviated one ("kg'a çevir"), so every shape a Turkish reader
   * writes arrives; what a reader gets back is the citation form.
   */
  selectForm: () => "other",
  /**
   * `defaultRenderQuantity` with one change, the same one German makes: a symbol
   * is set off from the number by a space rather than tight against it.
   *
   * Turkish typography follows SI here — TSE writes "5 kg", never "5kg" — and
   * the default template was written for English's tight `5kg`. The word branch
   * is untouched because it already spaces, and `gap` still wins wherever the
   * caller resolved a separator of its own, so `Printer`'s `spacing` option
   * reaches through this exactly as it does through the default.
   */
  renderQuantity: (parts) =>
    parts.form === undefined && parts.alias === undefined && parts.symbol !== undefined
      ? `${parts.number}${parts.gap ?? " "}${parts.symbol}`
      : defaultRenderQuantity(parts),
});

export default turkish;
