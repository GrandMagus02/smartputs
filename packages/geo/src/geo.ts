import { QueryCache } from "./cache";
import { allFailed, GeoError, type ProviderFailure } from "./errors";
import { RateLimiter, type RateLimiterOptions } from "./limiter";
import { normalizeName, type Place, type PlaceHint, type PlaceLookup } from "./place";
import { rank } from "./rank";
import type { Coord, GeoHit, GeoProvider, GeoQuery } from "./types";

/**
 * How results from several providers are combined (geocode spec §5.1).
 *
 * - `fallback` — providers in declared order, first non-empty result wins.
 *   Cheapest source first, network last. This is the launcher's strategy: a hit
 *   in a local table costs nothing and ends the query.
 * - `merge` — every eligible provider in parallel, results deduped and ranked
 *   together. For "best answer" over "cheapest answer".
 * - `race` — first non-empty response wins and the rest are abandoned. For a
 *   consumer with two equivalent mirrors and a latency budget.
 */
export type GeoStrategy = "fallback" | "merge" | "race";

export interface GeoOptions {
  /** Searched in this order, which is also `rank`'s source weighting. */
  readonly providers: readonly GeoProvider[];
  /** Default `fallback`. */
  readonly strategy?: GeoStrategy;
  /** Rows returned per query, before a query's own `limit` overrides it. */
  readonly limit?: number;
  /** How long a cached query stays fresh. Default: never expires. */
  readonly ttlMs?: number;
  /** Cached queries kept. Default 200. */
  readonly cacheMax?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  readonly now?: () => number;
  /**
   * Per-provider rate limits, keyed by provider id. A provider absent from this
   * map is unlimited, which is the right default for a budget that is the
   * consumer's — and the wrong one for a donated public server, which is why
   * the adapters for those construct their own and ignore this.
   */
  readonly limits?: Readonly<Record<string, RateLimiterOptions>>;
}

const DEFAULT_LIMIT = 10;

/**
 * Free-text place search over N providers (geocode spec §5).
 *
 * A class and not a factory function, matching how the rest of this codebase
 * hands back stateful things — `PostalFormats`, `PlaceCompleter`, `RateLimiter`:
 * the object owns a cache, a limiter per provider and a running index of what it
 * has seen, and those want a `this`. The functions underneath — `rank`,
 * `dedupe`, `similarity`, `cacheKey` — are plain, exported, and tested without
 * constructing anything.
 *
 * ```ts
 * const geo = new Geo({ providers: [geonames({ username })] });
 * await geo.search("paris tx");        // GeoHit[]
 * await geo.search({ text: "dnipro", kinds: ["water"] });
 * await geo.reverse({ lat: 48.85, lon: 2.35 });
 * await geo.resolve("berlin");         // Place | null
 * geo.sync.find("berlin");             // no I/O, only what is already loaded
 * geo.attribution;                     // the credit lines that must be shown
 * ```
 */
export class Geo {
  readonly providers: readonly GeoProvider[];
  readonly strategy: GeoStrategy;
  readonly limit: number;

  readonly #cache: QueryCache<GeoHit[]>;
  readonly #limiters = new Map<string, RateLimiter>();
  readonly #order: readonly string[];
  /**
   * Every place any query has returned, keyed by folded name and by postal code
   * — the same two keys `placeSnapshot` indexes, so `sync.find` and a snapshot's
   * `find` answer the same question the same way.
   *
   * This is what `sync` reads. It grows with use and is never evicted, which is
   * deliberate: it is a few hundred bytes per distinct place a user has actually
   * looked at, and the thing it buys is that the *second* mention of Kyiv in one
   * session needs no network at all.
   */
  readonly #seen = new Map<string, Place[]>();
  /**
   * Whether any provider declares it may not be typed at.
   *
   * It exists to go into the cache key. An uncommitted query skips those
   * providers, so what it caches is a *partial* answer — and without this the
   * committed query that follows, whose whole purpose is to ask them, is served
   * that partial answer from cache and never reaches them. False for the common
   * case, where it costs nothing.
   */
  readonly #partialWhenTyping: boolean;

