import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import { Evaluator } from "./eval/evaluator";
import { buildRegistry } from "./kind/registry";
import en from "./locale/en";
import { createResolver } from "./parse/candidates";
import { Normalizer } from "./parse/normalize";
import { Parser } from "./parse/program";
import { Tokenizer } from "./parse/tokenizer";
import { Solver } from "./solve/solver-class";
import type { Value } from "./types";

/**
 * The composition test spec §7 asks for and the plan calls "the real
 * deliverable": five stages, assembled by hand, with no `createEngine`
 * anywhere in this file. Every class here — `Normalizer`, `Tokenizer`,
 * `Parser` (plus the `createResolver` its constructor needs), `Solver`,
 * `Evaluator` — is exactly what `packages/core/src/index.ts` already exports;
 * nothing had to be unexported or newly reached into to write this. That is
 * the finding: the decomposition holds.
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
  expect(evaluateByHand(input)).toEqual(engine.evaluate(input).value);
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
