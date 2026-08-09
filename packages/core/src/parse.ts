// `@smartput/core/parse` — the tree stage alone (spec §6): `Parser` builds a
// `Program` out of a `TokenStream` and a `Resolver` (`@smartput/core/registry`
// constructs one), without pulling in the solver or evaluator.
export type { Node, NodeId } from "./parse/ast";
export { walk } from "./parse/ast";
export type { ParserOptions, Program } from "./parse/program";
export { Parser } from "./parse/program";