  constructor(opts: GeoOptions) {
    if (opts.providers.length === 0) {
      throw new GeoError("a Geo needs at least one provider");
    }
    this.providers = opts.providers;
    this.strategy = opts.strategy ?? "fallback";
    this.limit = opts.limit ?? DEFAULT_LIMIT;
    this.#order = opts.providers.map((p) => p.id);
    this.#partialWhenTyping = opts.providers.some((p) => !p.interactive);
    this.#cache = new QueryCache<GeoHit[]>({
      max: opts.cacheMax ?? 200,
      ...(opts.ttlMs === undefined ? {} : { ttlMs: opts.ttlMs }),
      ...(opts.now === undefined ? {} : { now: opts.now }),
    });
    for (const provider of opts.providers) {
      const limit = opts.limits?.[provider.id];
      this.#limiters.set(
        provider.id,
        new RateLimiter({
          ...(limit ?? {}),
          ...(opts.now === undefined ? {} : { now: opts.now }),
        }),
      );
    }
  }

  /** The credit lines every provider behind this `Geo` requires, deduplicated. */
  get attribution(): readonly string[] {
    return [...new Set(this.providers.map((p) => p.attribution))];
  }

  /**
   * A `PlaceLookup` over what this `Geo` has already returned. No I/O.
   *
   * Returns `null` rather than throwing when nothing is loaded, unlike rates'
   * `sync` getter, which throws `RatesNotReadyError`. The difference is what the
   * caller can do about it: a rate engine with no rates cannot evaluate
   * anything, while a place lookup with no snapshot has simply not got that
   * place, which is a `null` the caller already handles.
   */
  get sync(): PlaceLookup {
    const seen = this.#seen;
    return {
      find(name: string, hint?: PlaceHint): Place | null {
        const bucket = seen.get(normalizeName(name));
        if (bucket === undefined) return null;
        if (hint === undefined) return bucket[0] ?? null;
        const country = hint.country?.toLowerCase();
        const admin1 = hint.admin1?.toLowerCase();
        for (const row of bucket) {
          if (country !== undefined && row.country.toLowerCase() !== country) continue;
          if (admin1 !== undefined && row.admin1.toLowerCase() !== admin1) continue;
          return row;
        }
        return null;
      },
    };
  }

  /** Forget every cached query. The `sync` index is kept — it is not a cache. */
  clear(): void {
    this.#cache.clear();
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /** A ranked list. A bare string is sugar for `{ text }`. */
  async search(q: GeoQuery | string): Promise<GeoHit[]> {
    const query: GeoQuery = typeof q === "string" ? { text: q } : q;
    if (query.text.trim() === "") return [];
    // Thrown before anything is dispatched: a box whose corners are the wrong
    // way round filters out every result, and "no results" is the one answer a
    // caller cannot debug.
    assertBbox(query);

    const limit = query.limit ?? this.limit;
    const hits = await this.#cache.get(this.#key(query), () =>
      this.#dispatch(query, (p, qq) => p.search(qq)),
    );
    // Ranking happens outside the cache, so two queries that differ only by
    // `near` — which biases but does not filter — share one set of fetched rows.
    return rank(hits, query, this.#order, limit);
  }

  /** The top hit's place, or null. The one-answer form the kind bridge wants. */
  async resolve(q: GeoQuery | string): Promise<Place | null> {
    return (await this.search(q))[0]?.place ?? null;
  }

  /**
   * What is at this coordinate.
   *
   * Rejects rather than returning `[]` when no provider can reverse: an empty
   * array would read as "nowhere is there", which is never true of a coordinate
   * on land, and a caller cannot tell it apart from a genuine miss.
   */
  async reverse(at: Coord, q?: GeoQuery): Promise<GeoHit[]> {
    const query: GeoQuery = { ...q, text: q?.text ?? "" };
    assertBbox(query);
    const able = this.providers.filter((p) => p.reverse !== undefined);
    if (able.length === 0) {
      throw new GeoError("no provider behind this Geo can reverse geocode");
    }
    const hits = await this.#cache.get(
      `reverse|${at.lat},${at.lon}|${this.#key(query)}`,
      () =>
        this.#dispatch(
          query,
          // Non-null: `able` is exactly the providers that have one.
          // biome-ignore lint/style/noNonNullAssertion: filtered above
          (p, qq) => p.reverse!(at, qq),
          able,
        ),
    );
    // Proximity to the queried point is the whole ranking here, so the bias is
    // set rather than left to the caller — `reverse` without `near` would score
    // a distant metropolis above the village the coordinate is actually in.
    return rank(hits, { ...query, near: at }, this.#order, query.limit ?? this.limit);
  }

  /**
   * `cacheKey`, plus the one thing that is a fact about this `Geo` rather than
   * about the query: whether the answer was assembled from every provider or
   * only from the ones that may be typed at. See `#partialWhenTyping`.
   */
  #key(q: GeoQuery): string {
    const base = cacheKey(q);
    if (!this.#partialWhenTyping) return base;
    return `${q.committed === true ? "all" : "typed"}|${base}`;
  }

  // -------------------------------------------------------------------------
  // The strategies
  // -------------------------------------------------------------------------

  /**
   * Run `call` across the eligible providers under the configured strategy.
   *
   * Eligibility is where `interactive` is enforced: a provider that declares it
   * may not be typed at runs only on a committed query, and a `Geo` whose
   * providers are all non-interactive answers the typing from cache and the
   * `sync` index and returns what it has.
   */
  async #dispatch(
    q: GeoQuery,
    call: (p: GeoProvider, q: GeoQuery) => Promise<GeoHit[]>,
    from: readonly GeoProvider[] = this.providers,
  ): Promise<GeoHit[]> {
    const eligible = from.filter((p) => p.interactive || q.committed === true);
    if (eligible.length === 0) return [];

    const run = async (p: GeoProvider): Promise<GeoHit[]> => {
      await this.#limiters.get(p.id)?.take();
      // Checked after the wait as well as before it: a query that was superseded
      // while its turn came up in the bucket must not spend the request.
      q.signal?.throwIfAborted();
      const hits = await call(p, q);
      this.#remember(hits);
      return hits;
    };

    if (this.strategy === "merge") return this.#merge(q, eligible, run);
    if (this.strategy === "race") return this.#race(q, eligible, run);
    return this.#fallback(q, eligible, run);
  }

  /**
   * Every provider in parallel, everything they return kept.
   *
   * A rejection is *not* fatal here and an empty result *is* an answer, which is
   * the opposite of the other two strategies: a merge asked every source, so one
   * dead mirror leaves the others' answers standing. Only an all-rejected merge
   * throws.
   */
  async #merge(
    q: GeoQuery,
    providers: readonly GeoProvider[],
    run: (p: GeoProvider) => Promise<GeoHit[]>,
  ): Promise<GeoHit[]> {
    const settled = await Promise.allSettled(providers.map(run));
    const out: GeoHit[] = [];
    const failures: ProviderFailure[] = [];
    for (const [i, result] of settled.entries()) {
      if (result.status === "fulfilled") out.push(...result.value);
      else failures.push({ id: providers[i]?.id ?? "?", error: result.reason });
    }
    if (failures.length === providers.length) throw allFailed(q.text, failures);
    rethrowIfAborted(failures);
    return out;
  }

  /**
   * Declared order, first non-empty result wins.
   *
   * A provider that *rejects* does not end the query — the failure is recorded
   * and the next one is tried — while a provider that resolves empty is a miss
   * that moves on. This mirrors the split geo spec §8 already made between
   * GeoNames, where empty is an answer, and the ECB, where empty means the
   * format moved: a search that finds nothing has to be able to say so, but one
   * dead mirror must not take the query with it.
   */
  async #fallback(
    q: GeoQuery,
    providers: readonly GeoProvider[],
    run: (p: GeoProvider) => Promise<GeoHit[]>,
  ): Promise<GeoHit[]> {
    const failures: ProviderFailure[] = [];
    for (const provider of providers) {
      try {
        const hits = await run(provider);
        if (hits.length > 0) return hits;
      } catch (error) {
        rethrowIfAborted([{ id: provider.id, error }]);
        failures.push({ id: provider.id, error });
      }
    }
    if (failures.length === providers.length) throw allFailed(q.text, failures);
    return [];
  }

  /** First non-empty response wins; the losers are left to settle unobserved. */
  async #race(
    q: GeoQuery,
    providers: readonly GeoProvider[],
    run: (p: GeoProvider) => Promise<GeoHit[]>,
  ): Promise<GeoHit[]> {
    const failures: ProviderFailure[] = [];
    let pending = providers.length;
    return new Promise<GeoHit[]>((resolve, reject) => {
      const settle = (): void => {
        pending -= 1;
        if (pending > 0) return;
        if (failures.length === providers.length) reject(allFailed(q.text, failures));
        else resolve([]);
      };
      for (const provider of providers) {
        run(provider).then(
          (hits) => {
            if (hits.length > 0) resolve(hits);
            else settle();
          },
          (error: unknown) => {
            if (isAbort(error)) reject(error);
            failures.push({ id: provider.id, error });
            settle();
          },
        );
      }
    });
  }

  /** Fold every returned place into the `sync` index, newest first per key. */
  #remember(hits: readonly GeoHit[]): void {
    for (const hit of hits) {
      for (const key of [
        normalizeName(hit.place.name),
        normalizeName(hit.place.postal),
      ]) {
        if (key === "") continue;
        const bucket = this.#seen.get(key);
        if (bucket === undefined) this.#seen.set(key, [hit.place]);
        else if (!bucket.some((p) => sameRow(p, hit.place))) bucket.push(hit.place);
      }
    }
    for (const bucket of this.#seen.values()) {
      bucket.sort((a, b) => b.population - a.population);
    }
  }
}

