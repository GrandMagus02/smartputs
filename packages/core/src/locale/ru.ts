import type { Language } from "../types";
import { defineLanguage } from "./define";
import { cardinalNumerals, identity, suffixStripper } from "./helpers";
import { CARDINALS, russianSpeller } from "./ru-cardinals";

const plural = new Intl.PluralRules("ru");

/**
 * The word both multiplicative operators need after their verb, named once
 * because it is written twice: it is `keywords.by`'s only entry, and it is what
 * `renderExpression` has to put back between "умножить" and its right operand.
 *
 * Declaring it here rather than inlining the string twice is what keeps the
 * reading and the writing halves from drifting: `parse/wordops.ts` folds
 * "умножить" plus this word into one `*` token, and the printer has to emit the
 * very word that fold consumes or its own output stops reading back.
 */
const BY = "на";

/**
 * The Russian language: how Russian is read and written, with no word for any
 * unit in it.
 *
 * Structurally this is `uk`'s twin, and deliberately so: four CLDR categories
 * (`one`/`few`/`many`/`other`) crossed with a case axis, so a `forms` key is
 * `` `${case}-${category}` `` — eight per unit, not two. The engine never learns
 * what `"loc"` means; it asks the language for a key and indexes the unit's
 * table with it (design decision I3), which is the whole reason a language can
 * carry a second axis without anything upstream of `forms` changing shape.
 *
 * **The key names the Ukrainian case, not the Russian one, and that is a
 * choice.** Russian grammar calls this case the *prepositional* (предложный) —
 * it exists only after a preposition — so `prep-many` was the honest name and it
 * was rejected. The two Slavic vocabularies in this repo are the ones most
 * likely to be written by the same hand, one ported from the other, and a key
 * set that differs from `uk`'s by a rename would turn every one of those ports
 * into eight silent misses. The label is opaque to the engine either way; what
 * matters is that a vocabulary and its language agree, and `ru.test.ts` pins
 * every key this function can return.
 *
 * The case still comes from the slot, and `conversion-target` is prepositional
 * because that is what `в` governs: "в 5 килограммах", never "в 5 килограммов".
 *
 * Where Russian genuinely differs from Ukrainian is in every ending it prints,
 * which is a vocabulary's problem rather than this file's — but the two rows
 * worth naming here, because they are what a translator gets wrong:
 *
 *   `nom-many`   the 5+/0/teens row  "5 килограммов" — genitive plural in -ов
 *                                    where Ukrainian has -ів, and a bare stem
 *                                    for feminines: "5 тонн".
 *   `nom-other`  the *fractional*    "1,5 килограмма" — genitive **singular**.
 *                                    Not a plural at all; writing one prints
 *                                    "1,5 килограммов", which no shape-based
 *                                    test in this repo would catch.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const russian: Language = defineLanguage({
  id: "ru",
  // Read from CLDR rather than hand-written, the same as every other language
  // here. This runtime's `Intl.NumberFormat("ru")` groups with U+00A0 and marks
  // the decimal with ",", and `ru.test.ts` pins both — but pinning the *output*
  // of the "intl" branch is different from bypassing it: a language that
  // transcribes its own separators is a language that can disagree with the
  // platform.
  numberFormat: "intl",
  analyze: [
    // Required, not decorative: the resolver reaches an alias only through a
    // form some analyzer produced, so a chain without `identity()` cannot read
    // its own vocabulary.
    identity(),
    // Russian inflects for six cases across two numbers, and unlike English —
    // where two suffixes cover the whole of it — a fallback stripper needs the
    // endings a unit noun actually takes. Each is here for one reason, and the
    // hard/soft pairs are listed as pairs because Russian spells the same case
    // twice depending on the stem's final consonant:
    //
    //   ами  instrumental plural, hard     килограммами → килограмм
    //   ями  instrumental plural, soft     унциями      → унци-
    //   ах   prepositional plural, hard    в килограммах → килограмм  (the "в …" row)
    //   ях   prepositional plural, soft    в унциях     → унци-
    //   ам   dative plural, hard           килограммам  → килограмм
    //   ям   dative plural, soft           унциям       → унци-
    //   ов   genitive plural, masc. hard   килограммов  → килограмм
    //   ев   genitive plural after ц/soft  месяцев      → месяц
    //   ей   genitive plural, soft         рублей       → рубл-
    //   ой   instrumental sg. feminine     тонной       → тонн
    //   ом   instrumental sg. masculine    килограммом  → килограмм
    //   ем   instrumental sg. soft masc.   месяцем      → месяц
    //   ы    nominative plural, hard       килограммы   → килограмм
    //   и    nom. pl. soft / gen. sg. fem. рубли, унции → рубл-, унци-
    //   е    prepositional sg.             в килограмме → килограмм
    //   а    genitive sg. masculine        километра    → километр  (the 1,5 row)
    //   у    dative sg. m. / acc. sg. f.   килограмму, тонну
    //   ю    accusative sg. feminine soft  унцию        → унци-
    //   я    gen. sg. soft / nom. sg. fem. рубля, унция → рубл-, унци-
    //
    // Several rows fire on one word and that is intended: the chain pools every
    // form any analyzer produced and the alias index decides which ones exist.
    // Note what the feminine rows produce — "унци", not "унция". Russian marks
    // these cases by *substituting* the final vowel, and a stripper only
    // removes, so a feminine noun yields a stem rather than a lemma. That is
    // acceptable precisely because this is the fallback: a `Vocabulary` lists
    // the forms a reader is expected to type, and the stripper only catches what
    // it did not think to list.
    //
    // `minStem: 3` keeps it away from the two-letter symbols Russian units are
    // usually written with ("кг", "мм", "см", "га", "ГБ") — "га" ends in a
    // listed suffix, and shredding it would hand the resolver a stem of one
    // letter. `weight: -2` is the penalty `en` and `uk` both use, so an exactly
    // listed alias always outranks a stripped one. `suffixStripper` sorts
    // longest-first itself, so "ами" is tried before "и" regardless of the order
    // written here.
    suffixStripper({
      suffixes: [
        "ами",
        "ями",
        "ах",
        "ях",
        "ам",
        "ям",
        "ов",
        "ев",
        "ей",
        "ой",
        "ом",
        "ем",
        "ы",
        "и",
        "е",
        "а",
        "у",
        "ю",
        "я",
      ],
      minStem: 3,
      weight: -2,
    }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  // Not `cardinalSpeller`: Russian's hundreds are fused words and its scale
  // words agree with their multiplier, neither of which the shared four-table
  // shape can express. `ru-cardinals.ts` says so at length, and both directions
  // still read the one set of tables declared there.
  spell: russianSpeller(),
  keywords: {
    // "в" is the conversion preposition proper — "1 кг в граммах" — and "до" is
    // the "up to" of a target ("перевести 1 кг до граммов"), less common in
    // running Russian than "в" but unambiguous when it is a conversion being
    // written. The same pair `uk` claims as "в"/"до".
    //
    // "у" is the odd one and is claimed with open eyes: in Russian it means
    // "at, by, in the possession of" and a Russian sentence would not write "у
    // граммах" — that spelling is Ukrainian, where "в" and "у" are one
    // preposition chosen euphonically. It is here because recognition is
    // many-to-one while generation stays one (I6): the surface costs nothing to
    // accept, `uk` already claims it for this very keyword so `buildKeywords`
    // folds the two into a single entry rather than reporting a conflict, and a
    // reader switching between two keyboards types it. Nothing prints it —
    // `Printer` writes the format locale's own words.
    in: ["в", "у", "до"],
    // "20% от 50" — the partitive, and the only word Russian uses for it.
    of: ["от"],
    // `off` is deliberately unclaimed. Russian says "скидка 20% на 50", where
    // the operator is a noun phrase rather than a word: "скидка" alone is the
    // noun "discount", and claiming it would make an ordinary noun in running
    // text an operator that then demands two operands. The same subtraction is
    // still expressible as "50 - 20% от 50", and `of` is the piece Russian
    // actually has a single word for.
    plus: ["плюс"],
    minus: ["минус"],
    // The infinitives, because that is how an instruction is phrased: "5
    // умножить на 3", "12 разделить на 4". The finite forms ("умножь",
    // "умножим") were left out — one surface word per operator, and an
    // imperative is a second way of saying what this already says.
    times: ["умножить"],
    over: ["разделить"],
    // "на" completes both of the above, and is claimed by `uk` for exactly the
    // same job on exactly the same surface. `renderExpression` below is what
    // puts it back on the way out.
    by: [BY],
  },
  /**
   * Puts "на" back after "умножить" and "разделить", and changes nothing else.
   *
   * `Printer` spells an operator as `keywords[<op>][0]` and nothing more, which
   * is the whole word in English ("ten kilograms times two") and only half of
   * one in Russian: "умножить" and "разделить" are transitive verbs that govern
   * their second operand through "на", so the default assembler emits "десять
   * килограммов умножить два" — a string no Russian speaker would write. The
   * missing word is not a synonym or a politeness; it is the same "на" the
   * reading direction already requires, which is why `keywords.by` claims it and
   * why `parse/wordops.ts` swallows it as part of the operator.
   *
   * Two alternatives were considered and are worse. Claiming a phrase — "умножить
   * на" as a single `times` entry — cannot work: a keyword is matched against one
   * token and a space ends a token, so the phrase would be unreachable on the way
   * in as well as out. Choosing a different first entry, the way `en` gets a
   * standalone word by putting "times" before "multiplied", has nothing to choose
   * from: Russian has no one-token verb for this that stands without a
   * preposition.
   *
   * `+` and `-` are untouched because "плюс" and "минус" already stand alone, and
   * the unspelled branch (`word === undefined`) reproduces
   * `defaultRenderExpression` byte for byte — a symbolic print is punctuation
   * rather than grammar, and this language has no opinion about it.
   */
  renderExpression: (p) =>
    p.word !== undefined && (p.op === "*" || p.op === "/")
      ? `${p.left} ${p.word} ${BY} ${p.right}`
      : `${p.left} ${p.word ?? p.op} ${p.right}`,
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
    // one | few | many | other. "other" is the fractional category in Russian —
    // "1,5 килограмма", genitive *singular* — and it is also the answer when
    // there is no count at all (ruling R5), which is what makes "loc-other" the
    // key a bare conversion target lands on.
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
});

export default russian;
