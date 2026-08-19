import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { ordinalWeekAt } from "./ordinal-week";

// The clock is 2026-01-15T12:00:00Z, a Thursday, and the engine zone is UTC.
const ctx: MatchCtx = {
  locale: "en",
  now: TEST_NOW,
  timeZone: TEST_ZONE,
  isUnitAlias: () => false,
};

const span = (input: string, offset = 0, opts = {}) => {
  const match = ordinalWeekAt(input, offset, ctx, opts);
  if (match === null) return null;
  // Inclusive at both ends, the way `formatRange` displays a span.
  const to = match.span.end.subtract({ days: 1 });
  return `${match.span.start.toPlainDate()} → ${to.toPlainDate()}`;
};

test("second week Aug 2027 is the week of the second Monday", () => {
  // 2027-08-01 is a Sunday, so Mondays fall on the 2nd, 9th, 16th…
  expect(span("second week Aug 2027")).toBe("2027-08-09 → 2027-08-15");
});

test("the connector is optional and either word", () => {
  expect(span("second week of Aug 2027")).toBe("2027-08-09 → 2027-08-15");
  expect(span("second week in Aug 2027")).toBe("2027-08-09 → 2027-08-15");
  expect(span("2nd week Aug 2027")).toBe("2027-08-09 → 2027-08-15");
});

test("a month opening mid-week starts its first week on the next Monday", () => {
  expect(span("first week Aug 2027")).toBe("2027-08-02 → 2027-08-08");
});

test("the last week of a month may end in the next one", () => {
  // Mondays in August 2027 are the 2nd, 9th, 16th, 23rd and 30th.
  expect(span("last week of Aug 2027")).toBe("2027-08-30 → 2027-09-05");
});

test("a relative month scope works the same way", () => {
  // 2026-02-01 is a Sunday; the first Monday of February is the 2nd.
  expect(span("first week of next month")).toBe("2026-02-02 → 2026-02-08");
  expect(span("third week next month")).toBe("2026-02-16 → 2026-02-22");
});

test("an unscoped ordinal counts inside the month the clock is in", () => {
  // 2026-01-01 is a Thursday, so January's first Monday is the 5th.
  expect(span("first week")).toBe("2026-01-05 → 2026-01-11");
});

test("bare `last week` is left to the phrase table", () => {
  expect(ordinalWeekAt("last week", 0, ctx)).toBeNull();
});

test("a month with no fifth week claims nothing", () => {
  // February 2026 has four Mondays: the 2nd, 9th, 16th and 23rd.
  expect(ordinalWeekAt("fifth week of next month", 0, ctx)).toBeNull();
});

test("weekStart moves the whole grid", () => {
  // Sunday weeks: August 2027 opens on a Sunday, so its first week is the 1st.
  expect(span("second week Aug 2027", 0, { weekStart: 7 })).toBe(
    "2027-08-08 → 2027-08-14",
  );
});

test("the claim covers exactly the phrase", () => {
  expect(ordinalWeekAt("second week Aug 2027", 0, ctx)?.length).toBe(20);
  expect(ordinalWeekAt("second week Aug 2027 + 1 wk", 0, ctx)?.length).toBe(20);
});

test("the offset is honoured", () => {
  expect(span("1 wk + second week Aug 2027", 7)).toBe("2027-08-09 → 2027-08-15");
  expect(ordinalWeekAt("1 wk + second week Aug 2027", 0, ctx)).toBeNull();
});
