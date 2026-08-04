import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { DivideByZeroError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import { defineLocale } from "../locale/define";
import enLocale from "../locale/en";
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

const en = defineLocale({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in"], of: ["of"] },
});
const registry = buildRegistry([number, length, duration]);

function evaluate(input: string) {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const node = parse(lex(input, en), resolver, input);
  const [best] = solve(node, registry, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode({ node, assignment: best, registry, locale: "en", input });
}

test("evaluates a single quantity in its authored unit", () => {
  const v = evaluate("10 km");
  expect(v.value.kind).toBe("length");
  expect(v.value.unit).toBe("km");
  expect(v.value.canonical.toString()).toBe("10000");
});

test("addition keeps the left operand's unit", () => {
  const v = evaluate("1 km + 500 m");
  expect(v.value.unit).toBe("km");
  expect(v.value.canonical.toString()).toBe("1500");
});

test("subtraction across duration units", () => {
  const v = evaluate("30 h - 30 min");
  expect(v.value.unit).toBe("h");
  expect(v.value.canonical.toString()).toBe("106200");
});

test("context-resolved ambiguity evaluates as duration", () => {
  const v = evaluate("10 m + 5 h");
  expect(v.value.kind).toBe("duration");
  expect(v.value.canonical.toString()).toBe("18600");
});

test("scaling by a number", () => {
  expect(evaluate("10 km * 3").value.canonical.toString()).toBe("30000");
});

test("conversion rebases the unit without changing the quantity", () => {
  const v = evaluate("2 km in m");
  expect(v.value.unit).toBe("m");
  expect(v.value.canonical.toString()).toBe("2000");
});

test("unary minus negates", () => {
  expect(evaluate("-5 km").value.canonical.toString()).toBe("-5000");
});

test("plain arithmetic on numbers", () => {
  expect(evaluate("(1 + 2) * 3").value.canonical.toString()).toBe("9");
});

test("division by zero throws", () => {
  expect(() => evaluate("10 km / 0")).toThrow(DivideByZeroError);
});

test("values are frozen", () => {
  expect(Object.isFrozen(evaluate("10 km").value)).toBe(true);
});

test("evaluateNode collects the assumption of every signature it applies", () => {
  const noted = defineKind({
    id: "length",
    extendsKind: "length",
    value: { mode: "ratio", canonical: "m", units: {} },
    ops: [
      {
        op: "of",
        left: "number",
        right: "length",
        result: "length",
        assumption: "read as a scale factor",
        apply: (l, r) =>
          Object.freeze({ ...r, canonical: r.canonical.times(l.canonical) }),
      },
    ],
  });
  const r = buildRegistry([number, length, duration, noted]);
  const resolver = createResolver({ registry: r, locale: en, packs: [], layers: [] });
  const input = "2 of 10 km";
  const node = parse(lex(input, en), resolver, input);
  const [best] = solve(node, r, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");

  const out = evaluateNode({ node, assignment: best, registry: r, locale: "en", input });
  expect(out.value.canonical.toString()).toBe("20000");
  expect(out.assumptions).toEqual(["read as a scale factor"]);
});

test("a plain expression records no assumptions", () => {
  expect(evaluate("1 km + 500 m").assumptions).toEqual([]);
});

test("a value's meta is frozen, not just the value", () => {
  const engine = createEngine({
    locales: [enLocale],
    kinds: BUILTIN_KINDS,
    kindMeta: { mass: { note: "x" } },
  });
  const v = engine.evaluate("1 kg").value;
  expect(Object.isFrozen(v)).toBe(true);
  expect(Object.isFrozen(v.meta)).toBe(true);
});
