---
title: Locales
description: A language is mechanics, a vocabulary is words, a locale is the two composed.
---

# Locales

Three types, not one.

| Type | Holds | Ships in |
| --- | --- | --- |
| `Language` | mechanics: segmentation, morphology, numerals, keywords, number grammar, plural selection | `@smartput/locale-en`, `@smartput/locale-uk` |
| `Vocabulary` | the words for **one kind** in **one language** | beside the kind: `@smartput/mass/locale/en` |
| `Locale` | a language composed with its vocabularies | built by `composeLocale` |

The split is the whole design. A kind carries no natural-language word at all,
so translating `mass` into Ukrainian is publishing
`@smartput/mass/locale/uk` — not a pull request against the kind, and not a
patch that has to be kept in step with it.

```ts
interface Language {
  id: string;                                  // BCP-47
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];         // default: Intl.Segmenter
  analyze?: Analyzer[];                        // ordered chain, surface → lemmas
  numerals?: NumeralParser;                    // "twenty", "двадцять", 二十, ٢٠
  keywords: Partial<Record<Keyword, string[]>>;
  selectForm(ctx: FormCtx): string;            // which `forms` key applies here
  spell?: NumeralSpeller;                      // 22 → "twenty two"
  weights?: Weights;
}

interface Vocabulary {
  locale: string;                              // must equal the language's id
  kind: KindId;                                // named by string, never imported
  units: Record<string, UnitWords>;
}

interface UnitWords {
  aliases: readonly string[];                  // recognition
  symbol?: string;                             // "kg" — the default rendering
  forms?: Record<string, string>;              // generation, keyed by selectForm
}
```

A vocabulary names its kind by **id string** and never imports it. That is what
makes `@smartput/mass/locale/uk` installable without pulling in the ratio
tables, and publishable by someone who is not the kind's author.

## Composing and installing

`composeLocale` is the only thing that may build a `Locale`, because it is where
a bad wiring is caught — on boot, never at a keystroke.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { mass, length, angle } from "@smartput/kinds";
import massEn from "@smartput/mass/locale/en";
import lengthEn from "@smartput/length/locale/en";
import angleEn from "@smartput/angle/locale/en";

const en = composeLocale(english, [massEn, lengthEn, angleEn]);
const engine = createEngine({ locales: [en], kinds: [mass, length, angle] });
```

Swap `english` for `ukrainian` and the `en` vocabularies for `uk` ones, and no
English string exists anywhere in the engine.

`composeLocale` throws when:

| Condition | Error |
| --- | --- |
| a vocabulary's `locale` is not the language's `id` | `LocaleMismatchError` |
| two vocabularies claim the same `kind` | `VocabularyConflictError` |
| a vocabulary names a kind the engine does not register | `UnknownKindError`, at `createEngine()` |
| a vocabulary names a unit the kind does not declare | `UnknownKindError`, naming the unit |

A `forms` key that no `selectForm` output could produce is deliberately **not**
checked here — it cannot be, since `selectForm` is a function rather than a
table. `assertLocaleContract` covers that in tests.

### The convenience barrel

One import for the common case:

```ts
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english } from "@smartput/locale-en";

const en = composeLocale(english, BUILTIN_EN);
```

Convenience, not the byte-safe default: importing it links every built-in
kind's words, which is exactly what a bundle-conscious consumer avoids by
importing one `@smartput/<kind>/locale/en` subpath at a time.

### Installing nothing

Vocabularies are optional. Every unit is indexed under its **own key**
regardless — `kg`, `m`, `Europe/Kyiv` — tagged with the neutral locale `"*"`,
so an engine with no vocabulary installed still reads `5 kg` and still prints
it, as `5 kg`. That floor is what "degrade to the unit key" degrades to.

The floor yields the moment a language speaks for a kind: once a vocabulary
covers `length`, the units it leaves out were left out on purpose. That is how
`@smartput/length` spells `in` only as `inch`/`inches` — `in` is the conversion
keyword — and how `@smartput/country` keeps ISO alpha-2 codes out of the index
so `10 km` is a distance rather than Comoros.

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
**Generation** is one key per form the language distinguishes.

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

Here is the shipped English language in full:

```ts
import { defineLanguage, identity, suffixStripper, tableAnalyzer } from "@smartput/core";

