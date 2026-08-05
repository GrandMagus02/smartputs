import type { Registry } from "../kind/registry";
import { resolveWeight } from "../solve/weights";
import type { KindId, Locale, Span, Weights } from "../types";
import { leadingCount, trailingFragment } from "./fragment";
import { prefixQuality, scaleFit } from "./score";

export interface Completion {
  /** The alias that matched, e.g. "hour". */
  alias: string;
  /** The fragment this replaces, as offsets into the original input. */
  span: Span;
  /** The whole input rewritten, ready to put back in the box. */
  text: string;
  kind: KindId;
  /** Registry unit key, e.g. "h". */
  unit: string;
  score: number;
}

export interface CompleteOptions {
  /** Hard filter, identical in meaning to EvalOptions.kinds. */
  kinds?: KindId[];
  /** Per-call weight layer 4, identical to EvalOptions.weights. */
  weights?: Weights;
  /** Applied after ranking. Default 10. */
  limit?: number;
}

const DEFAULT_LIMIT = 10;

export function complete(args: {
  registry: Registry;
  locale: Locale;
  layers: (Weights | undefined)[];
  input: string;
  opts?: CompleteOptions;
}): Completion[] {
  const { registry, locale, layers, input, opts } = args;

  const fragment = trailingFragment(input);
  if (fragment === null) return [];

  const folded = fragment.text.normalize("NFKC").toLocaleLowerCase(locale.id);
  const count = leadingCount(input, fragment.span.start, locale) ?? undefined;
  const category = new Intl.PluralRules(locale.id).select(
    count === undefined ? 1 : count.toNumber(),
  );

  // Best row per (kind, unit): "mi" and "mile" are the same unit, and offering
  // both would fill the list with near-duplicates. Mirrors resolve().
  const best = new Map<string, Completion>();

  for (const [alias, entries] of registry.aliasIndex) {
    if (!alias.startsWith(folded)) continue;

    for (const entry of entries) {
      if (opts?.kinds !== undefined && !opts.kinds.includes(entry.kind)) continue;

      const kind = registry.kinds.get(entry.kind);
      if (kind === undefined) continue;
      // Completion inserts "<number><unit>", which a time zone is not. Date
      // completion has its own shape and is out of M4's scope (ruling R8).
      if (kind.spec.mode !== "ratio") continue;
      const unit = kind.units.get(entry.unit);
      if (unit === undefined) continue;

      const score =
        resolveWeight({
          kind: entry.kind,
          unit: entry.unit,
          surface: alias,
          prior: kind.prior,
          layers,
        }) +
        prefixQuality(alias, folded) +
        scaleFit(count, unit.lexeme.typical);

      const word = unit.lexeme.display?.[category] ?? alias;
      const key = `${entry.kind}:${entry.unit}`;
      const existing = best.get(key);

      // Strictly greater, and alias ascending on a tie, so two aliases of equal
      // length (millimetre / millimeter) resolve the same way on every run.
      if (
        existing === undefined ||
        score > existing.score ||
        (score === existing.score && alias < existing.alias)
      ) {
        best.set(key, {
          alias,
          span: fragment.span,
          text:
            input.slice(0, fragment.span.start) + word + input.slice(fragment.span.end),
          kind: entry.kind,
          unit: entry.unit,
          score,
        });
      }
    }
  }

  return [...best.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.kind.localeCompare(b.kind) ||
        a.unit.localeCompare(b.unit) ||
        a.alias.localeCompare(b.alias),
    )
    .slice(0, opts?.limit ?? DEFAULT_LIMIT);
}
