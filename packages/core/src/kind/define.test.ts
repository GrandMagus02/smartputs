import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { EvalCtx, Value } from "../types";
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

test("aliases default to the unit key", () => {
  const n = normalizeKind(
    defineKind({
      id: "datasize",
      value: { mode: "ratio", canonical: "b", units: { kb: 1e3 } },
    }),
  );
  expect(n.units.get("kb")?.lexeme.aliases).toEqual(["kb"]);
});

test("an explicit lexicon replaces the default aliases and keeps display forms", () => {
  const n = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
      lexicon: {
        kg: { aliases: ["kg", "kilo"], symbol: "kg", display: { one: "kilogram" } },
      },
    }),
  );
  expect(n.units.get("kg")?.lexeme.aliases).toEqual(["kg", "kilo"]);
  expect(n.units.get("kg")?.lexeme.display?.one).toBe("kilogram");
});

test("a string array is lexicon shorthand for aliases", () => {
  const n = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
      lexicon: { kg: ["kg", "kilo"] },
    }),
  );
  expect(n.units.get("kg")?.lexeme.aliases).toEqual(["kg", "kilo"]);
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
        units: { c: 1, f: { ratio: 5 / 9, offset: -32 } },
      },
    }),
  );
  expect(
    n.units
      .get("f")
      ?.offset(ctx(val("f")))
      .toString(),
  ).toBe("-32");
  expect(
    n.units
      .get("c")
      ?.offset(ctx(val("c")))
      .toString(),
  ).toBe("0");
});

test("defineKind freezes its descriptor", () => {
  const k = defineKind({
    id: "x",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
  });
  expect(Object.isFrozen(k)).toBe(true);
});
