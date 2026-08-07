import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { DimensionMismatchError, KindConflictError, UnknownKindError } from "../errors";
import { composeLocale, defineLanguage, defineVocabulary } from "../index";
import { defineLocalePack } from "../locale/define";
import type { EvalCtx, LiteralMatcher, Value } from "../types";
import { defineKind } from "./define";
import { buildRegistry, opKey, wordsFor } from "./registry";

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
  lexicon: { kg: ["kg", "kilo"] },
});

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

/**
 * Two installed languages, so the pack tests can say which one they expect to
 * be read: the alias index is built for the languages that are installed, and
 * a `uk` pack is invisible until a `uk` locale is one of them.
 */
const english = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  }),
);

const ukrainian = composeLocale(
  defineLanguage({
    id: "uk",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  }),
);

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
  expect(r.aliasIndex.get("kilo")).toEqual([{ kind: "mass", unit: "kg", locale: "en" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg", locale: "en" }]);
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
  // Both languages installed, which is what "unions" now means: each table is
  // read under its own language and both reach the one index.
  const r = buildRegistry([number, mass], [english, ukrainian], [pack]);
  expect(r.aliasIndex.get("кг")).toEqual([{ kind: "mass", unit: "kg", locale: "uk" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg", locale: "en" }]);
});

test("a pack for another locale is ignored", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг"] } } },
  });
  const r = buildRegistry([number, mass], [], [pack]);
  expect(r.aliasIndex.has("кг")).toBe(false);
});

test("a pack naming an unregistered kind throws at build time", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { nosuchkind: { x: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [], [pack])).toThrow(UnknownKindError);
});

test("extendsKind merges units and aliases into the base kind", () => {
  const patch = defineKind({
    id: "mass-extra",
    extendsKind: "mass",
    value: { mode: "ratio", canonical: "g", units: { t: 1e6 } },
    lexicon: { t: ["t", "tonne"] },
  });
  const r = buildRegistry([number, mass, patch]);
  expect(r.kinds.get("mass")?.units.has("t")).toBe(true);
  expect(r.aliasIndex.get("tonne")).toEqual([{ kind: "mass", unit: "t", locale: "en" }]);
  expect(r.aliasIndex.get("t")).toEqual([{ kind: "mass", unit: "t", locale: "en" }]);
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
  expect(() => buildRegistry([number, mass], [], [pack])).toThrow(UnknownKindError);
});

