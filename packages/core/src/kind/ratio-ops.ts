import { Decimal } from "../decimal";
import type { OpSignature, Value } from "../types";
import type { NormalizedKind } from "./define";

const wrap = (proto: Value, canonical: Decimal): Value =>
  Object.freeze({
    kind: proto.kind,
    canonical,
    unit: proto.unit,
    ...(proto.meta ? { meta: proto.meta } : {}),
  });

export const NUMBER_KIND = "number";
export const PERCENT_KIND = "percent";

export function generateRatioOps(kind: NormalizedKind): OpSignature[] {
  if (kind.spec.mode !== "ratio") return [];
  const id = kind.id;
  const affine = kind.spec.affine;

  // Conversion between a kind's own units is always available.
  const ops: OpSignature[] = [
    { op: "in", left: id, right: id, result: id, apply: (l, r) => wrap(r, l.canonical) },
  ];

  if (affine !== undefined) {
    // An absolute point on an affine scale has no sum and no product: 20°C + 20°C
    // and 20°C * 2 are both meaningless. Difference is the one exception, and it
    // yields a delta rather than another absolute point. Everything else this
    // kind supports is declared explicitly by the kind itself.
    ops.push({
      op: "-",
      left: id,
      right: id,
      result: affine.deltaKind,
      apply: (l, r) =>
        Object.freeze({
          kind: affine.deltaKind,
          canonical: l.canonical.minus(r.canonical),
          unit: l.unit,
        }),
    });
    return ops;
  }

  if (id === NUMBER_KIND) {
    ops.push(
      {
        op: "+",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.plus(r.canonical)),
      },
      {
        op: "-",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.minus(r.canonical)),
      },
      {
        op: "*",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.times(r.canonical)),
      },
      {
        op: "/",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.div(r.canonical)),
      },
    );
    return ops;
  }

  if (id === PERCENT_KIND) {
    // Percent has no sum with itself — spec §8's three behaviours are all
    // relative to some other kind K (`+|K|percent`, `-|K|percent`,
    // `of|percent|K`), never percent-to-percent. Multiplication/division
    // still make sense for a bare ratio, so those stay.
    ops.push(
      {
        op: "*",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.times(r.canonical)),
      },
      {
        op: "/",
        left: id,
        right: id,
        result: id,
        apply: (l, r) => wrap(l, l.canonical.div(r.canonical)),
      },
    );
    return ops;
  }

  ops.push(
    {
      op: "+",
      left: id,
      right: id,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.plus(r.canonical)),
    },
    {
      op: "-",
      left: id,
      right: id,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.minus(r.canonical)),
    },
    {
      op: "*",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(r.canonical)),
    },
    {
      op: "*",
      left: NUMBER_KIND,
      right: id,
      result: id,
      apply: (l, r) => wrap(r, r.canonical.times(l.canonical)),
    },
    {
      op: "/",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.div(r.canonical)),
    },
    // Percent is relative to the left operand: 50 + 20% is 60, not 50.2.
    // Generated per kind for the same reason number scaling is — so a
    // third-party kind gets it without declaring anything.
    {
      op: "+",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(r.canonical.plus(1))),
    },
    {
      op: "-",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(new Decimal(1).minus(r.canonical))),
    },
    {
      op: "of",
      left: PERCENT_KIND,
      right: id,
      result: id,
      apply: (l, r) => wrap(r, r.canonical.times(l.canonical)),
    },
  );

  return ops;
}
