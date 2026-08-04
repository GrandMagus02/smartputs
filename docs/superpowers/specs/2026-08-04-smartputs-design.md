# smartputs — Design Spec

**Date:** 2026-08-04
**Status:** Approved, pending implementation plan

## 1. Purpose

A TypeScript library that parses and evaluates human-written expressions mixing
dates, durations, physical units, currencies, and colors — the engine behind a
Raycast-style calculator, usable as a plain library, a launcher backend, or a
smart form input.

Examples of accepted input:

```
today
next week monday
10 C
20 pounds
30 usd - 10 eur
30 hours - 10 minutes
210mm in pt
червоний
#fff000
```

### Why this project exists

No JavaScript library covers this. The pieces exist in isolation and nothing
joins them:

| Domain | Existing option | Assessment |
| --- | --- | --- |
| Date/time/duration math | `temporal-polyfill` (2.8M/wk, actively published) | Borrow. Correct DST and calendar semantics. |
| Natural-language dates | `chrono-node` (4.6M/wk, maintained) | Borrow, behind a bridge. |
| Decimal arithmetic | `decimal.js` (78M/wk) | Borrow. Never use float for money. |
| Physical units | `js-quantities` (unmaintained since 2023), `convert-units` (conversion only, no algebra), `unitmath` (1.4k/wk), `mathjs` (full CAS, heavy, poor money model) | Write our own. This is the gap. |
| Money + FX | `dinero.js` v2 (immutable, but no FX, no parsing, throws on mixed currency) | Write our own on `decimal.js`. |
| Color | `@urcolor/core` + `@urcolor/i18n` (ours) | Reuse. |

The strongest evidence of the gap: Flare, the Raycast-compatible Linux launcher,
binds the closed-source Swift SoulverCore because no JavaScript equivalent
exists.

### Non-goals

Not a computer algebra system. Not a natural-language question answerer. Not an
LLM wrapper. It parses and evaluates expressions; it does not answer questions
about them.

## 2. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Three layered entry points: `evaluate()` strict, `suggest()` ranked, `coerce<K>()` type-directed | One pipeline serves library, launcher, and form-input consumers. |
| D2 | Own value classes; borrow Temporal, chrono, Decimal | Unit libraries on npm are weak or wrong-shaped; time and numerics are solved. |
| D3 | Single `defineKind()` descriptor as the only registration primitive, with `extendsKind` for patching | One concept to learn. Built-ins register through the same public API. |
| D4 | All kinds ship in v1 | Marginal cost per numeric kind is ~30 lines of table once the engine exists. |
| D5 | Scored candidates with a strict/loose split | `10 m` is genuinely ambiguous; context (`10 m + 5 min`) must be able to resolve it. |
| D6 | Sync core with injected `RateSnapshot`; separate async facade | Keystroke-rate parsing and deterministic tests require a pure sync core. |
| D7 | Hand-authored parsing lexicons; runtime `Intl` for formatting and number grammar | `Intl` provides canonical display forms, not the input variants people type. |
| D8 | Medium package split | Kinds share dimension algebra; splitting per-kind costs churn for no bundle win. |

Rejected: Yahoo Finance as the rate source. No official public API; the
`query1.finance.yahoo.com` endpoints are undocumented, cookie/crumb gated, and
redistribution breaches their terms. Default provider is the ECB daily reference
rates — official, free, no key, ~30 fiat currencies. CoinGecko's free tier covers
crypto.

## 3. Architecture

Seven stages. Ambiguity stays open until stage 5; that is what makes
`10 m + 5 min` resolve to minutes.

