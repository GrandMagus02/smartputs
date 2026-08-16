import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { MissingRateError } from "../errors";
import { defineKind } from "../kind/define";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";

/**
 * `BUILTIN_EN` with one kind's vocabulary replaced by a copy carrying cues.
 *
 * A patch and not an append: `composeLocale` refuses two vocabularies for one
 * (locale, kind), so appending a cue-only vocabulary for a kind the built-in
 * pack already covers throws before a single assertion runs. Spreading keeps
 * the original's units, which the mark still has to resolve through.
 */
const withCues = (kind: string, cues: Record<string, number>) =>
  BUILTIN_EN.map((v) => (v.kind === kind ? defineVocabulary({ ...v, cues }) : v));

const patched = withCues("duration", { in: 3, time: 2 });
const engine = createEngine({
  locales: [composeLocale(en, patched)],
  kinds: BUILTIN_KINDS,
});

test("scan marks a quantity in prose with its formatted reading", () => {
  const input = "My house is in 5km from work";
  const marks = engine.scan(input);
  expect(marks).toHaveLength(1);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(mark.text).toBe("5km");
  expect(input.slice(mark.start, mark.end)).toBe("5km");
  expect(mark.readings[0]?.kind).toBe("length");
});

test("a cue lifts the reading it argues for and leaves the loser visible", () => {
  // The headline example. Three cues — in, time, in — saturate at CUE_CEILING,
  // which the softmax turns into 0.982 against 0.018.
  const marks = engine.scan("Will be in time in 5m");
  const readings = marks[0]?.readings ?? [];
  expect(readings[0]?.kind).toBe("duration");
  expect(readings[0]?.formatted).toBe("5 minutes");
  expect(readings[1]?.kind).toBe("length");
  // The bounds are the assertion. "duration wins" alone would pass just as well
  // under a cue weight ten times too large, which is the bug §4 exists to stop.
  expect(readings[1]?.confidence).toBeGreaterThan(0.01);
  expect(readings[1]?.confidence).toBeLessThan(0.1);
});

test("text always equals the slice it names", () => {
  const input = "  I walked 5 km then ran 3 km.  ";
  for (const mark of engine.scan(input)) {
    expect(mark.text).toBe(input.slice(mark.start, mark.end));
  }
});

test("cue hits carry caller-relative spans", () => {
  const input = "Will be in time in 5m";
  const cues = engine.scan(input)[0]?.cues ?? [];
  expect(cues).not.toHaveLength(0);
  for (const cue of cues) {
    expect(input.slice(cue.start, cue.end)).toBe(cue.word);
  }
});

test("maxReadings truncates after ranking, not before", () => {
  const marks = engine.scan("about 10 m here", { maxReadings: 1 });
  expect(marks[0]?.readings).toHaveLength(1);
});

test("scan answers [] rather than throwing on prose with nothing in it", () => {
  expect(engine.scan("the kilometre is a unit of length")).toEqual([]);
  expect(engine.scan("")).toEqual([]);
});

test("scan forwards the caller's own cues", () => {
  // Bare "10 m" ties at 0.5/0.5 between duration:min and length:m — measured —
  // and the solver's tie-break is `a.kind.localeCompare(b.kind)`, so `duration`
  // wins unaided. Biasing toward `length` is therefore the only direction that
  // proves the forwarding works: a test that asserted `duration` would pass
  // just as well with the forward deleted.
  expect(engine.scan("10 m")[0]?.readings[0]?.kind).toBe("duration");
  expect(engine.scan("10 m", { cues: { length: 4 } })[0]?.readings[0]?.kind).toBe(
    "length",
  );
});

test("a reading whose rate is missing is dropped, not thrown", () => {
  // Ruling S4, exercised rather than asserted around. `@smartput/rate` is the
  // real source of a MissingRateError and core cannot depend on it, so a stub
  // kind whose format hook raises the same error stands in — the code path
  // under test is `toResult` throwing inside `scan`, and it does not care which
  // kind raised it.
  const unpriced = defineKind({
    id: "unpriced",
    value: { mode: "ratio", canonical: "zz", units: { zz: 1 } },
    format: () => {
      throw new MissingRateError("zz", "zz", "usd", "2026-08-16");
    },
  });
  const unpricedEn = defineVocabulary({
    locale: "en",
    kind: "unpriced",
    units: { zz: { aliases: ["zorkmid", "zorkmids"], symbol: "zz" } },
  });
  const stubbed = createEngine({
    locales: [composeLocale(en, [...BUILTIN_EN, unpricedEn])],
    kinds: [...BUILTIN_KINDS, unpriced],
  });

  // The unpriced mark has no formattable reading, so it is dropped whole — and
  // the two marks around it survive, which is the entire point of the ruling.
  const marks = stubbed.scan("I walked 5 km, paid 9 zorkmids, then ran 3 km");
  expect(marks.map((m) => m.text)).toEqual(["5 km", "3 km"]);
});
