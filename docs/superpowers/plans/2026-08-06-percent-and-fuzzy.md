# Percent conversion, `off`, and the fuzzy weight layer

Two features that the engine turned out to be most of the way to already. What
follows is the remainder, and the reasons the remainder is where it is.

## What already ships

Established by probing the built engine, not by reading:

- `20% of 50` → `10`, `50 kg + 10%` → `55 kg`, `50 kg - 10%` → `45 kg`.
  `generateRatioOps` emits `+|K|percent`, `-|K|percent` and `of|percent|K` for
  every non-affine ratio kind; `percent` declares the three `number` cases
  itself, because the generation loop excludes `number` by design.
- `20% * 50` → `1,000%`, and that is correct. `ratio-ops.ts` gives `percent` the
  number-scaling trio deliberately so that `20% * 3` is `60%`, matching the
  facade's `Percent.scale(3)`. `*` scales a percentage, `of` applies one. Not
  touched by this plan.
- `Resolver.nearest()` exists in `parse/candidates.ts` — plain Levenshtein,
  distance ≤ 2, top three — and feeds exactly one consumer: the
  `NoCandidateError` message. `1 klogram` throws with `Did you mean: kilogram?`
  and `complete("1 klogram")` returns `[]`.

## Task 1 — `in` between `number` and `percent`

`0.1 in %` throws `Cannot apply operation to number and percent`. Percent's
canonical storage *is* the plain 0–1 ratio, so the conversion is identity plus a
change of kind; the signature is missing, nothing else.

Neither `in|number|percent` nor `in|percent|number` is claimed — `number`
generates only `in|number|number`, `percent` only `in|percent|percent` — so both
belong in `packages/percent/src/index.ts` and core does not change.

- `in|number|percent → percent`, `apply: (l, r) => deriveValue(r, l.canonical)`
- `in|percent|number → number`, `apply: (l, r) => deriveValue(r, l.canonical)`

`deriveValue`'s `source` argument is the operand whose `meta` and `unit` the
result should carry, which here is the right-hand conversion target in both
directions.

What this unlocks is the reading the engine had no route to: `5 / 50 in %` →
`10%`. `as` is already an `in` keyword in the `en` locale, so `5 / 50 as %`
lexes the same way for free.

**Tests** (`packages/percent/src/index.test.ts`): `0.1 in %` is `20%`'s
canonical sibling — assert canonical `0.1` and kind `percent`; `20% in number`
is canonical `0.2`, kind `number`; `5 / 50 in %` end-to-end through
`createEngine`; round trip `0.1 in % in number` returns `0.1`.

## Task 2 — the `off` operator

`20% off 50` is `40`: the percentage is on the left, the base on the right, and
the result is the base reduced. It is `of`'s shape with a different arithmetic,
and it is not an alias for `-` — `50 - 20%` puts the same operands the other way
round.

Blast radius, all of it forced by `off` being a new operator rather than a new
signature:

1. `types.ts` — `OpSymbol` gains `"off"`, `Keyword` gains `"off"`.
2. `locale/en.ts` — `keywords.off: ["off"]`.
3. `parse/pratt.ts` — `BINDING.off = 15`, the same as `of`, and a branch beside
   the existing `of` keyword branch at the infix site. `off` is consumed as a
   keyword there rather than folded in `wordops.ts`, because `wordops` rewrites
   a keyword into an existing arithmetic op token and `off` has no arithmetic op
   to become.
4. `kind/ratio-ops.ts` — `off|percent|K → K` generated alongside `of|percent|K`,
   `apply: (l, r) => deriveValue(r, r.canonical.times(new Decimal(1).minus(l.canonical)))`.
5. `packages/percent/src/index.ts` — `off|percent|number`, same arithmetic, for
   the same reason the kind declares its own `of|percent|number`.

The affine branch of `generateRatioOps` closes every non-same-kind key that
`ordinaryOps` produces, so `off` is refused on temperature automatically. That
is the branch working as designed and needs no change — but it does need a test,
because it is the kind of thing that silently stops holding.

**Tests**: `20% off 50` → `40`; `20% off 50 kg` → `40 kg`; `15% off 200` → `170`;
precedence, `10 + 20% off 50` → `50`, which is `10 + (20% off 50)`; refusal,
`20% off 20 C` throws `DimensionMismatchError`. Plus a `wordops` test that a
stray `off` with no percentage on its left fails at the parser the way a stray
`as` does.

## Task 3 — one edit distance, in `@smartput/core`

There are two implementations. `packages/math/src/words/fuzzy.ts` has weighted
optimal string alignment: transposition costs one slip rather than two, the four
slip classes are priced apart so the commonest wins a tie instead of being
refused, and two equally-near candidates return `null` rather than a guess.
`parse/candidates.ts` has plain Levenshtein, which charges `kilogrma` two edits
for what is one transposition — the commonest typo class there is.

