import { Decimal } from "../decimal";
import type { AnalyzedForm, Analyzer, NumeralParser } from "../types";

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

export function cardinalNumerals(opts: {
  units: Record<string, number>;
  tens: Record<string, number>;
  scales: Record<string, number>;
  connectors?: string[];
}): NumeralParser {
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
