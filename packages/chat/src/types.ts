import type { Engine, Mark, Result } from "@smartput/core";
import type { KindId, Span, Value } from "@smartput/kind/types";

/** A slot a candidate needs and the message did not supply. */
export interface Hole {
  readonly slot: string;
  /** The kind a value must have to fill this slot. The coreference filter. */
  readonly kind: KindId;
}

/**
 * One reading of what the message was asking, before anything scored it.
 *
 * `carve` emits several per message and never one: committing to a span before
 * any evidence is weighed is how a carver acquires a rule nobody can state
 * (design §4.2).
 */
export interface Candidate {
  /** Caller-relative, like `Mark.start`/`end` and never normalized. */
  readonly span: Span;
  /** `input.slice(span.start, span.end)`, carried so no caller re-slices. */
  readonly text: string;
  /** Which intent frame matched, if any. */
  readonly frame?: string;
  readonly holes: readonly Hole[];
  /** What was removed from each end, for the feature extractor to read. */
  readonly stripped: { readonly head: string; readonly tail: string };
}

/** A hole filled from conversation state. */
export interface Filled {
  readonly slot: string;
  readonly from: "state";
  readonly value: Value;
  /** The surface the value was originally typed as — "5 pounds".
   * A resolver hands this back to the engine rather than rebuilding a display
   * number from a canonical `Decimal`, which would be arithmetic this package
   * does not do. */
  readonly text: string;
}

export interface ChatResult<T = Result> {
  readonly resolver: string;
  readonly payload: string;
  readonly span: Span;
  readonly result: T;
  readonly confidence: number;
  readonly filled: readonly Filled[];
}

/** What a resolver is handed. Deliberately not the conversation: a resolver
 * reads the values that were already filled for it, and never reaches back
 * into state to choose differently from what was scored. */
export interface ResolveCtx {
  readonly engine: Engine;
  readonly filled: readonly Filled[];
  readonly marks: readonly Mark[];
}

export interface Resolver<T = Result> {
  readonly id: string;
  /** Locale id -> the intent frames this resolver answers. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  /** Kinds whose presence argues for this resolver. */
  readonly kinds?: readonly KindId[];
  /** Tier 2 only: locale id -> example phrasings, embedded once at warm-up. */
  readonly prototypes?: Readonly<Record<string, readonly string[]>>;
  /** True when `resolve` returns a promise. Excluded from `handle` (design §5). */
  readonly async?: boolean;
  resolve(candidate: Candidate, ctx: ResolveCtx): T | Promise<T>;
}

export interface ChatVocabulary {
  readonly id: string;
  /** Head-only, like query's `leading`. */
  readonly greetings: readonly string[];
  readonly leading: readonly string[];
  /** Tail-only, like query's `trailing`. */
  readonly trailing: readonly string[];
  /** Words standing in for a prior value — "this", "that", "it". */
  readonly referents: readonly string[];
  /** Frame id -> spellings. `"convert" -> ["convert", "turn", "make"]`. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  readonly interrogatives: readonly string[];
}
