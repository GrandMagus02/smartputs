# Scan: reading quantities out of prose

**Status:** design approved, not implemented
**Date:** 2026-08-16
**Depends on:** M6.3 (non-destructive literal fold), the stages extraction
(`Tokenizer`, `Parser`, `Solver` as constructible classes)

## 1. What this adds

A sixth entry point. `evaluate`, `suggest`, `coerce`, `explain` and `complete`
all assume the caller's whole string is one expression. `scan` drops that
assumption: it takes a sentence, finds the stretches of it that are quantities,
and hands back each stretch with the readings it earned.

```ts
engine.scan("My house is in 5km from work");
// [ { start: 15, end: 18, text: "5km", readings: [ { kind: "length", … } ], cues: [] } ]
```

Alongside it, a second and smaller thing: a **cue** — a word that argues, by
standing near a quantity, that the quantity is of a particular kind. `in` argues
for `duration`. `away` argues for `length`. Cues are what make the second
example work:

```ts
engine.scan("Will be in time in 5m")[0].readings;
// [ { kind: "duration", formatted: "5 minutes", confidence: 0.982 },
//   { kind: "length",   formatted: "5 metres",  confidence: 0.018 } ]
```

Those two figures are `CUE_CEILING` saturating, and §4 derives them: `in`,
`time` and the second `in` all argue for `duration`, sum to more than the cap,
and are clamped to it.

Without cues that mark is a 0.5/0.5 tie — measured, not assumed; §6.5 records
the probe. The runner-up survives at 0.05 rather than being deleted, and §5
derives the arithmetic that keeps it there. Ambiguity stays data.

**Core gains three concepts**, all small, and §4 and §5 derive why each is
the cheapest correct place for it (§11 lists the plumbing each one drags along):

| Change | Where | Why |
| --- | --- | --- |
| `Vocabulary.cues?` | `@smartput/kind/types` | a cue is a *word*, so it belongs where a language's other words are |
| `Registry.cueIndex` | `core/kind/registry` | folded once at boot, exactly like `aliasIndex` |
| `Resolution.cueBonus` | `core/solve/solver` | a cue prices a *resolution*, which no existing weight layer can do |

Everything else scan needs already exists. It builds no parser, no lexer and no
second scoring model; §6 is a segmenter over the token stream the `Tokenizer`
already produces, and every mark is resolved by handing a *slice* of that stream
to the `Parser` the engine already holds.

## 2. The surface

```ts
interface Engine {
  scan(input: string, opts?: ScanOptions): Mark[];
}

interface Mark {
  /** Indexes the CALLER's string, like `Result.spans` — never the normalized one. */
  readonly start: number;
  readonly end: number;
  /** `input.slice(start, end)`, carried so a caller never has to re-slice. */
  readonly text: string;
  /** Ranked, best first. Never empty: a mark with no reading is not emitted. */
  readonly readings: readonly MarkReading[];
  /** Which words biased this mark, and by how much. Empty when none did. */
  readonly cues: readonly CueHit[];
}

interface MarkReading {
  readonly kind: KindId;
  readonly value: Value;
  readonly formatted: string;
  readonly confidence: number;
}

interface CueHit {
  readonly word: string;
  /** Also caller-relative. A UI that underlines the cue needs this. */
  readonly start: number;
  readonly end: number;
  readonly kind: KindId;
  readonly weight: number;
}

interface ScanOptions extends EvalOptions {
  /** Tokens either side of a mark that are offered as context. Default 4. */
  readonly cueWindow?: number;
  /** Readings kept per mark. Default 3. */
  readonly maxReadings?: number;
  /** Token backoff cap — the adversarial-input guard of §6.3. Default 12. */
  readonly maxSpan?: number;
}
```

Three properties the type does not state and the tests in §10 do:

- **Marks never overlap** and are emitted in source order. §6.4 is what makes
  this true by construction rather than by a filtering pass.
- **`scan` does not throw on prose.** An input with nothing in it answers `[]`.
  The exceptions are §9's, and they are all wiring errors rather than input.
