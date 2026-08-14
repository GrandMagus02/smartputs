import { Decimal } from "../decimal";
import type { NumeralParser, NumeralSpeller } from "../types";

/**
 * A scale noun and the three shapes it takes after a multiplier.
 *
 * Polish scale nouns are ordinary masculine nouns and agree with the number in
 * front of them, which is the same three-way split `Intl.PluralRules("pl")`
 * reports for every other Polish noun: `tysiąc` after one, `tysiące` after a
 * multiplier the rules call `few` (2–4, bar the 12–14 band), `tysięcy` after
 * everything else. So 2,000 is "dwa tysiące", 5,000 is "pięć tysięcy" and
 * 21,000 is "dwadzieścia jeden tysięcy" — *many*, because Polish counts 21 by
 * its final 1 the way it counts 5, which is the exact point where Ukrainian
 * (where 21 agrees like 1) goes the other way.
 *
 * The fields are named after the CLDR categories rather than after the cases
 * they happen to be, because that is how the speller indexes them: it asks
 * `Intl.PluralRules("pl")` for the multiplier's category and reads the field of
 * that name. Hand-deriving the 2–4/12–14 rule beside CLDR's copy of it would be
 * a second answer to a question that already has one.
 */
export interface PolishScale {
  /** After a multiplier of exactly one — where the "jeden" itself is dropped. */
  readonly one: string;
  /** After 2–4 and their compounds: "dwa tysiące", "dwadzieścia dwa tysiące". */
  readonly few: string;
  /** After everything else: "pięć tysięcy", "dwanaście tysięcy". */
  readonly many: string;
  readonly value: number;
}

/**
 * Polish cardinals: one table, two directions, the arrangement `uk-cardinals.ts`
 * and `de-cardinals.ts` both use and for the same reason — `polishNumerals`
 * reads the tables below to parse "dwadzieścia dwa" back to `22`, and
 * `polishSpeller` reads the very same objects to spell `22` as "dwadzieścia
 * dwa". Two separately maintained copies drift the first time a word is
 * corrected in one of them.
 *
 * **Why not the shared `cardinalNumerals`/`cardinalSpeller`.** The *parser* half
 * would have been fine: Polish spaces its numerals ("dwadzieścia dwa", "dwa
 * tysiące pięćset"), so it fits the run-of-words model that German famously does
 * not. The speller half is where it breaks, in two places that `CardinalTables`
 * has no shape to express:
 *
 * - **The hundreds are fused words that add, not multiply.** `dwieście` is not
 *   "dwa sto" and `pięćset` is one word whose first half is no longer a free
 *   numeral. Ukrainian has the same fact and handles it by declaring 200–900 in
 *   its `tens` table, which makes them read correctly — and then
 *   `cardinalSpeller` still writes 234 as "dwa sto trzydzieści cztery", because
 *   its sub-thousand branch composes a multiplier with the `hundred` scale word
 *   and only consults the whole-value table for an exact match. A separate
 *   `hundreds` table, summed as a third part, is what writes "dwieście
 *   trzydzieści cztery".
 * - **The scale nouns agree with their multiplier.** `cardinalSpeller` has no
 *   agreement machinery — `uk-cardinals.ts` documents this about itself, and
 *   `uk.test.ts` pins the resulting "два тисяча" as a known limitation rather
 *   than as correct Ukrainian. Polish declines to ship the same defect, so a
 *   scale here carries three forms and the speller selects between them.
 *
 * **`bilion` is 10¹², not 10⁹.** Polish follows the long scale as German does:
 * `miliard` is the 10⁹ English calls a billion, and `bilion` is a thousand
 * times that. It is the single likeliest error in a Polish numeral table, so the
 * values are written with separators below and the pairing is asserted in
 * `pl.test.ts` rather than left to a reader's trust.
 *
 * **No ASCII fallbacks for the diacritics**, and that is a decision rather than
 * an omission. Nearly every word below carries one — `pięć`, `sześć`,
 * `dwadzieścia`, `tysiąc` — so declaring stripped spellings would roughly double
 * the table, and one of them (`piec`, an oven) is an ordinary Polish noun that
 * would then be claimed as the number five every time it stood in front of a
 * unit. A numeral is claimed by this parser before the alias index is consulted
 * and never reaches the fuzzy-correction pass, so the cost of leaving them out
 * is bounded and local: a numeral typed without diacritics is simply not
 * claimed, and the digits it could have been written as still parse.
 */
