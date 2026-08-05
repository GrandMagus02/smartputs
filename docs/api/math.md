---
title: "@smartput/math"
description: LaTeX in, LaTeX out — evaluation, solving, systems, analysis, matrices, all with steps.
---

# @smartput/math

Symbolic math over LaTeX, with the working shown. Every entry point takes LaTeX
and answers in LaTeX, so results render through whatever already renders the
source.

```sh
bun add @smartput/math
```

| Subpath | Contents |
| --- | --- |
| `@smartput/math` | `createMathEngine`, `describeOperator`, `OPERATOR_WORDS`, `ruleForOperator`, `titleForRule`, the error classes, and the result types |

Runtime dependencies: `@cortex-js/compute-engine` and `@smartput/core` — the
first does the mathematics, the second supplies the error base class.

<SpMathEvaluate
  model-value="1+2\times3"
  :examples="['1+2\\times3', '\\frac{1}{2}+\\frac{1}{3}', '2^{10}', '(2+3)^2']" />

## createMathEngine()

```ts
function createMathEngine(): MathEngine
```

Each engine owns its compute engine, and with it the symbol table — bindings
handed to one `evaluate` call never reach another engine. Create one per
consumer; there is no shared module-level instance to leak state through.

```ts
import { createMathEngine } from "@smartput/math";

const math = createMathEngine();
```

## MathEngine

| Method | Returns |
| --- | --- |
| `evaluate(latex, options?)` | `EvaluateResult` — the value, exactly, innermost part first |
| `simplify(latex)` | `SimplifyResult` |
| `solve(latex, options?)` | `SolveResult` — every solution for one unknown |
| `solveSystem(input, options?)` | `SystemResult` — several equations together |
| `analyze(latex, options?)` | `AnalysisResult` — roots, turning points, derivatives, symmetry |
| `matrix(latex)` | `MatrixResult` — shape, determinant, trace, transpose, inverse |
| `differentiate(latex, options?)` | `SimplifyResult` |
| `integrate(latex, options?)` | `SimplifyResult` |
| `describe(latex)` | `string` — the expression in English |

### evaluate()

```ts
evaluate(latex: string, options?: EvaluateOptions): EvaluateResult

interface EvaluateOptions {
  bindings?: Readonly<Record<string, number | string>>;
  requireNumber?: boolean;
}

interface EvaluateResult {
  input: string;
  latex: string;          // exact: "\frac{5}{6}"
  approx: number | null;  // null when the result is symbolic
  steps: readonly Step[];
}
```

`bindings` are substituted before anything is computed, as their own step.
`requireNumber` turns a still-symbolic answer into `UnboundSymbolError` rather
than a result that looks like success.

### solve()

```ts
solve(latex: string, options?: { variable?: string }): SolveResult

interface SolveResult {
  input: string;
  variable: string;
  solutions: readonly string[];  // exact LaTeX, sorted; empty when there is none
  steps: readonly Step[];
}
```

The unknown is inferred when the equation has exactly one. With several, it
raises `MathSolveError` instead of guessing. A bare expression is read as
`= 0`.

<SpMathSolve :examples="['x^2-5x+6=0', '3x+2=11', 'ax+b=0', '\\sin(x)=1']" />

### solveSystem()

```ts
solveSystem(
  input: string | readonly string[],
  options?: { variables?: readonly string[] },
): SystemResult

interface SystemResult {
  input: string;
  equations: readonly string[];   // as they were read
  variables: readonly string[];
  consistent: boolean;            // false when the equations contradict
  solutions: Readonly<Record<string, string>> | null;
  steps: readonly Step[];
}
```

Accepts an array, a block of newline-separated equations, or a `cases`
environment. `variables` defaults to every symbol the equations mention, in the
order they first appear.

### analyze()

