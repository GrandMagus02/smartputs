# smartputs Stages — Design Spec

**Date:** 2026-08-05
**Status:** Approved, pending implementation plan

Break `createEngine` into seven composable stages, each with one job, each
usable alone. Add the one stage that does not exist today: turning a parsed
program back into a string.

The engine this restructures is specified in `2026-08-04-smartputs-design.md`.
The byte-minimal validator path is specified in
`2026-08-05-smartputs-validate-design.md` and is unaffected — the two are
independent doors into the same kind descriptors.

## 1. Why this exists

The pipeline is already seven stages of pure function. `normalize` is fourteen
lines, `lex` is 158, `parse` is 161, `solve` is 203, `evaluateNode` is 121,
`formatValue` is 111. None of them is a god object.

The problem is that they are **assembled inside a closure**. `createEngine` is
329 lines whose real content is threading `registry`, `locale`, `packs`,
`layers`, `matchCtx`, `kindMeta`, `rates` and `now` through eight call sites.
From outside, the library is a box: string goes in, `Result` comes out. You
cannot tokenize without solving, inspect a parse without evaluating, cache a
parse across keystrokes, or reuse the solver against a program you built
yourself.

`explain()` exists precisely because the intermediates are unreachable. It is a
read-only porthole into a box that should not have been closed.

### The bug this already caused

`lex()` runs on the **normalized** string, so every span it produces is
normalized-relative. `Result.spans` hands those back to the caller, who
reasonably reads them against the string they passed in. Measured on `main`:

| Input | Reported span slices to | Should be |
| --- | --- | --- |
| `"30 deg + 15 deg"` | `"30 deg + 15 deg"` | correct — normalize changed nothing |
| `"30 °C + 5 C"` | `"30 °C + 5 "` | `"30 °C + 5 C"` |
| `"  30 deg  "` | `"  30 d"` | `"30 deg"` |
| `"30  deg + 15 deg"` | `"30  deg + 15 de"` | `"30  deg + 15 deg"` |

Three of four wrong. Not a typo — a structural consequence of normalization
being a bare `string → string` function that discards what it did. A stage that
returns its edits cannot have this bug, and §4.1 is that stage.

## 2. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| S1 | Seven stages, each a class holding config, each backed by an exported pure function | The class captures the config once; the function keeps every stage testable with everything explicit and keeps the byte-minimal path viable. |
| S2 | The parse result is a **tree** (`Program`), not a flat instruction list | Precedence, parens and nesting are what a tree is for. A flat IR would need a lowering pass and would make the printer re-infer parenthesization. The user-facing "list of commands" is `Program` — see §4.3. |
| S3 | Every node gets a stable `id`; `Resolution` is keyed by id, not by node identity | `Assignment.choices` is a `Map<Node, Candidate>` today, so a solver result is meaningless without the exact tree object that produced it. Id-keying makes a resolution loggable, snapshot-testable and diffable. |
| S4 | `Normalizer` returns its edits and a `mapSpan` | Fixes §1's bug structurally, and gives the printer's `verbatim` mode and a UI's "here's what we changed" highlight for free. |
| S5 | `createEngine` is kept and **reimplemented as composition** | Every consumer keeps working, and its source becomes the reference example. One code path, so the stages and the engine cannot drift. |
| S6 | Ambiguity/tiebreak logic moves into `Solver.best()` | It lives inline in `evaluate()` today, which is why `suggest()` and `coerce()` each re-derive their own variant of it. |
| S7 | `Program` is an in-memory interchange type. Serialization is **out of scope** | Nodes carry `Decimal` and opaque `Value`s whose `meta` is kind-defined. A JSON protocol would need every kind to implement serialization — a subsystem, for a use case nobody has asked for. |
| S8 | Stages get subpath exports and `sideEffects: false` | A caller who wants the tokenizer should not ship the solver. Same discipline as the validate spec. |
| S9 | No behaviour changes except the span fix | This is a restructuring. A parity test over the full corpus is the acceptance criterion. |

### Rejected

