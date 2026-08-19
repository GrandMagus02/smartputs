# Second pass: seven things a person types that the engine gets wrong

**Status:** design proposed, not implemented
**Date:** 2026-08-18
**Depends on:** stages extraction (`Tokenizer`, `Parser`, `Solver`, `Evaluator`,
`Printer` as constructible classes), M6.3 (non-destructive literal fold),
comparison (`comparePrecision`)

## 0. What this is

A probe of the engine with ordinary input, run on 2026-08-18 against `main`,
turned up seven defects. None is a missing kind. Every one is either core
reading a person's input less carefully than the README promises, or core
telling the person less than it knows. Each section below states the probe
that found it, the design that fixes it, and what it costs core.

| # | Defect | Probe | Core changes |
| --- | --- | --- | --- |
| A | Number grammar is single-locale; recognition is not | `"1,5 kg"` on an en+de engine → `15 kilograms`, confidence 1 | `NumberToken.readings`, number slots in `Solver`, `grammar:` selector |
| B | Compound quantities do not parse | `"1 h 30 min"`, `"5 ft 3 in"`, `"1h30m"` all throw | `Kind.compound`, a parser fold, a lexer split |
| C | Display precision is the round-trip guard, not a display policy | `"1.5 kg in lb"` → `3.306933932773163710844607 pounds` | `EngineOptions.display`, `Printer` rounding, symbol spacing |
| D | Derived units exist as expressions, not as units | `"(100 km / 2 h) in km/h"` throws; `"100 km / 2 h"` prints `m/s` | `Registry.derivedUnits`, target chain in `Parser`, unit rewrite in `Evaluator` |
| E | `explain()` throws; errors carry no span | `explain("100 km / 2 h in km/h")` throws with `spans: []`, `op: "operation"` | `Explanation.outcome`, `Explanation.rejections`, spans on every error |
| F | Structural `meta` contracts have no home | `PlaceMeta` lives in `@smartput/kind/types`; ranges match an unnamed shape | `@smartput/kind/contracts` subpath |
| G | Plugin config accretes on `EngineOptions` | `rates`, `rounding` are money's | `EngineOptions.context`, `EvalCtx.context` |

The solver's enumeration does not move. A gains one slot type it enumerates
over; nothing else touches `solve()`.

Suggested order: **E, C, D, B, A, F+G.** E first because every later section
is debugged through `explain`. A last because it is the largest and the only
one that changes what a token is.

---

## A. Number grammar across installed locales

### A.1 The defect

```ts
const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
engine.evaluate("1,5 kg").formatted;         // "15 kilograms"   confidence 1
engine.evaluate("1,5 Kilogramm").formatted;  // "15 kilograms"   confidence 0.95
engine.evaluate("1.000 Kilogramm").formatted;// "1 kilogram"
```

Recognition is many-locale: `Kilogramm` is read because German is installed.
The digits beside it are read under the format locale's `numberFormat` only,
because `Tokenizer` is built once from `format` (`EvalOptions.format` doc,
`engine.ts`). So a German word next to a German number produces an English
number at full confidence. The engine's own thesis says this input is
ambiguous and should say so.

### A.2 Design

A number with a separator in it is a slot, exactly as a unit word is.

**Grammars.** At boot the tokenizer collects the *distinct* `(group, decimal)`
pairs among installed locales, each tagged with the locale ids that use it.
`en`, `ja`, `zh`, `hi`, `id`, `ko` share `(",", ".")`; `de`, `es`, `it`, `nl`,
`pt`, `tr`, `pl`, `ru`, `uk`, `fr`, `ar` split across `(".", ",")` and
`(" ", ",")` (with the folded-space rule `lex.ts` already applies). Seventeen
locales collapse to three or four grammars.

**Lexing.** `lex` runs the digit scan once per grammar over the same span and
keeps every grammar that accepts the whole run.

```ts
export interface NumberReading {
  value: Decimal;
  /** Locale ids whose grammar produced this value. */
  locales: readonly string[];
}
export interface NumberToken {
  type: "number";
  /** The format locale's reading, or the only one. Kept so every existing
   *  reader of `.value` keeps working; §A.4 says who may still use it. */
  value: Decimal;
  readings: readonly NumberReading[];   // length 1 for "15", "1.5" on en-only
  text: string; start: number; end: number;
}
```

