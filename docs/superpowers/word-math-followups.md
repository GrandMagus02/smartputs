# Word math follow-ups

Deferred from the final whole-branch review of `feat/word-math`. The review
verdict was *ready to merge*; everything here is polish or a guard for future
work, not a defect in shipped behaviour.

## Completion's hyphen rule disagrees with the fold's

`complete/fragment.ts` splits on `/[\s-]+/`, so every hyphen is a separator
regardless of adjacency. `foldNumerals` absorbs a hyphen only when the tokens
either side are adjacent in the source. So `"twenty - two k"` feeds `scaleFit`
a count of 22 while the same expression evaluates to 18.

Only the ranking signal is affected, and both readings land in the same
magnitude band today, so nothing is observable. The two rules should still
agree. Either reuse the adjacency test or split on whitespace alone and let the
hyphen case fall through unchanged.

## The keyword/alias collision rule is documented but not enforced

Listing a word under `Locale.keywords` removes it from the unit-alias namespace,
because `keywordFor` runs before candidate resolution. `api/define-locale.md`
and `types.ts` say so. Nothing checks it.

A kind that registers `over` or `by` as an alias gets a silently unreachable
alias and no error. `createResolver` already holds both the registry alias index
and the locale, so a dev-time check there would make the documented constraint
self-enforcing.

Checked at merge time: zero collisions across every shipped lexicon and
`@smartput/rates`'s currency table and locale pack, including `quid`,
`sterling`, `buck`/`bucks`, `euros` and the ISO names. This is a guard for
future authors, not a live bug.

## `cardinalNumerals` skips consecutive connectors

`["five","and","and","five"]` parses as 10 with `consumed: 4`. Internally
consistent — the fold's bounds hold and the emitted span covers exactly those
four words — and it takes a doubled connector to reach. Worth one test line
asserting whichever behaviour is wanted, next time the file is touched.

## `Explanation.tokens` carries a normalized `text`

A folded numeral token's `text` is the claimed words joined by single spaces, so
`explain("twenty-two km")` reports `text: "twenty two"` against span `0..10` — a
`text` that is not the substring its own span points at. The span is
authoritative and error underlining is unaffected, and the comment in
`parse/numerals.ts` now says so. Slicing the source instead would mean threading
the input into the pass.
