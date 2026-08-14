`@smartput/datetime` adds one kind. Once it is registered, `today` is a value,
`today + 3 d` is arithmetic against core's `duration`, and `3pm in tokyo` is the
ordinary `in` operator with a time zone as its target.

Core learned nothing about dates to make that work. It learned one new
recognition seam — a **literal matcher**, a function a kind supplies that is
offered the source string and claims a run of characters — and the datetime
package supplies exactly one of them. Core has no date-specific code at all: no
calendar, no zone table, and no mention of `chrono` or `Temporal` outside a
comment explaining why they are somebody else's dependency.

```sh
bun add @smartput/datetime
```

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { datetime } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import datetimeEn from "@smartput/datetime/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => Date.now(),      // injectable clock, epoch milliseconds
  timeZone: "UTC",            // defaults to the host zone
});

engine.evaluate("today").formatted;        // "2026-01-15 00:00 UTC"
engine.evaluate("3pm in tokyo").formatted; // "2026-01-16 00:00 JST"
```

`now` and `timeZone` are the two options the kind needs and core supplies.
Neither is date-specific: `now` is a number of milliseconds, `timeZone` is a
string, and both are handed to every registered matcher through `MatchCtx`.
Injecting them is what makes `"today"` testable — every example on this page is
a corpus row asserted against the fixed clock **2026-01-15T12:00:00Z**, a
Thursday, in **UTC**.

## What it recognises

| Input | Result |
| --- | --- |
| `today` | `2026-01-15 00:00 UTC` |
| `tomorrow` | `2026-01-16 00:00 UTC` |
| `yesterday` | `2026-01-14 00:00 UTC` |
| `next week monday` | `2026-01-19 00:00 UTC` |
| `next friday` | `2026-01-23 00:00 UTC` |
| `last monday` | `2026-01-12 00:00 UTC` |
| `3pm` | `2026-01-15 15:00 UTC` |
| `9:30` | `2026-01-15 09:30 UTC` |
| `2026-03-01` | `2026-03-01 00:00 UTC` |
| `2026-03-01 08:00` | `2026-03-01 08:00 UTC` |
| `in 3 days` | `2026-01-18 00:00 UTC` |
| `3 days ago` | `2026-01-12 00:00 UTC` |

Two behaviours worth stating outright, because both are choices:

- **A time nobody typed is midnight.** `today` is `00:00`, not the reference
  clock's 12:00. A result that silently carried the current time of day would
  make `"today"` depend on when it ran.
- **`next friday` is the Friday of the following week**, not tomorrow. That is
  how `chrono-node` reads a `next` modifier, and it is asserted in the corpus so
  an upgrade that changes it fails loudly rather than quietly.

<SpDatetime />

The value is an ordinary `Value` — no new field, nothing a `JSON.stringify` will
choke on:

```ts
const { value } = engine.evaluate("today");

value.kind;                 // "datetime"
value.canonical.toString(); // "1768435200000000000" — epoch nanoseconds, a Decimal
value.unit;                 // "UTC" — the IANA zone id
value.meta.iso;             // "2026-01-15T00:00:00+00:00[UTC]"
```

`canonical` is the epoch nanosecond count, which is why ordering and
subtraction work without the engine knowing what a date is. The zone and wall
clock ride on `meta.iso` as a string; the `Temporal` object is never stored.

## Arithmetic

`duration` is a core kind. It stays a core kind: `30 hours - 10 minutes` is
ratio arithmetic that never loads Temporal, never reaches a matcher, and works
in an engine that has never heard of `@smartput/datetime`. What the plugin adds
is four op signatures joining the two kinds.

| Input | Result |
| --- | --- |
| `today + 3 d` | `2026-01-18 00:00 UTC` |
| `today - 1 wk` | `2026-01-08 00:00 UTC` |
| `3 d + today` | `2026-01-18 00:00 UTC` |
| `today + 2 h` | `2026-01-15 02:00 UTC` |
| `today + 90 min` | `2026-01-15 01:30 UTC` |
| `tomorrow - today` | `1 day` (a `duration`) |
| `2026-03-01 - today` | `6.4285714285714285714285714 weeks` |

`3 d + today` has its own signature because a solver with only
`datetime + duration` would report a dimension mismatch on input a user
considers obviously fine.

Adding a whole number of days or weeks goes through the **calendar**, not
through a millisecond count: `today + 1 d` across a DST boundary moves the wall
clock by a day, which is not the same instant arithmetic would give. Everything
else — hours, minutes, fractional days — is exact, because two hours is two
hours whatever the calendar is doing.

Subtracting two datetimes gives a `duration` reported in the largest unit its
magnitude fills, since the left operand's "unit" is a time zone and there is no
unit to inherit.

## Time zones

A zone is a **unit** of the `datetime` kind. That is the entire mechanism:
conversion is the same `in` operator that converts kilometres to miles, and the
target is looked up in the same alias index.

| Input | Result |
| --- | --- |
| `3pm in tokyo` | `2026-01-16 00:00 JST` |
| `today in nyc` | `2026-01-14 19:00 ET` |
| `9:30 in london` | `2026-01-15 09:30 London` |
| `3pm in japan` | `2026-01-16 00:00 JST` |

`in` keeps the instant and relabels the wall clock — `canonical` is unchanged
across the conversion.

Eighteen named zones ship in `ZONES`, keyed by IANA id — from
[`@smartput/timezone`](#the-zone-tables), not from this package:

```ts
import { ZONES } from "@smartput/timezone";

