# smartputs i18n — Design Spec

**Date:** 2026-08-05
**Status:** Approved, pending implementation plan

Separate a kind from the words used to say it. Make English one language among
several rather than the one welded into every descriptor. Generalize the
one-dimensional plural model to whatever grammatical categories a language
actually has. Make `locales: Locale[]` mean what it says.

Supersedes decision **D11** and amends **D7** of
`2026-08-04-smartputs-design.md`. Amends two sections of the sibling specs —
see §12.

## 1. Why this exists

Five findings, all measured against `main`.

**English is welded into every kind.** `packages/mass/src/index.ts` declares
`aliases: ["kg", "kilo", "kilogram"]` and
`display: { one: "kilogram", other: "kilograms" }` inside the descriptor. So a
Japanese application registering `mass` ships English words it cannot remove,
and those words sit in the alias index producing candidates for input that was
never English.

**D11 is documented policy, half-implemented.** The kinds guide states that a
kind's vocabulary ships beside it under `./locale/<id>`. Only `datetime` and
`rates` have such a directory, and both contain `en` files that *supplement* an
already-English kind. There is no non-English vocabulary anywhere in the
repository, and no route to add one that does not also carry English.

**`LocalePack` cannot subtract.** `mergeLexeme` unions alias arrays. There is no
replace and no remove, so a Ukrainian engine necessarily indexes `кілограм`
*and* `kilogram`.

**`locales: Locale[]` is not an array.** `createEngine` reads `opts.locales[0]`
and discards the rest. Every downstream call takes one locale id.

**The grammar model has one dimension.** `display` is
`Partial<Record<Intl.LDMLPluralRule, string>>` — number, and nothing else.
That is sufficient for English and insufficient for most of the languages the
locales guide itself lists as motivation:

| Language | Needs | Has |
| --- | --- | --- |
| Ukrainian, Polish, Russian | case × number — `2 кілограми`, `5 кілограмів`, `в 5 кілограмах` | nominative only |
| Japanese, Chinese | classifiers — 三本 vs 三枚 vs 三個 for the same 3 | none |
| Arabic, Hebrew | gender agreement with the counted noun | none |
| Japanese, Korean | politeness register | none |

And output shape is hardcoded — `` `${number} ${display}` `` or
`` `${number}${symbol}` `` in `formatValue`. No word order control, no
language-specific spacing. Spelled-number *generation* (`spellNumber`) sits in
`@smartput/number`, English-only, with no locale hook at all, while
*recognition* (`numerals`) is properly a locale concern. The two directions of
the same capability live on opposite sides of the boundary.

## 2. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| I1 | `defineKind` loses `lexicon` entirely. Vocabulary is a separate artifact per (kind, language). | English stops being privileged. An engine's alias index contains only the languages installed. Removing a language actually removes it. |
| I2 | Three types where there was one: `Language` (mechanics), `Vocabulary` (words for one kind), `Locale` (a language plus its vocabularies, composed). | The two axes are independent — a language's plural rules do not change when a kind is added, and a kind's words do not change when the analyzer chain does. Conflating them is what made D11 unimplementable. |
| I3 | `display` becomes `forms: Record<string, string>`, with the **key set defined by the language**, selected by `Language.selectForm(ctx)`. | The engine must not enumerate the world's grammatical categories. It asks the language for a key and looks it up. `Intl.PluralRules` becomes the default *implementation*, not the model. |
| I4 | Output shape is `Language.renderQuantity()`, not a template in `formatValue`. | Word order, spacing and classifier placement are language facts. |
| I5 | Spelled-number generation moves from `@smartput/number` to the language module, beside recognition. | Two directions of one capability. `spellNumber` is English grammar living in a kind package. |
| I6 | **Recognition is multi-locale. Generation is single-locale.** | This is the ruling that makes multi-locale tractable — see §5. |
| I7 | `locale` becomes a dimension on `Candidate`, exactly like `kind` and `unit`, with a `locale:<id>` weight selector. | Zero new resolution machinery. The solver already ranks candidates; a language is one more thing a candidate has. |
| I8 | Number *grammar* (`1,500` = 1500 or 1.5) follows the **format** locale only, not every installed language. | Emitting both readings for every grouped number multiplies the solver's search space to disambiguate a rendering convention that belongs to the reader, not the writer. Deliberate limit, §5.3. |
| I9 | Cross-language keyword collisions fail at `composeLocale`, not at parse time. | A word meaning `in` in one installed language and `of` in another is a wiring error. Same philosophy as `KindConflictError`: a bad configuration fails on boot. |
| I10 | Missing vocabulary degrades to the unit key at runtime; `assertLocaleContract` fails it in tests. | A half-translated language should render `5 kg` awkwardly, not throw at a user. Gaps are a test failure, not a runtime one. |

