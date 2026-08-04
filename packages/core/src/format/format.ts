import { Decimal } from "../decimal";
import { fromCanonical } from "../eval/convert";
import { NUMBER_KIND, type Registry } from "../kind/registry";
import { numberSymbols } from "../locale/number";
import type { FormatOptions, Locale, Value } from "../types";

export type { FormatOptions } from "../types";

/**
 * Display precision, in significant digits: two below the 28 that Decimal
 * computes at. Those two guard digits absorb the error a round trip through a
 * non-terminating ratio accumulates — 5/9 for Fahrenheit, pi/180 for degrees,
 * 1000/3600 for kph — so `0.25 turn in deg` renders "90deg" rather than
 * "90.00000000000000000000000005deg".
 *
 * This is not a readability policy. Rounding harder would break spec §10's
 * `parse(format(v)) === v` property for values that legitimately need more
 * digits; at 26 it strengthens it, because the noise it removes is exactly
 * what made the property fail for temperature, angle and speed.
 */
export const DISPLAY_PRECISION = 26;

export function formatNumber(
  value: Decimal,
  locale: Locale,
  opts: FormatOptions = {},
): string {
  // Intl cannot take a Decimal, and Number() would lose precision on long
  // values, so reformat the digit string by hand using the locale's own
  // symbols. numberSymbols() is the single source of those symbols — deriving
  // them from Intl here would ignore a locale's own NumberFormatSpec and break
  // parse(format(v)) === v.
  const { group, decimal } = numberSymbols(locale);
  const precision = opts.precision ?? DISPLAY_PRECISION;
  const shown =
    opts.rounding === undefined
      ? new Decimal(value.toPrecision(precision))
      : new Decimal(value.toPrecision(precision, opts.rounding));

  // toFixed(), not toString(): toString() switches to exponential notation
  // outside Decimal's toExpNeg/toExpPos window, which the grouping below would
  // pass through ungrouped and parseNumber() would then reject.
  const text = shown.toFixed();
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [intPart = "0", fracPart] = body.split(".");

  // A Decimal has no notion of a trailing zero — `shown` above already lost
  // any "30.00" down to "30" — so a fixed scale (money's minor units) has to
  // be restored here, as padding on the digit string, using the same
  // `decimal` symbol the grouping below uses. `padEnd` never truncates, so a
  // fraction already longer than requested is left alone.
  const paddedFrac =
    opts.minFractionDigits === undefined
      ? fracPart
      : (fracPart ?? "").padEnd(opts.minFractionDigits, "0");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const joined =
    paddedFrac === undefined || paddedFrac === ""
      ? grouped
      : `${grouped}${decimal}${paddedFrac}`;
  return negative ? `-${joined}` : joined;
}

export function formatValue(
  value: Value,
  registry: Registry,
  locale: Locale,
  opts: FormatOptions = {},
): string {
  const kind = registry.kinds.get(value.kind);
  if (kind === undefined) return value.canonical.toFixed();

  const authored =
    kind.spec.mode === "ratio"
      ? fromCanonical(value.canonical, kind, value.unit, {
          locale: locale.id,
          ...(value.meta ? { meta: value.meta as Record<string, unknown> } : {}),
          ...(opts.rates ? { rates: opts.rates } : {}),
        })
      : value.canonical;

  if (kind.format !== undefined) {
    return kind.format(value, {
      locale: locale.id,
      authored,
      ...opts,
      formatNumber: (v, o) => formatNumber(v, locale, o ?? opts),
    });
  }

  const numberText = formatNumber(authored, locale, opts);
  if (value.kind === NUMBER_KIND) return numberText;

  const unit = kind.units.get(value.unit);
  const lexeme = unit?.lexeme;
  const category = new Intl.PluralRules(locale.id).select(authored.toNumber());
  const display = lexeme?.display?.[category];

  if (display !== undefined) return `${numberText} ${display}`;
  return `${numberText}${lexeme?.symbol ?? value.unit}`;
}
