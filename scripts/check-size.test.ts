import { expect, test } from "bun:test";
import { measureEntry } from "./check-size";

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
