import { ChatError } from "./errors";
import type { FeatureVector } from "./features";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";

/**
 * The class a router needs and a "least bad resolver" scorer cannot express.
 *
 * Most chat messages are not requests, so abstain is trained as a class rather
 * than bolted on as a threshold: a model that can only rank resolvers against
 * each other will answer every greeting in the room (design §4.4).
 */
export const ABSTAIN = "abstain";

/** Tier 2's two rows per class, from `EmbeddingFeature`. */
export interface EmbedScores {
  readonly centroid: number;
  readonly max: number;
}

/**
 * A trained table, as `src/weights/<locale>.json` holds it.
 *
 * `features` and `buckets` are recorded rather than assumed: a table trained
 * before a feature row was added is not merely stale, it is silently wrong —
 * every weight after the inserted row lands on the wrong column. Recording
 * both turns that into a startup error.
 */
export interface WeightTable {
  readonly locale: string;
  /** Must equal `NAMED_FEATURES` for this build. */
  readonly features: readonly string[];
  /** Must equal `NGRAM_BUCKETS` for this build. */
  readonly buckets: number;
  /** Resolver ids plus `ABSTAIN`. */
  readonly classes: readonly string[];
  /** `[class][namedFeature]`. */
  readonly named: readonly (readonly number[])[];
  /** int8, class-major, base64 — `classes.length * buckets` bytes. */
  readonly hashed: string;
  /** Per-class dequantisation scale. */
  readonly hashedScale: readonly number[];
  /** Tier 2, optional: `[class] -> [centroidWeight, maxWeight]`. */
  readonly embed?: readonly (readonly [number, number])[];
}

/**
 * Multinomial logistic regression over the named rows, the hashed buckets and
 * — when a table was trained with them — tier 2's two embedding rows.
 *
 * One model and one decision path. Tier 2 contributes features here rather
 * than scoring in parallel, because two routers disagreeing need a tiebreak
 * rule and there is no honest place to put one (design §7).
 */
export class LinearModel {
  readonly classes: readonly string[];
  readonly #named: readonly (readonly number[])[];
  readonly #hashed: Int8Array;
  readonly #scale: readonly number[];
  readonly #embed: readonly (readonly [number, number])[] | undefined;

  private constructor(table: WeightTable, hashed: Int8Array) {
    this.classes = table.classes;
    this.#named = table.named;
    this.#hashed = hashed;
    this.#scale = table.hashedScale;
    this.#embed = table.embed;
  }

  static from(table: WeightTable): LinearModel {
    if (table.features.join(",") !== NAMED_FEATURES.join(",")) {
      throw new ChatError(
        "model",
        `weight table lists ${table.features.length} features, this build has ${NAMED_FEATURES.length}; retrain with \`bun run chat:train\``,
      );
    }
    if (table.buckets !== NGRAM_BUCKETS) {
      throw new ChatError(
        "model",
        `weight table has ${table.buckets} hash buckets, this build has ${NGRAM_BUCKETS}`,
      );
    }
    const bytes = Uint8Array.from(atob(table.hashed), (c) => c.charCodeAt(0));
    const expected = table.classes.length * table.buckets;
    if (bytes.length !== expected) {
      throw new ChatError(
        "model",
        `weight table has ${bytes.length} hashed bytes, expected ${expected}`,
      );
    }
    return new LinearModel(table, new Int8Array(bytes.buffer));
  }

  score(v: FeatureVector, embed?: ReadonlyMap<string, EmbedScores>): Map<string, number> {
    const logits = this.classes.map((id, c) => {
      const named = this.#named[c] ?? [];
      let sum = 0;
      for (let f = 0; f < NAMED_FEATURES.length; f++) {
        sum += (named[f] ?? 0) * (v.named[f] ?? 0);
      }
      const scale = this.#scale[c] ?? 0;
      const base = c * NGRAM_BUCKETS;
      for (const [bucket, value] of v.hashed) {
        sum += (this.#hashed[base + bucket] ?? 0) * scale * value;
      }
      const weights = this.#embed?.[c];
      const scores = embed?.get(id);
      if (weights !== undefined && scores !== undefined) {
        sum += weights[0] * scores.centroid + weights[1] * scores.max;
      }
      return sum;
    });

    // Softmax, shifted by the max so a large logit cannot overflow `exp`.
    const top = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - top));
    const total = exps.reduce((a, b) => a + b, 0);
    const out = new Map<string, number>();
    this.classes.forEach((id, c) => {
      out.set(id, (exps[c] ?? 0) / total);
    });
    return out;
  }
}
