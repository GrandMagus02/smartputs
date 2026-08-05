---
title: defineLocale
description: Language mechanics, analyzer helpers, and translation packs.
---

# defineLocale

```ts
function defineLocale(locale: Locale): Locale
```

Declares language *mechanics*: segmentation, morphology, numerals, keywords and
weight conventions. Unit vocabulary is **not** here — it lives with the kind
that defines it, so the two cannot drift.

```ts
import { defineLocale, identity, suffixStripper, tableAnalyzer } from "@smartput/core";

export default defineLocale({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
    tableAnalyzer({ feet: "foot", inches: "inch" }, -1),
  ],
  keywords: { in: ["in", "to", "as"], plus: ["plus"], minus: ["minus"], of: ["of"] },
});
```

## Locale

```ts
interface Locale {
  id: string;                                  // BCP-47
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];
  analyze?: Analyzer[];
  numerals?: NumeralParser;
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}
```

### id

A BCP-47 tag. It is passed to `Intl.Segmenter`, `Intl.NumberFormat`,
`Intl.PluralRules` and `toLocaleLowerCase`, so case folding is correct for
Turkish dotted/dotless `i` without a special case.

### numberFormat

`"intl"` reads and writes numbers through `Intl.NumberFormat` for `id`. Supply a
`NumberFormatSpec` to override:

```ts
interface NumberFormatSpec {
  group: string;    // "." in de, "," in en
  decimal: string;  // "," in de, "." in en
}
```

### segment

Defaults to `Intl.Segmenter(id, { granularity: "word" })`, filtered to word-like
segments. Override for scripts without whitespace where the default boundary
detection is not good enough.

### analyze

An ordered chain, surface form → lemma candidates.

```ts
type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];
type AnalyzedForm = { form: string; weight?: number; tags?: string[] };
```

Analyzers return **several** candidates. Each becomes a scored solver candidate,
with `weight` expressing the analyzer's own confidence, so a stripped suffix
ranks below an exact match without any new resolution rules. Output is memoized
per `(locale, surface)`.

### keywords

```ts
type Keyword = "in" | "of" | "plus" | "minus" | "times" | "over" | "by";
```

Matched case-insensitively per locale. `Keyword` names the **keys** of
`Locale.keywords`, not the surface words — `in`, `to` and `as` all drive
conversion, but only `in` is a key; `"to"` and `"as"` are values reached
through it.

`plus`, `minus`, `times` and `over` are rewritten into `+`, `-`, `*` and `/`
before parsing. A `by` immediately following one of them is swallowed so
`"divided by"` and `"multiplied by"` are each a single operator; a `by`
anywhere else reaches the parser unconsumed and fails, exactly as a stray
`"as"` does. A word listed as a keyword can no longer resolve as a unit
alias — the same trade `in` already makes with the inch alias.

### numerals

```ts
type NumeralParser = (words: string[]) => NumeralMatch | null;

interface NumeralMatch {
  value: Decimal;
  /** How many of the offered words the parser claimed, from the front. */
  consumed: number;
}
```

Spelled-out numbers: `"twenty"`, `"двадцять"`, `二十`, `٢٠`. It is offered a run
of consecutive words and claims a **prefix** of it, returning `null` for
anything it does not recognise.

The run-and-prefix shape is what a single-word signature could not express:
`"one thousand thirty two"` is one number across four words, and a parser that
saw one word at a time had no way to ask for more. `consumed` is how it hands
back the words it did not want — `"five kg"` claims one word and leaves `kg` to
the unit resolver.

#### cardinalNumerals()

```ts
cardinalNumerals(opts: {
  units: Record<string, number>;    // zero…nineteen
  tens: Record<string, number>;     // twenty, thirty, …
  scales: Record<string, number>;   // hundred, thousand, million, …
  connectors?: string[];            // "and"
}): NumeralParser
```

A table-driven implementation covering every language that builds cardinals by
addition and multiplication — which is most of them. Scales below a thousand
multiply what precedes them; a thousand and above close the group and add to the
running total.

```ts
const numerals = cardinalNumerals({
  units: { zero: 0, one: 1, /* … */ nineteen: 19 },
  tens: { twenty: 20, /* … */ ninety: 90 },
  scales: { hundred: 100, thousand: 1e3, million: 1e6 },
  connectors: ["and"],
});

numerals(["two", "hundred", "and", "five"]); // { value: 205, consumed: 4 }
numerals(["five", "kg"]);                    // { value: 5, consumed: 1 }
numerals(["five", "and", "kg"]);             // { value: 5, consumed: 1 }
numerals(["kg"]);                            // null
```

A connector advances the scan without extending `consumed`, which is what stops
`"five and kg"` from claiming the `and` it never used.

`en` declares `"and"` as a numeral connector rather than an operator. A locale
cannot have it both ways, and `"two hundred and five"` is the commoner input.

`createEngine` calls this hook through `foldNumerals`, a pure token pass that
runs before parsing — see [the pipeline](/guide/pipeline) — so
`engine.evaluate("twenty two kg")` evaluates like `engine.evaluate("22 kg")`.

### weights

Layer 2 of the [weight stack](/guide/weights): locale conventions, such as
preferring `lb` over `lb` mass-vs-force readings in `en-GB`.

## Analyzer helpers

### identity()

```ts
identity(): Analyzer
```

Retains the exact surface form at weight 0. Always first in a chain — it is what
guarantees an unmodified word outranks any guessed stem.

### suffixStripper()

```ts
suffixStripper(opts: {
  suffixes: string[];
  minStem: number;
  weight?: number;
}): Analyzer
```

Emits the surface form with each matching suffix removed, at `weight` (use a
negative number). `minStem` prevents stripping a word down to noise. Covers most
Indo-European inflection.

Over-generation is harmless: `inches` → `inche` matches no alias, so the
candidate finds nothing and disappears.

### tableAnalyzer()

```ts
tableAnalyzer(map: Record<string, string>, weight?: number): Analyzer
```

Irregulars and colloquialisms — `feet → foot`, `кіло → кілограм`.

### createAnalyzerChain()

```ts
createAnalyzerChain(analyzers: Analyzer[]): (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[]
```

Composes a chain and memoizes it. `defineLocale` does this for you; call it
directly only when building an analyzer pipeline outside a locale.

## defineLocalePack

```ts
function defineLocalePack(pack: LocalePack): LocalePack
```

Contributes vocabulary — and optionally analyzers — to an existing locale, from
a separate publishable package. A translation is never a pull request against
this repo.

```ts
interface LocalePack {
  locale: string;
  contributes: Record<KindId, Lexicon>;
  analyze?: Analyzer[];
}
```

```ts
export default defineLocalePack({
  locale: "uk",
  contributes: {
    "crypto-ticker": { btc: { aliases: ["біткоїн", "біткойн"], symbol: "BTC" } },
  },
  analyze: [tableAnalyzer({ "битok": "біткоїн" })],
});
```

Merge rules, chosen so a pack can never silently break a built-in:

| Field | Rule |
| --- | --- |
| `aliases` | union across packs; collisions become competing candidates resolved by weights |
| `display`, `symbol` | last pack wins, and the override is reported by `explain()` |
| `analyze` | appended to the locale's chain in pack registration order |
| unknown kind | `UnknownKindError` at `createEngine()`, never a silent no-op |

## Available locales

| Locale | Status |
| --- | --- |
| `@smartput/core/locale/en` | Shipped |
| `@smartput/core/locale/uk` | M5 |
