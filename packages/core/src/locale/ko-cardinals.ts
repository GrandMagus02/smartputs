import { Decimal } from "../decimal";
import type { NumeralMatch, NumeralParser, NumeralSpeller } from "../types";

/**
 * Korean cardinals: one table, two directions — the arrangement
 * `uk-cardinals.ts` established and `ja-cardinals.ts` repeated, for the reason
 * both give. `koreanNumerals` reads the three consts below to turn 이십이 back
 * into `22`; `koreanSpeller` reads the very same consts to write `22` as 이십이.
 * Neither keeps a table of its own, so an edit here moves both halves or
 * neither.
 *
 * **These are the Sino-Korean numerals, and that is a choice about which of two
 * live systems a unit takes.** Korean counts with two complete sets of numbers.
 * The native set (하나, 둘, 셋, 넷, 다섯 …) counts people, hours, animals and
 * objects, and it is the wrong one here on three separate grounds: it stops
 * dead at 아흔아홉 and borrows Sino-Korean for everything above (there is no
 * native word for a hundred at all), it *changes shape* in front of the noun it
 * counts — 하나 becomes 한, 둘 becomes 두, 셋 becomes 세 — so a table of it
 * could not be read in the writing direction without a second column, and it
 * pairs only with native counters (개, 명, 시), never with a measurement unit.
 * Every unit this engine knows takes Sino-Korean: 오 킬로그램, 십 미터, 삼백 원.
 * So the native set is deliberately absent rather than forgotten, and adding it
 * would be a change to this file's shape and not a few more rows.
 *
 * **Why not `cardinalNumerals`/`cardinalSpeller`.** The shared helpers in
 * `locale/helpers.ts` rest on two assumptions Korean breaks, and it breaks them
 * the same way Japanese and Chinese do:
 *
 * 1. **One number-word per element of the run.** The shared fold reads *words*,
 *    and 이십이 is one word — measured, not assumed: `Intl.Segmenter("ko")`
 *    returns 이십이 and 일억이천삼백사십오만육천칠백팔십구 whole (`ko.test.ts`
 *    pins both), because ICU has no dictionary segmentation for Korean and
 *    breaks it at spaces alone. The atoms here are single syllable blocks and
 *    the composition is positional inside a word, so the reader below walks
 *    codepoints.
 * 2. **Scales chain in thousands.** `cardinalNumerals` encodes that in its
 *    `scale.gte(THOUSAND)` branch and `cardinalSpeller` derives its ceiling
 *    from it. Korean climbs in myriads above 천: 만 is 10⁴, 억 is 10⁸, 조 is
 *    10¹², and 100,000 is 십만 ("ten myriad") rather than a hundred thousand.
 *
 * And one thing Korean does that neither neighbour does, which is why this file
 * is not `ja-cardinals.ts` with the characters swapped: **it elides the 일 in
 * front of every sub-myriad scale, everywhere and not only at the head.** 1,111
 * is 천백십일 — not 일천일백일십일, which is the cheque register — where
 * Japanese writes 千百十一 with the same elision but Chinese writes 一千一百一十一
 * with the elision only on a leading ten. The rule is in `spellGroup` below and
 * it is a rule about Korean, not a formatting preference.
 */

/**
 * The ten digits.
 *
 * Two spellings of zero, and they are not interchangeable. 영 is the *word* —
 * what a magnitude of nothing is called, and what 영하 ("below zero") is written
 * with. 공 is the *read-aloud digit*, the 0 in a phone number or a room number
 * (공일공 for 010), and it never answers "how many". 영 is declared first, so
 * `koreanSpeller` — which keeps the first character it finds for a value, the
 * first-wins rule `cardinalSpeller` states for itself — writes the word and
 * never the digit.
 *
 * What the 공 row buys is narrower than that description suggests, and it is
 * worth stating so the next reader does not assume more: `read` refuses two bare
 * digits in a row, so 공일공 is emphatically *not* claimed as 010 (its own
 * refusal is documented on `read` below). The row reaches exactly one surface —
 * a lone 공 standing where a magnitude belongs — and it is kept at that price
 * because the price is bounded in a way an alias's would not be. 공 is also an
 * everyday noun, a ball and a merit, and `foldNumerals` rewrites a whole word
 * token: so the noun is misread only where it stands alone beside a quantity,
 * which is an input with no reading either way.
 *
 * 륙 is 6 for reading only. South Korean orthography applies 두음법칙 (the
 * initial-sound law) and writes 六 as 육 in every position a numeral occupies —
 * 육십, 십육, 육백 — so 육 is what the speller must produce. 륙 survives in
 * fixed compounds (오륙도) and is the North Korean spelling throughout, and a
 * reader has no way to know which orthography produced the text it was handed.
 */
