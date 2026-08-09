import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { Corpora } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { RANGE_KINDS } from "./index";
import { resolveSlice } from "./slice";

/**
 * `BUILTIN_KINDS` is registered for the same reason `@smartput/time-range`'s
 * corpus registers `datetime`: this is the engine a real consumer builds, and
 * every dash row has a competing reading inside it. Drop `number` and the dash
 * rows would win by default rather than on the +20 the signature says they win
 * by, which is exactly the thing a corpus is supposed to catch moving.
 *
 * No `kinds` filter. A `range` reading is the one that is meant to win outright.
 */
const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, ...RANGE_KINDS],
  now: () => 0,
  timeZone: "UTC",
});

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  {
    id: "en",
    engine,
  },
  {
    id: "uk",
    pending:
      "the selection words — first, last, top, to, through — are matched in `phrases.ts` as code rather than declared as a vocabulary, so there is nothing here for a language pack to translate yet",
  },
]);

corpora.evaluate();

/** The recorded rows, for the properties asserted over them below. */
const rows = corpora.rows("en");

/**
 * The property the whole package rests on: a selection resolved against a list
 * long enough to hold it selects at least one item, and the count it reports is
 * the number of positions between its ends.
 *
 * A hundred items is longer than any row's furthest reach, so nothing here is
 * clamped and every count is the un-clamped one — which is what makes this an
 * assertion about the parse rather than about `resolveSlice`'s clamping.
 */
test("every row selects a non-empty run of a hundred items", () => {
  for (const [input] of rows) {
    const { start, end } = engine.evaluate(input as string).value.meta as {
      start: number;
      end: number;
    };
    const resolved = resolveSlice({ start, end }, 100);
    expect(`${input}: ${resolved.count > 0}`).toBe(`${input}: true`);
    expect(`${input}: ${resolved.end - resolved.start + 1}`).toBe(
      `${input}: ${resolved.count}`,
    );
  }
});
