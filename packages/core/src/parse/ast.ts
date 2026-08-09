import type { Decimal } from "../decimal";
import type { Candidate, OpSymbol, Span, Value } from "../types";

/**
 * Stable within one Program, assigned depth-first at parse time.
 *
 * The reason this field exists: `Assignment.choices` was a `Map<Node, Candidate>`,
 * keyed by object identity, so a solver result was meaningless without the exact
 * tree object that produced it — unloggable, unsnapshottable, undiffable. One
 * number turns the solver's output from a pointer into a value.
 */
export type NodeId = number;

export interface NumberNode {
  readonly id: NodeId;
  type: "number";
  value: Decimal;
  span: Span;
}

export interface QuantityNode {
  readonly id: NodeId;
  type: "quantity";
  value: Decimal;
  candidates: Candidate[];
  span: Span;
}

/**
 * A run of source one or more kinds claimed. Unlike a quantity, every value is
 * already built — a matcher had to build one to decide its match — so the
 * evaluator has nothing to compute here, only a choice to read.
 *
 * One candidate per reading, exactly as a quantity carries one per unit its word
 * resolved to, so the solver scores, filters and explains this node with the
 * code it already had. `values` is keyed by candidate *identity* rather than by
 * kind and unit, because two readings of one span routinely agree on both:
 * three Springfields are all `place:us` and differ only in which city they are.
 */
export interface LiteralNode {
  readonly id: NodeId;
  type: "literal";
  candidates: Candidate[];
  values: ReadonlyMap<Candidate, Value>;
  span: Span;
}

export interface BinaryNode {
  readonly id: NodeId;
  type: "binary";
  op: Exclude<OpSymbol, "in">;
  left: Node;
  right: Node;
  span: Span;
}

export interface UnaryNode {
  readonly id: NodeId;
  type: "unary";
  op: "-";
  operand: Node;
  span: Span;
}

export interface ConvertNode {
  readonly id: NodeId;
  type: "convert";
  operand: Node;
  target: Candidate[];
  span: Span;
  /** The span of the target unit token alone, distinct from `span`, which covers the whole conversion expression. */
  targetSpan: Span;
  /**
   * The value behind each target a kind claimed outright — "japan to ukraine",
   * where the target is a value rather than a unit label. The evaluator hands
   * one of these to `apply` instead of the stand-in it synthesizes from
   * `target`, because a stand-in carries no `meta`, and a signature that reads
   * the right operand's `meta` is the whole point of a claimed target.
   *
   * A map rather than one value, because `target` may mix claimed readings with
   * the ordinary unit readings of the word underneath them: "3pm in tokyo" is a
   * claimed place and a registered time zone at once, and only the former has a
   * value. A candidate absent from the map gets the stand-in.
   */
  targetValues?: ReadonlyMap<Candidate, Value>;
}

export type Node =
  | NumberNode
  | QuantityNode
  | LiteralNode
  | BinaryNode
  | UnaryNode
  | ConvertNode;

export function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  switch (node.type) {
    case "binary":
      walk(node.left, visit);
      walk(node.right, visit);
      break;
    case "unary":
      walk(node.operand, visit);
      break;
    case "convert":
      walk(node.operand, visit);
      break;
    default:
      break;
  }
}
