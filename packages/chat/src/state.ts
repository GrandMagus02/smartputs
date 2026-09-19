import type { KindId, Value } from "@smartput/kind/types";

export interface ConversationEntry {
  readonly kind: KindId;
  readonly value: Value;
  /** The surface the value was read from, kept for explanation and training. */
  readonly text: string;
}

/** Entries kept. Eight turns is far enough back for a referent to still mean
 * what the user thinks it means, and short enough that a stale value cannot
 * win a lookup a fresh one should have. */
const DEFAULT_LIMIT = 8;

/**
 * The referent memory, and the whole of it.
 *
 * Deliberately not a dialogue model: no turns, no roles, no intent history. A
 * hole carries the kind it needs, so `candidates(kind)` is the entire
 * coreference mechanism — "convert this to kg" needs a mass, and a state
 * holding one length and one mass has no contest to resolve (design §4.5).
 *
 * Most recent first everywhere, because a referent means the thing most
 * recently said and every caller wants the same order.
 */
export class Conversation {
  #entries: ConversationEntry[] = [];
  readonly #limit: number;

  constructor(limit: number = DEFAULT_LIMIT) {
    this.#limit = Math.max(1, limit);
  }

  push(entry: ConversationEntry): void {
    this.#entries.push(entry);
    if (this.#entries.length > this.#limit) {
      this.#entries = this.#entries.slice(-this.#limit);
    }
  }

  last(kind?: KindId): Value | undefined {
    return this.candidates(kind)[0];
  }

  candidates(kind?: KindId): readonly Value[] {
    const out: Value[] = [];
    for (let i = this.#entries.length - 1; i >= 0; i--) {
      const entry = this.#entries[i];
      if (entry === undefined) continue;
      if (kind === undefined || entry.kind === kind) out.push(entry.value);
    }
    return out;
  }

  clear(): void {
    this.#entries = [];
  }

  get size(): number {
    return this.#entries.length;
  }
}
