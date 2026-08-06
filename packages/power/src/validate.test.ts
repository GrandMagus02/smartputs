import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { power } from "./index";
import { POWER_UNITS, type PowerUnit } from "./units";
import { addPower, formatPower, parsePower, toPower } from "./validate";

const units = Object.keys(POWER_UNITS.ratio) as PowerUnit[];

test("valid and invalid input", () => {
  expect(parsePower("1.5kw")).toMatchObject({ ok: true, value: 1.5, unit: "kw" });
  expect(parsePower("3 megawatts")).toMatchObject({ ok: true, value: 3, unit: "mw" });
  expect(parsePower("120 horsepower")).toMatchObject({
    ok: true,
    value: 120,
    unit: "hp",
  });
  expect(parsePower("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parsePower("kw")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addPower("1mw", "500kw");
  expect(sum).toMatchObject({ ok: true, unit: "mw" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("mw reads as megawatt on the free-function path too", () => {
  // The ruling from units.ts, checked through the surface a caller uses: a
  // milliwatt reading would make this 0.001.
  expect(toPower("1mw", "w")).toBe(1000000);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parsePower(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parsePower(formatPower(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toPower(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toPower(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [power] });
  for (const unit of units) {
    const parsed = parsePower(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toPower(parsed, POWER_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((power.value as { units: object }).units).sort()).toEqual(
    Object.keys(POWER_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(power.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(POWER_UNITS.alias[a], a).toBe(unit as PowerUnit);
  }
});
