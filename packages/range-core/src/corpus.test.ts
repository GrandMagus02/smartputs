import { expect, test } from "bun:test";
import { Corpora } from "@smartput/core/testing";
import { Temporal } from "@smartput/datetime";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  type SnapOptions,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "./snap";
import { WINDOWS } from "./windows";

/**
 * The corpus for `@smartput/range-core`.
 *
 * Every other corpus in the repo is a sentence and its answer. This package
 * reads no sentence — it is the interval algebra the three range kinds are
 * built out of, one layer below anything with a vocabulary — so a row here is
 * an instant, a zone and the boundary it snaps to. The file is still `en.tsv`
 * for the same reason the others are: it is the table a reviewer checks, and
 * the language a boundary is *named* in is the kind's business, not this one's.
 *
 * The rows worth reading twice are Santiago's. 2026-09-06 has no local midnight
 * there, which is what forces `snap.ts` to choose the calendar date before
 * snapping rather than after, and what would make a `with({ hour: 0 })`
 * implementation name a time that does not exist.
 */
const SNAPS: Record<
  string,
  (zdt: Temporal.ZonedDateTime, opts: SnapOptions) => Temporal.ZonedDateTime
> = {
  "start of week": startOfWeek,
  "end of week": endOfWeek,
  "start of month": (zdt) => startOfMonth(zdt),
  "end of month": (zdt) => endOfMonth(zdt),
  "start of year": (zdt) => startOfYear(zdt),
  "end of year": (zdt) => endOfYear(zdt),
};

/**
 * One language, and the table shape anyway — for the reason the comment above
 * gives: a row here is an instant, a zone and a boundary, and a boundary is not
 * named in any language until a kind names it. The shared loader is still what
 * reads it, so a corpus that stopped existing fails rather than passing empty.
 */
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  { id: "en" },
]);

corpora.each(([subject, zone, op, weekStart, result]) => {
  if (op === "window") {
    const window = WINDOWS[subject as string];
    expect(window).toBeDefined();
    if (window === undefined) return;
    const wraps = window.wraps ? "wraps" : "open";
    expect(`${window.start}/${window.end} ${wraps}`).toBe(result as string);
    return;
  }

  const snap = SNAPS[op as string];
  expect(snap).toBeDefined();
  if (snap === undefined) return;

  const zdt = Temporal.Instant.from(subject as string).toZonedDateTimeISO(zone as string);
  const opts: SnapOptions = weekStart === "-" ? {} : { weekStart: Number(weekStart) };
  expect(snap(zdt, opts).toString()).toBe(result as string);
});

/**
 * `wraps` is stored on the window rather than derived, so the two can disagree.
 * The corpus writes the stored flag; this checks it against the definition.
 */
test("every window's stored wrap flag matches its hours", () => {
  for (const [name, window] of Object.entries(WINDOWS)) {
    expect({ name, wraps: window.wraps }).toEqual({
      name,
      wraps: window.end <= window.start,
    });
  }
});