```
input string
  │
  1. Normalize      NFKC, case-fold, strip zero-width, unify − – — → -, ° optional
  │
  2. Lex            locale-aware. NUMBER | WORD | SYMBOL | OP | KEYWORD | PAREN
  │                 numbers read via locale numberFormat (1.000,50 vs 1,000.50)
  │
  3. Candidates     each WORD/SYMBOL → Set<{kind, unit, prior}> from merged lexicons
  │                 "m" → [{length,m,.55}, {duration,min,.52}]   ← both kept
  │
  4. Parse          Pratt parser → AST. Nodes carry candidate SETS, not choices.
  │                 infix + - * / ^, prefix -, "in"/"to"/"as", postfix %, parens,
  │                 per-locale keyword aliases
  │
  5. Solve          constraint propagation over the AST. Unify kinds across
  │                 operands, score each consistent assignment, take argmax.
  │
  6. Evaluate       walk the AST with kinds resolved. Ops dispatched off the Kind
  │                 descriptor. Arithmetic in canonical units, Decimal throughout.
  │
  7. Format         Value → string. Intl for number/date grammar, lexicon for
  │                 unit words.
  ▼
Result { value, formatted, kind, confidence, spans, meta }
```

### Stage 5: the solver

The load-bearing component and the only part with real invention risk.

```ts
solve(node): Assignment[]
  BinaryOp(+|-)  → left.kind must equal right.kind, or both coercible via a
                   Kind's `unify` hook
  BinaryOp(in)   → right is a unit token; its kind constrains left
  BinaryOp(*|/)  → dimension algebra: length/duration → speed, if some Kind
                   declares that signature
  Literal        → its candidate set

score(assignment) = Σ prior(token)      // lexicon / kind priority
                  + contextBonus        // sibling agreement
                  + localeBonus         // active locale's overrides
                  + callerHint          // opts.kinds, or the coerce<K> target
```

Candidate sets are small (1–3 entries), so exhaustive search over assignments is
acceptable. Guarded by `maxCandidates` (default 10,000); exceeding it raises
`TooAmbiguousError`.

`coerce<K>()` injects a hard constraint at this stage rather than running a
second code path, so type-directed parsing shares all solver behaviour.

### Value model

Internally a value is flat: `{ kind, canonical: Decimal, unit, meta? }`. No class
instances are allocated during solving. Facade classes (`Weight`, `Distance`,
`Measure`, `Temperature`, `TempDelta`, `Angle`, `Money`, `Duration`, …)
materialize only at the API boundary and are generated from the Kind descriptor,
so plugin-defined kinds get the same surface as built-ins.

Facade surface, matching `@urvis/unit`:

| Member | Meaning |
| --- | --- |
| `new X(value, unit)` | construct in an authored unit |
| `X.from(input)` | coerce an instance, number, or string; instances pass through |
| `X.parse("5kg")` | parse `<number><unit>`; throws `UnitParseError` |
| `.value` | the authored value, stored verbatim |
| `.unit` | the authored unit, drives `toString()` |
| `.to(unit)` | convert to another unit of the kind |
| `.as(unit)` | rebase on `unit`, same physical quantity |
| `.equals(other, epsilon?)` | compare canonical values across units |
| `.toString()` | back to the authored unit, e.g. `"210mm"` |
| `.toJSON()` | `{ value, unit }` |
| `add`, `sub`, `scale`, `negate` | ratio kinds only |

Results keep the left operand's unit: `new Weight(1,"kg").add("500g")` is
`"1.5kg"`. `Temperature` is the exception — it exposes `add(TempDelta)` and
`diff(Temperature) → TempDelta`, and no `scale`.

smartputs re-implements this surface against its registry rather than depending
on `@urvis/unit`, so third-party kinds are first-class.

## 4. Extension contract

```ts
type KindId = string;

export type Kind = {
  id: KindId;
  extendsKind?: KindId;        // patch a built-in; deep-merges lexicon/units/ops
  prior?: number;              // 0..1 base solver score, locale-overridable

  value: RatioSpec | OpaqueSpec;

  lexicon?: Lexicon;           // default (en) aliases; locale packs add more
  literals?: LiteralMatcher[]; // non-word forms: #fff, 2026-01-01, $30
  ops?: OpSignature[];
  format: (v: Value, ctx: FormatCtx) => string;
  facade?: FacadeSpec;         // optional custom class; default generated
};
```

### Ratio kinds

