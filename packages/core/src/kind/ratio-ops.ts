import { Decimal } from "../decimal";
import { DimensionMismatchError } from "../errors";
import type { ComparisonOp, EvalCtx, KindId, OpSignature, Value } from "../types";
import type { NormalizedKind } from "./define";

/**
 * The sanctioned way to build the `Value` an op signature returns.
 *
 * `meta` is the design's one generic context mechanism (currently `measure`'s
 * dpi), and it is carried by the *source* operand, never by the caller — so an
 * `apply` cannot forget to propagate it. Pass `target` only when the result is
 * a different kind or unit than the source operand: an affine difference
 * (temperature -> tempdelta) or a derived kind (length x length -> area).
 */
export function deriveValue(
  source: Value,
  canonical: Decimal,
  target: { kind?: KindId; unit?: string } = {},
): Value {
  return Object.freeze({
    kind: target.kind ?? source.kind,
    canonical,
    unit: target.unit ?? source.unit,
    ...(source.meta ? { meta: source.meta } : {}),
  });
}

export const NUMBER_KIND = "number";
export const PERCENT_KIND = "percent";
export const BOOLEAN_KIND = "boolean";
/** The boolean kind's one unit. Named here so core and `@smartput/boolean`
 * cannot drift about what a comparison's result is labelled. */
export const BOOLEAN_UNIT = "bool";

/**
 * Significant digits a comparison rounds to when nothing said otherwise —
 * ruling C4, and deliberately the same 26 `EngineOptions.formatPrecision`
 * defaults to.
 *
 * Core computes at 28 and displays at 26, so the last two digits are guard
 * digits that exist to absorb the drift of a non-terminating ratio. Comparing
 * at 28 would surface exactly that drift: `1 m / 3 * 3 = 1 m` is false at full
 * precision, true of the arithmetic, and useless to the person who typed it.
 * Comparing at 26 makes the rule statable — two values that *print* the same
 * *are* the same — which is the only tolerance a user can predict without
 * knowing the implementation.
 */
export const COMPARE_PRECISION = 26;

/**
 * The six, in the order they are generated. Exported because a consumer that
 * builds an operator picker, or a query layer mapping its own words onto these,
 * should not have to restate the list and risk missing one.
 */
export const COMPARISON_OPS: readonly ComparisonOp[] = ["<", "<=", ">", ">=", "=", "!="];

/**
 * `-1`, `0` or `1`, at the precision the context asked for.
 *
 * The rounding governs `<` and `>` as much as `=` (ruling C6). Tolerating only
 * equality would let `a = b` and `a > b` and `a < b` all be false for two
 * values a digit apart, and a caller branching on three outcomes would find a
 * fourth.
 */
function compareAt(l: Decimal, r: Decimal, ctx: EvalCtx): number {
  const precision = ctx.comparePrecision ?? COMPARE_PRECISION;
  if (precision === "exact") return l.comparedTo(r);
  return l.toSignificantDigits(precision).comparedTo(r.toSignificantDigits(precision));
}

const truth = (value: boolean): Value =>
  Object.freeze({
    kind: BOOLEAN_KIND,
    canonical: new Decimal(value ? 1 : 0),
    unit: BOOLEAN_UNIT,
  });

/**
 * The six comparison signatures for one kind, over its own kind.
 *
 * Same-kind only. A cross-kind comparison is exactly as meaningless as a
 * cross-kind sum — `10 m > 5 h` has no answer — and leaving the signature
 * absent is how this engine has always said so. What makes `1000 mb = 1 gb`
 * work is not a cross-kind rule but the solver: both operands unify to
 * `datasize` and the comparison is over canonical bytes, which is the same
 * mechanism that makes `1 kg + 500 g` a kilogram and a half.
 */
export function generateComparisonOps(kind: NormalizedKind): OpSignature[] {
  const ordered = kind.spec.mode === "ratio" ? true : kind.spec.ordered === true;
  if (!ordered) return [];
  const id = kind.id;
  const of = (op: ComparisonOp, test: (c: number) => boolean): OpSignature => ({
    op,
    left: id,
    right: id,
    result: BOOLEAN_KIND,
    apply: (l, r, ctx) => truth(test(compareAt(l.canonical, r.canonical, ctx))),
  });
  return [
    of("<", (c) => c < 0),
    of("<=", (c) => c <= 0),
    of(">", (c) => c > 0),
    of(">=", (c) => c >= 0),
    of("=", (c) => c === 0),
    of("!=", (c) => c !== 0),
  ];
}

/**
 * Everything a non-affine ratio kind generates beyond `in`. Split out from
 * `generateRatioOps` because an affine kind needs to enumerate exactly this
 * set in order to *close* it — see the affine branch below.
 */
