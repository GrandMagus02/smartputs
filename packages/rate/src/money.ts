import {
  Decimal,
  DISPLAY_PRECISION,
  defineKind,
  type EvalCtx,
  type Kind,
  MissingRateError,
  SmartputError,
  type UnitDef,
  type Value,
} from "@smartput/core";
import { CURRENCIES, formatAmount } from "@smartput/currency";
import type { MoneyContext } from "@smartput/kind/contracts";

const CANONICAL = "eur";

/**
 * The table this package converts by, from wherever the engine was configured
 * with it — §G. `context.money` is the API; `ctx.rates` is the field it
 * deprecates, kept as the fallback for its release. Both are read here rather
 * than reconciled at the call sites, so the two spellings cannot answer
 * differently in a ratio and in a signature.
 *
 * No `rounding` twin: that one is read by the `format` hook off a `FormatCtx`,
 * which core builds from its own options and never from a context slot.
 */
function ratesOf(ctx: EvalCtx) {
  return (ctx.context?.money as MoneyContext | undefined)?.rates ?? ctx.rates;
}

/**
 * One currency's ratio to the canonical euro, resolved from the injected
 * snapshot at conversion time rather than baked into the descriptor. This is
 * the whole reason `ratio` may be a function.
 */
function rateRatio(code: string): UnitDef {
  const upper = code.toUpperCase();
  return {
    ratio: (ctx) => {
      const rates = ratesOf(ctx);
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
 * One helper rather than three copies: `@smartput/rate` is the shape M4's
 * datetime and M5's colour packages will read, and a disclosure rule that lives
 * in three places is a disclosure rule that will be applied in two.
 *
 * The evaluator dedupes identical notes, so calling this once per operand pair
 * in a nested expression is harmless.
 */
function noteCross(ctx: EvalCtx, l: Value, r: Value): void {
  const base = ratesOf(ctx)?.base;
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
for (const code of Object.keys(CURRENCIES)) {
  if (code !== CANONICAL) units[code] = rateRatio(code);
}

/**
 * The magnitude band people actually type each currency in, read only by
 * completion's `scaleFit`. Economics, not language (ruling R3): 30 of
 * something is an ordinary dollar amount and an implausibly small yen one, and
 * that stays true in every language, so it belongs on the kind rather than in
 * a vocabulary. `@smartput/currency`'s table is still where it is written
 * down — the same rows `currencyVocabulary` reads the words from.
 */
const typical: Record<string, [number, number]> = {};
for (const [code, def] of Object.entries(CURRENCIES)) typical[code] = def.typical;

/**
 * Canonical euro, because ECB's daily reference file quotes against it.
 *
 * The descriptor names no language: its units are ISO 4217 codes and its
 * ratios are functions of a snapshot. Every English word money can be typed
 * with — "dollars", "quid", "€" — lives in `@smartput/rate/locale/en`, and an
 * engine that wants to read them composes it:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(english, [moneyEn])], kinds: [money] });
 * ```
 *
 * Without it the codes still parse (the registry indexes every unit under its
 * own key), and `$30.00` still prints, because the `format` hook below renders
 * from `@smartput/currency`'s table rather than from a vocabulary.
 *
 * Rounding happens here and nowhere else: the AST carries full Decimal
 * precision, so `(1 usd / 3) * 3` is a dollar rather than 99 cents.
 */
export const money: Kind = defineKind({
  id: "money",
  value: { mode: "ratio", canonical: CANONICAL, units },
  typical,
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
    {
      // The bridge to `@smartput/country`, declared here and importing nothing:
      // geo puts an ISO 4217 code on `meta.currency` (core's `PlaceMeta`, the
      // same reason `RateLookup` lives there), so rates reads a string and
      // gains no dependency in either direction.
      //
      // Naming a kind that may not exist is safe because registry pass 4
      // (core's `kind/registry.ts`) keys the op table without checking that
      // `left` and `right` are registered: with geo absent the solver can
      // never produce a `place` operand, so this entry is unreachable rather
      // than a build error. Pass 4 *does* refuse a second claimant of the same
      // key, which is why the bridge lives on money and not on place.
      op: "in",
      left: "money",
      right: "place",
      result: "money",
      apply: (l, r, ctx) => {
        const currency = r.meta?.currency;
        if (typeof currency !== "string" || currency === "") {
          // Not DimensionMismatchError: the evaluator already raises exactly
          // that for an absent signature, so this would be indistinguishable
          // from "geo is not registered" — which is the one thing this
          // signature exists to make distinguishable.
          throw new SmartputError(
            `Place ${JSON.stringify(r.unit)} carries no currency`,
            ctx.input ?? "",
          );
        }
        const unit = currency.toLowerCase();
        // CURRENCIES is the ECB file's coverage, not all of ISO 4217, and its
        // own header says a code with no rate behind it can only ever raise
        // MissingRateError. Raising it here rather than letting `fromCanonical`
        // reject an unregistered unit keeps that promise: the alternative is a
        // bare `Error("Unknown unit vnd")` from core, thrown at format time.
        if (CURRENCIES[unit] === undefined) {
          throw new MissingRateError(
            ctx.input ?? "",
            currency.toUpperCase(),
            CANONICAL.toUpperCase(),
            ratesOf(ctx)?.asOf ?? "",
          );
        }
        // Deliberately no meta. `in|money|money` sources it from the target
        // currency's Value; here the target is a country, and its geonameId,
        // zone and population describe a place, not an amount of money.
        const converted: Value = { kind: l.kind, canonical: l.canonical, unit };
        // Against the converted amount, not against `r`: the place's unit is a
        // country code, and what was derived through the euro is USD to JPY.
        noteCross(ctx, l, converted);
        return Object.freeze(converted);
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
    // The guard-digit trim is this package's and stays here, because it is
    // repairing damage a *rate* did. For any non-canonical currency
    // `ctx.authored` is `fromCanonical(canonical, ...)`, so the amount has
    // passed through the rate twice and carries ±1ulp at the 28th significant
    // digit — "0.005 usd" comes back as 0.005000000000000000000000000001.
    // Feeding that to a half-even tie-break decides the cent by round-trip
    // noise whose direction varies with the rate: $0.01 for one currency,
    // €0.00 for the same nominal amount in another. Trimming to the display
    // precision first (the same two guard digits `formatNumber` uses) restores
    // the tie, so the rounding mode decides it — and it has to happen before
    // the mode is applied, which is why it is not inside `formatAmount`.
    //
    // Everything after it — the minor-unit scale, the symbol, the sign, the
    // padding that puts the ".00" back — is a fact about the currency and
    // belongs to `@smartput/currency`. An amount that was never converted has
    // no noise to trim, and that caller gets the same digits from
    // `formatAmount` alone.
    const guarded = new Decimal(ctx.authored.toPrecision(DISPLAY_PRECISION));
    return formatAmount(guarded, value.unit, {
      ...(ctx.rounding !== undefined ? { rounding: ctx.rounding } : {}),
      formatNumber: ctx.formatNumber,
    });
  },
});
