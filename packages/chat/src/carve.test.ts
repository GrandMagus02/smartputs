import { expect, test } from "bun:test";
import { carve } from "./carve";
import { chatEn } from "./vocabulary";

const en = [chatEn];

test("strips a greeting at the head and politeness at the tail", () => {
  const [top] = carve("Hi, convert this to kg please", en);
  expect(top?.stripped.head).toBe("hi,");
  expect(top?.stripped.tail).toBe("please");
  expect(top?.text).toBe("convert this to kg");
});

test("spans index the caller's string", () => {
  const input = "Hi, convert this to kg please";
  const [top] = carve(input, en);
  expect(top?.text).toBe(input.slice(top?.span.start ?? 0, top?.span.end ?? 0));
});

test("matches the convert frame and records the hole the referent leaves", () => {
  const [top] = carve("convert this to kg", en);
  expect(top?.frame).toBe("convert");
  expect(top?.holes).toHaveLength(1);
  expect(top?.holes[0]?.slot).toBe("source");
});

test("a referent with no frame still leaves a hole", () => {
  const [top] = carve("that in kg", en);
  expect(top?.holes.map((h) => h.slot)).toContain("source");
});

test("leaves a message with its own operand hole-free", () => {
  const [top] = carve("convert 5 lb to kg", en);
  expect(top?.holes).toHaveLength(0);
});

test("emits several candidates and never one", () => {
  const found = carve("what is 2 + 2", en);
  expect(found.length).toBeGreaterThan(1);
  expect(found.map((c) => c.text)).toContain("2 + 2");
});

test("the unstripped whole message is always a candidate", () => {
  const input = "what is 2 + 2";
  expect(carve(input, en).map((c) => c.text)).toContain(input);
});

test("a stripped word never eats an operand beside it", () => {
  // "it" is a referent; "5 it" is not a thing, and stripping mid-string would
  // make it one. Referents are recognised, never removed.
  const [top] = carve("convert 5 lb to it", en);
  expect(top?.text).toContain("5 lb");
});

test("strips nothing from a message with no carrier", () => {
  const [top] = carve("2 + 2", en);
  expect(top?.stripped).toEqual({ head: "", tail: "" });
  expect(top?.text).toBe("2 + 2");
});

test("returns a single whole-input candidate for empty vocabulary", () => {
  const found = carve("2 + 2", []);
  expect(found).toHaveLength(1);
  expect(found[0]?.text).toBe("2 + 2");
});
