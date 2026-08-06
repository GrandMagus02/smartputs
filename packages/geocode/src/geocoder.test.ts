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

test("merge calls every provider and ranks the union", async () => {
  const a = stub("a", [hit("a", { place: place({ geonameId: 1 }) })]);
  const b = stub("b", [
    hit("b", { place: place({ geonameId: 2, name: "Berlin Heights" }) }),
  ]);
  const geo = new Geocoder({ providers: [a, b], strategy: "merge", now: () => 0 });
  const hits = await geo.search("berlin");
  expect(a.calls).toBe(1);
  expect(b.calls).toBe(1);
  expect(hits).toHaveLength(2);
});

test("merge deduplicates the same place found twice", async () => {
  const a = stub("a", [hit("a")]);
  const b = stub("b", [hit("b")]);
  const geo = new Geocoder({ providers: [a, b], strategy: "merge", now: () => 0 });
  expect(await geo.search("berlin")).toHaveLength(1);
});

test("merge prefers the earlier provider, all else equal", async () => {
  const a = stub("a", [hit("a", { place: place({ geonameId: 1 }) })]);
  const b = stub("b", [hit("b", { place: place({ geonameId: 2 }) })]);
  const geo = new Geocoder({ providers: [a, b], strategy: "merge", now: () => 0 });
  expect((await geo.search("berlin"))[0]?.source).toBe("a");
});

test("merge survives one provider rejecting", async () => {
  const a = stub("a", [], {
    async search() {
      throw new Error("down");
    },
  });
  const b = stub("b", [hit("b")]);
  const geo = new Geocoder({ providers: [a, b], strategy: "merge", now: () => 0 });
  expect(await geo.search("berlin")).toHaveLength(1);
});

test("merge with every provider rejecting is one GeocodeError", async () => {
  const down = () =>
    stub("x", [], {
      async search() {
        throw new Error("down");
      },
    });
  const geo = new Geocoder({
    providers: [down(), down()],
    strategy: "merge",
    now: () => 0,
  });
  await expect(geo.search("berlin")).rejects.toBeInstanceOf(GeocodeError);
});

test("race takes the first non-empty answer", async () => {
  const slow = stub("slow", [], {
    async search() {
      await new Promise((r) => setTimeout(r, 20));
      return [hit("slow")];
    },
  });
  const fast = stub("fast", [hit("fast")]);
  const geo = new Geocoder({ providers: [slow, fast], strategy: "race", now: () => 0 });
  expect((await geo.search("berlin")).map((h) => h.source)).toEqual(["fast"]);
});

test("an already-aborted query rejects with the signal's own reason", async () => {
  const controller = new AbortController();
  const reason = new Error("gone");
  controller.abort(reason);
  const a = stub("a", [hit("a")]);
  const geo = new Geocoder({ providers: [a], now: () => 0 });
  await expect(geo.search({ text: "berlin", signal: controller.signal })).rejects.toBe(
    reason,
  );
  expect(a.calls).toBe(0);
});

test("a query aborted mid-flight rejects for the aborter, not for the shared load", async () => {
  const controller = new AbortController();
  // Counted here rather than through `stub`'s `calls`, which only the default
  // `search` increments — an `over.search` replaces it outright.
  let calls = 0;
  const a = stub("a", [], {
    async search() {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return [hit("a")];
    },
  });
  const geo = new Geocoder({ providers: [a], now: () => 0 });
  const pending = geo.search({ text: "berlin", signal: controller.signal });
  controller.abort(new Error("superseded"));
  await expect(pending).rejects.toThrow("superseded");
  // The half of §11 the abort rule leaves ambiguous, pinned here: the abort is
  // the *aborter's view* of a load it never reaches, so it contributes no cache
  // entry of its own — but it does not cancel a request the next keystroke may
  // still be waiting on, which is §5.3's in-flight dedup. Hence the second
  // caller joins the load already running rather than starting a fresh one.
  expect(await geo.search("berlin")).toHaveLength(1);
  expect(calls).toBe(1);
});

test("reverse asks the providers that can reverse", async () => {
  const flat = stub("flat", []);
  const rev = stub("rev", [], {
    async reverse() {
      return [hit("rev")];
    },
  });
  const geo = new Geocoder({ providers: [flat, rev], now: () => 0 });
  expect((await geo.reverse(52.52, 13.4)).map((h) => h.source)).toEqual(["rev"]);
});

test("reverse with nothing that reverses throws rather than saying nowhere", async () => {
  const geo = new Geocoder({ providers: [stub("flat", [])], now: () => 0 });
  await expect(geo.reverse(52.52, 13.4)).rejects.toBeInstanceOf(GeocodeError);
});
