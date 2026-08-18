import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { conversionHead, convertibleKinds } from "./context";

const en = composeLocale(english, BUILTIN_EN);
const registry = buildRegistry(BUILTIN_KINDS, [en]);

/** The fragment always ends the input, so its start is where the head stops. */
const headOf = (input: string) => {
  const match = /[\p{L}][\p{L}\p{N}]*$/u.exec(input);
  return conversionHead(input, match?.index ?? input.length, en);
};

test("reads the expression a conversion target follows", () => {
  expect(headOf("30 hours in s")).toBe("30 hours");
});

test("every spelling of the keyword opens a target position", () => {
  expect(headOf("30 hours to s")).toBe("30 hours");
  expect(headOf("30 hours as s")).toBe("30 hours");
});

test("a fragment that follows no keyword is not a target", () => {
  expect(headOf("30 ho")).toBe(null);
  expect(headOf("s")).toBe(null);
});

test("the head keeps the whole expression, not just its last unit", () => {
  expect(headOf("10 kg + 5 lb in g")).toBe("10 kg + 5 lb");
});

test("a target may carry its own count", () => {
  expect(headOf("2 km in 3 m")).toBe("2 km");
});

test("a keyword with nothing before it converts nothing", () => {
  expect(headOf("in s")).toBe(null);
});

test("the trailing in of a bare quantity is the fragment, not a keyword", () => {
  // "3 in" is three inches: the walk starts left of the fragment and finds "3".
  expect(headOf("3 in")).toBe(null);
  // ...and in "3 in in c" the first "in" is the keyword, by position.
  expect(headOf("3 in in c")).toBe("3 in");
});

test("only conversion keywords open a target position", () => {
  expect(headOf("20% of 300 gr")).toBe(null);
});

test("convertible kinds are the registry's own in signatures", () => {
  const fromDuration = convertibleKinds(registry, ["duration"]);
  expect(fromDuration.has("duration")).toBe(true);
  expect(fromDuration.has("area")).toBe(false);
  expect(fromDuration.has("length")).toBe(false);
});

test("several source readings widen the set to their union", () => {
  const both = convertibleKinds(registry, ["duration", "length"]);
  expect(both.has("duration")).toBe(true);
  expect(both.has("length")).toBe(true);
  expect(both.has("area")).toBe(false);
});