export const KO_DIGITS: Record<string, number> = {
  영: 0,
  공: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  륙: 6,
  칠: 7,
  팔: 8,
  구: 9,
};

/**
 * The three sub-myriad scales. Each multiplies the digit in front of it and
 * adds into the group being built: 삼백사십오 is 3×100 + 4×10 + 5.
 *
 * A bare scale means one — 십 is 10, 백 is 100, 천 is 1000 — and unlike
 * Japanese, Korean means it at *every* position rather than only at the head of
 * the number: 백십오 is 115 and 천백 is 1,100. That asymmetry is the whole
 * content of `spellGroup`'s elision rule below.
 */
export const KO_SMALL_SCALES: Record<string, number> = {
  십: 10,
  백: 100,
  천: 1_000,
};

/**
 * The myriad scales. Each closes off the group of at most four digits built so
 * far and multiplies it: 이천삼백사십오만 is 2345 × 10⁴.
 *
 * 경 (10¹⁶) exists, is real Korean, and is deliberately absent for the reason
 * `ja-cardinals.ts` gives about 京: every scale declared here widens the
 * ceiling the speller will attempt, which is a promise about `Decimal`
 * precision that should be made on purpose rather than inherited from a table
 * row. 조 as the largest scale puts the ceiling at 10¹⁶ — `cardinalSpeller`'s
 * "1000 × the largest declared scale" rule with the myriad factor substituted
 * for the thousand one.
 */
export const KO_LARGE_SCALES: Record<string, number> = {
  만: 10_000,
  억: 100_000_000,
  조: 1_000_000_000_000,
};

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const MYRIAD = 10_000;

const digitValues = new Map(Object.entries(KO_DIGITS));
const smallScaleValues = new Map(Object.entries(KO_SMALL_SCALES));
const largeScaleValues = new Map(Object.entries(KO_LARGE_SCALES));

/** First character declared for a value wins, so `0` spells 영 and never 공. */
const charFor = (source: Record<string, number>): Map<number, string> => {
  const table = new Map<number, string>();
  for (const [ch, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, ch);
  }
  return table;
};

const digitChars = charFor(KO_DIGITS);
const smallScaleChars = charFor(KO_SMALL_SCALES);
/**
 * Ascending in the table, descending here: the largest scale at or below a
 * magnitude has to be the first one tried, exactly as `cardinalSpeller` sorts
 * its own scales.
 */
const largeDescending = Object.entries(KO_LARGE_SCALES)
  .map(([ch, value]) => ({ ch, value: new Decimal(value) }))
  .sort((a, b) => (a.value.gte(b.value) ? -1 : 1));

/** Exclusive: 10⁴ × the largest declared scale, so 조 tops out at 9999조. */
const CEILING = (largeDescending[0]?.value ?? new Decimal(MYRIAD)).times(MYRIAD);

const NUMERAL_CHARS = new Set([
  ...Object.keys(KO_DIGITS),
  ...Object.keys(KO_SMALL_SCALES),
  ...Object.keys(KO_LARGE_SCALES),
]);

