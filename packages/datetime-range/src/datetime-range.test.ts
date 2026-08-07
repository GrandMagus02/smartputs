import { expect, test } from "bun:test";
import {
  AmbiguityError,
  composeLocale,
  createEngine,
  UnitParseError,
} from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { InvertedRangeError } from "@smartput/range-core";
import { time } from "@smartput/time";
import { createDatetimeRange, datetimeRange } from "./datetime-range";

const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime, date, time, datetimeRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a date word plus a window is a datetime range", () => {
  const r = engine.evaluate("yesterday morning");
  expect(r.kind).toBe("datetime-range");
  expect(r.formatted).toBe("2026-01-14 06:00 → 2026-01-14 12:00 UTC");
});

test("next morning is tomorrow morning", () => {
  expect(engine.evaluate("next morning").formatted).toBe(
    "2026-01-16 06:00 → 2026-01-16 12:00 UTC",
  );
});

test("a window that wraps midnight ends on the following day", () => {
  expect(engine.evaluate("tomorrow night").formatted).toBe(
    "2026-01-16 22:00 → 2026-01-17 06:00 UTC",
  );
});

test("tonight is today's night window, and it wraps", () => {
  expect(engine.evaluate("tonight").formatted).toBe(
    "2026-01-15 22:00 → 2026-01-16 06:00 UTC",
  );
});

/**
 * `next` is a day word and `day` is a window name, so the two tables collide on
 * an input people really type. "next day" is tomorrow, which is what chrono
 * already says, so the matcher refuses the pair rather than claiming 06:00 to
 * 22:00 of it.
 */
test("next day is tomorrow, not tomorrow's daylight window", () => {
  expect(engine.evaluate("next day").kind).toBe("datetime");
});

test("from X to Y claims its whole span", () => {
  const r = engine.evaluate("from today to friday");
  expect(r.kind).toBe("datetime-range");
  expect(r.formatted).toBe("2026-01-15 00:00 → 2026-01-16 00:00 UTC");
});

test("`until` closes a `from` as well as `to` does", () => {
  expect(engine.evaluate("from today until friday").formatted).toBe(
    "2026-01-15 00:00 → 2026-01-16 00:00 UTC",
  );
});

test("until Y starts now", () => {
  const r = engine.evaluate("until 20:00");
  expect(r.kind).toBe("datetime-range");
  expect(r.formatted).toBe("2026-01-15 12:00 → 2026-01-15 20:00 UTC");
});

test("until yesterday is inverted and throws", () => {
  expect(() => engine.evaluate("until yesterday")).toThrow(InvertedRangeError);
});

/**
 * The §6 error-table row is `from tomorrow to present`, but chrono reads no
 * date at all in "present" (verified against chrono-node directly), so the
 * matcher declines the phrase rather than inverting on it. `now` is the reading
 * chrono does have for the same idea, and it is what the corpus uses too.
 */
test("from tomorrow to now is inverted and throws", () => {
  expect(() => engine.evaluate("from tomorrow to now")).toThrow(InvertedRangeError);
});

/**
 * Both ends land on 2026-01-16T00:00 — Friday *is* tomorrow against the fixed
 * Thursday clock — and an empty span is a mistake in every phrase that can
 * produce one, so the strict `assertOrdered` rejects it.
 */
test("a zero-length span throws too", () => {
  expect(() => engine.evaluate("from tomorrow to friday")).toThrow(InvertedRangeError);
});

/**
 * The design says an incomplete range "is not an error, it is not a range" —
 * the matcher declines, `from` falls through as an ordinary word and `X` keeps
 * whatever reading it had. The first half holds: `fromToAt` returns null and
 * no `datetime-range` is claimed. The second half is not core's behaviour and
 * is not this package's to change. Core's pratt parser does not skip an
 * unrecognised leading word for *anything* — `about tomorrow` and `blah 3 m`
 * throw the same `UnitParseError` — so what a declining matcher leaves behind
 * is that error, not a bare datetime. Pinned here so the difference is
 * recorded rather than rediscovered.
 */
test("a bare `from X` is not claimed as a range", () => {
  expect(() => engine.evaluate("from tomorrow")).toThrow(UnitParseError);
  expect(() => engine.evaluate("from tomorrow")).not.toThrow(InvertedRangeError);
});

test("`from X to <nothing readable>` is not claimed either", () => {
  expect(() => engine.evaluate("from tomorrow to tokyo")).toThrow(UnitParseError);
});

test("the window table is overridable per engine", () => {
  const nightOwl = createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [
      ...BUILTIN_KINDS,
      datetime,
      date,
      time,
      createDatetimeRange({ windows: { morning: { start: 4, end: 9, wraps: false } } }),
    ],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  expect(nightOwl.evaluate("yesterday morning").formatted).toBe(
    "2026-01-14 04:00 → 2026-01-14 09:00 UTC",
  );
});

/**
 * Why this kind carries a reading weight at all, pinned rather than argued.
 *
 * chrono reads "yesterday morning" too, as the instant 06:00, and claims the
 * identical span — so the fold carries both readings forward and, at equal
 * weight, the solver has no reason to prefer either. `AmbiguityError` is
 * exactly right about the situation and exactly wrong as an answer, and +20 is
 * what settles it. The `from`/`until` grammar needs none of this: nothing else
 * claims a run beginning with `from`, so it wins at any weight.
 */
test("without the reading weight, a window phrase ties with chrono's instant", () => {
  const flat = createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [...BUILTIN_KINDS, datetime, date, time, createDatetimeRange({ weight: 0 })],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  expect(() => flat.evaluate("yesterday morning")).toThrow(AmbiguityError);
  expect(flat.evaluate("until 20:00").kind).toBe("datetime-range");
});
