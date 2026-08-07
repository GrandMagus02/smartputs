import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { NoCandidateError, UnitParseError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { defineVocabulary } from "../locale/vocabulary";
import type { Candidate } from "../types";
import { createResolver } from "./candidates";
import { lex } from "./lex";
import { foldLiterals } from "./literals";
import { NUMBER_FALLBACK_WEIGHT, parse } from "./pratt";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in", "to", "as"], of: ["of"], off: ["off"] },
    selectForm: () => "other",
  }),
);
const registry = buildRegistry([number, length]);
const resolver = createResolver({ registry, locale: en, layers: [] });

const ast = (input: string) => parse(lex(input, en), resolver, input);

test("a bare number parses to a number node", () => {
  expect(ast("42")).toMatchObject({ type: "number" });
});

test("a number followed by a unit parses to a quantity node", () => {
  const node = ast("10 km");
  expect(node).toMatchObject({ type: "quantity" });
  if (node.type !== "quantity") throw new Error("unreachable");
  expect(node.candidates.map((c) => c.unit)).toEqual(["km"]);
});

test("a bare unit word is a quantity of one", () => {
  const node = ast("km");
  expect(node).toMatchObject({ type: "quantity" });
  if (node.type !== "quantity") throw new Error("unreachable");
  expect(node.value.toString()).toBe("1");
  expect(node.candidates.map((c) => c.unit)).toEqual(["km"]);
});

test("an implied one is an operand like any other", () => {
  const node = ast("km + 3 km");
  expect(node).toMatchObject({ type: "binary", op: "+" });
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.left).toMatchObject({ type: "quantity" });
  expect(node.right).toMatchObject({ type: "quantity" });
});

test("a word that names no unit is still not an atom", () => {
  expect(() => ast("furlong")).toThrow(UnitParseError);
});

test("addition is left-associative", () => {
  const node = ast("1 + 2 + 3");
  expect(node).toMatchObject({ type: "binary", op: "+" });
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.left).toMatchObject({ type: "binary", op: "+" });
});

test("multiplication binds tighter than addition", () => {
  const node = ast("1 + 2 * 3");
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.op).toBe("+");
  expect(node.right).toMatchObject({ type: "binary", op: "*" });
});

test("parens override precedence", () => {
  const node = ast("(1 + 2) * 3");
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.op).toBe("*");
  expect(node.left).toMatchObject({ type: "binary", op: "+" });
});

test("unary minus parses", () => {
  expect(ast("-5")).toMatchObject({ type: "unary", op: "-" });
});

test("the in keyword produces a convert node", () => {
  const node = ast("10 km in m");
  expect(node).toMatchObject({ type: "convert" });
  if (node.type !== "convert") throw new Error("unreachable");
  expect(node.target.map((c) => c.unit)).toEqual(["m"]);
});

test("convert binds loosest, so arithmetic on the left is grouped first", () => {
  const node = ast("1 km + 500 m in m");
  if (node.type !== "convert") throw new Error("unreachable");
  expect(node.operand).toMatchObject({ type: "binary", op: "+" });
});

test("an unknown unit word throws NoCandidateError", () => {
  expect(() => ast("10 zork")).toThrow(NoCandidateError);
});

test("an empty input throws UnitParseError", () => {
  expect(() => ast("")).toThrow(UnitParseError);
});

test("a trailing operator throws UnitParseError", () => {
  expect(() => ast("10 km +")).toThrow(UnitParseError);
});

test("an unclosed paren throws UnitParseError", () => {
  expect(() => ast("(1 + 2")).toThrow(UnitParseError);
});

test("leftover tokens after a complete parse throw UnitParseError", () => {
  // parseExpr returns after "1"; the second number is neither op nor keyword,
  // so the loop breaks and the top-level pos check must reject it.
  expect(() => ast("1 2")).toThrow(UnitParseError);
});

