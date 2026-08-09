import {
  composeLocale,
  createCachedEngine,
  createEngine,
  type Engine,
  type EngineOptions,
  type EvalOptions,
  type Language,
  type Result,
  type Vocabulary,
} from "@smartput/core";
import { type CountryTableOptions, countryTable } from "./countries";
import { GeoError } from "./errors";
import { definePlace } from "./kind/place";
import type { Admin1Row, CityRow, CountryRow } from "./kind/types";
import { placeVocabulary } from "./locale/vocabulary";
import type { GeoNames } from "./providers/geonames";

const DAY_MS = 86_400_000;

/** The tables one load produced, kept beside the engine built from them. */
export interface PlaceTables {
  readonly countries: readonly CountryRow[];
  readonly cities: readonly CityRow[];
  readonly admin1: readonly Admin1Row[];
  /** When the load happened, ISO 8601. The geo mirror of `RateSnapshot.asOf`. */
  readonly asOf: string;
}

export interface LivePlaceOptions extends Omit<EngineOptions, "kinds" | "locales"> {
  /** Where the countries come from. */
  readonly client: GeoNames;
  /** Language and alias policy, handed to `countryTable`. */
  readonly table?: CountryTableOptions;
  /**
   * The base language the place vocabulary is composed into — core's `english`,
   * or another `Language`. Composed here rather than by the caller because the
   * vocabulary does not exist until the table has arrived.
   */
  readonly language: Language;
  /** Vocabularies for the other kinds this engine registers. */
  readonly vocabularies?: readonly Vocabulary[];
  /** Kinds registered alongside `place` — `number`, `length`, whatever else. */
  readonly kinds?: EngineOptions["kinds"];
  /** Cities and divisions, if the consumer has any. See `PlaceOptions`. */
  readonly cities?: readonly CityRow[];
  readonly admin1?: readonly Admin1Row[];
  /** How long a table stays fresh. Default one day. */
  readonly ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  readonly now?: () => number;
}

export interface LivePlace {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  /** Force a fetch regardless of the TTL. */
  refresh(): Promise<void>;
  /** The underlying sync engine. Throws until the first load. */
  readonly sync: Engine;
  /** The tables the current engine was built from, undefined until the first load. */
  readonly tables: PlaceTables | undefined;
}

/**
 * The async facade over a sync engine, for places (geo spec §8.1).
 *
 * This is the function that section has been waiting for through two
 * milestones. It opened a ruling — either geo ships a live place engine that
 * owns the mapping from provider data to kind rows, or it ships the mapping
 * alone and the facade stays core's — M6.3 deferred it, M6.4's amendment
 * recorded that the milestone ended without making it, and core's
 * `createCachedEngine` has sat with one consumer and a justification its own
 * header called unearned. It has two now.
 *
 * Line for line the shape of `createLiveEngine` in `@smartput/rate`, which is
 * not a coincidence: a table of rates and a table of countries are the same
 * problem — data the library must not own, fetched once, cached with a TTL, and
 * rebuilt into a sync engine that stays keystroke-fast. What differs is only
 * what is being built, and how long it stays fresh: an hour for money, a day
 * here, because a country's currency and coordinates do not move by the hour.
 *
 * ```ts
 * const live = createLivePlace({
 *   client: geonames({ username }),
 *   language: english,
 *   table: { lang: "uk" },
 *   kinds: [number, length],
 * });
 * await live.evaluate("3pm in kyiv");
 * ```
 *
 * The vocabulary is composed inside the load and not by the caller, because it
 * cannot exist before the table does — the words for the countries *are* the
 * table's names. That is the one structural difference from the rates facade,
 * and the reason this takes a `Language` rather than a `Locale`.
 */
export function createLivePlace(opts: LivePlaceOptions): LivePlace {
  const {
    client,
    table,
    language,
    vocabularies = [],
    kinds = [],
    cities,
    admin1,
    ttlMs = DAY_MS,
    now = Date.now,
    ...engineOpts
  } = opts;

  const cached = createCachedEngine<PlaceTables>({
    load: async () => {
      const countries = await countryTable(client, table ?? {});
      return {
        countries,
        cities: cities ?? [],
        admin1: admin1 ?? [],
        // Stamped from the injected clock, so a test can pin it and a caller can
        // read how old the table behind an answer is.
        asOf: new Date(now()).toISOString(),
      };
    },
    build: (tables) =>
      createEngine({
        ...engineOpts,
        locales: [
          composeLocale(language, [
            ...vocabularies,
            placeVocabulary(tables.countries, language.id),
          ]),
        ],
        kinds: [
          ...kinds,
          definePlace({
            countries: tables.countries,
            ...(tables.cities.length === 0 ? {} : { cities: tables.cities }),
            ...(tables.admin1.length === 0 ? {} : { admin1: tables.admin1 }),
          }),
        ],
      }),
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
        // This package's own vocabulary rather than core's, for the reason rates
        // throws `RatesNotReadyError` from its own getter: core hands back
        // `engine | undefined` and leaves the wording to whoever owns the noun.
        throw new GeoError("no places loaded — await refresh() or an evaluate() first");
      }
      return engine;
    },
    get tables(): PlaceTables | undefined {
      return cached.snapshot;
    },
  };
}
