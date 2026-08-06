import { deepFreeze } from "../freeze";
import type { Node, NodeId } from "./ast";
import { walk } from "./ast";
import type { NormalizedInput } from "./normalize";

/**
 * A parsed expression, plus the input it came from. This is the "list of
 * commands" the design calls for — the list just has structure, because
 * `2 * (3 + 4)` does. A flat postfix stream would be a lossy projection: the
 * printer would have to re-derive where parentheses go and every span would
 * have to move onto the instruction. The tree already carries both.
 */
export interface Program {
  readonly root: Node;
  /** Depth-first, id-indexed. `nodes[n.id] === n` for every node. */
  readonly nodes: readonly Node[];
  readonly input: NormalizedInput;
}

export function buildProgram(root: Node, input: NormalizedInput): Program {
  const nodes: Node[] = [];
  walk(root, (node) => {
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

  // `input` is already frozen by `normalize`; freezing it again is a no-op, and
  // deepFreeze on the tree is what makes every later stage's "frozen output"
  // claim true rather than aspirational.
  return Object.freeze({
    root: deepFreeze(root),
    nodes: Object.freeze(nodes) as readonly Node[],
    input,
  });
}

export type { NodeId };
