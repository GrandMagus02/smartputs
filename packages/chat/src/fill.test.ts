import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "./carve";
import { testEngine } from "./engine.fixture";
import { fill, targetKindOf } from "./fill";
import { Conversation } from "./state";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const en = [chatEn];

const stocked = (): Conversation => {
  const c = new Conversation();
  c.push({
    kind: "mass",
    value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
    text: "5 pounds",
  });
  return c;
};

const carved = (text: string) => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return { candidate, marks: engine.scan(text) };
};

test("targetKindOf reads the kind of the last mark in the candidate", () => {
  const { candidate, marks } = carved("convert this to kg");
  expect(targetKindOf(candidate, marks, engine)).toBe("mass");
});

test("targetKindOf is undefined when the candidate names no unit", () => {
  const { candidate, marks } = carved("convert this");
  expect(targetKindOf(candidate, marks, engine)).toBeUndefined();
});

test("fills a hole from a compatible value and carries its surface text", () => {
  const { candidate, marks } = carved("convert this to kg");
  const [filled] = fill(candidate, marks, stocked(), engine);
  expect(filled?.slot).toBe("source");
  expect(filled?.from).toBe("state");
  expect(filled?.text).toBe("5 pounds");
  expect(filled?.value.unit).toBe("lb");
});

test("fills nothing when state holds no compatible value", () => {
  const { candidate, marks } = carved("convert this to kg");
  expect(fill(candidate, marks, new Conversation(), engine)).toHaveLength(0);
});

test("the target kind and not recency decides which value is taken", () => {
  const c = stocked();
  c.push({
    kind: "length",
    value: { kind: "length", canonical: new Decimal(5), unit: "m" },
    text: "5 metres",
  });
  const { candidate, marks } = carved("convert this to kg");
  expect(fill(candidate, marks, c, engine)[0]?.value.kind).toBe("mass");
});

test("fills nothing when the candidate has no hole", () => {
  const { candidate, marks } = carved("convert 5 lb to kg");
  expect(fill(candidate, marks, stocked(), engine)).toHaveLength(0);
});
