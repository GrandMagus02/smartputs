// The operator words are a plain table: a keypad caption or a translation does
// not need a compute engine to reach them.
export { describeOperator, OPERATOR_WORDS } from "./describe/describe";
export type {
  CalculusOptions,
  DescribeOptions,
  EvaluateOptions,
  MathEngine,
  SimplifyResult,
  SolveOptions,
  SystemOptions,
} from "./engine";
export { createMathEngine } from "./engine";
export {
  MathError,
  MathParseError,
  MathSolveError,
  NotAMatrixError,
  UnboundSymbolError,
  WordParseError,
} from "./errors";
// Exported so a UI can translate a step: `rule` is the stable key, and
// `titleForRule` is the English fallback for a locale that has no string yet.
export { ruleForOperator, titleForRule } from "./steps/label";
export type {
  AnalysisResult,
  ArithmeticRule,
  Bindings,
  EvaluateResult,
  MathJson,
  MatrixResult,
  Parity,
  SolveResult,
  Step,
  StepRule,
  SystemResult,
  TurningPoint,
} from "./types";
// The way in for an expression that was spoken rather than written. It hands
// back LaTeX, so nothing downstream of it needs to know words exist.
export type { WordOptions } from "./words/words";
export { latexFromWords } from "./words/words";
