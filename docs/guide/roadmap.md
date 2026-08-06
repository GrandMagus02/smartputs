---
title: Roadmap
description: What ships today, what is planned, and what is deliberately out of scope.
---

# Roadmap

Each milestone is independently shippable and gets its own implementation plan.

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** | Contracts, registry, lexer, Pratt parser, solver, layered weights, softmax confidence, `explain()`. Kinds: `number`, `length`, `mass`, `duration`. Locale: `en`. | **Shipped** |
| **M2** | Temperature (affine), measure (dpi via `Value.meta`), angle, datasize, percent (`of`, `+`, `-` — [`in` and `off` came later](#percent-finished)), speed/area/volume as explicit op signatures. Facade class generator. | **Shipped** |
| **M2.5** | `Engine.complete()`, prefix completion, `typical` bands, `display` on every unit, consistent word-form output. | **Shipped** |
| **M3** | Money kind, `@smartput/rate`, ECB provider, `createLiveEngine`. | **Shipped** |
| **Word math** | `NumeralParser`, `cardinalNumerals`, numeral folding, word operators — `"twenty two kg"`, `"ten km plus five km"`. | **Shipped** |
| **M4** | `@smartput/datetime`: datetime kind, chrono bridge, Temporal ops, timezones. Core's literal-matcher seam and opaque-kind units. | **Shipped** |
| **M4.5** | `@smartput/shared`: an engine-free parser, operation algebra and value-class factory. Every ratio kind gains `./units`, `./validate`, `./class` subpaths, plus `@smartput/kinds/validate` and `/class` barrels. Per-entry byte budgets enforced in CI. | **Shipped** |
| **M5** | `@smartput/color`, the Ukrainian locale across every package, `defineLocalePack`, analyzer helpers, `assertLocaleContract`. | Planned |
| **M6** | `@smartput/country` and its three layers below: place kind, countries and cities, `kyiv to warsaw` as a distance, postal codes, the datetime and rates bridges, GeoNames providers, place completion. | **Shipped** |
| **Ranges** | `date` and `time` as kinds of their own, `range-core`, and the three range kinds — `whole week`, `10:00 - 20:00`, `yesterday morning`, `from today until friday`. Core's one new field: [`OpSignature.weight`](#ranges-and-the-one-field-they-cost). | **Shipped** |
| **Stages** | `createEngine`'s 329-line closure split into [seven frozen, config-holding stage classes](/api/stages) — `Normalizer`, `Tokenizer`, `Parser`, `Solver`, `Evaluator`, `Printer`, `Autocompleter` — each importable from its own subpath, each backed by the pure function it always was. `Program` and stable node ids replace a bare AST; `Resolution` (renamed from `Assignment`) is keyed by id instead of by node object; the [`Printer`](/api/printer) is the one genuinely new stage, turning a `Program` back into text in three modes. One behaviour change: `Result.spans` now indexes the caller's string instead of the normalized one. | **Shipped** |
| **M7** | `@smartput/http`, meta-package, npm release. | Planned |

M1 carried the only real invention risk. Most of what came after it is
descriptor tables — M3 added a kind whose unit ratios come from an injected
table without touching the solver at all, which is the point of the design. The
exception is recognition: every plugin that had to claim text the lexer does not
shape (`3pm`, `kyiv to warsaw`, `SW1A 1AA`) has taken a change out of core, and
M6 took three. The solver has never moved.

Word math has shipped in full: `NumeralParser`, `cardinalNumerals`, and
`Locale.numerals` are [documented](/api/define-locale#numerals), and the two
token passes that fold spelled numerals and word operators into ordinary
number/op tokens run on every `evaluate()` call — see
[Stage 2b — Fold](/guide/pipeline). `"twenty two kg"` and `"ten km plus five
km"` evaluate the same as their digit-and-symbol equivalents.

M4 shipped `@smartput/datetime` — see [Dates and time zones](/guide/datetime).
It cost core one new capability and no date-specific code: a kind may now supply
[literal matchers](/api/define-kind#literals), which claim a run of the source
string and return a finished `Value`, and an opaque kind's `units` are indexed,
weighted and usable as `in` targets like any other kind's. `today + 3 d` and
`3pm in tokyo` fall out of those two additions plus four op signatures declared
in the plugin.

M4.5 shipped a second entry point into every ratio kind — see
[Validating without the engine](/guide/validating). It cost every kind package
a build step and three subpath exports, and cost `@smartput/core` nothing:
`@smartput/shared` never imports it, the dependency runs the other way. The
byte figures that justify the split are measured, not estimated —
`scripts/check-size.ts` builds each entry with `bun build --minify` and fails
`bun run check` on regression, the same enforcement `check-deps.ts` already
applied to the dependency table below.

M6 shipped in four parts and then split into four packages — see
[Places and distances](/guide/places). Core knows no geography: a place is an
opaque kind whose units are country codes, the distance is one
`in | place | place` signature, and the datetime and rates bridges are one op
signature each in *those* packages, reading a string off core's `PlaceMeta`.
Nobody imports anybody, and `check-deps` enforces it.

**Geo was not free for core, though, and the design document that said it would
be was wrong three times over.** Core took three changes across the milestone,
each forced by the same shape — a seam built to produce one answer per offset,
meeting a package whose answers arrive in groups:

- **M6.1: a claimed conversion target reaches `apply`.** `15:00 in japan` needs
  the claimed *value* on the right of `in`, because the zone lives in its `meta`,
  and the parser had been discarding it for a stand-in built from the unit name.
  Gated on an opt-in `LiteralMatch.targetable`, because accepting every literal
  made `today in tomorrow` a zone conversion where it had always thrown.
- **M6.3: the literal fold stopped being destructive.** A
  [`LiteralMatcher`](/api/types#returning-more-than-one-reading) may return
  several readings of one span, and the fold keeps every match reaching the
  furthest end instead of choosing one. The lexer, the AST, the Pratt parser and
  the evaluator changed with it. `suggest("springfield")` returning all three is
  that change; so is `tokyo` being a city and a time zone in one engine, which
  was datetime's half of the same defect.
- **M6.4: a kind may complete itself.**
  [`Kind.completions`](/api/define-kind#completions) is called once per keystroke
  for a vocabulary the global alias index cannot hold — six thousand city names,
  or any name short enough that `km` becomes Comoros. Opaque kinds could not be
  completed at all before it.

Two of the three are seams any plugin can use; the third is a gate on the parser.
The lifted [snapshot cache](/api/types#snapshot-cache) came with them — rates'
`createLiveEngine` was generalized into `createSnapshotCache` /
`createCachedEngine` so that geo's providers could share it, which geo then did
not do, so that generalization is still waiting for its second consumer.

What fell out for free: `nice`, `mobile` and `split` became places without
costing any input its reading, `90210` stayed 90,210 with a postcode ranked
underneath it, and the eighteen hand-written zones in `@smartput/datetime`
stopped being the only places the engine knows.

## Ranges, and the one field they cost

Six packages and five kinds shipped so that a value can have two ends — see
[Ranges](/guide/ranges). Core paid **one optional field**:

```ts
export interface OpSignature {
  /** Summed into the candidate's score when this signature is applied. */
  readonly weight?: number;
}
```

The field is not a convenience. `solve()` scores a candidate as the sum of its
**operand readings'** weights plus `contextBonus`, and every selector
`weights.ts` offers is a property of a reading; the result kind is never
consulted. So no existing knob can say "prefer this signature" without also
saying "prefer this reading everywhere" — and the milestone's two requirements
pull that single dial in opposite directions. `3pm` must stay a `datetime`,
which wants the `time` reading weighted *down*; `10:00 - 20:00` must become a
`time-range`, which wants it weighted *up*. `contextBonus` cannot break the tie
either, because both operands agree on kind in both readings, so it lands on
both paths and cancels.

A weight on the signature is the missing term, and it lands beside
`contextBonus` in the same tree walk. Default `0`, so nothing that existed
scores differently and no corpus row moved. `Assignment` gained a matching
field, because `explain()` has to be able to say where a score came from.

Everything else the milestone needed already existed: the literal-matcher seam
from M4, the non-destructive fold from M6.3, opaque-kind units, and the weight
layers. `date` and `time` do not even load `chrono-node` a second time — they
re-read the match `@smartput/datetime`'s bridge already made, which gained two
booleans (`hasDate`, `hasTime`) and cost 47 B in the size row that watches it.

One thing did not fall out, and is recorded rather than glossed:
`in | datetime | datetime` belongs to zone conversion and the registry refuses a
second claimant, so two fully specified endpoints cannot reach a range through
the op path at all. They are served by the `from X to Y` literal matcher
instead. The alternative was taking `3pm in tokyo` away.

## Percent, finished

`percent` shipped in M2 with `of`, `+` and `-`. Two readings people actually
type were missing, and they cost core very different amounts.

| Reading | | Cost to core |
| --- | --- | --- |
| `5 / 50 in %` → `10%` | also `as %`, and `0.1 in %` | **none** — two op signatures in `@smartput/percent` |
| `20% off 50` → `40` | `20% off 50 kg` → `40 kg` | one new `OpSymbol` |

The first is a conversion the engine could always have done and had no route
to: percent's canonical storage *is* the 0–1 ratio, so `in` between `number` and
`percent` is the identity plus a change of kind. Neither direction's key was
claimed by anything, so both are declared by the kind and core does not know
they exist.

The second is the first new `OpSymbol` since M1, and it earned that by not being
an alias for anything. `20% off 50` puts the percentage on the left and the base
on the right; `50 - 20%` puts the same two operands the other way round.
Rewriting one into the other means a token fold that swaps operands, which is
indistinguishable from a bug the first time anyone reads the parse tree. So
`off` is a keyword the Pratt parser consumes at `of`'s binding — `10 + 20% off
50` is `50`, not `36` — and `generateRatioOps` emits `off | percent | K` beside
`of | percent | K` for every non-affine ratio kind. The affine branch closes the
new key without being told to: `20% off 20 c` throws, because twenty percent
less than a temperature is not a temperature.

That is what a new operator costs when the design holds: five files, all of them
the ones that enumerate operators, and no change to the solver.

## Packages

Shipped:

```
@smartput/core         registry, lexer, parser, solver, evaluator, ratio kinds
@smartput/shared     engine-free parser, operation algebra, value-class factory
@smartput/rate         money kind, RateSnapshot, ECB provider, async facade
@smartput/currency     currency table, vocabulary, engine-free parse and format
@smartput/datetime     datetime kind, chrono bridge, Temporal ops, time zones
@smartput/holiday      which holiday a phrase names and when it falls; reached
                       from @smartput/datetime/holiday, never from its root
@smartput/country      place kind: T0 countries, zone and currency lookup,
                       completion, GeoNames providers
@smartput/city         T1 gazetteer: 6,247 cities, 1,664 divisions, no code
@smartput/zip          postal literal matcher, format validation, no data
@smartput/distance     great-circle op for two place values, no data
@smartput/datarate     datarate kind: bits per second, the datasize/duration
                       bridge in both directions
@smartput/power        power kind: watts through gigawatts, mechanical horsepower
@smartput/energy       energy kind: joules, watt-hours, calories, BTU, and the
                       power x duration bridge
@smartput/tempo        tempo kind: bpm and hertz, reciprocal bridge to duration
@smartput/date         date kind: the day half of a chrono match, weighted -5 so
                       a bare "today" still reads as a datetime
@smartput/time         time kind: the clock half, same weight, ns since midnight
@smartput/range-core   no kind: half-open range values, boundary snapping, the
                       window table, the endpoint seam, InvertedRangeError
@smartput/date-range   date-range kind: "whole week", "today to friday"
@smartput/time-range   time-range kind: "morning", "10:00 - 20:00", wrapping
@smartput/datetime-range
                       datetime-range kind: "yesterday morning", "from X to Y";
                       holiday endpoints from its ./holiday subpath, never its root
```

Planned:

```
@smartput/color       @urcolor adapter → color kind
@smartput/http        Hono on Bun, REST + OpenAPI
smartputs             meta: core + datetime + rates, en preloaded
```

Every package that defines a kind ships that kind's translations beside it under
`./locale/<id>`, so vocabulary cannot drift from the kind it describes.

| Package | Runtime dependencies |
| --- | --- |
| `core` | `decimal.js` — and nothing else |
| `validate` | none — the standing target for this package, same as `core`'s one dependency |
| any ratio kind (`angle`, `length`, …) | `@smartput/core`, `@smartput/shared` |
| `datarate`, `energy`, `power`, `tempo` | `@smartput/core`, `@smartput/shared` — a bridging kind names its operand kinds by string, so it depends on neither side of the bridge |
| `*/locale/*` | none — descriptors only |
| `datetime` | `temporal-polyfill`, `chrono-node`, `@smartput/core`, `@smartput/timezone`, `decimal.js`, and `@smartput/holiday` — the last reachable only from the `./holiday` subpath |
| `holiday` | `date-holidays` — and no `@smartput` edge at all, in either direction |
| `date`, `time`, `range-core` | `@smartput/core`, `@smartput/datetime` — the last for `Temporal` and the chrono match, so `temporal-polyfill` still has exactly one import site in the repo |
| `date-range` | `@smartput/core`, `@smartput/date`, `@smartput/range-core`, `@smartput/datetime` — the last for `addDuration`, because `whole week + 1 wk` walks the calendar rather than adding 604,800 seconds |
| `time-range` | `@smartput/core`, `@smartput/time`, `@smartput/range-core` — no `datetime` edge, because a clock span never touches a calendar |
| `datetime-range` | `@smartput/core`, `@smartput/date`, `@smartput/time`, `@smartput/datetime`, `@smartput/range-core`, and `@smartput/holiday` — the last reachable only from the `./holiday` subpath, exactly as `datetime`'s is |
| `rates` | `decimal.js`, `@smartput/core`; provider adapters use `fetch` only |
| `color` | `@urcolor/core`, `@urcolor/i18n` (peer) |
| `geo` | `decimal.js`, `@smartput/core` — GeoNames data is vendored as generated TypeScript, not an npm package |
| `http` | `hono` (peer), `@smartput/core` |

`bun run check-deps` enforces this table rather than trusting it: a package
whose `dependencies` gain an entry the map does not list fails CI, and so does a
new package the map does not mention at all.

`temporal-polyfill` and `chrono-node` together are several times the size of the
engine, so datetime moved out rather than taxing every consumer. That split was
only possible because datetime is an ordinary plugin — which is the strongest
available evidence that the extension seam is real, and M4 is where it was
tested.

`date-holidays` is the same argument one layer further out, and an order of
magnitude louder: a 768 KB rule table that bundles to 1.43 MB, which would
otherwise be paid by everyone who types `today + 3 d`. So it does not tax
`@smartput/datetime` either — the bridge is
[a subpath, not the root entry](/guide/datetime#holidays), the package under it
takes no `@smartput` dependency, and a `check-size` row on the root fails by a
megabyte if the import ever leaks inwards.

`@smartput/datetime-range` makes the identical split for the identical reason,
so there are now two guard rows rather than one: 147,846 B for the root against
1,586,908 B for `./holiday`, measured. A package that wants
[`from today to closest holiday`](/guide/ranges#holiday-endpoints) is a
different program from one that wants `whole week`.

## Deliberately rejected

Stated so they do not creep back in.

| Rejected | Instead | Why |
| --- | --- | --- |
| Dimensional-vector algebra | Explicit `OpSignature` per derived quantity | Would be the second-largest subsystem, for quantities nobody types into a launcher. |
| Per-kind `context` declarations | `Value.meta` | A generic framework built for one consumer (dpi). |
| Weight transform callbacks and selector precedence | Plain numbers that add | Predictable under four-layer composition. |
| Custom `tiebreak` callback | `"error" \| "first"` | Weights already express every preference a callback could. |
| `Kind.facade` class override | Generated facade only | The generated surface *is* the contract. |
| `engine.with(patch)` | Call `createEngine` again | Composing frozen descriptors is already cheap. |
| A bundled FST morphology engine | `suffixStripper` / `tableAnalyzer`, and `Analyzer` being a plain function | Full morphology is a research project per language. Anything harder calls a real analyzer through the same one-line interface. |
| Hand-written plural rules | `Intl.PluralRules` | Native, complete for every CLDR locale, zero shipped data. |
| Yahoo Finance as the FX source | ECB daily reference rates, CoinGecko for crypto | No official public API; the endpoints are undocumented, cookie-gated, and redistribution breaches their terms. |

## Out of scope for v1

Variables and assignment (`x = 5kg`), multi-line notepad mode, spreadsheet
references, natural-language sentences (`"how many km in a marathon"`), LLM
fallback, historical FX by date, plural or gender agreement in output
formatting beyond what `Intl` provides, spelled decimals (`three point five`),
fractions (`half a kg`), and ordinals.

## Four standing targets

- **`@smartput/core` ships one runtime dependency.** CI fails on a second. Still
  true after M6: the lifted snapshot cache is code, not a dependency, and geo’s
  GeoNames data is vendored as generated TypeScript inside geo. Still true after
  M4.5: `@smartput/shared` is a devDependency of core, read structurally by
  `kind/from-table.ts`, because an `import type` survives into the emitted
  `.d.ts` and would have named a dependency core does not have.
- **`@smartput/shared` ships zero.** Not even `@smartput/core` — the
  dependency, and `decimal.js`’s ~30 KB, run the other way.
- **A new ratio kind is five lines**, and needs no knowledge of the solver. Still
  true after M6, and worth stating precisely, because M6 was not free for core
  (above): geo added no solver knowledge, no new `OpSymbol` and no lexer or
  parser *stage*. What it added was one gated branch inside the existing `in`
  parse, a widened `LiteralMatcher` return type, and one optional field on
  `Kind`. A kind that wants none of the three is unaffected by all three — every
  one of them is opt-in, and `datasize` is still five lines.
- **A new ratio kind reaches both doors from one table.** `units.ts` is the only
  place a ratio or an English alias is written; the descriptor derives its
  lexicon from it and the micro path reads it directly, so the two paths cannot
  drift. `kinds/src/contract.test.ts` fails if they do.
