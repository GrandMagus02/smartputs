---
title: Completion
description: complete() ranks the units a half-typed fragment could still become.
---

# Completion

`suggest()` answers *what does this mean?*. `complete()` answers the question a
user is actually asking while still typing: *what could this word still become?*

```ts
engine.complete("30 ho");
// [ { alias: "hour", span: { start: 3, end: 5 }, text: "30 hours",
//     kind: "duration", unit: "h", score: 1 } ]
```

`text` is the **whole input rewritten**, not the unit word on its own, so the
value goes straight back into the input box. `span` is where the replacement
happened, for a caller that would rather splice the string itself.

<SpComplete
  model-value="30 ho"
  :examples="['30 ho', '5 kilog', '45 sec', '12 inc', '2 km in mil', '10 kg + 5 gram']"
  hint="Only the trailing fragment completes. Everything before it is copied through untouched, which is why the rewritten text stays evaluable." />

## Only the trailing fragment

An expression completes its last token and nothing else. `10 kg + 5 gram`
becomes `10 kg + 5 grams`; the `kg` is left exactly as typed. A fragment that is
not a word — a digit, a closing paren, an empty string — has nothing to complete
and returns `[]`.

`complete()` never throws. There is no input for which it is the wrong call.

## How rows are ranked

`score` is a sum of three terms, and the first of them is the same weight stack
that ranks readings:

| Term | What it expresses |
| --- | --- |
| `resolveWeight(...)` | the [four weight layers](/guide/weights) and the kind's `prior` — everything that already decides `m` means metres here |
| `prefixQuality(alias, typed)` | how much of the alias the user has already committed to. An exact alias beats a long word barely begun. |
| `scaleFit(count, typical)` | whether the number in front of the fragment falls in the band people actually type that unit in |

Bands are declared on the **kind**, keyed by unit — a magnitude range is physics
rather than language, so it does not move when a translation does:

```ts
// packages/length/src/index.ts
export const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: decimalRatios(LENGTH_UNITS) },
  typical: { mm: [1, 1000], cm: [1, 300], m: [1, 1000], mi: [0.1, 500] /* … */ },
});

// packages/length/src/locale/en.ts — the words, in a Vocabulary of their own
mi: { aliases: ["mi", "mile"], symbol: "mi", forms: { one: "mile", other: "miles" } }
```

The same row scores differently depending on the number in front of it:

```ts
engine.complete("2 mi")[0];   // → "2 miles",   score 13
engine.complete("600 mi")[0]; // → "600 miles", score 10
```

Three points, because 600 falls outside miles' band. Omitting a band scores
zero — the same as being out of one — so declaring a band is never a penalty,
which is what stops the honest kinds from being punished for supplying data.

## When nothing prefixes the fragment

`complete("1 klogram")` used to return `[]`. Nothing in the alias index starts
with `klogram`, and a prefix matcher has no other question to ask — so the one
input where the user most needs help got the same answer as gibberish.

When the prefix pass comes back empty, and only then, the fragment is matched
once against the alias index by [edit distance](/guide/weights#reading-through-a-typo)
and the single nearest alias is offered as an ordinary row:

```ts
engine.complete("1 kilogram")[0].score; //  13   exact alias, inside its band
engine.complete("1 kilogr")[0].score;   //   1   two characters still to type
engine.complete("1 klogram")[0].score;  // -22   the same alias, misspelled
```

`TYPO_PENALTY` is 25 per edit, and it is priced against the *range* a prefix
offer occupies rather than against a contest — 13 at the top, about −11 for the
longest alias in the index barely begun — because the two never meet in one
list. What it has to hold is the comparison the user makes across keystrokes:
the misspelling must read as visibly worse than the half-typed word, not as the
same offer arriving by another route.

`prefixQuality` is withheld from a corrected row. A corrected alias is by
construction not one the fragment prefixes — had it been, the prefix pass would
have found it and this one would never have run — so "characters still untyped"
has nothing to count. That is the same rule the completer path already applies
to a row whose alias its fragment does not prefix, and it makes the arithmetic
above exact: a corrected row is the exact row less `EXACT_BONUS` less
`TYPO_PENALTY`.

**The scan never reaches a kind's own `completions`.** The distance pass runs
over the global alias index and nothing else, once per unknown fragment. That is
the difference between a few hundred names and the 6,247 city names behind
[`Kind.completions`](/api/define-kind#completions), and between a cost paid on
an error path and one paid on every keystroke. The boundary is structural rather
than remembered: the helper takes the registry's alias index, not an iterable of
strings, so a completions vocabulary cannot be handed to it by a one-line
change. A test asserts a completions-supplying kind is never consulted.

## One row per unit

`mi` and `mile` are the same unit, and offering both would fill a six-row
dropdown with three answers. Rows are deduplicated per `(kind, unit)`, keeping
the highest-scoring alias — and on an exact tie, the alphabetically first, so
`millimetre` and `millimeter` resolve identically on every run.

## The insert text has to parse

Completion inserts the unit's `forms` entry for the key the language's
`selectForm` returns for the number in front of it — `1 hour`, `2 hours`,
`0.5 hours`, and in Ukrainian `2 кілограми` against `5 кілограмів`. English's
`selectForm` is `Intl.PluralRules`; that is the default *implementation*, not
the model.

The words come from the language named by
[`format`](/guide/locales#format), never from whichever language's alias
happened to match. Completion is a generation path, and it did not always know
it: while the alias index held one language the two were the same set, and the
moment a second language was installed an English-format engine started
answering `complete("5 б")` with `5 біт` — 401 rows of a 15,568-row sweep,
with every test in the repo green.

That constrains what a vocabulary may declare. A `forms` entry the parser would
reject is a dead end: the user accepts the row and the expression stops
evaluating. So several kinds declare none and let completion fall back to the
alias, which is already the form people type:

| Kind | Falls back because |
| --- | --- |
| `temperature` | "20 celsius degrees" is not what anyone writes; `20 c` is |
| `area`, `speed` | "square metres", "kilometres per hour" are multi-word — the lexer cannot take a two-word unit token |
| `percent` | the written form of the unit *is* the symbol |
| `money` (CAD, AUD) | "Canadian dollar" is two words, so those two insert the ISO code |

The corpus in `packages/core/corpus/en-complete.tsv` pins one row per unit and
asserts the inserted text, which is what keeps that rule from rotting.

## Options

```ts
interface CompleteOptions {
  kinds?: KindId[];   // hard filter, same meaning as EvalOptions.kinds
  weights?: Weights;  // per-call weight layer 4
  limit?: number;     // applied after ranking. Default 10
}
```

```ts
engine.complete("30 d", { kinds: ["duration"] }); // never offers degrees
```

## With money registered

Currencies compete for the same fragment as everything else, ranked by the same
sum. `30 d` offers days, then degrees, then dollars; `100 p` puts zlotys above
pounds; `1000 y` puts yen above yards.

<SpComplete
  with-money
  title="engine.complete(input) — money registered"
  model-value="30 d"
  :examples="['30 d', '5 e', '100 p', '20 u', '1000 y']"
  hint="Same call, one more kind registered. Completion has no currency-specific code path." />

## Next

- [`complete()` API reference](/api/complete) — the full return shape.
- [Ambiguity and weights](/guide/weights) — the ranking terms it inherits.
