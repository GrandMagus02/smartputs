import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { measure } from "./index";
import { DEFAULT_DPI, MEASURE_UNITS, type MeasureUnit } from "./units";
import {
  addMeasure,
  asMeasure,
  compareMeasure,
  equalsMeasure,
  formatMeasure,
  isMeasure,
  negateMeasure,
  parseMeasure,
  patternForMeasure,
  scaleMeasure,
  subMeasure,
  toMeasure,
} from "./validate";

const units = Object.keys(MEASURE_UNITS.ratio) as MeasureUnit[];

// `measure` is deliberately outside BUILTIN_KINDS — its mm/cm collide with
// `length` — so every engine here is built from `measure` alone.
const engineAt = (dpi?: number) =>
  createEngine({
    locales: [en],
    kinds: [measure],
    ...(dpi === undefined ? {} : { kindMeta: { measure: { dpi } } }),
  });

test("valid input parses; invalid input names the reason", () => {
  expect(isMeasure("10px")).toBe(true);
  expect(isMeasure("2.5cm")).toBe(true);
  expect(isMeasure(" 12 PICAS ")).toBe(true);
  expect(isMeasure("10smth")).toBe(false);

  expect(parseMeasure("10px")).toMatchObject({ ok: true, value: 10, unit: "px" });
  expect(parseMeasure("")).toMatchObject({ ok: false, code: "empty" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseMeasure("px")).toMatchObject({ ok: true, value: 1 });
  expect(parseMeasure("smth")).toMatchObject({ ok: false, code: "nan" });
  expect(parseMeasure("10")).toMatchObject({ ok: false, code: "missing-unit" });
  expect(parseMeasure("10furlong")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseMeasure("10px", { unit: "mm" })).toMatchObject({
    ok: false,
    code: "wrong-unit",
  });
  expect(parseMeasure("10 px", { mode: "strict" })).toMatchObject({ ok: true });
  expect(parseMeasure(" 10px", { mode: "strict" })).toMatchObject({ ok: false });
  expect(parseMeasure("10", { defaultUnit: "px" })).toMatchObject({
    ok: true,
    unit: "px",
  });
});

test("the left operand's unit wins", () => {
  expect(addMeasure("1inch", "72pt")).toMatchObject({ ok: true, unit: "inch" });
  expect(toMeasure(addMeasure("1inch", "72pt") as never, "inch")).toBeCloseTo(2, 12);
  expect(addMeasure("72pt", "1inch")).toMatchObject({ ok: true, unit: "pt" });
  expect(toMeasure(addMeasure("72pt", "1inch") as never, "pt")).toBeCloseTo(144, 9);
  // Same units short-circuit, so the arithmetic stays exact.
  expect(addMeasure("1cm", "2cm")).toMatchObject({ ok: true, value: 3, unit: "cm" });
  expect(subMeasure("3cm", "1cm")).toMatchObject({ ok: true, value: 2, unit: "cm" });
});

test("round-trip: parse(format(parse(s))) is parse(s), in strict mode", () => {
  for (const unit of units) {
    for (const n of ["1", "30.5", "-7", "0.25"]) {
      const first = parseMeasure(`${n}${unit}`);
      expect(first.ok, `${n}${unit}`).toBe(true);
      if (!first.ok) continue;
      expect(parseMeasure(formatMeasure(first), { mode: "strict" })).toEqual(first);
    }
  }
});

test("conversion identity: every pair of units returns to the original", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toMeasure(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toMeasure(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("a same-unit conversion is exact, not merely close", () => {
  for (const unit of units) {
    expect(toMeasure(`7${unit}`, unit), unit).toBe(7);
  }
});

test("px reads its ratio from ctx.dpi, and defaults to the descriptor's DEFAULT_DPI", () => {
  // 10px at 144dpi is 10/144 inch, and an inch is 25.4mm.
  expect(toMeasure("10px", "mm", { ctx: { dpi: 144 } })).toBeCloseTo(
    (10 / 144) * 25.4,
    12,
  );
  // No ctx: the same number the descriptor falls back to, read from the same
  // constant rather than an assumed 96.
  expect(DEFAULT_DPI).toBe(96);
  expect(toMeasure("10px", "mm")).toBeCloseTo((10 / DEFAULT_DPI) * 25.4, 12);
  expect(toMeasure("10px", "mm", { ctx: {} })).toBe(toMeasure("10px", "mm") as number);
  expect(toMeasure(`${DEFAULT_DPI}px`, "inch")).toBeCloseTo(1, 12);
  expect(toMeasure("300px", "inch", { ctx: { dpi: 300 } })).toBeCloseTo(1, 12);
  // A dpi-relative operand still combines correctly with a physical one.
  expect(
    toMeasure(addMeasure("1inch", "144px", { ctx: { dpi: 144 } }) as never, "inch", {
      ctx: { dpi: 144 },
    }),
  ).toBeCloseTo(2, 12);
});

test("cross-path agreement: the micro path matches the engine's canonical value", () => {
  const engine = engineAt();
  for (const unit of units) {
    for (const n of ["1", "30.5", "0.25"]) {
      const parsed = parseMeasure(`${n}${unit}`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const micro = toMeasure(parsed, MEASURE_UNITS.canonical);
      const engineValue = engine.evaluate(`${n} ${unit}`).value.canonical.toNumber();
      expect(micro, `${n}${unit}`).toBeCloseTo(engineValue, 9);
    }
  }
});

test("cross-path agreement: dpi flows the same way through both paths", () => {
  for (const dpi of [96, 144, 300]) {
    const engineValue = engineAt(dpi).evaluate("10 px in mm").value.canonical.toNumber();
    // The engine's canonical is inches; convert the micro result the same way.
    expect(toMeasure("10px", "inch", { ctx: { dpi } }), String(dpi)).toBeCloseTo(
      engineValue,
      12,
    );
  }
  // And the default agrees with the descriptor's own fallback, unset on both.
  expect(toMeasure("10px", "inch")).toBeCloseTo(
    engineAt().evaluate("10 px").value.canonical.toNumber(),
    12,
  );
});

test("cross-path agreement: every alias resolves to the same unit on both paths", () => {
  const engine = engineAt();
  for (const [word, unit] of Object.entries(MEASURE_UNITS.alias)) {
    const parsed = parseMeasure(`1${word}`);
    expect(parsed.ok, word).toBe(true);
    if (!parsed.ok) continue;
    expect(parsed.unit, word).toBe(unit);
    expect(engine.evaluate(`1 ${word}`).value.unit, word).toBe(unit);
  }
});

test("cross-path agreement: a conversion the engine states in words", () => {
  const engine = engineAt();
  expect(engine.evaluate("1 inch in pt").formatted).toBe("72 points");
  expect(toMeasure("1inch", "pt")).toBeCloseTo(72, 9);
  expect(toMeasure("1pc", "pt")).toBeCloseTo(12, 9);
  expect(toMeasure("1cm", "mm")).toBeCloseTo(10, 9);
});

test("the remaining wrappers are wired to the right table", () => {
  expect(scaleMeasure("30pt", 2)).toMatchObject({ ok: true, value: 60, unit: "pt" });
  expect(negateMeasure("30pt")).toMatchObject({ ok: true, value: -30, unit: "pt" });
  expect(asMeasure("1inch", "pc")).toMatchObject({ ok: true, unit: "pc" });
  expect((asMeasure("1inch", "pc") as { value: number }).value).toBeCloseTo(6, 9);
  expect(equalsMeasure("1inch", "72pt", 1e-12)).toBe(true);
  expect(equalsMeasure("1inch", "96px", 1e-12)).toBe(true);
  expect(compareMeasure("1cm", "1inch")).toBe(-1);
  expect(formatMeasure({ ok: true, value: 30, unit: "pt", raw: "30" })).toBe("30pt");
});

test("the emitted pattern agrees with isMeasure", () => {
  for (const mode of ["strict", "loose"] as const) {
    const re = new RegExp(`^(?:${patternForMeasure({ mode })})$`, "v");
    for (const input of ["10px", " 10 px ", "10PX", "10", "10smth", "2.5cm", "1pc"]) {
      expect(re.test(input), `${mode} ${input}`).toBe(isMeasure(input, { mode }));
    }
  }
});

test("contract: units.ts and the descriptor agree on every key and alias", () => {
  const declared = Object.keys((measure.value as { units: object }).units).sort();
  expect(declared).toEqual(Object.keys(MEASURE_UNITS.ratio).sort());
  expect((measure.value as { canonical: string }).canonical).toBe(
    MEASURE_UNITS.canonical,
  );

  const lexicon = measure.lexicon ?? {};
  const seen = new Set<string>();
  for (const [unit, lexeme] of Object.entries(lexicon)) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) {
      expect(MEASURE_UNITS.alias[a], `${a} must be in units.ts`).toBe(
        unit as MeasureUnit,
      );
      seen.add(a);
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(MEASURE_UNITS.alias).sort());
});

test("contract: the descriptor's constant ratios are the table's strings, digit for digit", () => {
  const declared = (measure.value as { units: Record<string, unknown> }).units;
  for (const [unit, ratio] of Object.entries(MEASURE_UNITS.ratio)) {
    if (typeof ratio === "function") {
      // `px` is the one dynamic ratio: the descriptor keeps its own closure,
      // because there is no constant string for `decimalRatios` to widen.
      expect(typeof declared[unit], unit).toBe("object");
      continue;
    }
    expect(String(declared[unit]), unit).toBe(ratio);
  }
});

test("contract: every alias is lowercase and every unit key is its own alias", () => {
  for (const word of Object.keys(MEASURE_UNITS.alias)) {
    expect(word, word).toBe(word.toLowerCase());
  }
  for (const unit of units) {
    // Otherwise `format`'s `${value}${unit}` output could not parse back.
    expect(MEASURE_UNITS.alias[unit], unit).toBe(unit);
  }
});