export const english = defineLanguage({
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
  selectForm: ({ count }) =>
    count === undefined ? "other" : new Intl.PluralRules("en").select(count.toNumber()),
});
```

`suffixStripper` producing `inche` from `inches` is harmless — no kind claims
that alias, so the candidate simply finds nothing.

The chain belongs to the language and to nothing else. There is no second
channel that appends analyzers to it; a language that needs more analyzers
declares more analyzers.

<SpExplain
  model-value="1.5 kilograms"
  :examples="['1.5 kilograms', '2 feet in cm', '3 inches', '1 kilo']"
  hint="The candidate table shows the surface form and the lemma it reached, with the analyzer's penalty in the weight column." />

### Shipped helpers

So a language author never starts from zero:

| Helper | Covers |
| --- | --- |
| `identity()` | Retains the exact surface form at weight 0. Always first. |
| `suffixStripper({ suffixes, minStem, weight })` | Most Indo-European inflection. |
| `tableAnalyzer(map, weight)` | Irregulars and colloquialisms. |
| `createAnalyzerChain(language)` | Composes the language's chain with memoization. |

Anything else is an ordinary function — the escape hatch is the type itself, so
a language needing real finite-state morphology can call one in a single line.
Analyzer output is memoized per `(language, surface)`, so keystroke-rate parsing
does not re-run the chain.

## Generation — `forms` and `selectForm`

A unit's written-out words live in its `forms` table, keyed by whatever string
that language's `selectForm` returns. The engine never learns what a key
*means*; it asks for one and indexes a table.

```ts
// @smartput/mass/locale/en
kg: {
  aliases: ["kg", "kilo", "kilogram", "kilograms"],
  symbol: "kg",
  forms: { one: "kilogram", other: "kilograms" },
}
```

English returns CLDR categories, so `one`/`other` is the whole table. Ukrainian
returns a case-and-number key, and the same mechanism carries it:

```ts
// @smartput/locale-uk
selectForm: ({ count, slot }) => {
  const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
  return `${grammaticalCase}-${plural.select(count?.toNumber() ?? 1)}`;
},
```

```ts
// @smartput/mass/locale/uk
kg: { symbol: "кг", forms: { "nom-one": "кілограм", "nom-many": "кілограмів",
                            "loc-many": "кілограмах" } },
```

`count` is **optional**, because a conversion target has no magnitude to agree
with: `1 kg in g` has nothing to count grams by. Every `selectForm` must handle
its absence; English answers `"other"`, the CLDR generic category.

A unit that declares no `forms` falls back to its `symbol`, which is correct for
abbreviations in every language — which is why `212 F in C` formats as `100°C`
while `1 kg + 500 g` formats as `1.5 kilograms`. Every built-in unit whose
written-out form parses back declares `forms`, so `2 km in m` formats as
`2,000 metres`; the ones that do not — `m²`, `m/s`, `°C` — keep their symbol,
because a written form the parser rejects is a dead end for completion.

`typical` bands are **not** here. A magnitude range is physics rather than
language, so it stays on the kind as `Kind.typical`.

## Spelled-out numbers

`numerals` is offered a run of consecutive words and claims a prefix of it, so a
number written across several words — `"one thousand thirty two"` — is one
match rather than four. `cardinalNumerals()` builds one from three tables:

```ts
numerals: cardinalNumerals({
  units: { zero: 0, one: 1, /* … */ nineteen: 19 },
  tens: { twenty: 20, /* … */ ninety: 90 },
  scales: { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 },
  // "and" is a numeral connector here, not an operator. A language cannot have
  // it both ways, and "two hundred and five" is the commoner input.
  connectors: ["and"],
}),
```

Matching is greedy and `consumed` reports how much was claimed, so a trailing
connector is never eaten: `["five","and","kg"]` returns `{ value: 5, consumed: 1 }`.
A run of cardinal words always *adds*, never concatenates digit-by-digit, so
`"twenty twenty five"` reads as 45 and `"nineteen eighty four"` as 103 rather
than erroring.

English cardinals do not inflect, so the analyzer chain does not run on them.

Full reference: [`numerals`](/api/define-locale#numerals).

## Number grammar

`numberFormat: "intl"` reads and writes numbers with `Intl.NumberFormat` for the
language id. `1,500` is 1500 in `en` and 1.5 in `de` — both candidates are
emitted when both locales are registered, and the primary locale scores higher.
Ambiguous number grammar needs no new mechanism.

<SpEvaluate
  model-value="1,500 g"
  :examples="['1,500 g', '1234567890123456789 g', '0.5 km']"
  hint="Group and decimal separators come from the language, not from a global setting." />

## Publishing a translation

A translation is a publishable package, never a pull request against this repo.
It is one `defineVocabulary` call per kind, naming the kind by string:

```ts
// @acme/crypto-ticker-uk
import { defineVocabulary } from "@smartput/core";

export default defineVocabulary({
  locale: "uk",
  kind: "crypto-ticker",
  units: {
    btc: { aliases: ["біткоїн", "біткойн"], symbol: "BTC" },
  },
});
```

```ts
const uk = composeLocale(ukrainian, [ukCrypto]);
const engine = createEngine({ locales: [uk], kinds: [cryptoTicker] });
```

One vocabulary per (kind, language), enforced at compose time. There is no
merge order to reason about and no last-one-wins: two packages claiming the same
kind in the same language is a `VocabularyConflictError` naming both, not a
silent override.

## Adding a language to this site

The documentation itself is set up for i18n from the start. English is the root
locale, so a second language is additive:

1. Copy `docs/.vitepress/locales/en.ts` to `docs/.vitepress/locales/<id>.ts` and
   translate the nav, sidebar and UI strings.
2. Register it in `docs/.vitepress/config.ts` under its own path prefix.
3. Put the translated pages under `docs/<id>/`.

No existing URL moves, because English never lived under `/en/`.

::: info Status
`@smartput/locale-uk` and the analyzer helpers beyond `identity` /
`suffixStripper` / `tableAnalyzer` are still landing. Today the shipped language
is `en`, and the engine still selects a `forms` key with `Intl.PluralRules`
directly rather than through `Language.selectForm` — the field is required of a
language now so the switch moves no bytes when it lands.
:::
