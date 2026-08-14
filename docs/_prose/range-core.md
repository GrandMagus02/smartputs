`whole week`, `10:00 - 20:00`, `yesterday morning`, `from today until friday`.
Six packages add five kinds so that a launcher can answer with a value that has
**two ends** instead of one.

```sh
bun add @smartput/date @smartput/time @smartput/range-core \
        @smartput/date-range @smartput/time-range @smartput/datetime-range
```

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

const en = composeLocale(english, [...BUILTIN_EN, datetimeEn]);

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, datetime, date, time, dateRange, timeRange, datetimeRange],
  now: () => Date.now(),
  timeZone: "UTC",
});

engine.evaluate("whole week").formatted;        // "2026-01-12 → 2026-01-18"
engine.evaluate("10:00 - 20:00").formatted;     // "10:00 → 20:00"
engine.evaluate("yesterday morning").formatted; // "2026-01-14 06:00 → 2026-01-14 12:00 UTC"
```

`@smartput/datetime` is a prerequisite, not an option: `date` and `time` do not
parse anything, they re-read the match `datetime`'s chrono bridge already made.
Registering them without it gives you two kinds that never claim a thing.

Every example on this page is a corpus row, asserted against the fixed clock
**2026-01-15T12:00:00Z** — a Thursday — in **UTC**, the same fixture
[`@smartput/datetime`](/packages/datetime) uses. The only exceptions are the
[holiday](#holiday-endpoints) rows, which are unit assertions in
`holiday.test.ts` because that subpath ships no corpus of its own; they are
marked where they appear.

## Why `date` and `time` are kinds

`@smartput/datetime` reads `3pm` and `today` into one kind: an instant with a
zone. That is right for arithmetic and wrong for ranges, because a range has to
know which *component* the user actually typed.

- `10:00 - 20:00` is a span of clock time. `tomorrow - today` is a duration.
  Both are `datetime - datetime`, so no op signature can separate them.
- `whole week` snaps to calendar boundaries. `whole hour` would not.
- `yesterday morning` is a date supplying the day and a window supplying the
  hours.

So the recognition is split. `@smartput/date` claims a match chrono is certain
of a **day** for and not an hour; `@smartput/time` claims one it is certain of an
**hour** for and not a day; both decline everything else. `2026-03-01 08:00` is
fully specified, so it stays a plain `datetime` and neither of them touches it.

Neither package loads `chrono-node` a second time. They read `hasDate` and
`hasTime` off the `BridgeMatch` the datetime bridge already returns, and claim
the same span — which is why the [non-destructive fold](/guide/pipeline) carries
all three readings forward together instead of one of them deleting the others.

Both readings are weighted **-5**, so an unprompted `today` is still a datetime:

| Input | Result |
| --- | --- |
| `today` | `2026-01-15 00:00 UTC` — a `datetime` |
| `today`, with `kinds: ["date"]` | `2026-01-15` — a `date` |
| `3pm` | `2026-01-15 15:00 UTC` — a `datetime` |
| `3pm`, with `kinds: ["time"]` | `15:00` — a `time` |

That penalty is the whole reason the range kinds can win: see
[the dash](#the-dash-and-what-it-costs).

## What it recognises

### Calendar spans — `date-range`

| Input | Result |
| --- | --- |
| `whole week` | `2026-01-12 → 2026-01-18` |
| `this week` | `2026-01-12 → 2026-01-18` |
| `next week` | `2026-01-19 → 2026-01-25` |
| `last week` | `2026-01-05 → 2026-01-11` |
| `whole month` | `2026-01-01 → 2026-01-31` |
| `next month` | `2026-02-01 → 2026-02-28` |
| `last month` | `2025-12-01 → 2025-12-31` |
| `whole year` | `2026-01-01 → 2026-12-31` |
| `last year` | `2025-01-01 → 2025-12-31` |
| `year` / `1 year` / `one year` | `2026-01-01 → 2026-12-31` |
| `whole day` | `2026-01-15 → 2026-01-15` |
| `today to friday` | `2026-01-15 → 2026-01-16` |
| `yesterday to tomorrow` | `2026-01-14 → 2026-01-16` |
| `friday to march 1 2026` | `2026-01-16 → 2026-03-01` |

`year`, `1 year` and `one year` all mean the **calendar year containing now**.
`duration` has no year unit, so nothing else claims them; it is the ruling in
this milestone most open to revision, and it is a corpus row so that revising it
is a visible act.

Weeks start on Monday. `createDateRange({ weekStart: 7 })` moves them to Sunday
— it is an ISO weekday number, 1 through 7.

### Clock spans — `time-range`

| Input | Result |
| --- | --- |
| `morning` | `06:00 → 12:00` |
| `afternoon` | `12:00 → 18:00` |
| `evening` | `18:00 → 22:00` |
| `night` | `22:00 → 06:00` |
| `day` | `06:00 → 22:00` |
| `10:00 - 20:00` | `10:00 → 20:00` |
| `10:00 to 20:00` | `10:00 → 20:00` |
| `10:00 as 20:00` | `10:00 → 20:00` |
| `3pm to 6pm` | `15:00 → 18:00` |
| `midnight to noon` | `00:00 → 12:00` |
| `20:00 - 06:00` | `20:00 → 06:00` — wraps |
| `22:30 to 06:30` | `22:30 → 06:30` — wraps |

A clock span is **not anchored to a day or to a zone**, which is the whole reason
this kind exists beside `datetime-range`. Its `meta.zone` is the empty string,
deliberately, and `meta.lengthNs` is computed modulo 24 hours so a wrapping span
has a real length.

`to` and `as` are not new operators. Core's folded keyword table already maps
both onto the `in` keyword — the same route `kyiv to warsaw` takes to reach
`in | place | place` — so the two-endpoint forms needed no change to the lexer.

### Days with hours — `datetime-range`

A day word plus a window word. The day supplies the date, the window supplies the
hours.

| Input | Result |
| --- | --- |
| `yesterday morning` | `2026-01-14 06:00 → 2026-01-14 12:00 UTC` |
| `today morning` | `2026-01-15 06:00 → 2026-01-15 12:00 UTC` |
| `today's morning` | `2026-01-15 06:00 → 2026-01-15 12:00 UTC` |
| `tomorrow afternoon` | `2026-01-16 12:00 → 2026-01-16 18:00 UTC` |
| `next morning` | `2026-01-16 06:00 → 2026-01-16 12:00 UTC` |
| `tonight` | `2026-01-15 22:00 → 2026-01-16 06:00 UTC` |
| `tomorrow night` | `2026-01-16 22:00 → 2026-01-17 06:00 UTC` |
| `tomorrow day` | `2026-01-16 06:00 → 2026-01-16 22:00 UTC` |

