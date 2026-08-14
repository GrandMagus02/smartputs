import { Decimal } from "../decimal";
import type { NumeralParser, NumeralSpeller } from "../types";

/**
 * Dutch cardinals: one table, two directions — the arrangement `uk-cardinals.ts`
 * introduced and `de-cardinals.ts` repeated, for the reason both give.
 * `dutchNumerals` reads the tables below to parse "eenentwintig" back to `21`;
 * `dutchSpeller` reads the very same objects to spell `21` as "eenentwintig".
 * Two separately maintained copies drift the first time a word is corrected in
 * one of them.
 *
 * **Why the shared `cardinalNumerals`/`cardinalSpeller` are not used here.**
 * They model a numeral as a *run of words*, because English ("twenty two") and
 * Ukrainian ("двадцять два") both space theirs. Dutch spaces nothing below a
 * million: the Taalunie rule is that every number under 10⁶ is written as a
 * single word, so 21 is `eenentwintig` — ones before tens, joined by an infixed
 * `en` — and 345,678 is the one word
 * `driehonderdvijfenveertigduizendzeshonderdachtenzeventig`.
 * `third-language.test.ts` recorded that limit as two findings against German
 * and concluded that a compounding language ships its own `numerals`; Dutch is
 * in exactly that position, so this is that.
 *
 * **Two things Dutch does that German does not**, and they are why this file is
 * not `de-cardinals.ts` with the words swapped:
 *
 * - **The infix is `en`, and `en` occurs inside ordinary numeral words.**
 *   German splits `einundzwanzig` with `word.indexOf("und")` because no German
 *   numeral word contains `und` except `hundert` (which is searched first). The
 *   same trick applied to Dutch reads `zevenentwintig` as `zev` + `twintig`,
 *   because `zeven` contains the infix — and `duizend` contains it too. So the
 *   split here starts from the **tens word at the end** and works backwards,
 *   which cannot be fooled by an `en` sitting anywhere else in the word.
 * - **The trema.** A ones word ending in a vowel takes `ën` rather than `en`,
 *   so that the reader does not see the digraph `ee`/`ie` running into the `e`
 *   of the infix: `tweeëntwintig`, `drieëntwintig`, against `vierentwintig`.
 *   Only `twee` and `drie` are affected, and both spellings are read (the
 *   trema-less `tweeentwintig` is what an unaccented keyboard produces) while
 *   only the tremaed one is written.
 *
 * **`biljoen` is 10¹², not 10⁹.** Dutch follows the long scale exactly as
 * German does: `miljard` is the 10⁹ that English calls a billion. Getting this
 * backwards is the likeliest error in the table, so the pairing is asserted in
 * `nl.test.ts` rather than left to a reader's trust.
 */
export interface DutchScale {
  /**
   * One form, not German's singular/plural pair. A Dutch scale noun does not
   * agree with its multiplier: "twee miljoen", never "twee miljoenen" — the
   * `-en` plural exists only in the indefinite "miljoenen mensen", which is not
   * a numeral at all and is therefore not read here.
   */
  readonly word: string;
  readonly value: number;
}

export interface DutchCardinalTables {
  /**
   * 1–9 **as they appear inside a compound**, which is the only place they
   * appear at all: `eenentwintig`, `vijfhonderd`, `tweeduizend`. The word for a
   * bare 1 is in `standalone`, for the reason written there.
   */
  readonly ones: Record<string, number>;
  /**
   * 10–19. Listed rather than composed because four of them are not the sum of
   * their parts: `dertien` and `veertien` metathesise the `r` of `drie`/`vier`
   * (not *drietien*, not *viertien*), and `elf`/`twaalf` are built from nothing.
   */
  readonly teens: Record<string, number>;
  /**
   * 20–90. Two irregulars: `dertig` and `veertig` carry the same metathesis as
   * their teens, and `tachtig` starts with a `t` that belongs to no other word
   * in the table (not *achttig*) — a spelling that exists to keep the `cht`
   * cluster pronounceable after the preceding `en`, as in `achtentachtig`.
   */
  readonly tens: Record<string, number>;
  /**
   * The words that never enter a compound. `nul` is zero, which composes with
   * nothing in Dutch, and `één` is the numeral one **written with its accents**.
   *
   * That accent is the whole reason this group exists, and it is a device
   * German has no need of: Dutch spells the numeral and the indefinite article
   * identically, so "een meter" is *a* metre and "één meter" is *one* metre.
   * Every magnitude this speller produces stands in front of a unit noun —
   * precisely the position the Taalunie prescribes the accents for — so a bare
   * 1 is written `één`, while the 1 inside `eenentwintig` stays plain, since no
   * ambiguity is possible in the middle of a word.
   *
   * The unaccented `een` is not listed here because `ones` already carries it:
   * the reader finds it either way, and leaving it out of this group is what
   * keeps `één` the spelling the speller reaches for.
   */
  readonly standalone: Record<string, number>;
  /** The free scale nouns, ascending. The one place Dutch puts a space. */
  readonly scales: readonly DutchScale[];
}

