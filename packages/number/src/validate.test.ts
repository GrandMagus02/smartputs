import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { toCanonical } from "@smartput/shared";
import { number } from "./index";
import { NUMBER_UNITS, type NumberUnit } from "./units";
import {
  addNumber,
  compareNumber,
  equalsNumber,
  formatNumber,
  isNumber,
  negateNumber,
  parseNumber,
  patternForNumber,
  scaleNumber,
  subNumber,
  toNumber,
} from "./validate";

const units = Object.keys(NUMBER_UNITS.ratio) as NumberUnit[];

test("valid and invalid input", () => {
  // The one thing this kind is for: a bare number, no unit word at all.
  expect(parseNumber("30")).toMatchObject({ ok: true, value: 30, unit: "one" });
  expect(parseNumber("3.5")).toMatchObject({ ok: true, value: 3.5, unit: "one" });
  // Spelled out, it still resolves — the self-alias `units.ts` carries.
  expect(parseNumber("30one")).toMatchObject({ ok: true, value: 30, unit: "one" });
  // A unit word from another kind is still `unknown-unit`, defaultUnit or not.
  expect(parseNumber("30kg")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseNumber("kg")).toMatchObject({ ok: false, code: "nan" });
  expect(parseNumber("")).toMatchObject({ ok: false, code: "empty" });
});

test("native mode reads the leading number and ignores what follows it", () => {
  // The case this mode exists for: a number that arrives already formatted,
  // from a form field, a CSV cell or an API that spells its own unit.
  expect(parseNumber("20%", { mode: "native" })).toMatchObject({
    ok: true,
    value: 20,
    unit: "one",
  });
  // Another kind's unit word is not an error here — it is trailing text, the
  // same as any other. This is exactly the contract loose mode refuses.
  expect(parseNumber("30kg", { mode: "native" })).toMatchObject({
    ok: true,
    value: 30,
  });
  expect(parseNumber("  1.5e3 apples ", { mode: "native" })).toMatchObject({
    ok: true,
    value: 1500,
  });
});

test("native mode is native, not clever", () => {
  // `parseFloat("1,234")` is 1, and so is this. A thousands separator needs
  // the locale's numberFormat, which is the engine's job — the same line
  // `parse`'s NUMBER regex already draws.
  expect(parseNumber("1,234", { mode: "native" })).toMatchObject({
    ok: true,
    value: 1,
  });
  // Nothing numeric to read is still the error it always was, named the same
  // way: native mode widens what counts as a number, not what counts as one.
  expect(parseNumber("kg", { mode: "native" })).toMatchObject({
    ok: false,
    code: "nan",
  });
  expect(parseNumber("", { mode: "native" })).toMatchObject({
    ok: false,
    code: "empty",
  });
});

