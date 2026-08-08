import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";
import type {
  CompleteCtx,
  Completer,
  Kind,
  KindCompletion,
  Vocabulary,
  Weights,
} from "../types";
import { complete } from "./complete";
import { EXACT_BONUS, LENGTH_PENALTY, SCALE_BONUS, TYPO_PENALTY } from "./score";

const en = composeLocale(english, BUILTIN_EN);

const registry = buildRegistry(BUILTIN_KINDS, [en]);
const run = (
  input: string,
  opts?: Parameters<typeof complete>[0]["opts"],
  layers: (Weights | undefined)[] = [english.weights],
) =>
  complete({
    registry,
    locale: en,
    layers,
    input,
    ...(opts ? { opts } : {}),
  });

test("completes a partial unit into its plural word form", () => {
  const [top] = run("30 ho");
  expect(top?.text).toBe("30 hours");
  expect(top?.kind).toBe("duration");
  expect(top?.unit).toBe("h");
});

test("uses the singular when the count selects it", () => {
  expect(run("1 ho")[0]?.text).toBe("1 hour");
});

test("renders the singular when there is no count at all", () => {
  expect(run("ho")[0]?.text).toBe("hour");
});

// The spec's worked tables (§4) were computed against the M1 kind set. Every
// score they list still holds exactly; M2's kinds simply contribute extra rows
// that interleave by the total order — score desc, then kind, unit, alias.
test("ranks mile above the milli- units for a longer prefix", () => {
  const rows = run("10 mil");
  expect(rows.map((r) => `${r.kind}:${r.unit}`)).toEqual([
    "length:mi", // +2  = -1 length, +3 scale
    "mass:mg", // -3  = -6 length, +3 scale
    "length:mm", // -4  = -7 length, +3 scale
    "volume:ml", // -4, ties mm, loses "length" < "volume"
    "duration:ms", // -5  = -8 length, +3 scale
  ]);
  expect(rows[0]?.text).toBe("10 miles");
});

test("offers one row per unit, ranked, for an ambiguous prefix", () => {
  const rows = run("1 mi");
  expect(rows.map((r) => `${r.kind}:${r.unit}`)).toEqual([
    "length:mi", // +13 = +10 exact, +3 scale
    "datasize:mib", // +2, ties min, wins "datasize" < "duration"
    "duration:min", // +2  = -1 length, +3 scale
    "mass:mg", // -4
    "length:mm", // -5
    "volume:ml", // -5, ties mm, loses "length" < "volume"
    "duration:ms", // -6
  ]);
  expect(rows.map((r) => r.text)).toEqual([
    "1 mile",
    "1 mebibyte",
    "1 minute",
    "1 milligram",
    "1 millimetre",
    "1 millilitre",
    "1 millisecond",
  ]);
});

test("an exact alias outranks a scale-fitting completion", () => {
  // 600 is outside mi's band and inside ms's, but "mi" is exact and
  // EXACT_BONUS (10) is larger than SCALE_BONUS (3). Documented in the spec.
  expect(run("600 mi")[0]?.unit).toBe("mi");
});

test("the span addresses the raw input and text splices around it", () => {
  const rows = run("10 kg + 5 gr");
  // M2's angle kind brought `grad`, which ties `gram` exactly — same length
  // penalty (-2), both in band for a count of 5 — and takes the kind
  // tie-break, "angle" < "mass". Every row splices identically either way.
  expect(rows[0]?.span).toEqual({ start: 10, end: 12 });
  expect(rows[0]?.text).toBe("10 kg + 5 gradians");
  const grams = rows.find((r) => r.unit === "g");
  expect(grams?.span).toEqual({ start: 10, end: 12 });
  expect(grams?.text).toBe("10 kg + 5 grams");
});

test("returns an empty array rather than throwing", () => {
  expect(run("")).toEqual([]);
  expect(run("30")).toEqual([]);
  expect(run("10 kg + ")).toEqual([]);
  expect(run("10 zzz")).toEqual([]);
});

test("opts.kinds filters candidates by kind", () => {
  const rows = run("1 mi", { kinds: ["duration"] });
  expect(rows.every((r) => r.kind === "duration")).toBe(true);
  expect(rows.map((r) => r.unit)).toEqual(["min", "ms"]);
});

