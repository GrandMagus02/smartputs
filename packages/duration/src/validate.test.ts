import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { duration } from "./index";
import durationEn from "./locale/en";
import { DURATION_UNITS, type DurationUnit } from "./units";
import { addDuration, formatDuration, parseDuration, toDuration } from "./validate";

const units = Object.keys(DURATION_UNITS.ratio) as DurationUnit[];

test("valid and invalid input", () => {
  expect(parseDuration("90min")).toMatchObject({ ok: true, value: 90, unit: "min" });
  expect(parseDuration("2 hours")).toMatchObject({ ok: true, value: 2, unit: "h" });
  expect(parseDuration("30 m")).toMatchObject({ ok: true, value: 30, unit: "min" });
  expect(parseDuration("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseDuration("h")).toMatchObject({ ok: true, value: 1 });
  expect(parseDuration("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addDuration("1h", "30min");
  expect(sum).toMatchObject({ ok: true, unit: "h" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseDuration(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseDuration(formatDuration(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toDuration(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toDuration(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [duration] });
  for (const unit of units) {
    const parsed = parseDuration(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toDuration(parsed, DURATION_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      9,
    );
  }
});

test("contract: the table, the descriptor and the vocabulary agree", () => {
  expect(Object.keys((duration.value as { units: object }).units).sort()).toEqual(
    Object.keys(DURATION_UNITS.ratio).sort(),
  );
  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home — an
  // English word only reaches the engine if `DURATION_UNITS.alias` maps it to the
  // very unit the vocabulary filed it under.
  for (const [unit, words] of Object.entries(durationEn.units)) {
    for (const a of words.aliases)
      expect(DURATION_UNITS.alias[a], a).toBe(unit as DurationUnit);
  }
});
