import { Decimal } from "../decimal";
import type { NumeralParser, NumeralSpeller } from "../types";

/**
 * Japanese cardinals: one table, two directions — the same arrangement
 * `uk-cardinals.ts` makes, for the same reason. `japaneseNumerals` reads these
 * three records to turn 二十二 back into `22`; `japaneseSpeller` reads the very
 * same records to write `22` as 二十二. Neither has a table of its own, so an
 * edit here moves both halves or neither.
 *
 * What Japanese does **not** share with `en` and `uk` is the shape of the
 * helper those two use. `cardinalNumerals`/`cardinalSpeller` (see
 * `locale/helpers.ts`) are built on two assumptions that Japanese breaks, and
 * breaks in a way no amount of extra table rows would repair:
 *
 * 1. **Words are separated by spaces.** A `NumeralParser` is handed the words
 *    of a run, and the shared helper reads one number-word per element. There
 *    is no space anywhere inside 二十二 — it is one orthographic word, and
 *    `Intl.Segmenter` in fact hands it over as *two* (`二十` + `二`, measured,
 *    not assumed; the same input written 千五百 comes back as `千` + `五百`).
 *    A parser for Japanese has to work at the character level and treat the
 *    word boundaries ICU offers as advisory, which is exactly what
 *    `japaneseNumerals` below does: it re-joins the numeral words and parses
 *    the join.
 * 2. **Scales chain in thousands.** `cardinalSpeller`'s own doc comment states
 *    the assumption, and `cardinalNumerals`'s `scale.gte(THOUSAND)` branch
 *    encodes it. Japanese groups in *myriads*: 万 is 10⁴, 億 is 10⁸, 兆 is
 *    10¹², and 100,000 is 十万 ("ten myriad"), not "hundred thousand". Feeding
 *    the shared helper a `scales` table with 万 in it would parse 十万 as
 *    10 × 10⁴ correctly by luck and then spell 100,000 as 一百千 — a string no
 *    Japanese reader would accept — because the speller composes groups of
 *    three. The grouping is the algorithm, not a table entry.
 *
 * So the two functions here are bespoke, and the discipline the shared helper
 * provided by construction is preserved the only other way available: both
 * read these consts and nothing else.
 */

/**
 * The ten digit characters, 0–9.
 *
 * 零 and 〇 are both zero and both are declared, because they are not
 * interchangeable in practice and a reader cannot be asked which one a keyboard
 * produced. 零 is the *word* — the reading "rei", what someone says and what
 * 零度 ("zero degrees") is written with. 〇 (U+3007 IDEOGRAPHIC NUMBER ZERO, not
 * the circle U+25CB it is drawn like) is a *glyph slot*: it appears only inside
 * a positionally-written number such as 二〇二五 for the year 2025, where each
 * character is a decimal place. 零 is declared first, so `japaneseSpeller` —
 * which keeps the first word it finds for a value, the same first-wins rule
 * `cardinalSpeller` documents — writes the word rather than the slot.
 */
export const JA_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/**
 * The three sub-myriad scales, which *multiply* the digit in front of them and
 * *add* to the group being built: 三百四十五 is 3×100 + 4×10 + 5.
 *
 * A bare scale with no digit in front means one — 十 is 10, 百 is 100, 千 is
 * 1000 — and this is the asymmetry that makes the speller's job non-obvious:
 * the same omission is *not* allowed at 万 and above. 10,000 is 一万 and never
 * 万. So `spellGroup` below drops the leading 一 for these three and
 * `japaneseSpeller` keeps it for the myriad scales, which is a rule about
 * Japanese and not a formatting preference.
 *
 * 一千 (rather than 千) is written in careful and financial registers and is
 * read here without complaint — the parser's "digit then scale" path covers it
 * with no extra entry — but is not what the speller produces.
 */
export const JA_SMALL_SCALES: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1_000,
};

/**
 * The myriad scales. Each closes off the group of at most four digits built so
 * far and multiplies it: 二千三百四十五万 is 2345 × 10⁴.
 *
 * 京 (10¹⁶) exists and is deliberately absent. It is the point where Japanese
 * itself stops being read as a number and starts being read as a name for a
 * quantity — nothing this engine measures is expressed in 京 — and every scale
 * declared here widens the ceiling `japaneseSpeller` will attempt, which is a
 * promise about `Decimal` precision that should be made on purpose. 兆 as the
 * largest scale puts the ceiling at 10¹⁶, mirroring `cardinalSpeller`'s "1000 ×
 * the largest declared scale" rule with the myriad factor substituted for the
 * thousand one.
 */
