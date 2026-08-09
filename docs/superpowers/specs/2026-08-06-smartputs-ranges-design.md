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

**Core changes once**: `OpSignature` gains `weight?: number`. Everything else
this design needs already exists — the literal-matcher seam from M4, the
multi-reading fold from M6.3, opaque-kind units, and the weight layers.

The one field is not optional, and §4 derives why from the solver's arithmetic:
a candidate's score is the sum of its **operand readings'** weights plus
`contextBonus`, and the result kind contributes nothing. So no existing knob can
say "prefer this signature" without also saying "prefer this reading
everywhere", and the two requirements conflict directly — `10:00 - 20:00` needs
`time` to win while bare `3pm` needs `datetime` to win. A weight on the
signature is the missing term, and it lands beside `contextBonus` in the same
tree walk.

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

Both kinds are **opaque**, and each registers exactly **one unit** — `date` has
`day`, `time` has `clock`. The zone rides on `meta`, not on `unit`.

| Kind | `canonical` | `unit` | `meta` | `format` |
| --- | --- | --- | --- | --- |
| `date` | epoch ns at local midnight of that day | `"day"` | `{ iso, day, zone }` | `2026-01-15` |
| `time` | ns since local midnight, `0 <= x < 86_400e9` | `"clock"` | `{ iso, hms, zone }` | `15:00` |

**Zones are deliberately not units here**, and this is load-bearing rather than
a simplification. A `convert` node's targets come from the unit-alias index, so
if `date` copied `ZONES` the way `datetime` does, `tokyo` would be a `date`
target — and `today in tokyo` would match `in | date | date`, which §5.1 makes a
`date-range`. It would score *above* the zone conversion, because both operands
would read as `date` and collect the `contextBonus` that a mixed
`date`/`datetime` pair does not. A correct input would return a broken range.

One unit each closes that off by construction: no zone alias can ever resolve to
a `date` or `time` target, so the range signatures are unreachable from
`X in <zone>`.

Both matchers set **`targetable: true`**, which is what lets `friday` stand on
the right of `to` in `today to friday`. The M6.1 gate that gave datetime's
literals `targetable: false` was there to keep `today in tomorrow` from being a
zone conversion; under this design that phrase becomes a `date-range`, which is
what it should have meant.

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
| `+ \| time \| duration` | `time` | `10:00 + 90 min` |
| `- \| time \| duration` | `time` | `10:00 - 90 min` |

**Neither kind declares an `in` conversion**, because neither has a zone to
convert to — §2.2 spent their unit slot on `day` and `clock`. `today in tokyo`
and `10:00 in tokyo` keep working through `in | datetime | datetime`, since the
fold carried a `datetime` reading of both alongside the new one. A zone
conversion therefore returns a `datetime` rather than a `date`, which is the
existing documented answer and the right one: `today in nyc` is
`2026-01-14 19:00 ET`, no longer a whole day.

**`- | date | date` is not declared.** It would lose every contest it entered —
§4's arithmetic gives `today - friday` 20 points on the `date` path against 30
on the `datetime` path — so `tomorrow - today` stays the `1 day` duration the
corpus already pins, and a signature that can never win is not worth its key.

`- | time | time` is **not** declared here either. It belongs to
`@smartput/time-range` and is the subject of §4.

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
  - | datetime | datetime -> duration     @smartput/datetime
  - | time     | time     -> time-range   @smartput/time-range
