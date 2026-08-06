import { QueryCache } from "./cache";
import type { Place, PlaceLookup } from "./place";
import {
  applyFilters,
  cacheKey,
  GeocodeError,
  type GeocodeHit,
  type GeocodeProvider,
  type GeocodeQuery,
  toQuery,
} from "./query";
import { rankHits } from "./rank";

export type GeocodeStrategy = "fallback" | "merge" | "race";

export interface GeocoderOptions {
  readonly providers: readonly GeocodeProvider[];
  /** Default `"fallback"`: cheapest source first, and stop when one answers. */
  readonly strategy?: GeocodeStrategy;
  /** How long a cached answer stays fresh. Default: forever. */
  readonly ttlMs?: number;
  /** Results per query, unless the query says otherwise. Default 10. */
  readonly limit?: number;
  /** Cached queries. Default 200. */
  readonly cacheMax?: number;
  readonly now?: () => number;
}

const DEFAULT_LIMIT = 10;

/**
 * The public door onto the search path (spec §5).
 *
 * A class and not a factory, matching how the rest of this codebase hands back
 * stateful things — `PostalFormats`, `PlaceCompleter`, `PlaceDistance`: this
 * object owns a cache and a provider list, and those want a `this`. The
 * functions underneath — `rankHits`, `dedupe`, `applyFilters`, `cacheKey` — are
 * plain and exported, and every one of them is tested without constructing a
 * `Geocoder`.
 */
export class Geocoder {
  readonly #providers: readonly GeocodeProvider[];
  readonly #strategy: GeocodeStrategy;
  readonly #limit: number;
  readonly #cache: QueryCache<readonly GeocodeHit[]>;