/** Two rows are one row when they are the same feature in the same place. */
function sameRow(a: Place, b: Place): boolean {
  if (a.geonameId !== 0 || b.geonameId !== 0) return a.geonameId === b.geonameId;
  return a.country === b.country && a.postal === b.postal && a.name === b.name;
}

/**
 * The cache key: everything that changes which rows come back, and nothing that
 * only changes their order.
 *
 * `near` is deliberately absent. It biases the ranking and never filters
 * (geocode spec §4.1), so two queries differing only by proximity want the same
 * fetched rows scored differently — and including it would make every step of a
 * moving user a cache miss. `limit` is absent for the same reason: it slices
 * after ranking. `signal` and `committed` are absent because neither is a fact
 * about the answer.
 */
export function cacheKey(q: GeoQuery): string {
  return [
    normalizeName(q.text),
    [...(q.countries ?? [])]
      .map((c) => c.toLowerCase())
      .sort()
      .join(","),
    [...(q.kinds ?? [])].sort().join(","),
    q.lang ?? "",
    q.bbox === undefined ? "" : q.bbox.join(","),
  ].join("|");
}

/** A `bbox` whose corners are transposed filters everything out, silently. */
function assertBbox(q: GeoQuery): void {
  if (q.bbox === undefined) return;
  const [, south, , north] = q.bbox;
  if (south > north) {
    throw new GeoError(
      `bbox south ${south} is north of north ${north}: the order is [west, south, east, north]`,
      [],
      q.text,
    );
  }
}

/**
 * An abort is the caller's own decision and is rethrown unwrapped, rather than
 * counted as a provider failure or dressed up in a `GeoError`. `AbortError` is
 * what every caller's `catch` already tests for, and wrapping it breaks that.
 */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function rethrowIfAborted(failures: readonly ProviderFailure[]): void {
  for (const failure of failures) if (isAbort(failure.error)) throw failure.error;
}
