# Second Pass (defects A–G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The parallel phases below are also encoded as a runnable `Workflow` script in [§ Parallel execution](#parallel-execution).

**Goal:** Fix the seven defects the 2026-08-18 probe found — multi-locale number grammar, compound quantities, display precision, derived units, a non-throwing `explain`, a home for structural contracts, and plugin config off `EngineOptions` — without moving the solver's enumeration model.

**Architecture:** Every change is a seam, not a special case. Two new kinds of evidence reach the solver (a number reading, a derived-unit target); everything else is a table built at boot (`Registry.derivedUnits`), an opt-in field with a false/undefined default (`Kind.compound`, `UnitWords.tight`, `EngineOptions.display`), or a policy only the `Printer` reads. No kind package learns anything about core, and core learns no domain.

**Tech Stack:** TypeScript 5.7, Bun 1.3 (package manager, test runner, bundler), `decimal.js` reached only through `@smartput/core`'s `Decimal`, Biome for lint/format.

**Spec:** `docs/superpowers/specs/2026-08-18-smartputs-second-pass-design.md` — read it alongside this plan; every task cites its section.

## Global Constraints

- **Core never learns a domain.** No metre, dollar or city in `packages/core` or `packages/kind`. A new capability is a seam any plugin can use.
- **Never import `decimal.js` directly.** `Decimal` comes from `@smartput/core` (or `./decimal` inside core). Biome fails the build on a raw import.
- **One runtime dependency per package.** `scripts/check-deps.ts` is the allowlist and fails on any package it does not know.
- **Frozen and pure.** Every stage calls `Object.freeze(this)` in its constructor; every public output is deep-frozen. No module state beyond `decimal.ts`.
- **Ambiguity is data.** Weight a reading down; never delete it, never pick a winner silently.
- **Defaults over configuration.** New behaviour is an opt-in field with a `false`/`undefined` default. A single-locale, single-grammar engine must produce byte-identical output after every task in this plan except Task 4, Task 7 and Task 8.
- **Tests sit beside their source** as `*.test.ts`. Kind packages carry corpus tests with strings people actually type, in every locale that gets the alias.
- **Gate:** `bun run check` = lint, typecheck, check-deps, test, build, check-size. Green before every commit.
- **Measured, not estimated.** A `check-size` row that moves gets a comment in `scripts/check-size.ts` saying why. Parity fixtures that move get a sentence in the PR body (CONTRIBUTION.md).
- **Record the ruling.** R-A1, R-B1, R-C1, R-F1 from the spec's §I go into the code where the reader will meet them: a test named for the cost, or a doc comment.
- **Fixture discipline for this plan:** a task re-records only the corpus `.tsv` rows it owns. `packages/core/parity/*.json` is re-recorded **once**, in Task 13, by `bun run parity:record`. A parallel task must never run `parity:record`.

## File Structure

| File | Task | Responsibility after this plan |
| --- | --- | --- |
| `packages/kind/src/contracts.ts` (new) | T1 | Types-only: `PlaceMeta`, `RangeMeta`, `InstantMeta`, `MoneyContext`. 0 B runtime. |
| `packages/kind/src/types.ts` | T1 | Gains `Kind.compound`, `UnitWords.tight`, `EvalCtx.context`; re-exports `PlaceMeta`. **No other task edits this file.** |
| `packages/kind/src/errors.ts` | T2 | Error classes carry spans; `DimensionMismatchError` carries `tried`. |
| `packages/core/src/kind/registry.ts` | T3 | Gains `derivedUnits`, built in `buildRegistry`. |
| `packages/core/src/format/format.ts`, `print/print.ts`, `print/unit-word.ts` | T4 | Display rounding and symbol spacing. |
| `packages/core/src/solve/solver.ts` | T5, T8, T12 | Rejections and spans (T5); target prune (T8); number slots (T12). |
| `packages/core/src/parse/pratt.ts` | T5, T8, T9 | Spans on throws (T5); derived target chain (T8); compound fold (T9). |
| `packages/core/src/parse/lex.ts` | T6, T11 | Digit-inside-run split and `in` re-lex (T6); per-grammar digit scan (T11). |
| `packages/core/src/engine.ts` | T5, T7, T10, T12 | `explain` catch (T5); `display` (T7); `context` (T10); `assignments[].numbers` (T12). Serialised across phases. |
| `packages/core/src/parse/tokenizer.ts` | T11 | Derives grammars from `locales`, not one `numberFormat` from `format`. |
| `packages/core/src/solve/weights.ts` | T12 | `grammar:<localeId>` selector. |
| `packages/core/src/eval/evaluate.ts` | T8, T10 | Derived-unit rewrite; `context` on `EvalCtx`. |
| `packages/{duration,length,mass,angle,volume}/src/index.ts` | T9 | `compound: true`. |
| `packages/{speed,datarate,tempo}/src/locale/*.ts` | T4 | Symbols that are written expressions take a space. |
| `packages/rate/src/*` | T10 | Reads `ctx.context?.money`. |
| `scripts/check-size.ts` | T1, T13 | New row for `kind/contracts` (0 B); moved core rows with reasons. |
| `docs/guide/roadmap.md`, `errors.md`, `inputs.md`, `weights.md` | T13 | Every core change and every ruling recorded. |

---

## Parallel execution

Tasks are grouped into phases by **file ownership**: two tasks in the same phase never write the same file, so they run as concurrent subagents in one worktree. Phases are barriers.

| Phase | Tasks (parallel) | Files each owns |
| --- | --- | --- |
| P0 | T1 | `kind/contracts.ts`, `kind/types.ts`, `kind/package.json`, `check-size.ts`, `geo/src/distance.ts` |
| P1 | T2, T3, T4 | `kind/errors.ts` \| `core/kind/registry.ts` \| `core/format/*`, `core/print/*`, speed/datarate/tempo/percent/temperature/angle/currency locales |
| P2 | T5, T6 | `core/solve/solver.ts`, `core/parse/pratt.ts`, `core/engine.ts` \| `core/parse/lex.ts` |
| P3 | T7, T8 | `core/engine.ts`, `core/print/*.test.ts` \| `core/parse/pratt.ts`, `core/solve/solver.ts`, `core/eval/*` |
| P4 | T9, T10 | `core/parse/pratt.ts`, `core/parse/ast.ts`, five kind packages \| `core/engine.ts`, `core/eval/evaluate.ts`, `packages/rate` |
| P5 | T11 | `core/parse/lex.ts`, `core/locale/number.ts`, `core/parse/tokenizer.ts` |
| P6 | T12 | `core/solve/*`, `core/parse/ast.ts`, `core/parse/pratt.ts`, `core/engine.ts` |
| P7 | T13 | fixtures, docs, `check-size.ts` |

T10 and T8 both touch `core/eval/evaluate.ts`, which is why they sit in different phases. T9 and T12 both touch `parse/ast.ts` for the same reason.

Run it with the `Workflow` tool:

```js
export const meta = {
  name: 'smartputs-second-pass',
  description: 'Implement defects A-G from the 2026-08-18 second-pass design, phase by phase',
  phases: [
    { title: 'P0 contracts' }, { title: 'P1 foundations' }, { title: 'P2 spans+lexer' },
    { title: 'P3 display+derived' }, { title: 'P4 compound+context' },
    { title: 'P5 grammars' }, { title: 'P6 number slots' }, { title: 'P7 fixtures+docs' },
  ],
}

const PLAN = 'docs/superpowers/plans/2026-08-18-second-pass.md'
const SPEC = 'docs/superpowers/specs/2026-08-18-smartputs-second-pass-design.md'

const brief = (task) => [
  `Read ${PLAN} and ${SPEC}.`,
  `Implement ONLY "${task}" from the plan, following its steps in order:`,
  'write the failing test, run it and confirm it fails, implement, run it again, commit.',
  "Touch ONLY the files that task's **Files:** block lists — another agent owns every other file right now.",
  'Do NOT run the parity recorder (bun run parity:record); Task 13 owns it.',
  'Before committing run: bun run lint, bun run typecheck, and bun test over the test files you touched.',
  'Return JSON: {task, filesChanged, testsAdded, commands, notes}.',
].join(' ')

const RESULT = {
  type: 'object',
  properties: {
    task: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'array', items: { type: 'string' } },
    commands: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['task', 'filesChanged', 'notes'],
}

const wave = async (title, tasks) => {
  phase(title)
  const out = await parallel(tasks.map((t) => () =>
    agent(brief(t), { label: t, phase: title, schema: RESULT })))
  const done = out.filter(Boolean)
  log(`${title}: ${done.length}/${tasks.length} tasks returned`)
  const gate = await agent(
    [
      'Run the repo gate: bun run lint, bun run typecheck, bun run check-deps, bun test.',
      'Report every failure verbatim with file and line.',
      `Fix ONLY failures caused by the tasks just merged (${tasks.join(', ')}).`,
      'If a failure needs a design decision, do not guess — report it and stop.',
      'Commit any fix with a conventional-commit subject.',
    ].join(' '),
    { label: `${title}:gate`, phase: title, effort: 'high' })
  return { phase: title, done, gate }
}

const results = []
results.push(await wave('P0 contracts', ['Task 1']))
results.push(await wave('P1 foundations', ['Task 2', 'Task 3', 'Task 4']))
results.push(await wave('P2 spans+lexer', ['Task 5', 'Task 6']))
results.push(await wave('P3 display+derived', ['Task 7', 'Task 8']))
results.push(await wave('P4 compound+context', ['Task 9', 'Task 10']))
results.push(await wave('P5 grammars', ['Task 11']))
results.push(await wave('P6 number slots', ['Task 12']))
results.push(await wave('P7 fixtures+docs', ['Task 13']))
return results
```

Two rules the script encodes and a human executor must keep too: **one owner per file per phase**, and **the phase gate runs the full suite before the next phase starts**. A task that cannot finish stops its phase; do not start the next one on a red tree.

---

## Task 1: Contracts subpath and the type surface (spec §F, plus the field declarations §B/§C/§G need)

**Files:**
- Create: `packages/kind/src/contracts.ts`
- Create: `packages/kind/src/contracts.test.ts`
- Modify: `packages/kind/src/types.ts` — move `PlaceMeta` out, re-export it; add `Kind.compound`, `UnitWords.tight`, `EvalCtx.context`
- Modify: `packages/kind/package.json` — `exports` gains `./contracts`
- Modify: `packages/geo/src/distance.ts` — import `PlaceMeta` from the subpath
- Modify: `scripts/check-size.ts` — row for `@smartput/kind/contracts`, expected 0 B

**Interfaces:**
- Consumes: nothing.
- Produces: `import type { PlaceMeta, RangeMeta, InstantMeta, MoneyContext } from "@smartput/kind/contracts"`. `Kind.compound?: boolean` (T9 reads it), `UnitWords.tight?: boolean` (T4 reads it), `EvalCtx.context?: Readonly<Record<KindId, unknown>>` (T10 reads it).

**Why one task:** three later tasks each need one line in `packages/kind/src/types.ts`. Declaring all three here — every one optional, so nothing behaves differently — is what lets T4, T9 and T10 run in different phases without ever touching that file.

- [ ] **Step 1: Write the failing test**

```ts
// packages/kind/src/contracts.test.ts
import { expect, test } from "bun:test";
import type { InstantMeta, PlaceMeta, RangeMeta } from "./contracts";
import type { EvalCtx, Kind, UnitWords } from "./types";

test("contracts is types-only: importing it adds no runtime export", async () => {
  const mod = await import("./contracts");
  expect(Object.keys(mod)).toEqual([]);
});

test("PlaceMeta stays reachable from types.ts for one release", () => {
  const place: PlaceMeta = {
    geonameId: 1, name: "Athens", zone: "Europe/Athens",
    currency: "EUR", lat: 37.98, lon: 23.72,
  };
  const alias: import("./types").PlaceMeta = place;
  expect(alias.zone).toBe("Europe/Athens");
});

test("RangeMeta and InstantMeta name the shapes range-core and datetime already write", () => {
  const range: RangeMeta<number> = { start: 1, end: 2, inclusive: true };
  const instant: InstantMeta = { zone: "UTC", hasDate: true, hasTime: false };
  expect(range.end - range.start).toBe(1);
  expect(instant.hasDate).toBe(true);
});

test("the three opt-in fields default to absent", () => {
  const kind = { id: "mass" } as Partial<Kind>;
  const words: UnitWords = { aliases: ["kg"] };
  const ctx = { locale: "en" } as unknown as EvalCtx;
  expect(kind.compound).toBeUndefined();
  expect(words.tight).toBeUndefined();
  expect(ctx.context).toBeUndefined();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test packages/kind/src/contracts.test.ts`
