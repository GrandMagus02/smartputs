---
title: What is smartputs?
description: The problem smartputs solves, and the shape of its answer.
---

# What is smartputs?

smartputs parses and evaluates expressions people write by hand — the kind you
type into a launcher, a spotlight bar, or a form field that should be smarter
than `<input type="number">`:

```
1 kg + 500 g
30 hours - 10 minutes
210mm in pt
10 m + 5 min
```

It is the engine behind a Raycast-style calculator, usable three ways: as a
plain library, as a launcher backend, or as a smart form input.

## Why it exists

The pieces exist in isolation on npm and nothing joins them.

| Domain | Existing option | Assessment |
| --- | --- | --- |
| Date/time/duration math | `temporal-polyfill` | Borrow. Correct DST and calendar semantics. |
| Natural-language dates | `chrono-node` | Borrow, behind a bridge. |
| Decimal arithmetic | `decimal.js` | Borrow. Never use float for money. |
| Physical units | `js-quantities`, `convert-units`, `unitmath`, `mathjs` | Unmaintained, conversion-only, or a full CAS with a poor money model. |
| Money + FX | `dinero.js` v2 | Immutable, but no FX, no parsing, throws on mixed currency. |

The strongest evidence of the gap: Flare, the Raycast-compatible Linux launcher,
binds the closed-source Swift SoulverCore because no JavaScript equivalent
exists.

## What makes it different

### Ambiguity survives until the solver

Most parsers commit to a reading token by token. `m` is metres — decided, done.
smartputs keeps both readings alive and lets the surrounding expression choose:

<SpEvaluate
  model-value="10 m + 5 h"
  :examples="['10 m + 5 h', '10 m + 5 km', '10 m']"
  hint="The same token resolves to minutes, then metres, then throws — the context decides." />

`10 m` on its own is a genuine tie, so strict `evaluate()` refuses to guess and
throws `AmbiguityError`. That is the correct answer, and
[`suggest()`](/api/engine#suggest) returns the ranking instead.

### The type system is a table

There is no separate checker. An operation is legal exactly when an
`OpSignature` exists for `(op, leftKind, rightKind)`. Ratio kinds get their
same-kind signatures generated; cross-kind cases are declared:

```ts
{ op: "+", left: "datetime", right: "duration", result: "datetime",
  apply: (d, dur) => wrap(d.temporal.add(dur.temporal)) }
```

Registering a signature immediately makes that expression form parseable. The
solver reads the same table to score candidates, so parsing and type-checking
cannot drift apart.

### Priority is four layers of plain addition

Weights are numbers and they add. The kind author, the locale, the integrator,
and the individual call each contribute, and every matching selector counts.
There is no precedence table to memorise, which is what keeps the composition
predictable. See [Ambiguity and weights](/guide/weights).

## What it is not

Not a computer algebra system. Not a natural-language question answerer. Not an
LLM wrapper. It parses and evaluates expressions; it does not answer questions
about them.

Out of scope for v1: variables and assignment (`x = 5kg`), notepad mode,
spreadsheet references, natural-language sentences, historical FX by date.

## Next

- [Getting started](/guide/getting-started) — install and evaluate something.
- [The pipeline](/guide/pipeline) — the seven stages, with each one inspectable.
- [Defining a kind](/guide/defining-a-kind) — the five-line extension contract.
