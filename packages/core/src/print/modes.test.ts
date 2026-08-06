import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser, type Program } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import { Printer } from "./print";

/**
 * The corpus-wide mode contracts task 10's done-when names directly:
 * `verbatim` reproduces every corpus input exactly, and `resolved` differs
 * from `canonical` on exactly the corpus's ambiguous inputs — never more,
 * never fewer. Built from the real stages, not `createEngine`, for the same
 * reason `roundtrip.test.ts` is: a failure here names which stage disagreed.
 */

const registry = buildRegistry(BUILTIN_KINDS, [], en.id);
const resolver = createResolver({
  registry,
  locale: en,
  packs: [],
  layers: [en.weights],
});
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale: en, registry });
const parser = new Parser({ resolver });
const solver = new Solver({ registry });
const printer = new Printer({ registry, locale: en });

function buildProgram(input: string): Program {
  return parser.run(tokenizer.run(normalizer.run(input)));
}

/** Every non-comment, non-blank row's input column — see
 * `roundtrip.test.ts`'s identical fixture-loading comment for why
 * `en.tsv` and not `en-complete.tsv`. */
const corpusText = await Bun.file(new URL("../../corpus/en.tsv", import.meta.url)).text();
const CORPUS_INPUTS: string[] = corpusText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.split("\t")[0] ?? "");

test("the corpus fixture is non-empty", () => {
  // Guards against a path typo turning every case below into a vacuous pass.
  expect(CORPUS_INPUTS.length).toBeGreaterThan(20);
});

// --- verbatim: reproduces every corpus input exactly ---------------------

for (const input of CORPUS_INPUTS) {
  test(`verbatim: ${input}`, () => {
    const program = buildProgram(input);
    expect(printer.print(program, { mode: "verbatim" })).toBe(input);
  });
}

// --- resolved: differs from canonical on exactly the ambiguous inputs ---

/**
 * The rows whose tree has a node with more than one candidate reading — six
 * of the 36, one more than the brief's "the thing to settle first" names,
 * because a full scan (not just eyeballing the four length/duration cases)
 * turns up two more: "212 F in C" and "30 C - 20 C", ambiguous between
 * `temperature` and `tempdelta`. Recorded here, not derived from the
 * printer, so this test does not validate the printer against its own
 * output — see `pickCandidate`'s call sites for where each row's ambiguous
 * node lives.
 */
const AMBIGUOUS_INPUTS = new Set([
  "10 m + 5 h",
  "10 m + 5 km",
  "2 km in m",
  "212 F in C",
  "30 C - 20 C",
  "3 m * 4 m",
]);

/**
 * Of those six, only four actually print differently under `resolved` —
 * `temperature` and `tempdelta` share one identical alias table (decorative
 * degree-signed entries included), so no spelling of either distinguishes
 * them and `resolved` correctly prints the same text `canonical` does. See
 * `unitWord`'s doc comment on `ambiguousSurface` for why the fallback is the
 * raw surface and not the unit's normalized alias. This is task 10's
 * done-when, verified against the recorded set above rather than restated.
 */
const EXPECTED_TO_DIFFER = new Set([
  "10 m + 5 h",
  "10 m + 5 km",
  "2 km in m",
  "3 m * 4 m",
]);

test("every ambiguous row this test knows about is still in the corpus", () => {
  // Guards the fixture above against drifting out of sync with `en.tsv` —
  // a row deleted or reworded there would otherwise silently stop being
  // exercised by the loop below.
  const inputs = new Set(CORPUS_INPUTS);
  for (const input of AMBIGUOUS_INPUTS) {
    expect(inputs.has(input)).toBe(true);
  }
});

for (const input of CORPUS_INPUTS) {
  const expectDiffer = EXPECTED_TO_DIFFER.has(input);
  test(`resolved vs canonical: ${input} (expect ${expectDiffer ? "differ" : "match"})`, () => {
    const program = buildProgram(input);
    const resolution = solver.best(program);
    const canonical = printer.print(program, { mode: "canonical" });
    const resolved = printer.print(program, { mode: "resolved", resolution });
    if (expectDiffer) {
      expect(resolved).not.toBe(canonical);
    } else {
      expect(resolved).toBe(canonical);
    }
  });
}

test("resolved differs from canonical on exactly the corpus's expected-to-differ inputs, no others", () => {
  const actuallyDiffered: string[] = [];
  for (const input of CORPUS_INPUTS) {
    const program = buildProgram(input);
    const resolution = solver.best(program);
    const canonical = printer.print(program, { mode: "canonical" });
    const resolved = printer.print(program, { mode: "resolved", resolution });
    if (resolved !== canonical) actuallyDiffered.push(input);
  }
  expect(new Set(actuallyDiffered)).toEqual(EXPECTED_TO_DIFFER);
});
