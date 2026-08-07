import { expect, test } from "bun:test";
import { buildRegistry, composeLocale, createEngine, Decimal } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { tempdelta, temperature } from "./index";
import temperatureEn from "./locale/en";
import { TEMPDELTA_UNITS, TEMPERATURE_UNITS, type TemperatureUnit } from "./units";
import {
  addTempDelta,
  compareTemperature,
  diffTemperature,
  formatTempDelta,
  formatTemperature,
  isTemperature,
  parseTempDelta,
  parseTemperature,
  patternForTemperature,
  toTempDelta,
  toTemperature,
} from "./validate";

const units = Object.keys(TEMPERATURE_UNITS.ratio) as TemperatureUnit[];

const okOf = (value: number, unit: TemperatureUnit) =>
  ({ ok: true as const, value, unit, raw: String(value) }) as const;

test("valid and invalid input", () => {
  expect(parseTemperature("30c")).toMatchObject({ ok: true, value: 30, unit: "c" });
  expect(parseTemperature("30°C")).toMatchObject({ ok: true, value: 30, unit: "c" });
  expect(parseTemperature("98.6 fahrenheit")).toMatchObject({ ok: true, unit: "f" });
  expect(parseTemperature("300 kelvins")).toMatchObject({ ok: true, unit: "k" });
  expect(parseTemperature("-40 °f")).toMatchObject({ ok: true, value: -40, unit: "f" });
  expect(parseTemperature("30smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseTemperature("c")).toMatchObject({ ok: true, value: 1 });
  expect(parseTemperature("smth")).toMatchObject({ ok: false, code: "nan" });
  expect(parseTemperature("30")).toMatchObject({ ok: false, code: "missing-unit" });
  expect(parseTempDelta("5°c")).toMatchObject({ ok: true, value: 5, unit: "c" });
  expect(parseTempDelta("")).toMatchObject({ ok: false, code: "empty" });
});

test("the left operand's unit wins for a difference", () => {
  const sum = addTempDelta("1c", "9f");
  expect(sum).toMatchObject({ ok: true, unit: "c" });
  // 9F as a *difference* is 5C, not -12.8C: tempdelta has no offset.
  if (sum.ok) expect(sum.value).toBeCloseTo(6, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const reading = parseTemperature(`7.25${unit}`);
    expect(reading.ok, unit).toBe(true);
    if (!reading.ok) continue;
    expect(parseTemperature(formatTemperature(reading), { mode: "strict" })).toEqual(
      reading,
    );

    const delta = parseTempDelta(`7.25${unit}`);
    expect(delta.ok, unit).toBe(true);
    if (!delta.ok) continue;
    expect(parseTempDelta(formatTempDelta(delta), { mode: "strict" })).toEqual(delta);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toTemperature(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      expect(toTemperature(okOf(there, to), from), `${from}->${to}->${from}`).toBeCloseTo(
        7,
        9,
      );

      const delta = toTempDelta(`7${from}`, to);
      expect(delta, `delta ${from}->${to}`).toBeDefined();
      if (delta === undefined) continue;
      expect(toTempDelta(okOf(delta, to), from), `delta round trip`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({
    locales: [composeLocale(en)],
    kinds: [temperature, tempdelta],
  });
  for (const unit of units) {
    const reading = parseTemperature(`7${unit}`);
    expect(reading.ok).toBe(true);
    if (!reading.ok) continue;
    expect(toTemperature(reading, TEMPERATURE_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      9,
    );

    const delta = parseTempDelta(`7${unit}`);
    expect(delta.ok).toBe(true);
    if (!delta.ok) continue;
    expect(toTempDelta(delta, TEMPDELTA_UNITS.canonical), `delta ${unit}`).toBeCloseTo(
      engine.evaluate(`7 ${unit}`, { kinds: ["tempdelta"] }).value.canonical.toNumber(),
      9,
    );
  }
});

test("every alias resolves to the same unit on both paths", () => {
  const registry = buildRegistry(
    [temperature, tempdelta],
    [composeLocale(en, temperatureEn)],
  );
  for (const [alias, unit] of Object.entries(TEMPERATURE_UNITS.alias)) {
    expect(parseTemperature(`7 ${alias}`), alias).toMatchObject({ ok: true, unit });
    expect(parseTempDelta(`7 ${alias}`), alias).toMatchObject({ ok: true, unit });
    const entries = registry.aliasIndex.get(alias) ?? [];
    // The two kinds share every alias -- that is what lets "20 C + 5 F" read
    // its right operand as a difference -- but they must never disagree about
    // which unit the alias names.
    expect(entries.map((e) => e.kind).sort(), alias).toEqual([
      "tempdelta",
      "temperature",
    ]);
    for (const entry of entries) expect(entry.unit, alias).toBe(unit);
  }
});

test("contract: the table, the descriptor and the vocabulary agree", () => {
  for (const [kind, table, vocabulary] of [
    [temperature, TEMPERATURE_UNITS, temperatureEn[0]],
    [tempdelta, TEMPDELTA_UNITS, temperatureEn[1]],
  ] as const) {
    expect(Object.keys((kind.value as { units: object }).units).sort()).toEqual(
      Object.keys(table.ratio).sort(),
    );
    expect(vocabulary?.kind).toBe(kind.id);
    for (const [unit, words] of Object.entries(vocabulary?.units ?? {})) {
      for (const a of words.aliases) {
        expect(table.alias[a], a).toBe(unit as TemperatureUnit);
      }
    }
    // The reverse direction: no alias may exist in the table that the
    // vocabulary never derived.
    for (const [alias, unit] of Object.entries(table.alias)) {
      expect(vocabulary?.units[unit]?.aliases ?? [], alias).toContain(alias);
    }
  }
});

test("the f ratio is exactly the Decimal the descriptor used to compute", () => {
  // The descriptor's comment is load-bearing: `new Decimal(5).div(9)`, never
  // `5 / 9`. Anything shorter than the full 28 digits makes "212 F in C" land
  // on 100.0000000000000000000008 instead of 100.
  expect(TEMPERATURE_UNITS.ratio.f).toBe(new Decimal(5).div(9).toString());
  expect(TEMPDELTA_UNITS.ratio.f).toBe(TEMPERATURE_UNITS.ratio.f);
  expect(
    new Decimal(212)
      .plus(-32)
      .times(new Decimal(TEMPERATURE_UNITS.ratio.f as string))
      .toString(),
  ).toBe("100");
});

test("the offsets are declared on temperature and absent from tempdelta", () => {
  expect(TEMPERATURE_UNITS.offset).toEqual({ f: "-32", k: "-273.15" });
  expect(TEMPDELTA_UNITS.offset).toBeUndefined();
  // 5F as a reading is -15C; as a difference it is 2.777...C.
  expect(toTemperature("5f", "c")).toBeCloseTo(-15, 12);
  expect(toTempDelta("5f", "c")).toBeCloseTo(2.7777777777777777, 12);
});

test("a difference between two readings is a delta in canonical units", () => {
  const d = diffTemperature("30c", "20c");
  expect(d).toMatchObject({ ok: true, unit: "c" });
  // Same unit, so no round trip through the ratio: exactly 10, not 9.999...
  if (d.ok) expect(d.value).toBe(10);

  const f = diffTemperature("212f", "32f");
  expect(f).toMatchObject({ ok: true, unit: "c" });
  if (f.ok) expect(f.value).toBeCloseTo(100, 9);

  expect(diffTemperature("nope", "20c")).toMatchObject({ ok: false, code: "nan" });
});

test("the affine kind exports no add, scale or negate", async () => {
  const free = (await import("./validate")) as Record<string, unknown>;
  expect(free.diffTemperature).toBeInstanceOf(Function);
  expect(free.addTemperature).toBeUndefined();
  expect(free.subTemperature).toBeUndefined();
  expect(free.scaleTemperature).toBeUndefined();
  expect(free.negateTemperature).toBeUndefined();
  // The delta kind is an ordinary ratio kind and keeps the whole set.
  for (const name of [
    "addTempDelta",
    "subTempDelta",
    "scaleTempDelta",
    "negateTempDelta",
  ]) {
    expect(free[name], name).toBeInstanceOf(Function);
  }
});

test("comparison and the emitted pattern", () => {
  // 100C is hotter than 100F, which the offsets are what decide.
  expect(compareTemperature("100c", "100f")).toBe(1);
  const loose = new RegExp(`^${patternForTemperature()}$`, "u");
  const strict = new RegExp(`^${patternForTemperature({ mode: "strict" })}$`, "u");
  for (const sample of ["30c", "30 °C", " 30celsius ", "-40f"]) {
    expect(loose.test(sample), sample).toBe(isTemperature(sample));
  }
  expect(strict.test("30c")).toBe(true);
  expect(strict.test("30C")).toBe(false);
});
