import { expect, test } from "bun:test";
import { AmbiguityError, createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { datetime } from "./datetime";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const make = (extra: Record<string, unknown> = {}) =>
  createEngine({
    locales: [coreEn],
    kinds: [...BUILTIN_KINDS, datetime],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
    ...extra,
  });

test("an engine without the datetime kind does not know what today is", () => {
  const bare = createEngine({ locales: [coreEn], kinds: [...BUILTIN_KINDS] });
  expect(() => bare.evaluate("today")).toThrow();
});

test("suggest ranks a date and never throws", () => {
  const engine = make();
  const results = engine.suggest("today");
  expect(results[0]?.kind).toBe("datetime");
  expect(engine.suggest("!!!")).toEqual([]);
});

test("coerce targets the datetime kind", () => {
  expect(make().coerce("datetime", "tomorrow").unit).toBe("UTC");
});

test("explain names the literal and its weight contributions", () => {
  const explanation = make().explain("today");
  expect(explanation.candidates[0]).toMatchObject({
    kind: "datetime",
    surface: "today",
  });
  expect(explanation.assignments[0]?.confidence).toBeCloseTo(1);
});

test("a weight override reaches a literal's contributions", () => {
  // "9:30" has exactly one reading, so a weight cannot change *which* reading
  // wins — only its score. The contribution row is the proof that the
  // four-layer weight model applies to a plugin kind's literal at all.
  const demoted = make({ weights: { datetime: -1000 } });
  const contributions = demoted.explain("9:30").assignments[0]?.contributions ?? [];
  expect(contributions).toContainEqual({
    selector: "datetime",
    value: -1000,
    layer: 2,
  });
});

test("the engine's timeZone changes what a bare time means", () => {
  const tokyo = make({ timeZone: "Asia/Tokyo" });
  expect(tokyo.evaluate("3pm").formatted).toBe("2026-01-15 15:00 JST");
  expect(tokyo.evaluate("3pm").value.canonical.toString()).not.toBe(
    make().evaluate("3pm").value.canonical.toString(),
  );
});

test("a per-call timeZone overrides the engine's", () => {
  expect(make().evaluate("3pm", { timeZone: "Asia/Tokyo" }).formatted).toBe(
    "2026-01-15 15:00 JST",
  );
});

test("the clock is injectable, so nothing depends on the wall clock", () => {
  const later = make({ now: () => TEST_NOW + 86_400_000 });
  expect(later.evaluate("today").formatted).toBe("2026-01-16 00:00 UTC");
});

test("AmbiguityError is still reachable for genuinely ambiguous units", () => {
  expect(() => make().evaluate("10 m")).toThrow(AmbiguityError);
});