| Rejected | Instead | Why |
| --- | --- | --- |
| A flat postfix instruction IR | `Program`, the existing AST made public | Needs a lowering pass, loses parenthesization, and makes span attribution harder. The tree already *is* the command list, in the shape the problem has. |
| Stopping decomposition at tokens | Seven stages | Would leave parse+solve+eval fused — the three biggest stages, and the whole point. |
| Fluent chaining (`pipeline(s).tokenize().solve()`) | Explicit stage objects | Hides where each stage's config came from and makes partial pipelines awkward. |
| Deleting `createEngine` | Keeping it as composition | The common case should stay one call. |
| Classes with no underlying pure function | Both | A test that must build a config object to check `lex("30deg")` is a worse test. |
| Making `Program` JSON | In-memory only (S7) | See S7. |
| Changing `Result.spans`'s shape to per-node | Fix the mapping, keep the shape | Richer spans are reachable off `Program`; breaking the public `Result` for it is not warranted. |

## 3. The shape

```
                    ┌──────────────┐
   source string ──▶│  Normalizer  │──▶ NormalizedInput { source, text, edits, mapSpan }
                    └──────────────┘
                    ┌──────────────┐
                    │  Tokenizer   │──▶ TokenStream { input, tokens }
                    └──────────────┘     lex + foldLiterals + foldNumerals + foldWordOps
                    ┌──────────────┐
                    │    Parser    │──▶ Program { root, nodes, input }
                    └──────────────┘     Pratt, over a Resolver
                    ┌──────────────┐
                    │    Solver    │──▶ Resolution[] { choices, kind, score, confidence }
                    └──────────────┘     .all() ranked  |  .best() with tiebreak
                    ┌──────────────┐
                    │  Evaluator   │──▶ Evaluation { value, assumptions }
                    └──────────────┘
                    ┌──────────────┐
                    │   Printer    │──▶ string
                    └──────────────┘     Program → string (modes) | Value → string
                    ┌──────────────┐
                    │  Completer   │──▶ Completion[]
                    └──────────────┘
```

Two shared dependencies, not stages — they are the configuration the stages read:

```
Registry     buildRegistry(kinds, packs, localeId)   — already public
Resolver     createResolver({ registry, locale, packs, layers })  — becomes public
```

Every stage instance is frozen and holds no mutable state between runs. Calling
`.run()` twice with the same input returns equal output. Reusing one `Parser`
across a thousand keystrokes is the intended usage.

## 4. The stages

### 4.1 Normalizer

The stage that tries to make input valid, and reports what it could and could
not do.

```ts
interface Edit {
  readonly at: Span;          // in the source
  readonly length: number;    // replacement length in the normalized text
  readonly reason: "nfkc" | "zero-width" | "dash" | "degree" | "whitespace" | "trim";
}

interface NormalizedInput {
  readonly source: string;    // exactly what the caller passed
  readonly text: string;      // what every later stage reads
  readonly edits: readonly Edit[];
  /** Translate a span in `text` back to a span in `source`. */
  mapSpan(span: Span): Span;
  readonly empty: boolean;    // text.length === 0
}

class Normalizer {
  constructor(cfg?: NormalizerOptions);
  run(input: string): NormalizedInput;
}

function normalize(input: string, opts?: NormalizerOptions): NormalizedInput;
```

`NormalizerOptions` exposes the passes individually (`nfkc`, `dashes`,
`degree`, `whitespace`, `trim`), all on by default, so a caller who needs `°`
preserved can keep it.

**Never throws.** Empty input is `empty: true`, and it is the caller's or the
engine's job to decide that is an error — today `createEngine` throws
`UnitParseError` on it, and that behaviour is preserved in the composed engine,
not in the stage.

`mapSpan` is the §1 fix. It is a binary search over `edits` — a handful of
entries for a launcher-length string.

**Divergence from the micro path, stated:** the engine strips `°` before
lexing, so `deg` never sees it. The validate spec's `temperature` table instead
lists `°c` as an alias, because that path has no normalizer. Both are right for
their path; neither should be "fixed" to match the other.

**The repair seam.** "At least tries, it's not always possible" gets a hook
rather than a feature: `NormalizerOptions.repair?: (text, ctx) => Edit[]`, run
after the built-in passes. Fuzzy unit correction (`"30d"` → `"30deg"`) lands
there later, alongside the validate spec's `resolve` seam, without changing
anything specified here.