A run with no separator has one reading and is never a slot. A run one grammar
rejects (`1,00,000` under en, `1.5.6`) drops that grammar. If every grammar
rejects, the token is not a number, as today.

**Parsing.** `parseAtom` builds the quantity node with `value` set to the
format reading, and adds `numberReadings` when `readings.length > 1`. The
Pratt parser does not otherwise care.

**Solving.** `collectSlots` gains a second slot kind:

```ts
type Slot =
  | { type: "unit"; node: NodeId; candidates: Candidate[] }
  | { type: "number"; node: NodeId; readings: NumberReading[] };
```

`enumerate` iterates number slots like unit slots. A number reading's score is
the sum of two terms, both landing in the same tree walk `contextBonus` and
`OpSignature.weight` use:

- `grammar:<localeId>` from the weight layers, one selector per locale in the
  reading (a caller can pin `{ "grammar:de": 5 }`); the **format locale's
  grammar carries a default `+1`** in the engine layer, so an engine that
  installs several grammars but sees a bare `"1,000"` still prefers the
  language it speaks, at ~0.73 rather than at 1.
- `+2` agreement bonus when the quantity's unit candidate `locale` is among the
  reading's `locales`. `Candidate.locale` is "the language that listed this
  spelling", which is precisely the evidence wanted here.

Worked: en+de engine, format en, `"1,5 kg"`. `kg` has an `en` candidate and a
`de` candidate. Paths: (en-number, value 15, +1 format, +2 agree with en-kg) = 3; (de-number 1.5, +2 agree with de-kg) = 2. Softmax at the engine's
temperature gives 15 kg ~0.73, 1.5 kg ~0.27. `suggest` returns both. With
`"1,5 Kilogramm"` only the `de` unit candidate exists, so the en number reading
earns no agreement: 1.5 kg wins at ~0.73 and `explain` shows why. A caller
whose users are German sets `format: "de"` or `{ "grammar:de": 3 }` and the
tie goes the other way. **A single-grammar engine sees no change at all**: one
reading, no slot, identical scores.

**Explain.** `Explanation.assignments[].numbers: Array<{ node, value,
locales }>` records the chosen reading per number slot;
`contributions` already lists selectors, and `grammar:*` appears there.

**Print** is untouched: output number grammar is the format locale's, as
before.

### A.3 Rulings

- **Format grammar defaults to +1, not 0.** At 0, a bare `"1,000"` on an
  en+de engine is a coin flip and `evaluate` would throw `AmbiguityError` on
  every thousand a user types. +1 keeps today's answer for unaccompanied
  numbers while letting a unit word overturn it. Recorded as R-A1.
- **Agreement is with the unit's `Candidate.locale`, not with the reader.**
  `"5 кг"` on an en+uk engine has only a `uk` candidate for `кг`; a Ukrainian
  number reading agrees, an English one does not, whichever locale is `format`.
- **`EvalOptions.locales` filters number readings too.** `{ locales: ["en"] }`
  removes readings whose `locales` has no `en`. Same place, same rule as unit
  candidates.
- **`coerce` and `validate` paths take the format reading.** They have no
  solver to rank with; the doc says so.

### A.4 Cost and tests

- `lex.ts`: per-grammar digit scan; `isFoldedGroup` becomes per grammar.
- `Tokenizer` constructor takes `grammars` derived from `locales`, not one
  `numberFormat` from `format`. `EvalOptions.format` stays output-only, as
  documented.
- `solver.ts`: number slots in `collectSlots`, `enumerate`, `Resolution`.
- `weights.ts`: `grammar:` selector.
- Tests: `lex.test.ts` per-grammar table; `solver.test.ts` the worked example
  above; a `third-language.test.ts` row proving en+uk+de reads `"1 000,5 кг"`,
  `"1.000,5 kg"`, `"1,000.5 kg"` each to the intended value; corpus rows in
  every locale package that carries a decimal comma; parity fixtures re-record
  for multi-locale engines only (the English fixture must not move).
