import { expect, test } from "bun:test";
import { BUILTIN_KINDS, length, number } from "@smartput/kinds";
import { Decimal } from "./decimal";
import { createEngine } from "./engine";
import {
  AmbiguityError,
  DimensionMismatchError,
  MissingRateError,
  NoCandidateError,
  UnitParseError,
} from "./errors";
import { createFacades } from "./facade/index";
import { defineKind } from "./kind/define";
import { defineLocale } from "./locale/define";
import en from "./locale/en";
import type { LiteralMatcher, Value } from "./types";

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
  const e = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, datasize2] });
  const r = e.evaluate("2 mib + 500 kb in kb", { kinds: ["datasize2"] });
  expect(r.kind).toBe("datasize2");
  expect(r.formatted).toBe("2,597.152kb");
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

test("engine.complete completes a partial unit", () => {
  const rows = engine.complete("30 ho");
  expect(rows[0]?.text).toBe("30 hours");
  expect(rows[0]?.kind).toBe("duration");
});

test("engine.complete honours engine-level weights", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { duration: 20 },
  });
  expect(biased.complete("1 mi")[0]?.kind).toBe("duration");
});

test("engine.complete never throws on half-typed input", () => {
  for (const input of ["", " ", "10 kg +", "(((", "10 zzz", "30"]) {
    expect(Array.isArray(engine.complete(input))).toBe(true);
  }
});

test("a unit ratio reads the injected rates, and the result is dated", () => {
  // Half a "florin" per "guilder" — an invented pair, so nothing here depends
  // on a real currency table or on @smartput/rates existing yet.
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
    lexicon: { gld: { aliases: ["gld"] }, fln: { aliases: ["fln"] } },
  });

  const e = createEngine({ locales: [en], kinds: [number, treasure], rates });
  const r = e.evaluate("10 fln + 1 gld");
  expect(r.value.canonical.toString()).toBe("6");
  expect(r.meta.ratesAsOf).toBe("2026-08-04");
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
    lexicon: { gld: { aliases: ["gld"] }, fln: { aliases: ["fln"] } },
  });
  const e = createEngine({ locales: [en], kinds: [number, treasure], rates });
  expect(() => e.evaluate("10 fln")).toThrow(MissingRateError);
});

test("rounding does not perturb an ordinary kind's formatted output", () => {
  // EngineOptions.rounding is documented as money formatting, and money reads
  // it from its format hook's ctx. Reaching the guard-digit trim as well would
  // let it decide the 26th significant digit of every kind — this same input
  // rendered ...334 under ROUND_UP before the scoping, purely by promoting
  // round-trip noise to a policy.
  const plain = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const up = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    rounding: Decimal.ROUND_UP,
  });
  const expected = "0.33333333333333333333333333 kilometres";
  expect(plain.evaluate("1 km / 3").formatted).toBe(expected);
  expect(up.evaluate("1 km / 3").formatted).toBe(expected);
});

test("a result carries no ratesAsOf when no rates were supplied", () => {
  const e = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
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
    value: { mode: "opaque", units: { UTC: ["utc"], other: ["other"] } },
    literals,
    format: (v) => v.canonical.toFixed(),
  });

test("EngineOptions.now is what the matcher sees", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now").value.canonical.toString()).toBe("1768478400000");
  expect(engine.evaluate("now").value.unit).toBe("UTC");
});

test("EvalOptions.timeZone overrides the engine's", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now", { timeZone: "Asia/Tokyo" }).value.unit).toBe("other");
});

test("isUnitAlias reports what the registry indexed", () => {
  const engine = createEngine({
    locales: [en],
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
  const facades = createFacades({ kinds: [number, length, probe([])], locale: en });
  expect(Object.keys(facades).sort()).toEqual(["length", "number"]);
});

test("completion offers nothing for an opaque kind", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, length, probe([])],
  });
  expect(engine.complete("1 ut").every((c) => c.kind !== "probe")).toBe(true);
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
  const engine = createEngine({ locales: [en], kinds: [number, probe([untargetable])] });

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
    value: { mode: "opaque", units: { UTC: ["utc"], other: ["other"] } },
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
  const engine = createEngine({ locales: [en], kinds: [number, kind] });

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
  const engine = createEngine({ locales: [en], kinds: [number, probe([twoCities])] });
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
  const engine = createEngine({ locales: [en], kinds: [number, probe([postal])] });

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
  const engine = createEngine({ locales: [en], kinds: [number, probe([unweighted])] });
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
    value: { mode: "opaque", units: { UTC: ["utc"], other: ["other"] } },
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
  const engine = createEngine({ locales: [en], kinds: [number, kind] });

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
