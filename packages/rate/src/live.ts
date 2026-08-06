import {
  createCachedEngine,
  createEngine,
  type Engine,
  type EngineOptions,
  type EvalOptions,
  RatesNotReadyError,
  type Result,
} from "@smartput/core";
import type { RateProvider } from "./providers/ecb";
import type { RateSnapshot } from "./snapshot";

const HOUR_MS = 3_600_000;

export interface LiveEngineOptions extends Omit<EngineOptions, "rates"> {
  provider: RateProvider;
  /** How long a snapshot stays fresh. Default one hour. */
  ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  now?: () => number;
}

export interface LiveEngine {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  /** Force a fetch regardless of TTL. */
  refresh(): Promise<void>;
  /** The underlying sync engine. Throws until the first refresh. */
  readonly sync: Engine;
  readonly ratesAsOf: string | undefined;
}

/**
 * The async facade over a sync core (spec D6). The core stays pure and
 * keystroke-fast; all I/O lives here.
 *
 * The caching half — one in-flight fetch shared by concurrent callers, the TTL,
 * the `finally` that lets the next call retry a rejection — moved to core's
 * `createCachedEngine` when geo needed the same three behaviours (geo spec
 * §8.1). What stays is what is about money: the hour default, and a `sync`
 * getter that answers a too-early caller in this package's own vocabulary. Core
 * hands back `engine | undefined` rather than taking an error factory, so
 * `RatesNotReadyError` is thrown from the file that owns the word "rates".
 *
 * Gone with the lift: a guard that threw `RateProviderError` when `ready()`
 * found no engine after a refresh. It could not fire — the refresh either
 * rejected, or ran `createEngine` and left an engine behind.
 */
export function createLiveEngine(opts: LiveEngineOptions): LiveEngine {
  const { provider, ttlMs = HOUR_MS, now = Date.now, ...engineOpts } = opts;

  const cached = createCachedEngine<RateSnapshot>({
    load: () => provider.fetch(),
    build: (rates) => createEngine({ ...engineOpts, rates }),
    ttlMs,
    now,
  });

  return {
    evaluate: (input, evalOpts) => cached.evaluate(input, evalOpts),
    suggest: (input, evalOpts) => cached.suggest(input, evalOpts),
    refresh: () => cached.refresh(),
    get sync(): Engine {
      const engine = cached.engine;
      if (engine === undefined) {
        throw new RatesNotReadyError("await refresh() or an evaluate() first");
      }
      return engine;
    },
    get ratesAsOf(): string | undefined {
      return cached.snapshot?.asOf;
    },
  };
}