- **`text` is `input.slice(start, end)`.** Stated because it is the invariant
  most likely to rot: every span in this design is caller-relative, and the one
  place that could silently produce a normalized-relative pair is a mark built
  from a node span without `mapSpan`.

### 2.1 `readings` is a list, and stays one on a unanimous mark

`5km` has exactly one reading. It still arrives as a one-element array rather
than as a bare `reading` with an optional `alternatives` beside it, because the
caller that renders a mark renders a list either way, and a shape that changes
with the arity forces every consumer to branch on a case that carries no
information. This is the same call `suggest()` already made.

## 3. Cues live on `Vocabulary`

A `Vocabulary` is already scoped to one (locale, kind) pair, so a cue table on
it needs only word → weight; the kind is the vocabulary's own and the language
is too.

```ts
export interface Vocabulary {
  readonly locale: string;
  readonly kind: KindId;
  readonly units: Readonly<Record<string, UnitWords>>;
  /**
   * Words that, standing NEAR a quantity, argue it is this kind. Positive
   * argues for; negative argues against. Read only by `scan`.
   *
   * Single digits, and §4 derives the ceiling. A cue ranks readings; it never
   * admits or refuses one.
   */
  readonly cues?: Readonly<Record<string, number>>;
}
```

This is one optional field, and it is the whole authoring surface. No new file,
no new export subpath, no new `define*` function: a kind package already ships
`src/locale/en.ts` exporting a `defineVocabulary(...)` call, and cues are
another key in the object already there. A third-party kind gets cues by
declaring them, exactly as it gets aliases.

**The road not taken** was a `CueVocabulary` shipped from a separate scan
package, which reads better in isolation and is wrong for one reason: it makes
the cue table a *stranger* to the kind. Whoever adds a `duration` unit is the
person who knows that `wait` and `ago` argue for durations, and a table living
in another package is one nobody updates. Ownership tracks the vocabulary.

### 3.1 Two kinds may claim the same word, and that is the point

`in` is a cue for `duration` and — once `@smartput/datetime` is installed — for
`datetime` too. `buildKeywords` treats a two-language disagreement on one
surface as a boot error; `cueIndex` deliberately does not, because a cue is a
*vote* rather than a definition. Both entries are recorded and the solver
weighs them.

The registry therefore folds cues into a list per surface, mirroring
`aliasIndex`'s shape:

```ts
interface CueEntry {
  readonly kind: KindId;
  readonly weight: number;
  /** The language that listed the word, for the same reason `AliasEntry` records it. */
  readonly locale: string;
}

interface Registry {
  // …
  /** Case-folded surface -> every kind that claims it. */
  cueIndex: Map<string, CueEntry[]>;
}
```

Keys are folded per contributing language, the way `buildKeywords` folds them
and for the reason recorded there. Two vocabularies of the *same* kind and
language cannot both claim one word — `composeLocale` already refuses a second
vocabulary per (locale, kind) — so within one kind the last writer question does
not arise.

## 4. Ruling S1 — cue weights are single digits, and are capped

The magnitudes already in the engine are `CONTEXT_BONUS = 30` and
`TYPO_PENALTY = 15`, and `weights.ts` derives the second from the first. A cue
weight is a third term on the same scale, and it must be **an order of magnitude
smaller than both**. The derivation is the softmax in `solve/solver.ts`, which
turns a score difference Δ into odds:

| Δ | winner's confidence | runner-up |
| --- | --- | --- |
| 0 | 0.500 | 0.500 |
| 1 | 0.731 | 0.269 |
| 2 | 0.881 | 0.119 |
| 3 | 0.953 | 0.047 |
| 4 | 0.982 | 0.018 |
| 15 | 0.9999997 | 3e-7 |
| 30 | 1 − 1e-13 | 1e-13 |

`Solver`'s `ambiguityEpsilon` defaults to 0.05, so a mark separated by Δ=1 is
already past the threshold at which `evaluate()` would stop calling it a tie. A
cue of 25 — the figure this design carried before the table was written out —
would put the runner-up at 1e-11 and report a certainty that no adjacent
preposition has earned. `in` near `5m` is evidence, not proof; someone can
perfectly well be five metres from being on time.

