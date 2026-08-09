import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { Temporal } from "@smartput/datetime";
import type { EndpointParser } from "./endpoint";
import { resolveEndpoint } from "./endpoint";

const ctx: MatchCtx = {
  locale: "en",
  now: 1_768_478_400_000,
  timeZone: "UTC",
  isUnitAlias: () => false,
};

const zdt = Temporal.ZonedDateTime.from("2026-01-15T12:00:00+00:00[UTC]");

const declines: EndpointParser = () => null;
const claims =
  (length: number): EndpointParser =>
  () => ({ zdt, length });

test("the first parser that claims the text wins", () => {
  const hit = resolveEndpoint("today", ctx, [declines, claims(2), claims(4)]);
  expect(hit?.length).toBe(2);
  expect(hit?.zdt).toBe(zdt);
});

test("no parser claiming it is a miss, not a throw", () => {
  expect(resolveEndpoint("today", ctx, [declines, declines])).toBeNull();
});

test("an empty parser list is a miss", () => {
  expect(resolveEndpoint("today", ctx, [])).toBeNull();
});

// The seam exists so `@smartput/datetime-range/holiday` can append a parser
// without the root entry ever reaching `date-holidays`. Ordering is therefore
// the caller's preference and must be honoured exactly: a later parser is only
// consulted when every earlier one declined.
test("a later parser only runs when the earlier ones decline", () => {
  const seen: string[] = [];
  const record =
    (tag: string, hit: boolean): EndpointParser =>
    (text, given) => {
      expect(text).toBe("closest holiday");
      expect(given).toBe(ctx);
      seen.push(tag);
      return hit ? { zdt, length: text.length } : null;
    };
  resolveEndpoint("closest holiday", ctx, [
    record("datetime", false),
    record("holiday", true),
    record("unreached", true),
  ]);
  expect(seen).toEqual(["datetime", "holiday"]);
});