Expected: FAIL with `Cannot find module './contracts'`.

- [ ] **Step 3: Create the contracts module**

```ts
// packages/kind/src/contracts.ts
/**
 * The shapes kinds agree on, held by the layer kinds are written in.
 *
 * Ruling R-F1: a subpath of `@smartput/kind`, not a `@smartput/contracts`
 * package. A types-only package still has to be a runtime `dependency` for a
 * published `.d.ts` to resolve, so it would need a `check-deps` exemption and a
 * 38th name to claim, to say what a file already says. The subpath costs 0 B
 * (`check-size` has the row) and is honest about what it is.
 *
 * Every field here is what the writing package ALREADY puts on `Value.meta`.
 * This file names those fields; it never invents one. Adding a field is a change
 * to the writer first and to this file second.
 */
import type { KindId, RateLookup } from "./types";

/** What a `place` Value carries on `meta`. Written by `@smartput/geo`; read by datetime and money. */
export interface PlaceMeta {
  /** GeoNames feature id. Stable, and the Value's canonical. */
  readonly geonameId: number;
  /** The place's own display name — "Japan", "Athens", "Los Angeles". */
  readonly name: string;
  /** IANA zone. Always present: a country carries its capital's zone. */
  readonly zone: string;
  /** ISO 4217. Present on countries; on a city, its country's. */
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  /** Population, when the gazetteer row carried one. */
  readonly population?: number;
  /** ISO 3166-1 alpha-2 of the country this place is in. */
  readonly country?: string;
}

/** What a range Value carries on `meta`. Written by `@smartput/range-core`. */
export interface RangeMeta<T = unknown> {
  readonly start: T;
  readonly end: T;
  /** Whether `end` is part of the range. `range-core` writes `true`. */
  readonly inclusive?: boolean;
}

/** What a datetime Value carries on `meta`. Written by `@smartput/datetime`. */
export interface InstantMeta {
  /** IANA zone the instant was resolved against. */
  readonly zone?: string;
  readonly hasDate: boolean;
  readonly hasTime: boolean;
}

/**
 * Money's slice of `EngineOptions.context` (§G). Declared here for the same
 * reason `RateLookup` is declared in `types.ts`: `@smartput/rate` produces it,
 * core threads it, and neither imports the other.
 */
export interface MoneyContext {
  readonly rates?: RateLookup;
  readonly rounding?: number;
}

/** Every kind's context slice, keyed by kind id — `EvalCtx.context`'s shape. */
export type KindContext = Readonly<Record<KindId, unknown>>;
```

- [ ] **Step 4: Move `PlaceMeta` and add the three fields in `types.ts`**

Delete the `PlaceMeta` interface body (it sits just below `RateLookup`, around line 170) and leave a re-export in its place:

```ts
/**
 * @deprecated Import from `@smartput/kind/contracts`. Re-exported here for one
 * release so a consumer pinned to the old path keeps compiling — ruling R-F1
 * moved the declaration, not the name.
 */
export type { PlaceMeta } from "./contracts";
```

In `interface Kind`, after `typical`:

```ts
  /**
   * Adjacent quantities of this kind, in strictly descending units and with no
   * operator between them, fold into a sum: "1 h 30 min", "5 ft 3 in". Off by
   * default, and off is right for most kinds — `datasize` does not want
   * "1 gb 500 mb", and `temperature` must not have it at all, since two
   * adjacent temperatures do not add.
   *
   * Read by the parser (`parse/pratt.ts`), never by the solver: the fold builds
   * an ordinary `+` node and the signature that already exists prices it.
   */
  compound?: boolean;
```

In `interface UnitWords`, after `symbol`:

```ts
  /**
   * The symbol is written against the number with no space — "50%", "20°C",
   * "£22.94". Default false, which is "12 kg" spacing.
   *
   * A property of the WORD, not of the kind: `%` is tight and `kg` is not, and
   * both belong to kinds whose other units disagree with them.
   */
  readonly tight?: boolean;
```

In `interface EvalCtx`, after `rates`:

```ts
  /**
   * Per-kind configuration, keyed by kind id and opaque to core (§G). A kind
   * casts its own slot to the contract it published — `@smartput/rate` reads
   * `ctx.context?.money as MoneyContext` from `@smartput/kind/contracts`.
   *
   * This is where `rates`/`rounding` go once their deprecation lapses: they are
   * one plugin's table on an options object every plugin shares.
   */
  readonly context?: Readonly<Record<KindId, unknown>>;
```

- [ ] **Step 5: Publish the subpath**

In `packages/kind/package.json`, beside the existing `./errors` entry, copying its exact key order and its `bun` condition:

```json
    "./contracts": {
      "bun": "./src/contracts.ts",
      "types": "./dist/contracts.d.ts",
      "default": "./dist/contracts.js"
    }
```

- [ ] **Step 6: Point the existing consumer at it**

In `packages/geo/src/distance.ts`, change the `PlaceMeta` import to `import type { PlaceMeta } from "@smartput/kind/contracts";`. Leave the `as PlaceMeta` casts alone.

- [ ] **Step 7: Add the size row**

In `scripts/check-size.ts`, beside the other `@smartput/kind` rows:

```ts
  {
    label: "kind/contracts (types only — the proof of ruling R-F1)",
    from: "@smartput/kind/contracts",
    // 0, and the row exists to keep it 0: the moment someone puts a const or a
    // function in contracts.ts, every package that imports a shape pays for it.
    max: 0,
  },
```

- [ ] **Step 8: Run the gate**

Run: `bun test packages/kind/src/contracts.test.ts && bun run typecheck && bun run build && bun run check-size`
Expected: PASS; the `kind/contracts` row reports 0 B.

- [ ] **Step 9: Commit**

```bash
git add packages/kind/src/contracts.ts packages/kind/src/contracts.test.ts \
        packages/kind/src/types.ts packages/kind/package.json \
        packages/geo/src/distance.ts scripts/check-size.ts
git commit -m "feat(kind): add types-only contracts subpath and the second-pass opt-in fields"
```

---

## Task 2: Errors carry spans and the real operator (spec §E.2, first half)

**Files:**
- Modify: `packages/kind/src/errors.ts`
- Test: `packages/kind/src/errors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `new DimensionMismatchError(input, op, left, right, tried, spans)` where `tried: ReadonlyArray<readonly [KindId, KindId]>`; `error.tried`; `new UnitParseError(input, kind?, spans?)`. T5 passes spans at every throw site.

**Ruling to keep:** `op` is an `OpSymbol` or `"in"`, never the string `"operation"`. The probe's `op: "operation"` is the defect.

- [ ] **Step 1: Write the failing test**

```ts
// packages/kind/src/errors.test.ts — append
import { DimensionMismatchError, UnitParseError } from "./errors";

test("DimensionMismatchError names the operator and every pair tried", () => {
  const err = new DimensionMismatchError(
    "10 kg / 2 m",
    "/",
    "mass",
    "length",
    [["mass", "length"], ["mass", "duration"]],
    [{ start: 0, end: 5 }, { start: 6, end: 7 }, { start: 8, end: 11 }],
  );
  expect(err.op).toBe("/");
  expect(err.tried).toEqual([["mass", "length"], ["mass", "duration"]]);
  expect(err.spans).toHaveLength(3);
  expect(err.message).toBe(
    "Cannot apply / to `10 kg` and `2 m`: no signature for mass / length or mass / duration",
  );
});

test("one pair reads as one clause", () => {
  const err = new DimensionMismatchError(
    "1 kg + 1 s", "+", "mass", "duration",
    [["mass", "duration"]],
    [{ start: 0, end: 4 }, { start: 5, end: 6 }, { start: 7, end: 10 }],
  );
  expect(err.message).toBe("Cannot apply + to `1 kg` and `1 s`: no signature for mass + duration");
});

test("with no spans the message falls back to naming the kinds", () => {
  const err = new DimensionMismatchError("x", "*", "mass", "length");
  expect(err.message).toBe("Cannot apply * to mass and length: no signature for mass * length");
});

