import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { Tempo } from "./class";
import { tempo } from "./index";
import { TEMPO_UNITS, type TempoUnit } from "./units";
import { addTempo, formatTempo, parseTempo, patternForTempo, toTempo } from "./validate";

const units = Object.keys(TEMPO_UNITS.ratio) as TempoUnit[];

test("valid and invalid input", () => {
  expect(parseTempo("120bpm")).toMatchObject({ ok: true, value: 120, unit: "bpm" });
  expect(parseTempo("2 hertz")).toMatchObject({ ok: true, value: 2, unit: "hz" });
  expect(parseTempo("0.5 Hz")).toMatchObject({ ok: true, value: 0.5, unit: "hz" });
  expect(parseTempo("120smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  // A unit with no count is one of it. A word that names no unit is still
  // `nan`: with no number in the string, nothing said a unit was expected.
  expect(parseTempo("bpm")).toMatchObject({ ok: true, value: 1 });
  expect(parseTempo("smth")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addTempo("120bpm", "1hz");
  expect(sum).toMatchObject({ ok: true, unit: "bpm" });
  if (sum.ok) expect(sum.value).toBeCloseTo(180, 12);
});

test("hertz is sixty beats a minute through the wrapper", () => {
  expect(toTempo("1hz", "bpm")).toBe(60);
  expect(toTempo("120bpm", "hz")).toBe(2);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseTempo(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseTempo(formatTempo(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toTempo(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toTempo(
        { ok: true, value: there, unit: to, raw: String(there) },
        from,
      );
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 6);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [composeLocale(en)], kinds: [tempo] });
  for (const unit of units) {
    const parsed = parseTempo(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toTempo(parsed, TEMPO_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      6,
    );
  }
});

// A two-unit table is the smallest one this repo has, so the generic surfaces
// are checked here rather than assumed: `patternFor` alternates over the alias
// list and `createValueClass` enumerates `Object.keys(table.ratio)`, and both
// would be a plausible place for a "more than one of these" assumption to hide.
test("the class surface holds with only two units", () => {
  expect(Tempo.units).toEqual(["bpm", "hz"]);
  expect(Tempo.canonical).toBe("bpm");
  expect(Tempo.parse("120 bpm").as("hz").value).toBeCloseTo(2, 12);
  expect(Tempo.from({ ok: true, value: 1, unit: "hz", raw: "1" }).to("bpm")).toBe(60);
  expect(new Tempo(120, "bpm").compare("1 hz")).toBe(1);
});

test("the pattern alternates over both units in both modes", () => {
  const strict = new RegExp(`^(?:${patternForTempo({ mode: "strict" })})$`, "u");
  const loose = new RegExp(`^(?:${patternForTempo()})$`, "u");
  expect(strict.test("120 bpm")).toBe(true);
  expect(strict.test("2hz")).toBe(true);
  // Longest-first ordering is what keeps `hz` from claiming the prefix of
  // `hertz` and leaving `ertz` unmatched.
  expect(strict.test("2 hertz")).toBe(true);
  expect(loose.test("  0.5 Hz  ")).toBe(true);
  expect(loose.test("120 rpm")).toBe(false);
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((tempo.value as { units: object }).units).sort()).toEqual(
    Object.keys(TEMPO_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(tempo.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(TEMPO_UNITS.alias[a], a).toBe(unit as TempoUnit);
  }
});
