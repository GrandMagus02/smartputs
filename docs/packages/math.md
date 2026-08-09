---
title: "@smartput/math"
description: "LaTeX in, steps out: evaluate, simplify, solve, analyse."
---

# @smartput/math

`createMathEngine()` over `@cortex-js/compute-engine`, plus the
step machinery — `ruleForOperator`, `titleForRule` — and
`describeOperator()`, which is what lets a step be read aloud.

## Try it

<SpMathEvaluate />

<SpMathSolve />

`@smartput/math` is the second package that sits beside core rather than inside
it. Core reads what people *type* — `1 kg + 500 g`, `30 usd in gbp`. This one
reads what people *write*: LaTeX, the notation every markdown file already uses
between `$…$`.

```sh
bun add @smartput/math
```

```ts
import { createMathEngine } from "@smartput/math";

const math = createMathEngine();

math.evaluate("\\frac{1}{2}+\\frac{1}{3}").latex; // "\frac{5}{6}"
math.solve("x^2-5x+6=0").solutions;               // ["2", "3"]
```

LaTeX in, LaTeX out — so a result renders through whatever already renders the
source. Every demo on this page is that engine running in your browser.

<SpMathEvaluate
  model-value="\frac{1}{2}+\frac{1}{3}"
  :examples="[
    '\\frac{1}{2}+\\frac{1}{3}',
    '1+2\\times3',
    '2^{10}',
    '\\sqrt{16}+x',
    '\\sin(\\pi/2)+\\log_{2}(8)',
    '\\int_0^1 x^2 dx',
    '\\frac{d}{dx}(x^3)',
  ]"
  hint="Arithmetic is exact: a half plus a third is five sixths, not 0.8333. The decimal is available separately, on `approx`." />

## Exact by default

`\frac{1}{2}+\frac{1}{3}` is `\frac{5}{6}`. It is not `0.8333333`, and it is
not `0.8333333333333334` either — the second is what floating point does to the
first, and neither is the answer to the question asked.

```ts
const result = math.evaluate("\\frac{1}{2}+\\frac{1}{3}");

result.latex;  // "\frac{5}{6}"  — the answer
result.approx; // 0.8333333333333334 — a decimal, when a decimal is what you want
```

`approx` is `null` when there is nothing to approximate: an expression with free
symbols stays symbolic, and `2x+3x` answers `5x` rather than failing.

## Steps

Every result carries the working. Each step has a stable `rule` to branch or
translate on, an English `title`, the whole expression on either side as
`before` and `after`, and the rewrite on its own as `detail`.

```ts
math.evaluate("1+2\\times3").steps;
// [ { rule: "multiply", title: "Multiply the factors",
//     before: "1+2\\times3", after: "1+6", detail: "2\\times3=6" },
//   { rule: "add", title: "Add the terms",
//     before: "1+6", after: "7", detail: "1+6=7" } ]
```

Arithmetic is traced innermost-first, the way it is done by hand. Two kinds of
rewrite are deliberately left out: ones that change nothing on the page — a part
already in final form — and ones that only reorder a commutative sum. Both are
true of the tree and meaningless to a reader, and emitting them buries the steps
that carry the work.

Where the rules come from matters for what you can do with them:

| Step source | `rule` looks like | Who owns the id |
| --- | --- | --- |
| Arithmetic in this package | `add`, `multiply`, `power`, `substitute` | `@smartput/math` |
| Algebra, calculus | `solve.linear`, `derivative.power-rule` | the compute engine, frozen |

The second kind is passed through untouched rather than re-narrated here. A
narration written on this side of the boundary would be a guess about what the
solver did, and would drift from it the moment the solver learned a new rule.

## Binding symbols

```ts
math.evaluate("x^2+1", { bindings: { x: 3 } });
// latex "10", and a first step reading "3^2+1" — the substitution is shown
// before it is computed
```

Substitution is its own step on purpose: `x^2+1` with `x=3` has to read `3^2+1`
before it reads `10`, or the reader is asked to take the jump on faith.

When a number is what you need — a spreadsheet cell, a converted unit — pass
`requireNumber` and a still-symbolic answer becomes an error instead of a result
that looks like success:

```ts
math.evaluate("2x+1", { requireNumber: true });
// throws UnboundSymbolError: "2x+1" still contains unbound symbol x
```

## Simplify

```ts
math.simplify("2x+3x").latex; // "5x"
```

<SpMathEvaluate
  mode="simplify"
  title="math.simplify(latex)"
  model-value="2x+3x"
  :examples="['2x+3x', '(x+1)^2-x^2', '\\frac{x^2}{x}', '\\sqrt{16}+x', 'x+1']"
  hint="Some simplifications leave no rule chain behind — canonicalisation folds `\sqrt{16}+x` on the way in, before any rule can fire — so that case reports one plain `simplify` step rather than none." />