### 4.2 Tokenizer

Owns lexing and all three fold passes, which today are four separate calls with
different argument shapes.

```ts
interface TokenStream {
  readonly input: NormalizedInput;
  readonly tokens: readonly Token[];
}

class Tokenizer {
  constructor(cfg: {
    locale: Locale;
    registry: Registry;
    now?: () => number;
    timeZone?: string;
  });
  run(input: string | NormalizedInput, opts?: { timeZone?: string }): TokenStream;
}
```

Accepting either a raw string or a `NormalizedInput` is what makes the stages
composable in practice: pass a string for the common case, pass a
`NormalizedInput` when you normalized yourself with different options.

`MatchCtx` — `{ locale, now, timeZone, isUnitAlias }` — is built here rather
than in the engine closure, which is the only place it was ever needed.

The underlying functions stay exported and unchanged: `lex`, `foldLiterals`,
`foldNumerals`, `foldWordOps`. A caller who wants numerals folded but not word
operators composes them directly.

### 4.3 Parser → `Program`

```ts
type NodeId = number;

interface Program {
  readonly root: Node;
  /** Depth-first, id-indexed. `nodes[n.id] === n` for every node. */
  readonly nodes: readonly Node[];
  readonly input: NormalizedInput;
}

class Parser {
  constructor(cfg: { resolver: Resolver });
  run(stream: TokenStream): Program;
}
```

Every `Node` gains `readonly id: NodeId`, assigned depth-first at parse time.
That single field is what makes `Resolution` a value rather than a pointer
(S3), and what lets a printer or a UI address a subexpression without holding
the object.

The node union is otherwise unchanged: `number`, `quantity`, `literal`,
`binary`, `unary`, `convert`. `walk` stays. The tree is frozen.

**Why a tree and not a list.** `Program` *is* the "list of commands" — it is
just that the list has structure, because `2 * (3 + 4)` does. A flat postfix
stream would be a lossy projection: the printer would have to re-derive where
parentheses go, and every span would have to be carried on the instruction
rather than read off the node. The tree already has both.

### 4.4 Solver → `Resolution`

```ts
interface Resolution {
  /** Keyed by NodeId, not by node object. */
  readonly choices: Readonly<Record<NodeId, Candidate>>;
  readonly kind: KindId;
  readonly score: number;
  readonly contextBonus: number;
  readonly confidence: number;
}

class Solver {
  constructor(cfg: {
    registry: Registry;
    maxCandidates?: number;
    ambiguityEpsilon?: number;
    tiebreak?: "error" | "first";
  });
  /** Every consistent assignment, ranked. Never throws on ambiguity. */
  all(program: Program, opts?: { kinds?: KindId[] }): Resolution[];
  /** The winner, applying epsilon and tiebreak. Throws AmbiguityError. */
  best(program: Program, opts?: { kinds?: KindId[] }): Resolution;
  /** The best resolution whose result kind is `kind`, or undefined. */
  forKind(program: Program, kind: KindId, opts?): Resolution | undefined;
}
```

`best()` is where the epsilon-and-tiebreak block currently inlined in
`evaluate()` moves (S6). `forKind()` is what `coerce()` open-codes today.
Having all three named in one place is what stops the fourth caller from
inventing a fourth variant.

`Assignment` is renamed `Resolution` and its `choices` re-keyed. `Assignment`
remains exported as a deprecated type alias for one minor version.

### 4.5 Evaluator

```ts
interface Evaluation {
  readonly value: Value;
  readonly assumptions: readonly Assumption[];
}

class Evaluator {
  constructor(cfg: {
    registry: Registry;
    locale: string;              // locale id, as evaluateNode takes today
    kindMeta?: Record<KindId, Record<string, unknown>>;
    rates?: RateLookup;
  });
  run(program: Program, resolution: Resolution): Evaluation;
}
```

`evaluateNode` stays exported, taking the same explicit options object it takes
today, with `node` + `assignment` becoming `program` + `resolution`.

