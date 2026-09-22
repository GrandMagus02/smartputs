# Code practices

`CONTRIBUTION.md` says how a change gets in. This file says what the code inside a
package should look like once it is there, and it is the brief a reviewer — human or
agent — reads before touching a package.

Two things it is not. It is not a style guide: formatting is Biome and nothing here
repeats it. And it is not a licence to churn. This codebase is mostly finished work,
written with the reasoning attached; a refactor that trades a documented decision for
a prettier shape is a regression with a clean diff.

## 0. The bar

A change to existing code has to be one of these, and the pull request has to say
which:

| | What it means | How it is shown |
| --- | --- | --- |
| **Correct** | Current code is wrong for an input a person would type. | A failing test first, then the fix. |
| **Smaller** | Fewer bytes a consumer pays for. | A moved row in `check-size.ts`, measured. |
| **Faster** | Less work on a path that runs per keystroke. | A before/after number, not an argument. |
| **Simpler** | Fewer concepts for the same behaviour, tests unchanged. | The diff deletes more than it adds. |
| **Safer** | A type or a freeze closes a hole that was reachable. | The hole, named. |

Anything that is none of these — renames for taste, a helper that saves three lines in
one file, a pattern imported from another codebase — is declined. "It reads better to
me" is not one of the five.

## 1. Invariants

These hold everywhere. A change that breaks one is wrong even when it is smaller,
faster and simpler.

- **Core learns no domain.** No metre, no dollar, no city in `packages/core`. A
  capability is a kind package; what core gains is a seam any plugin can use.
- **Kind packages do not import each other.** Agreement between two kinds is
  structural, off `Value.meta`. The shape is the contract.
- **One runtime dependency per package**, registered in `scripts/check-deps.ts`.
- **Never import `decimal.js` directly.** `Decimal` comes from `@smartput/kind`, or
  `./decimal` inside that package. A raw import runs at ~20 digits and is silently
  wrong.
- **No `any`.** `noExplicitAny` is an error, and `as unknown as` is a seam, not a
  tool — see §5.
- **Frozen and pure.** Descriptors are frozen, public output is deep-frozen, and there
  is no module state outside `decimal.ts`. No registry that mutates, no cache keyed on
  a global.
- **Words live outside the kind.** A kind holds mechanics and physics; a vocabulary
  holds words and names its kind by id string.
- **Ambiguity is data.** Weight a reading down, never delete it. No code picks a
  winner silently.
- **Measured, not estimated.** Byte budgets come from a real minified bundle, parity
  fixtures are recorded output, docs tables are read from source.

## 2. The shape of a package

A kind package is five kinds of file and nothing else:

```
src/units.ts        the UnitTable: canonical, ratio, offset?, alias. Data only.
src/index.ts        defineKind(...) — the engine-tier descriptor.
src/validate.ts     the free, typed wrappers over @smartput/shared.
src/class.ts        createValueClass(TABLE, "<kind>") — one line, /*#__PURE__*/.
src/locale/<id>.ts  one vocabulary per language, default-exported.
```

Rules that follow from it:

- **Every file in `exports` is an entry a consumer can land on alone.** The map is the
  source of truth for build, typecheck and docs. Adding a file that is not reachable
  from `exports` adds dead weight; adding an entry changes the published surface.
- **`units.ts` imports nothing but types.** It is a table. A table that imports an
  engine is a package a form field cannot use.
- **`validate.ts` re-exports the table and the unit type** so one import serves a
  caller, and wraps each shared op with the kind's name (`parseMass`, `addMass`). The
  wrappers are one-liners on purpose: they exist for types and discoverability, and
  every one of them that grows a body is logic that belonged in `shared`.
- **`class.ts` stays one line.** A class that needs more than `createValueClass` is
  asking for an option on `createValueClass`, not for a bespoke class — with
  `temperature` (affine, paired delta) as the standing exception, and it is already
  written.
- **A class is the public door, a function is the room behind it.** Ship the class for
  ergonomics; keep the implementation as plain functions underneath, where it is
  testable and tree-shakable.

Non-kind packages (`core`, `query`, `geo`, `math`, …) have their own shape, but the
same rule decides it: the directory mirrors the pipeline stage, one concern per file,
and a file that two stages both reach into is a seam that wants naming.

## 3. Numbers

- **Two tiers, two number types.** The ergonomic tier (`@smartput/shared` and the
  per-kind wrappers) works in `number` and returns result objects. The engine tier
  works in `Decimal` and throws `SmartputError`. Do not mix them in one function.
- **Ratios are decimal strings.** `"0.45359237"`, not `0.45359237`. The shared path
  does `Number(r)`, the engine path does `new Decimal(r)`, and the table stays exact
  for both.
- **Short-circuit the identity.** Same unit in and out must not round-trip through
  canonical: `30deg` to radians and back is `29.999999999999996`, and `30deg - 15deg`
  through canonical is `14.999999999999998`. `rebase` and `combine` already do this;
  any new conversion path does it too.
- **Affine kinds export `diff`, never `add`.** `20°C + 20°C` has no meaning, and the
  absence is the design.
- **`raw` is the number as authored.** It exists so a result re-parses in strict mode
  and so the engine can hand the string to `Decimal` without a float in between. Never
  recompute it from `value` when the original is in hand.

## 4. Errors

