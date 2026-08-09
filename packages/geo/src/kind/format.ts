import { Decimal, type FormatCtx, type PlaceMeta, type Value } from "@smartput/core";
import type { CountryRow } from "./types";

const SCALES: ReadonlyArray<readonly [number, string]> = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/**
 * "124M", "2.9M", "800K". Rendered through `ctx.formatNumber` so the locale's
 * own decimal separator survives — a hand-written `toFixed` is exactly what M2
 * rejected a per-kind format hook for.
 */
function abbreviate(n: number, ctx: FormatCtx): string {
  for (const [factor, suffix] of SCALES) {
    if (n < factor) continue;
    const scaled = new Decimal(n).div(factor);
    // One decimal below ten, none above: "2.9M" carries what "3M" loses, while
    // "126.5M" is precision no census has.
    const shown = scaled.toDecimalPlaces(scaled.lt(10) ? 1 : 0);
    return `${ctx.formatNumber(shown)}${suffix}`;
  }
  return ctx.formatNumber(new Decimal(n));
}

/** GeoNames stores some codes with the plus and the country prefix already on. */
function callingCode(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed === "") return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/**
 * A bare place renders its facts (spec §5.3): the whole "lookup" feature is
 * this function. No op, no grammar and no parser change — "population of japan"
 * would have cost a prefix-attribute grammar for four attributes.
 *
 * The figures come from `meta`, not from the country row. Reading them off the
 * row is what M6.2 shipped and it was wrong for every city: `athens` rendered
 * as "Greece — EUR, +30, Europe/Athens, 11M" while its own meta said Athens,
 * 664,046, and all three Springfields rendered as "United States". The country
 * row survives only for the two facts a city genuinely borrows — currency and
 * calling code — which is also why `PlaceMeta` carries a name (see core).
 *
 * A country is told apart from a city by its id rather than by a flag: §4.2
 * makes the canonical the GeoNames id, and a country's row carries the
 * country's own. Nothing new has to be stored to answer the question.
 *
 * A factory over the table, where it used to be a module constant closing over
 * the vendored one. The index is rebuilt per `definePlace()` rather than shared,
 * for the reason the distance op is: a build handed a different country table
 * must not render its places out of this one's, and with the table arriving from
 * a provider there is no longer any "this one" to fall back to.
 */
export function createPlaceFormatter(
  countries: readonly CountryRow[],
): (value: Value, ctx: FormatCtx) => string {
  const byA2 = new Map<string, CountryRow>(countries.map((row) => [row.a2, row]));
  return (value, ctx) => formatPlace(byA2, value, ctx);
}

function formatPlace(
  byA2: ReadonlyMap<string, CountryRow>,
  value: Value,
  ctx: FormatCtx,
): string {
  const row = byA2.get(value.unit);
  if (row === undefined) return value.unit;

  const meta = value.meta as Partial<PlaceMeta> | undefined;
  const name = meta?.name ?? row.name;
  const zone = meta?.zone ?? row.zone;
  const population = meta?.population ?? row.population;
  const isCountry = (meta?.geonameId ?? row.geonameId) === row.geonameId;

  // A city is qualified by its country, "Kyiv, UA" — the alpha-2 rather than
  // the country's name, because the line is already four facts long and the
  // code is what the Value's unit actually is.
  const title = isCountry ? name : `${name}, ${row.a2.toUpperCase()}`;

  const facts = [
    // Currency and calling code belong to the country. A city shows them too:
    // "what currency does Osaka use" is the same question as for Japan, and
    // dropping them would make a city answer thinner than the country line for
    // no reason a user would recognise.
    row.currency,
    callingCode(row.phone),
    zone,
    // GeoNames writes 0 for the uninhabited territories, which is "no figure"
    // rather than "nobody lives there"; printing it would state the wrong one.
    population > 0 ? abbreviate(population, ctx) : "",
  ].filter((fact) => fact !== "");

  return facts.length === 0 ? title : `${title} — ${facts.join(", ")}`;
}