export const CARDINALS: DutchCardinalTables = {
  ones: {
    een: 1,
    twee: 2,
    drie: 3,
    vier: 4,
    vijf: 5,
    zes: 6,
    zeven: 7,
    acht: 8,
    negen: 9,
  },
  teens: {
    tien: 10,
    elf: 11,
    twaalf: 12,
    dertien: 13,
    veertien: 14,
    vijftien: 15,
    zestien: 16,
    zeventien: 17,
    achttien: 18,
    negentien: 19,
  },
  tens: {
    twintig: 20,
    dertig: 30,
    veertig: 40,
    vijftig: 50,
    zestig: 60,
    zeventig: 70,
    tachtig: 80,
    negentig: 90,
  },
  standalone: {
    nul: 0,
    één: 1,
  },
  scales: [
    { word: "miljoen", value: 1_000_000 },
    { word: "miljard", value: 1_000_000_000 },
    { word: "biljoen", value: 1_000_000_000_000 },
  ],
};

/**
 * The two morphemes that multiply inside a compound, and the infix that joins a
 * ones word to a tens word.
 *
 * Unlike German's, none of these three may be searched for with `indexOf`
 * blindly: `duizend` contains the infix `en`, and so do `zeven` and `negen`. The
 * scale morphemes are long enough to be unambiguous and are found by position;
 * the infix is never searched for at all — see `readUnder100`.
 */
const HONDERD = "honderd";
const DUIZEND = "duizend";
const INFIX = "en";
/** The same infix after a vowel-final ones word: `tweeën`, `drieën`. */
const TREMA_INFIX = "ën";

const lookup = (table: Record<string, number>) => new Map(Object.entries(table));

const ONES = lookup(CARDINALS.ones);
const TEENS = lookup(CARDINALS.teens);
const TENS = lookup(CARDINALS.tens);
const STANDALONE = lookup(CARDINALS.standalone);

const SCALE_WORDS = new Map(CARDINALS.scales.map((s) => [s.word, s.value]));

/**
 * Below 100: a direct word, or ones-`en`-tens read from the right.
 *
 * The scan starts at the tens word because the infix cannot be located from the
 * left. `zevenentwintig` contains three `en` sequences and only the third is the
 * infix; anchoring on `twintig` finds it with no search at all, and the head
 * that remains (`zeven` + `en`) is then a single stripped suffix away from a
 * table lookup.
 */
function readUnder100(word: string): number | null {
  const direct =
    STANDALONE.get(word) ?? TEENS.get(word) ?? TENS.get(word) ?? ONES.get(word);
  if (direct !== undefined) return direct;

  for (const [tensWord, tensValue] of TENS) {
    if (!word.endsWith(tensWord)) continue;
    const head = word.slice(0, word.length - tensWord.length);
    // Both spellings of the infix, because the trema is what an accented
    // keyboard produces and `tweeentwintig` is what every other one does.
    const stem = head.endsWith(TREMA_INFIX)
      ? head.slice(0, -TREMA_INFIX.length)
      : head.endsWith(INFIX)
        ? head.slice(0, -INFIX.length)
        : null;
    if (stem === null) continue;
    const ones = ONES.get(stem);
    if (ones !== undefined) return ones + tensValue;
  }
  return null;
}