test("weight layers reorder the results", () => {
  const boosted = run("1 mi", undefined, [english.weights, { duration: 20 }]);
  expect(boosted[0]?.kind).toBe("duration");
});

test("a per-call weight layer applies", () => {
  // complete() does not read opts.weights itself. The engine composes layer 4
  // out of CompleteOptions.weights and hands it in through `layers`, exactly
  // as the evaluate path does; reading it here as well would double-count it.
  const boosted = run("1 mi", undefined, [
    english.weights,
    undefined,
    { "duration:min": 20 },
  ]);
  expect(boosted[0]?.unit).toBe("min");
});

test("limit defaults to 10 and is applied after ranking", () => {
  const all = run("m");
  expect(all.length).toBeLessThanOrEqual(10);
  const three = run("m", { limit: 3 });
  expect(three).toEqual(all.slice(0, 3));
});

test("results are deterministic across runs", () => {
  expect(JSON.stringify(run("1 mi"))).toBe(JSON.stringify(run("1 mi")));
});

test("matching is case-insensitive", () => {
  expect(run("30 HO")[0]?.unit).toBe("h");
  expect(run("30 Ho")[0]?.text).toBe("30 hours");
});

// ---------------------------------------------------------------------------
// The completer seam.
//
// Probed rather than driven from @smartput/geo, which is the kind that needed
// the seam: core cannot depend on a package that depends on core, and a test
// that reached for the real gazetteer would also be asserting six thousand
// rows of data every time it asserted a scoring rule. Same shape engine.test.ts
// builds its literal-matcher probes in.
// ---------------------------------------------------------------------------

/**
 * A vocabulary the global alias index must never hold: several names per unit,
 * names short enough to collide with somebody's symbol, and a ranking of its
 * own that core has no information to re-derive.
 */
const GAZETTEER: KindCompletion[] = [
  { text: "Kyiv", alias: "kyiv", unit: "ua", weight: 2 },
  { text: "Kyoto", alias: "kyoto", unit: "jp", weight: 1.5 },
  { text: "Kingston", alias: "kingston", unit: "jm", weight: 1 },
  {
    text: "Springfield, IL",
    alias: "springfield",
    unit: "us",
    key: "4250542",
    weight: 1,
  },
  {
    text: "Springfield, MA",
    alias: "springfield",
    unit: "us",
    key: "4951788",
    weight: 0.5,
  },
];

let seen: CompleteCtx[] = [];

const gazetteer: Completer = (ctx) => {
  seen.push(ctx);
  return GAZETTEER.filter((row) => row.alias.startsWith(ctx.fragment));
};

/** Opaque, with registered aliases of its own, exactly as `place` is. */
const places = (completions: Completer) =>
  defineKind({
    id: "place",
    value: { mode: "opaque", units: ["ua", "jp", "jm", "us"] },
    completions,
    format: (v) => v.unit,
  });

/**
 * The words for the fixture kinds, which no longer live on the kinds. Keyed by
 * kind id so `probeRun` can install exactly the ones the caller registered —
 * a vocabulary for a kind that is not registered is a wiring error.
 */
const FIXTURE_WORDS: Readonly<Record<string, Vocabulary>> = {
  place: defineVocabulary({
    locale: "en",
    kind: "place",
    units: {
      ua: { aliases: ["ukraine"] },
      jp: { aliases: ["japan"] },
      jm: { aliases: ["jamaica"] },
      us: { aliases: ["usa"] },
    },
  }),
  banded: defineVocabulary({
    locale: "en",
    kind: "banded",
    units: { b: { aliases: ["bandit"] } },
  }),
};

const probeRun = (
  kinds: Kind[],
  input: string,
  opts?: Parameters<typeof complete>[0]["opts"],
  layers: (Weights | undefined)[] = [english.weights],
) => {
  const extra = kinds
    .map((k) => FIXTURE_WORDS[k.id])
    .filter((v): v is Vocabulary => v !== undefined);
  const locale =
    extra.length === 0 ? en : composeLocale(english, [...BUILTIN_EN, ...extra]);
  return complete({
    registry: buildRegistry([...BUILTIN_KINDS, ...kinds], [locale]),
    locale,
    layers,
    input,
    ...(opts ? { opts } : {}),
  });
};

const gaz = (input: string, opts?: Parameters<typeof complete>[0]["opts"]) =>
  probeRun([places(gazetteer)], input, opts);