### Rejected

| Rejected | Instead | Why |
| --- | --- | --- |
| Keeping `lexicon` as an optional fallback | Removing it (I1) | English stays privileged, alias pollution survives, and vocabulary has two homes — the exact drift the kind/units split was designed to prevent. |
| Kind keeps symbols, vocabulary keeps words | Vocabulary owns `symbol` too | "Symbols are language-neutral" is false: `кг`, `фунт`, CJK conventions. The line would be argued forever. |
| A fixed `forms[case][plural]` matrix | Language-defined keys (I3) | Hardcodes which categories exist and still misses classifiers, register, and whatever the next language needs. |
| `inflect(ctx) => string` per unit | `forms` tables | Vocabulary stops being data — not authorable by translators, not diffable, not shippable as JSON. |
| Narrowing `locales` to a single `locale` | Real multi-locale (§5) | A launcher's users genuinely mix languages in one input box. |
| Multi-locale number grammar | I8 | See I8. |
| Multi-locale segmentation | Format locale drives it (§5.3) | One input string has one script reality. Segmenting it several ways to see which fits is a research project. |
| A bundled FST morphology engine | The `Analyzer` function type | Unchanged from the original spec's rejection. Full morphology is a research project per language; the one-line interface is how a real analyzer gets called. |

## 3. The three types

### `Language` — mechanics, kind-independent

One package per language: `@smartput/locale-en`, `@smartput/locale-uk`.

```ts
interface Language {
  readonly id: string;                  // BCP-47

  // --- reading ---
  readonly numberFormat: "intl" | NumberFormatSpec;
  readonly segment?: (run: string) => string[];
  readonly analyze?: readonly Analyzer[];
  readonly numerals?: NumeralParser;         // "twenty two" -> 22
  readonly keywords: Partial<Record<Keyword, readonly string[]>>;

  // --- writing ---
  /** Which key in a unit's `forms` table applies here. */
  selectForm(ctx: FormCtx): string;
  /** Assemble a rendered quantity. Default: `${number} ${form}`. */
  renderQuantity?(parts: QuantityParts): string;
  /** Assemble a rendered expression, for Printer's spelled mode. */
  renderExpression?(parts: ExpressionParts): string;
  /** 22 -> "twenty two". The inverse of `numerals`. */
  spell?(value: Decimal): string;

  readonly weights?: Weights;
}
```

```ts
interface FormCtx {
  readonly count: Decimal;
  readonly kind: KindId;
  readonly unit: string;
  /** Where in the expression this quantity sits. */
  readonly slot: Slot;
}

/** Core values documented; a language may recognise its own. */
type Slot = "bare" | "after-number" | "conversion-target" | (string & {});

interface QuantityParts {
  readonly number: string;      // already formatted by formatNumber
  readonly form?: string;       // forms[selectForm(ctx)], if the vocabulary had one
  readonly symbol?: string;
  readonly kind: KindId;
  readonly unit: string;
  readonly slot: Slot;
}
```

`selectForm` is the only required addition. English:

```ts
// @smartput/locale-en
const plural = new Intl.PluralRules("en");
selectForm: ({ count }) => plural.select(count.toNumber()),
```

which returns `"one"` or `"other"` — so every existing `display` table becomes a
`forms` table with no edit beyond the field name. Ukrainian:

```ts
// @smartput/locale-uk
const plural = new Intl.PluralRules("uk");   // one | few | many | other
selectForm: ({ count, slot }) => {
  const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
  return `${grammaticalCase}-${plural.select(count.toNumber())}`;
},
```

The engine never learns what `"loc"` means. It asks for a key and indexes a
table.

**`Locale` is replaced by `Language` + composition.** The old `Locale`
interface is exactly `Language` minus the writing half, so the migration is
additive for the fields that survive.

### `Vocabulary` — words for one kind in one language

Ships beside the kind that defines it, which is what D11 always intended:
`@smartput/mass/locale/en`, `@smartput/mass/locale/uk`.

