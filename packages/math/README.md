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
| `describe(latex, o?)`        | The expression read out in English             |

Plus one function that needs no engine: `latexFromWords`, which reads an
expression said in words into the LaTeX the rest of the package takes.

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

## Saying it

`latexFromWords` reads an expression spoken in English into LaTeX, so anything
that arrives as words — dictation, a chat message, a voice assistant — reaches
`evaluate` and `solve` without those knowing words exist:

```ts
import { latexFromWords } from "@smartput/math";

latexFromWords("one plus two power three"); // "1+2^3"
latexFromWords("one plus two in brackets power three"); // "(1+2)^3"
math.evaluate(latexFromWords("x plus one all squared")).latex; // "(x+1)^2"
```

A bracket can be said either way round, because both are things people say:

| Said | Means |
| ---- | ----- |
| `one plus two in brackets power three` | `(1+2)^3` — it groups everything said since the last bracket |
| `x plus one all squared` | `(x+1)^2` — "all" is the everyday form of the same marker |
| `four times the quantity one plus two` | `4\times(1+2)` — a comma closes it: `the quantity x plus 1, squared` |
| `open bracket one plus two close bracket` | `(1+2)` — said around it, for when neither of the above fits |

The vocabulary is deliberately generous — `power`, `to the power`, `to the
power of`, `raised to` are one operator, and `divided by` and `over` are
another — because a caller who has to learn which spelling is the supported one
has gained nothing over typing `^`. Numbers arrive as digits or as words in the
same sentence: `twenty-two plus one hundred and five` is `22+105`, and
`three point five` is `3.5`.

A power binds tighter than the arithmetic around it, and a function binds to
its operand rather than to the sentence: `the sine of x plus one` is
`\sin(x)+1`, and the other reading is available by saying it — `the sine of the
quantity x plus one`. A word it does not know is a `WordParseError` naming the
word, not a guess.

### Reading through a typo

`{ fuzzy: true }` mends a misspelled word into the closest one the vocabulary
has — operators, phrases and number words alike:

```ts
latexFromWords("one plsu two", { fuzzy: true });          // "1+2"
latexFromWords("twnty plus on", { fuzzy: true });         // "20+1"
latexFromWords("x plus one all squred", { fuzzy: true }); // "(x+1)^2"
```

It is off by default, and deliberately so: a correction that guesses wrong
still returns a number, and a number is not something a caller checks.

Three rules keep it from guessing. A single letter is never touched — every one
of them is a symbol. How far it will look depends on the length of the word:
one edit, or two once the word is long enough that two still leave most of it
standing. And the kinds of slip are not priced the same — a letter left out
beats two letters swapped, which beats a letter typed twice, which beats a
letter typed wrong. That ordering is what makes `sne` the sine rather than
one, and `thre` three rather than the.

Where two words are still equally near, it stops and reports the word instead
of picking: `si` is a letter short of both `sin` and `six`, and neither is more
likely than the other.

## Reading it out

`describe` turns an expression into English, and `OPERATOR_WORDS` is the plain
symbol-to-word table behind it — no engine needed to read it:

```ts
math.describe("(2+3)^2"); // "the quantity 2 plus 3, squared"
describeOperator("^"); // "power"
describeOperator("+"); // "plus"
OPERATOR_WORDS["\\leq"]; // "less than or equal to"
```

How it reads is an option, in the shape `Intl` uses — what varies is named, and
every default is what the reading was before the option existed:

```ts
math.describe("(2+3)^2", { style: "short" }); // "2 plus 3 in brackets squared"
math.describe("x^2+1", { numbers: "words" }); // "x squared plus one"
```

`style: "long"` (the default) reads as a sentence; `"short"` reads as a
caption — no articles, no "of" after a function, and a bracket marked after
what it holds rather than before. `numbers: "words"` spells numbers out;
`"digits"` (the default) leaves them as figures, as does a number too large for
the scale words.

The words `describe` uses are the words `latexFromWords` reads, so an ordinary
description returns to the expression it came from:

```ts
latexFromWords(math.describe("(2+3)^2")); // "(2+3)^2"
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

[`@smartput/locale-en`](../locale-en) supplies the number vocabulary both
directions of the word layer need: `numberFromWords` reads "one hundred and
five", and `spellNumber` says 105 back. Keeping the pair in one package is what
stops a word this one learns to read from being a word the other cannot say —
and that package is a *language*, not a kind, because cardinals are English
grammar rather than a property of what a number is.
