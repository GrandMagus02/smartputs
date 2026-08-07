import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { toCanonical } from "@smartput/shared";
import { percent } from "./index";
import percentEn from "./locale/en";
import { PERCENT_UNITS, type PercentUnit } from "./units";
import {
  addPercent,
  comparePercent,
  equalsPercent,
  formatPercent,
  isPercent,
  negatePercent,
  parsePercent,
  patternForPercent,
  scalePercent,
  subPercent,
  toPercent,
} from "./validate";

const units = Object.keys(PERCENT_UNITS.ratio) as PercentUnit[];

test("valid and invalid input", () => {
  expect(parsePercent("20%")).toMatchObject({ ok: true, value: 20, unit: "%" });
  expect(parsePercent("15 percent")).toMatchObject({ ok: true, value: 15, unit: "%" });
  expect(parsePercent("3pct")).toMatchObject({ ok: true, value: 3, unit: "%" });
  expect(parsePercent("3.5percents")).toMatchObject({ ok: true, unit: "%" });
  expect(parsePercent("20xyz")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parsePercent("%")).toMatchObject({ ok: true, value: 1 });
  expect(parsePercent("smth")).toMatchObject({ ok: false, code: "nan" });
  // No `defaultUnit` is hardcoded here, unlike `number` — a bare "20" is not
  // a percentage, and the wrapper does not pretend otherwise.
  expect(parsePercent("20")).toMatchObject({ ok: false, code: "missing-unit" });
});

test("ops work on raw strings", () => {
  const sum = addPercent("10%", "5%");
  expect(sum).toMatchObject({ ok: true, unit: "%" });
  if (sum.ok) expect(sum.value).toBeCloseTo(15, 12);
});

test("round-trip: parse(format(parse(s))) is parse(s), in strict mode", () => {
  for (const unit of units) {
    for (const n of ["1", "30.5", "-7", "0.25"]) {
      const first = parsePercent(`${n}${unit}`);
      expect(first.ok, `${n}${unit}`).toBe(true);
      if (!first.ok) continue;
      expect(parsePercent(formatPercent(first), { mode: "strict" })).toEqual(first);
    }
  }
});

test("conversion identity: the one unit converts to itself, exactly", () => {
  for (const unit of units) {
    expect(toPercent(`7${unit}`, unit), unit).toBe(7);
  }
});

// `%`'s own ratio is 0.01, not 1 — unlike every plain-ratio kind, percent's
// "canonical" *unit* and its canonical *magnitude* are not the same number.
// `toPercent(parsed, "%")` is a same-unit no-op (returns the raw 20), so the
// honest comparison against the engine's `Value.canonical` goes through
// `toCanonical`, which actually applies the ratio.
test("cross-path agreement: the micro path's canonical magnitude matches the engine's", () => {
  const engine = createEngine({
    locales: [composeLocale(en, [percentEn])],
    kinds: [percent],
  });
  for (const unit of units) {
    for (const n of ["1", "30.5", "0.25"]) {
      const parsed = parsePercent(`${n}${unit}`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const micro = toCanonical(PERCENT_UNITS, parsed.value, parsed.unit);
      const engineValue = engine.evaluate(`${n}${unit}`).value.canonical.toNumber();
      expect(micro, `${n}${unit}`).toBeCloseTo(engineValue, 9);
    }
  }
});

test("cross-path agreement: every alias resolves to the same unit on both paths", () => {
  const engine = createEngine({
    locales: [composeLocale(en, [percentEn])],
    kinds: [percent],
  });
  for (const [word, unit] of Object.entries(PERCENT_UNITS.alias)) {
    const parsed = parsePercent(`1${word}`);
    expect(parsed.ok, word).toBe(true);
    if (!parsed.ok) continue;
    expect(parsed.unit, word).toBe(unit);
    expect(engine.evaluate(`1${word}`).value.unit, word).toBe(unit);
  }
});

test("the remaining wrappers are wired to the right table", () => {
  expect(subPercent("30%", "10%")).toMatchObject({ ok: true, value: 20, unit: "%" });
  expect(scalePercent("30%", 2)).toMatchObject({ ok: true, value: 60, unit: "%" });
  expect(negatePercent("30%")).toMatchObject({ ok: true, value: -30, unit: "%" });
  expect(equalsPercent("50%", "0.5", 0)).toBe(false); // "0.5" has no unit at all
  expect(equalsPercent("50%", "50%")).toBe(true);
  expect(comparePercent("20%", "30%")).toBe(-1);
  expect(formatPercent({ ok: true, value: 20, unit: "%", raw: "20" })).toBe("20%");
});

test("the emitted pattern agrees with isPercent", () => {
  for (const mode of ["strict", "loose"] as const) {
    const re = new RegExp(`^(?:${patternForPercent({ mode })})$`, "v");
    for (const input of ["20%", " 20 percent ", "20PCT", "20", "20xyz", "3.5pcts"]) {
      expect(re.test(input), `${mode} ${input}`).toBe(isPercent(input, { mode }));
    }
  }
});

test("contract: units.ts, the descriptor and the vocabulary agree on every key and alias", () => {
  const declared = Object.keys((percent.value as { units: object }).units).sort();
  expect(declared).toEqual(Object.keys(PERCENT_UNITS.ratio).sort());

  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home — every
  // spelling in `units.ts` reaches the engine, and only under the unit the
  // vocabulary filed it under.
  const seen = new Set<string>();
  for (const [unit, words] of Object.entries(percentEn.units)) {
    for (const a of words.aliases) {
      expect(PERCENT_UNITS.alias[a], `${a} must be in units.ts`).toBe(
        unit as PercentUnit,
      );
      seen.add(a);
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(PERCENT_UNITS.alias).sort());
});

test("contract: the descriptor's ratios are the table's strings, digit for digit", () => {
  const declared = (percent.value as { units: Record<string, { toString(): string }> })
    .units;
  for (const [unit, ratio] of Object.entries(PERCENT_UNITS.ratio)) {
    expect(declared[unit]?.toString(), unit).toBe(ratio as string);
  }
});
