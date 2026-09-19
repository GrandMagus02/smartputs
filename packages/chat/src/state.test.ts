import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import type { Value } from "@smartput/kind/types";
import { Conversation } from "./state";

const val = (kind: string, unit: string, n: number): Value => ({
  kind,
  canonical: new Decimal(n),
  unit,
});

test("last returns the most recent entry when no kind is named", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last()?.kind).toBe("length");
});

test("last filters by kind — the coreference resolver", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last("mass")?.unit).toBe("lb");
});

test("last returns undefined when no entry has the kind", () => {
  const c = new Conversation();
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last("mass")).toBeUndefined();
});

test("candidates returns every compatible value, most recent first", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "mass", value: val("mass", "g", 2000), text: "2 kg" });
  const found = c.candidates("mass");
  expect(found.map((v) => v.unit)).toEqual(["g", "lb"]);
});

test("the ring is bounded and drops the oldest", () => {
  const c = new Conversation(2);
  c.push({ kind: "mass", value: val("mass", "g", 1), text: "a" });
  c.push({ kind: "mass", value: val("mass", "g", 2), text: "b" });
  c.push({ kind: "mass", value: val("mass", "g", 3), text: "c" });
  expect(c.size).toBe(2);
  expect(c.candidates("mass").map((v) => v.canonical.toString())).toEqual(["3", "2"]);
});

test("clear empties it", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "g", 1), text: "a" });
  c.clear();
  expect(c.size).toBe(0);
  expect(c.last()).toBeUndefined();
});

test("entries returns whole rows so a caller can reach the surface text", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  expect(c.entries("mass")[0]?.text).toBe("5 pounds");
  expect(c.entries("length")).toHaveLength(0);
});
