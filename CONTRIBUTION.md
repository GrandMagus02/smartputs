# Contributing to Smartputs

Thanks for taking the time. Short version: open an issue, agree on the shape, then
send a pull request that keeps `bun run check` green.

## Issue first, then pull request

Please open an issue before writing code, even for small things. Most changes here
touch a table somebody else depends on (a unit ratio, an alias, a weight, a locale
form), and a two-line issue saves a rewritten PR.

- **Bug.** Paste the exact input string, what you got, and what you expected.
  `engine.explain(input)` output helps a lot.
- **New unit, alias or phrasing.** Say which kind and which language, and add the
  phrasings people actually type, not just the canonical form.
- **New kind, locale or package.** Describe the shape first. See
  [Design practices](#design-practices) below; if the idea needs a change to core,
  say so up front, since that is the part we push back on.

Once the issue is agreed, open the PR and reference it (`Closes #123`).

## Setup

Requires [Bun](https://bun.sh) 1.3 or newer. Bun is the package manager, test runner
and bundler; there is no npm or yarn path. `bun.lock` is the only lockfile, and packages
resolve each other through the `bun` condition in `exports`, which points at TypeScript
source rather than build output.

```sh
git clone https://github.com/GrandMagus02/smartputs.git
cd smartputs
bun install
bun run check      # green on a clean checkout means you are set up
```

`bun install` also wires two git hooks from `.githooks`: **pre-commit** formats only the
files you staged and re-stages them; **pre-push** runs lint and typecheck. Tests and
size budgets stay with CI. Both hooks no-op when `CI` is set; `--no-verify` skips them.

```
packages/*   one workspace package per kind (mass, duration, geo, …) plus core
docs/        VitePress site; docs/packages/ is generated
scripts/     build, typecheck and the repo's guard scripts
```

## Commands

| Command | |
| --- | --- |
| `bun test` | Every test. Tests sit beside their source as `*.test.ts`. |
| `bun run lint` / `bun run format` | Biome check / Biome rewrite. |
| `bun run typecheck` | Every package, all failures in one pass. |
| `bun run build` | Every entry each package declares in `exports`. |
| `bun run check` | The full gate: lint, typecheck, check-deps, test, build, check-size. |
| `bun run docs:dev` | Build, regenerate package pages, serve the docs. |
| `bun run pack-size` | Stage every package as npm sees it and measure the tarball. |
| `bun run check-commits [range]` | Read commit subjects the way the release script does. |
| `bun run changelogs [--check]` | Rewrite every `CHANGELOG.md` from tags. |
| `bun run release --dry-run` | Print the version each package would move to, and why. |
| `bun run publish-packages` | First-time npm publish, one token per package. |

CI (`.github/workflows/ci.yml`) runs `bun run check`, `pack-size` and a Conventional
Commits check on every PR.

## Design practices

These are the rules the codebase is built on. None of them are enforced by a linter,
so they are recommended rather than required, but a PR that follows them gets merged
faster and a PR that fights them usually gets a redesign request.

**Core never learns a domain.** Core knows no metre, no dollar, no city. A new
capability is a kind package that declares its units and op signatures; the solver has
not moved since M1. If your change needs core, it should be a *seam any plugin can use*
(a literal matcher, an optional field with a `0`/`false` default), not a special case
for your kind. `docs/guide/roadmap.md` records every core change so far and what forced
it. Read it before proposing another.

**Nobody imports anybody.** Kind packages do not import each other. When two packages
need to agree on a shape (a place, a range), they match it structurally off
`Value.meta`; the shape is the contract. `check-deps` holds every package to one
runtime dependency and fails on a package it does not know.

**Words live outside the kind.** A `Language` holds mechanics, a `Vocabulary` holds
the words for one kind in one language, and a `Locale` is the two composed. A
vocabulary names its kind by id string and never imports it, so a translation is a
package (`@smartput/mass/locale/uk`), not a patch. Never put a word into a kind.

**Defaults over configuration.** `defineKind` needs `id`, `canonical` and `units`;
aliases, arithmetic, `in` conversion and formatting are generated. If a new kind needs
more than that, a default is missing, and fixing the default is the better PR. New
behaviours are opt-in fields (`ordered`, `targetable`), never new defaults.

**Ambiguity is data.** Keep every reading, rank it, let weights sort it out. Weight a
reading *down* rather than deleting it; `"5m"` in a sentence about time still carries a
metres reading at 0.018. Do not add code that picks a winner silently.

**Measured, not estimated.** Byte budgets come from a real minified bundle
(`check-size`), parity fixtures are recorded output, docs tables are read from source.
When a number in one of those moves, the PR explains why. A fixture that re-records
itself proves nothing.

**Frozen and pure.** An engine is a composition of frozen descriptors, and every public
output is deep-frozen. No globals, no registries that mutate, no module state beyond
`decimal.ts`.

**Record the ruling.** When a design forces a trade (`"durch"` is claimed as `by`, so
a bare `durch` does not divide), write it down where the reader will meet it: a test
named for the cost, a comment, or a paragraph in the roadmap. Stated beats hidden.

**Test what people type.** Beside unit tests, packages carry corpus tests that run real
input strings through the pipeline. A new alias comes with the phrasings a person would
actually type, in every locale that gets it.

## Guards CI enforces

- **One runtime dependency per package.** The allowlist is `scripts/check-deps.ts`,
  and it fails on any package it does not know. Register new packages there.
- **Never import `decimal.js` directly.** Use `Decimal` from `@smartput/core` (or
  `./decimal` inside core). `packages/core/src/decimal.ts` sets `precision: 28` on
  load; a raw import silently computes at the ~20-digit default. Biome fails on it.
- **Import budgets.** `scripts/check-size.ts` bundles and minifies a synthetic entry per
  measured import set, and uses the symbols so the minifier cannot drop them. A moved
  budget needs a reason in the PR.
- **No `any`.** `noExplicitAny` is an error.
- **Formatting is Biome:** two-space indent, 90 columns. Let `bun run format` do it.

## Generated files

Two kinds of file are committed but written by scripts. Hand edits last until the next
regeneration.

- `docs/packages/*.md` comes from `scripts/gen-package-pages.ts`. Prose lives in the
  script; tables are read from `exports`, `UnitTable`s and `check-size.ts`. Change the
  source, run `bun run docs:packages`, commit the result.
- Parity fixtures are regenerated with `bun run parity:record`, and only deliberately.
  The English fixture is frozen: a diff in it is a regression until shown otherwise.

## Adding things

- **A package.** Its `exports` map is the source of truth: build, typecheck and the docs
  generator discover entries from it. Register it in `scripts/check-deps.ts`.
- **A kind.** Start from `docs/guide/defining-a-kind.md`.
- **A locale.** Locales are entry points under `@smartput/core/locale/*`; put tests
  beside the existing ones in `packages/*/src/locale/`.

## Commits

Subjects follow [Conventional Commits](https://www.conventionalcommits.org). Versions
and changelogs are computed from them.

```
feat(length): add the nautical mile
fix: stop rounding the international yard
feat(core)!: rename parse() to solve()
```

- Type: `feat`, `fix`, `perf`, `revert` release; `docs`, `style`, `refactor`, `test`,
  `build`, `ci`, `chore` do not.
- Scope (optional): a package directory (`length`, `core`) or `repo`, `ci`, `deps`,
  `docs`, `scripts`, `release`.
- Breaking: `!` before the colon or a `BREAKING CHANGE:` footer. Below 1.0.0 that is a
  minor bump.
- Lower-case subject, no full stop, 72 characters max.

`bun run check-commits origin/main..HEAD` is what CI runs.

## Pull request checklist

- [ ] Linked issue
- [ ] `bun run check` green
- [ ] Change and its tests in one commit where practical
- [ ] Description says what changed and why the old behaviour was wrong
- [ ] Generated files or parity fixtures that moved are called out, so the diff is read
      rather than skimmed
- [ ] Any core change is a general seam, and the description says what forced it

## Releasing

Automatic. Merging to `main` runs `.github/workflows/release.yml`: `bun run check` and
`pack-size` on the merge result, then `scripts/release.ts` reads each package's commits
since its last `<name>@<version>` tag, bumps, writes the manifest and `CHANGELOG.md`
section, commits, tags, pushes, and publishes to npm in dependency order with
provenance plus a GitHub release per package. A package whose dependency moved is
republished at a patch, so no published range points at an untested version.

npm auth is [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no
stored secret). Each package needs it configured once on npmjs.com (Settings ->
Trusted Publisher -> GitHub Actions, this repo, `release.yml`); one without it 403s
without blocking the others. `NPM_TOKEN` as a repo secret is a fallback if set.

The first publish of a name is manual, since a package has to exist before npm lets
you attach a trusted publisher:

```sh
bun run publish-packages --dry-run --version 0.1.0   # stage everything, publish nothing
bun run publish-packages --version 0.1.0             # for real, one token per package
git push --tags
```

It stages each package into `.publish/` (`workspace:*` resolved, dev deps dropped,
licence and repository filled in), prompts for a token per publish, never writes
`~/.npmrc`, and skips anything already on the registry, so a failed run can be rerun.
