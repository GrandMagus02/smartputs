import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { measure } from "./index";

const at = (dpi?: number) =>
  createEngine({
    locales: [composeLocale(en)],
    kinds: [...BUILTIN_KINDS, measure],
    ...(dpi === undefined ? {} : { kindMeta: { measure: { dpi } } }),
  });

test("pixels default to 96dpi", () => {
  expect(at().evaluate("96 px in inch").formatted).toBe("1 inch");
});

test("the engine's kindMeta overrides the default dpi", () => {
  expect(at(300).evaluate("300 px in inch").value.canonical.toFixed(10)).toBe(
    "1.0000000000",
  );
});

test("A4 width in points", () => {
  expect(at().evaluate("210 mm in pt").value.canonical.toFixed(3)).toBe("8.268");
  // mm -> inch is 1/25.4 = 5/127, and 127 has no factor of 2 or 5, so the
  // conversion never terminates in decimal. formatValue guard-rounds the
  // exact authored value to 26 significant digits (see format.ts) rather
  // than printing all 28 Decimal computes at — so this is 26 significant
  // digits, not "595.276 points".
  expect(at().evaluate("210 mm in pt").formatted).toBe(
    "595.27559055118110236220472 points",
  );
});

test("physical units are unaffected by dpi", () => {
  // "inch" and "mm" are aliases of both `length` and `measure` (that's the
  // deliberate collision documented on the kind), so with BUILTIN_KINDS
  // also loaded this phrase is a genuine cross-kind tie — same as the
  // "10 m" tie in engine.test.ts. Restrict to `measure` explicitly, the
  // same way callers break real ties, so the assertion actually exercises
  // measure's own inch/mm ratio rather than erroring or silently falling
  // through to `length`.
  expect(at(300).evaluate("1 inch in mm", { kinds: ["measure"] }).formatted).toBe(
    "25.4 millimetres",
  );
});

test("operands authored in different units combine through canonical inches", () => {
  expect(at().evaluate("1 inch + 96 px in inch").value.canonical.toFixed(6)).toBe(
    "2.000000",
  );
});
