import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS, length, number } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import { Decimal } from "./decimal";
import { createEngine, type EngineOptions } from "./engine";
import {
  AmbiguityError,
  DimensionMismatchError,
  KeywordConflictError,
  MissingRateError,
  NoCandidateError,
  UnitParseError,
} from "./errors";
import { createFacades } from "./facade/index";
import { defineKind } from "./kind/define";
import { composeLocale } from "./locale/compose";
import { defineLanguage } from "./locale/define";
import type { LiteralMatcher, Value, Weights } from "./types";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

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
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m").kind).toBe("length");
});

test("per-call weights override engine weights", () => {
  const biased = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m", { weights: { "duration:min": 20 } }).kind).toBe(
    "duration",
  );
});

test("tiebreak first resolves instead of throwing", () => {
  const stable = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    tiebreak: "first",
  });
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
  const exploding = defineLanguage({
    id: "en",
    numberFormat: "intl",
    analyze: [
      () => {
        throw new TypeError("boom");
      },
    ],
    keywords: {},
    selectForm: () => "other",
  });
  const e = createEngine({
    locales: [composeLocale(exploding, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  expect(() => e.suggest("10 kg")).toThrow(TypeError);
});

test("coerce re-throws a genuine bug instead of reporting no candidate", () => {
  const exploding = defineLanguage({
    id: "en",
    numberFormat: "intl",
    analyze: [
      () => {
        throw new TypeError("boom");
      },
    ],
    keywords: {},
    selectForm: () => "other",
  });
  const e = createEngine({
    locales: [composeLocale(exploding, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
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

// Spec §3: the filter drops unit candidates, and a bare numeric literal has no
// candidate set to drop from. Without this, `10 kg * 2` under kinds:["mass"]
// would look like it needs "number" in the filter to survive — it does not.
test("opts.kinds filters unit candidates, never bare numbers", () => {
  expect(engine.evaluate("10 kg * 2", { kinds: ["mass"] }).formatted).toBe(
    engine.evaluate("10 kg * 2").formatted,
  );
  expect(engine.coerce("mass", "10 kg * 2").canonical.toString()).toBe("20000");
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
  //
  // The `locale:` rows are the P4 addition, and they are here rather than in
  // their own test because the failure they guard against is invisible
  // anywhere else: `toExplanation` rebuilds every row by re-calling
  // `weightBreakdown` with fields pulled off the stored `Candidate`, so a
  // `locale` that scoring passes and explaining forgets produces rows during
  // scoring and none during explaining, and every case above still passes.
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
    ["10 KG", { "locale:en": 7 }],
    ["1 kg + 500 g in kg", { "locale:en": 2, "mass:kg": 2 }],
    ["1.5 kilograms", { "locale:en": -3 }],
  ];

  for (const [input, weights] of cases) {
    const e = weights
      ? createEngine({
          locales: [composeLocale(en, BUILTIN_EN)],
          kinds: BUILTIN_KINDS,
          weights,
        })
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
    locales: [composeLocale(en, BUILTIN_EN)],
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

test("explain lists no signature row when no signature carries a weight", () => {
  // The row is emitted only when non-zero, so every built-in kind — none of
  // which weights a signature — explains exactly as it did before the term
  // existed. The positive case lives in solve/solver.test.ts, next to the one
  // fixture that sets a weight.
  const rows = engine.explain("10 m + 5 km").assignments[0]?.contributions ?? [];
  expect(rows.some((c) => c.selector === "signature")).toBe(false);
});

test("explain lists the analyzer's own weight", () => {
  const rows = engine.explain("1.5 kilograms").assignments[0]?.contributions ?? [];
  // en's suffixStripper penalises the plural stem by -2.
  expect(rows).toContainEqual({ selector: "analyzer", value: -2, layer: 0 });
});

test("conversion keywords match regardless of case", () => {
  const expected = engine.evaluate("2 km in m").formatted;
  expect(expected).toBe("2,000 metres");
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
  // The point of this test is a five-line kind definition working end to end
  // *alongside the full built-in roster* — that is what a third party
  // actually does. BUILTIN_KINDS now ships a real `datasize`, so the local
  // kind takes a distinct id; its units auto-derive their own aliases, which
  // therefore collide with the built-in datasize's b/kb/kib/mib. The
  // `{ kinds: [...] }` scope is how a caller breaks exactly that kind of tie
  // (measure.test.ts does the same with inch/mm against length).
  const datasize2 = defineKind({
    id: "datasize2",
    value: {
      mode: "ratio",
      canonical: "b",
      units: { b: 1, kb: 1e3, kib: 1024, mib: 1024 ** 2 },
    },
  });
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, datasize2],
  });
  const r = e.evaluate("2 mib + 500 kb in kb", { kinds: ["datasize2"] });
  expect(r.kind).toBe("datasize2");
  // The space is `defaultRenderQuantity`'s last branch: no vocabulary names
  // `datasize2`, so the unit has neither a word nor a symbol and the render
  // degrades to the registry key (I10). A kind that ships an `en` vocabulary
  // carries a symbol for every unit (ruling R8) and reads "2,597.152kb".
  expect(r.formatted).toBe("2,597.152 kb");
});

test("kindMeta configured on the engine reaches Value.meta via evaluate and coerce", () => {
  const withMeta = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    kindMeta: { length: { source: "engine-default" } },
  });
  expect(withMeta.evaluate("10 km").value.meta).toEqual({ source: "engine-default" });
  expect(withMeta.coerce("length", "10 km").meta).toEqual({ source: "engine-default" });
});

test("engines with different locales coexist", () => {
  const a = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  const b = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 99 },
  });
  expect(() => a.evaluate("10 m")).toThrow(AmbiguityError);
  expect(b.evaluate("10 m").kind).toBe("length");
});

test("engine.complete completes a partial unit", () => {
  const rows = engine.complete("30 ho");
  expect(rows[0]?.text).toBe("30 hours");
  expect(rows[0]?.kind).toBe("duration");
});

test("engine.complete honours engine-level weights", () => {
  const biased = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    weights: { duration: 20 },
  });
  expect(biased.complete("1 mi")[0]?.kind).toBe("duration");
});

