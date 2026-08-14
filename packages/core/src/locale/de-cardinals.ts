import { Decimal } from "../decimal";
import type { NumeralParser, NumeralSpeller } from "../types";

/**
 * German cardinals: one table, two directions — the same arrangement
 * `uk-cardinals.ts` uses, and for the same reason. `germanNumerals` reads the
 * tables below to parse "einundzwanzig" back to `21`; `germanSpeller` reads the
 * very same objects to spell `21` as "einundzwanzig". Two separately maintained
 * copies would drift the first time a word was corrected in one of them.
 *
 * **Why the shared `cardinalNumerals`/`cardinalSpeller` are not used here.**
 * `third-language.test.ts` measured exactly this and wrote the finding down as
 * two failing-by-design rows (`cardinalNumerals cannot express a German
 * compound numeral`, `cardinalSpeller composes with spaces, which German does
 * not`). Both helpers model a numeral as a *run of words*, because English
 * ("twenty two") and Ukrainian ("двадцять два") both space theirs. German
 * spaces nothing below a million: 21 is `einundzwanzig` — one token, units
 * before tens, joined by an infixed `und` — and 345,678 is the single word
 * `dreihundertfünfundvierzigtausendsechshundertachtundsiebzig`. The fix is not
 * a bigger table (21–99 alone would be ninety words of pure composition); it is
 * a parser that decomposes one token, which is a different function than
 * `(words) => …`. The test file's own conclusion was "a German language ships
 * its own `numerals`", so this is that.
 *
 * **Where German does put a space**, and the one thing that keeps the
 * word-level `NumeralParser` signature honest: the scale nouns from a million
 * up are free, capitalised nouns and are written apart — "eine Million",
 * "zwei Millionen dreihunderttausend". So the parser is genuinely two layers:
 * `readCompound` decomposes each token below 10⁶, and the exported parser walks
 * the run gluing those tokens to the scale nouns between them.
 *
 * **`Billion` is 10¹², not 10⁹.** German follows the long scale: `Milliarde`
 * is the 10⁹ that English calls a billion, and `Billion` is 10¹². Getting this
 * backwards is the single likeliest error in a German numeral table, so the
 * values are written with separators below and the pairing is asserted in
 * `de.test.ts` rather than left to a reader's trust.
 */
export interface GermanScale {
  /** The form after a multiplier of one: "eine Million". */
  readonly singular: string;
  /** The form after every other multiplier: "zwei Millionen". */
  readonly plural: string;
  readonly value: number;
}

export interface GermanCardinalTables {
  /**
   * 1–9 **as they appear inside a compound**, which is why 1 is `ein` and not
   * `eins`: German says `einundzwanzig`, `einhundert`, `ein Kilometer`, and
   * reserves `eins` for counting with no noun after it.
   *
   * `ein` is what the speller emits for a bare 1, and it is the right word in
   * front of a masculine or neuter noun and the wrong one in front of a feminine
   * one — German wants *eine Meile*, *eine Stunde*, *eine Kilowattstunde*. The
   * speller cannot tell which, having no noun among its arguments, so `de.ts`'s
   * `renderQuantity` rewrites the bare `ein` where the noun calls for it. See
   * `germanSpeller` below and `agree` there.
   */
  readonly ones: Record<string, number>;
  /**
   * 10–19. Listed rather than composed because three of them are not the sum
   * of their parts: `sechzehn` drops the -s of `sechs`, `siebzehn` drops the
   * -en of `sieben`, and `elf`/`zwölf` are not built from anything at all.
   */
  readonly teens: Record<string, number>;
  /**
   * 20–90. `dreißig` is the odd one — it ends in -ßig where every other tens
   * word ends in -zig — and it is also the only word in these tables that
   * carries an ß, so the Swiss spelling `dreissig` is declared beside it. It
   * is declared *second*, so the speller (first word for a value wins) writes
   * the ß form.
   */
  readonly tens: Record<string, number>;
  /**
   * The words that stand alone instead of composing. `eins` is the bare
   * counting one ("eins, zwei, drei"), `eine` the feminine agreement the scale
   * nouns require ("eine Million" — `Million` is feminine), and `null` is zero,
   * which enters no compound in German at all.
   */
  readonly standalone: Record<string, number>;
  /** The free, capitalised scale nouns, ascending. */
  readonly scales: readonly GermanScale[];
}

export const CARDINALS: GermanCardinalTables = {
  ones: {
    ein: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
  },
  teens: {
    zehn: 10,
    elf: 11,
    zwölf: 12,
    dreizehn: 13,
    vierzehn: 14,
    fünfzehn: 15,
    sechzehn: 16,
    siebzehn: 17,
    achtzehn: 18,
    neunzehn: 19,
  },
  tens: {
    zwanzig: 20,
    dreißig: 30,
    dreissig: 30,
    vierzig: 40,
    fünfzig: 50,
    sechzig: 60,
    siebzig: 70,
    achtzig: 80,
    neunzig: 90,
  },
  standalone: {
    null: 0,
    eins: 1,
    eine: 1,
  },
  scales: [
    { singular: "Million", plural: "Millionen", value: 1_000_000 },
    { singular: "Milliarde", plural: "Milliarden", value: 1_000_000_000 },
    { singular: "Billion", plural: "Billionen", value: 1_000_000_000_000 },
  ],
};

