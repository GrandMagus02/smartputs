import { Decimal } from "../decimal";
import type { NumeralParser, NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * French cardinals: one table, two directions — `frenchNumerals` reads it to
 * parse "quatre-vingt-dix-sept" back to `97`, `frenchSpeller` reads the same
 * object to spell `97` as "quatre-vingt-dix-sept". Hoisted into one const,
 * exactly as `uk-cardinals.ts` does, so the reading and the writing halves can
 * never drift apart.
 *
 * What French does *not* share with the two languages already shipped, and the
 * reason the two functions below exist beside `cardinalNumerals` /
 * `cardinalSpeller` rather than instead of a call to them:
 *
 * **The vigesimal eighty.** 80 is `quatre-vingts` — literally "four twenties",
 * a multiplication written as a compound — and 90 is `quatre-vingt-dix`, that
 * product plus ten. Neither the shared parser nor the shared speller can reach
 * it. Handing `vingt` to `scales` as a multiplier of 20 gets `quatre-vingts`
 * right and then reads `cent vingt` (120) as `100 × 20` = 2000, because `cent`
 * is a multiplier too and the shared fold has no notion of which multipliers
 * may stack. Leaving `vingt` an addend gets 120 right and reads
 * `quatre-vingt-deux` as `4 + 20 + 2` = 26. There is no arrangement of these
 * four tables that answers both, so the parser below special-cases exactly one
 * pair of adjacent words — `quatre` followed by `vingt`/`vingts` — and is the
 * shared fold in every other respect. 70 and 90 then fall out as ordinary
 * sums (`soixante` + `dix`, the eighty digraph + `dix`) and need no rule of
 * their own, which is why only one is written.
 *
 * **A plural -s that depends on what follows.** `vingt` and `cent` take an -s
 * when they are a bare multiplier ending the number — `quatre-vingts`, `deux
 * cents` — and lose it the moment another numeral follows: `quatre-vingt-un`,
 * `deux cent un`. They lose it before `mille` as well (`deux cent mille`,
 * `quatre-vingt mille`), because `mille` is an invariable numeral and not a
 * noun, and keep it before `millions` (`deux cents millions`), because that
 * one is. The shared speller composes a group without knowing what comes after
 * it, so this is threaded through as a single flag.
 *
 * **Hyphens, which the token stream has already dealt with.** `normalize()`
 * maps every dash to "-", the lexer emits it as an op, and `foldNumerals`'
 * `collectRun` absorbs a hyphen that joins two words with no space on either
 * side. So "vingt-deux" arrives here as `["vingt", "deux"]` and the parser
 * never sees a hyphen at all — the *speller* writes them, and the round trip
 * closes through the token stream rather than through this file.
 *
 * As in `uk-cardinals.ts`, a value with more than one spelling declares the one
 * to *write* first: both reverse maps below keep the first word they see for a
 * value, so `un` beats the feminine `une`, `vingt` beats the `vingts` that
 * exists only to be read inside `quatre-vingts`, and `zéro` beats the
 * accent-free `zero` that exists only because keyboards are what they are.
 */
export const CARDINALS: CardinalTables = {
  units: {
    zéro: 0,
    // Reading only. A French keyboard has é, and a hurried typist does not
    // always reach for it; nothing else in this table carries an accent, so
    // this is the whole of the concession.
    zero: 0,
    un: 1,
    // Feminine agreement — "une tonne", "vingt et une minutes". An extra key on
    // 1, never the spelling, so the speller keeps the masculine "un".
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    // 17, 18 and 19 are deliberately absent. French writes them as dix-sept,
    // dix-huit, dix-neuf — a hyphenated *sum* of two words already in this
    // table — and the token stream splits that hyphen before the parser is
    // offered the run, so `["dix", "sept"]` already adds to 17. The speller
    // composes them from the same two entries. Declaring "dix-sept" as a key
    // would be a word no run can ever hold, matched by nothing and read by
    // nobody.
  },
  tens: {
    vingt: 20,
    // Reading only, and load-bearing: the -s of "quatre-vingts" survives the
    // hyphen split, so the eighty digraph has to recognise the plural half as
    // readily as the singular one. Alone it is not French, which costs nothing
    // — nobody writes it alone.
    vingts: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
    // 70, 80 and 90 are absent for the same reason 17–19 are: French composes
    // all three. soixante-dix is 60 + 10, quatre-vingts is 4 × 20, and
    // quatre-vingt-dix is that product + 10. Only the product needs a rule; see
    // the digraph in `frenchNumerals`.
  },
  scales: {
    cent: 100,
    // The plural multiplier, "deux cents". Reading only, as with `vingts`.
    cents: 100,
    // Invariable: French writes "deux mille", never "deux milles", so unlike
    // every other scale here this one has no plural key to declare.
    mille: 1_000,
    million: 1_000_000,
    millions: 1_000_000,
    // French counts on the long scale: `milliard` is 10^9 and `billion` is
    // 10^12, where English `billion` is 10^9. The two words collide across
    // languages and the engine resolves it the way it resolves every numeral
    // tie — `foldNumerals` takes the longest claim, then the heavier
    // `locale:` weight, then the id ascending. "billion" alone is a one-word
    // claim in both languages, so `en` wins the tie by id and an English
    // reading is never made worse by French being installed; "deux billions"
    // is a two-word claim only French can make, so a French reader still gets
    // 10^12. A deployment that wants the other answer moves it with a
    // `locale:` weight rather than by deleting a word French genuinely has.
    milliard: 1_000_000_000,
    milliards: 1_000_000_000,
    billion: 1_000_000_000_000,
    billions: 1_000_000_000_000,
  },
  // "et" joins a unit to a ten only at 21, 31 … 61 and 71 ("vingt et un",
  // "soixante et onze") and appears nowhere else in a French numeral — notably
  // not at 81 or 91, which are "quatre-vingt-un" and "quatre-vingt-onze". It is
  // a connector rather than an operator here, and `keywords` claims no French
  // word for addition that could contest it: "plus" is the one, and "et" is not
  // among its spellings.
  connectors: ["et"],
};

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const THOUSAND = new Decimal(1000);
const EIGHTY = new Decimal(80);

/**
 * The first word declared for each value, so a table carrying several
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

function valueFor(source: Record<string, number>): Map<string, Decimal> {
  return new Map(
    Object.entries(source).map(([word, value]) => [
      word.toLowerCase(),
      new Decimal(value),
    ]),
  );
}

/** Every spelling of a value, for the digraph, which must accept both halves. */
function spellingsOf(source: Record<string, number>, value: number): Set<string> {
  return new Set(
    Object.entries(source)
      .filter(([, v]) => v === value)
      .map(([word]) => word.toLowerCase()),
  );
}

/**
 * `cardinalNumerals`' fold with one French rule added: `quatre` immediately
 * followed by `vingt` or `vingts` is 80, claimed as a single addend before
 * either word is looked up on its own.
 *
 * Everything else is the shared behaviour, and deliberately so — addends sum,
 * a scale below a thousand multiplies whatever has accumulated, a scale at or
 * above a thousand closes a group into the running total, and a connector
 * advances the scan without advancing the claim (which is what stops "cinq et
 * kg" from swallowing the "et"). Both words of the digraph are read off the
 * tables by value rather than spelled out here, so a table that renames them
 * renames them once.
 */
export function frenchNumerals(tables: CardinalTables): NumeralParser {
  const addends = new Map([...valueFor(tables.units), ...valueFor(tables.tens)]);
  const scales = valueFor(tables.scales);
  const connectors = new Set((tables.connectors ?? []).map((w) => w.toLowerCase()));
  const four = wordFor(tables.units).get(4);
  const twenties = spellingsOf(tables.tens, 20);

  return (words) => {
    let total = ZERO;
    let current = ZERO;
    // Distinct from `current.isZero()` so "cent" alone reads as 100 while
    // "zéro mille" still reads as 0.
    let currentSet = false;
    let claimed = false;
    // The prefix length at the last accepting state. A connector advances the
    // scan without advancing this.
    let consumed = 0;
    let i = 0;

    while (i < words.length) {
      const word = (words[i] as string).toLowerCase();

      // The vigesimal eighty, tried before `quatre` can be claimed as 4 on its
      // own. Two words, one addend — and an addend rather than a scale, because
      // "cent quatre-vingts" is 100 + 80 and not 100 × 80.
      if (
        four !== undefined &&
        word === four &&
        twenties.has((words[i + 1] ?? "").toLowerCase())
      ) {
        current = current.plus(EIGHTY);
        currentSet = true;
        claimed = true;
        i += 2;
        consumed = i;
        continue;
      }

      const addend = addends.get(word);
      if (addend !== undefined) {
        current = current.plus(addend);
        currentSet = true;
        claimed = true;
        i += 1;
        consumed = i;
        continue;
      }

      const scale = scales.get(word);
      if (scale !== undefined) {
        const multiplicand = currentSet ? current : ONE;
        if (scale.gte(THOUSAND)) {
          total = total.plus(multiplicand.times(scale));
          current = ZERO;
          currentSet = false;
        } else {
          current = multiplicand.times(scale);
          currentSet = true;
        }
        claimed = true;
        i += 1;
        consumed = i;
        continue;
      }

      if (claimed && connectors.has(word)) {
        i += 1;
        continue;
      }
      break;
    }

    return claimed ? { value: total.plus(current), consumed } : null;
  };
}

/**
 * The inverse of `frenchNumerals`, over the same four tables.
 *
 * Declines on exactly the three cases `cardinalSpeller` declines on, for the
 * same reasons it gives: a non-integer (there is no word for a decimal point
 * anywhere in these tables), a negative magnitude (the AST models a negative
 * quantity as a `UnaryNode` around a non-negative one, so `Printer` never asks
 * for a signed spelling), and a value at or above 1000 × the largest declared
 * scale, where composing the multiplier would itself need a scale one tier
 * higher than the table has. A caller that receives `null` prints that one
 * value's digits.
 *
 * The `plural` flag threaded through the three levels is French's own rule, not
 * a generalisation: it is true when the group being spelled ends the number or
 * is followed by a *noun* scale (million, milliard, billion) and false when it
 * is followed by `mille`, which is invariable. It reaches `vingt` and `cent`
 * and nothing else, because those are the only two numerals in the language
 * that inflect.
 */
export function frenchSpeller(tables: CardinalTables): NumeralSpeller {
  const units = wordFor(tables.units);
  const tens = wordFor(tables.tens);
  const scaleWords = wordFor(tables.scales);
  const connector = tables.connectors?.[0];

  const unit = (n: number) => units.get(n);
  const cent = scaleWords.get(100);
  const mille = scaleWords.get(1000);

  // Descending, so the largest scale at or below a magnitude is the first
  // match — the mirror of the parser's left-to-right scan over words.
  const bigScales = [...new Set(Object.values(tables.scales))]
    .filter((v) => v >= 1000)
    .sort((a, b) => b - a)
    .map((value) => ({ value, word: scaleWords.get(value) as string }));
  const ceiling = new Decimal(bigScales[0]?.value ?? 100).times(THOUSAND);

  /**
   * 0–99, the range where every French irregularity lives.
   *
   * Four bands, each a different composition: the atoms up to 16; the teens as
   * `dix` plus a unit; the regular tens up to 69, where a remainder of exactly
   * 1 takes "et" and every other remainder takes a hyphen; the seventies as
   * `soixante` plus a teen, keeping the "et" at 71 alone; and the eighties and
   * nineties as the vigesimal compound plus everything from 1 to 19.
   */
  const under100 = (n: number, plural: boolean): string | null => {
    const atom = unit(n);
    if (atom !== undefined && n < 17) return atom;

    const ten = unit(10);
    const one = unit(1);
    if (n < 20) {
      const rest = unit(n - 10);
      return ten === undefined || rest === undefined ? null : `${ten}-${rest}`;
    }

    if (n < 70) {
      const tensWord = tens.get(Math.floor(n / 10) * 10);
      if (tensWord === undefined) return null;
      const rest = n % 10;
      if (rest === 0) return tensWord;
      // "vingt et un", "soixante et un" — and no hyphen, which is the
      // traditional spelling still dominant in print. The 1990 reform's
      // "vingt-et-un" is equally correct and reads back identically here, since
      // the lexer absorbs the hyphens and the parser skips the connector
      // either way; one spelling had to be chosen to write.
      if (rest === 1 && connector !== undefined && one !== undefined) {
        return `${tensWord} ${connector} ${one}`;
      }
      const restWord = unit(rest);
      return restWord === undefined ? null : `${tensWord}-${restWord}`;
    }

    const sixty = tens.get(60);
    if (n < 80) {
      if (sixty === undefined) return null;
      const rest = n - 60;
      const eleven = unit(11);
      // 71 is "soixante et onze": the "et" belongs to the *remainder of one*
      // that the underlying 60 + 11 hides, and it appears here and nowhere else
      // in the seventies.
      if (rest === 11 && connector !== undefined && eleven !== undefined) {
        return `${sixty} ${connector} ${eleven}`;
      }
      const rest_ = under100(rest, plural);
      return rest_ === null ? null : `${sixty}-${rest_}`;
    }

    const four = unit(4);
    const twenty = tens.get(20);
    if (four === undefined || twenty === undefined) return null;
    const base = `${four}-${twenty}`;
    const rest = n - 80;
    // The bare eighty is the only place the -s is written, and only when
    // nothing follows it: "quatre-vingts" against "quatre-vingt-un" and
    // "quatre-vingt mille". `vingts` is a declared reading key, so the printed
    // form resolves back through the same table that produced it.
    if (rest === 0) return plural ? `${base}s` : base;
    // 81–99 take no "et" at all, which is the asymmetry with 21–71 that a
    // reader of this function should see stated rather than infer from the
    // absence of a branch.
    const rest_ = under100(rest, plural);
    return rest_ === null ? null : `${base}-${rest_}`;
  };

  const under1000 = (n: number, plural: boolean): string | null => {
    if (n < 100) return under100(n, plural);
    if (cent === undefined) return null;
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    let head: string;
    if (hundreds === 1) {
      // "cent", never "un cent" — French does not count the single hundred any
      // more than it counts the single thousand.
      head = cent;
    } else {
      const multiplier = under100(hundreds, false);
      if (multiplier === null) return null;
      head = `${multiplier} ${cent}${rest === 0 && plural ? "s" : ""}`;
    }
    if (rest === 0) return head;
    const tail = under100(rest, plural);
    return tail === null ? null : `${head} ${tail}`;
  };

  const groups = (n: Decimal): string | null => {
    for (const scale of bigScales) {
      const value = new Decimal(scale.value);
      if (n.lt(value)) continue;
      const multiple = n.dividedToIntegerBy(value).toNumber();
      const rest = n.minus(value.times(multiple));
      let head: string;
      if (scale.value === 1000) {
        if (mille === undefined) return null;
        // `mille` is invariable and takes no multiplier at one: 1000 is
        // "mille", not "un mille". Whatever multiplies it spells with its
        // plurals suppressed — "deux cent mille", "quatre-vingt mille" —
        // because `mille` is a numeral and not the noun that would license
        // them.
        if (multiple === 1) head = mille;
        else {
          const multiplier = under1000(multiple, false);
          if (multiplier === null) return null;
          head = `${multiplier} ${mille}`;
        }
      } else {
        // million, milliard, billion: nouns. They take their own -s above one,
        // and they license the -s on whatever counts them.
        const multiplier = under1000(multiple, true);
        if (multiplier === null) return null;
        head = `${multiplier} ${scale.word}${multiple > 1 ? "s" : ""}`;
      }
      if (rest.isZero()) return head;
      const tail = groups(rest);
      return tail === null ? null : `${head} ${tail}`;
    }
    return under1000(n.toNumber(), true);
  };

  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(ceiling)) return null;
    if (value.isZero()) return units.get(0) ?? null;
    return groups(value);
  };
}
