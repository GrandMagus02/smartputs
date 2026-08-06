/**
 * `@smartput/currency/validate` — currency recognition with no engine in the
 * graph, the subpath every ratio kind ships and `money` could not.
 *
 * `@smartput/rate` is exempt from the micro path because money's ratios are a
 * live rate table (spec §3), and that exemption is right about *conversion* and
 * wrong about everything else: which currency a word names, how much `"30 usd"`
 * is, and how to write it back are all answerable without a rate, a date or a
 * registry. This is that half, and it costs a form field none of the engine.
 *
 * What is deliberately absent is `convert`. See `Currency`.
 */

// `minorUnitsOf` and `symbolOf` and not `formatAmount`: rendering an exact
// amount needs a `Decimal`, core sets its precision in a module-load side
// effect, and a side effect is the one thing a bundler may not drop — so a
// `formatAmount` re-exported here would put 35 KB behind `parseAmount`. These
// two are the facts you need to render it yourself, and `@smartput/currency`
// proper has the function when you already hold a Decimal.
export { minorUnitsOf, symbolOf } from "./currencies";
export type {
  AmountError,
  AmountFailure,
  AmountOptions,
  ParsedAmount,
  ParsedInput,
} from "./parse";
export { isCurrency, parseAmount, parseCurrency } from "./parse";
