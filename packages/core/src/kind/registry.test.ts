import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { DimensionMismatchError, KindConflictError, UnknownKindError } from "../errors";
import { defineLocalePack } from "../locale/define";
import type { EvalCtx, Value } from "../types";
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

test("a locale pack unions aliases into the index", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг", "кілограм"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "uk");
  expect(r.aliasIndex.get("кг")).toEqual([{ kind: "mass", unit: "kg" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg" }]);
});

test("a pack for another locale is ignored", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "en");
  expect(r.aliasIndex.has("кг")).toBe(false);
});

test("a pack naming an unregistered kind throws at build time", () => {
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

test("a pack naming an unregistered unit throws", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [pack], "en")).toThrow(UnknownKindError);
});

test("an unregistered unit reports a bare kind id and the unit separately", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  try {
    buildRegistry([number, mass], [pack], "en");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(UnknownKindError);
    expect((e as UnknownKindError).kind).toBe("mass");
    expect((e as UnknownKindError).unit).toBe("nosuchunit");
  }
});

test("a third-party kind cannot hijack another kind's signature", () => {
  const evil = defineKind({
    id: "evil",
    value: { mode: "ratio", canonical: "e", units: { e: 1 } },
    ops: [
      {
        op: "+",
        left: "mass",
        right: "mass",
        result: "evil",
        apply: (l) => ({ kind: "evil", canonical: l.canonical, unit: "e" }),
      },
    ],
  });
  expect(() => buildRegistry([number, mass, evil])).toThrow(KindConflictError);
  // The message names both sources, per spec §7.
  expect(() => buildRegistry([number, mass, evil])).toThrow(
    /"evil".*\+\|mass\|mass.*"mass"/,
  );
});

test("registration order does not decide who wins a signature clash", () => {
  const evil = defineKind({
    id: "evil",
    value: { mode: "ratio", canonical: "e", units: { e: 1 } },
    ops: [
      {
        op: "+",
        left: "mass",
        right: "mass",
        result: "evil",
        apply: (l) => ({ kind: "evil", canonical: l.canonical, unit: "e" }),
      },
    ],
  });
  expect(() => buildRegistry([number, evil, mass])).toThrow(KindConflictError);
});

test("a kind may override a signature it generated itself", () => {
  const doubling = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
    ops: [
      {
        op: "+",
        left: "mass",
        right: "mass",
        result: "mass",
        apply: (l, r) => ({
          kind: "mass",
          canonical: l.canonical.plus(r.canonical).times(2),
          unit: l.unit,
        }),
      },
    ],
  });
  const r = buildRegistry([number, doubling]);
  const sig = r.ops.get(opKey("+", "mass", "mass"));
  expect(sig).toBeDefined();
  const g = (n: number) => ({ kind: "mass", canonical: new Decimal(n), unit: "g" });
  // The author's replacement, not the generated one.
  expect(sig?.apply(g(1), g(2), { self: g(1), locale: "en" }).canonical.toString()).toBe(
    "6",
  );
});

test("a declared cross-kind signature is not a conflict", () => {
  const length = defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1 } },
  });
  const duration = defineKind({
    id: "duration",
    value: { mode: "ratio", canonical: "s", units: { s: 1 } },
  });
  const speed = defineKind({
    id: "speed",
    value: { mode: "ratio", canonical: "mps", units: { mps: 1 } },
    ops: [
      {
        op: "/",
        left: "length",
        right: "duration",
        result: "speed",
        apply: (l, r) => ({
          kind: "speed",
          canonical: l.canonical.div(r.canonical),
          unit: "mps",
        }),
      },
    ],
  });
  const r = buildRegistry([number, length, duration, speed]);
  expect(r.ops.get(opKey("/", "length", "duration"))?.result).toBe("speed");
});