test("UnitParseError carries the span of what could not be parsed", () => {
  const err = new UnitParseError("5 ft 3", undefined, [{ start: 5, end: 6 }]);
  expect(err.spans).toEqual([{ start: 5, end: 6 }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test packages/kind/src/errors.test.ts`
Expected: FAIL — `Expected 4 arguments, but got 6`, and `err.tried` is undefined.

- [ ] **Step 3: Implement**

Replace `DimensionMismatchError` in `packages/kind/src/errors.ts`:

```ts
/**
 * The operands' SOURCE TEXT is what the message quotes, not their kinds alone:
 * "Cannot apply / to mass and duration" sent a user looking for a duration they
 * never typed, when the truth was that the engine read their "m" as minutes.
 * Naming the text and then every pair it tried says both halves.
 *
 * `tried` is every (left, right) the solver enumerated and found no signature
 * for, deduplicated, in enumeration order. The old message named one pair —
 * whichever the first failing assignment happened to hold — which is why
 * "10 kg / 2 m" reported MASS AND DURATION and read as a bug in the message.
 */
export class DimensionMismatchError extends SmartputError {
  readonly left: KindId;
  readonly right: KindId;
  /** An `OpSymbol` or `"in"`. Never the literal "operation". */
  readonly op: string;
  readonly tried: ReadonlyArray<readonly [KindId, KindId]>;
  constructor(
    input: string,
    op: string,
    left: KindId,
    right: KindId,
    tried: ReadonlyArray<readonly [KindId, KindId]> = [[left, right]],
    spans: Span[] = [],
  ) {
    const [leftSpan, , rightSpan] = spans;
    const quote = (s: Span | undefined): string | undefined =>
      s === undefined ? undefined : "`" + input.slice(s.start, s.end) + "`";
    const l = quote(leftSpan);
    const r = quote(rightSpan);
    const operands = l !== undefined && r !== undefined ? `${l} and ${r}` : `${left} and ${right}`;
    const pairs = tried.map(([a, b]) => `${a} ${op} ${b}`);
    const listed =
      pairs.length <= 1
        ? (pairs[0] ?? `${left} ${op} ${right}`)
        : `${pairs.slice(0, -1).join(", ")} or ${pairs[pairs.length - 1]}`;
    super(`Cannot apply ${op} to ${operands}: no signature for ${listed}`, input, spans);
    this.name = "DimensionMismatchError";
    this.op = op;
    this.left = left;
    this.right = right;
    this.tried = tried;
  }
}
```

Widen `UnitParseError`:

```ts
export class UnitParseError extends SmartputError {
  readonly kind: KindId | undefined;
  constructor(input: string, kind?: KindId, spans: Span[] = []) {
    super(`Cannot parse ${JSON.stringify(input)} as a quantity`, input, spans);
    this.name = "UnitParseError";
    this.kind = kind;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/kind/src/errors.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Update the call sites and message assertions**

Run: `bun run typecheck` — the new parameters are optional, so `solver.ts`'s existing throw still compiles. Then `bun test packages/core packages/kind`; any test asserting the old message string moves to the new one. Change assertion *strings*, never assertion *counts*.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/kind/src/errors.ts packages/kind/src/errors.test.ts packages/core/src
git commit -m "feat(kind): errors carry spans, and a mismatch names the operator and every pair tried"
```

---

## Task 3: `Registry.derivedUnits` (spec §D.2, the table)

**Files:**
- Modify: `packages/core/src/kind/registry.ts`
- Test: `packages/core/src/kind/registry.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface DerivedUnitParts {
    readonly leftKind: KindId; readonly leftUnit: string;
    readonly op: "*" | "/";
    readonly rightKind: KindId; readonly rightUnit: string;
  }
  export interface DerivedUnitTable {
    readonly forward: Map<string, string>;              // (kind|left|op|right) -> unit
    readonly reverse: Map<string, DerivedUnitParts>;    // (kind||| ) keyed by derivedKey(kind, unit, "", "")
  }
  export function derivedKey(kind: KindId, left: string, op: string, right: string): string;
  export function derivedUnitOf(
    registry: Registry, kind: KindId, left: string, op: "*" | "/", right: string,
  ): string | undefined;
  // Registry gains: derivedUnits: DerivedUnitTable
  ```
  T8 reads `derivedUnitOf` and `derivedUnits.reverse`.

**Ruling to keep:** ratio equality at 28 digits, never alias matching. `kph` is `(km, /, h)` because the numbers agree, which is what makes `mi/h → mph` and `nmi/h → knot` free.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/kind/registry.test.ts — append
import { BUILTIN_KINDS } from "@smartput/kinds";
import { buildRegistry, derivedKey, derivedUnitOf } from "./registry";

test("a length over a duration finds the speed unit whose ratio matches", () => {
  const reg = buildRegistry(BUILTIN_KINDS, []);
  expect(derivedUnitOf(reg, "speed", "km", "/", "h")).toBe("kph");
  expect(derivedUnitOf(reg, "speed", "m", "/", "s")).toBe("mps");
  expect(derivedUnitOf(reg, "speed", "mi", "/", "h")).toBe("mph");
  expect(derivedUnitOf(reg, "speed", "nmi", "/", "h")).toBe("knot");
});

test("a pair with no matching unit is absent, not guessed", () => {
  const reg = buildRegistry(BUILTIN_KINDS, []);
  expect(derivedUnitOf(reg, "speed", "km", "/", "s")).toBeUndefined();
});

test("the reverse direction names the parts a compound target decomposes to", () => {
  const reg = buildRegistry(BUILTIN_KINDS, []);
  expect(reg.derivedUnits.reverse.get(derivedKey("speed", "kph", "", ""))).toEqual({
    leftKind: "length", leftUnit: "km", op: "/", rightKind: "duration", rightUnit: "h",
  });
});

test("a kind whose ratios need a rate table contributes nothing rather than throwing", () => {
  const reg = buildRegistry(BUILTIN_KINDS, []);
  for (const key of reg.derivedUnits.forward.keys()) {
    expect(key.startsWith("money|")).toBe(false);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: FAIL — `derivedUnitOf is not a function`.

- [ ] **Step 3: Implement**

Add to `packages/core/src/kind/registry.ts`:

```ts
export interface DerivedUnitParts {
  readonly leftKind: KindId;
  readonly leftUnit: string;
  readonly op: "*" | "/";
  readonly rightKind: KindId;
  readonly rightUnit: string;
}

export interface DerivedUnitTable {
  readonly forward: Map<string, string>;
  readonly reverse: Map<string, DerivedUnitParts>;
}

export function derivedKey(kind: KindId, left: string, op: string, right: string): string {
  return `${kind}|${left}|${op}|${right}`;
}

export function derivedUnitOf(
  registry: Registry,
  kind: KindId,
  left: string,
  op: "*" | "/",
  right: string,
): string | undefined {
  return registry.derivedUnits.forward.get(derivedKey(kind, left, op, right));
}

/**
 * One unit's ratio as a plain Decimal, or null when the ratio is a function of
 * something this table has not got — money's rates, measure's dpi.
 *
 * Null rather than a throw, and this is the whole reason the table is safe to
 * build at boot: a `ratio(ctx)` may read `ctx.rates` and raise
 * `MissingRateError`, so a registry built with no rate table would fail to
 * construct at all. A kind whose ratios need a context contributes no rows,
 * which is exactly right — a derived unit whose value changes hourly is not a
 * unit the parser can name.
 *
 * An affine unit is excluded too: a scale with an offset (degC, degF) is not a
 * factor in another scale.
 */
function staticRatio(kind: NormalizedKind, unit: string): Decimal | null {
  const def = kind.units.get(unit);
  if (def === undefined) return null;
  const ctx = {
    self: { kind: kind.id, canonical: new Decimal(0), unit },
    locale: "*",
  } as unknown as EvalCtx;
  try {
    const ratio = def.ratio(ctx);
    const offset = def.offset(ctx);
    return offset.isZero() ? ratio : null;
  } catch {
    return null;
  }
}

/**
 * Every (resultKind, leftUnit, op, rightUnit) whose ratios multiply or divide to
 * a unit the result kind already has.
 *
 * Ruling: equality of ratios at 28 digits, never alias matching. "kph" is
 * derived from (km, /, h) because the numbers agree, which is what makes
 * mi/h -> mph and nmi/h -> knot free and costs no kind package a line.
 *
 * Built once, here, beside `aliasIndex`. The sizes are tiny: speed's one
 * signature over 10 length units and 8 duration units is 80 probes.
 */
function buildDerivedUnits(
  kinds: Map<KindId, NormalizedKind>,
  ops: Map<string, OpSignature>,
): DerivedUnitTable {
  const forward = new Map<string, string>();
  const reverse = new Map<string, DerivedUnitParts>();

  for (const sig of ops.values()) {
    if (sig.op !== "*" && sig.op !== "/") continue;
    const left = kinds.get(sig.left);
    const right = kinds.get(sig.right);
    const result = kinds.get(sig.result);
    if (left === undefined || right === undefined || result === undefined) continue;
    if (left.spec.mode !== "ratio" || right.spec.mode !== "ratio") continue;
    if (result.spec.mode !== "ratio") continue;

    const resultRatios: Array<[string, Decimal]> = [];
    for (const unit of result.units.keys()) {
      const r = staticRatio(result, unit);
      if (r !== null && !r.isZero()) resultRatios.push([unit, r]);
    }
    if (resultRatios.length === 0) continue;

    for (const lu of left.units.keys()) {
      const lr = staticRatio(left, lu);
      if (lr === null || lr.isZero()) continue;
      for (const ru of right.units.keys()) {
        const rr = staticRatio(right, ru);
        if (rr === null || rr.isZero()) continue;
        const want = sig.op === "*" ? lr.times(rr) : lr.div(rr);
        const hit = resultRatios.find(([, r]) => r.eq(want));
        if (hit === undefined) continue;
        const unit = hit[0];
        const key = derivedKey(sig.result, lu, sig.op, ru);
        // First writer wins, so a later signature never silently redefines an
        // established pair. Determinism is the same rule `ops` already follows.
        if (!forward.has(key)) forward.set(key, unit);
        const back = derivedKey(sig.result, unit, "", "");
        if (!reverse.has(back)) {
          reverse.set(back, {
            leftKind: sig.left, leftUnit: lu, op: sig.op,
            rightKind: sig.right, rightUnit: ru,
          });
        }
      }
    }
  }
  return { forward, reverse };
}
```

Add to `interface Registry`:

```ts
  /**
   * (resultKind, leftUnit, op, rightUnit) -> resultUnit, and back. Built by
   * `buildDerivedUnits` from ratio equality, which is what makes a compound
   * unit usable where a unit is required: after `in`, and as the unit a derived
   * result prints in.
   */
  derivedUnits: DerivedUnitTable;
```

and in `buildRegistry`'s returned object, beside `ops` and `aliasIndex`: `derivedUnits: buildDerivedUnits(kinds, ops),`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Prove nothing user-visible moved**

Run: `bun test packages/core && bun run build && bun run check-size`
Expected: PASS. If the `@smartput/core` row moves, raise it and write the one-line reason above it (`derivedUnits: table built at boot`), per CONTRIBUTION.md.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/kind/registry.ts packages/core/src/kind/registry.test.ts scripts/check-size.ts
git commit -m "feat(core): build a derived-unit table from ratio equality at boot"
```

---

## Task 4: Display precision and symbol spacing (spec §C.2, the Printer half)

**Files:**
- Modify: `packages/core/src/format/format.ts` — `DisplayOptions`, `DEFAULT_DISPLAY`, `applyDisplay`
- Modify: `packages/core/src/print/print.ts` — thread `display`, apply the spacing rule
- Modify: `packages/core/src/locale/render.ts` — `defaultRenderQuantity` honours `tight`
- Modify: `packages/speed/src/locale/*.ts`, `packages/datarate/src/locale/*.ts`, `packages/tempo/src/locale/*.ts`
- Modify: `packages/{percent,temperature,angle,currency}/src/locale/*.ts` — `tight: true`
- Test: `packages/core/src/format/format.test.ts`, `packages/core/src/print/print.test.ts`

**Interfaces:**
- Consumes: `UnitWords.tight` (T1).
- Produces:
  ```ts
  export interface DisplayOptions {
    maximumFractionDigits?: number;    // default 4
    minimumSignificantDigits?: number; // default 3
  }
  export const DEFAULT_DISPLAY: Required<DisplayOptions>;
  export function applyDisplay(value: Decimal, display: DisplayOptions | undefined): Decimal;
  export type FormatOptionsWithDisplay = FormatOptions & { display?: DisplayOptions };
  ```
  T7 wires `EngineOptions.display`/`EvalOptions.display` into the `Printer` that calls these.

**Ruling R-C1, to record in the doc comment:** 4 fraction digits, floor 3 significant, money exempt. `formatPrecision` keeps its meaning (round-trip and comparison guard) and its default of 26.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/format/format.test.ts — append
import { Decimal } from "../decimal";
import { applyDisplay, DEFAULT_DISPLAY } from "./format";

test("display rounds to four fraction digits and drops trailing zeros", () => {
  expect(applyDisplay(new Decimal("3.306933932773163710844607"), DEFAULT_DISPLAY).toFixed()).toBe("3.3069");
  expect(applyDisplay(new Decimal("96.56064"), DEFAULT_DISPLAY).toFixed()).toBe("96.5606");
  expect(applyDisplay(new Decimal("1.5000"), DEFAULT_DISPLAY).toFixed()).toBe("1.5");
});

test("a small value keeps three significant digits rather than rounding to zero", () => {
  expect(applyDisplay(new Decimal("0.00001234"), DEFAULT_DISPLAY).toFixed()).toBe("0.0000123");
  expect(applyDisplay(new Decimal("0.000000001"), DEFAULT_DISPLAY).toFixed()).toBe("0.000000001");
});

test("a large value keeps its whole part: the significant floor never truncates left of the point", () => {
  expect(applyDisplay(new Decimal("1234567.891"), DEFAULT_DISPLAY).toFixed()).toBe("1234567.891");
});

test("zero stays zero", () => {
  expect(applyDisplay(new Decimal("0"), DEFAULT_DISPLAY).toFixed()).toBe("0");
});

test("display is a policy, not the guard: absent display changes nothing", () => {
  const raw = new Decimal("13.888888888888888888888889");
  expect(applyDisplay(raw, undefined).toFixed()).toBe(raw.toFixed());
});
```

```ts
// packages/core/src/print/print.test.ts — append, using the file's existing engine helper
test("a symbol takes a space unless its word declares itself tight", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("50 km/h").formatted).toBe("50 km/h");
  expect(engine.evaluate("5 percent").formatted).toBe("5%");
  expect(engine.evaluate("20 degc").formatted).toBe("20°C");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/format/format.test.ts packages/core/src/print/print.test.ts`
Expected: FAIL — `applyDisplay` is not exported; the printer reports `13.888888888888888888888889m/s`-shaped output.

- [ ] **Step 3: Implement `applyDisplay`**

In `packages/core/src/format/format.ts`, below `DISPLAY_PRECISION`:

```ts
/**
 * What `Result.formatted` keeps. Ruling R-C1.
 *
 * Distinct from `DISPLAY_PRECISION` (26) above, which is the ROUND-TRIP AND
 * COMPARISON GUARD and keeps both its meaning and its default. This policy runs
 * after it, never before, so `Result.value.canonical` and `Result.value.raw` are
 * untouched at 28 and 26 digits and `comparePrecision` still decides that
 * `1 km / 3 * 3 = 1 km` (ruling C4).
 *
 * Four fraction digits, chosen against six and against a pure significant-digit
 * rule: four is what a pocket calculator and a Soulver-class tool show, and a
 * significant-digit rule makes `1234567.891` lose its cents. The three-digit
 * significant floor is what stops `0.00001234 g` printing as `0`.
 *
 * Money is exempt, and the exemption is enforced at the call site rather than
 * here: a money kind formats through its own `format` hook, which rounds by the
 * currency's minor units under `rounding`, and re-rounding a cent to a general
 * policy would be core deciding a domain question.
 */
export interface DisplayOptions {
  /** Fraction digits `formatted` keeps at most. Default 4. Trailing zeros are dropped. */
  maximumFractionDigits?: number;
  /** Significant digits `formatted` never drops below, so a small value is not rounded to 0. Default 3. */
  minimumSignificantDigits?: number;
}

export const DEFAULT_DISPLAY: Required<DisplayOptions> = Object.freeze({
  maximumFractionDigits: 4,
  minimumSignificantDigits: 3,
});

export type FormatOptionsWithDisplay = FormatOptions & { display?: DisplayOptions };

export function applyDisplay(value: Decimal, display: DisplayOptions | undefined): Decimal {
  if (display === undefined) return value;
  const maxFraction = display.maximumFractionDigits ?? DEFAULT_DISPLAY.maximumFractionDigits;
  const minSignificant = display.minimumSignificantDigits ?? DEFAULT_DISPLAY.minimumSignificantDigits;
  if (value.isZero()) return value;
  const rounded = value.toDecimalPlaces(maxFraction);
  // Zero is the case the floor exists for: 0.00001234 rounds to 0 at four
  // places, and zero has no significant digits to compare, so it always falls
  // through to the floor rather than being reported as nothing.
  if (!rounded.isZero() && rounded.sd() >= minSignificant) return rounded;
  return value.toSignificantDigits(minSignificant);
}
```

Widen `formatValue`/`formatNumber` to take `FormatOptionsWithDisplay`, and in `formatValue`'s default (non-hook) path:

```ts
  const { rounding: _hookOnly, display, ...trim } = opts;
  const shown = applyDisplay(authored, display);
  const numberText = formatNumber(shown, language, trim);
```

The `kind.format !== undefined` branch is untouched — that is the money exemption, and the comment above says so.

- [ ] **Step 4: Implement the spacing rule**

`formatValue` already fetches `words` via `wordsFor(...)`. Pass `tight: words?.tight === true` through `QuantityParts` into `renderQuantity`, and in `locale/render.ts`'s `defaultRenderQuantity` join number and symbol with `""` when `tight` is true, `" "` otherwise.

In `packages/core/src/print/print.ts`'s quantity branch, the separator becomes:

```ts
      // `UnitWords.tight` is the unit saying it is written against the number —
      // "50%", "20°C", "£22.94". `ctx.spacing` is the caller saying the whole
      // expression is tight. Either is sufficient; neither is required.
      //
      // Before this line the default ran the other way: a unit with no `forms`
      // fell through to its symbol and the renderer joined them with no space,
      // so "13.8889m/s" and "96.56064kph" were the NORMAL output and
      // "1.5 kilograms" was the exception. Reading a flag instead of inferring
      // one from the absence of a word is what makes "50 km/h" and "5%" both
      // right.
      const glued = label.source === "symbol" && words?.tight === true;
      const gap = glued || (ctx.spacing === "tight" && ctx.spell === undefined) ? "" : " ";
```

Hoist the existing `wordsFor` result if `words` is not already in scope; do not call it twice.

- [ ] **Step 5: Correct the symbols that were glued by accident**

- `packages/speed/src/locale/en.ts`: `kph: { aliases: alias("kph"), symbol: "km/h" }`. Update the file's doc comment: the symbols now print with a space (`"50 km/h"`), and `km/h` re-reads as an expression exactly as `m/s` already does, because the lexer splits on `/`. Repeat in every other `packages/speed/src/locale/*.ts`.
- `packages/datarate/src/locale/*.ts` and `packages/tempo/src/locale/*.ts`: same rule — a symbol containing `/` is a written expression, so it takes a space.
- `tight: true` on: `percent`'s `%`; `angle`'s `°`, `′`, `″`; `temperature`'s `°C`, `°F`, `K`; every `currency` prefix symbol.

- [ ] **Step 6: Re-record only this task's corpus rows**

Run: `bun test packages/core packages/speed packages/datarate packages/tempo packages/percent packages/temperature packages/angle packages/currency`

Every failing row must be explained by one of two sentences: "a long decimal is now four fraction digits", or "a symbol now takes a space". Update those `.tsv` rows. Anything else is a regression — stop and diagnose with `engine.explain`.

Do **not** run `bun run parity:record` — Task 13 owns it.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/format packages/core/src/print packages/core/src/locale/render.ts \
        packages/speed packages/datarate packages/tempo packages/percent \
        packages/temperature packages/angle packages/currency
git commit -m "feat(core): give display its own precision policy and let a unit declare tight spacing"
```

---

## Task 5: `explain` never throws; every throw site passes a span (spec §E)

**Files:**
- Modify: `packages/core/src/solve/solver.ts` — collect rejections, throw with spans and `tried`
- Modify: `packages/core/src/parse/pratt.ts` — spans on every `UnitParseError`
- Modify: `packages/core/src/engine.ts` — `Explanation.outcome`, `Explanation.rejections`, the `explain` catch
- Test: `packages/core/src/engine.test.ts`, `packages/core/src/properties.test.ts`

**Interfaces:**
- Consumes: `DimensionMismatchError(input, op, left, right, tried, spans)` and `UnitParseError(input, kind, spans)` (T2).
- Produces:
  ```ts
  export interface Rejection {
    node: NodeId; op: string; left: KindId; right: KindId; spans: [Span, Span];
  }
  // solve(program, registry, opts) gains: opts.onReject?: (r: Rejection) => void
  // Explanation gains:
  //   outcome: { status: "ok" } | { status: "error"; error: SmartputError }
  //   rejections: Rejection[]
  ```

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/engine.test.ts — append
test("explain returns an Explanation for input evaluate throws on", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const ex = engine.explain("100 km / 2 h in km/h");
  expect(ex.outcome.status).toBe("error");
  expect(ex.tokens.length).toBeGreaterThan(0);
  expect(ex.candidates.length).toBeGreaterThan(0);
  expect(ex.rejections.length).toBeGreaterThan(0);
  for (const r of ex.rejections) {
    expect(r.spans[0].end).toBeGreaterThan(r.spans[0].start);
    expect(r.op).not.toBe("operation");
  }
});

test("explain on a good input reports ok and no rejections", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const ex = engine.explain("1.5 kg in lb");
  expect(ex.outcome).toEqual({ status: "ok" });
  expect(ex.rejections).toEqual([]);
});

test("explain returns for every error class rather than throwing", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  for (const input of ["10 kg / 2 m", "5 zorkmids", "1h30m", ""]) {
    const ex = engine.explain(input);
    expect(ex.input).toBe(input);
    expect(["ok", "error"]).toContain(ex.outcome.status);
  }
});

test("a mismatch names the operator and every pair the solver tried", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  try {
    engine.evaluate("10 kg / 2 m");
    throw new Error("expected DimensionMismatchError");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err).toBeInstanceOf(DimensionMismatchError);
    expect(err.op).toBe("/");
    expect(err.spans).toHaveLength(3);
    expect(err.tried.length).toBeGreaterThan(1);
    expect(err.tried).toContainEqual(["mass", "length"]);
  }
});

test("a non-SmartputError still propagates out of explain: it is a bug, not an outcome", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const hostile = new Proxy({}, { get() { throw new TypeError("boom"); } });
  expect(() => engine.explain("1 kg", { weights: hostile })).toThrow(TypeError);
});
```

```ts
// packages/core/src/properties.test.ts — append
test("every SmartputError raised over the corpus carries a span", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  for (const input of corpusInputs()) {
    try {
      engine.evaluate(input);
    } catch (e) {
      if (!(e instanceof SmartputError)) throw e;
      if (e instanceof TooAmbiguousError) continue; // about the whole input, ruling in §E.2
      expect([input, e.spans.length > 0]).toEqual([input, true]);
    }
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/properties.test.ts`
Expected: FAIL — `explain` throws `DimensionMismatchError`; `ex.rejections` is undefined.

- [ ] **Step 3: Collect rejections in the solver**

In `packages/core/src/solve/solver.ts`, `typeOf` is where a signature lookup fails. Give it a sink, used only from `enumerate`'s terminal `typeOf(root, ...)` call so a rejection is recorded once per complete assignment, not once per partial one:

```ts
/**
 * Every (op, left, right) this walk found no signature for. Fed by `typeOf` when
 * a caller supplies a sink; `evaluate` supplies none and pays nothing.
 *
 * The pairs are what `DimensionMismatchError.tried` names and what
 * `Explanation.rejections` lists. Collecting them is the fix for the probe that
 * reported *mass and duration* for "10 kg / 2 m": the solver knew it had tried
 * mass/length too, and threw the knowledge away.
 */
export interface Rejection {
  node: NodeId;
  op: string;
  left: KindId;
  right: KindId;
  spans: [Span, Span];
}
```

```ts
function typeOf(
  node: Node,
  choices: Readonly<Record<NodeId, Candidate>>,
  registry: Registry,
  reject?: (r: Rejection) => void,
): KindId | null {
  // number / quantity / literal / unary: unchanged, forwarding `reject` on recursion.
  case "convert": {
    const operand = typeOf(node.operand, choices, registry, reject);
    const target = choices[node.id];
    if (operand === null || target === undefined) return null;
    const sig = registry.ops.get(opKey("in", operand, target.kind));
    if (sig === undefined) {
      reject?.({ node: node.id, op: "in", left: operand, right: target.kind,
        spans: [node.operand.span, node.targetSpan] });
      return null;
    }
    return sig.result;
  }
  case "binary": {
    const left = typeOf(node.left, choices, registry, reject);
    const right = typeOf(node.right, choices, registry, reject);
    if (left === null || right === null) return null;
    const sig = registry.ops.get(opKey(node.op, left, right));
    if (sig === undefined) {
      reject?.({ node: node.id, op: node.op, left, right,
        spans: [node.left.span, node.right.span] });
      return null;
    }
    return sig.result;
  }
}
```

In `solve`, deduplicate and build the throw from what was collected:

```ts
  const rejected = new Map<string, Rejection>();
  const sink = (r: Rejection): void => {
    const key = `${r.node}|${r.op}|${r.left}|${r.right}`;
    if (rejected.has(key)) return;
    rejected.set(key, r);
    opts.onReject?.(r);
  };
  // inside enumerate's terminal branch: const kind = typeOf(root, choices, registry, sink);

  if (viable.length === 0) {
    const all = [...rejected.values()];
    const first = all[0];
    if (first !== undefined) {
      const tried = all.map((r) => [r.left, r.right] as const);
      throw new DimensionMismatchError(
        opts.input, first.op, first.left, first.right, tried,
        [
          program.input.mapSpan(first.spans[0]),
          program.input.mapSpan({ start: first.spans[0].end, end: first.spans[1].start }),
          program.input.mapSpan(first.spans[1]),
        ],
      );
    }
    // No rejection recorded means no assignment reached an operator at all —
    // every slot was filtered away by `kinds`/`locales`. That is the case the
    // old `reportedOperands` walk was written for, and it stays.
    const operands = reportedOperands(root, opts.kinds, opts.locales);
    const left = operands[0] ?? "unknown";
    const right = operands[1] ?? "unknown";
    throw new DimensionMismatchError(opts.input, "in", left, right, [[left, right]], [
      program.input.mapSpan(root.span),
    ]);
  }
```

`solve` needs `program` in scope for `mapSpan` — it already takes it as its first parameter.

- [ ] **Step 4: Spans at the parser's throw sites**

In `packages/core/src/parse/pratt.ts`, add one helper and use it at every bare `throw new UnitParseError(input)`:

```ts
  /** The span of the token the parser choked on, or a zero-width span at end of input. */
  const here = (): Span => {
    const t = peek();
    return t === undefined
      ? { start: input.length, end: input.length }
      : { start: t.start, end: t.end };
  };
```

```ts
  throw new UnitParseError(input, undefined, [mapSpan(here())]);
```

- [ ] **Step 5: `explain` catches**

In `packages/core/src/engine.ts`, extend `Explanation`:

```ts
export interface Explanation {
  input: string;
  /** Token.start/end index `input`, the same string `Result.spans` does. */
  tokens: Token[];
  candidates: Candidate[];
  assignments: Array<{
    kind: KindId;
    score: number;
    confidence: number;
    units: string[];
    contributions: Array<{ selector: string; value: number; layer: number }>;
  }>;
  /**
   * Why the input succeeded or failed. `explain` used to let a `SmartputError`
   * out, which made the one API whose job is to say why an input failed
   * unusable on exactly the inputs that failed.
   */
  outcome: { status: "ok" } | { status: "error"; error: SmartputError };
  /**
   * Every (op, leftKind, rightKind) the solver enumerated and found no signature
   * for, with node ids and spans. Empty when `outcome` is ok.
   */
  rejections: Rejection[];
}
```

and rewrite the method body:

```ts
    explain(input, call) {
      const ctx = ctxFor(call);
      const rejections: Rejection[] = [];
      let tokens: Token[] = [];
      let candidates: Candidate[] = [];
      try {
        const stream = tokenizer.run(input, tokenizerScope(call));
        tokens = [...stream.tokens];
        const program = parser.run(stream);
        candidates = collectCandidates(program);
        const all = solver.all(program, {
          ...solveScope(call),
          onReject: (r) => rejections.push(r),
        });
        return toExplanation(input, tokens, candidates, all, ctx, { status: "ok" }, rejections);
      } catch (e) {
        // A SmartputError is an OUTCOME — saying why an input failed is this
        // method's whole job, and throwing the reason away in order to report it
        // was the defect. Anything else is a bug in a stage and still propagates.
        if (!(e instanceof SmartputError)) throw e;
        return toExplanation(
          input, tokens, candidates, [], ctx, { status: "error", error: e }, rejections,
        );
      }
    },
```

`tokens` and `candidates` stay filled as far as the pipeline got, which is what makes an explanation of a parse failure useful at all. `Solver.all`'s `SolveScope` gains `onReject?: (r: Rejection) => void` and forwards it — a new field on `EvalOptions` is silently ignored until it is named there, which that interface's own doc comment already warns about.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/properties.test.ts packages/core/src/solve`
Expected: PASS. The property test is the acceptance criterion for this task.

- [ ] **Step 7: Run the whole core suite**

Run: `bun test packages/core`
Expected: PASS except `parity.test.ts`, which fails because `Explanation` gained two fields. Note that in the commit body; Task 13 re-records. If anything *else* fails, it is a regression.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/solve/solver.ts packages/core/src/parse/pratt.ts \
        packages/core/src/engine.ts packages/core/src/engine.test.ts \
        packages/core/src/properties.test.ts
git commit -m "feat(core): explain returns an Explanation for every input, and errors point at their span"
```

---

## Task 6: Lexer — digit-inside-run split and the `in`-as-inch re-lex (spec §B.2, lexer half)

**Files:**
- Modify: `packages/core/src/parse/lex.ts`
- Modify: `packages/core/src/parse/tokenizer.ts` — pass `matchCtx.isUnitAlias` into `lex`
- Test: `packages/core/src/parse/lex.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `lex("1h30m")` gives `number(1) word(h) number(30) word(m)`; in `"5 ft 3 in"` the final `in` is a `word`, not a `keyword`. `lex` gains an optional trailing parameter `isUnitAlias?: (text: string) => boolean`, defaulting to `() => false`. `Token.start/end` keep indexing the source, so `Result.spans` is unaffected. T9 (the parser fold) consumes both changes.

**Ruling R-B1, to record as a named test:** a `keyword in` re-lexes as a word only where it cannot be the conversion keyword — preceded by a number, at end of input or followed by an operator or another `in`, and its surface listed as a unit alias by some installed vocabulary.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/parse/lex.test.ts — append
const shapes = (s: string) =>
  lex(s, enLocale, keywords, isUnitAlias).map((t) => `${t.type}:${"text" in t ? t.text : ""}`);

test("a digit run followed by a letter splits the word run", () => {
  expect(shapes("1h30m")).toEqual(["number:1", "word:h", "number:30", "word:m"]);
  expect(shapes("5ft3in")).toEqual(["number:5", "word:ft", "number:3", "word:in"]);
});

test("trailing digits stay inside the word: m2, km2 and ft3 are units", () => {
  expect(shapes("30 m2")).toEqual(["number:30", "word:m2"]);
  expect(shapes("30 km2")).toEqual(["number:30", "word:km2"]);
  expect(shapes("4 ft3")).toEqual(["number:4", "word:ft3"]);
});

test("spans index the source across a split", () => {
  const [, h, thirty, m] = lex("1h30m", enLocale, keywords, isUnitAlias);
  expect([h?.start, h?.end]).toEqual([1, 2]);
  expect([thirty?.start, thirty?.end]).toEqual([2, 4]);
  expect([m?.start, m?.end]).toEqual([4, 5]);
});

test("R-B1: `in` re-lexes as a word only where it cannot be the conversion keyword", () => {
  const at = (s: string, start: number) =>
    lex(s, enLocale, keywords, isUnitAlias).find((t) => t.start === start)?.type;
  expect(lex("5 ft 3 in", enLocale, keywords, isUnitAlias).at(-1)?.type).toBe("word");
  expect(at("5 ft 3 in + 1 ft", 7)).toBe("word");     // an operator follows
  expect(at("5 ft 3 in cm", 7)).toBe("keyword");      // a unit follows: still converts
  expect(lex("5 ft 3 in in cm", enLocale, keywords, isUnitAlias)
    .filter((t) => t.type === "keyword")).toHaveLength(1);
  expect(at("10 km in m", 6)).toBe("keyword");        // no regression on the ordinary case
});

test("with no alias oracle nothing re-lexes: the default keeps every existing caller", () => {
  expect(lex("5 ft 3 in", enLocale, keywords).at(-1)?.type).toBe("keyword");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/parse/lex.test.ts`
Expected: FAIL — `1h30m` lexes as `number:1, word:h30m`; the trailing `in` is a keyword.

- [ ] **Step 3: Implement the split**

In `lex.ts`'s letter-run branch, walk the run from `start` with the loop the branch already has, and end the word when a digit sequence is followed by a letter:

```ts
      // A digit sequence FOLLOWED BY A LETTER ends the word: "h30m" is an hour,
      // thirty, a minute, and "ft3in" is five feet three inches. Trailing digits
      // stay attached, because that is how kinds spell area and volume — "m2",
      // "km2", "ft3" are single unit words, and splitting them would make
      // "30 m2" unreadable.
      //
      // Emitted as separate tokens with source-indexed spans, so `Result.spans`
      // still points into the caller's string across a split.
      let j = i;
      while (j < end && !isDigit(input[j] as string)) j += 1;
      let k = j;
      while (k < end && isDigit(input[k] as string)) k += 1;
      const splits = j < end && k < end && !isDigit(input[k] as string);
```

When `splits` is true, emit the letters `[i, j)` as a word, let the main loop pick the digits up through the existing number branch (which already produces a `NumberToken` with source spans), and continue. When it is false, the run stays whole — which is every existing input.

- [ ] **Step 4: Implement the `in` re-lex**

`lex`'s signature gains the optional oracle, defaulted so every existing direct caller (this file's tests, `program.test.ts`) is unchanged:

```ts
export function lex(
  input: string,
  locale: Locale,
  keywords: ReadonlyMap<string, Keyword>,
  isUnitAlias: (text: string) => boolean = () => false,
): Token[] {
```

At the point `lex` decides a word run is a keyword:

```ts
    // Ruling R-B1. "5 ft 3 in" ends in a keyword today and throws, so nothing
    // that works can regress: this branch fires only where the conversion
    // reading is impossible.
    //
    // Three conditions, all required. Preceded by a number, because "in" as a
    // unit is a count of inches. At end of input, or followed by an operator or
    // another `in`, because a conversion keyword needs a target after it and
    // these are the positions where none can follow. And listed as a unit alias
    // by some installed vocabulary, because a language that does not spell the
    // inch this way has no reading to offer — `MatchCtx.isUnitAlias` is the
    // registry query the Tokenizer already builds for the literal fold.
    const previous = tokens.at(-1);
    const following = nextSignificant(input, i, keywords);
    const canBeInch =
      keyword === "in" &&
      previous?.type === "number" &&
      (following === "end" || following === "op" || following === "in") &&
      isUnitAlias(text);
    if (canBeInch) {
      tokens.push({ type: "word", text, start, end: i });
      continue;
    }
```

`nextSignificant(input, from, keywords)` scans forward over whitespace and returns `"end"`, `"op"`, `"in"` or `"other"` by looking at characters — one pass, no token list needed.

In `packages/core/src/parse/tokenizer.ts`, `run()` builds `matchCtx` before it calls `lex`; reorder so `matchCtx` is built first and pass `matchCtx.isUnitAlias` as `lex`'s fourth argument.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/core/src/parse/lex.test.ts packages/core/src/parse/tokenizer.test.ts`
Expected: PASS, all six.

- [ ] **Step 6: Record the intermediate state**

`"1h30m"` still fails to *evaluate* — Task 9 is what folds it — but it now fails differently. Add the named test so the change is recorded rather than surprising:

```ts
// packages/core/src/parse/lex.test.ts
test("a split run fails at the parser, not at the resolver: `Unknown unit \"h30\"` is gone", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(() => engine.evaluate("1h30m")).toThrow(UnitParseError);
});
```

Run: `bun test packages/core`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/parse/lex.ts packages/core/src/parse/lex.test.ts \
        packages/core/src/parse/tokenizer.ts
git commit -m "feat(core): split a digit run inside a word, and re-lex a trailing in as inch"
```

---

## Task 7: Wire `display` through the engine (spec §C.2 options half, §C.3 round-trip ruling)

**Files:**
- Modify: `packages/core/src/engine.ts` — `EngineOptions.display`, `EvalOptions.display`, pass to the `Printer`
- Modify: `packages/core/src/print/print.ts` — `PrinterOptions.display`, `PrintOptions.display`
- Test: `packages/core/src/engine.test.ts`, `packages/core/src/print/roundtrip.test.ts`

**Interfaces:**
- Consumes: `applyDisplay`, `DisplayOptions`, `DEFAULT_DISPLAY` (T4).
- Produces: `createEngine({ display })` and `engine.evaluate(input, { display })`. Neither moves `Result.value.canonical` or `Result.value.raw`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/engine.test.ts — append
test("the §C probes read the way a person expects", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1.5 kg in lb").formatted).toBe("3.3069 pounds");
  expect(engine.evaluate("60 mph in kph").formatted).toBe("96.5606 km/h");
});

test("display is a display policy: the value keeps every digit", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const r = engine.evaluate("1.5 kg in lb");
  expect(r.value.canonical.toFixed()).toBe("1.5");
  expect(r.formatted).toBe("3.3069 pounds");
});

test("a scientific caller sets display once and gets its digits back", () => {
  const engine = createEngine({
    locales: [en], kinds: BUILTIN_KINDS, display: { maximumFractionDigits: 12 },
  });
  expect(engine.evaluate("1.5 kg in lb").formatted).toBe("3.306933932773 pounds");
});

test("display overrides per call, like format", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1.5 kg in lb", { display: { maximumFractionDigits: 1 } }).formatted)
    .toBe("3.3 pounds");
});

test("money is exempt: its own rounding decides the cent", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS, rates: fixedRates });
  expect(engine.evaluate("20 usd in gbp").formatted).toBe("£22.94");
});
```

```ts
// packages/core/src/print/roundtrip.test.ts — replace the round-trip property, and add its guard twin
test("formatted round-trips at display precision", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  for (const input of corpusInputs()) {
    const once = engine.evaluate(input);
    const twice = engine.evaluate(once.formatted);
    expect(applyDisplay(twice.value.canonical, DEFAULT_DISPLAY).toFixed())
      .toBe(applyDisplay(once.value.canonical, DEFAULT_DISPLAY).toFixed());
  }
});

