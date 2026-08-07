---
title: Stages
description: The seven classes createEngine assembles, each usable alone and importable from its own subpath.
---

# Stages

`createEngine` is a composition of seven frozen, config-holding classes over
the pipeline described in [The pipeline](/guide/pipeline). Each one is usable
on its own — reused across a thousand keystrokes, tested independently of
every other stage, or wired into a pipeline you build by hand. Every stage
constructor freezes its instance, so none holds mutable state between calls.
`.run()` (or `.all()`/`.best()`/`.forKind()`, `.print()`/`.node()`/`.value()`)
is otherwise a pure function of its input — with one exception: `Tokenizer`
additionally reads an injectable clock once per `run()`, by design (a
long-lived instance must not freeze its own clock), so two calls with the
same string can fold a literal like `"3pm"` to a different `Value` across
calls.

## Composing a pipeline by hand

The same five stages `createEngine` assembles, wired together directly —
adapted from `packages/core/src/stages.test.ts`, which checks this pipeline
against `createEngine` on a plain quantity, a binary expression and a
convert:

```ts
import { Evaluator } from "@smartput/core/eval";
import en from "@smartput/core/locale/en";
import { Normalizer } from "@smartput/core/normalize";
import { Parser } from "@smartput/core/parse";
import { buildRegistry, createResolver } from "@smartput/core/registry";
import { Solver } from "@smartput/core/solve";
import { Tokenizer } from "@smartput/core/tokenize";
import { BUILTIN_KINDS } from "@smartput/kinds";

const registry = buildRegistry(BUILTIN_KINDS, [], en.id);
const resolver = createResolver({ registry, locale: en, packs: [], layers: [en.weights] });

const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale: en, registry });
const parser = new Parser({ resolver });
const solver = new Solver({ registry });
const evaluator = new Evaluator({ registry, locale: en.id });

function evaluate(input: string) {
  const normalized = normalizer.run(input);
  const stream = tokenizer.run(normalized);
  const program = parser.run(stream);
  const resolution = solver.best(program);
  return evaluator.run(program, resolution).value;
}

evaluate("1 kg + 500 g");
// { kind: "mass", canonical: Decimal(1500), unit: "kg" }
```

Every name above is publicly reachable from its own subpath. `Parser`'s one
required config field — a `Resolver` — comes from `@smartput/core/registry`,
which is also where `buildRegistry` lives; nothing but `createResolver`
builds one.

## Normalizer

```ts
class Normalizer {
  constructor(cfg?: NormalizerOptions);
  run(input: string): NormalizedInput;
}
function normalize(input: string, opts?: NormalizerOptions): NormalizedInput;
```

