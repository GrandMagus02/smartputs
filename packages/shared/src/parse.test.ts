import { describe, expect, test } from "bun:test";
import { is, parse } from "./parse";
import type { ErrCode, UnitTable } from "./types";

type AngleUnit = "rad" | "deg" | "grad" | "turn";

const T: UnitTable<AngleUnit> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    grad: "0.0157079632679489661923132169164",
    turn: "6.28318530717958647692528676656",
  },
  alias: {
    rad: "rad",
    radian: "rad",
    radians: "rad",
    deg: "deg",
    degree: "deg",
    degrees: "deg",
    grad: "grad",
    gradian: "grad",
    gradians: "grad",
    gon: "grad",
    turn: "turn",
    turns: "turn",
    rev: "turn",
    revolution: "turn",
  },
};

describe("accepted in both modes", () => {
  for (const [input, value, unit] of [
    ["30deg", 30, "deg"],
    ["30 deg", 30, "deg"],
    ["-30.5deg", -30.5, "deg"],
    ["+30deg", 30, "deg"],
    ["1e3deg", 1000, "deg"],
    ["0.25turn", 0.25, "turn"],
    ["5 radians", 5, "rad"],
  ] as const) {
    test(`${input} in strict`, () => {
      expect(parse(T, input, { mode: "strict" })).toEqual({
        ok: true,
        value,
        unit,
        raw: input.replace(/\s*[a-z]+$/i, "").trim(),
      });
    });
    test(`${input} in loose`, () => {
      const r = parse(T, input);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBe(value);
        expect(r.unit).toBe(unit);
      }
    });
  }
});

describe("the strict/loose difference", () => {
  test("outer whitespace: strict rejects, loose trims", () => {
    expect(parse(T, "  30deg  ", { mode: "strict" })).toEqual({
      ok: false,
      code: "trailing",
      input: "  30deg  ",
    });
    expect(parse(T, "  30deg  ")).toMatchObject({ ok: true, value: 30, unit: "deg" });
  });

  test("case: strict rejects, loose folds", () => {
    expect(parse(T, "30DEG", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "unknown-unit",
    });
    expect(parse(T, "30Deg")).toMatchObject({ ok: true, unit: "deg" });
  });

  test("bare number: strict rejects, loose needs defaultUnit", () => {
    expect(parse(T, "30", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "missing-unit",
    });
    expect(parse(T, "30", { mode: "strict", defaultUnit: "deg" })).toMatchObject({
      ok: false,
      code: "missing-unit",
    });
    expect(parse(T, "30")).toMatchObject({ ok: false, code: "missing-unit" });
    expect(parse(T, "30", { defaultUnit: "deg" })).toMatchObject({
      ok: true,
      value: 30,
      unit: "deg",
    });
  });
});

describe("a unit with no count", () => {
  test("is one of that unit", () => {
    expect(parse(T, "deg")).toMatchObject({ ok: true, value: 1, unit: "deg" });
    expect(parse(T, "rad")).toMatchObject({ ok: true, value: 1, unit: "rad" });
  });

  test("is folded and trimmed like any other loose input", () => {
    expect(parse(T, "  DEG  ")).toMatchObject({ ok: true, value: 1, unit: "deg" });
  });

  test("round-trips: the raw it reports is the number it implied", () => {
    const ok = parse(T, "deg");
    if (!ok.ok) throw new Error("unreachable");
    expect(ok.raw).toBe("1");
    expect(parse(T, `${ok.raw}${ok.unit}`, { mode: "strict" })).toMatchObject(ok);
  });

  test("still answers to `unit`, which is orthogonal to mode", () => {
    expect(parse(T, "deg", { unit: "rad" })).toMatchObject({
      ok: false,
      code: "wrong-unit",
    });
  });

  test("is loose only: strict has no implied count, as it has no implied unit", () => {
    expect(parse(T, "deg", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "nan",
    });
  });

  test("a word that names no unit is still nan, not unknown-unit", () => {
    // `unknown-unit` is what a *number* beside a bad word gets. With no number
    // there is nothing to say a unit was expected, so the older code names the
    // older problem: this string never looked like a value at all.
    expect(parse(T, "smth")).toMatchObject({ ok: false, code: "nan" });
    expect(is(T, "smth")).toBe(false);
  });
});

describe("rejected in both modes", () => {
  for (const [input, code] of [
    ["", "empty"],
    ["   ", "empty"],
    ["30,5deg", "nan"],
    ["30smth", "unknown-unit"],
    ["30 deg extra", "trailing"],
  ] as const) {
    test(`${JSON.stringify(input)} -> ${code}`, () => {
      expect(parse(T, input, { mode: "strict" })).toMatchObject({ ok: false, code });
      expect(parse(T, input)).toMatchObject({ ok: false, code });
    });
  }
});