- **Ergonomic tier returns `Parsed<U>`**: `{ ok: true, … }` or `{ ok: false, code,
  input }`, frozen, no throw. Short-circuit on the first failure and return it
  unchanged, so the `input` on it names the operand that actually broke.
- **Engine tier throws a `SmartputError` subclass.** A registration problem (kind
  registered twice, vocabulary naming an unknown kind) and a data problem (no rate) are
  never swallowed into "no interpretation" — see `NEVER_SWALLOWED` in `engine.ts`.
- **The code names the problem the user has**, not the branch the parser is in.
  `"30,5deg"` is `nan` because the number did not end where it looked like it ended;
  calling it `unknown-unit` would name a unit called `,5deg` that nobody typed.
- **No error text built by concatenation at a hot path.** Build the message where it is
  thrown, once.

## 5. Types

- `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.
  Indexed reads are `T | undefined`; handle the `undefined` rather than asserting past
  it. A non-null assertion needs a `biome-ignore` line saying what filtered it.
- **`as unknown as` is allowed at exactly three kinds of seam**: a third-party type
  that lies (`math`'s CAS JSON), a prototype being assembled before it is a class
  (`facade/quantity.ts`, `shared/class.ts`), and a brand being attached
  (`kind/decimal.ts`). Each one carries a comment. A fourth is a design problem.
- **Prefer a discriminated union over an optional boolean.** `Parsed<U>` is the model.
- **Export types with `export type`.** `verbatimModuleSyntax` is on, and a value
  import for a type is a runtime edge in the bundle graph.
- **Generic over the unit string, always.** `U extends string`, never `string`. The
  whole point of the wrappers is that `toMass(x, "kg")` is checked.

## 6. Bytes

Byte budgets are enforced (`scripts/check-size.ts`), so this is not advice.

- **Import from the subpath, not the barrel.** `@smartput/kind/vocabulary` and
  `@smartput/kind/types`, not `@smartput/core`. A vocabulary that names anything on
  core's root barrel links decimal.js: measured, one locale went from 35.7 KB to
  ~1.3 KB by changing only the import specifier.
- **`/*#__PURE__*/` on every module-level call whose result may be unused.** That
  annotation is what lets an unused kind's class drop out of a barrel.
- **`"sideEffects": false`** in every manifest, and it has to stay true: no module-load
  work beyond `decimal.ts`.
- **Data that only one subpath needs lives behind that subpath.** `datetime`'s holiday
  table is reachable only through `./holiday`, and the root's byte budget is what
  enforces it.
- **Prefer a lookup table built once at define time** over branching at call time, but
  not when the table is bigger than the branch — the budget decides, not taste.

## 7. Speed

The paths that matter run per keystroke: tokenize, scan, candidate resolution, solve,
score. Everything else is cold and should be written for clarity.

- **Do the cheap rejection first.** A `length` check before a regex, a `Set.has` before
  a scan, the same-unit comparison before the conversion.
- **Hoist regexes and tables to module scope.** A literal regex in a loop body is a new
  object per iteration.
- **Precompute at define time.** `defineKind` and `defineVocabulary` run once; alias
  maps, reverse indexes and sorted unit lists belong there, not in the hot call.
- **`Map`/`Set` for dynamic keys, plain frozen objects for fixed ones.** A `Record`
  keyed by user input pays prototype-chain lookups and megamorphic access.
- **Allocate nothing in a loop you can avoid.** No intermediate `.map().filter()` chain
  on a per-keystroke path; one pass, one array.
- **No memoisation in module scope.** Cache on the engine instance or not at all —
  a module-level cache is the module state the design forbids, and it leaks between
  engines with different locales.
- **A perf claim needs a number.** Write the measurement into the commit message.

## 8. Comments

The comment style here is unusual and deliberate: comments carry the *reasoning and
the cost*, not a restatement of the code. Keep it.

- **Record the ruling.** When a design forces a trade, write it where the reader meets
  it — a test named for the cost, a comment, or a paragraph in the roadmap.
- **A comment that repeats the line below it is deleted.** A comment that explains why
  the obvious version is wrong is load-bearing and is never deleted by a refactor.
- **Do not delete a rationale comment because the code around it moved.** Move it.

## 9. Tests

- Tests sit beside their source as `*.test.ts`.
- **Unit tests for mechanics, corpus tests for what people type.** A new alias arrives
  with the phrasings a person would actually type, in every locale that gets it.
- **Name a test for the cost it protects**, not for the function it calls, when it
  exists to hold a ruling in place.
- **A fixture that re-records itself proves nothing.** Parity fixtures move only with
  `bun run parity:record`, deliberately, and the English fixture is frozen: a diff in
  it is a regression until shown otherwise.
- **Test the error code, not the message.**

## 10. Working on a package

The loop, in order:

```sh
bun test packages/<name>           # the package you touched
bun run lint && bun run typecheck   # the pre-push gate
bun run check                       # the full gate, before you call it done
```

**Leave alone**, unless the change *is* about them and the reason is in the commit
message:

- public `exports` maps, package names, version fields
- byte budgets in `scripts/check-size.ts` and the allowlist in `check-deps.ts`
- parity fixtures and recorded corpus output
- generated files (`docs/packages/*.md`, `CHANGELOG.md`)
- rationale comments, and the tests that hold a ruling in place

**Never**: add a runtime dependency, import `decimal.js`, introduce `any`, make a kind
import another kind, teach core a domain, or re-record a fixture to make a test pass.
