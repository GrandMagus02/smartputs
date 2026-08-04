import type { AnalyzedForm, Analyzer } from "../types";

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