```ts
type RatioSpec = {
  mode: "ratio";
  canonical: string;                       // "metre", "gram", "byte", "eur"
  units: Record<string, UnitDef>;
  dimension?: Dimension;                   // { length: 1, time: -1 } enables * and /
  affine?: { deltaKind: KindId };          // Temperature ↔ TempDelta
  context?: ContextSpec;                   // extra per-value state, e.g. dpi
};

type UnitDef = {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;               // affine only: °F = °C·9/5 + 32
  aliases?: string[];
};

// a Kind's own lexicon is the default (en) layer; Locale packs add to it
type Lexicon = Record<string /* unit */, string[] /* aliases */>;
```

Plain numbers in `ratio` and `offset` are widened to `Decimal` at registration.
Authoring tables as numbers keeps unit definitions readable; nothing downstream
ever sees a float.

The `ratio: (ctx) => Decimal` form is what lets money and dpi-relative
measurement fall out of the general mechanism instead of needing bespoke
engines:

```ts
// money — unit ratios come from the injected snapshot
defineKind({
  id: "money",
  value: { mode: "ratio", canonical: "eur", units: fiatUnits },
});
// fiatUnits.usd = {
//   ratio: (ctx) => ctx.rates.get("USD", "EUR") ?? throwMissingRate("USD", "EUR"),
// }

// measure — px ratio depends on the value's own dpi context
defineKind({
  id: "measure",
  value: {
    mode: "ratio",
    canonical: "inch",
    context: { dpi: { default: 96 } },
    units: {
      inch: { ratio: 1 },
      mm:   { ratio: 1 / 25.4 },
      pt:   { ratio: 1 / 72 },
      px:   { ratio: (ctx) => new Decimal(1).div(ctx.self.dpi) },
    },
  },
});
```

`Measure` carries the dpi its pixels are read against, default 96. Arithmetic
runs in canonical inches, so operands authored at different dpi combine
correctly and the result keeps the left operand's unit and dpi. `withDpi(dpi)`
re-reads the authored value at a new dpi: it changes nothing physical for
dpi-independent units, and re-interprets the pixels for a `px` measure.

### Opaque kinds

For color, datetime, and anything that is not a scalar on a ratio line:

```ts
type OpaqueSpec = {
  mode: "opaque";
  parse: (tok: Token, ctx: EvalCtx) => unknown | null;   // null = not mine
  equals: (a: unknown, b: unknown) => boolean;
};
```

### Cross-kind operations

Declared, not hardcoded. The evaluator knows nothing about dates or speed.

```ts
type OpSignature = {
  op: "+" | "-" | "*" | "/" | "^" | "in";
  left: KindId;
  right: KindId;
  result: KindId;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
};

// declared by the datetime kind:
ops: [
  { op: "+", left: "datetime", right: "duration", result: "datetime",
    apply: (d, dur) => wrap(d.temporal.add(dur.temporal)) },
  { op: "-", left: "datetime", right: "datetime", result: "duration",
    apply: (a, b) => wrap(a.temporal.since(b.temporal)) },
]
```

The solver reads this signature table directly — it is the type system.
Registering a signature immediately makes that expression form parseable.
`10 km / 2 h → speed` works as soon as a `speed` kind declares the dimension.

### `extendsKind` merge rules

- `lexicon`, `units`, `literals`, `ops` — merged; the patch wins on key collision.
- `prior`, `format`, `canonical` — replaced when present.
- `value.mode` mismatch — throws at registration, never at parse time.
- Registration order is irrelevant; conflicts surface as `KindConflictError`
  naming both sources.

Example, adding Ukrainian color names:

```ts
const ukColorNames = defineKind({
  id: "color-uk",
  extendsKind: "color",
  lexicon: { "#ff0000": ["червоний", "червона"] },
});

const engine = createEngine({ locales: [uk, en], kinds: [ukColorNames] });
```

A patch is itself a Kind with its own `id`, registered through the same
`createEngine({ kinds })` channel as any other. There is no mutable global
registry to reach into.

### Locales

Data only, no logic:

