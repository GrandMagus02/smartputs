import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { datasize } from "./index";
import { DATASIZE_UNITS, type DatasizeUnit } from "./units";
import { addDatasize, formatDatasize, parseDatasize, toDatasize } from "./validate";

const units = Object.keys(DATASIZE_UNITS.ratio) as DatasizeUnit[];

test("valid and invalid input", () => {
  expect(parseDatasize("1.5gb")).toMatchObject({ ok: true, value: 1.5, unit: "gb" });
  expect(parseDatasize("3 gigabytes")).toMatchObject({ ok: true, value: 3, unit: "gb" });
  expect(parseDatasize("2kib")).toMatchObject({ ok: true, value: 2, unit: "kib" });
  expect(parseDatasize("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseDatasize("gb")).toMatchObject({ ok: true, value: 1 });
  expect(parseDatasize("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addDatasize("1gb", "500mb");
  expect(sum).toMatchObject({ ok: true, unit: "gb" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("decimal and binary prefixes stay distinct through the wrapper", () => {
  expect(toDatasize("1kb", "b")).toBe(1000);
  expect(toDatasize("1kib", "b")).toBe(1024);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseDatasize(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseDatasize(formatDatasize(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toDatasize(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toDatasize(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [datasize] });
  for (const unit of units) {
    const parsed = parseDatasize(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toDatasize(parsed, DATASIZE_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((datasize.value as { units: object }).units).sort()).toEqual(
    Object.keys(DATASIZE_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(datasize.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases)
      expect(DATASIZE_UNITS.alias[a], a).toBe(unit as DatasizeUnit);
  }
});