/**
 * Every ratio row "10 k" returns, in order. Pinned as a literal rather than
 * compared against a second run, because the point is that the ratio path did
 * not move — and a self-comparison would hold just as well if both sides broke
 * together.
 *
 * It was nine rows and fit inside the default limit, so one constant served
 * both tests below. datarate, power, energy and tempo brought five more `k`
 * units, and the unlimited list now overflows that limit — so the list stays
 * one literal and the default-limit run is asserted against its head. Splitting
 * it into two hand-written literals would let the two drift, which is the
 * comparison the second test exists to make.
 */
const TEN_K = [
  "temperature:k",
  "datasize:kb",
  "energy:kj",
  "length:km",
  "mass:kg",
  "power:kw",
  "speed:knot",
  "area:km2",
  "datasize:kib",
  "energy:kwh",
  "speed:kph",
  "datarate:kbps",
  "energy:kcal",
  "tempdelta:k",
];

/** How many rows `complete` returns when the caller asks for no limit. */
const DEFAULT_LIMIT = 10;

test("the ratio path is exactly what it was", () => {
  expect(run("10 k").map((r) => `${r.kind}:${r.unit}`)).toEqual(
    TEN_K.slice(0, DEFAULT_LIMIT),
  );
});

test("registering a completer does not disturb the ratio rows", () => {
  const rows = gaz("10 k", { limit: 50 });
  expect(
    rows.filter((r) => r.kind !== "place").map((r) => `${r.kind}:${r.unit}`),
  ).toEqual(TEN_K);
});

test("an opaque kind completes through its completer", () => {
  const [top] = gaz("kyi");
  expect(top?.kind).toBe("place");
  expect(top?.unit).toBe("ua");
  expect(top?.alias).toBe("kyiv");
  expect(top?.text).toBe("Kyiv");
});

// The other half of ruling R8, and the reason the alias-index filter stayed:
// "ukraine" is a registered alias of this same opaque kind, and completing it
// would splice "<count> ukraine" — which is what a time zone is not.
test("an opaque kind's registered aliases still do not complete", () => {
  expect(gaz("ukrai")).toEqual([]);
  expect(gaz("30 ukrai")).toEqual([]);
});

test("a completer's text replaces the fragment inside the whole input", () => {
  const [top] = gaz("10 km + kyi");
  expect(top?.span).toEqual({ start: 8, end: 11 });
  expect(top?.text).toBe("10 km + Kyiv");
});

// The rule `key` exists for. Both Springfields are in the US, so a map keyed on
// the unit would offer one of them and silently drop the other.
test("rows sharing a unit survive on distinct keys", () => {
  const rows = gaz("springfield");
  expect(rows.map((r) => r.text)).toEqual(["Springfield, IL", "Springfield, MA"]);
});

test("rows sharing a key collapse to the best-scoring one", () => {
  const twice: Completer = () => [
    { text: "quiet", alias: "quixote", unit: "ua", weight: 1 },
    { text: "loud", alias: "quixote", unit: "ua", weight: 9 },
  ];
  const rows = probeRun([places(twice)], "quix");
  expect(rows.map((r) => r.text)).toEqual(["loud"]);
});

test("a row's weight is summed in like a weight layer", () => {
  // prior 0 and no selector matches, so the whole score is the row's own weight
  // plus the three characters of "kyiv" still untyped.
  expect(gaz("k").find((r) => r.unit === "ua")?.score).toBe(2 - 3);
  expect(gaz("kyi")[0]?.score).toBe(2 - 1);
});

test("weight layers reach completer rows through the same selectors", () => {
  const boosted = probeRun([places(gazetteer)], "k", undefined, [
    english.weights,
    { "place:ua": 5 },
  ]);
  expect(boosted.find((r) => r.unit === "ua")?.score).toBe(2 - 3 + 5);
});

/**
 * `scaleFit` reads a `typical` band off a ratio unit — the magnitude people
 * type that unit in — and a completer row is not a magnitude of anything, so it
 * must not collect the bonus even when its kind is a ratio kind that declares
 * one. Both rows below are the same unit under the same alias, separated only
 * by `key`, so the gap between their scores is the bonus and nothing else.
 */
