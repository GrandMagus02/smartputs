import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createDatetime, datetime } from "./datetime";
import { createHolidayLiteral, datetimeWithHolidays } from "./holiday";
import { TEST_NOW, TEST_ZONE } from "./temporal";

/**
 * Every date below is resolved against `TEST_NOW` — 2026-01-15 — and nothing
 * here reads the host clock, which is the property that makes a holiday test
 * assertable at all: Easter moves, and the answer to "next easter" is a fact
 * about the pair (clock, country) and not about the day the suite runs.
 */
function engineAt(now: number, opts: Parameters<typeof datetimeWithHolidays>[0] = {}) {
  return createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, datetimeWithHolidays(opts)],
    now: () => now,
    timeZone: TEST_ZONE,
  });
}

/** No place: the `"US"` default-country ruling in action. */
const us = engineAt(TEST_NOW);

/**
 * The Netherlands is the one place in the shipped data with all three of
 * `public`, `bank` and `school`, so the nameless half of the grammar can be
 * tested against one country instead of three. The United States has no `bank`
 * holiday and no `school` holiday at all.
 */
const nl = engineAt(TEST_NOW, { place: { country: "NL" } });

const on = (engine: ReturnType<typeof engineAt>, input: string) =>
  engine.evaluate(input).formatted;

test("the worked-examples table, named subjects", () => {
  expect(on(us, "christmas")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "next easter")).toBe("2026-04-05 00:00 UTC");
  expect(on(us, "last christmas")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "this easter")).toBe("2026-04-05 00:00 UTC");
  expect(on(us, "day before christmas")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "2 days after easter")).toBe("2026-04-07 00:00 UTC");
  expect(on(us, "3 weeks before christmas")).toBe("2025-12-04 00:00 UTC");
  expect(on(us, "chrismas")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "next chrismas")).toBe("2026-12-25 00:00 UTC");
});

test("the worked-examples table, nameless subjects", () => {
  expect(on(nl, "closest holiday")).toBe("2026-01-01 00:00 UTC");
  expect(on(nl, "closest public holiday")).toBe("2026-01-01 00:00 UTC");
  expect(on(nl, "closest bank holiday")).toBe("2025-12-31 00:00 UTC");
  expect(on(nl, "nearest school holiday")).toBe("2026-04-03 00:00 UTC");
  expect(on(nl, "next public holiday")).toBe("2026-04-05 00:00 UTC");
  expect(on(nl, "last bank holiday")).toBe("2025-12-31 00:00 UTC");
  expect(on(nl, "holiday")).toBe("2026-01-01 00:00 UTC");
  expect(on(nl, "day before next public holiday")).toBe("2026-04-04 00:00 UTC");
});

test("a bare holiday means the closest one, and the default country is the US", () => {
  // Martin Luther King Jr. Day, four days out. New Year's Day is fourteen back.
  expect(on(us, "holiday")).toBe("2026-01-19 00:00 UTC");
  expect(on(us, "closest holiday")).toBe(on(us, "holiday"));
  expect(on(us, "holidays")).toBe(on(us, "holiday"));
});

/**
 * The half of the grammar that is easiest to get wrong: "closest" is not a
 * synonym for "next". On the 20th the nearest holiday is yesterday's.
 */
test("closest reaches backwards where next does not", () => {
  const after = engineAt(Date.UTC(2026, 0, 20));
  expect(on(after, "closest holiday")).toBe("2026-01-19 00:00 UTC");
  expect(on(after, "nearest holiday")).toBe("2026-01-19 00:00 UTC");
  expect(on(after, "next holiday")).toBe("2026-02-16 00:00 UTC");
  expect(on(after, "last holiday")).toBe("2026-01-19 00:00 UTC");
});

test("next and last are strict, in both directions, on a named subject", () => {
  expect(on(us, "next christmas")).toBe("2026-12-25 00:00 UTC");
  expect(on(us, "last christmas")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "next easter")).toBe("2026-04-05 00:00 UTC");
  expect(on(us, "last easter")).toBe("2025-04-20 00:00 UTC");
});

test("this takes the occurrence in the clock's own calendar year", () => {
  expect(on(us, "this christmas")).toBe("2026-12-25 00:00 UTC");
  expect(on(us, "this easter")).toBe("2026-04-05 00:00 UTC");
  // Which is not the closest one: Christmas 2025 is three weeks behind.
  expect(on(us, "closest christmas")).toBe("2025-12-25 00:00 UTC");
});