test("engine.complete honours a per-call weights override", () => {
  // Locks in that `complete()` rebuilds its `Autocompleter` per call the same
  // way `evaluate()` rebuilds its `Parser`: `CompleteOptions.weights` is
  // documented as "layer 4, identical to EvalOptions.weights", so a
  // once-built `Autocompleter` that ignored it would silently stop honouring
  // a per-call weights argument while every other test here still passed.
  const plain = engine.complete("1 mi");
  const boosted = engine.complete("1 mi", { weights: { duration: 20 } });
  expect(plain[0]?.kind).not.toBe("duration");
  expect(boosted[0]?.kind).toBe("duration");
});

test("engine.complete narrows a conversion target to what converts", () => {
  // The bug this exists for: "s" prefixes "second" and it also prefixes "sqm",
  // "sqcm" and "sqkm", and no `in` signature takes a duration to an area — so
  // three of the four rows offered an input the same engine refuses.
  const rows = engine.complete("30 hours in s");
  expect(rows.map((r) => `${r.kind}:${r.unit}`)).toEqual(["duration:s"]);
  expect(() => engine.evaluate("30 hours in sqm")).toThrow(DimensionMismatchError);
});

test("engine.complete reads the whole head, not just the unit beside it", () => {
  const rows = engine.complete("10 kg + 5 lb in g");
  expect(rows.every((r) => r.kind === "mass")).toBe(true);
  expect(rows[0]?.text).toBe("10 kg + 5 lb in gram");
});

test("engine.complete narrows by the head's kind, not by the fragment's", () => {
  // "c" prefixes centimetre, Celsius and calorie, and the head decides which
  // of the three the target can be.
  expect(engine.complete("3 inches in c").map((r) => r.kind)).toEqual(["length"]);
  expect(engine.complete("100 c in f").every((r) => r.kind !== "length")).toBe(true);
});

test("engine.complete narrows nothing outside a conversion target", () => {
  const kinds = new Set(engine.complete("30 hours s").map((r) => r.kind));
  expect(kinds.has("area")).toBe(true);
});

test("engine.complete narrows nothing when the head reads as nothing", () => {
  // "30 zzz" has no reading, so there is no kind to convert *from* and the
  // list stays as wide as it was.
  const kinds = new Set(engine.complete("30 zzz in s").map((r) => r.kind));
  expect(kinds.has("area")).toBe(true);
});

test("engine.complete never throws on half-typed input", () => {
  for (const input of ["", " ", "10 kg +", "(((", "10 zzz", "30"]) {
    expect(Array.isArray(engine.complete(input))).toBe(true);
  }
});

test("a unit ratio reads the injected rates, and the result is dated", () => {
  // Half a "florin" per "guilder" — an invented pair, so nothing here depends
  // on a real currency table or on @smartput/rate existing yet.
  const rates = {
    base: "GLD",
    asOf: "2026-08-04",
    get: (from: string, to: string) =>
      from === "FLN" && to === "GLD" ? new Decimal("0.5") : null,
  };
  const treasure = defineKind({
    id: "treasure",
    value: {
      mode: "ratio",
      canonical: "gld",
      units: {
        gld: 1,
        fln: {
          ratio: (ctx) => {
            const rate = ctx.rates?.get("FLN", "GLD");
            if (rate === null || rate === undefined) {
              throw new MissingRateError(
                ctx.input ?? "",
                "FLN",
                "GLD",
                ctx.rates?.asOf ?? "",
              );
            }
            return rate;
          },
        },
      },
    },
  });

  const e = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, treasure],
    rates,
  });
  const r = e.evaluate("10 fln + 1 gld");
  expect(r.value.canonical.toString()).toBe("6");
  expect(r.meta.ratesAsOf).toBe("2026-08-04");
});

