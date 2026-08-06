import { canonicalOf, coerce, fromCanonical, rebase } from "./convert";
import type { Err, Input, Ok, Parsed, ParseOptions, UnitTable } from "./types";

/**
 * `raw` defaults to `String(value)`, which is always in the grammar `parse`
 * accepts — including the `1e+22` and `1e-7` forms `String` reaches for at the
 * extremes — so `parse(format(result))` round-trips in strict mode.
 */
const ok = <U extends string>(value: number, unit: U, raw?: string): Ok<U> =>
  Object.freeze({
    ok: true as const,
    value,
    unit,
    raw: raw ?? String(value),
  }) as Ok<U>;

/**
 * Both operands, or the first `Err`. Short-circuiting on the first failure is
 * what makes the free ops composable without try/catch — and the returned Err
 * carries its own `input`, so a message names the operand that broke.
 */
function pair<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): [Ok<U>, Ok<U>] | Err {
  const left = coerce(table, a, opts);
  if (!left.ok) return left;
  const right = coerce(table, b, opts);
  if (!right.ok) return right;
  return [left, right];
}

function combine<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  sign: 1 | -1,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return both;
  const [left, right] = both;

  // Matching units do the arithmetic where they already are. Going out to
  // canonical and back multiplies and divides by one ratio for no reason, and
  // in binary floating point that is not free: `30deg - 15deg` comes back as
  // 14.999999999999998. (Affine tables would disagree with this branch, since
  // their round trip also adds and removes an offset — but an affine kind
  // exports `diff`, never `add`/`sub`, exactly because `20°C + 20°C` has no
  // meaning to get right.)
  if (left.unit === right.unit) return ok(left.value + sign * right.value, left.unit);

  const canonical =
    canonicalOf(table, left, opts?.ctx) + sign * canonicalOf(table, right, opts?.ctx);
  // The left operand's unit is inherited, matching the engine's documented
  // rule: 1 kg + 500 g is 1.5 kilograms, not 1500 g.
  return ok(fromCanonical(table, canonical, left.unit, opts?.ctx), left.unit);
}

export function add<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return combine(table, a, b, 1, opts);
}

export function sub<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return combine(table, a, b, -1, opts);
}

export function scale<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  factor: number,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return parsed;
  return ok(parsed.value * factor, parsed.unit);
}

export function negate<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return scale(table, a, -1, opts);
}

export function as<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  to: U,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return parsed;
  return ok(rebase(table, parsed, to, opts?.ctx), to);
}

export function equals<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  epsilon = 0,
  opts?: ParseOptions<U>,
): boolean {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return false;
  const [left, right] = both;
  return (
    Math.abs(
      canonicalOf(table, left, opts?.ctx) - canonicalOf(table, right, opts?.ctx),
    ) <= epsilon
  );
}

export function compare<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): -1 | 0 | 1 | undefined {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return undefined;
  const [left, right] = both;
  const l = canonicalOf(table, left, opts?.ctx);
  const r = canonicalOf(table, right, opts?.ctx);
  return l < r ? -1 : l > r ? 1 : 0;
}

/**
 * Compact, not pretty: "30deg", never "30 degrees". Round-tripping through
 * `parse` in strict mode is this path's contract; locale formatting is the
 * engine's job.
 */
export function format<U extends string>(_table: UnitTable<U>, a: Ok<U>): string {
  return `${a.raw}${a.unit}`;
}

/** Re-exported so a caller needs one import for parse-and-convert. */
export { coerce, convert, fromCanonical, toCanonical } from "./convert";
