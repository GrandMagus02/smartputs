import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as coreEn } from "@smartput/locale-en";
import { InvertedRangeError } from "@smartput/range-core";
import { createDateRange, dateRange } from "./date-range";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, date, dateRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("the whole week is Monday to Sunday inclusive on display", () => {
  const r = engine.evaluate("whole week");
  expect(r.kind).toBe("date-range");
  expect(r.formatted).toBe("2026-01-12 → 2026-01-18");
});

test("the end is stored exclusive", () => {
  const { value } = engine.evaluate("whole week");
  expect(value.meta?.end).toStartWith("2026-01-19T00:00:00");
});

test("next month", () => {
  expect(engine.evaluate("next month").formatted).toBe("2026-02-01 → 2026-02-28");
});

test("the calendar year, however it is written", () => {
  for (const input of ["whole year", "year", "1 year", "one year", "this year"]) {
    expect(engine.evaluate(input).formatted).toBe("2026-01-01 → 2026-12-31");
  }
});

test("two dates joined by `to` are a range, outscoring the zone conversion", () => {
  // Chrono reads a bare "friday" against the Thursday 2026-01-15 clock as the
  // *next* Friday, 2026-01-16 — pinned by `packages/date/corpus/en.tsv`. The
  // stored end is exclusive, so the displayed end is that same Friday.
  const r = engine.evaluate("today to friday");
  expect(r.kind).toBe("date-range");
  expect(r.formatted).toBe("2026-01-15 → 2026-01-16");
});

test("a zone conversion is still a zone conversion", () => {
  const r = engine.evaluate("today in tokyo");
  expect(r.kind).toBe("datetime");
});

test("a backwards range throws", () => {
  expect(() => engine.evaluate("tomorrow to today")).toThrow(InvertedRangeError);
});

test("shifting moves both ends", () => {
  expect(engine.evaluate("whole week + 1 wk").formatted).toBe("2026-01-19 → 2026-01-25");
  expect(engine.evaluate("whole week - 1 wk").formatted).toBe("2026-01-05 → 2026-01-11");
});

test("the week start is an option, and Sunday moves both boundaries", () => {
  const sunday = createEngine({
    locales: [composeLocale(coreEn, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, datetime, date, createDateRange({ weekStart: 7 })],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  expect(sunday.evaluate("whole week").formatted).toBe("2026-01-11 → 2026-01-17");
});

test("the +20 is on the signature, and explain() says so", () => {
  // The dial design §4.3 promises has to be visible, or nobody can tell whether
  // the range won on its own merits or on an operand weight somewhere else.
  const [best] = engine.explain("today to friday").assignments;
  expect(best?.kind).toBe("date-range");
  expect(best?.contributions).toContainEqual({
    selector: "signature",
    value: 20,
    layer: 0,
  });
});
