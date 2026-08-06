# Ranges: `date`, `time`, and the three range kinds

**Status:** design approved, not implemented
**Date:** 2026-08-06
**Depends on:** M4 (`@smartput/datetime`), M6.3 (non-destructive literal fold)

## 1. What this adds

Six packages and five kinds, so that a launcher can answer "when does this
week start and end", "10:00 - 20:00", and "yesterday morning" with a value that
has two ends instead of one.

```
@smartput/date            kind "date"             core, datetime, timezone
@smartput/time            kind "time"             core, datetime, timezone
@smartput/range-core      no kind                 core, datetime
@smartput/date-range      kind "date-range"       core, range-core, date
@smartput/time-range      kind "time-range"       core, range-core, time
@smartput/datetime-range  kind "datetime-range"   core, range-core, date, time
```

**Core does not change.** Every mechanism this design needs already exists: the
literal-matcher seam from M4, the multi-reading fold from M6.3, opaque-kind
units, op signatures, and the four weight layers. That is the claim this
milestone tests, the same way M4 tested the extension seam.

## 2. Why `date` and `time` are separate kinds

`@smartput/datetime` reads `3pm` and `today` into the same kind: an instant with
a zone. That is right for arithmetic and wrong for ranges, because a range needs
to know which *component* the user actually typed.

- `10:00 - 20:00` is a span of clock time. `tomorrow - today` is a duration.
  Both are `datetime - datetime` today, so no signature can separate them.
- `whole week` snaps to calendar boundaries. `whole hour` would not.
- `yesterday morning` is a date supplying the day and a window supplying the
  hours.

Splitting the recognition gives each reading its own kind, and therefore its own
signature key. That is the entire reason the two packages exist.

### 2.1 They do not re-parse

Neither package loads `chrono-node` a second time. `@smartput/datetime` already
exports `parseDateTime`; its `DateTimeMatch` gains two booleans read off
chrono's `ParsedComponents`:

```ts
export interface DateTimeMatch {
  readonly zdt: Temporal.ZonedDateTime;
  readonly length: number;
  readonly hasDate: boolean;  // components.isCertain("day")
  readonly hasTime: boolean;  // components.isCertain("hour")
}
```

`@smartput/date`'s matcher claims when `hasDate && !hasTime`.
`@smartput/time`'s claims when `hasTime && !hasDate`. Both claim **the same
span** datetime claims, so `foldLiterals` sees a tie on `end` and carries every
reading forward together — `today` arrives at the solver as `[datetime, date]`,
`3pm` as `[datetime, time]`, and `2026-03-01 08:00` as `[datetime]` alone.

This is the only reason the design needs no core change. If the fold still chose
one reading per span, as it did before M6.3, `date` could not coexist with
`datetime` at all.

### 2.2 Value shapes

Both kinds are **opaque**, and both take their units from `ZONES` +
`OFFSET_ZONES` — the same table `@smartput/datetime` copies — so that `in tokyo`
works on every one of them without a new mechanism.

| Kind | `canonical` | `unit` | `meta` | `format` |
| --- | --- | --- | --- | --- |
| `date` | epoch ns at local midnight of that day | IANA zone id | `{ iso, day }` | `2026-01-15` |
| `time` | ns since local midnight, `0 <= x < 86_400e9` | IANA zone id | `{ hms }` | `15:00` |

`date.meta.day` is the plain calendar date, `"2026-01-15"`. `time.meta.hms` is
`"15:00:00"`. `iso` keeps the full zoned string so `unwrap` can rebuild a
`Temporal.ZonedDateTime` without re-deriving the zone, matching what
`@smartput/datetime`'s `value.ts` already does.

`time`'s canonical is deliberately *not* an epoch count. Two clock times
compared across different days must still order by clock, and a span from 10:00
to 20:00 is 10 hours whatever day it lands on.

### 2.3 Ops on the two new kinds

| Signature | Result | Input |
| --- | --- | --- |
| `+ \| date \| duration` | `date` | `today + 3 d` |
| `- \| date \| duration` | `date` | `today - 1 wk` |
| `- \| date \| date` | `duration` | see below |
| `+ \| time \| duration` | `time` | `10:00 + 90 min` |
| `- \| time \| duration` | `time` | `10:00 - 90 min` |

**Neither kind declares an `in` conversion.** `today in tokyo` and
`10:00 in tokyo` already work through `in | datetime | datetime`, because the
fold carried a `datetime` reading of `today` and `10:00` alongside the new one.
Declaring `in | date | datetime` here would claim the key that §5.1 needs for
`today to friday 5pm`, and registry pass 4 refuses a second claimant. The
consequence is that a zone conversion returns a `datetime`, not a `date` —
which is the existing documented answer and the right one, since `today in nyc`
is `2026-01-14 19:00 ET` and no longer a whole day.

`- | date | date` is declared and returns a `duration` in whole days. It never
changes an existing answer: `tomorrow - today` already resolves through
`- | datetime | datetime`, both readings produce `1 day`, and the corpus row is
unaffected. It exists so that `2026-03-01 - 2026-01-15` reports `45 d` rather
than datetime's fractional-week rendering.

