import type { CardinalTables } from "./helpers";

/**
 * Hindi cardinals: one table, two directions. `cardinalNumerals` reads it to
 * parse "दो लाख पचास हज़ार" back to `250000`; `cardinalSpeller` reads the same
 * object to spell `250000` as "दो लाख पचास हज़ार". Hoisted into one const,
 * exactly as `en.ts` and `uk-cardinals.ts` do, so the reading and the writing
 * halves can never drift apart.
 *
 * Three things about Hindi shape this table, and each one decides which of the
 * four `CardinalTables` fields a word lands in.
 *
 * **`tens` is empty, and that is the whole story of Hindi numerals below 100.**
 * English composes twenty-one out of a `tens` word and a `units` word, and the
 * helper's `spellUnderHundred` exists to do exactly that. Hindi composes
 * nothing: 21 is इक्कीस, 22 is बाईस, 45 is पैंतालीस — each a single fused word
 * whose halves have been ground down by sandhi past the point of being free
 * numerals ("इक्" is not एक, "पैं" is not पाँच). There is no productive rule to
 * express, so every value from 0 to 99 is declared as an atom in `units`, and
 * `tens` — the table of things that *combine* — has nothing to hold. This is
 * the same reasoning that put Ukrainian's fused hundreds (двісті, п'ятсот) in
 * `tens` rather than `scales`, applied one order of magnitude lower and to a
 * hundred rows instead of eight: a word goes where its arithmetic is, not where
 * its magnitude is.
 *
 * The helper is fine with an empty `tens` by construction rather than by
 * accident. `cardinalNumerals` merges `units` and `tens` into one flat map of
 * addends with no assumption about either's range; `cardinalSpeller` derives
 * its `tensFloor` from the smallest declared `tens` value and, finding none,
 * takes `+Infinity` — which is correct here, because a Hindi value under 100
 * that is not a direct `units` hit has no fallback composition to reach for.
 * All hundred of them are direct hits.
 *
 * `units` also carries a short tail of **fractional** atoms — डेढ़, ढाई, आधा,
 * साढ़े — for the same "no compositional structure" reason, and they are worth
 * knowing about before the ×100 rows below: Hindi has single words where English
 * builds "one and a half" out of parts, so a table translated from `en` has no
 * slot to put them in and leaves "ढाई घंटे" unparseable. See the block comment on
 * the rows themselves for why सवा and पौने are not among them.
 *
 * **The scales are the Indian ones, and above हज़ार they chain in hundreds.**
 * लाख is 10⁵ and करोड़ is 10⁷, so the ladder goes ×1000, ×100, ×100, ×100 —
 * not the ×1000-forever ladder English walks. This costs the table nothing:
 * `cardinalNumerals` only asks whether a scale is at or above a thousand (to
 * decide whether it closes a group or multiplies the current one), and
 * `cardinalSpeller` walks the declared scales in descending order and takes the
 * largest that fits. What the Indian ladder *changes* is the size of the
 * multiplier each group carries — 25,00,000 is "पच्चीस लाख", twenty-five of
 * them, where the English grouping would want two-point-five million — and that
 * falls out of the same descending walk with no special case. `hi.test.ts` pins
 * लाख and करोड़ in both directions, because they are the half of this table
 * English has no word for and therefore the half a reader cannot check by
 * analogy.
 *
 * The ladder stops at खरब (10¹¹). नील, पद्म and शंख continue it in the
 * traditional lists and are not in modern use — a Hindi newspaper reaching past
 * खरब writes "सौ खरब", which is what the speller composes here anyway once its
 * ceiling (a thousand times the largest declared scale) is high enough to get
 * there. Declaring words nobody types would add reading surface for nothing and
 * would push the ceiling past the point where the composition stays honest.
 *
 * **Nukta and nasal marks are spelled two ways by two keyboards, and both are
 * declared.** ड़ and ज़ are composition exclusions in Unicode: NFKC — which
 * `normalize()` applies before a word ever reaches the numeral fold —
 * *decomposes* U+095C and U+095B into a bare consonant plus U+093C, so the
 * forms written here are the decomposed ones and a precomposed spelling folds
 * onto them upstream. That handles the *encoding* of the nukta. It does not
 * handle its *absence*: "हजार" for हज़ार, "करोड" for करोड़ and "अडतीस" for
 * अड़तीस are ordinary Devanagari that a great many people type, and no
 * normalization will ever join them to the nukta-bearing form, so each is
 * declared as its own key on the same value. Every ड़- and ज़-bearing word in
 * this table has such a twin, and the numeral fold is where the omission would
 * hurt most: it has no fuzzy fallback, so an unlisted spelling is a phrase that
 * does not parse rather than one that parses at a penalty.
 * The same goes for the nasals — पाँच (chandrabindu) and पांच (anusvara)
 * are one word set with two marks, as are the nine ं-bearing compounds in the
 * thirties and forties, and there is no way to know which one a keyboard
 * produced.
 *
 * In every such pair the form a careful typesetter would produce is declared
 * **first**, because `cardinalSpeller` keeps the first word it sees for a value.
 *
 * What is deliberately **not** here: हज़ारों, लाखों, करोड़ों. They look like
 * inflected scale words and are not numerals at all — "लाखों लोग" is "hundreds
 * of thousands of people", an indefinite quantifier with no value to parse to.
 * The oblique plural that produces them is a `suffixStripper` suffix in `hi.ts`,
 * where it belongs, and reading them as exact multiples here would turn a vague
 * phrase into a precise wrong number.
 */