export interface PolishCardinalTables {
  /**
   * 0–19, plus the gender variants of 1 and 2.
   *
   * 10–19 are listed rather than composed because they are not the sum of their
   * parts in any usable way: `jedenaście` is a fused "one-on-ten" whose first
   * element is not `jeden`, and `dziewiętnaście` has lost the `ć` of `dziewięć`.
   *
   * `jedna`/`jedno` and `dwie` are the feminine and neuter agreements a Polish
   * sentence actually contains ("jedna tona", "dwie godziny"). They are extra
   * keys on a value the speller cannot choose, so each is declared *after* the
   * masculine form — first word for a value wins — and that is a **read-only
   * asymmetry, not a proof that the masculine is always right**.
   *
   * It is right for the scale nouns, which are the only agreement this file's
   * speller performs: `tysiąc`, `milion`, `miliard` and `bilion` are all
   * masculine, so "dwa tysiące" is correct and `spellScales` never has to ask.
   * It is **wrong in front of a unit noun**, and `Printer`'s spelled mode puts
   * it there: a `Vocabulary` may name a feminine unit, so 1 h spells "jeden
   * godzina" for "jedna godzina" and 2 t spells "dwa tony" for "dwie tony". The
   * same two counts are the whole of the damage — 5 and up take the genitive
   * plural, where `pięć` is invariant, and 21 leaves its `jeden` uninflected in
   * "dwadzieścia jeden godzin" — but at 1, 2, 22, 102 the output is a numeral
   * disagreeing with its noun.
   *
   * There is no fix at this layer, and that is why the limitation is recorded
   * rather than worked around. `NumeralSpeller` is `(value) => string | null`:
   * it is handed a magnitude and nothing else, so it cannot know which noun the
   * word will land in front of, and the gender it would need is a property of a
   * `Vocabulary` entry that this file must never see — a language holds no word
   * for any unit, which is the whole shape of the model. Widening the signature
   * to carry a kind and a unit is a core-wide change every language would have
   * to answer, so it belongs to a phase of its own. `renderQuantity` is not the
   * back door either: it receives the *selected* form, and while a nominative
   * singular in -a does identify a feminine noun, a nominative plural in -y does
   * not — `kilogramy` and `tony` are the same ending in two genders — so the
   * count that most needs the correction is exactly the one it cannot make.
   *
   * `uk-cardinals.ts` records the identical defect for the identical reason
   * ("два тонни", "один година"), so this is the shared cost of the current
   * signature rather than something Polish does worse. `pl.test.ts` pins both
   * spellings, so the day a gender-aware speller lands the assertions fail
   * instead of the strings quietly changing under a green suite.
   *
   * The oblique declension — `dwóch`, `pięciu`, `dwudziestu` — is deliberately
   * not declared. Those forms appear only inside a prepositional phrase ("w
   * dwóch kilogramach"), which is a sentence about a quantity rather than a
   * quantity to be read, and each would be one more key on a value that must
   * still spell back as the nominative.
   */
  readonly ones: Record<string, number>;
  /** 20–90. Whole values that add; nothing here multiplies anything. */
  readonly tens: Record<string, number>;
  /**
   * 100–900. A table of their own rather than entries in `tens`, because a
   * Polish number under a thousand is a sum of up to three of these words —
   * "dwieście trzydzieści cztery" — and only a third table lets the speller
   * write all three parts. `sto` is here and not among the scales: in "sto
   * tysięcy" it is the addend 100 standing before the multiplier `tysięcy`, not
   * a multiplier itself.
   */
  readonly hundreds: Record<string, number>;
  /** The free scale nouns, ascending. Each multiplies the group before it. */
  readonly scales: readonly PolishScale[];
}