- Size: `check-size` row for `@smartput/core` moves; the diff is the per-grammar
  loop, expected under 300 B.

---

## B. Compound quantities

### B.1 The defect

```
"1 h 30 min"   !! Cannot parse "1 h 30 min" as a quantity
"5 ft 3 in"    !! Cannot parse "5 ft 3 in" as a quantity
"1 kg 200 g"   !! Cannot parse "1 kg 200 g" as a quantity
"1h30m"        !! Unknown unit "h30". Did you mean: h, ha, hp?
```

Two adjacent quantities of one kind, in descending units, is how people write
durations and lengths. The engine has `+`; the person did not type it.

### B.2 Design

**Opt-in per kind.**

```ts
interface Kind {
  /** Adjacent quantities of this kind in strictly descending units fold into
   *  a sum: "1 h 30 min", "5 ft 3 in". Off by default. */
  compound?: boolean;
}
```

`duration`, `length`, `mass`, `angle`, `volume` set it. `datasize` does not
(`1 gb 500 mb` is not a thing people write); `temperature` must not.

**Parser fold.** In `parseAtom`, after a quantity `Q1 = <number> <unit>` is
built, peek: if the next two tokens are `<number> <unit>` with no operator
between, and

1. some kind K with `compound: true` has a candidate on both units, and
2. every such K orders `unit1` strictly above `unit2` by ratio,

then build `{ type: "op", op: "+", implicit: "compound", left: Q1, right: Q2 }`
and repeat. Condition 2 is checked per kind, so `"10 m 5 s"` (no shared kind)
and `"3 m 4 m"` (not descending) do not fold and fail exactly as today.

The solver already prices this: `+` needs one kind on both sides, so
`"1 h 30 m"` reads `m` as minutes by dimension, and metres never had a
signature to reach. No new weight, no new selector. `explain` shows the
implicit `+` node.

**Lexer split.** Inside a letter run, a digit sequence *followed by a letter*
splits the run: `h30m` → `h`, `30`, `m`; `ft3in` → `ft`, `3`, `in`. Trailing
digits stay: `m2`, `km2`, `ft3` remain one word, because kinds spell area and
volume that way. `Token.start/end` index the source as before, so
`Result.spans` still points into the caller's string.

**`in` as inch.** `"5 ft 3 in"` ends in a keyword. Ruling R-B1: a `keyword
in` token that is immediately preceded by a number, is at end of input or
followed by an operator or another `in`, and whose surface some installed
vocabulary lists as a unit alias, is re-lexed as a word. Every such input
throws today, so nothing regresses; `"5 ft 3 in cm"` still reads `in` as the
conversion keyword because a unit follows it. Same for `"5 ft 3 in in cm"`,
which now means what it says.

**Print.** The result is a sum, printed as one quantity in the left operand's
unit (`"1.5 hours"`), consistent with `1 h + 30 min` today. A compound *print
mode* (`"1 h 30 min"`) is a follow-up on `Printer.modes`, not this spec.

### B.3 Cost and tests

- `types.ts`: `Kind.compound`.
- `pratt.ts`: the fold in `parseAtom`; `ast.ts`: `implicit?: "compound"` on op
  nodes.
- `lex.ts`: the digit-inside-run split; `keyword in` re-lex.
- Tests: `pratt.test.ts` fold and every non-fold; `lex.test.ts` the split table
  including `m2`, `km2`, `1h30m`, `5ft3in`; corpus rows in duration, length,
  mass, angle, volume, in every locale that has the aliases; `print/roundtrip`
  gains `"1 h 30 min"` → `"1.5 hours"` → `"1.5 hours"`.

---

## C. Display precision

### C.1 The defect

```
"1.5 kg in lb" -> 3.306933932773163710844607 pounds
"50 km/h"      -> 13.888888888888888888888889m/s
"60 mph in kph"-> 96.56064kph
```

`formatPrecision` (26) exists so that a round trip through a non-terminating
ratio does not surface noise (its doc says so), and comparison reuses it (C4).
Both are correctness figures. Neither is what a person wants to read. Also:
`13.88…m/s` has no space and `1.5 kilograms` does; `100kph` is documented as
intended.

### C.2 Design