/**
 * The spec's strict/loose table (§5), transcribed row by row so a change to
 * either mode has to argue with the document rather than with a memory of it.
 * `null` means "this row is accepted in that mode".
 */
describe("spec §5 strict/loose table", () => {
  const rows: ReadonlyArray<
    readonly [input: string, strict: ErrCode | null, loose: ErrCode | null]
  > = [
    ["30deg", null, null],
    ["30 deg", null, null],
    ["-30.5deg", null, null],
    ["+30deg", null, null],
    ["1e3deg", null, null],
    ["  30deg  ", "trailing", null],
    ["30DEG", "unknown-unit", null],
    ["30Deg", "unknown-unit", null],
    ["30", "missing-unit", "missing-unit"],
    // A unit with no count is one of it, in loose mode only. Strict accepts
    // exactly what `format` emits and `format` always writes the number, so a
    // bare unit there is still input that never started.
    ["deg", "nan", null],
    ["DEG", "nan", null],
    ["smth", "nan", "nan"],
    ["30,5deg", "nan", "nan"],
    ["30smth", "unknown-unit", "unknown-unit"],
    ["30 deg extra", "trailing", "trailing"],
    ["", "empty", "empty"],
    ["   ", "empty", "empty"],
  ];

  for (const [input, strictCode, looseCode] of rows) {
    test(`${JSON.stringify(input)}: strict ${strictCode ?? "ok"}, loose ${looseCode ?? "ok"}`, () => {
      const strict = parse(T, input, { mode: "strict" });
      expect(strict.ok ? null : strict.code).toBe(strictCode);
      const loose = parse(T, input);
      expect(loose.ok ? null : loose.code).toBe(looseCode);
    });
  }

  test("the bare-number row is the only one defaultUnit changes", () => {
    expect(parse(T, "30", { defaultUnit: "deg" })).toMatchObject({
      ok: true,
      unit: "deg",
    });
    expect(parse(T, "30", { mode: "strict", defaultUnit: "deg" })).toMatchObject({
      ok: false,
      code: "missing-unit",
    });
  });

  test("whitespace-only is empty, not trailing, even though strict rejects trims", () => {
    expect(parse(T, " \t\n ", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "empty",
    });
  });

  test("an Err carries the input exactly as given, untrimmed", () => {
    expect(parse(T, "  30smth  ")).toEqual({
      ok: false,
      code: "unknown-unit",
      input: "  30smth  ",
    });
  });
});

test("opts.unit turns any other valid unit into wrong-unit", () => {
  expect(parse(T, "30deg", { unit: "deg" })).toMatchObject({ ok: true });
  expect(parse(T, "30rad", { unit: "deg" })).toEqual({
    ok: false,
    code: "wrong-unit",
    input: "30rad",
  });
});

test("opts.unit is orthogonal to mode and leaves unknown words unknown", () => {
  // Strict still rejects what strict rejects; opts.unit does not loosen it.
  expect(parse(T, "30RAD", { unit: "deg", mode: "strict" })).toMatchObject({
    ok: false,
    code: "unknown-unit",
  });
  // Loose folds case first, then disagrees about the unit.
  expect(parse(T, "30RAD", { unit: "deg" })).toMatchObject({
    ok: false,
    code: "wrong-unit",
  });
  // A word that is nobody's alias is unknown, never wrong.
  expect(parse(T, "30smth", { unit: "deg" })).toMatchObject({
    ok: false,
    code: "unknown-unit",
  });
  // And it applies to the defaultUnit path too.
  expect(parse(T, "30", { unit: "deg", defaultUnit: "rad" })).toMatchObject({
    ok: false,
    code: "wrong-unit",
  });
});

test("resolve is consulted only after the alias lookup misses", () => {
  const calls: string[] = [];
  const resolve = (word: string): AngleUnit | undefined => {
    calls.push(word);
    return word === "d" ? "deg" : undefined;
  };
  expect(parse(T, "30deg", { resolve })).toMatchObject({ ok: true, unit: "deg" });
  expect(calls).toEqual([]);
  expect(parse(T, "30d", { resolve })).toMatchObject({ ok: true, unit: "deg" });
  expect(calls).toEqual(["d"]);
});

test("raw preserves the number exactly as authored", () => {
  const r = parse(T, "30.500deg");
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.raw).toBe("30.500");
});

test("results are frozen", () => {
  expect(Object.isFrozen(parse(T, "30deg"))).toBe(true);
  expect(Object.isFrozen(parse(T, "30smth"))).toBe(true);
});

test("is() is parse().ok", () => {
  expect(is(T, "30deg")).toBe(true);
  expect(is(T, "30smth")).toBe(false);
});
