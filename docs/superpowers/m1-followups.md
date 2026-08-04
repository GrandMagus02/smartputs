# M1 follow-ups

Carried out of the M1 implementation run (branch `feat/m1-engine`, 37 commits,
197 tests). Everything here was found by a per-task or whole-branch review,
triaged, and deliberately deferred — none of it blocks M1.

The M1 plan is `plans/2026-08-04-smartputs-m1-engine.md`; the spec it implements
is `specs/2026-08-04-smartputs-design.md`.

## Both open rulings are now decided

**Analyzer case-sensitivity — deferred to M5, deliberately.** `10 KG` works and
`1.5 kilograms` works, but `1.5 KILOGRAMS` throws `NoCandidateError`:
`KILOGRAMS` is only reachable through the English `suffixStripper`, analyzers
receive the raw surface, and `parse/candidates.ts` folds only *after* analysis.

The structural sibling of the keyword-folding defect fixed at the end of M1, but
not a one-liner — whether `Analyzer` receives folded or raw input is a contract
decision, and some morphologies are case-informative (German capitalises nouns,
Turkish has dotted/dotless I). Ruled: decide it when `@smartput/locale-uk` lands
and there is a real case-informative morphology to design against, then encode
the answer in `assertLocaleContract`. **All-caps unit words stay broken through
M2–M4.** That is an accepted, known gap, not an oversight.

**Registration stays explicit — spec amended.** `createEngine({ locales: [en] })`
registers no kinds, and `evaluate("10 kg")` against it raises
`NoCandidateError`; callers pass `BUILTIN_KINDS` for the standard set. Spec §6
previously annotated `kinds?: Kind[]` as "appended to built-ins", implying
auto-registration the implementation never did. Ruled in favour of the
implementation: the annotation now reads "the ENTIRE registry — nothing is
implicit", with a paragraph stating the trade-off (a launcher can register two
kinds and tree-shake the rest; the cost is that omitting `number` silently
disables digit grouping).

## Closed in M2

- **`Value` was shallow-frozen** while descriptors were deep-frozen. Fixed by
  `deepFreeze`ing every `Value` `evaluateNode` constructs, so `Value.meta` —
  M2's dpi carrier — is frozen too. `8c7ecd3`.
- **`UnknownKindError.kind` held a composite `"kindId:unit"` string** in the
  unregistered-unit branch. `UnknownKindError` now takes an explicit `unit`
  parameter, keeping `kind: KindId` true to its type. `8c7ecd3`.
- **`DimensionMismatchError` reported operands in traversal order.** The
  solver's no-viable-assignment path now sorts candidate slots by source
  position before naming the first and second operand (`8c7ecd3`); a
  convert-node's own span tied with its operand's, so a residual reversal
  there was fixed by giving `ConvertNode` the target unit token's span and
  sorting convert slots by it (`8df1bae`).
- **`en.ts` declared `plus`, `minus`, `of` keywords the parser never
  handled.** `of` is now implemented (M2's percent `of` operator); `plus` and
  `minus` remain unimplemented and were dropped. `8c7ecd3`.
- **`en.ts`'s `tableAnalyzer({ feet: "foot", inches: "inch" })` was
  redundant** — removed. `8c7ecd3`.
- **`engine.ts` hardcoded `"number"`** instead of the `NUMBER_KIND` constant
  every other module imports — `coerce` now imports and uses it. `8c7ecd3`.
- **`nearest()` was untested** for exact-match exclusion, the 3-result cap,
  and distance-then-alphabetical ordering — covered by a new
  `parse/candidates.test.ts` test. `8c7ecd3`.

## Correctness, deferred

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
