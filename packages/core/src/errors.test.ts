import { expect, test } from "bun:test";
import {
  AmbiguityError,
  KindConflictError,
  MissingRateError,
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
