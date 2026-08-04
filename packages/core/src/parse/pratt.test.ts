import { expect, test } from "bun:test";
import { NoCandidateError, UnitParseError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "./candidates";
import { lex } from "./lex";
import { parse } from "./pratt";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const en = defineLocale({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in", "to", "as"] },
});
const registry = buildRegistry([number, length]);
const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });

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

test("nodes carry spans back to the source", () => {
  const node = ast("10 km");
  expect(node.span).toEqual({ start: 0, end: 5 });
});
