import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Evaluator } from "../eval/evaluator";
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

const evaluator = new Evaluator({ registry, locale: locale.id });

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

test("a leading minus is part of the mark and part of the value", () => {
  // Before the anchor rule accepted a unary `op`, the mark started at the
  // number, dropping the sign from both the text ("5 km", not "-5 km") and
  // the resolved value (positive 5000, not -5000) — a wrong answer delivered
  // confidently, not just a short span. The span assertion alone would not
  // have caught the value bug, so both are asserted here.
  const marks = scanner.run("-5 km", parser);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(mark.span).toEqual({ start: 0, end: 5 });
  const resolution = mark.resolutions[0];
  expect(resolution).toBeDefined();
  if (resolution === undefined) return;
  expect(evaluator.run(mark.program, resolution).value.canonical.toString()).toBe(
    "-5000",
  );
});

test("a spelled-out minus is part of the mark and part of the value", () => {
  const marks = scanner.run("minus five kg", parser);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(mark.span).toEqual({ start: 0, end: 13 });
  const resolution = mark.resolutions[0];
  expect(resolution).toBeDefined();
  if (resolution === undefined) return;
  expect(evaluator.run(mark.program, resolution).value.canonical.toString()).toBe(
    "-5000",
  );
});

test("a parenthesised expression is one mark spanning its own parens", () => {
  // `program.root.span` covers only what is INSIDE the parens — a paren pair
  // contributes no span of its own to the node it builds — so before the mark
  // took its extent from the token run rather than the root node, this
  // reported "1 + 2", silently losing the parens and the trailing "* 3" that
  // depends on them.
  expect(spans("(1 + 2) * 3")).toEqual(["(1 + 2) * 3"]);
});

test("the binary minus that precedes a unit is left alone", () => {
  // The regression the unary anchor rule must not disturb: a `-` preceded by
  // a `number` is binary, and backing off must still find "5 - 3" as a bare
  // number, leaving the trailing "km" unclaimed rather than treating the "-"
  // as a fresh unary anchor over "3 km" alone.
  expect(spans("5 - 3 km")).toEqual(["5 - 3"]);
});

test("the binary minus that precedes a unit WORD is also left alone", () => {
  // The case a plain word/keyword allow-list gets wrong: "km" lexes as a
  // `word` token, indistinguishable by TYPE from "note" in "note -5 km ok".
  // Only the registry tells them apart. Before that check existed, "5 km"
  // parsed as its own mark (correctly), the walk resumed right at the `-`,
  // and — because a bare `word` was treated as never operand-terminating —
  // the `-` anchored a fresh unary run, reading "- 3 h" as a NEGATIVE
  // duration. Two marks are expected either way; what regressed was the sign
  // on the second one, so its value is asserted, not just its span.
  const input = "5 km - 3 h";
  const marks = scanner.run(input, parser);
  expect(marks.map((m) => input.slice(m.span.start, m.span.end))).toEqual([
    "5 km",
    "3 h",
  ]);
  const second = marks[1];
  const resolution = second?.resolutions[0];
  expect(resolution).toBeDefined();
  if (second === undefined || resolution === undefined) return;
  expect(evaluator.run(second.program, resolution).value.canonical.toString()).toBe(
    "10800",
  );
});

test("a carrier word before a leading minus still anchors it", () => {
  // Pinned separately from the bare "-5 km" case above: this is what killed
  // the first allow-list attempt at this rule (`op`/`lparen`/`keyword` only)
  // and what the corpus test actually exercises, since it wraps every row in
  // "note {row} ok". "note" is an ordinary `word` and not a registered unit
  // alias, so `endsOperand` must say no and let the `-` anchor.
  const input = "note -5 km ok";
  const marks = scanner.run(input, parser);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(input.slice(mark.span.start, mark.span.end)).toBe("-5 km");
  const resolution = mark.resolutions[0];
  expect(resolution).toBeDefined();
  if (resolution === undefined) return;
  expect(evaluator.run(mark.program, resolution).value.canonical.toString()).toBe(
    "-5000",
  );
});

test("a leading minus is read as unary even before a markdown bullet's item", () => {
  // A known limitation, not an accident: there is no lexical way to tell a
  // list bullet's "- " from a negation, and `engine.evaluate("- 2 kg")`
  // already reads this as -2 kg on its own — scan agreeing with evaluate is
  // the consistent answer, not a scan-specific bug to chase. Pinned so a
  // future reader knows it was considered and left alone deliberately.
  expect(spans("- 2 kg flour")).toEqual(["- 2 kg"]);
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
