import type { AnalyzedForm, Language } from "../types";
import { identity } from "./helpers";

export function createAnalyzerChain(
  language: Language,
): (surface: string) => AnalyzedForm[] {
  const chain = [...(language.analyze ?? [identity()])];
  const ctx = { locale: language.id };
  const cache = new Map<string, AnalyzedForm[]>();

  return (surface) => {
    const hit = cache.get(surface);
    if (hit !== undefined) return hit;

    const best = new Map<string, AnalyzedForm>();
    for (const analyzer of chain) {
      for (const produced of analyzer(surface, ctx)) {
        const weight = produced.weight ?? 0;
        const existing = best.get(produced.form);
        if (existing === undefined || weight > (existing.weight ?? 0)) {
          best.set(produced.form, { ...produced, weight });
        }
      }
    }

    const forms = [...best.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    cache.set(surface, forms);
    return forms;
  };
}