test("a quantity node preserves every candidate for an ambiguous unit", () => {
  // Its own registry: adding an "m"-colliding kind to the shared one would
  // change the single-candidate expectations in the other tests.
  const duration = defineKind({
    id: "duration",
    value: { mode: "ratio", canonical: "s", units: { min: 60 } },
  });
  const ambiguous = buildRegistry(
    [number, length, duration],
    [
      composeLocale(en.language, [
        defineVocabulary({
          locale: "en",
          kind: "duration",
          units: { min: { aliases: ["min", "m"] } },
        }),
      ]),
    ],
  );
  const r = createResolver({ registry: ambiguous, locale: en, layers: [] });

  const node = parse(lex("10 m", en), r, "10 m");
  if (node.type !== "quantity") throw new Error("unreachable");
  // The parser must never narrow — Task 10's solver needs the whole set.
  expect(node.candidates.map((c) => `${c.kind}:${c.unit}`)).toEqual([
    "duration:min",
    "length:m",
  ]);
});

test("nodes carry spans back to the source", () => {
  const node = ast("10 km");
  expect(node.span).toEqual({ start: 0, end: 5 });
});

test("the of keyword produces a binary node", () => {
  const node = ast("2 of 3");
  expect(node).toMatchObject({ type: "binary", op: "of" });
});

test("the off keyword produces a binary node", () => {
  const node = ast("2 off 3");
  expect(node).toMatchObject({ type: "binary", op: "off" });
});

// `off` shares `of`'s binding, so "10 + 2 off 3" is 10 + (2 off 3). The
// grouping is the whole reason it needs a binding rather than being folded
// into an existing operator.
test("off binds tighter than addition", () => {
  const node = ast("10 + 2 off 3");
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.op).toBe("+");
  expect(node.right).toMatchObject({ type: "binary", op: "off" });
});

test("a trailing off is left unconsumed and fails", () => {
  expect(() => ast("2 off")).toThrow(UnitParseError);
});

test("an off with nothing on its left is not an atom", () => {
  expect(() => ast("off 50")).toThrow(UnitParseError);
});

// ---------------------------------------------------------------------------
// M6.3 — a literal token carries readings, and the parser narrows none of them
// ---------------------------------------------------------------------------

/**
 * A kind whose matcher claims "mark" three ways and "77" once, so the parser can
 * be driven with the exact token shapes the fold now produces. Two of the three
 * readings share a unit, which is the case a kind/unit-keyed lookup would lose:
 * three Springfields are all `place:us`.
 */
const marks = defineKind({
  id: "mark",
  value: { mode: "opaque", units: ["a", "b"] },
  literals: [
    (input, offset) => {
      if (input.startsWith("mark", offset)) {
        return [
          { kind: "mark", unit: "a", canonical: new Decimal(1), length: 4, weight: 2 },
          { kind: "mark", unit: "a", canonical: new Decimal(2), length: 4, weight: 1 },
          {
            kind: "mark",
            unit: "b",
            canonical: new Decimal(3),
            length: 4,
            targetable: true,
          },
        ];
      }
      if (input.startsWith("77", offset))
        return { kind: "mark", unit: "a", canonical: new Decimal(9), length: 2 };
      return null;
    },
  ],
});

const marksEn = composeLocale(en.language, [
  defineVocabulary({
    locale: "en",
    kind: "mark",
    units: { a: { aliases: ["mark"] }, b: { aliases: ["bee"] } },
  }),
]);
const claimed = buildRegistry([number, length, marks], [marksEn]);
const claimedResolver = createResolver({
  registry: claimed,
  locale: en,

  layers: [],
});

const claimedAst = (input: string) => {
  const ctx = { locale: "en", now: 0, timeZone: "UTC", isUnitAlias: () => false };
  return parse(foldLiterals(lex(input, en), input, claimed, ctx), claimedResolver, input);
};

test("every reading of a literal becomes a candidate, in fold order", () => {
  const node = claimedAst("mark");
  if (node.type !== "literal") throw new Error("unreachable");
  expect(node.candidates.map((c) => `${c.kind}:${c.unit}@${c.weight}`)).toEqual([
    "mark:a@2",
    "mark:a@1",
    "mark:b@0",
  ]);
});