test("mutating the options object after createEngine does not affect later calls", () => {
  // The concrete failure this guards against: `Evaluator` snapshots `rates`
  // at construction, so `value.canonical` is already fixed to the table that
  // existed when `createEngine` ran. If the engine's own formatting/meta path
  // read the *live* options object instead of a frozen copy, a caller
  // mutating `opts.rates` afterward would make `evaluate()` answer with one
  // rate table baked into `value` and a different one showing up in
  // `formatted`/`meta.ratesAsOf` — two rate tables in one `Result`.
  const ratesA = {
    base: "GLD",
    asOf: "2026-08-04",
    get: (from: string, to: string) =>
      from === "FLN" && to === "GLD" ? new Decimal("0.5") : null,
  };
  const ratesB = {
    base: "GLD",
    asOf: "2099-01-01",
    get: (from: string, to: string) =>
      from === "FLN" && to === "GLD" ? new Decimal("99") : null,
  };
  const treasure = defineKind({
    id: "treasure",
    value: {
      mode: "ratio",
      canonical: "gld",
      units: {
        gld: 1,
        fln: {
          ratio: (ctx) => {
            const rate = ctx.rates?.get("FLN", "GLD");
            if (rate === null || rate === undefined) {
              throw new MissingRateError(
                ctx.input ?? "",
                "FLN",
                "GLD",
                ctx.rates?.asOf ?? "",
              );
            }
            return rate;
          },
        },
      },
    },
  });

  const opts: EngineOptions = {
    locales: [composeLocale(en)],
    kinds: [number, treasure],
    rates: ratesA,
  };
  const e = createEngine(opts);
  const before = e.evaluate("10 fln + 1 gld");

  // Mutate the very object `createEngine` was given, after construction.
  opts.rates = ratesB;
  opts.formatPrecision = 2;

  const after = e.evaluate("10 fln + 1 gld");
  expect(after.value.canonical.toString()).toBe(before.value.canonical.toString());
  expect(after.meta.ratesAsOf).toBe(before.meta.ratesAsOf);
  expect(after.formatted).toBe(before.formatted);
});

test("without rates, a rate-dependent unit raises MissingRateError", () => {
  const rates = {
    base: "GLD",
    asOf: "2026-08-04",
    get: () => null,
  };
  const treasure = defineKind({
    id: "treasure",
    value: {
      mode: "ratio",
      canonical: "gld",
      units: {
        gld: 1,
        fln: {
          ratio: (ctx) => {
            const rate = ctx.rates?.get("FLN", "GLD");
            if (rate === null || rate === undefined) {
              throw new MissingRateError(
                ctx.input ?? "",
                "FLN",
                "GLD",
                ctx.rates?.asOf ?? "",
              );
            }
            return rate;
          },
        },
      },
    },
  });
  const e = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, treasure],
    rates,
  });
  expect(() => e.evaluate("10 fln")).toThrow(MissingRateError);
});

test("rounding does not perturb an ordinary kind's formatted output", () => {
  // EngineOptions.rounding is documented as money formatting, and money reads
  // it from its format hook's ctx. Reaching the guard-digit trim as well would
  // let it decide the 26th significant digit of every kind — this same input
  // rendered ...334 under ROUND_UP before the scoping, purely by promoting
  // round-trip noise to a policy.
  const plain = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  const up = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    rounding: Decimal.ROUND_UP,
  });
  const expected = "0.33333333333333333333333333 kilometres";
  // `display` is turned off for the assertion, not for the mechanism: the
  // digit `rounding` would perturb is the 26th, and the four-fraction-digit
  // display policy this engine ships with would hide the difference rather
  // than prove it absent. Ruling R-C1's two figures, both visible in one test.
  const wide = { display: { maximumFractionDigits: 30 } } as const;
  expect(plain.evaluate("1 km / 3", wide).formatted).toBe(expected);
  expect(up.evaluate("1 km / 3", wide).formatted).toBe(expected);
  expect(plain.evaluate("1 km / 3").formatted).toBe("0.3333 kilometres");
});

test("a result carries no ratesAsOf when no rates were supplied", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  expect(e.evaluate("1 km").meta.ratesAsOf).toBeUndefined();
});

/** Echoes the clock and zone it was handed, so the wiring is observable. */
const clockProbe: LiteralMatcher = (input, offset, ctx) =>
  input.startsWith("now", offset)
    ? {
        kind: "probe",
        unit: ctx.timeZone === "UTC" ? "UTC" : "other",
        canonical: new Decimal(ctx.now),
        length: 3,
      }
    : null;

/** Refuses anything whose letters are all unit aliases — the R4 accept-gate. */
const gated: LiteralMatcher = (input, offset, ctx) => {
  const rest = input.slice(offset);
  const m = /^\d+ [a-z]+/.exec(rest);
  if (m === null) return null;
  const word = m[0].split(" ")[1] as string;
  if (ctx.isUnitAlias(word)) return null;
  return { kind: "probe", unit: "UTC", canonical: new Decimal(1), length: m[0].length };
};

const probe = (literals: LiteralMatcher[]) =>
  defineKind({
    id: "probe",
    value: { mode: "opaque", units: ["UTC", "other"] },
    literals,
    format: (v) => v.canonical.toFixed(),
  });

