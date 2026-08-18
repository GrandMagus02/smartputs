import { Decimal } from "../decimal";
import { fromCanonical } from "../eval/convert";
import { NUMBER_KIND, type Registry, wordsFor } from "../kind/registry";
import { numberSymbols } from "../locale/number";
import { defaultRenderQuantity } from "../locale/render";
import type {
  FormatOptions,
  Language,
  Locale,
  QuantityParts,
  Slot,
  Value,
} from "../types";

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

/**
 * What `Result.formatted` keeps. Ruling R-C1.
 *
 * Distinct from `DISPLAY_PRECISION` (26) above, which is the ROUND-TRIP AND
 * COMPARISON GUARD and keeps both its meaning and its default. This policy runs
 * after it, never before, so `Result.value.canonical` and `Result.value.raw`
 * are untouched at 28 and 26 digits and `comparePrecision` still decides that
 * `1 km / 3 * 3 = 1 km` (ruling C4).
 *
 * Four fraction digits, chosen against six and against a pure
 * significant-digit rule: four is what a pocket calculator and a Soulver-class
 * tool show, and a significant-digit rule makes `1234567.891` lose its cents.
 * The three-digit significant floor is what stops `0.00001234 g` printing as
 * `0`.
 *
 * Money is exempt, and the exemption is enforced at the call site rather than
 * here: a money kind formats through its own `format` hook, which rounds by the
 * currency's minor units under `rounding`, and re-rounding a cent to a general
 * policy would be core deciding a domain question.
 */
export interface DisplayOptions {
  /** Fraction digits `formatted` keeps at most. Default 4. Trailing zeros are dropped. */
  maximumFractionDigits?: number;
  /** Significant digits `formatted` never drops below, so a small value is not rounded to 0. Default 3. */
  minimumSignificantDigits?: number;
}

export const DEFAULT_DISPLAY: Required<DisplayOptions> = Object.freeze({
  maximumFractionDigits: 4,
  minimumSignificantDigits: 3,
});

/**
 * `FormatOptions` plus the display policy. A separate type rather than a field
 * on `FormatOptions` itself because `FormatOptions` is `@smartput/kind`'s, and
 * a kind's own `format` hook is precisely the path this policy does not run on
 * (the money exemption above).
 */
export type FormatOptionsWithDisplay = FormatOptions & { display?: DisplayOptions };

/**
 * Applies the display policy, or nothing at all when there is no policy —
 * `undefined` is "leave the guard digits alone", which is what every caller
 * that has not opted in gets and why this file's other outputs do not move.
 */
export function applyDisplay(
  value: Decimal,
  display: DisplayOptions | undefined,
): Decimal {
  if (display === undefined) return value;
  const maxFraction =
    display.maximumFractionDigits ?? DEFAULT_DISPLAY.maximumFractionDigits;
  const minSignificant =
    display.minimumSignificantDigits ?? DEFAULT_DISPLAY.minimumSignificantDigits;
  if (value.isZero()) return value;
  const rounded = value.toDecimalPlaces(maxFraction);
  // Zero is the case the floor exists for: 0.00001234 rounds to 0 at four
  // places, and zero has no significant digits to compare, so it always falls
  // through to the floor rather than being reported as nothing.
  if (!rounded.isZero() && rounded.sd() >= minSignificant) return rounded;
  return value.toSignificantDigits(minSignificant);
}

export function formatNumber(
  value: Decimal,
  language: Language,
  opts: FormatOptionsWithDisplay = {},
): string {
  // Intl cannot take a Decimal, and Number() would lose precision on long
  // values, so reformat the digit string by hand using the locale's own
  // symbols. numberSymbols() is the single source of those symbols — deriving
  // them from Intl here would ignore a locale's own NumberFormatSpec and break
  // parse(format(v)) === v.
  const { group, decimal } = numberSymbols(language);
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
  opts: FormatOptionsWithDisplay = {},
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

  const language = locale.language;

  // Pre-bound to this value's kind and unit, and defaulting `slot` to the same
  // `"bare"` the default path below passes — a hook renders a finished Value
  // with no expression around it, exactly as `formatValue` does. Built here
  // rather than inside the hook branch so the two paths cannot drift on what
  // "the form key for this value" means.
  const selectForm = (c: { count?: Decimal; slot?: Slot }): string =>
    language.selectForm({
      ...(c.count !== undefined ? { count: c.count } : {}),
      kind: value.kind,
      unit: value.unit,
      slot: c.slot ?? "bare",
    });
  const renderQuantity = (parts: Omit<QuantityParts, "kind" | "unit">): string =>
    (language.renderQuantity ?? defaultRenderQuantity)({
      ...parts,
      kind: value.kind,
      unit: value.unit,
    });

  if (kind.format !== undefined) {
    return kind.format(value, {
      locale: locale.id,
      authored,
      ...opts,
      formatNumber: (v, o) => formatNumber(v, language, o ?? opts),
      selectForm,
      renderQuantity,
    });
  }

  // `rounding` belongs to the kind's own format hook, which received it on
  // `ctx` above — EngineOptions documents it as money formatting, and money is
  // the one place where a rounding mode decides something a user can see (the
  // cent). Handing it to the default path instead perturbs the 26th
  // significant digit of every kind: `1 km / 3` renders
  // 0.33333333333333333333333333 by default and ...334 under ROUND_UP, which
  // is guard-digit noise being promoted to a policy.
  const { rounding: _hookOnly, display, ...trim } = opts;
  // `display` runs here and only here: after `fromCanonical` has authored the
  // value and before the digits are grouped, so what it rounds is the number
  // the reader sees and never the one `Result.value` carries.
  const shown = applyDisplay(authored, display);
  const numberText = formatNumber(shown, language, trim);
  if (value.kind === NUMBER_KIND) return numberText;

  const words = wordsFor(registry, locale.id, value.kind, value.unit);
  // `formatValue` renders a finished Value with no expression around it, so
  // the slot is always "bare". `Printer` is what knows a real position — which
  // is why Ukrainian's case government after `in` is only correct through the
  // Printer, and saying so is cheaper than inventing a slot to guess with.
  const slot = "bare" as const;
  const key = selectForm({ count: shown, slot });
  const form = words?.forms?.[key];

  // `UnitWords.tight` is the word saying it is written against the number —
  // "50%", "20°C". Everything else takes a space, which is the reverse of
  // what this used to do: a unit with no `forms` fell through to its symbol and
  // `defaultRenderQuantity` glued it, so "100kph" and "120bpm" were the NORMAL
  // output and "1.5 kilograms" the exception. Reading a declared flag rather
  // than inferring one from the absence of a word is what makes "50 km/h" and
  // "5%" both right.
  //
  // Handed over as `gap` rather than as a new `QuantityParts` field: `gap` is
  // already "the separator the caller resolved", a language that assembles its
  // own quantity already honours it, and the alternative would be two ways to
  // say the same thing to the same renderer.
  //
  // Passed ONLY when the word asked to be glued. The spaced case is the
  // language's own default now (`defaultRenderQuantity` spaces all three
  // branches), and sending `" "` for it would overrule every language that
  // sets nothing off from a number — ja, zh and ko all read `p.gap ?? ""` and
  // would start printing "100 メートル".
  const glued = form === undefined && words?.symbol !== undefined && words.tight === true;

  return renderQuantity({
    number: numberText,
    ...(form !== undefined ? { form } : {}),
    ...(words?.symbol !== undefined ? { symbol: words.symbol } : {}),
    ...(glued ? { gap: "" } : {}),
    slot,
  });
}