  constructor(opts: GeocoderOptions) {
    this.#providers = opts.providers;
    this.#strategy = opts.strategy ?? "fallback";
    this.#limit = opts.limit ?? DEFAULT_LIMIT;
    // Spread-or-omit rather than passing undefined through:
    // `exactOptionalPropertyTypes` makes an absent option and one holding
    // undefined different types, and `QueryCacheOptions` declares the absent
    // one — so `{ ttlMs: undefined }` is a type error, not a defaulted call.
    this.#cache = new QueryCache<readonly GeocodeHit[]>({
      ...(opts.ttlMs === undefined ? {} : { ttlMs: opts.ttlMs }),
      ...(opts.cacheMax === undefined ? {} : { max: opts.cacheMax }),
      ...(opts.now === undefined ? {} : { now: opts.now }),
    });
  }

  /**
   * Every attribution string a consumer must display, deduplicated. Empty
   * strings are dropped: `custom()` defaults to one, and a UI rendering a blank
   * line is worse than rendering nothing.
   */
  get attribution(): readonly string[] {
    const out: string[] = [];
    for (const p of this.#providers) {
      if (p.attribution !== "" && !out.includes(p.attribution)) out.push(p.attribution);
    }
    return out;
  }

  /**
   * Whatever a provider can already answer with no I/O — `bundled()` always,
   * a fetched index once loaded.
   *
   * Returns `null` where rates' `sync` getter throws `RatesNotReadyError`, and
   * the difference is what the caller can do about it: a rate engine with no
   * rates cannot evaluate anything, while a place lookup with no snapshot has
   * simply not got that place, which is a `null` every caller already handles.
   */
  get sync(): PlaceLookup {
    const providers = this.#providers;
    return {
      find(name: string): Place | null {
        for (const p of providers) {
          const found = p.snapshot?.find(name);
          if (found != null) return found;
        }
        return null;
      },
    };
  }

  async search(input: string | GeocodeQuery): Promise<readonly GeocodeHit[]> {
    const q = this.#withDefaults(toQuery(input));
    this.#throwIfAborted(q);
    const load = this.#load(q);
    const signal = q.signal;
    if (signal === undefined) return load;
    // The shared load is *not* cancelled — another caller may still want it.
    // What this rejects is this caller's view of it, which is what an abort
    // actually means when one request serves several callers (§5.3). Racing
    // rather than re-checking after the await, so an abort lands the moment it
    // happens instead of whenever the slowest provider gets round to answering.
    return Promise.race([
      load,
      new Promise<never>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            reject(signal.reason);
          },
          { once: true },
        );
      }),
    ]);
  }

  /** `search` narrowed to one answer, which is what the kind bridge wants. */
  async resolve(input: string | GeocodeQuery): Promise<Place | null> {
    const hits = await this.search(input);
    return hits[0]?.place ?? null;
  }

  #withDefaults(q: GeocodeQuery): GeocodeQuery {
    return q.limit === undefined ? { ...q, limit: this.#limit } : q;
  }

  /**
   * The cached load, in the one direction sharing is sound.
   *
   * `cacheKey` deliberately ignores `committed` because a committed answer is a
   * *superset* — every eligible provider ran — and a later keystroke is
   * entitled to read it. The converse is not true, and reading it as symmetric
   * is a cache poisoning: `type, then press Enter` is the only order that
   * happens in practice, so the keystroke's narrow answer (often `[]`, since
   * non-interactive providers were skipped) would be handed straight back to
   * the committed query and the provider would never run at all.
   *
   * So the committed answer owns `cacheKey(q)` and a keystroke answer is
   * shelved beside it under a suffixed key, which `cacheKey` can never produce
   * (its last field is `limit`, always a number once `#withDefaults` has run).
   * `peek` rather than `get` on the wide entry: an entry only exists once its
   * load resolved, and a *pending* committed load must not be awaited by a
   * keystroke that could still be served now.
   */
  #load(q: GeocodeQuery): Promise<readonly GeocodeHit[]> {
    const key = cacheKey(q);
    if (q.committed === true) return this.#cache.get(key, () => this.#run(q));
    const wide = this.#cache.peek(key);
    if (wide !== undefined) return Promise.resolve(wide);
    return this.#cache.get(`${key} ~`, () => this.#run(q));
  }

  /**
   * Rejects with the signal's own reason, unwrapped, rather than a
   * `GeocodeError`. `AbortError` is what every caller's `catch` already tests
   * for, and dressing it up breaks that (§10).
   */
  #throwIfAborted(q: GeocodeQuery): void {
    if (q.signal?.aborted === true) throw q.signal.reason;
  }

  /** Providers this query may reach: §4.3's licence condition, enforced. */
  #eligible(q: GeocodeQuery): readonly GeocodeProvider[] {
    if (q.committed === true) return this.#providers;
    return this.#providers.filter((p) => p.interactive);
  }

  /**
   * Order as weight: the first provider a query is allowed to reach is the one
   * the consumer trusts most, and §6's source term is how that trust enters the
   * score. Computed over the *eligible* list rather than the whole one, so a
   * provider skipped for being non-interactive does not leave a gap in the
   * scale.
   */
  #weightOf(providers: readonly GeocodeProvider[]): (source: string) => number {
    return (source: string) => {
      const index = providers.findIndex((p) => p.id === source);
      if (index < 0) return 0;
      return 1 - index / providers.length;
    };
  }

  async #run(q: GeocodeQuery): Promise<readonly GeocodeHit[]> {
    const providers = this.#eligible(q);
    if (providers.length === 0) return [];
    const weightOf = this.#weightOf(providers);
    if (this.#strategy === "merge") return this.#merge(providers, q, weightOf);
    if (this.#strategy === "race") return this.#race(providers, q, weightOf);
    return this.#fallback(providers, q, weightOf);
  }

  /** Cheapest source first, and stop at the first one that answers. */
  async #fallback(
    providers: readonly GeocodeProvider[],
    q: GeocodeQuery,
    weightOf: (source: string) => number,
  ): Promise<readonly GeocodeHit[]> {
    const causes: unknown[] = [];
    for (const provider of providers) {
      try {
        const hits = applyFilters(await provider.search(q), q);
        if (hits.length > 0) return rankHits(hits, q, weightOf);
      } catch (err) {
        // A dead mirror must not take the query with it. Recorded and walked
        // past; only an all-rejecting run is a failure.
        causes.push(err);
      }
    }
    return this.#empty(providers, causes);
  }

  /**
   * Every provider in parallel, the union deduped and ranked together.
   *
   * `allSettled` and not `all`: one dead mirror must not take the query with
   * it, which is the same rule `#fallback` follows. Only an all-rejecting run
   * is a failure.
   */
  async #merge(
    providers: readonly GeocodeProvider[],
    q: GeocodeQuery,
    weightOf: (source: string) => number,
  ): Promise<readonly GeocodeHit[]> {
    const settled = await Promise.allSettled(providers.map((p) => p.search(q)));
    const hits: GeocodeHit[] = [];
    const causes: unknown[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") hits.push(...applyFilters(result.value, q));
      else causes.push(result.reason);
    }
    if (hits.length > 0) return rankHits(hits, q, weightOf);
    return this.#empty(providers, causes);
  }

  /**
   * The first non-empty answer wins. Losers are left to settle rather than
   * cancelled: a provider's own `signal` is the query's, and aborting it here
   * would abort the winner too.
   */
  async #race(
    providers: readonly GeocodeProvider[],
    q: GeocodeQuery,
    weightOf: (source: string) => number,
  ): Promise<readonly GeocodeHit[]> {
    const causes: unknown[] = [];
    let pending = providers.length;
    return new Promise<readonly GeocodeHit[]>((resolve, reject) => {
      // Only reached once every provider has answered emptily or rejected —
      // a winner resolves the promise directly and leaves this counting into
      // an already-settled promise, which is a no-op.
      const settle = (): void => {
        pending -= 1;
        if (pending > 0) return;
        if (causes.length === providers.length) {
          reject(new GeocodeError(`every provider failed (${providers.length})`, causes));
          return;
        }
        resolve([]);
      };
      for (const provider of providers) {
        provider.search(q).then(
          (raw) => {
            const hits = applyFilters(raw, q);
            if (hits.length > 0) resolve(rankHits(hits, q, weightOf));
            else settle();
          },
          (err: unknown) => {
            causes.push(err);
            settle();
          },
        );
      }
    });
  }

  /** No hits: empty when someone answered, an error when nobody could. */
  #empty(
    providers: readonly GeocodeProvider[],
    causes: readonly unknown[],
  ): readonly GeocodeHit[] {
    if (causes.length > 0 && causes.length === providers.length) {
      throw new GeocodeError(`every provider failed (${providers.length})`, causes);
    }
    return [];
  }

  /**
   * The coordinate's place, from the providers that can answer one.
   *
   * A `Geocoder` with none throws rather than returning `[]`: an empty array
   * reads as "nowhere is there", which is never true of a coordinate (§4.3).
   */
  async reverse(
    lat: number,
    lon: number,
    input: string | GeocodeQuery = "",
  ): Promise<readonly GeocodeHit[]> {
    const q = this.#withDefaults(toQuery(input));
    this.#throwIfAborted(q);
    const able = this.#eligible(q).filter((p) => p.reverse !== undefined);
    if (able.length === 0) {
      throw new GeocodeError("no provider can reverse a coordinate");
    }
    const weightOf = this.#weightOf(able);
    const causes: unknown[] = [];
    const hits: GeocodeHit[] = [];
    for (const provider of able) {
      try {
        const raw = await provider.reverse?.(lat, lon, q);
        hits.push(...applyFilters(raw ?? [], q));
        if (hits.length > 0 && this.#strategy !== "merge") break;
      } catch (err) {
        causes.push(err);
      }
    }
    this.#throwIfAborted(q);
    if (hits.length > 0) return rankHits(hits, q, weightOf);
    return this.#empty(able, causes);
  }
}
