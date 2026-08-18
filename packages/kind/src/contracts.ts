/**
 * The shapes kinds agree on, held by the layer kinds are written in.
 *
 * Ruling R-F1: a subpath of `@smartput/kind`, not a `@smartput/contracts`
 * package. A types-only package still has to be a runtime `dependency` for a
 * published `.d.ts` to resolve, so it would need a `check-deps` exemption and a
 * 38th name to claim, to say what a file already says. The subpath costs 0 B
 * (`check-size` has the row) and is honest about what it is.
 *
 * Every field here is what the writing package ALREADY puts on `Value.meta`.
 * This file names those fields; it never invents one. Adding a field is a change
 * to the writer first and to this file second.
 *
 * That rule is why three shapes here differ from the sketch in the design doc
 * (`docs/superpowers/specs/2026-08-18-smartputs-second-pass-design.md` §F). The
 * sketch guessed at what range-core and datetime write; the writers were read
 * instead, and each divergence is recorded on the interface it belongs to. The
 * spec is the intent, the writer is the truth.
 */
import type { Decimal } from "./decimal";
import type { KindId, RateLookup } from "./types";

/**
 * What a `place` Value carries on `meta`. Written by `@smartput/geo`; read by
 * `@smartput/datetime` (`zone`), `@smartput/rate` (`currency`) and
 * `@smartput/distance` (`lat`/`lon`).
 *
 * Moved here verbatim from `types.ts`, fields and optionality included:
 * `population` and `country` are REQUIRED because `geo`'s `Place` extends this
 * interface and its matcher, its postal literals and its providers all write
 * both. R-F1 moved the declaration, not the shape — a widening here would be a
 * change to what geo promises, and belongs in a change to geo.
 *
 * The rejected alternative was injecting a `PlaceLookup` into datetime, which
 * would have made datetime's construction depend on geo being present to serve
 * a case that a plain string on `meta` already covers: the datetime bridge
 * reads `zone`, the money bridge reads `currency`, and neither needs to know
 * what a city is.
 */
export interface PlaceMeta {
  /** GeoNames feature id. Stable, and the Value's canonical. */
  readonly geonameId: number;
  /**
   * The place's own display name — "Japan", "Athens", "Los Angeles".
   *
   * Here rather than left to the formatter to look up, because the lookup a
   * formatter could do is by `country`, and that returns the *country's* name
   * for a city: it rendered "athens" as "Greece — … 11M" while this same meta
   * said 664,046. A city table big enough to answer the question properly is
   * the one thing the formatter must not import, since reaching it statically
   * links the whole gazetteer into every bundle.
   */
  readonly name: string;
  /** IANA zone. Always present: a country carries its capital's zone. */
  readonly zone: string;
  /** ISO 4217. Present on countries; on a city, its country's. */
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
  /** ISO 3166-1 alpha-2, lowercased. Equals the Value's `unit`. */
  readonly country: string;
}

/**
 * What a range Value carries on `meta`. Written by `@smartput/range-core`'s
 * `makeRangeValue` and checked by its `unwrapRange`.
 *
 * Three strings, not a generic pair of endpoints: the design sketch proposed
 * `RangeMeta<T> { start: T; end: T; inclusive?: boolean }`, and range-core
 * writes ISO zoned strings with a **half-open** end and the zone they are read
 * in. Naming the real shape is the point of this file, so the sketch loses.
 *
 * `inclusive` has no field because it has no choice: everything stored is
 * half-open so span arithmetic needs no off-by-one correction, and only
 * `date-range`'s formatter subtracts a day for display.
 */
export interface RangeMeta {
  /** ISO zoned string of the inclusive start. */
  readonly start: string;
  /** ISO zoned string of the **exclusive** end. */
  readonly end: string;
  /**
   * IANA zone both ends are read in, or the empty string for a clock span,
   * which is not anchored to a zone at all. Empty is a legitimate value here,
   * not a missing one.
   */
  readonly zone: string;
}

/**
 * What a datetime Value carries on `meta`. Written by `@smartput/datetime`'s
 * `makeDateTimeValue` and required by its `unwrapInstant`.
 *
 * One field, not the sketch's `{ zone?, hasDate, hasTime }`: `hasDate` and
 * `hasTime` live on the chrono bridge's `Match`, which is a parse result and
 * never reaches `Value.meta`, and the zone is already inside the ISO string.
 * A reader that wants the zone parses `iso`; a reader that wants to know
 * whether a date was certain is asking the matcher, not the value.
 */
export interface InstantMeta {
  /** `Temporal.ZonedDateTime.toString()` — the instant and its zone. */
  readonly iso: string;
}

/**
 * Money's slice of `EngineOptions.context` (§G). Declared here for the same
 * reason `RateLookup` is declared in `types.ts`: `@smartput/rate` produces it,
 * core threads it, and neither imports the other.
 */
export interface MoneyContext {
  readonly rates?: RateLookup;
  readonly rounding?: Decimal.Rounding;
}

/** Every kind's context slice, keyed by kind id — `EvalCtx.context`'s shape. */
export type KindContext = Readonly<Record<KindId, unknown>>;
