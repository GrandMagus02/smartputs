import { expect, test } from "bun:test";
import { createEngine } from "./engine";
import { AmbiguityError, DimensionMismatchError, NoCandidateError } from "./errors";
import { defineKind } from "./kind/define";
import { BUILTIN_KINDS } from "./kinds/index";
import { defineLocale } from "./locale/define";
import en from "./locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

test("evaluate returns a formatted result for an unambiguous input", () => {
  const r = engine.evaluate("1 kg + 500 g");
  expect(r.kind).toBe("mass");
  // The kg lexeme carries display forms, and Intl.PluralRules("en").select(1.5)
  // is "other" — so this renders the word, not the symbol.
  expect(r.formatted).toBe("1.5 kilograms");
});

test("evaluate resolves ambiguity from context", () => {
  expect(engine.evaluate("10 m + 5 h").kind).toBe("duration");
  expect(engine.evaluate("10 m + 5 km").kind).toBe("length");
});

test("evaluate throws AmbiguityError on a genuine tie", () => {
  expect(() => engine.evaluate("10 m")).toThrow(AmbiguityError);
});

test("weights break the tie", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m").kind).toBe("length");
});

test("per-call weights override engine weights", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m", { weights: { "duration:min": 20 } }).kind).toBe(
    "duration",
  );
});

test("tiebreak first resolves instead of throwing", () => {
  const stable = createEngine({ locales: [en], kinds: BUILTIN_KINDS, tiebreak: "first" });
  expect(stable.evaluate("10 m").kind).toBe("duration");
});

test("suggest never throws and returns ranked results", () => {
  const results = engine.suggest("10 m");
  expect(results).toHaveLength(2);
  expect(results[0]?.confidence).toBeGreaterThanOrEqual(results[1]?.confidence ?? 0);
});

test("suggest returns an empty array for unparseable input", () => {
  expect(engine.suggest("!!!")).toEqual([]);
  expect(engine.suggest("10 zork")).toEqual([]);
});

test("suggest re-throws a genuine bug instead of swallowing it", () => {
  const exploding = defineLocale({
    id: "en",
    numberFormat: "intl",
    analyze: [
      () => {
        throw new TypeError("boom");
      },
    ],
    keywords: {},
  });
  const e = createEngine({ locales: [exploding], kinds: BUILTIN_KINDS });
  expect(() => e.suggest("10 kg")).toThrow(TypeError);
});

test("coerce re-throws a genuine bug instead of reporting no candidate", () => {
  const exploding = defineLocale({
    id: "en",
    numberFormat: "intl",
    analyze: [
      () => {
        throw new TypeError("boom");
      },
    ],
    keywords: {},
  });
  const e = createEngine({ locales: [exploding], kinds: BUILTIN_KINDS });
  expect(() => e.coerce("mass", "10 kg")).toThrow(TypeError);
});

test("coerce filters candidates to the requested kind", () => {
  const v = engine.coerce("length", "10 m");
  expect(v.kind).toBe("length");
  expect(v.canonical.toString()).toBe("10");
});

test("coerce throws when no candidate matches the kind", () => {
  expect(() => engine.coerce("mass", "10 m")).toThrow(NoCandidateError);
});

test("mismatched dimensions throw", () => {
  expect(() => engine.evaluate("5 kg + 3 km")).toThrow(DimensionMismatchError);
});

test("an unknown unit throws NoCandidateError with suggestions", () => {
  try {
    engine.evaluate("10 kgg");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(NoCandidateError);
    expect((e as NoCandidateError).nearest).toContain("kg");
  }
});

test("explain exposes tokens, candidates and weight contributions", () => {
  const x = engine.explain("10 m");
  expect(x.tokens).toHaveLength(2);
  expect(x.candidates.map((c) => `${c.kind}:${c.unit}`).sort()).toEqual([
    "duration:min",
    "length:m",
  ]);
  expect(x.assignments[0]?.contributions.length).toBeGreaterThan(0);
});

