# smartputs Word Math Design

Spelled-out numbers and word operators. `"one kg"` evaluates like `"1 kg"`,
`"one thousand thirty two"` evaluates to `1032`, and `"ten km plus five km"`
evaluates like `"10 km + 5 km"`.

The engine this extends is specified in `2026-08-04-smartputs-design.md`. This
document adds two token passes, changes one locale hook signature, and extends
one union type. The lexer, the Pratt parser, the resolver and the solver are
untouched.

## 1. Why this exists

`Locale.numerals` has been declared in `types.ts` and documented in
`guide/locales.md`, `api/define-locale.md` and `api/types.md` since M1. Nothing
calls it. The original design named `plus` and `minus` as keywords; M1 shipped
`Keyword = "in" | "of"` and left the rest for later. This is later.

A launcher calculator is typed into by people, and people type words. The gap is
narrow and the seams for closing it were designed in already.

## 2. Scope

Recognised:

| Form | Example | Result |
| --- | --- | --- |
| Cardinal, one word | `one kg` | `1 kg` |
| Cardinal, multi-word | `one thousand thirty two` | `1032` |
| Cardinal, hyphenated | `twenty-two km` | `22 km` |
| Cardinal with connector | `two hundred and five g` | `205 g` |
| Digits with a scale word | `1.5 million m` | `1500000 m` |
| Word operators | `ten km plus five km` | `15 km` |
| Phrasal operators | `twenty divided by four` | `5` |
| Word unary minus | `minus five kg` | `-5 kg` |

Not recognised, deliberately:

| Excluded | Why |
| --- | --- |
| `three point five kg` | `point` is a registered `measure` alias (`kinds/measure.ts:53`). Making it a decimal marker would shadow a shipped unit. |
| `a kg`, `an inch` | `a` is the SI alias for the are. A leading-position-only rule buys one keystroke for a real collision. |
| `half`, `a third` | Fractions are a separate grammar, not a cardinal one. |
| `first`, `second`, `third` | Ordinals. `second` is a duration unit and must stay one. |
| `and` as an addition operator | Needed as a numeral connector by `two hundred and five`. A locale that wants it as `plus` cannot have both. |
| `x` as multiplication | Reserved for a possible `3 x 4 m` dimension syntax. |
| `less` as subtraction | Ambiguous with comparison. |

`nineteen eighty four` evaluates to `103`, not `1984`. Year reading is not a
unit-calculator concern and the accumulator that would support it is a different
machine.

## 3. Pipeline

```
normalize → lex → foldNumerals → foldWordOps → parse → solve
```

Both new stages are pure `Token[] → Token[]`. They are inserted in
`createEngine`'s `pipeline()` between the existing `lex` and `parse` calls.

Placing them after the lexer rather than inside it keeps `lex.ts` — already the
densest file in `parse/`, juggling segmentation, digit suffixes, unit symbols and
keywords — at its current size, gives each rewrite its own test file, and lets
`complete()` opt out, which it does.

## 4. Word operators

### 4.1 The `Keyword` union

```ts
export type Keyword = "in" | "of" | "plus" | "minus" | "times" | "over" | "by";
```

Members are keys, never surface words, exactly as `in` is the key under which a
locale lists `"in"`, `"to"` and `"as"`.

### 4.2 English vocabulary

```ts
keywords: {
  in:    ["in", "to", "as"],
  of:    ["of"],
  plus:  ["plus"],
  minus: ["minus"],
  times: ["times", "multiplied"],
  over:  ["over", "divided"],
  by:    ["by"],
}
```

`lex()` already produces `keyword` tokens for anything a locale lists, so the
lexer needs no change to see these.

### 4.3 `parse/wordops.ts`

```ts
export function foldWordOps(tokens: Token[]): Token[];
```

Rewrites `keyword` tokens whose key is in `{plus, minus, times, over}` into `op`
tokens via a fixed core map:

| Keyword | `OpSymbol` |
| --- | --- |
| `plus` | `+` |
| `minus` | `-` |
| `times` | `*` |
| `over` | `/` |

A `by` keyword immediately following one of those four is consumed into it, so
`divided by` and `multiplied by` each collapse to a single `op` token. The
emitted token's span covers the whole phrase, so `explain()` and error
underlining point at what the user typed.

A `by` keyword in any other position is left alone and reaches the parser as an
unconsumed token, which fails with `UnitParseError` — the same outcome `"10 as"`
produces today.

