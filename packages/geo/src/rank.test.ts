import { expect, test } from "bun:test";
import type { Place } from "./place";
import { dedupe, haversine, identity, inBbox, rank, similarity, WEIGHTS } from "./rank";
import type { GeoHit, GeoQuery } from "./types";

function place(over: Partial<Place> = {}): Place {
  return {
    geonameId: 0,
    name: "",
    zone: "",
    currency: "",
    lat: 0,
    lon: 0,
    population: 0,
    country: "",
    admin1: "",
    postal: "",
    ...over,
  };
}

function hit(
  over: Partial<Omit<GeoHit, "place">> & { place?: Partial<Place> } = {},
): GeoHit {
  return {
    place: place(over.place),
    kind: "city",
    score: 0,
    matched: over.matched ?? "",
    source: over.source ?? "a",
  };
}

const KYIV = { lat: 50.4501, lon: 30.5234 };
const WARSAW = { lat: 52.2297, lon: 21.0122 };

test("the weights sum to one, so a score is a 0..1", () => {
  const total = WEIGHTS.name + WEIGHTS.population + WEIGHTS.proximity + WEIGHTS.source;
  expect(total).toBeCloseTo(1, 10);
});

test("similarity falls from exact, through prefix, to shared words", () => {
  expect(similarity("kyiv", "Kyiv")).toBe(1);
  expect(similarity("ky", "Kyiv")).toBeGreaterThan(similarity("ky", "Kyzyl-Kiya"));
  expect(similarity("paris", "Paris Mountain State Park")).toBeGreaterThan(0);
  expect(similarity("kyiv", "Warsaw")).toBe(0);
});

test("similarity folds the way the matcher does, and leaves diacritics alone", () => {
  expect(similarity("  MÜNCHEN  ", "münchen")).toBe(1);
  // Not 1: stripping diacritics would make "malmo" find Malmö and also make two
  // genuinely different names collide. `normalizeName`'s ruling, kept here.
  expect(similarity("munchen", "München")).toBeLessThan(1);
});

test("a whole-name match beats the same word inside a longer name", () => {
  expect(similarity("paris", "Paris")).toBeGreaterThan(
    similarity("paris", "Paris Mountain State Park"),
  );
});

test("haversine is the great circle, not the straight line", () => {
  // Kyiv to Warsaw is ~690 km.
  expect(haversine(KYIV, WARSAW)).toBeGreaterThan(650);
  expect(haversine(KYIV, WARSAW)).toBeLessThan(730);
  expect(haversine(KYIV, KYIV)).toBe(0);
});

test("a bbox that crosses the antimeridian still contains Fiji", () => {
  const pacific = [170, -20, -170, 20] as const;
  expect(inBbox(pacific, { lat: 0, lon: 179 })).toBe(true);
  expect(inBbox(pacific, { lat: 0, lon: -179 })).toBe(true);
  expect(inBbox(pacific, { lat: 0, lon: 0 })).toBe(false);
});

test("a bbox filters and never admits a point outside it", () => {
  const q: GeoQuery = { text: "x", bbox: [0, 0, 10, 10] };
  const out = rank(
    [
      hit({ matched: "x", place: { geonameId: 1, lat: 5, lon: 5 } }),
      hit({ matched: "x", place: { geonameId: 2, lat: 50, lon: 50 } }),
    ],
    q,
    ["a"],
    10,
  );
  expect(out.map((h) => h.place.geonameId)).toEqual([1]);
});

test("kinds and countries are guaranteed here, not left to the providers", () => {
  const hits = [
    hit({ matched: "Dnipro", place: { geonameId: 1, country: "ua" } }),
    {
      ...hit({ matched: "Dnipro", place: { geonameId: 2, country: "ua" } }),
      kind: "water" as const,
    },
    hit({ matched: "Dnipro", place: { geonameId: 3, country: "pl" } }),
  ];
  // A `custom()` provider that ignores a filter would otherwise leak rows the
  // caller refused, and the caller has no way to see which source checked what.
  expect(
    rank(hits, { text: "dnipro", kinds: ["water"] }, ["a"], 10).map(
      (h) => h.place.geonameId,
    ),
  ).toEqual([2]);
  expect(
    rank(hits, { text: "dnipro", countries: ["PL"] }, ["a"], 10).map(
      (h) => h.place.geonameId,
    ),
  ).toEqual([3]);
});

