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
