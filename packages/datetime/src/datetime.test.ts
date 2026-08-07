import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";
import { datetime } from "./datetime";
import datetimeEn from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const engine = createEngine({
  locales: [composeLocale(en, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare date evaluates", () => {
  const r = engine.evaluate("today");
  expect(r.kind).toBe("datetime");
  expect(r.value.meta?.iso).toBe("2026-01-15T00:00:00+00:00[UTC]");
  expect(r.formatted).toBe("2026-01-15 00:00 UTC");
});

test("adding a duration is a datetime", () => {
  expect(engine.evaluate("today + 3 d").formatted).toBe("2026-01-18 00:00 UTC");
  expect(engine.evaluate("today + 2 h").formatted).toBe("2026-01-15 02:00 UTC");
});

test("a duration may lead", () => {
  expect(engine.evaluate("3 d + today").formatted).toBe("2026-01-18 00:00 UTC");
});

test("subtracting a duration is a datetime", () => {
  expect(engine.evaluate("today - 1 wk").formatted).toBe("2026-01-08 00:00 UTC");
});

test("the difference of two datetimes is a duration", () => {
  const r = engine.evaluate("2026-01-18 - today");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("259200");
  expect(r.formatted).toBe("3 days");
});

test("`in` converts the zone and keeps the instant", () => {
  const r = engine.evaluate("3pm in tokyo");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-16 00:00 JST");
  expect(r.value.canonical.toString()).toBe(
    engine.evaluate("3pm").value.canonical.toString(),
  );
});

test("duration arithmetic still needs no date at all", () => {
  const r = engine.evaluate("30 hours - 10 minutes");
  expect(r.kind).toBe("duration");
  expect(r.formatted).toBe("29.833333333333333333333333 hours");
});

test("a length expression is untouched by the date matcher", () => {
  expect(engine.evaluate("10 km + 5 km").kind).toBe("length");
});

test("multiplying a datetime is refused", () => {
  expect(() => engine.evaluate("today * 2")).toThrow(/datetime/);
});

test("a datetime is JSON-serialisable end to end", () => {
  const r = engine.evaluate("today");
  expect(JSON.parse(JSON.stringify(r.value))).toEqual({
    kind: "datetime",
    canonical: r.value.canonical.toString(),
    unit: "UTC",
    meta: { iso: "2026-01-15T00:00:00+00:00[UTC]" },
  });
});