`next morning` is tomorrow morning. `tomorrow day` is *daylight* on the 16th —
06:00 to 22:00 — not the calendar day; `next day` is excluded from the grammar
entirely and stays a `datetime`.

And the explicit two-endpoint forms, which claim their whole run:

| Input | Result |
| --- | --- |
| `from today to friday` | `2026-01-15 00:00 → 2026-01-16 00:00 UTC` |
| `from today until friday` | `2026-01-15 00:00 → 2026-01-16 00:00 UTC` |
| `from today till friday` | `2026-01-15 00:00 → 2026-01-16 00:00 UTC` |
| `from today through friday` | `2026-01-15 00:00 → 2026-01-16 00:00 UTC` |
| `from 20:00 to 22:00` | `2026-01-15 20:00 → 2026-01-15 22:00 UTC` |
| `from today to 2026-03-01` | `2026-01-15 00:00 → 2026-03-01 00:00 UTC` |
| `until 20:00` | `2026-01-15 12:00 → 2026-01-15 20:00 UTC` |
| `till 20:00` | `2026-01-15 12:00 → 2026-01-15 20:00 UTC` |
| `until tomorrow` | `2026-01-15 12:00 → 2026-01-16 00:00 UTC` |
| `until 2026-03-01` | `2026-01-15 12:00 → 2026-03-01 00:00 UTC` |

