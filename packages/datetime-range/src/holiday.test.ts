import { expect, test } from "bun:test";
import { composeLocale, createEngine, type Kind, UnitParseError } from "@smartput/core";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as coreEn } from "@smartput/locale-en";
import { time } from "@smartput/time";
import { datetimeRange } from "./datetime-range";
import { createDatetimeRangeHoliday, datetimeRangeHoliday } from "./holiday";

/**
 * Every date below is resolved against `TEST_NOW` — 2026-01-15 in `UTC` — the
 * way `@smartput/datetime`'s holiday suite does, and for the same reason: the
 * answer to "closest holiday" is a fact about the pair (clock, country), not
 * about the day the suite happens to run.
 */
function engineWith(range: Kind) {
  return createEngine({
    locales: [composeLocale(coreEn, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, datetime, date, time, range],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
}

const engine = engineWith(datetimeRangeHoliday);

/**
 * The default country is `"US"` (`@smartput/holiday`'s `DEFAULT_COUNTRY`), so
 * the closest public holiday to 2026-01-15 is Martin Luther King Jr. Day on the
 * 19th — four days ahead, against New Year's Day fourteen days behind.
 */
test("from today to closest holiday", () => {
  const r = engine.evaluate("from today to closest holiday");
  expect(r.kind).toBe("datetime-range");
  expect(r.value.meta?.start).toStartWith("2026-01-15");
  expect(r.formatted).toBe("2026-01-15 00:00 → 2026-01-19 00:00 UTC");
});

/** The bridge's offset grammar comes across whole, shift and selector both. */
test("a shifted holiday closes a range", () => {
  expect(engine.evaluate("from today to day before next christmas").formatted).toBe(
    "2026-01-15 00:00 → 2026-12-24 00:00 UTC",
  );
});

/**
 * A holiday may open a range as well as close one — which is also the test that
 * the *whole* left segment is consumed: `fromToAt` refuses a start that read
 * only part of what it was handed, so a holiday claim one character short here
 * would take the phrase down rather than shift it.
 */
test("a holiday opens a range", () => {
  expect(engine.evaluate("from next christmas to next new years day").formatted).toBe(
    "2026-12-25 00:00 → 2027-01-01 00:00 UTC",
  );
});

/**
 * The plan's row here was `from tomorrow to friday`, which `datetime-range.test`
 * already pins as an `InvertedRangeError`: `TEST_NOW` is a Thursday, so both
 * ends land on 2026-01-16. `from today to friday` is a corpus row and tests the
 * same thing — the datetime endpoint still runs, and runs first.
 */
test("a plain range still works through the same kind", () => {
  expect(engine.evaluate("from today to friday").kind).toBe("datetime-range");
});

/** The window grammar is untouched: this kind is a drop-in for the root one. */
test("the window phrases survive the swap", () => {
  expect(engine.evaluate("yesterday morning").formatted).toBe(
    "2026-01-14 06:00 → 2026-01-14 12:00 UTC",
  );
});

/**
 * The subpath is the *route*, not an optimisation of one — design §5.3. Without
 * it the right-hand segment resolves to nothing, `fromToAt` declines the whole
 * phrase, and the engine is left with a string it cannot read.
 */
test("the root kind cannot close a range on a holiday", () => {
  expect(() =>
    engineWith(datetimeRange).evaluate("from today to closest holiday"),
  ).toThrow(UnitParseError);
});

/** `place` reaches the bridge: Boxing Day is a holiday in Britain and not in the US. */
test("the place option reaches the holiday grammar", () => {
  const gb = engineWith(
    createDatetimeRangeHoliday({ place: { country: "GB", state: "ENG" } }),
  );
  expect(gb.evaluate("from today to next boxing day").formatted).toBe(
    "2026-01-15 00:00 → 2026-12-26 00:00 UTC",
  );
  expect(() => engine.evaluate("from today to next boxing day")).toThrow(UnitParseError);
});