test("R-C1: the round-trip guard is still exact at formatPrecision", () => {
  // The guard `formatPrecision` exists for, tested where it actually lives now:
  // through the Printer at 26 significant digits, not through `formatted`.
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  for (const input of corpusInputs()) {
    const once = engine.evaluate(input);
    const exact = printerFor(engine).print(once, { precision: 26 });
    expect(engine.evaluate(exact).value.canonical.toFixed()).toBe(once.value.canonical.toFixed());
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/print/roundtrip.test.ts`
Expected: FAIL — `display` is not an option; `"3.306933932773163710844607 pounds"`.

- [ ] **Step 3: Implement**

`EngineOptions` gains:

```ts
  /**
   * What `Result.formatted` keeps — ruling R-C1. Distinct from
   * `formatPrecision`, which stays the round-trip and comparison guard at 26
   * significant digits and is not a readability policy.
   *
   * Defaults to `{ maximumFractionDigits: 4, minimumSignificantDigits: 3 }`.
   */
  display?: DisplayOptions;
```

`EvalOptions` gains the same field, documented like `format`: per call, output-only, and it rebuilds nothing but the print step.

`newPrinter` passes `display: opts.display ?? DEFAULT_DISPLAY` into `PrinterOptions`. `toResult` reads `call?.display ?? opts.display ?? DEFAULT_DISPLAY` live, which is the pattern the file already documents for `rates`/`rounding`, and hands it to `printer.print`. `Printer` merges it into the `FormatOptions` it builds for `formatValue`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/print`
Expected: PASS.

- [ ] **Step 5: Re-record the corpus rows this rule moves**

Run: `bun test packages/core` and then each kind package's corpus test.

Every failing row must be explained by "a long decimal is now four fraction digits" or "a symbol now takes a space". Update those `.tsv` rows and nothing else. Do **not** run `parity:record`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/print packages/core/corpus packages/*/corpus
git commit -m "feat(core): EngineOptions.display governs formatted output; formatPrecision stays the guard"
```

---

## Task 8: Derived units reach the parser and the evaluator (spec §D.2, everything but the table)

**Files:**
- Modify: `packages/core/src/parse/pratt.ts` — target chain after `in`
- Modify: `packages/core/src/eval/evaluate.ts` — unit rewrite after a `*`/`/` signature
- Modify: `packages/core/src/solve/solver.ts` — prune target candidates with no `in` signature
- Test: `packages/core/src/parse/pratt.test.ts`, `packages/core/src/eval/evaluate.test.ts`, `packages/core/src/engine.test.ts`, corpus rows in `packages/speed`, `packages/datarate`

**Interfaces:**
- Consumes: `derivedUnitOf`, `derivedKey`, `Registry.derivedUnits` (T3); `Rejection`/`onReject` (T5).
- Produces: a `convert` node whose `targetSpan` covers the whole chain when the chain named one unit; `"100 km / 2 h"` evaluating to a `speed` Value with `unit: "kph"`.

**Rulings to keep:** the plugin's explicit unit wins (rewrite only when the returned unit is the result kind's canonical); `*` chains are limited to two operands, because there is no exponent token to write `s²` with.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/engine.test.ts — append
test("the four §D probes", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("50 km/h in mph").formatted).toBe("31.0686 mph");
  expect(engine.evaluate("(100 km / 2 h) in km/h").formatted).toBe("50 km/h");
  expect(engine.evaluate("100 km / 2 h").formatted).toBe("50 km/h");
  expect(engine.evaluate("10 km in m + 5").value.canonical.toFixed()).toBe("10005");
});

test("a derived result keeps the units the person wrote", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("100 m / 2 s").value.unit).toBe("mps");
  expect(engine.evaluate("100 km / 2 h").value.unit).toBe("kph");
  expect(engine.evaluate("100 mi / 2 h").value.unit).toBe("mph");
});

test("the target prune improves the error rather than changing the result set", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("10 km in m").value.unit).toBe("m"); // metres, not minutes
  const ex = engine.explain("10 km in m + 5");
  expect(ex.outcome.status).toBe("ok");
});
```

```ts
// packages/core/src/parse/pratt.test.ts — append
test("a target chain that names no derived unit backs off to the single unit", () => {
  const node = parseWith("10 km in m + 5");
  expect(node.type).toBe("binary");                      // (10 km in m) + 5
  expect((node as BinaryNode).left.type).toBe("convert");
});

test("a target chain that names a derived unit covers the whole chain", () => {
  const input = "50 km/h in mi / h";
  const node = parseWith(input) as ConvertNode;
  expect(node.type).toBe("convert");
  expect(input.slice(node.targetSpan.start, node.targetSpan.end)).toBe("mi / h");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/parse/pratt.test.ts`
Expected: FAIL — `Cannot apply / to length and duration`; `13.8889 m/s`.

- [ ] **Step 3: Target chain in the parser**

`parse` gains a `registry: Registry` parameter beside `resolver`; `Parser.run` already holds one and threads it. In the `in` branch, after the single-unit target has been resolved and before the `convert` node is built:

```ts
        // After `in`, read `unit ((/|*) unit)` and ask the registry whether the
        // chain names one unit — "in km/h", "in mi / h", "in bit/s". A chain the
        // table does not know backs off to the single unit, which is today's
        // behaviour, so "10 km in m + 5" still parses as (10 km in m) + 5 and
        // the "+ 5" stays arithmetic.
        //
        // Two operands only: `kg * m / s^2` is out of scope while there is no
        // exponent token to write the s² with.
        const chain = tryDerivedTarget();
        if (chain !== undefined) {
          target = chain.candidates;
          targetSpan = chain.span;
          pos = chain.next;
        }
```

```ts
  /**
   * `unit (/|*) unit` after `in`, resolved to the single unit the registry says
   * the pair derives — or undefined, which is the back-off.
   *
   * Undefined unless EXACTLY ONE derived unit is found across every candidate
   * pair: the parser must not rank, and two answers is a ranking question. The
   * result kinds probed are the ones `registry.ops` already has a `(op, left,
   * right)` signature for, so the parser never enumerates kinds it has no
   * signature for either.
   */
  const tryDerivedTarget = ():
    | { candidates: Candidate[]; span: Span; next: number }
    | undefined => {
    const first = tokens[pos];
    const op = tokens[pos + 1];
    const second = tokens[pos + 2];
    if (first?.type !== "word" || second?.type !== "word") return undefined;
    if (op?.type !== "op" || (op.op !== "/" && op.op !== "*")) return undefined;

    const found = new Map<string, Candidate>();
    for (const l of resolver.resolve(first.text, runOf(first))) {
      for (const r of resolver.resolve(second.text, runOf(second))) {
        const sig = registry.ops.get(opKey(op.op, l.kind, r.kind));
        if (sig === undefined) continue;
        const unit = derivedUnitOf(registry, sig.result, l.unit, op.op, r.unit);
        if (unit === undefined) continue;
        found.set(`${sig.result} ${unit}`, resolver.literal({
          kind: sig.result, unit, surface: `${first.text}${op.op}${second.text}`, weight: 0,
        }));
      }
    }
    if (found.size !== 1) return undefined;
    return {
      candidates: [...found.values()],
      span: { start: first.start, end: second.end },
      next: pos + 3,
    };
  };
```

- [ ] **Step 4: Unit rewrite in the evaluator**

In `packages/core/src/eval/evaluate.ts`, after a binary signature produced a `Value`:

```ts
      // The plugin declined to choose a unit — it returned the result kind's
      // canonical — and the operands name one between them. "100 km / 2 h" is
      // 50 kph, not 13.888… m/s, and `speed`'s `make(l, "speed", "mps", …)`
      // becomes a DEFAULT rather than a decision without the plugin changing a
      // line.
      //
      // Only when the returned unit IS the canonical: a signature that chose a
      // non-canonical unit made a decision, and the evaluator does not
      // second-guess a plugin that spoke (ruling §D.3).
      if (node.op === "*" || node.op === "/") {
        const spec = registry.kinds.get(out.kind)?.spec;
        const canonical = spec?.mode === "ratio" ? spec.canonical : undefined;
        if (canonical !== undefined && out.unit === canonical) {
          const derived = derivedUnitOf(registry, out.kind, left.unit, node.op, right.unit);
          if (derived !== undefined) out = Object.freeze({ ...out, unit: derived });
        }
      }
```

- [ ] **Step 5: Prune targets in the solver**

`collectSlots` gains a `registry` parameter (`solve` has one) and, for a `convert` node:

```ts
    } else if (node.type === "convert") {
      // "10 km in m + 5" failed as *length and duration* because the solver
      // enumerated `m` as minutes at the target and only found out at the end.
      // A target whose kind no `in` signature can reach from this operand is not
      // a reading; dropping it before enumeration is the same result set with a
      // better error and fewer paths.
      const reachable = possibleKinds(node.operand, keep);
      slots.push({
        node,
        candidates: node.target
          .filter(keep)
          .filter((c) =>
            reachable.size === 0 ||
            [...reachable].some((k) => registry.ops.has(opKey("in", k, c.kind)))),
      });
```

```ts
/** Every kind the operand subtree could take, without enumerating assignments. */
function possibleKinds(node: Node, keep: (c: Candidate) => boolean): Set<KindId> {
  const out = new Set<KindId>();
  walk(node, (n) => {
    if (n.type === "quantity" || n.type === "literal") {
      for (const c of n.candidates.filter(keep)) out.add(c.kind);
    } else if (n.type === "number") {
      out.add(NUMBER_KIND);
    }
  });
  return out;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/core/src/engine.test.ts packages/core/src/parse packages/core/src/eval packages/core/src/solve`
Expected: PASS.

- [ ] **Step 7: Add the probes as corpus rows**

Add to `packages/speed`'s corpus: `100 km / 2 h`, `50 km/h in mph`, `(100 km / 2 h) in km/h`, `100 mi / 2 h`. Add to `packages/datarate`: `100 mbit / 2 s`.

Run: `bun test packages/speed packages/datarate packages/length`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/parse/pratt.ts packages/core/src/eval packages/core/src/solve \
        packages/speed packages/datarate
git commit -m "feat(core): a compound unit is a target and a result unit, not only an expression"
```

---

## Task 9: The compound fold (spec §B.2, parser half)

**Files:**
- Modify: `packages/core/src/parse/pratt.ts` — the fold in `parseAtom`
- Modify: `packages/core/src/parse/ast.ts` — `implicit?: "compound"` on `BinaryNode`
- Modify: `packages/kind/src/define.ts` — `NormalizedKind.compound`
- Modify: `packages/{duration,length,mass,angle,volume}/src/index.ts` — `compound: true`; `packages/datasize/src/index.ts` — the comment saying why not
- Test: `packages/core/src/parse/pratt.test.ts`, `packages/core/src/engine.test.ts`, the five packages' corpus tests

**Interfaces:**
- Consumes: `Kind.compound` (T1); the lexer split and the `in` re-lex (T6).
- Produces: `{ type: "binary", op: "+", implicit: "compound", ... }` nodes. No new weight and no new selector — the existing `+` signature prices it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/engine.test.ts — append
test("the four §B probes", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1 h 30 min").formatted).toBe("1.5 hours");
  expect(engine.evaluate("5 ft 3 in").value.kind).toBe("length");
  expect(engine.evaluate("1 kg 200 g").formatted).toBe("1.2 kilograms");
  expect(engine.evaluate("1h30m").formatted).toBe("1.5 hours");
});

test("a fold needs one kind on both sides, in strictly descending units", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(() => engine.evaluate("10 m 5 s")).toThrow(SmartputError);   // no shared kind
  expect(() => engine.evaluate("3 m 4 m")).toThrow(SmartputError);    // not descending
  expect(() => engine.evaluate("30 min 1 h")).toThrow(SmartputError); // ascending
});

test("a kind that did not opt in does not fold", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(() => engine.evaluate("1 gb 500 mb")).toThrow(SmartputError);
  expect(() => engine.evaluate("20 degc 5 degc")).toThrow(SmartputError);
});

test("`in` after a compound still converts", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("5 ft 3 in in cm").value.unit).toBe("cm");
  expect(engine.evaluate("5 ft 3 in cm").value.unit).toBe("cm");
});

