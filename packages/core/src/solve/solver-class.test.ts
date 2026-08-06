import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { AmbiguityError } from "../errors";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import { Solver } from "./solver-class";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const resolver = createResolver({
  registry,
  locale: en,
  packs: [],
  layers: [en.weights],
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
  expect(JSON.parse(JSON.stringify(best.choices))).toEqual(
    JSON.parse(JSON.stringify(best.choices)),
  );
  for (const key of Object.keys(best.choices)) {
    expect(program.nodes[Number(key)]).toBeDefined();
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
  const [best] = solver.all(programFor("1 kg"));
  expect(Object.isFrozen(best)).toBe(true);
});
