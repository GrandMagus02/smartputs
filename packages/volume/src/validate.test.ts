import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { volume } from "./index";
import volumeEn from "./locale/en";
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
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [volume] });
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

test("contract: the table, the descriptor and the vocabulary agree", () => {
  expect(Object.keys((volume.value as { units: object }).units).sort()).toEqual(
    Object.keys(VOLUME_UNITS.ratio).sort(),
  );
  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home — an
  // English word only reaches the engine if `VOLUME_UNITS.alias` maps it to the
  // very unit the vocabulary filed it under.
  for (const [unit, words] of Object.entries(volumeEn.units)) {
    for (const a of words.aliases)
      expect(VOLUME_UNITS.alias[a], a).toBe(unit as VolumeUnit);
  }
});
