import { expect, test } from "bun:test";
import {
  AmbiguityError,
  DimensionMismatchError,
  DivideByZeroError,
  KindConflictError,
  MissingRateError,
  NoCandidateError,
  SmartputError,
  TooAmbiguousError,
  UnitParseError,
  UnknownKindError,
} from "./errors";

test("errors carry the input and are instanceof SmartputError", () => {
  const err = new NoCandidateError("10 zz", "zz", ["oz"]);
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.input).toBe("10 zz");
  expect(err.token).toBe("zz");
  expect(err.nearest).toEqual(["oz"]);
  expect(err.name).toBe("NoCandidateError");
});

// Spec §7: "All extend SmartputError and carry input and spans." engine.ts
// branches on `instanceof SmartputError` to tell "no interpretation" from "a bug
// in the pipeline", so an error outside the hierarchy is reported as a crash.
test("every error extends SmartputError and carries input and spans", () => {
  const errors = [
    new UnitParseError("abc"),
    new AmbiguityError("10 m", []),
    new NoCandidateError("10 zz", "zz", []),
    new DimensionMismatchError("10 km in kg", "in", "length", "mass"),
    new TooAmbiguousError("x", 20, 10),
    new KindConflictError("length", "registered twice"),
    new UnknownKindError("en", "length"),
    new DivideByZeroError("1/0"),
  ];

  for (const err of errors) {
    expect(err).toBeInstanceOf(SmartputError);
    expect(typeof err.input).toBe("string");
    expect(err.spans).toEqual([]);
  }
});

// Registration runs at createEngine() time, before any input exists. These two
// still have to be in the hierarchy — engine.ts branches on `instanceof
// SmartputError` — so rather than drop the field they carry the offending
// identifier in it: the kind id, and the locale pack's name.
test("registration errors are in the hierarchy and name what they blame", () => {
  const conflict = new KindConflictError("length", "registered twice");
  expect(conflict).toBeInstanceOf(SmartputError);
  expect(conflict.input).toBe("length");
  expect(conflict.kind).toBe("length");

  const unknown = new UnknownKindError("en", "length", "furlong");
  expect(unknown).toBeInstanceOf(SmartputError);
  expect(unknown.input).toBe("en");
  expect(unknown.pack).toBe("en");
  expect(unknown.unit).toBe("furlong");
});

test("AmbiguityError lists its candidates", () => {
  const err = new AmbiguityError("10 m", [
    { kind: "length", unit: "m", confidence: 0.55 },
    { kind: "duration", unit: "min", confidence: 0.45 },
  ]);
  expect(err.candidates).toHaveLength(2);
  expect(err.message).toContain("length");
  expect(err.message).toContain("duration");
});

test("configuration errors are SmartputErrors too", () => {
  // The facade throws KindConflictError at runtime (quantity.ts, an affine
  // kind whose delta kind has no facade), so a consumer catching
  // SmartputError must not fall through to a generic handler.
  const conflict = new KindConflictError("temperature", "delta kind missing");
  expect(conflict).toBeInstanceOf(SmartputError);
  expect(conflict.name).toBe("KindConflictError");
  expect(conflict.kind).toBe("temperature");

  const unknown = new UnknownKindError("uk", "nosuchkind", "x");
  expect(unknown).toBeInstanceOf(SmartputError);
  expect(unknown.name).toBe("UnknownKindError");
  expect(unknown.pack).toBe("uk");
  expect(unknown.unit).toBe("x");
});

test("a missing rate names the pair and the snapshot date", () => {
  const err = new MissingRateError("30 usd in jpy", "USD", "JPY", "2026-08-04");
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.name).toBe("MissingRateError");
  expect(err.from).toBe("USD");
  expect(err.to).toBe("JPY");
  expect(err.asOf).toBe("2026-08-04");
  expect(err.message).toContain("USD");
  expect(err.message).toContain("JPY");
  expect(err.message).toContain("2026-08-04");
});

// R-E1: the probe reported `op: "operation"` and one pair of kinds, so
// "10 kg / 2 m" blamed MASS AND DURATION — a duration nobody typed. The
// message now quotes the operands as written and lists every pair enumerated.
test("DimensionMismatchError names the operator and every pair tried", () => {
  const err = new DimensionMismatchError(
    "10 kg / 2 m",
    "/",
    "mass",
    "length",
    [
      ["mass", "length"],
      ["mass", "duration"],
    ],
    [
      { start: 0, end: 5 },
      { start: 6, end: 7 },
      { start: 8, end: 11 },
    ],
  );
  expect(err.op).toBe("/");
  expect(err.tried).toEqual([
    ["mass", "length"],
    ["mass", "duration"],
  ]);
  expect(err.spans).toHaveLength(3);
  expect(err.message).toBe(
    "Cannot apply / to `10 kg` and `2 m`: no signature for mass / length or mass / duration",
  );
});

test("one pair reads as one clause", () => {
  const err = new DimensionMismatchError(
    "1 kg + 1 s",
    "+",
    "mass",
    "duration",
    [["mass", "duration"]],
    [
      { start: 0, end: 4 },
      { start: 5, end: 6 },
      { start: 7, end: 10 },
    ],
  );
  expect(err.message).toBe(
    "Cannot apply + to `1 kg` and `1 s`: no signature for mass + duration",
  );
});

test("with no spans the message falls back to naming the kinds", () => {
  const err = new DimensionMismatchError("x", "*", "mass", "length");
  expect(err.message).toBe(
    "Cannot apply * to mass and length: no signature for mass * length",
  );
});

test("UnitParseError carries the span of what could not be parsed", () => {
  const err = new UnitParseError("5 ft 3", undefined, [{ start: 5, end: 6 }]);
  expect(err.spans).toEqual([{ start: 5, end: 6 }]);
});