The home is `packages/core/src/parse/distance.ts`, exported from
`@smartput/core`, and `math` imports it from there. `math` already lists
`@smartput/core` in its `dependencies`, so this adds no edge to the graph and
`check-deps.ts`'s table does not change.

Not `@smartput/shared`, which was the obvious-looking home and is the wrong one:
`shared` is a *devDependency* of core, read structurally by
`kind/from-table.ts`, precisely so that no emitted `.d.ts` names it. Importing a
*value* from it would reverse the M4.5 arrow and retire the standing target that
`shared` ships zero dependencies and core ships one.

Delete `packages/math/src/words/fuzzy.ts` and the private `editDistance` in
`parse/candidates.ts`. There must be exactly one implementation when the task is
done.

**Tests**: the existing `math/src/words/words.test.ts` must stay green
unchanged — that is the regression proof for the move. Add, at the new home:
transposition costs one (`kilogrma` → `kilogram` at distance ≈ 1), a tie returns
`null`, a single-character word returns `null`, and the cap short-circuits.

## Task 4 — near-misses become weighted candidates

Today a misspelling is an error with a hint attached. It should be a reading
with a penalty attached, and the penalty should be visible in `explain()` like
every other term.

In `createResolver`'s `resolve(surface)`: when the analyzer chain produces no
alias-index hit for any analyzed form, run one fuzzy pass over the alias index.
Each survivor becomes an ordinary `Candidate`, weighted through `resolveWeight`
exactly as an exact match is, plus a contribution of `-TYPO_PENALTY × distance`
carried under the selector `fuzzy:<alias>`.

Three constraints, each of which is the whole point of the design:

- **The fuzzy pass only runs when the exact pass found nothing.** A typo can
  never outrank a real reading, and every existing test keeps passing without
  being touched. If a test does need touching, the constraint has been broken.
- **A tie still refuses.** `nearestWord` returns `null` for two equally-near
  candidates, and that must survive to the caller as today's
  `NoCandidateError` with its `nearest` hint intact.
- **The contribution is a term, not a multiplier.** `weightBreakdown` returns
  contributions that sum; a fuzzy candidate has one more row than an exact one
  and nothing else about it differs.

`TYPO_PENALTY` is large enough that a corrected reading's confidence is visibly
below an exact one's and small enough that a lone corrected reading still wins
against nothing. Pick it against the softmax in `solver.ts`, and write the
number down beside the constant with the reasoning, in the style of
`EXACT_BONUS` and friends in `complete/score.ts`.

**Tests**: `1 klogram` evaluates to `1 kg` with confidence strictly below
`1 kilogram`'s; `explain()` on it contains a `fuzzy:kilogram` contribution;
`1 kgg` — which today suggests `kg, deg, g` — still throws, because three
candidates at the same distance is a guess; an exact match anywhere in the
input suppresses the fuzzy pass for that token.

## Task 5 — completion reads through a typo

`complete("1 klogram")` returns `[]` because the fragment matcher is
prefix-only. It should return the `kilogram` rewrite, scored below what an exact
prefix would have earned.

Same fallback rule as Task 4: only when the prefix pass is empty. Add a
`TYPO_PENALTY` to `complete/score.ts` beside `EXACT_BONUS`, `LENGTH_PENALTY` and
`SCALE_BONUS`, and let it flow through the existing sum.

**The perf gate is part of the task, not an afterthought.** `nearest()` scans
the entire alias index, which is acceptable once on an error path and not
acceptable once per keystroke. The fuzzy pass runs over the global alias index
only — never over a `Kind.completions` vocabulary, which is where the 6,247 city
names live — and it runs once per unknown fragment, not once per candidate.
Assert the boundary with a test that a kind supplying `completions` is not
consulted by the fuzzy path.

**Tests**: `complete("1 klogram")` yields the `1 kilogram` rewrite; its score is
below `complete("1 kilogr")`'s; `complete("1 kilogram")` is unchanged by the
feature; a completions-supplying kind is not consulted.

## Task 6 — integration

`bun run check` green end to end: `lint`, `typecheck`, `check-deps`, `bun test`,
`build`, `check-size`.

`check-size` budgets are two-sided — a row that drops 30% below its ceiling
fails as loudly as one that exceeds it — so any entry these tasks move must be
re-measured and its pair amended, with the new numbers written into the table
rather than the band being widened. Both features add bytes to core; expect at
least the core entry to move.

Docs owed: `docs/guide/weights.md` gains the fuzzy layer, `docs/guide/completion.md`
gains the typo fallback, and the roadmap's percent row gains `in` and `off`.
