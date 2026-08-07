import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { createResolver } from "../parse/candidates";
import { Parser } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import type { Locale, RateLookup } from "../types";
import { Evaluator } from "./evaluator";

// Only what this stage needs: a Program and a Resolution to hand to `run()`.
// The parser and solver are imported to build those fixtures, per the brief —
// nothing here asserts anything about parser or solver behaviour itself.

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m"], km: ["km"] },
});

/** A kind whose `of` records a static assumption, so `Evaluation.assumptions`
 * has something non-empty to assert on. */
const noted = defineKind({
  id: "scaled",
  value: { mode: "ratio", canonical: "u", units: { u: 1 } },
  lexicon: { u: ["u"] },
  ops: [
    {
      op: "of",
      left: "number",
      right: "scaled",
      result: "scaled",
      assumption: { code: "scale-factor", message: "read as a scale factor" },
      apply: (l, r) => Object.freeze({ ...r, canonical: r.canonical.times(l.canonical) }),
    },
  ],
});

/** A kind whose unit ratio reads `ctx.self.meta.dpi` — the only way to prove
 * `Evaluator`'s `kindMeta` config actually reaches `evaluateNode` rather than
 * being accepted and silently dropped. No alias on the base unit: only `px`
 * is ever typed, so it cannot collide with another fixture kind's alias. */
const pixel = defineKind({
  id: "pixel",
  value: {
    mode: "ratio",
    canonical: "in",
    units: {
      in: 1,
      px: {
        ratio: (ctx) => new Decimal((ctx.self.meta?.dpi as number | undefined) ?? 1),
      },
    },
  },
  lexicon: { px: ["px"] },
});

/** A kind whose unit ratio reads `ctx.rates` — proves `Evaluator`'s `rates`
 * config reaches `evaluateNode` rather than being dropped. */
const coin = defineKind({
  id: "coin",
  value: {
    mode: "ratio",
    canonical: "tok",
    units: {
      tok: 1,
      usd: { ratio: (ctx) => ctx.rates?.get("usd", "tok") ?? new Decimal(1) },
    },
  },
  lexicon: { usd: ["usd"] },
});

/** A kind whose `+` reads `ctx.locale` — proves `Evaluator`'s `locale` config
 * reaches `evaluateNode` rather than being hardcoded. */
const echo = defineKind({
  id: "echo",
  value: { mode: "ratio", canonical: "ec", units: { ec: 1 } },
  lexicon: { ec: ["ec"] },
  ops: [
    {
      op: "+",
      left: "echo",
      right: "echo",
      result: "echo",
      apply: (l, r, ctx) =>
        Object.freeze({
          kind: l.kind,
          canonical:
            ctx.locale === "xx" ? l.canonical.times(10) : l.canonical.plus(r.canonical),
          unit: l.unit,
        }),
    },
  ],
});

const ALL = [number, length, noted, pixel, coin, echo];

const en: Locale = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in"], of: ["of"] },
    selectForm: () => "other",
  }),
);
const xx: Locale = composeLocale(
  defineLanguage({
    id: "xx",
    numberFormat: "intl",
    keywords: { in: ["in"], of: ["of"] },
    selectForm: () => "other",
  }),
);

/** Builds a Program + Resolution for `input`, over `kinds`, in locale `loc` —
 * the fixture-building the brief allows, asserting nothing about parser or
 * solver behaviour itself. */
function resolve(input: string, kinds = ALL, loc = en) {
  const registry = buildRegistry(kinds);
  const resolver = createResolver({ registry, locale: loc, packs: [], layers: [] });
  const tokenizer = new Tokenizer({ locale: loc, registry });
  const parser = new Parser({ resolver });
  const solver = new Solver({ registry });
  const program = parser.run(tokenizer.run(input));
  const resolution = solver.best(program);
  return { registry, program, resolution };
}

test("evaluates a plain quantity", () => {
  const { registry, program, resolution } = resolve("10 km");
  const evaluator = new Evaluator({ registry, locale: "en" });
  const out = evaluator.run(program, resolution);
  expect(out.value.kind).toBe("length");
  expect(out.value.unit).toBe("km");
  expect(out.value.canonical.toString()).toBe("10000");
});

test("evaluates a binary expression", () => {
  const { registry, program, resolution } = resolve("1 km + 500 m");
  const evaluator = new Evaluator({ registry, locale: "en" });
  const out = evaluator.run(program, resolution);
  expect(out.value.unit).toBe("km");
  expect(out.value.canonical.toString()).toBe("1500");
});

test("evaluates a convert", () => {
  const { registry, program, resolution } = resolve("2 km in m");
  const evaluator = new Evaluator({ registry, locale: "en" });
  const out = evaluator.run(program, resolution);
  expect(out.value.unit).toBe("m");
  expect(out.value.canonical.toString()).toBe("2000");
});

