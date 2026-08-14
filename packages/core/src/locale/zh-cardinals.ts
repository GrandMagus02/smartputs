import { Decimal } from "../decimal";
import type { NumeralMatch, NumeralParser, NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * Chinese cardinals: one table, two directions — `chineseNumerals` reads it to
 * parse 二十二 back to `22`, `chineseSpeller` reads the same object to spell
 * `22` as 二十二. Hoisted into one const, exactly as `uk-cardinals.ts` and
 * `fr-cardinals.ts` do, so the reading and the writing halves can never drift
 * apart.
 *
 * What Chinese does that none of the shipped languages did, and the reason the
 * two functions below exist beside `cardinalNumerals`/`cardinalSpeller` rather
 * than instead of a call to them:
 *
 * **A numeral is a string of characters, not a run of words.** 二十二 is one
 * word to every segmenter that has ever looked at it, and the shared fold reads
 * *words*. German already exposed this from one side —
 * `third-language.test.ts` records `cardinalNumerals` returning null for
 * "einundzwanzig" — and Chinese exposes it from the other: here the atoms are
 * single characters and the composition is positional, so the parser below
 * walks codepoints and the tables are keyed by codepoint.
 *
 * **The scale ladder climbs in ten-thousands, not thousands.** Above 千 the
 * next scale word is 万 (10^4), then 亿 (10^8) — every four digits, where every
 * European language in this repo groups every three. `cardinalNumerals`
 * hardcodes the European assumption in its `scale.gte(THOUSAND)` branch (its
 * own comment says so), and `cardinalSpeller` derives its ceiling from it. A
 * table handed to those two would read 十万 as 10 followed by a stray 万 and
 * spell 100000 as a compound Chinese does not say.
 *
 * **`tens` is empty, and that is the honest shape rather than an omission.**
 * Chinese has no word for twenty: 二十 *is* 二 × 十, composed the same way 二百
 * is composed, so a `tens` table would be nine rows restating a multiplication
 * the parser already performs. The field exists because `CardinalTables`
 * requires it. Nothing below *composes* from it — the reader's three branches
 * are digits, small scales and large scales — and it is read only by the gate
 * that decides which characters may belong to a numeral at all, so a table that
 * filled it in would widen what the parser accepts and change nothing about
 * what it computes.
 *
 * As in `uk-cardinals.ts`, a value with more than one spelling declares the one
 * to *write* first: both reverse maps below keep the first character they see
 * for a value, so 零 beats 〇 and 二 beats 两.
 */
export const CARDINALS: CardinalTables = {
  units: {
    零: 0,
    // U+3007 IDEOGRAPHIC NUMBER ZERO, the zero of a written-out year
    // (二〇二六) and of a phone number. Reading only: it is a *placeholder*
    // digit and never the answer to "how many", which is what 零 is for.
    〇: 0,
    一: 1,
    二: 2,
    // The counting two, which is what stands in front of a measure word: 两公斤
    // is two kilograms where 二公斤 is stilted at best. Reading only, so the
    // speller keeps 二.
    //
    // Declared knowing what it costs, which is the tael — 两 is also a
    // traditional unit of mass. Only one of the two can have this character:
    // `foldNumerals` turns a standalone numeral word into a *number token*
    // before any vocabulary is consulted, so a kind claiming 两 as a unit would
    // never be reached. The numeral wins because the collision is measured and
    // empty — `mass` ships mg, g, kg, t, oz and lb, and no kind in this repo
    // has a tael — while dropping 两 would cost the ordinary way of saying
    // "two" in front of every unit there is. `zh.test.ts` pins the trade.
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    // The capital forms — 壹贰叁肆伍陆柒捌玖 and their scales 拾佰仟萬億 — are
    // deliberately absent. They are the anti-tampering spelling of a cheque, a
    // contract and a banknote, a register in which nobody asks a calculator to
    // convert kilograms; adding them later is a table edit and not a code one,
    // since the parser reads whatever characters this object declares.
  },
  // Empty on purpose. See the doc comment above: Chinese composes every ten.
  tens: {},
  scales: {
    十: 10,
    百: 100,
    千: 1_000,
    // The myriad, and the reason this language needs its own fold: the ladder
    // above 千 goes up by four digits at a time, so 十万 is "ten myriads"
    // (100,000) and 一亿 is "one myriad myriads" (100,000,000).
    万: 10_000,
    亿: 100_000_000,
  },
};

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
/** Where the scale ladder switches from adding inside a group to closing one. */
const MYRIAD = 10_000;

/**
 * The first character declared for each value, so a table carrying several
 * spellings of one number spells deterministically instead of picking whichever
 * key iteration happened to reach last. The same rule `cardinalSpeller` states
 * for itself, restated here because these two functions are the ones that have
 * to agree with each other.
 */
function wordFor(source: Record<string, number>): Map<number, string> {
  const table = new Map<number, string>();
  for (const [word, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, word);
  }
  return table;
}

/**
 * Read one string of numeral characters, or `null` if it is not a well-formed
 * Chinese numeral.
 *
 * The shape of the algorithm is the shape of the writing system: a digit sets
 * the pending multiplier, a small scale (十百千) folds that multiplier into the
 * group being built, and a large scale (万亿) closes the group into the running
 * total. Three refusals are worth naming, because each is what keeps the parser
 * from claiming a word that merely happens to be spelled out of these
 * characters:
 *
 * - **Two digits in a row.** 二二 is not 22 in any register this engine reads;
 *   a digit string like that is a phone number, and reading it as a quantity
 *   would silently claim the second character of a two-character word.
 * - **A small scale that does not descend.** 十百 is not a number. Within a
 *   group the scales run strictly downward (千, then 百, then 十), which is
 *   what makes 三千五百 unambiguous, and a large scale resets the ladder so
 *   二千万三百 goes on reading after 万.
 * - **Any character not in the tables.** The caller has already filtered whole
 *   words, so this is the last line of a defence rather than the first.
 *
 * 零 is a *placeholder* and not a digit: it marks a skipped decimal place
 * (一百零五 is 105, "one hundred, nothing, five") and never contributes a value
 * of its own. So it may not follow a digit — 五零 is a digit string, not a
 * number — and 零 standing alone still reads as 0, because nothing accumulated
 * is exactly what zero means.
 */
function chineseReader(tables: CardinalTables): (text: string) => Decimal | null {
  const zeros = new Set<string>();
  const digits = new Map<string, number>();
  for (const [ch, value] of Object.entries(tables.units)) {
    if (value === 0) zeros.add(ch);
    else digits.set(ch, value);
  }
  const small = new Map<string, number>();
  const big = new Map<string, number>();
  for (const [ch, value] of Object.entries(tables.scales)) {
    (value >= MYRIAD ? big : small).set(ch, value);
  }

  return (text) => {
    if (text.length === 0) return null;

    let total = ZERO;
    // The group under construction, below the next large scale.
    let section = ZERO;
    let digit: number | undefined;
    // The last small scale folded into `section`, so the next one can be
    // required to be smaller.
    let lastSmall = Number.POSITIVE_INFINITY;
    // The largest scale `total` has already been multiplied by. A larger one
    // arriving later multiplies everything read so far (一万亿 is 10^12); a
    // smaller one only multiplies its own group (一亿二千万).
    let biggest = 0;

    for (const ch of text) {
      if (zeros.has(ch)) {
        if (digit !== undefined) return null;
        continue;
      }

      const value = digits.get(ch);
      if (value !== undefined) {
        if (digit !== undefined) return null;
        digit = value;
        continue;
      }

      const scale = small.get(ch);
      if (scale !== undefined) {
        if (scale >= lastSmall) return null;
        // A bare scale multiplies by one, which is how 十五 is 15 and not 5:
        // the ten is written with no digit in front of it.
        section = section.plus((digit ?? 1) * scale);
        digit = undefined;
        lastSmall = scale;
        continue;
      }

      const myriad = big.get(ch);
      if (myriad === undefined) return null;
      let part = section.plus(digit ?? 0);
      // 万 standing at the head of the input is 10,000 for the same reason 十
      // standing there is 10 — but only there, so that 一亿万, which is not
      // Chinese, does not silently gain a myriad it never wrote.
      if (part.isZero() && total.isZero()) part = ONE;
      total =
        myriad > biggest
          ? total.plus(part).times(myriad)
          : total.plus(part.times(myriad));
      biggest = myriad;
      section = ZERO;
      digit = undefined;
      lastSmall = Number.POSITIVE_INFINITY;
    }

    return total.plus(section).plus(digit ?? 0);
  };
}

/**
 * Every character any of the tables declares. The gate on what a word may be
 * before it is offered to the reader at all: a word with one character outside
 * this set is a word, not a number, and the run stops there.
 */
function numeralChars(tables: CardinalTables): Set<string> {
  return new Set([
    ...Object.keys(tables.units),
    ...Object.keys(tables.tens),
    ...Object.keys(tables.scales),
  ]);
}

/**
 * The `NumeralParser` over the tables above.
 *
 * `NumeralParser` claims a prefix of a run of *words*, and a Chinese numeral is
 * one string of characters — but the segmenter is under no obligation to hand
 * it over as one word, and does not: ICU splits 二十二 into 二十 | 二 and
 * 一百零五 into 一百 | 零 | 五 (see `zh.test.ts`, which pins both). So this
 * walks the run word by word, joins the words that are made of nothing but
 * numeral characters, and re-reads the join at every length, keeping the
 * longest one that parses. Reading the join rather than each word separately is
 * what makes a numeral survive being cut in a place its writer never wrote:
 * 一百 and 零 and 五 are 100, 0 and 5 apart, and 105 together.
 *
 * The scan stops at the first word the reader refuses, which is what keeps 两两
 * — two taels, if a vocabulary says so — from being claimed as a single
 * ill-formed numeral: 两 alone is 2, 两两 is two digits in a row and is refused,
 * so the claim stops at one word and the second 两 goes on to the resolver as
 * the unit word it is.
 */
export function chineseNumerals(tables: CardinalTables): NumeralParser {
  const read = chineseReader(tables);
  const chars = numeralChars(tables);

  return (words) => {
    let best: NumeralMatch | null = null;
    let joined = "";

    for (const [index, word] of words.entries()) {
      if (word.length === 0) break;
      if (![...word].every((ch) => chars.has(ch))) break;
      joined += word;
      const value = read(joined);
      if (value === null) break;
      best = { value, consumed: index + 1 };
    }

    return best;
  };
}

/**
 * The inverse of `chineseNumerals`, over the same tables.
 *
 * Declines on the three cases `cardinalSpeller` declines on, for the reasons it
 * gives: a non-integer (there is no character for a decimal point anywhere in
 * these tables — 点 is a *word*, and spelling "三点五" would be composing a
 * grammar the parser cannot read back), a negative magnitude (the AST models a
 * negative quantity as a `UnaryNode` around a non-negative one, so `Printer`
 * never asks for a signed spelling), and a value the scale ladder cannot reach.
 *
 * The ceiling here is 10^12 rather than "1000 × the largest scale", and it is
 * the one place this speller answers a question the tables cannot: above 亿 the
 * next step is written 万亿 in the mainland standard and 兆 in Taiwan and in
 * computing, where 兆 has meant 10^6 often enough that the National Standard
 * warns against it. There is no single answer, so this declines at the point
 * the tables stop being unambiguous and the caller prints that one value's
 * digits — which is exactly the per-value fallback `NumeralSpeller` documents.
 */
export function chineseSpeller(tables: CardinalTables): NumeralSpeller {
  const digitWord = wordFor(tables.units);
  const scaleWord = wordFor(tables.scales);
  const zero = digitWord.get(0);
  const ten = scaleWord.get(10);
  /** Most significant place first, as the writing goes. */
  const places: Array<[number, string | undefined]> = [
    [1_000, scaleWord.get(1_000)],
    [100, scaleWord.get(100)],
    [10, ten],
    [1, ""],
  ];
  /** The four-digit groups, lowest first, and the scale word each carries. */
  const groups: Array<string | undefined> = [
    "",
    scaleWord.get(MYRIAD),
    scaleWord.get(1e8),
  ];
  const CEILING = new Decimal("1e12");

  /**
   * One four-digit group, 1–9999.
   *
   * `leading` is the 一十 elision and nothing else: Chinese writes 十五 for 15
   * and 十万 for 100,000, dropping the 一 in front of a ten that opens the
   * whole number — but writes it back the moment anything precedes it, which is
   * why 115 is 一百一十五 and 10,015 is 一万零一十五. So the elision is a
   * property of the number, not of the group, and the flag has to be passed in.
   *
   * A zero inside a group is written once, however many places it spans:
   * 1,005 is 一千零五 and not 一千零零五, which is what the pending flag is for.
   * A *trailing* zero is written not at all — 1,000 is 一千 — which is what
   * makes the flag pending rather than immediate.
   */
  const section = (value: number, leading: boolean): string | null => {
    let out = "";
    let pendingZero = false;

    for (const [place, word] of places) {
      const digit = Math.floor(value / place) % 10;
      if (digit === 0) {
        if (out !== "") pendingZero = true;
        continue;
      }
      if (word === undefined) return null;
      if (pendingZero) {
        if (zero === undefined) return null;
        out += zero;
        pendingZero = false;
      }
      if (place === 10 && digit === 1 && leading && out === "") {
        out += word;
        continue;
      }
      const spelled = digitWord.get(digit);
      if (spelled === undefined) return null;
      out += spelled + word;
    }

    return out;
  };

  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return zero ?? null;

    // Below 10^12 and integral, so this is exact in a double.
    const n = value.toNumber();
    let out = "";

    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const scale = groups[index];
      const magnitude = MYRIAD ** index;
      const part = Math.floor(n / magnitude) % MYRIAD;
      if (part === 0) continue;
      if (scale === undefined) return null;
      const leading = out === "";
      // The zero that marks a *skipped group boundary*: 100,005 is 十万零五,
      // because the five sits in the low group with three empty places above
      // it. A group that fills its thousands place needs no such mark —
      // 105,000 is 十万五千 — which is what the four-digit test says.
      if (!leading && part < 1_000) {
        if (zero === undefined) return null;
        out += zero;
      }
      const spelled = section(part, leading);
      if (spelled === null) return null;
      out += spelled + scale;
    }

    return out;
  };
}
