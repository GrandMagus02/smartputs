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