/**
 * Read one uninterrupted string of numeral syllables, or `null` when it is not
 * a well-formed Korean numeral.
 *
 * The shape of the algorithm is the shape of the writing system: a digit sets
 * the pending multiplier, a sub-myriad scale folds that multiplier into the
 * group being built, and a myriad scale closes the group into the running
 * total. Three refusals matter, and each of them is what keeps this from
 * claiming a word that merely happens to be spelled out of these syllables:
 *
 * - **Two digits in a row.** 이이 is not 22 in any register. Korean has no
 *   positional numeral writing — there is no Hangul equivalent of the Japanese
 *   二〇二五 for a year, which is why this reader has no second `parsePositional`
 *   pass the way `ja-cardinals.ts` does — so a bare digit pair is a
 *   read-aloud digit string (공일공) and reading it as a quantity would
 *   silently claim it.
 * - **A sub-myriad scale that does not descend.** 십백 is not a number. Inside
 *   a group the scales run strictly downward (천, then 백, then 십), which is
 *   what makes 삼천오백 unambiguous, and a myriad scale resets the ladder so
 *   이천만삼백 goes on reading after 만.
 * - **A bare myriad scale anywhere but the head.** 만 alone is 10,000 for the
 *   same reason 십 alone is 10, but 억조 and 만억 are not Korean, so a second
 *   myriad scale with nothing of its own in front of it refuses rather than
 *   quietly gaining a factor nobody wrote.
 */
function read(text: string): Decimal | null {
  if (text.length === 0) return null;

  let total = ZERO;
  /** The group under construction, below the next myriad scale. */
  let section = ZERO;
  let digit: number | undefined;
  /** The last sub-myriad scale folded in, so the next one must be smaller. */
  let lastSmall = Number.POSITIVE_INFINITY;
  /** Distinct from `section.isZero()`, so 영십 is 0 while 십 is 10. */
  let groupSet = false;
  let claimed = false;

  for (const ch of text) {
    const value = digitValues.get(ch);
    if (value !== undefined) {
      if (digit !== undefined) return null;
      digit = value;
      claimed = true;
      continue;
    }

    const small = smallScaleValues.get(ch);
    if (small !== undefined) {
      if (small >= lastSmall) return null;
      section = section.plus((digit ?? 1) * small);
      digit = undefined;
      lastSmall = small;
      groupSet = true;
      claimed = true;
      continue;
    }

    const large = largeScaleValues.get(ch);
    if (large === undefined) return null;
    const written = groupSet || digit !== undefined;
    let part = section.plus(digit ?? 0);
    if (!written) {
      if (!total.isZero()) return null;
      part = ONE;
    }
    total = total.plus(part.times(large));
    section = ZERO;
    digit = undefined;
    lastSmall = Number.POSITIVE_INFINITY;
    groupSet = false;
    claimed = true;
  }

  return claimed ? total.plus(section).plus(digit ?? 0) : null;
}

/** Exported so `ko.test.ts` can pin the reader's refusals without a run around them. */
export const parseKoreanNumeral = read;

/**
 * The `Language.numerals` for Korean.
 *
 * `NumeralParser` claims a prefix of a run of *words*, and a Korean numeral is
 * normally one word — ICU keeps 이십이 whole. So why walk the run at all? Because
 * the orthography spaces long numbers, and spaces it at exactly the myriad
 * boundaries this reader closes groups on: 한글 맞춤법 §44 writes 123,456,789 as
 * 일억 이천삼백사십오만 육천칠백팔십구, three words for one number, and that is
 * also what `koreanSpeller` below produces. Joining the maximal run of words
 * made of nothing but numeral syllables and re-reading the join at every length
 * is what lets the two halves round-trip: 일억 and 이천삼백사십오만 and
 * 육천칠백팔십구 are three numbers apart and one number together.
 *
 * The scan stops at the first word the reader refuses, keeping the longest
 * prefix that parsed — the same structure `chineseNumerals` uses, and for the
 * same reason: a numeral character used as a word rather than as a number
 * should end the claim, not fail it.
 */
