import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE, Temporal } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as coreEn } from "@smartput/locale-en";
import { dateRange } from "./date-range";

/**
 * `datetime` and `date` are registered rather than left out, and that is the
 * point of the file: four of the phrases are also chrono dates, so a corpus run
 * without them would pass while the shipped engine threw `AmbiguityError`.
 *
 * No `kinds` narrowing either, for the same reason. `@smartput/date`'s corpus
 * has to narrow because its reading is weighted -5 on purpose; a range is meant
 * to win outright, so every row here asserts the unprompted answer.
 */
const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime, date, dateRange],
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
  expect(rows.length).toBeGreaterThan(10);
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
 * Design §7's first property, over the corpus rather than over generated input.
 *
 * `assertOrdered` runs inside `build`, so in principle no row can reach here
 * inverted — which is exactly the reason to assert it from the outside. The
 * check is one call in one helper, and a phrase added later that assembles its
 * ends without going through `build` would silently opt out of it. This test
 * cannot be opted out of: it reads the value every row actually produced.
 *
 * `Temporal.Instant.compare` rather than a string comparison. Every row here is
 * UTC and the ISO strings would sort correctly, but a zone offset in the middle
 * of the string is not something lexicographic order knows about, and the first
 * non-UTC row would turn this from a property into a coincidence.
 */
test("every row's end is strictly after its start", () => {
  for (const [input] of rows) {
    const meta = engine.evaluate(input as string).value.meta as {
      start: string;
      end: string;
    };
    const order = Temporal.Instant.compare(
      Temporal.ZonedDateTime.from(meta.end).toInstant(),
      Temporal.ZonedDateTime.from(meta.start).toInstant(),
    );
    expect(`${input}: ${meta.start} → ${meta.end}`).toBe(
      order > 0 ? `${input}: ${meta.start} → ${meta.end}` : "end after start",
    );
  }
});
