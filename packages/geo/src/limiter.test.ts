import { expect, test } from "bun:test";
import { RateLimiter } from "./limiter";

/**
 * A clock and a sleep that move together, so a one-per-second bucket is asserted
 * in microseconds. A real `setTimeout` here would make the suite take as long as
 * the policy it is testing.
 */
function fakeTime(start = 0) {
  let at = start;
  return {
    now: () => at,
    sleep: async (ms: number) => {
      at += ms;
    },
    get elapsed() {
      return at - start;
    },
  };
}

test("the default admits everything without waiting", async () => {
  const t = fakeTime();
  const limiter = new RateLimiter({ now: t.now, sleep: t.sleep });
  for (let i = 0; i < 100; i += 1) await limiter.take();
  expect(t.elapsed).toBe(0);
});

test("one per second admits exactly one per second", async () => {
  const t = fakeTime();
  const limiter = new RateLimiter({ perSecond: 1, now: t.now, sleep: t.sleep });

  await limiter.take();
  expect(t.elapsed).toBe(0);
  await limiter.take();
  expect(t.elapsed).toBe(1000);
  await limiter.take();
  expect(t.elapsed).toBe(2000);
});

test("a burst allowance is spent before the waiting starts", async () => {
  const t = fakeTime();
  const limiter = new RateLimiter({
    perSecond: 1,
    burst: 3,
    now: t.now,
    sleep: t.sleep,
  });

  await limiter.take();
  await limiter.take();
  await limiter.take();
  expect(t.elapsed).toBe(0);
  await limiter.take();
  expect(t.elapsed).toBe(1000);
});

test("concurrent callers are served in call order, not in whatever order they race", async () => {
  const t = fakeTime();
  const limiter = new RateLimiter({ perSecond: 1, now: t.now, sleep: t.sleep });
  const order: number[] = [];

  await Promise.all(
    [1, 2, 3].map(async (n) => {
      await limiter.take();
      order.push(n);
    }),
  );

  // A bucket that lets the third caller in before the second is a bucket that
  // reorders a launcher's keystrokes.
  expect(order).toEqual([1, 2, 3]);
  expect(t.elapsed).toBe(2000);
});

test("tokens accrue while nobody is asking", async () => {
  const t = fakeTime();
  const limiter = new RateLimiter({ perSecond: 2, now: t.now, sleep: t.sleep });

  await limiter.take();
  await t.sleep(1000);
  // A second of idling at two per second refills the single-token bucket.
  await limiter.take();
  expect(t.elapsed).toBe(1000);
});