```ts
analyze(latex: string, options?: { variable?: string }): AnalysisResult

interface AnalysisResult {
  input: string;
  variable: string;
  latex: string;
  roots: readonly string[];         // on the real line
  complexRoots: readonly string[];  // the rest
  valueAtZero: string | null;       // null where undefined
  derivative: string;
  secondDerivative: string;
  turningPoints: readonly TurningPoint[];
  parity: "even" | "odd" | "neither";
  steps: readonly Step[];           // the working behind the roots
}

interface TurningPoint {
  at: string;
  value: string;
  kind: "minimum" | "maximum" | "inflection" | "unknown";
}
```

### matrix()

```ts
matrix(latex: string): MatrixResult

interface MatrixResult {
  input: string;
  latex: string;              // pmatrix form
  rows: number;
  columns: number;
  isSquare: boolean;
  determinant: string | null; // null when not square
  trace: string | null;       // null when not square
  transpose: string;
  inverse: string | null;     // null when singular or not square
  isSingular: boolean | null; // null when not square
}
```

Raises `NotAMatrixError` for an expression that is not one. Matrix arithmetic
goes through `evaluate` and comes back in `pmatrix` notation too.

### differentiate() / integrate()

```ts
differentiate(latex: string, options?: { variable?: string }): SimplifyResult
integrate(latex: string, options?: { variable?: string }): SimplifyResult

interface SimplifyResult {
  input: string;
  latex: string;
  steps: readonly Step[];
}
```

Integration rules load on the first `integrate` call, not at engine
construction.

## Step

```ts
interface Step {
  rule: StepRule;    // stable machine id
  title: string;     // English, for a UI with no translation of its own
  before: string;    // the whole expression before, as LaTeX
  after: string;     // and after
  detail?: string;   // the rewrite on its own: "2\times3=6"
}

type ArithmeticRule =
  | "add" | "subtract" | "multiply" | "divide" | "power" | "root"
  | "negate" | "differentiate" | "integrate" | "evaluate"
  | "substitute" | "simplify" | "expand" | "roots";

type StepRule = ArithmeticRule | (string & Record<never, never>);
```

The union is deliberately open. Arithmetic steps use the names above; algebraic
and calculus steps carry the compute engine's frozen rule ids — `solve.linear`,
`solve.quadratic-formula`, `derivative.power-rule` — which the library documents
as localisation keys, so they are passed through rather than re-declared here.

```ts
import { ruleForOperator, titleForRule } from "@smartput/math";

ruleForOperator("Power");   // "power"
titleForRule("power");      // "Raise to the power"
```

`titleForRule` answers for this package's own rules; steps that came from the
solver already carry their description in `title`.

## describe() and OPERATOR_WORDS

```ts
function describeOperator(symbol: string): string | null;
const OPERATOR_WORDS: Readonly<Record<string, string>>;
```

`OPERATOR_WORDS` is keyed by the notation as it is written — LaTeX (`\times`,
`\leq`) and the plain-text spellings people type for the same thing (`*`, `/`).
`describeOperator` returns `null` for a symbol with no word, rather than echoing
the symbol back as if it were one.

<SpMathSpeech />

## Errors

```
SmartputError            (@smartput/core)
└── MathError
    ├── MathParseError       LaTeX that cannot be read; `detail` lists why
    ├── MathSolveError       no such unknown, several unknowns, empty system
    ├── NotAMatrixError      a matrix operation on something that is not one
    └── UnboundSymbolError   a number was required, a symbol was left unbound
```

Extending core's `SmartputError` is what lets one `instanceof` guard catch input
problems from every package in this repo.

## Built on

[`@cortex-js/compute-engine`](https://cortexjs.io/compute-engine/) does the
mathematics: LaTeX parsing, exact arithmetic, simplification, equation and
system solving, derivatives, integrals, linear algebra — and the `explain()`
rule traces behind every algebraic step.

What this package adds is the LaTeX-in/LaTeX-out surface, the innermost-first
arithmetic trace (which `explain()` has no equivalent of), the `before`/`after`
framing on every step, matrix notation on results, the English descriptions, and
the error hierarchy the rest of the repo shares.
