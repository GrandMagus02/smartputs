import { Decimal, type RateLookup } from "@smartput/core";

/**
 * A dated, immutable rate table. Satisfies core's `RateLookup` structurally, so
 * neither package imports the other's implementation.
 *
 * Everything derives from one table of quotes per unit of `base`, which is the
 * shape every provider returns. A cross rate is then just a division, and it is
 * the caller's kind — not this table — that decides whether to record that as
 * an assumption.
 */
export interface RateSnapshot extends RateLookup {}

export function snapshot(
  base: string,
  asOf: string,
  table: Record<string, number | string>,
): RateSnapshot {
  const baseCode = base.toUpperCase();
  const quotes = new Map<string, Decimal>([[baseCode, new Decimal(1)]]);
  for (const [code, quote] of Object.entries(table)) {
    quotes.set(code.toUpperCase(), new Decimal(quote));
  }

  return Object.freeze({
    base: baseCode,
    asOf,
    get(from: string, to: string): Decimal | null {
      const a = quotes.get(from.toUpperCase());
      const b = quotes.get(to.toUpperCase());
      if (a === undefined || b === undefined) return null;
      // Both are quoted per unit of base, so the base cancels.
      return b.div(a);
    },
  });
}
