# M2 deferred findings and follow-ups

Everything below was found during M2 execution or its reviews, judged real, and
deliberately not fixed in M2. Each says why. The M2 ledger and per-task reports
that produced these lived in a git-ignored scratch directory and are gone; this
file is the durable record.

Thirteen defects in the M2 plan itself were found and adjudicated during
execution. Those are closed — the rulings are recorded in the commit history of
`worktree-m2-kinds`. This file lists only what remains open.

## Closed in M3

### No display-precision policy

Closed by commit `05f3db7` ("feat(core): round formatted output at two guard
digits"), M3 Task 1. Formatted output now rounds at 26 significant digits —
two guard digits below the 28 Decimal computes at — instead of rendering the
exact authored value, which is what surfaced artifacts like
`0.4999999999999999999999999998turn`. The corpus rows that asserted full
28-digit precision were updated in the same commit to the new rounded values.

## Blocking before any published release

_(nothing currently listed)_

## Correctness and API

- **`suggest()` returns `[]` where `evaluate()` answers.** A refusing signature
  throws inside `engine.ts:158`'s map and `engine.ts:163` swallows it. Example:
  `(30 C - 20 C) + 20%` evaluates to `tempdelta 12°C` but suggests nothing. The
  class predates M2 (`(30 C - 20 C) * 2` behaved this way as soon as refusing
  signatures existed); M2 widened it from `*`/`/` to `+ percent`, `- percent`
  and `of`. The real fix is per-assignment error isolation in `suggest`.

- **Dimension-mismatch messages name the wrong pair for 3+ operands.**
  `solve/solver.ts`'s `reportedOperands` reports the first two operands in source
  order, so `2 * 10 km + 5 h` says "number and length" — a legal pair — rather
  than the actual conflict, "length and duration". Two-operand cases are all
  correct. The "first two operands" heuristic is pre-existing; M2 only made
  bare numeric literals visible to it.

- **A unit key can be shadowed by another unit's alias within the same kind.**
  The facade's `parse` seeds its lookup from the alias index before the unit
  keys and is first-wins, so a third-party kind that aliases `"m"` onto unit
  `min` while also keying a unit `"m"` would resolve `parse("5m")` to `min`. No
  built-in kind has such a collision, but nothing structurally prevents it.

- **`measure` handles bad dpi silently.** A non-number `dpi` in `meta` falls back
  to 96 without complaint, and `withDpi(0)` yields an infinite ratio.

- **`Quantity.scale` multiplies the authored value** while `add`/`sub` go through
  canonical. Equivalent for offset-free ratio units, divergent the moment one
  isn't — and an affine kind has no `scale`, so this is latent rather than live.

- **`lex.ts`'s `keywordFor` casts to `Keyword` unchecked.** M2 narrowed `Keyword`
  to `"in" | "of"`, and that narrowing is enforced only at the type level. A JS
  consumer, or a locale built through `as`, declaring `keywords: { to: [...] }`
  now produces a keyword token the parser silently drops. Worth a runtime guard.

- **`50 * 20%` answers `1,000%`.** Numerically correct — 1000% is the ratio 10 —
  and a direct consequence of the `*|number|percent` signature. Whether a user
  reads that expression as "10" instead is a spec question for M3.

## Scope decisions, recorded so they are not mistaken for oversights

- **`measure` is excluded from `BUILTIN_KINDS` permanently.** Its `mm`/`cm`
  aliases collide with `length`'s, so `10 cm` becomes genuinely ambiguous for
  every consumer once both are registered. Callers opt in; `measure` is exported
  by name from the package root. Worth revisiting when the launcher use case is
  real.

- **Analyzer case-folding stays deferred to M5**, by the ruling recorded in M1.
  `1.5 KILOGRAMS` still throws. That is intended.

- **Locale packs do not reach facade `parse`'s analyzer chain.** Pack-contributed
  *aliases* do arrive, via the registry's alias index; pack *analyzers* would
  need a public signature change on `createFacades`.

- **`volume`'s canonical unit is `l`,** which forces a `×1000` factor into both
  of its `apply` bodies — the factor the plan originally applied in the wrong
  direction. Declaring `canonical: "m3"` with `l: 0.001` would remove the factor,
  the duplication and the sign trap, at the cost of churning test expectations
  that were already corrected once during M2.

- **Currency symbols are output-only.** `$30` does not parse: core's lexer
  allowlist (`UNIT_SYMBOLS`) contains only `%`, so a leading `$` is skipped.
  Adding currency symbols to the allowlist is a lexer change with its own
  ambiguity questions — `$` prefixes the number rather than following it — and
  belongs in its own task.

- **`money` is not in any default kind set.** It lives in `@smartput/rates` and
  callers pass it explicitly, like every other kind.

## Test gaps

- Assumption dedup and multi-op ordering in `eval/evaluate.ts` are asserted in
  code but never exercised by a test with two ops, or two ops sharing an
  assumption string.
- No corpus row for `volume` — the one piece of arithmetic the plan got
  backwards — nor for `% of <quantity>`. A `measure` row is structurally
  impossible while it stays out of `BUILTIN_KINDS`.
- `QuantityClass.kindId` and the generated class `name` have no direct
  assertions.
- The property-tolerance falsification injected a 1e-15 error against a 1e-25
  threshold. It proves the tests are not vacuous but does not probe tightness
  near the ulp floor.

## Cosmetic

- `eval/evaluate.ts` duplicates the `...(meta ? { meta } : {})` spread at two
  sites.
- `facade/quantity.ts`'s `this.meta as Record<string, unknown>` casts are not
  load-bearing; the type is assignable without them. Mirrors an existing
  convention in `format/format.ts`.
- `facade/quantity.ts`'s comment claims the alias index "iterates in sorted
  order"; it iterates in insertion order, which is derived from sorted kind ids
  and sorted unit names. Deterministic either way, but the stated reason is
  imprecise.
- `properties.test.ts`'s tolerance comment says "~1e-28 relative" where the
  ruling text said "~1e-27". One ulp at 28 significant digits is ~5e-28; neither
  figure affects the chosen 1e-25 threshold's headroom.
- `angle.test.ts`'s gradian comment attributes the precision artifact to the
  π/200 ratio alone; `200 grad in deg` actually composes two irrational
  divisions.
- `kinds/derived.ts` still has two byte-identical volume `apply` bodies, one per
  operand order.
- `facade/quantity.ts`'s `parse` advances past a leading `+` that `parseNumber`
  then rejects. Dead code.