The map is core, not locale data: `plus` means addition in every language that
has the concept. Only the surface words are per-locale, and those live in
`locale.keywords`.

### 4.4 Why the parser needs no change

`pratt.ts` already handles `op` tokens in both prefix (`parseAtom`'s unary `-`
branch) and infix (`parseExpr`'s `BINDING` lookup) position. Rewriting to `op`
before parsing means word operators get the existing precedences —
`ten plus two times three` is `16`, not `36` — with no second precedence table to
keep in sync.

### 4.5 Shadowing

Making a word a keyword makes it unavailable as a unit alias, because
`keywordFor` runs before candidate resolution. This is pre-existing behaviour,
not a new rule: `"12 in"` raises `UnitParseError` today because the `in` keyword
shadows the inch alias.

None of `plus`, `minus`, `times`, `over`, `by`, `multiplied` or `divided` is a
registered alias in any shipped lexicon. The cost is zero today and is a
documented constraint on future vocabulary.

## 5. Numerals

### 5.1 The hook signature

```ts
export interface NumeralMatch {
  value: Decimal;
  /** How many of the offered words the parser claimed, from the front. */
  consumed: number;
}

export type NumeralParser = (words: string[]) => NumeralMatch | null;

// Locale
numerals?: NumeralParser;
```

The previous signature, `(word: string) => Decimal | null`, cannot express
`one thousand thirty two`: it sees one word and has no way to say it wants more.
The change is breaking on paper and inert in practice — the hook has no callers
and no shipped locale sets it.

Returning `null` means "claimed nothing". Returning `consumed: 0` is invalid; the
fold treats it as `null`.

### 5.2 `locale/helpers.ts` — `cardinalNumerals()`

```ts
cardinalNumerals(opts: {
  units: Record<string, number>;      // zero..nineteen
  tens: Record<string, number>;       // twenty..ninety
  scales: Record<string, number>;     // hundred, thousand, million, ...
  connectors?: string[];              // ["and"]
}): NumeralParser
```

A table-driven builder beside `identity()` and `suffixStripper()`, so a locale
author configures vocabulary rather than writing an accumulator. The original
design named a `slavicNumerals()` sibling; this is the seam it was named for.

`en.ts` passes the English table: `zero`–`nineteen`, `twenty`–`ninety`,
`hundred`/`thousand`/`million`/`billion`/`trillion`, connector `and`.

Accumulation, over `Decimal` throughout so the engine's precision promise holds:

```
total = 0, current = 0
for each word:
  unit or teen or ten  →  current += value
  scale < 1000         →  current  = (current || 1) * value
  scale >= 1000        →  total   += (current || 1) * value ; current = 0
  connector            →  skip, only if something has already been claimed
  anything else        →  stop
result = total + current
```

Matching is greedy: the parser consumes as many words as it can. `consumed`
reports the index after the last word that left the machine in an accepting
state, so a trailing connector is never claimed — `five and kg` yields
`{value: 5, consumed: 1}`.

Words are matched case-folded against the tables. No analyzer chain runs on
them: numeral words are closed-class and do not inflect in English.

### 5.3 `parse/numerals.ts`

```ts
export function foldNumerals(tokens: Token[], locale: Locale): Token[];
```

Returns `tokens` unchanged when `locale.numerals` is undefined.

Otherwise it walks the token list. At each `word` token it collects the maximal
following run of `word` tokens, offers their texts to the hook, and on a match
replaces the consumed tokens with one `number` token whose `value` is the
returned `Decimal`, whose `start` and `end` span every consumed token, and whose
`text` is the joined source slice.

Keyword, op, paren and number tokens end a run, so `ten km plus five km` offers
`["ten"]`, then `["km"]` (no match), then `["five"]`, then `["km"]`.

### 5.4 Hyphens

`normalize.ts:10` maps every dash to `-`, and `lex` emits `-` as an `op` token.
So `twenty-two` reaches the fold as `word(twenty) op(-) word(two)` and would
otherwise evaluate to `18`.

The run collector absorbs an `op:"-"` into a run only when the tokens on both
sides are adjacent in the source:

```
prev.end === op.start && op.end === next.start
```

Spans make this exact. `twenty-two` is `22`; `twenty - two` and `twenty- two`
remain subtraction. The rule is written this way rather than by pre-processing
hyphens in `normalize()` because `normalize()` feeds every kind, and a dash is
load-bearing punctuation elsewhere.

### 5.5 Digits followed by a scale word

A `number` token followed by a `word` run that the hook parses as a bare scale
multiplier — `hundred`, `thousand`, `million`, `billion`, `trillion` — multiplies
the number: `1.5 million` is `1500000`.

The fold detects this by offering the run to the hook and checking that the match
consumed only scale words. Anything else after a number is left alone, so
`5 one` still raises `NoCandidateError` exactly as it does today.

### 5.6 Collisions

`one` is not a resolvable alias. The `number` kind's canonical unit is *keyed*
`one` (`kinds/number.ts:5`), but unit keys are not auto-aliased: `evaluate("5 one")`
raises `NoCandidateError` today. No numeral word in the English table collides
with a shipped alias.

The fold is greedy and does not preserve an alternative reading. A locale that
gives a numeral word to a unit lexicon loses the unit. This is the same trade the
keyword table already makes, and the same table-owner who would create the
collision is the one who can resolve it.

## 6. Completion

`leadingCount` (`complete/fragment.ts:33`) reads a trailing digit run to feed
`scaleFit`. It gains a spelled-word branch: when the digit regex finds nothing,
the words immediately preceding the fragment are offered to `locale.numerals`, so
`twenty k` ranks kilometres against kilobytes the way `20 k` does.

`NumeralParser` consumes from the *front* of what it is given, but completion
needs the count that ends where the fragment begins. So the branch splits the
preceding text into words and tries successively shorter suffixes of that list —
longest first — accepting the first match whose `consumed` covers the whole
suffix. `"5 kg + one thousand thirty two k"` offers
`["one","thousand","thirty","two"]` and matches on the first try; `"weighs twenty k"`
fails on `["weighs","twenty"]` and succeeds on `["twenty"]`. The list is capped at
the longest numeral phrase worth scanning, eight words, so a long sentence costs a
bounded number of calls.

No match returns `null`, which is what `leadingCount` already returns for
unparseable input, and `scaleFit` already scores `0`.

`complete()` does not suggest numeral words or operator words. Completing `"o"`
to `"one"` competes with every unit starting in `o` for no gain — a user typing a
spelled number is not looking for help finishing it.

The two folds do not run inside `complete()`. Completion works on a trailing
fragment, not a parse.

## 7. Errors

No new error type. Unclaimed words reach the resolver and fail with
`NoCandidateError` as before; a stranded `by` or a dangling operator fails with
`UnitParseError` as before. Spans on folded tokens cover the full phrase, so
underlining is unchanged in kind.

## 8. Testing

| File | Covers |
| --- | --- |
| `locale/helpers.test.ts` | `cardinalNumerals`: the accumulator, greedy `consumed`, trailing connectors, case folding, unknown words |
| `parse/numerals.test.ts` | Run collection, span arithmetic, adjacency-gated hyphens, digits-plus-scale, the undefined-hook passthrough |
| `parse/wordops.test.ts` | Keyword-to-op mapping, `by` absorption, stranded `by`, span coverage |
| `corpus/en.tsv` | End-to-end rows, driven by the existing table test |

Corpus rows, columns tab-separated as the file requires — aligned here for
reading only:

```
one kg                      mass      1000      1 kilogram
one thousand thirty two     number    1032      1,032
two hundred and five g      mass      205       205 grams
twenty-two km               length    22000     22 kilometres
ten km plus five km         length    15000     15 kilometres
twenty divided by four      number    5         5
minus five kg               mass      -5000     -5 kilograms
1.5 million m               length    1500000   1,500,000 metres
```

Regression rows that must keep their current behaviour: `twenty - two` as
subtraction, `10 km - 5 km`, `20% of 50`, `212 F in C`.

## 9. Documentation

| File | Change |
| --- | --- |
| `guide/locales.md` | `NumeralParser` signature, the `cardinalNumerals` helper, the numeral section |
| `api/define-locale.md` | Same, plus the four new keyword keys |
| `api/types.md` | `Keyword` union, `NumeralMatch`, `NumeralParser` |
| `guide/pipeline.md` | The two new stages |
| `guide/roadmap.md` | Milestone row |

## 10. What this does not change

`lex.ts`, `pratt.ts`, `candidates.ts`, `solve/solver.ts`, `eval/evaluate.ts`,
`format/format.ts`, every kind descriptor, and the public `Engine` interface.
`Token` gains no member. `Node` gains no member. `OpSymbol` gains no member.