ZONES["Asia/Tokyo"]; // { aliases: ["tokyo", "jst", "japan"], symbol: "JST" }
```

**Aliases are single words.** The alias index is keyed by one segmented word, so
`nyc` can be an alias and `"new york"` cannot. Multi-word aliases need a
multi-word index, which is [recorded as a followup](#limits).

### Offset zones

A zone written as an offset from UTC — `GMT+3`, `utc-05:30`, `gmt+5:45` — is a
unit too, on every quarter hour from `-12:00` to `+14:00`:

| Input | Result |
| --- | --- |
| `3pm gmt+3` | `2026-01-15 12:00 UTC` |
| `3pm utc+0530` | `2026-01-15 09:30 UTC` |
| `3pm in gmt+3` | `2026-01-15 18:00 UTC+03:00` |
| `9:30 in gmt+5:45` | `2026-01-15 15:15 UTC+05:45` |
| `GMT+3` | `2026-01-15 15:00 UTC+03:00` |

Read the first two rows the same way as `3pm est`: an offset **inside** a date
literal says which instant `3pm` was, and the engine zone still decides how the
answer reads. An offset **after `in`** is a conversion target like `tokyo`.

Written offsets accept `±H`, `±H:MM` and `±HHMM`, with or without spaces around
the sign, after either `gmt` or `utc`. Anything outside the range, or off the
quarter hour, is not claimed: `gmt+15` and `gmt+3:20` are no zone anyone keeps
time in, and `gmt` with no sign after it is still the plain `UTC` alias.

`GMT+3` on its own is the current time there — the only instant a zone alone can
mean. That is one thing a bare zone *word* does not do: `utc` reaches the engine
as a unit alias, and a lone unit alias has never been a quantity.

These units carry no aliases, because `gmt+3` lexes as three tokens (a word, an
operator, a number) and no single-word alias lookup could ever reach it. A
literal matcher claims the run instead, over a parser the zone package owns:

```ts
import { OFFSET_ZONES, parseOffsetZone } from "@smartput/timezone";

parseOffsetZone("gmt+5:30 tomorrow"); // { zone: "+05:30", length: 8 }
OFFSET_ZONES["+05:30"];               // { aliases: [], symbol: "UTC+05:30" }
OFFSET_ZONES["+00:00"];               // { aliases: [], symbol: "UTC" }
```

Time zones also change what a bare time *means*, so the engine zone is not only
a display setting:

```ts
engine.evaluate("3pm", { timeZone: "Asia/Tokyo" }).formatted;
// "2026-01-15 15:00 JST" — 3pm in Tokyo, a different instant from 3pm in UTC
```

`EvalOptions.timeZone` overrides `EngineOptions.timeZone` per call, which is
what a server handling requests from many places needs.

### The zone tables

Both tables, the offset parser and the symbol lookup live in
**`@smartput/timezone`**, which has no runtime dependency at all:

```ts
import { OFFSET_ZONES, parseOffsetZone, ZONES, zoneSymbol } from "@smartput/timezone";
```

They are a package of their own so that a zone picker costs a zone picker. A
form field listing zones, or checking that a user typed a real one, needs the
tables and nothing else; `@smartput/datetime` is those plus `chrono-node` and
`temporal-polyfill`, which are several times the size of the engine. The
dependency therefore runs from the consumer inwards — the same argument that
keeps `@smartput/city` out of `@smartput/country`.

`@smartput/datetime` registers both tables as its units and adds nothing to
them, which is why a zone id from either one works in every position.

### Adding vocabulary

Zone words are ordinary [`Vocabulary`](/guide/locales) entries — the same
channel `@smartput/datetime/locale/en` itself uses for `germany`, `ukraine` and
`britain`. A language holds **one** vocabulary per kind, so an extra word merges
into the shipped table rather than arriving as a second one; a second
`datetime` vocabulary is a `VocabularyConflictError` at `composeLocale()`:

```ts
import { composeLocale, defineVocabulary } from "@smartput/core";
import datetimeEn from "@smartput/datetime/locale/en";

