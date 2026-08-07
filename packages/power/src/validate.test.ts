import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { power } from "./index";
import powerEn from "./locale/en";
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
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parsePower("kw")).toMatchObject({ ok: true, value: 1 });
  expect(parsePower("smth")).toMatchObject({ ok: false, code: "nan" });
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
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [power] });
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

test("contract: the table, the descriptor and the vocabulary agree", () => {
  expect(Object.keys((power.value as { units: object }).units).sort()).toEqual(
    Object.keys(POWER_UNITS.ratio).sort(),
  );
  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home — an
  // English word only reaches the engine if `POWER_UNITS.alias` maps it to the
  // very unit the vocabulary filed it under.
  for (const [unit, words] of Object.entries(powerEn.units)) {
    for (const a of words.aliases)
      expect(POWER_UNITS.alias[a], a).toBe(unit as PowerUnit);
  }
});
