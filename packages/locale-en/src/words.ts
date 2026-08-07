import { Decimal } from "@smartput/core";
import { english as en } from "./english";

/**
 * Numbers as they are said: "one hundred and five" read into 105, and 105
 * spelled back out again.
 *
 * Both directions live together because they are one vocabulary, and a
 * vocabulary split across two packages drifts — a word this one learns to
 * read is a word the other has to learn to say.
 *
 * They live in the *language* package rather than beside the `number` kind
 * because English cardinals are English grammar, not a property of what a
 * number is: `@smartput/number` declares a ratio of one and a unit id, and a
 * Ukrainian consumer of that kind has no use for "one hundred and five". This
 * file already read `english.numerals` from here when it lived next door — the
 * table it spells from and the table it reads back are now in one package,
 * which is what stops the two directions drifting apart.
 *
 * `english.spell` is deliberately *not* this module's `spellNumber`: it stays
 * `cardinalSpeller(CARDINALS)`, because the two answer differently for the
 * values `cardinalSpeller` declines, and swapping one for the other would move
 * printed output. Merging them is a separate decision, taken against parity.
 */

export interface NumberWords {
  value: Decimal;
  /** The number as digits, ready to print: "105", "3.5". */
  text: string;
  /** How many of the offered words were claimed, counting from the front. */
  consumed: number;
}

/**
 * Longest cardinal a numeral table can express, matching core's own cap. It
 * bounds the words offered to the numeral parser without ever truncating a
 * real number.
 */
const LONGEST_NUMERAL = 32;

/** Digits after a spoken decimal point: "three point one four" is 3.14. */
const DIGIT_WORDS: Readonly<Record<string, string>> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

/**
 * Read a number off the front of a run of words, or null when the run does not
 * start with one. Digits count as a number too, so "3 point 5" and "three
 * point five" are the same reading.
 *
 * The cardinals themselves are core's numeral parser rather than a second
 * table: "one hundred and five" has to be the same number here as it is in a
 * quantity, and one table cannot drift from itself.
 */
export function numberFromWords(words: readonly string[]): NumberWords | null {
  const first = words[0];
  if (first === undefined) return null;

  const whole = /^\d+(?:\.\d+)?$/.test(first)
    ? { text: first, consumed: 1 }
    : spelled(words);
  if (whole === null) return null;

  const fraction = decimals(words, whole.consumed);
  const text = whole.text + fraction.text;
  return {
    value: new Decimal(text),
    text,
    consumed: whole.consumed + fraction.consumed,
  };
}

function spelled(words: readonly string[]): { text: string; consumed: number } | null {
  const numerals = en.numerals;
  if (numerals === undefined) return null;

  // "twenty-two" is one word to a caller and two cardinals to the table — the
  // hyphen is how English writes the compound, and `spellNumber` writes it
  // that way, so reading it back is this function's problem and no one else's.
  const parts: string[] = [];
  const owner: number[] = [];
  for (const [index, word] of words.slice(0, LONGEST_NUMERAL).entries()) {
    for (const part of word.split("-")) {
      if (part.length === 0) continue;
      parts.push(part);
      owner.push(index);
    }
  }

  const match = numerals(parts);
  if (match === null || match.consumed === 0) return null;

  // A match that stops halfway through a hyphenated word has not read that
  // word, so it does not get to claim it.
  const last = owner[match.consumed - 1] as number;
  const whole = owner[match.consumed] !== last;
  const consumed = whole ? last + 1 : last;
  if (consumed === 0) return null;
  return { text: match.value.toString(), consumed };
}

function decimals(
  words: readonly string[],
  at: number,
): { text: string; consumed: number } {
  if (words[at] !== "point") return { text: "", consumed: 0 };
  let digits = "";
  let i = at + 1;
  while (i < words.length) {
    const word = words[i] as string;
    const digit = DIGIT_WORDS[word] ?? (/^\d$/.test(word) ? word : null);
    if (digit === null) break;
    digits += digit;
    i += 1;
  }
  // A "point" with nothing spellable after it is not a decimal point, so leave
  // it for whoever comes next — which is what reports it.
  if (digits.length === 0) return { text: "", consumed: 0 };
  return { text: `.${digits}`, consumed: i - at };
}

const UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** Largest first, because that is the order the groups are spoken in. */
const SCALES = ["trillion", "billion", "million", "thousand", ""];

/**
 * The one scale word that is not a group of its own: it multiplies inside a
 * group rather than between them. Named rather than written twice, so it
 * cannot go missing from the vocabulary below the way it once did.
 */
const HUNDRED = "hundred";

/** Past a trillion the table runs out, and a wrong word is worse than digits. */
const LIMIT = 1e15;

/**
 * The number in words, or null when it cannot be spelled — too large for the
 * scale words, or not a number at all. A null is the caller's cue to print the
 * digits, which are always right if never conversational.
 *
 * What comes out is what `numberFromWords` reads back, so a number spelled
 * here survives the round trip.
 */
export function spellNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (value < 0) {
    const magnitude = spellNumber(-value);
    return magnitude === null ? null : `negative ${magnitude}`;
  }
  if (value >= LIMIT) return null;
  if (Number.isInteger(value)) return spellInteger(value);

  // A decimal is read digit by digit after the point — "three point one four",
  // never "three point fourteen", which is a different number to a listener.
  const [whole, fraction] = value.toString().split(".");
  if (whole === undefined || fraction === undefined || !/^\d+$/.test(fraction)) {
    return null;
  }
  const digits = [...fraction].map((digit) => UNITS[Number(digit)] as string);
  return `${spellInteger(Number(whole))} point ${digits.join(" ")}`;
}

function spellInteger(value: number): string {
  if (value === 0) return "zero";

  const groups: number[] = [];
  let rest = value;
  for (let i = 0; i < SCALES.length; i += 1) {
    groups.unshift(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const spoken: string[] = [];
  for (const [index, group] of groups.entries()) {
    if (group === 0) continue;
    const scale = SCALES[index] as string;
    // "one million and five": a tail under a hundred is joined to what comes
    // before it, the same way the tail of a hundred is.
    const lead =
      spoken.length > 0 && index === groups.length - 1 && group < 100 ? "and " : "";
    spoken.push(
      lead + (scale === "" ? spellGroup(group) : `${spellGroup(group)} ${scale}`),
    );
  }
  return spoken.join(" ");
}

/** A group of three digits: 1 to 999, which is where the names live. */
function spellGroup(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds === 0) return spellTens(rest);
  const head = `${UNITS[hundreds]} ${HUNDRED}`;
  return rest === 0 ? head : `${head} and ${spellTens(rest)}`;
}

function spellTens(value: number): string {
  if (value < 20) return UNITS[value] as string;
  const tens = TENS[Math.floor(value / 10)] as string;
  const unit = value % 10;
  return unit === 0 ? tens : `${tens}-${UNITS[unit]}`;
}

/**
 * Every word a number can be made of, for a caller that has to recognise one
 * without reading it — spelling correction, a keyboard's word list, a grammar
 * that needs to know which words are numbers. Taken from the same tables
 * `spellNumber` says and `numberFromWords` reads, so the list cannot fall
 * behind either of them.
 */
export const NUMBER_WORDS: readonly string[] = [
  ...UNITS,
  ...TENS.filter((word) => word !== ""),
  ...SCALES.filter((word) => word !== ""),
  HUNDRED,
  "point",
  // The connector inside a cardinal: "one hundred and five" is one number.
  "and",
];
