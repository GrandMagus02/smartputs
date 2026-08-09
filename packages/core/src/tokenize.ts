// `@smartput/core/tokenize` — lexing plus the three fold passes (spec §6).
// The underlying functions travel with the class, per `Tokenizer`'s own
// docstring: a caller who wants numerals folded but not word operators
// composes `lex`, `foldLiterals`, `foldNumerals` and `foldWordOps` directly,
// without paying for the parser, solver, evaluator or registry.
export type { Token } from "./parse/lex";
export { lex } from "./parse/lex";
export { foldLiterals } from "./parse/literals";
export { foldNumerals } from "./parse/numerals";
export type { TokenizerOptions, TokenStream } from "./parse/tokenizer";
export { Tokenizer } from "./parse/tokenizer";
export { foldWordOps } from "./parse/wordops";