test("an unregistered unit reports a bare kind id and the unit separately", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  try {
    buildRegistry([number, mass], [], [pack]);
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
    lexicon: { m: ["m"] },
  });
  const r = buildRegistry([number, duration, length]);
  expect(r.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min", locale: "en" },
    { kind: "length", unit: "m", locale: "en" },
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
//
// Fifty keys arrived with datarate, power, energy and tempo. Nine of them are
// declared, and they are the whole reason those kinds exist: `/|datasize|
// duration` and its three siblings belong to `@smartput/datarate`, the four
// sides of the power/duration/energy square to `@smartput/energy`, and
// `in|tempo|duration` with `in|duration|tempo` to `@smartput/tempo`. The other
// forty-one are generated -- the `+`/`-` pair each kind gets against itself,
// the `*`/`/` against number, the percent crossings, and the self `in` -- so
// their arrival says only that four ratio kinds were registered.
//
// Ninety-six keys arrived with comparison. They are entirely generated: six
// signatures per orderable kind, over that kind against itself, produced by
// `generateComparisonOps` beside the arithmetic ones. Every one of them
// answers -- a comparison has nothing to refuse, since a mismatched pair has
// no signature to reach in the first place -- and every one of them results in
// `boolean`, which is why the meta test below exempts that result kind.
const OP_TABLE = [
  "!=|angle|angle",
  "!=|area|area",
  "!=|datarate|datarate",
  "!=|datasize|datasize",
  "!=|duration|duration",
  "!=|energy|energy",
  "!=|length|length",
  "!=|mass|mass",
  "!=|number|number",
  "!=|percent|percent",
  "!=|power|power",
  "!=|speed|speed",
  "!=|tempdelta|tempdelta",
  "!=|temperature|temperature",
  "!=|tempo|tempo",
  "!=|volume|volume",
  "*|angle|number",
  "*|area|length",
  "*|area|number",
  "*|datarate|duration",
  "*|datarate|number",
  "*|datasize|number",
  "*|duration|datarate",
  "*|duration|number",
  "*|duration|power",
  "*|energy|number",
  "*|length|area",
  "*|length|length",
  "*|length|number",
  "*|mass|number",
  "*|number|angle",
  "*|number|area",
  "*|number|datarate",
  "*|number|datasize",
  "*|number|duration",
  "*|number|energy",
  "*|number|length",
  "*|number|mass",
  "*|number|number",
  "*|number|percent",
  "*|number|power",
  "*|number|speed",
  "*|number|tempdelta",
  "*|number|temperature  (refuses)",
  "*|number|tempo",
  "*|number|volume",
  "*|percent|number",
  "*|percent|percent",
  "*|power|duration",
  "*|power|number",
  "*|speed|number",
  "*|tempdelta|number",
  "*|temperature|number  (refuses)",
  "*|tempo|number",
  "*|volume|number",
  "+|angle|angle",
  "+|angle|percent",
  "+|area|area",
  "+|area|percent",
  "+|datarate|datarate",
  "+|datarate|percent",
  "+|datasize|datasize",
  "+|datasize|percent",
  "+|duration|duration",
  "+|duration|percent",
  "+|energy|energy",
  "+|energy|percent",
  "+|length|length",
  "+|length|percent",
  "+|mass|mass",
  "+|mass|percent",
  "+|number|number",
  "+|number|percent",
  "+|percent|percent",
  "+|power|percent",
  "+|power|power",
  "+|speed|percent",
  "+|speed|speed",
  "+|tempdelta|percent",
  "+|tempdelta|tempdelta",
  "+|temperature|percent  (refuses)",
  "+|temperature|tempdelta",
  "+|tempo|percent",
  "+|tempo|tempo",
  "+|volume|percent",
  "+|volume|volume",
  "-|angle|angle",
  "-|angle|percent",
  "-|area|area",
  "-|area|percent",
  "-|datarate|datarate",
  "-|datarate|percent",
  "-|datasize|datasize",
  "-|datasize|percent",
  "-|duration|duration",
  "-|duration|percent",
  "-|energy|energy",
  "-|energy|percent",
  "-|length|length",
  "-|length|percent",
  "-|mass|mass",
  "-|mass|percent",
  "-|number|number",
  "-|number|percent",
  "-|percent|percent",
  "-|power|percent",
  "-|power|power",
  "-|speed|percent",
  "-|speed|speed",
  "-|tempdelta|percent",
  "-|tempdelta|tempdelta",
  "-|temperature|percent  (refuses)",
  "-|temperature|tempdelta",
  "-|temperature|temperature",
  "-|tempo|percent",
  "-|tempo|tempo",
  "-|volume|percent",
  "-|volume|volume",
  "/|angle|number",
  "/|area|number",
  "/|datarate|number",
  "/|datasize|datarate",
  "/|datasize|duration",
  "/|datasize|number",
  "/|duration|number",
  "/|energy|duration",
  "/|energy|number",
  "/|energy|power",
  "/|length|duration",
  "/|length|number",
  "/|mass|number",
  "/|number|number",
  "/|percent|number",
  "/|percent|percent",
  "/|power|number",
  "/|speed|number",
  "/|tempdelta|number",
  "/|temperature|number  (refuses)",
  "/|tempo|number",
  "/|volume|number",
  "<=|angle|angle",
  "<=|area|area",
  "<=|datarate|datarate",
  "<=|datasize|datasize",
  "<=|duration|duration",
  "<=|energy|energy",
  "<=|length|length",
  "<=|mass|mass",
  "<=|number|number",
  "<=|percent|percent",
  "<=|power|power",
  "<=|speed|speed",
  "<=|tempdelta|tempdelta",
  "<=|temperature|temperature",
  "<=|tempo|tempo",
  "<=|volume|volume",
  "<|angle|angle",
  "<|area|area",
  "<|datarate|datarate",
  "<|datasize|datasize",
  "<|duration|duration",
  "<|energy|energy",
  "<|length|length",
  "<|mass|mass",
  "<|number|number",
  "<|percent|percent",
  "<|power|power",
  "<|speed|speed",
  "<|tempdelta|tempdelta",
  "<|temperature|temperature",
  "<|tempo|tempo",
  "<|volume|volume",
  "=|angle|angle",
  "=|area|area",
  "=|datarate|datarate",
  "=|datasize|datasize",
  "=|duration|duration",
  "=|energy|energy",
  "=|length|length",
  "=|mass|mass",
  "=|number|number",
  "=|percent|percent",
  "=|power|power",
  "=|speed|speed",
  "=|tempdelta|tempdelta",
  "=|temperature|temperature",
  "=|tempo|tempo",
  "=|volume|volume",
  ">=|angle|angle",
  ">=|area|area",
  ">=|datarate|datarate",
  ">=|datasize|datasize",
  ">=|duration|duration",
  ">=|energy|energy",
  ">=|length|length",
  ">=|mass|mass",
  ">=|number|number",
  ">=|percent|percent",
  ">=|power|power",
  ">=|speed|speed",
  ">=|tempdelta|tempdelta",
  ">=|temperature|temperature",
  ">=|tempo|tempo",
  ">=|volume|volume",
  ">|angle|angle",
  ">|area|area",
  ">|datarate|datarate",
  ">|datasize|datasize",
  ">|duration|duration",
  ">|energy|energy",
  ">|length|length",
  ">|mass|mass",
  ">|number|number",
  ">|percent|percent",
  ">|power|power",
  ">|speed|speed",
  ">|tempdelta|tempdelta",
  ">|temperature|temperature",
  ">|tempo|tempo",
  ">|volume|volume",
  "in|angle|angle",
  "in|area|area",
  "in|datarate|datarate",
  "in|datasize|datasize",
  "in|duration|duration",
  "in|duration|tempo",
  "in|energy|energy",
  "in|length|length",
  "in|mass|mass",
  "in|number|number",
  "in|number|percent",
  "in|percent|number",
  "in|percent|percent",
  "in|power|power",
  "in|speed|speed",
  "in|tempdelta|tempdelta",
  "in|temperature|temperature",
  "in|tempo|duration",
  "in|tempo|tempo",
  "in|volume|volume",
  "off|percent|angle",
  "off|percent|area",
  "off|percent|datarate",
  "off|percent|datasize",
  "off|percent|duration",
  "off|percent|energy",
  "off|percent|length",
  "off|percent|mass",
  "off|percent|number",
  "off|percent|power",
  "off|percent|speed",
  "off|percent|tempdelta",
  "off|percent|temperature  (refuses)",
  "off|percent|tempo",
  "off|percent|volume",
  "of|percent|angle",
  "of|percent|area",
  "of|percent|datarate",
  "of|percent|datasize",
  "of|percent|duration",
  "of|percent|energy",
  "of|percent|length",
  "of|percent|mass",
  "of|percent|number",
  "of|percent|power",
  "of|percent|speed",
  "of|percent|tempdelta",
  "of|percent|temperature  (refuses)",
  "of|percent|tempo",
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
  const registry = buildRegistry(BUILTIN_KINDS);
  const actual = [...registry.ops.entries()]
    .map(([key, sig]) => (probe(registry, sig) === null ? `${key}  (refuses)` : key))
    .sort();
  expect(actual).toEqual(OP_TABLE);
});