test("scaleFit is not applied to a completer row", () => {
  const banded = defineKind({
    id: "banded",
    value: { mode: "ratio", canonical: "b", units: { b: 1 } },
    typical: { b: [1, 100] },
    completions: () => [{ text: "bandit", alias: "bandit", unit: "b", key: "own" }],
  });

  const rows = probeRun([banded], "5 band").filter((r) => r.kind === "banded");
  expect(rows).toHaveLength(2);
  expect((rows[0]?.score ?? 0) - (rows[1]?.score ?? 0)).toBe(SCALE_BONUS);
});

/**
 * `prefixQuality` counts the characters of the alias the user has not typed
 * yet, which is as true of "kyiv" under "kyi" as of "kilometre" under "kilom".
 * It is withheld only where that count is undefined — see the next test.
 */
test("prefixQuality applies when the alias extends the fragment", () => {
  const rows = gaz("k", { limit: 50 });
  const byUnit = new Map(rows.map((r) => [r.unit, r.score]));
  // Same shape of answer, ranked by how much is left to type: kyiv 2-3,
  // kyoto 1.5-4, kingston 1-7.
  expect(byUnit.get("ua")).toBe(-1);
  expect(byUnit.get("jp")).toBe(-2.5);
  expect(byUnit.get("jm")).toBe(-6);
});

test("prefixQuality is withheld from an alias the fragment does not prefix", () => {
  // A completer may match by fold, transliteration or second name. "kv" is
  // shorter than the fragment, so the subtraction would pay it +1 for being a
  // worse match than an alias that starts with what was typed.
  const abbreviated: Completer = () => [
    { text: "Kyiv", alias: "kv", unit: "ua", weight: 2 },
  ];
  expect(probeRun([places(abbreviated)], "kyi")[0]?.score).toBe(2);
});

test("the completer sees the folded fragment, the locale and the count", () => {
  seen = [];
  gaz("10 KYI");
  expect(seen).toHaveLength(1);
  expect(seen[0]?.locale).toBe("en");
  expect(seen[0]?.fragment).toBe("kyi");
  expect(seen[0]?.count?.toString()).toBe("10");
});

test("the count is absent when nothing precedes the fragment", () => {
  seen = [];
  gaz("kyi");
  expect(seen[0]?.count).toBeUndefined();
});

// One ctx object goes to every completer in turn, which no other context in
// core does — `EvalCtx` is rebuilt per Value. Unfrozen, a kind that wrote to it
// would be silently rewriting the question the next kind is asked, and the two
// kinds need never have heard of each other.
test("the ctx is frozen, so one kind cannot rewrite the next kind's question", () => {
  const vandal: Completer = (ctx) => {
    (ctx as { fragment: string }).fragment = "zzz";
    return [];
  };
  expect(() => probeRun([places(vandal)], "kyi")).toThrow(TypeError);
});

test("a row naming an unregistered unit is dropped", () => {
  const wrong: Completer = () => [
    { text: "Nowhere", alias: "nowhere", unit: "zz", weight: 99 },
  ];
  expect(probeRun([places(wrong)], "nowh")).toEqual([]);
});

test("opts.kinds filters completer rows and skips the completer", () => {
  seen = [];
  expect(gaz("kyi", { kinds: ["duration"] })).toEqual([]);
  expect(seen).toEqual([]);
  expect(gaz("kyi", { kinds: ["place"] }).map((r) => r.unit)).toEqual(["ua"]);
});

test("limit applies to the merged list, not to each source", () => {
  const all = gaz("k", { limit: 50 });
  expect(all.length).toBeGreaterThan(10);
  expect(gaz("k")).toEqual(all.slice(0, 10));
});

test("completer rows are deterministic across runs", () => {
  expect(JSON.stringify(gaz("k"))).toBe(JSON.stringify(gaz("k")));
});

// Nothing to complete is decided before any completer runs, so a kind is never
// asked what an empty fragment could become.
test("no fragment means no completer call", () => {
  seen = [];
  expect(gaz("10 ")).toEqual([]);
  expect(seen).toEqual([]);
});

// ---- reaching back over the words in front of the fragment ----

/** Claims a two-word name the way geo's trie does. */
const twoWord: Completer = (ctx) => {
  const whole = ctx.input.slice(0, ctx.span.end).toLowerCase();
  if (!"san francisco".startsWith(whole)) return [];
  return [
    {
      text: "San Francisco",
      alias: "san francisco",
      unit: "us",
      key: "5391959",
      start: 0,
    },
  ];
};

