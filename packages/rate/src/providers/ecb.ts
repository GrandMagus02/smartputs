import { RateProviderError } from "@smartput/core";
import { type RateSnapshot, snapshot } from "../snapshot";

export interface RateProvider {
  readonly id: string;
  fetch(): Promise<RateSnapshot>;
}

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const DATE = /<Cube\s+time='(\d{4}-\d{2}-\d{2})'/;
const QUOTE = /<Cube\s+currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;

export interface EcbOptions {
  /** Injected for tests; defaults to the global. */
  fetch?: typeof globalThis.fetch;
  /** Override the endpoint, e.g. for a mirror. */
  url?: string;
}

/**
 * ECB daily reference rates: official, free, no key, ~30 fiat currencies,
 * quoted against the euro and published once each working day.
 *
 * Parsed with two regexes rather than an XML parser. The document has had the
 * same three-level Cube structure for two decades, and a parser would be the
 * heaviest thing in this package. The fixture test is what makes that safe: if
 * the format moves, it fails here rather than in production.
 */
export function ecb(opts: EcbOptions = {}): RateProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const url = opts.url ?? ECB_DAILY;

  return {
    id: "ecb",
    async fetch(): Promise<RateSnapshot> {
      const res = await doFetch(url);
      if (!res.ok) {
        throw new RateProviderError(
          "ecb",
          `request failed: ${res.status} ${res.statusText}`,
        );
      }
      const xml = await res.text();

      const date = DATE.exec(xml)?.[1];
      if (date === undefined) {
        throw new RateProviderError("ecb", "response carried no <Cube time='...'> date");
      }

      const table: Record<string, string> = {};
      // exec in a loop rather than matchAll, so the lastIndex reset below is
      // explicit: QUOTE is module-level and stateful.
      QUOTE.lastIndex = 0;
      let m = QUOTE.exec(xml);
      while (m !== null) {
        const code = m[1];
        const rate = m[2];
        if (code !== undefined && rate !== undefined) table[code] = rate;
        m = QUOTE.exec(xml);
      }
      if (Object.keys(table).length === 0) {
        throw new RateProviderError("ecb", "response carried no currency quotes");
      }

      return snapshot("EUR", date, table);
    },
  };
}

/** Wraps any async source in the provider shape. */
export function custom(fn: () => Promise<RateSnapshot>): RateProvider {
  return { id: "custom", fetch: fn };
}
