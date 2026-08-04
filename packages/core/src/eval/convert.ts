import { Decimal } from "../decimal";
import type { NormalizedKind } from "../kind/define";
import type { EvalCtx, RateLookup, Value } from "../types";

/**
 * Everything a unit's `ratio`/`offset` function might need, in one object.
 *
 * It grows: `note` arrives with a later task. A positional parameter list
 * would let a call site silently omit one — which is exactly the defect M2
 * shipped when `coerce` dropped `kindMeta` and disagreed with `evaluate` about
 * the canonical value of the same input.
 */
export interface ConversionCtx {
  readonly locale: string;
  readonly meta?: Record<string, unknown>;
  readonly rates?: RateLookup;
}

function evalCtxFor(kind: NormalizedKind, unit: string, ctx: ConversionCtx): EvalCtx {
  const self: Value = {
    kind: kind.id,
    canonical: new Decimal(0),
    unit,
    ...(ctx.meta ? { meta: ctx.meta } : {}),
  };
  return { self, locale: ctx.locale, ...(ctx.rates ? { rates: ctx.rates } : {}) };
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