test("an extendsKind patch may replace an op on its base", () => {
  const patch = defineKind({
    id: "mass-ops",
    extendsKind: "mass",
    value: { mode: "ratio", canonical: "g", units: {} },
    ops: [
      {
        op: "+",
        left: "mass",
        right: "mass",
        result: "mass",
        apply: (l) => ({ kind: "mass", canonical: l.canonical, unit: l.unit }),
      },
    ],
  });
  // The patch is merged into "mass", so the signature has a single owner.
  expect(() => buildRegistry([number, mass, patch])).not.toThrow();
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

// --- The op table is the type system -------------------------------------
//
// An operation is legal exactly when a signature exists for its key, so the
// full key list IS the public contract of what smartputs can compute. Twelve
// per-task reviews could not see it: each task only ever looked at its own
// kind, and both a missing key (`20% * 3` had no signature while the facade's
// `Percent.scale(3)` answered it) and a key that silently belongs to the wrong
// kind (`20 C + 20%` captured by tempdelta) are invisible one kind at a time.
//
// A key is listed as "refuses" when its `apply` throws DimensionMismatchError.
// Those exist because an affine kind cannot forbid an operation by *absence*:
// its delta kind shares its aliases and would capture the key instead.
//
// If this test fails, the diff names exactly which keys appeared, vanished, or
// changed between answering and refusing. Update the list only once you can
// say why each moved -- an unexplained move is the bug this test exists for.
const OP_TABLE = [
  "*|angle|number",
  "*|area|length",
  "*|area|number",
  "*|datasize|number",
  "*|duration|number",
  "*|length|area",
  "*|length|length",
  "*|length|number",
  "*|mass|number",
  "*|number|angle",
  "*|number|area",
  "*|number|datasize",
  "*|number|duration",
  "*|number|length",
  "*|number|mass",
  "*|number|number",
  "*|number|percent",
  "*|number|speed",
  "*|number|tempdelta",
  "*|number|temperature  (refuses)",
  "*|number|volume",
  "*|percent|number",
  "*|percent|percent",
  "*|speed|number",
  "*|tempdelta|number",
  "*|temperature|number  (refuses)",
  "*|volume|number",
  "+|angle|angle",
  "+|angle|percent",
  "+|area|area",
  "+|area|percent",
  "+|datasize|datasize",
  "+|datasize|percent",
  "+|duration|duration",
  "+|duration|percent",
  "+|length|length",
  "+|length|percent",
  "+|mass|mass",
  "+|mass|percent",
  "+|number|number",
  "+|number|percent",
  "+|percent|percent",
  "+|speed|percent",
  "+|speed|speed",
  "+|tempdelta|percent",
  "+|tempdelta|tempdelta",
  "+|temperature|percent  (refuses)",
  "+|temperature|tempdelta",
  "+|volume|percent",
  "+|volume|volume",
  "-|angle|angle",
  "-|angle|percent",
  "-|area|area",
  "-|area|percent",
  "-|datasize|datasize",
  "-|datasize|percent",
  "-|duration|duration",
  "-|duration|percent",
  "-|length|length",
  "-|length|percent",
  "-|mass|mass",
  "-|mass|percent",
  "-|number|number",
  "-|number|percent",
  "-|percent|percent",
  "-|speed|percent",
  "-|speed|speed",
  "-|tempdelta|percent",
  "-|tempdelta|tempdelta",
  "-|temperature|percent  (refuses)",
  "-|temperature|tempdelta",
  "-|temperature|temperature",
  "-|volume|percent",
  "-|volume|volume",
  "/|angle|number",
  "/|area|number",
  "/|datasize|number",
  "/|duration|number",
  "/|length|duration",
  "/|length|number",
  "/|mass|number",
  "/|number|number",
  "/|percent|number",
  "/|percent|percent",
  "/|speed|number",
  "/|tempdelta|number",
  "/|temperature|number  (refuses)",
  "/|volume|number",
  "in|angle|angle",
  "in|area|area",
  "in|datasize|datasize",
  "in|duration|duration",
  "in|length|length",
  "in|mass|mass",
  "in|number|number",
  "in|percent|percent",
  "in|speed|speed",
  "in|tempdelta|tempdelta",
  "in|temperature|temperature",
  "in|volume|volume",
  "of|percent|angle",
  "of|percent|area",
  "of|percent|datasize",
  "of|percent|duration",
  "of|percent|length",
  "of|percent|mass",
  "of|percent|number",
  "of|percent|speed",
  "of|percent|tempdelta",
  "of|percent|temperature  (refuses)",
  "of|percent|volume",
];

const META = Object.freeze({ probe: "meta" });

/** A stand-in operand of `kindId`, in that kind's canonical unit, carrying meta. */
function operand(registry: ReturnType<typeof buildRegistry>, kindId: string): Value {
  const kind = registry.kinds.get(kindId);
  const unit = kind?.spec.mode === "ratio" ? kind.spec.canonical : "one";
  return { kind: kindId, canonical: new Decimal(2), unit, meta: META };
}

const evalCtx = (self: Value): EvalCtx => ({ self, locale: "en", input: "probe" });

/** Applies `sig` to stand-in operands; null when the signature refuses. */
function probe(
  registry: ReturnType<typeof buildRegistry>,
  sig: { left: string; right: string; apply: (l: Value, r: Value, c: EvalCtx) => Value },
): Value | null {
  const l = operand(registry, sig.left);
  const r = operand(registry, sig.right);
  try {
    return sig.apply(l, r, evalCtx(l));
  } catch (e) {
    if (e instanceof DimensionMismatchError) return null;
    throw e;
  }
}

test("the built-in op table is exactly this, refusals included", () => {
  const registry = buildRegistry(BUILTIN_KINDS, [], "en");
  const actual = [...registry.ops.entries()]
    .map(([key, sig]) => (probe(registry, sig) === null ? `${key}  (refuses)` : key))
    .sort();
  expect(actual).toEqual(OP_TABLE);
});

test("every signature that answers propagates its operand's meta", () => {
  // `meta` is the design's one generic context mechanism (measure's dpi is the
  // only current user). A hand-written `apply` that builds its Value literally
  // drops it silently -- six of them did. `deriveValue` is the fix; this is
  // the check that keeps it that way for every kind at once.
  const registry = buildRegistry(BUILTIN_KINDS, [], "en");
  const dropped: string[] = [];
  for (const [key, sig] of registry.ops) {
    const result = probe(registry, sig);
    if (result !== null && result.meta === undefined) dropped.push(key);
  }
  expect(dropped).toEqual([]);
});
