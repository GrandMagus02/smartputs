---
title: Locales
description: Recognition via analyzer chains, generation via Intl.PluralRules.
---

# Locales

A locale carries language *mechanics* — segmentation, morphology, numerals,
keywords, and conventions. It does **not** carry unit vocabulary; that lives
with the kind that defines it, so a package adding a kind adds its translations
in the same release and the two cannot drift.

```ts
interface Locale {
  id: string;                                  // BCP-47
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];         // default: Intl.Segmenter
  analyze?: Analyzer[];                        // ordered chain, surface → lemmas
  numerals?: NumeralParser;                    // "twenty", "двадцять", 二十, ٢٠
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}
```

## Why alias lists are not enough

| Language | Why string lists fail |
| --- | --- |
| Ukrainian, Polish, Russian | `кілограм / кілограма / кілограмів / кілограмам` — seven cases × two numbers. |
| German | Compounds: `Kilogramm`, `Zentimeter`, unit words fused into neighbours. |
| Turkish, Finnish | Agglutinative — suffixes stack, so the surface set is effectively unbounded. |
| Japanese, Chinese, Thai | No whitespace: token boundaries must be found before any lookup. |
| Arabic, Hindi | Non-ASCII digits (`٢٠`, `२०`) and different plural categories. |

So two capabilities are separated, because they are not inverses of each other.
**Recognition** is many-to-one: every inflected form must reach one lemma.
**Generation** is one-to-one per plural category.

## Recognition — the analyzer chain

```ts
type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];
type AnalyzedForm = { form: string; weight?: number; tags?: string[] };
```

Analyzers return **several** candidates, not one. Morphological ambiguity feeds
straight into the solver: each analyzed form becomes a scored candidate, with
`weight` expressing the analyzer's own confidence. A stripped suffix scores
below an exact surface match, so an unmodified word always wins over a guessed
stem. No new concept, no new resolution rules.

Here is the shipped `en` locale in full:

```ts
import { defineLocale, identity, suffixStripper, tableAnalyzer } from "@smartput/core";

export default defineLocale({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    // metres → metre, kilograms → kilogram. Penalised so an exact alias wins.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
    tableAnalyzer({ feet: "foot", inches: "inch" }, -1),
  ],
  keywords: {
    in: ["in", "to", "as"],
    plus: ["plus"],
    minus: ["minus"],
    of: ["of"],
  },
});
```

`suffixStripper` producing `inche` from `inches` is harmless — no kind claims
that alias, so the candidate simply finds nothing.

<SpExplain
  model-value="1.5 kilograms"
  :examples="['1.5 kilograms', '2 feet in cm', '3 inches', '1 kilo']"
  hint="The candidate table shows the surface form and the lemma it reached, with the analyzer's penalty in the weight column." />

### Shipped helpers

So a locale author never starts from zero:

| Helper | Covers |
| --- | --- |
| `identity()` | Retains the exact surface form at weight 0. Always first. |
| `suffixStripper({ suffixes, minStem, weight })` | Most Indo-European inflection. |
| `tableAnalyzer(map, weight)` | Irregulars and colloquialisms. |
| `createAnalyzerChain(analyzers)` | Composes a chain with memoization. |

Anything else is an ordinary function — the escape hatch is the type itself, so
a language needing real finite-state morphology can call one in a single line.
Analyzer output is memoized per `(locale, surface)`, so keystroke-rate parsing
does not re-run the chain.

## Generation — Intl.PluralRules

Plural forms are not hand-rolled. `Intl.PluralRules` is native, covers every
CLDR locale, and already knows Ukrainian has `one/few/many/other`, Arabic six
categories, and Japanese one.

```ts
interface UnitLexeme {
  aliases: string[];                                     // recognition
  symbol?: string;                                       // "kg" — default formatter
  display?: Partial<Record<Intl.LDMLPluralRule, string>>; // generation
}
```

```ts
// mass:kg in @smartput/core
{
  aliases: ["kg", "kilo", "kilogram"],
  symbol: "kg",
  display: { one: "kilogram", other: "kilograms" },
}
```

`format()` calls `new Intl.PluralRules(locale).select(n)` and looks the category
up. A lexeme that omits `display` falls back to `symbol`, which is correct for
abbreviations in every language — which is why `212 F in C` formats as `100°C`
while `1 kg + 500 g` formats as `1.5 kilograms`. Every built-in unit whose
written-out form parses back declares `display`, so `2 km in m` formats as
`2,000 metres`; the ones that do not — `m²`, `m/s`, `°C` — keep their symbol,
because a display form the parser rejects is a dead end for completion.

## Spelled-out numbers

`numerals` is offered a run of consecutive words and claims a prefix of it, so a
number written across several words — `"one thousand thirty two"` — is one
match rather than four. `cardinalNumerals()` builds one from three tables:

```ts
numerals: cardinalNumerals({
  units: { zero: 0, one: 1, /* … */ nineteen: 19 },
  tens: { twenty: 20, /* … */ ninety: 90 },
  scales: { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 },
  // "and" is a numeral connector here, not an operator. A locale cannot have
  // it both ways, and "two hundred and five" is the commoner input.
  connectors: ["and"],
}),
```

Matching is greedy and `consumed` reports how much was claimed, so a trailing
connector is never eaten: `["five","and","kg"]` returns `{ value: 5, consumed: 1 }`.

English cardinals do not inflect, so the analyzer chain does not run on them.

Full reference: [`numerals`](/api/define-locale#numerals).

## Number grammar

`numberFormat: "intl"` reads and writes numbers with `Intl.NumberFormat` for the
locale id. `1,500` is 1500 in `en` and 1.5 in `de` — both candidates are emitted
when both locales are registered, and the primary locale scores higher. Ambiguous
number grammar needs no new mechanism.

<SpEvaluate
  model-value="1,500 g"
  :examples="['1,500 g', '1234567890123456789 g', '0.5 km']"
  hint="Group and decimal separators come from the locale, not from a global setting." />

## Translation packs

A translation is a publishable package, never a pull request against this repo.

```ts
import { defineLocalePack } from "@smartput/core";

export default defineLocalePack({
  locale: "uk",
  contributes: {
    "crypto-ticker": {
      btc: { aliases: ["біткоїн", "біткойн"], symbol: "BTC" },
    },
  },
  analyze: [tableAnalyzer({ "битok": "біткоїн" })], // optional chain extension
});
```

```ts
const engine = createEngine({ locales: [uk, en], kinds: [cryptoTicker], packs: [ukCrypto] });
```

Merge rules, chosen so a pack can never silently break a built-in:

- **`aliases`** — union across packs. Collisions become competing candidates and
  are resolved by weights, not by one pack overwriting another.
- **`display` and `symbol`** — last pack wins, and the override is reported by
  `explain()`.
- **`analyze`** — appended to the locale's chain in pack registration order.
- A pack naming an unregistered kind throws `UnknownKindError` at
  `createEngine()`, never silently no-ops.

## Adding a language to this site

The documentation itself is set up for i18n from the start. English is the root
locale, so a second language is additive:

1. Copy `docs/.vitepress/locales/en.ts` to `docs/.vitepress/locales/<id>.ts` and
   translate the nav, sidebar and UI strings.
2. Register it in `docs/.vitepress/config.ts` under its own path prefix.
3. Put the translated pages under `docs/<id>/`.

No existing URL moves, because English never lived under `/en/`.

::: info Status
`uk` and the analyzer helpers beyond `identity` / `suffixStripper` /
`tableAnalyzer` land in M5. Today the shipped locale is `en`.
:::
