import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "./time";
import { TIME_UNIT } from "./value";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, time],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare clock time still reads as a datetime", () => {
  const r = engine.evaluate("3pm");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-15 15:00 UTC");
});

test("the time reading is present and formats as a clock", () => {
  const r = engine.evaluate("3pm", { kinds: ["time"] });
  expect(r.kind).toBe("time");
  expect(r.formatted).toBe("15:00");
  expect(r.value.unit).toBe(TIME_UNIT);
});

test("canonical is nanoseconds since local midnight", () => {
  const { value } = engine.evaluate("10:00", { kinds: ["time"] });
  expect(value.canonical.toString()).toBe("36000000000000");
});

test("the time value carries its wall clock and zone on meta", () => {
  const { value } = engine.evaluate("3pm", { kinds: ["time"] });
  expect(value.meta?.hms).toBe("15:00:00");
  expect(value.meta?.zone).toBe("UTC");
});

test("a date yields no time reading", () => {
  expect(() => engine.evaluate("today", { kinds: ["time"] })).toThrow();
});

test("an ISO date-time yields no time reading", () => {
  expect(() => engine.evaluate("2026-03-01 08:00", { kinds: ["time"] })).toThrow();
});

test("a time plus a duration wraps within the day", () => {
  const r = engine.evaluate("23:30 + 90 min", { kinds: ["time", "duration"] });
  expect(r.formatted).toBe("01:00");
});

test("a time minus a duration is a time", () => {
  const r = engine.evaluate("10:00 - 90 min", { kinds: ["time", "duration"] });
  expect(r.kind).toBe("time");
  expect(r.formatted).toBe("08:30");
});

test("the sentinel unit id is not a word the lexer can produce", () => {
  // Same guard as `@smartput/date`'s: ruling R2 indexes a unit under its own
  // registry key when no language has spoken for the kind, so a sentinel id
  // made only of letters would be typeable. `lex` builds a word token out of
  // `\p{L}` runs alone, so one non-letter closes it off.
  expect(TIME_UNIT).toMatch(/[^\p{L}]/u);
});