const kyiv = datetimeEn.units["Europe/Kyiv"];

const myZones = defineVocabulary({
  ...datetimeEn,
  units: {
    ...datetimeEn.units,
    "Europe/Kyiv": { ...kyiv, aliases: [...(kyiv?.aliases ?? []), "kyivcity"] },
  },
});

createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, myZones])],
  kinds: [...BUILTIN_KINDS, datetime],
}).evaluate("3pm in kyivcity");
```

A zone the package does not ship at all is an `extendsKind` patch, since an
opaque kind's `units` merge exactly like a ratio kind's. Those units are unit
**ids** and carry no words — the words go where every kind's words go:

```ts
import { defineKind } from "@smartput/core";

const extraZones = defineKind({
  id: "datetime-extra-zones",
  extendsKind: "datetime",
  value: { mode: "opaque", units: ["Africa/Lagos"] },
});

const lagosEn = defineVocabulary({
  ...datetimeEn,
  units: {
    ...datetimeEn.units,
    "Africa/Lagos": { aliases: ["lagos"], symbol: "WAT" },
  },
});

createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, lagosEn])],
  kinds: [...BUILTIN_KINDS, datetime, extraZones],
}).evaluate("3pm in lagos").formatted;
// "2026-01-15 16:00 Africa/Lagos"
```

The formatter reads its zone symbol from `ZONES` and `OFFSET_ZONES`, so a zone
added this way
prints its IANA id rather than `WAT`. Registering the symbol for display is
`format`'s business, and overriding `format` in the patch is the way to get it.

## Holidays

`christmas`, `next easter`, `day before christmas`, `closest bank holiday`. They
are an opt-in behind a subpath, and the subpath is the whole design:

```sh
bun add @smartput/datetime @smartput/holiday
```

```ts
import { datetimeWithHolidays } from "@smartput/datetime/holiday";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetimeWithHolidays()],
  now: () => Date.now(),
  timeZone: "UTC",
});

