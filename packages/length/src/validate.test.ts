import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { length } from "./index";
import { LENGTH_UNITS, type LengthUnit } from "./units";
import { addLength, formatLength, parseLength, toLength } from "./validate";

const units = Object.keys(LENGTH_UNITS.ratio) as LengthUnit[];

test("valid and invalid input", () => {
  expect(parseLength("2ft")).toMatchObject({ ok: true, value: 2, unit: "ft" });
  expect(parseLength("3 inches")).toMatchObject({ ok: true, value: 3, unit: "in" });
  expect(parseLength("2metres")).toMatchObject({ ok: true, value: 2, unit: "m" });
  expect(parseLength("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseLength("km")).toMatchObject({ ok: true, value: 1 });
  expect(parseLength("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addLength("1km", "500m");
  expect(sum).toMatchObject({ ok: true, unit: "km" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseLength(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseLength(formatLength(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toLength(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toLength(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [length] });
  for (const unit of units) {
    const parsed = parseLength(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    // "in" is a unit key here but also the engine's own "convert to" keyword
    // (`lex.ts` tokenizes any bare "in" as `keyword`, never `word`), so
    // `engine.evaluate("7 in")` can never reach the length kind at all --
    // only an alias that isn't "in" itself does. The micro path has no
    // keyword grammar, so `parseLength` is unaffected and this substitution
    // is purely about which spelling reaches the engine.
    const engineWord = unit === "in" ? "inch" : unit;
    expect(toLength(parsed, LENGTH_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${engineWord}`).value.canonical.toNumber(),
      9,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((length.value as { units: object }).units).sort()).toEqual(
    Object.keys(LENGTH_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(length.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(LENGTH_UNITS.alias[a], a).toBe(unit as LengthUnit);
  }
});
