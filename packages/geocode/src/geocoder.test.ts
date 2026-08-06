import { expect, test } from "bun:test";
import { Geocoder } from "./geocoder";
import type { Place } from "./place";
import { GeocodeError, type GeocodeHit, type GeocodeProvider } from "./query";

function place(over: Partial<Place> = {}): Place {
  return {
    geonameId: 1,
    name: "Berlin",
    zone: "Europe/Berlin",
    currency: "",
    lat: 52.52,
    lon: 13.4,
    population: 3_600_000,
    country: "de",
    admin1: "16",
    postal: "",
    ...over,
  };
}

interface Stub extends GeocodeProvider {
  calls: number;
}

function stub(
  id: string,
  hits: readonly GeocodeHit[],
  over: Partial<GeocodeProvider> = {},
): Stub {
  const p: Stub = {
    id,
    attribution: `© ${id}`,
    interactive: true,
    calls: 0,
    async search() {
      p.calls += 1;
      return hits;
    },
    ...over,
  };
  return p;
}

function hit(id: string, over: Partial<GeocodeHit> = {}): GeocodeHit {
  return {
    place: place(),
    kind: "city",
    score: 0,
    matched: "berlin",
    source: id,
    ...over,
  };
}

test("fallback stops at the first provider that answers", async () => {
  const a = stub("a", [hit("a")]);
  const b = stub("b", [hit("b")]);
  const geo = new Geocoder({ providers: [a, b], now: () => 0 });
  const hits = await geo.search("berlin");
  expect(hits.map((h) => h.source)).toEqual(["a"]);
  expect(b.calls).toBe(0);
});

test("fallback walks past a provider that answers empty", async () => {
  const a = stub("a", []);
  const b = stub("b", [hit("b")]);
  const geo = new Geocoder({ providers: [a, b], now: () => 0 });
  expect((await geo.search("berlin")).map((h) => h.source)).toEqual(["b"]);
});

test("a rejecting provider does not end the query", async () => {
  const a = stub("a", [], {
    async search() {
      throw new Error("down");
    },
  });
  const b = stub("b", [hit("b")]);
  const geo = new Geocoder({ providers: [a, b], now: () => 0 });
  expect((await geo.search("berlin")).map((h) => h.source)).toEqual(["b"]);
});

test("every provider rejecting is one GeocodeError carrying every cause", async () => {
  const a = stub("a", [], {
    async search() {
      throw new Error("a down");
    },
  });
  const b = stub("b", [], {
    async search() {
      throw new Error("b down");
    },
  });
  const geo = new Geocoder({ providers: [a, b], now: () => 0 });
  const err = await geo.search("berlin").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(GeocodeError);
  expect((err as GeocodeError).causes).toHaveLength(2);
});

test("no provider answering is an empty array, not an error", async () => {
  const geo = new Geocoder({ providers: [stub("a", [])], now: () => 0 });
  expect(await geo.search("atlantis")).toEqual([]);
});

test("a repeated query is served from cache", async () => {
  const a = stub("a", [hit("a")]);
  const geo = new Geocoder({ providers: [a], now: () => 0 });
  await geo.search("berlin");
  await geo.search("  BERLIN ");
  expect(a.calls).toBe(1);
});

test("a burst of keystrokes on one key makes one call", async () => {
  const a = stub("a", [hit("a")]);
  const geo = new Geocoder({ providers: [a], now: () => 0 });
  await Promise.all([geo.search("berlin"), geo.search("berlin"), geo.search("berlin")]);
  expect(a.calls).toBe(1);
});

test("a non-interactive provider is skipped until the query is committed", async () => {
  const live = stub("live", [hit("live")], { interactive: false });
  const geo = new Geocoder({ providers: [live], now: () => 0 });
  expect(await geo.search("berlin")).toEqual([]);
  expect(live.calls).toBe(0);
  expect(await geo.search({ text: "berlin", committed: true })).toHaveLength(1);
  expect(live.calls).toBe(1);
});

test("a keystroke reads the committed answer, never the other way round", async () => {
  const live = stub("live", [hit("live")], { interactive: false });
  const geo = new Geocoder({ providers: [live], now: () => 0 });
  expect(await geo.search({ text: "berlin", committed: true })).toHaveLength(1);
  expect(await geo.search("berlin")).toHaveLength(1);
  expect(live.calls).toBe(1);
});

test("the constructor limit applies, and a query overrides it", async () => {
  const hits = [1, 2, 3].map((n) => hit("a", { place: place({ geonameId: n }) }));
  const geo = new Geocoder({ providers: [stub("a", hits)], limit: 2, now: () => 0 });
  expect(await geo.search("berlin")).toHaveLength(2);
  expect(await geo.search({ text: "berlin", limit: 1 })).toHaveLength(1);
});

test("resolve returns the top place, or null", async () => {
  const geo = new Geocoder({ providers: [stub("a", [hit("a")])], now: () => 0 });
  expect((await geo.resolve("berlin"))?.name).toBe("Berlin");
  const empty = new Geocoder({ providers: [stub("b", [])], now: () => 0 });
  expect(await empty.resolve("berlin")).toBeNull();
});

test("sync reads whatever a provider already holds, and never throws", () => {
  const snapshot = {
    asOf: "2026-08-06",
    find: (n: string) => (n === "berlin" ? place() : null),
  };
  const geo = new Geocoder({ providers: [stub("a", [], { snapshot })], now: () => 0 });
  expect(geo.sync.find("berlin")?.name).toBe("Berlin");
  expect(geo.sync.find("atlantis")).toBeNull();
  expect(new Geocoder({ providers: [stub("b", [])] }).sync.find("berlin")).toBeNull();
});

test("attribution is every provider's, deduplicated and empty-free", () => {
  const geo = new Geocoder({
    providers: [
      stub("a", []),
      stub("a2", [], { attribution: "© a" }),
      stub("c", [], { attribution: "" }),
    ],
  });
  expect(geo.attribution).toEqual(["© a"]);
});
