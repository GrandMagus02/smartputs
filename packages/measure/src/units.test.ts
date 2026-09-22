import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { DEFAULT_DPI, MEASURE_UNITS, type MeasureUnit } from "./units";

/**
 * A constructor of its own rather than `Decimal.set`, which would be module
 * state a test wrote into every other test in the run. `units.ts` claims 30
 * significant digits, two past the engine's configured 28, so re-deriving them
 * needs headroom the engine's own precision does not have.
 */
const Wide = Decimal.clone({ precision: 40 });

/**
 * Each unit's *definition*, not its digits. Canonical is the inch, which is
 * exactly 25.4 mm by the 1959 international agreement; a point is a 72nd of an
 * inch and a pica is twelve points, both by the PostScript convention the web
 * inherited. All four are non-terminating, so a literal has to stop somewhere,
 * and where it stops is what this file pins.
 *
 * Restating the strings would only re-bless whatever is in the table, which is
 * how `speed`'s knot survived six truncated decimals.
 */
const DEFINITION: Record<Exclude<MeasureUnit, "px">, () => Decimal> = {
  inch: () => new Wide(1),
  mm: () => new Wide(1).div("25.4"),
  cm: () => new Wide(1).div("2.54"),
  pt: () => new Wide(1).div(72),
  pc: () => new Wide(1).div(6),
};

test("every constant ratio is a decimal string, never a float literal", () => {
  // §3 of the code practices: the shared path does `Number(r)` and the engine
  // path does `new Decimal(r)`, and only a string keeps both exact. `px` is the
  // one exception in the repo, and it is a function rather than a number.
  for (const [unit, ratio] of Object.entries(MEASURE_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe(unit === "px" ? "function" : "string");
  }
});

test("every constant ratio re-derives from its definition, digit for digit", () => {
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    const want = unit === "inch" ? "1" : derive().toSignificantDigits(30).toString();
    expect(MEASURE_UNITS.ratio[unit as MeasureUnit], unit).toBe(want);
  }
});

/** Digits that carry information: no sign, no point, no leading zeros. */
const significantDigits = (s: string) =>
  s.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length;

test("the non-terminating ratios carry the 30 digits units.ts claims", () => {
  // Two past the engine's 28, so the engine's own arithmetic is what rounds
  // rather than the constant it starts from. A double holds ~17, so any of
  // these written as a number literal would have lost its tail already.
  for (const unit of ["mm", "cm", "pt", "pc"] as const) {
    const ratio = MEASURE_UNITS.ratio[unit];
    expect(typeof ratio, unit).toBe("string");
    if (typeof ratio !== "string") continue;
    expect(significantDigits(ratio), unit).toBe(30);
    expect(String(Number(ratio)), unit).not.toBe(ratio);
  }
});

test("a pica is twelve points and an inch is 72 of them", () => {
  // Rounded rather than exact: both strings are truncations of a repeating
  // decimal, so the relation holds to their shared digits, not past them.
  const pt = new Wide(MEASURE_UNITS.ratio.pt as string);
  const pc = new Wide(MEASURE_UNITS.ratio.pc as string);
  expect(pt.times(12).toSignificantDigits(28).toString()).toBe(
    pc.toSignificantDigits(28).toString(),
  );
  expect(pt.times(72).toSignificantDigits(28).toString()).toBe("1");
});

test("px reads its dpi from ctx, and DEFAULT_DPI is the CSS reference pixel", () => {
  // The one dynamic ratio in the repo. Its default is 96, which is what a `px`
  // means when no document has said otherwise; a caller's dpi overrides it.
  const px = MEASURE_UNITS.ratio.px;
  expect(typeof px).toBe("function");
  if (typeof px !== "function") return;
  expect(DEFAULT_DPI).toBe(96);
  expect(px({})).toBe(1 / 96);
  expect(px({ dpi: 300 })).toBe(1 / 300);
});

test("the canonical unit has ratio 1", () => {
  expect(MEASURE_UNITS.ratio[MEASURE_UNITS.canonical]).toBe("1");
});
