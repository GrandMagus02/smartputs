import { expect, test } from "bun:test";
import {
  AmbiguityError,
  KindConflictError,
  NoCandidateError,
  SmartputError,
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
