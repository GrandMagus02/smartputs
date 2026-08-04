import { expect, test } from "bun:test";
import { resolveWeight, weightBreakdown } from "./weights";

const base = { kind: "duration", unit: "min", surface: "m", prior: 0 };

test("with no layers the weight is the kind prior", () => {
  expect(resolveWeight({ ...base, prior: 7, layers: [] })).toBe(7);
});

test("a kind selector applies to every unit of the kind", () => {
  expect(resolveWeight({ ...base, layers: [{ duration: 5 }] })).toBe(5);
});

test("a kind:unit selector applies to one unit", () => {
  expect(resolveWeight({ ...base, layers: [{ "duration:min": -20 }] })).toBe(-20);
});

test("a token selector applies to the surface form", () => {
  expect(resolveWeight({ ...base, layers: [{ "token:m": 100 }] })).toBe(100);
});

test("all matching selectors sum — there is no precedence", () => {
  const w = resolveWeight({ ...base, layers: [{ duration: 5, "duration:min": -20 }] });
  expect(w).toBe(-15);
});

test("all four layers sum", () => {
  const w = resolveWeight({
    ...base,
    prior: 1,
    layers: [{ duration: 2 }, { duration: 4 }, { "duration:min": 8 }, { "token:m": 16 }],
  });
  expect(w).toBe(31);
});

test("non-matching selectors contribute nothing", () => {
  expect(
    resolveWeight({ ...base, layers: [{ length: 99, "length:m": 99, "token:kg": 99 }] }),
  ).toBe(0);
});

test("undefined layers are skipped", () => {
  expect(
    resolveWeight({ ...base, layers: [undefined, { duration: 3 }, undefined] }),
  ).toBe(3);
});

test("the breakdown lists every contribution in layer order", () => {
  const b = weightBreakdown({
    ...base,
    prior: 1,
    layers: [{ duration: 5 }, { "token:m": 2 }],
  });
  expect(b).toEqual([
    { selector: "prior", value: 1, layer: 0 },
    { selector: "duration", value: 5, layer: 1 },
    { selector: "token:m", value: 2, layer: 2 },
  ]);
});