**Two figures, two jobs.** `formatPrecision` keeps its meaning and its default:
it is the guard used for round trip and comparison. A new `display` policy
governs `Result.formatted` only.

```ts
interface DisplayOptions {
  /** Fraction digits `formatted` keeps at most. Default 4. Trailing zeros
   *  are dropped. */
  maximumFractionDigits?: number;
  /** Significant digits `formatted` never drops below, so a small value is not
   *  rounded to 0. Default 3: 0.00001234 g prints "0.0000123 g". */
  minimumSignificantDigits?: number;
}
interface EngineOptions { display?: DisplayOptions }
interface EvalOptions   { display?: DisplayOptions }   // per call, like `format`
```

Rule: round to `maximumFractionDigits`; if that leaves fewer than
`minimumSignificantDigits` significant digits, round to
`minimumSignificantDigits` instead. Applied by `Printer` after `formatPrecision`
rounding, never before, so `Result.value.canonical` and `Result.value.raw`
stay at 28 and 26. Money is excluded: it already rounds by currency minor
units under `rounding`, and the display policy must not re-round `£22.94`.

**Symbol spacing.** `formatValue` writes `<number> <symbol>` with a space,
unless the unit declares `tight: true`. `%`, `°`, `°C`, `°F`, `K`, `′`, `″`
and currency prefixes set it. Speed, datarate, tempo lose their glued form:
`50 km/h`, `96.5606 km/h`.

**Symbols.** `kph.symbol` becomes `"km/h"`, `mps.symbol` stays `"m/s"`. The
lexer splits `km/h` into `km / h`, so this symbol re-reads as an expression, as
`m/s` already does (`speed/locale/en.ts` records the same for `m/s`); §D makes
it also read as a *unit* after `in`.

### C.3 Rulings

- **Default 4 fraction digits.** Recorded R-C1. Chosen against 6 and against a
  pure significant-digit rule: 4 is what pocket calculators and Soulver-class
  tools show; a significant-digit rule makes `1234567.891` lose its cents.
  A caller with a scientific domain sets `display` once.
- **`formatted` and `formatPrecision` may disagree.** Round-trip tests that
  asserted `evaluate(evaluate(x).formatted).value` equals `evaluate(x).value`
  now assert equality *at display precision*, and a new test asserts the old
  equality against `Result.value.raw` printed at `formatPrecision` through the
  `Printer` directly. The guard is still tested; it just is not `formatted`.
- **Comparison is untouched.** `comparePrecision` keeps reading
  `formatPrecision`. `1 km / 3 * 3 = 1 km` stays true for the reason C4 gave.

### C.4 Cost and tests

- `Printer`: the rounding step and the spacing rule; `UnitWords.tight`.
- Every corpus fixture that pins a long decimal or a glued symbol changes. This
  is the one section whose diff is mostly fixtures; the PR lists the rule and
  regenerates, and the reviewer reads the rule, not the rows.
- Parity fixtures re-record, English included, **for this section only**, and
  the PR says so in its description per CONTRIBUTION.md.

---

## D. Derived units

### D.1 The defect

```
"50 km/h in mph"           -> 31.0686 mph      (km/h is an expression: km / h)
"(100 km / 2 h) in km/h"   !! Cannot apply operation to length and duration
"100 km / 2 h"             -> 13.8889 m/s      (a person expects 50 km/h)
"10 km in m + 5"           !! Cannot apply operation to length and duration
```

A compound unit works wherever an expression works and fails wherever a unit
is required: after `in`, and as the unit a derived result is printed in.
The `speed` signature hardcodes `mps`.

### D.2 Design

**A table, built at boot.** For every signature with `op ∈ {"*", "/"}` whose
three kinds are all ratio kinds, and every pair `(uL, uR)` of their units, if
the result kind has a unit `uK` with `ratio(uK) = ratio(uL) op ratio(uR)`
(Decimal equality at 28 digits), record it both ways:

```ts
interface Registry {
  /** (resultKind, leftUnit, op, rightUnit) -> resultUnit, and back. */
  derivedUnits: DerivedUnitTable;
}
```

Sizes are tiny: speed's one signature over 10 length × 8 duration units. It
runs once in `buildRegistry`, beside `aliasIndex`.

