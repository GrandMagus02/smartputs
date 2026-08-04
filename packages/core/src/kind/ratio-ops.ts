import type { Decimal } from "../decimal";
import type { OpSignature, Value } from "../types";
import type { NormalizedKind } from "./define";

export const NUMBER_KIND = "number";

const wrap = (proto: Value, canonical: Decimal): Value =>
  Object.freeze({
    kind: proto.kind,
    canonical,
    unit: proto.unit,
    ...(proto.meta ? { meta: proto.meta } : {}),
  });

export function generateRatioOps(kind: NormalizedKind): OpSignature[] {
  if (kind.spec.mode !== "ratio") return [];
  const id = kind.id;

  const sameKind: OpSignature[] = [
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
    { op: "in", left: id, right: id, result: id, apply: (l, r) => wrap(r, l.canonical) },
  ];

  if (id === NUMBER_KIND) {
    return [
      ...sameKind,
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
    ];
  }

  return [
    ...sameKind,
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
  ];
}
