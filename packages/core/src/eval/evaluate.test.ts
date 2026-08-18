import { expect, test } from "bun:test";
import { english as enLocale } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Decimal } from "../decimal";
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

// --- The derived-unit rewrite (spec §D.2, ruling §D.3) --------------------

/**
 * A speed whose `/` signature declines to choose a unit — it returns the result
 * kind's canonical — beside one that chooses `kph` outright, so both halves of
 * "the plugin's explicit unit wins" have something to be asserted against.
 */
const declining = defineKind({
  id: "speed",
  value: {
    mode: "ratio",
    // Derived rather than restated: the table matches on ratio equality at
    // this repo's 28-digit precision, so a hand-rounded literal would silently
    // fail to match and the test would pass for the wrong reason.
    units: { mps: 1, kph: new Decimal(1000).div(3600) },
    canonical: "mps",
  },
  ops: [
    {
      op: "/",
      left: "length",
      right: "duration",
      result: "speed",
      apply: (l, r) =>
        Object.freeze({
          kind: "speed",
          unit: "mps",
          canonical: l.canonical.div(r.canonical),
        }),
    },
  ],
});
const deciding = defineKind({
  id: "pace",
  value: {
    mode: "ratio",
    units: { mps: 1, kph: new Decimal(1000).div(3600) },
    canonical: "mps",
  },
  ops: [
    {
      op: "/",
      left: "length",
      right: "duration",
      result: "pace",
      apply: (l, r) =>
        Object.freeze({
          kind: "pace",
          unit: "kph",
          canonical: l.canonical.div(r.canonical),
        }),
    },
  ],
});
const derivedRegistry = buildRegistry([number, length, duration, declining], [en]);
const decidedRegistry = buildRegistry([number, length, duration, deciding], [en]);

function evaluateWith(reg: ReturnType<typeof buildRegistry>, input: string) {
  const resolver = createResolver({
    registry: reg,
    locales: [en],
    format: en,
    layers: [],
  });
  const normalized = normalize(input);
  const node = parse(lex(normalized.text, en), resolver, input);
  const program = buildProgram(node, normalized);
  const [best] = solve(program, reg, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode({ program, resolution: best, registry: reg, locale: "en", input });
}

test("a declined result unit is rewritten to the one the operands name", () => {
  const v = evaluateWith(derivedRegistry, "100 km / 2 h");
  expect(v.value.kind).toBe("speed");
  // The magnitude is untouched — canonical is still metres per second — and
  // only the unit the value is *read back in* moves.
  expect(v.value.canonical.toString()).toBe("13.88888888888888888888888889");
  expect(v.value.unit).toBe("kph");
});

test("operands that name no derived unit leave the canonical unit alone", () => {
  // (m, /, s) is metres per second, which the table does know; (km, /, s) is
  // not a unit `speed` has, so there is nothing to rewrite to.
  expect(evaluateWith(derivedRegistry, "100 m / 2 s").value.unit).toBe("mps");
  expect(evaluateWith(derivedRegistry, "100 km / 2 s").value.unit).toBe("mps");
});

test("a signature that chose a unit is not second-guessed", () => {
  // Ruling §D.3: `pace` returns `kph` for every pair, so (m, /, s) — which the
  // table would rewrite to `mps` — has to come back `kph` anyway.
  expect(evaluateWith(decidedRegistry, "100 m / 2 s").value.unit).toBe("kph");
});

// --- The four §D probes, end to end --------------------------------------
//
// The unit tests above run on hand-built kinds; these run on the real ones,
// because §D is a claim about what a person can type, and a table built from
// `length`, `duration` and `speed`'s actual ratios is the only thing that
// proves `mi / h` reaches `mph` without anyone spelling it that way.
const builtins = createEngine({
  locales: [composeLocale(enLocale, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("a compound unit is a conversion target, not only an expression", () => {
  // Three tokens, `km`, `/` and `h`, in a position where a *unit* is required.
  // Before the target chain the parser read the first and left `/ h` to
  // arithmetic, so this failed as *speed in length*.
  expect(builtins.evaluate("(100 km / 2 h) in km/h").value.unit).toBe("kph");
  expect(builtins.evaluate("(100 km / 2 h) in mi / h").value.unit).toBe("mph");
  // A single-unit target is the back-off, and stays what it always was.
  expect(builtins.evaluate("50 km/h in mph").value.unit).toBe("mph");
});

test("a derived result keeps the units the person wrote", () => {
  expect(builtins.evaluate("100 m / 2 s").value.unit).toBe("mps");
  expect(builtins.evaluate("100 km / 2 h").value.unit).toBe("kph");
  expect(builtins.evaluate("100 mi / 2 h").value.unit).toBe("mph");
  expect(builtins.evaluate("100 km / 2 h").formatted).toBe("50 km/h");
  // The magnitude is the number it always was; only the unit it is read back
  // in moved, which is why the corpus rows keep their canonical column.
  expect(builtins.evaluate("100 km / 2 h").value.canonical.toString()).toBe(
    "13.88888888888888888888888889",
  );
});

test("a plugin that chose its own result unit is not second-guessed", () => {
  // `datasize / duration` returns `mbps` outright, and the ratio table would
  // have answered `mbps` for (mb, /, s) by a factor of eight it cannot see —
  // the bit/byte conversion lives in that signature's `apply`, not in a ratio.
  // Ruling §D.3 is what keeps the evaluator's hands off it.
  expect(builtins.evaluate("500 mb / 20 s").value.unit).toBe("mbps");
});

test("the target prune improves the error rather than changing the result set", () => {
  // "m" is a metre and a minute, and the solver enumerated the minute at the
  // target and only found out at the end — so "10 km in m + 5" reported
  // *length and duration*, naming a reading nobody could have meant.
  //
  // Ruling: the prune is an error-quality change, not a semantic one (spec
  // §D.2, "same result set, better error"). There is no `+ | length | number`
  // signature, so this input still fails; what moves is that the failure now
  // names the operator that actually has none.
  expect(builtins.evaluate("10 km in m").value.unit).toBe("m");
  const ex = builtins.explain("10 km in m + 5");
  expect(ex.outcome.status).toBe("error");
  expect(ex.rejections?.map((r) => `${r.op}|${r.left}|${r.right}`)).toEqual([
    "+|length|number",
  ]);
});