```

Two live candidates. Nothing is deleted, `explain()` lists both, and
`AmbiguityError` still fires where it should.

### 4.1 Why the existing weight layers cannot rank them

`solve()` scores a candidate as **the sum of its operand readings' weights, plus
`contextBonus`**. `weights.ts` offers three selectors — `token:<surface>`,
`<kind>:<unit>`, and `<kind>` — every one of them a property of a *reading*. The
result kind is never consulted, and `OpSignature` carries no weight.

Two requirements pull that single dial in opposite directions:

| Input | Must win | Needs |
| --- | --- | --- |
| `3pm` | `datetime`, formatting `2026-01-15 15:00 UTC` | `weight(time) < weight(datetime)` |
| `10:00 - 20:00` | `time-range` | `weight(time) > weight(datetime)` |

`contextBonus` cannot break the tie: it pays +30 whenever a binary node's two
operands agree on kind, and both readings agree, so it lands on both paths and
cancels.

Writing out the sums with a `time` reading weighted `-5` and a signature weight
of `+20` shows what the new term has to do:

| Input | `datetime` path | `time` path | Winner |
| --- | --- | --- | --- |
| `3pm` | `0` | `-5` | `datetime` |
| `10:00 - 20:00` | `0 + 0 + 30` = **30** | `-5 - 5 + 30 + 20` = **40** | `time-range` |
| `today - friday` | `0 + 0 + 30` = **30** | `-5 - 5 + 30 + 0` = **20** | `duration` |

The signature weight must exceed twice the reading penalty, or the two
subtractions cancel and the contest ties. `+20` against `-5` clears it with room
and stays under `CONTEXT_BONUS` (30) and `TYPO_PENALTY` (15) so it cannot
overturn a corrected reading.

### 4.2 The core change

```ts
export interface OpSignature {
  // ...existing fields
  /** Summed into the candidate's score when this signature is applied. */
  readonly weight?: number;
}
```

Summed by a `signatureWeight` walk that sits beside `contextBonus` in
`solve/solver.ts` and resolves signatures exactly as it already does:

```ts
function signatureWeight(node, choices, registry): number {
  let total = 0;
  walk(node, (n) => {
    if (n.type === "binary") {
      const left = typeOf(n.left, choices, registry);
      const right = typeOf(n.right, choices, registry);
      if (left === null || right === null) return;
      total += registry.ops.get(opKey(n.op, left, right))?.weight ?? 0;
    } else if (n.type === "convert") {
      const operand = typeOf(n.operand, choices, registry);
      const target = choices.get(n);
      if (operand === null || target === undefined) return;
      total += registry.ops.get(opKey("in", operand, target.kind))?.weight ?? 0;
    }
  });
  return total;
}
```

`Assignment` gains a `signatureWeight` field alongside `contextBonus`, for the
same reason that one exists: `explain()` has to be able to say where a score
came from. Default `0` keeps every existing signature scoring exactly as it does
today, so no corpus row moves.

**`tomorrow - today` is untouched**, because neither operand has a `time`
reading: chrono reports no certain hour, so `@smartput/time`'s matcher declines
and only the datetime signature matches. Same for `3pm - 1h`, where the right
operand is a `duration` and no range signature applies.

### 4.3 Configuring the priority

Two dials, both exported as factory options rather than engine weights, because
both belong to the kind that declares them:

```ts
import { createTime } from "@smartput/time";
import { createTimeRange } from "@smartput/time-range";

