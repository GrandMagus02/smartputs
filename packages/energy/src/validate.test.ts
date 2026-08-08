import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { energy } from "./index";
import energyEn from "./locale/en";
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
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseEnergy("kwh")).toMatchObject({ ok: true, value: 1 });
  expect(parseEnergy("smth")).toMatchObject({ ok: false, code: "nan" });
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
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [energy] });
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

test("contract: the table, the descriptor and the vocabulary agree", () => {
  expect(Object.keys((energy.value as { units: object }).units).sort()).toEqual(
    Object.keys(ENERGY_UNITS.ratio).sort(),
  );
  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home — an
  // English word only reaches the engine if `ENERGY_UNITS.alias` maps it to the
  // very unit the vocabulary filed it under.
  for (const [unit, words] of Object.entries(energyEn.units)) {
    for (const a of words.aliases)
      expect(ENERGY_UNITS.alias[a], a).toBe(unit as EnergyUnit);
  }
});
