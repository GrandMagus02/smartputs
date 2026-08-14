import type {
  Completion,
  Engine,
  EngineOptions,
  Kind,
  Result,
  Weights,
} from "@smartput/core";
import { composeLocale, createEngine, SmartputError } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { dateRange } from "@smartput/date-range";
import { datetime } from "@smartput/datetime";
import datetimeEn from "@smartput/datetime/locale/en";
import { datetimeRange } from "@smartput/datetime-range";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { RANGE_KINDS } from "@smartput/range";
import { CURRENCIES, money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";
import { time } from "@smartput/time";
import { timeRange } from "@smartput/time-range";

export type { Completion, Engine, Result };
export { CURRENCIES };

/**
 * The language and the words are two descriptors now, and `composeLocale` is
 * the only thing that may join them — so a demo engine names the vocabularies
 * it wants exactly the way a consumer does. `english` alone is a `Language`,
 * not a `Locale`, and passing it to `createEngine` throws inside
 * `buildRegistry`; that is what this file did between the split and this fix.
 *
 * The extra kinds below each add their own vocabulary rather than a second
 * locale: one language may hold at most one vocabulary per kind, so money's
 * "quid" and datetime's "tokyo" ride in the same list as the built-ins'.
 */
export const en = composeLocale(english, BUILTIN_EN);

export interface DocsEngineOptions {
  kinds?: Kind[];
  weights?: Weights;
  tiebreak?: EngineOptions["tiebreak"];
  ambiguityEpsilon?: number;
}

/**
 * Every demo on this site talks to a real engine built from the published
 * entry points — there is no mock layer and no precomputed output.
 */
export function createDocsEngine(opts: DocsEngineOptions = {}): Engine {
  return createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, ...(opts.kinds ?? [])],
    ...(opts.weights ? { weights: opts.weights } : {}),
    ...(opts.tiebreak ? { tiebreak: opts.tiebreak } : {}),
    ...(opts.ambiguityEpsilon !== undefined
      ? { ambiguityEpsilon: opts.ambiguityEpsilon }
      : {}),
  });
}

export const docsEngine: Engine = createDocsEngine();

/**
 * A checked-in rate table, not a live quote. The docs are a static site, the
 * ECB endpoint sends no CORS header, and a demo that fails in the browser
 * teaches nothing — so the money demos run the same fixed snapshot
 * `packages/rate/src/properties.test.ts` asserts against. The date is part of
 * the data and every demo shows it, because a rate without an `asOf` is a
 * number pretending to be a fact.
 */
export const DOCS_RATES = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 170,
  CHF: 0.94,
  PLN: 4.28,
  UAH: 45.5,
  CAD: 1.5,
  AUD: 1.68,
  SEK: 11.2,
  NOK: 11.7,
  CZK: 24.8,
});

/**
 * Money is not in `BUILTIN_KINDS` and never will be: it needs an injected rate
 * table, so it ships in `@smartput/rate` and is registered by the caller. This
 * engine is what that registration looks like.
 */
export const moneyEngine: Engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: DOCS_RATES,
});

/**
 * Datetime, on a live clock rather than the corpus's frozen reference — a demo
 * that says "today" and means January is a screenshot.
 *
 * The place kind used to be registered here too, which is what made
 * `3pm in tokyo` read a zone off a place Value. `@smartput/country`,
 * `@smartput/city` and `@smartput/zip` have since been folded into
 * `@smartput/geo`, whose gazetteer is a network provider rather than a
 * committed table, and whose door does not yet expose the kind. The bridge
 * demos come back when it does — with rows this site fetches or declares
 * itself, because there is no longer a table to import.
 */
export const datetimeEngine: Engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => Date.now(),
  timeZone: "UTC",
});

/**
 * Every range kind at once, over the same live clock the datetime demos use.
 *
 * `datetime` is a prerequisite rather than a peer: `date` and `time` parse
 * nothing of their own, they re-read the match chrono already made, so an
 * engine with the range kinds and no datetime is six kinds that never claim
 * anything.
 */
export const rangeEngine: Engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],
  kinds: [
    ...BUILTIN_KINDS,
    datetime,
    date,
    time,
    dateRange,
    timeRange,
    datetimeRange,
    ...RANGE_KINDS,
  ],
  now: () => Date.now(),
  timeZone: "UTC",
});

/**
 * The engine `@smartput/query` reads values through on this site: the built-ins
 * for lengths and masses, money for `over 500 usd`, and the date kinds for
 * `last week`. No place kind — see `datetimeEngine` above — so the schema's
 * place column is declared and never exercised by these examples.
 */
export const queryEngine: Engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn, datetimeEn])],
  kinds: [...BUILTIN_KINDS, money, datetime, date, dateRange],
  rates: DOCS_RATES,
  now: () => Date.now(),
  timeZone: "UTC",
});

export type EvalOutcome =
  | { status: "empty" }
  | { status: "ok"; result: Result }
  | { status: "error"; name: string; message: string };

/**
 * `evaluate()` is strict and throws — including on ambiguity, which is a
 * normal thing to type into a live input. Demos render the error instead of
 * breaking, so the failure modes are visible rather than hidden.
 */
export function evaluateSafely(engine: Engine, input: string): EvalOutcome {
  if (input.trim() === "") return { status: "empty" };
  try {
    return { status: "ok", result: engine.evaluate(input) };
  } catch (error) {
    // `error.name` and not `constructor.name`: the client bundle is minified,
    // so the class name is mangled while `name` is a literal the library sets.
    if (error instanceof SmartputError) {
      return { status: "error", name: error.name, message: error.message };
    }
    return {
      status: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Lucide icon suffix per registered kind, used by the result cards. */
export const KIND_ICONS: Record<string, string> = {
  length: "ruler",
  mass: "weight",
  duration: "timer",
  number: "hash",
  percent: "percent",
  temperature: "thermometer",
  tempdelta: "thermometer-sun",
  angle: "triangle",
  datasize: "hard-drive",
  speed: "gauge",
  area: "square",
  volume: "beaker",
  money: "banknote",
  datetime: "calendar-clock",
  place: "map-pin",
};

export function kindIcon(kind: string): string {
  return `i-lucide-${KIND_ICONS[kind] ?? "shapes"}`;
}
