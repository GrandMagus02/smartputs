import { expect, test } from "bun:test";
import { composeLocale, createEngine, type Engine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { place } from "@smartput/country";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "@smartput/time";
import { truthOf } from "./index";

/**
 * Ruling C5, from both sides.
 *
 * `datetime`, `date` and `time` opt in, because their canonical is an instant
 * and ordering is the whole reason the scalar exists. `place` does not, and
 * that is the half worth testing: its canonical is a GeoNames feature id, so a
 * generated `>` would compare database row numbers and answer with total
 * confidence about nothing.
 */
const engine: Engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, date, time, place],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const truth = (input: string): boolean | null => truthOf(engine.evaluate(input).value);

test("instants order", () => {
  expect(truth("tomorrow > today")).toBe(true);
  expect(truth("yesterday > today")).toBe(false);
  expect(truth("today = today")).toBe(true);
  expect(truth("tomorrow != today")).toBe(true);
});

test("clock times order", () => {
  expect(truth("15:00 > 09:00")).toBe(true);
  expect(truth("09:00 >= 09:00")).toBe(true);
});

test("a place does not order, because its canonical is an identifier", () => {
  expect(() => engine.evaluate("ukraine > poland")).toThrow();
  // The kind still works for everything it did before; only the six
  // comparison signatures are absent.
  expect(engine.evaluate("ukraine").kind).toBe("place");
});
