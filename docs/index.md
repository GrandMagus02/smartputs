---
layout: home

hero:
  name: Smartputs
  text: Human input, evaluated.
  tagline: Mixed units, durations, and arithmetic in, a confidence score out.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Examples
      link: /guide/examples/
---

<style>
.sp-home {
  max-width: 1152px;
  margin: 0 auto;
  padding: 16px 24px 96px;
}
.sp-home h2 {
  border-top: none;
  padding-top: 0;
  margin-top: 48px;
}
/* The default anchor sits 24px down, matching the padding-top the divider
   normally reserves. Dropping that padding without moving the anchor left it
   floating under the heading instead of beside it. */
.sp-home h2 .header-anchor {
  top: 0;
}
</style>

<div class="sp-home">

## What it does

<SpFeatureGrid :items="[
  { icon: 'i-hugeicons-calculator', title: 'One expression, many kinds', summary: 'Cross-kind operations are signatures, not domain code. The evaluator never hardcodes a kind.', examples: ['1 kg + 500 g', '30 h - 30 min', '212 F in C', '100 km / 2 h'] },
  { icon: 'i-hugeicons-sliders-horizontal', title: 'Ambiguity is data, not a failure', summary: 'Candidates stay open until the solver runs. Four weight layers rank them; explain() shows every term.', examples: ['10 m -&gt; 10 metres', '10 m -&gt; 10 minutes'] },
  { icon: 'i-hugeicons-cursor-text', title: 'Completion, not just evaluation', summary: 'complete() ranks what a half-typed unit could become and rewrites the whole input. Same weights, plus a magnitude fit.', examples: ['30 ho', '5 kilog', '2 km in mil', '10 kg + 5 gram'] },
  { icon: 'i-hugeicons-money-01', title: 'Money with the rates you supply', summary: 'A rate derived through the base currency is disclosed, never implied.', examples: ['30 usd in gbp'] },
  { icon: 'i-hugeicons-paint-board', title: 'Colour is a kind, a notation is a unit', summary: 'CSS Color 4 in, any notation out. Channels are a kind of their own, so &quot;red of&quot; uses the operator core already has.', examples: ['#3b82f6 in oklch', 'rgb 255 60 128 in hex', 'red of #eeff66', '#eeff66 darken 20%'] },
  { icon: 'i-hugeicons-summation-01', title: 'LaTeX math, with the working', summary: 'Evaluates, solves, and analyses LaTeX exactly, then hands back the steps. Reads the expression in English too.', examples: ['systems', 'matrices', 'calculus'] },
  { icon: 'i-hugeicons-puzzle', title: 'A new kind is five lines', summary: 'defineKind takes an id and a unit table. Aliases, arithmetic, and &quot;in&quot; conversion are generated.', examples: ['defineKind({ id: &quot;css&quot; })'] },
  { icon: 'i-hugeicons-translate', title: 'Built for inflected languages', summary: 'Recognition runs an analyzer chain, not an alias list. Generation uses Intl.PluralRules.', examples: ['kilograms -&gt; kilogram'] },
  { icon: 'i-hugeicons-binary-code', title: 'Decimal all the way down', summary: 'Every value is a decimal.js Decimal in a canonical unit, end to end.', examples: ['23-digit input, intact'] },
  { icon: 'i-hugeicons-checkmark-square-01', title: 'A 1.5 KB door for one field', summary: 'No registry, no Pratt parser. Every kind ships an engine-free parseX, sized to a budget CI enforces.', examples: ['30deg', 'parseLength(&quot;30 cm&quot;)', 'parseAmount(&quot;30 usd&quot;)'] },
  { icon: 'i-hugeicons-package', title: 'One runtime dependency', summary: '@smartput/core depends on decimal.js, nothing else. Heavy kinds live in their own packages.', examples: [] },
]" />

## Try it

The demos below run the real engine, compiled from the same source the test
suite imports. Nothing here is precomputed.

<SpEvaluate
  :examples="['1 kg + 500 g', '30 h - 30 min', '2 km in m', '10 m + 5 h', '212 F in C', '100 km / 2 h', '(1 + 2) * 3']"
  hint="Every result carries a canonical value, a kind, and a confidence — not just a string." />

## Complete as they type

<SpComplete
  model-value="30 ho"
  :examples="['30 ho', '5 kilog', '2 km in mil', '10 kg + 5 gram']"
  hint="complete() rewrites the whole input, so the row you accept is always something evaluate() will take." />

## Money, with the rates you supply

<SpMoney />

## Install

```sh
bun add @smartput/core
```

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

engine.evaluate("1 kg + 500 g").formatted; // "1.5 kilograms"
engine.evaluate("10 m + 5 h").formatted; // "310 minutes"
engine.suggest("10 m"); // both readings, ranked
engine.complete("30 ho"); // "30 hours", ranked against every other unit
```

Currencies live next door, because their unit ratios come from a table you
supply rather than from a constant:

```sh
bun add @smartput/rate
```

```ts
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});

engine.evaluate("30 usd in gbp").formatted; // "£22.94"
```

</div>
