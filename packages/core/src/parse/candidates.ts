import type { Registry } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { resolveWeight } from "../solve/weights";
import type { Candidate, Locale, LocalePack, Weights } from "../types";

export interface Resolver {
  resolve(surface: string): Candidate[];
  nearest(surface: string): string[];
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

export function createResolver(args: {
  registry: Registry;
  locale: Locale;
  packs: LocalePack[];
  layers: (Weights | undefined)[];
}): Resolver {
  const analyze = createAnalyzerChain(args.locale, args.packs);
  const fold = (s: string) => s.toLocaleLowerCase(args.locale.id);

  return {
    resolve(surface) {
      const found = new Map<string, Candidate>();

      for (const analyzed of analyze(surface)) {
        const entries = args.registry.aliasIndex.get(fold(analyzed.form));
        if (entries === undefined) continue;

        for (const entry of entries) {
          const kind = args.registry.kinds.get(entry.kind);
          if (kind === undefined) continue;

          const weight =
            resolveWeight({
              kind: entry.kind,
              unit: entry.unit,
              surface: fold(surface),
              prior: kind.prior,
              layers: args.layers,
            }) + (analyzed.weight ?? 0);

          const key = `${entry.kind}:${entry.unit}`;
          const existing = found.get(key);
          if (existing === undefined || weight > existing.weight) {
            found.set(key, {
              kind: entry.kind,
              unit: entry.unit,
              weight,
              surface,
              form: analyzed.form,
            });
          }
        }
      }

      return [...found.values()].sort(
        (a, b) =>
          b.weight - a.weight ||
          a.kind.localeCompare(b.kind) ||
          a.unit.localeCompare(b.unit),
      );
    },

    nearest(surface) {
      const target = fold(surface);
      return [...args.registry.aliasIndex.keys()]
        .map((alias) => ({ alias, d: editDistance(target, alias) }))
        .filter((x) => x.d > 0 && x.d <= 2)
        .sort((a, b) => a.d - b.d || a.alias.localeCompare(b.alias))
        .slice(0, 3)
        .map((x) => x.alias);
    },
  };
}
