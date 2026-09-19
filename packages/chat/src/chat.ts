import type { Engine, Mark, Result } from "@smartput/core";
import { carve } from "./carve";
import type { EmbeddingFeature } from "./embed";
import { featurize, probe } from "./features";
import { fill } from "./fill";
import { ABSTAIN, type LinearModel } from "./model";
import { Conversation } from "./state";
import type { Candidate, ChatResult, ChatVocabulary, Filled, Resolver } from "./types";

export interface ChatResolverOptions {
  readonly engine: Engine;
  readonly resolvers: readonly Resolver[];
  readonly locales: readonly ChatVocabulary[];
  /** Required and never defaulted: a default would mean the root barrel
   * importing a shipped table, which is the one thing that lives on its own
   * subpath. The same answer `createEngine` gives (design §6). */
  readonly weights: LinearModel;
  /** Tier 2. Read only by `handleAsync` / `handleAllAsync`. */
  readonly embedder?: EmbeddingFeature;
  /** Minimum probability the winning class must reach. */
  readonly threshold?: number;
  readonly conversation?: Conversation;
}

/** Tuned by `chat-eval` on held-out negatives; this is the starting point the
 * first training run replaces. */
const DEFAULT_THRESHOLD = 0.5;

interface Row {
  readonly resolver: Resolver;
  readonly payload: string;
  readonly span: { start: number; end: number };
  readonly score: number;
  readonly filled: readonly Filled[];
  readonly marks: readonly Mark[];
}

/**
 * The spans `scan` marked, as candidates in their own right.
 *
 * `carve` strips a carrier off the two ends and never splits the middle, so a
 * message carrying two requests — "what is 2 + 2 and 3 kg + 1 kg" — has no
 * candidate for either half, and neither does a quantity named in passing:
 * "5 pounds of flour" reads as nothing at all to `suggest`, while `scan` marks
 * the `5 pounds` inside it. The marks are exactly the spans the engine already
 * found, and one answer per request is the reason `handleAll` exists at all
 * (design §6).
 *
 * A span `carve` already emitted is not repeated: the carved candidate carries
 * the frame and the holes it was read with, and this one would carry neither.
 */
function markCandidates(
  marks: readonly Mark[],
  carved: readonly Candidate[],
): Candidate[] {
  const seen = new Set(carved.map((c) => `${c.span.start}:${c.span.end}`));
  const out: Candidate[] = [];
  for (const mark of marks) {
    const key = `${mark.start}:${mark.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      span: { start: mark.start, end: mark.end },
      text: mark.text,
      holes: [],
      stripped: { head: "", tail: "" },
    });
  }
  return out;
}

export class ChatResolver {
  readonly conversation: Conversation;
  readonly #engine: Engine;
  readonly #resolvers: readonly Resolver[];
  readonly #locales: readonly ChatVocabulary[];
  readonly #model: LinearModel;
  readonly #embedder: EmbeddingFeature | undefined;
  readonly #threshold: number;

  constructor(opts: ChatResolverOptions) {
    this.#engine = opts.engine;
    this.#resolvers = opts.resolvers;
    this.#locales = opts.locales;
    this.#model = opts.weights;
    this.#embedder = opts.embedder;
    this.#threshold = opts.threshold ?? DEFAULT_THRESHOLD;
    this.conversation = opts.conversation ?? new Conversation();
  }

  handle(text: string): ChatResult | null {
    return this.#top(this.#rank(text, false));
  }

  handleAll(text: string): ChatResult[] {
    return this.#all(this.#rank(text, false));
  }

  async handleAsync(text: string): Promise<ChatResult | null> {
    return this.#top(await this.#rankAsync(text));
  }

  async handleAllAsync(text: string): Promise<ChatResult[]> {
    return this.#all(await this.#rankAsync(text));
  }

  /**
   * Score every (candidate, resolver) pair.
   *
   * `includeAsync` is the one difference between the two doors, and it is a
   * strict subset rather than a different decision: the synchronous path
   * answers fewer messages, never the same ones worse (design §6).
   */
  #rank(
    text: string,
    includeAsync: boolean,
    embed?: ReadonlyMap<string, { centroid: number; max: number }>,
  ): Row[] {
    const marks = this.#engine.scan(text);
    const rows: Row[] = [];
    const eligible = this.#resolvers.filter((r) => includeAsync || r.async !== true);
    const byId = new Map<string, Resolver>(eligible.map((r) => [r.id, r]));
    const carved = carve(text, this.#locales);

    for (const candidate of [...carved, ...markCandidates(marks, carved)]) {
      const filled = fill(candidate, marks, this.conversation, this.#engine);
      // An unfilled hole is a payload that cannot resolve. Skip the candidate
      // rather than routing to a resolver that will throw on it.
      if (candidate.holes.length > filled.length) continue;
      const scores = this.#model.score(
        featurize({
          input: text,
          candidate,
          marks,
          probe: probe(this.#engine, candidate.text),
          conversation: this.conversation,
        }),
        embed,
      );
      const abstain = scores.get(ABSTAIN) ?? 0;
      for (const [id, score] of scores) {
        const resolver = byId.get(id);
        if (resolver === undefined) continue;
        if (score < this.#threshold || score <= abstain) continue;
        rows.push({
          resolver,
          payload: candidate.text,
          span: candidate.span,
          score,
          filled,
          marks,
        });
      }
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  async #rankAsync(text: string): Promise<Row[]> {
    const embed = await this.#embedder?.score(text);
    return this.#rank(text, true, embed);
  }

  #resolve(row: Row): ChatResult | null {
    const out = row.resolver.resolve(
      { span: row.span, text: row.payload, holes: [], stripped: { head: "", tail: "" } },
      { engine: this.#engine, filled: row.filled, marks: row.marks },
    );
    // A resolver that declared itself synchronous and returned a promise is a
    // bug in that resolver, not a case to paper over.
    if (out instanceof Promise) return null;
    const result = out as Result;
    this.conversation.push({ kind: result.kind, value: result.value, text: row.payload });
    return {
      resolver: row.resolver.id,
      payload: row.payload,
      span: row.span,
      result,
      confidence: row.score,
      filled: row.filled,
    };
  }

  #top(rows: readonly Row[]): ChatResult | null {
    const row = rows[0];
    return row === undefined ? null : this.#resolve(row);
  }

  /** One result per non-overlapping span, best first: a message carrying two
   * requests gets two answers, and two readings of one span get one. */
  #all(rows: readonly Row[]): ChatResult[] {
    const out: ChatResult[] = [];
    const taken: { start: number; end: number }[] = [];
    for (const row of rows) {
      if (taken.some((t) => row.span.start < t.end && t.start < row.span.end)) continue;
      const result = this.#resolve(row);
      if (result === null) continue;
      taken.push(row.span);
      out.push(result);
    }
    return out;
  }
}
