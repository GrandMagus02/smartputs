# Contributing to Smartputs

Thanks for taking the time. This file covers how to get the repo running, what the
checks enforce, and the few rules that are easy to trip over.

## Requirements

- **Bun 1.3 or newer.** Bun is the package manager, the test runner and the bundler.
  There is no npm or yarn path — `bun.lock` is the only lockfile, and packages resolve
  each other through the `bun` condition in their `exports` maps, which points at
  TypeScript source rather than build output.

```sh
git clone https://github.com/GrandMagus02/smartputs.git
cd smartputs
bun install
bun run check
```

If `bun run check` passes on a clean checkout, your environment is set up correctly.

## Repository layout

```
packages/*   one workspace package per kind (mass, duration, geo, …) plus core
docs/        VitePress site; docs/packages/ is generated, see below
scripts/     build, typecheck and the repo's custom guard scripts
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `bun test` | Runs every test. Tests live beside their source as `*.test.ts`. |
| `bun run lint` | Biome lint and format check. |
| `bun run format` | Rewrites files to match the formatter. |
| `bun run typecheck` | Typechecks every workspace package and reports all failures in one pass. |
| `bun run build` | Builds every entry each package declares in `exports`. |
| `bun run docs:dev` | Builds, regenerates package pages, then serves the docs site. |
| `bun run check` | The full gate: lint, typecheck, check-deps, test, build, check-size. |
| `bun run pack-size` | Stages every package as npm would see it and measures the tarball. |
| `bun run check-commits [range]` | Reads commit subjects the way the release script does. |
| `bun run release --dry-run` | Prints the version each package would move to, and why. |
| `bun run publish-packages` | The first-time npm publish, prompting for a token per package. |

Run `bun run check` before opening a pull request. `.github/workflows/ci.yml` runs the
same commands on every pull request, plus `pack-size` and a Conventional Commits check
over the branch's subjects.

## Things the checks enforce

**One runtime dependency per package, declared in advance.** `scripts/check-deps.ts`
holds the allowlist. It discovers packages from the filesystem and *fails* on any it
does not know about, so adding a package means adding it to that map — a new package
cannot slip through with an unreviewed dependency.

**Never import `decimal.js` directly.** Import `Decimal` from `@smartput/core` instead
(or from `./decimal` inside `packages/core`). `packages/core/src/decimal.ts` applies
`Decimal.set({ precision: 28, … })` as a module-load side effect; a raw import bypasses
it and silently computes at decimal.js's ~20-digit default, producing wrong numbers
with no error. Biome fails the build on this import.

**Import budgets.** `scripts/check-size.ts` bundles and minifies a synthetic entry for
each measured import set, so the number reflects what a consumer actually pays. It
imports *and uses* the symbols deliberately: importing without using would let the
minifier drop the whole graph and report a budget of zero. If a change moves a budget,
the diff has to be justified rather than waved through.

**No `any`.** `noExplicitAny` is an error, not a warning.

Formatting is Biome: two-space indent, 90-column lines. Let `bun run format` settle
these rather than hand-formatting.

## Generated files

Two kinds of file are written by scripts and committed to the repo. Editing them by
hand works right up until the next regeneration silently reverts it.

**`docs/packages/*.md`** comes from `scripts/gen-package-pages.ts`. The prose lives in
that script; every table is read from the source it describes — the manifest's
`exports`, the kind's `UnitTable`, the rows of `check-size.ts`. Add a subpath or a unit,
then run `bun run docs:packages` and commit the result.

**Parity fixtures** are regenerated with `bun run parity:record`, and only ever
deliberately. A fixture that re-records itself proves nothing; the value of these files
is that a changed output shows up as a diff a reviewer has to approve. The English
fixture in particular is the frozen one — a diff in it is a regression until someone
demonstrates otherwise.

## Adding to the library

- **A new package.** Its `exports` map is the source of truth: build, typecheck and the
  docs generator all discover entries from it, so a subpath missing there is a subpath
  that never gets built. Register the package in `scripts/check-deps.ts` as well.
- **A new kind.** Start from `docs/guide/defining-a-kind.md`, which walks through the
  unit table, the signatures a kind declares, and how the evaluator picks them up.
- **A new locale.** Locales are separate entry points under `@smartput/core/locale/*`.
  Add tests next to the existing ones in `packages/*/src/locale/`.

## Tests

Tests sit next to the code they cover (`packages/angle/src/class.test.ts` beside
`class.ts`) and run under `bun test`. Alongside unit tests, packages carry corpus tests
that run real input strings through the pipeline — when you add a unit or an alias, add
the phrasings a person would actually type, not just the canonical form.

## Pull requests

Keep the change and its tests in one commit where practical, describe what the change
does and why the old behaviour was wrong, and make sure `bun run check` is green. If a
change alters a generated file or a parity fixture, say so in the description so the
diff is read rather than skimmed.

## Commit messages

Subjects follow [Conventional Commits](https://www.conventionalcommits.org), because the
version numbers and the changelogs are computed from them rather than written by hand:

```
feat(length): add the nautical mile
fix: stop rounding the international yard
feat(core)!: rename parse() to solve()
```

- **Type** is one of `feat`, `fix`, `perf`, `revert`, `docs`, `style`, `refactor`,
  `test`, `build`, `ci`, `chore`. Only the first four release anything.
- **Scope** is a package directory name (`length`, `core`) or one of `repo`, `ci`,
  `deps`, `docs`, `scripts`, `release`. It is optional.
- **Breaking** is a `!` before the colon, a `BREAKING CHANGE:` footer, or both. Below
  1.0.0 it is a minor bump, not a major one.
- Lower-case subject, no full stop, 72 characters at most.

`bun run check-commits origin/main..HEAD` is the same check CI runs.

## Releasing

Releases are automatic. Merging to `main` runs `.github/workflows/release.yml`, which:

1. runs `bun run check` and `bun run pack-size` against the merge result;
2. runs `scripts/release.ts` — per package, it reads the commits since that package's
   last `<name>@<version>` tag, works out the bump, writes the new version into the
   manifest and prepends a section to that package's `CHANGELOG.md`. A package whose
   dependency moved is republished at a patch, so no published range points at a version
   its dependent was never tested against;
3. commits, tags each released package and pushes;
4. publishes to npm in dependency order with provenance, and cuts a GitHub release per
   package.

It needs one repository secret, `NPM_TOKEN`, with publish rights to the `@smartput`
scope.

**The first publish is manual**, because 37 package names have to be claimed:

```sh
bun run publish-packages --dry-run --version 0.1.0   # stage everything, publish nothing
bun run publish-packages --version 0.1.0             # for real, one token per package
git push --tags
```

It stages each package into `.publish/` — `workspace:*` ranges resolved, dev
dependencies dropped, the shared licence and repository fields filled in — prompts for
an npm token before each publish, and never writes to `~/.npmrc`. Anything already on
the registry is skipped, so a run that fails part-way can simply be run again.
