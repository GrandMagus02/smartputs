import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Decimal } from "../decimal";
import { Evaluator } from "../eval/evaluator";
import { DEFAULT_DISPLAY } from "../format/format";
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
  locales: [en],
  format: en,
  layers: [english.weights],
});
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale: en, registry });
const parser = new Parser({ resolver });
const solver = new Solver({ registry });
const evaluator = new Evaluator({ registry, locale: en.id });
const printer = new Printer({ registry, locale: en });
/** What `createEngine` builds — `Result.formatted`'s printer, ruling R-C1. */
const displayPrinter = new Printer({ registry, locale: en, display: DEFAULT_DISPLAY });

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

/**
 * Ruling R-C1's cost, named where a reader will meet it.
 *
 * `Result.formatted` is a readability policy now, so the exact
 * `parse(format(v)) === v` equality no longer holds of it: "1.5 kg in lb"
 * prints 3.3069 pounds and reads back as a slightly different number of grams.
 * The guard that equality exists for is `formatPrecision`, and it is still
 * exact — every `round-trip:` case above is that guard, printed through the
 * default `Printer` at DISPLAY_PRECISION.
 *
 * What survives for `formatted` is the weaker property that actually matters
 * to a person: displaying is idempotent. Whatever the display printer wrote,
 * reading it back and displaying it again writes the same string, so a value
 * copied out of one answer and pasted into the next input does not drift.
 * `moved` is the non-vacuity check: at least one corpus row genuinely loses
 * digits to the policy, or this test would be asserting nothing.
 */
test("R-C1: display round-trips at display precision; the guard stays exact", () => {
  let moved = 0;
  for (const row of CORPUS_ROWS) {
    const original = evaluateProgram(buildProgram(row.input));
    const guarded = printer.value(original);
    const shown = displayPrinter.value(original);
    if (shown !== guarded) moved += 1;
    const reread = evaluateProgram(buildProgram(shown));
    expect(displayPrinter.value(reread), row.input).toBe(shown);
  }
  expect(moved).toBeGreaterThan(0);
});
