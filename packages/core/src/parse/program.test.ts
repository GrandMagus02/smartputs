import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { walk } from "./ast";
import { createResolver } from "./candidates";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { parse } from "./pratt";
import { buildProgram } from "./program";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const resolver = createResolver({
  registry,
  locale: en,
  packs: [],
  layers: [en.weights],
});

const programFor = (source: string) => {
  const input = normalize(source);
  return buildProgram(parse(lex(input.text, en), resolver, source), input);
};

test("every node has a unique id, and nodes[n.id] is n", () => {
  const program = programFor("2 * (3 kg + 4 kg)");
  const seen = new Set<number>();
  walk(program.root, (node) => {
    expect(seen.has(node.id), `duplicate id ${node.id}`).toBe(false);
    seen.add(node.id);
    expect(program.nodes[node.id]).toBe(node);
  });
  expect(seen.size).toBe(program.nodes.length);
});

test("ids are assigned depth-first from zero", () => {
  const program = programFor("1 kg + 2 kg");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2]);
});

// A left-associative chain demotes an already-built `left` that is itself a
// wrapping node (here, the first "+"). A demote that only renumbers the
// subtree's root — rather than the whole subtree — leaves the root sorting
// after its own children, which `buildProgram` cannot detect: every id is
// still unique and dense, just out of walk order.
test("a left-associative chain renumbers a demoted subtree's descendants too", () => {
  const program = programFor("1 kg + 2 kg + 3 kg");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2, 3, 4]);
});

// The case where a demoted node has a demoted node inside it: the second "+"
// demotes a subtree that itself contains the first "+"'s already-demoted
// result.
test("a four-term chain renumbers a demoted-within-demoted subtree", () => {
  const program = programFor("1 kg + 2 kg + 3 kg + 4 kg");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test("a demoted unary renumbers its operand too", () => {
  const program = programFor("-1 kg + 2 kg");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2, 3]);
});

test("a convert wrapping a binary renumbers the whole binary subtree", () => {
  const program = programFor("1 kg + 2 kg in g");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2, 3]);
});

test("the program carries its normalized input", () => {
  const program = programFor("  1 kg + 2 kg  ");
  expect(program.input.source).toBe("  1 kg + 2 kg  ");
  expect(program.input.text).toBe("1 kg + 2 kg");
});

test("the program and every node are frozen", () => {
  const program = programFor("1 kg");
  expect(Object.isFrozen(program)).toBe(true);
  expect(Object.isFrozen(program.nodes)).toBe(true);
  walk(program.root, (n) => expect(Object.isFrozen(n)).toBe(true));
});

test("a convert node's operand and its target both get ids", () => {
  const program = programFor("2 kg in g");
  const types = program.nodes.map((n) => n.type);
  expect(types).toContain("convert");
  expect(types).toContain("quantity");
});
