import { expect, test } from "bun:test";
import { GeoError } from "./errors";
import { cacheKey, Geo } from "./geo";
import type { Place } from "./place";
import type { Coord, GeoHit, GeoProvider, GeoQuery } from "./types";

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

/** A provider whose every answer and failure the test decides. */
function stub(
  id: string,
  answer: (q: GeoQuery) => GeoHit[] | Promise<GeoHit[]>,
  over: Partial<GeoProvider> = {},
): GeoProvider & { calls: GeoQuery[] } {
  const calls: GeoQuery[] = [];
  return {
    id,
    attribution: `${id} attribution`,
    interactive: true,
    calls,
    async search(q: GeoQuery): Promise<GeoHit[]> {
      calls.push(q);
      return answer(q);
    },
    ...over,
  };
}

const one = (id: string, name: string, geonameId: number): GeoHit => ({
  place: place({ geonameId, name }),
  kind: "city",
  score: 0,
  matched: name,
  source: id,
});

test("a Geo with no providers is refused at construction", () => {
  expect(() => new Geo({ providers: [] })).toThrow(GeoError);
});

test("fallback stops at the first provider with an answer", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const b = stub("b", () => [one("b", "Kyiv", 2)]);
  const geo = new Geo({ providers: [a, b] });

  const hits = await geo.search("kyiv");
  expect(hits.map((h) => h.source)).toEqual(["a"]);
  expect(b.calls).toHaveLength(0);
});

test("fallback treats empty as a miss and moves on", async () => {
  const a = stub("a", () => []);
  const b = stub("b", () => [one("b", "Kyiv", 2)]);
  const geo = new Geo({ providers: [a, b] });

  expect((await geo.search("kyiv")).map((h) => h.source)).toEqual(["b"]);
});

test("a rejecting provider does not end the query", async () => {
  const a = stub("a", () => {
    throw new Error("down");
  });
  const b = stub("b", () => [one("b", "Kyiv", 2)]);
  const geo = new Geo({ providers: [a, b] });

  // One dead mirror must not take the query with it.
  expect((await geo.search("kyiv")).map((h) => h.source)).toEqual(["b"]);
});

test("all providers rejecting is one GeoError naming each failure", async () => {
  const boom = (id: string) =>
    stub(id, () => {
      throw new Error(`${id} is down`);
    });
  const geo = new Geo({ providers: [boom("a"), boom("b")] });

  const err = await geo.search("kyiv").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(GeoError);
  expect((err as GeoError).message).toContain("a is down");
  expect((err as GeoError).message).toContain("b is down");
  expect((err as GeoError).causes).toHaveLength(2);
});

test("merge asks everyone and ranks the union", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const b = stub("b", () => [one("b", "Kyiv City", 2)]);
  const geo = new Geo({ providers: [a, b], strategy: "merge" });

  const hits = await geo.search("kyiv");
  expect(hits).toHaveLength(2);
  expect(b.calls).toHaveLength(1);
  // The exact match outranks the longer name regardless of who answered.
  expect(hits[0]?.place.geonameId).toBe(1);
});

test("merge survives one failure and only throws when everyone fails", async () => {
  const a = stub("a", () => {
    throw new Error("down");
  });
  const b = stub("b", () => [one("b", "Kyiv", 2)]);
  const geo = new Geo({ providers: [a, b], strategy: "merge" });

  expect(await geo.search("kyiv")).toHaveLength(1);
});

test("merge dedupes the same place found twice", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 703448)]);
  const b = stub("b", () => [one("b", "Kyiv", 703448)]);
  const geo = new Geo({ providers: [a, b], strategy: "merge" });

  expect(await geo.search("kyiv")).toHaveLength(1);
});

test("race takes the first non-empty answer", async () => {
  const slow = stub("slow", async () => {
    await new Promise((r) => setTimeout(r, 20));
    return [one("slow", "Kyiv", 1)];
  });
  const fast = stub("fast", () => [one("fast", "Kyiv", 2)]);
  const geo = new Geo({ providers: [slow, fast], strategy: "race" });

  expect((await geo.search("kyiv")).map((h) => h.source)).toEqual(["fast"]);
});

test("a non-interactive provider runs only on a committed query", async () => {
  const typed = stub("typed", () => [one("typed", "Kyiv", 1)]);
  const enter = stub("enter", () => [one("enter", "Kyiv", 2)], { interactive: false });
  const geo = new Geo({ providers: [enter, typed], strategy: "merge" });

  await geo.search("kyiv");
  expect(enter.calls).toHaveLength(0);

  await geo.search({ text: "kyiv", committed: true });
  expect(enter.calls).toHaveLength(1);
});

test("a Geo of only non-interactive providers answers the typing with nothing", async () => {
  const enter = stub("enter", () => [one("enter", "Kyiv", 2)], { interactive: false });
  const geo = new Geo({ providers: [enter] });
  expect(await geo.search("kyiv")).toEqual([]);
});

