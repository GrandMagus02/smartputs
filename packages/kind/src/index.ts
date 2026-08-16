// The contract a kind and a language are written in, and the machinery that
// reads one. Everything here was `@smartput/core`'s until the kinds were
// extracted into packages of their own and the edge was left running the wrong
// way: seventeen leaf packages named the engine to say what a kilometre is,
// which is a fact about metres and nothing to do with parsing a sentence.
//
// The split is by *layer*, not by size. Core is the pipeline — normalize,
// tokenize, parse, solve, eval, print — and this is what the pipeline agrees
// with a kind about beforehand. Core re-exports every name below unchanged, so
// nothing that imported them from `@smartput/core` has to stop.
export { Decimal } from "./decimal";
export type { NormalizedKind } from "./define";
export { defineKind, normalizeKind } from "./define";
export * from "./errors";
export { deepFreeze } from "./freeze";
// The engine-side view of a kind package's `UnitTable`: the micro path reads
// the same table, so English aliases and ratios have exactly one source.
export type { RatioTable } from "./from-table";
export { aliasesFor, decimalRatios } from "./from-table";
// The seam every extracted kind builds on: `deriveValue` for an op's result,
// and the three kind ids that name the kinds an arithmetic signature is
// allowed to mention without importing the package that defines them.
export {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  COMPARE_PRECISION,
  COMPARISON_OPS,
  deriveValue,
  generateComparisonOps,
  generateRatioOps,
  NUMBER_KIND,
  PERCENT_KIND,
} from "./ratio-ops";
export * from "./types";
export { defineVocabulary } from "./vocabulary";
