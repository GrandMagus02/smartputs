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

| Method                      | Answers                                    |
| --------------------------- | ------------------------------------------ |
| `evaluate(latex, options?)` | The value, exactly, innermost part first    |
| `simplify(latex)`           | The simplified expression                   |
| `solve(latex, options?)`    | Every solution for one unknown              |
| `differentiate(latex, o?)`  | The derivative                              |
| `integrate(latex, o?)`      | The antiderivative                          |

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
