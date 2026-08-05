import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { accepts, parseDateTime } from "./chrono-bridge";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const UNIT_ALIASES = new Set([
  "m",
  "min",
  "h",
  "d",
  "wk",
  "s",
  "km",
  "kg",
  "week",
  "day",
]);

const ctx: MatchCtx = {
  locale: "en",
  now: TEST_NOW,
  timeZone: TEST_ZONE,
  isUnitAlias: (s) => UNIT_ALIASES.has(s),
};

const iso = (input: string, offset = 0) =>
  parseDateTime(input, offset, ctx)?.zdt.toString() ?? null;

test("today resolves against the injected clock at midnight", () => {
  expect(iso("today")).toBe("2026-01-15T00:00:00+00:00[UTC]");
});

test("tomorrow is the next day", () => {
  expect(iso("tomorrow")).toBe("2026-01-16T00:00:00+00:00[UTC]");
});

test("a clock time keeps today's date", () => {
  expect(iso("3pm")).toBe("2026-01-15T15:00:00+00:00[UTC]");
});

test("an ISO date parses with no letters at all", () => {
  expect(iso("2026-03-01")).toBe("2026-03-01T00:00:00+00:00[UTC]");
});

test("next week monday resolves forward", () => {
  // 2026-01-15 is a Thursday; the Monday of the following week is 2026-01-19.
  expect(iso("next week monday")).toBe("2026-01-19T00:00:00+00:00[UTC]");
});

test("the reported length covers exactly the matched text", () => {
  expect(parseDateTime("today + 5 h", 0, ctx)?.length).toBe(5);
});

test("a match must start at the offset", () => {
  expect(parseDateTime("5 h + today", 0, ctx)).toBeNull();
});

test("the offset is honoured", () => {
  expect(iso("5 h + today", 6)).toBe("2026-01-15T00:00:00+00:00[UTC]");
});

test("the time zone is the one on the context", () => {
  // 12:00Z is 21:00 the same day in Tokyo, so "today" is still the 15th — but
  // the offset and the zone label are the context's, not the host's.
  expect(
    parseDateTime("today", 0, { ...ctx, timeZone: "Asia/Tokyo" })?.zdt.toString(),
  ).toBe("2026-01-15T00:00:00+09:00[Asia/Tokyo]");
});

test("the time zone decides which day 'today' is", () => {
  // 16:00Z is already the 16th in Tokyo and still the 15th in UTC.
  const late = { ...ctx, now: TEST_NOW + 4 * 3_600_000 };
  expect(parseDateTime("today", 0, late)?.zdt.toString()).toBe(
    "2026-01-15T00:00:00+00:00[UTC]",
  );
  expect(
    parseDateTime("today", 0, { ...late, timeZone: "Asia/Tokyo" })?.zdt.toString(),
  ).toBe("2026-01-16T00:00:00+09:00[Asia/Tokyo]");
});

test("a run whose letters are all unit aliases is refused", () => {
  expect(accepts("10 m", ctx.isUnitAlias)).toBe(false);
  expect(accepts("5 min", ctx.isUnitAlias)).toBe(false);
  expect(accepts("2 weeks", ctx.isUnitAlias)).toBe(false);
});

test("a run with one non-unit word is accepted", () => {
  expect(accepts("next week monday", ctx.isUnitAlias)).toBe(true);
  expect(accepts("3pm", ctx.isUnitAlias)).toBe(true);
  expect(accepts("in 3 days", ctx.isUnitAlias)).toBe(true);
});

test("a letterless run is accepted only when it is ISO-shaped", () => {
  expect(accepts("2026-03-01", ctx.isUnitAlias)).toBe(true);
  expect(accepts("10:30", ctx.isUnitAlias)).toBe(true);
  expect(accepts("2026", ctx.isUnitAlias)).toBe(false);
  expect(accepts("5 + 3", ctx.isUnitAlias)).toBe(false);
});

test("a duration expression is never claimed as a date", () => {
  expect(
    parseDateTime("30 hours", 0, { ...ctx, isUnitAlias: (s) => s === "hours" }),
  ).toBeNull();
});

test("the gate strips regular plurals, because the alias index holds singulars", () => {
  // core indexes "hour" and recovers "hours" with an analyzer at resolve time,
  // so the gate has to do the stripping itself or "30 hours - 10 minutes"
  // stops being duration arithmetic.
  const singular = (s: string) => ["hour", "minute", "week"].includes(s);
  expect(accepts("30 hours", singular)).toBe(false);
  expect(accepts("10 minutes", singular)).toBe(false);
  expect(accepts("2 weeks", singular)).toBe(false);
  expect(accepts("3 days ago", singular)).toBe(true);
});

test("an arithmetic tail is left for the parser", () => {
  // chrono reads "today + 5 h" as one relative date-and-time; claiming it would
  // erase the `datetime + duration` reading the whole plugin exists for.
  expect(parseDateTime("2026-03-01 - today", 0, ctx)?.length).toBe(10);
  expect(parseDateTime("3pm * 2", 0, ctx)?.length).toBe(3);
  expect(iso("today + 5 h")).toBe("2026-01-15T00:00:00+00:00[UTC]");
});

test("an unspaced + or * still ends the date", () => {
  // chrono claims "today+3d" whole, and a length that lands mid-token makes the
  // fold discard the match — leaving a bare word the parser cannot read at all.
  expect(parseDateTime("today+3d", 0, ctx)?.length).toBe(5);
  expect(parseDateTime("3pm*2", 0, ctx)?.length).toBe(3);
});

test("an unspaced / does not end the date, so a division tail still cuts", () => {
  // `/` is deliberately spaced-only, unlike `+` and `*`: it separates the parts
  // of a slash date. Such a date is refused anyway — the letterless gate admits
  // only ISO shapes, because "10/2" is division and "1/15" is locale-order
  // guesswork (recorded in m4-followups.md) — but the cut must not be what
  // decides that, or adding slash dates later would mean re-deriving this rule.
  expect(parseDateTime("1/15/2026", 0, ctx)).toBeNull();
  expect(parseDateTime("2026-03-01 / 2", 0, ctx)?.length).toBe(10);
});

test("a weekday after a week phrase picks the day inside that week", () => {
  expect(parseDateTime("next week monday", 0, ctx)?.length).toBe(16);
  // 2026-01-15 is a Thursday, so last week runs 2026-01-05..11.
  expect(iso("last week friday")).toBe("2026-01-09T00:00:00+00:00[UTC]");
});
