import { expect, test } from "bun:test";
import { length } from "@smartput/kinds";
import { english } from "@smartput/locale-en";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import type { LiteralMatcher, MatchCtx } from "../types";
import { lex, type Token } from "./lex";
import { foldLiterals } from "./literals";

const en = composeLocale(english);

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
    value: { mode: "opaque", units: ["UTC"] },
    literals,
  });

const ctx: MatchCtx = {
  locale: "en",
  now: 1_768_478_400_000,
  timeZone: "UTC",
  isUnitAlias: () => false,
};

const fold = (input: string, literals: LiteralMatcher[]) => {
  const registry = buildRegistry([day(literals), length]);
  return foldLiterals(lex(input, en), input, registry, ctx);
};

test("a matched word becomes one literal token", () => {
  const tokens = fold("today", [todayMatcher]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({
    type: "literal",
    readings: [{ kind: "day", unit: "UTC", weight: 3 }],
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

// ---------------------------------------------------------------------------
// M6.3 — the fold groups readings instead of choosing between them
// ---------------------------------------------------------------------------

const readingsOf = (token: Token) => (token.type === "literal" ? token.readings : []);

test("one matcher's several readings of a span all survive", () => {
  const both: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? [
          { kind: "day", unit: "UTC", canonical: new Decimal(1), length: 5, weight: 2 },
          { kind: "day", unit: "UTC", canonical: new Decimal(2), length: 5, weight: 1 },
        ]
      : null;
  const tokens = fold("today", [both]);
  expect(tokens).toHaveLength(1);
  // Same kind, same unit, different value — which is the shape the fold used to
  // have no way to express and the reason `suggest("springfield")` was a list of
  // one where three cities carry the name.
  expect(readingsOf(tokens[0] as Token).map((r) => r.canonical.toString())).toEqual([
    "1",
    "2",
  ]);
});

test("two kinds claiming the same span both survive, not just the first to register", () => {
  // The fold used to keep one match per offset and break ties on registration
  // order, so a kind sorted later lost its reading outright however heavy it was.
  const other = defineKind({
    id: "aday",
    value: { mode: "opaque", units: ["UTC"] },
    literals: [
      (input, offset) =>
        input.startsWith("today", offset)
          ? { kind: "aday", unit: "UTC", canonical: new Decimal(4), length: 5 }
          : null,
    ],
  });
  const registry = buildRegistry([day([todayMatcher]), other, length]);
  const tokens = foldLiterals(lex("today", en), "today", registry, ctx);
  expect(readingsOf(tokens[0] as Token).map((r) => r.kind)).toEqual(["aday", "day"]);
});

test("a shorter reading is dropped rather than ranked below a longer one", () => {
  // Grouping is on the end offset alone: two readings of "today noon" belong
  // together and a reading of "today" describes different text.
  const shorter: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 5 }
      : null;
  const longer: LiteralMatcher = (input, offset) =>
    input.startsWith("today noon", offset)
      ? [
          { kind: "day", unit: "UTC", canonical: new Decimal(8), length: 10 },
          { kind: "day", unit: "UTC", canonical: new Decimal(9), length: 10 },
        ]
      : null;
  const tokens = fold("today noon", [shorter, longer]);
  expect(readingsOf(tokens[0] as Token).map((r) => r.canonical.toString())).toEqual([
    "8",
    "9",
  ]);
});

test("a single-token claim keeps the token it was read from", () => {
  const tokens = fold("today", [todayMatcher]);
  expect(tokens[0]).toMatchObject({ fallback: { type: "word", text: "today" } });
});

test("a claim over several tokens has nothing to fall back to", () => {
  // There is no single token under "2026-01-15" — it lexes as five — so an
  // ordinary reading of it would have to be invented rather than kept.
  const tokens = fold("2026-01-15", [isoMatcher]);
  expect(tokens[0]).not.toHaveProperty("fallback");
});

test("a claimed number keeps the number underneath it", () => {
  const postal: LiteralMatcher = (input, offset) =>
    /^\d{5}(?!\d)/.test(input.slice(offset))
      ? { kind: "day", unit: "UTC", canonical: new Decimal(90210), length: 5 }
      : null;
  // Spec §6.2's mechanism: the claim and the number reach the parser together,
  // so "90210" can be a number and still offer the place beneath it.
  expect(fold("90210", [postal])[0]).toMatchObject({
    readings: [{ kind: "day" }],
    fallback: { type: "number", text: "90210" },
  });
});

test("a match the fold rejects leaves no reading and no fallback", () => {
  // Rejection is per match, not per matcher: the straddling one is discarded and
  // the sound one still claims, which is what keeps one buggy plugin from
  // costing another its reading.
  const tokens = fold("today", [straddling, todayMatcher]);
  expect(readingsOf(tokens[0] as Token).map((r) => r.weight)).toEqual([3]);
});
