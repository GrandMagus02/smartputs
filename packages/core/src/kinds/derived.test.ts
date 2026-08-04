import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { KindConflictError } from "../errors";
import en from "../locale/en";
import { area, speed, volume } from "./derived";
import { BUILTIN_KINDS } from "./index";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, speed, area, volume],
});

test("length over duration is a speed", () => {
  const r = engine.evaluate("100 km / 2 h");
  expect(r.kind).toBe("speed");
  expect(r.value.canonical.toFixed(6)).toBe("13.888889");
});

test("a speed converts to another speed unit", () => {
  expect(engine.evaluate("100 km / 1 h in kph").formatted).toBe("100kph");
});

test("length times length is an area", () => {
  const r = engine.evaluate("3 m * 4 m");
  expect(r.kind).toBe("area");
  expect(r.value.canonical.toString()).toBe("12");
});

test("area times length is a volume", () => {
  const r = engine.evaluate("3 m * 4 m * 2 m");
  expect(r.kind).toBe("volume");
  // volume.value.canonical is "l" — a Value's `canonical` field for this kind
  // is a magnitude in litres. area's canonical is m², length's is m, so
  // `area.canonical * length.canonical` is a magnitude in m³. 1 m³ = 1000 l,
  // so converting that product into the litre-denominated canonical requires
  // *multiplying* by 1000: 3m * 4m * 2m = 24 m³ = 24000 l.
  expect(r.value.canonical.toString()).toBe("24000");
  // The result is authored back out in m³ (the `unit` the op signature
  // attaches), so a reader sees the natural "24m³" rather than 24000 litres.
  expect(r.formatted).toBe("24m³");
});

test("scaling a length by a number is still a length", () => {
  // Not "3 m * 4": duration's "min" unit also aliases "m" (see
  // duration.ts), so a bare "m" with no other-kind context to disambiguate
  // is a genuine 50/50 tie between length:m and duration:min and throws
  // AmbiguityError — independent of this file, reproducible on plain
  // BUILTIN_KINDS. "km" has no such alias collision.
  expect(engine.evaluate("3 km * 4").kind).toBe("length");
});

test("registering two kinds that claim the same signature throws", () => {
  const impostor = {
    ...area,
    id: "impostor",
  };
  expect(() =>
    createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, area, impostor] }),
  ).toThrow(KindConflictError);
});
