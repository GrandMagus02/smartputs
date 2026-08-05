# M3 deferred findings and follow-ups

Everything below was found during M3 execution or its reviews, judged real, and
deliberately not fixed in M3. Each says why. The M3 ledger and per-task reports
lived in a git-ignored scratch directory and are gone; this file is the durable
record.

Five defects in the M3 plan itself were found and corrected during execution —
three in plan self-review before dispatch, two by implementers who stopped rather
than edit a failing expectation. Those are closed; the reasoning is in the commit
history of `worktree-m3-money`. This file lists only what remains open.

## Correctness

- **`Quantity.combine()` cross-converts silently.** `packages/core/src/facade/quantity.ts`
  does canonical arithmetic directly rather than through op signatures, so
  `new Money(30, "usd").add(gbpQuantity)` derives a USD/GBP rate via the base and
  records nothing. The engine path discloses this correctly; the facade cannot,
  because `Quantity` has no assumption channel at all. That is a design gap, not
  an oversight — giving the facade one is M4-sized work.

- **The money guard trim rounds above 26 significant digits.** `money.ts` guards
  `ctx.authored` to `DISPLAY_PRECISION` before applying the minor-unit rounding
  mode, which absorbs the rate round trip's ulp noise but also zeroes the cents
  column at 10^26 and beyond. It aligns money with the policy every other kind
  already follows and is unreachable at realistic amounts. Note that
  `packages/rates/src/properties.test.ts`'s 28-digit canary samples only assert
  "no exponential notation", so the loss passes unnoticed there.

- **Currency symbols are input-hostile, and the failure is silent.** `evaluate("$30.00")`
  returns `number` 30 — not an error, a different kind. Core's lexer allowlist
  (`UNIT_SYMBOLS`) contains only `%`, so a leading `$` is skipped and the rest
  parses as a bare number. `Money.parse(new Money(30, "usd").toString())` throws.
  Spec §10's `parse(format(v))` property iterates only core's `BUILTIN_KINDS`, so
  it covers `money` not at all; the known failure is pinned explicitly in
  `packages/rates/src/properties.test.ts` instead. Fixing it means teaching the
  lexer prefix symbols, which has its own ambiguity questions — `$` precedes the
  number rather than following it.

- **`KindConflictError` and `UnknownKindError` in `suggest`'s `NEVER_SWALLOWED`
  list are inert.** Both are thrown only from `buildRegistry`/`createFacade`, at
  engine construction, outside `suggest`'s try. Their entries are a rule
  statement rather than a behaviour, and nothing tests them. `MissingRateError`,
  the reason the list exists, is live and covered.

## Conventions the next package should inherit deliberately

`packages/rates` is the rehearsal for M4's datetime and M5's colour packages.
These were fixed during M3's final review, and are recorded so M4 starts from the
corrected shape rather than rediscovering them:

- Every package's errors extend `SmartputError` with `this.name` set to a string
  literal. `@smartput/rates` initially threw bare `Error` at five sites, which
  would have made `instanceof SmartputError` — the discriminator the engine
  itself relies on — miss every provider and live-engine failure.
- `scripts/check-deps.ts` globs `packages/*/package.json` and **fails closed** on
  a package with no `ALLOWED` entry. It previously hardcoded a map, so a new
  package would have passed CI with any dependency at all.
- No file outside `packages/core/src/decimal.ts` may import `decimal.js`
  directly; a Biome `noRestrictedImports` rule enforces it. Core configures
  `Decimal.set({ precision: 28 })` as a module-load side effect, and a raw import
  silently runs at ~20 digits with no error.
- A unit lexeme carries `aliases`, `symbol`, `display` and `typical`. `typical`
  feeds the `complete()` scorer; omitting it makes every unit tie at zero on
  `scaleFit`. And **every `display` word must be a single token that resolves
  back to its own unit** — `complete()` uses it as insert text, so a display form
  the lexer cannot parse breaks the complete→evaluate contract.

## Tooling

- **`bun run check` does not typecheck the docs app.** `typecheck` covers
  `packages/*/tsconfig.json` only; the VitePress/Vue site has no typecheck script.
  M3 nearly shipped `[object Object]` into `SpResult.vue` when
  `Result.meta.assumptions` changed from `string[]` to `Assumption[]`; only a
  manual `vitepress build` caught it. The same shape will recur in M4 and M5. Add
  `vue-tsc --noEmit` to the `check` script.

- **The ECB regex is pinned only by a fixture we wrote.** If the ECB changes its
  format, the fixture keeps passing while production fails. A periodic live smoke
  test outside the unit suite would close that; it belongs with M6's release
  tooling.

## Cosmetic

- `eval/evaluate.ts`'s assumption dedup key is `JSON.stringify([code, message,
  detail ?? null])`, which is sensitive to `detail`'s key insertion order. No
  current call site can trigger it — every `detail` is built from a literal — but
  a sorted-key form would be more robust.
- `money.ts` passes `precision: 34` to `ctx.formatNumber` to mean "do not
  guard-round, I already rounded". The number is magic; an explicit
  no-rounding path would read better.
- When no rate table is configured at all, `MissingRateError`'s message reads
  `No rate for USD->EUR in the snapshot as of ` — trailing space, empty date.
  "No rate table was supplied" is a different and more actionable condition.
- `packages/rates/package.json` declares `decimal.js`, which the Biome rule
  forbids the package from importing. A dependency it can never use directly.
- `snapshot()` lets a caller's table overwrite the base's implicit `1`
  (`snapshot("EUR", d, { EUR: 2 })` mis-rates everything), and a zero quote makes
  `get` throw a raw `DecimalError`. Both are reachable through a `custom()`
  provider.
- `format.ts`'s pre-bound `formatNumber` is `(v, o) => formatNumber(v, locale, o ?? opts)`,
  so a hook passing *any* option discards the engine's `precision` and `rounding`
  rather than merging. Money gets away with it by re-deriving `rounding` from
  `ctx`; a future hook will not.
- `engine.test.ts` defines the same 30-line `treasure` kind twice, verbatim, in
  adjacent tests.
- `live.ts` throws on a failed *refresh* even when a usable, slightly-stale
  snapshot is in hand. For a keystroke-rate UI, degrading with a stale
  `ratesAsOf` is probably the better default.
- `docs/guide/getting-started.md` still says `suggest()` "never throws" flat,
  where `docs/api/engine.md` and `docs/guide/errors.md` correctly scope it to
  parse problems.
- `docs/guide/roadmap.md` still lists M3 as "Planned".
