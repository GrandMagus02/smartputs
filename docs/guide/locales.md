---
title: Locales
description: A language is mechanics, a vocabulary is words, a locale is the two composed.
---

# Locales

Nothing in this engine knows an English word. `length` does not know "metre",
`mass` does not know "kilogram", and the parser does not know "in". Every one of
those strings arrives from outside, through three types that are deliberately
not one type.

| Type | Holds | Ships in |
| --- | --- | --- |
| `Language` | mechanics: segmentation, morphology, numerals, keywords, number grammar, form selection | `@smartput/core/locale/en`, `@smartput/core/locale/uk` |
| `Vocabulary` | the words for **one kind** in **one language** | beside the kind: `@smartput/mass/locale/en` |
| `Locale` | a language composed with its vocabularies | built by `composeLocale`, never by hand |

The split is the whole design, and it is what makes a translation a package
rather than a pull request. Translating `mass` into Ukrainian means publishing
`@smartput/mass/locale/uk` — not patching the kind, and not keeping a patch in
step with it forever.

## The three types

```ts
interface Language {
  id: string;                                  // BCP-47
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];         // default: Intl.Segmenter
  analyze?: Analyzer[];                        // ordered chain, surface → lemmas
  numerals?: NumeralParser;                    // "twenty", "двадцять", 二十, ٢٠
  keywords: Partial<Record<Keyword, string[]>>;
  selectForm(ctx: FormCtx): string;            // which `forms` key applies here
  renderQuantity?(parts: QuantityParts): string;
  renderExpression?(parts: ExpressionParts): string;
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

interface Locale {
  id: string;
  language: Language;
  vocabularies: readonly Vocabulary[];
}
```

Read `Language` and notice what is missing: there is no field anywhere in it
that holds a word for a unit. `id`, `numberFormat`, `segment`, `analyze`,
`numerals`, `keywords`, `selectForm` — every one of them is about how the
language works, and none is about what anything is called. A `Language` is
finished before anyone decides which kinds the engine will register.

A `Vocabulary` is the other half, and it names its kind by **id string**. It
never imports the kind. That one decision is what lets
`@smartput/mass/locale/uk` be installed without pulling in the ratio tables,
and published by someone who is not the kind's author and cannot change it.

## Composing and installing

`composeLocale` is the only thing that may build a `Locale`, because it is where
a bad wiring is caught — on boot, never at a keystroke.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { angle, length, mass } from "@smartput/kinds";
import angleEn from "@smartput/angle/locale/en";
import lengthEn from "@smartput/length/locale/en";
import massEn from "@smartput/mass/locale/en";

const en = composeLocale(english, [massEn, lengthEn, angleEn]);
const engine = createEngine({ locales: [en], kinds: [mass, length, angle] });

engine.evaluate("1.5 kg").formatted;         // "1.5 kilograms"
engine.evaluate("2 feet in cm").formatted;   // "60.96 centimetres"
engine.evaluate("90 degrees in rad").formatted;
// "1.5707963267948966192313217 radians"
```

Swap `english` for `ukrainian` and the `en` vocabularies for `uk` ones, and no
English string exists anywhere in the engine.

Four wirings are rejected, two at `composeLocale` and two at `createEngine` —
the second pair only because a vocabulary's claims cannot be checked until the
kinds it claims are on the table:

```ts
composeLocale(english, [ukMass]);
// LocaleMismatchError: Locale "en" was given a "uk" vocabulary for kind "mass"

composeLocale(english, [massEn, massEn]);
// VocabularyConflictError: Locale "en" has two vocabularies for kind "mass"

createEngine({ locales: [composeLocale(english, [massEn, lengthEn])], kinds: [mass] });
// UnknownKindError: Locale pack "en" contributes to unregistered kind "length"

createEngine({ locales: [enWithAStoneUnit], kinds: [mass] });
// UnknownKindError: Locale pack "en" contributes to unregistered kind "mass", unit "stone"
```

A `forms` key that no `selectForm` output could produce is deliberately **not**
checked here — it cannot be, since `selectForm` is a function rather than a
table, and the only way to know which keys it can return is to call it.
[`assertLocaleContract`](#what-assertlocalecontract-demands) does exactly that,
in a test.

### The convenience barrel

One import for the common case:

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
```

Convenience, not the byte-safe default: importing it links every built-in
kind's words, which is exactly what a bundle-conscious consumer avoids by
importing one `@smartput/<kind>/locale/en` subpath at a time.

