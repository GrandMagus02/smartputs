import { expect, test } from "bun:test";
import type { Admin1Row, CityRow } from "@smartput/city/types";
import { bundled } from "./bundled";

const CITIES: readonly CityRow[] = [
  {
    geonameId: 2_950_159,
    name: "Berlin",
    aliases: ["berlin"],
    country: "de",
    admin1: "16",
    lat: 52.52437,
    lon: 13.41053,
    zone: "Europe/Berlin",
    population: 3_426_354,
    capital: true,
  },
  {
    geonameId: 4_347_778,
    name: "Berlin",
    aliases: ["berlin"],
    country: "us",
    admin1: "MD",
    lat: 38.32262,
    lon: -75.21769,
    zone: "America/New_York",
    population: 4_485,
    capital: false,
  },
  {
    geonameId: 2_988_507,
    name: "Paris",
    aliases: ["paris"],
    country: "fr",
    admin1: "11",
    lat: 48.85341,
    lon: 2.3488,
    zone: "Europe/Paris",
    population: 2_138_551,
    capital: true,
  },
  {
    geonameId: 4_717_560,
    name: "Paris",
    aliases: ["paris"],
    country: "us",
    admin1: "TX",
    lat: 33.66094,
    lon: -95.55551,
    zone: "America/Chicago",
    population: 24_782,
    capital: false,
  },
];

const ADMIN1: readonly Admin1Row[] = [
  { key: "US.TX", name: "Texas", aliases: ["texas", "tx"] },
  { key: "DE.16", name: "Berlin", aliases: ["berlin"] },
];

const provider = bundled({ cities: CITIES, admin1: ADMIN1, asOf: "2026-08-06" });

test("it declares itself offline-usable and interactive", () => {
  expect(provider.id).toBe("bundled");
  expect(provider.interactive).toBe(true);
  expect(provider.attribution).toContain("GeoNames");
  expect(provider.snapshot?.asOf).toBe("2026-08-06");
});

test("an exact name returns every city that answers to it", async () => {
  const hits = await provider.search({ text: "berlin" });
  expect(hits.filter((h) => h.kind === "city")).toHaveLength(2);
});

test("a prefix matches", async () => {
  const hits = await provider.search({ text: "par" });
  expect(hits.some((h) => h.place.name === "Paris")).toBe(true);
});

test("a name nothing answers to returns empty, which is an answer", async () => {
  expect(await provider.search({ text: "atlantis" })).toEqual([]);
});

test("the country filter is honoured by the provider itself", async () => {
  const hits = await provider.search({ text: "berlin", countries: ["us"] });
  expect(hits.every((h) => h.place.country === "us")).toBe(true);
  expect(hits).not.toHaveLength(0);
});

test("admin1 rows are hits of kind admin, and carry no coordinates", async () => {
  const hits = await provider.search({ text: "texas" });
  const admin = hits.find((h) => h.kind === "admin");
  expect(admin?.place.name).toBe("Texas");
  expect(admin?.place.geonameId).toBe(0);
  expect(admin?.place.country).toBe("us");
});

test("a city carries its own zone, not its country's", async () => {
  const hits = await provider.search({ text: "berlin", countries: ["us"] });
  expect(hits[0]?.place.zone).toBe("America/New_York");
});

test("currency is left empty — it is a country-level fact this table lacks", async () => {
  const hits = await provider.search({ text: "paris" });
  expect(hits.every((h) => h.place.currency === "")).toBe(true);
});

test("the snapshot answers a name synchronously", () => {
  expect(provider.snapshot?.find("paris")?.country).toBe("fr");
  expect(provider.snapshot?.find("atlantis")).toBeNull();
});

test("limit is not the provider's to apply — ranking needs every candidate", async () => {
  // The regression this pins: the first version stopped the scan at `limit`
  // candidates in index order, so a query whose exact match sits late in the
  // bucket never reached it. Here "san jose" shares the token "san" with two
  // rows that precede the real one.
  const noise = (geonameId: number, name: string): CityRow => ({
    geonameId,
    name,
    aliases: [name.toLowerCase()],
    country: "ar",
    admin1: "",
    lat: 0,
    lon: 0,
    zone: "America/Argentina/Buenos_Aires",
    population: 900_000,
    capital: false,
  });
  const late = bundled({
    asOf: "2026-08-06",
    cities: [
      noise(1, "San Miguel"),
      noise(2, "San Salvador"),
      {
        geonameId: 3,
        name: "San Jose",
        aliases: ["san jose"],
        country: "us",
        admin1: "CA",
        lat: 37.33939,
        lon: -121.89496,
        zone: "America/Los_Angeles",
        population: 1_026_908,
      },
    ],
  });

  const hits = await late.search({ text: "san jose", limit: 1 });
  expect(hits.map((h) => h.place.name)).toContain("San Jose");
  // The exact match outscores the two that only share a token, so whoever
  // applies the limit above gets the right answer.
  expect(hits.reduce((a, b) => (a.score >= b.score ? a : b)).place.name).toBe("San Jose");
});

test("a place is reported under its best-matching alias, not its first", async () => {
  const p = bundled({
    asOf: "2026-08-06",
    cities: [
      {
        geonameId: 3_621_849,
        name: "San José",
        aliases: ["san josé", "san jose"],
        country: "cr",
        admin1: "08",
        lat: 9.93333,
        lon: -84.08333,
        zone: "America/Costa_Rica",
        population: 335_007,
      },
    ],
  });
  const hits = await p.search({ text: "san jose" });
  expect(hits).toHaveLength(1);
  expect(hits[0]?.matched).toBe("san jose");
});

test("no admin1 table means no admin hits and no crash", async () => {
  const cities = bundled({ cities: CITIES, asOf: "2026-08-06" });
  const hits = await cities.search({ text: "texas" });
  expect(hits).toEqual([]);
});
