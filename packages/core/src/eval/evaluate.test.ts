import { expect, test } from "bun:test";
import { english as enLocale } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "../engine";
import { DivideByZeroError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import { solve } from "../solve/solver";
import { evaluateNode } from "./evaluate";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { s: 1, min: 60, h: 3600 } },
});

// `m` deliberately names both length's metre and duration's minute: half these
// tests are about the solver choosing between them, so the ambiguity has to be
// declared rather than inherited from the unit keys.
const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in"], of: ["of"] },
    selectForm: () => "other",
  }),
  [
    defineVocabulary({
      locale: "en",
      kind: "length",
      units: { m: { aliases: ["m"] }, km: { aliases: ["km"] } },
    }),
    defineVocabulary({
      locale: "en",
      kind: "duration",
      units: {
        min: { aliases: ["min", "m"] },
        h: { aliases: ["h"] },
        s: { aliases: ["s"] },
      },
    }),
  ],
);
const registry = buildRegistry([number, length, duration], [en]);

function evaluate(input: string) {
  const resolver = createResolver({ registry, locales: [en], format: en, layers: [] });
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const [best] = solve(program, registry, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode({ program, resolution: best, registry, locale: "en", input });
}

test("evaluates a single quantity in its authored unit", () => {
  const v = evaluate("10 km");
  expect(v.value.kind).toBe("length");
  expect(v.value.unit).toBe("km");
  expect(v.value.canonical.toString()).toBe("10000");
});

test("addition keeps the left operand's unit", () => {
  const v = evaluate("1 km + 500 m");
  expect(v.value.unit).toBe("km");
  expect(v.value.canonical.toString()).toBe("1500");
});

test("subtraction across duration units", () => {
  const v = evaluate("30 h - 30 min");
  expect(v.value.unit).toBe("h");
  expect(v.value.canonical.toString()).toBe("106200");
});

test("context-resolved ambiguity evaluates as duration", () => {
  const v = evaluate("10 m + 5 h");
  expect(v.value.kind).toBe("duration");
  expect(v.value.canonical.toString()).toBe("18600");
});

test("scaling by a number", () => {
  expect(evaluate("10 km * 3").value.canonical.toString()).toBe("30000");
});

test("conversion rebases the unit without changing the quantity", () => {
  const v = evaluate("2 km in m");
  expect(v.value.unit).toBe("m");
  expect(v.value.canonical.toString()).toBe("2000");
});

test("unary minus negates", () => {
  expect(evaluate("-5 km").value.canonical.toString()).toBe("-5000");
});

test("plain arithmetic on numbers", () => {
  expect(evaluate("(1 + 2) * 3").value.canonical.toString()).toBe("9");
});

test("division by zero throws", () => {
  expect(() => evaluate("10 km / 0")).toThrow(DivideByZeroError);
});

test("values are frozen", () => {
  expect(Object.isFrozen(evaluate("10 km").value)).toBe(true);
});

test("evaluateNode collects the assumption of every signature it applies", () => {
  const noted = defineKind({
    id: "length",
    extendsKind: "length",
    value: { mode: "ratio", canonical: "m", units: {} },
    ops: [
      {
        op: "of",
        left: "number",
        right: "length",
        result: "length",
        assumption: { code: "scale-factor", message: "read as a scale factor" },
        apply: (l, r) =>
          Object.freeze({ ...r, canonical: r.canonical.times(l.canonical) }),
      },
    ],
  });
  const r = buildRegistry([number, length, duration, noted]);
  const resolver = createResolver({ registry: r, locales: [en], format: en, layers: [] });
  const input = "2 of 10 km";
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const [best] = solve(program, r, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");

  const out = evaluateNode({
    program,
    resolution: best,
    registry: r,
    locale: "en",
    input,
  });
  expect(out.value.canonical.toString()).toBe("20000");
  expect(out.assumptions).toEqual([
    { code: "scale-factor", message: "read as a scale factor" },
  ]);
});

test("a plain expression records no assumptions", () => {
  expect(evaluate("1 km + 500 m").assumptions).toEqual([]);
});

// A kind whose `+` records an assumption naming its own operands — the shape
// money's cross-rate needs, where the detail is known only per expression.
//
// Its own locale, with no vocabulary: `en` above speaks for length and
// duration, and installing a vocabulary for a kind an engine does not register
// is a wiring error. `gld`/`slv` are typeable regardless — R2 indexes every
// unit under its own key.
const bare = composeLocale(en.language);

const dynamicallyNoted = defineKind({
  id: "treasure",
  value: { mode: "ratio", canonical: "gld", units: { gld: 1, slv: 0.5 } },
  ops: [
    {
      op: "+",
      left: "treasure",
      right: "treasure",
      result: "treasure",
      apply: (l, r, ctx) => {
        ctx.note?.({
          code: "melted-down",
          message: `${l.unit} and ${r.unit} were melted into one ingot`,
          detail: { from: l.unit, to: r.unit, via: "gld" },
        });
        return Object.freeze({
          kind: l.kind,
          canonical: l.canonical.plus(r.canonical),
          unit: l.unit,
        });
      },
    },
  ],
});

test("an op can record an assumption dynamically through the context sink", () => {
  const e = createEngine({
    locales: [bare],
    kinds: [number, dynamicallyNoted],
  });
  const r = e.evaluate("10 gld + 4 slv");
  expect(r.meta.assumptions).toHaveLength(1);
  expect(r.meta.assumptions[0]?.code).toBe("melted-down");
  expect(r.meta.assumptions[0]?.detail?.via).toBe("gld");
  expect(r.meta.assumptions[0]?.message).toBe("gld and slv were melted into one ingot");
});

test("the same assumption recorded twice is kept once", () => {
  const e = createEngine({
    locales: [bare],
    kinds: [number, dynamicallyNoted],
  });
  // Two additions, identical operand units, so both notes serialize the same.
  expect(e.evaluate("1 gld + 2 gld + 3 gld").meta.assumptions).toHaveLength(1);
});

test("a value's meta is frozen, not just the value", () => {
  const engine = createEngine({
    locales: [composeLocale(enLocale)],
    kinds: BUILTIN_KINDS,
    kindMeta: { mass: { note: "x" } },
  });
  const v = engine.evaluate("1 kg").value;
  expect(Object.isFrozen(v)).toBe(true);
  expect(Object.isFrozen(v.meta)).toBe(true);
});
