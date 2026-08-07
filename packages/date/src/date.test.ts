import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as coreEn } from "@smartput/locale-en";
import { date } from "./date";

const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime, date],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare date still reads as a datetime", () => {
  // The `date` reading is weighted -5, so it loses to datetime on its own.
  const r = engine.evaluate("today");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-15 00:00 UTC");
});

test("but the date reading is present and explainable", () => {
  const kinds = engine.evaluate("today", { kinds: ["date"] });
  expect(kinds.kind).toBe("date");
  expect(kinds.formatted).toBe("2026-01-15");
});

test("a clock time yields no date reading", () => {
  expect(() => engine.evaluate("3pm", { kinds: ["date"] })).toThrow();
});

test("an ISO date-time yields no date reading", () => {
  expect(() => engine.evaluate("2026-03-01 08:00", { kinds: ["date"] })).toThrow();
});

test("the date value snaps to midnight and carries its zone on meta", () => {
  const { value } = engine.evaluate("today", { kinds: ["date"] });
  expect(value.unit).toBe("day");
  expect(value.meta?.day).toBe("2026-01-15");
  expect(value.meta?.zone).toBe("UTC");
});

test("a date plus a duration is a date", () => {
  const r = engine.evaluate("today + 3 d", { kinds: ["date", "duration"] });
  expect(r.kind).toBe("date");
  expect(r.formatted).toBe("2026-01-18");
});
