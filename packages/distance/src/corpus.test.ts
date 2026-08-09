import { expect, test } from "bun:test";
import { Decimal, type EvalCtx, type Value } from "@smartput/core";
import { Corpora } from "@smartput/core/testing";
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

/**
 * One language, and the table shape anyway.
 *
 * A row here is a pair of alpha-2 codes and a distance in metres, so there is
 * nothing in it for a second language to say — the words "kyiv to warsaw" are
 * `@smartput/country`'s to read, and its corpus is where a translation of them
 * would land. The file is `en.tsv` by the repo's convention rather than by
 * content, and the loader is shared so that a corpus which quietly stopped
 * existing fails here instead of passing with no rows.
 */
const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  { id: "en" },
]);

/** The recorded rows, for the two properties asserted over them below. */
const rows = corpora.rows("en");

corpora.each(([from, to, _pair, kind, unit, metres]) => {
  const out = apply(placeValue(from as string), placeValue(to as string));
  expect(out.kind).toBe(kind as string);
  expect(out.unit).toBe(unit as string);
  expect(out.canonical.toString()).toBe(metres as string);
});

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
