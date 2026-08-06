/**
 * `@smartput/currency` — what a currency is, without what it is worth.
 *
 * The table, the vocabulary, the parser and the formatter. Everything here
 * answers a question about a currency; nothing here answers a question about a
 * rate, and the split is exactly that line: `@smartput/rate` holds the `money`
 * kind, the snapshots and the providers, and depends on this package for the
 * half of money that a date cannot change.
 *
 * Three doors. `.` is this one — the table and the lexicon a kind is built out
 * of. `./validate` is the engine-free parser and formatter. `./class` is
 * `Currency`, which is both of those with a code already in hand.
 */
export { Currency } from "./class";
export type { CurrencyDef } from "./currencies";
export { CURRENCIES, minorUnitsOf, symbolOf } from "./currencies";
export type { FormatAmountOptions, NumberFormatter } from "./format";
export { formatAmount } from "./format";
export { currencyLexicon } from "./lexicon";
export type {
  AmountError,
  AmountFailure,
  AmountOptions,
  ParsedAmount,
  ParsedInput,
} from "./parse";
export { isCurrency, parseAmount, parseCurrency } from "./parse";