test("three parts fold left to right", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1 h 30 min 30 s").value.canonical.toFixed()).toBe("5430");
});

test("explain shows the implicit + the person did not type", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.explain("1 h 30 min").outcome.status).toBe("ok");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/engine.test.ts`
Expected: FAIL — `Cannot parse "1 h 30 min" as a quantity`.

- [ ] **Step 3: Implement the fold**

In `ast.ts`, `BinaryNode` gains:

```ts
  /**
   * The `+` nobody typed. "1 h 30 min" is two adjacent quantities of one kind in
   * descending units, which is how people write durations and lengths, and the
   * parser folds them into the sum the engine already knows how to price.
   *
   * Recorded so `explain` can show the operator as implicit rather than claiming
   * the user wrote it, and so a compound PRINT mode has something to key on when
   * it lands.
   */
  implicit?: "compound";
```

In `packages/kind/src/define.ts`, `NormalizedKind` gains `compound: boolean` and `normalizeKind` sets `compound: k.compound ?? false`.

In `pratt.ts`'s `parseAtom`, after the `<number> <unit>` quantity node is built and before it is returned:

```ts
          // Two adjacent quantities of one compound kind, in strictly descending
          // units, are a sum. The engine has `+`; the person did not type it.
          //
          // Both conditions are checked PER KIND, which is what keeps
          // "10 m 5 s" (no shared kind) and "3 m 4 m" (not descending) failing
          // exactly as they do today. The solver then prices the sum with the
          // signature it already had: `+` needs one kind on both sides, so
          // "1 h 30 m" reads `m` as minutes by dimension and metres never had a
          // path to reach.
          let node: Node = quantity;
          for (;;) {
            const folded = tryCompound(node);
            if (folded === undefined) break;
            node = folded;
          }
          return node;