`- | time | time` is **not** declared here. It belongs to `@smartput/time-range`
and is the subject of §4.

## 3. `@smartput/range-core`

No kind, no matcher, no vocabulary. It holds what the three range packages would
otherwise each copy:

- **`RangeValue` construction and `unwrap`** — the shared `{ start, end }` meta
  shape and its `Temporal` round-trip.
- **Boundary snapping** — start/end of week, month, year, day, against a
  `Temporal.ZonedDateTime` and a configurable week start.
- **The window table** — `morning`, `afternoon`, `evening`, `night`, `day`.
- **`InvertedRangeError`**.
- **`RANGE_WEIGHTS`** — the default weight layer that settles §4.

It depends on `@smartput/datetime` for `Temporal` rather than pulling
`temporal-polyfill` a second time. Every consumer of `range-core` depends on
datetime transitively regardless, so this costs nobody a byte they were not
already paying.

### 3.1 Half-open ends

Every range stores its end **exclusive**. `whole week` on Thursday
2026-01-15 is `2026-01-19T00:00` to `2026-01-26T00:00`.

`date-range`'s formatter subtracts one day for display, so it reads
`2026-01-19 → 2026-01-25`. Storing the exclusive instant keeps span arithmetic
free of off-by-one corrections; displaying the inclusive last day is what a
person means by "the week of the 19th".

`time-range` and `datetime-range` format their stored ends verbatim —
`10:00 → 20:00` — because a clock time or an instant reads naturally as a
boundary and nobody expects `19:59:59.999`.

### 3.2 The window table

```
morning     06:00 → 12:00
afternoon   12:00 → 18:00
evening     18:00 → 22:00
night       22:00 → 06:00    wraps
day         06:00 → 22:00
```

Overridable two ways, both already existing channels: an engine option passed
through to the matcher via `MatchCtx`, and a locale pack contributing the words.
The table is data, not code — a `night` that starts at 21:00 is a config change,
not a patch.

## 4. `10:00 - 20:00`, and how priority is configured

This is the load-bearing conflict, and the reason `time` is a kind.

`foldLiterals` is destructive for a claim spanning more than one token: only a
single-token claim keeps a `fallback`. So a literal matcher claiming the whole
run `10:00 - 20:00` would delete the subtraction reading before the solver ever
sees it. That path is rejected.

Instead the dash form is an **op signature**, over two kinds the fold carried
side by side:

```
lex "10:00 - 20:00"
  literal @0  readings: [datetime 10:00, time 10:00]
  op      -
  literal @8  readings: [datetime 20:00, time 20:00]

solver:
  - | datetime | datetime -> duration     @smartput/datetime, weight 0
  - | time     | time     -> time-range   @smartput/time-range, weight +3
```

Two live candidates, ranked by the ordinary weight layers. Nothing is deleted,
`explain()` lists both, and `AmbiguityError` still fires where it should.

**`tomorrow - today` is untouched**, because neither operand has a `time`
reading: chrono reports no certain hour, so `@smartput/time`'s matcher declines
and only the datetime signature matches. Same for `3pm - 1h`, where the right
operand is a `duration` and no range signature applies.

Priority is configured by the weight the reading carries, exported so it can be
overridden rather than hardcoded:

```ts
import { RANGE_WEIGHTS } from "@smartput/range-core";

createEngine({
  weights: { kinds: { "time-range": -5 } },  // prefer subtraction
});
```

Default is `+3`, which puts the range above subtraction: a person typing
`10:00 - 20:00` into a launcher means a span essentially always.

## 5. The two entry paths

### 5.1 Op signatures

`to` and `as` are surface words for the `in` keyword, not operators of their own
— `keywordFor` maps them to `in`, which is how `kyiv to warsaw` reaches
`in | place | place`. So the two-endpoint forms need no new `OpSymbol`.

| Signature | Result | Input |
| --- | --- | --- |
| `- \| time \| time` | `time-range` | `10:00 - 20:00` |
| `in \| time \| time` | `time-range` | `10:00 to 20:00` |
| `in \| date \| date` | `date-range` | `today to friday` |
| `in \| date \| datetime` | `datetime-range` | `today to friday 5pm` |
| `in \| datetime \| date` | `datetime-range` | `9am to friday` |
| `+ \| <range> \| duration` | same range | `whole week + 1 wk` |
| `- \| <range> \| duration` | same range | `whole week - 1 wk` |
| `in \| <range> \| datetime` | same range | `whole week in tokyo` |

`in | date | datetime` and `in | datetime | date` are free for these rows only
because §2.3 declined to spend them on zone conversion. `in | <range> | datetime`
has no such contest — a range has no `datetime` reading of its own, so it needs
its own conversion signature and nothing else claims one.

`- | date | date` is **not** a range. It stays the duration of §2.3, because
`today - friday` reads as subtraction to everybody.

**`in | datetime | datetime` is unavailable.** `@smartput/datetime` owns that key
for zone conversion, and registry pass 4 refuses a second claimant. So
`2026-03-01 08:00 to 2026-03-02 17:00` — both endpoints fully specified — cannot
reach a range through the op path. It is served by the `from X to Y` matcher
form in §5.2 instead. This is the one acknowledged wart in the design; the
alternative is taking the key away from zone conversion, which would break
`3pm in tokyo`.

