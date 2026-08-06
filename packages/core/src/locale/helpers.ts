import { Decimal } from "../decimal";
import type { AnalyzedForm, Analyzer, NumeralParser, NumeralSpeller } from "../types";

export function identity(): Analyzer {
  return (surface) => [{ form: surface, weight: 0 }];
}

export function suffixStripper(opts: {
  suffixes: string[];
  minStem: number;
  weight?: number;
}): Analyzer {
  const weight = opts.weight ?? -2;
  // Longest suffix first, so "ами" is tried before "и".
  const suffixes = [...opts.suffixes].sort((a, b) => b.length - a.length);

  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const suffix of suffixes) {
      if (!surface.endsWith(suffix)) continue;
      const stem = surface.slice(0, surface.length - suffix.length);
      if (stem.length === 0 || stem.length < opts.minStem) continue;
      out.push({ form: stem, weight });
    }
    return out;
  };
}

export function tableAnalyzer(table: Record<string, string>, weight = -1): Analyzer {
  return (surface) => {
    const form = table[surface];
    return form === undefined ? [] : [{ form, weight }];
  };
}

/**
 * The four tables a cardinal number system reduces to: `units` (the words
 * with no compositional structure, English 0–19), `tens` (multiples of ten
 * that combine with a `units` word, 20–90), `scales` (multiplicative words —
 * hundred through trillion in English), and an optional `connectors` list
 * (English "and", as in "two hundred and five" — skippable on the way in,
 * never required).
 *
 * `cardinalNumerals` and `cardinalSpeller` both take exactly this shape so a
 * locale can build one const and hand it to both (`en.ts` does) — the same
 * tables read in opposite directions, which is what keeps parsing and
 * spelling from drifting apart as the tables are edited.
 */
export interface CardinalTables {
  units: Record<string, number>;
  tens: Record<string, number>;
  scales: Record<string, number>;
  connectors?: string[];
}

