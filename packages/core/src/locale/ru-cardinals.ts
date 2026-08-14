import { Decimal } from "../decimal";
import type { NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/** Named because the speller returns it before it reaches any table at all. */
const ZERO = "ноль";

/**
 * The words with no compositional structure, 0–19, written by value rather than
 * by word — `{ 22: "двадцать два" }` is the direction the *speller* needs, and
 * the parser's `CardinalTables` is derived from these tables further down. One
 * source, two directions: the same property `uk-cardinals.ts` gets from handing
 * one `CardinalTables` object to both shared helpers, reached from the other
 * side because Russian does not use the shared speller (see `russianSpeller`
 * for why).
 */
const UNITS: Readonly<Record<number, string>> = {
  0: ZERO,
  1: "один",
  2: "два",
  3: "три",
  4: "четыре",
  5: "пять",
  6: "шесть",
  7: "семь",
  8: "восемь",
  9: "девять",
  10: "десять",
  11: "одиннадцать",
  12: "двенадцать",
  13: "тринадцать",
  14: "четырнадцать",
  15: "пятнадцать",
  16: "шестнадцать",
  17: "семнадцать",
  18: "восемнадцать",
  19: "девятнадцать",
};

/**
 * The only two numerals Russian inflects for gender, and the reason the speller
 * carries a `feminine` flag at all: "одна тысяча", "две тысячи" against "один
 * миллион", "два миллиона". Three and up are the same word in every gender, so
 * this table has exactly two rows and needs no others.
 */
const FEMININE: Readonly<Record<number, string>> = {
  1: "одна",
  2: "две",
};

const TENS: Readonly<Record<number, string>> = {
  20: "двадцать",
  30: "тридцать",
  40: "сорок",
  50: "пятьдесят",
  60: "шестьдесят",
  70: "семьдесят",
  80: "восемьдесят",
  90: "девяносто",
};

/**
 * The hundreds, 100–900, as whole words that **add** rather than multiply.
 *
 * English composes every one of these from a `units` word and a `hundred`
 * scale — "two hundred", "nine hundred" — and Russian does not: двести is not
 * "два сто", четыреста is not "четыре сто", and пятьсот is a single fused word
 * whose first half is no longer a free numeral. So they are addends here and
 * they land in `CardinalTables.tens`, which `cardinalNumerals` merges with
 * `units` into one flat table of addends with no assumption about their range.
 * "двести пять" then reads exactly the way "двадцать пять" already does.
 *
 * сто sits here too, and *not* in `scales` — which is where `uk-cardinals.ts`
 * put its own сто. Both parse "сто тысяч" correctly (a scale word multiplies by
 * whatever addends precede it, so 100 as an addend followed by тысяч is still
 * 100 000), and putting it here is what lets the speller read one hundreds table
 * for all nine values instead of composing the first one out of a multiplier it
 * would have to invent.
 */
const HUNDREDS: Readonly<Record<number, string>> = {
  100: "сто",
  200: "двести",
  300: "триста",
  400: "четыреста",
  500: "пятьсот",
  600: "шестьсот",
  700: "семьсот",
  800: "восемьсот",
  900: "девятьсот",
};

/**
 * A scale word in the three forms Russian agreement demands of it, plus the
 * gender the multiplier in front of it has to agree with.
 *
 * The three keys are CLDR's `one`/`few`/`many` and are named after them
 * deliberately: `russianSpeller` picks between them with the same
 * `Intl.PluralRules("ru")` instance `ru.ts`'s `selectForm` uses on unit nouns,
 * because "тысяча / тысячи / тысяч" after 1 / 2 / 5 is the very same agreement
 * as "килограмм / килограмма / килограммов" — one rule, applied twice, rather
 * than a second hand-written one that could disagree with the first.
 */
interface Scale {
  readonly value: number;
  /** тысяча is feminine ("одна тысяча"); every larger scale is masculine. */
  readonly feminine: boolean;
  readonly one: string;
  readonly few: string;
  readonly many: string;
}

/** Descending, so the largest scale at or below a magnitude is the first match. */
const SCALES: readonly Scale[] = [
  {
    value: 1_000_000_000_000,
    feminine: false,
    one: "триллион",
    few: "триллиона",
    many: "триллионов",
  },
  {
    value: 1_000_000_000,
    feminine: false,
    one: "миллиард",
    few: "миллиарда",
    many: "миллиардов",
  },
  {
    value: 1_000_000,
    feminine: false,
    one: "миллион",
    few: "миллиона",
    many: "миллионов",
  },
  { value: 1_000, feminine: true, one: "тысяча", few: "тысячи", many: "тысяч" },
];

const byWord = (table: Readonly<Record<number, string>>): Record<string, number> =>
  Object.fromEntries(Object.entries(table).map(([value, word]) => [word, Number(value)]));

/**
 * The reading direction, derived from the tables above rather than retyped
 * beside them — the drift `CardinalTables` exists to prevent, enforced by
 * construction instead of by a comment asking the next editor to keep two lists
 * in step.
 *
 * Three things are added here that the speller never emits, because reading is
 * many-to-one where writing is one:
 *
 * - **Gendered ones and twos.** "одна тонна", "одно ядро", "две тонны" are 1 and
 *   2 as surely as "один"/"два" are. The speller reaches the feminine pair
 *   through `FEMININE` when a feminine scale word follows; a reader may type any
 *   of them anywhere.
 * - **Inflected scale words.** "две тысячи", "пять тысяч", "трёх миллионов" —
 *   the forms a Russian sentence actually contains. All three per scale map to
 *   the same value.
 * - **Nothing else.** In particular there is no `connectors` list. Russian does
 *   not join the parts of a numeral with "и": 105 is "сто пять", never "сто и
 *   пять", and declaring "и" a connector would let the parser swallow the
 *   ordinary conjunction out of "5 кг и 3 кг" the moment a numeral preceded it.
 */
export const CARDINALS: CardinalTables = {
  units: {
    ...byWord(UNITS),
    одна: 1,
    одно: 1,
    две: 2,
  },
  tens: {
    ...byWord(TENS),
    ...byWord(HUNDREDS),
  },
  scales: Object.fromEntries(
    SCALES.flatMap((scale) => [
      [scale.one, scale.value] as const,
      [scale.few, scale.value] as const,
      [scale.many, scale.value] as const,
    ]),
  ),
};

/**
 * The writing direction, hand-written where `en` and `uk` both call the shared
 * `cardinalSpeller` — and hand-written for a reason worth stating, since a
 * shared helper that is not used is a decision, not an omission.
 *
 * `cardinalSpeller` composes a hundreds value as "<multiplier> <hundred word>"
 * and joins it to a remainder with the table's connector. That is English, and
 * it is what `uk` shipped as a known limitation: run its speller and 250 comes
 * back "два сто і п'ятдесят" where Ukrainian says "двісті п'ятдесят". It also
 * has no inflection machinery at all, so 2000 spells as "два тисяча" instead of
 * "дві тисячі". Russian has exactly the same two problems — fused hundreds and a
 * scale word that agrees with its multiplier — and both are structural: no
 * arrangement of the four `CardinalTables` fields fixes them, because the
 * missing information (which numeral is feminine, which scale form goes with
 * which count) has nowhere to live in that shape.
 *
 * So this reads the same five constants the parser's table is derived from and
 * spells them properly: "двести пятьдесят", "одна тысяча пятьсот", "две тысячи",
 * "пять тысяч", "один миллион двести тридцать четыре тысячи пятьсот шестьдесят
 * семь". The three `null` cases are `cardinalSpeller`'s own, unchanged, because
 * they are properties of the tables and not of the algorithm: a non-integer (no
 * word for a decimal point exists anywhere in these tables), a negative (this
 * engine's AST models a negative quantity as a unary node over a non-negative
 * magnitude, so the sign never reaches a speller), and a magnitude at or above
 * 1000 × the largest declared scale, where the multiplier under that scale would
 * itself need a scale one tier higher to be spelled at all.
 */
export function russianSpeller(): NumeralSpeller {
  const plural = new Intl.PluralRules("ru");
  const THOUSAND = new Decimal(1000);
  // Exclusive: see the doc comment's third `null` case.
  const ceiling = new Decimal(SCALES[0]?.value ?? 1000).times(THOUSAND);

  /**
   * 1–999. `feminine` reaches the final word and only the final word, because
   * that is the only place gender surfaces in a Russian numeral: "двести
   * двадцать одна тысяча" inflects the один and leaves двести and двадцать
   * alone.
   *
   * Every lookup is written as "take it if the table has it" rather than as an
   * arithmetic guard, because the tables are complete over the ranges the
   * arithmetic can produce and a missing hundreds word means the value had no
   * hundreds — `HUNDREDS[0]` is absent, so the zero case falls out instead of
   * being tested for.
   */
  const spellUnderThousand = (n: number, feminine: boolean): string => {
    const words: string[] = [];
    const hundreds = HUNDREDS[Math.floor(n / 100) * 100];
    if (hundreds !== undefined) words.push(hundreds);

    let rest = n % 100;
    // The teens are single words in `UNITS`, so a tens word is taken only from
    // 20 up — "двадцать пять", but "пятнадцать" and never "десять пять".
    if (rest >= 20) {
      const tens = TENS[Math.floor(rest / 10) * 10];
      if (tens !== undefined) words.push(tens);
      rest %= 10;
    }
    const unit = (feminine ? FEMININE[rest] : undefined) ?? UNITS[rest];
    if (rest > 0 && unit !== undefined) words.push(unit);
    return words.join(" ");
  };

  const agree = (multiplier: Decimal, scale: Scale): string => {
    // `other` is unreachable for an integer — CLDR gives it to Russian only for
    // fractional counts, and a multiplier here is always whole — but mapping it
    // to `many` beside the genuine `many` costs nothing and keeps this total.
    switch (plural.select(multiplier.toNumber())) {
      case "one":
        return scale.one;
      case "few":
        return scale.few;
      default:
        return scale.many;
    }
  };

  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(ceiling)) return null;
    if (value.isZero()) return ZERO;

    const words: string[] = [];
    let rest = value;
    for (const scale of SCALES) {
      const size = new Decimal(scale.value);
      if (rest.lt(size)) continue;
      // Always under 1000: the scales descend in thousands and `ceiling` bounds
      // the largest one, so each group is a three-digit number.
      const multiplier = rest.dividedToIntegerBy(size);
      rest = rest.minus(multiplier.times(size));
      words.push(spellUnderThousand(multiplier.toNumber(), scale.feminine));
      words.push(agree(multiplier, scale));
    }
    // The last group has no scale word after it, so `FEMININE` has nothing to
    // key off and it is spelled masculine.
    //
    // **That is a known defect and not a neutral default**, worth stating here
    // rather than leaving to be discovered: the word this group agrees with is
    // the *unit noun*, and half the unit nouns in this repo are feminine. So a
    // spelled print reads "один килограмм" correctly and "один тонна",
    // "два мили", "один минута" incorrectly — Russian wants "одна тонна",
    // "две мили", "одна минута".
    //
    // It cannot be fixed from inside this file, and the fix is not the
    // vocabulary's either. `NumeralSpeller` is `(value) => string | null`: the
    // gender of the noun the numeral will stand in front of is not one of its
    // arguments, and a `Vocabulary` records no gender for the engine to pass.
    // Closing it means a second argument on a core type that every language in
    // the repo implements, which is a change to the language contract rather
    // than to Russian. `uk` and `pl` print the same disagreement from the same
    // cause ("один тонна", "jeden tona"), so this is the shape of the contract
    // showing through and not something Russian does differently.
    //
    // The blast radius is exactly `Printer`'s `spelled` option — `evaluate`
    // never spells a numeral, so nothing in the ordinary path prints this.
    if (!rest.isZero()) words.push(spellUnderThousand(rest.toNumber(), false));
    return words.join(" ");
  };
}