**Target chain in the parser.** After `in`, the parser reads `unit ((/|*)
unit)*` greedily and asks the table for a single derived unit for the chain.
Found: the target is that unit, spans covering the chain. Not found: back off
to the single unit, which is today's behaviour, so `"10 km in m + 5"` still
parses as `(10 km in m) + 5`.

**Result unit in the evaluator.** After a `*` or `/` signature applies, if the
returned unit is the result kind's canonical (the plugin declined to choose)
and the table has `(K, left.unit, op, right.unit)`, the evaluator rewrites the
unit. `100 km / 2 h` → `50 km/h`. `100 m / 2 s` → `50 m/s`. Plugins do not
change; `speed`'s `make(l, "speed", "mps", …)` keeps working and is now a
default rather than a decision.

**Prune at the target.** `"10 km in m + 5"` fails as *length and duration*
because the solver enumerated `m` as minutes at the target. Target candidates
whose kind has no `in` signature from the left operand's possible kinds are
dropped before enumeration. Same result set, better error, fewer paths.

### D.3 Rulings

- **Ratio equality, not alias matching.** `kph` is derived from `(km, /, h)`
  because the numbers agree, not because someone spelled it `km/h`. That is
  what makes `mi / h` → `mph` and `nmi / h` → `knot` free.
- **The plugin's explicit unit wins.** If a signature returns a non-canonical
  unit, the evaluator does not second-guess it.
- **`*` chains are limited to two operands.** `kg * m / s^2` is out of scope;
  there is no exponent token.

### D.4 Cost and tests

- `registry.ts`: `derivedUnits`; `pratt.ts`: the target chain; `evaluator.ts`:
  the rewrite; `solver.ts`: the target prune.
- Tests: registry table for speed, datarate, power, tempo; parser target chain
  with back-off; evaluator rewrite for `km/h`, `m/s`, `mph`, `knot`, `bit/s`;
  the four probes above as corpus rows.

---

## E. `explain` never throws; every error points at its span

### E.1 The defect

`explain("100 km / 2 h in km/h")` threw `DimensionMismatchError` with
`spans: []`, `op: "operation"`, `left: "length"`, `right: "duration"`. The
error came from `solve()` finding no viable path, and `explain` let it out.
The message names one pair of kinds; the solver tried several. `"10 kg / 2 m"`
reports *mass and duration* because the first `m` reading it lists is
minutes.

### E.2 Design

**`explain` returns, always.**

```ts
interface Explanation {
  input: string;
  tokens: Token[];
  candidates: Candidate[];
  assignments: Assignment[];              // may be empty
  outcome:
    | { status: "ok" }
    | { status: "error"; error: SmartputError };
  /** Every (op, leftKind, rightKind) the solver enumerated and found no
   *  signature for, with node ids and spans. Empty when outcome is ok. */
  rejections: Rejection[];
}
interface Rejection {
  node: NodeId; op: OpSymbol; left: KindId; right: KindId;
  spans: [Span, Span];
}
```

`explain` runs tokenizer, parser and solver; anything a `SmartputError` stops
is caught into `outcome`, and `tokens`/`candidates` are always filled as far
as the pipeline got. Non-`SmartputError` exceptions still propagate: they are
bugs.

**Errors carry spans and the real operator.**

- `DimensionMismatchError` gains `tried: ReadonlyArray<[KindId, KindId]>` and
  `spans` = left operand, operator, right operand. `op` is the `OpSymbol` or
  `"in"`, never `"operation"`. Message: `` Cannot apply / to `10 kg` and `2
  m`: no signature for mass / length or mass / duration ``.
- `NoCandidateError`, `UnitParseError`, `UnknownUnitError` carry the offending
  token's span.
- `AmbiguityError` already lists readings; it gains the span of the ambiguous
  slot.
- `TooAmbiguousError` is about the whole input and keeps `spans: []`.

`Result.spans` and `Explanation.rejections[].spans` index the caller's string,
as `Result.spans` does since the stages extraction.

### E.3 Cost and tests

- `errors.ts` (in `@smartput/kind`): fields above; every throw site in
  `solver.ts`, `pratt.ts`, `resolver` passes spans.
