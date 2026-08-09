import { expect, test } from "bun:test";
import { Decimal, type EvalCtx, type Value } from "@smartput/core";
import { COUNTRIES } from "@smartput/country";
import { metresBetween, PlaceDistance, UnpositionedPlaceError } from "./distance";

/**
 * The corpus for `@smartput/distance`: the great-circle op, over the table the
 * place kind registers it with.
 *
 * The op only ever sees a finished `Value`, so the rows build one directly
 * rather than standing up an engine to reach `apply` — the sentence half of
 * "kyiv to warsaw" belongs to `@smartput/country`, and its corpus asserts it
 * there. What is asserted here is the measurement and the refusal.
 *
 * Distances are exact rather than approximate. `between` rounds to the metre
 * precisely so a golden file can be exact: capital coordinates carry five
 * decimal places, and a corpus that had to say "within 1%" would not catch a
 * table row moving by a kilometre.
 */
const distance = new PlaceDistance(COUNTRIES).op;

const rowOf = (a2: string) => {
  const row = COUNTRIES.find((r) => r.a2 === a2);
  if (row === undefined) throw new Error(`the corpus names no country ${a2}`);
  return row;
};

const placeValue = (a2: string): Value => {
  const row = rowOf(a2);
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
};

const apply = (from: Value, to: Value): Value =>
  distance.apply(from, to, { self: from, locale: "en" } as EvalCtx);

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [from, to, pair, kind, unit, metres] of rows) {
  test(`corpus: ${pair}`, () => {
    const out = apply(placeValue(from as string), placeValue(to as string));
    expect(out.kind).toBe(kind as string);
    expect(out.unit).toBe(unit as string);
    expect(out.canonical.toString()).toBe(metres as string);
  });
}

/**
 * `metresBetween` is exported so that "how far apart are these two points" can
 * be asked without a Value or a country table, and the two answers must not
 * drift apart. Checked over the whole corpus rather than once.
 */
test("the exported function agrees with the op on every row", () => {
  for (const [from, to, pair] of rows) {
    const direct = Math.round(metresBetween(rowOf(from as string), rowOf(to as string)));
    const viaOp = apply(placeValue(from as string), placeValue(to as string));
    expect({ pair, metres: viaOp.canonical.toString() }).toEqual({
      pair,
      metres: String(direct),
    });
  }
});

/**
 * The refusal, which has no corpus row because it has no distance.
 *
 * A postal code borrows its country's coordinates until a provider positions
 * it, and measuring from that borrowed point made "SW1A 1AA to EH1 1YZ" —
 * London to Edinburgh — come out as zero. An error naming the remedy beats a
 * confident wrong answer.
 */
test("an unpositioned place is refused rather than measured from its country", () => {
  const unpositioned = Object.freeze({
    kind: "place",
    unit: "gb",
    canonical: new Decimal(0),
    meta: { geonameId: 0, name: "SW1A 1AA", country: "gb", lat: 51.5, lon: -0.12 },
  }) as Value;

  expect(() => apply(unpositioned, placeValue("ua"))).toThrow(UnpositionedPlaceError);
});
