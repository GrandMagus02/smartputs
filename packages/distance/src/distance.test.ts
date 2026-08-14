import { expect, test } from "bun:test";
import { Decimal, type EvalCtx, type Value } from "@smartput/core";
import { PlaceDistance } from "./distance";
import { PLACES } from "./places.fixture";

// One op over the shipped table, which is what `definePlace` registers.
const distance = new PlaceDistance(PLACES).op;

// The matcher builds these in the real pipeline; the op only ever sees the
// finished Value, so the test builds one directly rather than standing up an
// engine to reach an `apply`.
function placeValue(a2: string): Value {
  const row = PLACES.find((r) => r.a2 === a2);
  if (row === undefined) throw new Error(`no country ${a2}`);
  return Object.freeze({
    kind: "place",
    unit: row.a2,
    canonical: new Decimal(row.geonameId),
    meta: {
      geonameId: row.geonameId,
      zone: row.zone,
      currency: row.currency,
      lat: row.lat,
      lon: row.lon,
      population: row.population,
      country: row.a2,
    },
  });
}

function apply(from: string, to: string): Value {
  const l = placeValue(from);
  const ctx = { self: l, locale: "en" } as EvalCtx;
  return distance.apply(l, placeValue(to), ctx);
}

const km = (from: string, to: string) => apply(from, to).canonical.toNumber() / 1000;

// Expected values are the great-circle distance between the capitals the data
// file emits, on a 6371008.8 m sphere: Tokyo-Kyiv and Paris-Berlin.
const within = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);
};

test("the signature is `in | place | place -> length`", () => {
  expect(distance.op).toBe("in");
  expect(distance.left).toBe("place");
  expect(distance.right).toBe("place");
  expect(distance.result).toBe("length");
});

test("the great-circle reading is recorded as an assumption", () => {
  expect(distance.assumption?.code).toBe("great-circle");
});

test("japan to ukraine is about 8199 km", () => {
  within(km("jp", "ua"), 8198.981);
});

test("france to germany is about 878 km", () => {
  within(km("fr", "de"), 878.399);
});

test("the result is a length in km, canonical metres", () => {
  const v = apply("fr", "de");
  expect(v.kind).toBe("length");
  expect(v.unit).toBe("km");
  expect(v.canonical.toString()).toBe("878399");
});

test("a stand-in right operand is read from its unit, not its borrowed meta", () => {
  // What core hands `apply` when the target stayed a unit alias: canonical 0
  // and the left operand's meta. Reading that meta answers 0 km for Tokyo to
  // Kyiv, which is the failure this exists to prevent.
  const l = placeValue("jp");
  const standIn: Value = Object.freeze({
    kind: "place",
    unit: "ua",
    canonical: new Decimal(0),
    ...(l.meta ? { meta: l.meta } : {}),
  });
  const ctx = { self: l, locale: "en" } as EvalCtx;
  const metres = distance.apply(l, standIn, ctx).canonical.toNumber();
  within(metres / 1000, 8198.981);
});

test("a place against itself is exactly zero", () => {
  expect(km("jp", "jp")).toBe(0);
  expect(km("aq", "aq")).toBe(0);
});

test("the antipodal case does not go NaN", () => {
  // sqrt(a) can land a hair above 1 there, and asin of that is NaN.
  const half = Math.PI * 6371008.8;
  for (const [a, b] of [
    ["nz", "es"],
    ["fj", "ml"],
  ] as const) {
    const d = km(a, b) * 1000;
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeLessThanOrEqual(half + 1);
  }
});
