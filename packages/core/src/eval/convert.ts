import type { KindContext } from "@smartput/kind/contracts";
import { Decimal } from "../decimal";
import type { NormalizedKind } from "../kind/define";
import type { EvalCtx, RateLookup, Value } from "../types";

/**
 * Everything a unit's `ratio`/`offset` function might need, in one object.
 *
 * It grows: earlier drafts expected `note` (the assumption sink) to land
 * here too, but M3 Task 4 deliberately put it on `EvalCtx` instead. A unit
 * ratio sees only one unit — it has no way to name the cross-rate pivot a
 * conversion went through, since that requires seeing both sides of the
 * conversion. `note` belongs where both operands are visible, which is
 * `EvalCtx`, not here. A positional parameter list for what does live here
 * would let a call site silently omit a field — which is exactly the defect
 * M2 shipped when `coerce` dropped `kindMeta` and disagreed with `evaluate`
 * about the canonical value of the same input.
 */
export interface ConversionCtx {
  readonly locale: string;
  readonly meta?: Record<string, unknown>;
  readonly rates?: RateLookup;
  /**
   * Per-kind configuration, keyed by kind id and opaque to core (§G). Here for
   * the same reason `rates` is: a unit whose ratio is a function of a plugin's
   * table reads that table off the ctx, and after §G the table arrives in a
   * slot rather than in a field of its own.
   */
  readonly context?: KindContext;
}

function evalCtxFor(kind: NormalizedKind, unit: string, ctx: ConversionCtx): EvalCtx {
  const self: Value = {
    kind: kind.id,
    canonical: new Decimal(0),
    unit,
    ...(ctx.meta ? { meta: ctx.meta } : {}),
  };
  return {
    self,
    locale: ctx.locale,
    ...(ctx.rates ? { rates: ctx.rates } : {}),
    ...(ctx.context ? { context: ctx.context } : {}),
  };
}

function unitOf(kind: NormalizedKind, unit: string) {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  return def;
}

export function toCanonical(
  value: Decimal,
  kind: NormalizedKind,
  unit: string,
  ctx: ConversionCtx,
): Decimal {
  const def = unitOf(kind, unit);
  const evalCtx = evalCtxFor(kind, unit, ctx);
  return value.plus(def.offset(evalCtx)).times(def.ratio(evalCtx));
}

export function fromCanonical(
  canonical: Decimal,
  kind: NormalizedKind,
  unit: string,
  ctx: ConversionCtx,
): Decimal {
  const def = unitOf(kind, unit);
  const evalCtx = evalCtxFor(kind, unit, ctx);
  return canonical.div(def.ratio(evalCtx)).minus(def.offset(evalCtx));
}
