import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { Temporal } from "./temporal";
import { addDuration, durationValue, unwrap, wrap } from "./value";

const zdt = Temporal.ZonedDateTime.from("2026-01-15T12:00:00+00:00[UTC]");

test("wrap carries the instant, the zone and the ISO string", () => {
  const v = wrap(zdt);
  expect(v.kind).toBe("datetime");
  expect(v.unit).toBe("UTC");
  expect(v.canonical.toString()).toBe(zdt.epochNanoseconds.toString());
  expect(v.meta).toEqual({ iso: "2026-01-15T12:00:00+00:00[UTC]" });
});

test("wrap then unwrap is the identity", () => {
  expect(unwrap(wrap(zdt)).equals(zdt)).toBe(true);
});

test("the wrapped value is frozen and JSON-serialisable", () => {
  const v = wrap(zdt);
  expect(Object.isFrozen(v)).toBe(true);
  expect(JSON.parse(JSON.stringify(v.meta))).toEqual({
    iso: "2026-01-15T12:00:00+00:00[UTC]",
  });
});

test("durationValue picks the largest unit that reads as at least one", () => {
  const hour = new Decimal(3_600).times(1e9);
  expect(durationValue(hour)).toMatchObject({ kind: "duration", unit: "h" });
  expect(durationValue(hour).canonical.toString()).toBe("3600");
  expect(durationValue(new Decimal(1e9))).toMatchObject({ unit: "s" });
  // 86 400 s is one day; 864 000 s is ten days, which fills a week, so it reads
  // as weeks — the plan's `d` expectation for it was an arithmetic slip.
  expect(durationValue(new Decimal(86_400).times(1e9))).toMatchObject({ unit: "d" });
  expect(durationValue(new Decimal(864_000).times(1e9))).toMatchObject({ unit: "wk" });
  expect(durationValue(new Decimal(0))).toMatchObject({ unit: "s" });
  expect(durationValue(new Decimal(-3_600).times(1e9))).toMatchObject({ unit: "h" });
});

test("a whole day is added as a calendar day, not 86400 seconds", () => {
  // 2026-03-08 is the US DST transition; 00:00 + 1 calendar day is 00:00 again,
  // while 86400 exact seconds would land on 01:00.
  const ny = Temporal.ZonedDateTime.from("2026-03-08T00:00:00-05:00[America/New_York]");
  const day = { kind: "duration", canonical: new Decimal(86_400), unit: "d" };
  expect(addDuration(ny, day, 1).toString()).toBe(
    "2026-03-09T00:00:00-04:00[America/New_York]",
  );
});

test("a sub-day duration is added exactly", () => {
  const two = { kind: "duration", canonical: new Decimal(7_200), unit: "h" };
  expect(addDuration(zdt, two, 1).toString()).toBe("2026-01-15T14:00:00+00:00[UTC]");
  expect(addDuration(zdt, two, -1).toString()).toBe("2026-01-15T10:00:00+00:00[UTC]");
});

test("a fractional calendar unit falls back to exact nanoseconds", () => {
  const half = { kind: "duration", canonical: new Decimal(43_200), unit: "d" };
  expect(addDuration(zdt, half, 1).toString()).toBe("2026-01-16T00:00:00+00:00[UTC]");
});
