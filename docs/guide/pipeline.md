---
title: The pipeline
description: The seven stages between an input string and a Result — each a frozen class, each usable alone.
---

# The pipeline

Seven stages, each a frozen class holding its own config, each backed by an
exported pure function, and — the completion stage aside — each importable
from its own subpath. Ambiguity stays open until stage 4 — that is what makes
`10 m + 5 min` resolve to minutes.

```
source string
  │
  1. Normalizer     NFKC, case-fold, strip zero-width, unify − – — → -
  │                 NormalizedInput { source, text, edits, mapSpan }
  │
  2. Tokenizer      lex + foldLiterals + foldNumerals + foldWordOps
  │                 TokenStream { input, tokens }
  │
  3. Parser         Pratt parser over a Resolver — analyze, then look up
  │                 candidates, then build the tree
  │                 Program { root, nodes, input } — every node has a stable id
  │
  4. Solver         constraint propagation over the tree, ranked results
  │                 .all() every consistent Resolution | .best() the winner
  │
  5. Evaluator      walk the tree with kinds resolved, arithmetic in canonical
  │                 units, Decimal throughout
  │                 Evaluation { value, assumptions }
  │
  6. Printer        Program → string, three modes | Value → string
  │
  7. Autocompleter  the input's trailing fragment → ranked Completion[]
  ▼
Result { value, formatted, kind, confidence, spans, meta }
```

