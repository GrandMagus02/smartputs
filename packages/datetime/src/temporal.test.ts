import { expect, test } from "bun:test";
import { TEST_NOW, TEST_ZONE, Temporal } from "./temporal";

test("the fixed test clock is 2026-01-15T12:00Z", () => {
  const zdt =
    Temporal.Instant.fromEpochMilliseconds(TEST_NOW).toZonedDateTimeISO(TEST_ZONE);
  expect(zdt.toString()).toBe("2026-01-15T12:00:00+00:00[UTC]");
});

test("Temporal round-trips a zoned datetime string", () => {
  const zdt = Temporal.ZonedDateTime.from("2026-01-15T00:00:00+09:00[Asia/Tokyo]");
  expect(zdt.timeZoneId).toBe("Asia/Tokyo");
  expect(zdt.epochNanoseconds.toString()).toBe(
    (BigInt(Date.UTC(2026, 0, 14, 15, 0, 0)) * 1_000_000n).toString(),
  );
});