export const JA_MYRIAD_SCALES: Record<string, number> = {
  万: 10_000,
  億: 100_000_000,
  兆: 1_000_000_000_000,
};

const TEN = new Decimal(10);
const MYRIAD = new Decimal(10_000);

const digitValues = new Map(
  Object.entries(JA_DIGITS).map(([ch, v]) => [ch, new Decimal(v)]),
);
const smallScaleValues = new Map(
  Object.entries(JA_SMALL_SCALES).map(([ch, v]) => [ch, new Decimal(v)]),
);
const myriadScaleValues = new Map(
  Object.entries(JA_MYRIAD_SCALES).map(([ch, v]) => [ch, new Decimal(v)]),
);

/** First character wins, so 零 and not 〇 is what `0` spells as. */
const wordFor = (source: Record<string, number>): Map<number, string> => {
  const table = new Map<number, string>();
  for (const [ch, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, ch);
  }
  return table;
};

const digitChars = wordFor(JA_DIGITS);
const smallScaleChars = wordFor(JA_SMALL_SCALES);
// Ascending in the table, descending here: the largest scale at or below a
// magnitude has to be the first one tried, exactly as `cardinalSpeller` sorts
// its own scales.
const myriadDescending = Object.entries(JA_MYRIAD_SCALES)
  .map(([ch, value]) => ({ ch, value: new Decimal(value) }))
  .sort((a, b) => (a.value.gte(b.value) ? -1 : 1));

/** Exclusive: 10⁴ × the largest declared scale, so 兆 tops out at 9999兆. */
const CEILING = (myriadDescending[0]?.value ?? MYRIAD).times(MYRIAD);

const isNumeralChar = (ch: string): boolean =>
  digitValues.has(ch) || smallScaleValues.has(ch) || myriadScaleValues.has(ch);

/**
 * A number written the way a year is: one character per decimal place, 二〇二五
 * for 2025. It is a different system from the additive one below — there are no
 * scale characters in it at all — and the two are told apart by exactly that
 * absence, plus a length of two or more.
 *
 * The length guard is what keeps 五 from being read here: a single digit means
 * the same thing under both readings, and routing it through the additive path
 * keeps one code path responsible for the ordinary case. Two or more digits
 * with no scale between them has no additive reading — 一二 is not a Japanese
 * way of writing 3 — so claiming it positionally takes nothing away.
 */
const parsePositional = (text: string): Decimal | null => {
  const chars = [...text];
  if (chars.length < 2) return null;
  let value = new Decimal(0);
  for (const ch of chars) {
    const digit = digitValues.get(ch);
    if (digit === undefined) return null;
    value = value.times(TEN).plus(digit);
  }
  return value;
};

/**
 * The ordinary reading: digits multiply the scale that follows them, sub-myriad
 * scales accumulate into a group, and a myriad scale closes the group and folds
 * it into the total. 一億二千三百四十五万六千七百八十九 walks through in one pass.
 *
 * `currentSet` and `groupSet` are the same distinction `cardinalNumerals` draws
 * with its own `currentSet`, and they are needed here for the same reason: a
 * bare 十 is 10 (nothing in front means one) while 零十 is 0 (something in front
 * that happens to be zero). Testing `current.isZero()` would collapse those two.
 */
const parseAdditive = (text: string): Decimal | null => {
  let total = new Decimal(0);
  let section = new Decimal(0);
  let current = new Decimal(0);
  let currentSet = false;
  let groupSet = false;
  let claimed = false;

  for (const ch of text) {
    const digit = digitValues.get(ch);
    if (digit !== undefined) {
      // Assignment, not addition: 二 after 三 is not five. Japanese never puts
      // two bare digits side by side in the additive system, so a second one
      // can only be the positional writing, which `parsePositional` has already
      // been offered and declined.
      current = digit;
      currentSet = true;
      claimed = true;
      continue;
    }

    const small = smallScaleValues.get(ch);
    if (small !== undefined) {
      const multiplicand = currentSet ? current : new Decimal(1);
      section = section.plus(multiplicand.times(small));
      current = new Decimal(0);
      currentSet = false;
      groupSet = true;
      claimed = true;
      continue;
    }

    const myriad = myriadScaleValues.get(ch);
    if (myriad !== undefined) {
      const multiplicand =
        groupSet || currentSet ? section.plus(current) : new Decimal(1);
      total = total.plus(multiplicand.times(myriad));
      section = new Decimal(0);
      current = new Decimal(0);
      currentSet = false;
      groupSet = false;
      claimed = true;
      continue;
    }

    return null;
  }

  return claimed ? total.plus(section).plus(current) : null;
};