export const koreanNumerals: NumeralParser = (words) => {
  let best: NumeralMatch | null = null;
  let joined = "";

  for (const [index, word] of words.entries()) {
    if (word.length === 0) break;
    if (![...word].every((ch) => NUMERAL_CHARS.has(ch))) break;
    joined += word;
    const value = read(joined);
    if (value === null) break;
    best = { value, consumed: index + 1 };
  }

  return best;
};

/**
 * One myriad group, 1–9999, in the sub-myriad scales.
 *
 * The 일 is dropped in front of all three of 천, 백 and 십, wherever they fall:
 * 1,111 is 천백십일. This is the rule Korean does not share with either
 * neighbour — Chinese writes 一千一百一十一 and elides only a leading ten,
 * Japanese elides at all three but then writes 一万 where Korean writes 만 — and
 * it is why this file could not be either of theirs with the characters
 * swapped. Reading is unaffected: `read` accepts 일천 and 천 alike, since a
 * digit in front of a scale is exactly the multiplier path.
 */
const spellGroup = (group: Decimal): string => {
  let remainder = group.toNumber();
  let out = "";
  // Descending, so 천 is placed before 백 before 십.
  for (const place of [1_000, 100, 10]) {
    const digit = Math.floor(remainder / place);
    if (digit === 0) continue;
    remainder -= digit * place;
    const scaleChar = smallScaleChars.get(place) ?? "";
    out += digit === 1 ? scaleChar : `${digitChars.get(digit) ?? ""}${scaleChar}`;
  }
  if (remainder !== 0) out += digitChars.get(remainder) ?? "";
  return out;
};

/**
 * The `Language.spell` for Korean, and the inverse of `koreanNumerals` over the
 * same three consts.
 *
 * Two conventions are settled here, both of them rules of the language rather
 * than of this engine:
 *
 * **The 일 in front of 만 is dropped only when 만 opens the number.** 10,000 is
 * 만 (만 원 is what a ten-thousand-won note is called; 일만 원 is the cheque
 * register), and 15,000 is 만 오천 — but 100,010,000 is 일억 일만, where the
 * same group of one is written out because something precedes it. 억 and 조
 * never drop it at all: 10⁸ is 일억 and 10¹² is 일조, never 억 and 조 standing
 * alone. Reading is indifferent — `read`'s bare-scale path accepts 만 and 일만
 * equally — so this is purely which of two readable spellings to write.
 *
 * **Groups are separated by a space, at the myriad boundary.** 한글 맞춤법 §44:
 * "수를 적을 적에는 만(萬) 단위로 띄어 쓴다". So the output here is
 * 일억 이천삼백사십오만 육천칠백팔십구, not one 17-syllable run. `koreanNumerals`
 * above joins the words back, so the round trip holds; the unspaced spelling
 * that a casual writer produces reads back just as well, since it is the same
 * syllables with one fewer break in them.
 *
 * Declines in exactly the three cases `cardinalSpeller` documents, for the
 * reasons given there rather than new ones: a non-integer (these tables have no
 * fractional grammar — 오분의 일 is a *construction* and nothing here could
 * read it back), a negative magnitude (the AST models a negative quantity as a
 * `UnaryNode` over a non-negative one, so `Printer` never asks), and a value at
 * or above 10⁴ × the largest declared scale, where the group in front of 조
 * would itself need 경 to be written at all.
 */
export const koreanSpeller: NumeralSpeller = (value) => {
  if (value.isNegative()) return null;
  if (!value.isInteger()) return null;
  if (value.gte(CEILING)) return null;
  if (value.isZero()) return digitChars.get(0) ?? null;

  const parts: string[] = [];
  let remainder = value;
  for (const { ch, value: scale } of largeDescending) {
    const group = remainder.dividedToIntegerBy(scale);
    if (group.isZero()) continue;
    remainder = remainder.minus(group.times(scale));
    // The one elision above the group level: a leading 만 with a group of one.
    const bare = group.equals(1) && scale.equals(MYRIAD) && parts.length === 0;
    parts.push(bare ? ch : `${spellGroup(group)}${ch}`);
  }
  if (!remainder.isZero()) parts.push(spellGroup(remainder));
  return parts.join(" ");
};