/**
 * The two morphemes that do the multiplying inside a compound, and the infix
 * that joins a units word to a tens word.
 *
 * `hundert` is searched before `und` is ever considered, which is not an
 * optimisation but a correctness requirement: `hundert` *contains* `und`, so a
 * decomposer that split on `und` first would read `einhundert` as `ein` + `hert`
 * and return null for a word it can read perfectly well.
 */
const HUNDERT = "hundert";
const TAUSEND = "tausend";
const UND = "und";

const lookup = (table: Record<string, number>) => new Map(Object.entries(table));

const ONES = lookup(CARDINALS.ones);
const TEENS = lookup(CARDINALS.teens);
const TENS = lookup(CARDINALS.tens);
const STANDALONE = lookup(CARDINALS.standalone);

const SCALE_WORDS = new Map<string, number>();
for (const scale of CARDINALS.scales) {
  SCALE_WORDS.set(scale.singular.toLowerCase(), scale.value);
  SCALE_WORDS.set(scale.plural.toLowerCase(), scale.value);
}

/** Below 100: a direct word, or units-`und`-tens. */
function readUnder100(word: string): number | null {
  const direct =
    STANDALONE.get(word) ?? TEENS.get(word) ?? TENS.get(word) ?? ONES.get(word);
  if (direct !== undefined) return direct;
  const cut = word.indexOf(UND);
  // `cut === 0` would mean a word beginning with `und`, which is a conjunction
  // and not a numeral: nothing is being added to anything.
  if (cut <= 0) return null;
  const ones = ONES.get(word.slice(0, cut));
  const tens = TENS.get(word.slice(cut + UND.length));
  if (ones === undefined || tens === undefined) return null;
  return ones + tens;
}

/**
 * Below 1000. The multiplier before `hundert` may be omitted — `hundertfünf`
 * and `einhundertfünf` are the same 105 — so an empty head reads as 1.
 */
function readUnder1000(word: string): number | null {
  const cut = word.indexOf(HUNDERT);
  if (cut < 0) return readUnder100(word);
  const head = word.slice(0, cut);
  const tail = word.slice(cut + HUNDERT.length);
  const hundreds = head === "" ? 1 : ONES.get(head);
  if (hundreds === undefined) return null;
  const rest = tail === "" ? 0 : readUnder100(tail);
  if (rest === null) return null;
  return hundreds * 100 + rest;
}

/**
 * Below 1,000,000 — the whole of what German writes as a single token. The
 * head before `tausend` is itself a sub-1000 compound (`zweihundertdreitausend`),
 * and as with `hundert` an omitted head reads as 1 (`tausendfünf` is 1005).
 */
export function readCompound(word: string): number | null {
  const cut = word.indexOf(TAUSEND);
  if (cut < 0) return readUnder1000(word);
  const head = word.slice(0, cut);
  const tail = word.slice(cut + TAUSEND.length);
  const thousands = head === "" ? 1 : readUnder1000(head);
  if (thousands === null) return null;
  const rest = tail === "" ? 0 : readUnder1000(tail);
  if (rest === null) return null;
  return thousands * 1000 + rest;
}

/**
 * The word-level layer: one compound token, optionally followed by a scale
 * noun, repeated.
 *
 * A second compound in a row ends the claim rather than being added to the
 * first, which is the deliberate difference from `cardinalNumerals`'s "keep
 * accumulating addends" loop. German has no spaced numerals below a million, so
 * "dreihundert zwei" is not 302 — it is the numeral 300 followed by a separate
 * word the caller must be free to read as something else. Claiming both would
 * silently eat the next token of every "300 2" the engine ever sees.
 *
 * `und` is likewise **not** declared as a connector, and that is the same
 * decision seen from the other side. `cardinalNumerals` accepts a connector
 * anywhere a claim is already open, so declaring one here would make
 * `["ein", "und", "zwanzig"]` read as 21 — a spelling German does not have —
 * while the real `["einundzwanzig"]` is handled by `readUnder100`'s infix split
 * and needs no connector at all.
 */
