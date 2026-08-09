import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { EvalCtx, OpSignature, RatioSpec, Value } from "../types";
import { defineKind, normalizeKind } from "./define";

const ctx = (v: Value): EvalCtx => ({ self: v, locale: "en" });
const val = (unit: string): Value => ({
  kind: "datasize",
  canonical: new Decimal(0),
  unit,
});

test("a five-line ratio kind needs only id, canonical and units", () => {
  const k = defineKind({
    id: "datasize",
    value: { mode: "ratio", canonical: "b", units: { b: 1, kb: 1e3, kib: 1024 } },
  });
  const n = normalizeKind(k);

  expect(n.id).toBe("datasize");
  expect(n.prior).toBe(0);
  expect(
    n.units
      .get("kib")
      ?.ratio(ctx(val("kib")))
      .toString(),
  ).toBe("1024");
});

test("Kind.typical reaches the normalized unit", () => {
  // The one thing that stayed on the descriptor when the words left for a
  // vocabulary: a magnitude band is physics, not language (ruling R3).
  const n = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { kg: 1000, g: 1 } },
      typical: { kg: [2, 200] },
    }),
  );
  expect(n.units.get("kg")?.typical).toEqual([2, 200]);
  // A unit with no band declared carries none, and scores 0 rather than being
  // penalised for it.
  expect(n.units.get("g")?.typical).toBeUndefined();
});

test("a function ratio receives the value's own meta", () => {
  const n = normalizeKind(
    defineKind({
      id: "measure",
      value: {
        mode: "ratio",
        canonical: "inch",
        units: {
          px: { ratio: (c) => new Decimal(1).div((c.self.meta?.dpi as number) ?? 96) },
        },
      },
    }),
  );
  const self: Value = {
    kind: "measure",
    canonical: new Decimal(0),
    unit: "px",
    meta: { dpi: 300 },
  };
  // 28 significant digits, per the Decimal config in Task 1: 28 threes.
  expect(n.units.get("px")?.ratio({ self, locale: "en" }).toString()).toBe(
    "0.003333333333333333333333333333",
  );
});

test("affine offsets normalize to a Decimal-returning function", () => {
  const n = normalizeKind(
    defineKind({
      id: "temperature",
      value: {
        mode: "ratio",
        canonical: "c",
        // new Decimal(5).div(9), never 5 / 9: the latter is a JS float rounded
        // before Decimal ever sees it, and is exactly what made an affine
        // conversion land on 100.000000000000008. This fixture is the one a
        // future kind author will copy.
        units: { c: 1, f: { ratio: new Decimal(5).div(9), offset: -32 } },
      },
    }),
  );
  expect(
    n.units
      .get("f")
      ?.offset(ctx(val("f")))
      .toString(),
  ).toBe("-32");
  // 28 significant digits, not the float's 0.5555555555555556.
  expect(
    n.units
      .get("f")
      ?.ratio(ctx(val("f")))
      .toString(),
  ).toBe("0.5555555555555555555555555556");
  expect(
    n.units
      .get("c")
      ?.offset(ctx(val("c")))
      .toString(),
  ).toBe("0");
});

test("a bare Decimal ratio converts using that ratio, not a default of 1", () => {
  const n = normalizeKind(
    defineKind({
      id: "tempdelta",
      value: {
        mode: "ratio",
        canonical: "c",
        // `f` is a bare Decimal, not wrapped in `{ ratio }`. Before this fix,
        // normalizeKind's `typeof raw === "number"` check missed Decimal
        // instances (typeof is "object"), fell through to treating the
        // Decimal itself as a UnitDef, found no `.ratio` property, and
        // silently defaulted to a ratio of 1 — a wrong-answer trap for any
        // kind (in this codebase or a third party's) that writes a bare
        // Decimal the way `new Decimal(5).div(9)` is written elsewhere.
        units: { c: 1, f: new Decimal(5).div(9) },
      },
    }),
  );
  expect(
    n.units
      .get("f")
      ?.ratio(ctx(val("f")))
      .toString(),
  ).toBe("0.5555555555555555555555555556");
});

test("defineKind deep-freezes its descriptor", () => {
  const k = defineKind({
    id: "x",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
    typical: { a: [1, 10] },
  });
  expect(Object.isFrozen(k)).toBe(true);
  expect(Object.isFrozen(k.value)).toBe(true);
  expect(Object.isFrozen((k.value as RatioSpec).units)).toBe(true);
  expect(Object.isFrozen(k.typical)).toBe(true);
  expect(Object.isFrozen(k.typical?.a)).toBe(true);
});

test("normalizeKind copies ops rather than aliasing the frozen array", () => {
  const k = defineKind({
    id: "x",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
    ops: [],
  });
  const n = normalizeKind(k);
  // The registry pushes generated signatures onto this array; it must not be
  // the descriptor's frozen one.
  expect(() => n.ops.push({} as OpSignature)).not.toThrow();
  expect(k.ops).toHaveLength(0);
});
