import type { GeocodeHit, GeocodeProvider, GeocodeQuery } from "../query";

export interface CustomOptions {
  readonly id?: string;
  readonly attribution?: string;
  /** Default true. Declare false for a source that forbids per-keystroke calls. */
  readonly interactive?: boolean;
  readonly reverse?: (
    lat: number,
    lon: number,
    q?: GeocodeQuery,
  ) => Promise<readonly GeocodeHit[]>;
}

/**
 * Any async source in the provider shape — the geo mirror of rates'
 * `custom(fn)`.
 *
 * It restamps `source` with the provider's id rather than trusting the rows,
 * because `source` is what `Geocoder` weights by (§6) and what attribution is
 * joined on: a hit claiming to come from somewhere it did not would silently
 * reweight the whole merge.
 */
export function custom(
  search: (q: GeocodeQuery) => Promise<readonly GeocodeHit[]>,
  opts: CustomOptions = {},
): GeocodeProvider {
  const id = opts.id ?? "custom";
  const base = {
    id,
    attribution: opts.attribution ?? "",
    interactive: opts.interactive ?? true,
    async search(q: GeocodeQuery): Promise<readonly GeocodeHit[]> {
      return (await search(q)).map((h) => ({ ...h, source: id }));
    },
  };
  // Assigned conditionally rather than set to undefined:
  // `exactOptionalPropertyTypes` makes those two different types, and a
  // `reverse` property holding undefined would still be `in` the object, which
  // is what `Geocoder` tests to find a reversing provider.
  if (opts.reverse === undefined) return base;
  const reverse = opts.reverse;
  return {
    ...base,
    async reverse(
      lat: number,
      lon: number,
      q?: GeocodeQuery,
    ): Promise<readonly GeocodeHit[]> {
      return (await reverse(lat, lon, q)).map((h) => ({ ...h, source: id }));
    },
  };
}
