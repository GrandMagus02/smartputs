import { expect, test } from "bun:test";
import { KindConflictError, UnknownKindError } from "../errors";
import { defineKind } from "./define";
import { buildRegistry, opKey } from "./registry";

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
  lexicon: { kg: ["kg", "kilo"] },
});

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

test("ratio kinds get same-kind + and - for free", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("+", "mass", "mass"))).toBe(true);
  expect(r.ops.has(opKey("-", "mass", "mass"))).toBe(true);
});

test("ratio kinds get scaling by number in both orders", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("*", "mass", "number"))).toBe(true);
  expect(r.ops.has(opKey("*", "number", "mass"))).toBe(true);
  expect(r.ops.has(opKey("/", "mass", "number"))).toBe(true);
  expect(r.ops.has(opKey("/", "number", "mass"))).toBe(false);
});

test("ratio kinds get in-kind conversion", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("in", "mass", "mass"))).toBe(true);
});

test("the alias index maps every alias to its kind and unit", () => {
  const r = buildRegistry([number, mass]);
  expect(r.aliasIndex.get("kilo")).toEqual([{ kind: "mass", unit: "kg" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg" }]);
});

test("the alias index is case-folded", () => {
  const r = buildRegistry([number, mass]);
  expect(r.aliasIndex.get("kg")).toBeDefined();
  expect(r.aliasIndex.has("KG")).toBe(false);
});

// Un-skipped in Task 5 once ../locale/define exists.
// The body dynamic-imports "../locale/define" instead of a static top-level
// import: a static import is evaluated eagerly by Bun even when the test
// that uses it is skipped, which would crash module load before any test
// runs. A dynamic import inside the (never-invoked) skipped callback is
// never evaluated at runtime, and @ts-expect-error suppresses the expected
// "cannot find module" diagnostic until Task 5 creates the file.
test.skip("a locale pack unions aliases into the index", async () => {
  // @ts-expect-error Cannot find module '../locale/define' — that file arrives in Task 5.
  const { defineLocalePack } = await import("../locale/define");
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг", "кілограм"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "uk");
  expect(r.aliasIndex.get("кг")).toEqual([{ kind: "mass", unit: "kg" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg" }]);
});

// Un-skipped in Task 5 once ../locale/define exists.
test.skip("a pack for another locale is ignored", async () => {
  // @ts-expect-error Cannot find module '../locale/define' — that file arrives in Task 5.
  const { defineLocalePack } = await import("../locale/define");
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "en");
  expect(r.aliasIndex.has("кг")).toBe(false);
});

// Un-skipped in Task 5 once ../locale/define exists.
test.skip("a pack naming an unregistered kind throws at build time", async () => {
  // @ts-expect-error Cannot find module '../locale/define' — that file arrives in Task 5.
  const { defineLocalePack } = await import("../locale/define");
  const pack = defineLocalePack({
    locale: "en",
    contributes: { nosuchkind: { x: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [pack], "en")).toThrow(UnknownKindError);
});

test("extendsKind merges units and aliases into the base kind", () => {
  const patch = defineKind({
    id: "mass-extra",
    extendsKind: "mass",
    value: { mode: "ratio", canonical: "g", units: { t: 1e6 } },
  });
  const r = buildRegistry([number, mass, patch]);
  expect(r.kinds.get("mass")?.units.has("t")).toBe(true);
  expect(r.aliasIndex.get("t")).toEqual([{ kind: "mass", unit: "t" }]);
  expect(r.kinds.has("mass-extra")).toBe(false);
});

test("a kind registered twice throws", () => {
  expect(() => buildRegistry([number, mass, mass])).toThrow(KindConflictError);
});

test("extending an unknown kind throws", () => {
  const orphan = defineKind({
    id: "orphan",
    extendsKind: "nosuchkind",
    value: { mode: "ratio", canonical: "g", units: { z: 1 } },
  });
  expect(() => buildRegistry([number, mass, orphan])).toThrow(KindConflictError);
});

test("a patch whose value.mode differs from its base throws", () => {
  const opaquePatch = defineKind({
    id: "mass-opaque",
    extendsKind: "mass",
    value: { mode: "opaque", parse: () => null, equals: (a, b) => a === b },
  });
  expect(() => buildRegistry([number, mass, opaquePatch])).toThrow(KindConflictError);
});

// Un-skipped in Task 5 once ../locale/define exists.
test.skip("a pack naming an unregistered unit throws", async () => {
  // @ts-expect-error Cannot find module '../locale/define' — that file arrives in Task 5.
  const { defineLocalePack } = await import("../locale/define");
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [pack], "en")).toThrow(UnknownKindError);
});

test("an ambiguous alias yields several entries sorted by kind id", () => {
  const duration = defineKind({
    id: "duration",
    value: { mode: "ratio", canonical: "s", units: { min: 60 } },
    lexicon: { min: ["min", "m"] },
  });
  const length = defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1 } },
  });
  const r = buildRegistry([number, duration, length]);
  expect(r.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min" },
    { kind: "length", unit: "m" },
  ]);
});