`until Y` starts at **now**, literally — 12:00 on the fixed clock, not midnight.

`from 20:00 to 22:00` is the shape the op path cannot serve at all:
`in | datetime | datetime` belongs to zone conversion and the registry refuses a
second claimant, so two fully specified endpoints can only reach a range through
this matcher. That is the one acknowledged wart in the design, and the
alternative was taking `3pm in tokyo` away.

`from X` with **no end is not claimed**. The matcher declines, `from` falls
through as an ordinary word, and `X` keeps whatever reading it had. An incomplete
range is not an error; it is not a range.

## The value

Ordinary `Value`s, no new field, nothing `JSON.stringify` will choke on.

```ts
const { value } = engine.evaluate("whole week");

value.kind;                 // "date-range"
value.unit;                 // "date-span"
value.canonical.toString(); // "1768176000000000000" — the start, epoch nanoseconds
value.meta.start;           // "2026-01-12T00:00:00+00:00[UTC]"
value.meta.end;             // "2026-01-19T00:00:00+00:00[UTC]"  ← exclusive
value.meta.zone;            // "UTC"
```

`canonical` is the **start**, so ordering and comparison work without the engine
knowing what a range is — the same trick datetime plays with epoch nanoseconds.

The stored end is **exclusive**. `whole week` runs to midnight on the 19th and
displays as `→ 2026-01-18`, because `date-range`'s formatter subtracts a day and
nobody means "up to but not including Monday" when they say "this week".
`time-range` and `datetime-range` format their ends verbatim: a clock time or an
instant reads naturally as a boundary and nobody expects `19:59:59.999`.

A clock span carries two more keys, and no zone:

```ts
const clock = engine.evaluate("20:00 - 06:00").value;

clock.canonical.toString(); // "72000000000000" — ns since local midnight
clock.meta.start;           // "20:00"
clock.meta.end;             // "06:00"
clock.meta.zone;            // ""      — not anchored to one
clock.meta.wraps;           // true
clock.meta.lengthNs;        // "36000000000000" — 10 hours, computed modulo a day
```

## The dash, and what it costs

`10:00 - 20:00` is the input the whole milestone turns on, because
`- | datetime | datetime` already claims it and answers **10 hours**.

The tempting fix — a literal matcher that claims the entire run — was rejected.
`foldLiterals` keeps a fallback only for a *single-token* claim, so a matcher
spanning three tokens would delete the subtraction reading before the solver ever
ran. Instead the dash form is an **op signature** over two kinds the fold carried
side by side:

```
lex "10:00 - 20:00"
  literal @0  readings: [datetime 10:00, time 10:00]
  op      -
  literal @8  readings: [datetime 20:00, time 20:00]

solver:
  - | datetime | datetime -> duration     @smartput/datetime
  - | time     | time     -> time-range   @smartput/time-range
```

Two live candidates. Nothing is deleted, `explain()` lists both, and
`AmbiguityError` still fires where it should.

### Why the existing weights could not rank them

`solve()` scores a candidate as **the sum of its operand readings' weights plus
`contextBonus`**. Every selector `weights.ts` offers — `token:<surface>`,
`<kind>:<unit>`, `<kind>` — is a property of a *reading*. The result kind is
never consulted. So one dial gets pulled in two directions at once:

| Input | Must win | Needs |
| --- | --- | --- |
| `3pm` | `datetime` | `weight(time) < weight(datetime)` |
| `10:00 - 20:00` | `time-range` | `weight(time) > weight(datetime)` |

`contextBonus` cannot break the tie either: it pays +30 whenever a binary node's
operands agree on kind, both readings agree, so it lands on both paths and
cancels.

The missing term is a weight on the **signature**. With the `time` reading at -5
and the signature at +20:

