---
title: Lab
description: One input against an engine you compose — every kind, every language, switchable.
aside: false
outline: false
---

# Lab

One input, one engine, and the engine's composition in your hands. Switch a kind off
and watch what stops resolving; switch a language off and watch the same input stop
being read. Everything is on to begin with.

This is not [the playground](/playground) — that page walks each entry point in turn
with a fixed engine. This one has a single box and makes the registry the variable.

<SpLab />

## What the sidebar is actually doing

Every toggle rebuilds a real engine from the published entry points:

```ts
createEngine({
  locales: enabled.map((id) => composeLocale(LANGUAGES[id], vocabulariesFor(id))),
  kinds: enabledKinds,
  format: "en",
})
```

Two axes, because kinds and words are two things. `mass` the ratio table and `mass`'s
Ukrainian words are separate imports — `@smartput/mass` and
`@smartput/mass/locale/uk` — and a bundle-conscious consumer takes one without the
other every day. Switching them independently here is the same operation, made
visible.

**Modules** are kinds. `temperature` registers `tempdelta` alongside it, because a
subtraction of two temperatures returns one and an engine with only the first answers
`30 C - 20 C` with an error nobody can act on. `date`, `time` and the range kinds
need `datetime` registered — they parse nothing themselves, they re-read the match
`datetime` already made — so switching one on pulls `datetime` back in and marks it
**needed**.

**Locales** are languages. Recognition is many-locale: a surface gets a reading if
*any* installed language can reach it, which is why `5 кілограмів + 500 грамів`
resolves on an engine that writes English. Generation is single-locale by design — a
`Result` is one string in one language, not a table — so **Writes in** picks the one
that prints.

`measure` is deliberately absent. Its `mm`/`cm` aliases collide with `length`, which
is why `BUILTIN_KINDS` leaves it out too; offering it here would hand a first-time
reader an ambiguity with no way to see where it came from.

## Why the report button exists

The vocabulary tables in this repo grow one row at a time, and the hard part has
never been adding a row — it is knowing which row is missing. Every gap found so far
was found by somebody sitting down and guessing sentences, and a guessed gap is not
evidence.

So the inputs this engine refuses are recorded, with the modules and locales that
were switched on when it happened. A ranked list of real failures is the only thing
that can say whether the next fix is one word in a table or something larger.

If you have something to say about it, the button takes plain words. "This should
have been kilometres" is a more useful row than any error string, because the
expectation is the half the input cannot carry.

No account, no cookie, no identifier that survives a reload. Please do not paste
anything private into a box that says it is being recorded.
