# smartputs i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is written to be executed as a **workflow with parallel agents** — see "Parallel execution map" below for the wave structure, the fan-out points, and a ready-to-run workflow script.

**Goal:** Separate a kind from the words used to say it — vocabulary becomes a per-(kind, language) artifact, grammar becomes language-defined `forms` keys instead of a one-dimensional plural table, and `locales: Locale[]` starts meaning what it says.

**Architecture:** Three types replace one. `Language` holds mechanics (analyzers, numerals, keywords, `selectForm`, `renderQuantity`), `Vocabulary` holds the words for one kind in one language, and `Locale` is a language composed with its vocabularies through `composeLocale`. `defineKind` loses `lexicon` entirely; the registry's alias index is built from installed vocabularies and each entry is tagged with the language that contributed it. Output shape moves out of `formatValue`'s template into `Language.renderQuantity`. Ukrainian ships as proof before multi-locale recognition lands, because multi-locale is untestable with one real language.

**Tech Stack:** Bun (test runner, bundler), TypeScript 5.7 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome 2, `decimal.js`.

**Spec:** `docs/superpowers/specs/2026-08-05-smartputs-i18n-design.md`

---

## Global Constraints

- **Parity is the acceptance criterion for P1 and P2.** Every English output must be byte-identical before and after. The net already exists on `main`: `packages/core/src/parity.ts`, `packages/core/src/parity.test.ts`, the recorded snapshot, and `bun run parity:record`. Spec §11's P0 is therefore **already landed** — Task 1 only verifies it.
- `@smartput/core` ships exactly **one** runtime dependency (`decimal.js`). Nothing in this plan changes that. A language module is a **file inside core** (`src/locale/<id>.ts`) with a subpath of its own, not a package — see R9's reversal.
- A vocabulary must **not** import its own kind. It names the kind by id string. This is what makes `locale/uk` importable without the ratio tables and shippable by someone who is not the kind's author (spec §10).
- Never import `decimal.js` directly — Biome errors. Use `Decimal` from `@smartput/core` (or `./decimal` inside core).
- `exactOptionalPropertyTypes` is on: build optional properties with conditional spread (`...(form !== undefined ? { form } : {})`), never `foo: undefined`.
- `noUncheckedIndexedAccess` is on: every array and record index is `T | undefined`. Handle it; do not reach for `!`.
- Every public artifact is frozen at its definition site: `defineVocabulary` deep-freezes, `defineLanguage` deep-freezes, `composeLocale` freezes its result.
- Every kind package keeps its three micro-path subpaths (`./units`, `./validate`, `./class`) in the pinned condition order `bun, types, default`. `scripts/check-deps.ts` enforces it. New `./locale/<id>` subpaths use the same condition order.
- Run `bun run check` (lint + typecheck + check-deps + test + build + check-size) before any commit that touches a package manifest or a public type.
- Commit after every task. Never squash two tasks into one commit — the review gate between them is the point.

---

## Plan rulings

The spec leaves these open or states them at a level the code cannot be written from. Each is decided here, with the reasoning, so no task has to stop and ask.

| # | Ruling | Why |
| --- | --- | --- |
| **R1** | `OpaqueSpec.units` becomes `readonly string[]` — bare unit ids. Aliases, symbols and forms for an opaque kind live in a `Vocabulary` exactly as a ratio kind's do. | `UnitLexeme` is removed by I1; an opaque kind's units were the last place it survived. Zone names and country names are words, and words belong to a language. |
| **R2** | A unit is **always** indexed under its own registry key (`kg`, `m`, `Europe/Kyiv`), with `locale: "*"`, regardless of which vocabularies are installed. Vocabulary aliases are indexed on top of it. | The unit key is the registry's identifier, not an English word. Without this, an engine with no vocabulary installed cannot read `5 kg` at all, and I10's "degrade to the unit key" would have nothing to degrade to. `"*"` never matches a `locale:<id>` weight selector. |
| **R3** | `typical` becomes `Kind.typical?: Readonly<Record<string, [number, number]>>` — a kind-level map, per spec §4. Missing entry scores 0, as today. | It was never language data, and its old home is going away. |
| **R4** | `Locale` keeps `id` and gains `language` + `vocabularies`. Every other field consumers read today (`analyze`, `numberFormat`, `keywords`, `weights`, `numerals`, `spell`, `segment`) moves behind `.language`. | One mechanical sweep (`locale.X` → `locale.language.X`), and `locale.id` — by far the commonest read — does not move. |
| **R5** | `FormCtx.count` is **optional** (`count?: Decimal`), amending the spec's required field. Every `selectForm` must handle its absence; English returns `"other"`, the CLDR generic category. | A conversion target has no magnitude attached to it ("1 kg in g" has nothing to count "grams" by). `print/unit-word.ts` already special-cases exactly this with `"other"`, and reproducing it is what keeps parity. Synthesising a fake count to steer `Intl.PluralRules` would be a lie the Ukrainian language module would then have to un-tell. |
| **R6** | `AliasEntry.locale` lands in **P1** (Task 3), not P4. `Candidate.locale`, per-language analyzer chains and the `locale:` selector stay in P4. | The alias index is built once, in one loop, in Task 3. Tagging the entry there costs one field; tagging it later means rewriting the same loop twice. |
| **R7** | `Kind.lexicon` and `EngineOptions.packs` survive **inside P1 only**, as an unexported bridge (`legacyVocabulary` in `kind/define.ts`) that converts them into `en` vocabularies at registry-build time. Task 7 deletes the bridge and both fields. | It is what makes every task in the Wave-2 fan-out independently green: the registry reads vocabularies from the first task onward, and a package that has not migrated yet is served by a bridge producing the identical table. Two homes for vocabulary exist for the length of one phase and are then gone, which is the opposite of the drift I1 forbids. |
| **R8** | Every `en` vocabulary carries an explicit `symbol` for every unit that has one today. The value is the one `toLexeme` computes now: explicit `symbol`, else `aliases[0]`, else the unit key. | `defaultRenderQuantity`'s third branch is `${number} ${unit}` **with a space**, where today's no-symbol fallback is `${numberText}${value.unit}` without one. Today that branch is unreachable (`toLexeme` always sets a symbol); a vocabulary that forgets `symbol` would make it reachable and move a byte. |
| **R9** | ~~`@smartput/core/locale/en` is deleted; English ships as `@smartput/locale-en`.~~ **REVERSED 2026-08-08, after P2.** A language ships inside `@smartput/core` under `src/locale/<id>.ts`, reachable at the `@smartput/core/locale/<id>` subpath. `@smartput/locale-en` no longer exists; `@smartput/locale-uk` will never be created — Task 12 writes `packages/core/src/locale/uk.ts` instead. Spelled-number generation (`spellNumber`, `numberFromWords`, `NUMBER_WORDS`) lives in `@smartput/number`, reversing I5's move as well. | Amends spec §10's package layout. A subpath keeps an unimported language out of the bundle, which is the only thing the separate package was buying, and it costs a consumer one dependency instead of two. The words move back because they were never the language's only copy: `Language.spell` is `cardinalSpeller` over core's own tables. |
| **R10** | The built-in set is **seventeen** kinds across eighteen packages, not the spec's "twelve": `boolean, number, percent, length, mass, duration, temperature, tempdelta, angle, datasize, speed, area, volume, datarate, power, energy, tempo`, plus `measure` (opt-in), `money` (`@smartput/rate`), `datetime`, `place` (`@smartput/country`), and the range kinds. Every "twelve" in the spec means "all of them". | Counted from `packages/kinds/src/index.ts` on `main`. |

---

## File Structure

### New files — `packages/core/src/`

| File | Responsibility |
| --- | --- |
| `locale/vocabulary.ts` | `defineVocabulary` — deep-freezes a `Vocabulary` |
| `locale/vocabulary.test.ts` | freezing, shape |
| `locale/compose.ts` | `composeLocale`, and in P4 the keyword-union collision check |
| `locale/compose.test.ts` | `LocaleMismatchError`, `VocabularyConflictError`, `KeywordConflictError` |
| `locale/render.ts` | `defaultRenderQuantity`, `defaultRenderExpression` |
| `locale/render.test.ts` | the three branches of the default render |
| `testing/locale.ts` | `assertLocaleContract(locale, kinds, opts?)` |

### Modified files — `packages/core/src/`

| File | Change |
| --- | --- |
| `types.ts` | add `Language`, `Vocabulary`, `UnitWords`, `FormCtx`, `Slot`, `QuantityParts`, `ExpressionParts`; rewrite `Locale`; delete `Lexicon`, `UnitLexeme`, `LocalePack`; `Kind.typical`; `OpaqueSpec.units: readonly string[]` |
| `errors.ts` | `LocaleMismatchError`, `VocabularyConflictError`, `KeywordConflictError` |
| `kind/define.ts` | `NormalizedUnit.words`/`typical` replace `lexeme`; `legacyVocabulary` bridge (P1 only) |
| `kind/registry.ts` | `buildRegistry(kinds, locales)`; `AliasEntry.locale`; `registry.words` + `wordsFor` |
| `locale/define.ts` | `defineLanguage` replaces `defineLocale`; `defineLocalePack` deleted in Task 7 |
| `locale/analyze.ts` | takes a `Language`; in P4, one chain per installed language |
| `locale/number.ts` | `numberSymbols(language)` |
| `format/format.ts` | `selectForm` + `renderQuantity` tail; `formatNumber(value, language, opts)` |
| `print/unit-word.ts`, `print/print.ts` | `forms` via `selectForm`; `slot`; spelled mode through `Language.spell`/`renderExpression` |
| `complete/complete.ts` | `unit.lexeme.display[category]` → `forms[selectForm(...)]`; `unit.lexeme.typical` → `unit.typical` |
| `facade/quantity.ts` | claim `forms` values instead of `display` values |
| `parse/candidates.ts`, `parse/lex.ts`, `complete/completer.ts`, `engine.ts` | `locale.X` → `locale.language.X` (R4) |
| `index.ts`, `testing/index.ts` | export surface |
| `src/locale/en.ts` | stays in core, gains `selectForm`; reachable at `@smartput/core/locale/en` |

### New packages

**None — see R9's reversal.** A language is a file inside core with a subpath of its own:

| File | Subpath | Contents |
| --- | --- | --- |
| `packages/core/src/locale/en.ts` | `@smartput/core/locale/en` | `english: Language` — analyzers, cardinals, `spell`, keywords, `selectForm` |
| `packages/core/src/locale/uk.ts` | `@smartput/core/locale/uk` | `ukrainian: Language` — four plural categories, case-by-slot `selectForm`, Cyrillic keywords, numerals |
| `packages/number/src/words.ts` | `@smartput/number` | `spellNumber`, `numberFromWords`, `NUMBER_WORDS` |

### New files in every kind package

| File | Responsibility |
| --- | --- |
| `packages/<kind>/src/locale/en.ts` | `defineVocabulary({ locale: "en", kind, units })` — aliases derived from `units.ts`, plus `symbol` and `forms` |
| `packages/<kind>/src/locale/uk.ts` | the same for Ukrainian (P3) |
| `packages/kinds/src/locale/en.ts` | barrel: every built-in `en` vocabulary as an array |
| `packages/kinds/src/locale/uk.ts` | the same for Ukrainian |

---

## Parallel execution map

Eight waves. Within a wave every task is independent — no shared files, no ordering. Between waves there is a hard barrier and a review gate.

```
W0  T1  baseline gate                                     (1 agent, serial)
      |
W1  T2  core types + defineVocabulary + composeLocale      (1 agent, serial)
      |
W2  T3  registry + engine read vocabularies (bridge)       (1 agent, serial)
      |
W3  T4  [SUPERSEDED by R9's reversal — English stays in core]  (1 agent, serial)
      |
W4  T5  mass en vocabulary  (exemplar — sets the pattern)  (1 agent, serial)
      |
W5  T6  ── FAN-OUT ×20 ──  one agent per kind package      (20 agents, parallel)
      |   angle area boolean datarate datasize duration energy length
      |   measure number percent power speed temperature tempo volume
      |   money(rate+currency) datetime place(country) ranges docs
      |
W6  T7  delete the bridge; kinds barrel; English-freedom   (1 agent, serial)
      |
W7  T8  forms + selectForm            ─┐
    T9  renderQuantity + slot          │ T8 → T9 → T10 serial (same files)
    T10 spell/renderExpression move    ─┘
    T11 assertLocaleContract             (parallel with T9 and T10)
      |
W8  T12 core/src/locale/uk.ts + ./locale/uk subpath        (1 agent, serial)
      |
W9  T13 ── FAN-OUT ×12 ── uk vocabularies                  (12 agents, parallel)
      |
W10 T14 Ukrainian acceptance (§8 table, round-trip)        (1 agent, serial)
      |
W11 T15 locale on Candidate + per-language chains          (1 agent, serial)
    T16 locale: weights, EngineOptions.format              (after T15)
    T17 KeywordConflictError + numerals longest-claim      (parallel with T16)
      |
W12 T18 multi-locale test suite (§9)                       (1 agent, serial)
      |
W13 T19 widened AnalyzeCtx                                 (1 agent, serial)
      |
W14 T20 ── FAN-OUT ×4 ── the four analyzer helpers         (4 agents, parallel)
      |
W15 T21 third-language smoke test + docs sweep             (1 agent, serial)
```

**Isolation.** Fan-out waves (T6, T13, T20) touch disjoint package directories, so they do **not** need `isolation: "worktree"` — one shared checkout is correct and cheaper, and it is also what makes T6's one shared file (the `@smartput/kinds` barrel, appended to by each row) resolve itself. Every other wave is a single agent.

**Gate between waves.** After each wave, run `bun run check` at the repo root. A wave is not done until it is green. For W1–W6 also run `bun test packages/core/src/parity.test.ts` and confirm **zero** snapshot diffs — a parity diff before Task 7 is a bug, never a re-record.

**Workflow script.** Paste into the `Workflow` tool (`script:`), or save and pass `scriptPath`. It reads this plan file for each task's text rather than restating it.

```js
export const meta = {
  name: 'smartputs-i18n',
  description: 'Execute the smartputs i18n plan wave by wave, fanning out per kind package',
  phases: [
    { title: 'P1 separation' },
    { title: 'P1 fan-out' },
    { title: 'P2 grammar' },
    { title: 'P3 ukrainian' },
    { title: 'P4 multi-locale' },
    { title: 'P5 nlp' },
  ],
}

const PLAN = 'docs/superpowers/plans/2026-08-07-smartputs-i18n.md'
const DONE = {
  type: 'object',
  required: ['task', 'committed', 'checkGreen', 'notes'],
  properties: {
    task: { type: 'string' },
    committed: { type: 'boolean' },
    checkGreen: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

const run = (task, phase, extra = '') =>
  agent(
    `Read ${PLAN} and execute ${task} exactly, every step in order. ${extra}
     Follow the plan's Global Constraints and Plan rulings. TDD: write the failing test,
     run it, implement, run it, commit. Do not start any other task. When done, run
     \`bun run check\` from the repo root and report whether it was green.`,
    { label: task, phase, schema: DONE },
  )

phase('P1 separation')
await run('Task 1', 'P1 separation')
await run('Task 2', 'P1 separation')
await run('Task 3', 'P1 separation')
await run('Task 4', 'P1 separation')
await run('Task 5', 'P1 separation')

phase('P1 fan-out')
const PACKAGES = [
  'angle', 'area', 'boolean', 'datarate', 'datasize', 'duration', 'energy',
  'length', 'measure', 'number', 'percent', 'power', 'speed', 'temperature',
  'tempo', 'volume', 'money', 'datetime', 'place', 'ranges',
]
await parallel(
  PACKAGES.map((p) => () =>
    run('Task 6', 'P1 fan-out', `Your row is the "${p}" row of Task 6's table, and only that row.`)),
)
await run('Task 7', 'P1 fan-out')

phase('P2 grammar')
await run('Task 8', 'P2 grammar')
await parallel([
  () => run('Task 9', 'P2 grammar'),   // T9 then T10 share files — see note
  () => run('Task 11', 'P2 grammar'),
])
await run('Task 10', 'P2 grammar')

phase('P3 ukrainian')
await run('Task 12', 'P3 ukrainian')
const UK = [
  'angle', 'area', 'datarate', 'datasize', 'duration', 'energy', 'length',
  'mass', 'number', 'percent', 'power', 'speed', 'temperature', 'tempo', 'volume',
]
await parallel(
  UK.map((p) => () =>
    run('Task 13', 'P3 ukrainian', `Your row is the "${p}" row of Task 13's table, and only that row.`)),
)
await run('Task 14', 'P3 ukrainian')

phase('P4 multi-locale')
await run('Task 15', 'P4 multi-locale')
await parallel([() => run('Task 16', 'P4 multi-locale'), () => run('Task 17', 'P4 multi-locale')])
await run('Task 18', 'P4 multi-locale')

