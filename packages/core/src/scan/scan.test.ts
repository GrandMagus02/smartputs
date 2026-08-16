import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import { Scanner } from "./scan";

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
const locale = composeLocale(en, patched);
const registry = buildRegistry(BUILTIN_KINDS, [locale]);
const parser = new Parser({
  resolver: createResolver({ registry, locales: [locale], format: locale, layers: [] }),
});
const scanner = new Scanner({
  normalizer: new Normalizer(),
  tokenizer: new Tokenizer({ locale, locales: [locale], registry }),
  solver: new Solver({ registry }),
  registry,
});

const spans = (input: string) =>
  scanner.run(input, parser).map((m) => input.slice(m.span.start, m.span.end));

test("a quantity in prose is marked, and the prose is not", () => {
  expect(spans("My house is in 5km from work")).toEqual(["5km"]);
});

test("backoff stops at the longest run that parses", () => {
  // "5 km from work" and "5 km from" both fail in the Pratt parser; "5 km"
  // parses and wins. Nothing in the parser changed to make this work — a parse
  // that does not consume its whole token list was already an error.
  expect(spans("walk 5 km from work today")).toEqual(["5 km"]);
});

test("an expression inside prose is one mark, not two", () => {
  expect(spans("the total was 5 km + 3 km overall")).toEqual(["5 km + 3 km"]);
});

test("a conversion inside prose is one mark", () => {
  expect(spans("convert 5 km in miles please")).toEqual(["5 km in miles"]);
});

test("several quantities in one sentence are several marks", () => {
  expect(spans("I walked 5 km then ran 3 km")).toEqual(["5 km", "3 km"]);
});

test("marks never overlap and are in source order", () => {
  // Adjacent marks with no space between them: the case a walk that resumed
  // at the wrong index would get wrong. The count assertion is load-bearing
  // — without it this test passes by asserting nothing whenever the scanner
  // returns fewer than two marks.
  const input = "5km,3km";
  const marks = scanner.run(input, parser);
  expect(marks).toHaveLength(2);
  let previousEnd = 0;
  for (const mark of marks) {
    expect(mark.span.start).toBeGreaterThanOrEqual(previousEnd);
    expect(mark.span.end).toBeGreaterThan(mark.span.start);
    previousEnd = mark.span.end;
  }
});

test("prose with no quantity in it marks nothing", () => {
  expect(spans("the kilometre is a unit of length")).toEqual([]);
});

test("an empty input marks nothing rather than throwing", () => {
  expect(scanner.run("   ", parser)).toEqual([]);
});

test("a cue outside the mark biases it; one inside does not", () => {
  const biased = scanner.run("Will be in time in 5m", parser);
  expect(biased[0]?.resolutions[0]?.kind).toBe("duration");
  // The assertion with teeth. Unbiased this is 0.5 — `duration` wins the
  // alphabetical tie-break either way — so only the confidence separates a
  // working cue collection from a deleted one. in(3) + time(2) + in(3) = 8,
  // clamped to CUE_CEILING = 4, which the softmax turns into 0.982.
  expect(biased[0]?.resolutions[0]?.confidence).toBeGreaterThan(0.9);
  expect(biased[0]?.cues.map((c) => c.word)).toEqual(["in", "time", "in"]);

  // Here `in` is the convert node, inside the mark, so it casts no vote.
  const converted = scanner.run("5 km in miles", parser);
  expect(converted[0]?.cues).toEqual([]);
});

test("maxSpan bounds the backoff", () => {
  // With a cap of 2 tokens the scanner can never reach past "5 km", so the
  // longer expression is broken into the marks that fit.
  const marks = scanner.run("total 5 km + 3 km", parser, { maxSpan: 2 });
  expect(marks.map((m) => m.span.end - m.span.start)).toEqual([4, 4]);
});

test("a mark never begins or ends with whitespace", () => {
  // Normalization deletes the degree sign and collapses the runs, so the mapped
  // end offset lands past the C. Interior spacing is the caller's own and stays.
  const input = "it was  30  °C  outside";
  const marks = scanner.run(input, parser);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(input.slice(mark.span.start, mark.span.end)).toBe("30  °C");
});

test("a caller's own cues are added to the ones collected from the text", () => {
  // ScanOptions extends EvalOptions, so `cues` is part of scan's surface. A
  // scope field that the scanner accepts and never forwards would be a silent
  // no-op on a documented option.
  //
  // `length` and not `duration` for the bias: bare "5 m" ties at 0.5/0.5 and
  // the solver's tie-break is alphabetical on kind, so `duration` already wins
  // unaided — asserting it here would pass with the forwarding deleted.
  const plain = scanner.run("5 m", parser);
  expect(plain[0]?.resolutions[0]?.kind).toBe("duration");

  const biased = scanner.run("5 m", parser, { cues: { length: 4 } });
  expect(biased[0]?.resolutions[0]?.kind).toBe("length");
  expect(biased[0]?.resolutions[0]?.cueBonus).toBe(4);
});

test("a non-breaking space does not collapse every mark onto the whole input", () => {
  // U+00A0 is what pasting from a web page produces. Before the mapSpan fix,
  // NFKC folding made every mark report the entire input as its span, which
  // silently broke the non-overlap invariant on exactly the input class scan
  // exists to read. The space between "5" and "km" below is a genuine
  // U+00A0, not U+0020 -- the other spaces in the input are ordinary.
  const input = "I ran 5 km then 3 km";
  const marks = scanner.run(input, parser);
  expect(marks.map((m) => input.slice(m.span.start, m.span.end))).toEqual([
    "5 km",
    "3 km",
  ]);
});
