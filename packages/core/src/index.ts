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
export { defineKind } from "./kind/define";
// Every built-in kind is exported by name, not only as an anonymous member of
// BUILTIN_KINDS. `measure` in particular has no other route: it is deliberately
// left out of BUILTIN_KINDS (its mm/cm aliases collide with `length`), so
// opting in by name is the only way to use it at all.
export {
  angle,
  area,
  BUILTIN_KINDS,
  datasize,
  duration,
  length,
  mass,
  measure,
  number,
  percent,
  speed,
  tempdelta,
  temperature,
  volume,
} from "./kinds/index";
export { createAnalyzerChain } from "./locale/analyze";
export { defineLocale, defineLocalePack } from "./locale/define";
export { identity, suffixStripper, tableAnalyzer } from "./locale/helpers";
// Explanation.tokens is Token[]; without this the type is unnameable downstream.
export type { Token } from "./parse/lex";
export type * from "./types";
