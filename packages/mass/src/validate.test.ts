import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { mass } from "./index";
import { MASS_UNITS, type MassUnit } from "./units";
import { addMass, formatMass, parseMass, toMass } from "./validate";

const units = Object.keys(MASS_UNITS.ratio) as MassUnit[];

test("valid and invalid input", () => {
  expect(parseMass("1.5kg")).toMatchObject({ ok: true, value: 1.5, unit: "kg" });
  expect(parseMass("3 pounds")).toMatchObject({ ok: true, value: 3, unit: "lb" });
  expect(parseMass("1.5kilos")).toMatchObject({ ok: true, unit: "kg" });
  expect(parseMass("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseMass("kg")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addMass("1kg", "500g");
  expect(sum).toMatchObject({ ok: true, unit: "kg" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseMass(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseMass(formatMass(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toMass(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toMass({ ok: true, value: there, unit: to, raw: String(there) }, from);
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [mass] });
  for (const unit of units) {
    const parsed = parseMass(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toMass(parsed, MASS_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      9,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((mass.value as { units: object }).units).sort()).toEqual(
    Object.keys(MASS_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(mass.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(MASS_UNITS.alias[a], a).toBe(unit as MassUnit);
  }
});
