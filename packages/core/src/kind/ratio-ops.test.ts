import { expect, test } from "bun:test";
import { defineKind, normalizeKind } from "./define";
import { generateRatioOps, NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";

const keys = (k: Parameters<typeof generateRatioOps>[0]) =>
  generateRatioOps(k).map((s) => `${s.op}|${s.left}|${s.right}`);

const mass = normalizeKind(
  defineKind({ id: "mass", value: { mode: "ratio", canonical: "g", units: { g: 1 } } }),
);

const temp = normalizeKind(
  defineKind({
    id: "temperature",
    value: {
      mode: "ratio",
      canonical: "c",
      units: { c: 1 },
      affine: { deltaKind: "tempdelta" },
    },
  }),
);

test("an ordinary ratio kind scales by number in both orders", () => {
  expect(keys(mass)).toContain("*|mass|number");
  expect(keys(mass)).toContain("*|number|mass");
  expect(keys(mass)).toContain("/|mass|number");
});

test("an ordinary ratio kind gets percent arithmetic for free", () => {
  expect(keys(mass)).toContain("+|mass|percent");
  expect(keys(mass)).toContain("-|mass|percent");
  expect(keys(mass)).toContain("of|percent|mass");
});

test("an affine kind cannot be scaled or added to itself", () => {
  const k = keys(temp);
  expect(k).not.toContain("*|temperature|number");
  expect(k).not.toContain("*|number|temperature");
  expect(k).not.toContain("/|temperature|number");
  expect(k).not.toContain("+|temperature|temperature");
  expect(k).not.toContain("+|temperature|percent");
});

test("subtracting two absolute temperatures yields the delta kind", () => {
  const sig = generateRatioOps(temp).find((s) => s.op === "-");
  expect(sig?.left).toBe("temperature");
  expect(sig?.right).toBe("temperature");
  expect(sig?.result).toBe("tempdelta");
});

test("an affine kind still converts between its own units", () => {
  expect(keys(temp)).toContain("in|temperature|temperature");
});

test("number and percent do not generate percent arithmetic for themselves", () => {
  const number = normalizeKind(
    defineKind({
      id: NUMBER_KIND,
      value: { mode: "ratio", canonical: "one", units: { one: 1 } },
    }),
  );
  const percent = normalizeKind(
    defineKind({
      id: PERCENT_KIND,
      value: { mode: "ratio", canonical: "ratio", units: { "%": 0.01 } },
    }),
  );
  expect(keys(number)).not.toContain("+|number|percent");
  expect(keys(percent)).not.toContain("+|percent|percent");
});
