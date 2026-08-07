import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as coreEn } from "@smartput/locale-en";
import { date } from "./date";
import { DATE_UNIT } from "./value";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
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
  expect(value.unit).toBe(DATE_UNIT);
  expect(value.meta?.day).toBe("2026-01-15");
  expect(value.meta?.zone).toBe("UTC");
});

test("a date plus a duration is a date", () => {
  const r = engine.evaluate("today + 3 d", { kinds: ["date", "duration"] });
  expect(r.kind).toBe("date");
  expect(r.formatted).toBe("2026-01-18");
});

test("the sentinel unit is named by id alone (R1)", () => {
  expect(date.value.mode).toBe("opaque");
  expect(date.value.mode === "opaque" ? date.value.units : null).toEqual([DATE_UNIT]);
});

test("the sentinel unit id is not a word the lexer can produce", () => {
  // Ruling R2 indexes a unit under its own registry key when no language has
  // spoken for the kind, and this kind ships no vocabulary in any language — so
  // the id *is* the alias now, and "registers no aliases" is no longer the
  // guard. `lex` only builds a word token out of `\p{L}` runs, so an id
  // carrying one non-letter can never be typed.
  expect(DATE_UNIT).toMatch(/[^\p{L}]/u);
});

test("registering date leaves duration's own word alone", () => {
  const r = engine.evaluate("1 day");
  expect(r.kind).toBe("duration");
});
