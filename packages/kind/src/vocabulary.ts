import { deepFreeze } from "./freeze";
import type { Vocabulary } from "./types";

/**
 * A vocabulary is data, and data that reaches the registry must not change
 * under it — the alias index is built once from these tables and never
 * rebuilt. Deep-frozen for the same reason `defineKind` deep-freezes a
 * descriptor.
 */
export function defineVocabulary(v: Vocabulary): Vocabulary {
  return deepFreeze(v);
}