export const CARDINALS: CardinalTables = {
  units: {
    शून्य: 0,
    एक: 1,
    दो: 2,
    तीन: 3,
    चार: 4,
    // Chandrabindu first, anusvara second: both spell 5, and the second is what
    // most phone keyboards emit.
    पाँच: 5,
    पांच: 5,
    // छह is the written form; छः, with the visarga, is the older spelling still
    // in wide use.
    छह: 6,
    छः: 6,
    सात: 7,
    आठ: 8,
    नौ: 9,
    दस: 10,
    ग्यारह: 11,
    बारह: 12,
    तेरह: 13,
    चौदह: 14,
    // पंद्रह uses the anusvara; पन्द्रह writes the same nasal as a conjunct न्.
    पंद्रह: 15,
    पन्द्रह: 15,
    सोलह: 16,
    सत्रह: 17,
    अठारह: 18,
    उन्नीस: 19,
    बीस: 20,
    // 21–29. Nothing in this row is derived from बीस by a rule anything could
    // apply: इक्कीस, बाईस and तेईस keep only a worn-down trace of एक, दो and
    // तीन, and उनतीस (29) is built by *subtraction* from तीस (30) rather than
    // by addition to बीस at all.
    इक्कीस: 21,
    बाईस: 22,
    तेईस: 23,
    चौबीस: 24,
    पच्चीस: 25,
    छब्बीस: 26,
    सत्ताईस: 27,
    अट्ठाईस: 28,
    उनतीस: 29,
    तीस: 30,
    इकतीस: 31,
    बत्तीस: 32,
    तैंतीस: 33,
    तैतीस: 33,
    चौंतीस: 34,
    चौतीस: 34,
    पैंतीस: 35,
    पैतीस: 35,
    छत्तीस: 36,
    सैंतीस: 37,
    सैतीस: 37,
    // ड़ is a composition exclusion, so NFKC settles how the nukta is *encoded*
    // and never supplies one that was not typed. The four ड़-bearing atoms in
    // this table therefore each get a nukta-less twin, exactly as हज़ार and
    // करोड़ do below — and they need it more than a unit alias does, because the
    // numeral fold has no fuzzy path: "अडतीस किलोग्राम" did not parse at all,
    // where an unlisted spelling of a *unit* is merely a penalised reading.
    अड़तीस: 38,
    अडतीस: 38,
    // 39, 49, 59, 69, 79, 89, 99 are all the subtractive pattern: उन- prefixed
    // to the *following* ten. They are listed as plain atoms because that is
    // what they are to a reader; naming the pattern would not let anything
    // compose them.
    उनतालीस: 39,
    चालीस: 40,
    इकतालीस: 41,
    बयालीस: 42,
    तैंतालीस: 43,
    तैतालीस: 43,
    चवालीस: 44,
    पैंतालीस: 45,
    पैतालीस: 45,
    छियालीस: 46,
    सैंतालीस: 47,
    सैतालीस: 47,
    अड़तालीस: 48,
    अडतालीस: 48,
    उनचास: 49,
    पचास: 50,
    इक्यावन: 51,
    बावन: 52,
    तिरपन: 53,
    चौवन: 54,
    पचपन: 55,
    छप्पन: 56,
    सत्तावन: 57,
    अट्ठावन: 58,
    उनसठ: 59,
    साठ: 60,
    इकसठ: 61,
    बासठ: 62,
    तिरसठ: 63,
    चौंसठ: 64,
    चौसठ: 64,
    पैंसठ: 65,
    पैसठ: 65,
    छियासठ: 66,
    सड़सठ: 67,
    सडसठ: 67,
    अड़सठ: 68,
    अडसठ: 68,
    उनहत्तर: 69,
    सत्तर: 70,
    इकहत्तर: 71,
    बहत्तर: 72,
    तिहत्तर: 73,
    चौहत्तर: 74,
    पचहत्तर: 75,
    छिहत्तर: 76,
    सतहत्तर: 77,
    अठहत्तर: 78,
    उन्यासी: 79,
    अस्सी: 80,
    इक्यासी: 81,
    बयासी: 82,
    तिरासी: 83,
    चौरासी: 84,
    पचासी: 85,
    छियासी: 86,
    सत्तासी: 87,
    अट्ठासी: 88,
    नवासी: 89,
    नब्बे: 90,
    इक्यानवे: 91,
    बानवे: 92,
    तिरानवे: 93,
    चौरानवे: 94,
    पचानवे: 95,
    छियानवे: 96,
    सत्तानवे: 97,
    अट्ठानवे: 98,
    निन्यानवे: 99,
    // The fractional atoms, and they are the half of Hindi counting an English
    // table has no slot for. English says "one and a half" — a compound of words
    // it already has — so `en`'s table needs no row for it and `CardinalTables`
    // was written without one in mind. Hindi has single words: डेढ़ is 1.5, ढाई
    // is 2.5, आधा is 0.5, and साढ़े adds a half to whatever follows it (साढ़े तीन
    // is 3.5). "डेढ़ किलो", "ढाई घंटे" and "आधा घंटा" are the ordinary way to
    // write those quantities — commoner in a search box than "1.5 किलो" — and
    // without these rows every one of them failed to parse at all.
    //
    // They belong in `units` because that is where an *addend* goes, and each of
    // these is one: `cardinalNumerals` sums addends before applying a scale, so
    // साढ़े तीन हज़ार is (0.5 + 3) × 1000 = 3500 and ढाई लाख is 2.5 × 100000,
    // both correct. आधे is आधा's oblique/plural form ("आधे घंटे में"), which is
    // an ending Hindi substitutes rather than appends, so no stripper reaches it
    // and it is listed outright.
    //
    // **सवा (+¼) and पौने (−¼) are deliberately absent, and the reason is
    // arithmetic rather than lexical.** They are increments like साढ़े, so they
    // read correctly in front of an addend — सवा तीन really is 3.25 — but Hindi
    // also writes them in front of a *scale*, and there the addend model gives
    // the wrong number rather than no number: सवा सौ is 125 and this fold would
    // make it 0.25 × 100 = 25, पौने सौ is 75 and it would make it −25. साढ़े
    // survives the same position only because साढ़े सौ is not idiomatic and
    // साढ़े तीन सौ resolves as (0.5 + 3) × 100 = 350. A quarter-scale word needs
    // a multiplier the four-table model cannot express, so declaring one would
    // trade a phrase that fails loudly for a phrase that answers wrongly.
    //
    // Nothing here is ever *written*: `cardinalSpeller` declines a non-integer
    // before it consults a table, so `spell(1.5)` stays null and the printer
    // falls back to digits, exactly as it did before these rows existed.
    डेढ़: 1.5,
    डेढ: 1.5,
    ढाई: 2.5,
    आधा: 0.5,
    आधे: 0.5,
    साढ़े: 0.5,
    साढे: 0.5,
  },
  /**
   * Empty on purpose — see the doc comment above. Hindi has no numeral that
   * combines with another below 100, so the table of combining tens has no
   * member. Every 0–99 value is an atom in `units`.
   */
  tens: {},
  scales: {
    // The only sub-thousand multiplier: "दो सौ पचास" is 250, and "सौ करोड़"
    // multiplies a whole scale. `cardinalNumerals` treats a scale under a
    // thousand as multiplying the current group rather than closing it, which
    // is exactly what सौ does in both of those.
    //
    // सौ stays out of `units` for that reason, and the consequence is worth
    // naming: 100 spells as "एक सौ" and never as the bare "सौ". Both are
    // idiomatic Hindi; "एक सौ" is the one a table of atoms cannot get wrong,
    // while declaring सौ as an atom too would make "दो सौ" parse as 2 + 100 =
    // 102, because `cardinalNumerals` checks addends before scales.
    सौ: 100,
    // Nukta-bearing form first (it is the correct spelling and what the speller
    // will emit), nukta-less second (it is what a great many keyboards produce).
    हज़ार: 1_000,
    हजार: 1_000,
    लाख: 100_000,
    करोड़: 10_000_000,
    करोड: 10_000_000,
    अरब: 1_000_000_000,
    खरब: 100_000_000_000,
  },
  // `connectors` is absent, and that is a claim about Hindi rather than an
  // omission. English needs one because "two hundred and five" is how the
  // language says 205. Hindi juxtaposes — "दो सौ पाँच" — and the closest word,
  // और, is the ordinary conjunction "and". Claiming it would put one of the
  // commonest words in the language inside the numeral fold, where its only
  // effect would be to let a phrase nobody writes parse; "पाँच किलो और तीन
  // किलो" would still not become addition, because और is not claimed as an
  // operator either (see `hi.ts`'s keyword table, which gives that job to जोड़).
};

