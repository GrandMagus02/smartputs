import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import type { Weights } from "../types";
import { complete } from "./complete";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const run = (
  input: string,
  opts?: Parameters<typeof complete>[0]["opts"],
  layers: (Weights | undefined)[] = [en.weights],
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
  const boosted = run("1 mi", undefined, [en.weights, { duration: 20 }]);
  expect(boosted[0]?.kind).toBe("duration");
});

test("a per-call weight layer applies", () => {
  // complete() does not read opts.weights itself. The engine composes layer 4
  // out of CompleteOptions.weights and hands it in through `layers`, exactly
  // as the evaluate path does; reading it here as well would double-count it.
  const boosted = run("1 mi", undefined, [en.weights, undefined, { "duration:min": 20 }]);
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