```ts
interface UnitWords {
  readonly aliases: readonly string[];
  readonly symbol?: string;
  /** Keys are whatever this language's `selectForm` returns. */
  readonly forms?: Readonly<Record<string, string>>;
}

interface Vocabulary {
  readonly locale: string;
  readonly kind: KindId;
  readonly units: Readonly<Record<string, UnitWords>>;
}

function defineVocabulary(v: Vocabulary): Vocabulary;   // deep-frozen
```

```ts
// packages/mass/src/locale/en.ts
export default defineVocabulary({
  locale: "en",
  kind: "mass",
  units: {
    kg: { aliases: ["kg", "kilo", "kilogram", "kilograms"], symbol: "kg",
          forms: { one: "kilogram", other: "kilograms" } },
    // ...
  },
});
```

```ts
// packages/mass/src/locale/uk.ts
export default defineVocabulary({
  locale: "uk",
  kind: "mass",
  units: {
    kg: { aliases: ["кг", "кілограм", "кілограма", "кілограмів", "кілограмам"],
          symbol: "кг",
          forms: { "nom-one": "кілограм",  "nom-few": "кілограми",
                   "nom-many": "кілограмів", "loc-many": "кілограмах" } },
    // ...
  },
});
```

`typical` bands stay on the **kind** — a magnitude range is physics, not
language.

### `Locale` — a language plus its vocabularies

```ts
interface Locale {
  readonly language: Language;
  readonly vocabularies: readonly Vocabulary[];
  readonly id: string;                       // language.id, for convenience
}

function composeLocale(
  language: Language,
  vocabularies: readonly Vocabulary[],
): Locale;
```

`composeLocale` validates and throws at compose time, never at keystroke time:

- a `Vocabulary` whose `locale` is not `language.id` → `LocaleMismatchError`
- two vocabularies for the same `kind` → `VocabularyConflictError` naming both
- a form key no `selectForm` output could produce is **not** checked here — it
  cannot be, since `selectForm` is a function. `assertLocaleContract` covers it
  (§9).

The install flow is then explicit, which is the point:

```ts
import { mass, length, angle } from "@smartput/kinds";
import massEn   from "@smartput/mass/locale/en";
import lengthEn from "@smartput/length/locale/en";
import angleEn  from "@smartput/angle/locale/en";
import { english } from "@smartput/locale-en";

const en = composeLocale(english, [massEn, lengthEn, angleEn]);
const engine = createEngine({ locales: [en], kinds: [mass, length, angle] });
```

Swap `english` for `ukrainian` and the `en` vocabularies for `uk` ones, and no
English string exists anywhere in the engine.

### Convenience barrels

`@smartput/kinds/locale/en` re-exports all twelve `en` vocabularies as an array,
so the common case stays one import:

```ts
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english } from "@smartput/locale-en";

const en = composeLocale(english, BUILTIN_EN);
```

Documented as convenience, not as the byte-safe default — same caveat as the
validate spec's barrels.

## 4. What `defineKind` becomes

```diff
  export const mass = defineKind({
    id: "mass",
    value: {
      mode: "ratio",
      canonical: "g",
      units: { mg: "0.001", g: "1", kg: "1000", t: "1e6",
               oz: "28.349523125", lb: "453.59237" },
    },
-   lexicon: {
-     kg: { aliases: ["kg", "kilo", "kilogram"], symbol: "kg",
-           display: { one: "kilogram", other: "kilograms" }, typical: [0.1, 500] },
-     ...
-   },
+   typical: { mg: [1, 2000], g: [1, 1000], kg: [0.1, 500],
+             t: [0.1, 200], oz: [0.5, 100], lb: [0.5, 500] },
  })
```

`typical` moves from per-lexeme to a kind-level map, because it was never
language data and its old home is going away. `ops`, `literals`, `prior`,
`format`, `extendsKind`, `affine`, `dpiUnit` are untouched.

`Lexicon` and `UnitLexeme` are removed. `LocalePack` is removed —
`Vocabulary` replaces it, and `extendsKind` already covers the "add units to
someone else's kind" case that packs were doing double duty for.

The two packs that exist today migrate directly. `packages/datetime/src/locale/en.ts`
contributes spelled zone words for the `datetime` kind and
`packages/rates/src/locale/en.ts` contributes currency words for `money`; both
become `defineVocabulary({ locale: "en", kind, units })` with the same content,
losing only the `contributes` wrapper that existed to let one pack target
several kinds. A pack that genuinely spanned kinds becomes several
vocabularies, which is the shape `composeLocale` takes anyway.

