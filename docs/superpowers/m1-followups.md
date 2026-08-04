# M1 follow-ups

Carried out of the M1 implementation run (branch `feat/m1-engine`, 37 commits,
197 tests). Everything here was found by a per-task or whole-branch review,
triaged, and deliberately deferred — none of it blocks M1.

The M1 plan is `plans/2026-08-04-smartputs-m1-engine.md`; the spec it implements
is `specs/2026-08-04-smartputs-design.md`.

## Needs a ruling before M2 builds on it

**The analyzer chain is case-sensitive.** `10 KG` works and `1.5 kilograms`
works, but `1.5 KILOGRAMS` throws `NoCandidateError`. `KILOGRAMS` is only
reachable through the English `suffixStripper`, analyzers receive the raw
surface, and `parse/candidates.ts` folds only *after* analysis.

This is the structural sibling of the keyword-folding defect fixed in the final
wave, but it is not a one-liner: whether `Analyzer` receives folded or raw input
is a contract decision. Some morphologies are case-informative — German nouns
capitalise, Turkish has dotted/dotless I — so folding before analysis is not
obviously right. Decide this when `@smartput/locale-uk` lands (spec §4.6, M5),
and put the answer in `assertLocaleContract`.

**`createEngine({ locales: [en] })` registers no kinds.** `evaluate("10 kg")`
throws `NoCandidateError` unless the caller passes `kinds: BUILTIN_KINDS`
explicitly. Spec §6 annotates `kinds?: Kind[]` as "appended to built-ins", which
reads as auto-registration; the plan mandated the explicit form everywhere and
the implementation followed it. Spec and plan diverge — pick one. This is also
the first thing a new user will hit, and a consumer who omits the `number` kind
silently loses digit grouping.

## Correctness, deferred

- **`Value` is shallow-frozen** while descriptors are deep-frozen (spec §8
  groups them). `Value.meta` — M2's dpi carrier — would be mutable.
- **`UnknownKindError.kind` holds a composite `"kindId:unit"` string** in the
  unregistered-unit branch, breaking its documented `kind: KindId` type.
- **`DimensionMismatchError` reports operands in traversal order**, so
  `10 km in kg` reads "Cannot apply operation to mass and length" — reversed.
  The plan accepted an imprecise message; the reversal makes it misleading.
- **Two `extendsKind` patches targeting the same base with colliding op
  signatures** still silently last-write-wins. Independent kinds now throw
  `KindConflictError`; patches do not, because owner tracking runs downstream of
  the merge. Consistent with the spec's "patch wins on key collision" rule, but
  worth a second look once third-party packs are normal (M5).
- **`locale.analyze ?? [identity()]` falls back only on `undefined`.** An
  explicit `analyze: []` yields zero analyzers, so every unit becomes
  `NoCandidateError`. Arguably correct — `[]` may genuinely mean "none" — but it
  should be a documented contract, checked by `assertLocaleContract`.

## API surface, deferred

- **`Candidate` carries `analyzerWeight`**, solver bookkeeping now visible
  through the public `Explanation.candidates`. The alternative — a separate
  internal type between `candidates.ts` and `explain()` — was judged not worth
  the indirection while nothing consumes `Candidate` externally. Revisit before
  the first published release.
- **`en.ts` declares `plus`, `minus`, `of` keywords the parser never handles.**
  `10 kg plus 5 kg` throws `UnitParseError`; without the declaration the user
  would get the more useful `NoCandidateError: Unknown unit "plus". Did you
  mean…`. Drop them until M2 implements the ops.
- **`en.ts`'s `tableAnalyzer({ feet: "foot", inches: "inch" })` is redundant** —
  `feet` is already a direct alias and `suffixStripper` already derives `inch`
  from `inches`. It only nudges the weight from -2 to -1.
- **`engine.ts` hardcodes `"number"`** instead of the `NUMBER_KIND` constant
  every other module imports.

## Tooling, M6

- **`bun run lint` cannot fail.** `biome check .` reports recommended-rule
  violations as warnings and exits 0 — confirmed with an unused variable. Add
  `--error-on-warnings` or the whole recommended set is advisory.
- **No script emits `.d.ts`.** The plan's Global Constraints require
  `tsc --emitDeclarationOnly`; `typecheck` runs `--noEmit` and nothing else
  builds. `package.json` exports point at raw `./src/*.ts` with no `types`
  field.
- **`scripts/check-deps.ts` is outside every tsconfig include glob**, so it is
  never type-checked.
- **The analyzer memo cache is unbounded** per closure lifetime. Only matters
  behind a long-running `@smartput/http` process.

## Test-rigor gaps

- **No error message is asserted verbatim.** Spec §10 calls error messages
  user-facing and requires snapshots; only `toContain` is used today. These
  strings are API.
- **The `extendsKind`-patch-override test asserts only `.not.toThrow()`**, so it
  would not catch a regression that flipped merge order and let the base's
  generated op win. The mechanism was verified by hand-trace instead.
- **`nearest()` is untested** for exact-match exclusion, the 3-result cap, and
  distance-then-alphabetical ordering.
- **The determinism test compares only `.kind`** across runs, not score,
  confidence or units.
- **`opts.kinds` filtering is untested against a binary node** where filtering
  removes the only surviving branch.
- **Four `DimensionMismatchError` branches in `evaluate.ts` are unexercised.**
  Three are unreachable given a well-formed assignment.

## A note on this plan's failure mode

Nine defects were caught during the run by implementers who stopped rather than
edit a failing expectation. Every one was in a *test fixture or expected value*,
not in implementation code: a digit count off by one, invisible U+00A0/U+202F
characters retyped as ASCII, a JS float where a Decimal was needed, an assertion
that could not fail, mutually contradictory format fixtures, and corpus rows
that ignored grouping.

Fixtures are the part of a plan that looks obviously correct on reading and is
never executed until an implementer runs it. When writing M2's plan, compute
expected values rather than reasoning them out, and prefer explicit `\u` escapes
over literal invisible characters.
