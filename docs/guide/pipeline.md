---
title: The pipeline
description: The seven stages between an input string and a Result.
---

# The pipeline

Seven stages. Ambiguity stays open until stage 5 — that is what makes
`10 m + 5 min` resolve to minutes.

```
input string
  │
  1. Normalize      NFKC, case-fold, strip zero-width, unify − – — → -
  │
  2. Lex            locale segmenter → NUMBER | WORD | OP | KEYWORD | PAREN.
  │                 Numbers read via the locale's numberFormat (1.000,50 vs 1,000.50)
  │
  2b. Fold          kind-claimed runs → one LITERAL; spelled-number runs → one
  │                 NUMBER; operator words → OP. "next week monday" → LITERAL,
  │                 "one thousand thirty two" → 1032, "divided by" → /
  │
  2c. Analyze       each WORD → lemma candidates via the locale's analyzer chain
  │                 "kilograms" → [kilograms(0), kilogram(-2)]
  │
  3. Candidates     each analyzed form → Set<{kind, unit, weight}>
  │                 "m" → [{length,m}, {duration,min}]   ← both kept
  │
  4. Parse          Pratt parser → AST. Nodes carry candidate SETS, not choices.
  │
  5. Solve          constraint propagation. Unify kinds across operands,
  │                 score each consistent assignment, take argmax.
  │
  6. Evaluate       walk the AST with kinds resolved. Ops dispatched off the
  │                 Kind descriptor. Arithmetic in canonical units, Decimal throughout.
  │
  7. Format         Value → string. Intl for number grammar, lexicon for unit words.
  ▼
Result { value, formatted, kind, confidence, spans, meta }
```

## Watch it run

`explain()` exposes stages 2 through 5 for any input. It shares the strict
pipeline, so it throws where `evaluate()` would.

<SpExplain />

## Stage 1 — Normalize

NFKC normalization, zero-width characters stripped, and the four dash
characters people actually type (`−` `–` `—` `-`) unified to ASCII hyphen. Case
folding happens per locale, since Turkish dotted/dotless `i` makes a global
`toLowerCase()` wrong.

## Stage 2 — Lex

`Intl.Segmenter` splits word runs by default; a locale can supply its own
`segment` for scripts without spaces. Numbers are read through the locale's
`numberFormat`, which is why `1,500` is 1500 in `en` and 1.5 in `de` — and why
both candidates are emitted when the locale list contains both.

Token types: `number`, `word`, `op`, `keyword`, `lparen`, `rparen`. `-` is
emitted as an op token even between letters, so `"twenty-two"` lexes as
word/op/word — which is what stage 2b's hyphen rule exists to undo.

## Stage 2b — Fold

Three pure token rewrites, so the parser never learns that words can be values,
numbers or operators.

`foldLiterals` runs first and is the only pass that can see the source string.
It offers every registered kind's [literal matchers](/api/define-kind#literals)
each token boundary in turn, and collapses a claimed run of *characters* into a
single `literal` token carrying a finished `Value`. That is what lets
`next week monday` — three words, no number — and `2026-03-01` — which lexes as
number-op-number-op-number — reach the solver as one operand. Core ships no
matchers; [`@smartput/datetime`](/guide/datetime) supplies the only one that
exists today.

`foldNumerals` collapses a run of spelled-number words into a single `number`
token by calling the locale's `numerals` hook, which claims a prefix of the run
and reports how much it took. A hyphen between two numeral words is absorbed
only when nothing separates it from either side, so `twenty-two` is 22 while
`twenty - two` is 18.

`foldWordOps` rewrites the `plus`, `minus`, `times` and `over` keywords into
`+`, `-`, `*` and `/`, swallowing a following `by` so that `divided by` is one
operator.

Because both run before parsing, `"ten plus five"` and `"10 + 5"` reach the
parser as identical token streams. Word operators get the existing precedence
table for free, with no second table to keep in sync:
`ten plus two times three` is 16.

## Stage 2c — Analyze

A flat list of alias strings works for English and fails for most of the world.
Ukrainian declines `кілограм` seven ways in two numbers; Turkish and Finnish
stack suffixes without bound. So surface forms are reduced to lemmas by an
ordered chain of analyzers before any lookup happens.

```ts
analyze: [
  identity(),                                              // exact form, weight 0
  suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
  tableAnalyzer({ feet: "foot", inches: "inch" }, -1),      // irregulars
]
```

Analyzers return *several* candidates, not one. Morphological ambiguity is
resolved by machinery that already exists — each analyzed form enters the solver
as a scored candidate, and the negative weight on a stripped suffix means an
exact alias always outranks a guessed stem. No new concept, no new resolution
rules. See [Locales](/guide/locales).

## Stage 3 — Candidates

Each analyzed form is looked up in the merged lexicon of every registered kind.
The result is a set, not a choice:

```
"m"  →  [ { kind: "length",   unit: "m"   },
          { kind: "duration", unit: "min" } ]
```

## Stage 4 — Parse

A Pratt parser builds the AST: infix `+ - * /`, prefix `-`, the `in` / `to` /
`as` conversion keyword, and parentheses. AST nodes carry candidate sets, so no
commitment has been made yet.

## Stage 5 — Solve

The load-bearing stage. Constraint propagation over the AST unifies kinds across
operands, scores each consistent assignment, and takes the argmax.

```
raw(candidate) = weight(candidate)   // Σ of every matching selector
               + contextBonus        // a matching OpSignature exists for the sibling
               + hintBonus           // opts.kinds, or the coerce() target

score(assignment) = Σ raw(candidate)
confidence        = softmax(score over all consistent assignments)
```

Three scoring terms and one signature lookup. There is no separate type system:
the `OpSignature` table *is* the check.

Raw scores are unbounded; `confidence` is the softmax normalization, so
`ambiguityEpsilon` always compares normalized values — weights change the
ranking without changing what the epsilon means.

Candidate sets are small (1–3 entries), so the search over assignments is
exhaustive. `maxCandidates` (default 10,000) guards it; exceeding it raises
`TooAmbiguousError`.

## Stage 6 — Evaluate

The AST is walked with kinds resolved. Every operation is dispatched through an
`OpSignature`, and arithmetic runs in canonical units with `Decimal` throughout —
no intermediate rounding, ever.

<SpEvaluate
  model-value="1234567890123456789.0625 km"
  :examples="['1234567890123456789.0625 km', '100 g in oz', '0.1 kg + 0.2 kg']"
  hint="23 significant digits survive intact. A JS number would have rounded the input before the parser saw it. (The demos display at most four decimal places — a theme-level trim, not the engine's.)" />

## Stage 7 — Format

`Value → string`. `Intl.NumberFormat` supplies number grammar for the locale;
the lexicon supplies the unit word. Plural selection goes through
`Intl.PluralRules`, so a locale that declares `display: { one, few, many, other }`
gets the right form for free and one that declares only a `symbol` falls back to
it — correct for abbreviations in every language.

```
1 kg + 500 g  →  "1.5 kilograms"    // mass:kg declares display forms
2 km in m     →  "2,000 metres"     // length:m declares display forms
3 m * 4 m     →  "12m²"             // area:m2 declares only a symbol
```