test("EngineOptions.now is what the matcher sees", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now").value.canonical.toString()).toBe("1768478400000");
  expect(engine.evaluate("now").value.unit).toBe("UTC");
});

test("EvalOptions.timeZone overrides the engine's", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now", { timeZone: "Asia/Tokyo" }).value.unit).toBe("other");
});

test("isUnitAlias reports what the registry indexed", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, length, probe([gated])],
    now: () => 0,
    timeZone: "UTC",
  });
  // "10 km" — km is a length alias, so the matcher declines and the ordinary
  // reading survives.
  expect(engine.evaluate("10 km").kind).toBe("length");
  // "10 zz" — not an alias, so the matcher claims it.
  expect(engine.evaluate("10 zz").kind).toBe("probe");
});

test("createFacades skips opaque kinds rather than generating a broken class", () => {
  const facades = createFacades({
    kinds: [number, length, probe([])],
    locale: composeLocale(en),
  });
  expect(Object.keys(facades).sort()).toEqual(["length", "number"]);
});

test("completion offers nothing for an opaque kind", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, length, probe([])],
  });
  // `.every()` over a possibly-empty array is vacuously true — it would pass
  // just as well if `complete()` always returned `[]`, opaque kind or not.
  // `toEqual([])` is the actual claim.
  expect(engine.complete("1 ut")).toEqual([]);

  // The companion: the identical alias, on a non-opaque kind, proves the
  // emptiness above comes from `probe` being opaque — not from "1 ut" simply
  // having no match for any kind, which the assertion above could not by
  // itself distinguish.
  const clock = defineKind({
    id: "clock",
    value: { mode: "ratio", canonical: "utc", units: { utc: 1 } },
  });
  const nonOpaqueEngine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, length, clock],
  });
  expect(nonOpaqueEngine.complete("1 ut").some((c) => c.kind === "clock")).toBe(true);
});

/**
 * A claim that carries a value but is not a conversion target — datetime's
 * "tomorrow" is the real instance.
 */
const untargetable: LiteralMatcher = (input, offset) =>
  input.slice(offset).startsWith("mark")
    ? { kind: "probe", unit: "UTC", canonical: new Decimal(7), length: 4 }
    : null;

test("a literal that does not opt in cannot be a conversion target", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([untargetable])],
  });

  // The claim still works on the left, where it is a value.
  expect(engine.evaluate("mark").kind).toBe("probe");
  // But not on the right of `in`. Accepting every literal there is what
  // silently turned "today in tomorrow" into a zone conversion returning today.
  expect(() => engine.evaluate("mark in mark")).toThrow(UnitParseError);
});

test("a targetable literal reaches apply with its own meta, not the stand-in's", () => {
  let sawRight: Value | undefined;
  const kind = defineKind({
    id: "probe",
    value: { mode: "opaque", units: ["UTC", "other"] },
    literals: [
      (input, offset) =>
        input.slice(offset).startsWith("mark")
          ? {
              kind: "probe",
              unit: "other",
              canonical: new Decimal(7),
              meta: { tag: "claimed" },
              length: 4,
              targetable: true,
            }
          : null,
    ],
    ops: [
      {
        op: "in",
        left: "probe",
        right: "probe",
        result: "probe",
        apply: (l, r) => {
          sawRight = r;
          return l;
        },
      },
    ],
    format: (v) => v.canonical.toFixed(),
  });
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [number, kind] });

  engine.evaluate("mark in mark");
  // The stand-in core synthesizes for an ordinary unit target carries canonical
  // 0 and the *left* operand's meta. A claimed target carries its own, which is
  // the whole reason the datetime and rates bridges can read `meta.zone` and
  // `meta.currency` off the right operand.
  expect(sawRight?.canonical.toString()).toBe("7");
  expect(sawRight?.meta?.tag).toBe("claimed");
});

// ---------------------------------------------------------------------------
// M6.3 — several readings of one claim, ranked rather than chosen between
// ---------------------------------------------------------------------------

/**
 * Two readings of one name, the shape geo's trie has for "athens": the capital
 * at +2 and the other one at +1.70, both real, one of them meant.
 */
const twoCities: LiteralMatcher = (input, offset) =>
  input.slice(offset).startsWith("athens")
    ? [
        {
          kind: "probe",
          unit: "UTC",
          canonical: new Decimal(264371),
          meta: { name: "Athens, GR" },
          length: 6,
          weight: 2,
        },
        {
          kind: "probe",
          unit: "other",
          canonical: new Decimal(4180386),
          meta: { name: "Athens, GA" },
          length: 6,
          weight: 1.7,
        },
      ]
    : null;

