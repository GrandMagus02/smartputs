import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { energy } from "./index";
import { ENERGY_UNITS, type EnergyUnit } from "./units";
import { addEnergy, formatEnergy, parseEnergy, toEnergy } from "./validate";

const units = Object.keys(ENERGY_UNITS.ratio) as EnergyUnit[];

test("valid and invalid input", () => {
  expect(parseEnergy("1.5kwh")).toMatchObject({ ok: true, value: 1.5, unit: "kwh" });
  expect(parseEnergy("3 joules")).toMatchObject({ ok: true, value: 3, unit: "j" });
  expect(parseEnergy("200 calories")).toMatchObject({
    ok: true,
    value: 200,
    unit: "cal",
  });
  expect(parseEnergy("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseEnergy("kwh")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addEnergy("1kwh", "1800kj");
  expect(sum).toMatchObject({ ok: true, unit: "kwh" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("the defining ratios, through the wrapper", () => {
  // Each of these is the unit's definition, not a rounded restatement of it:
  // an hour of watts, the thermochemical calorie, and the IT BTU.
  expect(toEnergy("1wh", "j")).toBe(3600);
  expect(toEnergy("1cal", "j")).toBe(4.184);
  expect(toEnergy("1btu", "j")).toBe(1055.05585262);
  expect(toEnergy("1kcal", "cal")).toBe(1000);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseEnergy(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseEnergy(formatEnergy(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toEnergy(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toEnergy(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [energy] });
  for (const unit of units) {
    const parsed = parseEnergy(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toEnergy(parsed, ENERGY_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((energy.value as { units: object }).units).sort()).toEqual(
    Object.keys(ENERGY_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(energy.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(ENERGY_UNITS.alias[a], a).toBe(unit as EnergyUnit);
  }
});
