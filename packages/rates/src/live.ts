import {
  createEngine,
  type Engine,
  type EngineOptions,
  type EvalOptions,
  RateProviderError,
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
 * keystroke-fast; all I/O, caching and TTL live here.
 *
 * A single in-flight promise is shared by concurrent callers, so a burst of
 * keystrokes on a cold cache produces one request, not one per keystroke. A
 * rejected fetch clears the in-flight promise in `finally`, so the rejection
 * propagates to every waiting caller and the next call retries rather than
 * awaiting a settled rejection forever.
 */
export function createLiveEngine(opts: LiveEngineOptions): LiveEngine {
  const { provider, ttlMs = HOUR_MS, now = Date.now, ...engineOpts } = opts;

  let engine: Engine | undefined;
  let rates: RateSnapshot | undefined;
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<void> | undefined;

  const doRefresh = async (): Promise<void> => {
    const next = await provider.fetch();
    rates = next;
    fetchedAt = now();
    engine = createEngine({ ...engineOpts, rates: next });
  };

  const refresh = (): Promise<void> => {
    // Share one request among concurrent callers.
    if (inFlight === undefined) {
      inFlight = doRefresh().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };

  const ready = async (): Promise<Engine> => {
    if (engine === undefined || now() - fetchedAt >= ttlMs) await refresh();
    if (engine === undefined) {
      throw new RateProviderError(provider.id, "returned no snapshot");
    }
    return engine;
  };

  return {
    async evaluate(input, evalOpts) {
      return (await ready()).evaluate(input, evalOpts);
    },
    async suggest(input, evalOpts) {
      return (await ready()).suggest(input, evalOpts);
    },
    refresh,
    get sync(): Engine {
      if (engine === undefined) {
        throw new RatesNotReadyError("await refresh() or an evaluate() first");
      }
      return engine;
    },
    get ratesAsOf(): string | undefined {
      return rates?.asOf;
    },
  };
}