/**
 * Below 1000, and a little above it.
 *
 * The multiplier before `honderd` may be omitted — `honderdvijf` and
 * `eenhonderdvijf` are the same 105, and the first is the ordinary spelling —
 * so an empty head reads as 1. The head is a whole sub-100 value rather than a
 * single ones word because Dutch really does count in hundreds past nine:
 * `negentienhonderd` is 1900, the way a year is said and the way a price often
 * is.
 */
function readUnder1000(word: string): number | null {
  const cut = word.indexOf(HONDERD);
  if (cut < 0) return readUnder100(word);
  const head = word.slice(0, cut);
  const tail = word.slice(cut + HONDERD.length);
  const hundreds = head === "" ? 1 : readUnder100(head);
  if (hundreds === null) return null;
  const rest = tail === "" ? 0 : readUnder100(tail);
  if (rest === null) return null;
  return hundreds * 100 + rest;
}

/**
 * Below 1,000,000 — the whole of what Dutch writes as a single token. The head
 * before `duizend` is itself a sub-1000 compound
 * (`tweehonderddrieduizend`), and as with `honderd` an omitted head reads as 1,
 * since `duizend` and not *eenduizend* is how a thousand is written.
 */
export function readCompound(word: string): number | null {
  const cut = word.indexOf(DUIZEND);
  if (cut < 0) return readUnder1000(word);
  const head = word.slice(0, cut);
  const tail = word.slice(cut + DUIZEND.length);
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
 * first — the same decision `de-cardinals.ts` makes and for the same reason.
 * "driehonderd twee" is not 302; it is the numeral 300 followed by a separate
 * word the caller must stay free to read as something else. Claiming both would
 * silently eat the token after every "300 2" the engine ever sees.
 *
 * **With one exception, and it is the one place Dutch really does put a space
 * below a million.** The Leidraad writes a number under 10⁶ as a single word but
 * allows a space after `duizend` for readability, and in running text that is
 * what most writers take: "tweeduizend driehonderdvijfenveertig" beside the
 * closed-up `tweeduizenddriehonderdvijfenveertig`. Both are Dutch, so both have
 * to read — recognition is many-to-one (I6) — even though only the closed-up one
 * is ever written back out by the speller below.
 *
 * The exception is gated on the *pending* value being a whole number of
 * thousands, which is exactly the shape a word ending in `duizend` with no tail
 * of its own leaves behind, and on the continuation being under a thousand. That
 * is what keeps "driehonderd twee" refused: 300 is not a multiple of 1000, so it
 * never opens the gate, and the assertion that pins it is unmoved. It also
 * closes after one word — 2300 is no longer a multiple of 1000 — so a run of
 * bare numerals can never chain into one number.
 *
 * `en` is likewise **not** declared as a connector anywhere. The shared
 * `cardinalNumerals` accepts a connector wherever a claim is already open, so
 * declaring one would make `["een", "en", "twintig"]` read as 21 — a spelling
 * Dutch does not have — while the real `["eenentwintig"]` is handled inside
 * `readUnder100` and needs no connector at all.
 */
export function dutchNumerals(): NumeralParser {
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
        // A bare scale noun multiplies 1. "één miljoen" reaches here with the
        // "één" already folded into `pending`; a bare "miljoen" is the elliptical
        // "a million" and goes through the same line.
        total = total.plus(new Decimal(pending ?? 1).times(scale));
        pending = null;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      const value = readCompound(word);
      if (value === null) break;
      if (pending !== null) {
        // The spaced tail after `duizend`, and nothing else: the head must be a
        // whole number of thousands and the tail must be under one, so
        // "tweeduizend driehonderdvijfenveertig" reads as 2345 while
        // "driehonderd twee" stays two numbers.
        if (pending < 1000 || pending % 1000 !== 0 || value >= 1000 || value === 0) {
          break;
        }
        pending += value;
        consumed = index + 1;
        continue;
      }
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
const STANDALONE_BY_VALUE = byValue(CARDINALS.standalone);
const ZERO_WORD = STANDALONE_BY_VALUE.get(0);
const ONE_WORD = STANDALONE_BY_VALUE.get(1);

/**
 * Ones before tens, glued by the infix: 21 is `eenentwintig`, never
 * *twintigeen*. The trema goes on the infix when the ones word ends in a vowel,
 * which is `twee` and `drie` and nothing else — the rule is orthographic (keep
 * `ee`/`ie` from running into the `e` of `en`), so it is tested on the word's
 * last letter rather than listed per number.
 */
function spellUnder100(n: number): string | null {
  const direct = ONES_BY_VALUE.get(n) ?? TEENS_BY_VALUE.get(n) ?? TENS_BY_VALUE.get(n);
  if (direct !== undefined) return direct;
  const tensValue = Math.floor(n / 10) * 10;
  const tensWord = TENS_BY_VALUE.get(tensValue);
  if (tensWord === undefined) return null;
  const onesWord = ONES_BY_VALUE.get(n - tensValue);
  if (onesWord === undefined) return null;
  const infix = onesWord.endsWith("e") ? TREMA_INFIX : INFIX;
  return `${onesWord}${infix}${tensWord}`;
}

/**
 * `honderd`, not the German-style *eenhonderd*. This is the opposite convention
 * from `de-cardinals.ts`, which always writes its multiplier: Dutch drops the
 * one, and a printed "eenhonderd" would read as a translation rather than as
 * Dutch. Both spellings are still accepted on the way in (see `readUnder1000`).
 */
function spellUnder1000(n: number): string | null {
  if (n < 100) return spellUnder100(n);
  const hundreds = Math.floor(n / 100);
  const head = hundreds === 1 ? "" : ONES_BY_VALUE.get(hundreds);
  if (head === undefined) return null;
  const rest = n % 100;
  if (rest === 0) return `${head}${HONDERD}`;
  const tail = spellUnder100(rest);
  return tail === null ? null : `${head}${HONDERD}${tail}`;
}

/**
 * Still one token: `duizend`, `tweeduizend`,
 * `driehonderdvijfenveertigduizendzeshonderdachtenzeventig`. The Leidraad allows
 * a space after `duizend` for readability and this speller does not take it —
 * generation is one where recognition is many (I6), and the closed-up spelling
 * is the one the rule states rather than the one it concedes. `dutchNumerals`
 * reads the spaced variant all the same, so the concession costs a Dutch reader
 * nothing on the way in.
 */
function spellCompound(n: number): string | null {
  if (n < 1000) return spellUnder1000(n);
  const thousands = Math.floor(n / 1000);
  const head = thousands === 1 ? "" : spellUnder1000(thousands);
  if (head === null) return null;
  const rest = n % 1000;
  if (rest === 0) return `${head}${DUIZEND}`;
  const tail = spellUnder1000(rest);
  return tail === null ? null : `${head}${DUIZEND}${tail}`;
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
    // "één miljoen": the scale noun is a free word, so the multiplier before it
    // is in standalone position and takes the accents. Inside a compound it
    // never would.
    const head = multiple.equals(1) ? ONE_WORD : spellCompound(multiple.toNumber());
    if (head === undefined || head === null) return null;
    if (remainder.isZero()) return `${head} ${scale.word}`;
    const tail = spellScales(remainder);
    return tail === null ? null : `${head} ${scale.word} ${tail}`;
  }
  return spellCompound(n.toNumber());
}

/**
 * The inverse of `dutchNumerals`, over the same tables. Declines on the same
 * three cases `cardinalSpeller` declines on, for the reasons it documents: a
 * non-integer (these tables have no fractional grammar), a negative magnitude
 * (the AST models a sign as a `UnaryNode`, never as part of the number), and
 * anything at or above 1000 × the largest declared scale — Dutch has `biljard`
 * for 10¹⁵, but it is not in the table, and composing "duizend biljoen" for it
 * would be inventing a spelling out of a word that is not there.
 */
export function dutchSpeller(): NumeralSpeller {
  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return ZERO_WORD ?? null;
    // A bare one, in standalone position, is the accented `één` — the only
    // magnitude whose spelling depends on standing alone rather than on its
    // size. Everything below routes through `ones`, where 1 is plain `een`.
    if (value.equals(1)) return ONE_WORD ?? null;
    return spellScales(value);
  };
}
