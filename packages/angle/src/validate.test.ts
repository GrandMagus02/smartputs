import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { angle } from "./index";
import angleEn from "./locale/en";
import { ANGLE_UNITS, type AngleUnit } from "./units";
import {
  addAngle,
  compareAngle,
  equalsAngle,
  formatAngle,
  isAngle,
  negateAngle,
  parseAngle,
  patternForAngle,
  scaleAngle,
  subAngle,
  toAngle,
} from "./validate";

const units = Object.keys(ANGLE_UNITS.ratio) as AngleUnit[];

test("the spec's headline example", () => {
  expect(isAngle("30deg")).toBe(true);
  expect(isAngle("30smth")).toBe(false);
});

test("ops work on raw strings", () => {
  expect(addAngle("30deg", "15deg")).toMatchObject({ ok: true, value: 45, unit: "deg" });
});

test("round-trip: parse(format(parse(s))) is parse(s), in strict mode", () => {
  for (const unit of units) {
    for (const n of ["1", "30.5", "-7", "0.25"]) {
      const first = parseAngle(`${n}${unit}`);
      expect(first.ok, `${n}${unit}`).toBe(true);
      if (!first.ok) continue;
      expect(parseAngle(formatAngle(first), { mode: "strict" })).toEqual(first);
    }
  }
});

test("conversion identity: every pair of units returns to the original", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toAngle(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toAngle(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("a same-unit conversion is exact, not merely close", () => {
  for (const unit of units) {
    expect(toAngle(`7${unit}`, unit), unit).toBe(7);
  }
});

test("cross-path agreement: the micro path matches the engine's canonical value", () => {
  const engine = createEngine({
    locales: [composeLocale(en, [angleEn])],
    kinds: [angle],
  });
  for (const unit of units) {
    for (const n of ["1", "30.5", "0.25"]) {
      const parsed = parseAngle(`${n}${unit}`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const micro = toAngle(parsed, ANGLE_UNITS.canonical);
      const engineValue = engine.evaluate(`${n} ${unit}`).value.canonical.toNumber();
      expect(micro, `${n}${unit}`).toBeCloseTo(engineValue, 9);
    }
  }
});

test("cross-path agreement: every alias resolves to the same unit on both paths", () => {
  // The whole point of deriving the lexicon. An alias the engine knows and the
  // table does not — or the reverse — is exactly the drift this catches, and it
  // is invisible to any test that only exercises the unit keys.
  const engine = createEngine({
    locales: [composeLocale(en, [angleEn])],
    kinds: [angle],
  });
  for (const [word, unit] of Object.entries(ANGLE_UNITS.alias)) {
    const parsed = parseAngle(`1${word}`);
    expect(parsed.ok, word).toBe(true);
    if (!parsed.ok) continue;
    expect(parsed.unit, word).toBe(unit);
    expect(engine.evaluate(`1 ${word}`).value.unit, word).toBe(unit);
  }
});

test("cross-path agreement: a conversion the engine states in words", () => {
  const engine = createEngine({
    locales: [composeLocale(en, [angleEn])],
    kinds: [angle],
  });
  expect(engine.evaluate("200 grad in deg").formatted).toBe("180 degrees");
  expect(toAngle("200grad", "deg")).toBeCloseTo(180, 9);
  expect(toAngle("0.25turn", "deg")).toBeCloseTo(90, 9);
});

test("the remaining wrappers are wired to the right table", () => {
  expect(subAngle("30deg", "15deg")).toMatchObject({ ok: true, value: 15, unit: "deg" });
  expect(scaleAngle("30deg", 2)).toMatchObject({ ok: true, value: 60, unit: "deg" });
  expect(negateAngle("30deg")).toMatchObject({ ok: true, value: -30, unit: "deg" });
  expect(equalsAngle("180deg", "0.5turn", 1e-12)).toBe(true);
  expect(compareAngle("180deg", "1turn")).toBe(-1);
  expect(formatAngle({ ok: true, value: 30, unit: "deg", raw: "30" })).toBe("30deg");
});

test("the emitted pattern agrees with isAngle", () => {
  for (const mode of ["strict", "loose"] as const) {
    const re = new RegExp(`^(?:${patternForAngle({ mode })})$`, "v");
    for (const input of ["30deg", " 30 deg ", "30DEG", "30", "30smth", "1turn"]) {
      expect(re.test(input), `${mode} ${input}`).toBe(isAngle(input, { mode }));
    }
  }
});

test("contract: units.ts, the descriptor and the vocabulary agree", () => {
  const declared = Object.keys((angle.value as { units: object }).units).sort();
  expect(declared).toEqual(Object.keys(ANGLE_UNITS.ratio).sort());

  // The aliases the engine indexes are the aliases the micro path inverts.
  // They used to be checked against the kind's `lexicon`; that table now lives
  // in `./locale/en`, and it is the same claim asked of its new home.
  const seen = new Set<string>();
  for (const [unit, words] of Object.entries(angleEn.units)) {
    for (const a of words.aliases) {
      expect(ANGLE_UNITS.alias[a], `${a} must be in units.ts`).toBe(unit as AngleUnit);
      seen.add(a);
    }
  }
  // And the other direction: an alias added to units.ts that the vocabulary
  // never derived would mean the engine cannot read what the micro path can.
  expect([...seen].sort()).toEqual(Object.keys(ANGLE_UNITS.alias).sort());
});

test("contract: the descriptor's ratios are the table's strings, digit for digit", () => {
  const declared = (angle.value as { units: Record<string, { toString(): string }> })
    .units;
  for (const [unit, ratio] of Object.entries(ANGLE_UNITS.ratio)) {
    expect(declared[unit]?.toString(), unit).toBe(ratio as string);
  }
});