| Input | `datetime` path | `time` path | Winner |
| --- | --- | --- | --- |
| `3pm` | `0` | `-5` | `datetime` |
| `10:00 - 20:00` | `0 + 0 + 30` = **30** | `-5 - 5 + 30 + 20` = **40** | `time-range` |
| `today - friday` | `0 + 0 + 30` = **30** | `-5 - 5 + 30 + 0` = **20** | `duration` |

Those are the numbers `explain("10:00 - 20:00")` actually prints, under a
`signature` selector beside `contextBonus`:

```ts
engine.explain("10:00 - 20:00").assignments[0];
// { kind: "time-range", score: 40, contributions: [
//     { selector: "prior",        value:  0 },
//     { selector: "analyzer",     value: -5 },
//     { selector: "prior",        value:  0 },
//     { selector: "analyzer",     value: -5 },
//     { selector: "contextBonus", value: 30 },
//     { selector: "signature",    value: 20 } ] }
```

The signature weight has to exceed **twice** the reading penalty, or the two
subtractions cancel and the contest ties. +20 against -5 clears that with room,
and stays under `CONTEXT_BONUS` (30) and `TYPO_PENALTY` (15) so a range can never
overturn a corrected reading or a binary whose operands already agree.

`tomorrow - today` is untouched: chrono reports no certain hour for either word,
so `@smartput/time` declines both and only the datetime signature matches. Same
for `3pm - 1 h`, where the right operand is a `duration` and no range signature
applies.

### What it cost core

One optional field.

```ts
export interface OpSignature {
  /** Summed into the candidate's score when this signature is applied. */
  readonly weight?: number;
}
```

Summed by a `signatureWeight` walk that sits beside `contextBonus` in
`solve/solver.ts` and resolves signatures exactly as that walk already does.
`Assignment` gains a matching field so `explain()` can say where a score came
from. The default is `0`, so no existing signature scores differently and no
corpus row moved.

### Configuring it

Both dials are factory options rather than engine weights, because both belong
to the kind that declares them:

```ts
import { createTime } from "@smartput/time";
import { createTimeRange } from "@smartput/time-range";
import { createDateRange } from "@smartput/date-range";
import { createDatetimeRange } from "@smartput/datetime-range";

createTime({ weight: -5 });               // the reading penalty
createTimeRange({ dashWeight: 20 });      // 0 makes subtraction win again
createDateRange({ signatureWeight: 20, phraseWeight: 5 });
createDatetimeRange({ weight: 20 });      // 0 gives "yesterday morning" back to datetime
```

`dashWeight: 0` restores subtraction as the reading of `10:00 - 20:00` without
removing the `to` form, which is the configuration someone doing clock arithmetic
wants. The default prefers the range, because a person typing `10:00 - 20:00`
into a launcher means a span essentially always.

Two smaller weights exist for contests the design did not predict, and they are
written down rather than buried:

- **`date-range`'s `phraseWeight`, +5.** Four phrases — `next month`,
  `this year`, `next year`, `last year` — are also chrono dates of exactly the
  same length, so the two readings tie at 0, and a tie is an `AmbiguityError`.
  The tiebreak goes to the phrase because chrono's own certainty says it should:
  those matches carry `hasDate: false`, meaning chrono resolved a day the user
  never named. "next month" names a month.
- **`time-range`'s window weight, +10.** chrono parses `morning`, `afternoon`,
  `evening` and `night` with no certain hour, so `@smartput/datetime` answers
  `morning` with *today at midnight*. Two readings at 0 is an `AmbiguityError` on
  a word with one obvious meaning.

Both stay under `TYPO_PENALTY` for the reason the signature weight does.

## Arithmetic

`+` and `-` with a `duration` shift **both ends** by the same amount, so the span
is preserved:

| Input | Result |
| --- | --- |
| `whole week + 1 wk` | `2026-01-19 → 2026-01-25` |
| `whole week - 1 wk` | `2026-01-05 → 2026-01-11` |
| `next month + 3 d` | `2026-02-04 → 2026-03-03` |
| `this year - 1 d` | `2025-12-31 → 2026-12-30` |
| `whole day + 2 wk` | `2026-01-29 → 2026-01-29` |

