import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "../carve";
import { testEngine } from "../engine.fixture";
import type { Filled } from "../types";
import { chatEn } from "../vocabulary";
import { convertResolver, evaluateResolver } from "./index";

const engine = testEngine();
const en = [chatEn];

const ctxFor = (text: string, filled: readonly Filled[] = []) => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return { candidate, ctx: { engine, filled, marks: engine.scan(text) } };
};

test("evaluate resolves arithmetic", () => {
  const { candidate, ctx } = ctxFor("2 + 2");
  expect(evaluateResolver.resolve(candidate, ctx).formatted).toBe("4");
});

test("evaluate resolves a unit expression", () => {
  const { candidate, ctx } = ctxFor("1 kg + 500 g");
  expect(evaluateResolver.resolve(candidate, ctx).formatted).toBe("1.5 kilograms");
});

test("evaluate takes the top reading of an ambiguous payload rather than throwing", () => {
  const { candidate, ctx } = ctxFor("10 m");
  expect(() => evaluateResolver.resolve(candidate, ctx)).not.toThrow();
});

test("convert handles an explicit source", () => {
  const { candidate, ctx } = ctxFor("convert 5 lb to kg");
  expect(convertResolver.resolve(candidate, ctx).kind).toBe("mass");
});

test("convert rebuilds the input from a filled surface, not from a Decimal", () => {
  const { candidate, ctx } = ctxFor("convert this to kg", [
    {
      slot: "source",
      from: "state" as const,
      value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
      text: "5 pounds",
    },
  ]);
  const result = convertResolver.resolve(candidate, ctx);
  expect(result.kind).toBe("mass");
  expect(result.formatted).toContain("kilogram");
});

test("both resolvers are synchronous", () => {
  expect(evaluateResolver.async).toBeUndefined();
  expect(convertResolver.async).toBeUndefined();
});

test("convert claims the convert frame and evaluate claims none", () => {
  expect(convertResolver.frames.en).toContain("convert");
  expect(evaluateResolver.frames.en ?? []).toHaveLength(0);
});
