import { expect, test } from "bun:test";
import type { UnitTable } from "@smartput/validate";
import { aliasesFor, decimalRatios, type RatioTable } from "./from-table";

/** Named separately so the assertions below compare against a `string`, not
 * against `RatioTable["ratio"][U]`, which is a string *or* a `Ctx` function. */
const DEG = "0.0174532925199432957692369076849";

const T: RatioTable<"rad" | "deg"> = {
  canonical: "rad",
  ratio: { rad: "1", deg: DEG },
  alias: { rad: "rad", radian: "rad", deg: "deg", degree: "deg", degrees: "deg" },
};

test("decimalRatios keeps every digit the string carried", () => {
  const ratios = decimalRatios(T);
  expect(ratios.rad.toString()).toBe("1");
  // decimal.js keeps what its constructor was given; it rounds to `precision`
  // on arithmetic, not on construction. So the assertion is the intent: the
  // string survives intact, all 30 significant digits of it.
  expect(ratios.deg.toString()).toBe(DEG);
  expect(ratios.deg.precision()).toBe(30);
  // Not Number(): a double carries ~17 significant digits, so a round-trip
  // through one would zero everything past the 17th.
  expect(ratios.deg.toString()).not.toBe(String(Number(DEG)));
  expect(ratios.deg.minus(Number(DEG)).isZero()).toBe(false);
});

test("aliasesFor inverts the flat map, in declaration order", () => {
  expect(aliasesFor(T, "rad")).toEqual(["rad", "radian"]);
  expect(aliasesFor(T, "deg")).toEqual(["deg", "degree", "degrees"]);
});

test("a real UnitTable satisfies RatioTable, so core needs no import to accept one", () => {
  // The assignment is the test, and it is why `@smartput/validate` is a
  // devDependency of core rather than a dependency: the structural type has to
  // stay wide enough for the real one, and nothing but a compile error would
  // say otherwise. Core's own source never names the package (spec §4/§13).
  const real: UnitTable<"rad" | "deg"> = T;
  const structural: RatioTable<"rad" | "deg"> = real;
  expect(decimalRatios(structural).deg.toString()).toBe(DEG);
});

test("a dynamic ratio has no Decimal form and is reported, not silently dropped", () => {
  const dynamic: UnitTable<"inch" | "px"> = {
    canonical: "inch",
    ratio: { inch: "1", px: (ctx) => 1 / (ctx.dpi ?? 96) },
    alias: { inch: "inch", px: "px" },
  };
  expect(() => decimalRatios(dynamic)).toThrow(/px/);
});