test("suggest returns every reading of one claim, best first", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([twoCities])],
  });
  const suggested = engine.suggest("athens");
  expect(suggested.map((r) => r.value.meta?.name)).toEqual(["Athens, GR", "Athens, GA"]);
  // Ranked, not merely listed: the weights order them and the confidences say so.
  expect(suggested[0]?.confidence).toBeGreaterThan(suggested[1]?.confidence ?? 1);
  // And evaluate still decides. Two readings of one span are a ranking; asking
  // the user which Athens they meant is what suggest() is for.
  expect(engine.evaluate("athens").value.canonical.toString()).toBe("264371");
});

/**
 * Spec §6.2, proved with a probe because `postalLiteral` is another agent's half
 * of M6.3. `90210` is a valid ZIP and a valid number, and the weight is what
 * says which one a bare five digits is: below `NUMBER_FALLBACK_WEIGHT`, so the
 * ordinary number wins — the fold no longer decides it by eating the token.
 */
const postal: LiteralMatcher = (input, offset) =>
  /^\d{5}(?!\d)/.test(input.slice(offset))
    ? {
        kind: "probe",
        unit: "UTC",
        canonical: new Decimal(90210),
        meta: { name: "Beverly Hills" },
        length: 5,
        weight: -1,
      }
    : null;

test("a claimed number evaluates as a number and suggests the claim beneath it", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([postal])],
  });

  const r = engine.evaluate("90210");
  expect(r.kind).toBe("number");
  expect(r.value.canonical.toString()).toBe("90210");
  expect(r.formatted).toBe("90,210");

  // The reading the destructive fold used to swallow whole. Both are present,
  // and the order is the weights' doing rather than the parser's.
  expect(engine.suggest("90210").map((s) => s.kind)).toEqual(["number", "probe"]);
  expect(engine.suggest("90210")[1]?.value.meta?.name).toBe("Beverly Hills");
});

test("a claim that names no weight still beats the number underneath it", () => {
  // The reason `NUMBER_FALLBACK_WEIGHT` is not zero: a matcher that starts
  // claiming bare digits without thinking about weight behaves as it did when
  // the fold was destructive, instead of turning a decided input into an
  // AmbiguityError.
  const unweighted: LiteralMatcher = (input, offset) =>
    /^\d{5}(?!\d)/.test(input.slice(offset))
      ? { kind: "probe", unit: "UTC", canonical: new Decimal(1), length: 5 }
      : null;
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, probe([unweighted])],
  });
  expect(engine.evaluate("90210").kind).toBe("probe");
  expect(engine.suggest("90210").map((s) => s.kind)).toEqual(["probe", "number"]);
});

test("a claimed word keeps the unit reading of the word underneath it", () => {
  // Spec §6.3's "both readings survive to the solver", which the destructive
  // fold made impossible: a claim over a single word used to be the only reading
  // there was, so a kind whose matcher claimed another kind's unit alias cost it
  // the alias — the 17 city names datetime's zones took.
  const kind = defineKind({
    id: "probe",
    value: { mode: "opaque", units: ["UTC", "other"] },
    literals: [
      (input, offset) =>
        input.slice(offset).startsWith("utc")
          ? {
              kind: "probe",
              unit: "other",
              canonical: new Decimal(5),
              length: 3,
              targetable: true,
            }
          : null,
    ],
    ops: [{ op: "in", left: "probe", right: "probe", result: "probe", apply: (l) => l }],
    format: (v) => v.canonical.toFixed(),
  });
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [number, kind] });

  // "utc" is unit UTC's alias and now also a claim of unit `other`. Both reach
  // the conversion-target slot: the claim because it opted in, and the label
  // because the word underneath the claim is still a registered alias. The
  // convert node is the first slot the walk collects, so each pair reads
  // target-first.
  expect(engine.explain("utc in utc").assignments.map((a) => a.units.join(","))).toEqual([
    "other,other",
    "UTC,other",
  ]);
});

/*
 * P4 Task 16 — `locale:` weights, `format`, `EvalOptions.locales`.
 *
 * Recognition is many-locale and generation is exactly one (design decision
 * I6), so everything below is about the seam between the two: which readings
 * exist (every installed language's), which language they are printed in
 * (`format`, one), and how a caller biases or narrows the first without
 * touching the second.
 */

const uk = composeLocale(ukrainian, BUILTIN_UK);
const bilingual = createEngine({
  locales: [composeLocale(en, BUILTIN_EN), uk],
  kinds: BUILTIN_KINDS,
});

test("both languages are accepted, and a locale: weight biases one", () => {
  const preferred = createEngine({
    locales: [composeLocale(en, BUILTIN_EN), uk],
    kinds: BUILTIN_KINDS,
    weights: { "locale:en": 10, "locale:uk": 5 },
  });
  expect(preferred.evaluate("5 kg").kind).toBe("mass");
  expect(preferred.evaluate("5 кг").kind).toBe("mass");
  // The claim the assertions above cannot make on their own: the weight is
  // reaching the readings at all. `locale:` is a whole-vocabulary bias knob,
  // not a same-token tiebreaker — `buildRegistry` tags each alias with the
  // alphabetically first language that listed it, so "kg" is an `en` reading
  // even here and "кг" is the `uk` one.
  const rows = (e: ReturnType<typeof createEngine>, input: string) =>
    e.explain(input).assignments[0]?.contributions ?? [];
  expect(rows(preferred, "5 kg")).toContainEqual({
    selector: "locale:en",
    value: 10,
    layer: 2,
  });
  expect(rows(preferred, "5 кг")).toContainEqual({
    selector: "locale:uk",
    value: 5,
    layer: 2,
  });
  // And the sum invariant with a `locale:` row present on a two-locale
  // engine, which is the one configuration the table above cannot build.
  for (const input of ["5 kg", "5 кг", "5 кг in pounds"]) {
    for (const a of preferred.explain(input).assignments) {
      const sum = a.contributions.reduce((s, c) => s + c.value, 0);
      expect(`${input} [${a.kind}] ${sum}`).toBe(`${input} [${a.kind}] ${a.score}`);
    }
  }
});