createTime({ weight: -5 });          // default -5
createTimeRange({ dashWeight: 20 }); // default +20; 0 makes subtraction win
```

`dashWeight: 0` restores subtraction as the reading of `10:00 - 20:00` without
removing the `to` form, which is the configuration someone doing clock
arithmetic wants. The default prefers the range: a person typing
`10:00 - 20:00` into a launcher means a span essentially always.

`RANGE_WEIGHTS` in `range-core` holds both defaults as named constants so the
numbers appear once.

## 5. The two entry paths

### 5.1 Op signatures

`to` and `as` are surface words for the `in` keyword, not operators of their own
— `keywordFor` maps them to `in`, which is how `kyiv to warsaw` reaches
`in | place | place`. So the two-endpoint forms need no new `OpSymbol`.

| Signature | Result | Weight | Input |
| --- | --- | --- | --- |
| `- \| time \| time` | `time-range` | +20 | `10:00 - 20:00` |
| `in \| time \| time` | `time-range` | +20 | `10:00 to 20:00` |
| `in \| date \| date` | `date-range` | +20 | `today to friday` |
| `+ \| <range> \| duration` | same range | 0 | `whole week + 1 wk` |
| `- \| <range> \| duration` | same range | 0 | `whole week - 1 wk` |
| `in \| <range> \| datetime` | same range | 0 | `whole week in tokyo` |

**Same-kind pairs only.** `in | date | datetime` and `in | datetime | date`
were in an earlier draft, for `today to friday 5pm`. They are dropped: a mixed
pair collects no `contextBonus`, so it scores 15 against the zone conversion's
30 and loses anyway, and declaring a signature that cannot win is how
`today in tokyo` acquires a second reading nobody wants. Mixed endpoints go
through the `from X to Y` matcher in §5.2, which claims its whole span and never
enters a contest.

`in | <range> | datetime` has no contest at all — a range has no `datetime`
reading of its own, so nothing else claims that key.

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

### 5.3 Holiday endpoints

`@smartput/holiday` and the `@smartput/datetime/holiday` subpath already ship, so
`from today to closest holiday` needs no new data and no new package — only a
route by which the range matcher can resolve an endpoint the holiday grammar
claims.

`range-core` exports the seam:

```ts
export type EndpointParser = (
  text: string,
  ctx: MatchCtx,
) => { zdt: Temporal.ZonedDateTime; length: number } | null;

export function resolveEndpoint(
  text: string,
  ctx: MatchCtx,
  parsers: readonly EndpointParser[],
): { zdt: Temporal.ZonedDateTime; length: number } | null;
```

`@smartput/datetime-range`'s root passes `[parseDateTime]`. Its
**`./holiday` subpath** passes `[parseDateTime, holidayEndpoint]` and exports
`datetimeRangeHoliday`, mirroring the split `@smartput/datetime` already makes
for exactly this dependency:

```ts
import { datetimeRangeHoliday } from "@smartput/datetime-range/holiday";
```

The subpath is the only module that imports `@smartput/holiday`, so importing
`@smartput/datetime-range` never reaches `date-holidays` and its 768 KB rule
table. `check-size.ts` enforces that with a `datetime-range root (no holiday
data)` row, the same guard the `datetime root` row already applies.

Without the subpath, `today to closest holiday` still works through the op path
— `closest holiday` is a `datetime` literal the holiday kind claims, and
§5.1's `in | date | date` does not apply to it, so it falls to
`in | datetime | datetime`, which is a zone conversion and wrong. The subpath is
therefore how holiday endpoints are supported, not an optimisation of them.

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
| `from tomorrow to present` | `UnitParseError` — see below |
| `until yesterday` | `InvertedRangeError` — implicit start is now |
| `until 20:00` when now is 21:00 | `InvertedRangeError` |
| `20:00 - 06:00` | a `time-range` that wraps — **not** an error |
| `night` | a `time-range` that wraps |

`from tomorrow to present` was written into this table as an
`InvertedRangeError` and is not one, which the implementation established rather
than assumed: chrono reads no date at all in "present", so the endpoint never
resolves, the matcher declines the whole run, and the input fails as an
unparseable quantity before any ordering check happens. `from tomorrow to today`
is the same intent expressed in words chrono knows, and it does throw
`InvertedRangeError`. Teaching the range packages a "present" synonym for `now`
would be vocabulary work in a locale pack, which none of these packages have yet
— see §8.

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

- **`yr` and `mo` duration units.** `duration` has `ms s min h d wk` and nothing
  larger, so `today + 1 year` still fails. A calendar year is not a fixed ratio
  and adding one to a ratio kind is a separate decision.
- **Recurrence.** No `every monday`, no `weekdays`.
- **Locales other than `en`.** The bridge is `chrono.parse` with the English
  rules, matching `@smartput/datetime`'s existing limit.
- **Range set algebra.** No intersection, union, or containment operators. A
  range is a value with two ends, not a collection.