export const CARDINALS: PolishCardinalTables = {
  ones: {
    zero: 0,
    jeden: 1,
    jedna: 1,
    jedno: 1,
    dwa: 2,
    dwie: 2,
    trzy: 3,
    cztery: 4,
    pięć: 5,
    sześć: 6,
    siedem: 7,
    osiem: 8,
    dziewięć: 9,
    dziesięć: 10,
    jedenaście: 11,
    dwanaście: 12,
    trzynaście: 13,
    czternaście: 14,
    piętnaście: 15,
    szesnaście: 16,
    siedemnaście: 17,
    osiemnaście: 18,
    dziewiętnaście: 19,
  },
  tens: {
    dwadzieścia: 20,
    trzydzieści: 30,
    czterdzieści: 40,
    pięćdziesiąt: 50,
    sześćdziesiąt: 60,
    siedemdziesiąt: 70,
    osiemdziesiąt: 80,
    dziewięćdziesiąt: 90,
  },
  hundreds: {
    sto: 100,
    dwieście: 200,
    trzysta: 300,
    czterysta: 400,
    pięćset: 500,
    sześćset: 600,
    siedemset: 700,
    osiemset: 800,
    dziewięćset: 900,
  },
  scales: [
    { one: "tysiąc", few: "tysiące", many: "tysięcy", value: 1_000 },
    { one: "milion", few: "miliony", many: "milionów", value: 1_000_000 },
    { one: "miliard", few: "miliardy", many: "miliardów", value: 1_000_000_000 },
    { one: "bilion", few: "biliony", many: "bilionów", value: 1_000_000_000_000 },
  ],
};

/**
 * The three-way agreement, taken from CLDR rather than rewritten. `select` is
 * asked about an integer multiplier, so it can only ever answer `one`, `few` or
 * `many` — the fourth category, `other`, is Polish's *fractional* one and no
 * multiplier of a scale noun is a fraction.
 */
const plural = new Intl.PluralRules("pl");

const lookup = (table: Record<string, number>) =>
  new Map(Object.entries(table).map(([word, value]) => [word.toLowerCase(), value]));

/**
 * `ones`, `tens` and `hundreds` flattened into one map, because on the way *in*
 * they behave identically: each is a whole value that adds to the group being
 * built. The three tables stay apart for the way *out*, where the speller has to
 * know which of the three parts it is writing.
 */
const ADDENDS = new Map<string, number>([
  ...lookup(CARDINALS.ones),
  ...lookup(CARDINALS.tens),
  ...lookup(CARDINALS.hundreds),
]);

const SCALE_WORDS = new Map<string, number>();
for (const scale of CARDINALS.scales) {
  for (const form of [scale.one, scale.few, scale.many]) {
    SCALE_WORDS.set(form.toLowerCase(), scale.value);
  }
}

/**
 * A run of words, claimed from the front.
 *
 * The shape is `cardinalNumerals`'s — addends accumulate into a group, a scale
 * word multiplies that group out into the running total — with two Polish
 * differences. Every scale word here is at least a thousand, so there is no
 * `hundred`-style branch that multiplies *into* the group; and no connector is
 * declared, because Polish has none. English writes "two hundred and five";
 * Polish writes "dwieście pięć" with nothing between the parts, and the obvious
 * candidate `i` is a plain conjunction — claiming it would let "5 i 3" swallow
 * the "i" and read as 8.
 */
