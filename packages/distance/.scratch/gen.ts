import { Decimal, type EvalCtx, type Value } from "@smartput/core";
import { COUNTRIES } from "@smartput/country";
import { metresBetween, PlaceDistance } from "../src/distance";

const distance = new PlaceDistance(COUNTRIES).op;

const rowOf = (a2: string) => {
  const row = COUNTRIES.find((r) => r.a2 === a2);
  if (row === undefined) throw new Error(`no country ${a2}`);
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

const PAIRS: [string, string][] = [
  ["ua", "pl"],
  ["ua", "jp"],
  ["fr", "de"],
  ["us", "ca"],
  ["gb", "ie"],
  ["au", "nz"],
  ["br", "ar"],
  ["cn", "in"],
  ["za", "eg"],
  ["no", "cl"],
  ["ua", "ua"],
  ["is", "nz"],
  ["mx", "es"],
  ["ke", "th"],
  ["se", "fi"],
];

for (const [from, to] of PAIRS) {
  const l = placeValue(from);
  const ctx = { self: l, locale: "en" } as EvalCtx;
  const out = distance.apply(l, placeValue(to), ctx);
  const direct = Math.round(metresBetween(rowOf(from), rowOf(to)));
  if (out.canonical.toString() !== String(direct)) {
    throw new Error(`op and metresBetween disagree for ${from}->${to}`);
  }
  console.log(
    `${from}\t${to}\t${rowOf(from).name} to ${rowOf(to).name}\t${out.kind}\t${out.unit}\t${out.canonical.toString()}`,
  );
}

// The refusal: a postal code nothing has positioned borrows its country's
// coordinates, and measuring from a borrowed point answered "0 km" for two
// codes at opposite ends of one country.
const unpositioned = Object.freeze({
  kind: "place",
  unit: "gb",
  canonical: new Decimal(0),
  meta: { geonameId: 0, name: "SW1A 1AA", country: "gb", lat: 51.5, lon: -0.12 },
}) as Value;
try {
  distance.apply(unpositioned, placeValue("ua"), {
    self: unpositioned,
    locale: "en",
  } as EvalCtx);
  console.log("NO THROW");
} catch (e) {
  console.log(`REFUSAL\t${(e as Error).constructor.name}\t${(e as Error).message}`);
}