export function germanNumerals(): NumeralParser {
  return (words) => {
    let total = new Decimal(0);
    let pending: number | null = null;
    let claimed = false;
    // The prefix length at the last accepting state, exactly as
    // `cardinalNumerals` tracks it.
    let consumed = 0;

    for (const [index, raw] of words.entries()) {
      const word = raw.toLowerCase();

      const scale = SCALE_WORDS.get(word);
      if (scale !== undefined) {
        // A bare scale noun multiplies 1: "Millionen Meter" is not a number
        // German writes, but "eine Million" reaching here with the "eine"
        // already folded into `pending` is, and both go through this line.
        total = total.plus(new Decimal(pending ?? 1).times(scale));
        pending = null;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      if (pending !== null) break;
      const value = readCompound(word);
      if (value === null) break;
      pending = value;
      claimed = true;
      consumed = index + 1;
    }

    return claimed ? { value: total.plus(pending ?? 0), consumed } : null;
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
const TEENS_BY_VALUE = byValue(CARDINALS.teens);
const TENS_BY_VALUE = byValue(CARDINALS.tens);
const ZERO_WORD = byValue(CARDINALS.standalone).get(0);

/** Units before tens, glued by `und`: 21 is `einundzwanzig`, never `zwanzigein`. */
function spellUnder100(n: number): string | null {
  const direct = ONES_BY_VALUE.get(n) ?? TEENS_BY_VALUE.get(n) ?? TENS_BY_VALUE.get(n);
  if (direct !== undefined) return direct;
  const tensValue = Math.floor(n / 10) * 10;
  const tensWord = TENS_BY_VALUE.get(tensValue);
  if (tensWord === undefined) return null;
  const onesWord = ONES_BY_VALUE.get(n - tensValue);
  return onesWord === undefined ? null : `${onesWord}${UND}${tensWord}`;
}

/**
 * `einhundert`, not the equally correct bare `hundert`. Both read back (see
 * `readUnder1000`'s omitted head), and writing the multiplier always is what
 * keeps the output uniform: `zweihundert` and `hundert` side by side in one
 * printed expression would look like two different conventions.
 */
function spellUnder1000(n: number): string | null {
  if (n < 100) return spellUnder100(n);
  const head = ONES_BY_VALUE.get(Math.floor(n / 100));
  if (head === undefined) return null;
  const rest = n % 100;
  if (rest === 0) return `${head}${HUNDERT}`;
  const tail = spellUnder100(rest);
  return tail === null ? null : `${head}${HUNDERT}${tail}`;
}

/** Still one token: `eintausend`, `dreihundertfünfundvierzigtausendsechs`. */
function spellCompound(n: number): string | null {
  if (n < 1000) return spellUnder1000(n);
  const head = spellUnder1000(Math.floor(n / 1000));
  if (head === null) return null;
  const rest = n % 1000;
  if (rest === 0) return `${head}${TAUSEND}`;
  const tail = spellUnder1000(rest);
  return tail === null ? null : `${head}${TAUSEND}${tail}`;
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
    const one = multiple.equals(1);
    // "eine Million", not "ein Million": every German scale noun from Million
    // up is feminine, so the multiplier one takes the feminine `eine`. This is
    // the only place in the whole speller where the word for 1 is not `ein`.
    const head = one ? "eine" : spellCompound(multiple.toNumber());
    if (head === null) return null;
    const noun = one ? scale.singular : scale.plural;
    if (remainder.isZero()) return `${head} ${noun}`;
    const tail = spellScales(remainder);
    return tail === null ? null : `${head} ${noun} ${tail}`;
  }
  return spellCompound(n.toNumber());
}

/**
 * The inverse of `germanNumerals`, over the same tables. Declines on the same
 * three cases `cardinalSpeller` declines on, for the same reasons it documents:
 * a non-integer (these tables have no fractional grammar), a negative
 * magnitude (the AST models a sign as a `UnaryNode`, never as part of the
 * number), and anything at or above 1000 × the largest declared scale — a
 * German `Billiarde` (10¹⁵) exists, but it is not in the table, and composing
 * "tausend Billionen" for it would be inventing a spelling out of a word that
 * is not there.
 *
 * **What this function deliberately does not do is agree in gender**, and the
 * correction lives one file over rather than here. German's word for 1 agrees
 * with the noun it counts — *ein Meter* (m), *ein Kilogramm* (n), but *eine
 * Meile*, *eine Stunde*, *eine Kilowattstunde* (f) — and `spellScales` applies
 * that rule only to the one noun it can see, its own feminine
 * `Million`/`Milliarde`/`Billion`. A *unit* noun is not one of this function's
 * arguments: a `NumeralSpeller` is `(value) => string | null`, which is the same
 * shape that made `uk-cardinals.ts` write its own limitation up, so this writes
 * the masculine and says so. `de.ts`'s `renderQuantity` fixes it up at the one
 * call where the number and the noun are both in hand, exactly as
 * `@smartput/core/locale/es` does for Spanish's broader agreement.
 *
 * That is why `eine` is declared in `standalone` below and never spelled from
 * here: the rewrite needs the word to read back as 1, and this table is what
 * makes it do so.
 */
export function germanSpeller(): NumeralSpeller {
  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return ZERO_WORD ?? null;
    return spellScales(value);
  };
}
