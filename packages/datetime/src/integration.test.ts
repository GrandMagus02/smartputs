import { expect, test } from "bun:test";
import { AmbiguityError, composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "./datetime";
import datetimeEn from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const make = (extra: Record<string, unknown> = {}) =>
  createEngine({
    locales: [composeLocale(coreEn, [...BUILTIN_EN, datetimeEn])],
    kinds: [...BUILTIN_KINDS, datetime],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
    ...extra,
  });

test("an engine without the datetime kind does not know what today is", () => {
  const bare = createEngine({
    locales: [composeLocale(coreEn, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS],
  });
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

test("a written UTC offset names the instant", () => {
  // The engine's zone still decides how the answer reads; the offset only
  // decides which instant "3pm" was. Same rule as "3pm est".
  expect(make().evaluate("3pm gmt+3").formatted).toBe("2026-01-15 12:00 UTC");
  expect(make().evaluate("3pm GMT+3").formatted).toBe("2026-01-15 12:00 UTC");
  expect(make().evaluate("3pm utc+05:30").formatted).toBe("2026-01-15 09:30 UTC");
});

test("an offset zone is a conversion target like any other unit", () => {
  const engine = make();
  expect(engine.evaluate("3pm in gmt+3").formatted).toBe("2026-01-15 18:00 UTC+03:00");
  expect(engine.evaluate("3pm in utc-5").formatted).toBe("2026-01-15 10:00 UTC-05:00");
  expect(engine.evaluate("3pm in gmt+5:45").formatted).toBe("2026-01-15 20:45 UTC+05:45");
  expect(engine.evaluate("3pm in gmt+3").value.unit).toBe("+03:00");
});

test("an offset of zero reads as UTC, not as +00:00", () => {
  expect(make().evaluate("3pm in gmt+0").formatted).toBe("2026-01-15 15:00 UTC");
});

test("a bare offset zone is the current time there", () => {
  expect(make().evaluate("GMT+3").formatted).toBe("2026-01-15 15:00 UTC+03:00");
  expect(make().evaluate("utc-5").formatted).toBe("2026-01-15 07:00 UTC-05:00");
});

test("offset zones compose with the rest of the kind", () => {
  const engine = make();
  expect(engine.evaluate("3pm gmt+3 in tokyo").formatted).toBe("2026-01-15 21:00 JST");
  expect(engine.evaluate("3pm gmt+3 + 2 h").formatted).toBe("2026-01-15 14:00 UTC");
  expect(engine.evaluate("3pm in gmt+3 - 3pm utc").value.unit).toBe("s");
});

test("gmt keeps its plain alias reading", () => {
  // The offset matcher must not swallow the word on its own: "gmt" with no
  // sign after it is still the UTC alias the kind has always registered.
  expect(make().evaluate("3pm in gmt").formatted).toBe("2026-01-15 15:00 UTC");
});
