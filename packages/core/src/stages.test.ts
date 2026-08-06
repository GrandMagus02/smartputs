import { expect, test } from "bun:test";
import { Evaluator } from "@smartput/core/eval";
import { Normalizer } from "@smartput/core/normalize";
import { Parser } from "@smartput/core/parse";
import { buildRegistry, createResolver } from "@smartput/core/registry";
import { Solver } from "@smartput/core/solve";
import { Tokenizer } from "@smartput/core/tokenize";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import en from "./locale/en";
import type { Value } from "./types";

/**
 * The composition test spec §7 asks for and the plan calls "the real
 * deliverable": five stages, assembled by hand, with no `createEngine`
 * anywhere in this file.
 *
 * Every import above is a public entry point a package outside `packages/
 * core` could use too: `Normalizer`, `Tokenizer`, `Parser`, `Solver` and
 * `Evaluator` are each their own subpath (spec §6), and `Parser`'s one
 * required config field — a `Resolver`, which nothing but `createResolver`
 * constructs — comes from `@smartput/core/registry`. That subpath is what
 * closes the gap this test used to record: before Task 12, `createResolver`
 * and the `Resolver` type were exported from neither `index.ts` nor any
 * subpath, and this file reached into `./parse/candidates` with a relative
 * import to get them — not the barrel, and not anything a package outside
 * `packages/core` could import at all. Nothing here reaches around the
 * package boundary anymore.
 *
 * `createEngine` below exists only as the oracle each hand-built pipeline is
 * checked against, over the same input, never as part of the pipeline itself.
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
const evaluator = new Evaluator({ registry, locale: en.id });

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

function evaluateByHand(input: string): Value {
  const normalized = normalizer.run(input);
  const stream = tokenizer.run(normalized);
  const program = parser.run(stream);
  const resolution = solver.best(program);
  return evaluator.run(program, resolution).value;
}

test("a plain quantity: the hand-built pipeline matches createEngine", () => {
  const input = "1 kg";
  expect(evaluateByHand(input)).toEqual(engine.evaluate(input).value);
});

test("a binary expression: the hand-built pipeline matches createEngine", () => {
  const input = "1 kg + 500 g";
  const value = evaluateByHand(input);
  expect(value).toEqual(engine.evaluate(input).value);
  // An absolute assertion, not just an equality with the oracle: a regression
  // shared by both the hand-built pipeline and createEngine (e.g. a bug in
  // Evaluator itself) would still pass the toEqual check above. 1 kg + 500 g
  // is 1500 (canonical grams) reported in the left operand's unit, "kg".
  expect(value.kind).toBe("mass");
  expect(value.unit).toBe("kg");
  expect(value.canonical.toString()).toBe("1500");
});

test("a convert: the hand-built pipeline matches createEngine", () => {
  const input = "2 km in m";
  expect(evaluateByHand(input)).toEqual(engine.evaluate(input).value);
});

test("the hand-built pipeline is not vacuously equal to itself", () => {
  // Guards against a pipeline bug that happens to reproduce createEngine's
  // Value for the wrong reason: two genuinely different inputs must not
  // collapse to the same result.
  expect(evaluateByHand("1 kg")).not.toEqual(evaluateByHand("2 km in m"));
});
