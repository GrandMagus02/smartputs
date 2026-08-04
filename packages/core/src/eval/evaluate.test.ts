import { expect, test } from "bun:test";
import { DivideByZeroError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { parse } from "../parse/pratt";
import { solve } from "../solve/solver";
import { evaluateNode } from "./evaluate";

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
  value: { mode: "ratio", canonical: "s", units: { s: 1, min: 60, h: 3600 } },
  lexicon: { min: ["min", "m"], h: ["h"], s: ["s"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: { in: ["in"] } });
const registry = buildRegistry([number, length, duration]);

function evaluate(input: string) {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const node = parse(lex(input, en), resolver, input);
  const [best] = solve(node, registry, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode(node, best, registry, "en", input);
}

test("evaluates a single quantity in its authored unit", () => {
  const v = evaluate("10 km");
  expect(v.kind).toBe("length");
  expect(v.unit).toBe("km");
  expect(v.canonical.toString()).toBe("10000");
});

test("addition keeps the left operand's unit", () => {
  const v = evaluate("1 km + 500 m");
  expect(v.unit).toBe("km");
  expect(v.canonical.toString()).toBe("1500");
});

test("subtraction across duration units", () => {
  const v = evaluate("30 h - 30 min");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("106200");
});

test("context-resolved ambiguity evaluates as duration", () => {
  const v = evaluate("10 m + 5 h");
  expect(v.kind).toBe("duration");
  expect(v.canonical.toString()).toBe("18600");
});

test("scaling by a number", () => {
  expect(evaluate("10 km * 3").canonical.toString()).toBe("30000");
});

test("conversion rebases the unit without changing the quantity", () => {
  const v = evaluate("2 km in m");
  expect(v.unit).toBe("m");
  expect(v.canonical.toString()).toBe("2000");
});

test("unary minus negates", () => {
  expect(evaluate("-5 km").canonical.toString()).toBe("-5000");
});

test("plain arithmetic on numbers", () => {
  expect(evaluate("(1 + 2) * 3").canonical.toString()).toBe("9");
});

test("division by zero throws", () => {
  expect(() => evaluate("10 km / 0")).toThrow(DivideByZeroError);
});

test("values are frozen", () => {
  expect(Object.isFrozen(evaluate("10 km"))).toBe(true);
});
