import type { Engine, Mark } from "@smartput/core";
import type { KindId } from "@smartput/kind/types";
import type { Conversation } from "./state";
import type { Candidate } from "./types";

/**
 * What `engine.suggest` said about a candidate span on its own.
 *
 * `suggest` and not `evaluate`: it never throws, and ambiguity is the signal
 * wanted here rather than an error to catch. This is the load-bearing feature
 * of the whole model — "2 + 2" resolves and "is 2 + 2" does not, so carving
 * checks itself against the engine and the classifier only has to learn which
 * frame introduced a payload (design §4.3).
 */
export interface Probe {
  readonly resolves: boolean;
  readonly confidence: number;
  readonly kind?: KindId;
  /** Readings returned. Greater than 1 is ambiguity, which is evidence. */
  readonly count: number;
}

export function probe(engine: Engine, text: string): Probe {
  const trimmed = text.trim();
  if (trimmed === "") return { resolves: false, confidence: 0, count: 0 };
  const found = engine.suggest(trimmed);
  const top = found[0];
  if (top === undefined) return { resolves: false, confidence: 0, count: 0 };
  return {
    resolves: true,
    confidence: top.confidence,
    kind: top.kind,
    count: found.length,
  };
}

export interface FeatureInput {
  readonly input: string;
  readonly candidate: Candidate;
  readonly marks: readonly Mark[];
  readonly probe: Probe;
  readonly conversation: Conversation;
}

/**
 * The named rows, in a fixed order the weight table's columns match.
 *
 * Kind identity is deliberately NOT here. A named row per kind would fix the
 * vector's length to the kinds installed when the model was trained, and kinds
 * are registered at runtime — a consumer's own `defineKind` has to be routable
 * by a table trained before it existed (design §1.1). Kind identity goes into
 * the hashed space instead, where an unseen name costs a bucket rather than a
 * shape mismatch.
 *
 * Appending to this list invalidates every trained table: adding a row means
 * re-running `bun run chat:train`.
 */
export const NAMED_FEATURES = [
  "bias",
  "markCount",
  "topConfidence",
  "confidenceMargin",
  "cueCount",
  "frameMatched",
  "greetingStripped",
  "politenessStripped",
  "leadingInterrogative",
  "payloadRatio",
  "probeResolves",
  "probeConfidence",
  "probeReadingCount",
  "holePresent",
  "stateHasCompatible",
] as const;

const INTERROGATIVE = /^\s*(what|how|which|when|where|why|who)\b/i;

/** Squash an unbounded count into [0, 1) so one long message cannot dominate. */
const squash = (n: number) => n / (n + 1);

export function namedFeatures(inp: FeatureInput): Float64Array {
  const { candidate, marks, probe: p, conversation } = inp;
  const top = marks[0]?.readings[0]?.confidence ?? 0;
  const second = marks[0]?.readings[1]?.confidence ?? 0;
  const cues = marks.reduce((n, m) => n + m.cues.length, 0);
  const hole = candidate.holes[0];
  // An empty `kind` means "any": carve could not know it yet, so a conversation
  // holding anything at all is compatible. `fill` narrows it later.
  const compatible =
    hole === undefined
      ? false
      : hole.kind === ""
        ? conversation.size > 0
        : conversation.last(hole.kind) !== undefined;

  const v = new Float64Array(NAMED_FEATURES.length);
  const set = (name: (typeof NAMED_FEATURES)[number], value: number) => {
    v[NAMED_FEATURES.indexOf(name)] = value;
  };

  set("bias", 1);
  set("markCount", squash(marks.length));
  set("topConfidence", top);
  set("confidenceMargin", top - second);
  set("cueCount", squash(cues));
  set("frameMatched", candidate.frame === undefined ? 0 : 1);
  set("greetingStripped", candidate.stripped.head === "" ? 0 : 1);
  set("politenessStripped", candidate.stripped.tail === "" ? 0 : 1);
  // Reads the WHOLE input and not the candidate: the word this looks for is the
  // one `carve` just removed, so reading the stripped span would pin it to zero.
  set("leadingInterrogative", INTERROGATIVE.test(inp.input) ? 1 : 0);
  set(
    "payloadRatio",
    inp.input.length === 0 ? 0 : candidate.text.length / inp.input.length,
  );
  set("probeResolves", p.resolves ? 1 : 0);
  set("probeConfidence", p.confidence);
  set("probeReadingCount", squash(p.count));
  set("holePresent", candidate.holes.length === 0 ? 0 : 1);
  set("stateHasCompatible", compatible ? 1 : 0);

  return v;
}
