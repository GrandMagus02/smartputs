import { expect, test } from "bun:test";
import { duration as durationKind, number as numberKind } from "@smartput/kinds";
import { english as enLocale } from "@smartput/locale-en";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import type { LiteralMatcher } from "../types";
import { solve } from "./solver";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60, h: 3600 } },
});

// `m` names both length's metre and duration's minute. That collision is the
// subject of most of this file, so it is declared rather than left to R2's
// unit-key floor, which would only ever spell `min`.
const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in"] },
    selectForm: () => "other",
  }),
  [
    defineVocabulary({
      locale: "en",
      kind: "length",
      units: { m: { aliases: ["m"] }, km: { aliases: ["km"] } },
    }),
    defineVocabulary({
      locale: "en",
      kind: "duration",
      units: { min: { aliases: ["min", "m"] }, h: { aliases: ["h"] } },
    }),
  ],
);
const registry = buildRegistry([number, length, duration], [en]);

function run(input: string, layers: Parameters<typeof createResolver>[0]["layers"] = []) {
  const resolver = createResolver({ registry, locale: en, layers });
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  return {
    node,
    assignments: solve(program, registry, { maxCandidates: 10_000, input }),
  };
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
  const reg = buildRegistry([number, length, duration, paces], [en]);
  const resolver = createResolver({ registry: reg, locale: en, layers: [] });
  const input = "10 km in h";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const assignments = solve(program, reg, { maxCandidates: 10_000, input });
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
  const bridged = buildRegistry([number, length, duration, bridge], [en]);
  const resolver = createResolver({
    registry: bridged,
    locale: en,

    layers: [{ "length:m": 10 }],
  });
  const input = "10 m + 5 h";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const assignments = solve(program, bridged, { maxCandidates: 10_000, input });

  expect(assignments).toHaveLength(2);
  // duration: 0 weight + 30 context bonus. length: 10 weight, no bonus.
  expect(assignments[0]?.kind).toBe("duration");
  expect(assignments[1]?.kind).toBe("length");
});

test("exceeding maxCandidates throws TooAmbiguousError", () => {
  const resolver = createResolver({ registry, locale: en, layers: [] });
  const input = "1 m + 1 m + 1 m + 1 m";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  expect(() => solve(program, registry, { maxCandidates: 4, input })).toThrow(
    TooAmbiguousError,
  );
});

test("the kinds filter drops candidates outside the allowed set", () => {
  const resolver = createResolver({ registry, locale: en, layers: [] });
  const input = "10 m";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const assignments = solve(program, registry, {
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
  value: { mode: "opaque", units: ["UTC"] },
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
  locales: [composeLocale(enLocale)],
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
    locales: [composeLocale(enLocale)],
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

/**
 * A patch that replaces the `-|length|length` signature `generateRatioOps`
 * already made for `length` with an identical one carrying a weight. Pass 4 of
 * the registry puts generated ops first and `kind.ops` second, so a kind may
 * overwrite what it generated — which is the only way to attach a weight to a
 * signature nobody wrote by hand.
 */
const weightedMinus = defineKind({
  id: "length-weighted-minus",
  extendsKind: "length",
  value: { mode: "ratio", canonical: "m", units: {} },
  ops: [
    {
      op: "-",
      left: "length",
      right: "length",
      result: "length",
      weight: 20,
      apply: (l, r) => ({
        kind: "length",
        canonical: l.canonical.minus(r.canonical),
        unit: l.unit,
      }),
    },
  ],
});

test("a signature weight lifts its candidate above an equal-scoring rival", () => {
  // "10 m - 5 m" reads two ways, because "m" is both metre and minute: both
  // slots length, or both duration. The readings weigh the same and
  // contextBonus lands on both — each pair agrees with itself — so the contest
  // is an exact tie that falls through to the alphabetical tie-break, and
  // `duration` wins for no reason anyone typed. This is the shape §4.1 of the
  // ranges design describes for `10:00 - 20:00`, reproduced in core's own
  // fixtures: no reading weight can decide it without also deciding the bare
  // "10 m" next door.
  const plain = run("10 m - 5 m").assignments;
  expect(plain.map((a) => a.kind)).toEqual(["duration", "length"]);
  expect(plain[0]?.score).toBe(plain[1]?.score);

  const weighted = buildRegistry([number, length, duration, weightedMinus], [en]);
  const resolver = createResolver({
    registry: weighted,
    locale: en,

    layers: [],
  });
  const input = "10 m - 5 m";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const assignments = solve(program, weighted, { maxCandidates: 10_000, input });

  expect(assignments[0]?.kind).toBe("length");
  expect(assignments[0]?.signatureWeight).toBe(20);
  // 30 context bonus + 20 signature, against the duration path's bare 30.
  expect(assignments[0]?.score).toBe(50);
  expect(assignments[1]?.kind).toBe("duration");
  expect(assignments[1]?.signatureWeight).toBe(0);
});

test("signatureWeight defaults to zero and moves no existing score", () => {
  // Every signature in the fixtures above is unweighted, so the field is 0 and
  // `score` is what it was before the term existed.
  expect(run("10 km").assignments[0]?.signatureWeight).toBe(0);
  const contextual = run("10 m + 5 h").assignments[0];
  expect(contextual?.signatureWeight).toBe(0);
  expect(contextual?.score).toBe(30);
});

test("explain lists a non-zero signature weight as its own row", () => {
  const weightedEngine = createEngine({
    locales: [composeLocale(enLocale)],
    kinds: [number, length, duration, weightedMinus],
  });
  const assignment = weightedEngine.explain("10 m - 5 m").assignments[0];
  expect(assignment?.contributions).toContainEqual({
    selector: "signature",
    value: 20,
    layer: 0,
  });
  // The invariant engine.test.ts checks globally, asserted here where the only
  // weighted signature in the repo lives: every summand of score has a row.
  const sum = assignment?.contributions.reduce((s, c) => s + c.value, 0);
  expect(sum).toBe(assignment?.score);
});
