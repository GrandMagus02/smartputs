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
type OpSymbol = "+" | "-" | "*" | "/" | "in" | "of";
type Keyword = "in" | "of" | "plus" | "minus" | "times" | "over" | "by";
type Selector = string;              // "token:m" | "duration:min" | "duration"
type Weights = Record<Selector, number>;
```

`Keyword` names the **keys** of `Locale.keywords`, not the surface words. A
locale lists every word that means conversion under `in` — English has `"in"`,
`"to"`, `"as"` — so `"to"` is a value, never a key, and a `Keyword` of `"to"` is
unreachable by construction.

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
  literals?: LiteralMatcher[];
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number | Decimal>;
  affine?: { deltaKind: KindId };
  /**
   * The unit whose ratio reads `meta.dpi`. Declaring it is what gives this
   * kind's facade a `.dpi` getter and `withDpi()`; a kind that does not
   * declare it gets neither.
   */
  dpiUnit?: string;
}

interface OpaqueSpec {
  mode: "opaque";
  /** Units as labels rather than ratios — `datetime`'s are IANA time zones. */
  units?: Record<string, UnitLexeme | string[]>;
  parse?: (token: string, ctx: EvalCtx) => unknown | null;
  equals?: (a: unknown, b: unknown) => boolean;
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
  /** Recorded on the Result whenever this signature is applied. */
  assumption?: Assumption;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}
```

## Literal recognition

A kind's escape hatch out of the `<number><unit-word>` shape. See
[`defineKind`](/api/define-kind#literals).

```ts
type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | null;

interface LiteralMatch {
  readonly kind: KindId;
  /** A unit registered by the kind. Never a free-form string. */
  readonly unit: string;
  readonly canonical: Decimal;
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Characters consumed starting at the offered offset. Must be > 0. */
  readonly length: number;
  /** Summed into the candidate's score, exactly like an analyzer's weight. */
  readonly weight?: number;
}

interface MatchCtx {
  readonly locale: string;
  /** Epoch milliseconds of "now", from `EngineOptions.now`. */
  readonly now: number;
  /** IANA zone, from `EvalOptions.timeZone ?? EngineOptions.timeZone`. */
  readonly timeZone: string;
  /** True when `text` is a registered unit alias of any kind. */
  isUnitAlias(text: string): boolean;
}
```

## Vocabulary

```ts
interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /**
   * The magnitude band people actually type this unit in, inclusive at both
   * ends. Read only by completion's `scaleFit`. Omitting it scores 0 — the
   * same as being out of band, so declaring one is never a penalty.
   */
  typical?: [number, number];
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
  numerals?: NumeralParser;
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}

/**
 * Offered a run of consecutive words, claims a prefix of it. The single-word
 * signature this replaced could not express "one thousand thirty two": it saw
 * one word and had no way to ask for more.
 */
type NumeralParser = (words: string[]) => NumeralMatch | null;

interface NumeralMatch {
  value: Decimal;
  /** How many of the offered words the parser claimed, from the front. */
  consumed: number;
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
  /** The source expression. Absent during a standalone conversion. */
  readonly input?: string;
  /** The engine's injected rate table, when one was supplied. */
  readonly rates?: RateLookup;
  /** Records an assumption made while converting. Absent where there is no Result. */
  readonly note?: (a: Assumption) => void;
}

interface FormatOptions {
  readonly precision?: number;          // significant digits. Default 26
  readonly rounding?: Decimal.Rounding;
  readonly rates?: RateLookup;
  /** Pad the fraction to at least this many digits — money needs "30.00". */
  readonly minFractionDigits?: number;
}

interface FormatCtx extends FormatOptions {
  readonly locale: string;
  /** `value.canonical` already converted into `value.unit`. */
  readonly authored: Decimal;
  /** Locale-aware, pre-bound. A `format` hook MUST render through it. */
  formatNumber(value: Decimal, opts?: FormatOptions): string;
}
```

A `format` hook gets `authored` so it never has to resolve a unit ratio itself —
which, for money, would mean reaching the rate table from inside the formatter.

## Rates and assumptions

```ts
/**
 * The shape the engine needs from a rate table. `@smartput/rates`'s
 * RateSnapshot satisfies it structurally; core imports nothing.
 */
interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}

/** A defensible-but-not-unique reading of the input, surfaced on the Result. */
interface Assumption {
  readonly code: string;     // stable and machine-readable
  readonly message: string;  // human-facing, may be reworded
  readonly detail?: Readonly<Record<string, string>>;
}
```

`get` returns `null` for an unknown pair rather than throwing, so the kind that
asked decides what a missing rate means — `money` raises `MissingRateError`; a
different kind might fall back.

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
  kindMeta?: Readonly<Record<KindId, Readonly<Record<string, unknown>>>>;
  formatPrecision?: number;
  rates?: RateLookup;
  rounding?: Decimal.Rounding;
  /** Injectable clock, epoch milliseconds. Default `Date.now`. */
  now?: () => number;
  /** IANA zone every literal matcher resolves against. Default: the host zone. */
  timeZone?: string;
}

interface EvalOptions {
  kinds?: KindId[];
  weights?: Weights;
  timeZone?: string;
}

interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;
  spans: Span[];
  meta: { ratesAsOf?: string; assumptions: Assumption[] };
}

interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
  complete(input: string, opts?: CompleteOptions): Completion[];
}
```

## Completion

```ts
interface Completion {
  alias: string;   // the alias that matched, e.g. "hour"
  span: Span;      // the fragment it replaces, as offsets into the input
  text: string;    // the whole input rewritten
  kind: KindId;
  unit: string;    // registry unit key, e.g. "h"
  score: number;
}

interface CompleteOptions {
  kinds?: KindId[];
  weights?: Weights;
  limit?: number;  // applied after ranking. Default 10
}
```

See [`complete()`](/api/complete).

## Facade

```ts
interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly dpi?: number | undefined;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): QuantitySnapshot;
  add?(other: QuantityInput): Quantity;      // ratio kinds only
  sub?(other: QuantityInput): Quantity;
  scale?(factor: Decimal | number | string): Quantity;
  negate?(): Quantity;
  diff?(other: QuantityInput): Quantity;     // affine kinds only
  withDpi?(dpi: number): Quantity;           // kinds declaring dpiUnit only
}

interface QuantitySnapshot {
  readonly value: string | number;  // toJSON emits a decimal string; a
                                    // micro-path ValueInstance carries a double
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

type QuantityInput = Quantity | QuantitySnapshot | number | string;

interface QuantityClass {
  new (value: Decimal | number | string, unit: string, meta?: Record<string, unknown>): Quantity;
  from(input: QuantityInput): Quantity;
  parse(text: string): Quantity;
  readonly kindId: KindId;
}
```

See [createFacade](/api/facade).

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
