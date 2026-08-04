---
layout: home

hero:
  name: Smartputs
  text: Human input, evaluated.
  tagline: >-
    A TypeScript engine that parses and evaluates what people actually type —
    units, durations, and arithmetic mixed together — and tells you how
    confident it is.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Playground
      link: /playground
    - theme: alt
      text: GitHub
      link: https://github.com/GrandMagus/smartputs

features:
  - icon: '<span class="i-lucide-calculator"></span>'
    title: One expression, many kinds
    details: >-
      "1 kg + 500 g", "30 h - 30 min", "2 km in m". Cross-kind operations are
      declared as signatures, so the evaluator never hardcodes a domain.
  - icon: '<span class="i-lucide-sliders-horizontal"></span>'
    title: Ambiguity is data, not a failure
    details: >-
      "10 m" is genuinely ambiguous. Candidates stay open until the solver runs,
      four layers of weights rank them, and explain() shows every term in the sum.
  - icon: '<span class="i-lucide-puzzle"></span>'
    title: A new kind is five lines
    details: >-
      defineKind takes an id and a unit table. Aliases, arithmetic and "in"
      conversion are generated. Built-ins register through the same public API.
  - icon: '<span class="i-lucide-languages"></span>'
    title: Built for inflected languages
    details: >-
      Recognition runs an analyzer chain, not an alias list, so "kilograms"
      reaches "kilogram" without enumerating every form. Generation uses
      Intl.PluralRules.
  - icon: '<span class="i-lucide-binary"></span>'
    title: Decimal all the way down
    details: >-
      Every value is a decimal.js Decimal in a canonical unit. A 23-significant-
      digit input survives the whole pipeline intact.
  - icon: '<span class="i-lucide-package"></span>'
    title: One runtime dependency
    details: >-
      @smartput/core depends on decimal.js and nothing else. CI fails on a
      second. Heavy kinds live in their own packages.
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
</style>

<div class="sp-home">

## Try it

The demo below runs the real engine, compiled from the same source the test
suite imports. Nothing here is precomputed.

<SpEvaluate
  :examples="['1 kg + 500 g', '30 h - 30 min', '2 km in m', '10 m + 5 h', '12 inch in cm', '(1 + 2) * 3']"
  hint="Every result carries a canonical value, a kind, and a confidence — not just a string." />

## Install

```sh
bun add @smartput/core
```

```ts
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

engine.evaluate("1 kg + 500 g").formatted; // "1.5 kilograms"
engine.evaluate("10 m + 5 h").formatted; // "310 minutes"
engine.suggest("10 m"); // both readings, ranked
```

</div>
