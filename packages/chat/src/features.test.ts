import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "./carve";
import { testEngine } from "./engine.fixture";
import type { FeatureInput } from "./features";
import { NAMED_FEATURES, namedFeatures, probe } from "./features";
import { Conversation } from "./state";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const en = [chatEn];

const inputFor = (text: string, conversation = new Conversation()): FeatureInput => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return {
    input: text,
    candidate,
    marks: engine.scan(text),
    probe: probe(engine, candidate.text),
    conversation,
  };
};

const at = (v: Float64Array, name: string): number => {
  const i = NAMED_FEATURES.indexOf(name as (typeof NAMED_FEATURES)[number]);
  if (i < 0) throw new Error(`no feature named ${name}`);
  return v[i] ?? 0;
};

test("probe says a carved payload resolves and a carrier fragment does not", () => {
  expect(probe(engine, "2 + 2").resolves).toBe(true);
  expect(probe(engine, "is 2 + 2").resolves).toBe(false);
});

test("probe never throws on an ambiguous payload", () => {
  const p = probe(engine, "10 m");
  expect(p.resolves).toBe(true);
  expect(p.count).toBeGreaterThan(1);
});

test("the feature vector is the length of the name list", () => {
  expect(namedFeatures(inputFor("what is 2 + 2"))).toHaveLength(NAMED_FEATURES.length);
});

test("probeResolves fires on a carved payload", () => {
  expect(at(namedFeatures(inputFor("what is 2 + 2")), "probeResolves")).toBe(1);
});

test("frameMatched fires on a frame and not on plain arithmetic", () => {
  expect(at(namedFeatures(inputFor("convert 5 lb to kg")), "frameMatched")).toBe(1);
  expect(at(namedFeatures(inputFor("2 + 2")), "frameMatched")).toBe(0);
});

test("greetingStripped and politenessStripped read carve's record", () => {
  const v = namedFeatures(inputFor("Hi, convert 5 lb to kg please"));
  expect(at(v, "greetingStripped")).toBe(1);
  expect(at(v, "politenessStripped")).toBe(1);
});

test("holePresent fires on a referent", () => {
  expect(at(namedFeatures(inputFor("convert this to kg")), "holePresent")).toBe(1);
});

test("stateHasCompatible is 0 on an empty conversation and 1 on a match", () => {
  expect(at(namedFeatures(inputFor("convert this to kg")), "stateHasCompatible")).toBe(0);

  const conversation = new Conversation();
  conversation.push({
    kind: "mass",
    value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
    text: "5 pounds",
  });
  const v = namedFeatures(inputFor("convert this to kg", conversation));
  expect(at(v, "stateHasCompatible")).toBe(1);
});

test("markCount and topConfidence read the scan", () => {
  const v = namedFeatures(inputFor("5 kg"));
  expect(at(v, "markCount")).toBeGreaterThan(0);
  expect(at(v, "topConfidence")).toBeGreaterThan(0);
});

test("bias is always 1", () => {
  expect(at(namedFeatures(inputFor("anything at all")), "bias")).toBe(1);
});
