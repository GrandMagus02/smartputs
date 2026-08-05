import { expect, test } from "bun:test";
import {
  buildRegistry,
  Decimal,
  type EvalCtx,
  type MatchCtx,
  type Value,
} from "@smartput/core";
import { length } from "@smartput/length";
import { number } from "@smartput/number";
import { COUNTRIES } from "./data/countries";
import { distance } from "./distance";
import { createPlaceLiteral } from "./matcher";
import { place } from "./place";
import type { CountryRow } from "./types";

const registry = buildRegistry([number, length, place], [], "en");
const units = registry.kinds.get("place")?.units;

function placeValue(a2: string): Value {
  const row = COUNTRIES.find((r) => r.a2 === a2);
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

function metres(from: string, to: string): number {
  const l = placeValue(from);
  const ctx = { self: l, locale: "en" } as EvalCtx;
  return distance.apply(l, placeValue(to), ctx).canonical.toNumber();
}

// Every row against the next one, wrapping — one pair per country, spread over
// the whole table, rather than the 63,504 a full cross product would cost.
const PAIRS: Array<[string, string]> = COUNTRIES.map((row, i) => [
  row.a2,
  (COUNTRIES[(i + 1) % COUNTRIES.length] as CountryRow).a2,
]);

test("distance is symmetric", () => {
  for (const [a, b] of PAIRS) {
    expect(metres(a, b)).toBe(metres(b, a));
  }
});

test("distance is non-negative and never exceeds half the circumference", () => {
  const half = Math.PI * 6371008.8;
  for (const [a, b] of PAIRS) {
    const d = metres(a, b);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(half + 1);
  }
});

test("a place against itself is zero", () => {
  for (const row of COUNTRIES) {
    expect(metres(row.a2, row.a2)).toBe(0);
  }
});

test("every country is a registered unit of the kind", () => {
  for (const row of COUNTRIES) {
    expect(units?.has(row.a2)).toBe(true);
  }
});

const matcher = createPlaceLiteral(COUNTRIES);
const matchCtx: MatchCtx = {
  locale: "en",
  now: 0,
  timeZone: "UTC",
  isUnitAlias: (text) => registry.aliasIndex.has(text.toLowerCase()),
};

test("every place Value's meta.country equals its unit", () => {
  // Every alias of every row, rather than one per row: an alias two countries
  // share resolves to whichever the matcher ranks first, and the property holds
  // for the winner either way.
  let claimed = 0;
  for (const row of COUNTRIES) {
    for (const alias of row.aliases) {
      // Null where the alias is a conversion keyword — "to" is Tonga.
      const match = matcher(alias, 0, matchCtx);
      if (match === null) continue;
      claimed += 1;
      const meta = match.meta as Record<string, unknown>;
      expect(match.kind).toBe("place");
      expect(units?.has(match.unit)).toBe(true);
      expect(meta.country).toBe(match.unit);
      expect(match.canonical.toString()).toBe(String(meta.geonameId));
    }
  }
  expect(claimed).toBeGreaterThan(COUNTRIES.length);
});
