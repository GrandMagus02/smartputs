import { expect, test } from "bun:test";
import { duration as durationKind, number as numberKind } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import enLocale from "../locale/en";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { parse } from "../parse/pratt";
import type { LiteralMatcher } from "../types";
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

test("a dimension mismatch names the operands in source order", () => {
  try {
    run("10 km + 5 h");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err.left).toBe("length");
    expect(err.right).toBe("duration");
  }
});

test("a dimension mismatch on a convert names the operand before the target", () => {
  // Unlike the binary case above, walk() visits the convert node (whose
  // reported candidates are the *target* unit's) before it visits the
  // operand — so this exercises the case the naive span.start sort does not
  // fix (the convert node's own span starts at its operand's span, tying
  // them), and only the targetSpan-aware sort gets right.
  try {
    run("5 h in km");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err.left).toBe("duration");
    expect(err.right).toBe("length");
  }
});

test("a bare numeric literal operand is reported as number, not unknown", () => {
  // `2 / 10 km` has no signature (`/|number|length` is never generated) and
  // no slot for the literal, so the report used to name the one operand it
  // could see and invent the other: "length and unknown" — the wrong kind for
  // the left operand and the wrong order too.
  try {
    run("2 / 10 km");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err.left).toBe("number");
    expect(err.right).toBe("length");
    expect(err.message).not.toContain("unknown");
  }
});

test("a literal on the right is reported in source order too", () => {
  // `+|length|number` is never generated either, so this is the mirror case.
  try {
    run("10 km + 2");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err.left).toBe("length");
    expect(err.right).toBe("number");
  }
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

test("a convert takes its result kind from the signature, not from the target", () => {
  // Generated `in` is always same-kind, so target.kind and signature.result
  // coincide for every built-in. A declared cross-kind `in` separates them,
  // and the solver must believe the signature.
  const paces = defineKind({
    id: "pace",
    value: { mode: "ratio", canonical: "spm", units: { spm: 1 } },
    lexicon: { spm: ["spm"] },
    ops: [
      {
        op: "in",
        left: "length",
        right: "duration",
        result: "pace",
        apply: (l) => ({ kind: "pace", canonical: l.canonical, unit: "spm" }),
      },
    ],
  });
  const reg = buildRegistry([number, length, duration, paces]);
  const resolver = createResolver({ registry: reg, locale: en, packs: [], layers: [] });
  const input = "10 km in h";
  const node = parse(lex(input, en), resolver, input);
  const assignments = solve(node, reg, { maxCandidates: 10_000, input });
  expect(assignments[0]?.kind).toBe("pace");
});

test("assignments report the context bonus that went into their score", () => {
  const plain = run("10 km").assignments[0];
  expect(plain?.contextBonus).toBe(0);

  const contextual = run("10 m + 5 h").assignments[0];
  expect(contextual?.contextBonus).toBe(30);
  expect(contextual?.score).toBe(30);
});

test("the context bonus decides when both assignments type-check", () => {
  // With only same-kind ops, typeOf prunes the mixed assignment outright, so
  // the bonus is never compared against anything — every other test here
  // passes for that stronger reason and would still pass with CONTEXT_BONUS
  // set to 0. A cross-kind signature keeps both assignments viable, and the
  // length weight is set high enough that removing the bonus flips the result.
  const bridge = defineKind({
    id: "length-bridge",
    extendsKind: "length",
    value: { mode: "ratio", canonical: "m", units: {} },
    ops: [
      { op: "+", left: "length", right: "duration", result: "length", apply: (l) => l },
    ],
  });
  const bridged = buildRegistry([number, length, duration, bridge]);
  const resolver = createResolver({
    registry: bridged,
    locale: en,
    packs: [],
    layers: [{ "length:m": 10 }],
  });
  const input = "10 m + 5 h";
  const node = parse(lex(input, en), resolver, input);
  const assignments = solve(node, bridged, { maxCandidates: 10_000, input });

  expect(assignments).toHaveLength(2);
  // duration: 0 weight + 30 context bonus. length: 10 weight, no bonus.
  expect(assignments[0]?.kind).toBe("duration");
  expect(assignments[1]?.kind).toBe("length");
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

/**
 * A stand-in for M4's chrono bridge: "day7" is a point in time whose canonical
 * value is a second count, so core can be tested against an opaque kind without
 * depending on the datetime package.
 */
const day7: LiteralMatcher = (input, offset) =>
  input.startsWith("day7", offset)
    ? {
        kind: "day",
        unit: "UTC",
        canonical: new Decimal(604_800),
        meta: { iso: "day7" },
        length: 4,
      }
    : null;

const day = defineKind({
  id: "day",
  value: { mode: "opaque", units: { UTC: ["utc"] } },
  literals: [day7],
  ops: [
    {
      op: "+",
      left: "day",
      right: "duration",
      result: "day",
      apply: (l, r) =>
        Object.freeze({
          kind: "day",
          canonical: l.canonical.plus(r.canonical),
          unit: l.unit,
        }),
    },
    {
      op: "-",
      left: "day",
      right: "day",
      result: "duration",
      apply: (l, r) =>
        Object.freeze({
          kind: "duration",
          canonical: l.canonical.minus(r.canonical),
          unit: "s",
        }),
    },
  ],
  format: (v) => `day+${v.canonical.toFixed()}`,
});

const engine = createEngine({
  locales: [enLocale],
  kinds: [numberKind, durationKind, day],
});

test("a literal evaluates to the value its matcher built", () => {
  const r = engine.evaluate("day7");
  expect(r.kind).toBe("day");
  expect(r.value.canonical.toString()).toBe("604800");
  expect(r.value.unit).toBe("UTC");
  expect(r.value.meta).toEqual({ iso: "day7" });
  expect(r.formatted).toBe("day+604800");
});

test("a cross-kind op signature joins a literal to a quantity", () => {
  const r = engine.evaluate("day7 + 2 h");
  expect(r.kind).toBe("day");
  expect(r.value.canonical.toString()).toBe("612000");
});

test("a literal minus a literal takes the declared result kind", () => {
  const r = engine.evaluate("day7 - day7");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("0");
});

test("a literal without a matching signature raises DimensionMismatchError", () => {
  expect(() => engine.evaluate("day7 * 2")).toThrow(/day/);
});

test("the kinds filter drops a literal candidate", () => {
  expect(() => engine.evaluate("day7", { kinds: ["duration"] })).toThrow();
});

test("a literal's weight goes through the weight layers", () => {
  const boosted = createEngine({
    locales: [enLocale],
    kinds: [numberKind, durationKind, day],
    weights: { day: 11 },
  });
  const contributions = boosted.explain("day7").assignments[0]?.contributions ?? [];
  expect(contributions).toContainEqual({ selector: "day", value: 11, layer: 2 });
});

test("explain lists the literal as a candidate", () => {
  expect(engine.explain("day7").candidates[0]).toMatchObject({
    kind: "day",
    unit: "UTC",
    surface: "day7",
  });
});
