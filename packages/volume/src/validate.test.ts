import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { volume } from "./index";
import { VOLUME_UNITS, type VolumeUnit } from "./units";
import { addVolume, formatVolume, parseVolume, toVolume } from "./validate";

const units = Object.keys(VOLUME_UNITS.ratio) as VolumeUnit[];

test("valid and invalid input", () => {
  expect(parseVolume("1.5gal")).toMatchObject({ ok: true, value: 1.5, unit: "gal" });
  expect(parseVolume("3 litres")).toMatchObject({ ok: true, value: 3, unit: "l" });
  expect(parseVolume("2milliliters")).toMatchObject({ ok: true, value: 2, unit: "ml" });
  expect(parseVolume("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseVolume("gal")).toMatchObject({ ok: true, value: 1 });
  expect(parseVolume("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the m³ symbol form parses", () => {
  expect(parseVolume("5m³")).toMatchObject({ ok: true, value: 5, unit: "m3" });
});

test("the left operand's unit wins", () => {
  const sum = addVolume("1l", "500ml");
  expect(sum).toMatchObject({ ok: true, unit: "l" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseVolume(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseVolume(formatVolume(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toVolume(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toVolume(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [volume] });
  for (const unit of units) {
    const parsed = parseVolume(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toVolume(parsed, VOLUME_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((volume.value as { units: object }).units).sort()).toEqual(
    Object.keys(VOLUME_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(volume.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(VOLUME_UNITS.alias[a], a).toBe(unit as VolumeUnit);
  }
});
