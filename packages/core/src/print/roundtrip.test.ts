import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english } from "@smartput/locale-en";
import { Decimal } from "../decimal";
import { Evaluator } from "../eval/evaluator";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser, type Program } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import type { Value } from "../types";
import { Printer } from "./print";

const en = composeLocale(english, BUILTIN_EN);

/**
 * Spec §4.6's round-trip contract: for every input in the corpus,
 * `parse(print(program, { mode: "canonical" }))` evaluates to the same
 * `Value`. Built from the five real stages, never `createEngine` — so a
 * failure here names which stage disagreed, the same reasoning
 * `stages.test.ts`'s composition test gives for staying off the engine.
 */

const registry = buildRegistry(BUILTIN_KINDS, [en]);
const resolver = createResolver({
  registry,
  locale: en,
  packs: [],
  layers: [english.weights],
});
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale: en, registry });
const parser = new Parser({ resolver });
const solver = new Solver({ registry });
const evaluator = new Evaluator({ registry, locale: en.id });
const printer = new Printer({ registry, locale: en });

function buildProgram(input: string): Program {
  return parser.run(tokenizer.run(normalizer.run(input)));
}

function evaluateProgram(program: Program): Value {
  const resolution = solver.best(program);
  return evaluator.run(program, resolution).value;
}

interface CorpusRow {
  readonly input: string;
  /** Column 2, `corpus/en.tsv`'s header row: `input kind canonical formatted`.
   * The independent anchor a `toEqual(original)` comparison alone doesn't
   * give: that assertion proves print and parse agree with each other, which
   * a bug in *either* — moving both sides equally, such as a parser change
   * that reads a literal one digit short on both the original and the
   * reprinted text — would still pass. Checking the corpus's own recorded
   * value is what catches that class of bug. */
  readonly canonical: string;
}

/** Every non-comment, non-blank row of `corpus/en.tsv` — the inputs the
 * round-trip contract governs. Not `parity.ts`'s `INPUTS`: that list also
 * walks `en-complete.tsv`, whose rows are completion fragments, not full
 * expressions, and have no `Value` to round-trip against. */
const corpusText = await Bun.file(new URL("../../corpus/en.tsv", import.meta.url)).text();
const CORPUS_ROWS: CorpusRow[] = corpusText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => {
    const cols = l.split("\t");
    // `?? ""` rather than `as string`: noUncheckedIndexedAccess is correct
    // that `cols[n]` could be undefined in general, even though the filter
    // above rules it out for a well-formed, non-empty, tab-separated row.
    return { input: cols[0] ?? "", canonical: cols[2] ?? "" };
  });

test("the corpus fixture is non-empty", () => {
  // Guards against a path typo turning every case below into a vacuous pass.
  expect(CORPUS_ROWS.length).toBeGreaterThan(20);
});

for (const row of CORPUS_ROWS) {
  test(`round-trip: ${row.input}`, () => {
    const program = buildProgram(row.input);
    const original = evaluateProgram(program);
    // The corpus's own recorded value — see `CorpusRow.canonical`'s doc
    // comment for why this, and not just the reprint-and-compare below, is
    // load-bearing.
    expect(original.canonical.equals(new Decimal(row.canonical))).toBe(true);

    const printed = printer.print(program, { mode: "canonical" });
    const reprogram = buildProgram(printed);
    const roundtripped = evaluateProgram(reprogram);

    expect(roundtripped).toEqual(original);
  });
}
