import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { DimensionMismatchError } from "../errors";
import type { EvalCtx, Value } from "../types";
import { defineKind, normalizeKind } from "./define";
import { generateRatioOps, NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";

const keys = (k: Parameters<typeof generateRatioOps>[0]) =>
  generateRatioOps(k).map((s) => `${s.op}|${s.left}|${s.right}`);

const val = (kind: string, n: number): Value => ({
  kind,
  canonical: new Decimal(n),
  unit: "x",
});
const ctx = (input: string): EvalCtx => ({ self: val("x", 0), locale: "en", input });

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

// The keys an affine kind must *close* rather than leave absent: its delta
// kind shares its aliases, so an absent signature is captured by the delta
// instead of refused.
const AFFINE_REFUSALS = [
  "*|temperature|number",
  "*|number|temperature",
  "/|temperature|number",
  "+|temperature|percent",
  "-|temperature|percent",
  "of|percent|temperature",
];

test("an affine kind cannot be scaled or added to itself", () => {
  const k = keys(temp);
  // Same-kind sums stay absent: "20 C + 5 C" is claimed by temperature's own
  // declared `+|temperature|tempdelta`, which reads the right side as a
  // difference. Nothing shadows it, so absence is still the right refusal.
  expect(k).not.toContain("+|temperature|temperature");
  // Everything else an ordinary kind would generate is present but refusing.
  for (const key of AFFINE_REFUSALS) expect(k).toContain(key);
});

test("an affine kind's shadowable signatures exist only to refuse", () => {
  const sigs = generateRatioOps(temp);
  for (const key of AFFINE_REFUSALS) {
    const sig = sigs.find((s) => `${s.op}|${s.left}|${s.right}` === key);
    expect(sig).toBeDefined();
    expect(() =>
      sig?.apply(val("temperature", 20), val("number", 2), ctx("20 C * 2")),
    ).toThrow(DimensionMismatchError);
  }
});

test("the affine refusal set is derived from the ordinary generation, not listed", () => {
  // The guard against the hand-maintained list drifting again: whatever
  // `ordinaryOps` grows next, an affine kind must close it the same day.
  const wouldBeGenerated = keys(mass)
    .map((k) => k.replaceAll("mass", "temperature"))
    .filter((k) => {
      const [, left, right] = k.split("|");
      return !(left === "temperature" && right === "temperature");
    });
  expect(wouldBeGenerated.length).toBeGreaterThan(0);
  for (const key of wouldBeGenerated) expect(keys(temp)).toContain(key);
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

const number = normalizeKind(
  defineKind({
    id: NUMBER_KIND,
    value: { mode: "ratio", canonical: "one", units: { one: 1 } },
  }),
);
// canonical must name a unit this kind actually declares — "%" is percent's
// only one. (The real kind carried `canonical: "ratio"` until Task 12; this
// fixture kept the defect after the kind was fixed.)
const percent = normalizeKind(
  defineKind({
    id: PERCENT_KIND,
    value: { mode: "ratio", canonical: "%", units: { "%": 0.01 } },
  }),
);

test("number and percent do not generate percent arithmetic for themselves", () => {
  expect(keys(number)).not.toContain("+|number|percent");
  // `of|percent|percent` is the key that tells the two apart: percent's
  // `+|percent|percent` is ordinary same-kind arithmetic, not the relative
  // adjustment the percent block would generate.
  expect(keys(percent)).not.toContain("of|percent|percent");
});

test("percent scales by a bare number, the way the facade's scale() does", () => {
  expect(keys(percent)).toContain("*|percent|number");
  expect(keys(percent)).toContain("*|number|percent");
  expect(keys(percent)).toContain("/|percent|number");
});

test("number's scaling trio is its own same-kind arithmetic, not a duplicate", () => {
  const k = keys(number);
  expect(k.filter((x) => x === "*|number|number")).toHaveLength(1);
  expect(new Set(k).size).toBe(k.length);
});
