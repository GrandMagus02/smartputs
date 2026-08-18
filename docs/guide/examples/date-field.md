---
title: A date field with no calendar in it
description: A due date typed as a sentence — "next friday", "in 3 days", "next monday 9am" — read by the engine and confirmed back before anything is submitted.
---

# A date field with no calendar in it

A date picker is a grid of 35 buttons that exists because a text field could
not be trusted to read `18/08/2026`. It is also, for the person filling in
"due next Friday", four clicks and a month of scrolling to say two words.

This field is the text box, trusted:

<SpDateField />

Nothing here opens a popup. The line under the input is what makes that safe —
it is a **confirmation**, and it is the entire trick of the pattern.

## The engine

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "@smartput/datetime";
import datetimeEn from "@smartput/datetime/locale/en";
import { date } from "@smartput/date";
import { time } from "@smartput/time";
import { dateRange } from "@smartput/date-range";
import { timeRange } from "@smartput/time-range";
import { datetimeRange } from "@smartput/datetime-range";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime, date, time, dateRange, timeRange, datetimeRange],
  now: () => Date.now(),
  timeZone: "Europe/Kyiv",
});
```

Two things in there are load-bearing.

**`now` is injected.** "Tomorrow" is a function of the clock, and a clock the
caller cannot move is a feature that cannot be tested. Every date in your test
suite becomes a fixed instant: `now: () => Date.parse("2026-08-18T10:00:00Z")`.

**`datetime` is a prerequisite for the rest.** `date` and `time` do not parse
anything of their own — they re-read the match chrono already made and narrow
it. Registering `date` without `datetime` is six kinds that never claim
anything, and it fails as silence rather than as an error.

## Reading the answer off `meta`

`canonical` is a scalar, because ordering and subtraction have to work without
the engine knowing what a calendar is. The calendar part rides on `meta`:

```ts
const result = engine.evaluate("next friday");

result.kind;               // "datetime"
result.value.canonical;    // epoch nanoseconds, as a Decimal
result.value.meta.iso;     // "2026-08-28T00:00:00+03:00[Europe/Kyiv]"
```

A span puts both ends there instead:

```ts
engine.evaluate("last week").value.meta;
// { start: "2026-08-10T00:00:00+03:00[…]", end: "2026-08-17T00:00:00+03:00[…]", zone: "…" }
```

So one field reads both shapes without deciding in advance which it is going to
get:

```ts
const meta = result.value.meta as { iso?: string; start?: string; end?: string };
const start = meta.iso ?? meta.start;
const span  = meta.end;
```

That is the whole reason the demo can answer "tomorrow" and "last week" from
the same input. A field that only wants a day takes `start` and says so; a
filter takes both ends.

## Say it back, always

```vue
<p v-if="reading">
  <strong>{{ day(reading.start) }}</strong>
  <span>{{ relative }}</span>
</p>
```

Three rules for that line, learned the hard way by every product that has
shipped this pattern:

1. **Show the resolved date in a different notation than the person typed.**
   They wrote `next friday`; you show `Fri 28 Aug 2026`. Echoing their own
   words back confirms nothing.
2. **Never print a time that was not said.** `tomorrow` lands at midnight
   because midnight is the start of the day, not because anybody chose 00:00.
   The demo suppresses the clock when it is exactly midnight — printing
   `00:00` is claiming a precision the sentence did not have.
3. **Show relative and absolute together.** `in 10 days` catches an off-by-one
   week that `Fri 28 Aug` does not.

## What it will not read, and why that is fine

```ts
engine.evaluate("18/08/2026");   // 0.0011105… — a number
```

Slashes are division, and the parser is not going to guess otherwise for a
string that is three integers and two operators. Three answers to that:

- Most people typing into a natural-language field type words. The ones who
  type digits usually type `18 aug 2026` or `2026-08-26`, both of which read.
- The confirmation line makes the failure visible in the one keystroke it
  happens, which is the difference between wrong and merely unhelpful.
- If numeric dates matter for your audience, that is a locale decision, and a
  small [literal matcher](/api/define-kind) on your own kind is where it goes
  — not a regex in the component, which would disagree with the engine about
  what it already claimed.

## Ambiguity is a menu, not a coin toss

`3pm` is a datetime. `10 m` is either ten metres or ten minutes, and if a date
field is also a general input you will meet that. `evaluate()` throws on a tie;
`suggest()` hands back the ranked readings:

```ts
engine.suggest("10 m");   // both, with scores and confidence
```

Render those as rows and let the person pick. The one thing not to do is take
`[0]` and move on quietly — see [Ambiguity and weights](/guide/weights) for
what the ranking is made of, and how to lean it toward dates in a field that is
mostly dates.

## Checklist

- `now` injected, so "tomorrow" is testable
- `timeZone` set explicitly — the default is not the user's, and a due date
  that shifts by a day at 23:30 is a support ticket
- `datetime` registered before the kinds that narrow it
- both `meta.iso` and `meta.start`/`meta.end` handled
- the resolved date shown back in a different notation, with the relative form
- no clock printed when the sentence did not name one
- keyboard only: nothing in this field needs a pointer at any point

## See also

- [`@smartput/datetime`](/packages/datetime) — the kind, and what chrono claims
- [`@smartput/date-range`](/packages/date-range) — spans, and the words for them
- [Filter bar](/guide/examples/filter-bar) — the same reading, aimed at a query
