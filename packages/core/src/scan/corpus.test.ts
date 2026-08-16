import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { composeLocale } from "../locale/compose";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

const corpusRows = (
  await Bun.file(new URL("../../corpus/en.tsv", import.meta.url)).text()
)
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.split("\t")[0] as string);

test("a corpus row inside a carrier sentence scans to what it evaluates to alone", () => {
  let checked = 0;
  let skipped = 0;
  for (const row of corpusRows) {
    let alone: { kind: string; formatted: string };
    try {
      const result = engine.evaluate(row);
      alone = { kind: result.kind, formatted: result.formatted };
    } catch {
      // Deliberately ambiguous or otherwise throwing rows are not this test's
      // concern. They are counted so the skip rate is visible rather than
      // silent.
      skipped += 1;
      continue;
    }
    const carrier = `note ${row} ok`;
    const marks = engine.scan(carrier);
    expect(marks.length, carrier).toBe(1);
    const mark = marks[0];
    if (mark === undefined) continue;
    expect(mark.text, carrier).toBe(row);
    expect(mark.readings[0]?.kind, carrier).toBe(alone.kind);
    expect(mark.readings[0]?.formatted, carrier).toBe(alone.formatted);
    checked += 1;
  }
  // Every `continue` above skips a row without recording that it did, so a bare
  // loop with no counter would still pass if a change made most rows throw.
  // This is the guard the corpus span test already uses, for the same reason.
  expect(checked).toBeGreaterThan(30);
  expect(skipped).toBeLessThan(checked);
});

test("every mark's span survives leading and trailing padding", () => {
  // The whitespace-padding torture from span.test.ts, which caught three real
  // normalized-relative span bugs on the Result path.
  let checked = 0;
  for (const row of corpusRows) {
    const carrier = `note ${row} ok`;
    const plain = engine.scan(carrier);
    if (plain.length !== 1) continue;
    const padded = engine.scan(`  ${carrier}  `);
    expect(padded.length, carrier).toBe(1);
    expect(padded[0]?.text, carrier).toBe(plain[0]?.text);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(30);
});

test("marks are sorted, non-overlapping, and name their own text", () => {
  const input = "I walked 5 km, waited 20 min, then drove 30 km at 100 kph.";
  const marks = engine.scan(input);
  expect(marks.length).toBeGreaterThan(2);
  let previousEnd = 0;
  for (const mark of marks) {
    expect(mark.start).toBeGreaterThanOrEqual(previousEnd);
    expect(mark.end).toBeGreaterThan(mark.start);
    expect(mark.text).toBe(input.slice(mark.start, mark.end));
    previousEnd = mark.end;
  }
});

test("scanning a long paragraph stays linear", () => {
  // The maxSpan guard of §6.3, asserted as a wall-clock ceiling rather than a
  // complexity proof: 200 quantities should not take 20x what 20 take.
  const sentence = "I walked 5 km and waited 20 min. ";
  const short = sentence.repeat(20);
  const long = sentence.repeat(200);

  const t0 = Bun.nanoseconds();
  engine.scan(short);
  const shortNs = Bun.nanoseconds() - t0;

  const t1 = Bun.nanoseconds();
  const marks = engine.scan(long);
  const longNs = Bun.nanoseconds() - t1;

  expect(marks.length).toBe(400);
  // Generous by design — this catches quadratic behaviour, not a slow day on
  // shared CI.
  expect(longNs).toBeLessThan(shortNs * 40);
});
