export type { CompleteOptions, Completion } from "./complete/complete";
export { complete } from "./complete/complete";
export type { AutocompleterOptions } from "./complete/completer";
export { Autocompleter } from "./complete/completer";
export { EXACT_BONUS, LENGTH_PENALTY, SCALE_BONUS } from "./complete/score";
export { Decimal } from "./decimal";
export type { Engine, EngineOptions, EvalOptions, Explanation, Result } from "./engine";
export { createEngine } from "./engine";
export * from "./errors";
export type { EvalResult, EvaluateOptions } from "./eval/evaluate";
export { evaluateNode } from "./eval/evaluate";
export type { Evaluation, EvaluatorOptions } from "./eval/evaluator";
export { Evaluator } from "./eval/evaluator";
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
export {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  COMPARE_PRECISION,
  COMPARISON_OPS,
  deriveValue,
  generateComparisonOps,
  NUMBER_KIND,
  PERCENT_KIND,
} from "./kind/ratio-ops";
// The registry an engine is built on, exposed so a kind package can assert what
// its own units and aliases resolve to without standing up a whole engine —
// which is the only way to see an alias collision between two kinds at all.
export type { AliasEntry, CueEntry, Registry } from "./kind/registry";
export { buildRegistry, wordsFor } from "./kind/registry";
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
export { buildKeywords, composeLocale } from "./locale/compose";
export { defineLanguage } from "./locale/define";
export type { CardinalTables, ScriptSegmenterOptions } from "./locale/helpers";
// Everything a language author assembles a `Language` out of. `scriptSegmenter`
// produces a `Language.segment` rather than an `Analyzer`, and is here for the
// same reason it is in `helpers.ts`: it is reached for in the same breath.
export {
  cardinalNumerals,
  cardinalSpeller,
  compoundSplitter,
  identity,
  phraseAnalyzer,
  prefixStripper,
  scriptSegmenter,
  suffixStripper,
  tableAnalyzer,
} from "./locale/helpers";
export { defineVocabulary } from "./locale/vocabulary";
export type { Node, NodeId } from "./parse/ast";
export { walk } from "./parse/ast";
// One edit distance for the whole repo. A package that reads through a typo —
// math's spoken words, completion's fragments — measures the slip the same way
// the error hints do, because two implementations of "how near is this" drift
// apart and the one that drifts is the one nobody is looking at.
export { EDIT_HEADROOM, editDistance, nearestWord } from "./parse/distance";
// Explanation.tokens is Token[]; without this the type is unnameable downstream.
export type { Token } from "./parse/lex";
// Exported so a plugin author can drive a literal matcher in isolation, without
// standing up an engine just to see what their matcher claims.
export { foldLiterals } from "./parse/literals";
export type {
  Edit,
  EditReason,
  NormalizedInput,
  NormalizerOptions,
} from "./parse/normalize";
export { Normalizer, normalize } from "./parse/normalize";
// The score the ordinary number under a claimed span gets, which a matcher that
// claims bare digits has to weigh itself against: a postal code must sit below
// it to leave "90210" a number. Public for the same reason the completion
// constants above are — a plugin cannot pick a weight against a number it
// cannot name, and this file is the only path out of the package.
export { NUMBER_FALLBACK_WEIGHT } from "./parse/pratt";
export type { ParserOptions, Program } from "./parse/program";
export { buildProgram, Parser } from "./parse/program";
export type { TokenizerOptions, TokenStream } from "./parse/tokenizer";
export { Tokenizer } from "./parse/tokenizer";
// `formatValue`/`formatNumber`/`DISPLAY_PRECISION` stay exported above from
// `./format/format`, their one home; `print/print.ts` only re-exports them
// for a caller reaching through the `@smartput/core/print` subpath.
export type { PrinterOptions, PrintMode, PrintOptions } from "./print/print";
export { Printer } from "./print/print";
export type { Resolution } from "./solve/solver";
export { solve } from "./solve/solver";
export type { SolverOptions } from "./solve/solver-class";
export { Solver } from "./solve/solver-class";
export type * from "./types";