So:

- **Cue weights are authored as single digits**, typically 1–4.
- **`CUE_CEILING = 4`** caps the summed cue weight for one kind at one mark.
  Three cue words agreeing do not compound past what one strong cue can say.

The ceiling is what makes the scale enforceable rather than advisory. Without
it a vocabulary author who writes `{ in: 25 }` gets a silently overconfident
engine and no error, which is exactly the failure mode `weights.ts` warns about
for the layers it prices. With it, the worst a bad table can do is saturate, and
the runner-up never falls below ~0.018.

The ceiling applies **per kind**, not per mark: `duration` saturating at 4 does
not stop `length` collecting its own 4 from a cue on the other side, and the two
then cancel — which is the right answer for a sentence that argues both ways.

## 5. Ruling S2 — a cue is a solver term, not a weight layer

The obvious implementation is to fold the mark's cues into a `Weights` object
keyed by bare kind id (`{ duration: 3 }`) and pass it as the per-call weight
layer, since `<kind>` is already a live selector in `weights.ts`'s
`selectorsFor`. It is wrong, for two reasons, and the second is decisive.

**It multiplies with slot count.** A weight layer prices a *reading*, and it is
summed once per slot. `"5 km + 3 km"` has two `length` slots, so a cue of 3
would contribute 6 to that mark and 3 to a single-quantity mark of the same
kind — a cue that gets louder the longer the expression is. Nothing about
"the word `away` appears nearby" scales with operand count.

**It forces a `Parser` per mark.** Candidate weights are computed by the
resolver during parsing, so a per-mark weight layer means a per-mark
`createResolver` and `new Parser`. Scanning a paragraph with forty marks would
rebuild the resolver forty times.

Pricing the resolution instead fixes both. `contextBonus` and `signatureWeight`
are already exactly this shape — terms added once per resolution inside
`enumerate`, each with a field on `Resolution` so `explain()` can list them —
and `signatureWeight` set the precedent when it landed for the ranges work.
`cueBonus` is the third:

```ts
export interface Resolution {
  readonly choices: Readonly<Record<NodeId, Candidate>>;
  readonly kind: KindId;
  readonly score: number;
  readonly contextBonus: number;
  readonly signatureWeight: number;
  /** The part of `score` contributed by cue words near the mark. */
  readonly cueBonus: number;
  readonly confidence: number;
}
```

and in `solve`, one lookup against the resolution's **result kind**:

```ts
const cue = opts.cues?.[kind] ?? 0;
viable.push({ …, score: weight + bonus + signature + cue, cueBonus: cue });
```

Against the result kind rather than against each choice's kind, because that is
what the caller is claiming: `away` says *this quantity is a distance*, and for
`"5 km + 3 km"` the quantity is the sum. It also means the term lands once by
construction, so the ceiling of §4 is a property of the cue table alone.

### 5.1 `cues` reaches the solver through `EvalOptions`

`SolveScope` is documented as a structural subset of `EvalOptions` so
`createEngine` can forward the caller's options untouched. Cues join it:

```ts
interface SolveScope {
  kinds?: KindId[];
  locales?: string[];
  /** Kind -> summed cue weight. Added once per resolution, to its result kind. */
  cues?: Readonly<Record<KindId, number>>;
}
```

Putting it on `EvalOptions` rather than on a private channel scan alone can
reach is a deliberate widening, and it costs nothing: a caller who already knows
the domain can write `suggest("10 m", { cues: { duration: 3 } })` and get the
same bias scan computes, and `scan` becomes *nothing but* a segmenter plus a cue
collector over machinery that was already public.

### 5.2 `explain()` gains a conditional row

`toExplanation` emits `contextBonus` unconditionally and `signature` only when
non-zero. `cueBonus` follows `signature`: emitted only when non-zero, so no
existing explanation moves and the recorded parity fixtures do not shift. The
`Σcontributions === score` invariant holds because the row is added exactly when
the term is.

## 6. The algorithm

### 6.1 One normalization, one tokenization

