import type { Decimal } from "../decimal";
import type { Candidate, OpSymbol, Span, Value } from "../types";

export interface NumberNode {
  type: "number";
  value: Decimal;
  span: Span;
}

export interface QuantityNode {
  type: "quantity";
  value: Decimal;
  candidates: Candidate[];
  span: Span;
}

/**
 * A run of source a kind claimed outright. Unlike a quantity, the value is
 * already built — the matcher had to build it to decide the match — so the
 * evaluator has nothing to compute here. The candidate list exists purely so
 * the node is scored, filtered and explained like every other operand.
 */
export interface LiteralNode {
  type: "literal";
  value: Value;
  candidates: Candidate[];
  span: Span;
}

export interface BinaryNode {
  type: "binary";
  op: Exclude<OpSymbol, "in">;
  left: Node;
  right: Node;
  span: Span;
}

export interface UnaryNode {
  type: "unary";
  op: "-";
  operand: Node;
  span: Span;
}

export interface ConvertNode {
  type: "convert";
  operand: Node;
  target: Candidate[];
  span: Span;
  /** The span of the target unit token alone, distinct from `span`, which covers the whole conversion expression. */
  targetSpan: Span;
  /**
   * Present when a kind claimed the target outright — "japan to ukraine", where
   * the target is a value rather than a unit label. The evaluator hands this to
   * `apply` instead of the stand-in it synthesizes from `target`, because a
   * stand-in carries no `meta`, and a signature that reads the right operand's
   * `meta` is the whole point of a claimed target.
   */
  targetValue?: Value;
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
