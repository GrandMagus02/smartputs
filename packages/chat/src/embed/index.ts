import type { EmbedScores } from "../model";

/** Tier 2's contract. Implemented in full in the next task. */
export interface EmbeddingFeature {
  score(text: string): Promise<ReadonlyMap<string, EmbedScores>>;
}
