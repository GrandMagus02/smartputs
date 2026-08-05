# @smartput/math

Symbolic math over LaTeX — the notation markdown files write between `$…$` —
with the working shown. LaTeX in, LaTeX out, plus a list of the steps that got
from one to the other.

```ts
import { createMathEngine } from "@smartput/math";

const math = createMathEngine();

math.evaluate("\\frac{1}{2}+\\frac{1}{3}");
// { latex: "\\frac{5}{6}", approx: 0.8333…, steps: [ … ] }

math.solve("x^2-5x+6=0");
// { variable: "x", solutions: ["2", "3"], steps: [ … ] }
```

## What it does

| Method                       | Answers                                       |
| ---------------------------- | --------------------------------------------- |
| `evaluate(latex, options?)`  | The value, exactly, innermost part first       |
| `simplify(latex)`            | The simplified expression                      |
| `solve(latex, options?)`     | Every solution for one unknown                 |
| `solveSystem(input, o?)`     | Several equations solved together              |
| `analyze(latex, o?)`         | Roots, turning points, derivatives, symmetry   |
| `matrix(latex)`              | Shape, determinant, trace, transpose, inverse  |
| `differentiate(latex, o?)`   | The derivative                                 |
| `integrate(latex, o?)`       | The antiderivative                             |
| `describe(latex)`            | The expression read out in English             |

Arithmetic is exact: `\frac{1}{2}+\frac{1}{3}` is `\frac{5}{6}`, not `0.8333`.
`approx` carries the decimal when one is wanted, and is `null` when the result
is symbolic.

`evaluate` takes `bindings` for free symbols, and `requireNumber` to turn a
still-symbolic answer into an `UnboundSymbolError` rather than a result that
looks like success:

```ts
math.evaluate("x^2+1", { bindings: { x: 3 } }); // 10, via a "3^2+1" step
math.evaluate("2x+1", { requireNumber: true }); // throws UnboundSymbolError
```

`solve` infers the unknown when there is exactly one, and refuses to guess
between several — pass `{ variable }` for those.

## Functions

`analyze` answers the questions a reader asks about a curve, all at once:

```ts
math.analyze("x^3-3x");
// roots:            ["-1.732…", "0", "1.732…"]
// derivative:       "3x^2-3"
// secondDerivative: "6x"
// turningPoints:    [ { at: "-1", value: "2",  kind: "maximum" },
//                     { at: "1",  value: "-2", kind: "minimum" } ]
// parity:           "odd"
// valueAtZero:      "0"
// steps:            the working behind the roots
```

Roots off the real line are kept separately in `complexRoots`, so `x^2+1` has
no roots and still reports the two it has over the complex numbers. A question
that does not apply is null or empty rather than an error — `\frac{1}{x}` has
no value at zero.

Roots are exact where the solver has an exact method — every linear and
quadratic, and the cubics it can factor. Past that it falls back to numerical
roots, so a cubic can answer `1.732…` where `\sqrt{3}` was hoped for.

## Systems

`solveSystem` takes a list, a block of lines, or a `cases` environment — all
three are the same system, and which one you have depends on where you copied
it from.

```ts
math.solveSystem("x+y=2\nx-y=0");
// { consistent: true, solutions: { x: "1", y: "1" }, variables: ["x", "y"], steps: [ … ] }

math.solveSystem(["x+y=2", "x+3=4", "y+1=8"]);
// { consistent: false, solutions: null, … }
```

A contradiction is an answer, not a failure: `consistent` goes false and
`solutions` is null, with the elimination that got there still in `steps`.

## Matrices

```ts
math.matrix("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}");
// rows 2, columns 2, isSquare true, determinant "-2", trace "5",
// transpose and inverse as \begin{pmatrix}… LaTeX, isSingular false
```

Everything is exact — the inverse holds `\frac{3}{2}`, not `1.5` — and results
come back in `pmatrix` notation rather than as nested lists. A singular matrix
reports `inverse: null` instead of echoing the request back. Matrix arithmetic
goes through `evaluate` and comes back as a matrix too.

## Reading it out

`describe` turns an expression into English, and `OPERATOR_WORDS` is the plain
symbol-to-word table behind it — no engine needed to read it:

```ts
math.describe("(2+3)^2"); // "the quantity 2 plus 3, squared"
describeOperator("^"); // "power"
describeOperator("+"); // "plus"
OPERATOR_WORDS["\\leq"]; // "less than or equal to"
```

## Steps

Every result carries `steps`, each with:

- `rule` — the stable machine id, for branching or translating
- `title` — English, for a UI with no translation of its own
- `before` / `after` — the whole expression either side of the step, as LaTeX
- `detail` — the rewrite on its own, e.g. `2\times3=6` (arithmetic steps)

Arithmetic steps come from this package and use short names — `add`,
`multiply`, `power`, `substitute`. Algebraic and calculus steps come from the
compute engine's own `explain()` and keep its frozen ids — `solve.linear`,
`solve.quadratic-formula`, `derivative.power-rule` — which are documented as
localisation keys, so they are passed through rather than re-derived.

```ts
math.evaluate("1+2\\times3").steps;
// [ { rule: "multiply", before: "1+2\\times3", after: "1+6", detail: "2\\times3=6" },
//   { rule: "add",      before: "1+6",        after: "7",   detail: "1+6=7" } ]
```

Steps that change nothing a reader would notice are left out: a part already in
final form, or a sum the engine merely reordered.

## Errors

`MathParseError`, `MathSolveError` and `UnboundSymbolError` all extend
`MathError`, which extends core's `SmartputError` — so one `instanceof
SmartputError` guard catches input problems from every package in this repo.

## Built on

[`@cortex-js/compute-engine`](https://cortexjs.io/compute-engine/) does the
mathematics: LaTeX parsing, exact arithmetic, simplification, equation solving,
derivatives and integrals, and the rule traces behind the algebraic steps.
Symbolic integration rules are loaded on first `integrate` call, not at engine
construction.
