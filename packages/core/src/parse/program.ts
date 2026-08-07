import { deepFreeze } from "../freeze";
import type { Node, NodeId } from "./ast";
import { walk } from "./ast";
import type { Resolver } from "./candidates";
import type { NormalizedInput } from "./normalize";
import { parse } from "./pratt";
import type { TokenStream } from "./tokenizer";

/**
 * A parsed expression, plus the input it came from. This is the "list of
 * commands" the design calls for — the list just has structure, because
 * `2 * (3 + 4)` does. A flat postfix stream would be a lossy projection: the
 * printer would have to re-derive where parentheses go and every span would
 * have to move onto the instruction. The tree already carries both.
 */
export interface Program {
  /**
   * Every `span` (and `ConvertNode.targetSpan`) reachable from here indexes
   * `input.text` — the normalized string — not `input.source`, the caller's
   * original. The two only ever differ after normalization edits (NFKC
   * folding, dash/degree stripping, whitespace collapsing), but when they do,
   * slicing `source` with a node's raw span is the exact bug this format's
   * spec opens with. Call `input.mapSpan(span)` first to get a `source`-relative
   * span.
   */
  readonly root: Node;
  /** Depth-first, id-indexed. `nodes[n.id] === n` for every node. */
  readonly nodes: readonly Node[];
  readonly input: NormalizedInput;
}

export function buildProgram(root: Node, input: NormalizedInput): Program {
  const nodes: Node[] = [];
  let visited = 0;
  walk(root, (node) => {
    visited += 1;
    nodes[node.id] = node;
  });

  // A hole means the parser skipped an id, which would make `nodes[id]`
  // silently undefined at every later stage. Fail here, where the cause is one
  // file away.
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i] === undefined) {
      throw new Error(`buildProgram: no node has id ${i} — the parser skipped one`);
    }
  }

  // A dense, hole-free array is not sufficient on its own: two nodes sharing
  // one id leave no hole — the second write just overwrites the first — and a
  // Resolution's Record<NodeId, Candidate> has no way to tell the two apart
  // either, so a solve() would silently score one node's candidate against the
  // other's slot. Counting what `walk` actually visited against how many
  // distinct ids survived into `nodes` is what catches that a hole check
  // cannot.
  if (visited !== nodes.length) {
    throw new Error(
      `buildProgram: walk visited ${visited} nodes but only ${nodes.length} ids are distinct — two nodes share an id`,
    );
  }

  // `input` is already frozen by `normalize`; freezing it again is a no-op, and
  // deepFreeze on the tree is what makes every later stage's "frozen output"
  // claim true rather than aspirational.
  return Object.freeze({
    root: deepFreeze(root),
    nodes: Object.freeze(nodes) as readonly Node[],
    input,
  });
}

export interface ParserOptions {
  resolver: Resolver;
}

/**
 * Pratt parsing over a `Resolver`, plus `buildProgram`, holding the resolver so
 * a caller reusing one `Parser` across a thousand keystrokes does not have to
 * restate it. `TokenStream` carries its own `NormalizedInput`, which is what
 * lets `parse` map a `NoCandidateError`'s span back to the caller's string
 * instead of leaving it normalized-relative — see `pratt.ts`.
 */
export class Parser {
  private readonly resolver: Resolver;

  constructor(cfg: ParserOptions) {
    this.resolver = cfg.resolver;
    Object.freeze(this);
  }

  run(stream: TokenStream): Program {
    const node = parse(
      // `parse` takes a mutable Token[]; a TokenStream's is frozen, so this is
      // a shallow copy, not a cast past the readonly modifier.
      [...stream.tokens],
      this.resolver,
      stream.input.source,
      // Not `stream.input.mapSpan` bare: that detaches the method from its
      // receiver, and `mapSpan` reads `this.offsets` and `this.nfkcShifted`.
      (span) => stream.input.mapSpan(span),
    );
    return buildProgram(node, stream.input);
  }
}