**A kind descriptor becomes language-free, and that is the test:** grep a kind
package for a natural-language word and find none outside `locale/`.

## 5. Multi-locale

### 5.1 The ruling that makes it tractable

**Recognition is multi-locale. Generation is single-locale.** (I6)

An input box may receive any installed language, and `5 кг in pounds` must work.
But a `Result` is rendered in exactly one language — the **format locale** —
because there is no such thing as rendering a number in two languages at once.

```ts
interface EngineOptions {
  locales: Locale[];            // now genuinely plural: every one is recognised
  format?: string;              // locale id for output. Default: locales[0].id
  // ...
}
interface EvalOptions {
  format?: string;              // per-call override
  // ...
}
```

This confines the change to the recognition half of the pipeline. `formatValue`,
`Printer` and `complete` each take one locale, as they do today.

It also matches the framing the locales guide already uses: recognition is
many-to-one, generation is one-to-one.

### 5.2 Locale as a candidate dimension

```diff
  interface AliasEntry {
    kind: KindId;
    unit: string;
+   locale: string;
  }

  interface Candidate {
    readonly kind: KindId;
    readonly unit: string;
+   readonly locale: string;
    readonly weight: number;
    // ... surface, foldedSurface, form, analyzerWeight unchanged
  }
```

One alias index, entries tagged with the language that contributed them. `кг`
yields one entry, `kg` another, and a surface that means something in two
languages yields one per language — which is correct: they are two readings, and
the solver's job is ranking readings.

`Resolver.resolve(surface)` runs **each** installed language's analyzer chain and
tags the forms it produced. Chains are already memoized per surface; the cache
key gains the language id. Cost is O(languages) per distinct word, paid once.

A new weight selector, `locale:<id>`, lets an integrator express preference
without a filter:

```ts
weights: { "locale:en": 10, "locale:uk": 5 }   // both accepted, English preferred
```

`EvalOptions.kinds` already filters by kind; a parallel `EvalOptions.locales`
filters by language, for a UI that knows which keyboard is active.

Nothing else in the solver changes. Locale is a property a candidate has, and
candidates were always ranked.

### 5.3 Deliberate limits

**Number grammar follows the format locale only** (I8). `1,500` is read once,
using `format`'s `numberFormat`. Reading it as both 1500 and 1.5 would make every
grouped number ambiguous in order to resolve a convention belonging to the
person reading the output, not the person who typed it. A `de` user sets
`format: "de"`.

**Segmentation follows the format locale.** One string has one script reality.
`Language.segment` is read from the format locale's language, and a note in the
docs says so. Recognising Thai input inside a `format: "en"` engine is not
supported and would need a script-detection pass nobody has asked for.

**Keyword collisions fail at compose** (I9). The union of every installed
language's `keywords` is built once. A surface mapping to two *different*
`Keyword`s across languages throws `KeywordConflictError` naming both languages
and both keywords. A surface mapping to the *same* keyword in several languages
is fine and common.

**Numerals: longest claim wins.** Each language's `NumeralParser` is offered the
word run; the longest `consumed` wins, ties broken by `locale:` weight, then by
locale id for determinism.

## 6. Formatting

`formatValue`'s tail becomes a call into the language:

```ts
const language = formatLocale.language;
const key   = language.selectForm({ count: authored, kind: value.kind, unit: value.unit, slot });
const words = vocabularyFor(value.kind, formatLocale.id)?.units[value.unit];
const form  = words?.forms?.[key];

return (language.renderQuantity ?? defaultRenderQuantity)({
  number: numberText, form, symbol: words?.symbol, kind: value.kind, unit: value.unit, slot,
});
```

```ts
const defaultRenderQuantity = (p: QuantityParts) =>
  p.form !== undefined ? `${p.number} ${p.form}`
: p.symbol !== undefined ? `${p.number}${p.symbol}`
: `${p.number} ${p.unit}`;                       // I10's graceful degradation
```

The default reproduces today's behaviour exactly, so English output is unchanged
byte for byte. That is a parity test, not a claim.