test("format decides the output language, not the input", () => {
  const ukFormat = createEngine({
    locales: [composeLocale(en, BUILTIN_EN), uk],
    kinds: BUILTIN_KINDS,
    format: "uk",
  });
  expect(ukFormat.evaluate("5 kg").formatted).toBe("5 кілограмів");
  expect(ukFormat.evaluate("5 кг").formatted).toBe("5 кілограмів");
  expect(bilingual.evaluate("5 kg").formatted).toBe("5 kilograms");
  expect(bilingual.evaluate("5 кг").formatted).toBe("5 kilograms");
});

test("format names a locale that must be installed", () => {
  expect(() =>
    createEngine({
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: BUILTIN_KINDS,
      format: "uk",
    }),
  ).toThrow(/format "uk" is not among the installed locales \(en\)/);
});

test("a per-call format rebuilds the printer instead of moving the engine's", () => {
  // The bug this catches is a per-call override that mutates the shared
  // stage: the third call has no override and must still be the engine's own
  // language, whatever the two before it asked for.
  expect(bilingual.evaluate("5 kg", { format: "uk" }).formatted).toBe("5 кілограмів");
  expect(bilingual.evaluate("5 kg", { format: "en" }).formatted).toBe("5 kilograms");
  expect(bilingual.evaluate("5 kg").formatted).toBe("5 kilograms");
  // And the reverse order, on a uk-format engine, so neither direction can
  // pass by leaking the value it was already going to produce.
  const ukFormat = createEngine({
    locales: [composeLocale(en, BUILTIN_EN), uk],
    kinds: BUILTIN_KINDS,
    format: "uk",
  });
  expect(ukFormat.evaluate("5 kg", { format: "en" }).formatted).toBe("5 kilograms");
  expect(ukFormat.evaluate("5 kg").formatted).toBe("5 кілограмів");
});

test("a per-call format names a locale that must be installed", () => {
  expect(() => bilingual.evaluate("5 kg", { format: "zz" })).toThrow(
    /format "zz" is not among the installed locales \(en, uk\)/,
  );
});

test("EvalOptions.locales filters by language the way kinds filters by kind", () => {
  expect(bilingual.evaluate("5 кг", { locales: ["uk"] }).value.unit).toBe("kg");
  expect(bilingual.evaluate("5 kg", { locales: ["en"] }).value.unit).toBe("kg");
  // Exactly the error `kinds` raises when its filter empties every slot: the
  // reading was found and then refused, so the parse succeeded and the solver
  // is where nothing is left. (The plan expected NoCandidateError; that is
  // what an *unrecognised* surface raises, in the parser, before any filter.)
  expect(() => bilingual.evaluate("5 кг", { locales: ["en"] })).toThrow(
    DimensionMismatchError,
  );
});

test("EvalOptions.locales keeps the language-neutral tag", () => {
  // `"*"` is the unit-key floor `buildRegistry` writes for a kind no installed
  // language speaks for (ruling R6) — `sprocket` below is one, so its `spk` is
  // reachable by spelling alone. `"*"` is not a language, so no `locales` list
  // could name it, and a filter that dropped it would make asking for a
  // language silently unregister every kind without a vocabulary.
  const sprocket = defineKind({
    id: "sprocket",
    value: { mode: "ratio", canonical: "spk", units: { spk: 1 } },
  });
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN), uk],
    kinds: [...BUILTIN_KINDS, sprocket],
  });
  expect(e.evaluate("5 spk").kind).toBe("sprocket");
  expect(e.evaluate("5 spk", { locales: ["uk"] }).kind).toBe("sprocket");
  expect(e.evaluate("5 spk", { locales: [] }).kind).toBe("sprocket");
});

test("EvalOptions.locales reaches coerce, which builds its own solver options", () => {
  expect(() => bilingual.coerce("mass", "5 кг", { locales: ["en"] })).toThrow(
    NoCandidateError,
  );
  expect(bilingual.coerce("mass", "5 кг", { locales: ["uk"] }).unit).toBe("kg");
});