// --- Opaque units and literal matchers -----------------------------------

const noopMatcher: LiteralMatcher = () => null;

const zone = defineKind({
  id: "zone",
  value: {
    mode: "opaque",
    units: {
      UTC: ["utc", "z"],
      "Asia/Tokyo": { aliases: ["tokyo", "jst"], symbol: "JST" },
    },
  },
  literals: [noopMatcher],
});

test("an opaque kind's units reach the alias index", () => {
  const registry = buildRegistry([zone]);
  expect(registry.aliasIndex.get("tokyo")).toEqual([
    { kind: "zone", unit: "Asia/Tokyo", locale: "en" },
  ]);
  expect(registry.aliasIndex.get("utc")).toEqual([
    { kind: "zone", unit: "UTC", locale: "en" },
  ]);
});

test("an opaque kind's unit carries its words", () => {
  const registry = buildRegistry([zone]);
  expect(wordsFor(registry, "en", "zone", "Asia/Tokyo")?.symbol).toBe("JST");
});

test("an opaque kind generates no ops", () => {
  const registry = buildRegistry([zone]);
  expect(registry.kinds.get("zone")?.ops).toEqual([]);
  expect([...registry.ops.keys()]).toEqual([]);
});

test("literal matchers are collected in kind-id order", () => {
  const other = defineKind({
    id: "aaa",
    value: { mode: "opaque", units: { x: ["x"] } },
    literals: [noopMatcher],
  });
  const registry = buildRegistry([zone, other]);
  expect(registry.literals.map((l) => l.kind)).toEqual(["aaa", "zone"]);
});

