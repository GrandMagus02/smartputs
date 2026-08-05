import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { length } from "../kinds/length";
import en from "../locale/en";
import type { LiteralMatcher, MatchCtx } from "../types";
import { lex } from "./lex";
import { foldLiterals } from "./literals";

/** Claims the literal word "today", and nothing else. */
const todayMatcher: LiteralMatcher = (input, offset) => {
  if (!input.startsWith("today", offset)) return null;
  return { kind: "day", unit: "UTC", canonical: new Decimal(7), length: 5, weight: 3 };
};

/** Claims a whole ISO date, which lexes as number-op-number-op-number. */
const isoMatcher: LiteralMatcher = (input, offset) => {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(input.slice(offset));
  if (m === null) return null;
  return { kind: "day", unit: "UTC", canonical: new Decimal(1), length: m[0].length };
};

/** Claims one character too few to land on a token boundary. */
const straddling: LiteralMatcher = (input, offset) =>
  input.startsWith("today", offset)
    ? { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 4 }
    : null;

const day = (literals: LiteralMatcher[]) =>
  defineKind({
    id: "day",
    value: { mode: "opaque", units: { UTC: ["utc"] } },
    literals,
  });

const ctx: MatchCtx = {
  locale: "en",
  now: 1_768_478_400_000,
  timeZone: "UTC",
  isUnitAlias: () => false,
};

const fold = (input: string, literals: LiteralMatcher[]) => {
  const registry = buildRegistry([day(literals), length], [], "en");
  return foldLiterals(lex(input, en), input, registry, ctx);
};

test("a matched word becomes one literal token", () => {
  const tokens = fold("today", [todayMatcher]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({
    type: "literal",
    kind: "day",
    unit: "UTC",
    weight: 3,
    text: "today",
    start: 0,
    end: 5,
  });
});

test("a match spanning several tokens collapses all of them", () => {
  const tokens = fold("2026-01-15", [isoMatcher]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({
    type: "literal",
    text: "2026-01-15",
    start: 0,
    end: 10,
  });
});

test("surrounding tokens survive untouched", () => {
  const tokens = fold("today + 5 km", [todayMatcher]);
  expect(tokens.map((t) => t.type)).toEqual(["literal", "op", "number", "word"]);
});

test("a match that does not end on a token boundary is discarded", () => {
  const tokens = fold("today", [straddling]);
  expect(tokens.map((t) => t.type)).toEqual(["word"]);
});

test("the longest match wins", () => {
  const shorter: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 5 }
      : null;
  const longer: LiteralMatcher = (input, offset) =>
    input.startsWith("today noon", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(9), length: 10 }
      : null;
  const tokens = fold("today noon", [shorter, longer]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({ text: "today noon" });
});

test("matching resumes after the claimed run", () => {
  const tokens = fold("today today", [todayMatcher]);
  expect(tokens.map((t) => t.type)).toEqual(["literal", "literal"]);
});

test("a zero-length or negative match is ignored rather than looping", () => {
  const zero: LiteralMatcher = () => ({
    kind: "day",
    unit: "UTC",
    canonical: new Decimal(0),
    length: 0,
  });
  expect(fold("today", [zero]).map((t) => t.type)).toEqual(["word"]);
});

test("a match naming a unit the kind does not register is ignored", () => {
  const bogus: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "Mars/Olympus", canonical: new Decimal(0), length: 5 }
      : null;
  expect(fold("today", [bogus]).map((t) => t.type)).toEqual(["word"]);
});

test("no matchers means the token list is returned unchanged", () => {
  const tokens = fold("5 km", []);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});
