import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { datarate } from "./index";
import { DATARATE_UNITS, type DatarateUnit } from "./units";
import { addDatarate, formatDatarate, parseDatarate, toDatarate } from "./validate";

const units = Object.keys(DATARATE_UNITS.ratio) as DatarateUnit[];

test("valid and invalid input", () => {
  expect(parseDatarate("1.5gbps")).toMatchObject({ ok: true, value: 1.5, unit: "gbps" });
  expect(parseDatarate("100 mbps")).toMatchObject({ ok: true, value: 100, unit: "mbps" });
  expect(parseDatarate("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseDatarate("mbps")).toMatchObject({ ok: true, value: 1 });
  expect(parseDatarate("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("case folding sends MBps to the megabit unit", () => {
  // The units.ts ruling in one assertion: there is no byte-per-second unit for
  // the uppercase B to select, so this is megabits and not a silent 8x error.
  expect(parseDatarate("100 MBps")).toMatchObject({ ok: true, unit: "mbps" });
});

test("the left operand's unit wins", () => {
  const sum = addDatarate("1gbps", "500mbps");
  expect(sum).toMatchObject({ ok: true, unit: "gbps" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseDatarate(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseDatarate(formatDatarate(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toDatarate(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toDatarate(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [datarate] });
  for (const unit of units) {
    const parsed = parseDatarate(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toDatarate(parsed, DATARATE_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((datarate.value as { units: object }).units).sort()).toEqual(
    Object.keys(DATARATE_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(datarate.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases)
      expect(DATARATE_UNITS.alias[a], a).toBe(unit as DatarateUnit);
  }
});
