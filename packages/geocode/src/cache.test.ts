import { expect, test } from "bun:test";
import { QueryCache } from "./cache";

test("a hit inside the TTL does not reload", async () => {
  const cache = new QueryCache<number>({ ttlMs: 1000, now: () => 0 });
  let calls = 0;
  const load = async () => ++calls;
  expect(await cache.get("k", load)).toBe(1);
  expect(await cache.get("k", load)).toBe(1);
  expect(calls).toBe(1);
});

test("a stale entry reloads", async () => {
  let clock = 0;
  const cache = new QueryCache<number>({ ttlMs: 1000, now: () => clock });
  let calls = 0;
  const load = async () => ++calls;
  await cache.get("k", load);
  clock = 1000;
  expect(await cache.get("k", load)).toBe(2);
});

test("a burst on a cold key makes one load", async () => {
  const cache = new QueryCache<number>({ now: () => 0 });
  let calls = 0;
  const load = async () => {
    calls += 1;
    await Promise.resolve();
    return calls;
  };
  const all = await Promise.all([
    cache.get("k", load),
    cache.get("k", load),
    cache.get("k", load),
  ]);
  expect(calls).toBe(1);
  expect(all).toEqual([1, 1, 1]);
});

test("a rejection reaches every waiter and leaves nothing cached", async () => {
  const cache = new QueryCache<number>({ now: () => 0 });
  let calls = 0;
  const load = async () => {
    calls += 1;
    throw new Error(`boom ${calls}`);
  };
  const a = cache.get("k", load);
  const b = cache.get("k", load);
  await expect(a).rejects.toThrow("boom 1");
  await expect(b).rejects.toThrow("boom 1");
  expect(calls).toBe(1);
  expect(cache.peek("k")).toBeUndefined();
  await expect(cache.get("k", load)).rejects.toThrow("boom 2");
});

test("the least recently used entry is evicted at capacity", async () => {
  const cache = new QueryCache<string>({ max: 2, now: () => 0 });
  await cache.get("a", async () => "a");
  await cache.get("b", async () => "b");
  await cache.get("a", async () => "reloaded");
  await cache.get("c", async () => "c");
  expect(cache.peek("b")).toBeUndefined();
  expect(cache.peek("a")).toBe("a");
  expect(cache.peek("c")).toBe("c");
  expect(cache.size).toBe(2);
});

test("peek does not count as a use", async () => {
  const cache = new QueryCache<string>({ max: 2, now: () => 0 });
  await cache.get("a", async () => "a");
  await cache.get("b", async () => "b");
  cache.peek("a");
  await cache.get("c", async () => "c");
  expect(cache.peek("a")).toBeUndefined();
});

test("clear empties it", async () => {
  const cache = new QueryCache<string>({ now: () => 0 });
  await cache.get("a", async () => "a");
  cache.clear();
  expect(cache.size).toBe(0);
});
