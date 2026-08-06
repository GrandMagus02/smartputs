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
 * Whether any node in `program` has more than one candidate reading —
 * derived from the tree itself (`Program.nodes`, the flat id-indexed array,
 * so no recursive walk is needed) rather than a hand-maintained list, so a
 * row that stopped being ambiguous (or started being ambiguous) would move
 * itself in or out of `AMBIGUOUS_INPUTS` below instead of leaving a stale
 * assertion that still passes for the wrong reason.
 */
function hasAmbiguousNode(program: Program): boolean {
  return program.nodes.some((node) => {
    if (node.type === "quantity" || node.type === "literal") {
      return node.candidates.length > 1;
    }
    if (node.type === "convert") return node.target.length > 1;
    return false;
  });
}

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

/** The rows `hasAmbiguousNode` finds — six of the 36, one more than the
 * brief's "the thing to settle first" names, because a full scan (not just
 * eyeballing the four length/duration cases) turns up two more:
 * "212 F in C" and "30 C - 20 C", ambiguous between `temperature` and
 * `tempdelta`. Cross-checked against the derivation below, not asserted on
 * its own, so a row silently becoming (or ceasing to be) ambiguous shows up
 * as a mismatch instead of leaving this comment quietly wrong. */
const EXPECTED_AMBIGUOUS = new Set([
  "10 m + 5 h",
  "10 m + 5 km",
  "2 km in m",
  "212 F in C",
  "30 C - 20 C",
  "3 m * 4 m",
]);

const AMBIGUOUS_INPUTS = CORPUS_INPUTS.filter((input) =>
  hasAmbiguousNode(buildProgram(input)),
);

test("hasAmbiguousNode finds exactly the rows this file expects to be ambiguous", () => {
  expect(new Set(AMBIGUOUS_INPUTS)).toEqual(EXPECTED_AMBIGUOUS);
});

/**
 * Of those six, only four actually print differently under `resolved` —
 * `temperature` and `tempdelta` share one identical alias table (decorative
 * degree-signed entries included), so no spelling of either distinguishes
 * them and `resolved` correctly prints the same text `canonical` does. See
 * `unitWord`'s doc comment on `ambiguousSurface` for why the fallback is the
 * raw surface and not the unit's normalized alias.
 *
 * Each of the four is pinned to its exact resolved text, not just "differs
 * from canonical" — a printer that substituted the wrong candidate, or the
 * wrong spelling of the right one, would still pass a bare `not.toBe` check.
 * This is task 10's done-when.
 */
const EXPECTED_TO_DIFFER: Readonly<Record<string, string>> = {
  "10 m + 5 h": "10 min + 5 h",
  "10 m + 5 km": "10 metre + 5 km",
  "2 km in m": "2 km in metre",
  "3 m * 4 m": "3 metre * 4 metre",
};

for (const input of CORPUS_INPUTS) {
  const expected = EXPECTED_TO_DIFFER[input];
  test(`resolved vs canonical: ${input} (expect ${expected !== undefined ? "differ" : "match"})`, () => {
    const program = buildProgram(input);
    const resolution = solver.best(program);
    const canonical = printer.print(program, { mode: "canonical" });
    const resolved = printer.print(program, { mode: "resolved", resolution });
    if (expected !== undefined) {
      expect(resolved).toBe(expected);
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
  expect(new Set(actuallyDiffered)).toEqual(new Set(Object.keys(EXPECTED_TO_DIFFER)));
});
