import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import english from "../locale/en";
import type { LiteralMatcher } from "../types";
import { normalize } from "./normalize";
import { Tokenizer } from "./tokenizer";

const en = composeLocale(english);

// Fixed so the golden table below is deterministic; no case here reads a
// literal matcher that consults `ctx.now`, but a fixed clock is what makes
// "two `.run()` calls return equal output" a fact rather than a coin flip.
const NOW = 1_768_478_400_000;

const emptyRegistry = buildRegistry([]);
const tokenizer = new Tokenizer({
  locale: en,
  registry: emptyRegistry,
  now: () => NOW,
  timeZone: "UTC",
});

/** Compact, comparable shape: type, surface-ish text, start, end. */
const shape = (input: string) =>
  tokenizer
    .run(input)
    .tokens.map((t) => [
      t.type,
      t.type === "number"
        ? t.value.toString()
        : t.type === "op"
          ? t.op
          : t.type === "keyword"
            ? t.keyword
            : "text" in t
              ? t.text
              : "",
      t.start,
      t.end,
    ]);

test("a plain quantity lexes to a number and a unit word", () => {
  expect(shape("3 kg")).toEqual([
    ["number", "3", 0, 1],
    ["word", "kg", 2, 4],
  ]);
});

test("a binary expression keeps both operands and the operator", () => {
  expect(shape("3 kg + 4 kg")).toEqual([
    ["number", "3", 0, 1],
    ["word", "kg", 2, 4],
    ["op", "+", 5, 6],
    ["number", "4", 7, 8],
    ["word", "kg", 9, 11],
  ]);
});

test("a numeral fold turns a spelled-out number into a number token", () => {
  expect(shape("thirty deg")).toEqual([
    ["number", "30", 0, 6],
    ["word", "deg", 7, 10],
  ]);
});

test("a word operator folds into an op token", () => {
  expect(shape("3 plus 4")).toEqual([
    ["number", "3", 0, 1],
    ["op", "+", 2, 6],
    ["number", "4", 7, 8],
  ]);
});

test("a literal matcher claims its span as one token", () => {
  const todayMatcher: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(7), length: 5, weight: 3 }
      : null;
  const day = defineKind({
    id: "day",
    value: { mode: "opaque", units: { UTC: ["utc"] } },
    literals: [todayMatcher],
  });
  const registry = buildRegistry([day]);
  const withLiterals = new Tokenizer({ locale: en, registry, now: () => NOW });

  const stream = withLiterals.run("today + 5 km");
  expect(stream.tokens.map((t) => t.type)).toEqual(["literal", "op", "number", "word"]);
  expect(stream.tokens[0]).toMatchObject({ text: "today", start: 0, end: 5 });
});

test("a NormalizedInput is accepted directly, without re-normalizing", () => {
  const normalized = normalize("  3 kg  ");
  const stream = tokenizer.run(normalized);
  expect(stream.input).toBe(normalized);
  expect(stream.tokens.map((t) => t.type)).toEqual(["number", "word"]);
});

test("a string input is normalized before it is lexed", () => {
  const fromString = tokenizer.run("  3 kg  ").tokens;
  const fromNormalized = tokenizer.run(normalize("  3 kg  ")).tokens;
  expect(fromString.map((t) => [t.type, t.start, t.end])).toEqual(
    fromNormalized.map((t) => [t.type, t.start, t.end]),
  );
});

test("the Tokenizer instance and every TokenStream it produces are frozen", () => {
  expect(Object.isFrozen(tokenizer)).toBe(true);
  const stream = tokenizer.run("3 kg");
  expect(Object.isFrozen(stream)).toBe(true);
  expect(Object.isFrozen(stream.tokens)).toBe(true);
  // The container being frozen does not imply its elements are: a frozen
  // array of mutable objects still lets `stream.tokens[0].text = "HACK"`
  // through, which `Parser.run`'s `[...stream.tokens]` (a shallow copy) would
  // then read as if it were real input.
  expect(stream.tokens.length).toBeGreaterThan(0);
  for (const token of stream.tokens) {
    expect(Object.isFrozen(token)).toBe(true);
  }
});

test("two run() calls on the same input return equal output", () => {
  const a = tokenizer.run("3 kg + 4 kg");
  const b = tokenizer.run("3 kg + 4 kg");
  const project = (s: typeof a) => s.tokens.map((t) => [t.type, t.start, t.end]);
  expect(project(a)).toEqual(project(b));
  expect(a.input.text).toBe(b.input.text);
});

test("now() is called once per run(), not fixed at construction", () => {
  // A long-lived Tokenizer must not freeze its own clock — the ruling this
  // guards is that `now` is read inside `run()`, not memoized in the
  // constructor. A matcher that records `ctx.now` on each call is the only
  // way to observe that from outside.
  let counter = 0;
  const clock = () => {
    counter += 1;
    return counter;
  };
  const seen: number[] = [];
  const clockMatcher: LiteralMatcher = (input, offset, ctx) => {
    if (!input.startsWith("z", offset)) return null;
    seen.push(ctx.now);
    return { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 1 };
  };
  const day = defineKind({
    id: "day",
    value: { mode: "opaque", units: { UTC: ["utc"] } },
    literals: [clockMatcher],
  });
  const registry = buildRegistry([day]);
  const withLiterals = new Tokenizer({ locale: en, registry, now: clock });

  withLiterals.run("z");
  withLiterals.run("z");
  expect(seen).toEqual([1, 2]);
});