export function cardinalNumerals(opts: CardinalTables): NumeralParser {
  const table = (source: Record<string, number>) =>
    new Map(
      Object.entries(source).map(([word, value]) => [
        word.toLowerCase(),
        new Decimal(value),
      ]),
    );

  const addends = new Map([...table(opts.units), ...table(opts.tens)]);
  const scales = table(opts.scales);
  const connectors = new Set((opts.connectors ?? []).map((w) => w.toLowerCase()));
  const THOUSAND = new Decimal(1000);

  return (words) => {
    let total = new Decimal(0);
    let current = new Decimal(0);
    // Distinct from `current.isZero()` so "hundred" alone reads as 100 while
    // "zero thousand" still reads as 0.
    let currentSet = false;
    let claimed = false;
    // The prefix length at the last accepting state. A connector advances the
    // scan without advancing this, which is what stops "five and kg" from
    // claiming the "and".
    let consumed = 0;

    for (const [index, raw] of words.entries()) {
      const word = raw.toLowerCase();

      const addend = addends.get(word);
      if (addend !== undefined) {
        current = current.plus(addend);
        currentSet = true;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      const scale = scales.get(word);
      if (scale !== undefined) {
        const multiplicand = currentSet ? current : new Decimal(1);
        if (scale.gte(THOUSAND)) {
          total = total.plus(multiplicand.times(scale));
          current = new Decimal(0);
          currentSet = false;
        } else {
          current = multiplicand.times(scale);
          currentSet = true;
        }
        claimed = true;
        consumed = index + 1;
        continue;
      }

      if (claimed && connectors.has(word)) continue;
      break;
    }

    // `total` and `current` only ever advance on an accepting word, so their
    // sum already describes the prefix `consumed` points at.
    return claimed ? { value: total.plus(current), consumed } : null;
  };
}

/**
 * The inverse of `cardinalNumerals`, over the exact same four tables —
 * literally the same options object in `en.ts`, which is what makes "inverse
 * of the numeral fold" a structural fact rather than a description that could
 * quietly stop being true.
 *
 * Spells a non-negative integer the tables can reach; returns `null` for
 * three documented cases, each mirroring something already true on the
 * parsing side rather than a new rule invented for this direction alone:
 *
 * - **Non-integer.** The tables have no fractional grammar — there is no
 *   word for a decimal point anywhere in `units`/`tens`/`scales`, the same
 *   reason `cardinalNumerals` can never read one back out of a run of words
 *   either.
 * - **Negative.** Sign is not part of the numeral fold on the parsing side:
 *   this engine's AST always models a negative quantity as a `UnaryNode`
 *   wrapping a non-negative magnitude (`parse/ast.ts`'s `UnaryNode`), never a
 *   signed number literal, so `Printer` never asks `cardinalSpeller` to spell
 *   a negative value — this case exists for a caller of the helper directly,
 *   and returning `null` (rather than inventing a "negative" word the tables
 *   were never given) keeps that symmetry.
 * - **Too large.** Above `1000 ×` the largest scale the tables declare (a
 *   trillion for `en`, so `999,999,999,999,999`), composing a group under
 *   that scale would itself need a three-digit multiplier this table cannot
 *   spell without a scale one tier higher still — there is no word to
 *   compose from, so this declines rather than guessing a compound like
 *   "thousand trillion". This assumes the tables' own scales chain in
 *   multiples of 1000 above `hundred`, exactly what `cardinalNumerals`
 *   itself assumes (its `scale.gte(THOUSAND)` branch above).
 *
 * A caller that receives `null` is expected to fall back to digits for that
 * one value — `Printer`'s `renderMagnitude` does exactly that when
 * `{ spelled: true }` is set. That is a documented, tested fallback for a
 * specific number, not a silent one for an unimplemented feature: `Printer`
 * throws instead, upfront, when the locale has no `spell` at all (see
 * `PrintOptions.spelled`).
 *
 * The connector (`opts.connectors[0]`, English "and") is used only where the
 * table's own hundred scale joins a sub-100 remainder ("two hundred and
 * five") — it is not repeated at every scale boundary above that ("one
 * thousand five", not "one thousand and five"). One convention, not the only
 * defensible one, but a fixed, tested one: `cardinalNumerals` accepts the
 * connector optionally everywhere `claimed` is already true (see its own
 * comment), so this speller's narrower placement round-trips regardless.
 */
export function cardinalSpeller(opts: CardinalTables): NumeralSpeller {
  const wordFor = (source: Record<string, number>): Map<number, string> => {
    const table = new Map<number, string>();
    // First word for a value wins — a table with two spellings for one value
    // (unlikely, but not forbidden by `cardinalNumerals`'s shape) spells
    // deterministically rather than picking whichever iteration happened to
    // land last.
    for (const [word, value] of Object.entries(source)) {
      if (!table.has(value)) table.set(value, word);
    }
    return table;
  };

  const unitsByValue = wordFor(opts.units);
  const tensByValue = wordFor(opts.tens);
  // Derived, not hardcoded: `cardinalNumerals` merges `units` and `tens` into
  // one flat `addends` map with no boundary assumption of its own (a locale
  // whose `tens` table started at 10, say, would still parse "ten one" fine),
  // so hardcoding "20" here — the boundary that happens to hold for `en` —
  // would make this speller decline values that same table's parser reads
  // without trouble, quietly breaking the inverse-of-the-same-tables property
  // that is the whole reason these two functions share `CardinalTables`. The
  // smallest declared `tens` value is the actual boundary: below it, a value
  // has no `tens` word to combine with, so only a direct `units` entry (see
  // `spellUnderHundred`'s own `direct` lookup) can name it.
  const tensFloor =
    tensByValue.size > 0 ? Math.min(...tensByValue.keys()) : Number.POSITIVE_INFINITY;

  const HUNDRED = new Decimal(100);
  const THOUSAND = new Decimal(1000);
  const scaleEntries = Object.entries(opts.scales).map(([word, value]) => ({
    word,
    value: new Decimal(value),
  }));
  const hundred = scaleEntries.find((e) => e.value.equals(HUNDRED));
  // Descending, so the largest scale at or below a given magnitude is always
  // the first match — the mirror of `cardinalNumerals`'s left-to-right scan
  // over words, just walked over values instead.
  const bigScales = scaleEntries
    .filter((e) => e.value.gte(THOUSAND))
    .sort((a, b) => (a.value.gte(b.value) ? -1 : 1));
  const connector = opts.connectors?.[0];
  // Exclusive: see the doc comment's "too large" case above.
  const ceiling = (bigScales[0]?.value ?? HUNDRED).times(THOUSAND);

  const spellUnderHundred = (n: Decimal): string | null => {
    const value = n.toNumber();
    const direct = unitsByValue.get(value);
    if (direct !== undefined) return direct;
    if (value < tensFloor) return null; // below any declared tens word
    const tensValue = Math.floor(value / 10) * 10;
    const tensWord = tensByValue.get(tensValue);
    if (tensWord === undefined) return null;
    const remainder = value - tensValue;
    if (remainder === 0) return tensWord;
    const unitsWord = unitsByValue.get(remainder);
    return unitsWord === undefined ? null : `${tensWord} ${unitsWord}`;
  };

  const spellUnderThousand = (n: Decimal): string | null => {
    if (hundred === undefined || n.lt(HUNDRED)) return spellUnderHundred(n);
    const multiple = n.dividedToIntegerBy(HUNDRED);
    const remainder = n.minus(multiple.times(HUNDRED));
    const head = spellUnderHundred(multiple);
    if (head === null) return null;
    if (remainder.isZero()) return `${head} ${hundred.word}`;
    const tail = spellUnderHundred(remainder);
    if (tail === null) return null;
    return connector !== undefined
      ? `${head} ${hundred.word} ${connector} ${tail}`
      : `${head} ${hundred.word} ${tail}`;
  };

  const spellGroups = (n: Decimal): string | null => {
    for (const scale of bigScales) {
      if (n.gte(scale.value)) {
        const multiple = n.dividedToIntegerBy(scale.value);
        const remainder = n.minus(multiple.times(scale.value));
        const head = spellUnderThousand(multiple);
        if (head === null) return null;
        if (remainder.isZero()) return `${head} ${scale.word}`;
        const tail = spellGroups(remainder);
        if (tail === null) return null;
        return `${head} ${scale.word} ${tail}`;
      }
    }
    return spellUnderThousand(n);
  };

  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(ceiling)) return null;
    if (value.isZero()) return unitsByValue.get(0) ?? null;
    return spellGroups(value);
  };
}
