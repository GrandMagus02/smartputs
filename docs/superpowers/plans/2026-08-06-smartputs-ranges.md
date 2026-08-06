# Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@smartput/date`, `@smartput/time`, `@smartput/range-core`, `@smartput/date-range`, `@smartput/time-range` and `@smartput/datetime-range`, so that `whole week`, `10:00 - 20:00`, `yesterday morning` and `from today to closest holiday` evaluate to a value with two ends.

**Architecture:** `date` and `time` are opaque kinds that re-read `@smartput/datetime`'s existing chrono match rather than parsing again, claiming the same span so M6.3's fold carries every reading forward together. Range kinds are then ordinary op signatures over those two kinds, plus literal matchers for the phrases that have no two-operand shape. Core takes exactly one change: `OpSignature.weight`.

**Tech Stack:** TypeScript, Bun (test runner, bundler, workspaces), `temporal-polyfill`, `chrono-node`, Biome.

**Spec:** `docs/superpowers/specs/2026-08-06-smartputs-ranges-design.md`. Read it before starting; this plan implements it and does not restate its reasoning.

## Global Constraints

- **Never import `decimal.js` directly.** Import `Decimal` from `@smartput/core`. Core's module-load `Decimal.set({ precision: 28 })` is what keeps every package at one precision.
- **`Temporal` is imported from `@smartput/datetime`**, never from `temporal-polyfill`. That package has one import site by design.
- **Every package must appear in `scripts/check-deps.ts`'s `ALLOWED` map** with a comment explaining its dependency edge, or CI fails. The loop discovers packages from the filesystem and fails on one the map does not mention.
- **Every `exports` subpath must have a `check-size.ts` budget row.** Budgets are a measurement rounded up to the next 50 B; `FLOOR_RATIO` is 0.7, so a row measuring under 70% of its ceiling also fails.
- **Test clock is `TEST_NOW = 1_768_478_400_000`** (2026-01-15T12:00:00Z, a Thursday) in `TEST_ZONE = "UTC"`, both exported from `@smartput/datetime`'s `temporal.ts`.
- **Corpus files are TSV**: `input \t kind \t canonical \t formatted`, `#` comments, in `packages/<name>/corpus/en.tsv`.
- **Ranges store their end exclusive.** Only `date-range`'s formatter subtracts a day for display.
- **Commit after every task.** Conventional Commits, and run `bun run lint` before committing.
- **Numbers that must appear verbatim:** reading weight `-5`, signature weight `+20`, `CONTEXT_BONUS` 30, `TYPO_PENALTY` 15.

---

## File Structure

**Modified:**

- `packages/core/src/types.ts` — `OpSignature.weight`
- `packages/core/src/kind/registry.ts` — carry `weight` into the op table
- `packages/core/src/solve/solver.ts` — `signatureWeight` walk, `Assignment.signatureWeight`
- `packages/core/src/engine.ts` — surface it in `explain()`
- `packages/datetime/src/chrono-bridge.ts` — `hasDate` / `hasTime` on `BridgeMatch`
- `scripts/check-deps.ts`, `scripts/check-size.ts` — six packages, nine entries
- `docs/guide/roadmap.md`, `docs/guide/` — new guide page

**Created — one responsibility each:**

| File | Responsibility |
| --- | --- |
| `packages/date/src/value.ts` | `DATE_KIND`, `wrap`, `unwrap`, `startOfDay` |
| `packages/date/src/date.ts` | the kind, its matcher, its ops, its format |
| `packages/date/src/index.ts` | barrel |
| `packages/time/src/value.ts` | `TIME_KIND`, `wrap`, `unwrap`, ns-of-day helpers |
| `packages/time/src/time.ts` | the kind, its matcher, its ops, its format |
| `packages/time/src/index.ts` | barrel |
| `packages/range-core/src/value.ts` | `RangeMeta`, `wrapRange`, `unwrapRange` |
| `packages/range-core/src/snap.ts` | week/month/year/day boundaries |
| `packages/range-core/src/windows.ts` | the named-window table |
| `packages/range-core/src/endpoint.ts` | `EndpointParser`, `resolveEndpoint` |
| `packages/range-core/src/errors.ts` | `InvertedRangeError` |
| `packages/range-core/src/weights.ts` | `RANGE_WEIGHTS` |
| `packages/range-core/src/index.ts` | barrel |
| `packages/date-range/src/{phrases,date-range,index}.ts` | calendar-span phrases; the kind |
| `packages/time-range/src/{time-range,index}.ts` | the kind, the dash race |
| `packages/datetime-range/src/{phrases,datetime-range,holiday,index}.ts` | window+date phrases, `from`/`until`, the holiday subpath |

---

## Task 0: Scaffold six packages

Everything downstream needs these directories linked into the workspace and named in `check-deps`. Doing it once, first, keeps later tasks from racing on `bun.lock`.

**Files:**
- Create: `packages/{date,time,range-core,date-range,time-range,datetime-range}/package.json`
- Create: `packages/{date,time,range-core,date-range,time-range,datetime-range}/tsconfig.json`
- Create: `packages/{date,time,range-core,date-range,time-range,datetime-range}/src/index.ts`
- Modify: `scripts/check-deps.ts`

**Interfaces:**
- Produces: six workspace packages resolvable as `@smartput/<name>`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-deps.test.ts` only if absent; otherwise skip to Step 2 and use `bun run check-deps` as the test.

- [ ] **Step 2: Run `bun run check-deps` to verify it fails**

Run: `bun run check-deps`
Expected: FAIL, naming each of the six new packages as unlisted — but only after Step 3 creates them. Run it now to record the current PASS baseline.

- [ ] **Step 3: Create the six manifests**

`packages/date/package.json` — the other five follow the same shape, differing only in `name`, `dependencies` and (for `datetime-range`) the extra subpath.

```json
{
  "name": "@smartput/date",
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
    "@smartput/datetime": "workspace:*"
  },
  "devDependencies": {
    "@smartput/kinds": "workspace:*"
  }
}
```

Dependencies per package:

| Package | `dependencies` |
| --- | --- |
| `date` | `@smartput/core`, `@smartput/datetime` |
| `time` | `@smartput/core`, `@smartput/datetime` |
| `range-core` | `@smartput/core`, `@smartput/datetime` |
| `date-range` | `@smartput/core`, `@smartput/date`, `@smartput/range-core` |
| `time-range` | `@smartput/core`, `@smartput/range-core`, `@smartput/time` |
| `datetime-range` | `@smartput/core`, `@smartput/date`, `@smartput/datetime`, `@smartput/holiday`, `@smartput/range-core`, `@smartput/time` |

Every package also takes `"devDependencies": { "@smartput/kinds": "workspace:*" }`, which the corpus tests need for `BUILTIN_KINDS`.

`datetime-range` declares a second subpath:

```json
    "./holiday": {
      "bun": "./src/holiday.ts",
      "types": "./dist/holiday.d.ts",
      "default": "./dist/holiday.js"
    }
```

- [ ] **Step 4: Create the six tsconfigs**

Identical in every package:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Create six placeholder barrels**

`packages/<name>/src/index.ts`, one line so the build has an entry:

```ts
export {};
```

For `datetime-range` also create `src/holiday.ts` with the same line.

- [ ] **Step 6: Add the six rows to `check-deps.ts`**

Insert into `ALLOWED`, keeping the map's existing style of a comment per row explaining the edge:

```ts
  // The calendar-day half of datetime's recognition. It depends on datetime
  // rather than on chrono because it re-reads the match datetime already made
  // — `hasDate && !hasTime` — instead of parsing the string a second time.
  "packages/date/package.json": ["@smartput/core", "@smartput/datetime"],
  // The clock-time half, on the same terms as `date`.
  "packages/time/package.json": ["@smartput/core", "@smartput/datetime"],
  // The interval algebra the three range kinds share: the meta shape, boundary
  // snapping, the window table, the endpoint seam and `InvertedRangeError`.
  // Depends on datetime for `Temporal` rather than importing temporal-polyfill
  // a second time; every consumer of this package already pays for datetime.
  "packages/range-core/package.json": ["@smartput/core", "@smartput/datetime"],
  "packages/date-range/package.json": [
    "@smartput/core",
    "@smartput/date",
    "@smartput/range-core",
  ],
  "packages/time-range/package.json": [
    "@smartput/core",
    "@smartput/range-core",
    "@smartput/time",
  ],
  // `@smartput/holiday` is a dependency of the package but not of its root
  // entry: one file imports it, `src/holiday.ts`, reachable only through the
  // `./holiday` subpath. Enforced next door by check-size.ts's
  // `datetime-range root (no holiday data)` row, exactly as datetime's is.
  "packages/datetime-range/package.json": [
    "@smartput/core",
    "@smartput/date",
    "@smartput/datetime",
    "@smartput/holiday",
    "@smartput/range-core",
    "@smartput/time",
  ],
```

- [ ] **Step 7: Install and verify**

Run: `bun install && bun run check-deps && bun run typecheck`
Expected: PASS on all three.

- [ ] **Step 8: Commit**

```bash
git add packages/date packages/time packages/range-core packages/date-range packages/time-range packages/datetime-range scripts/check-deps.ts bun.lock
git commit -m "chore: scaffold the six range packages"
```

---

## Task 1: `OpSignature.weight` in core

The spec's §4.2. Without it no range signature can outrank the subtraction it competes with.

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/kind/registry.ts`
- Modify: `packages/core/src/solve/solver.ts`
- Test: `packages/core/src/solve/solver.test.ts`

