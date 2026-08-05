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
import { ADMIN1 } from "./data/admin1";
import { CITIES } from "./data/cities";
import { COUNTRIES } from "./data/countries";
import { RESERVED_WORDS } from "./data/reserved";
import { distance } from "./distance";
import { createPlaceLiteral } from "./matcher";
import { place } from "./place";
import type { CityRow, CountryRow } from "./types";

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

// ---- the same properties over T1, where six thousand rows can break them ----

const CURRENCY = new Map(COUNTRIES.map((row) => [row.a2, row.currency]));

/**
 * What the matcher builds for a city, built here instead so the properties below
 * hold for every row rather than only for the rows a claim happens to reach: a
 * city whose alias the matcher refuses still has a position, and a distance
 * property that skipped it would be silent about exactly the rows most likely to
 * be wrong.
 */
function cityValue(row: CityRow): Value {
  return Object.freeze({
    kind: "place",
    // Spec §4.1: a city is not a unit, so it borrows the one thing about it that
    // is registered. This line is the invariant the next test asserts.
    unit: row.country,
    canonical: new Decimal(row.geonameId),
    meta: {
      geonameId: row.geonameId,
      zone: row.zone,
      currency: CURRENCY.get(row.country) ?? "",
      lat: row.lat,
      lon: row.lon,
      population: row.population,
      country: row.country,
    },
  });
}

function cityMetres(a: CityRow, b: CityRow): number {
  const l = cityValue(a);
  const ctx = { self: l, locale: "en" } as EvalCtx;
  return distance.apply(l, cityValue(b), ctx).canonical.toNumber();
}

const CITY_PAIRS: Array<[CityRow, CityRow]> = CITIES.map((row, i) => [
  row,
  CITIES[(i + 1) % CITIES.length] as CityRow,
]);

test("distance between cities is symmetric and zero for a city against itself", () => {
  // The T0 version of this walks capitals, which are one position per country and
  // all of them well inside the temperate latitudes. T1 reaches Longyearbyen and
  // Ushuaia and every antipodal pair between them, which is where the clamped
  // asin in `metresBetween` earns its comment.
  for (const [a, b] of CITY_PAIRS) {
    expect(cityMetres(a, b)).toBe(cityMetres(b, a));
    expect(cityMetres(a, a)).toBe(0);
  }
});

test("every city's unit is its country's alpha-2, and the kind registers it", () => {
  // Asserted over the table rather than over claims, which is the stronger of the
  // two: `LiteralMatch.unit` naming something the kind never registered is a
  // resolver error the fold reports as a dropped match, so a single bad row would
  // show up as a name that silently stopped resolving.
  for (const row of CITIES) {
    const value = cityValue(row);
    const meta = value.meta as Record<string, unknown>;
    expect(value.unit).toBe(row.country);
    expect(meta.country).toBe(value.unit);
    expect(units?.has(value.unit)).toBe(true);
  }
});

const cityMatcher = createPlaceLiteral(COUNTRIES, CITIES, ADMIN1);

test("no reserved word is claimable, as a city or as anything else", () => {
  // The second of the two nets described in `cityClaimable`. The generator
  // already filtered CITIES and ADMIN1 by this set — data/cities.test.ts asserts
  // that — so this asserts the other end: that the matcher refuses the word even
  // if a future table arrives carrying it.
  //
  // Run against a context that knows only this kind's own aliases, which is the
  // harshest reading of the property: `isUnitAlias` would refuse most of these
  // words for the matcher in any engine that registered the kinds they came from,
  // and a net that only holds while its neighbours are loaded is not a net.
  const bare = buildRegistry([place], [], "en");
  const ctx: MatchCtx = {
    locale: "en",
    now: 0,
    timeZone: "UTC",
    isUnitAlias: (text) => bare.aliasIndex.has(text.toLowerCase()),
  };
  const claimed = [...RESERVED_WORDS].filter(
    (word) => cityMatcher(word, 0, ctx) !== null,
  );
  expect(claimed).toEqual([]);
});