- `engine.ts`: `explain` catch.
- Tests: `engine.test.ts` `explain` on every error class returns an
  `Explanation`; a property test in `properties.test.ts` asserting that every
  `SmartputError` raised over the corpus has `spans.length > 0` unless it is
  `TooAmbiguousError`; the two probes above as named tests.

---

## F. A home for structural contracts

### F.1 The defect

`PlaceMeta` is declared in `@smartput/kind/types.ts` (line 170) "for the same
reason as" `RateLookup`: structural agreement without a runtime edge. It works,
and it puts a country's shape into the layer CONTRIBUTION.md now says knows no
domain. Ranges and datetime match shapes off `Value.meta` with no named type,
so `distance.ts` writes `value.meta as PlaceMeta` and `query` writes nothing
at all.

### F.2 Design

A types-only subpath, not a package: `@smartput/kind/contracts`.

```ts
// packages/kind/src/contracts.ts — type declarations only, no runtime
export interface PlaceMeta { … }        // moved from types.ts, re-exported there for one release
export interface RangeMeta<T = unknown> { start: T; end: T; … }   // what range-core already writes
export interface InstantMeta { zone?: string; hasDate: boolean; hasTime: boolean } // what datetime already writes
export interface RateMeta { … }          // if rate writes one; else omitted
```

Every field is what the writing package already puts on `meta`; the file
names them, it does not invent them. Consumers `import type { PlaceMeta } from
"@smartput/kind/contracts"`. `check-size` gets a row proving the entry is 0 B.
`check-deps` is unaffected: `@smartput/kind` is already every package's one
dependency.

Ruling R-F1: a subpath, not `@smartput/contracts`. A separate package would
need a `check-deps` exemption (a types-only package still has to be a
`dependency` for published `.d.ts` to resolve) and would be a 38th name to
claim. The subpath costs nothing and is honest about what it is: the shapes
kinds agree on, held by the layer kinds are written in.

---

## G. Plugin config off `EngineOptions`

### G.1 The defect

`EngineOptions.rates` and `EngineOptions.rounding` are money's. `kindMeta`
exists, is generic, and is used by one kind. Each milestone that needed engine
level configuration added a field.

### G.2 Design

```ts
interface EngineOptions {
  /** Per-kind configuration, keyed by kind id, opaque to core. */
  context?: Readonly<Record<KindId, unknown>>;
  /** @deprecated use context.money = { rates, rounding } */
  rates?: RateLookup;
  /** @deprecated */
  rounding?: Decimal.Rounding;
}
interface EvalCtx {
  context?: Readonly<Record<KindId, unknown>>;
}
```

`createEngine` copies `rates`/`rounding` into `context.money` when that slot is
absent, for one release, then the fields go. `@smartput/rate` reads
`ctx.context?.money as MoneyContext`, typed in `@smartput/kind/contracts`
(§F). `now` and `timeZone` stay where they are: they are engine semantics
that several kinds and `EvalOptions` share, not one plugin's table.
`kindMeta` stays: it is default *value* meta, a different thing.

---

## H. Follow-ups this spec names and does not do

- **Typed weight selectors.** `Selector` is `string`. A `selector(kind, unit)`
  helper or a template-literal type over registered kinds would catch
  `"duration:mins"` at compile time. Small, separate.
- **`class Engine`.** `createEngine` is an 800-line closure over frozen stage
  classes. An `Engine` class composing them, with `createEngine` kept as the
  factory, would match the rest of the stages design. Mechanical, separate.
- **Compound print mode.** `"1 h 30 min"` out, not only in (§B.2).
- **Exponents.** `m^2`, `s^2`, `m²` as tokens; would let §D's table cover
  area and acceleration.

## I. Rulings index

| Id | Ruling |
| --- | --- |
| R-A1 | Format locale's number grammar carries +1 by default; unit agreement +2. |
| R-B1 | `keyword in` re-lexes as inch only where it cannot be the conversion keyword. |
| R-C1 | Display default: 4 fraction digits, floor 3 significant. Money exempt. |
| R-F1 | Contracts are a subpath of `@smartput/kind`, not a package. |