/** Keep the first word declared for each value; drop every later synonym. */
const firstSpellingWins = (source: Record<string, number>): Record<string, number> => {
  const taken = new Set<number>();
  const out: Record<string, number> = {};
  for (const [word, value] of Object.entries(source)) {
    if (taken.has(value)) continue;
    taken.add(value);
    out[word] = value;
  }
  return out;
};

/**
 * `CARDINALS` with the synonyms filtered out — the same table, read in the
 * writing direction. `hi.ts` hands `CARDINALS` to `cardinalNumerals` and this
 * to `cardinalSpeller`.
 *
 * **This is not a second table.** It is derived from the first by a function
 * with no words in it, so a row added above appears in both directions or in
 * neither, which is the entire property "one table, two directions" was
 * protecting. What it is not allowed to become is a hand-written copy.
 *
 * It exists because a value with two spellings resolves *deterministically* on
 * one side of `cardinalSpeller` and not on the other. For `units` and `tens`
 * the helper builds its lookup with an explicit first-word-wins rule and says
 * so. For `scales` it instead sorts the declared entries by descending value
 * with `(a, b) => a.value.gte(b.value) ? -1 : 1` — a comparator that answers
 * −1 for *both* orders of an equal-valued pair, which is exactly the
 * inconsistency a sort is entitled to resolve however it likes. Measured, not
 * reasoned about: with हज़ार declared before हजार, this runtime's sort emits
 * हजार, and `spell(1000)` came back "एक हजार" — the nukta-less spelling, from
 * a table that declares the correct one first precisely so that would not
 * happen. Ukrainian hit the same tie with тисяча/тисячі/тисяч and dealt with it
 * by declining to pin its own output (see `uk.test.ts`).
 *
 * Hindi declines the tie instead. A nukta is not a synonym on the way out: ज़
 * and ज are different letters, and printing "हजार" from a table whose first
 * word is "हज़ार" is a spelling error, not a variant. Filtering the writing
 * direction costs the reading direction nothing — every synonym is still
 * declared above and still parses — and it makes `spell` pinnable, which
 * `hi.test.ts` does.
 */
export const SPELLING: CardinalTables = {
  units: firstSpellingWins(CARDINALS.units),
  tens: firstSpellingWins(CARDINALS.tens),
  scales: firstSpellingWins(CARDINALS.scales),
};
