import { Decimal } from "../decimal";
import type { NumeralMatch, NumeralParser, NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * Italian cardinals: one table, two directions — and, unlike `uk-cardinals.ts`,
 * the two readers of that table live here beside it rather than being
 * `cardinalNumerals` and `cardinalSpeller`.
 *
 * That is the finding this language forced, and it is the same one
 * `third-language.test.ts` records for German under `cardinalNumerals cannot
 * express a German compound numeral`: the shared helpers read and write a *run
 * of words*, and Italian writes every cardinal below a million as a **single
 * word**. "ventidue" is 22, "duemilatrecento" is 2300, "centoundici" is 111 —
 * no spaces anywhere. English ("twenty two") and Ukrainian ("двадцять два")
 * both space their numerals, so neither exposed the assumption.
 *
 * German declined to ship numerals at all, because German's join is genuinely
 * irregular (units before tens, welded with "und"). Italian's is not: it is
 * plain left-to-right concatenation with exactly two sandhi rules, both
 * mechanical and both applied identically on the way in and on the way out.
 * So Italian implements rather than declines — and the implementation reads
 * `CARDINALS` and nothing else, so the parse and the spell directions still
 * cannot drift, which is the property that put the Ukrainian table in a file
 * of its own in the first place.
 *
 * The two sandhi rules, stated once here because both readers apply them:
 *
 * - **Elision before *uno* and *otto*.** A tens word and *cento* drop their
 *   final vowel in front of the only two vowel-initial units they can meet:
 *   venti + uno = "ventuno", venti + otto = "ventotto", cento + uno =
 *   "centuno", cento + otto = "centotto". It is keyed on the *value* 1 or 8 and
 *   never on "the tail starts with a vowel", because 11 is also vowel-initial
 *   and does **not** elide: 111 is "centoundici", not "centundici".
 * - **The accent on final *tre*.** Standalone the word is "tre"; welded to the
 *   end of a compound it takes an acute accent — "ventitré", "centotré",
 *   "duemilatré". It loses the accent again the moment it stops being final,
 *   which is why 23,000 is "ventitremila". Both spellings are declared below,
 *   so a reader who omits the accent is understood either way.
 *
 * Elision deliberately does **not** apply across the thousands join: 1001 is
 * "milleuno" and 2001 is "duemilauno", never "milluno".
 */

/**
 * The three spellings the speller must name rather than look up by value, given
 * as constants and used as the table's own keys — so each string still has
 * exactly one declaration site and the speller cannot reach for a word the
 * parser has not been taught.
 *
 * `un` is the apocopated masculine, and it is the *only* form that appears in
 * front of a scale noun: Italian says "un milione", never "uno milione".
 * `tré` is the accented final form described above. `mille`/`mila` is
 * suppletive — 1000 is "mille" but 2000 is "duemila" — and no rule derives one
 * from the other, unlike `milione`/`milioni`, which is an ordinary -e → -i
 * plural and is derived below.
 */
const ONE_APOCOPATED = "un";
const THREE_FINAL = "tré";
const THOUSAND_ONE = "mille";
const THOUSAND_MANY = "mila";

export const CARDINALS: CardinalTables = {
  units: {
    zero: 0,
    // Three spellings of 1, and the order matters only to the speller, which
    // keeps the first word it sees for a value: "uno" is what stands alone.
    // "un" is the form before a noun ("un metro", "un milione") and "una" its
    // feminine ("una tonnellata"). Both are the indefinite article as well as
    // the numeral — in this engine that distinction has no consequence, since
    // "un metro" and "1 metro" are the same quantity.
    uno: 1,
    [ONE_APOCOPATED]: 1,
    una: 1,
    due: 2,
    tre: 3,
    [THREE_FINAL]: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
    // 11–19 are opaque: "undici" is not composed from "uno" and "dieci" by any
    // rule this file could state, so they are units and not a tens row.
    undici: 11,
    dodici: 12,
    tredici: 13,
    quattordici: 14,
    quindici: 15,
    sedici: 16,
    diciassette: 17,
    diciotto: 18,
    diciannove: 19,
  },
  tens: {
    venti: 20,
    trenta: 30,
    quaranta: 40,
    cinquanta: 50,
    sessanta: 60,
    settanta: 70,
    ottanta: 80,
    novanta: 90,
  },
  scales: {
    // Italian composes every hundred from a unit word and "cento" the way
    // English does — "duecento", "novecento" — so unlike Ukrainian's двісті
    // there is nothing to declare between 100 and 1000. `cento` genuinely
    // multiplies, and stays a scale.
    cento: 100,
    [THOUSAND_ONE]: 1_000,
    [THOUSAND_MANY]: 1_000,
    // At a million and above the scale word detaches and becomes a word of its
    // own — "due milioni", "un miliardo" — which is why these are matched at
    // the word level and never inside a compound. Both numbers of each are
    // declared: the singular is what a table lookup returns, the plural is
    // what `pluralize` derives, and a test pins that the derived form is a key
    // here.
    milione: 1_000_000,
    milioni: 1_000_000,
    miliardo: 1_000_000_000,
    miliardi: 1_000_000_000,
  },
  // No connectors, and that is a decision rather than an omission. Italian
  // welds its numerals instead of joining them, so the "and" of "two hundred
  // and five" has no Italian counterpart inside a number — "duecentocinque" is
  // one word. The one place "e" does appear ("un milione e mezzo") introduces a
  // fraction this table has no word for anyway, and claiming "e" would make the
  // ordinary coordinating conjunction disappear into whatever number preceded
  // it.
  //
  // The partitive "di" that a detached scale noun demands — "un milione **di**
  // chilogrammi", which is the only grammatical way Italian counts a noun with
  // *milione* or *miliardo* — is likewise not here, and could not be made to
  // work if it were. `it.ts` claims "di" as the `of` keyword ("20% di 50"), and
  // `lex` resolves a keyword surface into a `keyword` token before `collectRun`
  // gathers anything: a run of consecutive *word* tokens can therefore never
  // contain "di", so no `NumeralParser` is ever offered it and no table here
  // can reach it. So "un milione di chilogrammi" reaches the parser as
  // `1000000 of <mass>` and is refused. The gap is real, it is reported rather
  // than papered over with a table row nothing would ever read, and closing it
  // needs a change in core — a numeral pass able to look past a keyword token —
  // not a different set of Italian number words. Dropping "di" from
  // `keywords.of` is not the alternative it looks like: "di" is the only
  // Italian word for the partitive percentage, so "20% di 50" would go with it.
};

const HUNDRED = 100;
const THOUSAND = 1_000;
const MILLION = 1_000_000;

/**
 * The regular Italian masculine plural, the same -o/-e → -i that `it.ts`'s
 * analyzer folds in the opposite direction. Applied here to the scale nouns
 * only: "milione" → "milioni", "miliardo" → "miliardi".
 */
const pluralize = (singular: string): string => singular.replace(/[eo]$/, "i");

/** First word declared for a value wins, exactly as `cardinalSpeller` does. */
function byValue(source: Record<string, number>): Map<number, string> {
  const table = new Map<number, string>();
  for (const [word, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, word);
  }
  return table;
}

const UNITS_BY_VALUE = byValue(CARDINALS.units);
const TENS_BY_VALUE = byValue(CARDINALS.tens);
const SCALES_BY_VALUE = byValue(CARDINALS.scales);
const HUNDRED_WORD = SCALES_BY_VALUE.get(HUNDRED) as string;

/**
 * The scales that stand as separate words, largest first — the mirror of
 * `cardinalSpeller`'s descending `bigScales`, and descending for the same
 * reason: the largest scale at or below a magnitude is then always the first
 * match.
 */
const BIG_SCALES = [...new Set(Object.values(CARDINALS.scales))]
  .filter((value) => value >= MILLION)
  .sort((a, b) => b - a)
  .map((value) => {
    const singular = SCALES_BY_VALUE.get(value) as string;
    return { value, singular, plural: pluralize(singular) };
  });

/** Every word-level scale spelling, for the reading direction. */
const BIG_BY_WORD = new Map<string, Decimal>(
  Object.entries(CARDINALS.scales)
    .filter(([, value]) => value >= MILLION)
    .map(([word, value]) => [word, new Decimal(value)]),
);

/** Exclusive, and the same shape `cardinalSpeller` uses: 1000 × the top scale. */
const CEILING = new Decimal((BIG_SCALES[0]?.value ?? THOUSAND) * THOUSAND);

// --- reading ------------------------------------------------------------

/**
 * A piece of a welded numeral. `kind` is what the piece does to the running
 * total, not what it is worth: "cento" and "cent" multiply, "mille" and "mila"
 * close a group of thousands, and everything else adds.
 */
interface Atom {
  readonly word: string;
  readonly value: number;
  readonly kind: "add" | "hundred" | "thousand";
}

const ENDS_IN_VOWEL = /[aeiou]$/;

/**
 * Every string that may appear inside a welded numeral, longest first.
 *
 * The elided stems are *derived* from the words above rather than typed out —
 * "vent" from "venti", "cent" from "cento" — because they are the same elision
 * the speller applies, and two hand-written copies of one rule is how a table
 * starts reading a form it can no longer write.
 */
const ATOMS: readonly Atom[] = (() => {
  const out: Atom[] = [];
  const add = (word: string, value: number, kind: Atom["kind"]) => {
    out.push({ word, value, kind });
  };

  for (const [word, value] of Object.entries(CARDINALS.units)) add(word, value, "add");
  for (const [word, value] of Object.entries(CARDINALS.tens)) {
    add(word, value, "add");
    if (ENDS_IN_VOWEL.test(word)) add(word.slice(0, -1), value, "add");
  }
  for (const [word, value] of Object.entries(CARDINALS.scales)) {
    if (value === HUNDRED) {
      add(word, value, "hundred");
      if (ENDS_IN_VOWEL.test(word)) add(word.slice(0, -1), value, "hundred");
    } else if (value === THOUSAND) {
      add(word, value, "thousand");
    }
    // A million and above is a word of its own and never welded, so it is not
    // an atom at all: see `BIG_BY_WORD`.
  }

  // Longest first, so "venti" is tried before "vent" and "diciotto" before
  // "otto". The scan below still backtracks — "centotto" needs the *shorter*
  // "cent" — but trying the longest first is what makes the common case one
  // pass with no backtracking at all.
  return out.sort((a, b) => b.word.length - a.word.length);
})();

/**
 * One welded numeral → its value, or null if the token is not one.
 *
 * Backtracking, and it has to be: greedy longest-match alone reads "centotto"
 * as "cento" followed by an unparseable "tto" and gives up, where the answer is
 * "cent" + "otto" = 108. The search is bounded by a memo of the offsets already
 * proven dead, which is sound because *whether* the rest of a token parses does
 * not depend on the running total — an atom always sets something, so the
 * accepting test at the end is satisfied by any non-empty consumed prefix.
 *
 * Consuming the *whole* token is required. That is what keeps this from
 * shredding ordinary Italian words that merely begin like a numeral:
 * "centimetro" starts "cent" and "settimana" starts "sett", and neither has a
 * remainder this table can read, so both are refused outright rather than
 * claimed in part.
 */
function decompose(token: string): number | null {
  if (token.length === 0) return null;
  const dead = new Set<number>();

  const scan = (
    at: number,
    total: number,
    current: number,
    set: boolean,
  ): number | null => {
    if (at === token.length) return set || total > 0 ? total + current : null;
    if (dead.has(at)) return null;

    for (const atom of ATOMS) {
      if (!token.startsWith(atom.word, at)) continue;
      let nextTotal = total;
      let nextCurrent = current;
      let nextSet = set;
      if (atom.kind === "thousand") {
        // A bare "mille"/"mila" with nothing in front of it is one thousand,
        // the same implicit 1 `cardinalNumerals` supplies for a bare "hundred".
        nextTotal = total + (set ? current : 1) * THOUSAND;
        nextCurrent = 0;
        nextSet = false;
      } else if (atom.kind === "hundred") {
        nextCurrent = (set ? current : 1) * HUNDRED;
        nextSet = true;
      } else {
        nextCurrent = current + atom.value;
        nextSet = true;
      }
      const found = scan(at + atom.word.length, nextTotal, nextCurrent, nextSet);
      if (found !== null) return found;
    }

    dead.add(at);
    return null;
  };

  return scan(0, 0, 0, false);
}

/**
 * The Italian numeral fold: welded tokens read by `decompose`, detached scale
 * nouns ("milioni", "miliardi") read at the word level, and the two combined
 * the way `cardinalNumerals` combines a scale with what precedes it.
 *
 * "due milioni cinquecentomila" is three words and two shapes at once, which is
 * exactly why neither half alone would do.
 */
export function italianNumerals(): NumeralParser {
  return (words): NumeralMatch | null => {
    let total = new Decimal(0);
    let current = new Decimal(0);
    // Distinct from `current.isZero()` for the same reason as in
    // `cardinalNumerals`: "milioni" alone is a million, "zero" alone is zero.
    let currentSet = false;
    let claimed = false;
    let consumed = 0;

    for (const [index, raw] of words.entries()) {
      const word = raw.toLowerCase();

      const scale = BIG_BY_WORD.get(word);
      if (scale !== undefined) {
        const multiplicand = currentSet ? current : new Decimal(1);
        total = total.plus(multiplicand.times(scale));
        current = new Decimal(0);
        currentSet = false;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      const welded = decompose(word);
      if (welded !== null) {
        current = current.plus(welded);
        currentSet = true;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      break;
    }

    return claimed ? { value: total.plus(current), consumed } : null;
  };
}

// --- writing ------------------------------------------------------------

/** The two units a preceding vowel is elided in front of: *uno* and *otto*. */
const ELIDE_BEFORE = new Set([1, 8]);

const THREE = UNITS_BY_VALUE.get(3) as string;

/** Final "tre" carries an acute accent; anywhere else it does not. */
const accented = (word: string): string => (word === THREE ? THREE_FINAL : word);
const plain = (word: string): string =>
  word.endsWith(THREE_FINAL) ? `${word.slice(0, -THREE_FINAL.length)}${THREE}` : word;

/**
 * Weld `tail` onto `head` inside a hundreds-or-below group, applying both
 * sandhi rules. `tailValue` and not `tail` decides the elision, because 1 and 8
 * elide and 11 does not — see the file's opening comment.
 */
function fuse(head: string, tail: string, tailValue: number): string {
  if (head === "") return accented(tail);
  const stem =
    ELIDE_BEFORE.has(tailValue) && ENDS_IN_VOWEL.test(head) ? head.slice(0, -1) : head;
  return `${stem}${accented(tail)}`;
}

function spellUnderHundred(n: number): string | null {
  const direct = UNITS_BY_VALUE.get(n);
  if (direct !== undefined) return direct;
  const tensValue = Math.floor(n / 10) * 10;
  const tensWord = TENS_BY_VALUE.get(tensValue);
  if (tensWord === undefined) return null;
  const rest = n - tensValue;
  if (rest === 0) return tensWord;
  const unitWord = UNITS_BY_VALUE.get(rest);
  return unitWord === undefined ? null : fuse(tensWord, unitWord, rest);
}

function spellUnderThousand(n: number): string | null {
  if (n < HUNDRED) return spellUnderHundred(n);
  const hundreds = Math.floor(n / HUNDRED);
  const rest = n % HUNDRED;
  // A lone hundred is "cento" and never "unocento": the multiplier is dropped
  // rather than spelled, which is the one place Italian and English agree
  // against Ukrainian's fused двісті.
  const multiplier = hundreds === 1 ? "" : UNITS_BY_VALUE.get(hundreds);
  if (multiplier === undefined) return null;
  const head = `${multiplier}${HUNDRED_WORD}`;
  if (rest === 0) return head;
  const tail = spellUnderHundred(rest);
  return tail === null ? null : fuse(head, tail, rest);
}

/**
 * A whole sub-million magnitude as ONE word, which is what Italian writes.
 * The thousands join takes the accent rule and not the elision rule: 2001 is
 * "duemilauno", and 23,000 is "ventitremila" — the accent that "ventitré"
 * carries on its own disappears the moment "mila" follows it, which is what
 * `plain` undoes.
 */
function spellUnderMillion(n: number): string | null {
  const thousands = Math.floor(n / THOUSAND);
  const rest = n % THOUSAND;

  let head = "";
  if (thousands === 1) {
    head = THOUSAND_ONE;
  } else if (thousands > 1) {
    const multiplier = spellUnderThousand(thousands);
    if (multiplier === null) return null;
    head = `${plain(multiplier)}${THOUSAND_MANY}`;
  }

  if (rest === 0) return head === "" ? null : head;
  const tail = spellUnderThousand(rest);
  if (tail === null) return null;
  return head === "" ? tail : `${head}${accented(tail)}`;
}

/**
 * The inverse of `italianNumerals`, over the same table and the same two sandhi
 * rules — and declining in exactly the three cases `cardinalSpeller` declines,
 * for exactly its reasons: a non-integer has no fractional grammar here, a
 * negative magnitude is a `UnaryNode` in this engine's AST and never a signed
 * literal, and a magnitude at or above 1000 × the largest declared scale has no
 * word left to compose from. `Printer` prints that one value's digits.
 */
export function italianSpeller(): NumeralSpeller {
  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return UNITS_BY_VALUE.get(0) ?? null;

    const parts: string[] = [];
    let rest = value;

    for (const scale of BIG_SCALES) {
      const scaleValue = new Decimal(scale.value);
      if (rest.lt(scaleValue)) continue;
      const multiple = rest.dividedToIntegerBy(scaleValue);
      rest = rest.minus(multiple.times(scaleValue));
      if (multiple.equals(1)) {
        // "un milione", never "uno milione" — the apocopated form is the only
        // one Italian puts in front of a noun.
        parts.push(`${ONE_APOCOPATED} ${scale.singular}`);
        continue;
      }
      const spelled = spellUnderMillion(multiple.toNumber());
      if (spelled === null) return null;
      parts.push(`${spelled} ${scale.plural}`);
    }

    if (!rest.isZero()) {
      const spelled = spellUnderMillion(rest.toNumber());
      if (spelled === null) return null;
      parts.push(spelled);
    }

    return parts.join(" ");
  };
}