export function polishNumerals(): NumeralParser {
  return (words) => {
    let total = new Decimal(0);
    let group = 0;
    // Distinct from `group !== 0` so a bare "tysiąc" multiplies 1 while "zero
    // tysięcy" still reads as 0.
    let groupSet = false;
    let claimed = false;
    // The prefix length at the last accepting state, exactly as
    // `cardinalNumerals` tracks it.
    let consumed = 0;

    for (const [index, raw] of words.entries()) {
      const word = raw.toLowerCase();

      const addend = ADDENDS.get(word);
      if (addend !== undefined) {
        group += addend;
        groupSet = true;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      const scale = SCALE_WORDS.get(word);
      if (scale !== undefined) {
        total = total.plus(new Decimal(groupSet ? group : 1).times(scale));
        group = 0;
        groupSet = false;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      break;
    }

    // `total` and `group` only ever advance on an accepting word, so their sum
    // already describes the prefix `consumed` points at.
    return claimed ? { value: total.plus(group), consumed } : null;
  };
}

/** First word for a value wins, so a value with two spellings spells one way. */
const byValue = (table: Record<string, number>): Map<number, string> => {
  const out = new Map<number, string>();
  for (const [word, value] of Object.entries(table)) {
    if (!out.has(value)) out.set(value, word);
  }
  return out;
};

const ONES_BY_VALUE = byValue(CARDINALS.ones);
const TENS_BY_VALUE = byValue(CARDINALS.tens);
const HUNDREDS_BY_VALUE = byValue(CARDINALS.hundreds);
const ZERO_WORD = ONES_BY_VALUE.get(0);

/**
 * 1–999, as up to three space-separated parts: a hundreds word, a tens word and
 * a ones word, each omitted when its digit is zero. "dwieście trzydzieści
 * cztery", "sto pięć", "czterdzieści".
 *
 * 10–19 short-circuit the tens/ones split, because they are single words and
 * `dwanaście` is not "dziesięć dwa".
 */
function spellUnder1000(n: number): string | null {
  const parts: string[] = [];

  const hundreds = Math.floor(n / 100) * 100;
  if (hundreds > 0) {
    const word = HUNDREDS_BY_VALUE.get(hundreds);
    if (word === undefined) return null;
    parts.push(word);
  }

  const rest = n % 100;
  if (rest > 0) {
    const direct = ONES_BY_VALUE.get(rest);
    if (direct !== undefined) {
      parts.push(direct);
    } else {
      const tens = Math.floor(rest / 10) * 10;
      const tensWord = TENS_BY_VALUE.get(tens);
      if (tensWord === undefined) return null;
      parts.push(tensWord);
      const ones = rest % 10;
      if (ones > 0) {
        const onesWord = ONES_BY_VALUE.get(ones);
        if (onesWord === undefined) return null;
        parts.push(onesWord);
      }
    }
  }

  return parts.length === 0 ? null : parts.join(" ");
}

const THOUSAND = new Decimal(1000);
const BIGGEST = CARDINALS.scales[CARDINALS.scales.length - 1];
/** Exclusive, and the same reasoning `cardinalSpeller` gives for its own. */
const CEILING = new Decimal(BIGGEST?.value ?? 1).times(THOUSAND);
// Descending, so the largest scale at or below a magnitude is the first match.
const DESCENDING = [...CARDINALS.scales].sort((a, b) => b.value - a.value);

function spellScales(n: Decimal): string | null {
  for (const scale of DESCENDING) {
    if (n.lt(scale.value)) continue;
    const multiple = n.dividedToIntegerBy(scale.value);
    const remainder = n.minus(multiple.times(scale.value));
    const m = multiple.toNumber();

    // "tysiąc", never "jeden tysiąc": Polish drops the multiplier one in front
    // of a scale noun the way English drops it in "a thousand". Every larger
    // multiplier is written, and picks the noun's form by CLDR category.
    const category = plural.select(m);
    const noun =
      category === "one" ? scale.one : category === "few" ? scale.few : scale.many;
    const head = m === 1 ? "" : spellUnder1000(m);
    if (head === null) return null;
    const named = head === "" ? noun : `${head} ${noun}`;

    if (remainder.isZero()) return named;
    const tail = spellScales(remainder);
    return tail === null ? null : `${named} ${tail}`;
  }
  return spellUnder1000(n.toNumber());
}

/**
 * The inverse of `polishNumerals`, over the same tables. Declines on the same
 * three cases `cardinalSpeller` documents, for the same reasons: a non-integer
 * (these tables have no fractional grammar — there is no word for a decimal
 * comma anywhere in them), a negative magnitude (the AST models a sign as a
 * `UnaryNode` and never as part of the number), and anything at or above 1000 ×
 * the largest declared scale — a Polish `biliard` (10¹⁵) is a real word and is
 * not in the table, so composing "tysiąc bilionów" for it would be inventing a
 * spelling out of a word that is not there.
 */
export function polishSpeller(): NumeralSpeller {
  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return ZERO_WORD ?? null;
    return spellScales(value);
  };
}
