import type { Decimal } from "@smartput/core";
import { CURRENCIES, type CurrencyDef } from "./currencies";
import { type FormatAmountOptions, formatAmount } from "./format";
import {
  type AmountOptions,
  type ParsedInput,
  parseAmount,
  parseCurrency,
} from "./parse";

/**
 * One currency, as something you can hold.
 *
 * ```ts
 * const usd = Currency.for("dollars");
 * usd?.format(new Decimal("30"));   // "$30.00"
 * usd?.parse("30 usd");             // { ok: true, amount: 30, currency: "usd" }
 * Currency.for("xyz");              // null — not a currency this table holds
 * ```
 *
 * The door, in the sense the rest of this repo uses the word: the functions
 * underneath take a code as a string and are reachable when you want them, and
 * this is what you reach for when you have a currency rather than a string.
 *
 * Frozen, with no public constructor and one instance per code, so two lookups
 * of `usd` are the same object and `===` means what it looks like it means.
 * `for` refuses rather than inventing: a `Currency` for a code with no row is a
 * currency with no symbol and no scale, which is a worse thing to hand a caller
 * than `null`.
 *
 * There is no `convert` and there will not be one here. That needs a rate, a
 * rate needs a date, and both live in `@smartput/rate`.
 */
export class Currency {
  /** Lowercase ISO 4217. */
  readonly code: string;
  /** `"$"`, `"€"`, `"CHF"` — what `format` puts in front of the digits. */
  readonly symbol: string;
  /** Decimal places this currency is written at. JPY has none. */
  readonly minorUnits: number;
  /** Every word that resolves to this currency, the ISO code among them. */
  readonly aliases: readonly string[];

  private constructor(code: string, def: CurrencyDef) {
    this.code = code;
    this.symbol = def.symbol;
    this.minorUnits = def.minorUnits;
    this.aliases = Object.freeze([...def.aliases]);
    Object.freeze(this);
  }

  /** Every currency the shipped table carries, in table order. */
  static all(): readonly Currency[] {
    return Object.keys(CURRENCIES)
      .map((code) => Currency.for(code))
      .filter((c): c is Currency => c !== null);
  }

  /**
   * By ISO code or by any word that names one — `"usd"`, `"USD"`, `"dollars"`.
   * `null` when the word names no currency in this table.
   */
  static for(word: string): Currency | null {
    const code = parseCurrency(word);
    if (code === null) return null;
    const held = instances.get(code);
    if (held !== undefined) return held;
    const def = CURRENCIES[code] as CurrencyDef;
    const made = new Currency(code, def);
    instances.set(code, made);
    return made;
  }

  /** `"30 usd"` and friends, refused when the currency named is not this one. */
  parse(input: string, opts?: AmountOptions): ParsedInput {
    const parsed = parseAmount(input, opts);
    if (!parsed.ok) return parsed;
    if (parsed.currency !== this.code) {
      return { ok: false, code: "unknown-currency", input };
    }
    return parsed;
  }

  /** `-$10.00`, `¥1200`. See `formatAmount` for what each step is for. */
  format(amount: Decimal, opts?: FormatAmountOptions): string {
    return formatAmount(amount, this.code, opts);
  }
}

/** Keyed by code so `for("usd")` and `for("dollars")` share one instance. */
const instances = new Map<string, Currency>();