`@smartput/core/normalize`. Never throws — empty input comes back as
`{ empty: true }`. `NormalizedInput.mapSpan` translates a span in the
normalized text back into the caller's own string; see
[The pipeline](/guide/pipeline#stage-1-normalizer) for `NormalizerOptions`
and what each pass does.

```ts
import { Normalizer } from "@smartput/core/normalize";

new Normalizer().run("  30 deg  ");
// { source: "  30 deg  ", text: "30 deg", edits: [...], empty: false, mapSpan: [Function] }
```

## Tokenizer

```ts
class Tokenizer {
  constructor(cfg: { locale: Locale; registry: Registry; now?: () => number; timeZone?: string });
  run(input: string | NormalizedInput, opts?: { timeZone?: string }): TokenStream;
}
```

`@smartput/core/tokenize`, alongside the four pure functions it composes:
`lex`, `foldLiterals`, `foldNumerals`, `foldWordOps`. Accepts either a raw
string or a `NormalizedInput` — pass the latter when you normalized yourself
with non-default `NormalizerOptions`.

```ts
import { Tokenizer } from "@smartput/core/tokenize";

const tokenizer = new Tokenizer({ locale: en, registry });
const stream = tokenizer.run("1 kg + 500 g");
stream.tokens.map((t) => t.type); // ["number", "word", "op", "number", "word"]
```

## Parser

```ts
class Parser {
  constructor(cfg: { resolver: Resolver });
  run(stream: TokenStream): Program;
}
```

`@smartput/core/parse`. Builds a `Program` — an id-indexed, frozen tree —
out of a `TokenStream` and a `Resolver`. The pure function underneath is
`buildProgram(root, input)`, which assembles and freezes the tree and checks
that every node's `id` is assigned exactly once; unlike every other stage
here, it is exported from the root barrel only, not yet from
`@smartput/core/parse` itself. The Pratt tree-builder underneath *that*
(`parse`) is a private implementation detail with no public export at all —
`Parser.run` is the one door onto both steps.

```ts
import { Parser } from "@smartput/core/parse";
import { createResolver } from "@smartput/core/registry";

const resolver = createResolver({ registry, locale: en, packs: [], layers: [en.weights] });
const parser = new Parser({ resolver });
const program = parser.run(stream); // stream from the Tokenizer example above
program.nodes[program.root.id] === program.root; // true
```

## Solver

```ts
class Solver {
  constructor(cfg: {
    registry: Registry;
    maxCandidates?: number;      // default 10_000
    ambiguityEpsilon?: number;   // default 0.05
    tiebreak?: "error" | "first"; // default "error"
  });
  all(program: Program, opts?: { kinds?: KindId[] }): Resolution[];
  best(program: Program, opts?: { kinds?: KindId[] }): Resolution;
  forKind(program: Program, kind: KindId, opts?: { kinds?: KindId[] }): Resolution | undefined;
}
```

`@smartput/core/solve`, alongside `weightBreakdown` — the same per-candidate
accounting `explain()` uses. `all()` is every consistent assignment, ranked,
and never throws on ambiguity; `best()` is where the epsilon-and-tiebreak
check that used to live inside `evaluate()` now lives, and throws
`AmbiguityError`; `forKind()` is what `coerce()` used to open-code, returning
the best `Resolution` whose result kind matches, or `undefined`. The bare
`solve()` function this class wraps is exported from the root barrel but not
from this subpath.

```ts
import { Solver } from "@smartput/core/solve";

const solver = new Solver({ registry });
const resolution = solver.best(program); // program from the Parser example above
resolution.kind; // "mass"
// keyed by NodeId, one entry per operand node — "1 kg + 500 g" has two
Object.values(resolution.choices); // [{ kind: "mass", unit: "kg", ... }, { kind: "mass", unit: "g", ... }]
```

## Evaluator

```ts
class Evaluator {
  constructor(cfg: {
    registry: Registry;
    locale: string;   // locale id, not the Locale object
    kindMeta?: Record<KindId, Record<string, unknown>>;
    rates?: RateLookup;
  });
  run(program: Program, resolution: Resolution): Evaluation;
}
```

`@smartput/core/eval`, alongside the pure function underneath —
`evaluateNode`, which takes the same options explicitly — and `toCanonical`,
the conversion primitive `Evaluator` and `Printer` both use.

```ts
import { Evaluator } from "@smartput/core/eval";

const evaluator = new Evaluator({ registry, locale: en.id });
evaluator.run(program, resolution); // program/resolution from the Solver example above
// { value: { kind: "mass", canonical: Decimal(1500), unit: "kg" }, assumptions: [] }
```

`Evaluator` copies `kindMeta` at construction but holds `rates` (and
`registry`) by reference — one instance of the rule every stage's
config-holding follows: an already-built service object (`registry`, `rates`,
a `Resolver`) is held by reference, since nothing incrementally mutates it
after handing it over, while a caller-assembled bag (`kindMeta`,
`NormalizerOptions`, `Autocompleter`'s `layers`) is copied, since a caller
could keep adding to or reassigning entries on the object they passed in
after construction. `Tokenizer`, `Parser` and `Solver` copy nothing at all —
every one of their *object-valued* config fields is a service object under
this rule. (Their scalars — `Tokenizer`'s `now`/`timeZone`, `Solver`'s
`maxCandidates`/`ambiguityEpsilon`/`tiebreak` — are neither copied nor held
by reference; a primitive has no such distinction to make.)

## Printer

```ts
class Printer {
  constructor(cfg: { registry: Registry; locale: Locale; rates?: RateLookup; rounding?: Decimal.Rounding });
  print(program: Program, opts?: PrintOptions): string;
  node(program: Program, id: NodeId, opts?: PrintOptions): string;
  value(v: Value, opts?: FormatOptions): string;
}
```

`@smartput/core/print`. The stage that did not exist before this
restructuring — full reference, including the three modes and the round-trip
contract, at [Printer](/api/printer). Unlike every stage above, `print` and
`node` have no free-function twin at all — `formatValue`, exported alongside
`Printer`, backs `value()` only. The class-and-pure-function pairing is
uneven this way across all four export lists: `/eval` exports `evaluateNode`
outright, `/parse` and `/solve` withhold `buildProgram`/`solve` from their
own subpaths (both noted above), and `/print` has no twin at all for
`print`/`node`. Each of the four matches spec §6's own export list exactly —
the unevenness is a stated decision, not residue left over from an
incomplete pass.

## Autocompleter

```ts
class Autocompleter {
  constructor(cfg: { registry: Registry; locale: Locale; layers: (Weights | undefined)[] });
  run(input: string, opts?: CompleteOptions): readonly Completion[];
}
```

`complete()` holding its own config, the same shape as every stage above —
no behaviour change from before this restructuring. Named `Autocompleter`
rather than `Completer` because `Completer` already names the kind contract's
completion hook (`Kind.completions?: Completer`); barrel-exporting both under
one name would let the class shadow the type. Unlike the other six stages, it
has **no subpath of its own** — there is no `@smartput/core/complete` — so
`Autocompleter` is reachable only from the root barrel. It also runs on a raw
input string rather than a `Program`: a completion is offered for text that,
by definition, does not yet parse. Full reference: [`complete()`](/api/complete).
