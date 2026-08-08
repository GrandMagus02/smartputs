---
title: Locales
description: A language is mechanics, a vocabulary is words, a locale is the two composed.
---

# Locales

Three types, not one.

| Type | Holds | Ships in |
| --- | --- | --- |
| `Language` | mechanics: segmentation, morphology, numerals, keywords, number grammar, plural selection | `@smartput/core/locale/en`, `@smartput/core/locale/uk` |
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
import { english } from "@smartput/core/locale/en";
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
import { english } from "@smartput/core/locale/en";

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

That asymmetry holds a second time, one level up, between *languages* rather
than between forms of one — see
[Reading many languages, writing one](#reading-many-languages-writing-one).

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
// @smartput/core/locale/uk
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

## Reading many languages, writing one

`locales` is a list, and every language in it is **read**. Exactly one is
**written**, and `format` names it.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";

const en = composeLocale(english, BUILTIN_EN);
const uk = composeLocale(ukrainian, BUILTIN_UK);

const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "en" });

engine.evaluate("5 kg").formatted;             // "5 kilograms"
engine.evaluate("5 кг").formatted;             // "5 kilograms"
engine.evaluate("5 кг in pounds").formatted;   // "11.02311310924387903614869 pounds"
engine.evaluate("5 кг в фунтах").formatted;    // "11.02311310924387903614869 pounds"
engine.evaluate("двадцять два кг").formatted;  // "22 kilograms"
```

Every layer of the input side widened, not just the alias index. `в` is a
Ukrainian conversion keyword and `in` is an English one, and the engine above
takes either; `двадцять два` is read by Ukrainian's `numerals` and `twenty two`
by English's. A reader who types half a sentence in each is not doing anything
the engine has to be told about.

The output side did not widen, and that is the design rather than an unfinished
edge (design decision I6). A `Result` carries one `formatted` string. Making it
many-locale means either returning a table nobody asked for, or picking a
language anyway — silently, from the input, which is the one signal that is
least reliable, since `5 kg` on a bilingual engine is spelled identically in
both. So the choice is made once, explicitly, by configuration.

### `format`

Defaults to `locales[0].id`, so an engine that installs one language never
mentions it. Reordering the list moves the output language and nothing else:

```ts
const ukEngine = createEngine({ locales: [uk, en], kinds: BUILTIN_KINDS });
ukEngine.evaluate("5 kg").formatted;  // "5 кілограмів"
```

It must name an installed locale, and `createEngine` refuses on boot when it
does not — a format locale with no vocabulary behind it has nothing to print
from, and the alternative is discovering that at a keystroke:

```ts
createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "de" });
// Error: format "de" is not among the installed locales (en, uk)
```

Every method that takes `EvalOptions` — `evaluate`, `suggest`, `coerce`,
`explain` — takes a per-call `format` too, for the case where one engine serves
readers in two languages:

```ts
engine.evaluate("2 km in m").formatted;                    // "2,000 metres"
engine.evaluate("2 km in m", { format: "uk" }).formatted;  // "2 000 метрів"
```

Per-call `format` is **output only**. It rebuilds the printer and the evaluator,
not the tokenizer — see [the two deliberate limits](#the-two-deliberate-limits)
below for what that costs and why it is drawn there.

### `locale:` weights

`locale:<id>` is a fourth selector beside `token:`, `${kind}:${unit}` and
`${kind}`, summed with them like everything else — the
[weights guide](/guide/weights#selectors) has the whole model. It matches on the
language that **listed the spelling** a reading was reached through, which is
narrower than "the language you are reading in".

Here are two tiny languages that genuinely collide, each spelling one of its own
units `zz`:

```ts
const alfa = composeLocale(defineLanguage({ id: "aa", /* … */ }), [
  defineVocabulary({ locale: "aa", kind: "widget", units: { w: { aliases: ["zz"], /* … */ } } }),
]);
const bravo = composeLocale(defineLanguage({ id: "ab", /* … */ }), [
  defineVocabulary({ locale: "ab", kind: "gadget", units: { g: { aliases: ["zz"], /* … */ } } }),
]);

createEngine({ locales: [alfa, bravo], kinds }).evaluate("5 zz");
// AmbiguityError: "5 zz" is ambiguous between gadget:g, widget:w

const prefersAlfa = createEngine({ locales: [alfa, bravo], kinds, weights: { "locale:aa": 20 } });
const prefersBravo = createEngine({ locales: [alfa, bravo], kinds, weights: { "locale:ab": 20 } });