engine.evaluate("next easter").formatted;              // "2026-04-05 00:00 UTC"
engine.evaluate("3 weeks before christmas").formatted; // "2025-12-04 00:00 UTC"
```

`datetimeWithHolidays()` **is** the `datetime` kind — same id, same units, same
op signatures — with one more literal matcher behind it. Register one or the
other, never both.

`@smartput/holiday` wraps `date-holidays`, which ships a 768 KB rule table and
bundles to 1.43 MB minified, 236 KB gzipped. Those are measurements, not
estimates: `scripts/check-size.ts` carries a row for the package alone, a row for
the bridge, and a row for the root entry, and the subtraction is the price of the
feature — 1.58 MB with holidays against 144 KB without, so opting in costs 1.43
MB and the doc has no reason to round it in its own favour.

Importing `@smartput/datetime` reaches none of that. The bridge is the only
module in the repo that imports both packages, it lives at `./holiday`, and the
root row fails CI by a megabyte if a re-export ever leaks the rule table inwards,
rather than the leak appearing in somebody's bundle six months later. Stating the
cost is the point: a launcher that wants `day before christmas` is a different
program from a form field that wants `today + 3 d`.

### Where to ask

Holidays are a fact about a country, so the matcher takes one:

```ts
datetimeWithHolidays({ place: { country: "GB" } });
datetimeWithHolidays({ place: { country: "US", state: "CA" } });
datetimeWithHolidays({ defaultCountry: "UA" });   // no state, no region
```

**With nothing given, the country is `US`.** That is arbitrary and it is
deliberate, so it is written down rather than discovered: `date-holidays` cannot
enumerate without a country — there is no global holiday set to search — and
sweeping all 206 would be slow and ambiguous, since `labour day` exists in dozens
of them on different dates in different months. A default that one argument
overrides beats a search that returns noise. Nothing guesses the country from the
engine's time zone or the host locale either; a guess that is usually right is
the worst of the three options, because the times it is wrong are silent.

Two smaller rulings ride along with it. A `region` needs a `state` — the library
keys regions under one, so a region on its own is dropped rather than half
applied. And a country code nothing recognises returns no holidays instead of
throwing, because this runs once per keystroke; `holidayCountries()` from
`@smartput/holiday` is the door to validate one against.

### The grammar

```
phrase   := shift? selector? subject
shift    := count? durationWord ("before" | "after")
selector := "closest" | "nearest" | "next" | "last" | "this"
subject  := typeNoun | holidayName
typeNoun := typeWord? ("holiday" | "holidays")
typeWord := "public" | "bank" | "school" | "optional" | "observance"
count    := digits | "a" | "an"
durationWord := day(s) | week(s) | month(s) | year(s)
```

Named subjects, against the default `US` place:

| Input | Result |
| --- | --- |
| `christmas` | `2025-12-25 00:00 UTC` |
| `next easter` | `2026-04-05 00:00 UTC` |
| `last christmas` | `2025-12-25 00:00 UTC` |
| `this easter` | `2026-04-05 00:00 UTC` |
| `day before christmas` | `2025-12-24 00:00 UTC` |
| `2 days after easter` | `2026-04-07 00:00 UTC` |
| `3 weeks before christmas` | `2025-12-04 00:00 UTC` |
| `2 months after christmas` | `2026-02-25 00:00 UTC` |
| `chrismas` | `2025-12-25 00:00 UTC` |
| `next chrismas` | `2026-12-25 00:00 UTC` |
| `christmas + 3 d` | `2025-12-28 00:00 UTC` |
| `christmas in tokyo` | `2025-12-25 09:00 JST` |

Nameless subjects, against `{ country: "NL" }` — because **the United States
ships no `bank` and no `school` holiday at all**, so the obvious example on the
default place returns nothing:

| Input | Result |
| --- | --- |
| `holiday` | `2026-01-01 00:00 UTC` — New Year's Day |
| `closest holiday` | `2026-01-01 00:00 UTC` |
| `closest public holiday` | `2026-01-01 00:00 UTC` |
| `closest bank holiday` | `2025-12-31 00:00 UTC` — New Year's Eve |
| `nearest school holiday` | `2026-04-03 00:00 UTC` — Good Friday |
| `next public holiday` | `2026-04-05 00:00 UTC` — Easter Sunday |
| `last bank holiday` | `2025-12-31 00:00 UTC` |
| `day before next public holiday` | `2026-04-04 00:00 UTC` |

The last row is a shift and a selector stacked over a nameless subject, and it
works. The two halves answer different questions — *which* occurrence, and *how
far from it* — so refusing the pair would mean the grammar could express each
alone but not both. A stack of *shifts* is refused: `day before 2 weeks after
christmas` parses in principle and is not a thing anyone types.

Behaviours worth stating outright, because each is a choice:

- **`closest` reaches backwards, `next` does not.** That is what makes it more
  than a synonym. With `now` on 2026-01-20, the day after Martin Luther King Jr
  Day:

  | Input | Result |
  | --- | --- |
  | `closest holiday` | `2026-01-19` — yesterday |
  | `nearest holiday` | `2026-01-19` |
  | `next holiday` | `2026-02-16` — Washington's Birthday |
  | `last holiday` | `2026-01-19` |

- **No selector means `closest`**, for both subject shapes. Bare `holiday` and
  bare `christmas` are one rule, not two: in January, `christmas` is the one
  three weeks behind rather than the one eleven months ahead.
- **A selector with nothing to point at is refused.** `this easter` in a year
  with no Easter in the window throws rather than quietly answering a nearby
  question.
- **The type filter excludes and never widens.** `closest bank holiday` on a US
  engine throws, because the US has no bank holidays — it does not fall back to
  the unfiltered set. A caller who wants that fallback asks twice, which makes it
  their visible decision instead of this package's silent one.
- **A named query applies no type filter unless you give it one.** You said which
  holiday you meant; filtering on an assumed type would refuse a correct match,
  since `boxing day` is `bank` in some countries and `public` in others.
- **Shifts go through the calendar**, not through a millisecond count — the same
  rule as `today + 1 d` above.
- **The result is midnight in the engine's zone**, rebuilt from the holiday's
  calendar date rather than converted from an instant. An `Asia/Tokyo` engine
  reads `christmas` as `2025-12-25T00:00:00+09:00`, not as the Japanese wall
  clock during American Christmas.
- **Not a conversion target.** `3pm in christmas` throws, for the same reason
  `today in tomorrow` does.

### When it declines

Names are matched by token similarity, so `chrismas` and `xmas day` land where
they should. The cost of that tolerance is that some ordinary words sit within
an edit of a holiday, and two rules keep them from stealing readings that were
already right:

- **A reading the date literal can produce on its own always wins.** `monday`
  scores 0.833 against *Easter Monday* on a `GB` engine, and without this rule a
  weekday that used to evaluate would become an `AmbiguityError`. A word chrono
  reads as a date is a date; an edit-distance neighbour of a holiday name is a
  guess, and a guess must not cost the answer that was already correct.
- **A single word shorter than four characters is never a name.** `may` is 0.663
  from *Christmas Day*, and nowhere near what anyone meant by it.

Below `minScore` — 0.6, raise it with `datetimeWithHolidays({ minScore })` — a
phrase is not claimed at all, so it fails the way any unknown word does. Raising
it past 0.667 loses `chrismas`.

## How it works

Core can otherwise only reach a kind through the shape `<number><unit-word>`. A
date is neither: `next week monday` is three words and no number, and
`2026-01-01` lexes as three numbers and two operators. So M4 added one seam.

- **A literal matcher** is a kind-supplied function offered
  `(input, offset, ctx)` at every token boundary. It returns a finished `Value`
  plus the number of characters it claims, or `null`. See
  [`Kind.literals`](/api/define-kind#literals).
- **`foldLiterals`** is a token pass — the sibling of `foldNumerals` and
  `foldWordOps`, and the first of the three. It collapses the claimed run into a
  single `literal` token, but only when the run ends exactly on a token
  boundary; a match that stops halfway through a token is dropped rather than
  splitting it.
- **Everything downstream is unchanged.** The parser makes a `LiteralNode`, the
  solver scores it through all four weight layers, `kinds` filtering drops it,
  `explain()` lists it, and `AmbiguityError` still fires where it should.

The fold is **destructive**: once `10 m` has been claimed as a date, the
`10 metres` reading is gone before the solver ever runs. `chrono-node` is happy
to read a bare quantity as a duration-from-now, so the bridge refuses any match
whose letter runs are *all* registered unit aliases.

| Text | Letter runs | Verdict |
| --- | --- | --- |
| `10 m` | `m` — a unit alias | rejected, stays `length`/`duration` |
| `5 min` | `min` — a unit alias | rejected, stays `duration` |
| `30 hours - 10 minutes` | all unit aliases | rejected, stays `duration` |
| `3pm` | `pm` — nobody's unit | accepted |
| `next week monday` | `week` is a unit; `next` and `monday` are not | accepted |
| `2026-03-01` | none, and ISO-shaped | accepted |

`MatchCtx.isUnitAlias` is the one piece of registry knowledge a matcher gets,
and it exists for exactly this gate. The corpus pins the rejected rows, so a
`chrono-node` upgrade that starts claiming `5 min` fails the suite rather than
quietly changing what a launcher does with it.

The bridge is also cut off at the first whitespace-delimited operator, because
chrono reads `today + 5 h` as one relative date and would otherwise swallow the
arithmetic the plugin exists to provide.

## Limits

Deliberate, and recorded in `docs/superpowers/m4-followups.md`:

- **Formatting is not locale-aware.** Output is `YYYY-MM-DD HH:MM <zone>`, built
  from Temporal fields rather than `Intl.DateTimeFormat`, because ICU's date
  patterns move between runtime versions and the golden corpus asserts strings
  verbatim. Locale-aware date formatting is M5's, together with the rest of i18n.
- **English only.** The bridge is `chrono.parse` with the English rules;
  `chrono` has no Ukrainian locale upstream.
- **No multi-word zone aliases** — `nyc`, not `"new york"`.
- **No completion for dates.** `complete()`'s alias-index path inserts
  `<number><unit>`, which a time zone is not, so it offers no zone rather than
  offering `1 utc`. The door out of that is
  [`Kind.completions`](/api/define-kind#completions), added in M6.4 for exactly
  this shape of vocabulary and used by `@smartput/country`; this kind does not
  declare one yet.
- **No `DateTime` facade class.** `createFacade` generates `.to()` and `.scale()`
  from a ratio table an opaque kind does not have, so it refuses one outright.
- **No recurrence, no durations-as-dates, no historical zone names.**

## Next

- [`defineKind`](/api/define-kind#literals) — the `literals` field, `LiteralMatcher`,
  `LiteralMatch` and `MatchCtx`, with the shortest matcher that works.
- [The pipeline](/guide/pipeline) — where the literal fold sits.
- [Ambiguity and weights](/guide/weights) — how a literal is scored against
  everything else.
