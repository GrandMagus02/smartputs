import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import {
  EXACT_BONUS,
  LENGTH_PENALTY,
  prefixQuality,
  SCALE_BONUS,
  scaleFit,
} from "./score";

test("an exact alias earns the exact bonus", () => {
  expect(prefixQuality("mi", "mi")).toBe(EXACT_BONUS);
});

test("a longer alias is penalised once per untyped character", () => {
  expect(prefixQuality("mile", "mi")).toBe(-2 * LENGTH_PENALTY);
  expect(prefixQuality("millisecond", "mi")).toBe(-9 * LENGTH_PENALTY);
  expect(prefixQuality("hour", "ho")).toBe(-2 * LENGTH_PENALTY);
});

test("scaleFit pays the bonus inside the band and nothing outside it", () => {
  expect(scaleFit(new Decimal("30"), [1, 72])).toBe(SCALE_BONUS);
  expect(scaleFit(new Decimal("600"), [1, 180])).toBe(0);
});

test("the band is inclusive at both ends", () => {
  expect(scaleFit(new Decimal("1"), [1, 72])).toBe(SCALE_BONUS);
  expect(scaleFit(new Decimal("72"), [1, 72])).toBe(SCALE_BONUS);
});

test("scaleFit is never negative, with or without data", () => {
  expect(scaleFit(new Decimal("9999"), [1, 72])).toBe(0);
  expect(scaleFit(new Decimal("30"), undefined)).toBe(0);
  expect(scaleFit(undefined, [1, 72])).toBe(0);
  expect(scaleFit(undefined, undefined)).toBe(0);
});

test("scaleFit uses magnitude, so a negative count still lands in band", () => {
  expect(scaleFit(new Decimal("-30"), [1, 72])).toBe(SCALE_BONUS);
});

test("scaleFit compares as Decimal, not as float", () => {
  // 0.1 + 0.2 is 0.30000000000000004 in float; as Decimal it is exactly 0.3,
  // which must count as inside a band that ends at 0.3.
  const count = new Decimal("0.1").plus(new Decimal("0.2"));
  expect(scaleFit(count, [0.1, 0.3])).toBe(SCALE_BONUS);
});

test("every built-in unit declares a typical band", () => {
  const registry = buildRegistry(BUILTIN_KINDS);
  const missing: string[] = [];
  for (const [kindId, kind] of registry.kinds) {
    // `number`'s single unit has no aliases, so it can never be completed.
    if (kindId === "number") continue;
    for (const [unitName, unit] of kind.units) {
      if (unit.lexeme.typical === undefined) missing.push(`${kindId}:${unitName}`);
    }
  }
  expect(missing).toEqual([]);
});

test("every typical band runs low to high", () => {
  const registry = buildRegistry(BUILTIN_KINDS);
  const inverted: string[] = [];
  for (const [kindId, kind] of registry.kinds) {
    for (const [unitName, unit] of kind.units) {
      const band = unit.lexeme.typical;
      if (band !== undefined && band[0] >= band[1]) {
        inverted.push(`${kindId}:${unitName} [${band[0]}, ${band[1]}]`);
      }
    }
  }
  expect(inverted).toEqual([]);
});
