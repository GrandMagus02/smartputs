import type { Engine, EvalOptions, Result } from "./engine";

export interface SnapshotCacheOptions<S> {
  /** Fetches a fresh snapshot. Its rejection reaches every waiting caller. */
  load: () => Promise<S>;
  /** How long a snapshot stays fresh. Default: never expires — load once. */
  ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  now?: () => number;
}

export interface SnapshotCache<S> {
  /** The snapshot, loaded first if there is none or it has aged past the TTL. */
  get(): Promise<S>;
  /** Load regardless of the TTL. */
  refresh(): Promise<S>;
  /** The last snapshot loaded, undefined until the first load succeeds. */
  readonly current: S | undefined;
}

/**
 * A TTL cache in front of one async source, with one in-flight load shared by
 * concurrent callers (spec §8.1).
 *
 * Shipped in core because `@smartput/rate` and `@smartput/country` both need it and
 * a TTL-plus-in-flight-promise cache written twice is where two copies start to
 * drift. Copying the twenty lines into geo was the alternative, and the second
 * consumer is the point at which the shape is proven rather than guessed.
 *
 * Core carries no I/O of its own: `load` is injected, so this file adds no
 * dependency and no network to a package that has one dependency and stays
 * keystroke-fast.
 */
export function createSnapshotCache<S>(opts: SnapshotCacheOptions<S>): SnapshotCache<S> {
  const { load, ttlMs = Number.POSITIVE_INFINITY, now = Date.now } = opts;

  let current: S | undefined;
  // Freshness is the TTL's answer, never the value's. A separate flag rather
  // than `current !== undefined`, because a loader that legitimately resolves
  // undefined would otherwise reload on every single call — the exact burst
  // this cache exists to collapse.
  let loaded = false;
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<S> | undefined;

  const doLoad = async (): Promise<S> => {
    const next = await load();
    current = next;
    loaded = true;
    // Stamped after the await, so a slow load is not born stale.
    fetchedAt = now();
    return next;
  };

  const refresh = (): Promise<S> => {
    // One request for a burst of keystrokes on a cold cache, not one each. The
    // `finally` clears the slot on rejection too, so the rejection propagates to
    // everyone waiting and the next call retries instead of awaiting a settled
    // rejection forever.
    if (inFlight === undefined) {
      inFlight = doLoad().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };

  return {
    get(): Promise<S> {
      if (!loaded || now() - fetchedAt >= ttlMs) return refresh();
      return Promise.resolve(current as S);
    },
    refresh,
    get current(): S | undefined {
      return current;
    },
  };
}

export interface CachedEngineOptions<S> extends SnapshotCacheOptions<S> {
  /** Builds the sync engine a snapshot implies. Called once per load. */
  build: (snapshot: S) => Engine;
}

export interface CachedEngine<S> {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  /** Force a load regardless of the TTL, and rebuild from what it returns. */
  refresh(): Promise<void>;
  /**
   * The engine built from the current snapshot, undefined until the first load
   * succeeds. Undefined rather than throwing: what a consumer owes a caller who
   * asks too early is its own vocabulary — rates throws `RatesNotReadyError`
   * from its own getter. Taking an error factory here was the alternative, and
   * it puts a second injection point in core to save each consumer one line.
   */
  readonly engine: Engine | undefined;
  /** The current snapshot, undefined until the first load succeeds. */
  readonly snapshot: S | undefined;
}

/**
 * The async facade over a sync core (spec D6): the core stays pure and
 * keystroke-fast, and all I/O, caching and TTL live out here.
 *
 * The snapshot and the engine it built are cached as one pair, so they cannot
 * come apart — the alternative, a snapshot cache beside a mutable `engine`
 * variable, is two things that have to be updated together and one day will not
 * be. It also means the rebuild happens inside the shared in-flight load: one
 * fetch is one `createEngine`, not one per waiting caller.
 *
 * A load that fails past the TTL rejects rather than serving the expired
 * engine. A caller who asked after the TTL asked for current data, and silently
 * answering with stale rates is the one failure they cannot detect; `engine`
 * stays readable for a consumer that would rather have stale than nothing.
 */
export function createCachedEngine<S>(opts: CachedEngineOptions<S>): CachedEngine<S> {
  const { load, build, ...cacheOpts } = opts;

  const cache = createSnapshotCache<{ snapshot: S; engine: Engine }>({
    ...cacheOpts,
    load: async () => {
      const snapshot = await load();
      return { snapshot, engine: build(snapshot) };
    },
  });

  return {
    async evaluate(input, evalOpts) {
      return (await cache.get()).engine.evaluate(input, evalOpts);
    },
    async suggest(input, evalOpts) {
      return (await cache.get()).engine.suggest(input, evalOpts);
    },
    async refresh() {
      await cache.refresh();
    },
    get engine(): Engine | undefined {
      return cache.current?.engine;
    },
    get snapshot(): S | undefined {
      return cache.current?.snapshot;
    },
  };
}
