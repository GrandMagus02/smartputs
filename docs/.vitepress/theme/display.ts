import { Decimal } from "@smartput/core";

/**
 * Decimal places the demos show. The engine keeps full precision — 26
 * significant digits reach `formatted` — and a live demo that prints
 * `13.888888888888888888888889m/s` teaches the reader nothing except that the
 * column is too narrow. This is a display trim in the docs theme only; nothing
 * here runs in the library.
 */
const DISPLAY_DP = 4;

/**
 * Matches a number as `formatNumber` writes it for `en`: optional grouping
 * commas, a `.` decimal separator. Anchored on a digit rather than a word
 * boundary so it also finds the number inside "13.8889m/s" and "$4,136.36".
 * A sign, when there is one, sits outside the match and is left alone.
 */
const NUMBER = /\d[\d,]*\.\d+/g;

function trim(value: Decimal): Decimal {
  if (value.decimalPlaces() <= DISPLAY_DP) return value;
  const rounded = value.toDecimalPlaces(DISPLAY_DP);
  // Never let a non-zero value display as a bare 0 — "0" reads as "no value",
  // which is a different claim from "smaller than four decimal places".
  return rounded.isZero() ? value : rounded;
}

/** A `Decimal` as the demos print it: ungrouped, at most four decimals. */
export function round4(value: Decimal): string {
  return trim(value).toString();
}

const group = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * The same trim applied to an already-formatted string, keeping the unit word,
 * symbol and grouping the engine produced. A number with four or fewer decimals
 * comes back untouched, so money's "$30.00" keeps the trailing zero its minor
 * unit requires.
 */
export function round4Text(text: string): string {
  return text.replace(NUMBER, (match) => {
    const value = new Decimal(match.replaceAll(",", ""));
    const trimmed = trim(value);
    if (trimmed.equals(value)) return match;

    const [whole = "", fraction = ""] = trimmed.toFixed().split(".");
    // Regroup only if the engine grouped: the separator is the locale's, and
    // re-deriving it here would be a second source of truth for it.
    const shown = match.includes(",") ? group(whole) : whole;
    return fraction === "" ? shown : `${shown}.${fraction}`;
  });
}