```ts
export type Locale = {
  id: string;                    // BCP-47
  numberFormat: "intl" | NumberFormatSpec;
  lexicon: Record<KindId, Record<string /* unit */, string[] /* aliases */>>;
  keywords: Partial<Record<Keyword, string[]>>;   // in/to/as/plus/minus/of/ago/next…
  priors?: Record<KindId, number>;                // e.g. "lb" in en-GB
};
```

```ts
// @smartput/locale-uk
export default defineLocale({
  id: "uk",
  numberFormat: "intl",
  lexicon: {
    mass:  { kg: ["кг", "кіло", "кілограм", "кілограми"] },
    color: { "#ff0000": ["червоний", "червона"] },
  },
  keywords: { in: ["в", "до"], plus: ["плюс"] },
});
```

`defineKind` and `defineLocale` are pure functions returning frozen descriptors.
`createEngine({ kinds, locales, rates })` composes them. Engines with different
locales coexist in one process.

## 5. Packages

```
smartputs/                      Bun workspace, Biome, tsc for .d.ts only
├─ packages/
│  ├─ core/          @smartput/core      registry, lexer, parser, solver, evaluator,
│  │                                     built-in kinds, facade classes, errors
│  ├─ locale-en/     @smartput/locale-en
│  ├─ locale-uk/     @smartput/locale-uk
│  ├─ rates/         @smartput/rates     RateSnapshot, providers, async facade
│  ├─ color/         @smartput/color     @urcolor adapter → color kind
│  ├─ http/          @smartput/http      Hono on Bun, REST + OpenAPI
│  └─ smartputs/     smartputs           meta: core + locale-en + rates/ecb
└─ docs/superpowers/specs/
```

| Package | Runtime dependencies |
| --- | --- |
| `core` | `decimal.js`, `temporal-polyfill`, `chrono-node` |
| `locale-*` | none — data only; peer-dep on core for types |
| `rates` | none in the interface; provider adapters use `fetch` only |
| `color` | `@urcolor/core`, `@urcolor/i18n` (peer) |
| `http` | `hono` (peer), `@smartput/core` |

`chrono-node` is confined to
`packages/core/src/kinds/datetime/chrono-bridge.ts` so it can be swapped or made
optional without touching the solver.

## 6. Public API

```ts
// @smartput/core
export function createEngine(opts: EngineOptions): Engine;
export function defineKind(k: Kind): Kind;
export function defineLocale(l: Locale): Locale;

export interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;           // strict, throws
  suggest(input: string, opts?: EvalOptions): Result[];          // ranked, never throws
  coerce<K extends KindId>(kind: K, input: unknown): ValueOf<K>; // type-directed
  explain(input: string): Explanation;                           // tokens, AST, scores
  with(patch: Partial<EngineOptions>): Engine;                   // immutable derive
}

export type EngineOptions = {
  locales: Locale[];                     // first is primary, rest are fallbacks
  kinds?: Kind[];                        // appended to built-ins
  rates?: RateSnapshot;
  now?: () => Temporal.ZonedDateTime;    // injectable clock
  timeZone?: string;
  maxCandidates?: number;                // solver guard, default 10_000
  ambiguityEpsilon?: number;             // evaluate() throws within this margin, default 0.05
  maxRateAge?: number;                   // ms; opt-in, raises StaleRatesError. Off by default
  rounding?: Decimal.Rounding;           // money formatting, default ROUND_HALF_EVEN
};

export type Result = {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;                    // 0..1, normalized solver score
  spans: Span[];                         // token → source offsets
  meta: { ratesAsOf?: string; assumptions: Assumption[] };
};
```

`explain()` is required, not a nicety: a scored solver is unusable without a way
to inspect why it chose. It is also the debugging surface for plugin authors.

`now` must be injectable — `"today"` and `"next week monday"` are otherwise
untestable.

Behaviour of the three entry points on the same input:

```ts
engine.evaluate("10 m");
// throws AmbiguityError { candidates: [
//   { kind: "length",   unit: "m",   score: 0.55 },
//   { kind: "duration", unit: "min", score: 0.52 } ] }

engine.evaluate("10 m + 5 min");   // 15 min — context wins
engine.evaluate("10 m + 5 km");    // 5010 m
engine.suggest("10 m");            // both candidates, ranked
engine.coerce("mass", "10 m");     // throws NoCandidateError
```

