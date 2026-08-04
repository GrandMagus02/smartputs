import { Decimal } from "../decimal";
import { DimensionMismatchError, DivideByZeroError } from "../errors";
import { NUMBER_KIND, opKey, type Registry } from "../kind/registry";
import type { Node } from "../parse/ast";
import type { Assignment } from "../solve/solver";
import type { EvalCtx, OpSignature, Value } from "../types";
import { toCanonical } from "./convert";

export interface EvalResult {
  value: Value;
  assumptions: string[];
}

export function evaluateNode(
  node: Node,
  assignment: Assignment,
  registry: Registry,
  locale: string,
  input: string,
  kindMeta: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): EvalResult {
  const assumptions: string[] = [];
  const ctxFor = (self: Value): EvalCtx => ({ self, locale });

  const note = (sig: OpSignature): void => {
    if (sig.assumption !== undefined && !assumptions.includes(sig.assumption)) {
      assumptions.push(sig.assumption);
    }
  };

  const evalNode = (n: Node): Value => {
    switch (n.type) {
      case "number":
        return Object.freeze({ kind: NUMBER_KIND, canonical: n.value, unit: "one" });

      case "quantity": {
        const choice = assignment.choices.get(n);
        if (choice === undefined)
          throw new DimensionMismatchError(input, "quantity", "?", "?");
        const kind = registry.kinds.get(choice.kind);
        if (kind === undefined)
          throw new DimensionMismatchError(input, "quantity", choice.kind, "?");
        // Per-kind default meta is how a px measure learns its dpi without the
        // evaluator knowing what dpi is.
        const meta = kindMeta[choice.kind];
        return Object.freeze({
          kind: choice.kind,
          canonical: toCanonical(n.value, kind, choice.unit, locale, meta),
          unit: choice.unit,
          ...(meta ? { meta } : {}),
        });
      }

      case "unary": {
        const operand = evalNode(n.operand);
        return Object.freeze({ ...operand, canonical: operand.canonical.negated() });
      }

      case "convert": {
        const operand = evalNode(n.operand);
        const target = assignment.choices.get(n);
        if (target === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, "?");
        const sig = registry.ops.get(opKey("in", operand.kind, target.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, target.kind);
        note(sig);
        const rhs: Value = Object.freeze({
          kind: target.kind,
          canonical: new Decimal(0),
          unit: target.unit,
          ...(operand.meta ? { meta: operand.meta } : {}),
        });
        return Object.freeze(sig.apply(operand, rhs, ctxFor(operand)));
      }

      case "binary": {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        if (n.op === "/" && right.canonical.isZero()) throw new DivideByZeroError(input);
        const sig = registry.ops.get(opKey(n.op, left.kind, right.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, n.op, left.kind, right.kind);
        note(sig);
        return Object.freeze(sig.apply(left, right, ctxFor(left)));
      }
    }
  };

  return { value: evalNode(node), assumptions };
}