test("an empty filter list means no filter, never admit nothing", () => {
  const hits = [hit({ matched: "x", place: { geonameId: 1, country: "ua" } })];
  expect(rank(hits, { text: "x", kinds: [], countries: [] }, ["a"], 10)).toHaveLength(1);
});

test("near biases and never removes — the asymmetry §4.1 rules", () => {
  const hits = [
    hit({ matched: "x", place: { geonameId: 1, ...KYIV } }),
    hit({ matched: "x", place: { geonameId: 2, ...WARSAW } }),
  ];
  const without = rank(hits, { text: "x" }, ["a"], 10);
  const withNear = rank(hits, { text: "x", near: WARSAW }, ["a"], 10);

  expect(withNear).toHaveLength(without.length);
  // It reorders, which is the whole of what a bias may do.
  expect(withNear[0]?.place.geonameId).toBe(2);
});

test("population breaks a name tie, log-compressed so a capital is not a hamlet", () => {
  const out = rank(
    [
      hit({ matched: "Springfield", place: { geonameId: 1, population: 1_600 } }),
      hit({ matched: "Springfield", place: { geonameId: 2, population: 117_000 } }),
    ],
    { text: "springfield" },
    ["a"],
    10,
  );
  expect(out[0]?.place.geonameId).toBe(2);
});

test("the declared provider order is a weighting, not just documentation", () => {
  const out = rank(
    [
      hit({ matched: "x", source: "b", place: { geonameId: 2 } }),
      hit({ matched: "x", source: "a", place: { geonameId: 1 } }),
    ],
    { text: "x" },
    ["a", "b"],
    10,
  );
  expect(out[0]?.source).toBe("a");
});

test("identity is the geonameId when there is one and coordinates when there is not", () => {
  expect(identity(hit({ place: { geonameId: 42 } }))).toBe("id:42");
  expect(
    identity(hit({ place: { name: "Minerva", country: "us", postal: "44657" } })),
  ).toContain("minerva");
});

test("dedupe keeps the best copy and is idempotent", () => {
  const rows = [
    { ...hit({ place: { geonameId: 7 } }), score: 0.4 },
    { ...hit({ place: { geonameId: 7 } }), score: 0.9 },
    { ...hit({ place: { geonameId: 8 } }), score: 0.5 },
  ];
  const once = dedupe(rows);
  expect(once).toHaveLength(2);
  expect(once.find((h) => h.place.geonameId === 7)?.score).toBe(0.9);
  // Asserted rather than assumed: a merge runs this over the output of a merge.
  expect(dedupe(once)).toEqual(once);
});

test("two postal rows for one town stay two rows", () => {
  const rows = [
    hit({ place: { name: "London", country: "gb", postal: "EC1A" } }),
    hit({ place: { name: "London", country: "gb", postal: "SW1A" } }),
  ];
  expect(dedupe(rows)).toHaveLength(2);
});

test("the order is total and deterministic across runs", () => {
  const rows = [
    hit({ matched: "x", place: { geonameId: 0, name: "a", postal: "2" } }),
    hit({ matched: "x", place: { geonameId: 0, name: "a", postal: "1" } }),
    hit({ matched: "x", place: { geonameId: 3 } }),
  ];
  const q: GeoQuery = { text: "x" };
  const first = rank(rows, q, ["a"], 10).map((h) => h.place.postal);
  const again = rank([...rows].reverse(), q, ["a"], 10).map((h) => h.place.postal);
  expect(again).toEqual(first);
});

test("limit slices after ranking, so it keeps the best and not the first", () => {
  const out = rank(
    [
      hit({ matched: "zzz", place: { geonameId: 1 } }),
      hit({ matched: "kyiv", place: { geonameId: 2 } }),
    ],
    { text: "kyiv" },
    ["a"],
    1,
  );
  expect(out).toHaveLength(1);
  expect(out[0]?.place.geonameId).toBe(2);
});