test("each candidate keeps its own value, including two that agree on the unit", () => {
  const node = claimedAst("mark");
  if (node.type !== "literal") throw new Error("unreachable");
  // Keyed by candidate identity, so the two `mark:a` readings stay distinct —
  // the whole reason the node carries a Map and not a kind/unit lookup.
  expect(node.candidates.map((c) => node.values.get(c)?.canonical.toString())).toEqual([
    "1",
    "2",
    "3",
  ]);
});

test("a claimed number offers the ordinary number beside the claim", () => {
  const node = claimedAst("77");
  if (node.type !== "literal") throw new Error("unreachable");
  expect(node.candidates.map((c) => c.kind)).toEqual(["mark", "number"]);
  // Below the claim by exactly the stated margin, so a matcher that says nothing
  // about weight still wins — and one that means to lose says so with a weight
  // under it.
  expect(node.candidates[1]?.weight).toBe(NUMBER_FALLBACK_WEIGHT);
  expect(node.values.get(node.candidates[1] as Candidate)?.canonical.toString()).toBe(
    "77",
  );
});

test("only the readings that opt in are conversion targets, and the word joins them", () => {
  const node = claimedAst("mark in mark");
  if (node.type !== "convert") throw new Error("unreachable");
  // `mark:b` opted in; the two `mark:a` readings did not. "mark" is also unit
  // a's alias, so the ordinary unit reading of the word underneath the claim
  // arrives beside it — which is what "3pm in tokyo" needs once geo claims the
  // city that datetime registers as a zone.
  expect(node.target.map((c) => c.unit)).toEqual(["b", "a"]);
  expect(node.targetValues?.size).toBe(1);
  expect(node.targetValues?.get(node.target[0] as Candidate)?.canonical.toString()).toBe(
    "3",
  );
  // And nothing was invented for the unit reading: it is a label, not a value.
  expect(node.targetValues?.has(node.target[1] as Candidate)).toBe(false);
});

test("a claimed word is still a unit after a number, when the word is one", () => {
  const node = claimedAst("10 mark");
  if (node.type !== "quantity") throw new Error("unreachable");
  expect(node.candidates.map((c) => `${c.kind}:${c.unit}`)).toEqual(["mark:a"]);
});

/**
 * A claim whose own unit is the alias of the word beneath it. Every country name
 * is a place alias, so "3pm in ukraine" and "100 usd in japan" are both this
 * shape, and it is the one case where the word must NOT join the target.
 */
const zones = defineKind({
  id: "zone",
  value: { mode: "opaque", units: ["z"] },
  literals: [
    (input, offset) =>
      input.startsWith("zed", offset)
        ? {
            kind: "zone",
            unit: "z",
            canonical: new Decimal(5),
            length: 3,
            targetable: true,
          }
        : null,
  ],
});
const zonesEn = composeLocale(en.language, [
  defineVocabulary({
    locale: "en",
    kind: "zone",
    units: { z: { aliases: ["zed"] } },
  }),
]);
const zoned = buildRegistry([number, length, zones], [zonesEn]);
const zonedAst = (input: string) =>
  parse(
    foldLiterals(lex(input, en), input, zoned, {
      locale: "en",
      now: 0,
      timeZone: "UTC",
      isUnitAlias: () => false,
    }),
    createResolver({ registry: zoned, locale: en, layers: [] }),
    input,
  );

test("the word under a claim does not repeat a target the claim already named", () => {
  const node = zonedAst("10 km in zed");
  if (node.type !== "convert") throw new Error("unreachable");
  // One target, not two. The alias reading would agree with the claim on kind
  // and unit and disagree on everything that matters: it has no value, so it
  // takes the stand-in, whose meta is the LEFT operand's. `evaluate` never
  // reached that second assignment, and `suggest`, which evaluates all of them,
  // threw on it and returned an empty list for an input it had just decided.
  expect(node.target.map((c) => `${c.kind}:${c.unit}`)).toEqual(["zone:z"]);
  expect(node.targetValues?.size).toBe(1);
  expect(node.targetValues?.get(node.target[0] as Candidate)?.canonical.toString()).toBe(
    "5",
  );
});
