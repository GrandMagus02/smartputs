# smartputs Completion Design

`Engine.complete()` — as-you-type unit completion. `"30 ho"` becomes
`"30 hours"`, `"10 mil"` becomes `"10 miles"`, and `"1 mi"` offers mile, minute,
millimetre and millisecond ranked against each other.

The engine it extends is specified in `2026-08-04-smartputs-design.md`; this
document adds one entry point and two lexicon fields and changes nothing else
about the pipeline. Section references below are to that spec.

## 1. Why this exists

The spec's opening line calls smartputs a "Raycast-style calculator, usable as a
plain library, a launcher backend, or a form-input consumer". A launcher backend
is asked for completions on every keystroke, and the engine currently has no way
to answer. `evaluate("30 ho")` raises `NoCandidateError`; the error carries
`nearest`, but that is edit distance over a *finished* word, not completion of a
prefix. Typing `ho` is not a typo for `h`.

The three existing entry points all assume the user has stopped typing.
`complete()` is the one that does not.

## 2. Public API

```ts
export interface Completion {
  /** The alias that matched, e.g. "hour". */
  alias: string;
  /** The fragment this replaces, offsets into the *original* input. */
  span: Span;
  /** The whole input rewritten, ready to put back in the box: "30 hours". */
  text: string;
  kind: KindId;
  /** Registry unit key, e.g. "h". */
  unit: string;
  score: number;
}

export interface CompleteOptions {
  /** Hard filter, identical in meaning to EvalOptions.kinds (§3). */
  kinds?: KindId[];
  /** Per-call weight layer 4, identical to EvalOptions.weights (§4.5). */
  weights?: Weights;
  /** Applied after ranking. Default 10. */
  limit?: number;
}

interface Engine {
  complete(input: string, opts?: CompleteOptions): Completion[];
}
```

Two new optional fields on `UnitLexeme`. `display` already exists and is already
read by `formatValue`; only `typical` is new.

```ts
export interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /** Magnitude band people actually type this unit in. Read only by scaleFit. */
  typical?: [number, number];
}
```

### `complete()` never throws

Empty input, no trailing fragment, and zero prefix hits all return `[]`. This
matches `suggest()`, not `evaluate()`. A method called on every keystroke must
not throw on half-typed input, and half-typed input is the only input it will
ever see.

### Rows are deduplicated by `(kind, unit)`

`"1 mi"` prefix-matches both `mi` and `mile`, which are the same unit. One row
survives, carrying the higher-scoring alias. This mirrors `resolve()`, which
already deduplicates on `` `${kind}:${unit}` `` (`candidates.ts:64`), and it is
what makes `"1 mi"` read as *mile, minute, millimetre, millisecond* rather than
as seven near-duplicate rows.

## 3. Algorithm

Six steps. No lexer, no parser, no solver.

```
complete(input, opts):

1. FRAGMENT   /[\p{L}][\p{L}\p{N}]*$/u against the raw input.
              Must begin with a letter: "10 m2" -> "m2", bare "30" -> no match.
              No match -> return [].
              span = { start, end } into the RAW input.

2. COUNT      Walk left from span.start over spaces, take the trailing run of
              /[-\d.,\u00A0\u202F ]+$/ and pass it to parseNumber(text, locale).
              \u00A0 and \u202F are load-bearing: parseNumber already strips
              them, because French ICU uses U+202F as its group separator.
              Written as escapes, never as literals -- see the M1 plan's note
              on invisible characters in fixtures.
              null -> count stays undefined.

3. MATCH      Fold the fragment (NFKC, then toLocaleLowerCase(locale.id)) and
              prefix-scan the keys of registry.aliasIndex.

4. SCORE      For each AliasEntry { kind, unit } under a matching alias:
                  resolveWeight({ kind, unit, surface: foldedAlias,
                                  prior: kind.prior, layers })
                + prefixQuality
                + scaleFit(count, lexeme.typical)
              Drop entries whose kind is outside opts.kinds.

5. RENDER     category = Intl.PluralRules(locale.id).select(count ?? 1)
              word     = lexeme.display?.[category] ?? alias
              text     = input.slice(0, span.start) + word + input.slice(span.end)

6. ORDER      Deduplicate by (kind, unit) keeping the best alias, then sort by
              score desc, kind asc, unit asc, alias asc.
              Return .slice(0, opts.limit ?? 10).
```

### Why the fragment must start with a letter

M2 introduces `m2`, `cm2` and `km2`. A letters-only pattern returns nothing for
`"10 m2"` — the string ends in a digit — so every area unit would be silently
uncompletable. Requiring a leading letter and then allowing digits accepts `m2`
while still rejecting a bare `"30"`, which is a number and not a fragment.

### Why step 1 does not call `normalize()`

`normalize()` collapses whitespace and rewrites dashes, so offsets computed
against its output do not address the string the user actually typed, and the
caller cannot splice with them. Only the fragment is normalized, and only for
matching. The cost is that a fullwidth-typed `"ＨＯ"` will not match. Accepted.

