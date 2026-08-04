import type { Decimal } from "../decimal";
import type { Candidate, OpSymbol, Span } from "../types";

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
}

export type Node = NumberNode | QuantityNode | BinaryNode | UnaryNode | ConvertNode;

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