### Rates

```ts
// @smartput/rates
export type RateSnapshot = {
  base: string;
  asOf: string;                                  // ISO
  get(from: string, to: string): Decimal | null; // null → engine throws MissingRate
};

export function snapshot(
  base: string,
  asOf: string,
  table: Record<string, number>,
): RateSnapshot;

export function ecb(): RateProvider;             // free, no key, official, daily
export function coingecko(opts?: CoingeckoOptions): RateProvider;
export function custom(fn: FetchFn): RateProvider;

export function createLiveEngine(
  opts: EngineOptions & { provider: RateProvider; ttlMs?: number },  // default 1h
): LiveEngine;  // async evaluate(), refreshes on TTL, `.sync` exposes the Engine
```

Sync usage:

```ts
const rates = await ecb().fetch();                 // caller's I/O
const engine = createEngine({ locales: [en], rates });
engine.evaluate("30 usd - 10 eur");                // sync, no await
```

### HTTP

```
POST /evaluate   { input, locale?, timeZone?, kinds? }  → Result
POST /suggest    { input, ... }                          → Result[]
GET  /kinds                                              → registered kind metadata
GET  /health                                             → { ratesAsOf, locales }
```

No auth, persistence, or rate limiting in the package — those belong to the
deployer, and baking them in guesses wrong. Ships an OpenAPI document generated
from the same schemas that validate request bodies. Runs on Bun.

## 7. Errors

All extend `SmartputError` and carry `input` and `spans` so callers can underline
the offending token.

| Error | Raised when | Carries |
| --- | --- | --- |
| `UnitParseError` | `X.parse("abc")`; bare number where a unit is required | `input`, `kind` |
| `AmbiguityError` | `evaluate()` top two candidates within `epsilon` (default 0.05) | `candidates: Result[]` |
| `NoCandidateError` | nothing in the registry matches a token | `token`, `nearest: string[]` |
| `DimensionMismatchError` | `5 kg + 3 km` — no matching op signature | `left`, `right`, `op` |
| `MissingRateError` | FX pair absent from the snapshot | `from`, `to`, `asOf` |
| `StaleRatesError` | snapshot older than `maxRateAge` (opt-in, off by default) | `asOf`, `maxAge` |
| `TooAmbiguousError` | assignment search exceeds `maxCandidates` | `count` |
| `KindConflictError` | registration time: two kinds claim the same id or signature | both source ids |
| `DivideByZeroError` | explicit; wraps the Decimal throw | — |

`suggest()` never throws on parse problems; it returns `[]` and the failure is
visible through `explain()`. Registration errors always throw at `createEngine()`
time, never lazily at parse time, so a bad plugin fails on boot.

## 8. Semantics

- **Result unit is the left operand's unit.** `1kg + 500g` is `"1.5kg"`. The same
  rule applies to dpi in `Measure`.
- **Money never rounds mid-expression.** Full Decimal precision through the AST;
  rounding happens once, in `format()`, at the currency's minor-unit scale.
  Default mode `ROUND_HALF_EVEN`, configurable.
- **FX is directional and dated.** Results carry `meta.ratesAsOf`. Cross-rates via
  the base currency (`USD→EUR→UAH`) are recorded in `meta.assumptions`, never
  silent.
- **Absolute and delta temperature are distinct kinds.** `20°C + 5°C` parses as
  `Temperature + TempDelta` with an `Assumption` recorded and `confidence`
  reduced, because that is what humans mean. `20°C + 5°F` also resolves as a
  delta, converted as a delta (2.78°C), not as an absolute. `20°C * 2` always
  raises `DimensionMismatchError`.
- **Percent is contextual**, expressed as three op signatures rather than special
  cases: `20% of 50 → 10`; `50 + 20% → 60` (relative to the left operand); bare
  `20% → 0.2`.
- **Date math uses Temporal, never milliseconds.** `next month` from Jan 31 gives
  Feb 28 or 29, DST-safe and calendar-aware. `30 hours - 10 minutes` stays a
  `Duration` (`PT29H50M`); no date is involved.