**Interfaces:**
- Produces: `OpSignature.weight?: number`, summed into a candidate's score; `Assignment.signatureWeight: number`.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/solve/solver.test.ts`. Follow the file's existing helper style for building a registry — read it first and reuse whatever fixture it already has rather than inventing one.

```ts
test("a signature weight lifts its candidate above an equal-scoring rival", () => {
  // Two kinds claim the same two spans. Only the weighted signature differs.
  const engine = createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, kindAlpha, kindBeta],
  });
  // `kindBeta`'s `+ | beta | beta` declares weight: 20; alpha's declares none.
  const r = engine.evaluate("1 alpha + 2 alpha");
  expect(r.kind).toBe("beta-sum");
});

test("signatureWeight defaults to zero and moves no existing score", () => {
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const r = engine.evaluate("2 kg + 3 kg");
  expect(r.explain().find((row) => row.selector === "signature")).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: FAIL — `weight` is not a property of `OpSignature`, so the fixture will not typecheck.

- [ ] **Step 3: Add the field**

`packages/core/src/types.ts`, inside `OpSignature`, after `assumption`:

```ts
  /**
   * Summed into the candidate's score whenever this signature is applied.
   *
   * The other weight layers are properties of a *reading* — `token:<surface>`,
   * `<kind>:<unit>`, `<kind>` — and the result kind is never scored at all. So
   * a plugin that wants one signature preferred without also preferring its
   * operands everywhere has no way to say so: `- | time | time` must beat
   * `- | datetime | datetime` while a bare "3pm" must still read as a datetime.
   * This is that term. Defaults to 0, so no existing signature moves.
   */
  readonly weight?: number;
```

- [ ] **Step 4: Carry it through the registry**

In `packages/core/src/kind/registry.ts`, pass 4 builds the op table. Include `weight` on the stored entry — if the table stores the whole `OpSignature`, nothing changes and this step is a no-op; verify by reading the file.

- [ ] **Step 5: Sum it in the solver**

`packages/core/src/solve/solver.ts`. Add beside `contextBonus`, which resolves signatures the same way:

```ts
/**
 * The signature half of a candidate's score, and the mirror of `contextBonus`
 * above: same walk, same `typeOf` resolution, different term. A signature that
 * declares no weight contributes 0, which is why adding this moved no corpus
 * row.
 */
function signatureWeight(
  node: Node,
  choices: Map<Node, Candidate>,
  registry: Registry,
): number {
  let total = 0;
  walk(node, (n) => {
    if (n.type === "binary") {
      const left = typeOf(n.left, choices, registry);
      const right = typeOf(n.right, choices, registry);
      if (left === null || right === null) return;
      total += registry.ops.get(opKey(n.op, left, right))?.weight ?? 0;
    } else if (n.type === "convert") {
      const operand = typeOf(n.operand, choices, registry);
      const target = choices.get(n);
      if (operand === null || target === undefined) return;
      total += registry.ops.get(opKey("in", operand, target.kind))?.weight ?? 0;
    }
  });
  return total;
}
```

Extend `Assignment`:

```ts
  /** The part of `score` that came from op signatures, so explain() can list it. */
  signatureWeight: number;
```

And in `enumerate`, where `viable.push` happens:

```ts
      const bonus = contextBonus(root, choices, registry);
      const signature = signatureWeight(root, choices, registry);
      viable.push({
        choices: new Map(choices),
        kind,
        score: weight + bonus + signature,
        contextBonus: bonus,
        signatureWeight: signature,
      });
```

Update the `viable` array's inline type to include `signatureWeight: number`.

- [ ] **Step 6: Surface it in `explain()`**

In `packages/core/src/engine.ts`, find where `contextBonus` is turned into an explain row and add the sibling row, emitted only when non-zero:

```ts
    ...(assignment.signatureWeight === 0
      ? []
      : [{ selector: "signature", value: assignment.signatureWeight, layer: 0 }]),
```

- [ ] **Step 7: Run the full core suite**

Run: `bun test packages/core`
Expected: PASS, including every pre-existing test. If any corpus row moved, the default is not 0 somewhere — fix that rather than the corpus.

- [ ] **Step 8: Commit**

```bash
git add packages/core
git commit -m "feat(core): weight an op signature into a candidate's score"
```

---

## Task 2: `hasDate` / `hasTime` on the chrono bridge

**Files:**
- Modify: `packages/datetime/src/chrono-bridge.ts`
- Test: `packages/datetime/src/chrono-bridge.test.ts`

**Interfaces:**
- Produces: `BridgeMatch` gains `readonly hasDate: boolean` and `readonly hasTime: boolean`.

- [ ] **Step 1: Write the failing test**

Append to `packages/datetime/src/chrono-bridge.test.ts`, matching the file's existing `ctx` fixture:

```ts
test("a bare date reports hasDate and not hasTime", () => {
  const m = parseDateTime("today", 0, ctx);
  expect(m?.hasDate).toBe(true);
  expect(m?.hasTime).toBe(false);
});

test("a bare clock time reports hasTime and not hasDate", () => {
  const m = parseDateTime("3pm", 0, ctx);
  expect(m?.hasDate).toBe(false);
  expect(m?.hasTime).toBe(true);
});

test("an ISO date-time reports both", () => {
  const m = parseDateTime("2026-03-01 08:00", 0, ctx);
  expect(m?.hasDate).toBe(true);
  expect(m?.hasTime).toBe(true);
});