```
normalizer.run(input)          → NormalizedInput   (once)
tokenizer.run(normalized)      → TokenStream       (once)
```

The `Tokenizer` is the expensive stage — 0.028 ms against 0.06 ms for a whole
`evaluate` — and scan runs it once for the whole prose rather than once per
mark. `foldNumerals` and `foldLiterals` run inside it, so `twenty two kg` is
already one number token and `tomorrow` is already a `literal` token by the time
the segmenter sees anything.

### 6.2 Anchors

An anchor is a token index at which a quantity may begin:

| Token type | Anchor? | Note |
| --- | --- | --- |
| `number` | yes | the ordinary case |
| `literal` | yes | `tomorrow`, `kyiv` — a claim that is already a value |
| `lparen` | yes | a parenthesised expression begins at its paren |
| `op` of `-` | conditional | only in unary position — see below |
| everything else | no | a unit word with no number is not a quantity |

A bare unit word is deliberately not an anchor. `"the kilometre is a unit"`
should mark nothing, and an anchor rule that fired on unit words would mark the
word `kilometre` as a quantity of one.

**`lparen` anchors too**, because a parenthesised expression begins at its
paren, never at the number inside it. Without this, backoff finds `"1 + 2"`
inside `"(1 + 2) * 3"` and stops there — it never tries the run that also
swallows the closing paren and everything after it — so the sentence produced
two marks (`"1 + 2"` and, separately, whatever the trailing `* 3` anchored on)
instead of the one quantity it actually is.

**A `-` anchors in unary position.** A leading sign lexes as a plain `op`
token, the same as any other operator, so dropping it from the anchor set does
not merely shorten a mark — `scan("-5 km")` reported `+5000` where `evaluate`
gives `-5000`, a wrong value rather than a short span. "Unary position" means:
the next token is something a sign can attach to (`number`, `literal`, or
`lparen`), and the *previous* token does not end an operand. Ending an operand
is `number`, `literal`, `rparen`, or a `word` that is a registered unit alias
in the active locale — **and** nothing but spaces separates that token from the
sign. The gap check is load-bearing on its own: `lex` silently drops
punctuation, so `"5 km, -3 C"` and `"5 km -3 C"` tokenize identically as far as
token *types* go, and only the source text between the two tokens' spans still
holds the comma that ends the first clause. Skipping the gap check was a real
regression — `"I ran 5 km, -3 C outside"` silently flipped the second mark's
sign — and reading a comma or full stop as "the operand continues" is the
class of bug this half of the rule removes.

The alias lookup folds with `toLocaleLowerCase(localeId)`, matching how
`registry.ts` folded the alias keys it is compared against and how the
`Tokenizer`'s own alias lookup works. A plain `.toLowerCase()` disagrees with
that fold for `tr`/`az`/`lt` aliases containing `i`/`I`
(`"DAKİKA".toLowerCase()` is `"daki̇ka"`, an index miss;
`toLocaleLowerCase("tr")` is `"dakika"`, a hit) — get it wrong and a genuine
unit word reads as ordinary prose, flipping a sign the same way a missed
punctuation gap does.

`+` is deliberately **not** an anchor: `pratt.ts` has a unary branch for `-`
only, so a `+` anchor would never parse and would cost up to `maxSpan` wasted
attempts per `+` in the input for nothing.

