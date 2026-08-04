import { expect, test } from "bun:test";
import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { parse } from "../parse/pratt";
import { solve } from "./solver";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m"], km: ["km"] },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60, h: 3600 } },
  lexicon: { min: ["min", "m"], h: ["h"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: { in: ["in"] } });
const registry = buildRegistry([number, length, duration]);

function run(input: string, layers: Parameters<typeof createResolver>[0]["layers"] = []) {
  const resolver = createResolver({ registry, locale: en, packs: [], layers });
  const node = parse(lex(input, en), resolver, input);
  return { node, assignments: solve(node, registry, { maxCandidates: 10_000, input }) };
}

test("an unambiguous input yields one assignment at confidence 1", () => {
  const { assignments } = run("10 km");
  expect(assignments).toHaveLength(1);
  expect(assignments[0]?.kind).toBe("length");
  expect(assignments[0]?.confidence).toBeCloseTo(1, 10);
});

test("an ambiguous token yields both assignments", () => {
  const { assignments } = run("10 m");
  expect(assignments.map((a) => a.kind).sort()).toEqual(["duration", "length"]);
});

test("context resolves ambiguity: 10 m + 5 h is a duration", () => {
  const { assignments } = run("10 m + 5 h");
  expect(assignments[0]?.kind).toBe("duration");
});

test("context resolves ambiguity the other way: 10 m + 5 km is a length", () => {
  const { assignments } = run("10 m + 5 km");
  expect(assignments[0]?.kind).toBe("length");
});

test("a cross-kind expression with no signature throws", () => {
  expect(() => run("10 km + 5 h")).toThrow(DimensionMismatchError);
});

test("weights flip an ambiguous result", () => {
  const { assignments } = run("10 m", [{ "duration:min": 999 }]);
  expect(assignments[0]?.kind).toBe("duration");
  const flipped = run("10 m", [{ "length:m": 999 }]).assignments;
  expect(flipped[0]?.kind).toBe("length");
});

test("confidences form a softmax and sum to 1", () => {
  const { assignments } = run("10 m");
  const total = assignments.reduce((s, a) => s + a.confidence, 0);
  expect(total).toBeCloseTo(1, 10);
});

test("scaling by a number type-checks", () => {
  const { assignments } = run("10 km * 3");
  expect(assignments[0]?.kind).toBe("length");
});

test("conversion type-checks and takes the target unit's kind", () => {
  const { assignments } = run("10 km in m");
  expect(assignments[0]?.kind).toBe("length");
});

test("exceeding maxCandidates throws TooAmbiguousError", () => {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const input = "1 m + 1 m + 1 m + 1 m";
  const node = parse(lex(input, en), resolver, input);
  expect(() => solve(node, registry, { maxCandidates: 4, input })).toThrow(
    TooAmbiguousError,
  );
});

test("the kinds filter drops candidates outside the allowed set", () => {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const input = "10 m";
  const node = parse(lex(input, en), resolver, input);
  const assignments = solve(node, registry, {
    maxCandidates: 10_000,
    kinds: ["length"],
    input,
  });
  expect(assignments).toHaveLength(1);
  expect(assignments[0]?.kind).toBe("length");
});

test("ranking is stable across repeated runs", () => {
  const first = run("10 m").assignments.map((a) => `${a.kind}`);
  const second = run("10 m").assignments.map((a) => `${a.kind}`);
  expect(first).toEqual(second);
});