- **Timezone conversion is an op**, not a subsystem: `3pm in Tokyo` is an `in`
  signature on the datetime kind.
- **Ambiguous number grammar needs no new mechanism.** `1,500` is 1500 in `en` and
  1.5 in `uk`/`de`; both candidates are emitted and the primary locale scores
  higher.
- **Unknown currency codes** raise `NoCandidateError` with nearest-match
  suggestions rather than being ignored.
- **Parsing accepts surrounding whitespace and an optional degree sign**: `"20°C"`
  and `"20C"` are equivalent. A bare number with no unit is rejected by `parse()`
  — use the constructor or `from()`.
- **Immutability throughout.** Descriptors and values are frozen, every operation
  returns a new instance, and `engine.with()` derives rather than mutates.

## 9. Tooling

Bun workspaces (`bun test`, `bun build`, Bun as the package manager). Biome for
formatting and linting, one `biome.json` at the root, `noExplicitAny` and import
sorting enabled. `tsc --emitDeclarationOnly` for `.d.ts`. TypeScript `strict`
plus `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. ESM only, no
CJS build. `publint` and `arethetypeswrong` run in CI.

## 10. Testing

Test-driven: a corpus row first, then the code that satisfies it.

1. **Golden corpus.** One TSV per locale:
   `input ⇥ expected kind ⇥ expected canonical ⇥ expected formatted`. Thousands of
   rows, growing with every bug report. This is the regression suite and the
   project's most valuable public artifact.
2. **Property tests** (`fast-check`): `parse(format(v)) ≈ v` for every unit of
   every kind; conversion transitivity `a.to(b).to(c) ≈ a.to(c)`; commutativity of
   `add` within a kind; Decimal precision holding across operation chains.
3. **Solver tests.** Ambiguity fixtures assert full rankings, not just winners —
   `10 m` must rank length above duration in `en`, with a margin under epsilon so
   `evaluate()` still throws.
4. **Plugin contract tests.** A shared `assertKindContract(kind)` suite exported
   from `@smartput/core/testing`, run by every built-in kind and available to
   third-party kinds. This is what proves the extension seam is genuinely
   dogfooded.
5. **Error snapshots.** Error messages are user-facing; they are asserted
   verbatim.

Every test uses a fixed clock
(`now: () => Temporal.ZonedDateTime.from("2026-01-15T12:00[UTC]")`) and a frozen
`RateSnapshot`. No test touches the network; provider adapters run against
recorded fixtures.

## 11. Milestones

Each is independently shippable and gets its own implementation plan.

| Milestone | Scope | Validates |
| --- | --- | --- |
| **M1** | Contracts, registry, lexer, Pratt parser, solver, evaluator. Kinds: number, length, mass, duration. Locale: en. | The engine. `10 m + 5 min` resolves correctly. |
| **M2** | Temperature (affine), Measure (dpi context), angle, datasize, speed/area/volume via dimension algebra. Facade class generator. | The Kind contract under every numeric shape. |
| **M3** | Money kind, `@smartput/rates`, ECB provider, `createLiveEngine`. | `30 usd - 10 eur`. The `ratio: (ctx)` escape hatch. |
| **M4** | datetime, chrono bridge, Temporal ops, timezones. `"today"`, `"next week monday"`. | Opaque kinds and cross-kind op signatures. |
| **M5** | `@smartput/color` (@urcolor adapter), `@smartput/locale-uk`, `defineLocale` docs. | i18n and non-numeric kinds. `червоний` → Color. |
| **M6** | `@smartput/http`, meta-package, docs site, npm release. | Ship. |

M1 carries the only real invention risk. M2–M5 are largely descriptor tables once
M1 holds, which is the point of the design.

## 12. Out of scope for v1

Stated explicitly so it does not creep back in: variables and assignment
(`x = 5kg`), multi-line notepad mode, spreadsheet references, natural-language
sentences (`"how many km in a marathon"`), LLM fallback, historical FX by date,
and plural or gender agreement in output formatting beyond what `Intl` provides.