```

```ts
  /** Ratio of one unit with no context, or null when the kind's ratios need one. */
  const ratioOf = (kindId: KindId, unit: string): Decimal | null => {
    const kind = registry.kinds.get(kindId);
    if (kind === undefined || kind.spec.mode !== "ratio" || !kind.compound) return null;
    const def = kind.units.get(unit);
    if (def === undefined) return null;
    try {
      const ctx = { self: { kind: kindId, canonical: IMPLIED_COUNT, unit }, locale: "*" };
      return def.ratio(ctx as unknown as EvalCtx);
    } catch {
      return null;
    }
  };

  /**
   * The `<number> <unit>` after `left`, folded into `left + right`, or undefined.
   *
   * Descending is by ratio and STRICT: equal ratios are not a compound, because
   * "3 m 4 m" is two lengths written beside each other, which nobody does on
   * purpose and which is worth failing on.
   */
  const tryCompound = (left: Node): Node | undefined => {
    const number = tokens[pos];
    const word = tokens[pos + 1];
    if (number?.type !== "number" || word?.type !== "word") return undefined;
    const leftCandidates = left.type === "quantity" ? left.candidates
      : left.type === "binary" ? rightmostCandidates(left) : undefined;
    if (leftCandidates === undefined) return undefined;
    const rightCandidates = resolver.resolve(word.text, runOf(word));
    if (rightCandidates.length === 0) return undefined;

    const foldable = leftCandidates.some((lc) =>
      rightCandidates.some((rc) => {
        if (rc.kind !== lc.kind) return false;
        const lr = ratioOf(lc.kind, lc.unit);
        const rr = ratioOf(rc.kind, rc.unit);
        return lr !== null && rr !== null && lr.gt(rr);
      }));
    if (!foldable) return undefined;

    pos += 2;
    const right: Node = {
      id: id(), type: "quantity", value: number.value,
      candidates: rightCandidates, span: span(number, word),
    };
    const { nodeId, demoted } = demote(left);
    return {
      id: nodeId, type: "binary", op: "+", implicit: "compound",
      left: demoted, right, span: span(demoted.span, right.span),
    };
  };