### Installing nothing

Vocabularies are optional, and an engine with none still works. Every unit is
indexed under its **own key** regardless — `kg`, `m`, `Europe/Kyiv` — tagged
with the neutral locale `"*"`:

```ts
const bare = createEngine({ locales: [composeLocale(english)], kinds: BUILTIN_KINDS });

bare.evaluate("5 kg").formatted;      // "5 kg"
bare.evaluate("2 km in m").formatted; // "2,000 m"
```

That floor is what "degrade to the unit key" degrades to, and it is the reason a
half-translated language is usable rather than broken.

The floor yields the moment a language speaks for a kind: once a vocabulary
covers `length`, the units it leaves out were left out on purpose. That is how
`@smartput/length` spells `in` only as `inch`/`inches` — `in` is the conversion
keyword — and how `@smartput/country` keeps ISO alpha-2 codes out of the index
so `10 km` is a distance rather than Comoros.

## Why a list of strings is not enough

The obvious design is `aliases: string[]` and nothing else. It survives English
and falls over on the next language tried:

| Language | Why string lists fail |
| --- | --- |
| Ukrainian, Polish, Russian | `кілограм / кілограма / кілограмів / кілограмам` — seven cases × two numbers. |
| German, Dutch, Norwegian | Compounds: `Zentimeter`, `Bandmeter` — one token, no closed set to enumerate. |
| Turkish, Finnish, Swahili | Agglutinative — affixes stack, so the surface set is effectively unbounded. |
| Japanese, Chinese, Thai | No whitespace: token boundaries must be found before any lookup. |
| Arabic, Hindi | Non-ASCII digits (`٢٠`, `२०`) and different plural categories. |

So two capabilities are separated, because they are not inverses of each other.
**Recognition** is many-to-one: every inflected, compounded and misspelled form
must reach one lemma. **Generation** is one key per form the language
distinguishes, and no more. A language needs a dozen ways in and four ways out,
and a single list cannot be both.

