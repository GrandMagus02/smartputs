import { expect, test } from "bun:test";
import {
  AmbiguityError,
  DimensionMismatchError,
  DivideByZeroError,
  KindConflictError,
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
// still have to be in the hierarchy, so they report an empty input rather than
// dropping the field.
test("registration errors are in the hierarchy with an empty input", () => {
  expect(new KindConflictError("length", "registered twice").input).toBe("");
  expect(new UnknownKindError("en", "length").input).toBe("");
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
