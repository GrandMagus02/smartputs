export type { CompleteOptions, Completion } from "./complete/complete";
export { complete } from "./complete/complete";
export { EXACT_BONUS, LENGTH_PENALTY, SCALE_BONUS } from "./complete/score";
export { Decimal } from "./decimal";
export type { Engine, EngineOptions, EvalOptions, Explanation, Result } from "./engine";
export { createEngine } from "./engine";
export * from "./errors";
export type {
  Quantity,
  QuantityClass,
  QuantityInput,
  QuantitySnapshot,
} from "./facade/index";
export { createFacade, createFacades } from "./facade/index";
export type { FormatOptions } from "./format/format";
export { DISPLAY_PRECISION, formatNumber, formatValue } from "./format/format";
export { defineKind } from "./kind/define";
// The engine-side view of a kind package's UnitTable: the micro path reads the
// same table, so English aliases and ratios have exactly one source.
export { aliasesFor, decimalRatios } from "./kind/from-table";
// The seam the extracted kind packages build on: every @smartput/<kind> package
// derives its values and names the number/percent kinds through these.
export { deriveValue, NUMBER_KIND, PERCENT_KIND } from "./kind/ratio-ops";
// The registry an engine is built on, exposed so a kind package can assert what
// its own units and aliases resolve to without standing up a whole engine —
// which is the only way to see an alias collision between two kinds at all.
export type { AliasEntry, Registry } from "./kind/registry";
export { buildRegistry } from "./kind/registry";
export { createAnalyzerChain } from "./locale/analyze";
export { defineLocale, defineLocalePack } from "./locale/define";
export {
  cardinalNumerals,
  identity,
  suffixStripper,
  tableAnalyzer,
} from "./locale/helpers";
// Explanation.tokens is Token[]; without this the type is unnameable downstream.
export type { Token } from "./parse/lex";
// Exported so a plugin author can drive a literal matcher in isolation, without
// standing up an engine just to see what their matcher claims.
export { foldLiterals } from "./parse/literals";
export type * from "./types";
