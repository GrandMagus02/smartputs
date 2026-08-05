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
| `@smartput/math` | `createMathEngine`, `latexFromWords`, `describeOperator`, `OPERATOR_WORDS`, `ruleForOperator`, `titleForRule`, the error classes, and the result types |

Runtime dependencies: `@cortex-js/compute-engine`, `@smartput/core` and
`@smartput/number` — the first does the mathematics, the second supplies the
error base class, the third the number vocabulary the word layer reads and
spells.

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
| `describe(latex, options?)` | `string` — the expression in English |

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

## latexFromWords()

```ts
function latexFromWords(words: string, options?: WordOptions): string

interface WordOptions {
  fuzzy?: boolean;  // default false
}
```

Reads an expression said in English into LaTeX. It needs no engine, and hands
back ordinary notation, so everything above it stays LaTeX-only.

```ts
latexFromWords("one plus two power three");             // "1+2^3"
latexFromWords("one plus two in brackets power three"); // "(1+2)^3"
latexFromWords("x plus one all squared");               // "(x+1)^2"
latexFromWords("the quantity two plus three, squared"); // "(2+3)^2"
```

A bracket may be marked after what it holds (`in brackets`, `all`) or before it
(`the quantity`, closed by a comma; `open bracket` … `close bracket`). Marked
after, it groups everything said since the last bracket opened — which is what
a person marking a bracket after the fact means by it.

Each operator answers to every ordinary spelling of it: `power`, `to the
power`, `to the power of`, `raised to`; `divided by` and `over`; `equals`, `is
equal to`. Numbers arrive as digits or as words in the same sentence
(`twenty-two plus one hundred and five`, `three point five`), and `two x` is a
product.

Precedence is the precedence the symbols have. A power binds tighter than the
arithmetic around it, and a function binds to its operand rather than to the
sentence — `the sine of x plus one` is `\sin(x)+1`, with `the sine of the
quantity x plus one` available for the other reading.

A word it does not know raises `WordParseError`, whose `word` is the one it
stopped at, for a UI that wants to underline it.

### fuzzy

Mends a misspelled word into the closest one the vocabulary has — operators,
phrase words and number words alike.

```ts
latexFromWords("one plsu two", { fuzzy: true });   // "1+2"
latexFromWords("twnty plus on", { fuzzy: true });  // "20+1"
latexFromWords("thre point five", { fuzzy: true }); // "3.5"
```

Off by default: a correction that guesses wrong still returns a number, and a
number is not something a caller checks.

| Rule | Why |
| --- | --- |
| A single letter is never corrected | Every one of them is already a symbol |
| One edit up to four letters, two beyond | Two edits into a short word reach half the vocabulary |
| A letter left out < swapped < typed twice < typed wrong | Ordered by how often each slip actually happens |
| Two words equally near ⇒ `WordParseError` | `si` is a letter short of both `sin` and `six` |

The last two together are what make `sne` the sine rather than one, and `thre`
three rather than the: both are ties by edit count, and only the ordering of
slips separates them.

## describe() and OPERATOR_WORDS

```ts
describe(latex: string, options?: DescribeOptions): string

interface DescribeOptions {
  style?: "long" | "short";      // default "long"
  numbers?: "digits" | "words";  // default "digits"
}

function describeOperator(symbol: string): string | null;
const OPERATOR_WORDS: Readonly<Record<string, string>>;
```

`OPERATOR_WORDS` is keyed by the notation as it is written — LaTeX (`\times`,
`\leq`) and the plain-text spellings people type for the same thing (`*`, `/`).
`describeOperator` returns `null` for a symbol with no word, rather than echoing
the symbol back as if it were one.

The options follow `Intl`: what varies is named, and each default is what the
reading was before the option existed.

| `(2+3)^2` read | Result |
| --- | --- |
| `{}` | `the quantity 2 plus 3, squared` |
| `{ style: "short" }` | `2 plus 3 in brackets squared` |
| `{ numbers: "words" }` | `the quantity two plus three, squared` |
| `{ style: "short", numbers: "words" }` | `two plus three in brackets squared` |

`"short"` is the caption reading: no articles, no "of" after a function name,
no copula in a relation (`x less than 3`), and a bracket marked after what it
holds. `numbers: "words"` spells numbers out; one too large for the scale words
keeps its digits.

The vocabulary is the one `latexFromWords` reads, so an ordinary description —
no matrices, no operator the table has no phrasing for — returns to the
expression it came from:

```ts
latexFromWords(math.describe("(2+3)^2")); // "(2+3)^2"
```

<SpMathSpeech />

## Errors

```
SmartputError            (@smartput/core)
└── MathError
    ├── MathParseError       LaTeX that cannot be read; `detail` lists why
    ├── WordParseError       words that cannot be read; `word` is where it stopped
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