function ordinaryOps(id: KindId): OpSignature[] {
  const ops: OpSignature[] = [
    {
      op: "+",
      left: id,
      right: id,
      result: id,
      apply: (l, r) => deriveValue(l, l.canonical.plus(r.canonical)),
    },
    {
      op: "-",
      left: id,
      right: id,
      result: id,
      apply: (l, r) => deriveValue(l, l.canonical.minus(r.canonical)),
    },
  ];

  if (id === NUMBER_KIND || id === PERCENT_KIND) {
    // Both kinds multiply and divide against themselves: "3 * 4" and
    // "20% * 20%" are the same signature shape as any other kind's `*|K|K`
    // would be, except that here it is meaningful.
    ops.push(
      {
        op: "*",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => deriveValue(l, l.canonical.times(r.canonical)),
      },
      {
        op: "/",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => deriveValue(l, l.canonical.div(r.canonical)),
      },
    );
    // For `number`, the same-kind pair above *is* the number-scaling trio;
    // generating it again would be a duplicate key. `percent` is a different
    // kind from `number`, so it still needs the trio: "20% * 3" and
    // "3 * 20%" have no signature otherwise, while the facade's
    // `Percent.scale(3)` answers them — two public surfaces disagreeing.
    if (id === NUMBER_KIND) return ops;
  }

  ops.push(
    {
      op: "*",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => deriveValue(l, l.canonical.times(r.canonical)),
    },
    {
      op: "*",
      left: NUMBER_KIND,
      right: id,
      result: id,
      apply: (l, r) => deriveValue(r, r.canonical.times(l.canonical)),
    },
    {
      op: "/",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => deriveValue(l, l.canonical.div(r.canonical)),
    },
  );

  // `percent` stops here. It belongs to this generation loop as the kind
  // being scaled, not as the kind doing the scaling, so "20% of 20%" and
  // "20% + 20%"-as-relative-adjustment are deliberately not generated —
  // percent's own `+`/`-` above are ordinary same-kind arithmetic.
  if (id === PERCENT_KIND) return ops;

  ops.push(
    // Percent is relative to the left operand: 50 + 20% is 60, not 50.2.
    // Generated per kind for the same reason number scaling is — so a
    // third-party kind gets it without declaring anything.
    {
      op: "+",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) => deriveValue(l, l.canonical.times(r.canonical.plus(1))),
    },
    {
      op: "-",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) =>
        deriveValue(l, l.canonical.times(new Decimal(1).minus(r.canonical))),
    },
    {
      op: "of",
      left: PERCENT_KIND,
      right: id,
      result: id,
      apply: (l, r) => deriveValue(r, r.canonical.times(l.canonical)),
    },
    // The discount reading, and deliberately not an alias for `-|K|percent`
    // above: that one takes the base on the left, this one takes it on the
    // right, so they are two signatures over the same pair of kinds rather
    // than one signature with two spellings. Same operand order as `of`, and
    // the same source operand for `deriveValue` — the result is the base with
    // a bite taken out of it, so it carries the base's unit and meta.
    {
      op: "off",
      left: PERCENT_KIND,
      right: id,
      result: id,
      apply: (l, r) =>
        deriveValue(r, r.canonical.times(new Decimal(1).minus(l.canonical))),
    },
  );

  return ops;
}

/**
 * Turn a signature into one that refuses. See the affine branch below for why
 * these have to exist rather than simply be absent. The error carries the real
 * operands and the source expression, so it reads like any other
 * DimensionMismatchError in this codebase.
 */
function refuse(sig: OpSignature): OpSignature {
  return {
    ...sig,
    apply: (l, r, ctx): never => {
      throw new DimensionMismatchError(ctx.input ?? "", sig.op, l.kind, r.kind);
    },
  };
}

export function generateRatioOps(kind: NormalizedKind): OpSignature[] {
  if (kind.spec.mode !== "ratio") return [];
  const id = kind.id;
  const affine = kind.spec.affine;

  // Conversion between a kind's own units is always available.
  const ops: OpSignature[] = [
    {
      op: "in",
      left: id,
      right: id,
      result: id,
      apply: (l, r) => deriveValue(r, l.canonical),
    },
  ];

  if (affine !== undefined) {
    // An absolute point on an affine scale has no sum and no product: 20°C +
    // 20°C and 20°C * 2 are both meaningless. Difference is the one
    // exception, and it yields a delta rather than another absolute point.
    ops.push({
      op: "-",
      left: id,
      right: id,
      result: affine.deltaKind,
      apply: (l, r) =>
        deriveValue(l, l.canonical.minus(r.canonical), { kind: affine.deltaKind }),
    });

    // An affine kind cannot express a refusal by *absence* of a signature.
    // Its delta kind shares its aliases (that is what lets "20 C + 5 F" read
    // its right operand as a difference), and the solver silently drops a
    // non-viable assignment (solver.ts), so every key this kind does not own
    // is captured by the delta kind's own generation instead — "20 C * 2"
    // would quietly answer 40°C. So: enumerate exactly what an ordinary kind
    // of this id would generate, and close every key that is not purely
    // same-kind. Same-kind keys are this kind's own business — `in` and `-`
    // are generated above, and `+|T|T` is deliberately left open so the
    // kind's declared `+|T|delta` claims "20 C + 5 C".
    //
    // Derived from `ordinaryOps` rather than hand-listed on purpose: a
    // hand-maintained list drifted inside the milestone that introduced it.
    for (const sig of ordinaryOps(id)) {
      if (sig.left === id && sig.right === id) continue;
      ops.push(refuse(sig));
    }
    return ops;
  }

  ops.push(...ordinaryOps(id));
  return ops;
}