test("the offset grammar composes with the type grammar", () => {
  // The plan's last row, and the ruling it left open: supported, not refused.
  expect(on(us, "day before next public holiday")).toBe("2026-01-18 00:00 UTC");
  expect(on(us, "2 days after next public holiday")).toBe("2026-01-21 00:00 UTC");
  expect(on(us, "a week after last public holiday")).toBe("2026-01-08 00:00 UTC");
});

test("count is optional, spelled, or a numeral", () => {
  expect(on(us, "day before christmas")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "a day before christmas")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "1 day before christmas")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "an week after christmas")).toBe("2026-01-01 00:00 UTC");
});

test("every duration word shifts through the calendar", () => {
  expect(on(us, "2 days after christmas")).toBe("2025-12-27 00:00 UTC");
  expect(on(us, "2 weeks after christmas")).toBe("2026-01-08 00:00 UTC");
  expect(on(us, "2 months after christmas")).toBe("2026-02-25 00:00 UTC");
  expect(on(us, "2 years after christmas")).toBe("2027-12-25 00:00 UTC");
  expect(on(us, "2 months before christmas")).toBe("2025-10-25 00:00 UTC");
});

/**
 * "next" in "next easter" must not be left stranded as a bare word, which is
 * what happens if the subject is claimed before the offset that governs it.
 */
test("the longest offset prefix wins", () => {
  expect(us.evaluate("next easter").value.meta?.iso).toBe(
    "2026-04-05T00:00:00+00:00[UTC]",
  );
  // Longest name run too: "christmas day" pins the 25th where bare "christmas"
  // is one token short of distinguishing it from Christmas Eve.
  expect(on(us, "christmas day")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "xmas day")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "christmas eve")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "new year's day")).toBe("2026-01-01 00:00 UTC");
});

test("one reading, and not a conversion target", () => {
  // `dateLiteral`'s rule, unchanged: a date resolves to one instant, so a claim
  // that ranked six occurrences above `minScore` still hands back exactly one
  // and the solver has nothing to be ambiguous about.
  expect(us.evaluate("christmas").confidence).toBe(1);
  // "3pm in christmas" is not a conversion, so the claim is not `targetable`
  // and the `in` target stays the unit-parse error it always was.
  expect(() => us.evaluate("3pm in christmas")).toThrow(/christmas/);
});

test("the claim is midnight in the engine's zone, not a converted instant", () => {
  const tokyo = createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, datetimeWithHolidays()],
    now: () => TEST_NOW,
    timeZone: "Asia/Tokyo",
  });
  // `@smartput/holiday` anchors `start` to UTC midnight of the local calendar
  // date; converting that instant would render Christmas as the 24th at 09:00.
  expect(tokyo.evaluate("christmas").value.meta?.iso).toBe(
    "2025-12-25T00:00:00+09:00[Asia/Tokyo]",
  );
  expect(tokyo.evaluate("christmas").formatted).toBe("2025-12-25 00:00 JST");
});

test("a holiday is a datetime and takes datetime arithmetic", () => {
  expect(on(us, "christmas + 3 d")).toBe("2025-12-28 00:00 UTC");
  expect(on(us, "christmas in tokyo")).toBe("2025-12-25 09:00 JST");
  expect(us.evaluate("today - christmas").formatted).toBe("3 weeks");
});

test("the type filter excludes and never widens", () => {
  // The United States has no `bank` holiday, and `findHoliday` says so by
  // answering nothing rather than by dropping the filter.
  expect(() => us.evaluate("closest bank holiday")).toThrow();
  expect(() => us.evaluate("nearest school holiday")).toThrow();
});

test("a place is one argument, and it changes the answer", () => {
  const gb = engineAt(TEST_NOW, { place: { country: "GB" } });
  expect(on(gb, "boxing day")).toBe("2025-12-26 00:00 UTC");
  expect(on(gb, "closest holiday")).toBe("2026-01-01 00:00 UTC");
  // Same phrase, different place, different date: Liberation Day is Dutch.
  expect(on(nl, "liberation day")).toBe("2026-05-05 00:00 UTC");
  expect(() => us.evaluate("liberation day")).toThrow();
});

test("defaultCountry moves the default without naming a state", () => {
  const dutch = engineAt(TEST_NOW, { defaultCountry: "NL" });
  expect(on(dutch, "closest bank holiday")).toBe("2025-12-31 00:00 UTC");
});