### Why the count is optional

It feeds pluralization and `scaleFit` and nothing else. `complete("ho")` with no
number works and renders the singular, because `select(1)` is the fallback.

### Why a linear scan

Step 3 walks roughly sixty alias keys, which is what `nearest()` already does
(`candidates.ts:90`). At M2's full kind set that is a few hundred string
comparisons per keystroke. No trie, no prefix index on `Registry`. If it ever
matters, a sorted array with binary search is a contained change behind an
unchanged signature.

## 4. Scoring

The existing scale sets the budget: `CONTEXT_BONUS` is 30 and decisive,
`suffixStripper` is −2 and a nudge, and §4.5's example engine weights run ±15 to
±100. Completion terms are summands of `resolveWeight`, so they must live on
that same scale.

```ts
export const EXACT_BONUS    = 10;  // alias === fragment
export const LENGTH_PENALTY = 1;   // per character the user has not typed
export const SCALE_BONUS    = 3;   // count falls inside lexeme.typical
```

All three are exported so tests can pin them and integrators can reason about
them. Engine-layer weights override any of it, which is the tuning path §4.5
already documents.

`scaleFit` contributes 0 when the count is out of band, and 0 when the unit
declares no `typical` at all. **It is never negative.** A unit that supplies data
is never ranked below one that stays silent.

### Worked examples

`"10 mil"`, count 10:

| Unit | Best alias | Length | scaleFit | Score | Text |
| --- | --- | --- | --- | --- | --- |
| `length:mi` | mile | −1 | +3 | **+2** | `10 miles` |
| `length:mm` | millimetre | −7 | +3 | **−4** | `10 millimetres` |
| `duration:ms` | millisecond | −8 | +3 | **−5** | `10 milliseconds` |

`"30 ho"`, count 30:

| Unit | Best alias | Length | scaleFit | Score | Text |
| --- | --- | --- | --- | --- | --- |
| `duration:h` | hour | −2 | +3 | **+1** | `30 hours` |

`"1 mi"`, count 1:

| Unit | Best alias | Exact | Length | scaleFit | Score | Text |
| --- | --- | --- | --- | --- | --- | --- |
| `length:mi` | mi | +10 | 0 | +3 | **+13** | `1 mile` |
| `duration:min` | min | — | −1 | +3 | **+2** | `1 minute` |
| `length:mm` | millimetre | — | −8 | +3 | **−5** | `1 millimetre` |
| `duration:ms` | millisecond | — | −9 | +3 | **−6** | `1 millisecond` |

### An exact match outranks scale

`EXACT_BONUS` is 10 and `SCALE_BONUS` is 3, so `scaleFit` cannot overturn an
exact alias match. `"600 mi"` ranks `600 miles` above `600 minutes` even though
600 is outside `mi`'s typical band and inside `min`'s.

This is intended. If the user typed exactly `mi` and `mi` is a real unit,
offering it first respects what they typed; `scaleFit` discriminates among
genuine completions rather than second-guessing a finished word. The consequence
is that `scaleFit` is a tie-breaker, not a primary signal. Raising
`SCALE_BONUS` above `EXACT_BONUS` reverses this, and nothing else depends on the
ordering.

## 5. Data

### `typical` is additive

Read only by `scaleFit`. Absent everywhere today, so adding it changes no
existing behaviour.

### `display` is not additive, and this is the expensive part

`formatValue` already reads `lexeme.display` (`format.ts:50`). Populating it on
every built-in unit — which is what `"30 hours"` requires — therefore changes
what `evaluate()` prints across the board.

The golden corpus expects symbol forms today. Fifteen of its nineteen rows
change:

```
10 km          length    10000    10km    ->  10 kilometres
30 h - 30 min  duration  106200   29.5h   ->  29.5 hours
10 m + 5 h     duration  18600    310min  ->  310 minutes
3 lbs          mass      1360.77  3lb     ->  3 pounds
```

`format.test.ts` and the playground documentation change with them.

This is accepted deliberately. The status quo is already inconsistent: `kg`
renders `"1.5 kilograms"` while `g` renders `"1,500g"`, for no reason other than
that `kg` is the single unit anyone gave a `display` to. Completion forces a
question that was already open, and word forms are the better answer for a
launcher. The corpus rewrite lands as its own commit, separate from
`complete()`.

### Every `display` form must parse

`complete()` hands the user text they will then evaluate. If a display form is
not something the parser accepts, completion produces a dead end.

The built-ins are safe by inspection but only by luck. `"hours"` parses because
`suffixStripper` strips the `s` at −2; `"feet"` parses because `tableAnalyzer`
maps it to `foot`; `"inches"` by both routes. Nothing enforces this — an author
writing `display.other: "hrs"` would break completion silently.

The round-trip property test in §7 enforces it for the built-in set. For
third-party locale packs it becomes `assertLocaleContract`'s job in M5.

### Plural forms carry a −2 penalty