test("explain contributions sum to the score for every assignment", () => {
  // The one invariant that makes explain() trustworthy: every summand of the
  // solver's score has a row. Each case below broke it in a different place —
  // a token: selector on non-lowercase input, contextBonus, analyzer weight.
  const cases: Array<[string, Record<string, number> | undefined]> = [
    ["10 m", undefined],
    ["10 KG", { "token:kg": 7 }],
    ["10 Kg", { "token:kg": 7, mass: 3 }],
    ["10 m + 5 km", undefined],
    ["10 m + 5 h", undefined],
    ["1.5 kilograms", undefined],
    ["1.5 kilograms", { "token:kilograms": 4, "mass:kg": 1 }],
    ["2 km in m", undefined],
    ["1 kg + 500 g in kg", { "mass:kg": 2, length: -1 }],
  ];

  for (const [input, weights] of cases) {
    const e = weights
      ? createEngine({ locales: [en], kinds: BUILTIN_KINDS, weights })
      : engine;
    const x = e.explain(input);
    expect(x.assignments.length).toBeGreaterThan(0);
    for (const a of x.assignments) {
      const sum = a.contributions.reduce((s, c) => s + c.value, 0);
      expect(`${input} [${a.kind}] ${sum}`).toBe(`${input} [${a.kind}] ${a.score}`);
    }
  }
});

test("explain lists a token selector matched against non-lowercase input", () => {
  const e = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "token:kg": 7 },
  });
  const rows = e.explain("10 KG").assignments[0]?.contributions ?? [];
  // layer 2 is the engine layer: layers are [locale, engine, per-call].
  expect(rows).toContainEqual({ selector: "token:kg", value: 7, layer: 2 });
});

test("explain lists contextBonus as its own row", () => {
  const rows = engine.explain("10 m + 5 km").assignments[0]?.contributions ?? [];
  expect(rows.filter((c) => c.selector === "contextBonus")).toEqual([
    { selector: "contextBonus", value: 30, layer: 0 },
  ]);
});

test("explain lists the analyzer's own weight", () => {
  const rows = engine.explain("1.5 kilograms").assignments[0]?.contributions ?? [];
  // en's suffixStripper penalises the plural stem by -2.
  expect(rows).toContainEqual({ selector: "analyzer", value: -2, layer: 0 });
});

test("conversion keywords match regardless of case", () => {
  const expected = engine.evaluate("2 km in m").formatted;
  expect(expected).toBe("2,000m");
  for (const input of ["2 km IN m", "2 km In m", "2 KM in M", "2 KM IN M"]) {
    expect(engine.evaluate(input).formatted).toBe(expected);
  }
});

test("results carry spans and confidence", () => {
  const r = engine.evaluate("1 kg + 500 g");
  expect(r.spans.length).toBeGreaterThan(0);
  expect(r.confidence).toBeGreaterThan(0);
});

test("a custom five-line kind works end to end", () => {
  // BUILTIN_KINDS now includes a real `datasize` kind (M2) with the same id
  // and the same b/kb/kib/mib aliases this local kind auto-derives, so
  // spreading both would throw KindConflictError("registered twice") before
  // the engine ever evaluated anything. The point of this test is that a
  // minimal, standalone kind definition works end to end — it never needed
  // BUILTIN_KINDS's other kinds for "2 mib + 500 kb in kb" — so it now
  // registers only itself.
  const datasize = defineKind({
    id: "datasize",
    value: {
      mode: "ratio",
      canonical: "b",
      units: { b: 1, kb: 1e3, kib: 1024, mib: 1024 ** 2 },
    },
  });
  const e = createEngine({ locales: [en], kinds: [datasize] });
  expect(e.evaluate("2 mib + 500 kb in kb").formatted).toBe("2,597.152kb");
});

test("kindMeta configured on the engine reaches Value.meta via evaluate and coerce", () => {
  const withMeta = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    kindMeta: { length: { source: "engine-default" } },
  });
  expect(withMeta.evaluate("10 km").value.meta).toEqual({ source: "engine-default" });
  expect(withMeta.coerce("length", "10 km").meta).toEqual({ source: "engine-default" });
});

test("engines with different locales coexist", () => {
  const a = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const b = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 99 },
  });
  expect(() => a.evaluate("10 m")).toThrow(AmbiguityError);
  expect(b.evaluate("10 m").kind).toBe("length");
});
