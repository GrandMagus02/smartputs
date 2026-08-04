import { expect, test } from "bun:test";
import { number, RatesNotReadyError } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { createLiveEngine } from "./live";
import { money } from "./money";
import type { RateProvider } from "./providers/ecb";
import { snapshot } from "./snapshot";

function countingProvider(): RateProvider & { calls: number } {
  const p = {
    id: "test",
    calls: 0,
    async fetch() {
      p.calls += 1;
      // The rate moves each call, so a stale read is visible in the output.
      return snapshot("EUR", `2026-08-0${p.calls}`, { USD: 1 + p.calls / 10 });
    },
  };
  return p;
}

test("the first evaluate fetches, and the result is dated", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  const r = await live.evaluate("11 usd");
  expect(provider.calls).toBe(1);
  expect(r.meta.ratesAsOf).toBe("2026-08-01");
});

test("a second call inside the TTL reuses the snapshot", async () => {
  const provider = countingProvider();
  let clock = 0;
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("11 usd");
  clock = 999;
  await live.evaluate("11 usd");
  expect(provider.calls).toBe(1);
});

test("a call at exactly the TTL boundary refetches", async () => {
  // The implementation refetches at `now() - fetchedAt >= ttlMs`, so 1000ms
  // against a 1000ms TTL must be treated as stale, not fresh. This pins the
  // seam a `>=` -> `>` regression would slip through, between the 999ms
  // (fresh) and 1001ms (stale) cases already covered above.
  const provider = countingProvider();
  let clock = 0;
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("11 usd");
  clock = 1000;
  const r = await live.evaluate("11 usd");
  expect(provider.calls).toBe(2);
  expect(r.meta.ratesAsOf).toBe("2026-08-02");
});

test("a call past the TTL refetches", async () => {
  const provider = countingProvider();
  let clock = 0;
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("11 usd");
  clock = 1001;
  const r = await live.evaluate("11 usd");
  expect(provider.calls).toBe(2);
  expect(r.meta.ratesAsOf).toBe("2026-08-02");
});

test("concurrent first calls share one fetch", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  await Promise.all([live.evaluate("11 usd"), live.evaluate("11 usd")]);
  expect(provider.calls).toBe(1);
});

test("sync throws before the first refresh and works after", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  // A SmartputError, not a bare one: `instanceof SmartputError` is the
  // discriminator core itself branches on.
  expect(() => live.sync).toThrow(RatesNotReadyError);
  await live.refresh();
  expect(live.sync.evaluate("11 usd").meta.ratesAsOf).toBe("2026-08-01");
  expect(live.ratesAsOf).toBe("2026-08-01");
});

test("suggest is available asynchronously too", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  expect(Array.isArray(await live.suggest("11 usd"))).toBe(true);
});

test("a rejected fetch propagates to the caller, and a later call can succeed", async () => {
  let calls = 0;
  const provider: RateProvider = {
    id: "flaky",
    async fetch() {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return snapshot("EUR", "2026-08-01", { USD: 1.1 });
    },
  };
  const live = createLiveEngine({ locales: [en], kinds: [number, money], provider });
  await expect(live.evaluate("11 usd")).rejects.toThrow("network down");
  const r = await live.evaluate("11 usd");
  expect(r.meta.ratesAsOf).toBe("2026-08-01");
  expect(calls).toBe(2);
});

test("a rejected fetch does not leave a poisoned in-flight promise for concurrent callers", async () => {
  let calls = 0;
  const provider: RateProvider = {
    id: "flaky",
    async fetch() {
      calls += 1;
      throw new Error("boom");
    },
  };
  const live = createLiveEngine({ locales: [en], kinds: [number, money], provider });
  const results = await Promise.allSettled([
    live.evaluate("11 usd"),
    live.evaluate("11 usd"),
  ]);
  expect(results.every((r) => r.status === "rejected")).toBe(true);
  // Both concurrent calls shared the single failed fetch.
  expect(calls).toBe(1);
});
