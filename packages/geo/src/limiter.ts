/**
 * A token bucket, one per provider (geocode spec §5.3, mechanism four).
 *
 * Some providers' budgets are the consumer's to spend — a GeoNames account's
 * credits are bought or granted to them, and geo spec §8 rules that a provider
 * has no business second-guessing how often it is called. Others are not: the
 * OSMF Nominatim policy caps the public instance at one request per second on a
 * donated server, and that is a licence condition rather than a tuning knob.
 *
 * So the limiter exists, defaults to unlimited, and is constructed non-optionally
 * by the adapters whose upstream demands it. A README paragraph was the
 * alternative and it is what every other geocoding wrapper ships, which is why
 * every other geocoding wrapper's users get banned.
 */

export interface RateLimiterOptions {
  /** Requests per second. `Infinity` — the default — never waits. */
  readonly perSecond?: number;
  /** How many may go at once after an idle period. Default 1. */
  readonly burst?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  readonly now?: () => number;
  /** Injectable delay, for tests that must not actually wait. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export class RateLimiter {
  readonly perSecond: number;
  readonly burst: number;

  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  #tokens: number;
  #last: number;
  /**
   * The tail of the queue. Each `take` chains onto the previous one, so N
   * concurrent callers are served in call order rather than racing — a bucket
   * that admits one request per second but lets the tenth caller in before the
   * second is a bucket that reorders a launcher's keystrokes.
   */
  #tail: Promise<void> = Promise.resolve();

  constructor(opts: RateLimiterOptions = {}) {
    this.perSecond = opts.perSecond ?? Number.POSITIVE_INFINITY;
    this.burst = opts.burst ?? 1;
    this.#now = opts.now ?? Date.now;
    this.#sleep =
      opts.sleep ??
      ((ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }));
    this.#tokens = this.burst;
    this.#last = this.#now();
  }

  /** Refill from the clock. Tokens accrue continuously, not in ticks. */
  #refill(): void {
    const at = this.#now();
    const elapsed = Math.max(0, at - this.#last);
    this.#last = at;
    this.#tokens = Math.min(this.burst, this.#tokens + (elapsed * this.perSecond) / 1000);
  }

  /** Resolves when the caller may make its request. */
  async take(): Promise<void> {
    if (this.perSecond === Number.POSITIVE_INFINITY) return;
    const wait = this.#tail.then(async () => {
      this.#refill();
      if (this.#tokens < 1) {
        await this.#sleep(Math.ceil(((1 - this.#tokens) * 1000) / this.perSecond));
        this.#refill();
      }
      this.#tokens -= 1;
    });
    // The tail swallows rejections so one caller's failure cannot wedge the
    // queue; the rejection still reaches the caller through `wait`.
    this.#tail = wait.catch(() => {});
    return wait;
  }
}
