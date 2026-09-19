import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";
import type { WeightTable } from "./model";
import { ABSTAIN } from "./model";

/**
 * A table written by hand, not trained.
 *
 * Tests need a model whose behaviour they can state — "a frame makes convert
 * win" — and a trained table cannot promise that any individual weight has a
 * given sign. The trainer's output is checked by `chat-eval`, on held-out data,
 * which is the only honest way to check it.
 */
export function fixtureTable(resolverIds: readonly string[]): WeightTable {
  const classes = [...resolverIds, ABSTAIN];
  const row = (weights: Partial<Record<(typeof NAMED_FEATURES)[number], number>>) =>
    NAMED_FEATURES.map((name) => weights[name] ?? 0);

  const named = classes.map((id) => {
    if (id === ABSTAIN) return row({ bias: 1.5 });
    if (id === "convert")
      return row({ frameMatched: 5, holePresent: 2, probeResolves: 2 });
    return row({ probeResolves: 4, probeConfidence: 2, markCount: 1 });
  });

  return {
    locale: "en",
    features: [...NAMED_FEATURES],
    buckets: NGRAM_BUCKETS,
    classes,
    named,
    hashed: btoa(String.fromCharCode(...new Uint8Array(classes.length * NGRAM_BUCKETS))),
    hashedScale: classes.map(() => 0),
  };
}
