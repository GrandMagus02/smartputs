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
// The seam the extracted kind packages build on: every @smartput/<kind> package
// derives its values and names the number/percent kinds through these.
export { deriveValue, NUMBER_KIND, PERCENT_KIND } from "./kind/ratio-ops";
// The registry an engine is built on, exposed so a kind package can assert what
// its own units and aliases resolve to without standing up a whole engine —
// which is the only way to see an alias collision between two kinds at all.
export type { AliasEntry, Registry } from "./kind/registry";
export { buildRegistry } from "./kind/registry";
// The provider path's caching half, shared by every package that fetches a
// snapshot and rebuilds an engine from it — rates does, geo does (spec §8.1).
export type {
  CachedEngine,
  CachedEngineOptions,
  SnapshotCache,
  SnapshotCacheOptions,
} from "./live";
export { createCachedEngine, createSnapshotCache } from "./live";
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
// The score the ordinary number under a claimed span gets, which a matcher that
// claims bare digits has to weigh itself against: a postal code must sit below
// it to leave "90210" a number. Public for the same reason the completion
// constants above are — a plugin cannot pick a weight against a number it
// cannot name, and this file is the only path out of the package.
export { NUMBER_FALLBACK_WEIGHT } from "./parse/pratt";
export type * from "./types";
