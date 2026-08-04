import {
  Decimal,
  defineKind,
  type FormatCtx,
  type Kind,
  type Lexicon,
  MissingRateError,
  type UnitDef,
} from "@smartput/core";
import { CURRENCIES } from "./currencies";

const CANONICAL = "eur";

/**
 * One currency's ratio to the canonical euro, resolved from the injected
 * snapshot at conversion time rather than baked into the descriptor. This is
 * the whole reason `ratio` may be a function.
 */
function rateRatio(code: string): UnitDef {
  const upper = code.toUpperCase();
  return {
    ratio: (ctx) => {
      const rates = ctx.rates;
      if (rates === undefined) {
        throw new MissingRateError(ctx.input ?? "", upper, "EUR", "");
      }
      const rate = rates.get(upper, "EUR");
      if (rate === null) {
        throw new MissingRateError(ctx.input ?? "", upper, "EUR", rates.asOf);
      }
      return rate;
    },
  };
}

const units: Record<string, UnitDef | number> = { [CANONICAL]: 1 };
const lexicon: Lexicon = {};
for (const [code, def] of Object.entries(CURRENCIES)) {
  if (code !== CANONICAL) units[code] = rateRatio(code);
  lexicon[code] = { aliases: def.aliases, symbol: def.symbol };
}

/**
 * The locale's own decimal separator, asked of `formatNumber` rather than
 * hardcoded — a per-kind hook that assumed "." is exactly what M2 rejected.
 * "1.5" is a probe value guaranteed to survive `formatNumber`'s significant-
 * digit rounding (its fractional digit is non-zero, so it is never dropped as
 * a Decimal is reconstructed), so the character between its two digits is
 * whatever this locale uses to separate them.
 */
function decimalSeparator(ctx: FormatCtx): string {
  return ctx.formatNumber(new Decimal("1.5")).slice(1, -1);
}

/**
 * Canonical euro, because ECB's daily reference file quotes against it.
 *
 * Rounding happens here and nowhere else: the AST carries full Decimal
 * precision, so `(1 usd / 3) * 3` is a dollar rather than 99 cents.
 */
export const money: Kind = defineKind({
  id: "money",
  value: { mode: "ratio", canonical: CANONICAL, units },
  lexicon,
  ops: [
    {
      // Replaces the generated `in|money|money`. Same arithmetic — the
      // conversion itself is done by toCanonical/fromCanonical around this —
      // but it is the one place that sees both currencies, so it is the only
      // place that can tell a directly quoted rate from a derived one.
      op: "in",
      left: "money",
      right: "money",
      result: "money",
      apply: (l, r, ctx) => {
        const base = ctx.rates?.base;
        const from = l.unit.toUpperCase();
        const to = r.unit.toUpperCase();
        if (base !== undefined && from !== to && from !== base && to !== base) {
          ctx.note?.({
            code: "cross-rate",
            message: `${from} to ${to} was derived via ${base}`,
            detail: { from, to, via: base },
          });
        }
        // Same shape the generated signature produces, meta included — M2's
        // review found six hand-written applies that silently dropped it.
        return Object.freeze({
          kind: r.kind,
          canonical: l.canonical,
          unit: r.unit,
          ...(l.meta ? { meta: l.meta } : {}),
        });
      },
    },
  ],
  format: (value, ctx) => {
    const def = CURRENCIES[value.unit];
    const minorUnits = def?.minorUnits ?? 2;
    const rounding = ctx.rounding ?? Decimal.ROUND_HALF_EVEN;
    // ctx.authored is already in this currency; the only job left is to round
    // to its minor units and render through the locale-aware formatter.
    //
    // `toFixed(minorUnits, …)`, not `formatNumber`'s `precision` option, is
    // what supplies the padded fractional digits: a Decimal has no notion of
    // a "trailing zero" once constructed (`new Decimal("30.00")` is just 30),
    // so routing a rounded-to-zero-cents amount back through formatNumber's
    // significant-digit machinery silently loses the ".00" — $30.00 comes
    // back as "$30". Only the integer part is safe to reconstruct as a
    // Decimal and hand to formatNumber, for its locale-aware grouping; the
    // fractional digits are taken verbatim from the fixed-point string.
    const fixed = ctx.authored.toFixed(minorUnits, rounding);
    const negative = fixed.startsWith("-");
    const body = negative ? fixed.slice(1) : fixed;
    const dot = body.indexOf(".");
    const intPart = dot === -1 ? body : body.slice(0, dot);
    const fracPart = dot === -1 ? "" : body.slice(dot + 1);
    const groupedInt = ctx.formatNumber(new Decimal(intPart), { precision: 34 });
    const sep = fracPart === "" ? "" : decimalSeparator(ctx);
    const symbol = def?.symbol ?? value.unit.toUpperCase();
    return `${symbol}${negative ? "-" : ""}${groupedInt}${sep}${fracPart}`;
  },
});