test("native mode is opt-in: the default modes are untouched", () => {
  expect(parseNumber("20%")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseNumber("30kg")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(isNumber("20%")).toBe(false);
  expect(isNumber("20%", { mode: "native" })).toBe(true);
});

test("defaultUnit composes with caller opts: forced, not erasable, mode still overrides", () => {
  // Loose (the default) needs no unit at all.
  expect(parseNumber("30")).toMatchObject({ ok: true, unit: "one" });
  // Strict mode still round-trips a value that spells its unit out...
  expect(parseNumber("30one", { mode: "strict" })).toMatchObject({
    ok: true,
    unit: "one",
  });
  // ...but a bare number in strict mode is `missing-unit`, defaultUnit or
  // not: `parse`'s strict mode has no bare-number fallback regardless of
  // what `defaultUnit` names (packages/shared/src/parse.ts's
  // `word.length === 0` branch forces `fallback` to `undefined` whenever
  // `strict` is true). Hardcoding `defaultUnit: "one"` cannot and does not
  // change that — only loose mode gets the free pass, and loose is what a
  // caller gets unless they explicitly ask for strict.
  expect(parseNumber("30", { mode: "strict" })).toMatchObject({
    ok: false,
    code: "missing-unit",
  });
  // Other opts fields still pass through untouched alongside the hardcoded
  // default.
  expect(parseNumber("30", { unit: "one" })).toMatchObject({ ok: true, unit: "one" });
});

test("ops work on raw strings without any unit written", () => {
  expect(addNumber("3", "4")).toMatchObject({ ok: true, value: 7, unit: "one" });
});

test("round-trip: parse(format(parse(s))) is parse(s), in strict mode", () => {
  for (const unit of units) {
    for (const n of ["1", "30.5", "-7", "0.25"]) {
      const first = parseNumber(`${n}${unit}`);
      expect(first.ok, `${n}${unit}`).toBe(true);
      if (!first.ok) continue;
      expect(parseNumber(formatNumber(first), { mode: "strict" })).toEqual(first);
    }
  }
});

test("conversion identity: the one unit converts to itself, exactly", () => {
  for (const unit of units) {
    expect(toNumber(`7${unit}`, unit), unit).toBe(7);
  }
});

test("cross-path agreement: the micro path matches the engine's canonical value", () => {
  const engine = createEngine({ locales: [en], kinds: [number] });
  for (const n of ["1", "30.5", "0.25", "7"]) {
    const parsed = parseNumber(n);
    expect(parsed.ok, n).toBe(true);
    if (!parsed.ok) continue;
    const micro = toCanonical(NUMBER_UNITS, parsed.value, parsed.unit);
    const engineValue = engine.evaluate(n).value.canonical.toNumber();
    expect(micro, n).toBeCloseTo(engineValue, 9);
  }
});

// Unlike every other kind, `1one` is not a form the engine ever matches: a
// bare numeral becomes a "number" AST node in the grammar itself
// (evaluate.ts's `case "number"`), never a literal-matcher lookup against
// this kind's lexicon, and the word "one" is claimed first by the numeral
// tokenizer's own cardinal-word support (`@smartput/number`'s
// `numberFromWords`) — "7 one" reads as two adjacent numbers with no
// operator between them, a syntax error. `units.ts`'s self-alias exists
// only so the micro path's `format`/`parse` round-trip; the engine was never
// going to see it, with or without it in the table.
test("the self-alias is inert on the engine path, by design", () => {
  expect(parseNumber("1one")).toMatchObject({ ok: true, unit: "one" });
  const engine = createEngine({ locales: [en], kinds: [number] });
  expect(() => engine.evaluate("1one")).toThrow();
});

test("the remaining wrappers are wired to the right table", () => {
  expect(subNumber("30", "12")).toMatchObject({ ok: true, value: 18, unit: "one" });
  expect(scaleNumber("30", 2)).toMatchObject({ ok: true, value: 60, unit: "one" });
  expect(negateNumber("30")).toMatchObject({ ok: true, value: -30, unit: "one" });
  expect(equalsNumber("30", "30.0")).toBe(true);
  expect(compareNumber("1", "2")).toBe(-1);
  expect(formatNumber({ ok: true, value: 30, unit: "one", raw: "30" })).toBe("30one");
});

// Unlike angle, the pattern and `isNumber` do not fully agree — and
// `pattern.ts` says so itself: "the unit is required... a table cannot know
// whether `defaultUnit` was set." A pattern that guessed a bare number was
// fine would pass any table's `30` through native form validation even for
// tables whose parser rejects it, so `patternFor` never emits that branch.
// Wherever a unit is written out, the two agree exactly.
test("the emitted pattern requires a unit; isNumber accepts a bare number via defaultUnit", () => {
  const strictRe = new RegExp(`^(?:${patternForNumber({ mode: "strict" })})$`, "v");
  const looseRe = new RegExp(`^(?:${patternForNumber({ mode: "loose" })})$`, "v");

  expect(strictRe.test("30one")).toBe(isNumber("30one", { mode: "strict" }));
  expect(looseRe.test("30one")).toBe(isNumber("30one", { mode: "loose" }));
  expect(looseRe.test("30ONE")).toBe(isNumber("30ONE", { mode: "loose" }));
  expect(strictRe.test("30kg")).toBe(isNumber("30kg", { mode: "strict" }));

  expect(strictRe.test("30")).toBe(false);
  expect(looseRe.test("30")).toBe(false);
  expect(isNumber("30")).toBe(true);
});

test("contract: units.ts and the descriptor agree on every key and alias", () => {
  const declared = Object.keys((number.value as { units: object }).units).sort();
  expect(declared).toEqual(Object.keys(NUMBER_UNITS.ratio).sort());

  const lexicon = number.lexicon ?? {};
  const seen = new Set<string>();
  for (const [unit, lexeme] of Object.entries(lexicon)) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) {
      expect(NUMBER_UNITS.alias[a], `${a} must be in units.ts`).toBe(unit as NumberUnit);
      seen.add(a);
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(NUMBER_UNITS.alias).sort());
});

test("contract: the descriptor's ratios are the table's strings, digit for digit", () => {
  const declared = (number.value as { units: Record<string, { toString(): string }> })
    .units;
  for (const [unit, ratio] of Object.entries(NUMBER_UNITS.ratio)) {
    expect(declared[unit]?.toString(), unit).toBe(ratio as string);
  }
});