test("an identical query is served from cache, not from the provider", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const geo = new Geo({ providers: [a] });

  await geo.search("kyiv");
  await geo.search("Kyiv  ");
  expect(a.calls).toHaveLength(1);
});

test("near is not part of the cache key, because it reorders and never filters", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const geo = new Geo({ providers: [a] });

  await geo.search({ text: "kyiv" });
  await geo.search({ text: "kyiv", near: { lat: 0, lon: 0 } });
  // One fetch, two rankings. Including `near` would make every step of a moving
  // user a cache miss.
  expect(a.calls).toHaveLength(1);
});

test("a filter is part of the cache key, because it changes which rows come back", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const geo = new Geo({ providers: [a] });

  await geo.search({ text: "kyiv" });
  await geo.search({ text: "kyiv", countries: ["ua"] });
  expect(a.calls).toHaveLength(2);
});

test("cacheKey is order-insensitive within a filter", () => {
  expect(cacheKey({ text: "x", countries: ["UA", "pl"] })).toBe(
    cacheKey({ text: "x", countries: ["pl", "ua"] }),
  );
  expect(cacheKey({ text: "x", kinds: ["city", "water"] })).toBe(
    cacheKey({ text: "x", kinds: ["water", "city"] }),
  );
});

test("sync answers from what has already been fetched, with no I/O", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 703448)]);
  const geo = new Geo({ providers: [a] });

  expect(geo.sync.find("kyiv")).toBeNull();
  await geo.search("kyiv");
  expect(geo.sync.find("kyiv")?.geonameId).toBe(703448);
  // Null rather than a throw: a lookup with no snapshot has simply not got that
  // place, which is a null the caller already handles.
  expect(geo.sync.find("warsaw")).toBeNull();
});

test("a sync hint that selects nothing answers null, not the unhinted winner", async () => {
  const a = stub("a", () => [
    {
      ...one("a", "Paris", 1),
      place: place({ geonameId: 1, name: "Paris", country: "fr" }),
    },
  ]);
  const geo = new Geo({ providers: [a] });
  await geo.search("paris");

  expect(geo.sync.find("paris", { country: "fr" })?.geonameId).toBe(1);
  expect(geo.sync.find("paris", { country: "us" })).toBeNull();
});

test("reverse rejects when nothing behind the Geo can do it", async () => {
  const geo = new Geo({ providers: [stub("a", () => [])] });
  // [] would read as "nowhere is there", which is never true of a coordinate.
  await expect(geo.reverse({ lat: 50, lon: 30 })).rejects.toThrow(GeoError);
});

test("reverse biases towards the queried point", async () => {
  const near = place({ geonameId: 1, name: "Kyiv", lat: 50.45, lon: 30.52 });
  const far = place({ geonameId: 2, name: "Warsaw", lat: 52.23, lon: 21.01 });
  const a: GeoProvider = {
    id: "a",
    attribution: "",
    interactive: true,
    async search(): Promise<GeoHit[]> {
      return [];
    },
    async reverse(_at: Coord): Promise<GeoHit[]> {
      return [
        { place: far, kind: "city", score: 0, matched: "Warsaw", source: "a" },
        { place: near, kind: "city", score: 0, matched: "Kyiv", source: "a" },
      ];
    },
  };
  const geo = new Geo({ providers: [a] });

  const hits = await geo.reverse({ lat: 50.45, lon: 30.52 });
  expect(hits[0]?.place.geonameId).toBe(1);
});

test("a transposed bbox is refused rather than silently filtering everything out", async () => {
  const geo = new Geo({ providers: [stub("a", () => [])] });
  await expect(geo.search({ text: "x", bbox: [0, 10, 10, 0] })).rejects.toThrow(GeoError);
});

test("an abort is rethrown unwrapped, because that is what callers catch", async () => {
  const a = stub("a", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  });
  const geo = new Geo({ providers: [a] });

  const err = await geo.search("kyiv").catch((e: unknown) => e);
  expect((err as Error).name).toBe("AbortError");
  expect(err).not.toBeInstanceOf(GeoError);
});

test("attribution is the union of what the providers require", async () => {
  const geo = new Geo({ providers: [stub("a", () => []), stub("b", () => [])] });
  expect(geo.attribution).toEqual(["a attribution", "b attribution"]);
});

test("an empty query is answered without asking anyone", async () => {
  const a = stub("a", () => [one("a", "Kyiv", 1)]);
  const geo = new Geo({ providers: [a] });
  expect(await geo.search("   ")).toEqual([]);
  expect(a.calls).toHaveLength(0);
});

test("resolve is the one-answer form of search", async () => {
  const a = stub("a", (q) => (q.text === "kyiv" ? [one("a", "Kyiv", 703448)] : []));
  const geo = new Geo({ providers: [a] });

  expect((await geo.resolve("kyiv"))?.geonameId).toBe(703448);
  expect(await geo.resolve("nowhere at all")).toBeNull();
});
