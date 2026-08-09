import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "@smartput/time";
import { timeRange } from "./time-range";

/**
 * `datetime` and `time` are registered for the same reason `@smartput/time`'s
 * corpus registers `datetime`: this is the engine a real consumer builds, and
 * every row here has a competing reading inside it. Drop `datetime` and the
 * dash rows would win by default rather than on the +20 the design says they
 * win by, which is exactly the thing the corpus is supposed to catch moving.
 *
 * No `kinds` filter, unlike `time`'s corpus. A `time-range` reading is the one
 * that is meant to win outright.
 */
const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, time, timeRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(15);
});

for (const [input, kind, canonical, formatted] of rows) {
  test(`corpus: ${input}`, () => {
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}

/**
 * Design §7's first property — "for every non-wrapping range, `start < end`" —
 * and this is the kind the qualifier was written for. `assertOrdered` is never
 * called here at all, so unlike the other two range packages there is no
 * internal check this one is double-asserting: `wraps` is the only thing
 * standing between "night shift" and "backwards", and nothing else in the repo
 * checks that the flag agrees with the two ends it describes.
 *
 * A plain string comparison is correct here and nowhere else in the milestone.
 * A clock reading is `HH:MM` zero-padded with no zone and no day, so
 * lexicographic order *is* chronological order — which is the same fact that
 * makes `wraps` necessary in the first place.
 */
test("a row wraps exactly when its end is not after its start", () => {
  for (const [input] of rows) {
    const meta = engine.evaluate(input as string).value.meta as {
      start: string;
      end: string;
      wraps: boolean;
    };
    const forward = meta.end > meta.start;
    expect(`${input} wraps: ${meta.wraps}`).toBe(`${input} wraps: ${!forward}`);
  }
});
