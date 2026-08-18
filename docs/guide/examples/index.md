---
title: Examples
description: Seven inputs built on the engine — a Figma-style dimension field, a date field with no calendar, a launcher, a filter bar, and the rest.
---

# Examples

Seven fields, each one wired end to end and running on this page. They are not
sketches: every demo below calls the same published entry points your app would
call, and the code blocks are the code that runs.

The point of the collection is that they are all the same three moves in
different clothes. Something a person typed goes in; a **kind** decides what it
could mean; what comes back is a value plus enough information to say so out
loud before anything is submitted. What changes between them is which door you
use — the [1.5 KB parser](/packages/shared) for one field of one kind, the
[engine](/packages/core) for an expression that mixes them.

<SpCatalog :items="[
  { title: 'Dimension input', summary: 'px, rem, em and % with arithmetic in the box — 2+4px is 6px.', example: '100% - 24px', link: '/guide/examples/dimension-input', icon: 'i-hugeicons-ruler' },
  { title: 'Date field', summary: 'A due date typed as a sentence, with no calendar popup anywhere.', example: 'next friday', link: '/guide/examples/date-field', icon: 'i-hugeicons-date-time' },
  { title: 'Duration field', summary: 'Estimates and timers: one number, one unit, 1.5 KB.', example: '1h + 30m', link: '/guide/examples/duration-field', icon: 'i-hugeicons-timer-01' },
  { title: 'Money field', summary: 'An amount, a currency, and a rate table you own.', example: '30 usd in gbp', link: '/guide/examples/money-field', icon: 'i-hugeicons-money-01' },
  { title: 'Filter bar', summary: 'One sentence to a WHERE clause, in SQL or Mongo.', example: 'orders over 500 usd', link: '/guide/examples/filter-bar', icon: 'i-hugeicons-search-01' },
  { title: 'Command palette', summary: 'A launcher that answers the calculation before it searches.', example: '2 tb in gb', link: '/guide/examples/command-palette', icon: 'i-hugeicons-computer-terminal-01' },
  { title: 'Pasted column', summary: 'An import that reads what the spreadsheet had, and reports what it did not.', example: '1,5 kg', link: '/guide/examples/pasted-column', icon: 'i-hugeicons-checkmark-square-01' },
]" />

## Which door

Two of the recipes never build an engine, and that is the first decision to
make rather than the last:

| The field is… | Use | Costs |
| --- | --- | --- |
| one number and one unit, one kind (`500 g`) | [`@smartput/<kind>/validate`](/api/validate) | ~1.5 KB |
| the same, and you want a value object | [`/class`](/api/value-classes) | ~2 KB |
| an expression, or more than one kind (`1 kg + 500 g`) | [`createEngine`](/api/create-engine) | the engine and `decimal.js` |
| an expression **plus** a unit nobody ships (`4px`, `2fr`) | `createEngine` + [`defineKind`](/api/define-kind) | the same, plus your table |

A field that only ever holds one kind should not link a Pratt parser to find
that out. A field that holds `100% - 24px` cannot avoid one.

## The rule every one of them follows

**Say what you read, before you act on it.** Each recipe puts the reading back
on screen — `6px`, `Fri 28 Aug 2026`, `total > 500`. That line is not polish;
it is the difference between an input that understands a person and an input
that occasionally books the wrong flight and never mentions it.

The corollary is that ambiguity is shown, not resolved by coin toss. `10 m` is
genuinely two readings, and [`suggest()`](/api/complete) hands back both with
scores. A field that picks one silently has made a decision it cannot defend.
