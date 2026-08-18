import { expect, test } from "bun:test";
import { BUDGETS, floorOf, measureEntry } from "./check-size";

test("measures a real entry and reports both numbers", async () => {
  const { min, gzip } = await measureEntry({
    label: "core root",
    from: "@smartput/core",
    names: ["createEngine"],
    min: Number.POSITIVE_INFINITY,
    gzip: Number.POSITIVE_INFINITY,
  });
  expect(min).toBeGreaterThan(0);
  expect(gzip).toBeGreaterThan(0);
  expect(gzip).toBeLessThan(min);
});

test("a symbol that does not exist fails loudly rather than measuring zero", async () => {
  await expect(
    measureEntry({
      label: "bogus",
      from: "@smartput/core",
      names: ["thisSymbolDoesNotExist"],
      min: Number.POSITIVE_INFINITY,
      gzip: Number.POSITIVE_INFINITY,
    }),
  ).rejects.toThrow();
});

test("every budget is two-sided, and the floor rejects a shaken-away graph", () => {
  // The hole this closes: a one-sided budget passes on a bundle containing none
  // of what it measures. `export const parseAngle = () => {};` bundles to 36 B,
  // which cleared the old 32-byte "nothing was kept" check and printed OK
  // against a 1300 B budget.
  for (const spec of BUDGETS) {
    // A types-only row is the one exception, and it is the inverse case rather
    // than a hole in this one: `@smartput/kind/contracts` claims to bundle to
    // nothing, so "the graph was shaken away" is what it asserts, not what it
    // guards against. Its own two-sided check is the next test.
    if (spec.typesOnly === true) continue;
    const floor = floorOf(spec);
    expect({ label: spec.label, positive: floor > 0 }).toEqual({
      label: spec.label,
      positive: true,
    });
    expect({ label: spec.label, below: floor < spec.min }).toEqual({
      label: spec.label,
      below: true,
    });
    // 36 B is the measured size of a stub with the right export name. No row's
    // floor may be low enough to accept it.
    expect({ label: spec.label, rejectsStub: floor > 36 }).toEqual({
      label: spec.label,
      rejectsStub: true,
    });
  }
});

test("a types-only row budgets zero at both ends and names no export", () => {
  // Ruling R-F1's proof. A row that claims 0 B has to claim it exactly: a
  // ceiling above zero would let a const slip into `contracts.ts` unnoticed,
  // which is the only failure this row exists to catch.
  const typesOnly = BUDGETS.filter((spec) => spec.typesOnly === true);
  expect(typesOnly.map((spec) => spec.from)).toContain("@smartput/kind/contracts");
  for (const spec of typesOnly) {
    expect({
      label: spec.label,
      min: spec.min,
      gzip: spec.gzip,
      names: spec.names,
    }).toEqual({
      label: spec.label,
      min: 0,
      gzip: 0,
      names: [],
    });
    expect({ label: spec.label, floor: floorOf(spec) }).toEqual({
      label: spec.label,
      floor: 0,
    });
  }
});

test("a types-only entry measures zero rather than failing the keep-alive guard", async () => {
  const { min, gzip } = await measureEntry({
    label: "kind/contracts probe",
    from: "@smartput/kind/contracts",
    names: [],
    typesOnly: true,
    min: 0,
    gzip: 0,
  });
  expect({ min, gzip }).toEqual({ min: 0, gzip: 0 });
});

test("the class barrel is measured, not just the validate barrel", () => {
  // Spec §8's `/*#__PURE__*/` claim is only observable through a barrel — the
  // per-kind subpath holds one class, so the annotation changes nothing there.
  // Stripping it took `Angle` through `@smartput/kinds/class` from 4218 B to
  // 7975 B with nothing failing, because no row measured this entry.
  const labels = BUDGETS.map((b) => b.from);
  expect(labels).toContain("@smartput/kinds/class");
  expect(labels).toContain("@smartput/kinds/validate");
});