test("a completer sees the whole input and where the fragment sits in it", () => {
  seen = [];
  gaz("san fran");
  const ctx = seen[0] as CompleteCtx;
  // The fragment is one word and the name is two. With only the fragment to go
  // on, a completer can answer about "fran" and nothing else — which is how
  // "san fran" came back as "san France".
  expect(ctx.fragment).toBe("fran");
  expect(ctx.input).toBe("san fran");
  expect(ctx.input.slice(ctx.span.start, ctx.span.end)).toBe("fran");
});

test("a row may replace the words in front of the fragment", () => {
  const rows = probeRun([places(twoWord)], "san fran");
  expect(rows.map((r) => r.text)).toEqual(["San Francisco"]);
  // The span widens with the text, so a caller splicing by span and a caller
  // taking `text` wholesale agree about what was replaced.
  expect(rows[0]?.span).toEqual({ start: 0, end: 8 });
});

test("a start outside the input is dropped rather than spliced", () => {
  const bad =
    (start: number): Completer =>
    () => [{ text: "Nowhere", alias: "nowhere", unit: "us", key: "x", start }];
  // Past the fragment's start: would duplicate the text it meant to replace.
  expect(probeRun([places(bad(6))], "san fran")).toEqual([]);
  // Negative, and fractional: neither names a position in a string.
  expect(probeRun([places(bad(-1))], "san fran")).toEqual([]);
  expect(probeRun([places(bad(1.5))], "san fran")).toEqual([]);
  // The fragment's own start is the boundary and is legal — it is the default.
  expect(probeRun([places(bad(4))], "san fran").map((r) => r.text)).toEqual([
    "san Nowhere",
  ]);
});

// ---------------------------------------------------------------------------
// Completing through a typo.
// ---------------------------------------------------------------------------

test("a fragment nothing prefixes is completed through its nearest alias", () => {
  const [top] = run("1 klogram");
  expect(top?.text).toBe("1 kilogram");
  expect(top?.kind).toBe("mass");
  expect(top?.unit).toBe("kg");
  // The span still addresses the fragment the user typed, not the word offered.
  expect(top?.span).toEqual({ start: 2, end: 9 });
});

test("a corrected offer scores below the prefix it would have been", () => {
  const corrected = run("1 klogram")[0];
  const prefix = run("1 kilogr").find((r) => r.unit === "kg");
  expect(corrected?.text).toBe("1 kilogram");
  // Two characters of "kilogram" still to type, and 1 kg is inside mass's band.
  expect(prefix?.score).toBe(-2 * LENGTH_PENALTY + SCALE_BONUS);
  expect(corrected?.score).toBeLessThan(prefix?.score as number);
});

test("the correction is one term of the ordinary sum", () => {
  // Everything the exact offer earns except `prefixQuality`, which counts
  // characters still untyped and has nothing to count here, less one edit.
  const exact = run("1 kilogram").find((r) => r.unit === "kg")?.score ?? 0;
  expect(run("1 klogram")[0]?.score).toBe(exact - EXACT_BONUS - TYPO_PENALTY);
});

test("a well-spelled fragment is untouched by the correction", () => {
  expect(run("1 kilogram")[0]?.text).toBe("1 kilogram");
  expect(run("1 kilogram")[0]?.score).toBe(EXACT_BONUS + SCALE_BONUS);
  expect(JSON.stringify(run("1 mi"))).toBe(JSON.stringify(run("1 mi")));
});

/**
 * The perf gate, asserted rather than commented. `nearestWord` walks its whole
 * vocabulary, which is affordable once over the 214 aliases in the global index
 * and not affordable over the 6,247 names @smartput/city hangs off one kind —
 * on every keystroke, for a fragment that by definition matched nothing. So the
 * correction is offered the alias index and nothing else, and a completer is
 * asked about the fragment the user typed exactly once, however that fragment
 * is later read.
 */
test("the fuzzy pass never reaches a kind's own completions", () => {
  seen = [];
  const rows = gaz("1 klogram");
  expect(rows[0]?.text).toBe("1 kilogram");
  expect(seen).toHaveLength(1);
  expect(seen[0]?.fragment).toBe("klogram");
});
