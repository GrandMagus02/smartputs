import type { Language } from "../types";
import { defineLanguage } from "./define";
import { identity } from "./helpers";

/**
 * The Indonesian language: how Indonesian is read and written, with no word for
 * any unit in it.
 *
 * **This file is the floor, and being the floor is the point of it.** Five
 * fields — `id`, `numberFormat`, `analyze`, `keywords`, `selectForm` — and a
 * `forms` table with exactly one row per unit. Ukrainian needs eight keys per
 * unit and German four; Indonesian needs one, because nothing in the language
 * agrees with anything else in it. There is no grammatical plural: plurality is
 * reduplication ("buku-buku", books) or context, and neither survives a
 * numeral — "lima kilogram" is five kilograms and "lima kilogram-kilogram" is
 * not Indonesian at all, so the counted noun is invariant by rule rather than
 * by coincidence. There is no gender, no case, no article, and no agreement for
 * a preposition to govern. The script is Latin and the words are spaced, so
 * `segment` is absent too, and the morphology below is one analyzer long.
 *
 * That a language *can* be this cheap is the claim the three-type split was
 * designed to be able to make, and it is a claim only a language at this end of
 * the range can support. `Language` holds mechanics and nothing else, so a
 * language with almost no mechanics is almost no file — while an Indonesian
 * `Vocabulary` is exactly the same size as anybody else's, because the words
 * for a kind's units are the same job in every language. Had words and grammar
 * stayed in one object, Indonesian would have cost whatever its unit inventory
 * costs and the saving would have been invisible. The cheapness lives entirely
 * on the grammar side, which is why it shows up only once the two are apart.
 *
 * **The tag is `id`, and the alternative is a trap rather than a preference.**
 * ISO 639-1 originally coded Indonesian as `in`; that was superseded by `id` in
 * 1989, and every `Intl` constructor canonicalises the old tag to the new one
 * (`new Intl.Locale("in").toString()` is `"id"`). So there is no choice to
 * make — but it is worth naming, because `in` is this engine's English
 * conversion keyword and a language file called `in.ts` sitting in this
 * directory would read as the wrong thing every time.
 *
 * **No `numerals` and no `spell`, and that is a measurement rather than a
 * shrug.** Indonesian spaces its numerals, so it looks like precisely the
 * run-of-words shape `cardinalNumerals` models, and it is not one. A
 * sub-thousand Indonesian number is built from *two* multiplying morphemes —
 * `puluh` (×10) and `ratus` (×100) — where English has a flat table of addends
 * and a single `hundred`: "dua puluh lima" is 2×10 + 5, not an addend plus an
 * addend. The shared helper flushes an accumulated group into the total only at
 * a scale of a thousand or more, so within one group the hundreds and the tens
 * multiply into each other instead: "seratus dua puluh lima" reads 1025 where
 * Indonesian says 125. The teens are the same defect from the other side —
 * `belas` is additive ("dua belas" is 10 + 2, units before the ten) and
 * `CardinalTables` has no row that can say so, so the most charitable table
 * reads 20. Both cases return the wrong number rather than refusing, which is
 * exactly the failure `third-language.test.ts` recorded against German's
 * `einundzwanzig` and the one thing a numeral fold must never do. `id.test.ts`
 * pins both numbers, so the day the helper grows a second sub-thousand scale
 * the pin fails and this paragraph gets rewritten instead of quietly staying
 * here.
 *
 * The repair is an Indonesian `NumeralParser` of its own, in an
 * `id-cardinals.ts` beside a speller reading the same table — the grammar is
 * regular enough that it would not be a hard one to write. It is not written
 * here because a language with no `numerals` claims no word at all, while a
 * language with a *nearly* right one claims four words and answers 1025.
 *
 * **No `renderQuantity` either, and that one is a cost rather than a
 * saving.** Indonesian follows the SI convention of spacing a symbol from its
 * number ("5 kg", never "5kg"), and `defaultRenderQuantity` sets a symbol
 * tight. What makes it affordable is that the tight branch is reached only when
 * a unit has neither a `form` nor an `alias` to print, and every unit of a
 * translated Indonesian vocabulary has the one `forms` row above — so
 * `formatValue` takes the word branch, which already spaces. The branch that
 * remains is `Printer`'s `symbols` mode, where `spacing` is the caller's own
 * option and is passed through as `gap`. Spending a sixth field to move one
 * space in a path that already has a knob for it would spend the claim this
 * file exists to make.
 */
