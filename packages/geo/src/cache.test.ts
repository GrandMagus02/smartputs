import { expect, test } from "bun:test";
import { QueryCache } from "./cache";

/** A clock the test moves by hand: no timers, no flake. */
function clock(start = 0) {
  let at = start;
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms;
    },
  };
}

test("a burst on a cold key makes one load, not one per caller", async () => {
  let loads = 0;
  const cache = new QueryCache<number>();
  const load = async () => {
    loads += 1;
    await Promise.resolve();
    return 1;
  };

  const all = await Promise.all(Array.from({ length: 10 }, () => cache.get("k", load)));

  expect(loads).toBe(1);
  expect(all).toEqual(Array(10).fill(1));
});

test("a rejection clears the slot so the next call retries", async () => {
  let calls = 0;
  const cache = new QueryCache<number>();
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("boom");
    return 2;
  };

  await expect(cache.get("k", load)).rejects.toThrow("boom");
  // The whole point of the `finally`: without it every later caller awaits a
  // settled rejection forever.
  expect(await cache.get("k", load)).toBe(2);
  expect(calls).toBe(2);
});

test("a rejection reaches every caller already waiting on it", async () => {
  const cache = new QueryCache<number>();
  const load = async () => {
    await Promise.resolve();
    throw new Error("boom");
  };
  // Caught at the moment each promise is created, not after both exist: an
  // `await expect(a).rejects` on the first would leave the second momentarily
  // unhandled, which is a fact about this test and not about the cache.
  const a = cache.get("k", load).catch((e: unknown) => e);
  const b = cache.get("k", load).catch((e: unknown) => e);

  expect(((await a) as Error).message).toBe("boom");
  expect(((await b) as Error).message).toBe("boom");
});

test("a value past the TTL is reloaded", async () => {
  const c = clock();
  let loads = 0;
  const cache = new QueryCache<number>({ ttlMs: 1000, now: c.now });
  const load = async () => ++loads;

  expect(await cache.get("k", load)).toBe(1);
  c.advance(999);
  expect(await cache.get("k", load)).toBe(1);
  c.advance(1);
  expect(await cache.get("k", load)).toBe(2);
});

test("the least recently used key is the one evicted", async () => {
  const cache = new QueryCache<string>({ max: 2 });
  await cache.get("a", async () => "a");
  await cache.get("b", async () => "b");
  // Touching "a" makes "b" the oldest, which is what makes this an LRU rather
  // than a first-in-first-out queue.
  cache.peek("a");
  await cache.get("c", async () => "c");

  expect(cache.peek("a")).toBe("a");
  expect(cache.peek("b")).toBeUndefined();
  expect(cache.peek("c")).toBe("c");
  expect(cache.size).toBe(2);
});

test("peek does no I/O and reports a miss as undefined", () => {
  const cache = new QueryCache<number>();
  expect(cache.peek("nothing")).toBeUndefined();
});

test("clear forgets values but leaves an in-flight load to its callers", async () => {
  const cache = new QueryCache<number>();
  let resolve: (v: number) => void = () => {};
  const pending = cache.get("k", () => new Promise<number>((r) => (resolve = r)));

  cache.clear();
  resolve(5);
  // Dropping the slot here would let a second caller start a duplicate request
  // for an answer already on its way.
  expect(await pending).toBe(5);
});
