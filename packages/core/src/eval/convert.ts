import { Decimal } from "../decimal";
import type { NormalizedKind } from "../kind/define";
import type { EvalCtx, Value } from "../types";

function ctxFor(
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta: Record<string, unknown> | undefined,
): EvalCtx {
  const self: Value = {
    kind: kind.id,
    canonical: new Decimal(0),
    unit,
    ...(meta ? { meta } : {}),
  };
  return { self, locale };
}

export function toCanonical(
  value: Decimal,
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta?: Record<string, unknown>,
): Decimal {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  const ctx = ctxFor(kind, unit, locale, meta);
  return value.plus(def.offset(ctx)).times(def.ratio(ctx));
}

export function fromCanonical(
  canonical: Decimal,
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta?: Record<string, unknown>,
): Decimal {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  const ctx = ctxFor(kind, unit, locale, meta);
  return canonical.div(def.ratio(ctx)).minus(def.offset(ctx));
}
