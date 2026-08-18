---
title: "@smartput/range"
description: "Numeric and measured ranges: `10–20 km`."
---

# @smartput/range

`RANGE_KINDS` registers a range over every ratio kind, and `Range` is the class door onto one.

## Try it

<SpSelection />

`first three`, `last three`, `from 6 to 9`, `4-5`, `(1;5]`.

One package, two kinds, and an answer that is **two positions in a list** rather
than a quantity of anything. It is the range kind with no calendar in it: where
[`date-range`](/packages/range-core) answers with two instants,
[`@smartput/range`](https://npmjs.com/package/@smartput/range) answers with two
array indices, for the launcher that has a list of results and a person typing
which of them they meant.

```sh
bun add @smartput/range
```

```ts
import { Range } from "@smartput/range/class";

const results = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

Range.parse("first three")?.slice(results); // ["a", "b", "c"]
Range.parse("last three")?.slice(results);  // ["h", "i", "j"]
Range.parse("from 6 to 9")?.slice(results); // ["f", "g", "h", "i"]
Range.parse("4-5")?.slice(results);         // ["d", "e"]
Range.parse("(1;5]")?.slice(results);       // ["b", "c", "d", "e"]
```

Most callers want exactly that and nothing else — a string and a list, no engine.
The kinds below are for the launcher that already has one.

## The two rules

**Positions are written from one and stored from zero.** People count items
starting at one, and `Array.prototype.at` starts at zero, so "from 6 to 9" is
`[5, 8]`. The translation happens once, at the parse, and everything downstream
is an index.

**A negative position counts back from the end, `-1` being the last item.** That
is what lets "last three" be `[-3, -1]` without knowing how long the list is —
the phrase is parsed at a moment when the list may not exist yet, and `resolve`
is what needs the length.

Both ends are **inclusive**. A half-open end would read better against
`Array.prototype.slice` and worse against everything a person says: "from 6 to 9"
means item nine is in, and a stored `9` that displays as `9` and excludes item 9
is a trap the caller falls into once per codebase.

## What it recognises

| Input | Result | Over ten items |
| --- | --- | --- |
| `first` | `[0, 0]` | a |
| `first three` / `first 3` / `top 3` | `[0, 2]` | a b c |
| `first one hundred` | `[0, 99]` | all ten |
| `last` | `[-1, -1]` | j |
| `last three` / `bottom 3` | `[-3, -1]` | h i j |
| `from 6 to 9` / `6 to 9` | `[5, 8]` | f g h i |
| `from 2 until 4` / `till` / `through` | `[1, 3]` | b c d |
| `from -3 to -1` | `[-3, -1]` | h i j |
| `4-5` | `[3, 4]` | d e |
| `[1,5]` | `[0, 4]` | a b c d e |
| `(1,5]` / `(1;5]` / `[2,5]` | `[1, 4]` | b c d e |
| `[1,5)` | `[0, 3]` | a b c d |

Counts may be spelled — `numberFromWords` is
[`@smartput/number`](/guide/kinds)'s, so "one hundred and five" reads the same
here as it does in a quantity.

**Ordinal words are deliberately absent.** `second` is a `duration` alias in
every locale pack this repo ships, so claiming it here would put a selection
reading on the right of "3 seconds" for the solver to weigh — the same reason
[`date-range` refuses to claim a bare "week"](/packages/range-core). Positions are
written as numbers or not at all.

### Interval notation

`[` and `]` include the endpoint, `(` and `)` exclude it. Both separators are
accepted, because both are written: a comma is the English convention and a
semicolon the one most of continental Europe learns, for the reason that decimal
commas make `(1,5)` ambiguous there. This parser reads integers only, so it has
no such ambiguity to resolve and no reason to refuse either spelling.

An open end moves **inwards by one written position**, which is what makes
`(1;5]` and `[2;5]` the same four items. The adjustment happens in written space,
before the origin is applied, so a negative open end stays correct: `[1,-1)`
excludes the last item and stops at `-2`.

## The value

Ordinary `Value`s, no new field, nothing `JSON.stringify` will choke on.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { RANGE_KINDS } from "@smartput/range";

const en = composeLocale(english, BUILTIN_EN);

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, ...RANGE_KINDS],
});