test("a ratio kind without literals contributes none", () => {
  const ratio = defineKind({
    id: "r",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
  });
  expect(buildRegistry([ratio]).literals).toEqual([]);
});

test("an opaque unit's ratio is the identity, so conversion helpers never crash", () => {
  const registry = buildRegistry([zone]);
  const unit = registry.kinds.get("zone")?.units.get("UTC");
  const ctx: EvalCtx = {
    self: { kind: "zone", canonical: new Decimal(0), unit: "UTC" },
    locale: "en",
  };
  expect(unit?.ratio(ctx).toString()).toBe("1");
  expect(unit?.offset(ctx).toString()).toBe("0");
});

test("every signature that answers propagates its operand's meta", () => {
  // `meta` is the design's one generic context mechanism (measure's dpi is the
  // only current user). A hand-written `apply` that builds its Value literally
  // drops it silently -- six of them did. `deriveValue` is the fix; this is
  // the check that keeps it that way for every kind at once.
  const registry = buildRegistry(BUILTIN_KINDS);
  const dropped: string[] = [];
  for (const [key, sig] of registry.ops) {
    // A comparison is exempt, and this is the one place that exemption is
    // stated. `meta` travels with a *quantity* — measure's dpi is the only
    // user — and the result of a comparison is not one: there is no unit for a
    // dpi to qualify and no arithmetic left to do. Propagating it would attach
    // the left operand's rendering context to a truth value, which reads as a
    // fact about the boolean and is a fact about neither operand.
    if (sig.result === "boolean") continue;
    const result = probe(registry, sig);
    if (result !== null && result.meta === undefined) dropped.push(key);
  }
  expect(dropped).toEqual([]);
});

// --- Vocabularies build the index (Task 3) --------------------------------

const vocabLang = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: {},
  selectForm: () => "other",
});

const widget = defineKind({
  id: "widget",
  value: { mode: "ratio", canonical: "w", units: { w: 1, kw: 1000 } },
  typical: { kw: [1, 10] },
});

test("aliases come from the installed vocabulary, tagged with its locale", () => {
  const vocab = defineVocabulary({
    locale: "en",
    kind: "widget",
    units: { kw: { aliases: ["kw", "kilowidget"], symbol: "kW" } },
  });
  const registry = buildRegistry([widget], [composeLocale(vocabLang, [vocab])]);

  expect(registry.aliasIndex.get("kilowidget")).toEqual([
    { kind: "widget", unit: "kw", locale: "en" },
  ]);
  expect(wordsFor(registry, "en", "widget", "kw")?.symbol).toBe("kW");
});

test("a unit is indexed under its own key with no vocabulary at all (R2)", () => {
  const registry = buildRegistry([widget]);
  expect(registry.aliasIndex.get("kw")).toEqual([
    { kind: "widget", unit: "kw", locale: "*" },
  ]);
  expect(wordsFor(registry, "en", "widget", "kw")).toBeUndefined();
});

test("a kind its language does speak for is not also indexed by bare key", () => {
  // The narrowing R2 needs in order to survive `@smartput/length`,
  // `@smartput/country` and the wordless sentinel units: once a vocabulary has
  // spoken for the kind, the units it leaves out were left out on purpose, and
  // the registry does not hand their identifiers back as spellings.
  const vocab = defineVocabulary({
    locale: "en",
    kind: "widget",
    units: { w: { aliases: ["w", "widget"] } },
  });
  const registry = buildRegistry([widget], [composeLocale(vocabLang, [vocab])]);
  expect(registry.aliasIndex.has("kw")).toBe(false);
  expect(registry.aliasIndex.get("widget")).toEqual([
    { kind: "widget", unit: "w", locale: "en" },
  ]);
});

test("typical is read off the kind, not off a lexeme", () => {
  const registry = buildRegistry([widget]);
  expect(registry.kinds.get("widget")?.units.get("kw")?.typical).toEqual([1, 10]);
});

test("a vocabulary naming an unregistered unit is a wiring error", () => {
  const vocab = defineVocabulary({
    locale: "en",
    kind: "widget",
    units: { nope: { aliases: ["nope"] } },
  });
  expect(() => buildRegistry([widget], [composeLocale(vocabLang, [vocab])])).toThrow(
    UnknownKindError,
  );
});