test("a weekday-snapped week phrase reports a date", () => {
  const m = parseDateTime("next week monday", 0, ctx);
  expect(m?.hasDate).toBe(true);
  expect(m?.hasTime).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/datetime/src/chrono-bridge.test.ts`
Expected: FAIL — `hasDate` is undefined.

- [ ] **Step 3: Implement**

In `chrono-bridge.ts`, extend the interface:

```ts
export interface BridgeMatch {
  zdt: Temporal.ZonedDateTime;
  length: number;
  /**
   * Which components the user actually typed, as chrono certainty rather than
   * as a guess from the resolved value. `@smartput/date` claims a match with
   * `hasDate && !hasTime`, `@smartput/time` one with `hasTime && !hasDate`, and
   * neither package re-runs chrono to find out.
   *
   * `hasDate` is `isCertain("day")` OR a weekday snap: "next week monday"
   * resolves a day the user named through `weekdaySnap`, and chrono's own
   * certainty flags do not see that.
   */
  hasDate: boolean;
  hasTime: boolean;
}
```

`certainTime` is already computed in `parseDateTime`. Add beside it:

```ts
    const certainDate = result.start.isCertain("day");
```

and return, at the existing `return { zdt, length }`:

```ts
    return { zdt, length, hasDate: certainDate || snap !== null, hasTime: certainTime };
```

`snap` is in scope at that point — it is assigned above the `accepts` gate.

- [ ] **Step 4: Run to verify it passes**

Run: `bun test packages/datetime`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add packages/datetime
git commit -m "feat(datetime): report which date components the user typed"
```

---

## Task 3: `@smartput/date`

**Files:**
- Create: `packages/date/src/value.ts`, `packages/date/src/date.ts`, `packages/date/src/index.ts`
- Create: `packages/date/src/date.test.ts`, `packages/date/src/corpus.test.ts`
- Create: `packages/date/corpus/en.tsv`
- Replace: `packages/date/src/index.ts` (the Task 0 placeholder)

**Interfaces:**
- Consumes: `parseDateTime`, `BridgeMatch.hasDate`, `BridgeMatch.hasTime`, `Temporal`, `TEST_NOW`, `TEST_ZONE` from `@smartput/datetime`.
- Produces:
  - `DATE_KIND = "date"`, `DATE_UNIT = "day"`
  - `wrap(zdt: Temporal.ZonedDateTime): Value` — snaps to start of day
  - `unwrap(value: Value): Temporal.ZonedDateTime`
  - `createDate(opts?: { weight?: number }): Kind`
  - `date: Kind` — `createDate()`

- [ ] **Step 1: Write the failing test**

`packages/date/src/date.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { date } from "./date";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, date],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare date still reads as a datetime", () => {
  // The `date` reading is weighted -5, so it loses to datetime on its own.
  const r = engine.evaluate("today");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-15 00:00 UTC");
});

test("but the date reading is present and explainable", () => {
  const kinds = engine.evaluate("today", { kinds: ["date"] });
  expect(kinds.kind).toBe("date");
  expect(kinds.formatted).toBe("2026-01-15");
});

test("a clock time yields no date reading", () => {
  expect(() => engine.evaluate("3pm", { kinds: ["date"] })).toThrow();
});

test("an ISO date-time yields no date reading", () => {
  expect(() => engine.evaluate("2026-03-01 08:00", { kinds: ["date"] })).toThrow();
});

test("the date value snaps to midnight and carries its zone on meta", () => {
  const { value } = engine.evaluate("today", { kinds: ["date"] });
  expect(value.unit).toBe("day");
  expect(value.meta?.day).toBe("2026-01-15");
  expect(value.meta?.zone).toBe("UTC");
});

test("a date plus a duration is a date", () => {
  const r = engine.evaluate("today + 3 d", { kinds: ["date", "duration"] });
  expect(r.kind).toBe("date");
  expect(r.formatted).toBe("2026-01-18");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/date`
Expected: FAIL — `./date` has no export `date`.

- [ ] **Step 3: Write `value.ts`**

```ts
import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "@smartput/datetime";

export const DATE_KIND = "date";

/**
 * The kind's one unit, and deliberately not a time zone.
 *
 * A `convert` node takes its targets from the unit-alias index, so a `date`
 * that copied datetime's zone table would make "tokyo" a date target — and
 * "today in tokyo" would match `in | date | date`, which is a date-range, and
 * outscore the zone conversion because both operands would agree on kind and
 * collect the context bonus. One unit closes that off by construction.
 */
export const DATE_UNIT = "day";

/** Midnight of `zdt`'s calendar day, in `zdt`'s own zone. */
export function startOfDay(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zdt.startOfDay();
}

export function wrap(zdt: Temporal.ZonedDateTime): Value {
  const day = startOfDay(zdt);
  return Object.freeze({
    kind: DATE_KIND,
    canonical: new Decimal(day.epochNanoseconds.toString()),
    unit: DATE_UNIT,
    meta: Object.freeze({
      iso: day.toString(),
      day: `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`,
      zone: day.timeZoneId,
    }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(`date value is missing meta.iso: ${JSON.stringify(value.unit)}`);
  }
  return Temporal.ZonedDateTime.from(iso);
}
```

- [ ] **Step 4: Write `date.ts`**

```ts
import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { addDuration, parseDateTime } from "@smartput/datetime";
import { DATE_KIND, DATE_UNIT, unwrap, wrap } from "./value";

export interface DateOptions {
  /**
   * Summed into every claim this kind makes. Negative by default so that a
   * bare "today" still reads as a `datetime` and formats as it always has;
   * the range signatures in `@smartput/date-range` carry +20 of their own,
   * which is what lets "today to friday" outscore a zone conversion.
   */
  weight?: number;
}

export const DEFAULT_DATE_WEIGHT = -5;

const dateLiteral =
  (weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const match = parseDateTime(input, offset, ctx);
    if (match === null) return null;
    // A day the user named, and no clock time. "2026-03-01 08:00" is both and
    // belongs to datetime alone; "3pm" is neither and belongs to `time`.
    if (!match.hasDate || match.hasTime) return null;
    const value = wrap(match.zdt);
    return {
      kind: DATE_KIND,
      unit: value.unit,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: match.length,
      weight,
      // "friday" has to be able to stand on the right of `to`.
      targetable: true,
    };
  };

function formatDate(value: { meta?: Readonly<Record<string, unknown>> }): string {
  return String(value.meta?.day ?? "");
}

export function createDate(opts: DateOptions = {}): Kind {
  return defineKind({
    id: DATE_KIND,
    value: { mode: "opaque", units: { [DATE_UNIT]: { aliases: [], symbol: "" } } },
    literals: [dateLiteral(opts.weight ?? DEFAULT_DATE_WEIGHT)],
    ops: [
      {
        op: "+",
        left: DATE_KIND,
        right: "duration",
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
      },
      {
        op: "+",
        left: "duration",
        right: DATE_KIND,
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(r), l, 1)),
      },
      {
        op: "-",
        left: DATE_KIND,
        right: "duration",
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
      },
    ],
    format: formatDate,
  });
}

export const date: Kind = createDate();
```

If `addDuration` is not exported from `@smartput/datetime`'s index, add it there in this task — it is already exported from `value.ts` inside that package.

- [ ] **Step 5: Write `index.ts`**

```ts
export { createDate, DEFAULT_DATE_WEIGHT, date, type DateOptions } from "./date";
export { DATE_KIND, DATE_UNIT, startOfDay, unwrap, wrap } from "./value";
```

- [ ] **Step 6: Run to verify it passes**

Run: `bun test packages/date`
Expected: PASS.

- [ ] **Step 7: Add the corpus**

`packages/date/corpus/en.tsv` — canonical values are epoch nanoseconds at UTC midnight; compute them, do not guess:

```
# input	kind	canonical	formatted
today	date	1768435200000000000	2026-01-15
tomorrow	date	1768521600000000000	2026-01-16
yesterday	date	1768348800000000000	2026-01-14
next friday	date	1769126400000000000	2026-01-23
2026-03-01	date	1772323200000000000	2026-03-01
```

`packages/date/src/corpus.test.ts` — copy `packages/datetime/src/corpus.test.ts` verbatim, changing the imports and adding `kinds: ["date"]` to the `evaluate` call so the rows assert the date reading rather than the datetime one that outscores it.

- [ ] **Step 8: Run and commit**

Run: `bun test packages/date && bun run lint`

```bash
git add packages/date
git commit -m "feat(date): a calendar-day kind over datetime's existing match"
```

---

## Task 4: `@smartput/time`

Same shape as Task 3, mirrored onto the clock. Read Task 3 in full before starting; the code below is complete and does not defer to it.

**Files:**
- Create: `packages/time/src/value.ts`, `packages/time/src/time.ts`, `packages/time/src/index.ts`
- Create: `packages/time/src/time.test.ts`, `packages/time/src/corpus.test.ts`
- Create: `packages/time/corpus/en.tsv`

**Interfaces:**
- Consumes: `parseDateTime`, `BridgeMatch.hasDate` / `.hasTime`, `Temporal`, `addDuration` from `@smartput/datetime`.
- Produces:
  - `TIME_KIND = "time"`, `TIME_UNIT = "clock"`
  - `wrap(zdt): Value` — canonical is nanoseconds since local midnight
  - `unwrap(value: Value): Temporal.ZonedDateTime`
  - `NS_PER_DAY: Decimal`
  - `createTime(opts?: { weight?: number }): Kind`, `time: Kind`

- [ ] **Step 1: Write the failing test**

`packages/time/src/time.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { time } from "./time";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, time],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare clock time still reads as a datetime", () => {
  const r = engine.evaluate("3pm");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-15 15:00 UTC");
});

test("the time reading is present and formats as a clock", () => {
  const r = engine.evaluate("3pm", { kinds: ["time"] });
  expect(r.kind).toBe("time");
  expect(r.formatted).toBe("15:00");
  expect(r.value.unit).toBe("clock");
});

test("canonical is nanoseconds since local midnight", () => {
  const { value } = engine.evaluate("10:00", { kinds: ["time"] });
  expect(value.canonical.toString()).toBe("36000000000000");
});

test("a date yields no time reading", () => {
  expect(() => engine.evaluate("today", { kinds: ["time"] })).toThrow();
});

test("a time plus a duration wraps within the day", () => {
  const r = engine.evaluate("23:30 + 90 min", { kinds: ["time", "duration"] });
  expect(r.formatted).toBe("01:00");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/time`
Expected: FAIL — no export `time`.

- [ ] **Step 3: Write `value.ts`**

```ts
import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "@smartput/datetime";

export const TIME_KIND = "time";

/** See `@smartput/date`'s `DATE_UNIT`: a zone here would make "10:00 in tokyo" a range. */
export const TIME_UNIT = "clock";

export const NS_PER_DAY = new Decimal("86400000000000");

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Canonical is nanoseconds since local midnight, not an epoch count.
 *
 * Two clock times compared across different days must still order by clock,
 * and 10:00 to 20:00 is ten hours whatever day it lands on.
 */
export function wrap(zdt: Temporal.ZonedDateTime): Value {
  const ns = zdt.startOfDay().until(zdt).total({ unit: "nanosecond" });
  return Object.freeze({
    kind: TIME_KIND,
    canonical: new Decimal(ns.toString()),
    unit: TIME_UNIT,
    meta: Object.freeze({
      iso: zdt.toString(),
      hms: `${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}`,
      zone: zdt.timeZoneId,
    }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(`time value is missing meta.iso: ${JSON.stringify(value.unit)}`);
  }
  return Temporal.ZonedDateTime.from(iso);
}

/** `hh:mm` from a canonical nanosecond-of-day count. */
export function formatClock(canonical: Decimal): string {
  const total = canonical.mod(NS_PER_DAY).plus(NS_PER_DAY).mod(NS_PER_DAY);
  const minutes = total.div("60000000000").floor().toNumber();
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
```

- [ ] **Step 4: Write `time.ts`**

```ts
import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { addDuration, parseDateTime } from "@smartput/datetime";
import { formatClock, TIME_KIND, TIME_UNIT, unwrap, wrap } from "./value";

export interface TimeOptions {
  /** See `@smartput/date`'s `DateOptions.weight`. Negative keeps "3pm" a datetime. */
  weight?: number;
}

export const DEFAULT_TIME_WEIGHT = -5;

const timeLiteral =
  (weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const match = parseDateTime(input, offset, ctx);
    if (match === null) return null;
    if (!match.hasTime || match.hasDate) return null;
    const value = wrap(match.zdt);
    return {
      kind: TIME_KIND,
      unit: value.unit,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: match.length,
      weight,
      targetable: true,
    };
  };

export function createTime(opts: TimeOptions = {}): Kind {
  return defineKind({
    id: TIME_KIND,
    value: { mode: "opaque", units: { [TIME_UNIT]: { aliases: [], symbol: "" } } },
    literals: [timeLiteral(opts.weight ?? DEFAULT_TIME_WEIGHT)],
    ops: [
      {
        op: "+",
        left: TIME_KIND,
        right: "duration",
        result: TIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
      },
      {
        op: "-",
        left: TIME_KIND,
        right: "duration",
        result: TIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
      },
    ],
    format: (value) => formatClock(value.canonical),
  });
}

export const time: Kind = createTime();
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { createTime, DEFAULT_TIME_WEIGHT, time, type TimeOptions } from "./time";
export { formatClock, NS_PER_DAY, TIME_KIND, TIME_UNIT, unwrap, wrap } from "./value";
```

- [ ] **Step 6: Run to verify it passes**

Run: `bun test packages/time`
Expected: PASS. If `23:30 + 90 min` formats as `25:00`, `formatClock`'s modulo is missing.

- [ ] **Step 7: Corpus and commit**

`packages/time/corpus/en.tsv`:

```
# input	kind	canonical	formatted
3pm	time	54000000000000	15:00
9:30	time	34200000000000	09:30
10:00	time	36000000000000	10:00
noon	time	43200000000000	12:00
midnight	time	0	00:00
```

Verify `noon` and `midnight` actually parse through chrono with `hasTime && !hasDate`; drop any row that does not, rather than making the matcher special-case a word.

`packages/time/src/corpus.test.ts` — as Task 3 Step 7, with `kinds: ["time"]`.

Run: `bun test packages/time && bun run lint`

```bash
git add packages/time
git commit -m "feat(time): a clock-time kind over datetime's existing match"
```

---

## Task 5: `@smartput/range-core`

No kind, no matcher, no vocabulary. Pure algebra, and the only task with no engine in its tests.

**Files:**
- Create: `packages/range-core/src/{value,snap,windows,endpoint,errors,weights,index}.ts`
- Create: `packages/range-core/src/{snap,windows,value}.test.ts`

**Interfaces:**
- Produces:
  - `RANGE_WEIGHTS = { reading: -5, signature: 20 }`
  - `InvertedRangeError`
  - `wrapRange(kind, unit, start, end, extra?): Value`, `unwrapRange(value): { start, end }`
  - `startOfWeek/endOfWeek/startOfMonth/endOfMonth/startOfYear/endOfYear(zdt, opts?)`
  - `WINDOWS: Record<string, { start: number; end: number; wraps: boolean }>` — hours as integers
  - `EndpointParser`, `resolveEndpoint`

- [ ] **Step 1: Write the failing tests**

`packages/range-core/src/snap.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Temporal } from "@smartput/datetime";
import { endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from "./snap";

// Thursday 2026-01-15T12:00 UTC — the repo's fixed clock.
const now = Temporal.ZonedDateTime.from("2026-01-15T12:00:00+00:00[UTC]");

test("the week runs Monday to the next Monday, exclusive", () => {
  expect(startOfWeek(now).toString()).toStartWith("2026-01-12T00:00:00");
  expect(endOfWeek(now).toString()).toStartWith("2026-01-19T00:00:00");
});

test("the week start is configurable", () => {
  expect(startOfWeek(now, { weekStart: 7 }).toString()).toStartWith("2026-01-11T00:00:00");
});

test("the month runs to the first of the next", () => {
  expect(startOfMonth(now).toString()).toStartWith("2026-01-01T00:00:00");
  expect(endOfMonth(now).toString()).toStartWith("2026-02-01T00:00:00");
});

test("December rolls the year, not the month", () => {
  const dec = Temporal.ZonedDateTime.from("2026-12-20T12:00:00+00:00[UTC]");
  expect(endOfMonth(dec).toString()).toStartWith("2027-01-01T00:00:00");
});

test("the year runs to the first of the next", () => {
  expect(startOfYear(now).toString()).toStartWith("2026-01-01T00:00:00");
  expect(endOfYear(now).toString()).toStartWith("2027-01-01T00:00:00");
});

test("a leap day is inside its month", () => {
  const feb = Temporal.ZonedDateTime.from("2028-02-29T12:00:00+00:00[UTC]");
  expect(startOfMonth(feb).toString()).toStartWith("2028-02-01T00:00:00");
  expect(endOfMonth(feb).toString()).toStartWith("2028-03-01T00:00:00");
});
```

`packages/range-core/src/windows.test.ts`:

```ts
import { expect, test } from "bun:test";
import { WINDOWS } from "./windows";

test("night wraps midnight and the others do not", () => {
  expect(WINDOWS.night?.wraps).toBe(true);
  expect(WINDOWS.morning?.wraps).toBe(false);
});

test("morning is 06 to 12", () => {
  expect(WINDOWS.morning).toEqual({ start: 6, end: 12, wraps: false });
});
```

`packages/range-core/src/value.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Temporal } from "@smartput/datetime";
import { InvertedRangeError } from "./errors";
import { assertOrdered } from "./value";

const a = Temporal.ZonedDateTime.from("2026-01-15T00:00:00+00:00[UTC]");
const b = Temporal.ZonedDateTime.from("2026-01-16T00:00:00+00:00[UTC]");

test("a backwards range throws and names both ends", () => {
  expect(() => assertOrdered("until yesterday", b, a)).toThrow(InvertedRangeError);
});

test("an equal-ended range throws too", () => {
  expect(() => assertOrdered("x", a, a)).toThrow(InvertedRangeError);
});

test("an ordered range passes", () => {
  expect(() => assertOrdered("x", a, b)).not.toThrow();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test packages/range-core`
Expected: FAIL — no such modules.

- [ ] **Step 3: Write `errors.ts`**

```ts
import { SmartputError } from "@smartput/core";

/**
 * A range whose end is not after its start.
 *
 * Endpoints resolve literally — there is no rolling forward to the next
 * occurrence. A rule that rescued "until 20:00" at 21:00 by moving to tomorrow
 * would have to rescue "until yesterday" too, and then no input is ever wrong.
 *
 * `time-range` never raises this: a clock has no ordering across midnight, so
 * "20:00 - 06:00" is a wrapping span rather than a mistake.
 */
export class InvertedRangeError extends SmartputError {
  constructor(
    readonly input: string,
    readonly start: string,
    readonly end: string,
  ) {
    super(`range ends before it starts: ${start} to ${end}`);
    this.name = "InvertedRangeError";
  }
}
```

Read `packages/core/src/errors.ts` first and match whatever constructor shape `SmartputError` actually takes — it may want a code or an input as its first argument.

- [ ] **Step 4: Write `weights.ts`**

```ts
/**
 * The two numbers the range design turns on, named once.
 *
 * `reading` is charged to every `date` and `time` claim so a bare "3pm" still
 * reads as a datetime. `signature` is paid back by each range op signature, and
 * must exceed twice `|reading|` or the two penalties cancel and the contest
 * ties. It stays under CONTEXT_BONUS (30) so it cannot overturn a corrected
 * reading.
 */
export const RANGE_WEIGHTS = { reading: -5, signature: 20 } as const;
```

- [ ] **Step 5: Write `snap.ts`**

```ts
import { Temporal } from "@smartput/datetime";

export interface SnapOptions {
  /** ISO weekday the week starts on: 1 is Monday, 7 is Sunday. Defaults to 1. */
  weekStart?: number;
}

export const DEFAULT_WEEK_START = 1;

export function startOfWeek(
  zdt: Temporal.ZonedDateTime,
  opts: SnapOptions = {},
): Temporal.ZonedDateTime {
  const start = opts.weekStart ?? DEFAULT_WEEK_START;
  const back = (zdt.dayOfWeek - start + 7) % 7;
  return zdt.startOfDay().subtract({ days: back });
}

export function endOfWeek(
  zdt: Temporal.ZonedDateTime,
  opts: SnapOptions = {},
): Temporal.ZonedDateTime {
  return startOfWeek(zdt, opts).add({ weeks: 1 });
}

export function startOfMonth(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zdt.startOfDay().with({ day: 1 });
}

export function endOfMonth(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return startOfMonth(zdt).add({ months: 1 });
}

export function startOfYear(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zdt.startOfDay().with({ month: 1, day: 1 });
}

export function endOfYear(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return startOfYear(zdt).add({ years: 1 });
}
```

- [ ] **Step 6: Write `windows.ts`**

```ts
export interface Window {
  /** Local hour the window opens, inclusive. */
  start: number;
  /** Local hour it closes, exclusive. */
  end: number;
  /** True when `end <= start` and the span runs through midnight. */
  wraps: boolean;
}

/**
 * Data, not code: a "night" that starts at 21:00 is a configuration change.
 * Overridden through the range kinds' factory options.
 */
export const WINDOWS: Readonly<Record<string, Window>> = Object.freeze({
  morning: { start: 6, end: 12, wraps: false },
  afternoon: { start: 12, end: 18, wraps: false },
  evening: { start: 18, end: 22, wraps: false },
  night: { start: 22, end: 6, wraps: true },
  day: { start: 6, end: 22, wraps: false },
});
```

- [ ] **Step 7: Write `value.ts`**

```ts
import { Decimal, type Value } from "@smartput/core";
import type { Temporal } from "@smartput/datetime";
import { InvertedRangeError } from "./errors";

export interface RangeMeta extends Record<string, unknown> {
  /** ISO zoned string of the inclusive start. */
  start: string;
  /** ISO zoned string of the **exclusive** end. */
  end: string;
  zone: string;
}

/** Throws unless `end` is strictly after `start`. Not called by `time-range`. */
export function assertOrdered(
  input: string,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): void {
  if (Temporal.ZonedDateTime.compare(end, start) > 0) return;
  throw new InvertedRangeError(input, start.toString(), end.toString());
}

/**
 * `canonical` is the start, so ordering and comparison work without the engine
 * knowing what a range is — the same trick datetime plays with epoch
 * nanoseconds.
 */
export function wrapRange(
  kind: string,
  unit: string,
  canonical: Decimal,
  meta: RangeMeta,
): Value {
  return Object.freeze({ kind, canonical, unit, meta: Object.freeze({ ...meta }) });
}

export function unwrapRange(value: Value): { start: string; end: string; zone: string } {
  const { start, end, zone } = (value.meta ?? {}) as Partial<RangeMeta>;
  if (typeof start !== "string" || typeof end !== "string" || typeof zone !== "string") {
    throw new TypeError(`range value is missing start/end/zone: ${value.kind}`);
  }
  return { start, end, zone };
}
```

`assertOrdered` references `Temporal` as a value, so import it as a value, not `import type`.

- [ ] **Step 8: Write `endpoint.ts`**

```ts
import type { MatchCtx } from "@smartput/core";
import type { Temporal } from "@smartput/datetime";

export interface Endpoint {
  zdt: Temporal.ZonedDateTime;
  length: number;
}

/**
 * How a range matcher resolves one end of "from X to Y".
 *
 * A seam rather than a direct call to `parseDateTime`, so that the
 * `@smartput/datetime-range/holiday` subpath can add `findHoliday` without the
 * root entry ever reaching `date-holidays` and its 768 KB rule table.
 */
export type EndpointParser = (text: string, ctx: MatchCtx) => Endpoint | null;

/** First parser to claim the text wins. Order is the caller's preference. */
export function resolveEndpoint(
  text: string,
  ctx: MatchCtx,
  parsers: readonly EndpointParser[],
): Endpoint | null {
  for (const parse of parsers) {
    const hit = parse(text, ctx);
    if (hit !== null) return hit;
  }
  return null;
}
```

- [ ] **Step 9: Write `index.ts`**

```ts
export { type Endpoint, type EndpointParser, resolveEndpoint } from "./endpoint";
export { InvertedRangeError } from "./errors";
export {
  DEFAULT_WEEK_START,
  endOfMonth,
  endOfWeek,
  endOfYear,
  type SnapOptions,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "./snap";
export { assertOrdered, type RangeMeta, unwrapRange, wrapRange } from "./value";
export { RANGE_WEIGHTS } from "./weights";
export { type Window, WINDOWS } from "./windows";
```

- [ ] **Step 10: Run and commit**

Run: `bun test packages/range-core && bun run lint`
Expected: PASS.

```bash
git add packages/range-core
git commit -m "feat(range-core): interval algebra, boundary snapping, windows"
```

---

## Task 6: `@smartput/date-range`

**Files:**
- Create: `packages/date-range/src/{phrases,date-range,index}.ts`
- Create: `packages/date-range/src/date-range.test.ts`, `packages/date-range/src/corpus.test.ts`
- Create: `packages/date-range/corpus/en.tsv`

**Interfaces:**
- Consumes: `startOfWeek`/`endOfWeek`/`startOfMonth`/`endOfMonth`/`startOfYear`/`endOfYear`, `assertOrdered`, `wrapRange`, `unwrapRange`, `RANGE_WEIGHTS` from `@smartput/range-core`; `DATE_KIND`, `unwrap as unwrapDate` from `@smartput/date`.
- Produces: `DATE_RANGE_KIND = "date-range"`, `createDateRange(opts?): Kind`, `dateRange: Kind`.

- [ ] **Step 1: Write the failing test**

`packages/date-range/src/date-range.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { InvertedRangeError } from "@smartput/range-core";
import { dateRange } from "./date-range";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, date, dateRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("the whole week is Monday to Sunday inclusive on display", () => {
  const r = engine.evaluate("whole week");
  expect(r.kind).toBe("date-range");
  expect(r.formatted).toBe("2026-01-12 → 2026-01-18");
});

test("the end is stored exclusive", () => {
  const { value } = engine.evaluate("whole week");
  expect(value.meta?.end).toStartWith("2026-01-19T00:00:00");
});

test("next month", () => {
  expect(engine.evaluate("next month").formatted).toBe("2026-02-01 → 2026-02-28");
});

test("the calendar year, however it is written", () => {
  for (const input of ["whole year", "year", "1 year", "one year", "this year"]) {
    expect(engine.evaluate(input).formatted).toBe("2026-01-01 → 2026-12-31");
  }
});

test("two dates joined by `to` are a range, outscoring the zone conversion", () => {
  const r = engine.evaluate("today to friday");
  expect(r.kind).toBe("date-range");
  expect(r.formatted).toBe("2026-01-15 → 2026-01-16");
});

test("a zone conversion is still a zone conversion", () => {
  const r = engine.evaluate("today in tokyo");
  expect(r.kind).toBe("datetime");
});

test("a backwards range throws", () => {
  expect(() => engine.evaluate("tomorrow to today")).toThrow(InvertedRangeError);
});

test("shifting moves both ends", () => {
  expect(engine.evaluate("whole week + 1 wk").formatted).toBe("2026-01-19 → 2026-01-25");
});
```

`today to friday` resolves `friday` through chrono against the fixed Thursday clock. Confirm what chrono returns for a bare `friday` there before asserting the date; if it is 2026-01-16, the assertion above is right.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/date-range`
Expected: FAIL.

- [ ] **Step 3: Write `phrases.ts`**

A table, not a parser. Each entry names the span it selects and the offset in those units.

```ts
import { Temporal } from "@smartput/datetime";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  type SnapOptions,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@smartput/range-core";

export interface Span {
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
}

type Unit = "day" | "week" | "month" | "year";

const SNAP: Record<Unit, (z: Temporal.ZonedDateTime, o: SnapOptions) => Span> = {
  day: (z) => ({ start: z.startOfDay(), end: z.startOfDay().add({ days: 1 }) }),
  week: (z, o) => ({ start: startOfWeek(z, o), end: endOfWeek(z, o) }),
  month: (z) => ({ start: startOfMonth(z), end: endOfMonth(z) }),
  year: (z) => ({ start: startOfYear(z), end: endOfYear(z) }),
};

/**
 * Every phrase this kind claims, longest first so that "next week" is never
 * read as the "week" inside it. The fold takes the longest claim anyway, but
 * ordering the table keeps the two facts in one place.
 */
export const PHRASES: ReadonlyArray<{ text: string; unit: Unit; offset: number }> =
  Object.freeze([
    { text: "whole week", unit: "week", offset: 0 },
    { text: "this week", unit: "week", offset: 0 },
    { text: "next week", unit: "week", offset: 1 },
    { text: "last week", unit: "week", offset: -1 },
    { text: "whole month", unit: "month", offset: 0 },
    { text: "this month", unit: "month", offset: 0 },
    { text: "next month", unit: "month", offset: 1 },
    { text: "last month", unit: "month", offset: -1 },
    { text: "whole year", unit: "year", offset: 0 },
    { text: "this year", unit: "year", offset: 0 },
    { text: "next year", unit: "year", offset: 1 },
    { text: "last year", unit: "year", offset: -1 },
    { text: "one year", unit: "year", offset: 0 },
    { text: "1 year", unit: "year", offset: 0 },
    { text: "year", unit: "year", offset: 0 },
    { text: "whole day", unit: "day", offset: 0 },
  ]);

const PLURAL: Record<Unit, "days" | "weeks" | "months" | "years"> = {
  day: "days",
  week: "weeks",
  month: "months",
  year: "years",
};

export function spanFor(
  phrase: { unit: Unit; offset: number },
  now: Temporal.ZonedDateTime,
  opts: SnapOptions,
): Span {
  const shifted =
    phrase.offset === 0 ? now : now.add({ [PLURAL[phrase.unit]]: phrase.offset });
  const snap = SNAP[phrase.unit];
  return snap(shifted, opts);
}

/** The longest phrase matching at `offset`, case-insensitively, or null. */
export function phraseAt(
  input: string,
  offset: number,
): { text: string; unit: Unit; offset: number } | null {
  const rest = input.slice(offset).toLowerCase();
  let best: { text: string; unit: Unit; offset: number } | null = null;
  for (const phrase of PHRASES) {
    if (!rest.startsWith(phrase.text)) continue;
    if (best === null || phrase.text.length > best.text.length) best = phrase;
  }
  return best;
}
```

`1 year` reaching `phraseAt` requires the matcher to be offered the offset of the `1` token, which `foldLiterals` does at every token boundary. Confirm with a test rather than assuming.

- [ ] **Step 4: Write `date-range.ts`**

```ts
import { Decimal, defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { DATE_KIND, unwrap as unwrapDate } from "@smartput/date";
import { addDuration, Temporal } from "@smartput/datetime";
import {
  assertOrdered,
  RANGE_WEIGHTS,
  type SnapOptions,
  unwrapRange,
  wrapRange,
} from "@smartput/range-core";
import { phraseAt, spanFor } from "./phrases";

export const DATE_RANGE_KIND = "date-range";
export const DATE_RANGE_UNIT = "span";

export interface DateRangeOptions extends SnapOptions {
  /** Weight on the `in | date | date` signature. 0 makes the conversion win. */
  signatureWeight?: number;
}

function build(
  input: string,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
) {
  assertOrdered(input, start, end);
  return wrapRange(DATE_RANGE_KIND, DATE_RANGE_UNIT, new Decimal(start.epochNanoseconds.toString()), {
    start: start.toString(),
    end: end.toString(),
    zone: start.timeZoneId,
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
const day = (z: Temporal.ZonedDateTime) => `${z.year}-${pad(z.month)}-${pad(z.day)}`;

/**
 * The end is stored exclusive and displayed inclusive: "the week of the 19th"
 * ends on the 25th to a person and at 00:00 on the 26th to arithmetic. Storing
 * the exclusive instant keeps span maths free of off-by-one corrections.
 */
function formatRange(value: { meta?: Readonly<Record<string, unknown>> }): string {
  const { start, end } = unwrapRange(value as never);
  const from = Temporal.ZonedDateTime.from(start);
  const to = Temporal.ZonedDateTime.from(end).subtract({ days: 1 });
  return `${day(from)} → ${day(to)}`;
}

const phraseLiteral =
  (opts: SnapOptions): LiteralMatcher =>
  (input, offset, ctx) => {
    const phrase = phraseAt(input, offset);
    if (phrase === null) return null;
    const now = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
      ctx.timeZone,
    );
    const span = spanFor(phrase, now, opts);
    const value = build(input, span.start, span.end);
    return {
      kind: DATE_RANGE_KIND,
      unit: DATE_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: phrase.text.length,
    };
  };

export function createDateRange(opts: DateRangeOptions = {}): Kind {
  const weight = opts.signatureWeight ?? RANGE_WEIGHTS.signature;
  return defineKind({
    id: DATE_RANGE_KIND,
    value: {
      mode: "opaque",
      units: { [DATE_RANGE_UNIT]: { aliases: [], symbol: "" } },
    },
    literals: [phraseLiteral(opts)],
    ops: [
      {
        op: "in",
        left: DATE_KIND,
        right: DATE_KIND,
        result: DATE_RANGE_KIND,
        weight,
        apply: (l, r, ctx) =>
          build(ctx.input ?? "", unwrapDate(l), unwrapDate(r).add({ days: 1 })),
      },
      {
        op: "+",
        left: DATE_RANGE_KIND,
        right: "duration",
        result: DATE_RANGE_KIND,
        apply: (l, r, ctx) => {
          const { start, end } = unwrapRange(l);
          return build(
            ctx.input ?? "",
            addDuration(Temporal.ZonedDateTime.from(start), r, 1),
            addDuration(Temporal.ZonedDateTime.from(end), r, 1),
          );
        },
      },
      {
        op: "-",
        left: DATE_RANGE_KIND,
        right: "duration",
        result: DATE_RANGE_KIND,
        apply: (l, r, ctx) => {
          const { start, end } = unwrapRange(l);
          return build(
            ctx.input ?? "",
            addDuration(Temporal.ZonedDateTime.from(start), r, -1),
            addDuration(Temporal.ZonedDateTime.from(end), r, -1),
          );
        },
      },
    ],
    format: formatRange,
  });
}

export const dateRange: Kind = createDateRange();
```

`in | date | date` adds a day to the right endpoint, because a user writing `today to friday` means Friday **included** and the stored end is exclusive.

- [ ] **Step 5: Write `index.ts`**

```ts
export {
  createDateRange,
  DATE_RANGE_KIND,
  DATE_RANGE_UNIT,
  type DateRangeOptions,
  dateRange,
} from "./date-range";
export { PHRASES, phraseAt, type Span, spanFor } from "./phrases";
```

- [ ] **Step 6: Run, add the corpus, commit**

Run: `bun test packages/date-range`

Add `packages/date-range/corpus/en.tsv` with one row per phrase in `PHRASES`, and `src/corpus.test.ts` copied from `packages/datetime/src/corpus.test.ts`. Compute canonicals; do not guess them.

Run: `bun test packages/date-range && bun run lint`

```bash
git add packages/date-range
git commit -m "feat(date-range): calendar spans and the date-to-date signature"
```

---

## Task 7: `@smartput/time-range`

**Files:**
- Create: `packages/time-range/src/{time-range,index}.ts`
- Create: `packages/time-range/src/time-range.test.ts`, `packages/time-range/src/corpus.test.ts`
- Create: `packages/time-range/corpus/en.tsv`

**Interfaces:**
- Consumes: `TIME_KIND`, `formatClock`, `NS_PER_DAY`, `unwrap as unwrapTime` from `@smartput/time`; `WINDOWS`, `RANGE_WEIGHTS`, `wrapRange`, `unwrapRange` from `@smartput/range-core`.
- Produces: `TIME_RANGE_KIND = "time-range"`, `createTimeRange(opts?): Kind`, `timeRange: Kind`.

- [ ] **Step 1: Write the failing test**

`packages/time-range/src/time-range.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { time } from "@smartput/time";
import { createTimeRange, timeRange } from "./time-range";

const build = (kinds: unknown[]) =>
  createEngine({
    locales: [coreEn],
    kinds: [...BUILTIN_KINDS, datetime, time, ...(kinds as never[])],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

const engine = build([timeRange]);

test("a dash between two clock times is a range, not a subtraction", () => {
  const r = engine.evaluate("10:00 - 20:00");
  expect(r.kind).toBe("time-range");
  expect(r.formatted).toBe("10:00 → 20:00");
});

test("`to` reads the same way", () => {
  expect(engine.evaluate("10:00 to 20:00").kind).toBe("time-range");
});

test("dashWeight 0 gives the dash back to subtraction", () => {
  const subtracting = build([createTimeRange({ dashWeight: 0 })]);
  expect(subtracting.evaluate("10:00 - 20:00").kind).toBe("duration");
});

test("two datetimes still subtract to a duration", () => {
  const r = engine.evaluate("tomorrow - today");
  expect(r.kind).toBe("duration");
  expect(r.formatted).toBe("1 day");
});

test("a time minus a duration is still a time", () => {
  expect(engine.evaluate("3pm - 1 h", { kinds: ["time", "duration"] }).kind).toBe("time");
});

test("a backwards clock span wraps instead of throwing", () => {
  const r = engine.evaluate("20:00 - 06:00");
  expect(r.kind).toBe("time-range");
  expect(r.value.meta?.wraps).toBe(true);
});

test("named windows", () => {
  expect(engine.evaluate("morning").formatted).toBe("06:00 → 12:00");
  expect(engine.evaluate("evening").formatted).toBe("18:00 → 22:00");
  expect(engine.evaluate("night").formatted).toBe("22:00 → 06:00");
  expect(engine.evaluate("night").value.meta?.wraps).toBe(true);
});

test("the window table is configurable", () => {
  const late = build([
    createTimeRange({ windows: { night: { start: 21, end: 5, wraps: true } } }),
  ]);
  expect(late.evaluate("night").formatted).toBe("21:00 → 05:00");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/time-range`
Expected: FAIL.

- [ ] **Step 3: Write `time-range.ts`**

```ts
import { Decimal, defineKind, type Kind, type LiteralMatcher, type Value } from "@smartput/core";
import { RANGE_WEIGHTS, type Window, WINDOWS, wrapRange } from "@smartput/range-core";
import { formatClock, NS_PER_DAY, TIME_KIND } from "@smartput/time";

export const TIME_RANGE_KIND = "time-range";
export const TIME_RANGE_UNIT = "clock-span";

const NS_PER_HOUR = new Decimal("3600000000000");

export interface TimeRangeOptions {
  /**
   * Weight on `- | time | time` and `in | time | time`. Must exceed twice the
   * `time` reading penalty or the contest ties; 0 hands "10:00 - 20:00" back to
   * subtraction, which is what someone doing clock arithmetic wants.
   */
  dashWeight?: number;
  /** Overrides merged over the default table. */
  windows?: Record<string, Window>;
}

/** A clock span has no ordering across midnight, so a backwards pair wraps. */
function build(startNs: Decimal, endNs: Decimal): Value {
  const wraps = endNs.lte(startNs);
  return wrapRange(TIME_RANGE_KIND, TIME_RANGE_UNIT, startNs, {
    start: formatClock(startNs),
    end: formatClock(endNs),
    zone: "",
    wraps,
    lengthNs: (wraps ? endNs.plus(NS_PER_DAY) : endNs).minus(startNs).toString(),
  } as never);
}

const hoursNs = (h: number) => NS_PER_HOUR.times(h);

const windowLiteral =
  (windows: Record<string, Window>): LiteralMatcher =>
  (input, offset) => {
    const rest = input.slice(offset).toLowerCase();
    let hit: { name: string; window: Window } | null = null;
    for (const [name, window] of Object.entries(windows)) {
      if (!rest.startsWith(name)) continue;
      if (hit === null || name.length > hit.name.length) hit = { name, window };
    }
    if (hit === null) return null;
    const value = build(hoursNs(hit.window.start), hoursNs(hit.window.end));
    return {
      kind: TIME_RANGE_KIND,
      unit: TIME_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: hit.name.length,
    };
  };

export function createTimeRange(opts: TimeRangeOptions = {}): Kind {
  const weight = opts.dashWeight ?? RANGE_WEIGHTS.signature;
  const windows = { ...WINDOWS, ...(opts.windows ?? {}) };
  const span = {
    left: TIME_KIND,
    right: TIME_KIND,
    result: TIME_RANGE_KIND,
    weight,
    apply: (l: Value, r: Value) => build(l.canonical, r.canonical),
  };
  return defineKind({
    id: TIME_RANGE_KIND,
    value: {
      mode: "opaque",
      units: { [TIME_RANGE_UNIT]: { aliases: [], symbol: "" } },
    },
    literals: [windowLiteral(windows)],
    ops: [
      { op: "-", ...span },
      { op: "in", ...span },
    ],
    format: (value) =>
      `${String(value.meta?.start ?? "")} → ${String(value.meta?.end ?? "")}`,
  });
}

export const timeRange: Kind = createTimeRange();
```

`wrapRange`'s `RangeMeta` requires `zone`; a clock span has none, so it passes the empty string. If that reads badly once written, widen `RangeMeta` to make `zone` optional rather than inventing a zone here.

- [ ] **Step 4: Write `index.ts`**

```ts
export {
  createTimeRange,
  TIME_RANGE_KIND,
  TIME_RANGE_UNIT,
  type TimeRangeOptions,
  timeRange,
} from "./time-range";
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test packages/time-range`
Expected: PASS. If `10:00 - 20:00` still reads as a duration, check `signatureWeight` is actually summed in `solve()` — Task 1 Step 5 — and that the `time` readings really are present by asserting `explain()`.

- [ ] **Step 6: Corpus and commit**

`packages/time-range/corpus/en.tsv` covering every window plus both separator forms.

Run: `bun test packages/time-range && bun run lint`

```bash
git add packages/time-range
git commit -m "feat(time-range): clock spans, the dash race, and named windows"
```

---

## Task 8: `@smartput/datetime-range`

The largest of the three, because it owns the `from`/`until` grammar.

**Files:**
- Create: `packages/datetime-range/src/{phrases,datetime-range,index}.ts`
- Create: `packages/datetime-range/src/datetime-range.test.ts`, `packages/datetime-range/src/corpus.test.ts`
- Create: `packages/datetime-range/corpus/en.tsv`

**Interfaces:**
- Consumes: `parseDateTime`, `Temporal` from `@smartput/datetime`; `WINDOWS`, `resolveEndpoint`, `EndpointParser`, `assertOrdered`, `wrapRange`, `unwrapRange` from `@smartput/range-core`.
- Produces: `DATETIME_RANGE_KIND = "datetime-range"`, `createDatetimeRange(opts?): Kind`, `datetimeRange: Kind`, and `datetimeEndpoint: EndpointParser`.

- [ ] **Step 1: Write the failing test**

`packages/datetime-range/src/datetime-range.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { InvertedRangeError } from "@smartput/range-core";
import { time } from "@smartput/time";
import { datetimeRange } from "./datetime-range";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, date, time, datetimeRange],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a date word plus a window is a datetime range", () => {
  const r = engine.evaluate("yesterday morning");
  expect(r.kind).toBe("datetime-range");
  expect(r.formatted).toBe("2026-01-14 06:00 → 2026-01-14 12:00 UTC");
});

test("next morning is tomorrow morning", () => {
  expect(engine.evaluate("next morning").formatted).toBe(
    "2026-01-16 06:00 → 2026-01-16 12:00 UTC",
  );
});

test("from X to Y claims its whole span", () => {
  const r = engine.evaluate("from tomorrow to friday");
  expect(r.kind).toBe("datetime-range");
});

test("until Y starts now", () => {
  const r = engine.evaluate("until 20:00");
  expect(r.kind).toBe("datetime-range");
  expect(r.formatted).toBe("2026-01-15 12:00 → 2026-01-15 20:00 UTC");
});

test("until yesterday is inverted and throws", () => {
  expect(() => engine.evaluate("until yesterday")).toThrow(InvertedRangeError);
});

test("from tomorrow to present is inverted and throws", () => {
  expect(() => engine.evaluate("from tomorrow to present")).toThrow(InvertedRangeError);
});

test("a bare `from X` is not claimed at all", () => {
  const r = engine.evaluate("from tomorrow");
  expect(r.kind).toBe("datetime");
});
```

`until 20:00` against a 12:00 clock is forwards, so it must not throw. `present` must resolve through chrono as now; if chrono does not read it, use `now` in the corpus and record the refusal.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/datetime-range`
Expected: FAIL.

- [ ] **Step 3: Write `phrases.ts`**

Two grammars, both claimed by one matcher.

```ts
import type { MatchCtx } from "@smartput/core";
import { parseDateTime, Temporal } from "@smartput/datetime";
import {
  type Endpoint,
  type EndpointParser,
  resolveEndpoint,
  type Window,
} from "@smartput/range-core";

/** The base endpoint parser: whatever chrono reads, and nothing else. */
export const datetimeEndpoint: EndpointParser = (text, ctx) => {
  const match = parseDateTime(text, 0, ctx);
  return match === null ? null : { zdt: match.zdt, length: match.length };
};

const DAY_WORDS: Record<string, number> = {
  yesterday: -1,
  today: 0,
  todays: 0,
  "today's": 0,
  tomorrow: 1,
  next: 1,
};

/**
 * "yesterday morning": a day word supplying the date and a window word
 * supplying the hours. "next morning" is tomorrow morning, which is what
 * `next` mapping to +1 gives for free.
 */
export function dayWindowAt(
  input: string,
  offset: number,
  windows: Record<string, Window>,
  now: Temporal.ZonedDateTime,
): { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime; length: number } | null {
  const rest = input.slice(offset).toLowerCase();
  for (const [word, shift] of Object.entries(DAY_WORDS)) {
    if (!rest.startsWith(`${word} `)) continue;
    const after = rest.slice(word.length + 1);
    for (const [name, window] of Object.entries(windows)) {
      if (!after.startsWith(name)) continue;
      const day = now.startOfDay().add({ days: shift });
      const start = day.add({ hours: window.start });
      const end = window.wraps
        ? day.add({ days: 1, hours: window.end })
        : day.add({ hours: window.end });
      return { start, end, length: word.length + 1 + name.length };
    }
  }
  return null;
}

const OPENERS = ["from "] as const;
const CLOSERS = [" to ", " until ", " till ", " through "] as const;
const BARE_CLOSERS = ["until ", "till ", "through "] as const;

/**
 * `from X to Y`, and `until Y` with an implied start of now.
 *
 * Claimed by a matcher rather than by an op signature because
 * `in | datetime | datetime` belongs to zone conversion and registry pass 4
 * refuses a second claimant. A run beginning with `from` or `until` has no
 * competing reading, so claiming the whole span costs nothing.
 *
 * A bare `from X` is not claimed: an incomplete range is not an error, it is
 * not a range, and declining lets `X` keep whatever reading it had.
 */
export function fromToAt(
  input: string,
  offset: number,
  ctx: MatchCtx,
  now: Temporal.ZonedDateTime,
  parsers: readonly EndpointParser[],
): { start: Temporal.ZonedDateTime; end: Endpoint; length: number } | null {
  const rest = input.slice(offset);
  const lower = rest.toLowerCase();

  for (const opener of OPENERS) {
    if (!lower.startsWith(opener)) continue;
    const afterOpen = rest.slice(opener.length);
    const start = resolveEndpoint(afterOpen, ctx, parsers);
    if (start === null) return null;
    const tail = afterOpen.slice(start.length);
    for (const closer of CLOSERS) {
      if (!tail.toLowerCase().startsWith(closer)) continue;
      const end = resolveEndpoint(tail.slice(closer.length), ctx, parsers);
      if (end === null) return null;
      return {
        start: start.zdt,
        end,
        length: opener.length + start.length + closer.length + end.length,
      };
    }
    return null;
  }

  for (const closer of BARE_CLOSERS) {
    if (!lower.startsWith(closer)) continue;
    const end = resolveEndpoint(rest.slice(closer.length), ctx, parsers);
    if (end === null) return null;
    return { start: now, end, length: closer.length + end.length };
  }

  return null;
}
```

- [ ] **Step 4: Write `datetime-range.ts`**

```ts
import { Decimal, defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { Temporal } from "@smartput/datetime";
import {
  assertOrdered,
  type EndpointParser,
  type Window,
  WINDOWS,
  unwrapRange,
  wrapRange,
} from "@smartput/range-core";
import { datetimeEndpoint, dayWindowAt, fromToAt } from "./phrases";

export const DATETIME_RANGE_KIND = "datetime-range";
export const DATETIME_RANGE_UNIT = "span";

export interface DatetimeRangeOptions {
  windows?: Record<string, Window>;
  /** Endpoint parsers for `from X to Y`. The `./holiday` subpath adds one. */
  parsers?: readonly EndpointParser[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (z: Temporal.ZonedDateTime) =>
  `${z.year}-${pad(z.month)}-${pad(z.day)} ${pad(z.hour)}:${pad(z.minute)}`;

function build(input: string, start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime) {
  assertOrdered(input, start, end);
  return wrapRange(
    DATETIME_RANGE_KIND,
    DATETIME_RANGE_UNIT,
    new Decimal(start.epochNanoseconds.toString()),
    { start: start.toString(), end: end.toString(), zone: start.timeZoneId },
  );
}

export function createDatetimeRange(opts: DatetimeRangeOptions = {}): Kind {
  const windows = { ...WINDOWS, ...(opts.windows ?? {}) };
  const parsers = opts.parsers ?? [datetimeEndpoint];

  const matcher: LiteralMatcher = (input, offset, ctx) => {
    const now = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
      ctx.timeZone,
    );
    const window = dayWindowAt(input, offset, windows, now);
    const span = window ?? fromToAt(input, offset, ctx, now, parsers);
    if (span === null) return null;
    const start = "start" in span ? span.start : now;
    const end = "end" in span && "zdt" in (span.end as object)
      ? (span.end as { zdt: Temporal.ZonedDateTime }).zdt
      : (span as { end: Temporal.ZonedDateTime }).end;
    const value = build(input, start, end);
    return {
      kind: DATETIME_RANGE_KIND,
      unit: DATETIME_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: span.length,
    };
  };

  return defineKind({
    id: DATETIME_RANGE_KIND,
    value: {
      mode: "opaque",
      units: { [DATETIME_RANGE_UNIT]: { aliases: [], symbol: "" } },
    },
    literals: [matcher],
    ops: [],
    format: (value) => {
      const { start, end, zone } = unwrapRange(value);
      return `${stamp(Temporal.ZonedDateTime.from(start))} → ${stamp(
        Temporal.ZonedDateTime.from(end),
      )} ${zone}`;
    },
  });
}

export const datetimeRange: Kind = createDatetimeRange();
```

The `start`/`end` narrowing above is awkward because `dayWindowAt` and `fromToAt` return different shapes. Give them **one** shape — `{ start: ZonedDateTime; end: ZonedDateTime; length: number }` — by unwrapping the `Endpoint` inside `fromToAt` before returning, and delete the narrowing entirely. Do that; the version above is written out only so the problem is visible.

- [ ] **Step 5: Write `index.ts`**

```ts
export {
  createDatetimeRange,
  DATETIME_RANGE_KIND,
  DATETIME_RANGE_UNIT,
  type DatetimeRangeOptions,
  datetimeRange,
} from "./datetime-range";
export { datetimeEndpoint, dayWindowAt, fromToAt } from "./phrases";
```

- [ ] **Step 6: Run and commit**

Run: `bun test packages/datetime-range && bun run lint`

Add `corpus/en.tsv` and `src/corpus.test.ts` as in Task 6.

```bash
git add packages/datetime-range
git commit -m "feat(datetime-range): windows on a day, and the from/until grammar"
```

---

## Task 9: The `./holiday` subpath

**Files:**
- Create: `packages/datetime-range/src/holiday.ts` (replacing the Task 0 placeholder)
- Create: `packages/datetime-range/src/holiday.test.ts`

**Interfaces:**
- Consumes: `findHoliday` from `@smartput/holiday`; `createDatetimeRange`, `datetimeEndpoint` from this package.
- Produces: `holidayEndpoint: EndpointParser`, `datetimeRangeHoliday: Kind`.

- [ ] **Step 1: Read the existing bridge first**

Read `packages/datetime/src/holiday.ts` in full. It already resolves a holiday phrase to a `Temporal.ZonedDateTime` and owns the offset grammar. Reuse its exported helpers if it exposes any; only call `findHoliday` directly if it does not.

- [ ] **Step 2: Write the failing test**

`packages/datetime-range/src/holiday.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { time } from "@smartput/time";
import { datetimeRangeHoliday } from "./holiday";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, date, time, datetimeRangeHoliday],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("from today to closest holiday", () => {
  const r = engine.evaluate("from today to closest holiday");
  expect(r.kind).toBe("datetime-range");
  expect(r.value.meta?.start).toStartWith("2026-01-15");
});

test("a plain range still works through the same kind", () => {
  expect(engine.evaluate("from tomorrow to friday").kind).toBe("datetime-range");
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test packages/datetime-range/src/holiday.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
import type { Kind } from "@smartput/core";
import type { EndpointParser } from "@smartput/range-core";
import { createDatetimeRange } from "./datetime-range";
import { datetimeEndpoint } from "./phrases";

/**
 * The opt-in half of this package, and the only module that imports
 * `@smartput/holiday`. Importing `@smartput/datetime-range` therefore never
 * reaches `date-holidays` — a 768 KB rule table nobody asking for "whole week"
 * agreed to download. `check-size.ts`'s `datetime-range root (no holiday data)`
 * row fails by a megabyte the moment this import reaches the root graph.
 */
export const holidayEndpoint: EndpointParser = (text, ctx) => {
  // Delegate to whatever @smartput/datetime/holiday exposes; see Step 1.
  throw new Error("implement against the bridge read in Step 1");
};

export const datetimeRangeHoliday: Kind = createDatetimeRange({
  parsers: [datetimeEndpoint, holidayEndpoint],
});
```

Replace the `throw` with the real delegation. Leaving it is a task failure.

- [ ] **Step 5: Run and commit**

Run: `bun test packages/datetime-range && bun run lint`

```bash
git add packages/datetime-range
git commit -m "feat(datetime-range): resolve holiday endpoints behind a subpath"
```

---

## Task 10: Budgets, docs, and a green `bun run check`

**Files:**
- Modify: `scripts/check-size.ts`
- Create: `docs/guide/ranges.md`
- Modify: `docs/guide/roadmap.md`
- Modify: `docs/.vitepress` sidebar config (find it; `docs/guide/*.md` pages are listed somewhere)

- [ ] **Step 1: Measure, then budget**

Run `bun run check-size` once with rows added at a deliberately low ceiling to read the real numbers out of the failure output, then set each `min`/`gzip` to the measurement **rounded up to the next 50 B**. Do not guess a budget.

Rows to add — nine entries:

```ts
  { label: "date", from: "@smartput/date", names: ["date"], min: 0, gzip: 0 },
  { label: "time", from: "@smartput/time", names: ["time"], min: 0, gzip: 0 },
  { label: "range-core", from: "@smartput/range-core", names: ["WINDOWS", "startOfWeek"], min: 0, gzip: 0 },
  { label: "date-range", from: "@smartput/date-range", names: ["dateRange"], min: 0, gzip: 0 },
  { label: "time-range", from: "@smartput/time-range", names: ["timeRange"], min: 0, gzip: 0 },
  { label: "datetime-range root (no holiday data)", from: "@smartput/datetime-range", names: ["datetimeRange"], min: 0, gzip: 0 },
  { label: "datetime-range holiday", from: "@smartput/datetime-range/holiday", names: ["datetimeRangeHoliday"], min: 0, gzip: 0 },
```

The `datetime-range root` row is the enforcement `check-deps.ts` points at. Its ceiling must be small enough that a stray `@smartput/holiday` import fails it — read the `datetime root` row's number and mirror the reasoning in a comment.

- [ ] **Step 2: Write the guide page**

`docs/guide/ranges.md`, following `docs/guide/datetime.md`'s structure: frontmatter with `title` and `description`, an install line, an engine snippet, a "What it recognises" table, the dash conflict explained with the score arithmetic, the error table, and a "Limits" section carrying §8 of the spec verbatim.

Every example in it must be a corpus row. That is the rule `datetime.md` states about itself and the reason its examples cannot drift.

- [ ] **Step 3: Update the roadmap**

Add a milestone row to the table in `docs/guide/roadmap.md`, add the six packages to the "Shipped" package list, and add their rows to the runtime-dependency table. Add a short prose section in the style of the existing "Percent, finished" one, stating what the milestone cost core: one field on `OpSignature`.

- [ ] **Step 4: Run the whole check**

Run: `bun run check`
Expected: PASS — lint, typecheck, check-deps, tests, build, check-size.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-size.ts docs
git commit -m "docs: the ranges guide, roadmap row, and size budgets"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §1 package layout | 0 |
| §2.1 `hasDate`/`hasTime` | 2 |
| §2.2 value shapes, one unit, `targetable` | 3, 4 |
| §2.3 ops on `date`/`time` | 3, 4 |
| §3 `range-core`, half-open ends, windows | 5 |
| §4.1 the arithmetic | 1 (test), 7 (assertion) |
| §4.2 `OpSignature.weight` | 1 |
| §4.3 configuring priority | 4, 7 |
| §5.1 op signatures | 6, 7 |
| §5.2 literal matchers | 6, 7, 8 |
| §5.3 holiday endpoints | 5 (seam), 9 (subpath) |
| §6 errors | 5 (throw), 6/8 (rows) |
| §7 testing | every task, plus 10 |
| §8 out of scope | 10 (guide "Limits") |

**Known gaps, stated rather than hidden:**

- §7 asks for two property tests (`start < end`; `in <zone>` preserves the span). No task writes them, because `in | <range> | datetime` is declared in Task 6 for `date-range` only and never for `time-range` or `datetime-range`. Add them to Task 10 once the signature set is final, or drop the second property and keep the first.
- Task 8's `datetime-range` declares `ops: []`, so §5.1's `+`/`-`/`in` rows exist for `date-range` alone. If a `whole week`-style shift is wanted on `datetime-range` too, it is a copy of Task 6's three signatures.
- Locale packs are not built. `@smartput/datetime` ships `./locale/en`; none of these six do, so the window and phrase words are hardcoded English inside their matchers rather than contributed vocabulary. That contradicts the repo's "vocabulary lives with the kind" rule and should become a followup issue.
