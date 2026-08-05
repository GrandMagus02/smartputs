import { Decimal, type FormatCtx, type Value } from "@smartput/core";
import { COUNTRIES } from "./data/countries";
import type { CountryRow } from "./types";

const BY_A2 = new Map<string, CountryRow>(COUNTRIES.map((row) => [row.a2, row]));

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
 * The facts come from the country row rather than from `meta`, because `meta`
 * is the bridge contract that datetime and rates read (spec §3.1) and carries
 * no display name. Widening it to carry one would make every reader pay for a
 * field only the formatter wants.
 */
export function formatPlace(value: Value, ctx: FormatCtx): string {
  const row = BY_A2.get(value.unit);
  if (row === undefined) return value.unit;

  const facts = [
    row.currency,
    callingCode(row.phone),
    row.zone,
    // GeoNames writes 0 for the uninhabited territories, which is "no figure"
    // rather than "nobody lives there"; printing it would state the wrong one.
    row.population > 0 ? abbreviate(row.population, ctx) : "",
  ].filter((fact) => fact !== "");

  return facts.length === 0 ? row.name : `${row.name} — ${facts.join(", ")}`;
}
