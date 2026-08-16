import { expect, test } from "bun:test";
import type { UnitTable } from "@smartput/shared";
import { aliasesFor, type RatioTable } from "./aliases";

/**
 * Its own fixture rather than one shared with `from-table.test.ts`, deliberately.
 * A helper module imported from both would put the two test files back in one
 * graph, and the point of splitting `aliasesFor` out of `from-table.ts` was that
 * naming the alias helper must not reach `./decimal`. Twelve lines of duplicated
 * table is a cheap way to keep that true in the tests as well as in the source.
 */
const T: RatioTable<"rad" | "deg"> = {
  canonical: "rad",
  ratio: { rad: "1", deg: "0.0174532925199432957692369076849" },
  alias: { rad: "rad", radian: "rad", deg: "deg", degree: "deg", degrees: "deg" },
};

test("aliasesFor inverts the flat map, in declaration order", () => {
  expect(aliasesFor(T, "rad")).toEqual(["rad", "radian"]);
  expect(aliasesFor(T, "deg")).toEqual(["deg", "degree", "degrees"]);
});

test("a real UnitTable satisfies RatioTable, so core needs no import to accept one", () => {
  // The assignment is the test, and it is why `@smartput/shared` is a
  // devDependency of core rather than a dependency: the structural type has to
  // stay wide enough for the real one, and nothing but a compile error would
  // say otherwise. Core's own source never names the package (spec §4/§13).
  const real: UnitTable<"rad" | "deg"> = T;
  const structural: RatioTable<"rad" | "deg"> = real;
  expect(aliasesFor(structural, "deg")).toEqual(["deg", "degree", "degrees"]);
});
