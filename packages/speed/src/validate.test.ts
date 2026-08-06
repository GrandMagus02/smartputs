import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { speed } from "./index";
import { SPEED_UNITS, type SpeedUnit } from "./units";
import { addSpeed, formatSpeed, parseSpeed, toSpeed } from "./validate";

const units = Object.keys(SPEED_UNITS.ratio) as SpeedUnit[];

test("valid and invalid input", () => {
  expect(parseSpeed("1.5kph")).toMatchObject({ ok: true, value: 1.5, unit: "kph" });
  expect(parseSpeed("3 knots")).toMatchObject({ ok: true, value: 3, unit: "knot" });
  expect(parseSpeed("60kmh")).toMatchObject({ ok: true, value: 60, unit: "kph" });
  expect(parseSpeed("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseSpeed("kph")).toMatchObject({ ok: true, value: 1 });
  expect(parseSpeed("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addSpeed("10mps", "26mph");
  expect(sum).toMatchObject({ ok: true, unit: "mps" });
  if (sum.ok) expect(sum.value).toBeCloseTo(10 + 26 * 0.44704, 9);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseSpeed(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseSpeed(formatSpeed(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toSpeed(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toSpeed(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [speed] });
  for (const unit of units) {
    const parsed = parseSpeed(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toSpeed(parsed, SPEED_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      9,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((speed.value as { units: object }).units).sort()).toEqual(
    Object.keys(SPEED_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(speed.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(SPEED_UNITS.alias[a], a).toBe(unit as SpeedUnit);
  }
});
