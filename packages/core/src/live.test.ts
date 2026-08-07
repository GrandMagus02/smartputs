import { expect, test } from "bun:test";
import { number } from "@smartput/kinds";
import { createEngine } from "./engine";
import { createCachedEngine, createSnapshotCache } from "./live";
import { composeLocale } from "./locale/compose";
import en from "./locale/en";

/** A loader that stamps each snapshot with its call number, so a stale read shows. */
function counting(): { load: () => Promise<{ n: number }>; calls: number } {
  const c = {
    calls: 0,
    async load() {
      c.calls += 1;
      return { n: c.calls };
    },
  };
  return c;
}

test("the first get loads, and a second inside the TTL does not", async () => {
  const c = counting();
  let clock = 0;
  const cache = createSnapshotCache({ load: c.load, ttlMs: 1000, now: () => clock });
  expect((await cache.get()).n).toBe(1);
  clock = 999;
  expect((await cache.get()).n).toBe(1);
  expect(c.calls).toBe(1);
});

test("a get at exactly the TTL boundary reloads", async () => {
  // `now() - fetchedAt >= ttlMs`, so 1000ms against a 1000ms TTL is stale. The
  // same seam rates/live.test.ts pins, asserted here now that the arithmetic
  // lives here.
  const c = counting();
  let clock = 0;
  const cache = createSnapshotCache({ load: c.load, ttlMs: 1000, now: () => clock });
  await cache.get();
  clock = 1000;
  expect((await cache.get()).n).toBe(2);
});

test("the clock starts at the end of the load, not the start", async () => {
  // A slow load must not be born stale: a 900ms fetch under a 1000ms TTL leaves
  // a full second of freshness, not 100ms.
  let clock = 0;
  let calls = 0;
  const cache = createSnapshotCache({
    load: async () => {
      clock += 900;
      calls += 1;
      return { n: calls };
    },
    ttlMs: 1000,
    now: () => clock,
  });
  await cache.get();
  clock = 1800; // 900ms after the load settled, not 1800.
  await cache.get();
  expect(calls).toBe(1);
  clock = 1900;
  await cache.get();
  expect(calls).toBe(2);
});

test("the default TTL never expires", async () => {
  const c = counting();
  let clock = 0;
  const cache = createSnapshotCache({ load: c.load, now: () => clock });
  await cache.get();
  clock = Number.MAX_SAFE_INTEGER;
  await cache.get();
  expect(c.calls).toBe(1);
});

test("concurrent first gets share one load", async () => {
  const c = counting();
  const cache = createSnapshotCache({ load: c.load });
  const [a, b] = await Promise.all([cache.get(), cache.get()]);
  expect(c.calls).toBe(1);
  expect(a).toBe(b);
});

test("refresh loads regardless of the TTL", async () => {
  const c = counting();
  const cache = createSnapshotCache({ load: c.load, ttlMs: 1000, now: () => 0 });
  await cache.get();
  expect((await cache.refresh()).n).toBe(2);
  expect(c.calls).toBe(2);
});

test("current is undefined until a load succeeds", async () => {
  const c = counting();
  const cache = createSnapshotCache({ load: c.load });
  expect(cache.current).toBeUndefined();
  await cache.get();
  expect(cache.current).toEqual({ n: 1 });
});

test("a rejected load reaches every waiting caller and does not poison the cache", async () => {
  let calls = 0;
  const cache = createSnapshotCache({
    async load() {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return { n: calls };
    },
  });
  const settled = await Promise.allSettled([cache.get(), cache.get()]);
  expect(settled.every((r) => r.status === "rejected")).toBe(true);
  // Both waited on the single failed load — that is the burst-of-keystrokes case.
  expect(calls).toBe(1);
  // And the in-flight promise was cleared, so the retry is a new load rather
  // than another await on the settled rejection.
  expect((await cache.get()).n).toBe(2);
});

test("a loader that resolves undefined still counts as loaded", async () => {
  // Freshness is the TTL's answer, never the value's. Keying "has it loaded?"
  // off `current !== undefined` would make such a loader refetch on every
  // single call, which is the failure this cache exists to prevent.
  let calls = 0;
  const cache = createSnapshotCache<undefined>({
    load: async () => {
      calls += 1;
      return undefined;
    },
    ttlMs: 1000,
    now: () => 0,
  });
  await cache.get();
  await cache.get();
  expect(calls).toBe(1);
});

/** The snapshot the engine below is built from: a precision the output shows. */
function engineOpts(digits: number) {
  return { locales: [composeLocale(en)], kinds: [number], formatPrecision: digits };
}

test("evaluate and suggest run against the built engine", async () => {
  const live = createCachedEngine({
    load: async () => 4,
    build: (digits: number) => createEngine(engineOpts(digits)),
  });
  expect((await live.evaluate("2 + 2")).formatted).toBe("4");
  expect(Array.isArray(await live.suggest("2 + 2"))).toBe(true);
});

test("the engine is built once per load, not once per evaluate", async () => {
  let builds = 0;
  const c = counting();
  const live = createCachedEngine({
    load: c.load,
    build: () => {
      builds += 1;
      return createEngine(engineOpts(4));
    },
  });
  await live.evaluate("2 + 2");
  await live.evaluate("2 + 2");
  await live.suggest("2 + 2");
  expect(builds).toBe(1);
  expect(c.calls).toBe(1);
});

test("engine and snapshot are undefined before the first load", async () => {
  const live = createCachedEngine({
    load: async () => 4,
    build: (digits: number) => createEngine(engineOpts(digits)),
  });
  expect(live.engine).toBeUndefined();
  expect(live.snapshot).toBeUndefined();
  await live.refresh();
  expect(live.snapshot).toBe(4);
  expect(live.engine?.evaluate("2 + 2").formatted).toBe("4");
});

test("a refresh rebuilds the engine from the new snapshot", async () => {
  const c = counting();
  const live = createCachedEngine({
    load: async () => (await c.load()).n,
    // Precision 1 truncates to one significant digit, so which snapshot built
    // the engine is legible in the output rather than in a counter.
    build: (digits: number) => createEngine(engineOpts(digits)),
  });
  expect((await live.evaluate("1234")).formatted).toBe("1,000");
  await live.refresh();
  expect((await live.evaluate("1234")).formatted).toBe("1,200");
});

test("a failed reload rejects rather than serving the stale engine", async () => {
  // Deliberate: a caller that asked past the TTL asked for current data, and
  // silently answering with expired rates is the one failure a rates consumer
  // cannot detect. `engine` stays readable for a consumer that wants the
  // stale-is-better-than-nothing path.
  let calls = 0;
  let clock = 0;
  const live = createCachedEngine({
    load: async () => {
      calls += 1;
      if (calls === 2) throw new Error("network down");
      return 4;
    },
    build: (digits: number) => createEngine(engineOpts(digits)),
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("2 + 2");
  clock = 1001;
  await expect(live.evaluate("2 + 2")).rejects.toThrow("network down");
  expect(live.engine?.evaluate("2 + 2").formatted).toBe("4");
});