phase('P5 nlp')
await run('Task 19', 'P5 nlp')
await parallel(
  ['prefixStripper', 'compoundSplitter', 'phraseAnalyzer', 'scriptSegmenter'].map((h) => () =>
    run('Task 20', 'P5 nlp', `Your helper is \`${h}\`, and only that one.`)),
)
await run('Task 21', 'P5 nlp')

return { done: true }
```

---

## Task 1: Baseline gate

Spec §11's P0 already exists on `main` — this task proves it, and records the number every later task is measured against. It writes no source.

**Files:**
- Read: `packages/core/src/parity.ts`, `packages/core/src/parity.test.ts`
- Create: nothing

- [ ] **Step 1: Confirm the working tree is clean enough to measure**

```bash
git status --short
```

Expected: whatever branch you are on, no *uncommitted* change to `packages/core/src/parity.ts`, the corpus files, or any `src/index.ts` of a kind package. If there is one, commit or stash it first — a parity diff later must be attributable to this plan.

- [ ] **Step 2: Run the parity net**

```bash
bun test packages/core/src/parity.test.ts
```

Expected: PASS. If it fails on `main`, stop and report — every task below uses this as its acceptance criterion, and a red net measures nothing.

- [ ] **Step 3: Run the full check**

```bash
bun run check
```

Expected: green through lint, typecheck, check-deps, `bun test`, build and check-size.

- [ ] **Step 4: Record the baseline**

```bash
bun test 2>&1 | tail -5
```

Write the pass/fail counts into the task's report. Every later task's own run must show the same count plus its own new tests, and never fewer.

---

## Task 2: The three types, `defineVocabulary`, `composeLocale`

Purely additive. Nothing consumes these yet, so the whole suite stays green.

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/errors.ts`
- Create: `packages/core/src/locale/vocabulary.ts`
- Create: `packages/core/src/locale/compose.ts`
- Modify: `packages/core/src/locale/define.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/locale/compose.test.ts`, `packages/core/src/locale/vocabulary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Language`, `Vocabulary`, `UnitWords`, `FormCtx`, `Slot`, `QuantityParts`, `ExpressionParts`, `Locale` (new shape), `defineLanguage(l: Language): Language`, `defineVocabulary(v: Vocabulary): Vocabulary`, `composeLocale(language: Language, vocabularies?: readonly Vocabulary[]): Locale`, `LocaleMismatchError`, `VocabularyConflictError`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/locale/compose.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { LocaleMismatchError, VocabularyConflictError } from "../errors";
import { composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { defineVocabulary } from "./vocabulary";

const english = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in", "to", "as"] },
  selectForm: ({ count }) =>
    count === undefined ? "other" : new Intl.PluralRules("en").select(count.toNumber()),
});

const massEn = defineVocabulary({
  locale: "en",
  kind: "mass",
  units: { kg: { aliases: ["kg", "kilogram"], symbol: "kg", forms: { one: "kilogram", other: "kilograms" } } },
});

