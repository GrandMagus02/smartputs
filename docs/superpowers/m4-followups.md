# M4 deferred findings and follow-ups

Everything below was decided during M4 — the `@smartput/datetime` package and
core's literal-matcher seam — judged real, and deliberately not done in M4. Each
says why. Shipped behaviour is correct as it stands; nothing here is a defect in
what merged.

The design rulings these refer to (R1–R9) are in
`docs/superpowers/plans/2026-08-05-smartputs-m4-datetime.md`.

## Deferred by design

- **Locale-aware date formatting.** `datetime`'s formatter builds
  `YYYY-MM-DD HH:MM <zone symbol>` from Temporal fields rather than calling
  `Intl.DateTimeFormat` (ruling R7). ICU's date patterns move between runtime
  versions, and the golden corpus asserts formatted output verbatim, so an
  `Intl` formatter would make `packages/datetime/corpus/en.tsv` a test of the
  host's ICU build. M5 wants the locale-aware form; it needs a corpus strategy
  that asserts something other than the exact string first — a round-trip
  property, or a normalized comparison against `Intl` output computed in the
  test rather than pasted into the fixture.

- **Multi-word time-zone aliases.** `"new york"` cannot be an alias; `nyc` can
  (ruling R9). The alias index is keyed by one segmented word, so a multi-word
  alias needs either a multi-word index or a phrase pass ahead of resolution.
  The same gap blocks `"per cent"`, `"square metre"` and every other phrasal
  unit name, so it is one mechanism serving several kinds rather than a datetime
  feature.

- **Date completion.** `complete()` skips opaque kinds outright (ruling R8),
  because it inserts `<number><unit>` and a time zone is not that. A useful date
  completion is a different shape — completing `"tomo"` to `"tomorrow"`, or
  `"3pm in tok"` to a zone — and needs its own scorer. `scaleFit` and `typical`
  have no meaning for a zone.

- **A `DateTime` facade class.** `createFacade` throws `KindConflictError` on an
  opaque kind rather than generating a class whose every method throws, since
  `.to()`, `.scale()` and `.equals()` all read unit ratios. A datetime facade
  would need a different generated surface — `.inZone()`, `.plus(duration)` —
  which is a facade generator change, not a datetime one.

- **`chrono` locales beyond `en`.** The bridge calls `chrono.parse` with the
  English rules. M5's Ukrainian work needs `chrono.uk`, which does not exist
  upstream: the options are contributing one, writing a small rule set behind
  the same `parseDateTime` signature, or shipping datetime as English-only for
  another milestone. The seam is already right — `MatchCtx.locale` is handed to
  every matcher and nothing else in the package assumes English.

- **Slash dates (`1/15/2026`).** Refused, and deliberately: the accept-gate
  admits a letterless run only when it is ISO-shaped, because `10/2` is division
  and `1/15` is a locale-order guess (`D/M` in most of the world, `M/D` in the
  US). Supporting them means a locale-supplied date order, which is the same
  decision `Locale.numberFormat` already makes for `1,500` — so the mechanism
  exists, the vocabulary does not. `ARITHMETIC_TAIL` already cuts on `/` only
  when whitespace-delimited, so the slashes of a date would survive the cut the
  day the gate admits them.

- **Unspaced `today-1d`.** `ARITHMETIC_TAIL` cuts on `+` and `*` wherever they
  stand, but on `-` and `/` only when whitespace-delimited, because both appear
  inside dates chrono reads (`2026-03-01`, and slash dates above). So
  `today+3d` works and `today-1d` throws `UnitParseError`: chrono claims the
  whole run, the match lands mid-token, and the fold discards it — leaving a
  bare word the parser cannot read. Resolving it properly means letting a
  matcher return *several* candidate lengths rather than one, which is the
  non-destructive folding item below.

## Non-destructive literal folding

`foldLiterals` is destructive: a claimed run erases every alternative reading of
that text before the solver runs, so `10 m` can be a date **or** a length, never
both-and-let-the-solver-decide. That contradicts the engine's own principle —
ambiguity stays open until stage 5 — and it is the one place M4 broke it.

The workaround is the accept-gate (ruling R4): the chrono bridge refuses any
match whose letter runs are all registered unit aliases, so the destructive path
is only taken for text nothing else wanted. It is a heuristic standing in for a
data structure. The real fix is a token *lattice* — the fold emits an
alternative rather than a replacement, and the solver scores both — which is a
parser change large enough to be its own milestone.

Two consequences worth knowing until then:

- The gate strips regular English plural suffixes itself (`hours` → `hour`),
  duplicating the `suffixStripper` analyzer's job, because the alias index
  stores singulars and analysis happens *after* the fold. Two places now know
  English pluralization.
- The bridge cuts the input at the first whitespace-delimited operator, so
  chrono never sees `today + 5 h` as one phrase. A date syntax that legitimately
  contains a space-delimited `-` would be unreachable.

## Zone symbols come from `ZONES`, not from the registered unit

`formatDateTime` reads `ZONES[zdt.timeZoneId]?.symbol`, falling back to the IANA
id. A zone added through an `extendsKind` patch therefore formats as
`Africa/Lagos` even when its unit lexeme declares `symbol: "WAT"` — the lexeme is
indexed and resolvable, but the formatter never consults it.

Reading the symbol off the normalized unit would need `FormatCtx` to expose the
lexeme of the value's own unit, which it does not today. Until then, a caller
adding zones has to override `format` as well.

## Cosmetic and small

- `ZONES["Asia/Tokyo"]` already lists `japan`, and
  `@smartput/datetime/locale/en` contributes `japan` again. Harmless — the merge
  is idempotent — but the corpus comment on the `3pm in japan` row claims the
  word comes from the pack rather than from `ZONES`, which is now false. Either
  drop it from `ZONES` (making the pack the only source, as the comment says) or
  fix the comment.
