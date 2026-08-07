import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as coreEn } from "@smartput/locale-en";
import { date } from "./date";

const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime, date],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/**
 * Every row is read with the candidate set narrowed to these two kinds.
 *
 * `datetime` is registered in the engine above but excluded here on purpose:
 * the date reading is weighted -5 precisely so that an unnarrowed "today" keeps
 * answering as a datetime, which `date.test.ts` pins. This file asserts the
 * *other* reading — the one the range kinds are built on — so it has to ask for
 * it. `duration` rides along because the arithmetic rows need a right operand.
 */
const KINDS = ["date", "duration"];

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
    const r = engine.evaluate(input as string, { kinds: KINDS });
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}