const { value } = engine.evaluate("from 6 to 9");

value.kind;                 // "range"
value.unit;                 // "range-slice"
value.canonical.toString(); // "5" — the start position
value.meta;                 // { start: 5, end: 8 }

engine.evaluate("from 6 to 9").formatted; // "[5, 8]"
```

`canonical` is the **start**, so ordering and comparison work without the engine
knowing what a selection is — the same trick every range kind in the repo plays.

`RANGE_KINDS` is two kinds, and registering one without the other is a quiet
mistake rather than an error. See [the dash](#the-dash-and-what-it-costs).

## Applying it

`Range` is the door. It is immutable, it knows nothing about the list until you
hand it one, and it never throws for a list that is shorter than the phrase.

```ts
import { Range } from "@smartput/range/class";

const r = Range.parse("last three");   // Range | null

r.start;             // -3
r.end;               // -1
r.count;             // 3 — null when the ends disagree on sign
r.fromEnd;           // true
String(r);           // "[-3, -1]"

r.resolve(10);       // { start: 7, end: 9, count: 3 }
r.indices(10);       // [7, 8, 9]
r.slice(items);      // the items themselves

Range.first(3);      // [0, 2]
Range.last(3);       // [-3, -1]
Range.all();         // [0, -1]
Range.from(value);   // from an engine Result
```

**Resolution clamps rather than throws.** "first ten" over a list of three is the
answer "all three of them", not a mistake the user made, and a launcher that
threw there would fail on every short result set. Out of range in the other
direction — "from 20 to 30" over three items — clamps to an empty selection,
reported as `count: 0`.

`Range.parse` returns **null** for a string that is not a selection at all,
because "is this a range?" is a question a launcher asks of every keystroke and
an exception is a poor way to answer no. A string that *is* a selection and is
wrong still throws.

## The dash, and what it costs

`4-5` is the input this package turns on, because `- | number | number` already
claims it and answers **-1**.

The answer is the one [`time-range`](/packages/range-core#the-dash-and-what-it-costs)
found for `10:00 - 20:00`: a second kind over the same surface, weighted so it
loses every contest it is not wanted in, and an op signature that pays the
penalty back.

```
lex "4-5"
  literal @0  readings: [number 4, index 4]
  op      -
  literal @2  readings: [number 5, index 5]

solver:
  - | number | number -> number    @smartput/core's ratio ops
  - | index  | index  -> range     @smartput/range
```

`index` is a kind whose only purpose is to be an operand. It claims a bare
non-negative integer at **-20**, so a bare "6" is still a number and still
formats as one, and it declines any run followed by a unit alias — core's ruling
R4, the same one that keeps `10 m` from becoming a date.

### Why the arithmetic differs from `time-range`'s

`contextBonus` pays +30 to a binary node whose operands agree on kind **unless
that kind is `number`**. Over in `time-range` both competing paths collect it and
it cancels; here only one path can, and the asymmetry is the whole reason the
reading penalty is -20 rather than -5:

| Path | Score |
| --- | --- |
| `- \| number \| number` | `-0.5 - 0.5` = **-1** |
| `- \| index \| index` | `-20 - 20 + 30 + 20` = **10** |

The selection wins by 11. Had the reading stayed at -5, the range path would
score 20 with `dashWeight: 0` and win anyway — the dial documented as "gives
subtraction back" would have given nothing back. The penalty has to be steep
enough that the free +30 loses on its own: `2 × reading + 30 < -1`, so anything
below -15.5.

The winning score of 10 stays under `TYPO_PENALTY` (15), so a selection can never
overturn a corrected reading.

### The cost, stated plainly

An engine with these kinds registered reads **`4 - 5` as a selection too**, not
only the tight `4-5`. Core's token stream carries no adjacency, so no weight can
tell the two spellings apart. If you want your subtraction back:

```ts
import { createIndex, createRange } from "@smartput/range";

