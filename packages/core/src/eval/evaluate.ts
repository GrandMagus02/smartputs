import { Decimal } from "../decimal";
import { DimensionMismatchError, DivideByZeroError } from "../errors";
import { deepFreeze } from "../freeze";
import { NUMBER_KIND, opKey, type Registry } from "../kind/registry";
import type { Node } from "../parse/ast";
import type { Program } from "../parse/program";
import type { Resolution } from "../solve/solver";
import type { Assumption, EvalCtx, OpSignature, RateLookup, Value } from "../types";
import { toCanonical } from "./convert";

export interface EvalResult {
  value: Value;
  assumptions: Assumption[];
}

export interface EvaluateOptions {
  program: Program;
  resolution: Resolution;
  registry: Registry;
  locale: string;
  input: string;
  kindMeta?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  rates?: RateLookup;
  /** Significant digits a comparison rounds to. See `COMPARE_PRECISION`. */
  comparePrecision?: number | "exact";
}

export function evaluateNode(opts: EvaluateOptions): EvalResult {
  const { program, resolution, registry, locale, input, rates, comparePrecision } = opts;
  const kindMeta = opts.kindMeta ?? {};
  const assumptions: Assumption[] = [];
  const seen = new Set<string>();
  const note = (a: Assumption): void => {
    const key = JSON.stringify([a.code, a.message, a.detail ?? null]);
    if (seen.has(key)) return;
    seen.add(key);
    assumptions.push(a);
  };
  const noteSignature = (sig: OpSignature): void => {
    if (sig.assumption !== undefined) note(sig.assumption);
  };
  const ctxFor = (self: Value): EvalCtx => ({
    self,
    locale,
    input,
    note,
    ...(rates ? { rates } : {}),
    ...(comparePrecision === undefined ? {} : { comparePrecision }),
  });

  const evalNode = (n: Node): Value => {
    switch (n.type) {
      case "number":
        return deepFreeze({ kind: NUMBER_KIND, canonical: n.value, unit: "one" });

      case "literal": {
        // A matcher already built every one of these; the assignment says which
        // one this reading of the input meant. Nothing is recomputed here — and
        // nothing is picked here either, which is why "90210" can be a number
        // under `evaluate` and a postal code under `suggest` without the two
        // disagreeing about what the parser saw.
        const choice = resolution.choices[n.id];
        const value = choice === undefined ? undefined : n.values.get(choice);
        if (value === undefined) {
          const kind = choice?.kind ?? n.candidates[0]?.kind ?? "?";
          throw new DimensionMismatchError(input, "literal", kind, "?");
        }
        return deepFreeze({ ...value });
      }

      case "quantity": {
        const choice = resolution.choices[n.id];
        if (choice === undefined)
          throw new DimensionMismatchError(input, "quantity", "?", "?");
        const kind = registry.kinds.get(choice.kind);
        if (kind === undefined)
          throw new DimensionMismatchError(input, "quantity", choice.kind, "?");
        // Per-kind default meta is how a px measure learns its dpi without the
        // evaluator knowing what dpi is.
        const meta = kindMeta[choice.kind];
        return deepFreeze({
          kind: choice.kind,
          canonical: toCanonical(n.value, kind, choice.unit, {
            locale,
            ...(meta ? { meta } : {}),
            ...(rates ? { rates } : {}),
          }),
          unit: choice.unit,
          ...(meta ? { meta } : {}),
        });
      }

      case "unary": {
        const operand = evalNode(n.operand);
        return deepFreeze({ ...operand, canonical: operand.canonical.negated() });
      }

      case "convert": {
        const operand = evalNode(n.operand);
        const target = resolution.choices[n.id];
        if (target === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, "?");
        const sig = registry.ops.get(opKey("in", operand.kind, target.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, target.kind);
        noteSignature(sig);
        // The stand-in exists because an ordinary conversion target is a unit
        // label with no value behind it, and `in` signatures read `r.unit`
        // alone. A claimed target does have a value — and its own meta, which
        // the stand-in would replace with the *left* operand's. Which of the two
        // applies is settled by whether the assigned candidate came from a
        // claim, so the kinds cannot disagree the way they could when one value
        // stood for a whole list of targets.
        const claimed = n.targetValues?.get(target);
        const rhs: Value =
          claimed ??
          deepFreeze({
            kind: target.kind,
            canonical: new Decimal(0),
            unit: target.unit,
            ...(operand.meta ? { meta: operand.meta } : {}),
          });
        return deepFreeze(sig.apply(operand, rhs, ctxFor(operand)));
      }

      case "binary": {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        if (n.op === "/" && right.canonical.isZero()) throw new DivideByZeroError(input);
        const sig = registry.ops.get(opKey(n.op, left.kind, right.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, n.op, left.kind, right.kind);
        noteSignature(sig);
        return deepFreeze(sig.apply(left, right, ctxFor(left)));
      }
    }
  };

  return { value: evalNode(program.root), assumptions };
}