test("an unresolvable selector is refused, not widened", () => {
  // The lieu day for Christmas falls only in 2027 across the whole three-year
  // window, so it has a "closest" and no "last" at all. Answering the former
  // for the latter would be a wrong date, which is the failure that matters.
  expect(on(us, "christmas day substitute")).toBe("2027-12-24 00:00 UTC");
  expect(() => us.evaluate("last christmas day substitute")).toThrow();
});

test("phrases outside the grammar are refused cleanly", () => {
  // `durationWord` stops at a day; an hour is not a calendar unit.
  expect(() => us.evaluate("an hour before christmas")).toThrow();
  // A shift with no subject, and a selector with no subject.
  expect(() => us.evaluate("day before")).toThrow();
  expect(() => us.evaluate("next")).toThrow();
  expect(() => us.evaluate("closest")).toThrow();
  // A count `Temporal` cannot honour is refused rather than thrown out of.
  expect(() => us.evaluate("99999 days after christmas")).toThrow();
  // And a name nothing is near.
  expect(() => us.evaluate("quxfest")).toThrow();
});

/**
 * The two guards that stop a fuzzy name matcher from eating readings that were
 * already right. Both failures were real before they went in.
 */
test("a unit alias is never a holiday name", () => {
  // "days" scores 0.75 against "Christmas Day" and "year" 0.70 against
  // "New Year's Day"; the fold is destructive, so claiming either would delete
  // the duration arithmetic before the solver ran.
  expect(on(us, "3 days + 2 days")).toBe("5 days");
  expect(us.evaluate("3 days + 2 days").kind).toBe("duration");
  expect(on(us, "30 hours - 10 minutes")).toBe("29.833333333333333333333333 hours");
});

test("the date literal keeps every span it can read on its own", () => {
  const gb = engineAt(TEST_NOW, { place: { country: "GB" } });
  // "may" is 0.663 from "Christmas Day" and "monday" 0.833 from "Easter
  // Monday"; both used to reach the solver beside chrono's reading and turn an
  // answer into an AmbiguityError.
  expect(on(us, "may")).toBe("2026-05-01 00:00 UTC");
  expect(on(gb, "monday")).toBe("2026-01-12 00:00 UTC");
  expect(on(gb, "next monday")).toBe("2026-01-19 00:00 UTC");
  expect(on(gb, "friday")).toBe("2026-01-16 00:00 UTC");
  expect(on(us, "june")).toBe("2026-06-01 00:00 UTC");
});

/**
 * Every test above stands in UTC, where a holiday's UTC-anchored `start` and the
 * instant its day begins are the same number — which is exactly why the bug
 * below survived them. `TEST_ZONE` is the one zone in which the two agree.
 */
function engineIn(zone: string, now: number, place?: { country: string }) {
  return createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, datetimeWithHolidays(place === undefined ? {} : { place })],
    now: () => now,
    timeZone: zone,
  });
}

/**
 * The selectors compare a holiday against `now`, and `start` is not an instant:
 * it is UTC midnight of the calendar date. West of Greenwich that lands up to
 * 14 h before the day begins locally, so comparing it raw declared a holiday
 * past before it had happened. The default country is one of those places.
 */
test("next and last read the holiday in the engine's zone, not in UTC", () => {
  // 20:00 on New Year's Eve in New York. `tomorrow` says which day it is.
  const ny = engineIn("America/New_York", Date.UTC(2026, 0, 1, 1, 0));
  expect(on(ny, "tomorrow")).toBe("2026-01-01 00:00 ET");
  // Was 2026-01-19 (Martin Luther King Jr. Day), skipping the holiday that is
  // literally tomorrow, because New Year's `start` reads 01-01T00:00Z and
  // `now` is 01-01T01:00Z.
  expect(on(ny, "next holiday")).toBe("2026-01-01 00:00 ET");
  // And "last" answered 2026-01-01 — a date in the future.
  expect(on(ny, "last holiday")).toBe("2025-12-25 00:00 ET");
  expect(on(ny, "next christmas")).toBe("2026-12-25 00:00 ET");

  // Three more hours of offset, same failure: 19:00 on the 31st in California.
  const la = engineIn("America/Los_Angeles", Date.UTC(2026, 0, 1, 3, 0));
  expect(on(la, "tomorrow")).toBe("2026-01-01 00:00 PT");
  expect(on(la, "next holiday")).toBe("2026-01-01 00:00 PT");
  expect(on(la, "last holiday")).toBe("2025-12-25 00:00 PT");
});

