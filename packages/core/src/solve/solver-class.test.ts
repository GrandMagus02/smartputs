import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english } from "@smartput/locale-en";
import { AmbiguityError, TooAmbiguousError } from "../errors";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import { Solver } from "./solver-class";

const en = composeLocale(english, BUILTIN_EN);

const registry = buildRegistry(BUILTIN_KINDS, [en]);
const resolver = createResolver({
  registry,
  locale: en,

  layers: [english.weights],
});

const programFor = (source: string) => {
  const input = normalize(source);
  return buildProgram(parse(lex(input.text, en), resolver, source), input);
};

const solver = new Solver({ registry });

test("choices are keyed by node id, so a resolution is JSON-serializable", () => {
  const program = programFor("1 kg + 500 g");
  const [best] = solver.all(program);
  expect(best).toBeDefined();
  if (best === undefined) return;
  // Round-tripping through JSON must reproduce `choices` exactly. Under the
  // old Map<Node, Candidate> design `JSON.stringify(map)` was always `"{}"`,
  // so comparing the round-trip to itself would have passed either way —
  // comparing it to the original is what actually exercises the re-key.
  expect(JSON.parse(JSON.stringify(best.choices))).toEqual(best.choices);
  for (const key of Object.keys(best.choices)) {
    expect(program.nodes[Number(key)]).toBeDefined();
  }
});

test("choices iterate in ascending node-id order", () => {
  // Object.values(resolution.choices) is what every reader (solve()'s own
  // tie-break sort, engine.ts's explain()/ambiguity paths) relies on standing
  // in for the old Map's insertion order. "1 kg + 500 g" has two quantity
  // slots, so this is not vacuously true for a single-slot input.
  const program = programFor("1 kg + 500 g");
  const [best] = solver.all(program);
  expect(best).toBeDefined();
  if (best === undefined) return;
  const ids = Object.keys(best.choices).map(Number);
  expect(ids.length).toBeGreaterThan(1);
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
  for (let i = 1; i < ids.length; i += 1) {
    expect((ids[i] as number) > (ids[i - 1] as number)).toBe(true);
  }
});

test("all() is ranked and never throws on ambiguity", () => {
  const all = solver.all(programFor("10 m"));
  expect(all.length).toBeGreaterThan(1);
  for (let i = 1; i < all.length; i += 1) {
    expect((all[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
      (all[i] as { score: number }).score,
    );
  }
});

test("best() applies the epsilon and throws AmbiguityError", () => {
  expect(() => solver.best(programFor("10 m"))).toThrow(AmbiguityError);
});

test("tiebreak: first returns the top candidate instead of throwing", () => {
  const lenient = new Solver({ registry, tiebreak: "first" });
  expect(lenient.best(programFor("10 m")).kind).toBeDefined();
});

test("ambiguityEpsilon: 0 never treats a softmax gap as a tie", () => {
  // "10 m" is the fixture that ties at the default epsilon (see the throwing
  // test above). Two distinct scores always leave a positive gap between
  // their softmax confidences, so an epsilon of 0 — read correctly, not left
  // on the 0.05 default — must never call that gap a tie.
  const decisive = new Solver({ registry, ambiguityEpsilon: 0 });
  expect(() => decisive.best(programFor("10 m"))).not.toThrow();
});

test("maxCandidates throws TooAmbiguousError when the search space is too large", () => {
  // "10 m" has one slot with two candidates (duration, length): a search
  // space of 2. maxCandidates: 1 must reject it before any scoring happens —
  // solve() itself is what raises TooAmbiguousError, not the Solver.
  const strict = new Solver({ registry, maxCandidates: 1 });
  expect(() => strict.all(programFor("10 m"))).toThrow(TooAmbiguousError);
});

test("best() does not throw when the winner is clear", () => {
  expect(solver.best(programFor("1 kg + 500 g")).kind).toBe("mass");
});

test("forKind() finds a resolution by result kind, or returns undefined", () => {
  const program = programFor("10 m");
  expect(solver.forKind(program, "length")?.kind).toBe("length");
  expect(solver.forKind(program, "duration")?.kind).toBe("duration");
  expect(solver.forKind(program, "money")).toBeUndefined();
});

test("the solver instance is frozen and stateless across runs", () => {
  expect(Object.isFrozen(solver)).toBe(true);
  const program = programFor("1 kg + 500 g");
  expect(solver.all(program)).toEqual(solver.all(program));
});

test("resolutions are frozen", () => {
  const all = solver.all(programFor("1 kg"));
  // The array container itself, not just each element: `all[0] = fake` must
  // fail too, or a mutable container of frozen elements would still let a
  // caller swap in a whole different resolution.
  expect(Object.isFrozen(all)).toBe(true);
  const [best] = all;
  expect(best).toBeDefined();
  expect(Object.isFrozen(best)).toBe(true);
  // The nested freeze is what actually carries "a resolution is a value" —
  // a frozen Resolution whose `choices` record could still be mutated in
  // place would only look immutable.
  expect(Object.isFrozen(best?.choices)).toBe(true);
});
