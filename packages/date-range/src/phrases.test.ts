import { describe, expect, test } from "bun:test";
import { Temporal } from "@smartput/datetime";
import { PHRASES, phraseAt, spanFor } from "./phrases";

const at = (iso: string) => Temporal.ZonedDateTime.from(iso);

describe("phraseAt", () => {
  test("takes the longest phrase, not the first", () => {
    // "this year" and "year" both match at 0, and only one of them is what the
    // user typed. The fold never sees the loser: `phraseAt` returns one reading.
    expect(phraseAt("this year", 0)?.text).toBe("this year");
    expect(phraseAt("next week", 0)?.text).toBe("next week");
  });

  test("is case-insensitive and offset-anchored", () => {
    expect(phraseAt("Whole Month", 0)?.text).toBe("whole month");
    expect(phraseAt("in whole month", 3)?.text).toBe("whole month");
    expect(phraseAt("in whole month", 0)).toBeNull();
  });

  test("claims nothing it has no row for", () => {
    for (const input of ["week", "month", "day", "fortnight", "yearly"]) {
      const hit = phraseAt(input, 0);
      // "yearly" starts with "year", so the guard is that no *bare* duration
      // word is a row — not that nothing ever matches a prefix.
      if (input === "yearly") expect(hit?.text).toBe("year");
      else expect(hit).toBeNull();
    }
  });

  test("every row is reachable by its own text", () => {
    for (const phrase of PHRASES) {
      expect(phraseAt(phrase.text, 0)?.text).toBe(phrase.text);
    }
  });
});

describe("spanFor", () => {
  const thursday = at("2026-01-15T12:00:00+00:00[UTC]");

  test("the week is Monday to the next Monday, exclusive", () => {
    const span = spanFor({ unit: "week", offset: 0 }, thursday);
    expect(span.start.toPlainDate().toString()).toBe("2026-01-12");
    expect(span.end.toPlainDate().toString()).toBe("2026-01-19");
  });

  test("the week start is an option", () => {
    const span = spanFor({ unit: "week", offset: 0 }, thursday, { weekStart: 7 });
    expect(span.start.toPlainDate().toString()).toBe("2026-01-11");
    expect(span.end.toPlainDate().toString()).toBe("2026-01-18");
  });

  test("the shift happens before the snap, so month ends do not spill", () => {
    // From the 31st, `add({ months: 1 })` clamps to the 28th and the snap then
    // takes February. Snapping first and shifting second would give March.
    const spilling = at("2026-01-31T12:00:00+00:00[UTC]");
    const span = spanFor({ unit: "month", offset: 1 }, spilling);
    expect(span.start.toPlainDate().toString()).toBe("2026-02-01");
    expect(span.end.toPlainDate().toString()).toBe("2026-03-01");
  });

  test("a leap February ends on March 1st all the same", () => {
    const leap = at("2024-02-10T12:00:00+00:00[UTC]");
    const span = spanFor({ unit: "month", offset: 0 }, leap);
    expect(span.start.toPlainDate().toString()).toBe("2024-02-01");
    expect(span.end.toPlainDate().toString()).toBe("2024-03-01");
  });

  test("a year crosses into the next one", () => {
    const span = spanFor({ unit: "year", offset: 1 }, thursday);
    expect(span.start.toPlainDate().toString()).toBe("2027-01-01");
    expect(span.end.toPlainDate().toString()).toBe("2028-01-01");
  });

  test("a day is midnight to the next midnight, in the zone's own reckoning", () => {
    // Santiago springs forward at 00:00 on 2026-09-06, so the day begins at
    // 01:00 there. `startOfDay()` asks the zone; `with({ hour: 0 })` would name
    // an instant that does not exist.
    const santiago = at("2026-09-06T12:00:00-03:00[America/Santiago]");
    const span = spanFor({ unit: "day", offset: 0 }, santiago);
    expect(span.start.toPlainTime().toString()).toBe("01:00:00");
    expect(span.end.toPlainDate().toString()).toBe("2026-09-07");
  });

  test("every span runs forwards", () => {
    for (const phrase of PHRASES) {
      const span = spanFor(phrase, thursday);
      expect(Temporal.ZonedDateTime.compare(span.end, span.start)).toBeGreaterThan(0);
    }
  });
});
