import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import { NoCandidateError } from "./errors";
import en from "./locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

const corpusRows = (await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text())
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.split("\t")[0] as string);

test("Result.spans indexes the caller's string, not the normalized one", () => {
  // The four inputs probed on main. Three reported a wrong slice.
  for (const [input, expected] of [
    ["30 deg + 15 deg", "30 deg + 15 deg"],
    ["30 °C + 5 C", "30 °C + 5 C"],
    ["  30 deg  ", "30 deg"],
    ["30  deg + 15 deg", "30  deg + 15 deg"],
  ] as const) {
    const span = engine.evaluate(input).spans[0];
    expect(span, input).toBeDefined();
    if (span === undefined) continue;
    expect(input.slice(span.start, span.end), input).toBe(expected);
  }
});

test("Explanation.tokens index the caller's string, not the normalized one", () => {
  // Measured on main before Task 6: these five tokens sliced "  ", "0 d", "g",
  // "+ " and "5 d" — the normalized-relative offsets read against the padded
  // source. Mapped through NormalizedInput, they read back the words they
  // actually are.
  const input = "  30 deg + 15 deg  ";
  const slices = engine.explain(input).tokens.map((t) => input.slice(t.start, t.end));
  expect(slices).toEqual(["30", "deg", "+", "15", "deg"]);
});

test("NoCandidateError.spans indexes the caller's string, not the normalized one", () => {
  // Measured on main before Task 6: the raw lexer token's offsets sliced
  // "0 zzzzz" out of this padded input.
  const input = "  10 zzzzzzz  ";
  expect.assertions(2);
  try {
    engine.evaluate(input);
  } catch (e) {
    expect(e).toBeInstanceOf(NoCandidateError);
    if (!(e instanceof NoCandidateError)) throw e;
    const span = e.spans[0];
    expect(span && input.slice(span.start, span.end)).toBe("zzzzzzz");
  }
});

test("every corpus input's root span survives leading/trailing padding", () => {
  // The corpus itself contains no input with a degree sign, a non-ASCII
  // dash, or a collapsed whitespace run, so mapSpan is the identity for all
  // of it and a bare bounds check would pass identically against the
  // unfixed code. Padding every input with whitespace that normalization
  // trims forces a real length-changing edit, so the padded span only
  // slices out the same text as the unpadded span if the leading trim is
  // actually mapped back through.
  for (const input of corpusRows) {
    let span: { start: number; end: number } | undefined;
    try {
      span = engine.evaluate(input).spans[0];
    } catch {
      // Some corpus rows are deliberately ambiguous or otherwise throw on
      // evaluate; they are not this test's concern, so they are skipped
      // rather than swallowed into a false pass.
      continue;
    }
    expect(span, input).toBeDefined();
    if (span === undefined) continue;
    expect(span.start).toBeGreaterThanOrEqual(0);
    expect(span.end).toBeLessThanOrEqual(input.length);
    const unpaddedSlice = input.slice(span.start, span.end);
    expect(unpaddedSlice.trim().length, input).toBeGreaterThan(0);

    const padded = `  ${input}  `;
    let paddedSpan: { start: number; end: number } | undefined;
    try {
      paddedSpan = engine.evaluate(padded).spans[0];
    } catch {
      continue;
    }
    expect(paddedSpan, padded).toBeDefined();
    if (paddedSpan === undefined) continue;
    expect(padded.slice(paddedSpan.start, paddedSpan.end), padded).toBe(unpaddedSlice);
  }
});