Two shapes still lose a sign, and neither is fixable at this layer. A markdown
bullet — `"- 2 kg flour"` — reads as `-2 kg`, because there is no lexical way
to tell a bullet's `"- "` from a negation; `engine.evaluate("- 2 kg")` already
agrees, so scan matching it is the consistent answer, not a bug to chase. And
`"the min -5 km"` reads `+5 km`, because `min` genuinely is a registered alias
(of `duration`'s minute) sitting where ordinary prose happens to be — nothing
in the token stream marks the difference between "the word before the sign IS
a unit, used as a unit" and "used as an ordinary noun". Both are real
ambiguities of the input, not defects in the anchor rule.

### 6.3 Longest-match backoff

From each anchor, take the longest token run that starts there and is at most
`maxSpan` tokens; hand it to the `Parser`; on failure drop the last token and
retry, down to the anchor alone. The first run that parses wins.

```
tokens:  … keyword(in) number(5) word(km) word(from) word(work)
                       └── anchor
  try [5 km from work]  → UnitParseError
  try [5 km from]       → UnitParseError
  try [5 km]            → parses.   mark = "5km"
```

This works, unchanged, because `pratt.ts` already ends with
`if (pos !== tokens.length) throw new UnitParseError(input)` — a parse that does
not consume its whole token list is already an error, which is precisely the
signal backoff needs. Nothing in the parser changes.

The run is handed over as a synthetic `TokenStream`:

```ts
const sub: TokenStream = { input: normalized, tokens: stream.tokens.slice(i, j) };
const program = parser.run(sub);
```

`input` is the **whole** `NormalizedInput`, not a sliced one. Token offsets stay
normalized-relative to the entire string, so `program.input.mapSpan(...)` maps a
mark's span back to the caller's original exactly as it does for `evaluate`.
This was spiked against the real stages before this spec was written: parsing
`stream.tokens.slice(5, 7)` of `"Will be in time in 5m"` yields a root span of
`{19, 21}`, which slices `"5m"` out of the source string, and solving it returns
`duration:min` and `length:m` at 0.5 each.

`maxSpan` bounds the work. Backoff from one anchor is O(maxSpan) parse attempts
over runs of at most `maxSpan` tokens, so a paragraph of *n* tokens costs
O(n · maxSpan²) in the worst case with `maxSpan` fixed at 12 — linear in the
input, which is what stops a pathological paste from going quadratic.

### 6.4 Non-overlap by construction

Anchor search resumes at the token *after* the winning run. A mark therefore
cannot overlap the one before it, and the emitted list needs no dedup pass. A
literal that a longer run absorbed — the `3pm` inside `"3pm in tokyo"` — is not
re-anchored, which is why that sentence produces one mark and not two.

### 6.5 Cue collection

Cue candidates are the tokens within `cueWindow` positions of either edge of the
run that are **not inside any mark**, bounded by a sentence break (§6.6). Each
is folded, looked up in `registry.cueIndex`, and its entries summed per kind,
then clamped to `CUE_CEILING`. The window is counted in tokens of every type;
only the two types below are looked up.

**Cue candidates are `word` *and* `keyword` tokens**, and the second half is
load-bearing rather than thorough. `"Will be in time in 5m"` tokenizes to
`word(Will) word(be) keyword(in) word(time) keyword(in) number(5) word(m)` —
measured against the real lexer before this spec was written, not assumed — so
`in` never arrives as a `WordToken` at all. A cue collector that read word tokens only would find `time` and miss both
`in`s, and the headline example of this design would resolve on the strength of
one cue instead of three.

A `keyword` token carries no `text` field; its surface is
`normalized.text.slice(token.start, token.end)`, folded the way `cueIndex`'s
keys are. Every other token type is skipped: a number is not a cue, and a unit
word inside a *neighbouring* mark is already excluded by the in-mark rule.

The exclusion of in-mark tokens is not a tidiness rule; it is what makes the
headline example correct without a special case:

| Input | Where `in` sits | Fires as a cue? |
| --- | --- | --- |
| `"5 km in miles"` | inside the mark — it is the `convert` node | no |
| `"be in time in 5m"` | before the anchor, outside the mark | yes |

The conversion keyword and the temporal preposition are the same word, and the
thing that tells them apart is whether the parser claimed it. Backoff already
answers that question, so cue collection reads the answer off the mark's extent
rather than trying to re-derive it from grammar.

### 6.6 Ruling S3 — sentence breaks come from the source gaps

`lex` skips unrecognized characters silently, which was verified rather than
assumed: `"I ran 5 km. Meters matter."` tokenizes to
`word(I) word(ran) number(5) word(km) word(Meters) word(matter)`. The full stop
is gone, and `Meters` is a word token four characters after `km` ends.

So the token stream cannot express a sentence boundary and scan must not look
for one in it. Instead, cue collection walks outward from the mark and stops
when the **source text between two consecutive tokens** contains any of
`.`, `!`, `?`, `;` or a newline. The spans are already in hand; the check is a
substring of the original.

Decimal points are unaffected — `5.5` is one number token and the dot never sits
*between* tokens, which the same probe confirmed. Abbreviations (`e.g.`) will
break a window early. That is accepted: an over-short cue window loses a bias,
while an over-long one imports an unrelated sentence's words as evidence, and
the first failure is the cheaper one.

### 6.7 Assembly

Each surviving resolution becomes a `MarkReading` through the same `toResult`
path `evaluate` uses, so `formatted`, `value` and `confidence` cannot drift from
what the other entry points would report for the same span. `readings` is
truncated to `maxReadings` after ranking, never before.

The mark's own `span` comes from the winning token run's own first and last
tokens (`tokens[from]` and `tokens[to - 1]`), not from `program.root.span`.
For an ordinary run the two coincide, but for a parenthesised one they do not:
a paren pair contributes no span of its own to the AST it builds, so
`program.root.span` for the run `"(1 + 2)"` sits *inside* the parens. Reporting
that would either drop the parens from the mark or, once trailing tokens are
folded in, report a span that omits the opening one entirely. A mark is a
claim about the run backoff found, not about the node that run happened to
produce, so its extent is `{ start: tokens[from].start, end: tokens[to -
1].end }`, mapped back through `normalized.mapSpan` like every other span in
this design.

## 7. English cue tables, first cut

Authored, not generated, and only for `en`. A kind that ships no `cues` key is
not penalised — the same degradation rule `typical` follows.

```ts
// @smartput/duration/src/locale/en.ts
cues: { in: 3, within: 3, after: 2, ago: 3, wait: 3, takes: 2, lasts: 3,
        late: 2, early: 2, delay: 3, every: 1, time: 2 }

// @smartput/length/src/locale/en.ts
cues: { away: 4, far: 3, from: 1, tall: 4, wide: 3, deep: 2, long: 1,
        drive: 2, walk: 2, run: 1, distance: 4, radius: 4 }

// @smartput/mass/src/locale/en.ts
cues: { weighs: 4, weight: 4, heavy: 3, lifts: 2 }

// @smartput/temperature/src/locale/en.ts
cues: { degrees: 3, hot: 3, cold: 3, warm: 2, oven: 3, fever: 3 }

// @smartput/datasize/src/locale/en.ts
cues: { file: 3, download: 2, disk: 3, storage: 3, ram: 3, upload: 2 }

// @smartput/speed/src/locale/en.ts
cues: { speed: 4, fast: 3, limit: 2, driving: 2, wind: 2 }
```

The implementation plan authors tables of the same shape and scale for `volume`,
`area`, `power`, `energy`, `currency` and `percent`; they are not reproduced
here because the judgement in each is per-word and belongs beside the
vocabulary, not in a design document. `from` earns 1 rather than 3 because it argues for length only weakly
— `"5 minutes from now"` is at least as common as `"5 km from work"` — and the
table is where that judgement belongs.

Other locales get the mechanism and no table. Translating cue words is not
translation of the English list: the words that argue for a duration in Polish
are Polish words a Polish speaker picks, and machine-translating this table
would produce a file that looks authored and is not.

## 8. Ruling S4 — `scan` drops a mark that `suggest` would re-throw on

`suggest` re-throws `MissingRateError` rather than answering "no results",
because for a caller who typed `"30 jpy"` the truth is "no rate for JPY" and an
empty list would hide it.

`scan` inverts that for `MissingRateError` alone: the *reading* is dropped, and
the mark with it only if no reading survives. The caller of `scan` did not type
the prose — it arrived from a document, a message, a paste — and a single
unpriced currency in paragraph three must not delete the twelve marks around it.
Dropping the reading rather than the whole mark is the narrower form of the same
rule: a mark whose other readings are perfectly priced still has something true
to say. `KindConflictError` and `UnknownKindError` still propagate: those
describe the caller's wiring, and wiring is as broken on the first mark as on
the last.

Every other `SmartputError` is per-mark and already handled by backoff, which
treats a throw as "this run is not it" and shortens.

## 9. What `scan` does not do

- **`$5` marks as a bare number.** `lex`'s `UNIT_SYMBOLS` allowlist contains
  only `%`; `$` falls through the unrecognized-character path and is skipped, so
  `"it costs $5 today"` tokenizes to `… number(5) word(today)`. This is a
  pre-existing gap in the lexer, not scan's to close, but scan makes it *visible*
  — it produces a confidently wrong `number` mark where `evaluate` produced an
  error. Recorded as a follow-up; the principled fix is the one `lex` already
  names, threading the alias index into the lexer.
- **No cursor API.** Cues re-rank readings and nothing more. A cue-biased
  `complete()` for the fragment under a cursor is a coherent next step and is
  deliberately not in this design.
- **No unit inference.** `"be there in 5"` marks `5` as a number. Proposing the
  unit a cue implies is inventing input.
- **No cross-sentence context.** By §6.6, on purpose.

## 10. Testing

**Unit.**
`cueIndex` folding: case, two kinds claiming one word, a kind with no table, the
`CUE_CEILING` clamp, and a negative cue.

**Solver.**
`cueBonus` lands once per resolution regardless of slot count — the §5
regression, asserted directly on `"5 km + 3 km"`. `Σcontributions === score`
after the new `explain()` row.

**Scanner, table-driven.**
Anchors, backoff, non-overlap, the in-mark/out-of-mark `in` distinction of §6.5,
and sentence breaks.

**The two stated examples, as literal assertions.**
`"My house is in 5km from work"` → one mark, `"5km"`, `length`.
`"Will be in time in 5m"` → one mark, `"5m"`, best reading `duration:min`, with
`length:m` still present and its confidence strictly between 0.01 and 0.10.
The bounds on the loser are the point: an assertion of "duration wins" would
pass just as well under the 25-weight version §4 rejects.

**Span fidelity.**
The whitespace-padding torture of `span.test.ts`, applied to every mark: pad the
input, rescan, and require each mark to slice the same text out of the padded
string that it did out of the unpadded one. That test caught three real
normalized-relative span bugs on the `Result` path and is the reason this design
states the invariant in §2.

**Corpus.**
Every row of `corpus/en.tsv` embedded in a carrier sentence
(`"note: <row> ok"`) must produce exactly one mark whose best reading's kind and
formatted value equal what `evaluate()` returns for the row standing alone. This
is a few hundred assertions for one loop, and it is the net that catches a
backoff change that starts eating a token too many. It must count what it
checked and assert the count, the way the existing corpus span test does —
otherwise a change that makes half the rows throw silently halves the test's
reach and still passes.

**Property.**
Marks are sorted and non-overlapping; scan is stable under leading and trailing
whitespace; `text === input.slice(start, end)` for every mark.

**Size.**
`check-size` covers core, and `cueIndex` plus the scanner add to it. The English
cue tables land in the kind packages rather than in core, so core's growth is
the index and the segmenter alone.

## 11. Files

| File | Change |
| --- | --- |
| `packages/kind/src/types.ts` | `Vocabulary.cues?` |
| `packages/core/src/kind/registry.ts` | `CueEntry`, `Registry.cueIndex`, the fold |
| `packages/core/src/solve/solver.ts` | `Resolution.cueBonus`, the term in `enumerate` |
| `packages/core/src/solve/solver-class.ts` | `SolveScope.cues`, forwarded |
| `packages/core/src/scan/scan.ts` | new — `Scanner`, anchors, backoff, assembly |
| `packages/core/src/scan/cues.ts` | new — window walk, sentence breaks, clamp |
| `packages/core/src/engine.ts` | `EvalOptions.cues`, `ScanOptions`, `Mark`, `scan()` |
| `packages/core/src/index.ts` | exports |
| `packages/{duration,length,mass,temperature,datasize,speed,volume,area,power,energy,currency,percent}/src/locale/en.ts` | `cues` |
| `README.md`, `docs/` | the five-entry-point table becomes six |