**Where `slot` comes from.** `formatValue` renders a finished `Value` and has no
expression around it, so it passes `"bare"`. The stages spec's `Printer` walks a
`Program` and knows the real position, so it passes `"conversion-target"` for a
`ConvertNode`'s target and `"after-number"` for an operand. Ukrainian's case
government (§8's fourth row) is therefore only correct through the `Printer` —
`formatValue` on a bare `Value` cannot know it was a conversion target, and
saying so is cheaper than inventing a slot it would have to guess.

`Kind.format` — the per-kind hook money uses — stays, and now receives
`selectForm`/`renderQuantity` on its context alongside `formatNumber`.

### Spelled expressions

The stages spec's `Printer` gains `{ spelled: true }`. It resolves to
`Language.spell` for numbers and `Language.renderExpression` for operators and
the conversion phrase, so `"thirty degrees plus fifteen degrees"` is generated
by the language rather than assembled in the printer. `spellNumber` moves from
`@smartput/number` into `@smartput/locale-en` (I5); `NUMBER_WORDS` moves with it.

`renderExpression`'s default walks the tree with symbolic operators, which is
what `mode: "canonical"` already needs — so the two share one implementation.

## 7. Analyzers and NLP

The `Analyzer` type survives unchanged in spirit; its context grows. This is the
least-determined part of the spec and lands last, informed by two real
languages rather than one.

```diff
  interface AnalyzeCtx {
    readonly locale: string;
+   /** The full segmented word run, and this analyzer's position in it. */
+   readonly words: readonly string[];
+   readonly index: number;
  }
```

Neighbour access is what German compound splitting, CJK boundary decisions and
`"square metres"`-style multi-word units all need, and none of them is
expressible with a word in isolation. It is a widening, so every existing
analyzer keeps working.

New shipped helpers, in the same spirit as `suffixStripper` and `tableAnalyzer`:

| Helper | Covers |
| --- | --- |
| `prefixStripper({ prefixes, minStem, weight })` | Agglutinative prefixing. |
| `compoundSplitter({ vocabulary, minPart, weight })` | German `Zentimeter`, Dutch, Scandinavian. |
| `phraseAnalyzer(table, weight)` | Multi-word units, using the new neighbour context — `"square metres"` → `m2`. |
| `scriptSegmenter({ script })` | CJK/Thai runs via `Intl.Segmenter` with `granularity: "word"`. |

**Shortcuts and abbreviations get no new mechanism.** Explicit abbreviations are
aliases, which vocabularies already carry. Everything else is the fuzzy
`resolve` seam from the validate spec and the `repair` seam from the stages
spec. Adding a third recovery mechanism here would be the fourth way to spell
the same idea.

## 8. Ukrainian, as proof

`@smartput/locale-uk` plus `uk` vocabularies for all twelve kinds is a phase of
this plan, not a follow-up. It is the only way to know whether `forms` +
`selectForm` actually holds: Ukrainian exercises four plural categories, case
government after the conversion keyword, and a non-Latin script, and it is a
language the project already committed to in M5.

Concretely it must produce:

| Input | Output |
| --- | --- |
| `1 кілограм` | `1 кілограм` |
| `2 кг` | `2 кілограми` |
| `5 кг` | `5 кілограмів` |
| `2 кг в грамах` | `2 000 грамів` |
| `двадцять два кг` | `22 кілограми` |

The fourth row is the one the current model cannot express at all.

## 9. Testing

**Parity first.** Every English output must be byte-identical before and after.
This shares the stages spec's P0 corpus snapshot; whichever plan lands first
builds it.

**`assertLocaleContract(locale, kinds)`** in `@smartput/core/testing`, promised
by M5 and now given something to check:

- every unit of every registered kind has a `UnitWords` entry
- every entry has at least one alias
- every alias resolves back to its own unit through the analyzer chain — the
  check that catches a suffix stripper that eats its own vocabulary
- for a supplied sample of counts and slots, `selectForm` returns a key the
  vocabulary actually has

That last one is how a missing `loc-many` is found by a test rather than by a
user reading `в 5 кілограм`.

**Alias isolation.** For every pair of installed languages, no surface resolves
to two different `(kind, unit)` pairs *within one language*. Across languages it
may, and must be a ranked ambiguity rather than a conflict.

**English-freedom.** A test greps every kind package for non-ASCII and for a
word list of English unit names outside `src/locale/`, and fails on a hit. This
is what keeps I1 true a year from now.

**Round-trip per language.** `parse(format(v))` equals `v`, run for `en` and
`uk` independently. A `forms` entry the analyzer cannot read back is a bug in
the vocabulary, and this finds it.

**Multi-locale ranking.** With `[en, uk]` installed: `5 kg` and `5 кг` both
resolve; `weights: { "locale:uk": 20 }` flips a genuinely ambiguous surface; a
keyword collision throws at `composeLocale`.

## 10. Package layout

```
@smartput/locale-en          Language: analyzers, numerals, spell, keywords, forms, render
@smartput/locale-uk          same, Ukrainian
@smartput/<kind>/locale/en   Vocabulary
@smartput/<kind>/locale/uk   Vocabulary
@smartput/kinds/locale/en    barrel: all twelve en vocabularies
@smartput/kinds/locale/uk    barrel: all twelve uk vocabularies
```

Dependency table additions for `check-deps.ts`:

| Package | Runtime dependencies |
| --- | --- |
| `locale-*` | `@smartput/core` (types + helpers), `decimal.js` |
| `<kind>/locale/*` | `@smartput/core` — descriptors only, no kind import |

A vocabulary must **not** import its own kind: it names the kind by id string.
That keeps `locale/uk` importable without pulling the ratio tables, and it is
what makes a translation shippable by someone who is not the kind's author.

`@smartput/core` still ships one runtime dependency. Nothing here changes that.

## 11. Phasing

| Phase | Scope | Done when |
| --- | --- | --- |
| **P0 — Parity net** | Shared with the stages spec: snapshot every public result over the corpus. | Snapshots green on `main`. |
| **P1 — Separation** | `Language`, `Vocabulary`, `Locale`, `composeLocale`, `defineVocabulary`. `lexicon` removed from `defineKind`, `typical` relocated. `en` vocabularies for all twelve kinds. `@smartput/locale-en`. Single-locale behaviour preserved. | Parity byte-identical; the English-freedom grep passes. |
| **P2 — Grammar** | `forms` + `selectForm`, `renderQuantity`, `renderExpression`, `spell` moved out of `@smartput/number`. `assertLocaleContract`. | Parity still byte-identical — English's `selectForm` reproduces `Intl.PluralRules` and the default render reproduces the old template. |
| **P3 — Ukrainian** | `@smartput/locale-uk` and `uk` vocabularies for twelve kinds. | §8's table passes; `uk` round-trip passes; contract assertions pass for both languages. |
| **P4 — Multi-locale** | `locale` on `AliasEntry`/`Candidate`, per-language chains, `locale:` weight selector, `EngineOptions.format`, `EvalOptions.locales`, `KeywordConflictError`. | §9's multi-locale tests pass with `[en, uk]`. |
| **P5 — NLP** | Widened `AnalyzeCtx`, the four new helpers, CJK segmentation. | Each helper has a corpus, and a third language (German or Japanese) is registered as a smoke test. |

P3 before P4 deliberately: multi-locale is untestable with one real language,
and Ukrainian is what proves P1 and P2 were right. Discovering `forms` is wrong
while implementing Ukrainian costs one phase; discovering it after multi-locale
costs two.

## 12. Amendments to the sibling specs

**`2026-08-05-smartputs-validate-design.md` §4.** That spec has `index.ts`
deriving its `lexicon.aliases` from `units.ts`. Under I1 there is no `lexicon`,
so the derivation moves: `@smartput/<kind>/locale/en` derives its `aliases` from
`units.ts`'s `alias` map, and adds `symbol` and `forms`. The direction is
unchanged — `units.ts` remains the single source of English aliases, which is
what keeps the micro path and the engine path in agreement (that spec's
cross-path test). The micro path stays `en`-only, as V9 already states.

**`2026-08-05-smartputs-stages-design.md` §4.6.** `Printer` renders through
`Language.renderQuantity` / `renderExpression`, and takes a format locale rather
than a `Locale` in the old sense. Its `spelled` option resolves to
`Language.spell`. `Candidate` gaining `locale` (§5.2) is visible on
`Resolution`, so `mode: "resolved"` can show which language won a surface — a
strictly better answer than showing only the unit.

**Ordering.** Stages P0–P2 and i18n P1 both touch the engine's construction.
Land stages P0 (parity net) first, then i18n P1–P2, then stages P3 onward —
otherwise the stage classes get written against a `Locale` shape that is about
to change.

## 13. Out of scope

Machine translation or generated vocabularies — every alias is hand-authored or
comes from a real analyzer. Script detection and automatic locale identification
from input. Multi-locale number grammar and segmentation (I8, §5.3).
Bidirectional text shaping beyond what the host does. Locale-aware *sorting* of
completions. Gender agreement between a unit and a surrounding sentence the
library did not generate. Any language beyond `en`, `uk`, and P5's smoke-test
third.