prefersAlfa.evaluate("5 zz").kind;   // "widget"
prefersBravo.evaluate("5 zz").kind;  // "gadget"
```

`explain()` shows it as one more row, because that is all it is:

```
gadget  score 20   prior 0 | locale:ab 20 | analyzer 0 | contextBonus 0
widget  score  0   prior 0 | analyzer 0 | contextBonus 0
```

**English and Ukrainian never reach that contest, and it is worth knowing why
before reaching for the selector.** Of the 780 keys in the built-in `[en, uk]`
alias index, not one is claimed by two languages: English is Latin and Ukrainian
is Cyrillic, and where they overlap on a symbol — both vocabularies list `kg` —
the entry is tagged with the first language that listed it, so there is one
reading rather than two competing. On that pair `locale:` is a bias applied to
everything a language uniquely spells — under
`weights: { "locale:uk": 5 }`, `explain()` gives:

```
"5 кг"  score 5   prior 0 | locale:uk 5 | analyzer 0 | contextBonus 0
"5 kg"  score 0   prior 0 | analyzer 0 | contextBonus 0
```

Use it to favour or disfavour a language's whole vocabulary. It is a tie-break
between two languages over one word only when two languages actually claim that
word, which is a property of the languages you install, not of the mechanism.

### Filtering by language: `EvalOptions.locales`

`locales` narrows recognition exactly the way `kinds` narrows it, in the same
place and with the same semantics — a hard filter applied before scoring, not a
weight:

```ts
engine.evaluate("5 kg", { locales: ["en"] }).formatted;  // "5 kilograms"
engine.evaluate("5 кг", { locales: ["uk"] }).formatted;  // "5 kilograms"
engine.evaluate("5 кг", { locales: ["en"] });            // throws DimensionMismatchError
```

The second line is the one that shows what is being filtered. It still prints
English, because `locales` is about *reading* and `format` is about *writing*;
they are independent, and an engine that formats English while accepting only
Ukrainian input is a sensible thing to configure.

The third line throws `DimensionMismatchError` rather than `NoCandidateError`
for the same reason `{ kinds: [...] }` does: the surface *was* recognised and
then refused. "No reading exists" and "every reading was ruled out" are
different facts and the caller can act on them differently.

### Keyword collisions fail on boot

Unit words are indexed per language and a collision between two of them is just
ambiguity, ranked like any other. Keywords are not: the lexer consults **one**
table, folded from every installed language, because an engine reading two
languages has to take `5 кг in grams` and `5 кг в грамах` alike.

Two languages agreeing on a surface is the ordinary case and collapses to one
entry. Two languages *disagreeing* is a wiring error, and it is raised where the
wiring happens:

```ts
const nordic = defineLanguage({ id: "aa", keywords: { in: ["na"] }, /* … */ });
const southern = defineLanguage({ id: "ab", keywords: { minus: ["na"] }, /* … */ });

createEngine({ locales: [composeLocale(nordic), composeLocale(southern)], kinds: [] });
// KeywordConflictError: "na" means "in" in "aa" and "minus" in "ab"
```

```ts
// Agreement is not a conflict.
buildKeywords([composeLocale(nordic), composeLocale(agreeing)]).get("na");  // "in"
```

The alternative is worse than it looks. A surface that means `in` to one
installed language and `minus` to another has **no** reading — it is not
ambiguous between two operators, it is a token the parser cannot shape an
expression around — so the failure surfaces as an unparseable input, at a
keystroke, with the two innocent-looking language packs nowhere in the message.
`KeywordConflictError` names the surface, both keywords and both languages, at
`createEngine`, where someone is holding the two packs that disagree.

### The two deliberate limits

Two input-side concerns are **not** many-locale, and both follow `format`:

| Concern | Whose | Consequence |
| --- | --- | --- |
| number grammar — group and decimal separators | the format locale's | `1,5` is one and a half only when the format locale writes it that way |
| segmentation — where a word run breaks | the format locale's | a language's `segment` hook runs only when that language is the format locale |

Said plainly, with the two built-ins:

```ts
const enFmt = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "en" });
const ukFmt = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "uk" });

enFmt.evaluate("1,5 кг").formatted;  // "15 kilograms"   — "," grouped, per en
ukFmt.evaluate("1,5 кг").formatted;  // "1,5 кілограма"  — "," decimal, per uk

enFmt.evaluate("1.5 кг").formatted;  // "1.5 kilograms"
ukFmt.evaluate("1.5 кг").formatted;  // throws UnitParseError
```

The Ukrainian unit word is read on both engines. The Ukrainian *number* is read
on neither unless Ukrainian is the format locale — `1,5 кг` on the English-
formatting engine is fifteen kilograms, silently and correctly by English rules.
Per-call `format` does not move this either, because it rebuilds the printer and
not the tokenizer:

```ts
enFmt.evaluate("1,5 кг", { format: "uk" }).formatted;  // "15 кілограмів"
```

Fifteen, in Ukrainian. Move the whole engine when the input grammar has to move.

Segmentation draws the same line. A language whose `segment` hook knows where
its own unspaced words break has that hook consulted only while it holds
`format`, even though its vocabulary is read either way:

```ts
// `unspaced` writes without spaces and splits its own runs; `spaced` does not.
const formatUnspaced = createEngine({ locales: [spaced, unspaced], kinds, format: "xh" });
const formatSpaced = createEngine({ locales: [spaced, unspaced], kinds, format: "en" });

formatUnspaced.evaluate("5 kilongagrama").formatted;  // "5 000 grama"
formatSpaced.evaluate("5 kilongagrama").formatted;    // throws NoCandidateError
formatSpaced.evaluate("5 kilo nga grama").formatted;  // "5,000 grams"
```

The third line is what makes this a segmentation limit rather than a vocabulary
one: put the spaces in by hand and the English-formatting engine reads every
`xh` word it had just refused, conversion keyword included. It knows the words.
It was never offered them, because nothing cut the run.

Neither limit is an oversight. Both are the same trade: reading a surface is a
lookup that several languages can each attempt independently, while *cutting a
string into surfaces* and *deciding what `1,5` denotes* are single decisions
with no ranking to fall back on. Running them once, under the language the
engine speaks, is what keeps `Result` a value rather than a matrix. If the input
grammar has to move, `EngineOptions.format` is the thing that moves it.

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
Two languages ship, `@smartput/core/locale/en` and `@smartput/core/locale/uk`,
and every built-in kind has a vocabulary in both. `Language.selectForm` is what
picks a `forms` key — Ukrainian's two-axis `` `${case}-${category}` `` is the
reason the return type is an opaque string rather than a CLDR category, and
`Intl.PluralRules` is now one language's implementation detail rather than the
engine's.

The analyzer helpers shipped are `identity`, `suffixStripper` and
`tableAnalyzer`, with `cardinalNumerals` and `cardinalSpeller` for numbers.
Anything beyond them is an ordinary function of the `Analyzer` type.
:::