## Calculus

```ts
math.differentiate("x^3").latex; // "3x^2", via derivative.power-rule
math.integrate("x^2").latex;     // "\frac{x^3}{3}"
```

Symbolic integration rules are large enough that the compute engine ships them
separately, so they load on the first `integrate` call rather than at engine
construction — an engine that only ever adds fractions never pays for them.
Definite integrals go through `evaluate` and come back exact:
`\int_0^1 x^2 dx` is `\frac{1}{3}`.

## Reading it out

`describe` turns an expression into English, for a caption, a screen reader, or
a keypad legend. `OPERATOR_WORDS` is the plain symbol-to-word table behind it,
exported on its own because reading `+` as "plus" should not require an engine.

```ts
import { describeOperator, OPERATOR_WORDS } from "@smartput/math";

math.describe("(2+3)^2"); // "the quantity 2 plus 3, squared"
describeOperator("^");    // "power"
describeOperator("+");    // "plus"
OPERATOR_WORDS["\\leq"];  // "less than or equal to"
```

How it reads is an option, in the shape `Intl` uses — `style` for how much
sentence there is, `numbers` for figures or words:

```ts
math.describe("(2+3)^2", { style: "short" }); // "2 plus 3 in brackets squared"
math.describe("x^2+1", { numbers: "words" }); // "x squared plus one"
```

<SpMathSpeech />

## Saying it

The same words go back the other way. `latexFromWords` reads an expression said
in English into LaTeX, so dictation, a chat message or a voice assistant
reaches the engine without the engine knowing words exist:

```ts
import { latexFromWords } from "@smartput/math";

latexFromWords("one plus two power three");             // "1+2^3"
latexFromWords("one plus two in brackets power three"); // "(1+2)^3"

math.evaluate(latexFromWords("one plus two in brackets power three")).latex; // "27"
```

The awkward part of saying mathematics out loud is where the brackets go, and
English has three ways of doing it — all three work:

| Said | Means |
| ---- | ----- |
| `one plus two in brackets power three` | `(1+2)^3` |
| `x plus one all squared` | `(x+1)^2` |
| `the quantity x plus one, squared` | `(x+1)^2` |
| `open bracket x plus one close bracket squared` | `(x+1)^2` |

Marked afterwards — `in brackets`, `all` — the bracket takes everything said
since the last one opened, which is what a speaker who marks a bracket after
the fact means by it. Marked beforehand, `the quantity` runs to the comma, the
same pause `describe` puts there when it reads a bracket out.

Everything else is generous on purpose: `power`, `to the power of` and `raised
to` are one operator, `divided by` and `over` another, and numbers come as
digits or words in the same breath — `twenty-two plus one hundred and five`.

Because it is the same vocabulary `describe` speaks, a description reads back
as the expression it described:

```ts
latexFromWords(math.describe("(2+3)^2")); // "(2+3)^2"
```

Anything typed is eventually mistyped, so `{ fuzzy: true }` mends a word into
the closest one the vocabulary has — numbers included:

```ts
latexFromWords("one plsu two", { fuzzy: true });   // "1+2"
latexFromWords("twnty plus on", { fuzzy: true });  // "20+1"
```

It stays off unless asked for, because a wrong correction still returns a
number and nobody double-checks a number. Where two words are equally likely it
refuses instead of choosing: `si` is a letter short of both `sin` and `six`.

## Errors

`MathParseError`, `WordParseError`, `MathSolveError`, `NotAMatrixError` and
`UnboundSymbolError` all extend `MathError`, which extends core's
`SmartputError`. One
`instanceof SmartputError` guard therefore catches input problems from every
package in this repo — which is exactly what the demos on this page do to render
a failure instead of blanking.

```ts
math.evaluate("\\frac{1}{");
// MathParseError: Cannot parse "\frac{1}{" as math: expected-closing-delimiter at {
```

## Next

- [Equations and matrices](/packages/math) — solving, systems, function analysis, linear algebra.
- [`@smartput/math` API reference](/api/math) — every export.

Everything on this page is `@smartput/math` answering a question about an
expression rather than computing its value. Same engine, same LaTeX in and out,
same steps.

## Solving

```ts
math.solve("x^2-5x+6=0");
// { variable: "x", solutions: ["2", "3"],
//   steps: [ solve.quadratic-formula, roots ] }
```

The unknown is inferred when there is exactly one, and never guessed when there
are several — `x+y=1` solved "for x" when the writer meant `y` is a wrong answer
delivered without a warning, so it raises `MathSolveError` instead. Pass
`{ variable }` to say which.

