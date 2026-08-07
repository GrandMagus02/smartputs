import { expect, test } from "bun:test";
import { Evaluator } from "@smartput/core/eval";
import { Normalizer } from "@smartput/core/normalize";
import { Parser } from "@smartput/core/parse";
import { buildRegistry, createResolver } from "@smartput/core/registry";
import { Solver } from "@smartput/core/solve";
import { Tokenizer } from "@smartput/core/tokenize";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english } from "@smartput/locale-en";
import { createEngine } from "./engine";
import { composeLocale } from "./locale/compose";
import type { Value } from "./types";

const en = composeLocale(english, BUILTIN_EN);

/**
 * The composition test spec §7 asks for and the plan calls "the real
 * deliverable": five stages, assembled by hand, with no `createEngine`
 * anywhere in this file.
 *
 * Every name the hand-built pipeline is made of is publicly reachable:
 * `Normalizer`, `Tokenizer`, `Parser`, `Solver` and `Evaluator` are each
 * their own subpath (spec §6), `Parser`'s one required config field — a
 * `Resolver`, which nothing but `createResolver` constructs — comes from
 * `@smartput/core/registry`, and the language it all runs against comes from
 * `@smartput/locale-en` rather than a relative import. That registry
 * subpath is what closes the gap this test used to record: before Task 12,
 * `createResolver` and the `Resolver` type were exported from neither
 * `index.ts` nor any subpath, and this file reached into `./parse/candidates`
 * with a relative import to get them — not the barrel, and not anything a
 * package outside `packages/core` could import at all.
 *
 * The two imports below that do stay relative are not part of the pipeline
 * under test: `createEngine` is the oracle every hand-built pipeline is
 * checked against, never a step in one, and `Value` is a type, compiled away
 * before anything ships. Both are reachable from the root barrel too
 * (`@smartput/core` and `export type * from "./types"` respectively) — the
 * relative path is a convenience inside this package, not a gap in it.
 */

const registry = buildRegistry(BUILTIN_KINDS, [en]);
const resolver = createResolver({
  registry,
  locale: en,

  layers: [english.weights],
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
  const value = evaluateByHand(input);
  expect(value).toEqual(engine.evaluate(input).value);
  // An absolute assertion, not just an equality with the oracle — see the
  // binary-expression test below for why a regression shared by both sides
  // would otherwise slip through.
  expect(value.kind).toBe("mass");
  expect(value.unit).toBe("kg");
  expect(value.canonical.toString()).toBe("1000");
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
  const value = evaluateByHand(input);
  expect(value).toEqual(engine.evaluate(input).value);
  // An absolute assertion, not just an equality with the oracle — see the
  // binary-expression test above for why a regression shared by both sides
  // would otherwise slip through.
  expect(value.kind).toBe("length");
  expect(value.unit).toBe("m");
  expect(value.canonical.toString()).toBe("2000");
});

test("the hand-built pipeline is not vacuously equal to itself", () => {
  // Guards against a pipeline bug that happens to reproduce createEngine's
  // Value for the wrong reason: two genuinely different inputs must not
  // collapse to the same result.
  expect(evaluateByHand("1 kg")).not.toEqual(evaluateByHand("2 km in m"));
});