- `docs/.vitepress/config.ts` lists `@smartput/core` and `@smartput/rates` under
  `ssr.noExternal` and `optimizeDeps.exclude`. A docs demo component that
  imports `@smartput/datetime` will fail the SSR pass until the package is added
  to both lists. No component does today, which is why the guide page carries
  tables of corpus rows rather than a live `<SpDatetime />`.
- `addDuration` converts the nanosecond branch through
  `Number(nanoseconds.toFixed(0))`, so a duration beyond ~104 days expressed in
  a non-calendar unit loses precision at the far end of the double. Unreachable
  from anything a launcher accepts, but it is the one float in the package.
- `durationValue` picks the largest unit whose magnitude reads ≥ 1, which makes
  `2026-03-01 - today` report `6.43 weeks` rather than `45 days`. Defensible, and
  the corpus pins it; a `preferredUnit` hint on the op would let a caller choose.
- The `M4` row of `docs/guide/roadmap.md`'s milestone table now says Shipped, but
  the same file's "two standing targets" section still asserts a new ratio kind
  is five lines. An opaque kind with a matcher is closer to fifty; the claim is
  about ratio kinds and remains true, and it is worth a sentence saying so.

## Added 2026-08-19 — the ordinal and calendar-interval grammars

Three shapes chrono has no rule for now run *ahead* of it in
`parseDateTime`: the ordinal weekday (`first friday next month`,
`second monday in Aug 2027`), the ordinal week (`second week Aug 2027`), and the
calendar interval (`next week`, `last month`, `this year`). The counting is
shared through `packages/datetime/src/ordinal.ts`, so `@smartput/datetime` and
`@smartput/date-range` cannot disagree about which September "of september"
means. The rulings, and what each of them defers:

- **A phrase that names an interval resolves to the interval's first day, and
  says which interval it was.** `next week` was the following Thursday under
  chrono alone. `BridgeMatch.calendarUnit` is what lets
  `@smartput/datetime-range` close the span without re-reading the words, the
  same way `hasDate`/`hasTime` split the reading between `date` and `time`.
  A consequence worth naming: those four phrases now come back with
  `hasDate: true`, so `@smartput/date` claims them where it used to decline —
  the comment in `date-range.ts` that explained the tiebreak by their
  `hasDate: false` has been rewritten rather than left to rot.

- **A week of a month is one that *starts* in it.** So the first week of August
  2027 opens on the 2nd (the 1st is a Sunday, in July's last week) and the last
  week of August 2027 closes on 5 September. Clipping either end would hand back
  three days under a word that means seven. It also makes `second week Aug 2027`
  and `second monday in Aug 2027` name the same day, which is the property the
  two grammars are built to share.

- **A month named without a year is the next one.** `parseMonthScope` is the one
  place in the package that passes `forwardDate: true`; the bridge's own parse
  stays backward-tolerant so `friday` is the nearest Friday. The asymmetry is
  deliberate and is the most revisable ruling here.

- **An occurrence a month does not have is not a date.** `fifth friday of next
  month` claims nothing rather than rolling into March or clamping to the
  fourth.

- **`last` needs a month.** `last friday` and `last week` on their own are
  chrono's and `date-range`'s respectively, and both have meant "the one just
  gone" since M4. Only `last friday of August` counts backwards from a month.

Deferred, and each says why:

- **The week starts on Monday, and only here.** `@smartput/range-core` carries
  the `weekStart` dial and `@smartput/date-range` passes it through to its own
  copy of the count. This package sits below range-core and cannot import it,
  and `parseDateTime` is a free function four packages call, so the dial would
  have to be threaded through all of them. Monday is `DEFAULT_WEEK_START` over
  there, so the two agree until an embedder changes it — at which point
  `next week` and `second week Aug 2027` snap to Monday while `date-range`'s
  phrase table snaps to Sunday. The real fix is a `SnapOptions` on `MatchCtx`,
  which is the same widening the chrono-locale entry above wants.

- **`whole week`, `whole month`, `whole day`, `one year`.** These were never
  chrono phrases; they are `@smartput/date-range`'s own table. The bridge does
  not read them, so `@smartput/datetime-range` does not either — the one place
  the two range packages do not support the same strings.

- **English, and more sharply than chrono is.** The ordinals, the weekday
  names, the connectors `of` and `in`, and the interval words are all spelled in
  `ordinal.ts` and `calendar-phrase.ts`. `MatchCtx` carries a locale name and a
  unit-alias predicate, not the locale's word tables, which is the same gap
  `OPERATOR_TAIL` and `PLURAL_SUFFIXES` already sit in.

- **`next day` is not an interval.** It reads as tomorrow through chrono and
  `datetime-range`'s tests pin it as a plain instant; adding a `day` row to the
  interval table would turn it into a span for no gain, since `tomorrow` says
  the same thing and `whole day` is `date-range`'s.

- **The datetime-range calendar span is weighted to lose.**
  `DEFAULT_CALENDAR_SPAN_WEIGHT` is +4 against `@smartput/date-range`'s +5, so
  an engine carrying both answers `next week` with `2026-01-19 → 2026-01-25`
  rather than with two midnights. The number is restated in
  `calendar-span.test.ts` rather than imported: reaching for the constant would
  make a devDependency cycle between the two range packages out of a one-number
  fact. Those rows are therefore absent from
  `packages/datetime-range/corpus/en.tsv` — `@smartput/geo`'s ambiguity suite
  replays every row of that file against an engine that has both kinds, and a
  corpus row is a claim about what a user gets.
