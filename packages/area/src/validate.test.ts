import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { area } from "./index";
import { AREA_UNITS, type AreaUnit } from "./units";
import { addArea, formatArea, parseArea, toArea } from "./validate";

const units = Object.keys(AREA_UNITS.ratio) as AreaUnit[];

test("valid and invalid input", () => {
  expect(parseArea("1.5hectare")).toMatchObject({
    ok: true,
    value: 1.5,
    unit: "hectare",
  });
  expect(parseArea("3 acres")).toMatchObject({ ok: true, value: 3, unit: "acre" });
  expect(parseArea("2sqm")).toMatchObject({ ok: true, value: 2, unit: "m2" });
  expect(parseArea("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseArea("hectare")).toMatchObject({ ok: true, value: 1 });
  expect(parseArea("smth")).toMatchObject({ ok: false, code: "nan" });
});

// The grammar's unit character class must accept the superscript digits
// `²`/`³` for the symbol forms to parse at all -- confirmed here rather than
// assumed, per the task's own note that a rejection here is a blocker for
// packages/shared, not something this package can work around.
test("superscript symbol forms parse", () => {
  expect(parseArea("5m²")).toMatchObject({ ok: true, value: 5, unit: "m2" });
  expect(parseArea("3cm²")).toMatchObject({ ok: true, value: 3, unit: "cm2" });
  expect(parseArea("2km²")).toMatchObject({ ok: true, value: 2, unit: "km2" });
});

test("the left operand's unit wins", () => {
  const sum = addArea("1hectare", "5000m2");
  expect(sum).toMatchObject({ ok: true, unit: "hectare" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 9);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseArea(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseArea(formatArea(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toArea(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toArea({ ok: true, value: there, unit: to, raw: String(there) }, from);
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [area] });
  for (const unit of units) {
    const parsed = parseArea(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toArea(parsed, AREA_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((area.value as { units: object }).units).sort()).toEqual(
    Object.keys(AREA_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(area.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(AREA_UNITS.alias[a], a).toBe(unit as AreaUnit);
  }
});
