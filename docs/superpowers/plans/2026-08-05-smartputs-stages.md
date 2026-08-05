# smartputs Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `createEngine`'s 329-line closure into seven composable stages, each with one job and each usable alone, and add the one stage that does not exist today — turning a parsed program back into a string.

**Architecture:** The pipeline is already seven pure functions; they are just assembled inside a closure that threads eight pieces of config through them. Each becomes a frozen config-holding class over the existing function: `Normalizer`, `Tokenizer`, `Parser`, `Solver`, `Evaluator`, `Printer`, `Completer`. `createEngine` is kept and reimplemented as a readable assembly of those parts, so there is one code path and its source doubles as the reference example. Two supporting changes make the intermediates into values rather than pointers: `Normalizer` returns its edits and a `mapSpan` (which fixes a real span bug), and every AST node gains a stable `id` so a solver result can be keyed by id instead of by node object identity.

**Tech Stack:** Bun (test runner, bundler), TypeScript 5.7 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome 2, `decimal.js`.

**Spec:** `docs/superpowers/specs/2026-08-05-smartputs-stages-design.md`

## Global Constraints

- **No behaviour changes except the span fix.** This is a restructuring. Task 1's parity snapshot is the acceptance criterion for every later task.
- `EngineOptions`, `EvalOptions`, `Result`, `Explanation` and `Engine` keep their current shapes. Every existing consumer keeps working.
- Every stage ships **both** a configured class and an exported pure function taking everything explicitly.
- Every stage instance is frozen and holds no mutable state between runs. Two `.run()` calls with the same input return equal output.
- Every stage output is frozen (`deepFreeze` from `packages/core/src/freeze.ts`).
- `@smartput/core` ships one runtime dependency (`decimal.js`). Unchanged by this plan.
- Never import `decimal.js` directly — Biome errors. Use `Decimal` from `./decimal` inside core.
- `Program` is an **in-memory** interchange type. Do not add serialization; nodes carry `Decimal` and kind-defined opaque `Value.meta`, and a JSON protocol would need every kind to implement one.
- `exactOptionalPropertyTypes` is on: build optional properties with conditional spread (`...(rates ? { rates } : {})`), the way the existing code does — never `foo: undefined`.
- `noUncheckedIndexedAccess` is on: every array and record index is `T | undefined`. Handle it; do not reach for `!`.
- Task 12 depends on the validate plan's Task 1 (the build pipeline and three-condition exports). Land that first or Task 12 has nothing to add subpaths to.
- Forward note: `2026-08-05-smartputs-i18n-design.md` will replace `Locale` with `Language` + `composeLocale`. Per that spec's §12, land Task 1 here, then i18n P1–P2, then Task 2 onward — otherwise the stage classes get written against a `Locale` shape that is about to change. If that ordering is not being followed, Tasks 2–13 still apply; only the `locale:` config field name moves.

---

## File Structure

**New files — `packages/core/src/`**

| File | Responsibility |
| --- | --- |
| `parse/normalize.ts` *(rewrite)* | `normalize`, `Normalizer`, `NormalizedInput`, `Edit`, `NormalizerOptions`, `mapSpan` |
| `parse/tokenizer.ts` | `Tokenizer`, `TokenStream` — owns lex + the three fold passes (Task 6) |
| `parse/program.ts` | `Program`, `buildProgram` (Task 4); `Parser` class added in Task 6 |
| `solve/solver-class.ts` | `Solver` — `all`, `best`, `forKind` (Task 5) |
| `eval/evaluator.ts` | `Evaluator` |
| `print/print.ts` | `Printer`, `PrintOptions`, `PrintMode` |
| `complete/completer.ts` | `Completer` |
| `stages.test.ts` | the composition test — a pipeline built by hand, no `createEngine` |

**New files — repo**

| File | Responsibility |
| --- | --- |
| `packages/core/src/parity.test.ts` | The parity net: snapshots of every public result over the corpus |
| `packages/core/parity/*.json` | Committed snapshot fixtures |

**Modified**

| File | Change |
| --- | --- |
| `parse/ast.ts` | every node gains `readonly id: NodeId` |
| `parse/pratt.ts` | assigns ids while building |
| `solve/solver.ts` | `Assignment` renamed `Resolution`, `choices` re-keyed by id, `solve` takes a `Program` |
| `eval/evaluate.ts` | takes `program` + `resolution` instead of `node` + `assignment` |
| `format/format.ts` | `formatValue` re-exported through `print/` |
| `engine.ts` | reimplemented as composition; shrinks to under 60 lines of body |
| `index.ts` | exports every stage class and type |

---

## Task 1: The parity net

Not optional. A restructuring of this size without a parity net is a rewrite with extra steps. No production code changes in this task.

**Files:**
- Create: `packages/core/src/parity.test.ts`
- Create: `packages/core/parity/en.json` (generated, then committed)
- Modify: `package.json` (add a `parity:record` script)

**Interfaces:**
- Consumes: nothing. Runs against `main` as-is.
- Produces: `packages/core/parity/en.json` — a snapshot keyed by input, holding the shape every later task must reproduce. `bun run parity:record` regenerates it; the test compares against it.

- [ ] **Step 1: Write the recorder and the test**

Create `packages/core/src/parity.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import en from "./locale/en";

/**
 * The acceptance criterion for the whole stage restructuring: every public
 * result, over the whole corpus, byte for byte.
 *
 * Recorded with `bun run parity:record` and committed. A later task that
 * changes an output has to change this file too, in a diff a reviewer reads —
 * which is the point. The one expected diff is the span fix in Task 3, and it
 * gets its own explicit expectations rather than a blanket re-record.
 */
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

const corpus = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();
const completeCorpus = await Bun.file(
  new URL("../corpus/en-complete.tsv", import.meta.url),
).text();

const rows = (raw: string): string[][] =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t"));

/** Every input the recorder and the test both walk, in a stable order. */
export const INPUTS: string[] = [
  ...rows(corpus).map((r) => r[0] as string),
  ...rows(completeCorpus).map((r) => r[0] as string),
].filter((v, i, a) => a.indexOf(v) === i);

/** JSON-safe, and deliberately lossy in no place a later task could hide in. */
function snapshot(input: string): unknown {
  const capture = <T>(f: () => T): unknown => {
    try {
      return { ok: f() };
    } catch (e) {
      return {
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      };
    }
  };

  return {
    evaluate: capture(() => {
      const r = engine.evaluate(input);
      return {
        kind: r.kind,
        canonical: r.value.canonical.toString(),
        unit: r.value.unit,
        formatted: r.formatted,
        confidence: r.confidence,
        spans: r.spans,
        assumptions: r.meta.assumptions,
      };
    }),
    suggest: capture(() =>
      engine.suggest(input).map((r) => ({
        kind: r.kind,
        canonical: r.value.canonical.toString(),
        formatted: r.formatted,
        confidence: r.confidence,
      })),
    ),
    explain: capture(() => {
      const x = engine.explain(input);
      return {
        tokens: x.tokens.map((t) =>
          t.type === "number"
            ? { type: t.type, text: t.text, start: t.start, end: t.end }
            : { ...t, value: undefined, canonical: undefined },
        ),
        candidates: x.candidates.map((c) => ({
          kind: c.kind,
          unit: c.unit,
          weight: c.weight,
          form: c.form,
        })),
        assignments: x.assignments,
      };
    }),
    complete: capture(() => engine.complete(input)),
    coerce: capture(() => {
      const kind = engine.evaluate(input).kind;
      const v = engine.coerce(kind, input);
      return { kind: v.kind, canonical: v.canonical.toString(), unit: v.unit };
    }),
  };
}

export function record(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of INPUTS) out[input] = snapshot(input);
  return out;
}

const expected = (await Bun.file(new URL("../parity/en.json", import.meta.url)).json()) as
  Record<string, unknown>;

test("the parity fixture covers every corpus input", () => {
  expect(Object.keys(expected).sort()).toEqual([...INPUTS].sort());
});

for (const input of INPUTS) {
  test(`parity: ${input}`, () => {
    expect(snapshot(input)).toEqual(expected[input]);
  });
}
```