test("keywords are many-locale: every installed language's connectives lex", () => {
  // The gap this closes, measured before the change: the alias half of
  // recognition already worked on a two-locale engine ("5 кг" resolved), and
  // the only reason Ukrainian *sentences* threw was that `lex` read one
  // language's keyword table. "в"/"до" are uk-only, "in" is en-only, and one
  // engine now reads both.
  expect(bilingual.evaluate("5 кг в грамах").formatted).toBe("5,000 grams");
  expect(bilingual.evaluate("5 кг до грамів").formatted).toBe("5,000 grams");
  expect(bilingual.evaluate("5 кг in grams").formatted).toBe("5,000 grams");
  expect(bilingual.evaluate("5 кг помножити на 2").formatted).toBe("10 kilograms");
});

test("numerals are many-locale: each language is offered the same word run", () => {
  expect(bilingual.evaluate("двадцять два кг").value.canonical.toString()).toBe("22000");
  expect(bilingual.evaluate("twenty two kg").value.canonical.toString()).toBe("22000");
});

test("a surface meaning two different keywords across languages fails on boot", () => {
  // Not at a keystroke: `buildKeywords` runs once, inside `createEngine`, so
  // the stack names the line that wired the two languages together (I9).
  const clash = defineLanguage({
    id: "clash",
    numberFormat: "intl",
    keywords: { of: ["in"] },
    selectForm: () => "other",
  });
  expect(() =>
    createEngine({
      locales: [composeLocale(en, BUILTIN_EN), composeLocale(clash)],
      kinds: BUILTIN_KINDS,
    }),
  ).toThrow(KeywordConflictError);
});

test("cues passed to suggest re-rank the readings", () => {
  // Bare "10 m" ties, and solve's tie-break is `a.kind.localeCompare(b.kind)`,
  // so `duration` wins unaided. Biasing toward `length` is therefore the only
  // direction that proves the option is wired: asserting `duration` here would
  // pass with EvalOptions.cues deleted.
  const unbiased = engine.suggest("10 m");
  expect(unbiased[0]?.kind).toBe("duration");

  const ranked = engine.suggest("10 m", { cues: { length: 4 } });
  expect(ranked[0]?.kind).toBe("length");
  expect(ranked[1]?.kind).toBe("duration");
  // The magnitude too, not just the order — see spec §4. Delta 4 through the
  // softmax is 0.982/0.018.
  expect(ranked[0]?.confidence).toBeCloseTo(0.982, 3);
});

test("explain lists cueBonus as its own row when a cue applied", () => {
  const explained = engine.explain("10 m", { cues: { duration: 3 } });
  const duration = explained.assignments.find((a) => a.kind === "duration");
  expect(duration?.contributions).toContainEqual({
    selector: "cueBonus",
    value: 3,
    layer: 0,
  });
});

test("explain omits the cueBonus row when no cue applied", () => {
  // Emitted only when non-zero, following `signature` and not `contextBonus`:
  // an unconditional row would add `cueBonus: 0` to every explanation in the
  // repo to say nothing, and would move every recorded parity fixture.
  const explained = engine.explain("10 m");
  for (const assignment of explained.assignments) {
    expect(assignment.contributions.map((c) => c.selector)).not.toContain("cueBonus");
  }
});

test("the contribution rows still sum to the score with a cue applied", () => {
  const explained = engine.explain("10 m", { cues: { duration: 3 } });
  for (const assignment of explained.assignments) {
    const sum = assignment.contributions.reduce((total, c) => total + c.value, 0);
    expect(sum).toBeCloseTo(assignment.score, 10);
  }
});

/**
 * R-E1: `explain` is the one API whose job is to say why an input failed, and
 * it used to let the failure out instead of reporting it — unusable on exactly
 * the inputs a caller reaches for it with. Every `SmartputError` is an
 * `outcome` now; anything else is a bug in a stage and still propagates.
 */
test("explain returns an Explanation for input evaluate throws on", () => {
  // Was "100 km / 2 h in km/h", which spec §D turned into a working input: a
  // compound unit is a conversion target now, so that string evaluates and
  // proves nothing about `explain`. "10 kg / 2 m" has no signature and no
  // prospect of one, which is what this test needs.
  const ex = engine.explain("10 kg / 2 m");
  expect(ex.outcome.status).toBe("error");
  expect(ex.tokens.length).toBeGreaterThan(0);
  expect(ex.candidates.length).toBeGreaterThan(0);
  expect(ex.rejections.length).toBeGreaterThan(0);
  for (const r of ex.rejections) {
    expect(r.spans[0].end).toBeGreaterThan(r.spans[0].start);
    expect(r.op).not.toBe("operation");
  }
});

test("explain on a good input reports ok and no rejections", () => {
  const ex = engine.explain("1.5 kg in lb");
  expect(ex.outcome).toEqual({ status: "ok" });
  expect(ex.rejections).toEqual([]);
});

test("explain returns for every error class rather than throwing", () => {
  for (const input of ["10 kg / 2 m", "5 zorkmids", "1h30m", ""]) {
    const ex = engine.explain(input);
    expect(ex.input).toBe(input);
    expect(["ok", "error"]).toContain(ex.outcome.status);
  }
});