```

`rightmostCandidates` walks a folded chain's right spine so `"1 h 30 min 30 s"` compares seconds against minutes, not against hours.

- [ ] **Step 4: Opt the five kinds in**

Add `compound: true` to `defineKind({...})` in `packages/{duration,length,mass,angle,volume}/src/index.ts`, each with a one-line comment naming the phrasing it buys: `"1 h 30 min"`, `"5 ft 3 in"`, `"1 kg 200 g"`, `"30° 15′"`, `"1 l 500 ml"`. In `packages/datasize/src/index.ts` add the comment saying why not — nobody writes "1 gb 500 mb" — and leave `temperature` alone with its own line: two adjacent temperatures do not add.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/core packages/duration packages/length packages/mass packages/angle packages/volume packages/datasize packages/temperature`
Expected: PASS.

- [ ] **Step 6: Corpus rows in every locale that has the aliases**

For each of the five packages, add the compound phrasings to the corpus in every locale whose vocabulary lists both units — the phrasings a person actually types, per CONTRIBUTION.md. Add a round-trip row: `"1 h 30 min"` → `"1.5 hours"` → `"1.5 hours"`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/parse packages/kind/src/define.ts \
        packages/duration packages/length packages/mass packages/angle \
        packages/volume packages/datasize
git commit -m "feat(core): fold adjacent descending quantities of a compound kind into a sum"
```

---

## Task 10: Plugin config off `EngineOptions` (spec §G)

**Files:**
- Modify: `packages/core/src/engine.ts` — `EngineOptions.context`, deprecations, the copy-forward
- Modify: `packages/core/src/eval/evaluator.ts` and `eval/evaluate.ts` — `context` onto the `EvalCtx` handed to `apply`
- Modify: `packages/rate/src/*` — read `ctx.context?.money`
- Test: `packages/core/src/engine.test.ts`, `packages/rate`'s tests

**Interfaces:**
- Consumes: `EvalCtx.context` and `MoneyContext` (T1).
- Produces: `createEngine({ context: { money: { rates, rounding } } })`. `rates`/`rounding` keep working for one release.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/engine.test.ts — append
test("context reaches a signature's EvalCtx keyed by kind id", () => {
  const seen: unknown[] = [];
  const probe = defineKind({
    id: "probe",
    value: { mode: "ratio", canonical: "u", units: { u: 1 } },
    ops: [{
      op: "+", left: "probe", right: "probe", result: "probe",
      apply: (l, _r, ctx) => { seen.push(ctx.context?.probe); return l; },
    }],
  });
  const engine = createEngine({
    locales: [en], kinds: [...BUILTIN_KINDS, probe], context: { probe: { dial: 7 } },
  });
  engine.evaluate("1 u + 1 u");
  expect(seen).toEqual([{ dial: 7 }]);
});

test("rates and rounding copy forward into context.money for one release", () => {
  const engine = createEngine({
    locales: [en], kinds: BUILTIN_KINDS, rates: fixedRates, rounding: 4,
  });
  expect(engine.evaluate("20 usd in gbp").formatted).toBe("£22.94");
});

test("an explicit context.money wins over the deprecated fields", () => {
  const engine = createEngine({
    locales: [en], kinds: BUILTIN_KINDS,
    rates: staleRates,
    context: { money: { rates: fixedRates } },
  });
  expect(engine.evaluate("20 usd in gbp").formatted).toBe("£22.94");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/engine.test.ts`
Expected: FAIL — `context` is not an option; `ctx.context` is undefined.

- [ ] **Step 3: Implement**

In `engine.ts`:

```ts
  /**
   * Per-kind configuration, keyed by kind id and opaque to core.
   *
   * `rates` and `rounding` below are money's, and every milestone that needed
   * engine-level configuration added a field beside them. This is the seam that
   * stops the accretion: a kind publishes its context shape in
   * `@smartput/kind/contracts` and reads `ctx.context?.<its id>`.
   *
   * `now` and `timeZone` deliberately stay where they are — they are engine
   * semantics several kinds and `EvalOptions` share, not one plugin's table.
   * `kindMeta` stays too: it is default VALUE meta, a different thing.
   */
  context?: Readonly<Record<KindId, unknown>>;
  /** @deprecated Use `context.money = { rates, rounding }`. Copied forward for one release. */
  rates?: RateLookup;
  /** @deprecated Use `context.money = { rates, rounding }`. */
  rounding?: Decimal.Rounding;
```

In `createEngine`, immediately after options are resolved:

```ts
  // Copied forward only when `context.money` is absent, so a caller who set both
  // gets the one they wrote in the newer API rather than the one that is older
  // in the codebase.
  const hasLegacy = callerOpts.rates !== undefined || callerOpts.rounding !== undefined;
  const context =
    callerOpts.context?.money !== undefined || !hasLegacy
      ? callerOpts.context
      : {
          ...callerOpts.context,
          money: {
            ...(callerOpts.rates !== undefined ? { rates: callerOpts.rates } : {}),
            ...(callerOpts.rounding !== undefined ? { rounding: callerOpts.rounding } : {}),
          },
        };
```

Thread `context` through `EvaluatorOptions` (held by reference, like `rates`) and onto the `EvalCtx` `evaluate.ts` builds for `apply`.

In `packages/rate`, replace the `ctx.rates` reads with:

```ts
const money = ctx.context?.money as MoneyContext | undefined;
const rates = money?.rates ?? ctx.rates;
```

keeping `ctx.rates` as the fallback for the deprecation window.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/src/engine.test.ts packages/rate packages/currency`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/eval packages/rate
git commit -m "feat(core): EngineOptions.context carries per-kind config; rates and rounding deprecate into it"
```

---

## Task 11: Number grammars in the lexer and the tokenizer (spec §A.2, lexing half)

**Files:**
- Modify: `packages/core/src/locale/number.ts` — `Grammar`, `grammarsFor`
- Modify: `packages/core/src/parse/lex.ts` — `NumberReading`, `NumberToken.readings`, per-grammar digit scan
- Modify: `packages/core/src/parse/tokenizer.ts` — derive grammars from `locales`
- Test: `packages/core/src/parse/lex.test.ts`, `packages/core/src/locale/third-language.test.ts`

**Interfaces:**
- Consumes: `lex`'s `isUnitAlias` parameter (T6) — the grammars parameter goes after it.
- Produces:
  ```ts
  export interface Grammar { group: string; decimal: string; locales: readonly string[] }
  export function grammarsFor(locales: readonly Locale[]): Grammar[];
  export interface NumberReading { value: Decimal; locales: readonly string[] }
  export interface NumberToken {
    type: "number";
    /** The format locale's reading, or the only one. Every existing reader of `.value` keeps working. */
    value: Decimal;
    readings: readonly NumberReading[]; // length 1 for "15", "1.5" on an en-only engine
    text: string; start: number; end: number;
  }
  ```
  T12 consumes `NumberToken.readings`.

**Invariant to hold and to test:** a single-grammar engine sees **no change at all** — one reading, no slot, identical scores.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/parse/lex.test.ts — append
test("grammarsFor collapses installed locales to distinct (group, decimal) pairs", () => {
  const gs = grammarsFor([en, de, fr, uk, ja]);
  const pairs = gs.map((g) => `${g.group}|${g.decimal}`).sort();
  expect(new Set(pairs).size).toBe(pairs.length);           // distinct
  expect(gs.find((g) => g.group === "," && g.decimal === ".")?.locales).toEqual(["en", "ja"]);
  expect(gs.find((g) => g.group === "." && g.decimal === ",")?.locales).toContain("de");
});

test("a run with no separator has exactly one reading and is never a slot", () => {
  const [tok] = lex("15 kg", enLocale, keywords, noAlias, grammarsFor([en, de])) as [NumberToken];
  expect(tok.readings).toHaveLength(1);
  expect(tok.value.toFixed()).toBe("15");
});

test("a separated run keeps every grammar that accepts the whole run", () => {
  const [tok] = lex("1,5 kg", enLocale, keywords, noAlias, grammarsFor([en, de])) as [NumberToken];
  expect(tok.readings.map((r) => r.value.toFixed()).sort()).toEqual(["1.5", "15"]);
  expect(tok.value.toFixed()).toBe("15"); // the format locale's, en
});

test("a run one grammar rejects drops that grammar", () => {
  const [tok] = lex("1,00,000", enLocale, keywords, noAlias, grammarsFor([en, de])) as [NumberToken];
  expect(tok.readings.every((r) => !r.locales.includes("en"))).toBe(true);
});

test("a run every grammar rejects is not a number", () => {
  const tokens = lex("1.5.6", enLocale, keywords, noAlias, grammarsFor([en, de]));
  expect(tokens[0]?.type).not.toBe("number");
});

test("a single-grammar engine sees exactly one reading", () => {
  const [tok] = lex("1,000.5 kg", enLocale, keywords, noAlias, grammarsFor([en])) as [NumberToken];
  expect(tok.readings).toHaveLength(1);
  expect(tok.value.toFixed()).toBe("1000.5");
});
```

```ts
// packages/core/src/locale/third-language.test.ts — append
test("an en+uk+de engine reads each thousand-and-decimal spelling to its intended value", () => {
  const t = new Tokenizer({ locale: en, locales: [en, uk, de], registry });
  const values = (s: string) =>
    (t.run(s).tokens[0] as NumberToken).readings.map((r) => r.value.toFixed());
  expect(values("1 000,5 кг")).toContain("1000.5");
  expect(values("1.000,5 kg")).toContain("1000.5");
  expect(values("1,000.5 kg")).toContain("1000.5");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/parse/lex.test.ts packages/core/src/locale/third-language.test.ts`
Expected: FAIL — `grammarsFor` is not exported; `tok.readings` is undefined.

- [ ] **Step 3: Implement `grammarsFor`**

In `packages/core/src/locale/number.ts`:

```ts
export interface Grammar {
  readonly group: string;
  readonly decimal: string;
  /** Locale ids whose `numberFormat` is this pair. Sorted, so a reading is stable. */
  readonly locales: readonly string[];
}

/**
 * The distinct `(group, decimal)` pairs among the installed locales, each tagged
 * with the locale ids that use it.
 *
 * `en`, `ja`, `zh`, `hi`, `id`, `ko` share `(",", ".")`; `de`, `es`, `it`, `nl`,
 * `pt`, `tr`, `pl`, `ru`, `uk`, `fr`, `ar` split across `(".", ",")` and
 * `(" ", ",")`. Seventeen locales collapse to three or four grammars, which is
 * what keeps `lex`'s per-grammar scan from being a per-locale one.
 *
 * Deterministic: pairs in first-installed order, locale ids sorted.
 */
export function grammarsFor(locales: readonly Locale[]): Grammar[] {
  const byPair = new Map<string, { group: string; decimal: string; locales: string[] }>();
  for (const locale of locales) {
    const { group, decimal } = numberSymbols(locale.language);
    const key = `${group} ${decimal}`;
    const hit = byPair.get(key);
    if (hit === undefined) byPair.set(key, { group, decimal, locales: [locale.id] });
    else if (!hit.locales.includes(locale.id)) hit.locales.push(locale.id);
  }
  return [...byPair.values()].map((g) => ({
    group: g.group,
    decimal: g.decimal,
    locales: [...g.locales].sort(),
  }));
}
```

