import { expect, test } from "bun:test";
import { CountQueryError, composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

/**
 * The count idiom against the real vocabularies, not a fixture.
 *
 * `eval/count.test.ts` in core pins the rule; what this file is for is that the
 * rule is a rule about *words*, and the words come from every kind package's
 * `locale/en`. A unit whose vocabulary spells no `forms` — a symbol-only entry,
 * a half-translated table — silently stays a conversion, and the only place
 * that shows up is here, with the shipped tables installed.
 */
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

const formatted = (input: string): string | undefined =>
  engine.evaluate(input)?.formatted;

test.each([
  ["minutes in hour", "60 minutes"],
  ["seconds in minute", "60 seconds"],
  ["days in week", "7 days"],
  ["grams in kilogram", "1,000 grams"],
  ["centimetres in metre", "100 centimetres"],
  ["bytes in kilobyte", "1,000 bytes"],
  ["millilitres in litre", "1,000 millilitres"],
])("%p counts, and answers in the plural unit", (input, expected) => {
  expect(formatted(input)).toBe(expected);
});

test.each([
  // The mirrored spelling — singular, then plural — is the conversion it has
  // always been, and lands on the same answer from the other side.
  ["hour in minutes", "60 minutes"],
  ["kilogram in grams", "1,000 grams"],
  // A count somebody wrote down is never a count query.
  ["10 minutes in hours", "0.16666666666666666666666667 hours"],
  ["1 minute in hours", "0.016666666666666666666666667 hours"],
  // Singular on the left, or plural on the right: neither is the idiom.
  ["minute in hours", "0.016666666666666666666666667 hours"],
  ["minutes in hours", "0.016666666666666666666666667 hours"],
])("%p stays a conversion", (input, expected) => {
  expect(formatted(input)).toBe(expected);
});

test.each([
  ["hours in minute"],
  ["kilograms in gram"],
  ["metres in centimetre"],
  ["weeks in day"],
])("%p asks for a count that cannot exist", (input) => {
  expect(() => engine.evaluate(input)).toThrow(CountQueryError);
});

test("the refusal points at the spelling that does resolve", () => {
  expect(() => engine.evaluate("hours in minute")).toThrow(/"minute in hours"/);
  expect(formatted("minute in hours")).toBe("0.016666666666666666666666667 hours");
});

test("a count query crosses no kind", () => {
  // "in" between two kinds is a conversion the kinds define — nothing about
  // grammatical number should reach it.
  expect(() => engine.evaluate("metres in second")).toThrow();
});
