import {
  Decimal,
  defineKind,
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
        // The generated `in|money|money` this replaces is
        // `deriveValue(r, l.canonical)`, which sources meta from `r` (the
        // target currency), not `l` — so this does too.
        return Object.freeze({
          kind: r.kind,
          canonical: l.canonical,
          unit: r.unit,
          ...(r.meta ? { meta: r.meta } : {}),
        });
      },
    },
  ],
  format: (value, ctx) => {
    const def = CURRENCIES[value.unit];
    const minorUnits = def?.minorUnits ?? 2;
    const rounding = ctx.rounding ?? Decimal.ROUND_HALF_EVEN;
    // Two steps, each doing a job the other can't: `toFixed(minorUnits, …)`
    // applies the rounding mode at the minor-unit scale (cents, not guard
    // digits), but a Decimal has no notion of a trailing zero, so
    // `new Decimal("30.00")` is just 30 again — the ".00" is gone the moment
    // it's reconstructed. `minFractionDigits` on the formatNumber call below
    // is what restores it, padding back up to the minor-unit scale, using the
    // locale's own decimal symbol rather than a hand-rolled one.
    const rounded = new Decimal(ctx.authored.toFixed(minorUnits, rounding));
    const symbol = def?.symbol ?? value.unit.toUpperCase();
    return `${symbol}${ctx.formatNumber(rounded, { precision: 34, minFractionDigits: minorUnits })}`;
  },
});