`createEngine` is exactly this: one instance of each class, wired together —
see [its source](/api/create-engine) and the [full stage reference](/api/stages).
Every stage is reachable on its own, which is what makes each of the following
true: you can tokenize without solving, inspect a parse without evaluating,
reuse a `Parser` across a thousand keystrokes, or hand-build a pipeline from
five public imports and no `createEngine` at all —
[`stages.test.ts`](https://github.com/GrandMagus02/smartputs/blob/main/packages/core/src/stages.test.ts)
does exactly that, and [Stages](/api/stages) walks through it.

## Watch it run

`explain()` exposes stages 2 through 4 for any input. It shares the strict
pipeline, so it throws where `evaluate()` would.

<SpExplain />

## Two behaviour changes worth knowing

**`Result.spans` now indexes the string you passed in.** Lexing runs on
normalized text, so a span is naturally normalized-relative; every stage
before this one produced spans against `NormalizedInput.text` and handed them
back unmapped. `NormalizedInput.mapSpan` (stage 1) fixes that, and
`createEngine` calls it before a span ever reaches a `Result`. It matters most
when normalization changes length — `"30 °C + 5 C"` strips the `°`, so a span
that ignored the mapping would slice one character short.

**Each entry of `Result.meta.assumptions`, and every `Completion`, are now
frozen.** `Result.value` was already frozen before this restructuring —
`evalNode`'s returns were `deepFreeze`d on `main` too, so mutating it has
always thrown. What is new is narrower: each `Assumption` object an evaluation
produces, and each `Completion` row `complete()` returns, now come back
frozen as well — mutating one now throws instead of silently succeeding:

```ts
const result = engine.evaluate("20 C + 5 C"); // reads the right operand as a delta
result.meta.assumptions[0].message = "hacked";
// TypeError: Attempted to assign to readonly property.
```

`Result` itself, `Result.meta`, and the `meta.assumptions` array as a
container are not frozen — `toResult` builds `meta.assumptions` as a fresh
`[...assumptions]` array precisely so the container stays a plain array;
only the `Assumption` objects inside it carry the freeze. Only the values a
caller is likely to hold onto and pass around individually are frozen.

## Stage 1 - Normalizer

The stage that tries to make input valid, and reports what it could and could
not do. `@smartput/core/normalize`.

```ts
class Normalizer {
  constructor(cfg?: NormalizerOptions);
  run(input: string): NormalizedInput;
}
function normalize(input: string, opts?: NormalizerOptions): NormalizedInput;
```

NFKC normalization, zero-width characters stripped, the degree sign removed
(so `deg` never has to see it — `@smartput/temperature`'s `°C` alias is a
concern of its own vocabulary, not the normalizer), and the five dash characters
people actually type (`−` `‒` `–` `—` `―`) unified to ASCII `-`, the target,
not one of the five. Every pass is
individually gated in `NormalizerOptions` and on by default. **Never throws:**
empty input comes back as `{ empty: true }`, and it is the caller's job (or
`createEngine`'s — it throws `UnitParseError`) to decide that is an error.

```ts
interface NormalizedInput {
  readonly source: string;   // exactly what the caller passed
  readonly text: string;     // what every later stage reads
  readonly edits: readonly Edit[];
  readonly empty: boolean;
  mapSpan(span: Span): Span; // translate a span in `text` back to `source`
}
```

`mapSpan` is what stage 1 owes every stage after it: `lex()` runs on `text`
and produces spans against it, and a caller reasonably reads a `Result`'s spans
against the string they typed. `mapSpan` closes that gap with an O(1) lookup
into a precomputed `offsets` array built alongside `text` — not, as first
proposed, a binary search over `edits`; a direct index turned out simpler and
faster than the search it replaced. One case it cannot
close honestly: once NFKC has changed the string *at all* — not only when it
changes length; a same-length fold like `"①"` → `"1"` counts too — there is no
character-level correspondence left, and `mapSpan` answers with the whole
source rather than a plausible-looking wrong offset.

## Stage 2 - Tokenizer

Lexing plus the three fold passes, which used to be four separate calls with
different argument shapes. `@smartput/core/tokenize`.

```ts
class Tokenizer {
  constructor(cfg: { locale: Locale; registry: Registry; now?: () => number; timeZone?: string });
  run(input: string | NormalizedInput, opts?: { timeZone?: string }): TokenStream;
}
```

Accepting either a raw string or a `NormalizedInput` is what makes stages
composable in practice: pass a string for the common case, or a
`NormalizedInput` you built yourself with different `NormalizerOptions`.
`MatchCtx` — `{ locale, now, timeZone, isUnitAlias }` — is assembled inside
`run()`, once per call.

### Lex

`Intl.Segmenter` splits word runs by default; a locale can supply its own
`segment` for scripts without spaces. Numbers are read through the locale's
`numberFormat`, which is why `1,500` is 1500 in `en` and 1.5 in `de`. Both of
those are the **format** locale's, and only its: number grammar and
segmentation are the two input-side concerns that belong to the one language
the engine writes, so an `[en, uk]` engine formatting in English reads
`1,000.5` and not `1 000,5`. Keywords are the opposite — `buildKeywords` folds
every installed language's connectives into one table before lexing starts, so
the same engine reads `5 кг in grams` and `5 кг в грамах` alike. A surface two
languages read as two *different* keywords is a wiring error and throws
`KeywordConflictError` on boot, where the stack names the line that installed
them. Token types:
`number`, `word`, `op`, `keyword`, `lparen`, `rparen`. `-` is emitted as an op
token even between letters, so `"twenty-two"` lexes as word/op/word — which is
what the hyphen rule in fold exists to undo.

Multiplication has four accepted spellings — `*`, plus U+00B7 MIDDLE DOT,
U+00D7 MULTIPLICATION SIGN and U+22C5 DOT OPERATOR — all canonicalized to the
one `*` op, so nothing downstream sees a second name for it. That is what makes
a printed SI product symbol readable: `energy:kwh` prints as `кВт·год` in
Ukrainian, which lexes as kilowatt `*` hour and evaluates through the
`* | power | duration` signature, exactly as `speed:mps`'s `m/s` lexes as metre
`/` second. Neither symbol is a registered alias — a unit word ends at the
operator — and neither needs to be. A dot between digits is arithmetic too:
`1·5` is 5, never 1.5, since the number scanner only absorbs the locale's own
decimal symbol.

### Fold

Three pure token rewrites — `foldLiterals`, `foldNumerals`, `foldWordOps` —
so the parser never learns that words can be values, numbers or operators. All
three stay exported on their own, alongside `lex`, for a caller who wants
numerals folded but not word operators.

`foldLiterals` runs first and is the only pass that can see the source string.
It offers every registered kind's [literal matchers](/api/define-kind#literals)
each token boundary in turn, and collapses a claimed run of *characters* into a
single `literal` token carrying a finished `Value`. That is what lets
`next week monday` — three words, no number — and `2026-03-01` — which lexes as
number-op-number-op-number — reach the parser as one operand. Core ships no
matchers; [`@smartput/datetime`](/packages/datetime) supplies the only one that
exists today.

`foldNumerals` collapses a run of spelled-number words into a single `number`
token by calling the `numerals` hook, which claims a prefix of the run and
reports how much it took. The run is collected once and offered to *every*
installed language, and the longest claim wins: a language that read two words
where another read one has understood more of the input, whatever the reader
prefers. Only a genuine tie — two languages claiming the same number of words —
consults preference, first the `locale:` weight on the engine's layers and then
the locale id ascending, so the answer never depends on the order `locales` was
written in. A hyphen between two numeral words is absorbed only when nothing
separates it from either side, so `twenty-two` is 22 while `twenty - two` is 18.

`foldWordOps` rewrites the `plus`, `minus`, `times` and `over` keywords into
`+`, `-`, `*` and `/`, swallowing a following `by` so that `divided by` is one
operator. Because both fold passes run before parsing, `"ten plus five"` and
`"10 + 5"` reach the parser as identical token streams, and word operators get
the existing precedence table for free: `ten plus two times three` is 16.

## Stage 3 - Parser

Pratt parsing over a `Resolver`, producing a `Program` — the tree that *is*
the "list of commands," just with structure, because `2 * (3 + 4)` has some.
`@smartput/core/parse`.

```ts
class Parser {
  constructor(cfg: { resolver: Resolver });
  run(stream: TokenStream): Program;
}
```

`Parser`'s one required config field is a `Resolver`, which nothing but
`createResolver` (`@smartput/core/registry`) builds — it is what turns an
analyzed word into a candidate set during parsing:

```
"m"  →  [ { kind: "length",   unit: "m"   },
          { kind: "duration", unit: "min" } ]  ← both kept
```

Getting there is two steps folded into resolving, not the parser itself. A
flat list of alias strings works for English and fails for most of the world,
so surface forms are reduced to lemmas by an ordered chain of analyzers first:

```ts
analyze: [
  identity(),                                              // exact form, weight 0
  suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
  tableAnalyzer({ feet: "foot", inches: "inch" }, -1),      // irregulars
]
```

Analyzers return *several* candidates, not one — morphological ambiguity is
resolved by the same machinery that resolves lexical ambiguity, and the
negative weight on a stripped suffix means an exact alias always outranks a
guessed stem. Each analyzed form is then looked up in one alias index built from
every installed vocabulary, which is where the candidate set above comes from.

There is one chain **per installed language**, and `resolve` unions what all of
them produce: recognition is many-locale, so a Ukrainian inflection reaches the
Ukrainian vocabulary that lists its stem even on an engine that prints English.
`Candidate.locale` records which language spelled the reading, and `locale:<id>`
is a weight selector like any other. See [Locales](/guide/locales).

The Pratt parser itself builds the AST from there: infix `+ - * /`, prefix
`-`, the `in` / `to` / `as` conversion keyword, and parentheses. Nodes carry
candidate sets, not choices, so no commitment has been made yet.

```ts
interface Program {
  readonly root: Node;
  /** Depth-first, id-indexed. `nodes[n.id] === n` for every node. */
  readonly nodes: readonly Node[];
  readonly input: NormalizedInput;
}
```

Every node carries a stable `id: NodeId`, assigned depth-first at parse time.
That field is the whole reason a solver's result can be a value rather than a
pointer into one specific tree — see stage 4 — and it is what lets
`Printer.node()` address a subexpression by number instead of by holding the
object. `buildProgram` is the function that assembles and freezes `Program`
from a parsed root and a `NormalizedInput`; it is exported from the root
barrel (not yet from `@smartput/core/parse` itself), and it also validates the
tree it is given — every id present exactly once — which is what catches a
parser bug one file away rather than as a mysterious `undefined` three stages
later. The Pratt tree-builder underneath it (`parse`) is a private
implementation detail: nothing outside `parse/program.ts` calls it, and
`Parser.run` is the public door onto both steps.

## Stage 4 - Solver

The load-bearing stage: constraint propagation over the tree unifies kinds
across operands, scores each consistent assignment, and ranks them.
`@smartput/core/solve`.

```ts
class Solver {
  constructor(cfg: { registry: Registry; maxCandidates?: number; ambiguityEpsilon?: number; tiebreak?: "error" | "first" });
  all(program: Program, opts?: { kinds?: KindId[] }): Resolution[];
  best(program: Program, opts?: { kinds?: KindId[] }): Resolution;
  forKind(program: Program, kind: KindId, opts?): Resolution | undefined;
}
```

```
raw(candidate) = weight(candidate)   // Σ of every matching selector
               + contextBonus        // a matching OpSignature exists for the sibling

score(assignment) = Σ raw(candidate)
confidence        = softmax(score over all consistent assignments)
```

Three named entry points cover what used to be three copies of the same logic:
`best()` applies `ambiguityEpsilon` and `tiebreak` (this is where `evaluate()`'s
tie-break lived before this stage existed), `forKind()` is what `coerce()`
open-coded before, and `all()` underlies both. Raw scores are unbounded;
`confidence` is the softmax normalization, so `ambiguityEpsilon` always
compares normalized values — weights change the ranking without changing what
the epsilon means. Candidate sets are small (1–3 entries), so the search over
assignments is exhaustive; `maxCandidates` (default 10,000) guards it, and
exceeding it raises `TooAmbiguousError`.

A `Resolution` — renamed from `Assignment` — is the result, keyed by node id
rather than by node object:

```ts
interface Resolution {
  readonly choices: Readonly<Record<NodeId, Candidate>>;
  readonly kind: KindId;
  readonly score: number;
  readonly contextBonus: number;
  readonly confidence: number;
}
```

That is the change §3 of the design spec calls for: id-keying makes a
resolution loggable, snapshot-testable and diffable, none of which a
`Map<Node, Candidate>` ever was. The bare `solve()` function underneath
`Solver` is exported from the root barrel; the `@smartput/core/solve` subpath
itself re-exports `Solver`, `Resolution`, `SolverOptions` and
`weightBreakdown` (the same per-candidate accounting `explain()` uses) but not
`solve` on its own — `Solver.all()`/`best()`/`forKind()` are the intended door
from that subpath.

## Stage 5 - Evaluator

The tree, walked with kinds resolved. `@smartput/core/eval`.

```ts
class Evaluator {
  constructor(cfg: { registry: Registry; locale: string; kindMeta?: Record<KindId, Record<string, unknown>>; rates?: RateLookup });
  run(program: Program, resolution: Resolution): Evaluation;
}
```

Every operation is dispatched through an `OpSignature`, and arithmetic runs in
canonical units with `Decimal` throughout — no intermediate rounding, ever.

<SpEvaluate
  model-value="1234567890123456789.0625 km"
  :examples="['1234567890123456789.0625 km', '100 g in oz', '0.1 kg + 0.2 kg']"
  hint="23 significant digits survive intact. A JS number would have rounded the input before the parser saw it. (The demos display at most four decimal places — a theme-level trim, not the engine's.)" />

The pure function underneath is `evaluateNode`, taking the same explicit
options `Evaluator` holds; `toCanonical` — the conversion primitive both
`Evaluator` and `Printer` share — travels with it on the same subpath.

## Stage 6 - Printer

The stage that did not exist before this restructuring: turning a `Program`
back into a string, and a `Value` back into a string. Full reference:
[Printer](/api/printer). `@smartput/core/print`.

```ts
class Printer {
  constructor(cfg: { registry: Registry; locale: Locale; rates?: RateLookup; rounding?: Decimal.Rounding });
  print(program: Program, opts?: PrintOptions): string;
  node(program: Program, id: NodeId, opts?: PrintOptions): string;
  value(v: Value, opts?: FormatOptions): string; // what formatValue does
}
```

`value()` is what stage 5 always ended with — number grammar from the format
language's `numberFormat`, the unit word from that language's vocabulary for the
kind, and the key into the unit's `forms` table from its `selectForm`. English's
`selectForm` is `Intl.PluralRules`; that is the default implementation, not the
model, which is why Ukrainian's genitive plural needs no core change:

```
1 kg + 500 g  →  "1.5 kilograms"    // mass:kg has a forms table
2 km in m     →  "2,000 metres"     // length:m has a forms table
3 m * 4 m     →  "12m²"             // area:m2 declares only a symbol
2 кг в грамах →  "2 000 грамів"     // same units, uk as the format locale
```

`print()`/`node()` are new: three modes over a `Program`, one of which —
`"resolved"` — is the reason this is a stage and not a function. See
[Printer](/api/printer) for the modes, the options and the round-trip
contract.

## Stage 7 - Autocompleter

Prefix completion, ranked by the same weight stack that ranks readings.
`complete()` holding its own config, no behaviour change from before this
restructuring — see [Completion](/guide/completion) and
[`complete()`](/api/complete) for the full reference.

```ts
class Autocompleter {
  constructor(cfg: { registry: Registry; locale: Locale; layers: (Weights | undefined)[] });
  run(input: string, opts?: CompleteOptions): readonly Completion[];
}
```

Named `Autocompleter`, not `Completer`: `Completer` is already the kind
contract's name (`Kind.completions?: Completer`, a plugin's own completion
hook), and this class had to pick a different one. Unlike the other six
stages, it has no subpath of its own — `@smartput/core/complete` does not
exist, so `Autocompleter` is only reachable from the root barrel. It also
takes a raw input string rather than a `Program`: a completion is offered for
text that, by definition, does not yet parse, which a `Program` cannot
represent.