### 4.6 Printer — the new stage

Two jobs, deliberately in one class because they share the registry and locale:
render a `Value` (what `formatValue` does today) and render a `Program` (what
nothing does today).

```ts
type PrintMode = "canonical" | "verbatim" | "resolved";

interface PrintOptions {
  mode?: PrintMode;                // default "canonical"
  resolution?: Resolution;         // required for "resolved"
  unit?: string;                   // rebase every quantity of the result kind
  spelled?: boolean;               // "thirty degrees plus fifteen degrees"
  symbols?: boolean;               // "30° + 15°" vs "30 deg + 15 deg"
  precision?: number;
  spacing?: "tight" | "normal";    // "30deg+15deg" vs "30 deg + 15 deg"
}

class Printer {
  constructor(cfg: { registry: Registry; locale: Locale; rates?: RateLookup; rounding?: Decimal.Rounding });
  print(program: Program, opts?: PrintOptions): string;
  node(program: Program, id: NodeId, opts?: PrintOptions): string;
  value(value: Value, opts?: FormatOptions): string;   // today's formatValue
}
```

The modes:

| Mode | Reads | Produces | For |
| --- | --- | --- | --- |
| `canonical` | `Program` | normalized units, canonical spacing | round-trip tests, "what we understood" |
| `verbatim` | `Program.input.source` + spans | exactly what the user typed | echoing input, diffing against canonical |
| `resolved` | `Program` + `Resolution` | the solver's chosen units substituted | making ambiguity visible: `10 m + 5 min` prints `10 min + 5 min` |

`resolved` is the one that earns the stage. The single most confusing thing the
engine does is silently pick between `m`-as-metres and `m`-as-minutes; printing
the resolution is how a UI shows the choice instead of hiding it.

