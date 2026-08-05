import {
  Decimal,
  DISPLAY_PRECISION,
  defineKind,
  type EvalCtx,
  type Kind,
  type Lexicon,
  MissingRateError,
  type UnitDef,
  type Value,
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

/**
 * Records the one assumption money makes: that a rate the snapshot does not
 * quote directly was derived by pivoting through the base currency. Every
 * signature that can see two currencies at once calls this — `in`, `+` and `-`
 * — because a derived rate is exactly as derived in `30 usd - 10 gbp` as it is
 * in `30 usd in gbp`, and spec §8 says cross-rates are never silent.
 *
 * One helper rather than three copies: `@smartput/rates` is the shape M4's
 * datetime and M5's colour packages will read, and a disclosure rule that lives
 * in three places is a disclosure rule that will be applied in two.
 *
 * The evaluator dedupes identical notes, so calling this once per operand pair
 * in a nested expression is harmless.
 */
function noteCross(ctx: EvalCtx, l: Value, r: Value): void {
  const base = ctx.rates?.base;
  const from = l.unit.toUpperCase();
  const to = r.unit.toUpperCase();
  if (base === undefined || from === to || from === base || to === base) return;
  ctx.note?.({
    code: "cross-rate",
    message: `${from} to ${to} was derived via ${base}`,
    detail: { from, to, via: base },
  });
}

const units: Record<string, UnitDef | number> = { [CANONICAL]: 1 };
const lexicon: Lexicon = {};
for (const [code, def] of Object.entries(CURRENCIES)) {
  if (code !== CANONICAL) units[code] = rateRatio(code);
  // The full lexeme shape core's own kinds carry (mass.ts is the reference):
  // aliases and symbol alone leave `display` — what completion inserts — and
  // `typical` — what its scaleFit scores — empty for every currency.
  lexicon[code] = {
    aliases: def.aliases,
    symbol: def.symbol,
    ...(def.display ? { display: def.display } : {}),
    typical: def.typical,
  };
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
        noteCross(ctx, l, r);
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
    // `30 usd - 10 gbp` derives USD/GBP through the euro exactly as
    // `30 usd in gbp` does, so it owes the user the same disclosure. Both
    // replace a generated signature whose apply is
    // `deriveValue(l, l.canonical.op(r.canonical))` — meta, kind and unit all
    // from `l`, the left operand whose currency the result keeps (spec §8).
    {
      op: "+",
      left: "money",
      right: "money",
      result: "money",
      apply: (l, r, ctx) => {
        noteCross(ctx, l, r);
        return Object.freeze({
          kind: l.kind,
          canonical: l.canonical.plus(r.canonical),
          unit: l.unit,
          ...(l.meta ? { meta: l.meta } : {}),
        });
      },
    },
    {
      op: "-",
      left: "money",
      right: "money",
      result: "money",
      apply: (l, r, ctx) => {
        noteCross(ctx, l, r);
        return Object.freeze({
          kind: l.kind,
          canonical: l.canonical.minus(r.canonical),
          unit: l.unit,
          ...(l.meta ? { meta: l.meta } : {}),
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
    //
    // The guard-digit trim has to happen BEFORE the mode is applied. For any
    // non-canonical currency `ctx.authored` is `fromCanonical(canonical, ...)`,
    // so the amount has passed through the rate twice and carries ±1ulp at the
    // 28th significant digit — "0.005 usd" comes back as
    // 0.005000000000000000000000000001. Feeding that to a half-even tie-break
    // decides the cent by round-trip noise whose direction varies with the
    // rate: $0.01 for one currency, €0.00 for the same nominal amount in
    // another. Trimming to the display precision first (the same two guard
    // digits `formatNumber` uses) restores the tie, so the rounding mode
    // decides it.
    const guarded = new Decimal(ctx.authored.toPrecision(DISPLAY_PRECISION));
    const rounded = new Decimal(guarded.toFixed(minorUnits, rounding));
    const symbol = def?.symbol ?? value.unit.toUpperCase();
    // Sign outside the symbol: every locale convention writes "-$10.00", never
    // "$-10.00". `isZero` guards the case where rounding a small negative to
    // the minor unit lands on zero — "-$0.00" would be worse than what it
    // replaces.
    const sign = rounded.isNegative() && !rounded.isZero() ? "-" : "";
    const digits = ctx.formatNumber(rounded.abs(), {
      precision: 34,
      minFractionDigits: minorUnits,
    });
    return `${sign}${symbol}${digits}`;
  },
});