test("an input that produces an assumption", () => {
  const { registry, program, resolution } = resolve("2 of 10 u");
  const evaluator = new Evaluator({ registry, locale: "en" });
  const out = evaluator.run(program, resolution);
  expect(out.value.canonical.toString()).toBe("20");
  expect(out.assumptions).toEqual([
    { code: "scale-factor", message: "read as a scale factor" },
  ]);
  // The container being frozen (asserted elsewhere) does not imply each
  // entry is — `deepFreeze` recurses, but a test that only checks
  // `out.assumptions` itself would pass even if a shallow `Object.freeze`
  // regressed this.
  expect(Object.isFrozen(out.assumptions[0])).toBe(true);
});

test("the locale in the constructor reaches evaluateNode, not a hardcoded default", () => {
  const enFixture = resolve("1 ec + 1 ec");
  const xxFixture = resolve("1 ec + 1 ec", ALL, xx);

  const enOut = new Evaluator({ registry: enFixture.registry, locale: "en" }).run(
    enFixture.program,
    enFixture.resolution,
  );
  const xxOut = new Evaluator({ registry: xxFixture.registry, locale: "xx" }).run(
    xxFixture.program,
    xxFixture.resolution,
  );
  expect(enOut.value.canonical.toString()).toBe("2");
  expect(xxOut.value.canonical.toString()).toBe("10");
});

test("kindMeta in the constructor reaches evaluateNode, not dropped silently", () => {
  const { registry, program, resolution } = resolve("10 px");
  const withMeta = new Evaluator({
    registry,
    locale: "en",
    kindMeta: { pixel: { dpi: 2 } },
  }).run(program, resolution);
  const withoutMeta = new Evaluator({ registry, locale: "en" }).run(program, resolution);
  expect(withMeta.value.canonical.toString()).toBe("20");
  expect(withoutMeta.value.canonical.toString()).toBe("10");
});

test("rates in the constructor reach evaluateNode, not dropped silently", () => {
  const { registry, program, resolution } = resolve("5 usd");
  const rates: RateLookup = {
    base: "tok",
    asOf: "2020-01-01",
    get: (from, to) => (from === "usd" && to === "tok" ? new Decimal(2) : null),
  };
  const withRates = new Evaluator({ registry, locale: "en", rates }).run(
    program,
    resolution,
  );
  const withoutRates = new Evaluator({ registry, locale: "en" }).run(program, resolution);
  expect(withRates.value.canonical.toString()).toBe("10");
  expect(withoutRates.value.canonical.toString()).toBe("5");
});

test("run() supplies input from program.input.source", () => {
  // Every SmartputError carries the `input` it was thrown for. If `run()`
  // failed to supply it (or supplied the wrong string), `.input` would read
  // undefined or the wrong source instead of the literal input text.
  const { registry, program, resolution } = resolve("10 km / 0", [number, length]);
  const evaluator = new Evaluator({ registry, locale: "en" });
  expect(() => evaluator.run(program, resolution)).toThrow(
    expect.objectContaining({ input: "10 km / 0" }),
  );
});

test("output is frozen", () => {
  const { registry, program, resolution } = resolve("10 km");
  const out = new Evaluator({ registry, locale: "en" }).run(program, resolution);
  expect(Object.isFrozen(out)).toBe(true);
  expect(Object.isFrozen(out.value)).toBe(true);
  expect(Object.isFrozen(out.assumptions)).toBe(true);
});

test("two run() calls with the same input return equal output", () => {
  const { registry, program, resolution } = resolve("1 km + 500 m");
  const evaluator = new Evaluator({ registry, locale: "en" });
  const a = evaluator.run(program, resolution);
  const b = evaluator.run(program, resolution);
  expect(a.value.canonical.toString()).toBe(b.value.canonical.toString());
  expect(a).toEqual(b);
});

test("the constructor destructures cfg rather than retaining it", () => {
  const { registry, program, resolution } = resolve("1 ec + 1 ec");
  const cfg = { registry, locale: "en" };
  const evaluator = new Evaluator(cfg);
  // Mutated after construction: a `Evaluator` that stored `cfg` itself (or
  // read `cfg.locale` lazily inside `run()`) would pick this up; one that
  // destructured `locale` onto its own field at construction time, the way
  // `Tokenizer` and `Parser` do, would not.
  cfg.locale = "xx";
  const out = evaluator.run(program, resolution);
  expect(out.value.canonical.toString()).toBe("2");
});

test("the constructor copies kindMeta rather than aliasing the caller's map", () => {
  const { registry, program, resolution } = resolve("10 px");
  const kindMeta: Record<string, Record<string, unknown>> = { pixel: { dpi: 2 } };
  const evaluator = new Evaluator({ registry, locale: "en", kindMeta });
  const before = evaluator.run(program, resolution);
  // Reassigns the whole `pixel` entry after construction, rather than
  // mutating the nested `{ dpi: 2 }` record in place — a shallow copy of the
  // outer `kindMeta` map defends against exactly this class of aliasing (the
  // one Task 2's `Normalizer` review caught), the same way `Autocompleter`'s
  // `layers` copy defends against an in-place array push.
  kindMeta.pixel = { dpi: 100 };
  const after = evaluator.run(program, resolution);
  expect(after.value.canonical.toString()).toBe(before.value.canonical.toString());
});