A completed plural re-parses two points below the singular, because it reaches
the alias through `suffixStripper`. The penalty is uniform across plural
completions, so relative ordering among candidates is unaffected; only the
absolute score shifts against a hypothetical singular. Low practical impact,
recorded so it is not rediscovered.

Removing it would mean registering every display form as a first-class alias,
roughly doubling the alias tables and changing `nearest()` and `explain()`
output. Rejected as disproportionate.

## 6. Structure

```
packages/core/src/complete/complete.ts   complete(), pure, no Engine dependency
packages/core/src/complete/complete.test.ts
```

`complete()` is a pure function of `(registry, locale, layers, input, opts)`.
`Engine.complete()` closes over the registry, locale and weight layers that
`pipeline()` already builds and forwards. This mirrors the existing
`parse/ · solve/ · eval/ · format/` layout, is testable without constructing an
engine, and touches no existing module beyond one method on `engine.ts` and one
field on `types.ts`.

Two alternatives were considered and rejected.

Putting `complete()` on `Resolver` would reuse `aliasIndex` access, weight layers
and folding for free, and read tidily beside `resolve()` and `nearest()`. But
`createResolver` is rebuilt inside `pipeline()` on every call (`engine.ts:88`),
so completion would pay that construction cost on every keystroke — precisely the
hot path this feature lives on.

A separate `@smartput/complete` package would keep prefix machinery out of
`core`, but it needs `Registry` internals, weight layers and locale folding, all
of which are core-private. It would force them public or duplicate them, and the
dependency table in §5 of the main spec exists to prevent exactly that.

## 7. Testing

| # | Case | Assertion |
| --- | --- | --- |
| 1 | Fragment extraction | `"30 ho"`→`ho`, `"10 m2"`→`m2`, `"30"`→none, `"10 kg + "`→none |
| 2 | Count scan | `"1,500 ho"`, `"1.5 ho"`, NBSP group separator, `"ho"` with no count |
| 3 | Prefix match and dedupe | `"1 mi"` returns four rows, one per `(kind, unit)` |
| 4 | Plural rendering | counts 1, 30, 0.5, 0 select the right CLDR category |
| 5 | `scaleFit` | in band +3, out of band 0, absent `typical` 0 |
| 6 | Weight layers | engine weight `{ duration: 5 }` reorders `"1 mi"` |
| 7 | `opts.kinds` | filters exactly as `EvalOptions.kinds` does |
| 8 | `limit` | defaults to 10, honoured when explicit, applied after ranking |
| 9 | Never throws | `fast-check` over arbitrary strings always yields an array |
| 10 | Round-trip | see below |
| 11 | Determinism | identical input yields an identical array (§9) |
| 12 | Corpus | `corpus/en-complete.tsv`, input to expected top completion |

Case 10 is the one that protects the design, and it must be scoped honestly,
because completing only the trailing token makes `complete()` context-blind:

```
For a single-quantity input "<number> <fragment>":
    evaluate(c.text) must not throw, and must return c.kind.

For any input:
    lex(normalize(c.text)) must not throw.

Explicitly NOT asserted: that a completion inside an expression evaluates.
"10 kg + 5 mil" -> "10 kg + 5 miles" is a legal completion and a
DimensionMismatchError. That is the price of not parsing, and it is accepted.
```

## 8. Sequencing

M2 is in flight in a locked worktree (`worktree-m2-kinds`) and adds roughly eight
kinds with their own lexicons. This work touches `types.ts`, all four built-in
lexicons and `corpus/en.tsv`, every one of which collides with that branch.

**This lands after `worktree-m2-kinds` merges**, so the `display` and `typical`
data pass runs once across all twelve kinds instead of twice.

Three commits, in order:

1. `display` on every built-in unit, plus the corpus, format-test and
   documentation rewrite that follows from it.
2. `typical` bands and `scaleFit`.
3. `complete()` and `Engine.complete()`.

The roadmap gains a row:

| Milestone | Scope | Status |
| --- | --- | --- |
| **M2.5** | `Engine.complete()`, prefix completion, `typical` bands, `display` on every unit, consistent word-form output | Planned |

## 9. Deliberately rejected

| Rejected | Instead | Why |
| --- | --- | --- |
| Fuzzy or substring matching | Strict prefix | Two scoring regimes in one number cannot be thresholded by a UI. `nearest()` already covers typos on the failure path. |
| Parsing the expression to constrain candidates by op signature | Trailing token only | Would require a parser that accepts holes and a solver that ranks them. The context-blind completion is wrong only for cross-kind expressions, which a UI can filter after the fact. |
| Learning from accepted completions | `kind.prior` and the four weight layers | Mutable per-engine state contradicts §9 determinism, and the weight system already expresses "this unit matters more here". |
| Canonical-magnitude heuristic for `scaleFit` | Author-declared `typical` | Deriving a band from the ratio table ranks `600 ms` above `600 min`, which is backwards. |
| Registering plurals as first-class aliases | Accept the −2 | Roughly doubles every alias table and changes `nearest()` and `explain()` output, to remove a penalty that shifts no relative ordering. |