- [ ] **Step 2: Write the recorder script**

Create `scripts/parity-record.ts`:

```ts
/**
 * Regenerates the parity fixture. Run deliberately, never automatically: a
 * fixture that re-records itself proves nothing, and the whole value of this
 * file is that changing an output produces a diff a reviewer has to approve.
 */
const { record } = await import("../packages/core/src/parity.test.ts");
const target = new URL("../packages/core/parity/en.json", import.meta.url);
await Bun.write(target, `${JSON.stringify(record(), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
```

Add to root `package.json` scripts:

```json
    "parity:record": "bun run scripts/parity-record.ts",
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test ./packages/core/src/parity.test.ts`
Expected: FAIL — `../parity/en.json` does not exist yet.

- [ ] **Step 4: Record the fixture**

Run: `mkdir -p packages/core/parity && bun run parity:record`
Expected: `wrote .../packages/core/parity/en.json`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test ./packages/core/src/parity.test.ts`
Expected: PASS — one test per corpus input, plus the coverage test.

- [ ] **Step 6: Verify the fixture is not trivially empty**

Run: `bun -e 'const j = await Bun.file("packages/core/parity/en.json").json(); const n = Object.keys(j).length; const errs = Object.values(j).filter((v) => v.evaluate?.error).length; console.log({ inputs: n, evaluateErrors: errs });'`
Expected: `inputs` is at least 80 and `evaluateErrors` is a small number — the
completion corpus contains deliberate fragments that do not evaluate. If
`evaluateErrors` equals `inputs`, the engine failed to build and the fixture is
worthless; stop and fix that before continuing.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/parity.test.ts packages/core/parity scripts/parity-record.ts package.json
git commit -m "test(core): record a parity net over every public result

The acceptance criterion for the stage restructuring. evaluate, suggest,
coerce, explain and complete are snapshotted over both corpora and the
fixture is committed, so a later task that changes an output has to
change this file in a diff a reviewer reads.

The recorder is a deliberate script, never automatic: a fixture that
re-records itself proves nothing.

Errors are captured rather than thrown, because the completion corpus
contains fragments that legitimately do not evaluate, and 'this input
threw NoCandidateError' is exactly as much a behaviour to preserve as a
successful result."
```

---

## Task 2: `Normalizer` — edits and `mapSpan`

**Files:**
- Modify: `packages/core/src/parse/normalize.ts` (rewrite)
- Create: `packages/core/src/parse/normalize.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Edit { readonly at: Span; readonly length: number; readonly reason: EditReason }`
  - `type EditReason = "nfkc" | "zero-width" | "dash" | "degree" | "whitespace" | "trim"`
  - `interface NormalizedInput { readonly source: string; readonly text: string; readonly edits: readonly Edit[]; readonly empty: boolean; mapSpan(span: Span): Span }`
  - `interface NormalizerOptions { nfkc?: boolean; dashes?: boolean; degree?: boolean; whitespace?: boolean; trim?: boolean; repair?: (text: string, ctx: { source: string }) => readonly Edit[] }`
  - `normalize(input: string, opts?: NormalizerOptions): NormalizedInput`
  - `class Normalizer { constructor(cfg?: NormalizerOptions); run(input: string): NormalizedInput }`

**Breaking change:** `normalize` returned `string` and now returns
`NormalizedInput`. `engine.ts` is its only caller and Task 3 updates it.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/parse/normalize.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Normalizer, normalize } from "./normalize";

test("the passes that existed before still run", () => {
  expect(normalize("  30   deg  ").text).toBe("30 deg");
  expect(normalize("30 − 5").text).toBe("30 - 5");
  expect(normalize("20 °C").text).toBe("20 C");
  expect(normalize("30​deg").text).toBe("30deg");
});

test("empty input is reported, not thrown", () => {
  expect(normalize("").empty).toBe(true);
  expect(normalize("   ").empty).toBe(true);
  expect(normalize("30deg").empty).toBe(false);
});

test("source is preserved verbatim", () => {
  const n = normalize("  30 °C  ");
  expect(n.source).toBe("  30 °C  ");
  expect(n.text).toBe("30 C");
});

test("mapSpan translates a normalized span back to the source", () => {
  // The four cases measured on main. Three of them sliced wrong before this.
  for (const [source, expectedSlice] of [
    ["30 deg + 15 deg", "30 deg + 15 deg"],
    ["30 °C + 5 C", "30 °C + 5 C"],
    ["  30 deg  ", "30 deg"],
    ["30  deg + 15 deg", "30  deg + 15 deg"],
  ] as const) {
    const n = normalize(source);
    const whole = n.mapSpan({ start: 0, end: n.text.length });
    expect(source.slice(whole.start, whole.end), source).toBe(expectedSlice);
  }
});

test("mapSpan is exact for an interior span", () => {
  const n = normalize("  30  deg + 15 deg  ");
  expect(n.text).toBe("30 deg + 15 deg");
  // "15 deg" starts at index 9 of the normalized text.
  const span = n.mapSpan({ start: 9, end: 15 });
  expect(n.source.slice(span.start, span.end)).toBe("15 deg");
});

test("mapSpan on unchanged input is the identity", () => {
  const n = normalize("30 deg + 15 deg");
  expect(n.edits).toHaveLength(0);
  expect(n.mapSpan({ start: 5, end: 8 })).toEqual({ start: 5, end: 8 });
});

test("every pass can be turned off", () => {
  expect(normalize("20 °C", { degree: false }).text).toBe("20 °C");
  expect(normalize("  30deg  ", { trim: false }).text).toBe(" 30deg ");
  expect(normalize("30 − 5", { dashes: false }).text).toBe("30 − 5");
  expect(normalize("a  b", { whitespace: false }).text).toBe("a  b");
});

test("edits record what changed and why", () => {
  const n = normalize("  20 °C  ");
  const reasons = n.edits.map((e) => e.reason);
  expect(reasons).toContain("degree");
  expect(reasons).toContain("trim");
  for (const edit of n.edits) {
    expect(edit.at.end).toBeGreaterThanOrEqual(edit.at.start);
    expect(edit.length).toBeGreaterThanOrEqual(0);
  }
});

test("the repair hook runs after the built-in passes and its edits are recorded", () => {
  const seen: string[] = [];
  const n = normalize("30 d", {
    repair: (text) => {
      seen.push(text);
      return [{ at: { start: 3, end: 4 }, length: 3, reason: "nfkc" }];
    },
  });
  // The hook sees the already-normalized text, not the source.
  expect(seen).toEqual(["30 d"]);
  expect(n.edits.some((e) => e.at.start === 3)).toBe(true);
});

test("the class holds config and returns equal output across calls", () => {
  const n = new Normalizer({ degree: false });
  expect(Object.isFrozen(n)).toBe(true);
  expect(n.run("20 °C").text).toBe("20 °C");
  expect(n.run("20 °C")).toEqual(n.run("20 °C"));
});

test("outputs are frozen", () => {
  const n = normalize("  30 deg  ");
  expect(Object.isFrozen(n)).toBe(true);
  expect(Object.isFrozen(n.edits)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/core/src/parse/normalize.test.ts`
Expected: FAIL — `normalize(...)​.text` is undefined; `normalize` returns a string.

- [ ] **Step 3: Rewrite the module**

Rewrite `packages/core/src/parse/normalize.ts`:

```ts
import type { Span } from "../types";

export type EditReason =
  | "nfkc"
  | "zero-width"
  | "dash"
  | "degree"
  | "whitespace"
  | "trim";

/**
 * One replacement the normalizer made. `at` indexes the **source**; `length` is
 * how many characters the replacement occupies in the normalized text. A
 * deletion has `length: 0`.
 */
export interface Edit {
  readonly at: Span;
  readonly length: number;
  readonly reason: EditReason;
}

export interface NormalizedInput {
  /** Exactly what the caller passed. */
  readonly source: string;
  /** What every later stage reads. */
  readonly text: string;
  readonly edits: readonly Edit[];
  readonly empty: boolean;
  /** Translate a span in `text` back to a span in `source`. */
  mapSpan(span: Span): Span;
}

export interface NormalizerOptions {
  nfkc?: boolean;
  dashes?: boolean;
  degree?: boolean;
  whitespace?: boolean;
  trim?: boolean;
  /**
   * Ran after the built-in passes, on the already-normalized text. The seam
   * fuzzy unit repair ("30d" -> "30deg") lands in later, alongside the validate
   * path's `resolve`. Its edits are appended to `edits`, and it must not change
   * `text` — a repair that rewrites the string is a second normalizer, not a
   * hook.
   */
  repair?: (text: string, ctx: { source: string }) => readonly Edit[];
}

const ZERO_WIDTH = /[​‌‍﻿]/;
const DASH = /[−‒–—―]/;
const WHITESPACE = /\s/;

/**
 * Character-by-character rather than a chain of `.replace()` calls, because a
 * chain cannot say where it edited. That is not a stylistic preference: `lex()`
 * runs on `text` and produces spans against it, `Result.spans` hands them back
 * as if they indexed `source`, and on `main` three of four probed inputs slice
 * the wrong substring. A pass that records its edits cannot have that bug.
 */
export function normalize(input: string, opts: NormalizerOptions = {}): NormalizedInput {
  const doNfkc = opts.nfkc !== false;
  const doDashes = opts.dashes !== false;
  const doDegree = opts.degree !== false;
  const doWhitespace = opts.whitespace !== false;
  const doTrim = opts.trim !== false;

  // NFKC can change length, so it runs first and its own edit is recorded
  // against the whole string rather than per character — a per-character map
  // through a compatibility decomposition is not derivable from the output.
  const pre = doNfkc ? input.normalize("NFKC") : input;
  const edits: Edit[] = [];
  if (pre !== input) {
    edits.push({ at: { start: 0, end: input.length }, length: pre.length, reason: "nfkc" });
  }

  // `offsets[i]` is the index in `pre` that `text[i]` came from, plus one
  // trailing entry for the end position. This is what makes mapSpan exact
  // rather than approximate.
  let text = "";
  const offsets: number[] = [];
  let pendingWhitespace = false;

  for (let i = 0; i < pre.length; i += 1) {
    const ch = pre[i] as string;

    if (doNfkc && ZERO_WIDTH.test(ch)) {
      edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "zero-width" });
      continue;
    }
    if (doDegree && ch === "°") {
      edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "degree" });
      continue;
    }
    if (doWhitespace && WHITESPACE.test(ch)) {
      // A run collapses to one space, emitted lazily so a trailing run
      // disappears without a second pass.
      if (!pendingWhitespace) pendingWhitespace = true;
      else edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "whitespace" });
      continue;
    }

    if (pendingWhitespace) {
      pendingWhitespace = false;
      if (text.length === 0 && doTrim) {
        // Leading run: dropped entirely.
        edits.push({ at: { start: 0, end: i }, length: 0, reason: "trim" });
      } else {
        offsets.push(i - 1);
        text += " ";
      }
    }

    if (doDashes && DASH.test(ch)) {
      edits.push({ at: { start: i, end: i + 1 }, length: 1, reason: "dash" });
      offsets.push(i);
      text += "-";
      continue;
    }

    offsets.push(i);
    text += ch;
  }

  if (pendingWhitespace) {
    if (doTrim) {
      edits.push({ at: { start: pre.length - 1, end: pre.length }, length: 0, reason: "trim" });
    } else {
      offsets.push(pre.length - 1);
      text += " ";
    }
  }

  // One past the last character, so a span whose `end` is `text.length` maps.
  offsets.push(pre.length);

  const nfkcShifted = pre !== input;

  const mapSpan = (span: Span): Span => {
    // After an NFKC length change there is no character-level correspondence to
    // the source, so the honest answer is the whole source rather than an
    // offset that happens to be plausible.
    if (nfkcShifted) return { start: 0, end: input.length };
    const start = offsets[span.start] ?? 0;
    const endExclusive = offsets[span.end] ?? pre.length;
    return { start, end: endExclusive };
  };

  const repaired = opts.repair?.(text, { source: input }) ?? [];
  edits.push(...repaired);

  return Object.freeze({
    source: input,
    text,
    edits: Object.freeze([...edits]) as readonly Edit[],
    empty: text.length === 0,
    mapSpan,
  });
}

/**
 * The configured form. Holds options once so a caller normalizing a thousand
 * keystrokes does not restate them, and is frozen so it cannot acquire state
 * between runs.
 */
export class Normalizer {
  private readonly opts: NormalizerOptions;

  constructor(cfg: NormalizerOptions = {}) {
    this.opts = cfg;
    Object.freeze(this);
  }

  run(input: string): NormalizedInput {
    return normalize(input, this.opts);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test ./packages/core/src/parse/normalize.test.ts`
Expected: PASS — all eleven tests. If the interior-span test fails, the
`offsets` bookkeeping for the collapsed-whitespace case is off by one; the
emitted space maps to `i - 1`, the last character of the run it replaced.

- [ ] **Step 5: Export from the barrel**

Add to `packages/core/src/index.ts`, in alphabetical position among the `parse/` exports:

```ts
export type {
  Edit,
  EditReason,
  NormalizedInput,
  NormalizerOptions,
} from "./parse/normalize";
export { Normalizer, normalize } from "./parse/normalize";
```

- [ ] **Step 6: Verify the rest of the suite is red, and only where expected**

Run: `bun test ./packages/core 2>&1 | tail -20`
Expected: `engine.ts` no longer typechecks — `normalize(input)` returns an
object where a string is used. That is the only expected breakage, and Task 3
fixes it. `bun run typecheck` will report it as a type error in `engine.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/parse/normalize.ts packages/core/src/parse/normalize.test.ts packages/core/src/index.ts
git commit -m "feat(core): normalize returns its edits and a span mapping

lex() runs on the normalized string, so every span it produces is
normalized-relative -- and Result.spans hands those back to a caller who
reasonably reads them against the string they passed in. Measured on
main, three of four probed inputs slice the wrong substring:
'  30 deg  ' reports a span covering '  30 d'.

That is not a typo, it is a structural consequence of normalization
being a bare string -> string function that discards what it did. This
rewrites it character by character, keeping an offset table, so mapSpan
is exact rather than approximate.

NFKC is the one pass with no character-level correspondence to its
input, so after a compatibility decomposition changes length mapSpan
returns the whole source rather than an offset that merely looks
plausible.

Also adds the repair seam, where fuzzy unit correction lands later, and
NormalizerOptions so a caller who needs the degree sign can keep it.

engine.ts does not compile after this commit; the next one rewires it."
```

---

## Task 3: Thread the `Normalizer` through the engine, and fix the spans

**Files:**
- Modify: `packages/core/src/engine.ts:151-176` (the `pipeline` closure), `:196-208` (`toResult`)
- Create: `packages/core/src/span.test.ts`
- Modify: `packages/core/parity/en.json` (re-record, spans only)

**Interfaces:**
- Consumes: Task 2's `Normalizer`, `NormalizedInput`.
- Produces: `pipeline()` returns `{ normalized: NormalizedInput, resolver, tokens, node, assignments }` — `normalized` is now the object, not a string. `Result.spans` indexes the caller's string.

- [ ] **Step 1: Write the failing span test**

Create `packages/core/src/span.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import en from "./locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

test("Result.spans indexes the caller's string, not the normalized one", () => {
  // The four inputs probed on main. Three reported a wrong slice.
  for (const [input, expected] of [
    ["30 deg + 15 deg", "30 deg + 15 deg"],
    ["30 °C + 5 C", "30 °C + 5 C"],
    ["  30 deg  ", "30 deg"],
    ["30  deg + 15 deg", "30  deg + 15 deg"],
  ] as const) {
    const span = engine.evaluate(input).spans[0];
    expect(span, input).toBeDefined();
    if (span === undefined) continue;
    expect(input.slice(span.start, span.end), input).toBe(expected);
  }
});

test("every corpus input's root span slices back to something non-empty", () => {
  const raw = Bun.file(new URL("../corpus/en.tsv", import.meta.url));
  const rows = (await raw.text())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t")[0] as string);

  for (const input of rows) {
    const span = engine.evaluate(input).spans[0];
    expect(span, input).toBeDefined();
    if (span === undefined) continue;
    expect(span.start).toBeGreaterThanOrEqual(0);
    expect(span.end).toBeLessThanOrEqual(input.length);
    expect(input.slice(span.start, span.end).trim().length, input).toBeGreaterThan(0);
  }
});
```

Note: the second test needs a top-level `await`, so declare the file's rows
above the tests instead:

```ts
const corpusRows = (
  await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text()
)
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.split("\t")[0] as string);
```

and have the test iterate `corpusRows`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/core/src/span.test.ts`
Expected: FAIL — three of the four inputs in the first test slice wrong, and
`engine.ts` may not compile at all after Task 2.

- [ ] **Step 3: Rewire `pipeline`**

In `packages/core/src/engine.ts`, replace the `normalize` import:

```ts
import { Normalizer, type NormalizedInput } from "./parse/normalize";
```

Add the stage instance beside the other config, after `const timeZone = ...`:

```ts
  // One instance, frozen, reused across every call: it holds only options.
  const normalizer = new Normalizer();
```

Replace the head of `pipeline`:

```ts
  function pipeline(input: string, call?: EvalOptions) {
    const normalized = normalizer.run(input);
    if (normalized.empty) throw new UnitParseError(input);
    const resolver = createResolver({
      registry,
      locale: locale as Locale,
      packs,
      layers: layersFor(call?.weights),
    });
    const lexed = lex(normalized.text, locale as Locale);
    const matchCtx: MatchCtx = {
      locale: (locale as Locale).id,
      now: now(),
      timeZone: call?.timeZone ?? timeZone,
      isUnitAlias: (text) =>
        registry.aliasIndex.has(text.toLocaleLowerCase((locale as Locale).id)),
    };
    const tokens = foldWordOps(
      foldNumerals(
        foldLiterals(lexed, normalized.text, registry, matchCtx),
        locale as Locale,
      ),
    );
    const node = parse(tokens, resolver, input);
    const assignments = solve(node, registry, {
      maxCandidates,
      input,
      ...(call?.kinds ? { kinds: call.kinds } : {}),
    });
    return { normalized, resolver, tokens, node, assignments };
  }
```

- [ ] **Step 4: Map the spans in `toResult`**

Change `toResult`'s signature to take the `NormalizedInput`, and map the span:

```ts
  function toResult(
    normalized: NormalizedInput,
    node: ReturnType<typeof pipeline>["node"],
    assignment: Assignment,
    input: string,
  ): Result {
    const { value, assumptions } = evaluateNode({
      node,
      assignment,
      registry,
      locale: (locale as Locale).id,
      input,
      kindMeta,
      ...(rates ? { rates } : {}),
    });
    return {
      value,
      formatted: formatValue(value, registry, locale as Locale, {
        ...(formatPrecision === undefined ? {} : { precision: formatPrecision }),
        ...(rounding === undefined ? {} : { rounding }),
        ...(rates ? { rates } : {}),
      }),
      kind: value.kind,
      confidence: assignment.confidence,
      // Spans are produced against the normalized text; the caller reads them
      // against the string they passed in. Without this they disagree whenever
      // normalization changed a length.
      spans: [normalized.mapSpan(node.span)],
      meta: {
        assumptions,
        ...(rates ? { ratesAsOf: rates.asOf } : {}),
      },
    };
  }
```

Update the three call sites — in `evaluate`, destructure `normalized` and pass
it:

```ts
    evaluate(input, call) {
      const { normalized, node, assignments } = pipeline(input, call);
      const [best, second] = assignments;
      if (best === undefined) throw new SmartputError("No interpretation", input);

      if (
        tiebreak === "error" &&
        second !== undefined &&
        Math.abs(best.confidence - second.confidence) < epsilon
      ) {
        const listed: ResultCandidate[] = assignments.slice(0, 5).map((a) => ({
          kind: a.kind,
          unit: [...a.choices.values()][0]?.unit ?? "",
          confidence: a.confidence,
        }));
        throw new AmbiguityError(input, listed, [normalized.mapSpan(node.span)]);
      }

      return toResult(normalized, node, best, input);
    },
```

and in `suggest`:

```ts
        const { normalized, node, assignments } = pipeline(input, call);
        return assignments.map((a) => toResult(normalized, node, a, input));
```

- [ ] **Step 5: Run the span test**

Run: `bun test ./packages/core/src/span.test.ts && bun run typecheck`
Expected: PASS. All four inputs slice correctly.

- [ ] **Step 6: Confirm the parity diff is spans and nothing else**

Run: `bun test ./packages/core/src/parity.test.ts 2>&1 | tail -30`
Expected: FAIL, on the inputs whose normalization changed a length. Inspect a
failure and confirm the only differing key is `evaluate.ok.spans`. If any other
key differs — `formatted`, `canonical`, `confidence`, `explain` — stop: that is
a behaviour change this task is not allowed to make.

- [ ] **Step 7: Re-record the fixture and review the diff**

Run: `bun run parity:record && git diff --stat packages/core/parity/en.json`
Then: `git diff packages/core/parity/en.json | grep -E '^[+-]' | grep -v '"start"\|"end"\|^[+-][+-]' | head -20`
Expected: the second command prints nothing. Every changed line is a span
boundary. If it prints anything else, revert the re-record and find out why.

- [ ] **Step 8: Run the full suite**

Run: `bun test && bun run typecheck && bun run lint`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/span.test.ts packages/core/parity/en.json
git commit -m "fix(core): report spans against the caller's string

Result.spans and AmbiguityError's spans are produced by lex() against the
normalized text, and were handed back as if they indexed the input. Any
input where normalization changed a length reported a wrong slice:
'  30 deg  ' gave a span covering '  30 d', and '30 °C + 5 C' one
covering '30 °C + 5 '.

Both now map through NormalizedInput.mapSpan. The parity fixture is
re-recorded and its diff is span boundaries and nothing else, which is
the check that this is a bug fix rather than a behaviour change."
```

---

## Task 4: Node ids and `Program`

**Files:**
- Modify: `packages/core/src/parse/ast.ts` (add `id` to every node)
- Modify: `packages/core/src/parse/pratt.ts` (assign ids)
- Create: `packages/core/src/parse/program.ts`, `packages/core/src/parse/program.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 2's `NormalizedInput`.
- Produces:
  - `type NodeId = number`
  - every `Node` variant gains `readonly id: NodeId`
  - `interface Program { readonly root: Node; readonly nodes: readonly Node[]; readonly input: NormalizedInput }`
  - `buildProgram(root: Node, input: NormalizedInput): Program`
  - `class Parser { constructor(cfg: { resolver: Resolver }); run(stream: TokenStream): Program }` — added in Task 6, once `TokenStream` exists. This task ships `buildProgram` only.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/parse/program.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { walk } from "./ast";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { createResolver } from "./candidates";
import { buildProgram } from "./program";
import { parse } from "./pratt";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const resolver = createResolver({ registry, locale: en, packs: [], layers: [en.weights] });

const programFor = (source: string) => {
  const input = normalize(source);
  return buildProgram(parse(lex(input.text, en), resolver, source), input);
};

test("every node has a unique id, and nodes[n.id] is n", () => {
  const program = programFor("2 * (3 kg + 4 kg)");
  const seen = new Set<number>();
  walk(program.root, (node) => {
    expect(seen.has(node.id), `duplicate id ${node.id}`).toBe(false);
    seen.add(node.id);
    expect(program.nodes[node.id]).toBe(node);
  });
  expect(seen.size).toBe(program.nodes.length);
});

test("ids are assigned depth-first from zero", () => {
  const program = programFor("1 kg + 2 kg");
  const order: number[] = [];
  walk(program.root, (n) => order.push(n.id));
  expect(order).toEqual([0, 1, 2]);
});

test("the program carries its normalized input", () => {
  const program = programFor("  1 kg + 2 kg  ");
  expect(program.input.source).toBe("  1 kg + 2 kg  ");
  expect(program.input.text).toBe("1 kg + 2 kg");
});

test("the program and every node are frozen", () => {
  const program = programFor("1 kg");
  expect(Object.isFrozen(program)).toBe(true);
  expect(Object.isFrozen(program.nodes)).toBe(true);
  walk(program.root, (n) => expect(Object.isFrozen(n)).toBe(true));
});

test("a convert node's operand and its target both get ids", () => {
  const program = programFor("2 kg in g");
  const types = program.nodes.map((n) => n.type);
  expect(types).toContain("convert");
  expect(types).toContain("quantity");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/core/src/parse/program.test.ts`
Expected: FAIL — `Cannot find module './program'`, and `node.id` does not exist.

- [ ] **Step 3: Add `id` to the node union**

In `packages/core/src/parse/ast.ts`, add the type and the field. At the top:

```ts
/**
 * Stable within one Program, assigned depth-first at parse time.
 *
 * The reason this field exists: `Assignment.choices` was a `Map<Node, Candidate>`,
 * keyed by object identity, so a solver result was meaningless without the exact
 * tree object that produced it — unloggable, unsnapshottable, undiffable. One
 * number turns the solver's output from a pointer into a value.
 */
export type NodeId = number;
```

Then add `readonly id: NodeId;` as the first member of `NumberNode`,
`QuantityNode`, `LiteralNode`, `BinaryNode`, `UnaryNode` and `ConvertNode`.

- [ ] **Step 4: Assign ids in the parser**

In `packages/core/src/parse/pratt.ts`, thread a counter. Add near the top of
`parse`:

```ts
  // Depth-first, matching `walk`'s order, so a reader can predict an id from
  // the source position rather than having to look it up.
  let nextId = 0;
  const id = () => nextId++;
```

Then add `id: id(),` as the first property of every node literal the parser
constructs. **Order matters:** a parent must take its id before recursing into
its children, so `id: id()` appears in the object literal before the recursive
calls are evaluated. Where a node literal is built after its children (the usual
Pratt shape), capture the id first:

```ts
    // Taken before the operands are parsed, so ids run parent-then-children.
    const nodeId = id();
    const right = parseExpr(prec + 1);
    node = { id: nodeId, type: "binary", op, left: node, right, span };
```

Apply the same pattern to `unary` and `convert`.

- [ ] **Step 5: Write the program module**

Create `packages/core/src/parse/program.ts`:

```ts
import { deepFreeze } from "../freeze";
import type { Node, NodeId } from "./ast";
import { walk } from "./ast";
import type { NormalizedInput } from "./normalize";

/**
 * A parsed expression, plus the input it came from. This is the "list of
 * commands" the design calls for — the list just has structure, because
 * `2 * (3 + 4)` does. A flat postfix stream would be a lossy projection: the
 * printer would have to re-derive where parentheses go and every span would
 * have to move onto the instruction. The tree already carries both.
 */
export interface Program {
  readonly root: Node;
  /** Depth-first, id-indexed. `nodes[n.id] === n` for every node. */
  readonly nodes: readonly Node[];
  readonly input: NormalizedInput;
}

export function buildProgram(root: Node, input: NormalizedInput): Program {
  const nodes: Node[] = [];
  walk(root, (node) => {
    nodes[node.id] = node;
  });

  // A hole means the parser skipped an id, which would make `nodes[id]`
  // silently undefined at every later stage. Fail here, where the cause is one
  // file away.
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i] === undefined) {
      throw new Error(`buildProgram: no node has id ${i} — the parser skipped one`);
    }
  }

  // `input` is already frozen by `normalize`; freezing it again is a no-op, and
  // deepFreeze on the tree is what makes every later stage's "frozen output"
  // claim true rather than aspirational.
  return Object.freeze({
    root: deepFreeze(root),
    nodes: Object.freeze(nodes) as readonly Node[],
    input,
  });
}

export type { NodeId };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test ./packages/core/src/parse/program.test.ts && bun run typecheck`
Expected: PASS. If "ids are assigned depth-first from zero" fails with
`[1, 0, 2]` or similar, a node literal is taking its id after recursing —
re-read Step 4's ordering note.

- [ ] **Step 7: Export from the barrel**

Add to `packages/core/src/index.ts`:

```ts
export type { Node, NodeId } from "./parse/ast";
export { walk } from "./parse/ast";
export type { Program } from "./parse/program";
export { buildProgram } from "./parse/program";
```

- [ ] **Step 8: Run the full suite**

Run: `bun test && bun run typecheck && bun run lint`
Expected: all PASS, parity included — ids are additive and no output reads them.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/parse packages/core/src/index.ts
git commit -m "feat(core): give every node a stable id and introduce Program

Assignment.choices is a Map<Node, Candidate> keyed by object identity, so
a solver result is meaningless without the exact tree object that
produced it: it cannot be logged, snapshot-tested or diffed. One number
per node turns the solver's output from a pointer into a value, and the
next commit re-keys Resolution onto it.

Ids run parent-then-children, matching walk's order, so a reader can
predict an id from a source position instead of looking it up.

buildProgram refuses a hole in the id sequence rather than leaving
nodes[id] silently undefined for every later stage to trip over.

Program carries its NormalizedInput, which is what lets the printer's
verbatim mode reproduce the source and what gives every stage access to
mapSpan without threading it separately."
```

---

## Task 5: `Resolution` and the `Solver` class

**Files:**
- Modify: `packages/core/src/solve/solver.ts` (re-key `choices`, rename, keep `solve`)
- Create: `packages/core/src/solve/solver-class.ts`, `packages/core/src/solve/solver-class.test.ts`
- Modify: `packages/core/src/eval/evaluate.ts` (read `choices` by id)
- Modify: `packages/core/src/engine.ts` (the three `.choices.values()` call sites)
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 4's `Program`, `NodeId`.
- Produces:
  - `interface Resolution { readonly choices: Readonly<Record<NodeId, Candidate>>; readonly kind: KindId; readonly score: number; readonly contextBonus: number; readonly confidence: number }`
  - `type Assignment = Resolution` — deprecated alias, kept for one minor version
  - `solve(program: Program, registry: Registry, opts: { maxCandidates: number; kinds?: KindId[]; input: string }): Resolution[]` — takes a `Program`, not a bare `Node`
  - `class Solver { constructor(cfg: { registry: Registry; maxCandidates?: number; ambiguityEpsilon?: number; tiebreak?: "error" | "first" }); all(program, opts?): Resolution[]; best(program, opts?): Resolution; forKind(program, kind, opts?): Resolution | undefined }`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/solve/solver-class.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { AmbiguityError } from "../errors";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { parse } from "../parse/pratt";
import { buildProgram } from "../parse/program";
import { Solver } from "./solver-class";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const resolver = createResolver({ registry, locale: en, packs: [], layers: [en.weights] });

const programFor = (source: string) => {
  const input = normalize(source);
  return buildProgram(parse(lex(input.text, en), resolver, source), input);
};

const solver = new Solver({ registry });

test("choices are keyed by node id, so a resolution is JSON-serializable", () => {
  const program = programFor("1 kg + 500 g");
  const [best] = solver.all(program);
  expect(best).toBeDefined();
  if (best === undefined) return;
  expect(JSON.parse(JSON.stringify(best.choices))).toEqual(
    JSON.parse(JSON.stringify(best.choices)),
  );
  for (const key of Object.keys(best.choices)) {
    expect(program.nodes[Number(key)]).toBeDefined();
  }
});

test("all() is ranked and never throws on ambiguity", () => {
  const all = solver.all(programFor("10 m"));
  expect(all.length).toBeGreaterThan(1);
  for (let i = 1; i < all.length; i += 1) {
    expect((all[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
      (all[i] as { score: number }).score,
    );
  }
});

test("best() applies the epsilon and throws AmbiguityError", () => {
  expect(() => solver.best(programFor("10 m"))).toThrow(AmbiguityError);
});

test("tiebreak: first returns the top candidate instead of throwing", () => {
  const lenient = new Solver({ registry, tiebreak: "first" });
  expect(lenient.best(programFor("10 m")).kind).toBeDefined();
});

test("best() does not throw when the winner is clear", () => {
  expect(solver.best(programFor("1 kg + 500 g")).kind).toBe("mass");
});

test("forKind() finds a resolution by result kind, or returns undefined", () => {
  const program = programFor("10 m");
  expect(solver.forKind(program, "length")?.kind).toBe("length");
  expect(solver.forKind(program, "duration")?.kind).toBe("duration");
  expect(solver.forKind(program, "money")).toBeUndefined();
});

test("the solver instance is frozen and stateless across runs", () => {
  expect(Object.isFrozen(solver)).toBe(true);
  const program = programFor("1 kg + 500 g");
  expect(solver.all(program)).toEqual(solver.all(program));
});

test("resolutions are frozen", () => {
  const [best] = solver.all(programFor("1 kg"));
  expect(Object.isFrozen(best)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/core/src/solve/solver-class.test.ts`
Expected: FAIL — `Cannot find module './solver-class'`.

- [ ] **Step 3: Re-key `solve`'s output**

In `packages/core/src/solve/solver.ts`:

Rename the interface and re-key `choices`, keeping a deprecated alias:

```ts
import type { NodeId } from "../parse/ast";
import type { Program } from "../parse/program";

export interface Resolution {
  /**
   * Keyed by NodeId, never by node object. Keying by identity made a
   * resolution meaningless without the exact tree that produced it.
   */
  readonly choices: Readonly<Record<NodeId, Candidate>>;
  readonly kind: KindId;
  readonly score: number;
  /** The part of `score` that came from context agreement, so explain() can list it. */
  readonly contextBonus: number;
  readonly confidence: number;
}

/** @deprecated Renamed to `Resolution`. Kept for one minor version. */
export type Assignment = Resolution;
```

Change `solve`'s signature and its internal accumulation from `Map<Node, Candidate>`
to a `Record<NodeId, Candidate>`:

```ts
export function solve(
  program: Program,
  registry: Registry,
  opts: { maxCandidates: number; kinds?: KindId[]; input: string },
): Resolution[] {
  const root = program.root;
  const slots = collectSlots(root, opts.kinds);
  // ... the existing body, with every `choices.set(node, candidate)` becoming
  // `choices[node.id] = candidate` and the accumulator declared as
  // `const choices: Record<NodeId, Candidate> = {}`
```

At each point where a completed assignment is pushed, freeze it:

```ts
    viable.push(Object.freeze({ choices: Object.freeze(choices), kind, score, contextBonus, confidence: 0 }));
```

and freeze again after the softmax pass rewrites `confidence` — the existing code
computes confidence in a second pass, so build the frozen objects there rather
than mutating:

```ts
  const confidences = softmax(viable.map((v) => v.score));
  return viable.map((v, i) =>
    Object.freeze({ ...v, confidence: confidences[i] ?? 0 }),
  );
```

- [ ] **Step 4: Update the readers**

In `packages/core/src/eval/evaluate.ts`, change `EvaluateOptions` to take the
program and read choices by id:

```ts
export interface EvaluateOptions {
  program: Program;
  resolution: Resolution;
  registry: Registry;
  locale: string;
  input: string;
  kindMeta?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  rates?: RateLookup;
}
```

and replace every `assignment.choices.get(node)` with
`opts.resolution.choices[node.id]`. The lookup already had to handle a miss, so
the `| undefined` from `noUncheckedIndexedAccess` needs no new branch.

In `packages/core/src/engine.ts`, the three places that read
`[...a.choices.values()]` become `Object.values(a.choices)`:

```ts
        const listed: ResultCandidate[] = assignments.slice(0, 5).map((a) => ({
          kind: a.kind,
          unit: Object.values(a.choices)[0]?.unit ?? "",
          confidence: a.confidence,
        }));
```

```ts
      for (const assignment of assignments) {
        for (const candidate of Object.values(assignment.choices)) {
```

```ts
          const chosen = Object.values(a.choices);
```

and update the `pipeline` call to `solve` to pass a `Program`. Build one there:

```ts
    const node = parse(tokens, resolver, input);
    const program = buildProgram(node, normalized);
    const assignments = solve(program, registry, {
      maxCandidates,
      input,
      ...(call?.kinds ? { kinds: call.kinds } : {}),
    });
    return { normalized, resolver, tokens, program, node, assignments };
```

and change `evaluateNode` call sites to pass `program` and `resolution`.

- [ ] **Step 5: Write the Solver class**

Create `packages/core/src/solve/solver-class.ts`:

```ts
import { AmbiguityError } from "../errors";
import type { Registry } from "../kind/registry";
import type { Program } from "../parse/program";
import type { KindId, ResultCandidate } from "../types";
import { type Resolution, solve } from "./solver";

export interface SolverOptions {
  registry: Registry;
  maxCandidates?: number;
  ambiguityEpsilon?: number;
  tiebreak?: "error" | "first";
}

/**
 * `best()` is where the epsilon-and-tiebreak block that lived inline in
 * `evaluate()` moves, and `forKind()` is what `coerce()` open-coded. Having all
 * three named in one place is what stops the fourth caller inventing a fourth
 * variant.
 */
export class Solver {
  private readonly registry: Registry;
  private readonly maxCandidates: number;
  private readonly epsilon: number;
  private readonly tiebreak: "error" | "first";

  constructor(cfg: SolverOptions) {
    this.registry = cfg.registry;
    this.maxCandidates = cfg.maxCandidates ?? 10_000;
    this.epsilon = cfg.ambiguityEpsilon ?? 0.05;
    this.tiebreak = cfg.tiebreak ?? "error";
    Object.freeze(this);
  }

  /** Every consistent assignment, ranked. Never throws on ambiguity. */
  all(program: Program, opts?: { kinds?: KindId[] }): Resolution[] {
    return solve(program, this.registry, {
      maxCandidates: this.maxCandidates,
      input: program.input.source,
      ...(opts?.kinds ? { kinds: opts.kinds } : {}),
    });
  }

  /** The winner, applying epsilon and tiebreak. Throws `AmbiguityError`. */
  best(program: Program, opts?: { kinds?: KindId[] }): Resolution {
    const all = this.all(program, opts);
    const [best, second] = all;
    if (best === undefined) {
      throw new AmbiguityError(program.input.source, [], [program.root.span]);
    }
    if (
      this.tiebreak === "error" &&
      second !== undefined &&
      Math.abs(best.confidence - second.confidence) < this.epsilon
    ) {
      const listed: ResultCandidate[] = all.slice(0, 5).map((a) => ({
        kind: a.kind,
        unit: Object.values(a.choices)[0]?.unit ?? "",
        confidence: a.confidence,
      }));
      throw new AmbiguityError(
        program.input.source,
        listed,
        [program.input.mapSpan(program.root.span)],
      );
    }
    return best;
  }

  /** The best resolution whose result kind is `kind`, or undefined. */
  forKind(
    program: Program,
    kind: KindId,
    opts?: { kinds?: KindId[] },
  ): Resolution | undefined {
    return this.all(program, opts).find((r) => r.kind === kind);
  }
}
```

- [ ] **Step 6: Run tests**

Run: `bun test ./packages/core/src/solve && bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Export and run the full suite**

Add to `packages/core/src/index.ts`:

```ts
export type { Resolution, SolverOptions } from "./solve/solver";
export { Solver } from "./solve/solver-class";
```

Run: `bun test && bun run typecheck && bun run lint`
Expected: all PASS **including parity** — this task changes no output. If parity
fails, the `Object.values` ordering differs from `Map` insertion order somewhere
that reaches `explain()`. Numeric-like record keys iterate in ascending numeric
order, which is node-id order, which is the depth-first order `walk` produced —
so it should match. If it does not, sort explicitly by id and note why.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/solve packages/core/src/eval/evaluate.ts packages/core/src/engine.ts packages/core/src/index.ts
git commit -m "refactor(core): key Resolution by node id and add the Solver class

Assignment becomes Resolution and its choices move from
Map<Node, Candidate> to Record<NodeId, Candidate>, so a solver result is
a value: loggable, snapshot-testable, diffable, JSON-serializable.
Assignment stays as a deprecated alias for one minor version.

Solver.best() is where the epsilon-and-tiebreak block that lived inline
in evaluate() moves, and forKind() is what coerce() open-coded. Having
all three named in one place is what stops the fourth caller inventing a
fourth variant of the same decision.

Resolutions are built frozen in the softmax pass rather than mutated
into shape afterwards.

Parity is unchanged: record keys that look like integers iterate in
ascending numeric order, which is node-id order, which is the
depth-first order the Map's insertion order already had."
```

---

Tasks 6 through 13 remain, and they are the mechanical half — every hard
decision is now made and tested.

| Task | Scope | Done when |
| --- | --- | --- |
| **6** | `Tokenizer` + `TokenStream`, owning `lex` and the three fold passes; `Parser` class over `buildProgram`. Both accept a string or a `NormalizedInput`. | Golden per-stage tests pass with no solver or evaluator imported; parity unchanged. |
| **7** | `Evaluator` and `Completer` classes over `evaluateNode` and `complete`. | Same. |
| **8** | `createEngine` reimplemented as the composition in the spec's §5, its body under 60 lines. `stages.test.ts` builds a five-stage pipeline by hand and gets the same `Value`. | Parity unchanged; the composition test passes. If it is awkward to write, the decomposition failed and that test is where to find out. |
| **9** | `Printer` — `canonical` mode and `value()` (today's `formatValue`). The round-trip contract over the corpus. | `parse(print(program, { mode: "canonical" }))` evaluates to the same `Value` for every corpus input. |
| **10** | `Printer` — `verbatim` and `resolved` modes, `node()`, `unit`, `symbols`, `spacing`. | `verbatim` reproduces the source exactly; `resolved` differs from `canonical` on exactly the corpus's ambiguous inputs. |
| **11** | `Printer` — `spelled`, via `spellNumber` from `@smartput/number`. | `"30 deg + 15 deg"` prints as `"thirty degrees plus fifteen degrees"`. |
| **12** | Subpath exports: `@smartput/core/{normalize,tokenize,parse,solve,eval,print,registry}`. **Needs the validate plan's Task 1.** | Bundling `@smartput/core/normalize` alone does not pull the solver — asserted with the validate plan's `measureEntry`. |
| **13** | Docs: `docs/guide/pipeline.md` rewritten around the stages, `docs/api/stages.md`, `docs/api/printer.md`, a `Printer` row in `docs/guide/roadmap.md`. | `bun run docs:build` passes. |

**Stop after Task 5 and check in.** Tasks 1–5 carry every structural risk in this
plan: the span fix, the id assignment, and the `Resolution` re-key. Tasks 6–13
are class wrappers over functions that already work, plus one new stage whose
contract (§9's round-trip) is already specified. Expanding them into full
bite-sized steps is worth doing once Task 5's parity run is green, and not
before — Task 5's outcome decides whether `Object.values` ordering needs an
explicit sort, which changes code in Tasks 6 and 8.

## Self-Review

**Spec coverage.** §1's measured span bug → Tasks 2 and 3. §2's decisions:
S1 (class + function) → every stage task, S2 (tree not IR) → Task 4's `Program`
doc comment, S3 (node ids) → Task 4, S4 (edits + mapSpan) → Task 2,
S5 (`createEngine` as composition) → Task 8, S6 (tiebreak into `best()`) →
Task 5, S7 (no serialization) → Global Constraints, S8 (subpaths) → Task 12,
S9 (no behaviour change) → Task 1's parity net, enforced in every task's final
step. §3's stage diagram → Tasks 2, 4, 5, 6, 7, 9. §4.1–4.7 → Tasks 2, 6, 5, 7,
9–11, 7. §5's `createEngine` → Task 8. §6's package layout → Task 12. §7's six
test classes → Task 1 (parity), Task 3 (span regression), Tasks 6–7 (per-stage
golden), Task 8 (composition), Task 9 (printer round-trip), Task 10 (printer
modes), and the immutability assertions in Tasks 2, 4, 5. §8's phases map to the
task order.

**Gap found and closed:** the spec's §4.4 specifies `Solver.forKind`, and
`coerce()` in `engine.ts` currently open-codes it *plus* a `NoCandidateError`
translation. Task 8 must move that translation into `coerce`'s composition
rather than into `forKind` — `forKind` returns `undefined` and the entry point
decides what absence means. Noted here so Task 8's expansion does not put error
policy in the solver.

**Placeholder scan.** One typo corrected inline in Task 3's Files block
(`packages ting/core` → `packages/core`). Tasks 6–13 are summarised with
concrete done-when criteria and gated behind an explicit check-in driven by
Task 5's parity result — deferred expansion, not deferred content.

**Type consistency.** `NormalizedInput`/`Edit`/`EditReason`/`NormalizerOptions`
defined in Task 2 and used unchanged in Tasks 3, 4, 5. `NodeId` defined in
Task 4 and consumed in Task 5's `Resolution`. `Program` defined in Task 4 and
taken by `solve` in Task 5. `Resolution` replaces `Assignment` consistently:
Task 5 changes `solver.ts`, `evaluate.ts` and `engine.ts` in the same task, so
no intermediate commit has one name in one file and the other in another.
`EvaluateOptions` gains `program` + `resolution` and loses `node` + `assignment`
in Task 5 Step 4, matching Task 5's Produces block.