A bare expression means "= 0", which is how a root is usually written in a note:
`math.solve("x^2-4")` is the same call as `math.solve("x^2-4=0")`.

<SpMathSolve
  :examples="[
    'x^2-5x+6=0',
    '3x+2=11',
    'x^2-4',
    'ax+b=0',
    '\\sin(x)=1',
    'x^3-1=0',
    'x+1=x+2',
  ]"
  hint="Solutions come back sorted and exact. The steps are the solver's own rule chain — `solve.move-terms`, then `solve.linear` — with a closing `roots` step added only when the chain stopped before the answers were on the page." />

## Systems

Several equations at once. They can arrive as an array, as a block of lines the
way they are written in a note, or as a LaTeX `cases` environment — all three
are the same system, and which one you have is an accident of where you copied
it from.

```ts
math.solveSystem("x+y=2\nx-y=0");
// { consistent: true, solutions: { x: "1", y: "1" }, variables: ["x", "y"],
//   steps: [ solve.system.eliminate, solve.system.back-substitute, … ] }

math.solveSystem(["x+y=2", "x+3=4", "y+1=8"]);
// { consistent: false, solutions: null, … }
```

A contradiction is an answer about the system, not a failure of the call. Only a
system with no equations in it throws.

<SpMathSystem />

Square systems carry the solver's elimination and back-substitution as steps.
Overdetermined ones — three equations, two unknowns — have no such strategy, so
they report the verdict with an empty step chain rather than failing.

## Function analysis

`analyze` asks every question a reader has about a curve, at once.

```ts
math.analyze("x^2-4");
// roots:            ["-2", "2"]
// valueAtZero:      "-4"
// derivative:       "2x"
// secondDerivative: "2"
// turningPoints:    [{ at: "0", value: "-4", kind: "minimum" }]
// parity:           "even"
// steps:            the working behind the roots
```

Turning points are classified by the sign of the second derivative there —
positive is a minimum, negative a maximum, zero an inflection. Parity is decided
symbolically, never by sampling: a function that happens to agree with its
mirror image at the points you tried is not an even function.

<SpMathAnalyze />

Two things worth knowing before you trust a number here:

- **Complex roots are kept apart.** `x^2+1` has no roots on a graph and two over
  the complex numbers. `roots` holds the first, `complexRoots` the second.
- **Exactness has a limit.** Every linear and quadratic is solved exactly, and
  so are the cubics the solver can factor. Past that it falls back to numerical
  roots, so `x^3-3x` answers `1.732…` where `\sqrt{3}` was hoped for.

A question that does not apply is `null` or an empty list, never an error —
`\frac{1}{x}` has no value at zero and no root, and analysis that throws when
part of it does not apply cannot be run on an unknown function, which is the
only time anyone wants to run it.

## Matrices

```ts
math.matrix("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}");
// rows 2, columns 2, isSquare true,
// determinant "-2", trace "5", isSingular false,
// transpose and inverse as \begin{pmatrix}… LaTeX
```

<SpMathMatrix />

Three details that decide whether the output is usable:

- **Exact entries.** The inverse of the 2×2 holds `\frac{3}{2}`, not `1.5`.
- **Matrix notation on the way out.** The compute engine computes matrices into
  nested lists, which print as `[[1,3],[2,4]]` — correct, and not what anyone
  typed. Results are put back into `pmatrix`, including matrix arithmetic that
  went through `evaluate`.
- **A singular matrix reports `inverse: null`.** Left alone, the engine hands
  back the unevaluated request — `[[1,2],[2,4]]^{-1}` — which as "the inverse"
  would be worse than useless. The determinant decides instead.

`determinant`, `trace`, `inverse` and `isSingular` are `null` for a non-square
matrix, where the questions do not apply. `transpose` and the shape always
answer.

## Next

- [LaTeX math](/packages/math) — expressions, steps, exactness, reading it out.
- [`@smartput/math` API reference](/api/math) — every export.

## Installing

```sh
npm add @smartput/math
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/math` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`MathError` · `MathParseError` · `MathSolveError` · `NotAMatrixError` · `OPERATOR_WORDS` · `UnboundSymbolError` · `WordParseError` · `createMathEngine` · `describeOperator` · `latexFromWords` · `ruleForOperator` · `titleForRule`

## Dependencies

- `@cortex-js/compute-engine`
- [`@smartput/core`](/packages/core)
- [`@smartput/number`](/packages/number)

## See also

- [LaTeX math](/packages/math)
- [Equations and matrices](/packages/math)
- [@smartput/math API](/api/math)