test("a mismatch names the operator and every pair the solver tried", () => {
  try {
    engine.evaluate("10 kg / 2 m");
    throw new Error("expected DimensionMismatchError");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err).toBeInstanceOf(DimensionMismatchError);
    expect(err.op).toBe("/");
    expect(err.spans).toHaveLength(3);
    expect(err.tried.length).toBeGreaterThan(1);
    expect(err.tried).toContainEqual(["mass", "length"]);
  }
});

test("a non-SmartputError still propagates out of explain: it is a bug, not an outcome", () => {
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new TypeError("boom");
      },
    },
  ) as unknown as Weights;
  expect(() => engine.explain("1 kg", { weights: hostile })).toThrow(TypeError);
});

/**
 * Ruling R-C1 — the display policy, wired.
 *
 * `formatPrecision` (26 significant digits) is the round-trip and comparison
 * guard and keeps both its meaning and its default; `display` is what
 * `Result.formatted` is allowed to keep. The two figures answer two different
 * questions, and the cost of separating them is stated in the last test here:
 * `formatted` and `value.canonical` no longer agree digit for digit, by design.
 */
test("R-C1: formatted reads the way a person expects", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  expect(e.evaluate("1.5 kg in lb").formatted).toBe("3.3069 pounds");
  expect(e.evaluate("60 mph in kph").formatted).toBe("96.5606 km/h");
  // Spelled as a conversion since spec §D: "50 km/h" is a length over a
  // duration, and a derived result now keeps the units the person wrote, so it
  // comes back "50 km/h" with no repeating decimal left to round.
  expect(e.evaluate("50 km/h in mps").formatted).toBe("13.8889 m/s");
  expect(e.evaluate("90 deg in rad").formatted).toBe("1.5708 radians");
});

test("R-C1: display is a display policy — the value keeps every digit", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  const r = e.evaluate("1.5 kg in lb");
  expect(r.value.canonical.toFixed()).toBe("1500");
  expect(r.value.unit).toBe("lb");
  expect(r.formatted).toBe("3.3069 pounds");
});

test("the significant-digit floor keeps a small value off zero", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  // Four fraction digits alone would round this to "0 grams"; the three
  // significant-digit floor is the whole reason the policy is two figures.
  expect(e.evaluate("0.00001234 g").formatted).toBe("0.0000123 grams");
});

test("a scientific caller sets display once and gets its digits back", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    display: { maximumFractionDigits: 12 },
  });
  expect(e.evaluate("1.5 kg in lb").formatted).toBe("3.306933932773 pounds");
});

test("display overrides per call, like format", () => {
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  // Both halves of the policy stay in force: asking for one fraction digit
  // still gets the three-significant-digit floor, because the floor is what
  // stops a small value displaying as 0 and a per-call override of one field
  // is not a request to drop the other. Say so to get one digit.
  expect(
    e.evaluate("1.5 kg in lb", { display: { maximumFractionDigits: 1 } }).formatted,
  ).toBe("3.31 pounds");
  expect(
    e.evaluate("1.5 kg in lb", {
      display: { maximumFractionDigits: 1, minimumSignificantDigits: 1 },
    }).formatted,
  ).toBe("3.3 pounds");
  // Per call, and only for that call: the engine's own policy is untouched.
  expect(e.evaluate("1.5 kg in lb").formatted).toBe("3.3069 pounds");
});

test("a per-call display composes with a per-call format", () => {
  // Both are per-call output overrides, and the ctx that carries one has to
  // carry the other: `format` rebuilds the Printer, `display` does not, so a
  // call using both is the one that would drop `display` if the rebuild
  // branch forgot it.
  const e = createEngine({
    locales: [composeLocale(en, BUILTIN_EN), composeLocale(ukrainian, BUILTIN_UK)],
    kinds: BUILTIN_KINDS,
  });
  const uk = e.evaluate("1.5 kg in lb", { format: "uk" }).formatted;
  const short = e.evaluate("1.5 kg in lb", {
    format: "uk",
    display: { maximumFractionDigits: 1, minimumSignificantDigits: 1 },
  }).formatted;
  expect(uk).toContain("3,3069");
  expect(short).toBe(uk.replace(/^3,3\d+/, "3,3"));
});

test("R-C1: a kind that formats itself is exempt, so money keeps its own cent", () => {
  // The money exemption, enforced at the call site rather than inside
  // `applyDisplay`: a kind with its own `format` hook decides its last digit
  // (a currency's minor units, under `rounding`), and a general readability
  // policy re-rounding £22.94 would be core deciding a domain question.
  const doubloon = defineKind({
    id: "doubloon",
    value: { mode: "ratio", canonical: "dbl", units: { dbl: 1 } },
    format: (_v, ctx) => `${ctx.formatNumber(ctx.authored, { precision: 8 })} dbl`,
  });
  const e = createEngine({
    locales: [composeLocale(en)],
    kinds: [number, doubloon],
    display: { maximumFractionDigits: 1 },
  });
  expect(e.evaluate("1 dbl / 3").formatted).toBe("0.33333333 dbl");
});
