import { parse } from "./parse";
import type { Ctx, Input, Ok, Parsed, ParseOptions, UnitTable } from "./types";

const EMPTY_CTX: Ctx = {};

export function ratioOf<U extends string>(
  table: UnitTable<U>,
  unit: U,
  ctx?: Ctx,
): number {
  const r = table.ratio[unit];
  // One typeof check, paid by every kind, so `measure`'s dpi-relative px is a
  // unit rather than a second exclusion.
  return typeof r === "function" ? r(ctx ?? EMPTY_CTX) : Number(r);
}

export function offsetOf<U extends string>(table: UnitTable<U>, unit: U): number {
  const o = table.offset?.[unit];
  return o === undefined ? 0 : Number(o);
}

/** `canonical = (value + offset) * ratio` — the order core's convert.ts uses. */
export function toCanonical<U extends string>(
  table: UnitTable<U>,
  value: number,
  unit: U,
  ctx?: Ctx,
): number {
  return (value + offsetOf(table, unit)) * ratioOf(table, unit, ctx);
}

export function fromCanonical<U extends string>(
  table: UnitTable<U>,
  canonical: number,
  unit: U,
  ctx?: Ctx,
): number {
  return canonical / ratioOf(table, unit, ctx) - offsetOf(table, unit);
}

/** Parse a string input, or pass an already-parsed one through. */
export function coerce<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return typeof a === "string" ? parse(table, a, opts) : a;
}

/**
 * The magnitude of a known-good value expressed in `to`. Shared by `convert`
 * and `ops.as`.
 *
 * A unit's own ratio divides out exactly in arithmetic and not at all reliably
 * in binary floating point: `30deg` out to radians and back is
 * 29.999999999999996. One comparison buys an identity that is actually the
 * identity.
 */
export function rebase<U extends string>(
  table: UnitTable<U>,
  a: Ok<U>,
  to: U,
  ctx?: Ctx,
): number {
  if (a.unit === to) return a.value;
  return fromCanonical(table, toCanonical(table, a.value, a.unit, ctx), to, ctx);
}

export function convert<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  to: U,
  opts?: ParseOptions<U>,
): number | undefined {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return undefined;
  return rebase(table, parsed, to, opts?.ctx);
}

/** Exported for ops.ts, which needs the canonical magnitude of a known-good value. */
export function canonicalOf<U extends string>(
  table: UnitTable<U>,
  a: Ok<U>,
  ctx?: Ctx,
): number {
  return toCanonical(table, a.value, a.unit, ctx);
}