**Round-trip contract:** for every input in the corpus,
`parse(print(program, { mode: "canonical" }))` produces a `Program` that
evaluates to the same `Value`. This is a test, not an aspiration — it is what
keeps the printer honest about units the parser cannot read back (`speed`'s
`m/s`, `area`'s `m²`), which is exactly why those kinds carry no `display`
today.

`spelled` reuses `spellNumber` from `@smartput/number` and the locale's
`numerals`, so it is the inverse of the numeral fold that already runs on every
evaluate.

### 4.7 Completer

`complete()` becomes `Completer` with the same config-holding shape. No
behaviour change; included so the stage set is complete and one import style
covers everything.

## 5. `createEngine`, reimplemented

The whole point: the engine becomes a readable assembly of the parts, and
nothing in it is unavailable to a caller.

```ts
export function createEngine(opts: EngineOptions): Engine {
  const locale = opts.locales[0];
  if (locale === undefined) throw new Error("createEngine requires at least one locale");

  const registry = buildRegistry(opts.kinds ?? [], opts.packs ?? [], locale.id);
  const layers = (call?: Weights) => [locale.weights, opts.weights, call];

  const normalizer = new Normalizer();
  const tokenizer  = new Tokenizer({ locale, registry, now: opts.now, timeZone: opts.timeZone });
  const solver     = new Solver({ registry, maxCandidates: opts.maxCandidates,
                                  ambiguityEpsilon: opts.ambiguityEpsilon, tiebreak: opts.tiebreak });
  const evaluator  = new Evaluator({ registry, locale: locale.id, kindMeta: opts.kindMeta, rates: opts.rates });
  const printer    = new Printer({ registry, locale, rates: opts.rates, rounding: opts.rounding });

  // The Parser is the one stage rebuilt per call: its Resolver closes over the
  // weight layers, and `EvalOptions.weights` is a per-call override.
  const parserFor = (call?: EvalOptions) =>
    new Parser({ resolver: createResolver({ registry, locale, packs: opts.packs ?? [], layers: layers(call?.weights) }) });

  const compile = (input: string, call?: EvalOptions): Program => {
    const normalized = normalizer.run(input);
    if (normalized.empty) throw new UnitParseError(input);
    return parserFor(call).run(tokenizer.run(normalized, { timeZone: call?.timeZone }));
  };

  return {
    evaluate(input, call) {
      const program = compile(input, call);
      return toResult(program, solver.best(program, call), printer, evaluator);
    },
    // suggest / coerce / explain / complete, each three or four lines
  };
}
```

`EngineOptions`, `EvalOptions`, `Result`, `Explanation` and `Engine` are
unchanged. Every existing consumer keeps working (S9).

The one behaviour change is the §1 span fix: `Result.spans` now maps through
`NormalizedInput.mapSpan`, so it indexes the caller's string. This is a bug fix
and is called out in the changelog as one.

## 6. Package layout

Subpath exports, so a caller ships only the stages they touch:

```
@smartput/core                  everything, as today
@smartput/core/normalize        Normalizer, normalize
@smartput/core/tokenize         Tokenizer, lex, foldLiterals, foldNumerals, foldWordOps
@smartput/core/parse            Parser, Program, Node, walk
@smartput/core/solve            Solver, Resolution, weightBreakdown
@smartput/core/eval             Evaluator, evaluateNode, toCanonical
@smartput/core/print            Printer, formatValue
@smartput/core/registry         buildRegistry, createResolver, defineKind
```

The root barrel keeps re-exporting all of it. With `sideEffects: false` and ESM
output it still shakes; the subpaths exist for bundlers that give up on
re-exports and for callers who want the dependency to be visible in the import.

This requires the same build work the validate spec's P1 requires. Whichever
plan lands first does it; the second inherits it.

## 7. Testing

**Parity is the acceptance criterion.** Before any restructuring, snapshot every
`evaluate`, `suggest`, `coerce`, `explain` and `complete` result over the full
`packages/core/corpus` fixture set. After, they must match byte for byte — with
one allowed diff, the span fix, which gets its own explicit expectations.

**Per-stage golden tests.** Each stage gets a table of input → frozen output,
independent of every other stage. This is the thing that is impossible today:
`Tokenizer` tests need no solver, `Solver` tests need no evaluator.

**Span regression.** The four inputs in §1, plus a property test: for every
corpus input and every node, `source.slice(mapSpan(node.span))` must equal the
text that node was built from, modulo normalization.

**Printer round-trip.** §4.6's contract, over the corpus.

**Printer modes.** `verbatim` reproduces the source exactly. `resolved` differs
from `canonical` on exactly the ambiguous inputs, and the corpus already has
them.

**Composition test.** A test that builds a pipeline by hand — five stages, no
`createEngine` — and gets the same `Value`. If that test is awkward to write,
the decomposition failed and the test is the place to find out.

**Immutability.** Every stage output frozen; every stage instance frozen; two
`.run()` calls on one instance return equal results.

## 8. Phasing

| Phase | Scope | Done when |
| --- | --- | --- |
| **P0 — Parity net** | Snapshot the entire public surface over the corpus. No production changes. | Snapshots committed and green on `main`. |
| **P1 — Normalizer** | `NormalizedInput`, `edits`, `mapSpan`, `NormalizerOptions`. Engine threads it. Span fix lands here. | §7's span tests pass; parity snapshots differ only in spans. |
| **P2 — Node ids + Program** | `id` on every node, `nodes[]`, `Program`, `Resolution` re-keyed, `Assignment` deprecated alias. | Parity green. |
| **P3 — Stage classes** | `Tokenizer`, `Parser`, `Solver`, `Evaluator`, `Completer`; `createEngine` reimplemented as §5. | Parity green; composition test passes; `createEngine` under 60 lines. |
| **P4 — Printer** | The new stage, three modes, round-trip and mode tests. | Round-trip contract holds over the corpus. |
| **P5 — Subpaths** | §6's export map, `sideEffects: false`, `check-deps` extension. | Bundling `@smartput/core/normalize` alone does not pull the solver. |

P0 is not optional. A restructuring of this size without a parity net is a
rewrite with extra steps.

## 9. Out of scope

`Program` serialization (S7). Any change to the solver's scoring, the weight
model, the lexer's grammar, or the kind contract. New kinds. The fuzzy repair
implementation — only its seam (§4.1) lands here. Async anything. Incremental
or streaming parsing, and parse caching across keystrokes: the stages make both
possible, and neither is specified here.