`+`/`-` with a duration shift **both ends** by the same amount, so
`whole week + 1 wk` is next week. Shifting through the calendar for whole days
and weeks reuses `addDuration` from `@smartput/datetime`.

`in <zone>` converts both ends and preserves the span exactly. For `time-range`
the conversion moves the clock and may change `meta.wraps`.

### 5.2 Literal matchers

Everything with no two-operand shape. Each range package registers one matcher.

**`@smartput/date-range`**

```
whole week / this week / next week / last week
whole month / this month / next month / last month
whole year / this year / next year / last year
year / 1 year / one year
whole day
```

`year`, `1 year` and `one year` all resolve to the **calendar year containing
now** — 2026-01-01 to 2027-01-01. `duration` has no `yr` unit, so nothing else
claims them. This is the ruling most open to revision; the competing reading is
a duration of one year, which §8 records as out of scope.

Week start defaults to Monday and is a `range-core` option.

**`@smartput/time-range`**

```
morning / afternoon / evening / night / day
```

Resolved against the window table. Bare, they are a `time-range` — no date
attached.

**`@smartput/datetime-range`**

```
yesterday morning / todays morning / tomorrow morning / next morning
yesterday evening / tonight / ...
from X to Y  /  from X until Y
until Y / till Y / through Y
```

A date word plus a window word is a `datetime-range`: the date supplies the day,
the window supplies the hours. `next morning` is tomorrow morning.

`from X to Y` claims the whole run, which is safe — there is no competing
reading of a run that starts with `from`. `until Y` implies **start = now**.

`from X` with **no end is not claimed at all**. The matcher declines, `from`
falls through as an ordinary word, and `X` keeps whatever reading it had. An
incomplete range is not an error, it is not a range.

## 6. Errors

`range-core` exports one new error:

```ts
export class InvertedRangeError extends SmartputError {
  constructor(readonly input: string, readonly start: string, readonly end: string)
}
```

Thrown when `end <= start` after both endpoints resolve. It names both formatted
endpoints, because "tomorrow is after now" is the fact the user needs.

| Input | Outcome |
| --- | --- |
| `from tomorrow to present` | `InvertedRangeError` |
| `until yesterday` | `InvertedRangeError` — implicit start is now |
| `until 20:00` when now is 21:00 | `InvertedRangeError` |
| `20:00 - 06:00` | a `time-range` that wraps — **not** an error |
| `night` | a `time-range` that wraps |

Endpoints resolve **literally**. There is no rolling forward to the next
occurrence: a rule that rescued `until 20:00` at 21:00 by moving to tomorrow
would have to rescue `until yesterday` too, and then no input is ever wrong.

`time-range` is exempt from the check entirely. A clock has no ordering across
midnight, so a wrapping span is a legitimate value; `meta.wraps` records it and
the length is computed modulo 24 hours.

`date-range` and `datetime-range` are not exempt. A backwards calendar span is
always a mistake.

## 7. Testing

Every package gets a golden corpus asserted against the fixed clock
**2026-01-15T12:00:00Z** — a Thursday — in **UTC**, the same fixture
`@smartput/datetime` uses. Corpus rows assert `formatted` verbatim.

Per package:

- **`date` / `time`** — the claim gate. Rows pinning that `today` yields both a
  `date` and a `datetime` reading, that `2026-03-01 08:00` yields only
  `datetime`, and that `10 m` is still a length.
- **`range-core`** — unit tests for boundary snapping across month and year
  ends, leap day, and a DST transition. No engine.
- **`date-range`** — every calendar span, with the week-start option flipped.
- **`time-range`** — the dash race in both weight configurations, and wrapping.
- **`datetime-range`** — date-plus-window combinations, `from`/`until`, and
  every row of the §6 error table.

Two property tests: for every non-wrapping range, `start < end`; and `in <zone>`
preserves `end - start` exactly.

Regression rows in `@smartput/datetime`'s own corpus pin that
`tomorrow - today`, `3pm - 1h`, and `3pm in tokyo` are unchanged with all six
packages registered.

`check-deps.ts` gains the six packages and their dependency rows.
`check-size.ts` gains a budget per entry point.

## 8. Out of scope

- **`from today to closest holiday`.** Needs a holiday table, which is a data
  package of its own. `@smartput/holiday` would feed named dates through the
  same literal seam the range packages already read; recorded as a followup, not
  built here.
- **`yr` and `mo` duration units.** `duration` has `ms s min h d wk` and nothing
  larger, so `today + 1 year` still fails. A calendar year is not a fixed ratio
  and adding one to a ratio kind is a separate decision.
- **Recurrence.** No `every monday`, no `weekdays`.
- **Locales other than `en`.** The bridge is `chrono.parse` with the English
  rules, matching `@smartput/datetime`'s existing limit.
- **Range set algebra.** No intersection, union, or containment operators. A
  range is a value with two ends, not a collection.
