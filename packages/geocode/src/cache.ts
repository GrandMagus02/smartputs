export interface QueryCacheOptions {
  /** Entries kept before the least recently used is dropped. Default 200. */
  readonly max?: number;
  /** How long an entry stays fresh. Default: forever. */
  readonly ttlMs?: number;
  /** Injectable clock, epoch milliseconds. Default `Date.now`. */
  readonly now?: () => number;
}

interface Entry<T> {
  readonly value: T;
  readonly at: number;
}

/**
 * A per-query LRU with a TTL and one in-flight load shared by concurrent
 * callers (spec §5.3).
 *
 * Not `createSnapshotCache` from core, and the difference is the key: core's
 * cache is one slot for one snapshot, which is what a whole-index provider
 * wants, and this is many slots for many queries, which is what a keystroke
 * path wants. The three behaviours they share — TTL, shared in-flight promise,
 * a `finally` that clears the slot on rejection so the next call retries rather
 * than awaiting a settled rejection forever — are deliberately spelled the same
 * way here, because they are the same three behaviours and drift between them
 * would be a bug in whichever one is read second.
 *
 * Recency is `Map` insertion order: a hit deletes and re-sets, so the first key
 * `keys()` yields is always the least recently used. `peek` deliberately does
 * not, so a caller inspecting the cache cannot change what it evicts.
 */
export class QueryCache<T> {
  readonly #entries = new Map<string, Entry<T>>();
  readonly #inFlight = new Map<string, Promise<T>>();
  readonly #max: number;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(opts: QueryCacheOptions = {}) {
    this.#max = opts.max ?? 200;
    this.#ttlMs = opts.ttlMs ?? Number.POSITIVE_INFINITY;
    this.#now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.#entries.size;
  }

  /** The cached value, without touching recency and without loading. */
  peek(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (this.#now() - entry.at >= this.#ttlMs) return undefined;
    return entry.value;
  }

  get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = this.#entries.get(key);
    if (entry !== undefined && this.#now() - entry.at < this.#ttlMs) {
      this.#touch(key, entry);
      return Promise.resolve(entry.value);
    }

    const pending = this.#inFlight.get(key);
    if (pending !== undefined) return pending;

    const promise = load()
      .then((value) => {
        // Stamped after the await, so a slow load is not born stale.
        this.#set(key, { value, at: this.#now() });
        return value;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });
    this.#inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.#entries.clear();
    // In-flight loads are deliberately left alone: their callers are still
    // awaiting them, and dropping the slot would only make the next call load
    // the same thing twice.
  }

  #touch(key: string, entry: Entry<T>): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }

  #set(key: string, entry: Entry<T>): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    while (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) break;
      this.#entries.delete(oldest.value);
    }
  }
}