Whole days and weeks go through the **calendar** rather than a millisecond count,
reusing `addDuration` from `@smartput/datetime` — the same rule
[`today + 1 d`](/packages/datetime#arithmetic) follows across a DST boundary.

Shifting is declared on `date-range` only. `time-range` and `datetime-range`
carry no `+`/`-` signatures; if you want them, they are a copy of the three
`date-range` declares.

`- | date | date` is deliberately **not** a range. `today - friday` stays a
duration, because that is what subtraction between two days reads as to
everybody.

## Errors

`@smartput/range-core` exports one error, `InvertedRangeError`, thrown when the
end is not strictly after the start. It names both formatted endpoints, because
"tomorrow is after now" is the fact the user needs.

| Input | Outcome |
| --- | --- |
| `from tomorrow to today` | `InvertedRangeError` |
| `until yesterday` | `InvertedRangeError` — the implicit start is now |
| `until 20:00` when now is 21:00 | `InvertedRangeError` |
| `from today to today` | `InvertedRangeError` — an empty span is a mistake too |
| `20:00 - 06:00` | a `time-range` that wraps — **not** an error |
| `night` | a `time-range` that wraps |

```ts
try {
  engine.evaluate("until yesterday");
} catch (e) {
  e.name;  // "InvertedRangeError"
  e.start; // "2026-01-15T12:00:00+00:00[UTC]"
  e.end;   // "2026-01-14T00:00:00+00:00[UTC]"
}
```

Endpoints resolve **literally**. There is no rolling forward to the next
occurrence: a rule that rescued `until 20:00` at 21:00 by moving to tomorrow
would have to rescue `until yesterday` too, and then no input is ever wrong.

`time-range` is exempt from the check entirely, and that is not an oversight. A
clock has no ordering across midnight, so there is no fact of the matter about
which end comes first; picking one would make an overnight span an error on input
every rota in the world writes that way.

The comparison is `Temporal.ZonedDateTime.compare`, which orders by **instant**.
Comparing wall clocks would call 23:00 in Tokyo later than 20:00 UTC when it is
in fact six hours earlier.

## Holiday endpoints

`from today to closest holiday` needs no new data and no new package — only a
route by which a range endpoint can be resolved by the holiday grammar
[`@smartput/datetime/holiday`](/packages/datetime#holidays) already owns.

That route is a subpath, for the reason that subpath exists:

```sh
bun add @smartput/datetime-range @smartput/holiday
```

```ts
import { datetimeRangeHoliday } from "@smartput/datetime-range/holiday";

const engine = createEngine({
  locales: [en], // composeLocale(english, [...BUILTIN_EN, datetimeEn]), as above
  kinds: [...BUILTIN_KINDS, datetime, date, time, datetimeRangeHoliday],
  now: () => Date.now(),
  timeZone: "UTC",
});
```

Asserted in `holiday.test.ts` rather than in a corpus — this subpath ships none:

| Input | Result |
| --- | --- |
| `from today to closest holiday` | `2026-01-15 00:00 → 2026-01-19 00:00 UTC` |
| `from today to day before next christmas` | `2026-01-15 00:00 → 2026-12-24 00:00 UTC` |
| `from next christmas to next new years day` | `2026-12-25 00:00 → 2027-01-01 00:00 UTC` |

`datetimeRangeHoliday` **is** the `datetime-range` kind — same id, same unit, same
window grammar — with one more endpoint parser behind it. Register one or the
other, never both. The place is configured exactly as the datetime bridge's is,
and defaults to `US` for the same reason:

```ts
createDatetimeRangeHoliday({ place: { country: "GB", state: "ENG" } });
// "from today to next boxing day" → 2026-01-15 00:00 → 2026-12-26 00:00 UTC
```

The bridge reaches `@smartput/datetime/holiday` rather than `findHoliday`
directly, so the selector, the shift, the type nouns and the fuzzy name scorer
are one implementation and not two that drift. And the datetime endpoint is tried
**first**: a segment chrono can read is a date, the name scorer is an
edit-distance guess, and a guess must not cost the reading that was already
right.

Importing `@smartput/datetime-range` reaches none of that. The subpath is the
only module in the package that imports `@smartput/holiday`, and
`scripts/check-size.ts` carries a `datetime-range root (no holiday data)` row
that fails by 1.44 MB if a re-export ever leaks the rule table inwards —
147,846 B without holidays against 1,586,908 B with them, measured rather than
estimated.

Without the subpath, `from today to closest holiday` does not silently do
something else. The right-hand segment resolves to nothing, the matcher declines
the whole phrase, and the engine throws on a string it cannot read.

## The packages

```
@smartput/date            kind "date"             core, datetime
@smartput/time            kind "time"             core, datetime
@smartput/range-core      no kind                 core, datetime
@smartput/date-range      kind "date-range"       core, range-core, date
@smartput/time-range      kind "time-range"       core, range-core, time
@smartput/datetime-range  kind "datetime-range"   core, range-core, date, time, holiday
```

`@smartput/range-core` defines no kind. It holds the pieces all three ranges
share — the half-open value shape, the boundary snapping, the window table, the
endpoint seam, `InvertedRangeError`, and the two weights:

```ts
import {
  RANGE_WEIGHTS,   // { reading: -5, signature: 20 }
  WINDOWS,         // the five named windows, frozen
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  wrapRange, unwrapRange, assertOrdered,
  InvertedRangeError,
  type EndpointParser, resolveEndpoint,
} from "@smartput/range-core";

WINDOWS.night; // { start: 22, end: 6, wraps: true }
```

The window table is data, not code: a `night` that starts at 21:00 is a
configuration change, passed as `windows` to `createTimeRange` or
`createDatetimeRange` and merged over the defaults per engine.

Boundary snapping is the part with the sharp edge. Every boundary is
`startOfDay()` of the target calendar date, and the date is always chosen
*before* the snap — a wall clock is not guaranteed to have a midnight (Santiago
springs forward at 00:00), and `ZonedDateTime` arithmetic preserves the wall
clock, so snapping first and walking second lands an hour into the wrong day.

Six packages instead of one because the dependency graph has one direction and
the sizes differ: `range-core` is +412 B over datetime's graph, `date` is
+1,089 B, `date-range` — the widest — is +4,781 B. None of them ships a second
date library, which is what those numbers are in `check-size.ts` to prove.

## Limits

Out of scope, and stated so they do not creep back in:

- **`yr` and `mo` duration units.** `duration` has `ms s min h d wk` and nothing
  larger, so `today + 1 year` still fails. A calendar year is not a fixed ratio,
  and adding one to a ratio kind is a separate decision.
- **Recurrence.** No `every monday`, no `weekdays`.
- **Locales other than `en`.** The bridge is `chrono.parse` with the English
  rules, matching `@smartput/datetime`'s existing limit. These six packages ship
  no `./locale/<id>` entry at all, so the window and phrase words are hardcoded
  English inside their matchers rather than contributed vocabulary — which
  contradicts the repo's "vocabulary lives with the kind" rule and is the first
  followup this milestone owes.
- **Range set algebra.** No intersection, union, or containment operators. A
  range is a value with two ends, not a collection.

Two more the implementation added to that list:

- **No `in <zone>` on a range.** `whole week in tokyo` throws
  `DimensionMismatchError`. The design declares `in | <range> | datetime`; no
  range kind ships it yet.
- **No shifting on `time-range` or `datetime-range`**, as noted under
  [Arithmetic](#arithmetic).

## Next

- [Dates and time zones](/packages/datetime) — the kind all six of these read
  through, and the holiday grammar the endpoint parser reuses.
- [Ambiguity and weights](/guide/weights) — the four layers a signature weight
  now sits beside.
- [The pipeline](/guide/pipeline) — where the non-destructive literal fold that
  carries `[datetime, time]` forward together happens.