createRange({ dashWeight: 0 });  // "4-5" is -1 again
```

That leaves every other form exactly as it was — including `6 to 9`, which needs
no refund at all: there is no `in | number | number` for a pair of bare integers,
so the selection is the only reading either way.

`in | index | index` exists because `to` and `as` are surface words core's
`keywordFor` folds onto `in`, so `6 to 9` arrives as a convert node and `4-5` as
a binary one.

### Why `index` must be registered

`range`'s two signatures name `index` by string, and registry pass 4 does not
check that a named operand kind exists. A `range` registered on its own is not an
error — it is a kind that silently claims the written phrases and loses the dash.
`RANGE_KINDS` is the export that makes forgetting impossible.

## Configuring it

```ts
import { createIndex, createRange } from "@smartput/range";

createRange({ dashWeight: 20 });  // the refund; 0 restores subtraction
createRange({ phraseWeight: 0 }); // charged to every written claim
createRange({ origin: 0 });       // "from 6 to 9" is [6, 9]
createRange({ phrases: { head: (n) => ({ start: 0, end: n - 1 }) } });
createIndex({ weight: -20 });     // the reading penalty
```

`origin: 0` takes written positions as indices already — for a REPL over an array
or a picker over rows it numbered itself. It is the one setting under which
`ZeroIndexError` is unreachable. A **count** is a count of items either way:
"first three" names no position, so it is `[0, 2]` at either origin.

`phrases` replaces the `first` / `top` / `last` / `bottom` table outright.

## Errors

| Input | Outcome |
| --- | --- |
| `9 to 6` | `BackwardsRangeError` |
| `[5,2]` | `BackwardsRangeError` |
| `0 to 5` | `ZeroIndexError` — positions are counted from 1 |
| `first ten` over three items | all three — clamped, not an error |
| `from 20 to 30` over three items | `count: 0` — an empty selection |
| `from 6` | not claimed; an incomplete range is not a range |
| `[0, -1]` | "everything"; ordering is decided by the list, not the phrase |

`BackwardsRangeError` names both ends, because being told the range is backwards
without being told which end came out where leaves the user re-deriving it. It
fires only when the two ends share a sign: whether `[0, -1]` is backwards is a
fact about the list rather than about the phrase, and that one resolves to
`count: 0` later instead.

```ts
try {
  engine.evaluate("9 to 6");
} catch (e) {
  e.name;   // "BackwardsRangeError"
  e.start;  // 8
  e.end;    // 5
}
```

## What it does not do

- **No ordinal words.** `second` and `third` are units, not positions.
- **No `..` in the engine.** `Range.parse("1..5")` works; the engine's lexer
  reads `1..5` as a malformed number and produces one token, so the matcher is
  never offered the run. The written closers — `to`, `until`, `till`, `through` —
  are the reachable ones.
- **No `[` inside an expression.** Core's lexer drops `[`, `]` and `;` as
  unrecognized characters. The matcher finds an opening `[` by looking one
  character behind the offset it is offered, which is enough for `[1,5]` standing
  alone and is not a general bracket grammar.
- **English counts only.** The written positions are locale-independent; the
  spelled ones go through `@smartput/number`, which is English.

## Installing

```sh
npm add @smartput/range
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/range` | The package root. |
| `@smartput/range/class` | The immutable value class. |

## Runtime exports

Type-only exports are erased and do not appear here.

`ANCHORS` · `BackwardsRangeError` · `DEFAULT_DASH_WEIGHT` · `DEFAULT_INDEX_WEIGHT` · `DEFAULT_PHRASE_WEIGHT` · `INDEX_KIND` · `INDEX_UNIT` · `RANGE_KIND` · `RANGE_KINDS` · `RANGE_UNIT` · `Range` · `ZeroIndexError` · `assertOrdered` · `claimAt` · `createIndex` · `createRange` · `formatSlice` · `index` · `parseSlice` · `range` · `resolveSlice` · `sliceItems` · `toPosition` · `unwrapSlice` · `wrapSlice`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| range | ≤ 43.7 kB | ≤ 17.3 kB |
| range/class | ≤ 43.8 kB | ≤ 17.4 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/number`](/packages/number)

## See also

- [Ranges](/packages/range-core)
- [Selections](/packages/range)