/** Either reading of one uninterrupted string of numeral characters. */
export const parseJapaneseNumeral = (text: string): Decimal | null =>
  parsePositional(text) ?? parseAdditive(text);

/**
 * The `Language.numerals` for Japanese.
 *
 * The signature is "offered a run of consecutive words, claim a prefix of it",
 * and Japanese is the case that signature was widened for — but sideways.
 * English needs several words because "one thousand thirty two" *is* several
 * words; Japanese needs several because `Intl.Segmenter` cuts inside what is
 * orthographically one word. Measured on this runtime: 二十二 comes back as
 * `二十` + `二`, 千五百 as `千` + `五百`, while 一万 survives whole. There is no
 * rule to those cuts worth modelling, so this joins the maximal run of words
 * made entirely of numeral characters and parses the join as one string.
 *
 * The back-off loop exists because that maximal run can be one word too long —
 * two numbers written next to each other, or a numeral character used as a
 * word rather than a number — and a claim that fails to parse should shorten
 * rather than fail outright. It is bounded by the run, and in practice exits on
 * the first iteration.
 */
export const japaneseNumerals: NumeralParser = (words) => {
  let limit = 0;
  while (limit < words.length) {
    const word = words[limit] ?? "";
    if (word.length === 0 || ![...word].every(isNumeralChar)) break;
    limit += 1;
  }

  for (let count = limit; count > 0; count--) {
    const value = parseJapaneseNumeral(words.slice(0, count).join(""));
    if (value !== null) return { value, consumed: count };
  }
  return null;
};

/**
 * One myriad group, 1–9999, in the sub-myriad scales.
 *
 * The leading 一 is dropped here and only here: 十 for 10, 百 for 100, 千 for
 * 1000, but 二十 for 20 and 三百 for 300. `japaneseSpeller` deliberately does
 * *not* apply the same rule to 万/億/兆, because Japanese does not — 10,000 is
 * 一万. Reading is unaffected either way, since `parseAdditive` accepts 一千 and
 * 千 alike.
 */
const spellGroup = (group: Decimal): string => {
  let remainder = group;
  let out = "";
  // Descending, so 千 is placed before 百 before 十.
  for (const value of [1_000, 100, 10]) {
    const scale = new Decimal(value);
    const digit = remainder.dividedToIntegerBy(scale);
    if (digit.isZero()) continue;
    remainder = remainder.minus(digit.times(scale));
    const scaleChar = smallScaleChars.get(value) ?? "";
    out += digit.equals(1)
      ? scaleChar
      : `${digitChars.get(digit.toNumber()) ?? ""}${scaleChar}`;
  }
  if (!remainder.isZero()) out += digitChars.get(remainder.toNumber()) ?? "";
  return out;
};

/**
 * The `Language.spell` for Japanese, and the inverse of `japaneseNumerals` over
 * the same three consts.
 *
 * Declines in exactly the three cases `cardinalSpeller` documents, each for the
 * reason given there rather than a new one invented for Japanese: a non-integer
 * (these tables contain no fractional grammar — 五分の一 is a *construction*,
 * not a numeral, and nothing here could read it back), a negative magnitude
 * (this engine models a negative quantity as a `UnaryNode` over a non-negative
 * one, so `Printer` never asks), and a magnitude at or above 10⁴ × the largest
 * declared scale, where the group in front of 兆 would itself need a scale one
 * myriad higher to be written at all.
 */
export const japaneseSpeller: NumeralSpeller = (value) => {
  if (value.isNegative()) return null;
  if (!value.isInteger()) return null;
  if (value.gte(CEILING)) return null;
  if (value.isZero()) return digitChars.get(0) ?? null;

  let remainder = value;
  let out = "";
  for (const { ch, value: scale } of myriadDescending) {
    const group = remainder.dividedToIntegerBy(scale);
    if (group.isZero()) continue;
    remainder = remainder.minus(group.times(scale));
    out += `${spellGroup(group)}${ch}`;
  }
  if (!remainder.isZero()) out += spellGroup(remainder);
  return out;
};