describe("composeLocale", () => {
  test("carries the language's id and the vocabularies given", () => {
    const en = composeLocale(english, [massEn]);
    expect(en.id).toBe("en");
    expect(en.language).toBe(english);
    expect(en.vocabularies).toEqual([massEn]);
  });

  test("a vocabulary for another language is a wiring error", () => {
    const massUk = defineVocabulary({ locale: "uk", kind: "mass", units: {} });
    expect(() => composeLocale(english, [massUk])).toThrow(LocaleMismatchError);
  });

  test("two vocabularies for one kind name both", () => {
    const other = defineVocabulary({ locale: "en", kind: "mass", units: {} });
    expect(() => composeLocale(english, [massEn, other])).toThrow(VocabularyConflictError);
  });

  test("composes with no vocabularies at all", () => {
    expect(composeLocale(english).vocabularies).toEqual([]);
  });

  test("the composed locale is frozen", () => {
    const en = composeLocale(english, [massEn]);
    expect(Object.isFrozen(en)).toBe(true);
    expect(Object.isFrozen(en.vocabularies)).toBe(true);
  });

  test("selectForm answers with the CLDR generic category when there is no count", () => {
    expect(english.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" })).toBe("other");
    expect(english.selectForm({ count: new Decimal(1), kind: "mass", unit: "kg", slot: "bare" })).toBe("one");
  });
});
```

Create `packages/core/src/locale/vocabulary.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { defineVocabulary } from "./vocabulary";

describe("defineVocabulary", () => {
  test("deep-freezes the whole table", () => {
    const v = defineVocabulary({
      locale: "en",
      kind: "mass",
      units: { kg: { aliases: ["kg"], symbol: "kg", forms: { one: "kilogram", other: "kilograms" } } },
    });
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.units)).toBe(true);
    expect(Object.isFrozen(v.units.kg)).toBe(true);
    expect(Object.isFrozen(v.units.kg?.aliases)).toBe(true);
    expect(Object.isFrozen(v.units.kg?.forms)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
bun test packages/core/src/locale/compose.test.ts packages/core/src/locale/vocabulary.test.ts
```

Expected: FAIL — `Cannot find module './compose'`.

- [ ] **Step 3: Add the types**

In `packages/core/src/types.ts`, **keep** `Lexicon`, `UnitLexeme` and `LocalePack` for now (R7 — Task 7 deletes them) and add:

```ts
/**
 * Where in an expression a quantity sits, handed to `Language.selectForm` so a
 * language whose grammar depends on position can answer differently. The three
 * core values are documented; a language may recognise its own, which is what
 * `(string & {})` is for — it keeps the union open without widening the three
 * away from autocomplete.
 *
 * `formatValue` renders a finished `Value` with no expression around it, so it
 * always passes `"bare"`. `Printer` walks a `Program` and knows the real
 * position.
 */
export type Slot = "bare" | "after-number" | "conversion-target" | (string & {});

/**
 * What a language is told in order to pick a key in a unit's `forms` table.
 *
 * `count` is optional — ruling R5, amending the spec. A conversion target has
 * no magnitude attached to it ("1 kg in g" has nothing to count "grams" by),
 * and every implementation must answer for that case; English returns
 * `"other"`, the category CLDR requires every locale to define precisely as
 * its generic one.
 */
export interface FormCtx {
  readonly count?: Decimal;
  readonly kind: KindId;
  readonly unit: string;
  readonly slot: Slot;
}

/** The pieces of a rendered quantity, assembled by `Language.renderQuantity`. */
export interface QuantityParts {
  /** Already formatted by `formatNumber` — never a raw Decimal. */
  readonly number: string;
  /** `forms[selectForm(ctx)]`, when the vocabulary had one. */
  readonly form?: string;
  readonly symbol?: string;
  readonly kind: KindId;
  readonly unit: string;
  readonly slot: Slot;
}

/**
 * The pieces of a rendered binary expression, for `Printer`'s spelled mode.
 * `left` and `right` are already rendered, so a language assembles words and
 * order and never walks the tree itself.
 */
export interface ExpressionParts {
  readonly op: OpSymbol;
  readonly left: string;
  readonly right: string;
  /** The language's own word for `op`, from `keywords`, when it has one. */
  readonly word?: string;
}

/** The words for one unit, in one language. */
export interface UnitWords {
  readonly aliases: readonly string[];
  readonly symbol?: string;
  /** Keys are whatever this language's `selectForm` returns. */
  readonly forms?: Readonly<Record<string, string>>;
}

/**
 * The words for one kind, in one language. Ships beside the kind that defines
 * it and names that kind by **id string** — never by import, so a translation
 * is shippable by someone who is not the kind's author and `locale/uk` is
 * importable without the ratio tables (spec §10).
 */
export interface Vocabulary {
  readonly locale: string;
  readonly kind: KindId;
  readonly units: Readonly<Record<string, UnitWords>>;
}

/**
 * A language's mechanics, independent of any kind. One package per language.
 *
 * This is the old `Locale` minus everything that was about words for units,
 * plus the writing half. `selectForm` is the only required addition: the
 * engine must not enumerate the world's grammatical categories, so it asks the
 * language for a key and indexes a table with it. `Intl.PluralRules` is the
 * default *implementation*, not the model.
 */
export interface Language {
  /** BCP-47. */
  readonly id: string;

  // --- reading ---
  readonly numberFormat: "intl" | NumberFormatSpec;
  readonly segment?: (run: string) => string[];
  readonly analyze?: readonly Analyzer[];
  readonly numerals?: NumeralParser;
  readonly keywords: Partial<Record<Keyword, readonly string[]>>;

  // --- writing ---
  /** Which key in a unit's `forms` table applies here. */
  selectForm(ctx: FormCtx): string;
  /** Assemble a rendered quantity. Defaults to `defaultRenderQuantity`. */
  renderQuantity?(parts: QuantityParts): string;
  /** Assemble a rendered expression, for `Printer`'s spelled mode. */
  renderExpression?(parts: ExpressionParts): string;
  /** The inverse of `numerals`: 22 -> "twenty two". */
  spell?: NumeralSpeller;

  readonly weights?: Weights;
}

/**
 * A language plus the vocabularies installed with it. Built by
 * `composeLocale`, which is the only thing that may construct one — the
 * validation it does (spec §3) is what makes a bad wiring fail on boot rather
 * than at a keystroke.
 */
export interface Locale {
  readonly id: string;
  readonly language: Language;
  readonly vocabularies: readonly Vocabulary[];
}
```

`Locale`'s old body is entirely replaced. Leave the existing `Lexicon`/`UnitLexeme`/`LocalePack` declarations alone; typecheck will now fail everywhere that reads `locale.analyze` and friends — Task 3 fixes those. To keep **this** task green, do the mechanical `.language.` sweep here as Step 5.

- [ ] **Step 4: Add the two errors**

Append to `packages/core/src/errors.ts`:

```ts
/**
 * A vocabulary handed to `composeLocale` for a language that is not its own.
 * Same philosophy as `KindConflictError`: a bad configuration fails on boot,
 * where the stack names the line that wired it, and never at a keystroke.
 */
export class LocaleMismatchError extends SmartputError {
  readonly locale: string;
  readonly vocabularyLocale: string;
  readonly kind: KindId;
  constructor(locale: string, vocabularyLocale: string, kind: KindId) {
    super(
      `Locale ${JSON.stringify(locale)} was given a ${JSON.stringify(vocabularyLocale)} vocabulary for kind ${JSON.stringify(kind)}`,
      locale,
    );
    this.name = "LocaleMismatchError";
    this.locale = locale;
    this.vocabularyLocale = vocabularyLocale;
    this.kind = kind;
  }
}

/** Two vocabularies for one kind in one language. Names both by kind and locale. */
export class VocabularyConflictError extends SmartputError {
  readonly locale: string;
  readonly kind: KindId;
  constructor(locale: string, kind: KindId) {
    super(
      `Locale ${JSON.stringify(locale)} has two vocabularies for kind ${JSON.stringify(kind)}`,
      locale,
    );
    this.name = "VocabularyConflictError";
    this.locale = locale;
    this.kind = kind;
  }
}
```

- [ ] **Step 5: Write the three modules**

Create `packages/core/src/locale/vocabulary.ts`:

```ts
import { deepFreeze } from "../freeze";
import type { Vocabulary } from "../types";

/**
 * A vocabulary is data, and data that reaches the registry must not change
 * under it — the alias index is built once from these tables and never
 * rebuilt. Deep-frozen for the same reason `defineKind` deep-freezes a
 * descriptor.
 */
export function defineVocabulary(v: Vocabulary): Vocabulary {
  return deepFreeze(v);
}
```

Create `packages/core/src/locale/compose.ts`:

```ts
import { LocaleMismatchError, VocabularyConflictError } from "../errors";
import type { Language, Locale, Vocabulary } from "../types";

/**
 * A language plus its vocabularies, validated once at compose time.
 *
 * What is *not* checked here: that every key a vocabulary's `forms` table
 * declares is one `selectForm` could produce. It cannot be — `selectForm` is a
 * function, not a table — so `assertLocaleContract` covers it in tests
 * instead (spec §9), sampling counts and slots and asserting the key comes
 * back with a word behind it.
 */
export function composeLocale(
  language: Language,
  vocabularies: readonly Vocabulary[] = [],
): Locale {
  const byKind = new Set<string>();
  for (const v of vocabularies) {
    if (v.locale !== language.id) {
      throw new LocaleMismatchError(language.id, v.locale, v.kind);
    }
    if (byKind.has(v.kind)) throw new VocabularyConflictError(language.id, v.kind);
    byKind.add(v.kind);
  }
  return Object.freeze({
    id: language.id,
    language,
    vocabularies: Object.freeze([...vocabularies]),
  });
}
```

Rewrite `packages/core/src/locale/define.ts`:

```ts
import { deepFreeze } from "../freeze";
import type { Language, LocalePack } from "../types";

export function defineLanguage(l: Language): Language {
  return deepFreeze(l);
}

/**
 * @deprecated The P1 bridge — ruling R7. Deleted in Task 7 along with
 * `LocalePack` itself; a pack's content becomes one `Vocabulary` per kind.
 */
export function defineLocalePack(p: LocalePack): LocalePack {
  return deepFreeze(p);
}
```

> `deepFreeze` walks own enumerable properties. `Language` carries methods (`selectForm`), which are own properties of the object literal and freeze fine. Confirm `packages/core/src/freeze.ts` does not choke on a function value — if it recurses into functions, skip them (`typeof v === "function"` continues), and add a test for it in `freeze.test.ts`.

- [ ] **Step 6: Sweep `locale.X` → `locale.language.X` (R4)**

```bash
rg -n "locale\.(analyze|numberFormat|keywords|weights|numerals|spell|segment)\b" packages/core/src packages/*/src
```

For each hit, insert `.language`. `locale.id` does **not** change. Two functions take a `Locale` only to read mechanics and should now take a `Language` outright:

```ts
// packages/core/src/locale/number.ts
export function numberSymbols(language: Language): NumberFormatSpec { /* body unchanged */ }

// packages/core/src/locale/analyze.ts
export function createAnalyzerChain(
  language: Language,
  packs: LocalePack[],
): (surface: string) => AnalyzedForm[] {
  const chain = [
    ...(language.analyze ?? [identity()]),
    ...packs.filter((p) => p.locale === language.id).flatMap((p) => p.analyze ?? []),
  ];
  const ctx = { locale: language.id };
  /* rest unchanged */
}
```

Their callers pass `locale.language`. `formatNumber(value, locale, opts)` likewise becomes `formatNumber(value, language, opts)` — update its five call sites (`format/format.ts`, `print/print.ts` ×2, and the two test files) with `rg -n "formatNumber\("`.

- [ ] **Step 7: Export from the package door**

In `packages/core/src/index.ts`, replace the `defineLocale` export line:

```ts
export { composeLocale } from "./locale/compose";
export { defineLanguage, defineLocalePack } from "./locale/define";
export { defineVocabulary } from "./locale/vocabulary";
```

`export type * from "./types"` already re-exports the new types.

- [ ] **Step 8: Fix the existing English locale so core still compiles**

`packages/core/src/locale/en.ts` currently calls `defineLocale`. Change it to `defineLanguage` and add `selectForm` (Task 4 moves the whole file into its own package):

```ts
const plural = new Intl.PluralRules("en");

export default defineLanguage({
  id: "en",
  numberFormat: "intl",
  analyze: [ /* unchanged */ ],
  numerals: cardinalNumerals(CARDINALS),
  spell: cardinalSpeller(CARDINALS),
  keywords: { /* unchanged */ },
  // "one" | "other" — so every `display` table in the repo becomes a `forms`
  // table with no edit beyond the field name.
  selectForm: ({ count }) => (count === undefined ? "other" : plural.select(count.toNumber())),
});
```

Every test that builds an engine passes this object as `locales: [en]`, and a `Language` is not a `Locale` any more. Make them compose:

```bash
rg -ln "locales: \[(en|coreEn|enLocale)\]" packages
```

In each hit, wrap: `locales: [composeLocale(en)]`. There are ~35; do it mechanically and let typecheck find the stragglers.

- [ ] **Step 9: Run the tests**

```bash
bun test packages/core/src/locale/compose.test.ts packages/core/src/locale/vocabulary.test.ts
bun run typecheck && bun test
```

Expected: PASS, PASS. The parity net must still be green — nothing has changed what the engine reads yet.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/errors.ts packages/core/src/locale packages/core/src/index.ts packages
git commit -m "feat(core): Language, Vocabulary and composeLocale beside the existing lexicon"
```

---

## Task 3: The registry reads vocabularies

The alias index stops coming from `Kind.lexicon` and starts coming from installed vocabularies. Behaviour is identical because a kind that still declares `lexicon` is served by the bridge (R7).

**Files:**
- Modify: `packages/core/src/kind/define.ts`
- Modify: `packages/core/src/kind/registry.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/format/format.ts`, `print/unit-word.ts`, `complete/complete.ts`, `facade/quantity.ts`
- Modify: `packages/core/src/types.ts` (`Kind.typical`, `OpaqueSpec.units`)
- Test: `packages/core/src/kind/registry.test.ts` (extend), `packages/core/src/parity.test.ts` (must stay green)

**Interfaces:**
- Consumes: `Vocabulary`, `UnitWords`, `Locale`, `composeLocale` (Task 2).
- Produces: `buildRegistry(kinds: Kind[], locales?: readonly Locale[]): Registry`; `AliasEntry { kind, unit, locale }`; `Registry.words: Map<string, UnitWords>` keyed `` `${locale}|${kind}|${unit}` ``; `wordsFor(registry, locale, kind, unit): UnitWords | undefined`; `NormalizedUnit { unit, ratio, offset, typical? }` — `lexeme` is gone.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/kind/registry.test.ts`:

```ts
import { composeLocale, defineLanguage, defineVocabulary } from "../index";
import { buildRegistry, wordsFor } from "./registry";

const lang = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: {},
  selectForm: () => "other",
});

const widget = defineKind({
  id: "widget",
  value: { mode: "ratio", canonical: "w", units: { w: 1, kw: 1000 } },
  typical: { kw: [1, 10] },
});

test("aliases come from the installed vocabulary, tagged with its locale", () => {
  const vocab = defineVocabulary({
    locale: "en",
    kind: "widget",
    units: { kw: { aliases: ["kw", "kilowidget"], symbol: "kW" } },
  });
  const registry = buildRegistry([widget], [composeLocale(lang, [vocab])]);

  expect(registry.aliasIndex.get("kilowidget")).toEqual([
    { kind: "widget", unit: "kw", locale: "en" },
  ]);
  expect(wordsFor(registry, "en", "widget", "kw")?.symbol).toBe("kW");
});

test("a unit is indexed under its own key with no vocabulary at all (R2)", () => {
  const registry = buildRegistry([widget]);
  expect(registry.aliasIndex.get("kw")).toEqual([
    { kind: "widget", unit: "kw", locale: "*" },
  ]);
  expect(wordsFor(registry, "en", "widget", "kw")).toBeUndefined();
});

test("typical is read off the kind, not off a lexeme", () => {
  const registry = buildRegistry([widget]);
  expect(registry.kinds.get("widget")?.units.get("kw")?.typical).toEqual([1, 10]);
});

test("a vocabulary naming an unregistered unit is a wiring error", () => {
  const vocab = defineVocabulary({
    locale: "en",
    kind: "widget",
    units: { nope: { aliases: ["nope"] } },
  });
  expect(() => buildRegistry([widget], [composeLocale(lang, [vocab])])).toThrow(UnknownKindError);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/core/src/kind/registry.test.ts
```

Expected: FAIL — `wordsFor is not a function`.

- [ ] **Step 3: Add `Kind.typical` and narrow `OpaqueSpec.units`**

In `packages/core/src/types.ts`:

```ts
export interface OpaqueSpec {
  mode: "opaque";
  /**
   * The kind's unit **ids** — R1. An opaque unit is a label, not a ratio
   * (`datetime`'s are IANA zones), but it is indexed, weighted, formatted and
   * used as an `in` target exactly like a ratio kind's unit. The words for it
   * live in a `Vocabulary`, because words belong to a language.
   */
  units?: readonly string[];
  ordered?: boolean;
  parse?: (token: string, ctx: EvalCtx) => unknown | null;
  equals?: (a: unknown, b: unknown) => boolean;
}

export interface Kind {
  id: KindId;
  value: RatioSpec | OpaqueSpec;
  extendsKind?: KindId;
  prior?: number;
  /** @deprecated P1 bridge — ruling R7. Removed in Task 7. */
  lexicon?: Lexicon;
  /**
   * The magnitude band people actually type each unit in, inclusive at both
   * ends — read only by completion's `scaleFit`. A kind-level map because a
   * magnitude range is physics, not language (spec §4). A unit with no entry
   * scores 0, which is the same as being out of band: declaring a band is
   * never a penalty.
   */
  typical?: Readonly<Record<string, [number, number]>>;
  literals?: LiteralMatcher[];
  completions?: Completer;
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}
```

- [ ] **Step 4: Rework `normalizeKind` and add the bridge**

In `packages/core/src/kind/define.ts`:

```ts
export interface NormalizedUnit {
  unit: string;
  ratio: (ctx: EvalCtx) => Decimal;
  offset: (ctx: EvalCtx) => Decimal;
  /** Read only by completion's `scaleFit`. Kind-level in the descriptor. */
  typical?: [number, number];
}
```

`toLexeme` is deleted. `normalizeKind` builds units from the spec alone:

```ts
export function normalizeKind(k: Kind): NormalizedKind {
  const units = new Map<string, NormalizedUnit>();
  const typical = (unit: string): { typical?: [number, number] } => {
    const band = k.typical?.[unit];
    return band === undefined ? {} : { typical: band };
  };

  if (k.value.mode === "ratio") {
    for (const [unit, raw] of Object.entries(k.value.units)) {
      const def: UnitDef =
        typeof raw === "number" || raw instanceof Decimal ? { ratio: raw } : raw;
      units.set(unit, {
        unit,
        ratio: toDecimalFn(def.ratio, 1),
        offset: toDecimalFn(def.offset, 0),
        ...typical(unit),
      });
    }
  } else {
    // An opaque unit has no scale, but it is still a unit: indexed by alias,
    // chosen by the solver, named by `in`, read by the formatter. The identity
    // ratio keeps toCanonical/fromCanonical total.
    for (const unit of k.value.units ?? []) {
      units.set(unit, {
        unit,
        ratio: toDecimalFn(1, 1),
        offset: toDecimalFn(0, 0),
        ...typical(unit),
      });
    }
  }

  return { /* id, spec, prior, literals, ops, completions, format — unchanged */ };
}

/**
 * The P1 bridge — ruling R7, deleted in Task 7.
 *
 * A kind that still declares `lexicon` (or an `OpaqueSpec.units` map, the
 * shape R1 replaces) is served an `en` vocabulary built from it, so the
 * registry can read vocabularies from this task onward while the eighteen kind
 * packages migrate one commit at a time. The table it produces is byte-for-byte
 * what `toLexeme` used to produce, which is why parity holds across the whole
 * fan-out.
 */
export function legacyVocabulary(k: Kind): Vocabulary | null {
  const entries: Record<string, UnitWords> = {};
  const add = (unit: string, entry: UnitLexeme | string[] | undefined): void => {
    if (entry === undefined) {
      entries[unit] = { aliases: [unit], symbol: unit };
      return;
    }
    const lexeme: UnitLexeme = Array.isArray(entry) ? { aliases: entry } : entry;
    const symbol = lexeme.symbol ?? lexeme.aliases[0] ?? unit;
    entries[unit] = {
      aliases: [...lexeme.aliases],
      symbol,
      ...(lexeme.display ? { forms: { ...lexeme.display } } : {}),
    };
  };

  if (k.value.mode === "ratio") {
    for (const unit of Object.keys(k.value.units)) add(unit, k.lexicon?.[unit]);
  } else {
    const raw = k.value.units;
    if (Array.isArray(raw)) {
      if (k.lexicon === undefined) return null;
      for (const unit of raw) add(unit, k.lexicon[unit]);
    } else {
      for (const [unit, entry] of Object.entries(raw ?? {})) {
        add(unit, k.lexicon?.[unit] ?? (entry as UnitLexeme | string[]));
      }
    }
  }
  if (Object.keys(entries).length === 0) return null;
  return { locale: "en", kind: k.id, units: entries };
}
```

> `k.value.units` for an opaque kind is `readonly string[]` after Step 3, but eighteen packages still pass the old record shape, so the bridge accepts both and `normalizeKind`'s opaque branch must too until Task 7: use `const names = Array.isArray(raw) ? raw : Object.keys(raw ?? {})`.

- [ ] **Step 5: Rebuild the registry around vocabularies**

In `packages/core/src/kind/registry.ts`:

```ts
export interface AliasEntry {
  kind: KindId;
  unit: string;
  /**
   * Which installed language contributed this alias — ruling R6, landing here
   * rather than in P4 because the index is built in one loop and tagging it
   * twice would mean writing the loop twice. `"*"` is the unit's own registry
   * key (R2): language-neutral, and never matched by a `locale:` selector.
   */
  locale: string;
}

export interface Registry {
  kinds: Map<KindId, NormalizedKind>;
  ops: Map<string, OpSignature>;
  aliasIndex: Map<string, AliasEntry[]>;
  literals: Array<{ kind: KindId; matcher: LiteralMatcher }>;
  /** `${locale}|${kind}|${unit}` -> the words that (locale, kind, unit) has. */
  words: Map<string, UnitWords>;
}

const wordsKey = (locale: string, kind: KindId, unit: string): string =>
  `${locale}|${kind}|${unit}`;

/**
 * The words for one unit in one language, or `undefined` when that language
 * ships none for it — which is I10's degradation path, not an error: a
 * half-translated language renders `5 kg` awkwardly rather than throwing at a
 * user, and `assertLocaleContract` is what fails it in tests.
 */
export function wordsFor(
  registry: Registry,
  locale: string,
  kind: KindId,
  unit: string,
): UnitWords | undefined {
  return registry.words.get(wordsKey(locale, kind, unit));
}

export function buildRegistry(
  kinds: Kind[],
  locales: readonly Locale[] = [],
  packs: LocalePack[] = [],
): Registry {
  // Passes 1, 2 and 4 (base kinds, patches, op table) are unchanged except
  // that pass 2 no longer merges lexemes — a patch kind adds units and
  // signatures; its words arrive as a vocabulary like everyone else's.
  ...

  // Pass 3: vocabularies. Every installed locale's own, plus the bridge's for
  // any kind that still declares `lexicon` and has no real vocabulary yet
  // (ruling R7 — this half is deleted in Task 7 with the `packs` parameter).
  const words = new Map<string, UnitWords>();
  const install = (vocab: Vocabulary): void => {
    const kind = normalized.get(vocab.kind);
    if (kind === undefined) throw new UnknownKindError(vocab.locale, vocab.kind);
    for (const [unit, entry] of Object.entries(vocab.units)) {
      if (!kind.units.has(unit)) throw new UnknownKindError(vocab.locale, vocab.kind, unit);
      const key = wordsKey(vocab.locale, vocab.kind, unit);
      const existing = words.get(key);
      // A real vocabulary always wins over the bridge; two real ones for the
      // same kind were already refused by composeLocale.
      words.set(key, existing === undefined ? entry : mergeWords(existing, entry));
    }
  };

  const installedKinds = new Set<string>();
  for (const locale of locales) {
    for (const vocab of locale.vocabularies) {
      install(vocab);
      installedKinds.add(`${locale.id}|${vocab.kind}`);
    }
  }
  for (const k of kinds) {
    if (installedKinds.has(`en|${k.id}`)) continue;
    const bridged = legacyVocabulary(k);
    if (bridged !== null) install(bridged);
  }
  for (const pack of packs) {
    for (const [kindId, lexicon] of Object.entries(pack.contributes)) {
      install(legacyPackVocabulary(pack.locale, kindId, lexicon));
    }
  }

  // Pass 5: alias index, deterministically ordered. Kind ids sorted, unit
  // names sorted, then locales sorted — so the entry list for one surface is
  // the same on every run and in every process.
  const aliasIndex = new Map<string, AliasEntry[]>();
  const push = (alias: string, entry: AliasEntry, fold: string): void => {
    const list = aliasIndex.get(fold) ?? [];
    if (!list.some((e) => e.kind === entry.kind && e.unit === entry.unit && e.locale === entry.locale)) {
      list.push(entry);
    }
    aliasIndex.set(fold, list);
  };
  const localeIds = [...new Set(locales.map((l) => l.id))].sort();
  for (const kindId of [...normalized.keys()].sort()) {
    const kind = normalized.get(kindId);
    if (kind === undefined) continue;
    for (const unitName of [...kind.units.keys()].sort()) {
      // R2: the unit's own key, always, language-neutral.
      push(unitName, { kind: kindId, unit: unitName, locale: "*" }, unitName.toLowerCase());
      for (const localeId of localeIds.length > 0 ? localeIds : ["en"]) {
        const entry = words.get(wordsKey(localeId, kindId, unitName));
        for (const alias of entry?.aliases ?? []) {
          push(alias, { kind: kindId, unit: unitName, locale: localeId }, alias.toLocaleLowerCase(localeId));
        }
      }
    }
  }
  ...
  return { kinds: normalized, ops, aliasIndex, literals, words };
}
```

`mergeWords` replaces `mergeLexeme` and unions aliases the same way, keeping the patch's `symbol`/`forms` where present:

```ts
function mergeWords(base: UnitWords, patch: UnitWords): UnitWords {
  const symbol = patch.symbol ?? base.symbol;
  return {
    aliases: [...new Set([...base.aliases, ...patch.aliases])],
    ...(symbol !== undefined ? { symbol } : {}),
    ...(patch.forms || base.forms ? { forms: { ...base.forms, ...patch.forms } } : {}),
  };
}
```

- [ ] **Step 6: Point every `lexeme` reader at `wordsFor`**

```bash
rg -n "\.lexeme" packages/core/src
```

Five shipping call sites, each a mechanical rewrite:

```ts
// format/format.ts — formatValue tail (grammar arrives in Task 8; this is the
// same behaviour reached through the new lookup)
const words = wordsFor(registry, locale.id, value.kind, value.unit);
const category = new Intl.PluralRules(locale.id).select(authored.toNumber());
const display = words?.forms?.[category];
if (display !== undefined) return `${numberText} ${display}`;
return `${numberText}${words?.symbol ?? value.unit}`;

// print/unit-word.ts — `unitWord` and `avoidSpellings` both take `registry`
// and `locale` already; replace
//   registry.kinds.get(c.kind)?.units.get(c.unit)?.lexeme
// with
//   wordsFor(registry, locale.id, c.kind, c.unit)
// and `lexeme.display` with `words.forms`.

// complete/complete.ts
scaleFit(count, unit.typical) -                                   // was unit.lexeme.typical
const word = wordsFor(registry, locale.id, entry.kind, entry.unit)?.forms?.[category] ?? alias;

// facade/quantity.ts
for (const [name, unit] of kind.units) {
  const words = wordsFor(registry, locale.id, kind.id, name);
  claim(name, name);
  claim(words?.symbol, name);
  for (const form of Object.values(words?.forms ?? {})) claim(form, name);
}
```

- [ ] **Step 7: Thread locales through the engine**

In `packages/core/src/engine.ts`:

```ts
const registry = buildRegistry(opts.kinds ?? [], opts.locales, opts.packs ?? []);
```

`opts.locales[0]` still selects the one locale everything downstream uses; multi-locale recognition is P4. `weightLayers` reads `locale.language.weights`.

- [ ] **Step 8: Run the tests**

```bash
bun test packages/core/src/kind/registry.test.ts
bun test packages/core/src/parity.test.ts
bun run check
```

Expected: PASS, PASS with **zero** snapshot diffs, green. A parity diff here means the bridge is not reproducing `toLexeme` — fix the bridge, never the snapshot.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): build the alias index from vocabularies, with a bridge for lexicon"
```

---

## Task 4: `@smartput/locale-en` — SUPERSEDED

> **Executed, then reversed.** R9's reversal (2026-08-08) folded this package back into core; the English language is `packages/core/src/locale/en.ts` behind the `@smartput/core/locale/en` subpath, exactly where this task moved it *from*. The steps below are kept as the record of what was done and undone. **Do not execute them.**

Moves the English language out of core into its own package, per spec §10, and rewrites every import in the repo (R9).

**Files:**
- Create: `packages/locale-en/package.json`, `packages/locale-en/src/index.ts`, `packages/locale-en/src/english.ts`, `packages/locale-en/src/english.test.ts`
- Delete: `packages/core/src/locale/en.ts` (and its `./locale/en` export from `packages/core/package.json`)
- Modify: ~35 test files across packages; `scripts/check-deps.ts`
- Test: `packages/locale-en/src/english.test.ts`

**Interfaces:**
- Consumes: `defineLanguage`, `cardinalNumerals`, `cardinalSpeller`, `identity`, `suffixStripper` from `@smartput/core` (Task 2).
- Produces: `import { english } from "@smartput/locale-en"` — a `Language` with `id: "en"`; also the default export, so `import english from "@smartput/locale-en"` works.

- [ ] **Step 1: Write the failing test**

Create `packages/locale-en/src/english.test.ts`:

```ts
import { Decimal } from "@smartput/core";
import { describe, expect, test } from "bun:test";
import { english } from "./english";

describe("english", () => {
  test("is a Language with the CLDR plural categories", () => {
    expect(english.id).toBe("en");
    expect(english.selectForm({ count: new Decimal(1), kind: "mass", unit: "kg", slot: "bare" })).toBe("one");
    expect(english.selectForm({ count: new Decimal(2), kind: "mass", unit: "kg", slot: "bare" })).toBe("other");
    expect(english.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" })).toBe("other");
  });

  test("reads and spells cardinals through one table", () => {
    expect(english.numerals?.(["twenty", "two"])).toEqual({ value: new Decimal(22), consumed: 2 });
    expect(english.spell?.(new Decimal(22))).toBe("twenty two");
  });

  test("claims the conversion keywords it always did", () => {
    expect(english.keywords.in).toEqual(["in", "to", "as"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/locale-en/src/english.test.ts
```

Expected: FAIL — the package does not exist.

- [ ] **Step 3: Create the package**

`packages/locale-en/package.json`:

```json
{
  "name": "@smartput/locale-en",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "dependencies": {
    "@smartput/core": "workspace:*",
    "decimal.js": "^10.4.3"
  }
}
```

> Check the `decimal.js` version against `packages/core/package.json` and use exactly that range.

`packages/locale-en/src/english.ts` is `packages/core/src/locale/en.ts` moved verbatim, with three edits: import from `@smartput/core` instead of relative paths, `defineLanguage` instead of `defineLocale`, and the `selectForm` from Task 2 Step 8. Export it **named as well as default**:

```ts
export const english: Language = defineLanguage({ /* ... */ });
export default english;
```

`packages/locale-en/src/index.ts`:

```ts
export { english, english as default } from "./english";
```

- [ ] **Step 4: Delete the old home and rewrite the imports**

```bash
git rm packages/core/src/locale/en.ts
rg -l '@smartput/core/locale/en' packages | xargs sed -i '' 's|import \(.*\) from "@smartput/core/locale/en"|import { english as \1 } from "@smartput/locale-en"|'
```

That leaves `import { english as en }` / `{ english as coreEn }` shapes, which are fine and keep every call site's local name. Inside core's own tests use a relative-free import too — core devDependencies the package:

```bash
rg -n '"./locale/en"' packages/core/src   # core's own tests
```

Remove the `./locale/en` entry from `packages/core/package.json`'s `exports`, add `"@smartput/locale-en": "workspace:*"` to `devDependencies` of `packages/core/package.json` and of every package whose **tests** import it (`rg -l "@smartput/locale-en" packages | cut -d/ -f2 | sort -u`).

- [ ] **Step 5: Teach check-deps about the new package**

In `scripts/check-deps.ts`'s `ALLOWED`:

```ts
  // One package per language (spec §10). It is the words-free half — analyzers,
  // cardinals, keywords, plural selection, render defaults — so it names no kind
  // package and no kind package names it: a vocabulary reaches its language
  // only through `composeLocale`, at the integrator's own wiring.
  "packages/locale-en/package.json": ["@smartput/core", "decimal.js"],
```

- [ ] **Step 6: Run the tests**

```bash
bun test packages/locale-en/src/english.test.ts
bun run check
```

Expected: PASS, green — including `check-deps` and `build` (the new package must build; `scripts/build.ts` discovers packages from `exports`).

- [ ] **Step 7: Commit**

```bash
git add -A packages/locale-en packages/core scripts/check-deps.ts packages
git commit -m "feat(locale-en): give English its own package and delete core/locale/en"
```

---

## Task 5: `mass` — the worked exemplar for every kind package

The template Task 6's twenty agents copy. Do it once, carefully, and read the diff before fanning out.

**Files:**
- Create: `packages/mass/src/locale/en.ts`, `packages/mass/src/locale/en.test.ts`
- Modify: `packages/mass/src/index.ts`, `packages/mass/package.json`
- Test: `packages/mass/src/locale/en.test.ts`, `packages/mass/src/validate.test.ts` (existing, must stay green)

**Interfaces:**
- Consumes: `defineVocabulary` (Task 2), `aliasesFor` (existing, from `@smartput/core`).
- Produces: `import massEn from "@smartput/mass/locale/en"` — a `Vocabulary` with `locale: "en"`, `kind: "mass"`, one entry per unit of `MASS_UNITS`.

- [ ] **Step 1: Write the failing test**

Create `packages/mass/src/locale/en.test.ts`:

```ts
import { composeLocale, createEngine } from "@smartput/core";
import english from "@smartput/core/locale/en";
import { describe, expect, test } from "bun:test";
import { mass } from "../index";
import massEn from "./en";

describe("mass en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(mass)).not.toMatch(/kilogram|pound|ounce|tonne/i);
  });

  test("an engine built from it reads and writes English mass", () => {
    const engine = createEngine({ locales: [composeLocale(english, [massEn])], kinds: [mass] });
    expect(engine.evaluate("1.5 kilograms").formatted).toBe("1.5 kilograms");
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1.5 kilograms");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/mass/src/locale/en.test.ts
```

Expected: FAIL — `Cannot find module './en'`.

- [ ] **Step 3: Write the vocabulary**

Create `packages/mass/src/locale/en.ts`. The content is the `lexicon` block from `src/index.ts`, moved: `display` becomes `forms`, `typical` does not come along (Step 4 puts it on the kind), and `aliases` keeps deriving from `MASS_UNITS` so `units.ts` stays the single source of English aliases (spec §12's amendment to the validate spec).

```ts
import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * English words for the mass units.
 *
 * The kind next door names no language at all (I1): it is ratios and ids. This
 * file is the only place in the package an English word appears, which is what
 * `packages/kinds/src/english-freedom.test.ts` asserts.
 *
 * `aliases` derives from `units.ts` rather than being written out again, so the
 * micro path (`parseMass`) and the engine path agree by construction — the
 * cross-path test in the validate plan depends on exactly that.
 */
export default defineVocabulary({
  locale: "en",
  kind: "mass",
  units: {
    mg: { aliases: alias("mg"), symbol: "mg", forms: { one: "milligram", other: "milligrams" } },
    g: { aliases: alias("g"), symbol: "g", forms: { one: "gram", other: "grams" } },
    kg: { aliases: alias("kg"), symbol: "kg", forms: { one: "kilogram", other: "kilograms" } },
    t: { aliases: alias("t"), symbol: "t", forms: { one: "tonne", other: "tonnes" } },
    oz: { aliases: alias("oz"), symbol: "oz", forms: { one: "ounce", other: "ounces" } },
    lb: { aliases: alias("lb"), symbol: "lb", forms: { one: "pound", other: "pounds" } },
  },
});
```

- [ ] **Step 4: Strip the kind**

`packages/mass/src/index.ts` becomes:

```ts
import { decimalRatios, defineKind } from "@smartput/core";
import { MASS_UNITS } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: MASS_UNITS.canonical,
    units: decimalRatios(MASS_UNITS),
  },
  // Physics, not language (spec §4): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    mg: [1, 2000],
    g: [1, 1000],
    kg: [0.1, 500],
    t: [0.1, 200],
    oz: [0.5, 100],
    lb: [0.5, 500],
  },
});
```

`aliasesFor` is no longer imported here — it moved to the vocabulary.

- [ ] **Step 5: Add the subpath**

In `packages/mass/package.json`'s `exports`, after `./class`:

```json
    "./locale/en": {
      "bun": "./src/locale/en.ts",
      "types": "./dist/locale/en.d.ts",
      "default": "./dist/locale/en.js"
    }
```

Condition order is pinned (`bun`, `types`, `default`) — `check-deps` fails otherwise.

- [ ] **Step 6: Run the tests**

```bash
bun test packages/mass
bun test packages/core/src/parity.test.ts
bun run check
```

Expected: PASS, PASS with zero diffs, green. Parity holds because `BUILTIN_KINDS`-based engines get mass's words from the bridge until Task 7 wires the barrel — and the bridge now finds no `lexicon` on mass, so **`packages/kinds`'s engine must already receive the vocabulary**. Wire it now, in this task, by adding the barrel entry:

```ts
// packages/kinds/src/locale/en.ts  (created here, filled in by Task 6 and 7)
import type { Vocabulary } from "@smartput/core";
import massEn from "@smartput/mass/locale/en";

/**
 * Every built-in `en` vocabulary, as one array. Documented as a convenience,
 * not as the byte-safe default: importing it links every kind's words, which
 * is exactly what a bundle-conscious consumer imports one at a time to avoid —
 * the same caveat the validate spec's barrels carry.
 */
const BUILTIN_EN: readonly Vocabulary[] = [massEn];
export default BUILTIN_EN;
```

with the matching `./locale/en` subpath in `packages/kinds/package.json`, and update every engine built over `BUILTIN_KINDS` in the repo's tests to `composeLocale(english, BUILTIN_EN)`:

```bash
rg -ln "BUILTIN_KINDS" packages | xargs rg -l "composeLocale\(english\)"
```

- [ ] **Step 7: Commit**

```bash
git add packages/mass packages/kinds
git commit -m "feat(mass): move English words into locale/en and relocate typical"
```

---

## Task 6: Fan-out — the other twenty packages

**One agent per row.** Every row is the same recipe as Task 5, applied to a different directory. Exactly **one** file is shared: `packages/kinds/src/locale/en.ts`, the barrel, where every row appends two lines (an import and an array entry). That append is what keeps parity green *during* the fan-out — a package that has dropped its `lexicon` but is not in the barrel has no words in a `BUILTIN_KINDS` engine, and the parity net would go red until Task 7. Conflicts there are append-only and resolve by keeping both lines; if agents run in worktrees, merge them one at a time.

### The recipe (identical for every row)

1. Read `packages/<pkg>/src/index.ts`. Copy the `lexicon` block into a new `src/locale/<kind>.en.ts`-shaped file — `src/locale/en.ts` for a one-kind package.
2. In the copy: `display:` → `forms:`, and delete `typical:` from every entry.
3. Add `symbol` to any unit that has none, using the value `toLexeme` computed: explicit `symbol`, else `aliases[0]`, else the unit key (**R8** — a missing symbol moves a byte).
4. In `src/index.ts`: delete `lexicon`, add `typical: { ... }` collecting the bands you deleted in (2). If no unit had a `typical`, add nothing.
5. For an **opaque** kind: `value.units` becomes `readonly string[]` of the ids (R1); the aliases and symbols that were in the record go into the vocabulary.
6. Add the `./locale/en` subpath to `package.json` in the pinned condition order.
7. Append your vocabulary to `packages/kinds/src/locale/en.ts` — one import line, one array entry, alphabetical. Skip this for `measure` (not in `BUILTIN_KINDS`), `boolean` (no vocabulary), and rows 17–20, whose kinds are not built-ins.
8. Write `src/locale/en.test.ts` — copy Task 5's four tests, swapping the kind, the units and the English words the third test greps for.
9. Run `bun test packages/<pkg>`, `bun test packages/core/src/parity.test.ts` (zero diffs) and `bun run typecheck`. Commit as `feat(<pkg>): move English words into locale/en`.

> A kind whose aliases come from a `UnitTable` keeps deriving them with `aliasesFor(<TABLE>, unit)` — do not inline the strings. That is what keeps the micro path and the engine path in agreement.

### The rows

| # | Package | Kind id(s) | Anything unusual |
| --- | --- | --- | --- |
| 1 | `angle` | `angle` | Symbols `°`, `rad`, `grad`, `turn` — keep them exactly. |
| 2 | `area` | `area` | Symbols are `m²`, `cm²`, `km²` — the superscript form, unchanged. |
| 3 | `boolean` | `boolean` | **No vocabulary at all.** `value.units` becomes `[BOOLEAN_UNIT]`; the unit registered `aliases: []` and a `symbol` nothing reads (the kind has its own `format` hook). Add `packages/boolean/src/index.test.ts` coverage asserting `engine.evaluate("1 kg > 500 g").formatted === "true"` still holds. No `./locale/en` subpath. |
| 4 | `datarate` | `datarate` | Bridging kind; its ops name operand kinds by string and are untouched. |
| 5 | `datasize` | `datasize` | — |
| 6 | `duration` | `duration` | — |
| 7 | `energy` | `energy` | Bridging kind. |
| 8 | `length` | `length` | Read the `in`-alias comment in `src/index.ts` before moving it: the note about `in` reaching `lex` as a keyword belongs beside the alias list, so it moves into the vocabulary with it. |
| 9 | `measure` | `measure` | Declares `dpiUnit`; that stays on the kind. Not in `BUILTIN_KINDS`, so nothing in the barrel changes. |
| 10 | `number` | `number` | One unit `one`, `symbol: ""` — the empty string is deliberate (`NUMBER_KIND` short-circuits before the symbol is read). Keep it exactly, and keep `aliases: alias("one")`. |
| 11 | `percent` | `percent` | Aliases come from `units.ts`; check `src/units.ts`'s comment about the hand-written lexicon it replaced and keep the note with the words. |
| 12 | `power` | `power` | — |
| 13 | `speed` | `speed` | Symbols include `m/s`, `km/h` — slashes and all. |
| 14 | `temperature` | `temperature`, `tempdelta` | **Two kinds, two vocabularies, one file.** `src/locale/en.ts` default-exports an *array* of both. The two register the identical alias list (including the decorative `°c` entries) — that is load-bearing for `print/unit-word.ts`'s ambiguity fallback, so copy both lists verbatim. |
| 15 | `tempo` | `tempo` | `src/units.ts` has a comment about `bpm` having no display form. Preserve the shape it describes. |
| 16 | `volume` | `volume` | — |
| 17 | `money` (`packages/rate` + `packages/currency`) | `money` | `currencyLexicon()` in `packages/currency/src/lexicon.ts` **generates** the table. It becomes `currencyVocabulary(locale = "en"): Vocabulary` returning `{ locale, kind: "money", units }`, and `packages/rate/src/money.ts` drops its `lexicon` field. Also fold in `packages/rate/src/locale/en.ts` — today a `LocalePack` contributing `quid`/`sterling`/`buck`/`bucks`/`euros` — as extra aliases on the same vocabulary (`defineLocalePack` disappears in Task 7). Keep `packages/rate/src/locale/en.test.ts` passing by rewriting its assertions against the vocabulary. |
| 18 | `datetime` | `datetime` | Opaque, units are IANA zones. `value.units` becomes the zone-id array (R1); zone aliases and the existing pack in `src/locale/en.ts` (`universal`, `manhattan`, `hollywood`, `england`, `britain`, `france`, `germany`, `ukraine`, `japan`, `china`, `india`, `australia`, `nz`) merge into **one** `defineVocabulary({ locale: "en", kind: DATETIME_KIND, units })`. `packages/datetime/src/locale/en.test.ts` is rewritten to assert against it. Note in the file's doc comment that a `uk` datetime vocabulary is what P3 adds beside it — that is the seam the pack existed to prove. |
| 19 | `place` (`packages/country`) | `place` | `COUNTRY_UNITS` (`src/place.ts`) builds `Record<string, UnitLexeme>` from `COUNTRIES`, filtered by `MIN_NAME_LENGTH`, with `symbol: row.name`. Split it: `value.units` is `COUNTRIES.map(r => r.a2)`, and `src/locale/en.ts` generates the vocabulary from the same rows. `packages/country/src/ambiguity.test.ts` and `completion.test.ts` build engines — update their wiring. |
| 20 | `ranges` (`packages/date`, `time`, `date-range`, `time-range`, `datetime-range`, `range`) | six opaque kinds | Mechanical only: each declares `units: { [X_UNIT]: { aliases: [], symbol: "" } }` or similar. Each becomes `units: [X_UNIT]` and ships **no** vocabulary — they are structural placeholders with their own `format` hooks. One agent, one commit, six one-line edits plus whatever typecheck reports. |

- [ ] **Step 1 (per row): Follow the recipe above, in order**
- [ ] **Step 2 (per row): `bun test packages/<pkg> && bun run typecheck`** — Expected: PASS
- [ ] **Step 3 (per row): Commit** — `feat(<pkg>): move English words into locale/en`

---

## Task 7: Delete the bridge

`lexicon`, `UnitLexeme`, `Lexicon`, `LocalePack`, `defineLocalePack`, `EngineOptions.packs` and `legacyVocabulary` all go. After this task, a kind package contains no natural-language word outside `src/locale/`, and a test enforces it.

**Files:**
- Modify: `packages/core/src/types.ts`, `kind/define.ts`, `kind/registry.ts`, `locale/define.ts`, `locale/analyze.ts`, `engine.ts`, `index.ts`
- Modify: `packages/kinds/src/locale/en.ts`, `packages/kinds/package.json`
- Create: `packages/kinds/src/english-freedom.test.ts`
- Modify: `docs/guide/kinds.md`, `docs/guide/locales.md`, `docs/guide/defining-a-kind.md`
- Modify: `docs/superpowers/specs/2026-08-05-smartputs-validate-design.md`, `docs/superpowers/specs/2026-08-05-smartputs-stages-design.md` (spec §12's amendments, recorded where the specs live)

**Interfaces:**
- Consumes: every vocabulary from Tasks 5 and 6.
- Produces: `BUILTIN_EN` (default export of `@smartput/kinds/locale/en`) — `readonly Vocabulary[]`, every built-in kind's English words; `buildRegistry(kinds, locales)` with the third parameter gone.

- [ ] **Step 1: Write the failing test**

Create `packages/kinds/src/english-freedom.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

/**
 * What keeps I1 true a year from now: a kind descriptor is language-free, and
 * the only place an English word may appear in a kind package is `src/locale/`.
 *
 * The word list is unit *names*, not every English word — a doc comment is
 * prose and always will be. So the grep is over string literals: a source line
 * containing a quoted member of the list, outside `src/locale/` and outside a
 * comment, is a word that escaped its vocabulary.
 */
const WORDS = [
  "kilogram", "gram", "milligram", "tonne", "ounce", "pound",
  "metre", "meter", "kilometre", "kilometer", "mile", "inch", "foot", "yard",
  "second", "minute", "hour", "day", "week", "degree", "radian", "turn",
  "byte", "kilobyte", "megabyte", "gigabyte", "watt", "joule", "calorie",
  "litre", "liter", "gallon", "celsius", "fahrenheit", "kelvin", "percent",
];

const PACKAGES = [
  "angle", "area", "datarate", "datasize", "duration", "energy", "length",
  "mass", "measure", "number", "percent", "power", "speed", "temperature",
  "tempo", "volume",
];

describe("english freedom", () => {
  for (const pkg of PACKAGES) {
    test(`${pkg} names no English unit word outside src/locale`, async () => {
      const offenders: string[] = [];
      for (const file of new Glob(`packages/${pkg}/src/**/*.ts`).scanSync(
        new URL("../../..", import.meta.url).pathname,
      )) {
        if (file.includes("/locale/") || file.endsWith(".test.ts")) continue;
        const text = await Bun.file(new URL(`../../../${file}`, import.meta.url)).text();
        for (const line of text.split("\n")) {
          const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
          for (const word of WORDS) {
            if (code.includes(`"${word}`) || code.includes(`'${word}`)) {
              offenders.push(`${file}: ${line.trim()}`);
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  test("no kind package source is non-ASCII outside src/locale", async () => {
    const offenders: string[] = [];
    for (const pkg of PACKAGES) {
      for (const file of new Glob(`packages/${pkg}/src/**/*.ts`).scanSync(
        new URL("../../..", import.meta.url).pathname,
      )) {
        if (file.includes("/locale/") || file.endsWith(".test.ts")) continue;
        const text = await Bun.file(new URL(`../../../${file}`, import.meta.url)).text();
        // Symbols the kind legitimately keeps: none. `°`, `²`, `µ` are all
        // vocabulary now.
        const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        if (/[^\x00-\x7F]/.test(stripped)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

> `units.ts` holds the `alias` map that vocabularies derive from — the single source of English aliases the validate spec pins (§12). Exempt it explicitly by adding `|| file.endsWith("/units.ts")` to both skips, and say so in the test's doc comment: the table is data a vocabulary reads, and moving it would give the micro path a second copy.

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/kinds/src/english-freedom.test.ts
```

Expected: FAIL, listing whatever Task 6 missed. Fix those in this task; they are the real yield of the test.

- [ ] **Step 3: Fill the barrels**

`packages/kinds/src/locale/en.ts` imports every built-in vocabulary (seventeen kinds across sixteen packages — `temperature` contributes two, `boolean` none) and default-exports the flattened array. `packages/kinds/package.json` gains the `./locale/en` subpath and no new dependency (every kind package is already a dependency).

- [ ] **Step 4: Delete the bridge**

- `packages/core/src/types.ts`: delete `Lexicon`, `UnitLexeme`, `LocalePack`, and `Kind.lexicon`.
- `packages/core/src/kind/define.ts`: delete `legacyVocabulary`; the opaque branch of `normalizeKind` takes only `readonly string[]`.
- `packages/core/src/kind/registry.ts`: `buildRegistry(kinds, locales)` — third parameter and the bridge loops gone.
- `packages/core/src/locale/define.ts`: delete `defineLocalePack`.
- `packages/core/src/locale/analyze.ts`: `createAnalyzerChain(language)` — the `packs` parameter goes; call sites drop their `[]`/`opts.packs`.
- `packages/core/src/engine.ts`: delete `EngineOptions.packs`. `UnknownKindError`'s mention in `NEVER_SWALLOWED`'s doc comment refers to "a locale pack contributing to a kind that does not exist" — reword to "a vocabulary naming a kind that does not exist"; the error itself still fires, from `install`.
- `packages/core/src/index.ts`: drop `defineLocalePack` from the export list.

Then fix the fallout:

```bash
rg -n "packs|LocalePack|defineLocalePack|lexicon|Lexicon|UnitLexeme" packages --glob '!**/dist/**'
```

Every remaining hit is a test that passed `packs:` — rewrite it to compose the vocabulary into the locale instead. `packages/timezone/src/zones.ts` and `packages/query/src/shop.fixture.ts` are the two non-test files in the list.

- [ ] **Step 5: Update the docs and the sibling specs**

- `docs/guide/kinds.md`: the patch-kind example at line ~183 uses `lexicon: { "#ff0000": [...] }`; rewrite it as a vocabulary composed alongside. The merge table row `lexicon, units, literals, ops` loses `lexicon`.
- `docs/guide/locales.md`: rewrite around `Language` / `Vocabulary` / `composeLocale`, including the install flow from spec §3.
- `docs/guide/defining-a-kind.md`: `typical` is kind-level; words ship in `locale/en`.
- `docs/superpowers/specs/2026-08-05-smartputs-validate-design.md` §4 and `...-stages-design.md` §4.6: append the amendment paragraphs spec §12 dictates, marked as amendments with a pointer back to the i18n spec.

- [ ] **Step 6: Run everything**

```bash
bun test packages/kinds/src/english-freedom.test.ts
bun test packages/core/src/parity.test.ts
bun run check
```

Expected: PASS, PASS with zero diffs, green. **P1 is done when this is true.**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core)!: remove lexicon, LocalePack and packs; vocabulary is the only home for words"
```

---

## Task 8: `forms` and `selectForm`

Grammar. The engine stops calling `Intl.PluralRules` itself and asks the language for a key.

**Files:**
- Modify: `packages/core/src/format/format.ts`, `print/unit-word.ts`, `complete/complete.ts`
- Modify: `packages/core/src/types.ts` (`FormatCtx`)
- Test: `packages/core/src/format/format.test.ts`, `packages/core/src/print/print.test.ts` (existing, must stay green), new cases below

**Interfaces:**
- Consumes: `Language.selectForm`, `FormCtx`, `wordsFor` (Tasks 2–3).
- Produces: `FormatCtx.selectForm(ctx: Omit<FormCtx, "kind" | "unit">): string` — pre-bound to the value's kind and unit, for `Kind.format` hooks.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/format/format.test.ts`:

```ts
test("the language chooses the form key, not Intl", () => {
  const shouty = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    // Deliberately not a CLDR category: proves the engine indexes whatever key
    // it is handed rather than enumerating categories of its own.
    selectForm: ({ count }) => (count?.eq(1) ? "singular" : "plural"),
  });
  const vocab = defineVocabulary({
    locale: "en",
    kind: "mass",
    units: { kg: { aliases: ["kg"], symbol: "kg", forms: { singular: "kilogram", plural: "kilogrammes" } } },
  });
  const engine = createEngine({ locales: [composeLocale(shouty, [vocab])], kinds: [mass, number] });
  expect(engine.evaluate("2 kg").formatted).toBe("2 kilogrammes");
  expect(engine.evaluate("1 kg").formatted).toBe("1 kilogram");
});

test("a unit with no words at all degrades to its key (I10)", () => {
  const bare = composeLocale(english);
  const engine = createEngine({ locales: [bare], kinds: [mass, number] });
  expect(engine.evaluate("2 kg").formatted).toBe("2 kg");
});

test("the slot reaches selectForm", () => {
  const slots: string[] = [];
  const spy = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: ({ slot }) => { slots.push(slot); return "other"; },
  });
  const engine = createEngine({ locales: [composeLocale(spy, [massEn])], kinds: [mass, number] });
  engine.evaluate("2 kg");
  expect(slots).toContain("bare");
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/core/src/format/format.test.ts
```

Expected: FAIL — the shouty language's keys are never looked up; output is `2 kg`.

- [ ] **Step 3: Rewrite `formatValue`'s tail**

```ts
  const { rounding: _hookOnly, ...trim } = opts;
  const numberText = formatNumber(authored, locale.language, trim);
  if (value.kind === NUMBER_KIND) return numberText;

  const language = locale.language;
  const words = wordsFor(registry, locale.id, value.kind, value.unit);
  // `formatValue` renders a finished Value with no expression around it, so
  // the slot is always "bare". `Printer` is what knows a real position — which
  // is why Ukrainian's case government after `in` is only correct through the
  // Printer, and saying so is cheaper than inventing a slot to guess with.
  const slot = "bare" as const;
  const key = language.selectForm({
    count: authored,
    kind: value.kind,
    unit: value.unit,
    slot,
  });
  const form = words?.forms?.[key];

  return (language.renderQuantity ?? defaultRenderQuantity)({
    number: numberText,
    ...(form !== undefined ? { form } : {}),
    ...(words?.symbol !== undefined ? { symbol: words.symbol } : {}),
    kind: value.kind,
    unit: value.unit,
    slot,
  });
```

Create `packages/core/src/locale/render.ts`:

```ts
import type { ExpressionParts, QuantityParts } from "../types";

/**
 * What every language gets unless it says otherwise, and an exact reproduction
 * of the template `formatValue` used to inline: a word wins, then a symbol
 * (set tight against the number, as `5kg` always was), then I10's graceful
 * degradation to the unit key.
 *
 * The third branch is unreachable for any language shipping a complete
 * vocabulary — every unit carries a symbol (R8) — and exists for the
 * half-translated case, where rendering `5 kg` awkwardly is the correct
 * outcome and throwing is not.
 */
export const defaultRenderQuantity = (p: QuantityParts): string =>
  p.form !== undefined
    ? `${p.number} ${p.form}`
    : p.symbol !== undefined
      ? `${p.number}${p.symbol}`
      : `${p.number} ${p.unit}`;

/**
 * Symbolic operators with single spaces — which is what `mode: "canonical"`
 * already needs, so the two share one implementation rather than drifting.
 */
export const defaultRenderExpression = (p: ExpressionParts): string =>
  `${p.left} ${p.word ?? p.op} ${p.right}`;
```

- [ ] **Step 4: Do the same in `unit-word.ts` and `complete.ts`**

`unit-word.ts`'s spelled branch:

```ts
  if (spell !== undefined) {
    const words = wordsFor(registry, locale.id, kindId, unitId);
    const key = locale.language.selectForm({
      ...(spell.magnitude !== undefined ? { count: spell.magnitude } : {}),
      kind: kindId,
      unit: unitId,
      slot: spell.slot,
    });
    const word = words?.forms?.[key];
    if (word !== undefined && !avoid.has(fold(word))) return word;
  }
```

`UnitWordOptions.spell` gains `readonly slot: Slot` — `renderQuantity` passes `"after-number"`, `renderTarget` passes `"conversion-target"`. With `count` absent, English's `selectForm` returns `"other"`, exactly what the hardcoded `"other"` did (R5), so the spelled-print tests stay byte-identical.

`complete.ts` replaces its module-level `category` with a per-row call:

```ts
      const key = locale.language.selectForm({
        ...(count === undefined ? {} : { count }),
        kind: entry.kind,
        unit: entry.unit,
        slot: "after-number",
      });
      const word = wordsFor(registry, locale.id, entry.kind, entry.unit)?.forms?.[key] ?? alias;
```

- [ ] **Step 5: Extend `FormatCtx` for kind hooks**

```ts
export interface FormatCtx extends FormatOptions {
  readonly locale: string;
  readonly authored: Decimal;
  formatNumber(value: Decimal, opts?: FormatOptions): string;
  /**
   * The form key for this value, pre-bound to its kind and unit — spec §6. A
   * hook that renders a word must select it the way the engine does, for the
   * same reason it must render numbers through `formatNumber`: money's hook
   * formatted by hand once and silently dropped locale grouping.
   */
  selectForm(ctx: { count?: Decimal; slot?: Slot }): string;
  /** The language's assembler, so a hook composes rather than templates. */
  renderQuantity(parts: Omit<QuantityParts, "kind" | "unit">): string;
}
```

Build both in `formatValue` before calling `kind.format`, binding `kind`/`unit` from the value and defaulting `slot` to `"bare"`.

- [ ] **Step 6: Run the tests**

```bash
bun test packages/core/src/format packages/core/src/print packages/core/src/complete
bun test packages/core/src/parity.test.ts
bun run check
```

Expected: PASS ×3, PASS with zero diffs, green. English's `selectForm` reproduces `Intl.PluralRules` and the default render reproduces the old template — that is the parity claim P2 makes.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): the language selects the form key and assembles the quantity"
```

---

## Task 9: `renderQuantity` and the real `slot`

**Files:**
- Modify: `packages/core/src/print/print.ts`, `print/unit-word.ts`
- Test: `packages/core/src/print/print.test.ts`, `print/modes.test.ts`

**Interfaces:**
- Consumes: `defaultRenderQuantity`, `Slot`, `UnitWordOptions.spell.slot` (Task 8).
- Produces: `Printer` renders every quantity through `language.renderQuantity ?? defaultRenderQuantity`, and passes `"after-number"` for an operand, `"conversion-target"` for a `ConvertNode` target.

- [ ] **Step 1: Write the failing test**

```ts
test("the printer renders through the language, with the real slot", () => {
  const seen: Array<{ slot: string; unit: string }> = [];
  const spy = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in"] },
    selectForm: ({ slot, unit }) => { seen.push({ slot, unit }); return "other"; },
    renderQuantity: (p) => `[${p.slot}]${p.number}${p.form ?? p.symbol ?? p.unit}`,
  });
  const engine = createEngine({ locales: [composeLocale(spy, [massEn])], kinds: [mass, number] });
  const printer = new Printer({ registry: buildRegistry([mass, number], [composeLocale(spy, [massEn])]), locale: composeLocale(spy, [massEn]) });
  expect(printer.print(compile("2 kg in g"), { mode: "resolved", spelled: true }))
    .toContain("[conversion-target]");
  expect(seen.some((s) => s.slot === "after-number")).toBe(true);
});
```

> Build the `Program` the way `print.test.ts` already does — copy its `compile` helper rather than inventing a second one.

- [ ] **Step 2: Run it to verify it fails** — `bun test packages/core/src/print/print.test.ts`. Expected: FAIL, no `[conversion-target]` in the output.

- [ ] **Step 3: Thread the slot and the renderer**

In `print.ts`'s `renderQuantity` method (the private one that assembles number + unit word), replace the string concatenation with a call into the language, passing `slot: "after-number"`, `number: text`, the `form` from `unitWord`'s spelled branch when spelling, and `symbol` otherwise. `renderTarget` passes `slot: "conversion-target"` into `unitWord`'s `spell` option (Task 8 Step 4 added the field) and leaves its own assembly alone — a target is a bare word, not a quantity.

- [ ] **Step 4: Run the tests**

```bash
bun test packages/core/src/print
bun test packages/core/src/parity.test.ts
```

Expected: PASS, PASS with zero diffs.

- [ ] **Step 5: Commit** — `feat(core): print quantities through Language.renderQuantity`

---

## Task 10: `spell` and `renderExpression` move to the language

> **Executed, then partly reversed.** R9's reversal moved `spellNumber`/`numberFromWords`/`NUMBER_WORDS` back to `@smartput/number`, undoing I5's relocation; the `renderExpression` half of this task stands. The steps below are the record. **Do not execute the move.**

`spellNumber` and `NUMBER_WORDS` are English grammar living in a kind package (I5). They move to `@smartput/locale-en`, beside recognition.

**Files:**
- Modify: `packages/number/src/words.ts`, `packages/number/src/index.ts`, `packages/number/package.json`
- Modify: `packages/locale-en/src/english.ts`, `packages/locale-en/src/words.ts` (new)
- Modify: `packages/math/src/*` (its two consumers — `latexFromWords`, `describe`), `packages/math/package.json`
- Modify: `packages/core/src/print/print.ts` (spelled operators through `renderExpression`)
- Modify: `scripts/check-deps.ts`
- Test: `packages/locale-en/src/words.test.ts` (moved from `packages/number/src/words.test.ts`), `packages/core/src/print/modes.test.ts`

**Interfaces:**
- Consumes: `Language.spell`, `Language.renderExpression`, `defaultRenderExpression` (Task 8).
- Produces: `@smartput/locale-en` exports `spellNumber`, `numberFromWords`, `NUMBER_WORDS`; `@smartput/number` re-exports nothing of them.

- [ ] **Step 1: Write the failing test** — move `packages/number/src/words.test.ts` to `packages/locale-en/src/words.test.ts`, changing the import to `./words`.
- [ ] **Step 2: Run it to verify it fails** — `bun test packages/locale-en/src/words.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Move the module** — `git mv packages/number/src/words.ts packages/locale-en/src/words.ts`; drop the `words` re-exports from `packages/number/src/index.ts`; export them from `packages/locale-en/src/index.ts`. `english.spell` keeps using `cardinalSpeller(CARDINALS)` — the two tables now sit in one package and a follow-up may merge them, but **not in this task**: merging them changes what `spell` returns for values `cardinalSpeller` refuses, and parity would move.
- [ ] **Step 4: Fix `@smartput/math`** — it imported `numberFromWords`/`spellNumber` from `@smartput/number`; point it at `@smartput/locale-en` and swap the dependency in both its manifest and `check-deps.ts`'s `ALLOWED` entry (with the reason: it reads spelled numbers, which is a language's business, not a kind's).
- [ ] **Step 5: Route spelled operators through the language** — in `print.ts`'s spelled branch, assemble binary nodes with `(language.renderExpression ?? defaultRenderExpression)({ op, left, right, ...(word !== undefined ? { word } : {}) })`, where `word` is the language's own keyword for the op, as today.
- [ ] **Step 6: Run the tests** — `bun run check` and `bun test packages/core/src/parity.test.ts`. Expected: green, zero diffs.
- [ ] **Step 7: Commit** — `refactor: move spelled-number generation into the language, beside recognition`

---

## Task 11: `assertLocaleContract`

**Files:**
- Create: `packages/core/src/testing/locale.ts`, `packages/core/src/testing/locale.test.ts`
- Modify: `packages/core/src/testing/index.ts`
- Test: `packages/core/src/testing/locale.test.ts`

**Interfaces:**
- Consumes: `Locale`, `Kind`, `buildRegistry`, `wordsFor`, `createAnalyzerChain`.
- Produces:

```ts
export interface LocaleContractOptions {
  /** Counts sampled against every unit. Defaults to 0, 1, 2, 5, 11, 21, 100, 1000. */
  readonly counts?: readonly (number | Decimal)[];
  /** Slots sampled. Defaults to "bare", "after-number", "conversion-target". */
  readonly slots?: readonly Slot[];
  /** Units this language deliberately has no words for, `${kind}:${unit}`. */
  readonly skip?: readonly string[];
}
export function assertLocaleContract(
  locale: Locale,
  kinds: Kind[],
  opts?: LocaleContractOptions,
): void;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { mass } from "@smartput/mass";
import massEn from "@smartput/mass/locale/en";
import english from "@smartput/core/locale/en";
import { composeLocale, defineVocabulary } from "../index";
import { assertLocaleContract } from "./locale";

describe("assertLocaleContract", () => {
  test("passes for a complete language", () => {
    expect(() => assertLocaleContract(composeLocale(english, [massEn]), [mass])).not.toThrow();
  });

  test("fails when a unit has no words", () => {
    const partial = defineVocabulary({
      locale: "en",
      kind: "mass",
      units: { kg: massEn.units.kg as never },
    });
    expect(() => assertLocaleContract(composeLocale(english, [partial]), [mass])).toThrow(/mass:g/);
  });

  test("fails when selectForm asks for a key the vocabulary lacks", () => {
    const gapped = defineVocabulary({
      locale: "en",
      kind: "mass",
      units: Object.fromEntries(
        Object.entries(massEn.units).map(([u, w]) => [u, { ...w, forms: { one: w.forms?.one ?? u } }]),
      ),
    });
    expect(() => assertLocaleContract(composeLocale(english, [gapped]), [mass])).toThrow(/other/);
  });

  test("fails when an alias does not resolve back to its own unit", () => {
    const eaten = defineVocabulary({
      locale: "en",
      kind: "mass",
      units: { ...massEn.units, kg: { aliases: ["grams"], symbol: "kg" } },
    });
    expect(() => assertLocaleContract(composeLocale(english, [eaten]), [mass])).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `bun test packages/core/src/testing/locale.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement the four checks (spec §9)**

```ts
export function assertLocaleContract(locale, kinds, opts = {}) {
  const registry = buildRegistry(kinds, [locale]);
  const analyze = createAnalyzerChain(locale.language);
  const counts = (opts.counts ?? [0, 1, 2, 5, 11, 21, 100, 1000]).map((c) => new Decimal(c));
  const slots = opts.slots ?? ["bare", "after-number", "conversion-target"];
  const skip = new Set(opts.skip ?? []);
  const problems: string[] = [];

  for (const [kindId, kind] of registry.kinds) {
    for (const unit of kind.units.keys()) {
      if (skip.has(`${kindId}:${unit}`)) continue;
      const words = wordsFor(registry, locale.id, kindId, unit);
      // 1. Every unit of every registered kind has an entry ...
      if (words === undefined) { problems.push(`${kindId}:${unit} has no words`); continue; }
      // 2. ... with at least one alias.
      if (words.aliases.length === 0) problems.push(`${kindId}:${unit} has no alias`);
      // 3. Every alias resolves back to its own unit through the analyzer
      //    chain — the check that catches a suffix stripper eating its own
      //    vocabulary.
      for (const alias of words.aliases) {
        const forms = [alias, ...analyze(alias).map((a) => a.form)];
        const hit = forms.some((f) =>
          (registry.aliasIndex.get(f.toLocaleLowerCase(locale.id)) ?? [])
            .some((e) => e.kind === kindId && e.unit === unit));
        if (!hit) problems.push(`${kindId}:${unit} alias ${JSON.stringify(alias)} does not resolve back`);
      }
      // 4. For the sampled counts and slots, selectForm names a key the
      //    vocabulary actually has. This is how a missing `loc-many` is found
      //    by a test rather than by a user reading `в 5 кілограм`.
      if (words.forms === undefined) continue;
      for (const slot of slots) {
        for (const count of counts) {
          const key = locale.language.selectForm({ count, kind: kindId, unit, slot });
          if (words.forms[key] === undefined) {
            problems.push(`${kindId}:${unit} has no form ${JSON.stringify(key)} (count ${count}, slot ${slot})`);
          }
        }
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`locale ${locale.id} fails its contract:\n  ${problems.join("\n  ")}`);
  }
}
```

> Check 4 runs only for a unit that declares `forms` at all: a unit with a symbol and no words is I10's degradation, which is legal. A language that *wants* every unit spelled asserts it with `opts.slots`/`counts` plus its own test.

- [ ] **Step 4: Export it** — `export { assertLocaleContract } from "./locale";` in `packages/core/src/testing/index.ts`, and add an `en` contract test to `packages/kinds/src/contract.test.ts` over `BUILTIN_KINDS` + `BUILTIN_EN`.
- [ ] **Step 5: Run the tests** — `bun test packages/core/src/testing packages/kinds`. Expected: PASS. Whatever the `en` run reports is a real gap; fix the vocabulary, not the assertion.
- [ ] **Step 6: Commit** — `feat(core): assertLocaleContract — the four checks M5 promised`

---

## Task 12: Ukrainian, as a language module inside core

> **R9 reversed.** There is no `@smartput/locale-uk` package and there must not be one. Ukrainian is a file in core beside English, with a subpath of its own — read `packages/core/src/locale/en.ts` first and mirror its shape exactly.

**Files:**
- Create: `packages/core/src/locale/uk.ts`, `packages/core/src/locale/uk-cardinals.ts`, `packages/core/src/locale/uk.test.ts`
- Modify: `packages/core/package.json` (add the `./locale/uk` subpath, in the pinned `bun, types, default` order, next to `./locale/en`)
- Test: `packages/core/src/locale/uk.test.ts`

**Interfaces:**
- Consumes: `defineLanguage` (`./define`), `cardinalNumerals`, `cardinalSpeller`, `identity`, `suffixStripper` (`./helpers`), `Language` (`../types`) — all by **relative** import, since this file is inside core.
- Produces: `import ukrainian from "@smartput/core/locale/uk"` (also exported named, as `en.ts` does) — a `Language` with `id: "uk"` whose `selectForm` returns `` `${case}-${pluralCategory}` `` keys.

> `check-deps.ts` needs no new row: core is not gaining a dependency, only a subpath. `check-size.ts` may want a `core/locale/uk` row proving an engine that never imports Ukrainian does not link it — that is the whole reason a subpath replaced a package, so add one if the file has a natural place for it.

- [ ] **Step 1: Write the failing test**

```ts
import { Decimal } from "@smartput/core";
import { describe, expect, test } from "bun:test";
import { ukrainian } from "./ukrainian";

describe("ukrainian", () => {
  test("keys are case × plural category", () => {
    const f = (n: number, slot = "bare") =>
      ukrainian.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });
    expect(f(1)).toBe("nom-one");
    expect(f(2)).toBe("nom-few");
    expect(f(5)).toBe("nom-many");
    expect(f(2000)).toBe("nom-many");
    expect(f(5, "conversion-target")).toBe("loc-many");
  });

  test("a count-free target still names a key", () => {
    expect(ukrainian.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }))
      .toBe("loc-other");
  });

  test("reads Ukrainian cardinals", () => {
    expect(ukrainian.numerals?.(["двадцять", "два"])).toEqual({ value: new Decimal(22), consumed: 2 });
  });

  test("claims the conversion keyword", () => {
    expect(ukrainian.keywords.in).toContain("в");
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, package missing.

- [ ] **Step 3: Write the language**

```ts
// packages/core/src/locale/uk.ts
import { cardinalNumerals, cardinalSpeller, defineLanguage, identity, type Language, suffixStripper } from "@smartput/core";
import { CARDINALS } from "./cardinals";

const plural = new Intl.PluralRules("uk"); // one | few | many | other

/**
 * Ukrainian needs two axes where English needs one: grammatical case and
 * number. The engine never learns what `"loc"` means — it asks for a key and
 * indexes a table (I3) — so the case is chosen here, from the slot, and
 * pasted onto the CLDR category.
 *
 * `conversion-target` is locative because that is what `в` governs: "в 5
 * кілограмах", not "в 5 кілограмів". That row is the one the old
 * one-dimensional `display` model could not express at all, and it is why
 * Ukrainian is a phase of this plan rather than a follow-up.
 */
export const ukrainian: Language = defineLanguage({
  id: "uk",
  numberFormat: { group: " ", decimal: "," },
  analyze: [
    identity(),
    // Ukrainian inflects by suffix; the penalty keeps an exact alias winning.
    suffixStripper({ suffixes: ["ів", "ам", "ах", "и", "а", "у"], minStem: 3, weight: -2 }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  spell: cardinalSpeller(CARDINALS),
  keywords: {
    in: ["в", "у", "до"],
    of: ["від"],
    off: ["знижка"],
    plus: ["плюс"],
    minus: ["мінус"],
    times: ["помножити"],
    over: ["поділити"],
    by: ["на"],
  },
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
});
```

`src/cardinals.ts` holds the `CardinalTables` for Ukrainian (units один…дев'ятнадцять, tens двадцять…дев'яносто, scales сто/тисяча/мільйон/мільярд, connectors `["і", "та"]`). Write them out in full; `cardinalNumerals`/`cardinalSpeller` read the same table in both directions.

- [ ] **Step 4: Add the subpath** — `./locale/uk` in `packages/core/package.json`'s `exports`, beside `./locale/en`, in the pinned `bun, types, default` order. No `check-deps` row: core gains no dependency.
- [ ] **Step 5: Run the tests** — `bun test packages/core/src/locale && bun run check`. Expected: PASS, green.
- [ ] **Step 6: Commit** — `feat(core): Ukrainian language module — four plural categories and case by slot`

---

## Task 13: Fan-out — Ukrainian vocabularies

**One agent per row.** Fifteen kind packages, each adding `src/locale/uk.ts` beside its `en.ts` and a `./locale/uk` subpath. No row touches any other row's files; `packages/kinds/src/locale/uk.ts` is assembled by Task 14.

### The recipe

1. Copy `src/locale/en.ts` to `src/locale/uk.ts`.
2. `locale: "uk"`. Aliases become the Ukrainian spellings **hand-authored, in every inflected form a reader might type** — the vocabulary is what the analyzer falls back from, not a stem list.
3. `symbol` becomes the Ukrainian symbol where one differs (`кг`, `г`, `м`, `км`, `с`, `год`); keep the Latin symbol where Ukrainian uses it (`Hz`, `W` — check, do not assume).
4. `forms` keys are `nom-one`, `nom-few`, `nom-many`, `nom-other`, `loc-one`, `loc-few`, `loc-many`, `loc-other` — the eight `ukrainian.selectForm` can produce. Every unit needs all eight, or `assertLocaleContract` fails it (which is the point).
5. Add the `./locale/uk` subpath.
6. Write `src/locale/uk.test.ts`: `assertLocaleContract(composeLocale(ukrainian, [<kind>Uk]), [<kind>])` plus a round-trip — `engine.evaluate(engine.evaluate(input).formatted)` equals the first result for three inputs of your choosing.
7. `bun test packages/<pkg> && bun run typecheck`. Commit as `feat(<pkg>): Ukrainian vocabulary`.

### The rows

`angle`, `area`, `datarate`, `datasize`, `duration`, `energy`, `length`, `mass`, `number`, `percent`, `power`, `speed`, `temperature` (two kinds, one file, as `en`), `tempo`, `volume`.

`mass`'s file is written out in full here, as the exemplar the other fourteen follow:

```ts
// packages/mass/src/locale/uk.ts
import { defineVocabulary } from "@smartput/core";

export default defineVocabulary({
  locale: "uk",
  kind: "mass",
  units: {
    kg: {
      aliases: ["кг", "кілограм", "кілограма", "кілограми", "кілограмів", "кілограмам", "кілограмах"],
      symbol: "кг",
      forms: {
        "nom-one": "кілограм",
        "nom-few": "кілограми",
        "nom-many": "кілограмів",
        "nom-other": "кілограма",
        "loc-one": "кілограмі",
        "loc-few": "кілограмах",
        "loc-many": "кілограмах",
        "loc-other": "кілограмах",
      },
    },
    g: {
      aliases: ["г", "грам", "грама", "грами", "грамів", "грамам", "грамах"],
      symbol: "г",
      forms: {
        "nom-one": "грам", "nom-few": "грами", "nom-many": "грамів", "nom-other": "грама",
        "loc-one": "грамі", "loc-few": "грамах", "loc-many": "грамах", "loc-other": "грамах",
      },
    },
    // mg, t, oz, lb — same shape. Do not leave one out: assertLocaleContract
    // fails on a missing unit, which is exactly the check I10 wants running.
  },
});
```

> Ukrainian's `nom-other` is the fractional category ("1,5 кілограма") — genitive singular, not a plural. Getting it wrong shows up as `1.5 кілограмів`, which the round-trip test in step 6 will not catch. Read it once against a grammar reference before committing.

- [ ] **Step 1 (per row): Follow the recipe**
- [ ] **Step 2 (per row): `bun test packages/<pkg> && bun run typecheck`** — Expected: PASS
- [ ] **Step 3 (per row): Commit**

---

## Task 14: Ukrainian acceptance

**Files:**
- Create: `packages/kinds/src/locale/uk.ts`, `packages/kinds/src/ukrainian.test.ts`
- Modify: `packages/kinds/package.json`
- Test: `packages/kinds/src/ukrainian.test.ts`

**Interfaces:**
- Consumes: every `uk` vocabulary (Task 13), `ukrainian` (Task 12), `assertLocaleContract` (Task 11).
- Produces: `BUILTIN_UK` — default export of `@smartput/kinds/locale/uk`.

- [ ] **Step 1: Write the failing test — spec §8's table, verbatim**

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { assertLocaleContract } from "@smartput/core/testing";
import english from "@smartput/core/locale/en";
import ukrainian from "@smartput/core/locale/uk";
import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";

const uk = composeLocale(ukrainian, BUILTIN_UK);
const engine = createEngine({ locales: [uk], kinds: BUILTIN_KINDS });

describe("Ukrainian, as proof (spec §8)", () => {
  test.each([
    ["1 кілограм", "1 кілограм"],
    ["2 кг", "2 кілограми"],
    ["5 кг", "5 кілограмів"],
    ["2 кг в грамах", "2 000 грамів"],
    ["двадцять два кг", "22 кілограми"],
  ])("%s -> %s", (input, expected) => {
    expect(engine.evaluate(input).formatted).toBe(expected);
  });

  test("both languages satisfy the contract", () => {
    expect(() => assertLocaleContract(uk, BUILTIN_KINDS)).not.toThrow();
    expect(() => assertLocaleContract(composeLocale(english, BUILTIN_EN), BUILTIN_KINDS)).not.toThrow();
  });

  test("round-trips independently per language", () => {
    for (const [locale, inputs] of [
      [uk, ["5 кг", "2 кг в грамах", "1,5 кілограма"]],
      [composeLocale(english, BUILTIN_EN), ["5 kg", "2 kg in grams", "1.5 kilograms"]],
    ] as const) {
      const e = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
      for (const input of inputs) {
        const once = e.evaluate(input);
        const twice = e.evaluate(once.formatted);
        expect(twice.value.canonical.toString()).toBe(once.value.canonical.toString());
        expect(twice.value.unit).toBe(once.value.unit);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL. Row four (`2 кг в грамах`) is the one the old model could not express at all; if it is the *only* failure, `selectForm`'s slot plumbing is right and the vocabulary's `loc-many` is wrong.
- [ ] **Step 3: Assemble the barrel** — `packages/kinds/src/locale/uk.ts` mirrors `en.ts`; add the `./locale/uk` subpath.
- [ ] **Step 4: Fix what the table reports** — the failures are real; they belong in the vocabularies (Task 13's files) or in `ukrainian.selectForm`, never in the expectations. `2 000` with a non-breaking space is `numberFormat: { group: " " }` doing its job — assert the actual character, not a plain space.
- [ ] **Step 5: Run everything** — `bun run check` and `bun test packages/core/src/parity.test.ts`. Expected: green, zero English diffs.
- [ ] **Step 6: Commit** — `test(kinds): spec §8's Ukrainian table passes, both languages satisfy the contract`

---

## Task 15: `locale` on `Candidate`, one chain per language

**Files:**
- Modify: `packages/core/src/types.ts` (`Candidate`), `parse/candidates.ts`, `locale/analyze.ts`, `engine.ts`
- Test: `packages/core/src/parse/candidates.test.ts`

**Interfaces:**
- Consumes: `AliasEntry.locale` (Task 3).
- Produces: `Candidate.locale: string`; `createResolver({ registry, locales, format, layers })` — `locales` is every installed locale, `format` the one whose language drives segmentation and number grammar.

- [ ] **Step 1: Write the failing test**

```ts
test("each installed language contributes its own reading", () => {
  const resolver = createResolver({
    registry: buildRegistry([mass], [en, uk]),
    locales: [en, uk],
    format: en,
    layers: [],
  });
  expect(resolver.resolve("кг").map((c) => c.locale)).toEqual(["uk"]);
  expect(resolver.resolve("kg").map((c) => c.locale)).toEqual(["en"]);
  // A surface meaning something in two languages is two readings, and ranking
  // readings is what the solver is for.
  expect(resolver.resolve("g").length).toBeGreaterThan(0);
});

test("the analyzer chain runs per language and the cache key includes it", () => {
  // uk's suffix stripper must not be offered en's surfaces as uk forms unless
  // the alias index agrees.
  const resolver = createResolver({ registry, locales: [en, uk], format: en, layers: [] });
  expect(resolver.resolve("кілограмів").some((c) => c.locale === "uk" && c.unit === "kg")).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, `resolve` returns candidates with no `locale`.

- [ ] **Step 3: Implement**

- `Candidate` gains `readonly locale: string` — copied straight off the `AliasEntry` that produced it. A `literal()` candidate carries the format locale's id; a corrected (`fuzzy`) candidate carries the id of the entry it corrected to.
- `createAnalyzerChain(language)` is now called once **per installed language**, and `createResolver` keeps a `Map<string, chain>`. Chains are already memoized per surface; the cache lives inside each chain, so the key gains the language by construction. Cost is O(languages) per distinct word, paid once.
- `resolve`'s dedupe key becomes `` `${entry.kind}:${entry.unit}:${entry.locale}` `` — two languages reading one surface as the same unit are two candidates, not one, because the `locale:` selector must be able to prefer one over the other.
- Segmentation and number grammar read `format.language` only (I8, §5.3). Add the comment saying so where `segment` is read.

- [ ] **Step 4: Run the tests** — `bun test packages/core/src/parse packages/core/src/parity.test.ts`. Expected: PASS, zero diffs (a single-locale engine tags everything `en`/`*` and ranks identically).
- [ ] **Step 5: Commit** — `feat(core): locale is a dimension on Candidate, with one analyzer chain per language`

---

## Task 16: `locale:` weights, `format`, `EvalOptions.locales`

**Files:**
- Modify: `packages/core/src/solve/weights.ts`, `engine.ts`, `types.ts`
- Test: `packages/core/src/solve/weights.test.ts`, `packages/core/src/engine.test.ts`

**Interfaces:**
- Consumes: `Candidate.locale` (Task 15).
- Produces: selector `locale:<id>` in every weight layer; `EngineOptions.format?: string` (default `locales[0].id`); `EvalOptions.format?: string`; `EvalOptions.locales?: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
test("locale: is a weight selector like kind and unit", () => {
  expect(resolveWeight({ kind: "mass", unit: "kg", locale: "uk", surface: "кг", prior: 0,
    layers: [{ "locale:uk": 5 }] })).toBe(5);
});

test("both accepted, one preferred", () => {
  const engine = createEngine({
    locales: [en, uk], kinds: BUILTIN_KINDS, weights: { "locale:en": 10, "locale:uk": 5 },
  });
  expect(engine.evaluate("5 kg").kind).toBe("mass");
  expect(engine.evaluate("5 кг").kind).toBe("mass");
});

test("format decides the output language, not the input", () => {
  const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "uk" });
  expect(engine.evaluate("5 kg").formatted).toBe("5 кілограмів");
  expect(engine.evaluate("5 kg", { format: "en" }).formatted).toBe("5 kilograms");
});

test("EvalOptions.locales filters by language the way kinds filters by kind", () => {
  const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS });
  expect(() => engine.evaluate("5 кг", { locales: ["en"] })).toThrow(NoCandidateError);
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL on all four.
- [ ] **Step 3: Implement** — `resolveWeight` gains a `locale` argument and emits a `locale:<id>` row (`weightBreakdown` too, so `Σcontributions === score` still holds and `explain()` shows it). `createEngine` resolves the format locale once (`opts.locales.find(l => l.id === (opts.format ?? locales[0].id))`, throwing a plain `Error` naming the id if absent) and builds `Printer`/`Evaluator`/`formatValue` against it; `ctxFor(call)` rebuilds them when `call.format` overrides, exactly as it already does for `comparePrecision`. `EvalOptions.locales` filters candidates in the solver where `EvalOptions.kinds` already does.
- [ ] **Step 4: Run the tests** — `bun test packages/core && bun test packages/core/src/parity.test.ts`. Expected: PASS, zero diffs.
- [ ] **Step 5: Commit** — `feat(core): locale: weight selector, EngineOptions.format, EvalOptions.locales`

---

## Task 17: Keyword collisions and numeral claims

**Files:**
- Modify: `packages/core/src/locale/compose.ts` (or a new `locale/keywords.ts` if compose grows past ~80 lines), `parse/lex.ts`, `parse/numerals.ts`, `errors.ts`, `engine.ts`
- Test: `packages/core/src/locale/compose.test.ts`, `packages/core/src/parse/numerals.test.ts`

**Interfaces:**
- Consumes: `Locale[]` on the engine.
- Produces: `KeywordConflictError`; `buildKeywords(locales): Map<string, Keyword>`; numeral resolution across languages by longest claim.

- [ ] **Step 1: Write the failing test**

```ts
test("a surface meaning two different keywords across languages is a wiring error", () => {
  const a = defineLanguage({ id: "a", numberFormat: "intl", keywords: { in: ["do"] }, selectForm: () => "other" });
  const b = defineLanguage({ id: "b", numberFormat: "intl", keywords: { of: ["do"] }, selectForm: () => "other" });
  expect(() => createEngine({ locales: [composeLocale(a), composeLocale(b)], kinds: [number] }))
    .toThrow(KeywordConflictError);
});

test("the same keyword in several languages is fine and common", () => {
  const a = defineLanguage({ id: "a", numberFormat: "intl", keywords: { in: ["in"] }, selectForm: () => "other" });
  const b = defineLanguage({ id: "b", numberFormat: "intl", keywords: { in: ["in", "u"] }, selectForm: () => "other" });
  expect(() => createEngine({ locales: [composeLocale(a), composeLocale(b)], kinds: [number] })).not.toThrow();
});

test("numerals: longest claim wins, ties broken by locale: weight then id", () => {
  const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("двадцять два кг").value.canonical.toString()).toBe("22000");
  expect(engine.evaluate("twenty two kg").value.canonical.toString()).toBe("22000");
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, no `KeywordConflictError` exists.
- [ ] **Step 3: Implement**

```ts
export class KeywordConflictError extends SmartputError {
  readonly surface: string;
  readonly keywords: readonly [Keyword, Keyword];
  readonly locales: readonly [string, string];
  constructor(surface: string, keywords: readonly [Keyword, Keyword], locales: readonly [string, string]) {
    super(
      `${JSON.stringify(surface)} means ${keywords[0]} in ${locales[0]} and ${keywords[1]} in ${locales[1]}`,
      surface,
    );
    this.name = "KeywordConflictError";
    this.surface = surface;
    this.keywords = keywords;
    this.locales = locales;
  }
}
```

`buildKeywords` folds every installed language's `keywords` into one map, throwing on the first surface that maps to two different `Keyword`s. It runs once, at engine construction — a bad configuration fails on boot (I9). `lex.ts` reads the folded map instead of one locale's.

Numerals: offer the word run to each installed language's `NumeralParser`, keep the largest `consumed`; break ties on the `locale:` weight from the merged layers, then on locale id ascending — determinism first, preference second.

- [ ] **Step 4: Run the tests** — `bun test packages/core && bun test packages/core/src/parity.test.ts`. Expected: PASS, zero diffs.
- [ ] **Step 5: Commit** — `feat(core): keyword collisions fail at compose; numerals resolve by longest claim`

---

## Task 18: The multi-locale suite (spec §9)

**Files:**
- Create: `packages/kinds/src/multi-locale.test.ts`
- Modify: `docs/guide/locales.md`

- [ ] **Step 1: Write the tests**

```ts
const both = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "en" });

test("recognition is multi-locale", () => {
  expect(both.evaluate("5 kg").value.unit).toBe("kg");
  expect(both.evaluate("5 кг").value.unit).toBe("kg");
  expect(both.evaluate("5 кг in pounds").value.unit).toBe("lb");
});

test("generation is single-locale", () => {
  expect(both.evaluate("5 кг").formatted).toBe("5 kilograms");
});

test("a locale: weight flips a genuinely ambiguous surface", () => {
  // Pick the surface from the actual index rather than assuming one: any key
  // whose entries span two locales with different (kind, unit) pairs.
  const registry = buildRegistry(BUILTIN_KINDS, [en, uk]);
  const ambiguous = [...registry.aliasIndex.entries()].find(([, es]) =>
    new Set(es.map((e) => e.locale)).size > 1 && new Set(es.map((e) => `${e.kind}:${e.unit}`)).size > 1);
  expect(ambiguous).toBeDefined();
  const [surface] = ambiguous as [string, unknown];
  const preferUk = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, weights: { "locale:uk": 20 } });
  const preferEn = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, weights: { "locale:en": 20 } });
  expect(preferUk.evaluate(`5 ${surface}`).kind).not.toBe(preferEn.evaluate(`5 ${surface}`).kind);
});

test("alias isolation holds within a language", () => {
  for (const locale of [en, uk]) {
    const registry = buildRegistry(BUILTIN_KINDS, [locale]);
    for (const [surface, entries] of registry.aliasIndex) {
      const within = entries.filter((e) => e.locale === locale.id);
      const distinct = new Set(within.map((e) => `${e.kind}:${e.unit}`));
      expect(distinct.size, `${locale.id}: ${surface} resolves to ${[...distinct].join(", ")}`).toBeLessThan(2);
    }
  }
});
```

> If the ambiguous-surface search finds nothing, the third test is vacuous — say so out loud rather than deleting it: replace the search with a purpose-built pair of tiny languages sharing one surface, and keep the search as a separate `test.skip` documenting that the built-in set currently has no cross-language collision.

- [ ] **Step 2: Run** — `bun test packages/kinds/src/multi-locale.test.ts`. Expected: PASS (fix the engine, not the test, on failure).
- [ ] **Step 3: Document** — `docs/guide/locales.md` gains the multi-locale section: what is recognised many-to-one, what is generated one-to-one, and the two deliberate limits (I8, segmentation).
- [ ] **Step 4: Commit** — `test(kinds): the multi-locale suite spec §9 specifies`

---

## Task 19: The widened `AnalyzeCtx`

**Files:**
- Modify: `packages/core/src/types.ts`, `locale/analyze.ts`, `parse/candidates.ts`
- Test: `packages/core/src/locale/analyze.test.ts`

**Interfaces:**
- Produces: `AnalyzeCtx { locale, words, index }` — a widening, so every existing analyzer keeps working.

- [ ] **Step 1: Write the failing test**

```ts
test("an analyzer can see its neighbours", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  const spy: Analyzer = (surface, ctx) => { seen.push({ words: ctx.words, index: ctx.index }); return [{ form: surface }]; };
  const chain = createAnalyzerChain({ ...english, analyze: [spy] });
  chain("metres", { words: ["square", "metres"], index: 1 });
  expect(seen[0]).toEqual({ words: ["square", "metres"], index: 1 });
});

test("a chain called with no run at all still works", () => {
  const chain = createAnalyzerChain(english);
  expect(chain("kilograms").some((f) => f.form === "kilogram")).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, the chain takes one argument.
- [ ] **Step 3: Implement** — the chain's returned function becomes `(surface, position?: { words: readonly string[]; index: number })`, defaulting to `{ words: [surface], index: 0 }`. The memo key becomes `` `${position.index} ${position.words.join(" ")}` `` (index, space, the space-joined run) when a position is given, and stays the bare surface when it is not — so the common path keeps its one-entry-per-word cache. `parse/candidates.ts`'s `resolve` gains the same optional parameter and passes it through; its caller (`Tokenizer`'s word fold) supplies the segmented run.
- [ ] **Step 4: Run** — `bun test packages/core && bun test packages/core/src/parity.test.ts`. Expected: PASS, zero diffs.
- [ ] **Step 5: Commit** — `feat(core): analyzers can see the word run around them`

---

## Task 20: Fan-out — the four analyzer helpers

**One agent per helper.** All four land in `packages/core/src/locale/helpers.ts` — **the one file conflict in this plan**. Give each agent its own file and re-export from `helpers.ts` in Task 21, or run the four serially. The former is preferred:

| Helper | File | Signature | Covers |
| --- | --- | --- | --- |
| `prefixStripper` | `locale/prefix-stripper.ts` | `({ prefixes, minStem, weight }): Analyzer` | Agglutinative prefixing. Mirrors `suffixStripper` exactly — read it first and copy its shape, including the `minStem` guard and the negative default weight. |
| `compoundSplitter` | `locale/compound-splitter.ts` | `({ vocabulary, minPart, weight }): Analyzer` | German `Zentimeter`, Dutch, Scandinavian. `vocabulary` is the set of known forms to split against; emit the **last** part as the form (the head of a Germanic compound) at a penalty. |
| `phraseAnalyzer` | `locale/phrase-analyzer.ts` | `(table: Record<string, string>, weight?): Analyzer` | Multi-word units, via Task 19's neighbour context: `"square metres"` → `m2`. Keys are space-joined phrases; match backwards from `ctx.index` so the longest phrase ending at this word wins. |
| `scriptSegmenter` | `locale/script-segmenter.ts` | `({ script }): (run: string) => string[]` | CJK/Thai runs through `Intl.Segmenter` with `granularity: "word"`. This is a `Language.segment`, not an `Analyzer` — different seam, same file family. |

Each agent's steps are the same four:

- [ ] **Step 1: Write the failing test** in `locale/<helper>.test.ts` — at least: the happy case, the `minStem`/`minPart` refusal, the weight it attaches, and one case it must *not* claim.
- [ ] **Step 2: Run it to verify it fails.**
- [ ] **Step 3: Implement.** Every helper returns an `Analyzer` (or a segmenter) and holds no state between calls.
- [ ] **Step 4: `bun test packages/core/src/locale && bun run typecheck`, then commit** as `feat(core): <helper>`.

---

## Task 21: Third language smoke test, exports, docs

**Files:**
- Modify: `packages/core/src/locale/helpers.ts` (re-export the four), `packages/core/src/index.ts`
- Create: `packages/core/src/locale/third-language.test.ts`
- Modify: `docs/guide/locales.md`, `docs/guide/kinds.md`, `docs/guide/roadmap.md`, `docs/.vitepress/locales/en.ts`

- [ ] **Step 1: Write the smoke test** — a minimal German `Language` built **inside the test** (not a shipped package: spec §13 puts any language beyond `en`/`uk` out of scope) with `compoundSplitter` over a small length vocabulary, asserting `"10 Zentimeter"` resolves to `cm` and that a word the splitter must not claim (`"Zentrum"`) does not.
- [ ] **Step 2: Run it to verify it fails**, then make it pass.
- [ ] **Step 3: Export the helpers** from `helpers.ts` and `index.ts`, keeping the existing alphabetical export order.
- [ ] **Step 4: Documentation sweep** — `docs/guide/locales.md` is rewritten end to end around `Language`/`Vocabulary`/`Locale`, the install flow, the `forms`/`selectForm` model, the four helpers, multi-locale and its two limits; `docs/guide/roadmap.md`'s M5 row moves to done with a pointer; `docs/.vitepress/locales/en.ts` gets any new sidebar entry. Check every code sample in `docs/guide/*.md` that builds an engine — `rg -n "createEngine" docs` — and update the ones still passing a bare locale.
- [ ] **Step 5: Run everything** — `bun run check`, `bun run docs:build`, `bun test packages/core/src/parity.test.ts`. Expected: green, green, zero diffs.
- [ ] **Step 6: Commit** — `docs: rewrite the locales guide around Language, Vocabulary and composeLocale`

---

## Execution log

**P1 (Tasks 1–7) — landed.** 24 commits, `bd232bd`..`93be592`. Tests 2872→3000, 0 fail. Parity 86/0 throughout. Plus `f610d57`, an orchestrator fix: `OP_KEYWORDS` in `print.ts` was a closed record over `+ - * /` and `BinaryOp` admits the comparison six, so the `.language.` sweep surfaced a latent type error — now `Partial<Record<BinaryOp, Keyword>>`, and a comparison prints its bare symbol.

**P2 (Tasks 8–11) — landed.** `c469e98`, `3215be7`, `bf171f2`, `4296ec5`. Tests 3014, 0 fail. Parity 86/0. Typecheck, lint, check-deps, build all clean.

**Four errors in this plan that execution found. Later tasks must not trust the originals.**

1. **Task 6 row 1 is wrong about angle's symbols.** It claims `°`; `deg`'s declared symbol is the string `"deg"` and there is no `°` in the package. The row was executed against the real values.
2. **Task 8 Step 4's `complete.ts` snippet moves parity.** `...(count === undefined ? {} : { count })` makes English answer `"other"` for a fragment with no number typed yet, and six corpus rows flip to plurals. The old code fabricated a count of 1, and the corpus holds the singular. Shipped as `count: count ?? IMPLIED_COUNT` (a module-level `new Decimal(1)`), which is **not** ruling R5: R5 is a conversion target with no magnitude anywhere, this is a magnitude merely not typed yet.
3. **Task 9 Step 1's test contradicts Step 3.** The test asserts `[conversion-target]` appears in printed output, which only the `renderQuantity` spy can emit — but Step 3 correctly says `renderTarget` does not call `renderQuantity` (a target is a bare word, and routing it through would emit a leading space and turn `1 kg in g` into ` grams`). Step 3 is the correct half. The slot assertion belongs where the slot actually travels: through `unitWord`'s `spell.slot` into `selectForm`.
4. **Task 11's check 3 was unfalsifiable.** "Every alias resolves back to its own unit through the analyzer chain" is true by construction — `buildRegistry` pass 5 indexes every alias under an entry for the unit that declared it, so the lookup cannot miss. The plan's own test 4 did not throw when run against the verbatim implementation. The shipped check keeps the reachability loop (commented as true-by-construction today) and adds the clause that makes the name honest: **an exact alias must not be claimed by another unit of the same kind**. Deliberately not applied to analyzed forms — a stripper folding one unit's word onto another's within a kind (`ms` → `m`) is ordinary English, resolved by weight.

**P1's package layout was reversed on 2026-08-08, after P2.** `@smartput/locale-en` is deleted: the English `Language` is back at `packages/core/src/locale/en.ts` behind the `@smartput/core/locale/en` subpath, and `spellNumber`/`numberFromWords`/`NUMBER_WORDS` are back in `@smartput/number`. Commit `9f9554e`. Ruling R9 carries the reasoning; Tasks 4 and 10 are marked superseded in place. Tests stayed 3014/0 and parity 86/0 across the reversal.

**Two facts P3 inherits.**

- `assertLocaleContract` over `en` + `BUILTIN_KINDS` reports exactly one gap: `boolean:bool has no words`. Legitimate, and passed via `opts.skip` — the kind prints through its own `format` hook, so the unit id never reaches a user. Ukrainian will need the same skip.
- `spellNumber`/`numberFromWords`/`NUMBER_WORDS` were moved to `@smartput/locale-en` and then, by R9's reversal, moved back to `@smartput/number`. Four consumers the plan did not name were repointed twice: `scripts/geo/build.ts`, `scripts/geo/build.test.ts`, `packages/country/src/data/reserved.test.ts`, and `packages/range/src/phrases.ts` — the last being **untracked in-flight work**, whose manifest gained `@smartput/locale-en` as a runtime dependency.

**P3 (Tasks 12–14) — landed 2026-08-08.** 22 commits, `51da919`..`b269208`, plus `c8a4973` and the seven-commit correction wave `98c3c5b`..`3f3c001` described below. Tests 3014 → 3657, parity 86/0 throughout, typecheck/check-deps/build clean.

Ukrainian ships as `packages/core/src/locale/uk.ts` + `uk-cardinals.ts` behind `@smartput/core/locale/uk` (R9's layout, not the package the task text was originally written against), fifteen `src/locale/uk.ts` vocabularies, and `packages/kinds/src/locale/uk.ts`. Spec §8's table passes verbatim, including `2 кг в грамах` → `2 000 грамів`.

**Four things execution found that this plan did not anticipate. P4 and P5 must not trust the originals.**

1. **`normalize()` ate Ukrainian's group separator, and nothing in the plan predicted it.** `normalize()` folds every whitespace run to a plain space before `lex()` runs, so a language whose separator is U+00A0 never saw its own separator and could not read back the number it had just printed — `evaluate(evaluate("2 кг в грамах").formatted)` threw. Fixed in `f7fbbdd`: `lex` accepts a folded separator when the language's declared separator is space-like *and* exactly three digits follow, so `2 000 г` is one number while `2 3 кг` stays two tokens. `en` is untouched by construction (its separator is `,`). French ICU's U+202F has the same problem and the same fix.

2. **`assertLocaleContract` checked the wrong set, and four kinds shipped broken because of it.** It asserts that every *alias* resolves back to its unit. It never asserted that every *string the printer can emit* does — and those are different sets. Ukrainian shipped `datarate` (5 units), `energy` (3), `power:hp` and `tempo:bpm` printing strings no analyzer could read, with every test in the repo green and the contract passing. Found only by brute force after the fact: for every unit, evaluate `"<n> <alias>"`, then evaluate the output again. The check now lives in `assertLocaleContract` (`e933928`) with the end-to-end net in `packages/kinds/src/ukrainian.test.ts` (`3f3c001`). **Any future language must be audited this way, not by reading its tables.**

3. **A compound symbol is read by arithmetic, not by lookup — and that is load-bearing.** English `speed:mps` prints `1m/s`, which re-reads not because `m/s` is an alias (it is not) but because `lex` splits on `/` and length ÷ duration has a registered signature. Three consequences the plan never states: an alias containing an operator character can never match, because a word token ends at one; a compound symbol only works if its *operands* belong to the right kinds; and `·` was an unknown character while `/` was arithmetic, which was arbitrary. `98c3c5b` adds U+00B7, U+00D7 and U+22C5 as spellings of `*`, so `кВт·год` resolves as power × duration. Ruling: **add an operator spelling only when a symbol the repo already emits is written with it.**

4. **`cardinalSpeller` has a latent tie-break bug, still unfixed.** Its `wordFor` helper implements "first word for a value wins" for `units` and `tens`, but the `scales` path bypasses it: `bigScales` sorts with `(a, b) => a.value.gte(b.value) ? -1 : 1`, which returns `-1` for ties and is therefore an inconsistent comparator. Measured on Bun 1.3.0 it *reverses* ties, so the last-declared variant of a duplicated scale value is the one spelled. English is unaffected — its scales hold no duplicate values — so this is invisible until a language declares inflected scale words, which Ukrainian must. Worth its own task; it was outside P3's staging.

**Three Ukrainian trade-offs recorded, because each gave up orthography for readability.** `power:hp`'s symbol is `кс`, not the correct `к.с.` — `.` is a token boundary, so `5 к.с.` fails with `Unknown unit "к"` — and its two-word `forms` ("кінська сила") are gone, since no single-token analyzer can recover a phrase. `tempo:bpm`'s symbol is `бпм`, not the metronome's `уд/хв`: unlike energy and datarate there is no "beat" kind for the numerator to be, so the arithmetic route is unavailable. `datarate`'s five symbols lost their `/с` — `datasize` is bytes-only and declares no bit unit, so the Cyrillic bit-words could not move to it and `біт/с` had no division to resolve into.

**A pre-existing English gap the new check surfaced:** `length:in`'s symbol is `in`, core's own conversion keyword, which `lex` emits as a keyword token — so `@smartput/length/locale/en` drops it from `aliases` on purpose and a `symbols: true` print of `5in` does not parse. Waived by name through the new `skipPrintable` option rather than by weakening the check. Ukrainian needs no such waiver: its inch is `дюйм`, alias and symbol and form at once.

**P4 (Tasks 15–18) — landed 2026-08-08.** Seven commits, `4bbd457`..`af1d966`. Tests 3657 → 3702 pass / 1 skip, parity 86/0, Ukrainian 11/0, typecheck/check-deps/build clean.

Recognition is many-locale and generation is one. Measured on a two-locale engine: `5 кг in pounds` and `5 kg в грамах` both read, and each prints in whichever language `format` names. `engine.ts`'s `const locale = opts.locales[0]` is gone.

**What execution found that the plan did not say.**

1. **`complete()` is a generation path, and I6 binds it — no task in this plan said so.** `complete/complete.ts` built its offer from the alias it *matched* (`?? alias`), which was safe only while the alias index held one language. P4 made the index many-locale, so an English-format engine answered `complete("5 б")` with `5 біт` and `5 бпм`. It fired for every unit whose format language ships no `forms` table — 24 units in English. Every test was green, the suite passed, `assertLocaleContract` passed, and **401 of 15,568 completion rows** were leaking a foreign word. Found by sweeping every completion a two-locale engine can produce, not by reading the diff. Fixed in `f3e4d86`: the fallback walks the format language's own words, falling through to the alias only when no installed language has spoken for the kind (R2's unit-key floor). `Printer` was never affected — `unit-word.ts` already read `wordsFor(registry, locale.id, …)` and degraded to the unit key. **Any future generation path must be checked against I6 explicitly; the plan's task list is not the list of them.**

2. **Case folding is global by measurement, not by argument.** The registry folds each alias under its contributing language's id while the resolver folds the query under one. If two languages folded differently, a key written under one would be unreachable by a query folded under the other — silent total non-recognition, no error, no candidate. Over all 780 alias keys, `en` and `uk` fold identically, and Ukrainian has no case tailoring. So one fold, taken from `format`, is correct and folding per-language "to be safe" would be a real behaviour change for no gain. **Installing a case-tailored language — Turkish or Azeri dotted-I, Lithuanian dot-above, Greek final sigma — is the trigger to revisit**, and the comment in `candidates.ts` says so.

3. **The dedupe key's sort had to grow with it.** `resolve`'s final sort was `weight, kind, unit` with no locale term; once the key gained `locale`, two candidates could tie on all three and the sort stopped being total. Determinism came back with a locale tiebreak, not with the key change alone.

4. **The built-in set has no cross-language ambiguous surface at all.** Not merely none with differing `(kind, unit)` — **zero** surfaces in the en+uk index carry entries from more than one locale. Task 18 took the plan's documented fallback: the weight test runs on a purpose-built pair of tiny languages, and the plan's index search survives as a live assertion that it finds nothing plus a `test.skip`. So `locale:` is proven to work, but not on the real vocabulary set, and cannot be until a second Latin-script or third language lands.

**Four things P4 deliberately did not decide. Each is a design call, not a defect.**

- **Number grammar follows `format` only, and is silently wrong rather than refusing.** `evaluate("1,5 кг")` on a `format: "en"` two-locale engine answers **15 kilograms** — the comma is read as a thousands separator, so the input is off by 10×. `format: "uk"` gives the correct `1,5 кілограма`. This is design decision I8 working as specified and it is documented on both `format` options, but it is the one place many-locale recognition is silently wrong rather than throwing, and nothing pins it. Either accept it with a test that names it, or make the tokenizer many-locale for numbers too.
- **`locale:` is a partial selector.** `registry.ts`'s `push` skips an entry whose `(kind, unit)` already matched, so an alias both languages list keeps only the first language's tag — **226 aliases** (`kg`, `mm`, `cm`, `%`, …) fold to a single `en` entry. Consequences: `{ "locale:uk": 5 }` cannot move `"5 kg"`, and `evaluate("5 kg", { locales: ["uk"] })` throws even though Ukrainian's vocabulary lists `kg`. Coherent and documented, but weaker than "a weight selector" sounds.
- **`toExplanation` dedupes `Explanation.candidates` on `(kind, unit)`** while `resolve` now keys on `(kind, unit, locale)`, so two locale-variants collapse to one row in `explain()`. Harmless while no surface spans two locales — see finding 4 — and exactly the thing that stops being harmless when one does.
- **The roster sweep needs a 30 s budget.** `multi-locale.test.ts`'s 3,111-call sweep runs in ~200 ms idle and was measured at 21 s under four competing `bun test` processes, past bun's 5 s default. The budget moved rather than the loop, because the sweep's size is what makes it worth having.

**Known red, untouched by design:** `bun run check-size` reports three OVER rows — `range`, `range/class` and `query/sql` (the last by four bytes). All three are untracked in-flight packages whose budgets live in an uncommitted `scripts/check-size.ts`. Rebudgeting someone else's in-flight numbers is not this plan's call.

---

## Self-Review

**Spec coverage.**

| Spec | Landed by |
| --- | --- |
| §2 I1 (no `lexicon`) | Tasks 3, 5, 6, 7 |
| §2 I2 (three types) | Task 2 |
| §2 I3 (`forms` + `selectForm`) | Tasks 2, 8 |
| §2 I4 (`renderQuantity`) | Tasks 8, 9 |
| §2 I5 (`spell` moves) | Task 10 |
| §2 I6 (recognition many, generation one) | Tasks 15, 16, 18 |
| §2 I7 (`locale` on Candidate, `locale:` selector) | Tasks 3, 15, 16 |
| §2 I8 (number grammar follows format) | Task 15 Step 3 |
| §2 I9 (keyword collisions at compose) | Task 17 |
| §2 I10 (degrade to unit key) | Tasks 3 (R2), 8, 11 |
| §3 the three types, `composeLocale`, barrels | Tasks 2, 5, 7, 14 |
| §4 `defineKind` loses `lexicon`, `typical` relocates | Tasks 3, 5, 6, 7 |
| §5 multi-locale, limits | Tasks 15–18 |
| §6 formatting, spelled expressions | Tasks 8, 9, 10 |
| §7 analyzers, four helpers | Tasks 19, 20 |
| §8 Ukrainian table | Task 14 |
| §9 testing (parity, contract, isolation, freedom, round-trip, ranking) | Tasks 1, 7, 11, 14, 18 |
| §10 package layout, dependency table | Tasks 4, 5, 6, 12, 13 |
| §11 P0–P5 | Tasks 1–21 |
| §12 sibling-spec amendments | Task 7 Step 5 |
| §13 out of scope | Respected: no MT, no script detection, no multi-locale number grammar, third language is a test fixture only |

**Known deviations from the spec, each with its ruling:** `FormCtx.count` is optional (R5); `AliasEntry.locale` lands in P1 rather than P4 (R6); `lexicon` survives inside P1 as an unexported bridge (R7); the built-in set is seventeen kinds, not twelve (R10). Everything else follows the spec as written.

**Open risk, named rather than papered over:** Task 6's rows 17–19 (`money`, `datetime`, `place`) are the three that generate their unit tables from data rather than declaring them, and each one's split is a genuine design decision made inside a fan-out task. If a row's agent finds the split is not mechanical, it should stop and report rather than improvise — those three are the likeliest place this plan is wrong.
