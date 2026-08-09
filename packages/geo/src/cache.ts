/**
 * The keystroke path's first two mechanisms (geocode spec §5.3): a per-query LRU
 * and in-flight deduplication.
 *
 * A launcher calls `search` on every keystroke, so "berlin" is eight queries of
 * which seven are prefixes nobody wanted an answer to, and the eighth is often
 * asked twice because the UI re-rendered. Neither belongs on the network.
 *
 * The rule about rejections is verbatim core's `createSnapshotCache`: the slot
 * is cleared in a `finally`, so a failure reaches every waiter and the next call
 * retries instead of awaiting a settled rejection forever. It is written again
 * here rather than reused because that cache holds *one* value and this holds
 * many — the generic over a key is a different object, not a configuration of
 * the same one.
 */

export interface QueryCacheOptions {
  /** Entries kept before the least recently used is evicted. Default 200. */
  readonly max?: number;
  /** How long an entry stays fresh. Default: never expires. */
  readonly ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  readonly now?: () => number;
}

interface Entry<V> {
  readonly value: V;
  readonly at: number;
}

export class QueryCache<V> {
  readonly max: number;
  readonly ttlMs: number;

  readonly #now: () => number;
  /**
   * Insertion order *is* the recency order: a `Map` iterates in insertion order,
   * and a hit deletes and re-sets its key, which moves it to the end. That is
   * the whole LRU — no linked list, no counters, and eviction is `keys().next()`.
   */
  readonly #entries = new Map<string, Entry<V>>();
  readonly #inFlight = new Map<string, Promise<V>>();

  constructor(opts: QueryCacheOptions = {}) {
    this.max = opts.max ?? 200;
    this.ttlMs = opts.ttlMs ?? Number.POSITIVE_INFINITY;
    this.#now = opts.now ?? Date.now;
  }

  /** The cached value if it is present and fresh, else undefined. */
  peek(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (this.#now() - entry.at >= this.ttlMs) {
      this.#entries.delete(key);
      return undefined;
    }
    // Re-set, so a hit counts as a use and the key moves to the young end.
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  /**
   * A cached value, a joined in-flight load, or a new one — in that order.
   *
   * The three-way choice is the point: a burst of ten identical keystrokes on a
   * cold key makes exactly one request, and the tenth caller gets the first
   * caller's promise rather than a tenth of its own.
   */
  async get(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.peek(key);
    if (hit !== undefined) return hit;

    const pending = this.#inFlight.get(key);
    if (pending !== undefined) return pending;

    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });
    this.#inFlight.set(key, promise);
    return promise;
  }

  set(key: string, value: V): void {
    this.#entries.delete(key);
    this.#entries.set(key, { value, at: this.#now() });
    while (this.#entries.size > this.max) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) break;
      this.#entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.#entries.clear();
    // In-flight loads are deliberately left alone. Their callers are still
    // awaiting them, and dropping the slot here would let a second caller start
    // a duplicate request for an answer that is already on its way.
  }

  get size(): number {
    return this.#entries.size;
  }
}