test("closest measures its distance in the engine's zone too", () => {
  // 09:00 on 2025-12-28 in New York: Christmas is 3 d 9 h back and New Year's
  // Day 3 d 15 h out. Against the UTC anchors the two swap places, and
  // "closest holiday" answered with the further one.
  const between = engineIn("America/New_York", Date.UTC(2025, 11, 28, 14, 0));
  expect(on(between, "closest holiday")).toBe("2025-12-25 00:00 ET");
  expect(on(between, "nearest holiday")).toBe("2025-12-25 00:00 ET");
  expect(on(between, "holiday")).toBe("2025-12-25 00:00 ET");
});

/**
 * `MIN_NAME_LENGTH` gated the run, not the words, so a two-word run only had to
 * be short in one of them. The score is an average over the name: "day" landing
 * exactly carries whatever stands in front of it.
 */
test("a short word must be in the name, not an edit away from it", () => {
  // All four scored 0.715-0.765 against "Christmas Day" and all four answered
  // with Christmas.
  for (const junk of ["may day", "pay day", "may days", "dry day"]) {
    expect(() => us.evaluate(junk)).toThrow();
  }
  // The worst of it: Britain has a May holiday in the data, and "may day" still
  // answered Boxing Day (0.765) because "Early May bank holiday" scores lower.
  // Refused rather than answered — the data has no name this phrase matches,
  // and picking the closest thing to it is how the wrong date got out.
  const gb = engineAt(TEST_NOW, { place: { country: "GB" } });
  expect(() => gb.evaluate("may day")).toThrow();
  // Short words that are really in the name keep working, which is what stops
  // the fix from being a second length gate.
  expect(on(us, "christmas day")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "new year's day")).toBe("2026-01-01 00:00 UTC");
  expect(on(us, "christmas eve")).toBe("2025-12-24 00:00 UTC");
  expect(on(us, "xmas day")).toBe("2025-12-25 00:00 UTC");
  expect(on(us, "christmas day substitute")).toBe("2027-12-24 00:00 UTC");
  // And a long word keeps its typo tolerance.
  expect(on(us, "chrismas")).toBe("2025-12-25 00:00 UTC");
});

/**
 * The ruling on bare "year": not a holiday. It scores 0.70 against "New Year's
 * Day" and the accept-gate never stopped it — this repo has no `year` duration
 * unit, so `isUnitAlias("year")` is false — which meant `datetimeWithHolidays()`
 * answered a string plain `datetime` refuses, and answered "year + 1 day" with
 * the 2nd of January.
 */
test("a bare duration word is a duration, never a holiday name", () => {
  const plain = createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, datetime],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  for (const input of ["year", "years", "year + 1 day"]) {
    expect(() => us.evaluate(input)).toThrow();
    expect(() => plain.evaluate(input)).toThrow();
  }
  // Still a shift word where the grammar puts one, and still a duration where
  // the unit exists.
  expect(on(us, "2 years after christmas")).toBe("2027-12-25 00:00 UTC");
  expect(on(us, "3 days + 2 days")).toBe("5 days");
});

/**
 * The refactor's contract: `createDatetime()` with no extra matchers is the
 * `datetime` every consumer already had, and adding one changes nothing that
 * does not name a holiday.
 */
test("the holiday kind is the datetime kind everywhere else", () => {
  const plain = createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, datetime],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  for (const input of [
    "today",
    "today + 3 d",
    "3 d + today",
    "today - 1 wk",
    "2026-01-18 - today",
    "3pm in tokyo",
    "next friday",
    "next week monday",
    "30 hours - 10 minutes",
    "10 km + 5 km",
    "3pm gmt+3",
    "tomorrow",
    "december",
  ]) {
    expect([input, on(us, input)]).toEqual([input, plain.evaluate(input).formatted]);
  }
});

test("the matcher can be installed by hand through createDatetime", () => {
  const byHand = createEngine({
    locales: [en],
    kinds: [
      ...BUILTIN_KINDS,
      createDatetime({ literals: [createHolidayLiteral({ place: { country: "NL" } })] }),
    ],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  expect(byHand.evaluate("closest bank holiday").formatted).toBe("2025-12-31 00:00 UTC");
  expect(byHand.evaluate("today").formatted).toBe("2026-01-15 00:00 UTC");
});
