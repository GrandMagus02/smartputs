// `@smartput/core/eval` — turning a resolved `Program` into a `Value` (spec
// §6): `Evaluator` holds its config the way `Tokenizer` and `Parser` do,
// `evaluateNode` is the pure function underneath it, and `toCanonical` is the
// unit-conversion primitive both `Evaluator` and `Printer` share.

export { toCanonical } from "./eval/convert";
export type { EvalResult, EvaluateOptions } from "./eval/evaluate";
export { evaluateNode } from "./eval/evaluate";
export type { Evaluation, EvaluatorOptions } from "./eval/evaluator";
export { Evaluator } from "./eval/evaluator";
