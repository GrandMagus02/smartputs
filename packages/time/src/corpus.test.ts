import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as coreEn } from "@smartput/locale-en";
import { time } from "./time";

const engine = createEngine({
  locales: [composeLocale(coreEn)],
  kinds: [...BUILTIN_KINDS, datetime, time],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/**
 * The corpus asserts the *time* reading, which is not the reading that wins.
 *
 * `datetime` is registered above precisely so the engine here is the one a real
 * consumer builds — a `time` reading only exists alongside a `datetime` one —
 * and `kinds` then names the reading each row is about. `duration` rides along
 * because the arithmetic rows need a right operand; it never claims a row's
 * input on its own.
 */
const KINDS = ["time", "duration"];

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
    const r = engine.evaluate(input as string, { kinds: KINDS });
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}