That asymmetry holds a second time, one level up, between *languages* rather
than between forms of one — see
[Reading many languages, writing one](#reading-many-languages-writing-one).

## Recognition — the analyzer chain

```ts
type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];
type AnalyzeCtx = { locale: string; words: readonly string[]; index: number };
type AnalyzedForm = { form: string; weight?: number; tags?: string[] };
```

An analyzer is handed one word, the run of words it sits in, and where in that
run it sits. It returns **several** candidates, not one. Morphological ambiguity
feeds straight into the solver: each analyzed form becomes a scored candidate,
with `weight` expressing the analyzer's own confidence. A stripped suffix scores
below an exact surface match, so an unmodified word always wins over a guessed
stem. No new concept, no new resolution rules.

Here is the shipped English language in full:

```ts
import { cardinalNumerals, cardinalSpeller, defineLanguage, identity, suffixStripper }
  from "@smartput/core";

// One table, two directions: `cardinalNumerals` reads it to parse "thirty" back
// to 30, `cardinalSpeller` reads it to spell 30 as "thirty".
const CARDINALS = { units: { /* … */ }, tens: { /* … */ }, scales: { /* … */ }, connectors: ["and"] };
const plural = new Intl.PluralRules("en");

export const english = defineLanguage({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    // metres → metre, kilograms → kilogram. Penalised so an exact alias wins.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  spell: cardinalSpeller(CARDINALS),
  keywords: {
    in: ["in", "to", "as"],
    of: ["of"],
    off: ["off"],
    plus: ["plus"],
    minus: ["minus"],
    times: ["times", "multiplied"],
    over: ["over", "divided"],
    by: ["by"],
  },
  selectForm: ({ count }) =>
    count === undefined ? "other" : plural.select(count.toNumber()),
});
```

Two analyzers is the whole of English morphology as far as this engine is
concerned. `suffixStripper` producing `inche` from `inches` is harmless — no
kind claims that alias, so the candidate simply finds nothing — and the
irregulars that a stripper cannot reach (`feet`, `mice`) are listed as aliases
by the vocabularies that own them, which is where a fact about *one unit*
belongs.

The chain belongs to the language and to nothing else. There is no second
channel that appends analyzers to it; a language that needs more analyzers
declares more analyzers.

<SpExplain
  model-value="1.5 kilograms"
  :examples="['1.5 kilograms', '2 feet in cm', '3 inches', '1 kilo']"
  hint="The candidate table shows the surface form and the lemma it reached, with the analyzer's penalty in the weight column." />

### `identity()` is not decorative

The resolver looks a surface up **only through the forms some analyzer
produced**. There is no unconditional lookup of the raw word underneath. So a
language whose `analyze` list omits `identity()` cannot reach its own aliases,
and the failure is not an error — it is a different unit:

```ts
// A German language with a compound splitter and no identity().
alone.evaluate("10 Zentimeter").value.unit;   // "m"  ← wrong: the split's `meter`

// The same broken chain, with English installed beside it.
withEnglish.evaluate("10 Zentimeter").value.unit;  // "cm" ← right, by accident

// With its own identity().
fixed.evaluate("10 Zentimeter").value.unit;   // "cm"
```

The middle line is why this is worth a heading. Every installed language's chain
runs over one shared alias index, and a reading belongs to whoever *listed* the
alias rather than to whoever produced the form — so English's `identity()`
silently covers the gap. A two-language engine can never show the bug. Declare
`identity()` first in every language.

### The shipped helpers

So a language author never starts from zero. All of these come from
`@smartput/core`:

| Helper | Default weight | Covers |
| --- | --- | --- |
| `identity()` | 0 | The exact surface. Always present. |
| `suffixStripper({ suffixes, minStem, weight })` | −2 | Inflection at the end of the word. |
| `prefixStripper({ prefixes, minStem, weight })` | −2 | Inflection at the front of it. |
| `compoundSplitter({ vocabulary, minPart, weight })` | −3 | Germanic compounds. |
| `tableAnalyzer(map, weight)` | −1 | Irregulars and colloquialisms, one word each. |
| `phraseAnalyzer(table, weight)` | **+1** | Multi-word units, via the neighbour run. |
| `scriptSegmenter({ script })` | — | A `Language.segment`, not an `Analyzer`. |
| `createAnalyzerChain(language)` | — | Composes the language's chain, with memoization. |

Anything else is an ordinary function — the escape hatch is the type itself, so
a language needing real finite-state morphology can call one in a single line.
Analyzer output is memoized per `(language, surface, position)`, so
keystroke-rate parsing does not re-run the chain.

The signs matter more than the magnitudes, and `phraseAnalyzer` is the one that
points the other way. The strippers and `tableAnalyzer` hand back a *less* exact
reading of the one word they were given, so they pay. A phrase read two words
where `identity` read one, so it must outrank the bare word's own reading or the
table never does anything.

#### `suffixStripper` and `prefixStripper`

Mirror images, down to the `minStem` floor and the penalty. Every matching
marker is offered, not only the longest — the analyzer proposes and the solver
disposes.

```ts
createAnalyzerChain(english)("kilograms");
// [{ form: "kilograms", weight: 0 }, { form: "kilogram", weight: -2 }]

// analyze: [identity(), prefixStripper({ prefixes: ["ki", "vi"], minStem: 3 })]
chain("kimita");  // [{ form: "kimita", weight: 0 }, { form: "mita", weight: -2 }]
chain("mkiwa");   // [{ form: "mkiwa", weight: 0 }]   ← a prefix is at position 0 or nowhere
```

The two do **not** compose. `createAnalyzerChain` runs every analyzer over the
*original* surface and pools the results, so no analyzer ever sees another's
output: a language declaring both gets `kimita → mita` and `mitani → mita`, and
`kimitani` reaches neither end's stem. That is deliberate. Both are lossy
guesses over a fixed marker list, and a flat `weight` has no way to say "twice
as speculative", so a composing chain would score a doubly-stripped stem exactly
like a singly-stripped one.

Both match the surface **exactly as typed**. The resolver folds the form an
analyzer returns, on its way into the alias index — not the surface on its way
in. That matters far more for a prefix than a suffix, because a prefix sits
precisely where sentence-initial capitalisation lands. A language that expects
capitalised input lists both casings: `["ki", "Ki"]`.

#### `compoundSplitter`

German, Dutch and the Scandinavian languages write a compound as one word, and
there is no closed set of them to list. What *is* fixed is where the meaning
sits: a Germanic compound is right-headed, so the last element says what the
word is a kind of. `Bandmeter` is a metre; `Meterband` is a band. So the helper
emits the last part, and only the last part.

```ts
// analyze: [identity(), compoundSplitter({ vocabulary: ["meter", "zentimeter", "kilometer"], minPart: 3 })]
chain("Zentimeter"); // [{ form: "Zentimeter", weight: 0 }, { form: "meter", weight: -3 }]
chain("Bandmeter");  // [{ form: "Bandmeter", weight: 0 }, { form: "meter", weight: -3 }]
chain("Zentrum");    // [{ form: "Zentrum", weight: 0 }]   ← ends in no known form
```

The −3 is the contract. Installed beside a German length vocabulary that lists
`zentimeter` as an alias at weight 0, the split loses and the centimetre wins:

```ts
engine.evaluate("10 Zentimeter").formatted;  // "10 centimetres"
engine.evaluate("10 Kilometer").formatted;   // "10 kilometres"
engine.evaluate("10 Bandmeter").formatted;   // "10 metres"   ← only the split reaches this
engine.evaluate("10 Zentrum");               // NoCandidateError: Unknown unit "Zentrum"
```

Give the split a positive weight instead and every prefixed length word in the
language quietly answers in the base unit, with every unit test still green.
Unlike the strippers, this one folds case on both sides itself — it has to
compare a surface against a vocabulary before any form exists to be folded — so
`Zentimeter`, `zentimeter` and `ZENTIMETER` are one word to it.

It deliberately does not check the head. `zenti-` and `kubik-` are bound
morphemes no vocabulary would list, so requiring a known head would refuse the
very compounds the helper exists for. `minPart` stands in for that check, on
both parts at once.

#### `tableAnalyzer` and `phraseAnalyzer`

`tableAnalyzer` is a one-word map, for the irregulars a rule cannot reach.
`phraseAnalyzer` is the same idea widened to the run of neighbours, matching
**backwards** so that the longest phrase *ending* at this word wins — "square"
alone is a shape, and the word the writer's unit sits on is "metres":

```ts
// analyze: [identity(), tableAnalyzer({ feet: "foot" })]
chain("feet");   // [{ form: "feet", weight: 0 }, { form: "foot", weight: -1 }]

// analyze: [identity(), phraseAnalyzer({ "square metres": "m2" })]
chain("metres", { words: ["square", "metres"], index: 1 });
// [{ form: "m2", weight: 1 }, { form: "metres", weight: 0 }]
chain("square", { words: ["square", "metres"], index: 0 });
// [{ form: "square", weight: 0 }]   ← the reading belongs to the last word
```

::: warning `phraseAnalyzer` cannot yet spell out a multi-word unit
The reading above is correct and it arrives, and the parser cannot spend it:
`pratt` reads one word per quantity, so `"10 square metres"` fails on "square" —
nobody's alias, and no phrase ends there — before "metres" is ever resolved. A
multi-word quantity needs the parser to consume several words, and no analyzer
can reach that.

What works today is a phrase whose earlier words another fold absorbs. Runs are
recorded before the folds run, so a table entry for `"twenty two kg"` is matched
on a three-word run even though the numeral fold will collapse the first two.
:::

#### `scriptSegmenter` — a different seam

Japanese, Chinese and Thai put no spaces between words, so token boundaries have
to be found before any lookup can happen. That is `Language.segment`, one stage
earlier than the analyzer chain, and `scriptSegmenter` builds one:

```ts
const segment = scriptSegmenter({ script: ["Han", "Hiragana", "Katakana"] });

segment("キログラムをグラム");  // ["キログラム", "を", "グラム"]
segment("kilograms");         // ["kilograms"]   ← no declared script, returned whole
```

`script` takes Unicode script **property values** — `"Han"`, `"Katakana"`,
`"Thai"` — not ISO 15924 codes; `"Jpan"` throws when the segmenter is built.

The lexer already segments every letter run with `Intl.Segmenter`, so CJK is
broken into words with no hook installed at all. What this adds is **scope**: a
language that declares Thai gets Thai word breaking and nothing else, and a run
with no character of a declared script is returned whole rather than handed to
ICU. It also builds one segmenter instead of one per run, and it loses no
letter — the default filters on `isWordLike`, and a dropped segment is worse
than a missing word, because the lexer re-attaches a run's trailing digits to
the *last* segment returned.

Wired into a language with a Japanese vocabulary, the whole sentence is one
letter run and reaches the seam together or not at all:

```ts
const japanese = defineLanguage({
  id: "ja",
  numberFormat: "intl",
  segment: scriptSegmenter({ script: ["Han", "Hiragana", "Katakana"] }),
  analyze: [identity()],
  keywords: { in: ["を"] },
  selectForm: () => "other",
  renderQuantity: ({ number, form }) => `${number}${form}`,
});

engine.evaluate("5キログラムをグラム").formatted;  // "5,000グラム"
engine.evaluate("5キログラム").formatted;         // "5キログラム"
```

`renderQuantity` is the other half of that: the default puts a space between a
number and a word, and Japanese does not. `QuantityParts.form` is the word —
`unit` is the unit id, and reading it prints `5kg` on a Japanese engine.

## Generation — `forms` and `selectForm`

A unit's written-out words live in its `forms` table, keyed by whatever string
that language's `selectForm` returns. **The engine never learns what a key
means.** It asks the language for one and indexes a table with it. That is the
only reason a language can add a grammatical axis without anything upstream of
`forms` changing shape, and it is why `selectForm` returns an opaque `string`
rather than a CLDR plural category — `Intl.PluralRules` is one language's
implementation, not the model.

English distinguishes two things, so its tables have two entries:

```ts
// @smartput/mass/locale/en
kg: {
  aliases: ["kg", "kilo", "kilogram", "kilograms"],
  symbol: "kg",
  forms: { one: "kilogram", other: "kilograms" },
}
```

Ukrainian distinguishes eight, and nothing above `forms` changes:

```ts
// @smartput/core/locale/uk
selectForm: ({ count, slot }) => {
  const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
  const category = count === undefined ? "other" : plural.select(count.toNumber());
  return `${grammaticalCase}-${category}`;
},
```

Two axes, multiplied: case comes from the slot and number comes from CLDR.
Sampling every slot against every count produces exactly eight keys —
`nom-one`, `nom-few`, `nom-many`, `nom-other`, and the same four under `loc` —
and the vocabulary fills all eight:

```ts
// @smartput/mass/locale/uk
kg: {
  symbol: "кг",
  forms: {
    "nom-one": "кілограм",   "nom-few": "кілограми",
    "nom-many": "кілограмів", "nom-other": "кілограма",
    "loc-one": "кілограмі",  "loc-few": "кілограмах",
    "loc-many": "кілограмах", "loc-other": "кілограмах",
  },
}
```

```ts
ukEngine.evaluate("1 кг").formatted;          // "1 кілограм"
ukEngine.evaluate("2 кг").formatted;          // "2 кілограми"
ukEngine.evaluate("5 кг").formatted;          // "5 кілограмів"
ukEngine.evaluate("1,5 кг").formatted;        // "1,5 кілограма"
ukEngine.evaluate("2 кг в грамах").formatted; // "2 000 грамів"
```

The last line is the row a one-dimensional plural model cannot express. `в`
governs the locative, so the *target* of a conversion is a different word from
the same unit standing on its own — and it is chosen with **no count in hand at
all**, because `1 kg in g` has nothing to count grams by. That is why
`FormCtx.count` is optional and every `selectForm` must handle its absence;
English answers `"other"`, the CLDR generic category.

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
number written across several words is one match rather than four.
`cardinalNumerals()` builds one from three tables:

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
connector is never eaten:

```ts
read(["five", "and", "kg"]);              // { value: 5, consumed: 1 }
read(["two", "hundred", "and", "five"]);  // 205
read(["twenty", "twenty", "five"]);       // 45
```

A run of cardinal words always *adds*, never concatenates digit-by-digit, so
`"twenty twenty five"` reads as 45 and `"nineteen eighty four"` as 103 rather
than erroring. `cardinalSpeller` reads the same four tables in the other
direction, which is what keeps parsing and spelling from drifting apart as the
tables are edited — `en.ts` hands one const to both.

Two things it assumes, both true of English and Ukrainian and neither universal:
numerals are **spaced** (German writes `einundzwanzig` as one token, and
`cardinalNumerals` cannot decompose it), and they **compose with spaces** on the
way out (`cardinalSpeller` writes `zwanzig ein` where German writes
`einundzwanzig`). A language that does neither ships its own `numerals` and
`spell`; both fields are optional for exactly that reason.

English cardinals do not inflect, so the analyzer chain does not run on them.

Full reference: [`numerals`](/api/define-locale#numerals).

## Number grammar

`numberFormat: "intl"` reads and writes numbers with `Intl.NumberFormat` for the
language id. `1,500` is 1500 in `en` and 1.5 in `de`; `2 000` in Ukrainian is
two thousand, grouped with U+00A0. Ambiguous number grammar needs no new
mechanism — but it does follow one language and not all of them, which is
[the first of the two deliberate limits](#the-two-deliberate-limits) below.

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
engine.evaluate("twenty two кг").formatted;    // "22 kilograms"
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
below for what that costs and why the line is drawn there.

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

`explain()` shows it as one more contribution row, because that is all it is:

```
gadget  score 20  prior 0 | locale:ab 20 | analyzer 0 | contextBonus 0
widget  score  0  prior 0 | analyzer 0 | contextBonus 0
```

**English and Ukrainian never reach that contest, and it is worth knowing why
before reaching for the selector.** Of the 780 keys in the built-in `[en, uk]`
alias index, **not one** carries entries from two languages. English is Latin
and Ukrainian is Cyrillic, and where they overlap on a spelling — 215 keys,
`kg`, `mm`, `deg`, `%` — the entry is tagged with the first language that listed
it, so there is one reading rather than two competing. On that pair `locale:` is
a bias applied to everything a language *uniquely* spells:

```
"5 кг"  mass  score 5  prior 0 | locale:uk 5 | analyzer 0 | contextBonus 0
"5 kg"  mass  score 0  prior 0 | analyzer 0 | contextBonus 0
```

Use it to favour or disfavour a language's whole vocabulary. It is a tie-break
between two languages over one word only when two languages actually claim that
word, which is a property of the languages you install, not of the mechanism —
and by the same token `{ "locale:uk": 5 }` cannot move `5 kg`, because Ukrainian
is not who that key is tagged to.

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
const nordic = defineLanguage({ id: "na", keywords: { in: ["na"] }, /* … */ });
const southern = defineLanguage({ id: "nb", keywords: { minus: ["na"] }, /* … */ });

createEngine({ locales: [composeLocale(nordic), composeLocale(southern)], kinds: [] });
// KeywordConflictError: "na" means "in" in "na" and "minus" in "nb"

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
on neither unless Ukrainian is the format locale — `1,5 кг` on the
English-formatting engine is fifteen kilograms, silently and correctly by
English rules. This is the one place many-locale recognition is quietly wrong
rather than throwing, and it is worth knowing before shipping a bilingual input
box. Per-call `format` does not move it either, because it rebuilds the printer
and not the tokenizer:

```ts
enFmt.evaluate("1,5 кг", { format: "uk" }).formatted;  // "15 кілограмів"
```

Fifteen, in Ukrainian. Move the whole engine when the input grammar has to move.

Segmentation draws the same line, and only bites where a language's hook knows
something the lexer's default `Intl.Segmenter` does not. CJK is not that case —
ICU breaks Japanese with no hook installed at all, so a Japanese vocabulary
reads on an English-formatting engine. A language whose words break on a
convention only it knows is:

```ts
// `unspaced` writes without spaces and splits its own runs on its own
// connective; `spaced` is English, which has never heard of it.
const formatUnspaced = createEngine({ locales: [en, xh], kinds, format: "xh" });
const formatSpaced = createEngine({ locales: [en, xh], kinds, format: "en" });

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

## Writing a new language

Everything above is the mechanism. This is the part a reader arrives for.

### The minimum

Four fields are required — `id`, `numberFormat`, `keywords`, `selectForm` — and
one more is required in practice:

```ts
import { composeLocale, createEngine, defineLanguage, defineVocabulary, identity }
  from "@smartput/core";

const plural = new Intl.PluralRules("nl");

export const dutch = defineLanguage({
  id: "nl",
  numberFormat: "intl",
  // Not optional in practice: without it the language cannot reach its own
  // aliases. See `identity()` is not decorative, above.
  analyze: [identity()],
  keywords: { in: ["in", "naar"] },
  selectForm: ({ count }) =>
    count === undefined ? "other" : plural.select(count.toNumber()),
});
```

That is a working language. Give it one vocabulary and it reads and writes:

```ts
const nlMass = defineVocabulary({
  locale: "nl",
  kind: "mass",
  units: {
    kg: { aliases: ["kg", "kilogram"], symbol: "kg",
          forms: { one: "kilogram", other: "kilogram" } },
    g: { aliases: ["g", "gram"], symbol: "g",
         forms: { one: "gram", other: "gram" } },
  },
});

const engine = createEngine({
  locales: [composeLocale(dutch, [nlMass])],
  kinds: [mass],
  format: "nl",
});

engine.evaluate("2 kilogram naar gram").formatted;  // "2.000 gram"
engine.evaluate("1,5 kg").formatted;                // "1,5 kilogram"
```

The separators came from `Intl.NumberFormat("nl")` — `.` for groups and `,` for
the decimal — with nothing declared about either. It has no morphology, no
numerals and no spelling, and it is already correct. Add `analyze`
entries when a reader types forms the vocabulary does not list; add `numerals`
and `spell` when written-out numbers matter; add `segment` when the language
does not space its words; add `renderQuantity` when the space between a number
and its unit is wrong.

The vocabularies are separate packages, one per kind, and each one is a single
`defineVocabulary` call — see [Publishing a translation](#publishing-a-translation).

### What `assertLocaleContract` demands

A half-translated vocabulary does not throw. It renders a wrong word at a user.
So the check lives in a test, and it reports **every** problem at once, because
finding them one re-run at a time is how a translator gives up:

```ts
import { assertLocaleContract } from "@smartput/core/testing";

test("en", () =>
  assertLocaleContract(composeLocale(english, BUILTIN_EN), BUILTIN_KINDS, {
    skip: ["boolean:bool"],
    skipPrintable: ["length:in"],
  }));

test("uk", () =>
  assertLocaleContract(composeLocale(ukrainian, BUILTIN_UK), BUILTIN_KINDS, {
    skip: ["boolean:bool"],
  }));
```

It asserts four things about a `(language, kinds)` pair:

1. every registered unit has words, or is named in `skip`;
2. every alias resolves back to its own unit, and to no *other* unit of the same
   kind;
3. every string the printer can emit — each `forms` entry and the `symbol` —
   reads back through the alias index or the analyzer chain;
4. every key `selectForm` can return exists in the table it will index, sampled
   across every slot and a spread of counts.

Check 4 is the one that catches a table stopping halfway. It names the count and
the slot, so the missing row is obvious:

```
locale zz fails its contract:
  mass:g has no form "nom-many" (count 0, slot bare)
  mass:g has no form "nom-few" (count 2, slot bare)
  mass:g has no form "loc-one" (count 1, slot conversion-target)
  …
```

`skip` is for a unit that legitimately has no words — `boolean:bool` prints
through the kind's own `format` hook, so its unit id never reaches a user.
Taking it is a decision, not a way to quiet the check.

### Trap 1 — a word the printer can emit and no analyzer can read

Aliases and printed strings are **different sets**, and the gap between them is
where a printer that cannot read its own output lives. Four Ukrainian kinds
shipped in exactly that state with the whole suite green: `1 hp` printed
`1 кінська сила` and then threw `Unknown unit "кінська"` on it.

Check 3 above is the fix, and it fails like this:

```ts
// A language with only identity() in its chain, and a vocabulary whose
// plural form is not among its aliases.
g: { aliases: ["g", "gram"], symbol: "g", forms: { one: "gram", other: "grams" } }

// locale zz fails its contract:
//   mass:g prints "grams" (form "other") but cannot read it back
```

English gets away with the same table because its `suffixStripper` recovers
`grams → gram`. That is the point: readability is a property of the vocabulary
*and* the chain together, and neither can be reviewed alone.

A two-word form is never readable in any language, because the lexer builds a
word token out of a run of letters and a space ends it:

```ts
lb: { aliases: ["lb"], symbol: "lb", forms: { one: "pound mass", other: "pounds mass" } }

// locale zz fails its contract:
//   mass:lb prints "pound mass" (form "one") but no single token can read it
//   back — a unit word is one token
```

Ukrainian's horsepower lost its two-word form (`кінська сила`) to this rule and
kept the single-token `кс`. Given the choice between a correct word that cannot
be read and a readable one that is slightly informal, take the readable one —
the alternative is a `Result` the engine cannot re-evaluate.

Do not verify this by printing with the engine and feeding the string back. The
fuzzy-correction pass rescues a word that is one edit away from an alias, so
that round trip passes for a vocabulary that is merely *nearly* right.
`assertLocaleContract` goes through the index and the chain directly for exactly
that reason.

### Trap 2 — a symbol with an operator character in it

`lex` ends a word token at an operator character, so **an alias containing one
can never match**. `m/s` is not an alias of anything. It reads because the lexer
splits it and `length ÷ duration` is a registered signature:

```ts
en.evaluate("1 mps").formatted;  // "1m/s"
en.evaluate("1 m/s").formatted;  // "1m/s"   ← arithmetic, not a lookup
uk.evaluate("5 кВт·год").formatted;  // "18 000 000 джоулів"  ← power × duration
```

`·` (U+00B7), `×` (U+00D7) and `⋅` (U+22C5) are spellings of `*` for this
reason, so a kilowatt-hour resolves. `.` is not an operator but it *is* a token
boundary, which is the same problem with a different cause:

```ts
uk.evaluate("5 кс").formatted;    // "5кс"
uk.evaluate("5 к.с.");            // NoCandidateError: Unknown unit "к". Did you mean: кб, кг, км?
en.evaluate("5 k.p.h");           // UnitParseError: Cannot parse "5 k.p.h" as a quantity
```

Three rules follow, and `assertLocaleContract` can only enforce the first:

- A symbol with no operator character in it must be a listed alias. The contract
  skips symbols that *do* carry one, because whether they read is a question
  about signatures that no words check can see.
- A compound symbol works only when its **operands** resolve to the right kinds.
  Ukrainian's data rates lost their `/с` because `datasize` declares no bit unit
  for the numerator to be, and `tempo:bpm` could not be `уд/хв` because there is
  no "beat" kind at all.
- Add an operator spelling only when a symbol the repo already emits is written
  with it. Inventing them ahead of need is how a punctuation character stops
  being usable in a unit name.

Where a compound symbol *is* the right answer, pin it with an evaluation test in
the kind's own `locale/<id>.test.ts` — evaluate the printed symbol and check the
quantity that comes back. That is the only check that sees the signature.

::: tip Audit by measurement, not by reading
Trap 1 shipped past a green suite, in four kinds at once, and the operator rule
was found while repairing it. Neither was visible in the tables; both came out
of sweeping a real engine — every unit, every alias, print it and read it back.
A new language deserves the same sweep before it is believed.
:::

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
    btc: {
      aliases: ["біткоїн", "біткойн"],
      symbol: "BTC",
      forms: {
        "nom-one": "біткоїн",   "nom-few": "біткоїни",
        "nom-many": "біткоїнів", "nom-other": "біткоїна",
        "loc-one": "біткоїні",  "loc-few": "біткоїнах",
        "loc-many": "біткоїнах", "loc-other": "біткоїнах",
      },
    },
  },
});
```

```ts
const uk = composeLocale(ukrainian, [ukCrypto]);
const engine = createEngine({ locales: [uk], kinds: [cryptoTicker], format: "uk" });

engine.evaluate("2 біткоїни").formatted;         // "2 біткоїни"
engine.evaluate("1 біткоїн в сатоші").formatted; // "100 000 000 сатоші"
```

The `forms` keys are Ukrainian's, and the package that supplies them never
imports Ukrainian — it writes the strings the language's `selectForm` will ask
for. That is the contract between a vocabulary and a language: an id, and a set
of keys.

One vocabulary per (kind, language), enforced at compose time. There is no merge
order to reason about and no last-one-wins:

```ts
composeLocale(ukrainian, [ukCrypto, ukCrypto]);
// VocabularyConflictError: Locale "uk" has two vocabularies for kind "crypto-ticker"
```

## Adding a language to this site

The documentation itself is set up for i18n from the start. English is the root
locale, so a second language is additive:

1. Copy `docs/.vitepress/locales/en.ts` to `docs/.vitepress/locales/<id>.ts` and
   translate the nav, sidebar and UI strings.
2. Register it in `docs/.vitepress/config.ts` under its own path prefix.
3. Put the translated pages under `docs/<id>/`.

No existing URL moves, because English never lived under `/en/`.

::: info Status
Two languages ship — `@smartput/core/locale/en` and `@smartput/core/locale/uk`
— and every built-in kind has a vocabulary in both. A third, German, exists only
as a test fixture: it is built inside `locale/third-language.test.ts` to prove
the seams generalise past the two languages they were cut alongside, and it is
where the `identity()` finding above came from.

The analyzer helpers shipped are `identity`, `suffixStripper`, `prefixStripper`,
`compoundSplitter`, `tableAnalyzer` and `phraseAnalyzer`, with `scriptSegmenter`
for `Language.segment` and `cardinalNumerals`/`cardinalSpeller` for numbers.
Anything beyond them is an ordinary function of the `Analyzer` type.
:::
