import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE, Temporal } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "@smartput/time";
import { datetimeRange } from "./datetime-range";

/**
 * No `kinds` narrowing, unlike `date`'s and `time`'s corpora. Those two are
 * weighted -5 and have to be asked for; this kind is weighted +20 and is
 * supposed to win outright, so every row here is what a user actually gets.
 *
 * `date` and `time` are registered even though no row resolves to either,
 * because their readings are what a range phrase competes against — a corpus
 * that left them out would not be testing the contest the weight exists for.
 */
const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, date, time, datetimeRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine,
  },
  {
    id: "uk",
    pending:
      "@smartput/datetime reads its dates through chrono-node, which parses English; the zone words come from a vocabulary whose Ukrainian half (`@smartput/datetime/locale/uk`) is P3's and does not exist yet",
  },
]);

/** The recorded rows, for the property asserted over them below. */
const rows = corpora.rows("en");

/**
 * Design §7's first property, asserted from outside the kind.
 *
 * `assertOrdered` already runs inside every path that builds one of these, so
 * nothing here should be able to fail — which is the point. A window phrase or
 * a closer added later that assembles its two ends directly would opt out of the
 * internal check without anyone noticing; it cannot opt out of this one, which
 * reads the value the engine actually returned.
 *
 * The wrapping `night` window is not an exception to it. `tonight` runs 22:00 on
 * the 15th to 06:00 on the *16th* — a `datetime-range` is anchored to a day, so
 * wrapping shows up as a later date rather than as a smaller clock reading. Only
 * `time-range`, which has no day at all, can wrap in the sense §6 exempts.
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

corpora.evaluate();
