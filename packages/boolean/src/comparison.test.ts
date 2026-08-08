import { expect, test } from "bun:test";
import {
  composeLocale,
  createEngine,
  DimensionMismatchError,
  type Engine,
} from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Bool, truthOf } from "./index";

const engine: Engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

const truth = (input: string, e: Engine = engine): boolean | null =>
  truthOf(e.evaluate(input).value);

/**
 * The sentence that motivated the feature, and the mechanism it demonstrates.
 *
 * There is no cross-unit rule anywhere in this package. `mb` and `gb` are both
 * `datasize`, the solver unifies them the way it unifies `1 kg + 500 g`, and
 * the comparison runs over canonical bytes. A megabyte being 10^6 and a
 * gigabyte 10^9 is `@smartput/datasize`'s table talking, not this one's.
 */
test("1000 mb = 1 gb", () => {
  expect(truth("1000 mb = 1 gb")).toBe(true);
  expect(truth("1000 mb == 1 gb")).toBe(true);
  expect(truth("999 mb = 1 gb")).toBe(false);
  expect(truth("1000 mb != 1 gb")).toBe(false);
});

test("the binary prefixes are a different table and compare as one", () => {
  expect(truth("1024 mib = 1 gib")).toBe(true);
  expect(truth("1000 mib = 1 gib")).toBe(false);
  expect(truth("1 gib > 1 gb")).toBe(true);
});

test("bare numbers compare", () => {
  expect(truth("5 > 3")).toBe(true);
  expect(truth("5 < 3")).toBe(false);
  expect(truth("3 >= 3")).toBe(true);
  expect(truth("3 <= 3")).toBe(true);
  expect(truth("3 != 3")).toBe(false);
  expect(truth("2 + 2 = 4")).toBe(true);
});

test("every kind that has a magnitude compares", () => {
  expect(truth("1 kg > 500 g")).toBe(true);
  expect(truth("1000 g = 1 kg")).toBe(true);
  expect(truth("1 h > 59 min")).toBe(true);
  // Spelled "25.4 mm" rather than "1 in": `in` is the conversion keyword as
  // well as the inch alias, and that collision predates comparison.
  expect(truth("2.54 cm = 25.4 mm")).toBe(true);
  expect(truth("90 deg = 0.25 turn")).toBe(true);
  expect(truth("50% > 25%")).toBe(true);
});

test("the mathematical spellings are the same operators", () => {
  expect(truth("3 ≥ 3")).toBe(true);
  expect(truth("3 ≤ 2")).toBe(false);
  expect(truth("3 ≠ 4")).toBe(true);
  expect(truth("3 <> 4")).toBe(true);
});

/**
 * Ruling C2. Conversion binds tighter than comparison, so the conversion runs
 * and its result is what gets compared — which is the only reading of the
 * sentence anyone means.
 */
test("conversion binds tighter than comparison", () => {
  expect(truth("1 kg in g > 500 g")).toBe(true);
  expect(truth("1 kg in g > 5000 g")).toBe(false);
});

test("arithmetic binds tighter than comparison", () => {
  expect(truth("1 kg + 500 g = 1.5 kg")).toBe(true);
  expect(truth("2 * 3 = 6")).toBe(true);
  expect(truth("10 - 4 > 5")).toBe(true);
});

/**
 * Ruling C4, and the reason a tolerance exists at all. The arithmetic is
 * genuinely not 1 — a third of a metre does not terminate — and at the 26
 * digits this engine displays, it is.
 */
test("equality is tolerant at the precision the engine displays", () => {
  expect(truth("1 km / 3 * 3 = 1 km")).toBe(true);
  const exact = createEngine({
    locales: [composeLocale(en, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
    comparePrecision: "exact",
  });
  expect(truth("1 km / 3 * 3 = 1 km", exact)).toBe(false);
  // The tolerance governs ordering too — ruling C6. Without it, two values
  // that are neither equal nor greater would leave a caller with a fourth
  // outcome for a three-way question.
  expect(truth("1 km / 3 * 3 < 1 km", exact)).toBe(true);
  expect(truth("1 km / 3 * 3 < 1 km")).toBe(false);
});

test("comparison precision is overridable per call", () => {
  expect(truthOf(engine.evaluate("1 km / 3 * 3 = 1 km").value)).toBe(true);
  expect(
    truthOf(engine.evaluate("1 km / 3 * 3 = 1 km", { comparePrecision: "exact" }).value),
  ).toBe(false);
});

/** Ruling C3 — the op table refuses it, no chain rule required. */
test("a chained comparison is refused", () => {
  expect(() => engine.evaluate("1 < 2 < 3")).toThrow();
});

/**
 * The refusal is the op table's, and it lands in exactly the same places
 * addition's does — which is the point. A comparison is not a looser question
 * than a sum: if two operands cannot be added they cannot be ordered either.
 */
test("a mismatched pair is refused exactly as a mismatched sum is", () => {
  expect(() => engine.evaluate("10 kg > 5 h")).toThrow(DimensionMismatchError);
  expect(() => engine.evaluate("10 kg + 5 h")).toThrow(DimensionMismatchError);
  // A bare number is a kind too, so this is the same refusal and not a
  // special case: comparing a mass to 500 of nothing has no more meaning than
  // adding them.
  expect(() => engine.evaluate("1 kg = 500")).toThrow(DimensionMismatchError);
  expect(() => engine.evaluate("1 kg + 500")).toThrow(DimensionMismatchError);
});

/**
 * `m` is metres and minutes, and a comparison keeps both readings alive
 * exactly as arithmetic does: `10 m > 5 h` is not a mismatch, it is ten
 * minutes against five hours, and the solver picks the reading that makes the
 * expression consistent. This is the whole design working, not a coincidence.
 */
test("an ambiguous unit resolves from the other operand", () => {
  expect(truth("10 m > 5 h")).toBe(false);
  expect(truth("10 m < 5 h")).toBe(true);
  expect(truth("10 m > 5 km")).toBe(false);
});

test("the result formats as a word, and reads back as a boolean", () => {
  const r = engine.evaluate("1000 mb = 1 gb");
  expect(r.kind).toBe("boolean");
  expect(r.formatted).toBe("true");
  expect(engine.evaluate("999 mb = 1 gb").formatted).toBe("false");
  expect(Bool.of(r.value).value).toBe(true);
  expect(String(Bool.of(r.value))).toBe("true");
  expect(JSON.stringify(Bool.from(false))).toBe("false");
});

test("truthOf answers null for something that is not a comparison", () => {
  expect(truthOf(engine.evaluate("1 kg").value)).toBeNull();
  expect(() => Bool.of(engine.evaluate("1 kg").value)).toThrow(TypeError);
});

/**
 * The boolean kind claims no word. "true" is ordinary English and the alias
 * index is global, so an alias here would make it a unit wherever it appeared
 * — the same argument that keeps country codes and city names out of the index.
 */
test("registering the kind claims no vocabulary", () => {
  expect(() => engine.evaluate("true")).toThrow();
  expect(engine.suggest("1 true")).toEqual([]);
});
