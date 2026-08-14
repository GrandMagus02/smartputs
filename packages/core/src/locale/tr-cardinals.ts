import { Decimal } from "../decimal";
import type { NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * Turkish cardinals: one table, two directions. `cardinalNumerals` reads it to
 * parse "yirmi iki" back to `22`; `turkishSpeller` below reads the same object
 * to spell `22` as "yirmi iki". Hoisted into one const, exactly as
 * `uk-cardinals.ts` does, so the reading and the writing halves can never drift
 * apart.
 *
 * **Turkish is the most regular numeral system this repo has met**, and that is
 * worth stating because it is what lets `tr.ts` hand the *shared*
 * `cardinalNumerals` this table and stop there, where German and French both had
 * to ship a parser of their own. Every number below a million is a run of
 * space-separated words, units after tens, with no infix ("yirmi iki", not
 * German's "zweiundzwanzig"), no vigesimal branch (French's "quatre-vingt-dix"),
 * no fusion (Ukrainian's "п'ятсот") and no connective word at all — which is why
 * `connectors` is absent rather than empty: Turkish has no "and" to skip.
 *
 * Two things it does need, neither of them a parser change:
 *
 * **`on` (10) lives in `tens`, and the teens are not declared.** Turkish writes
 * 11–19 as "on bir" … "on dokuz" — ten plus a unit, two words — so
 * `cardinalNumerals`' flat merge of `units` and `tens` into one table of addends
 * already reads them, and `cardinalSpeller`'s `tensFloor` (the smallest declared
 * `tens` value, 10 here) already composes them. Declaring "onbir" as a key would
 * be a word no run can ever hold.
 *
 * **The ASCII spellings.** Nine of these words carry a letter a Turkish keyboard
 * has and an ASCII one does not — ü, ç, ş, ı — and a hurried typist reaches for
 * the plain letter. Each is a second key on the same value, declared *after* the
 * correct spelling so the speller (which keeps the first word it sees for a
 * value) writes the one a Turk would. They pull a second shift as well, and it
 * is the one this language exists to worry about: `cardinalNumerals` folds an
 * incoming word with the locale-neutral `toLowerCase()`, so an all-caps "SIFIR"
 * arrives as "sifir" and *not* as "sıfır" — the dotless ı is unreachable through
 * that fold. The ASCII key is what catches it. See `tr.ts`'s `caseFolds` for the
 * same hazard on the unit-word side, where it had to be solved differently.
 */
export const CARDINALS: CardinalTables = {
  units: {
    sıfır: 0,
    sifir: 0,
    bir: 1,
    iki: 2,
    üç: 3,
    uc: 3,
    dört: 4,
    dort: 4,
    beş: 5,
    bes: 5,
    altı: 6,
    alti: 6,
    yedi: 7,
    sekiz: 8,
    dokuz: 9,
    // 11–19 are absent on purpose: Turkish composes all nine from `on` plus a
    // unit, and both directions of the shared helper already do that.
  },
  tens: {
    // The one entry that is not a multiple of twenty-something: `on` is here
    // rather than in `units` so that `cardinalSpeller`'s tens/units split has a
    // word to build "on bir" out of. It is an addend either way — "on" never
    // multiplies in Turkish, unlike "yüz" — so parsing is unaffected by which
    // of the two tables it sits in.
    on: 10,
    yirmi: 20,
    otuz: 30,
    kırk: 40,
    kirk: 40,
    elli: 50,
    altmış: 60,
    altmis: 60,
    yetmiş: 70,
    yetmis: 70,
    seksen: 80,
    doksan: 90,
  },
  scales: {
    // A genuine multiplier, unlike Ukrainian's hundreds: "iki yüz" is 2 × 100
    // and is written as two free words, so `yüz` belongs in `scales` and the
    // 200–900 row Ukrainian had to declare word by word does not exist here.
    yüz: 100,
    yuz: 100,
    bin: 1_000,
    milyon: 1_000_000,
    milyar: 1_000_000_000,
    trilyon: 1_000_000_000_000,
  },
  // No `connectors`. Turkish juxtaposes — "yüz beş", never "yüz ve beş" — so
  // there is no word to skip, and declaring "ve" (the ordinary conjunction)
  // would let a numeral swallow the "and" out of an unrelated phrase.
};

const THOUSAND = new Decimal(1000);

/**
 * The first word declared for each value, so a table carrying several spellings
 * of one number spells deterministically instead of picking whichever key
 * iteration happened to reach last. The same rule `cardinalSpeller` states for
 * itself, restated here because this speller and that parser are the two halves
 * that have to agree.
 */
function wordFor(source: Record<string, number>): Map<number, string> {
  const table = new Map<number, string>();
  for (const [word, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, word);
  }
  return table;
}

/**
 * The inverse of `cardinalNumerals` over the table above, and the *only* half of
 * Turkish the shared helpers could not do.
 *
 * The whole of the difference is one rule: **`bin` counts itself.** Turkish says
 * "bin" for 1000 and "bin beş yüz" for 1500 — never "bir bin" — where it says
 * "bir milyon" for 10^6 and "yüz" for 100 without hesitation. `cardinalSpeller`
 * composes every scale as `<multiplier> <scale>`, so it writes the correct "yüz"
 * as "bir yüz" and the correct "bin" as "bir bin": two wrong words on the two
 * commonest round numbers in the language. Everything else below is the shared
 * shape — units and tens add, `yüz` multiplies within a group, the scales at and
 * above a thousand close a group into the running total.
 *
 * Note which way the asymmetry runs, because it is not arbitrary: `yüz` drops
 * its "bir" and `milyon` keeps it, and `bin` sits with `yüz` rather than with
 * `milyon` even though it is a thousand-scale. That is the language, not a
 * simplification — "bin" and "yüz" are numerals, "milyon" and "milyar" are
 * borrowed nouns that need something to count them.
 *
 * Declines on exactly the three cases `cardinalSpeller` declines on, for the
 * same reasons it gives: a non-integer (there is no word for a decimal point
 * anywhere in these tables), a negative magnitude (the AST models a negative
 * quantity as a `UnaryNode` around a non-negative one, so `Printer` never asks
 * for a signed spelling), and a value at or above 1000 × the largest declared
 * scale, where composing the multiplier would itself need a scale one tier
 * higher than the table has. A caller that receives `null` prints that one
 * value's digits.
 */
export function turkishSpeller(tables: CardinalTables): NumeralSpeller {
  const units = wordFor(tables.units);
  const tens = wordFor(tables.tens);
  const scaleWords = wordFor(tables.scales);
  const hundred = scaleWords.get(100);

  // Descending, so the largest scale at or below a magnitude is the first
  // match — the mirror of the parser's left-to-right scan over words.
  const bigScales = [...new Set(Object.values(tables.scales))]
    .filter((v) => v >= 1000)
    .sort((a, b) => b - a)
    .map((value) => ({ value, word: scaleWords.get(value) as string }));
  const ceiling = new Decimal(bigScales[0]?.value ?? 100).times(THOUSAND);

  /**
   * 0–99. Two words at most, tens first: "kırk beş". There is no irregularity
   * in this range at all — no teens to special-case, no "et", no infix — which
   * is why this function is four lines where French's is fifty.
   */
  const under100 = (n: number): string | null => {
    const atom = units.get(n);
    if (atom !== undefined) return atom;
    const tensWord = tens.get(Math.floor(n / 10) * 10);
    if (tensWord === undefined) return null;
    const rest = n % 10;
    if (rest === 0) return tensWord;
    const restWord = units.get(rest);
    return restWord === undefined ? null : `${tensWord} ${restWord}`;
  };

  const under1000 = (n: number): string | null => {
    if (n < 100) return under100(n);
    if (hundred === undefined) return null;
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    let head: string;
    if (hundreds === 1) {
      // "yüz", never "bir yüz" — the first of the two rules this function
      // exists for.
      head = hundred;
    } else {
      const multiplier = under100(hundreds);
      if (multiplier === null) return null;
      head = `${multiplier} ${hundred}`;
    }
    if (rest === 0) return head;
    const tail = under100(rest);
    return tail === null ? null : `${head} ${tail}`;
  };

  const groups = (n: Decimal): string | null => {
    for (const scale of bigScales) {
      const value = new Decimal(scale.value);
      if (n.lt(value)) continue;
      const multiple = n.dividedToIntegerBy(value).toNumber();
      const rest = n.minus(value.times(multiple));
      let head: string;
      if (scale.value === 1000 && multiple === 1) {
        // "bin", never "bir bin" — the second rule, and the reason this is a
        // `scale.value === 1000` test rather than a `multiple === 1` one: the
        // borrowed scale nouns above it do take their "bir".
        head = scale.word;
      } else {
        const multiplier = under1000(multiple);
        if (multiplier === null) return null;
        head = `${multiplier} ${scale.word}`;
      }
      if (rest.isZero()) return head;
      const tail = groups(rest);
      return tail === null ? null : `${head} ${tail}`;
    }
    return under1000(n.toNumber());
  };

  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(ceiling)) return null;
    if (value.isZero()) return units.get(0) ?? null;
    return groups(value);
  };
}