`parseNumber` gains an overload taking a `Grammar` instead of a `Language`, so the per-grammar scan does not have to synthesise a fake language. Keep the existing signature — `numerals.ts` and the completer call it.

- [ ] **Step 4: Per-grammar scan in `lex`**

`lex` gains a trailing parameter, defaulted so every existing direct caller is unchanged:

```ts
export function lex(
  input: string,
  locale: Locale,
  keywords: ReadonlyMap<string, Keyword>,
  isUnitAlias: (text: string) => boolean = () => false,
  grammars: readonly Grammar[] = grammarsFor([locale]),
): Token[] {
```

In the digit branch:

- run the existing scan once per grammar from the same start, each with its own `group`, `decimal` and its own `isFoldedGroup` (only a space-like separator has one);
- keep the grammars whose scan consumed the **maximal** run and whose `parseNumber` returned non-null. A grammar that stopped earlier was reading a word boundary as a number boundary, and is dropped;
- `readings` are the survivors, deduplicated by value with locale ids unioned;
- `value` is the reading whose `locales` contains the format locale's id, falling back to the first reading;
- `end` is the maximal run.

If every grammar rejects, fall through to today's behaviour: the run is not a number.

- [ ] **Step 5: Tokenizer derives grammars**

`TokenizerOptions` gains no field: the constructor computes `this.grammars = grammarsFor(this.locales)` and `run()` passes it to `lex`. Update the `EvalOptions.format` doc comment in `engine.ts` — it still says output-only, which stays true, but the sentence about the input grammar becomes "the format locale's grammar is the one `NumberToken.value` takes; every installed grammar contributes a reading."

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/core/src/parse packages/core/src/locale`
Expected: PASS.

Run: `bun test packages/core`
Expected: PASS with the English corpus unmoved — that is this task's acceptance criterion.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/locale/number.ts packages/core/src/parse/lex.ts \
        packages/core/src/parse/lex.test.ts packages/core/src/parse/tokenizer.ts \
        packages/core/src/locale/third-language.test.ts
git commit -m "feat(core): a number carries one reading per installed grammar"
```

---

## Task 12: Number slots in the solver (spec §A.2 solving half, ruling R-A1)

**Files:**
- Modify: `packages/core/src/parse/ast.ts` — `numberReadings` on `QuantityNode` and `NumberNode`
- Modify: `packages/core/src/parse/pratt.ts` — attach it when a token had more than one reading
- Modify: `packages/core/src/solve/solver.ts` — number slots in `collectSlots`, `enumerate`, `Resolution`
- Modify: `packages/core/src/solve/weights.ts` — `grammar:<localeId>` selector
- Modify: `packages/core/src/engine.ts` — `grammar:<format>` default in the engine layer, `assignments[].numbers`
- Modify: `packages/core/src/eval/evaluate.ts` — read the chosen reading's value
- Test: `packages/core/src/solve/solver.test.ts`, `packages/core/src/engine.test.ts`

**Interfaces:**
- Consumes: `NumberReading` (T11).
- Produces: `Resolution.numbers: Readonly<Record<NodeId, NumberReading>>`; `Explanation.assignments[].numbers: Array<{ node: NodeId; value: string; locales: readonly string[] }>`.

**Ruling R-A1, recorded in the code:** the format locale's grammar carries **+1** by default — at 0 a bare `"1,000"` on an en+de engine is a coin flip and `evaluate` would throw `AmbiguityError` on every thousand a user types. Unit agreement is **+2**, and agreement is with the unit candidate's `Candidate.locale`, never with the reader.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/solve/solver.test.ts — append
test("the worked example: en+de engine, format en, `1,5 kg`", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  const [first, second] = engine.suggest("1,5 kg");
  expect(first?.value.canonical.toFixed()).toBe("15");
  expect(first?.confidence).toBeCloseTo(0.73, 2);
  expect(second?.value.canonical.toFixed()).toBe("1.5");
  expect(second?.confidence).toBeCloseTo(0.27, 2);
});

test("a German word beside a German number wins: `1,5 Kilogramm`", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  const [first] = engine.suggest("1,5 Kilogramm");
  expect(first?.value.canonical.toFixed()).toBe("1.5");
  expect(first?.confidence).toBeCloseTo(0.73, 2);
});

test("R-A1: a bare thousand still reads under the format grammar, not as a coin flip", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1,000").value.canonical.toFixed()).toBe("1000");
  expect(engine.evaluate("1.000 Kilogramm").value.canonical.toFixed()).toBe("1");
});

test("a caller pins a grammar with a weight layer", () => {
  const engine = createEngine({
    locales: [en, de], kinds: BUILTIN_KINDS, weights: { "grammar:de": 5 },
  });
  expect(engine.evaluate("1,5 kg").value.canonical.toFixed()).toBe("1.5");
});

test("agreement is with the unit candidate's locale, not the reader's", () => {
  const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "en" });
  expect(engine.evaluate("1 000,5 кг").value.canonical.toFixed()).toBe("1000.5");
});

test("EvalOptions.locales filters number readings too", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("1,5 kg", { locales: ["en"] }).value.canonical.toFixed()).toBe("15");
});

test("a single-grammar engine has no number slot and no grammar rows", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const ex = engine.explain("1,000.5 kg");
  expect(ex.assignments).toHaveLength(1);
  expect(ex.assignments[0]?.contributions.some((c) => c.selector.startsWith("grammar:"))).toBe(false);
});

test("explain records the chosen reading per number slot", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  const ex = engine.explain("1,5 kg");
  expect(ex.assignments[0]?.numbers[0]?.locales).toContain("en");
  expect(ex.assignments[0]?.contributions.map((c) => c.selector)).toContain("grammar:en");
});

test("coerce takes the format reading: it has no solver to rank with", () => {
  const engine = createEngine({ locales: [en, de], kinds: BUILTIN_KINDS });
  expect(engine.coerce("mass", "1,5 kg").canonical.toFixed()).toBe("15");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: FAIL — `"1,5 kg"` evaluates to 15 kg at confidence 1 and `suggest` returns one row.

- [ ] **Step 3: Carry readings onto the node**

In `ast.ts`, both `QuantityNode` and `NumberNode` gain:

```ts
  /**
   * Present only when the digits admitted more than one reading — a separator
   * some installed grammar reads differently from the format one. A node without
   * it is not a slot, which is what keeps a single-grammar engine's enumeration
   * byte-identical.
   */
  numberReadings?: readonly NumberReading[];
```

In `pratt.ts`'s number branch, attach it when `token.readings.length > 1`. `value` stays the format reading, so `count.ts`, the completer, `coerce` and `validate` keep working — and say in the doc comment that `coerce`/`validate` take the format reading because they have no solver to rank with.

- [ ] **Step 4: Number slots in the solver**

```ts
type Slot =
  | { type: "unit"; node: Node; candidates: Candidate[] }
  | { type: "number"; node: Node; readings: NumberReading[] };
```

`collectSlots` pushes a number slot for any node carrying `numberReadings`, filtered by `opts.locales` in the same place and by the same rule unit candidates are: a reading whose `locales` has no id in the list is dropped.

`enumerate` iterates number slots exactly like unit slots, recording the chosen reading in a parallel `numbers: Record<NodeId, NumberReading>` and adding its score:

```ts
/**
 * A number reading's score: the grammar weight layers plus the agreement bonus.
 *
 * Ruling R-A1. The format grammar's `+1` lives in the ENGINE's own weight layer,
 * not here, so a caller who wants a different default writes one — and so this
 * stays a pure sum over layers, like every other score in the file.
 *
 * `+2` for agreement is charged when the quantity's chosen unit candidate was
 * listed by a language that also spells numbers this way. `Candidate.locale` is
 * "the language that listed this spelling", which is precisely the evidence
 * wanted here. Two rather than one, so agreement can overturn the format default
 * and still lose to an explicit `{ "grammar:de": 5 }`.
 */
const AGREEMENT_BONUS = 2;
```

`weights.ts` adds one selector per locale in the reading:

```ts
/**
 * `grammar:<localeId>` — one per locale whose number grammar produced this
 * reading. A caller pins a language's digits with `{ "grammar:de": 5 }` the way
 * they pin its words with `{ "locale:de": 5 }`, and the engine layer's
 * `grammar:<format>` default of 1 is what keeps a bare "1,000" reading the way
 * the engine's own language reads it (R-A1).
 */
```

`Resolution` gains `readonly numbers: Readonly<Record<NodeId, NumberReading>>`, frozen alongside `choices`. `evaluate.ts` reads `resolution.numbers[node.id]?.value ?? node.value`.

- [ ] **Step 5: Engine layer default and `explain`**

In `engine.ts`'s engine weight layer, beside the existing entries: `[`grammar:${format.id}`]: 1`.

`Explanation.assignments[]` gains `numbers: Array<{ node: NodeId; value: string; locales: readonly string[] }>`, filled from `Resolution.numbers` with the value as a decimal string so an explanation stays JSON-shaped. `grammar:*` rows already flow into `contributions` through `weightBreakdown`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/core/src/solve packages/core/src/engine.test.ts`
Expected: PASS, all nine.

- [ ] **Step 7: The single-locale invariant, measured**

Run: `bun test packages/core packages/mass packages/length`
Expected: PASS with **no** change to the English corpus. If an English row moved, a number slot is firing on a single-grammar engine — a bug in `collectSlots`, not a fixture to re-record.

Add corpus rows in every locale package that carries a decimal comma, using the phrasings people type there.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/parse/ast.ts packages/core/src/parse/pratt.ts \
        packages/core/src/solve packages/core/src/eval packages/core/src/engine.ts packages/*/corpus
git commit -m "feat(core): rank number readings across installed grammars as solver slots"
```

---

## Task 13: Fixtures, size rows, docs

**Files:**
- Modify: `packages/core/parity/en.json`, `packages/core/parity/uk.json` (re-recorded)
- Modify: `scripts/check-size.ts` (rows that moved, each with its reason)
- Modify: `docs/guide/roadmap.md`, `docs/guide/errors.md`, `docs/guide/inputs.md`, `docs/guide/weights.md`

- [ ] **Step 1: Re-record parity**

Run: `bun run parity:record`
Run: `git diff --stat packages/core/parity`

- [ ] **Step 2: Read the diff and justify every class of change**

Every moved row must fall into one of: display precision (T4/T7), symbol spacing (T4), derived result unit (T8), `Explanation` gained `outcome`/`rejections`/`numbers` (T5/T12), compound fold (T9). Anything else is a regression — find it with `engine.explain` before continuing.

Write the classes into the PR body; CONTRIBUTION.md requires a re-record to be explained, and "a fixture that re-records itself proves nothing".

- [ ] **Step 3: Size rows**

Run: `bun run build && bun run check-size`

For each row that moved, raise the budget and write the one-line reason above it: the per-grammar loop (spec §A.4 expects under 300 B), the derived-unit table, the compound fold, the display rounding.

- [ ] **Step 4: Docs**

- `docs/guide/roadmap.md`: one paragraph per core change and what forced it. That file is what the next person reads before proposing another core change. Record all four rulings with their trade, not just their conclusion.
- `docs/guide/errors.md`: `explain` never throws; `Explanation.outcome`; `Rejection`; every error carries spans except `TooAmbiguousError`.
- `docs/guide/inputs.md`: compound quantities, and numbers read under every installed grammar.
- `docs/guide/weights.md`: the `grammar:` selector beside `locale:`.

- [ ] **Step 5: The full gate**

Run: `bun run check`
Expected: PASS — lint, typecheck, check-deps, test, build, check-size.

Run: `bun run pack-size`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/parity scripts/check-size.ts docs/guide
git commit -m "docs(repo): record the second-pass rulings, re-record parity, move the size rows"
```

---

## Follow-ups this plan names and does not do

Carried from the spec's §H, unchanged: typed weight selectors; `class Engine` over the `createEngine` closure; compound *print* mode (`"1 h 30 min"` out, not only in); exponent tokens (`m²`, `s²`), which would let §D's table cover area and acceleration.
