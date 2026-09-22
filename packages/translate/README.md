# @smartput/translate

> Text translation, deliberately outside the kind engine.

A phrase in one language, the same phrase in another, answered by a provider
rather than by a table committed into this repository.

It does not join the kind engine, and that is the design rather than a gap.
Every kind carries a `Decimal` and a unit, and a `Vocabulary` puts its words in
front of `createEngine` to be resolved against every other kind's words in one
pass. A translation carries no quantity — there is nothing for a `Value` to
hold — so registering one would buy nothing but a new way for its literal
grammar to collide with everybody else's. Staying outside sidesteps that whole
class of bug: the literal grammar here is private, and this package is the only
thing that reads it.

The shape is the one `@smartput/rate` and `@smartput/geo` already use for
network-backed data: a small provider interface, one factory per upstream, a
`custom()` escape hatch, and a class that wraps a provider with caching.

## Setup

```sh
npm add @smartput/translate
```

## Example

```ts
import { TranslateProviderError } from "@smartput/translate";
```

The root barrel is the half that calls no `fetch`: the error type and the
shapes a provider is written against. Providers live behind `./providers`, so a
consumer who only wants to validate input before spending an API call links no
network code.

## Status

Scaffolded, not finished. `TranslateProviderError` and the four shared types
(`TranslateResult`, `TranslateProvider`, `LanguageDef`, `TranslateLiteral`) are
in place; the language table, the literal grammar, the `Translator` class and
the providers are not. See
[the design](../../docs/superpowers/specs/2026-08-20-translate-package-design.md).
