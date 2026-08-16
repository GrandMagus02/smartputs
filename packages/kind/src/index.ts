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
//
// IMPORTANT — this barrel is the *arithmetic* tier, and it costs ~33 KB.
//
// `defineKind` needs `Decimal`, `Decimal` is decimal.js, and a barrel is one
// module: naming any export below links the whole library, whether or not the
// name you asked for has anything to do with numbers. There is no tree-shaking
// story that saves you, because the cost is not in the export you took — it is
// in the module the barrel had to load to offer it.
//
// So a consumer that only wants tables and words must NOT import from here. The
// subpaths exist for exactly this and are the supported way in:
//
//   @smartput/kind/aliases      RatioTable, aliasesFor        — no runtime deps
//   @smartput/kind/vocabulary   defineVocabulary              — 272 B
//   @smartput/kind/errors       the SmartputError hierarchy   — no runtime deps
//
// This is load-bearing, not advice. Every locale file in every kind package
// used to open with `import { aliasesFor, defineVocabulary } from
// "@smartput/kind"`, and every one of those 273 published entries — sixteen
// kind packages with a locale directory plus the `kinds` aggregator, seventeen
// languages each; `boolean` has no locales — shipped decimal.js to say that
// "kilometre" means `km`. Three packages ship vocabularies WITHOUT being kind
// packages — `datetime`, `rate` and `geo` — and a sweep phrased as "every kind
// package" walked past all thirty-five of their locale files. If you are adding
// a vocabulary anywhere, the rule is the subpaths above, not the package it
// happens to live in. One
// of them, `@smartput/length/locale/en`, is the row the harness watches: it
// measured 34_720 B for eight nouns. Rewriting those two names to the two
// subpaths above took the same entry to 1_519 B — a 22.9x drop bought entirely
// by which door was used, with not one line of the vocabulary changed.
//
// `scripts/check-size.ts` holds that row (`length/locale/en`) at a 1_550 B
// ceiling, tight enough that a single stray root import puts it back over by a
// factor of twenty-two. If you are adding a subpath here, keep it free of
// `./decimal` and say so in its header the way `./aliases.ts` does.
//
// The export list below is sorted by module path, not grouped by topic — biome
// enforces that — so the comments sit where the sort puts their line, and a
// pair that belongs together may end up several lines apart.

// The engine-side view of a kind package's `UnitTable`, half of it. The micro
// path reads the same table, so English aliases and ratios have exactly one
// source. `RatioTable` and `aliasesFor` moved to `./aliases` on 2026-08-16 —
// see that file's header — while `decimalRatios` stayed in `./from-table` with
// the `Decimal` it needs; both are named here, so this barrel's surface never
// changed.
export type { RatioTable } from "./aliases";
export { aliasesFor } from "./aliases";
export { Decimal } from "./decimal";
export type { NormalizedKind } from "./define";
export { defineKind, normalizeKind } from "./define";
export * from "./errors";
export { deepFreeze } from "./freeze";
// The other half of that view, and the reason the two halves are two modules:
// this one widens a table's ratio strings to `Decimal`.
export { decimalRatios } from "./from-table";
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
