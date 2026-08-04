---
title: Types
description: Every exported type in @smartput/core.
---

# Types

All types are exported from the package root. `verbatimModuleSyntax` is on in
this codebase, so import them with `import type`.

## Core identifiers

```ts
type KindId = string;
type OpSymbol = "+" | "-" | "*" | "/" | "in";
type Keyword = "in" | "to" | "as" | "plus" | "minus" | "of";
type Selector = string;              // "token:m" | "duration:min" | "duration"
type Weights = Record<Selector, number>;
```

## Value

```ts
interface Value {
  readonly kind: KindId;
  readonly canonical: Decimal;   // always in the kind's canonical unit
  readonly unit: string;         // the authored unit, drives formatting
  readonly meta?: Readonly<Record<string, unknown>>;
}

interface Span {
  start: number;
  end: number;
}
```

`meta` is the one generic escape hatch. `Measure` carries its dpi there; nothing
else in the engine reads it.

## Kind

```ts
interface Kind {
  id: KindId;
  value: RatioSpec | OpaqueSpec;
  extendsKind?: KindId;
  prior?: number;
  lexicon?: Lexicon;
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number>;
  affine?: { deltaKind: KindId };
}

interface OpaqueSpec {
  mode: "opaque";
  parse: (token: string, ctx: EvalCtx) => unknown | null;
  equals: (a: unknown, b: unknown) => boolean;
}

interface UnitDef {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;
  aliases?: string[];
}

interface OpSignature {
  op: OpSymbol;
  left: KindId;
  right: KindId;
  result: KindId;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}
```

## Vocabulary

```ts
interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
}

type Lexicon = Record<string, UnitLexeme | string[]>;
```

## Locale

```ts
interface Locale {
  id: string;
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];
  analyze?: Analyzer[];
  numerals?: (word: string) => Decimal | null;
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}

interface NumberFormatSpec {
  group: string;
  decimal: string;
}

interface LocalePack {
  locale: string;
  contributes: Record<KindId, Lexicon>;
  analyze?: Analyzer[];
}

type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];

interface AnalyzedForm {
  form: string;
  weight?: number;
  tags?: string[];
}

interface AnalyzeCtx {
  locale: string;
}
```

## Contexts

```ts
interface EvalCtx {
  readonly self: Value;
  readonly locale: string;
}

interface FormatCtx {
  readonly locale: string;
}
```

## Engine surface

```ts
interface EngineOptions {
  locales: Locale[];
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
}

interface EvalOptions {
  kinds?: KindId[];
  weights?: Weights;
}

interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;
  spans: Span[];
  meta: { assumptions: Assumption[] };
}

interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
}
```

## Introspection

```ts
interface Candidate {
  readonly kind: KindId;
  readonly unit: string;
  readonly weight: number;
  readonly surface: string;        // exactly as typed
  readonly foldedSurface: string;  // what `token:` selectors match
  readonly form: string;           // lemma the analyzer chain produced
  readonly analyzerWeight: number; // a summand of `weight`
}

interface ResultCandidate {
  kind: KindId;
  unit: string;
  confidence: number;
}

interface Explanation {
  input: string;
  tokens: Token[];
  candidates: Candidate[];
  assignments: Array<{
    kind: KindId;
    score: number;
    confidence: number;
    units: string[];
    contributions: Array<{ selector: string; value: number; layer: number }>;
  }>;
}
```

## Token

```ts
type Token =
  | { type: "number"; value: Decimal; text: string; start: number; end: number }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number };
```

`Token` is exported explicitly because `Explanation.tokens` is `Token[]` — the
type would otherwise be unnameable downstream.

## Decimal

`Decimal` is re-exported from `decimal.js`, so consumers do not have to add the
dependency to name the type of `Value.canonical`.

```ts
import { Decimal } from "@smartput/core";
```