export const indonesian: Language = defineLanguage({
  id: "id",
  /**
   * Read from CLDR rather than transcribed, as in every language here. This
   * runtime's `Intl.NumberFormat("id")` groups with "." and marks the decimal
   * with "," — Dutch and German's pair, the exact inverse of English's — and
   * `id.test.ts` pins both. Pinning the *output* of the "intl" branch is not
   * the same as bypassing it: a language that transcribes its own separators is
   * a language that can disagree with the platform.
   */
  numberFormat: "intl",
  analyze: [
    // The whole of Indonesian morphology, as far as this engine is concerned.
    // `identity()` is required rather than decorative: `createResolver` looks a
    // surface up only through the forms some analyzer produced, with no
    // unconditional lookup of the raw word underneath, so a chain without it
    // cannot reach its own aliases (`third-language.test.ts` measures that
    // failure, where the cost is a wrong unit rather than an error).
    //
    // Nothing joins it, and the two candidates were both weighed rather than
    // forgotten. Indonesian affixation is rich but *derivational* — meN-, ber-,
    // -kan, -i, -an build verbs and abstract nouns out of roots, and none of
    // them lands on a measure noun standing after a numeral; a stripper for
    // "-an" would find "satuan" (a unit, the abstract noun) and hand back
    // "satu" (one), which is a number, so the one plausible rule is also the
    // one that turns a noun into a numeral. The other candidate is the clitic
    // "-nya", the only suffix that genuinely does attach to a unit noun
    // ("kilonya"): it marks definiteness, not agreement, and it does not appear
    // in the "<number> <unit>" position this engine reads — a quantity is
    // "5 kilo", never "5 kilonya". A vocabulary that wants it lists it, which
    // is where a fact about one word belongs.
    identity(),
  ],
  keywords: {
    // "ke" is the directional "to" ("5 kg ke gram") and "dalam" is "in"
    // ("5 kg dalam gram"). Indonesian does not claim the surface "in" at all,
    // which is why installing this language beside English adds no work for
    // `buildKeywords`: the two tables do not overlap anywhere.
    //
    // "dalam" also heads the temporal "dalam 3 hari" ("within three days"),
    // which this table now reads as a conversion into the unit "hari". That is
    // the same word English gives away in "in 3 days", accepted here for the
    // same reason: the conversion sense is the one a calculator is being asked
    // for, and the temporal one fails loudly at the parser rather than
    // returning a plausible wrong number. Dropping "dalam" and keeping only
    // "ke" was the alternative, and it costs more than it saves — "dalam" is
    // the commoner of the two in written Indonesian, where "ke" reads as motion
    // toward a place.
    in: ["ke", "dalam"],
    // "20% dari 50". "dari" is "of"/"from" and sits between the two operands in
    // exactly the order `of` reads them.
    //
    // It is also the second half of every Indonesian comparative — "lebih dari"
    // (more than), "kurang dari" (less than) — which is the same collision the
    // `minus` row below records from the other side, and it resolves the same
    // way. A comparison written out in words reads "dari" as `of` and then
    // fails on the operand behind it; a comparison written with an operator is
    // untouched, because "<" and ">" never reach the keyword table. Leaving
    // "dari" unclaimed to protect the spelled-out comparative would be the
    // trade `en.ts` refuses when it declines "less" for `off`, run backwards:
    // there it is the operator that yields to the ordinary word, because
    // English has "off" to fall back on. Indonesian has no second preposition
    // for `of` — "dari" is the only word that stands between a percentage and
    // its base — so yielding here would leave the slot empty.
    of: ["dari"],
    // No word claimed for `off`, and that is a decision about word order rather
    // than a gap in the vocabulary. Indonesian states a discount as the noun
    // "diskon", which comes *first* — "diskon 20% dari 50" — while `off` is an
    // infix operator taking the percentage on its left and the base on its
    // right. A keyword that only ever appears in front of both operands has no
    // spelling this parser can accept, and claiming it anyway would make
    // "20% diskon 50" the single phrase that works, which is one no Indonesian
    // writes. The arithmetic stays reachable through `-` and `%`.
    plus: ["tambah"],
    // The bare verb, which is how spoken Indonesian arithmetic runs: "sepuluh
    // kurang lima". Worth one caveat for whoever meets it next — "kurang dari"
    // is also the ordinary way to say "less than", so an input written as a
    // comparison rather than as a subtraction reads "kurang" as `minus` and
    // then fails on the "dari" behind it. That is the same class of collision
    // English accepts by not claiming "less", and it is the right way round:
    // the failure is loud, and the comparison has its own operator to be
    // written with.
    minus: ["kurang"],
    // "kali" is the multiplier ("dua kali tiga"), and the same word is the noun
    // for an occasion — "tiga kali" is three times in both senses at once,
    // which is why the two never have to be told apart. The homograph worth
    // naming is the other "kali", the Jakarta word for a river; it is a bare
    // noun that never stands between two numerals, so nothing claims it away
    // from anybody.
    times: ["kali"],
    // "sepuluh bagi dua". The bare verb, chosen over the fuller "dibagi" for
    // the reason `by` is absent below: "dibagi" wants a preposition after it,
    // and every candidate is a word this table has no business taking.
    //
    // "bagi" is also the ordinary preposition "for" ("bagi saya", "bagi kita"),
    // and that is a heavier claim than "kurang"'s — a preposition is commoner
    // than a comparative, and it can open a phrase rather than only sit inside
    // one. It is claimed anyway, on the same argument: the collision surfaces
    // only where a keyword is *reachable*, which is between two operands, and
    // "bagi saya" puts a pronoun there that fails at the parser instead of
    // dividing by anything. The alternative was to leave `over` unspelled and
    // let "/" carry division alone, as `off` is left unspelled above — and the
    // two cases are not alike. `off` has no infix spelling in Indonesian at
    // all, so claiming a word for it would invent a phrase; `over` has one that
    // Indonesians genuinely write, and refusing it would drop a reading the
    // language actually has to avoid a reading the parser already rejects.
    over: ["bagi"],
    // No `by`, which is the shape of the language rather than an omission.
    // `by` exists only to be swallowed by one of the four operator words, so
    // that "divided by" is a single operator; "kali" and "bagi" are complete on
    // their own ("sepuluh bagi dua") and have nothing to swallow. The fully
    // spelled passive forms — "dikali dengan", "dibagi oleh" — would need
    // "dengan" or "oleh", and both are among the commonest prepositions in the
    // language. Claiming one so that a second spelling of division parses is a
    // bad trade: a stray `by` fails at the parser, so the cost lands on every
    // input that used the preposition for anything else.
  },
  /**
   * One key, always, for every count and every slot: **`"other"`**. That is the
   * whole contract an Indonesian `Vocabulary` keys its `forms` table off, and
   * it is closed at one.
   *
   * The constant is deliberate, and the rejected alternative is
   * `plural.select(...)` the way every other language here writes it.
   * `Intl.PluralRules("id")` declares exactly one category — Indonesian is in
   * CLDR's no-plural group, beside Japanese, Korean, Chinese, Thai and its own
   * close relative Malay — so the lookup could only ever return the
   * string below, and writing it as a lookup would tell a reader the key set is
   * open when it is not. `id.test.ts` asserts CLDR's category list is still the
   * single `["other"]`, so this constant is pinned to the platform rather than
   * merely agreeing with it today.
   *
   * `count` and `slot` are both ignored, and neither is an axis this language
   * has: a fraction, a zero and a thousand all take the same noun, and there is
   * no case for a preposition to govern, so a conversion target ("… dalam
   * gram") is spelled exactly like a bare quantity. Ruling R5's count-free call
   * is answered by the same constant for free — `"other"` is the category CLDR
   * requires every locale to define as its generic one, which is why it is the
   * right name for a language that has only the generic one.
   */
  selectForm: () => "other",
});

export default indonesian;
