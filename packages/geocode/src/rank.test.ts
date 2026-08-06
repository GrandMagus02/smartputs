import { expect, test } from "bun:test";
import type { Place } from "./place";
import type { GeocodeHit } from "./query";
import { dedupe, proximity, rankHits, similarity } from "./rank";

function place(over: Partial<Place> = {}): Place {
  return {
    geonameId: 1,
    name: "Berlin",
    zone: "Europe/Berlin",
    currency: "",
    lat: 52.52,
    lon: 13.405,
    population: 3_600_000,
    country: "de",
    admin1: "16",
    postal: "",
    ...over,
  };
}

function hit(over: Partial<GeocodeHit> = {}): GeocodeHit {
  return {
    place: place(),
    kind: "city",
    score: 0,
    matched: "berlin",
    source: "a",
    ...over,
  };
}

test("an exact name scores 1", () => {
  expect(similarity("berlin", "Berlin")).toBe(1);
  expect(similarity("  BERLIN ", "berlin")).toBe(1);
});

test("a prefix beats a token hit, and both beat nothing", () => {
  const prefix = similarity("ber", "berlin");
  const token = similarity("york new", "new york");
  expect(prefix).toBeGreaterThan(token);
  expect(token).toBeGreaterThan(0);
  expect(similarity("tokyo", "berlin")).toBe(0);
});

test("a longer prefix of the same name scores higher", () => {
  expect(similarity("berli", "berlin")).toBeGreaterThan(similarity("be", "berlin"));
});

test("similarity is bounded to 0..1", () => {
  for (const [a, b] of [
    ["", "x"],
    ["x", ""],
    ["a b c d", "a"],
    ["berlin", "berlin"],
  ]) {
    const s = similarity(a as string, b as string);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  }
});

test("proximity decays with separation and is bounded to 0..1", () => {
  const here = { lat: 52.52, lon: 13.405 };
  const near = proximity(here, { lat: 52.5, lon: 13.4 });
  const far = proximity(here, { lat: -33.87, lon: 151.21 });
  expect(near).toBeGreaterThan(far);
  expect(near).toBeLessThanOrEqual(1);
  expect(far).toBeGreaterThanOrEqual(0);
});

test("proximity survives the antimeridian", () => {
  const a = proximity({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 });
  const b = proximity({ lat: 0, lon: 179.9 }, { lat: 0, lon: 100 });
  expect(a).toBeGreaterThan(b);
});

test("dedupe joins two rows carrying the same geoname id, keeping the higher score", () => {
  const out = dedupe([
    hit({ score: 0.4, source: "a" }),
    hit({ score: 0.9, source: "b" }),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]?.source).toBe("b");
});

test("dedupe falls back to name, country and coordinates when the id is 0", () => {
  const a = hit({ place: place({ geonameId: 0 }), score: 0.4 });
  const b = hit({ place: place({ geonameId: 0, lat: 52.5201 }), score: 0.9 });
  expect(dedupe([a, b])).toHaveLength(1);
});

test("dedupe keeps genuinely different places apart", () => {
  const paris = hit({ place: place({ geonameId: 2, name: "Paris", country: "fr" }) });
  expect(dedupe([hit(), paris])).toHaveLength(2);
});

test("dedupe is idempotent", () => {
  const hits = [
    hit({ score: 0.4 }),
    hit({ score: 0.9 }),
    hit({ place: place({ geonameId: 2 }) }),
  ];
  const once = dedupe(hits);
  expect(dedupe(once)).toEqual(once);
});

test("ranking is deterministic", () => {
  const hits = [
    hit({ place: place({ geonameId: 2, name: "Berlin", population: 100 }), source: "b" }),
    hit({ place: place({ geonameId: 3, name: "Berlin", population: 100 }), source: "a" }),
    hit({ place: place({ geonameId: 4, name: "Berlin Heights", population: 9 }) }),
  ];
  const q = { text: "berlin" };
  const w = (s: string) => (s === "a" ? 1 : 0.5);
  expect(rankHits(hits, q, w).map((h) => h.place.geonameId)).toEqual(
    rankHits([...hits].reverse(), q, w).map((h) => h.place.geonameId),
  );
});

test("the closer name wins over the bigger population", () => {
  const exact = hit({ place: place({ geonameId: 2, population: 1 }), matched: "berlin" });
  const partial = hit({
    place: place({ geonameId: 3, population: 9_000_000 }),
    matched: "berlin heights",
  });
  const out = rankHits([partial, exact], { text: "berlin" }, () => 1);
  expect(out[0]?.place.geonameId).toBe(2);
});

test("limit is respected", () => {
  const hits = [1, 2, 3, 4].map((n) => hit({ place: place({ geonameId: n }) }));
  expect(rankHits(hits, { text: "berlin", limit: 2 }, () => 1)).toHaveLength(2);
});

test("every ranked score is inside 0..1", () => {
  const out = rankHits(
    [hit(), hit({ place: place({ geonameId: 2, population: 40_000_000 }) })],
    { text: "berlin", near: { lat: 52.5, lon: 13.4 } },
    () => 1,
  );
  for (const h of out) {
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(1);
  }
});
