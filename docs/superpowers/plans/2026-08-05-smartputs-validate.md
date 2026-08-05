# smartputs Validate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every ratio kind an engine-free entry point — a byte-minimal parser, free operation functions, and an immutable value class — each on its own subpath, each costing only what it imports.

**Architecture:** A new zero-dependency package `@smartput/validate` holds a shared parser, op functions and a class factory. Each kind package gains `units.ts` (a `UnitTable` of decimal-string ratios plus a flat alias map), and thin `validate.ts` / `class.ts` wrappers that bind that table. The existing `defineKind` descriptor derives its lexicon aliases from the same table, so the micro path and the engine path cannot drift. A second new package `@smartput/input` binds a parser to a DOM input via the Constraint Validation API, with React and Vue adapters on their own subpaths.

**Tech Stack:** Bun (test runner, bundler), TypeScript 5.7 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome 2, `decimal.js` (engine path only — never in the micro path).

**Spec:** `docs/superpowers/specs/2026-08-05-smartputs-validate-design.md`

## Global Constraints

- `@smartput/validate` has **zero** runtime dependencies. CI fails on a first one.
- `@smartput/core` ships **one** runtime dependency (`decimal.js`). Unchanged by this plan.
- The micro path must never import `decimal.js`, `@smartput/core`, or any DOM type.
- Unit ratios are stored as **decimal strings**. Micro path does `Number(r)`; engine path does `new Decimal(r)`.
- Micro path is `en` aliases only. No locale vocabulary, no `Intl`.
- Free ops **return** `Ok | Err` and short-circuit. Class methods **throw** `ValidationError`.
- Class instances are `Object.freeze`d in the constructor; every method returns a new instance.
- `toString()` is compact (`"30deg"`), and `parseX(x.toString())` must round-trip in `strict` mode.
- Never import `decimal.js` directly — Biome errors. Use `Decimal` from `@smartput/core` (or `./decimal` inside core).
- Left operand's unit wins in every binary op, matching the engine.
- Budgets in Task 6 and Task 12 are **measured then committed**. If a measurement exceeds the spec's budget, amend the spec with the measured value and the reason — never silently raise it.
- Forward note: `2026-08-05-smartputs-i18n-design.md` will later remove `lexicon` from `defineKind`. Task 6's `aliasesFor` derivation is written so that change moves the *consumer* (`index.ts` → `locale/en.ts`) without changing `units.ts`. Do not pre-implement the i18n change here.

---

## File Structure

**New package — `packages/validate/`**

| File | Responsibility |
| --- | --- |
| `src/types.ts` | `Ok`, `Err`, `ErrCode`, `Parsed`, `UnitTable`, `ParseOptions`, `Ctx`, `Input` |
| `src/errors.ts` | `ValidationError` |
| `src/parse.ts` | `parse`, `is` — the grammar and the strict/loose difference |
| `src/convert.ts` | `ratioOf`, `toCanonical`, `fromCanonical`, `convert` — ratio + offset + dynamic |
| `src/ops.ts` | `add`, `sub`, `scale`, `negate`, `as`, `equals`, `compare`, `format` |
| `src/pattern.ts` | `patternFor` |
| `src/class.ts` | `createValueClass`, `ValueClass`, `ValueInstance` |
| `src/index.ts` | barrel |

**New package — `packages/input/`**

| File | Responsibility |
| --- | --- |
| `src/messages.ts` | `messageFor`, `DEFAULT_MESSAGES` |
| `src/bind.ts` | `bindInput` |
| `src/index.ts` | DOM barrel |
| `src/react.ts` | `useSmartInput` (React) |
| `src/vue.ts` | `useSmartInput` (Vue) |

**Per kind package — `packages/<kind>/src/`**

| File | Responsibility |
| --- | --- |
| `units.ts` | `<KIND>_UNITS: UnitTable<U>`, `type <Kind>Unit` |
| `validate.ts` | thin arrow wrappers binding the table |
| `class.ts` | `export const <Kind> = /*#__PURE__*/ createValueClass(...)` |
| `index.ts` | existing descriptor, aliases now derived from `units.ts` |

**Core additions — `packages/core/src/kind/`**

| File | Responsibility |
| --- | --- |
| `from-table.ts` | `decimalRatios`, `aliasesFor` — engine-side adapters over a `UnitTable` |

**Scripts**

| File | Responsibility |
| --- | --- |
| `scripts/build.ts` | Build every package entry declared in its `exports` map |
| `scripts/check-size.ts` | Measure minified + gzip bytes per entry against a budget table |

---

## Task 1: Build pipeline and dual-condition exports

Prerequisite for every byte claim in this plan. Packages currently export raw `./src/index.ts` with no build and no `sideEffects` flag.

**Files:**
- Create: `scripts/build.ts`
- Modify: `package.json` (root scripts)
- Modify: every `packages/*/package.json` (16 files)
- Test: `scripts/build.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `bun run build` populates `packages/*/dist/`. Every package resolves to `src` under the `bun` condition and `dist` under `default`, so existing tests keep working with no build.

- [ ] **Step 1: Write the failing test**

Create `scripts/build.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Glob } from "bun";

const root = new URL("..", import.meta.url);

const packages = [...new Glob("packages/*/package.json").scanSync(root.pathname)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

test("every package declares sideEffects: false", async () => {
  for (const path of packages) {
    const pkg = await Bun.file(new URL(path, root)).json();
    expect(pkg.sideEffects, `${pkg.name} must declare sideEffects`).toBe(false);
  }
});

test("every export subpath resolves to src under the bun condition", async () => {
  for (const path of packages) {
    const pkg = await Bun.file(new URL(path, root)).json();
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
      expect(typeof target, `${pkg.name} ${subpath} must be a condition map`).toBe(
        "object",
      );
      const map = target as Record<string, string>;
      expect(map.bun, `${pkg.name} ${subpath} needs a bun condition`).toMatch(
        /^\.\/src\/.+\.ts$/,
      );
      expect(map.default, `${pkg.name} ${subpath} needs a default condition`).toMatch(
        /^\.\/dist\/.+\.js$/,
      );
      expect(map.types, `${pkg.name} ${subpath} needs types`).toMatch(
        /^\.\/dist\/.+\.d\.ts$/,
      );
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./scripts/build.test.ts`
Expected: FAIL — `packages/core` has `sideEffects` undefined, and `exports["."]` is the string `"./src/index.ts"`, not a condition map.

- [ ] **Step 3: Write the build script**

Create `scripts/build.ts`:

```ts
import { Glob } from "bun";

/**
 * Builds every entry a package declares in its `exports` map, reading the
 * `bun` condition as the source and the `default` condition as the output.
 * Discovering entries from `exports` rather than a hardcoded list is what
 * stops a new subpath from being silently unbuilt — the same reason
 * check-deps.ts and typecheck.ts scan the filesystem.
 *
 * `--packages external` keeps workspace and npm dependencies as bare imports
 * so a consumer's bundler dedupes them. Bundling decimal.js into every package
 * would ship it several times over.
 */
const root = new URL("..", import.meta.url);

const manifests = [...new Glob("packages/*/package.json").scanSync(root.pathname)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

let failed = false;

for (const manifest of manifests) {
  const dir = manifest.replace(/\/package\.json$/, "");
  const pkg = await Bun.file(new URL(manifest, root)).json();
  const entries = Object.values(pkg.exports ?? {})
    .map((t) => (t as Record<string, string>).bun)
    .filter((s): s is string => typeof s === "string")
    .map((s) => `${dir}/${s.replace(/^\.\//, "")}`);

  if (entries.length === 0) {
    console.error(`${pkg.name} declares no buildable entries`);
    failed = true;
    continue;
  }

  const result = await Bun.build({
    entrypoints: entries.map((e) => new URL(e, root).pathname),
    outdir: new URL(`${dir}/dist`, root).pathname,
    root: new URL(`${dir}/src`, root).pathname,
    target: "browser",
    format: "esm",
    packages: "external",
    splitting: false,
  });

  if (!result.success) {
    console.error(`${pkg.name} build FAILED`);
    for (const log of result.logs) console.error(log);
    failed = true;
  } else {
    console.log(`${pkg.name} built ${result.outputs.length} file(s)`);
  }
}

if (failed) process.exit(1);
```

- [ ] **Step 4: Rewrite every package's exports map**

For each `packages/*/package.json`, add `"sideEffects": false` and convert every
`exports` value from a bare string to a three-condition map. `packages/core/package.json`
becomes:

```json
{
  "name": "@smartput/core",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "bun": "./src/index.ts",
      "default": "./dist/index.js"
    },
    "./locale/en": {
      "types": "./dist/locale/en.d.ts",
      "bun": "./src/locale/en.ts",
      "default": "./dist/locale/en.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "bun": "./src/testing/index.ts",
      "default": "./dist/testing/index.js"
    }
  },
  "dependencies": { "decimal.js": "^10.6.0" },
  "devDependencies": { "@smartput/kinds": "workspace:*" }
}
```

`packages/angle/package.json` becomes:

```json
{
  "name": "@smartput/angle",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "bun": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "dependencies": { "@smartput/core": "workspace:*" },
  "devDependencies": { "@smartput/kinds": "workspace:*" }
}
```

Apply the same shape to `area`, `datasize`, `datetime`, `duration`, `kinds`,
`length`, `mass`, `math`, `measure`, `number`, `percent`, `rates`, `speed`,
`temperature`, `volume`, preserving each one's existing subpath list.

- [ ] **Step 5: Add root scripts**

Modify `package.json`:

```json
  "scripts": {
    "test": "bun test",
    "build": "bun run scripts/build.ts",
    "docs:dev": "bun run --cwd docs dev",
    "docs:build": "bun run --cwd docs build",
    "docs:preview": "bun run --cwd docs preview",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "bun run scripts/typecheck.ts",
    "check-deps": "bun run scripts/check-deps.ts",
    "check": "bun run lint && bun run typecheck && bun run check-deps && bun test && bun run build"
  }
```

- [ ] **Step 6: Add dist to .gitignore**

Append to `.gitignore`:

```
dist/
```

- [ ] **Step 7: Run the full check**

Run: `bun run build && bun test ./scripts/build.test.ts && bun test && bun run typecheck`
Expected: build reports one line per package; `build.test.ts` PASSes; the existing
suite still PASSes unchanged, because Bun resolves the `bun` condition to `src`.

- [ ] **Step 8: Commit**

```bash
git add scripts/build.ts scripts/build.test.ts package.json .gitignore packages/*/package.json
git commit -m "build: add a per-package ESM build and dual-condition exports

Packages exported raw TypeScript with no build and no sideEffects flag, so
tree-shaking was the consumer's problem and no byte claim about this
library could be verified.

scripts/build.ts discovers entries from each package's own exports map
rather than a hardcoded list, for the same reason typecheck.ts and
check-deps.ts scan the filesystem: a new subpath that nobody remembered
to register should fail, not be skipped.

Exports are three-condition maps. Bun resolves the bun condition to src,
so the existing suite runs with no build step; bundlers and Node get
dist."
```

---

## Task 2: Size budget harness

**Files:**
- Create: `scripts/check-size.ts`
- Modify: `package.json` (add `check-size` to scripts and to `check`)
- Test: `scripts/check-size.test.ts`

**Interfaces:**
- Consumes: Task 1's `bun run build` and exports maps.
- Produces: `measureEntry(spec: EntrySpec): Promise<{ min: number; gzip: number }>` and a `BUDGETS` table. Later tasks add rows to `BUDGETS`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-size.test.ts`:

```ts
import { expect, test } from "bun:test";
import { measureEntry } from "./check-size";

test("measures a real entry and reports both numbers", async () => {
  const { min, gzip } = await measureEntry({
    label: "core root",
    from: "@smartput/core",
    names: ["createEngine"],
    min: Number.POSITIVE_INFINITY,
    gzip: Number.POSITIVE_INFINITY,
  });
  expect(min).toBeGreaterThan(0);
  expect(gzip).toBeGreaterThan(0);
  expect(gzip).toBeLessThan(min);
});

test("a symbol that does not exist fails loudly rather than measuring zero", async () => {
  await expect(
    measureEntry({
      label: "bogus",
      from: "@smartput/core",
      names: ["thisSymbolDoesNotExist"],
      min: Number.POSITIVE_INFINITY,
      gzip: Number.POSITIVE_INFINITY,
    }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./scripts/check-size.test.ts`
Expected: FAIL — `Cannot find module './check-size'`.

- [ ] **Step 3: Write the harness**

Create `scripts/check-size.ts`:

```ts
/**
 * Measures what a consumer actually pays for a named set of imports.
 *
 * The measurement bundles a synthetic entry that imports exactly `names` from
 * `from` and does something unremovable with them, then minifies. Importing
 * without using would let the minifier drop the whole graph and report a
 * budget of zero, which is why `globalThis.__keep` is assigned rather than the
 * values merely being referenced.
 *
 * A budget is the feature here. `check-deps.ts` is the precedent: the repo
 * enforces its tables rather than trusting them.
 */
export interface EntrySpec {
  label: string;
  from: string;
  names: string[];
  /** Budget in minified bytes. */
  min: number;
  /** Budget in gzipped bytes. */
  gzip: number;
}

export async function measureEntry(spec: EntrySpec): Promise<{
  min: number;
  gzip: number;
}> {
  const source = `import { ${spec.names.join(", ")} } from ${JSON.stringify(spec.from)};
(globalThis as Record<string, unknown>).__keep = [${spec.names.join(", ")}];
`;
  const entry = `/tmp/smartput-size-${spec.label.replace(/[^a-z0-9]+/gi, "-")}.ts`;
  await Bun.write(entry, source);

  const built = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "esm",
    minify: true,
    packages: "bundle",
  });

  if (!built.success) {
    throw new Error(
      `${spec.label}: build failed — ${built.logs.map(String).join("; ")}`,
    );
  }

  const output = built.outputs[0];
  if (output === undefined) throw new Error(`${spec.label}: build produced no output`);

  const text = await output.text();
  // A tree-shaken-to-nothing bundle means the symbol did not exist or the
  // keep-alive failed. Either way the number would be a lie.
  if (text.length < 32) {
    throw new Error(`${spec.label}: bundle is ${text.length} bytes — nothing was kept`);
  }

  const bytes = new TextEncoder().encode(text);
  return { min: bytes.byteLength, gzip: Bun.gzipSync(bytes).byteLength };
}

export const BUDGETS: EntrySpec[] = [
  // Rows are added by later tasks as each entry lands. Every number here was
  // measured first and then committed — see the plan's Global Constraints.
];

if (import.meta.main) {
  let failed = false;
  for (const spec of BUDGETS) {
    const { min, gzip } = await measureEntry(spec);
    const ok = min <= spec.min && gzip <= spec.gzip;
    const line = `${spec.label}: ${min} B min (budget ${spec.min}), ${gzip} B gzip (budget ${spec.gzip})`;
    if (ok) {
      console.log(`OK   ${line}`);
    } else {
      console.error(`OVER ${line}`);
      failed = true;
    }
  }
  if (BUDGETS.length === 0) console.log("check-size: no budgets registered yet");
  if (failed) process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test ./scripts/check-size.test.ts`
Expected: PASS — both tests.

- [ ] **Step 5: Wire into check**

Modify `package.json`, adding the script and extending `check`:

```json
    "check-size": "bun run scripts/check-size.ts",
    "check": "bun run lint && bun run typecheck && bun run check-deps && bun test && bun run build && bun run check-size"
```

- [ ] **Step 6: Run the full check**

Run: `bun run check`
Expected: all stages pass; `check-size` prints `no budgets registered yet`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-size.ts scripts/check-size.test.ts package.json
git commit -m "build: measure per-entry bundle cost against a budget table

The whole point of the validate path is that it costs approximately what
a hand-written regex costs. Unenforced, that claim rots on the first
refactor.

measureEntry bundles a synthetic entry importing exactly the named
symbols and assigns them to a global, so the minifier cannot shake away
the thing being measured and report zero. A bundle under 32 bytes is
treated as a failed measurement rather than a passing budget."
```

---

## Task 3: `@smartput/validate` — types and parser

**Files:**
- Create: `packages/validate/package.json`, `packages/validate/tsconfig.json`
- Create: `packages/validate/src/types.ts`, `packages/validate/src/errors.ts`, `packages/validate/src/parse.ts`, `packages/validate/src/index.ts`
- Create: `packages/validate/src/parse.test.ts`
- Modify: `scripts/check-deps.ts:11-40` (add the `packages/validate/package.json` entry)

**Interfaces:**
- Consumes: Task 1's export-map shape.
- Produces:
  - `type Ok<U extends string> = { readonly ok: true; readonly value: number; readonly unit: U; readonly raw: string }`
  - `type Err = { readonly ok: false; readonly code: ErrCode; readonly input: string }`
  - `type ErrCode = "empty" | "nan" | "missing-unit" | "unknown-unit" | "wrong-unit" | "trailing"`
  - `type Parsed<U extends string> = Ok<U> | Err`
  - `type Ctx = { readonly dpi?: number }`
  - `interface UnitTable<U extends string>` with `canonical`, `ratio`, `offset?`, `alias`
  - `interface ParseOptions<U extends string>` with `mode?`, `unit?`, `defaultUnit?`, `ctx?`, `resolve?`
  - `type Input<U extends string> = string | Ok<U>`
  - `class ValidationError extends Error` with `code: ErrCode`, `input: string`
  - `parse<U extends string>(t: UnitTable<U>, input: string, opts?: ParseOptions<U>): Parsed<U>`
  - `is<U extends string>(t: UnitTable<U>, input: string, opts?: ParseOptions<U>): boolean`

- [ ] **Step 1: Write the failing test**

Create `packages/validate/src/parse.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { is, parse } from "./parse";
import type { UnitTable } from "./types";

type AngleUnit = "rad" | "deg" | "grad" | "turn";

const T: UnitTable<AngleUnit> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    grad: "0.0157079632679489661923132169164",
    turn: "6.28318530717958647692528676656",
  },
  alias: {
    rad: "rad",
    radian: "rad",
    radians: "rad",
    deg: "deg",
    degree: "deg",
    degrees: "deg",
    grad: "grad",
    gradian: "grad",
    gradians: "grad",
    gon: "grad",
    turn: "turn",
    turns: "turn",
    rev: "turn",
    revolution: "turn",
  },
};

describe("accepted in both modes", () => {
  for (const [input, value, unit] of [
    ["30deg", 30, "deg"],
    ["30 deg", 30, "deg"],
    ["-30.5deg", -30.5, "deg"],
    ["+30deg", 30, "deg"],
    ["1e3deg", 1000, "deg"],
    ["0.25turn", 0.25, "turn"],
    ["5 radians", 5, "rad"],
  ] as const) {
    test(`${input} in strict`, () => {
      expect(parse(T, input, { mode: "strict" })).toEqual({
        ok: true,
        value,
        unit,
        raw: input.replace(/\s*[a-z]+$/i, "").trim(),
      });
    });
    test(`${input} in loose`, () => {
      const r = parse(T, input);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBe(value);
        expect(r.unit).toBe(unit);
      }
    });
  }
});

describe("the strict/loose difference", () => {
  test("outer whitespace: strict rejects, loose trims", () => {
    expect(parse(T, "  30deg  ", { mode: "strict" })).toEqual({
      ok: false,
      code: "trailing",
      input: "  30deg  ",
    });
    expect(parse(T, "  30deg  ")).toMatchObject({ ok: true, value: 30, unit: "deg" });
  });

  test("case: strict rejects, loose folds", () => {
    expect(parse(T, "30DEG", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "unknown-unit",
    });
    expect(parse(T, "30Deg")).toMatchObject({ ok: true, unit: "deg" });
  });

  test("bare number: strict rejects, loose needs defaultUnit", () => {
    expect(parse(T, "30", { mode: "strict" })).toMatchObject({
      ok: false,
      code: "missing-unit",
    });
    expect(parse(T, "30", { mode: "strict", defaultUnit: "deg" })).toMatchObject({
      ok: false,
      code: "missing-unit",
    });
    expect(parse(T, "30")).toMatchObject({ ok: false, code: "missing-unit" });
    expect(parse(T, "30", { defaultUnit: "deg" })).toMatchObject({
      ok: true,
      value: 30,
      unit: "deg",
    });
  });
});

describe("rejected in both modes", () => {
  for (const [input, code] of [
    ["", "empty"],
    ["   ", "empty"],
    ["30,5deg", "nan"],
    ["deg", "nan"],
    ["30smth", "unknown-unit"],
    ["30 deg extra", "trailing"],
  ] as const) {
    test(`${JSON.stringify(input)} -> ${code}`, () => {
      expect(parse(T, input, { mode: "strict" })).toMatchObject({ ok: false, code });
      expect(parse(T, input)).toMatchObject({ ok: false, code });
    });
  }
});

test("opts.unit turns any other valid unit into wrong-unit", () => {
  expect(parse(T, "30deg", { unit: "deg" })).toMatchObject({ ok: true });
  expect(parse(T, "30rad", { unit: "deg" })).toEqual({
    ok: false,
    code: "wrong-unit",
    input: "30rad",
  });
});

test("resolve is consulted only after the alias lookup misses", () => {
  const calls: string[] = [];
  const resolve = (word: string): AngleUnit | undefined => {
    calls.push(word);
    return word === "d" ? "deg" : undefined;
  };
  expect(parse(T, "30deg", { resolve })).toMatchObject({ ok: true, unit: "deg" });
  expect(calls).toEqual([]);
  expect(parse(T, "30d", { resolve })).toMatchObject({ ok: true, unit: "deg" });
  expect(calls).toEqual(["d"]);
});

test("raw preserves the number exactly as authored", () => {
  const r = parse(T, "30.500deg");
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.raw).toBe("30.500");
});

test("results are frozen", () => {
  expect(Object.isFrozen(parse(T, "30deg"))).toBe(true);
  expect(Object.isFrozen(parse(T, "30smth"))).toBe(true);
});

test("is() is parse().ok", () => {
  expect(is(T, "30deg")).toBe(true);
  expect(is(T, "30smth")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/validate/src/parse.test.ts`
Expected: FAIL — `Cannot find module './parse'`.

- [ ] **Step 3: Create the package manifest and tsconfig**

Create `packages/validate/package.json`:

```json
{
  "name": "@smartput/validate",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "bun": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

Create `packages/validate/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write the types**

Create `packages/validate/src/types.ts`:

```ts
/** A successful parse. `raw` is the number exactly as authored, for Decimal handoff. */
export type Ok<U extends string> = {
  readonly ok: true;
  readonly value: number;
  readonly unit: U;
  readonly raw: string;
};

export type ErrCode =
  /** Input was empty or whitespace only. */
  | "empty"
  /** No number could be read. */
  | "nan"
  /** A number was read, no unit followed, and no `defaultUnit` applied. */
  | "missing-unit"
  /** The unit word is not an alias of this table. */
  | "unknown-unit"
  /** `opts.unit` was set and the input named a different unit. */
  | "wrong-unit"
  /** Input continued past the unit. */
  | "trailing";

export type Err = {
  readonly ok: false;
  readonly code: ErrCode;
  readonly input: string;
};

export type Parsed<U extends string> = Ok<U> | Err;

/** Anything an operation accepts in place of an already-parsed value. */
export type Input<U extends string> = string | Ok<U>;

/**
 * Context a dynamic ratio reads. `dpi` is the only member, for `measure`'s
 * `px`; the engine reads the same number off `Value.meta`.
 */
export type Ctx = { readonly dpi?: number };

/**
 * Ratios are decimal **strings**, not numbers: `angle` guards a 30-digit pi
 * against float drift and a shared table cannot be floats without breaking
 * that. This path does `Number(r)`; the engine path does `new Decimal(r)`.
 *
 * A ratio may instead be a function of `Ctx` — `measure`'s `px` is `1/dpi`.
 * That branch costs every kind about fifteen bytes and is the difference
 * between `measure` working here and being a second exclusion.
 */
export interface UnitTable<U extends string> {
  readonly canonical: U;
  readonly ratio: Readonly<Record<U, string | ((ctx: Ctx) => number)>>;
  /** Affine kinds only. `canonical = (v + offset) * ratio`. */
  readonly offset?: Readonly<Partial<Record<U, string>>>;
  /** Lowercase alias -> unit key. Flat, because that is what the parser reads. */
  readonly alias: Readonly<Record<string, U>>;
}

export interface ParseOptions<U extends string> {
  /** Default `"loose"`. See the strict/loose table in the spec. */
  mode?: "strict" | "loose";
  /** Require exactly this unit; anything else is `wrong-unit`. */
  unit?: U;
  /** Loose mode only: a bare number lands on this unit. */
  defaultUnit?: U;
  ctx?: Ctx;
  /** Consulted only after the table's own alias lookup misses. */
  resolve?: (word: string, table: UnitTable<U>) => U | undefined;
}
```

- [ ] **Step 5: Write the error class**

Create `packages/validate/src/errors.ts`:

```ts
import type { ErrCode } from "./types";

/**
 * Thrown by class methods. Free functions return `Err` instead — two algebras,
 * each idiomatic for its caller.
 *
 * Deliberately not a subclass of core's `SmartputError`: importing core here
 * would pull `decimal.js` into a 600-byte budget. Same `name`/`code`/`input`
 * shape, no dependency. Do not "fix" this by importing core.
 */
export class ValidationError extends Error {
  readonly code: ErrCode;
  readonly input: string;

  constructor(code: ErrCode, input: string) {
    super(`${code}: ${JSON.stringify(input)}`);
    // A literal, never `new.target.name`: a minifier renames the class.
    this.name = "ValidationError";
    this.code = code;
    this.input = input;
  }
}
```

- [ ] **Step 6: Write the parser**

Create `packages/validate/src/parse.ts`:

```ts
import type { Err, Ok, ParseOptions, Parsed, UnitTable } from "./types";

/**
 * sign? digits ("." digits)? exponent?   then optional whitespace, then a unit.
 * No thousands separators and no locale decimal comma: those need `Intl` and
 * the locale's numberFormat, which is the engine's job.
 */
const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;

const fail = (code: Err["code"], input: string): Err =>
  Object.freeze({ ok: false as const, code, input });

export function parse<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const strict = opts?.mode === "strict";
  // The entire strict/loose difference: trim, case-fold, bare-number fallback.
  const text = strict ? input : input.trim();

  if (text.length === 0) return fail("empty", input);

  const matched = NUMBER.exec(text);
  if (matched === null) return fail("nan", input);

  const raw = matched[0];
  const value = Number(raw);
  if (!Number.isFinite(value)) return fail("nan", input);

  const rest = text.slice(raw.length);
  // A single inner space is always allowed, in both modes: "30 deg" is the
  // form people type and rejecting it would make strict useless.
  const word = rest.startsWith(" ") ? rest.slice(1) : rest;

  if (word.length === 0) {
    const fallback = strict ? undefined : opts?.defaultUnit;
    if (fallback === undefined) return fail("missing-unit", input);
    return finish(value, fallback, raw, input, opts);
  }

  // Anything that is not a unit word is trailing input, not an unknown unit:
  // "30 deg extra" has a space inside `word`, and reporting `unknown-unit` for
  // it would name the wrong problem.
  if (/[\s]/.test(word)) return fail("trailing", input);

  const key = strict ? word : word.toLowerCase();
  const direct = table.alias[key];
  const unit = direct ?? opts?.resolve?.(key, table);
  if (unit === undefined) return fail("unknown-unit", input);

  return finish(value, unit, raw, input, opts);
}

function finish<U extends string>(
  value: number,
  unit: U,
  raw: string,
  input: string,
  opts: ParseOptions<U> | undefined,
): Parsed<U> {
  if (opts?.unit !== undefined && opts.unit !== unit) return fail("wrong-unit", input);
  return Object.freeze({ ok: true as const, value, unit, raw }) as Ok<U>;
}

export function is<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): boolean {
  return parse(table, input, opts).ok;
}
```

- [ ] **Step 7: Write the barrel**

Create `packages/validate/src/index.ts`:

```ts
export { ValidationError } from "./errors";
export { is, parse } from "./parse";
export type {
  Ctx,
  Err,
  ErrCode,
  Input,
  Ok,
  Parsed,
  ParseOptions,
  UnitTable,
} from "./types";
```

- [ ] **Step 8: Register the package in check-deps**

Modify `scripts/check-deps.ts`, adding to `ALLOWED` above the extracted-kinds block:

```ts
  // The micro-validation path. Zero runtime dependencies, enforced here: a
  // first one would mean decimal.js or core leaked into a 600-byte budget.
  "packages/validate/package.json": [],
```

- [ ] **Step 9: Run tests**

Run: `bun test ./packages/validate/src/parse.test.ts && bun run typecheck && bun run check-deps`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/validate scripts/check-deps.ts
git commit -m "feat(validate): add the zero-dependency parser

parse() reads <number><unit> against a UnitTable and returns a
discriminated Ok | Err with a typed code, never throwing. The whole
strict/loose difference is trim, case-fold and the bare-number fallback
-- about thirty bytes, and a real contract: strict accepts exactly what
format() and toString() emit, which is what makes a round-trip test a
test.

A word containing whitespace reports trailing rather than unknown-unit,
because '30 deg extra' has nothing wrong with its unit.

ValidationError deliberately does not extend core's SmartputError:
importing core would pull decimal.js into the budget this package
exists to defend."
```

---

## Task 4: `@smartput/validate` — conversion and operations

**Files:**
- Create: `packages/validate/src/convert.ts`, `packages/validate/src/ops.ts`, `packages/validate/src/pattern.ts`
- Create: `packages/validate/src/convert.test.ts`, `packages/validate/src/ops.test.ts`, `packages/validate/src/pattern.test.ts`
- Modify: `packages/validate/src/index.ts`

**Interfaces:**
- Consumes: Task 3's `parse`, `UnitTable`, `Ok`, `Err`, `Input`, `Ctx`.
- Produces:
  - `ratioOf<U>(t: UnitTable<U>, unit: U, ctx?: Ctx): number`
  - `offsetOf<U>(t: UnitTable<U>, unit: U): number`
  - `toCanonical<U>(t: UnitTable<U>, value: number, unit: U, ctx?: Ctx): number`
  - `fromCanonical<U>(t: UnitTable<U>, canonical: number, unit: U, ctx?: Ctx): number`
  - `convert<U>(t, a: Input<U>, to: U, opts?: ParseOptions<U>): number | undefined`
  - `coerce<U>(t, a: Input<U>, opts?: ParseOptions<U>): Parsed<U>`
  - `add`, `sub`, `scale`, `negate`, `as`: `(t, ...) => Parsed<U>`
  - `equals<U>(t, a, b, epsilon?: number, opts?): boolean`
  - `compare<U>(t, a, b, opts?): -1 | 0 | 1 | undefined`
  - `format<U>(t, a: Ok<U>): string`
  - `patternFor<U>(t: UnitTable<U>, opts?: { mode?: "strict" | "loose" }): string`

- [ ] **Step 1: Write the failing conversion test**

Create `packages/validate/src/convert.test.ts`:

```ts
import { expect, test } from "bun:test";
import { convert, fromCanonical, toCanonical } from "./convert";
import type { UnitTable } from "./types";

const ANGLE: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", turn: "turn" },
};

const TEMP: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  offset: { f: "-32", k: "-273.15" },
  alias: { c: "c", f: "f", k: "k" },
};

const MEASURE: UnitTable<"inch" | "mm" | "px"> = {
  canonical: "inch",
  ratio: {
    inch: "1",
    mm: "0.03937007874015748031496062992126",
    px: (ctx) => 1 / (ctx.dpi ?? 96),
  },
  alias: { inch: "inch", mm: "mm", px: "px" },
};

test("ratio conversion round-trips", () => {
  expect(convert(ANGLE, "180deg", "rad")).toBeCloseTo(Math.PI, 12);
  expect(convert(ANGLE, "0.25turn", "deg")).toBeCloseTo(90, 12);
  expect(convert(ANGLE, "1rad", "rad")).toBe(1);
});

test("affine conversion applies offsets in the right order", () => {
  expect(convert(TEMP, "212f", "c")).toBeCloseTo(100, 9);
  expect(convert(TEMP, "0c", "k")).toBeCloseTo(273.15, 9);
  expect(convert(TEMP, "300k", "c")).toBeCloseTo(26.85, 9);
  expect(convert(TEMP, "100c", "f")).toBeCloseTo(212, 9);
});

test("a dynamic ratio reads dpi off the context", () => {
  expect(convert(MEASURE, "96px", "inch", { ctx: { dpi: 96 } })).toBeCloseTo(1, 12);
  expect(convert(MEASURE, "144px", "inch", { ctx: { dpi: 144 } })).toBeCloseTo(1, 12);
  // No ctx supplied: 96 dpi is assumed, matching the kind's DEFAULT_DPI.
  expect(convert(MEASURE, "96px", "inch")).toBeCloseTo(1, 12);
});

test("convert returns undefined on bad input rather than a sentinel number", () => {
  expect(convert(ANGLE, "30smth", "rad")).toBeUndefined();
});

test("toCanonical and fromCanonical are inverses for every unit", () => {
  for (const table of [ANGLE, TEMP] as const) {
    for (const unit of Object.keys(table.ratio) as Array<keyof typeof table.ratio>) {
      const canonical = toCanonical(table, 7, unit as never);
      expect(fromCanonical(table, canonical, unit as never)).toBeCloseTo(7, 9);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/validate/src/convert.test.ts`
Expected: FAIL — `Cannot find module './convert'`.

- [ ] **Step 3: Write the conversion module**

Create `packages/validate/src/convert.ts`:

```ts
import { parse } from "./parse";
import type { Ctx, Input, Ok, ParseOptions, Parsed, UnitTable } from "./types";

const EMPTY_CTX: Ctx = {};

export function ratioOf<U extends string>(
  table: UnitTable<U>,
  unit: U,
  ctx?: Ctx,
): number {
  const r = table.ratio[unit];
  // One typeof check, paid by every kind, so `measure`'s dpi-relative px is a
  // unit rather than a second exclusion.
  return typeof r === "function" ? r(ctx ?? EMPTY_CTX) : Number(r);
}

export function offsetOf<U extends string>(table: UnitTable<U>, unit: U): number {
  const o = table.offset?.[unit];
  return o === undefined ? 0 : Number(o);
}

/** `canonical = (value + offset) * ratio` — the order core's convert.ts uses. */
export function toCanonical<U extends string>(
  table: UnitTable<U>,
  value: number,
  unit: U,
  ctx?: Ctx,
): number {
  return (value + offsetOf(table, unit)) * ratioOf(table, unit, ctx);
}

export function fromCanonical<U extends string>(
  table: UnitTable<U>,
  canonical: number,
  unit: U,
  ctx?: Ctx,
): number {
  return canonical / ratioOf(table, unit, ctx) - offsetOf(table, unit);
}

/** Parse a string input, or pass an already-parsed one through. */
export function coerce<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return typeof a === "string" ? parse(table, a, opts) : a;
}

export function convert<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  to: U,
  opts?: ParseOptions<U>,
): number | undefined {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return undefined;
  return fromCanonical(
    table,
    toCanonical(table, parsed.value, parsed.unit, opts?.ctx),
    to,
    opts?.ctx,
  );
}

/** Exported for ops.ts, which needs the canonical magnitude of a known-good value. */
export function canonicalOf<U extends string>(
  table: UnitTable<U>,
  a: Ok<U>,
  ctx?: Ctx,
): number {
  return toCanonical(table, a.value, a.unit, ctx);
}
```

- [ ] **Step 4: Write the failing ops test**

Create `packages/validate/src/ops.test.ts`:

```ts
import { expect, test } from "bun:test";
import { add, as, compare, equals, format, negate, scale, sub } from "./ops";
import { parse } from "./parse";
import type { UnitTable } from "./types";

const T: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg", turn: "turn" },
};

test("ops accept raw strings", () => {
  expect(add(T, "30deg", "15deg")).toMatchObject({ ok: true, value: 45, unit: "deg" });
  expect(sub(T, "30deg", "15deg")).toMatchObject({ ok: true, value: 15, unit: "deg" });
});

test("the left operand's unit wins, matching the engine", () => {
  const sum = add(T, "1turn", "180deg");
  expect(sum).toMatchObject({ ok: true, unit: "turn" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);

  const flipped = add(T, "180deg", "1turn");
  expect(flipped).toMatchObject({ ok: true, unit: "deg" });
  if (flipped.ok) expect(flipped.value).toBeCloseTo(540, 9);
});

test("errors short-circuit and name the operand that broke", () => {
  expect(add(T, "30smth", "15deg")).toEqual({
    ok: false,
    code: "unknown-unit",
    input: "30smth",
  });
  expect(add(T, "30deg", "15smth")).toEqual({
    ok: false,
    code: "unknown-unit",
    input: "15smth",
  });
});

test("scale and negate", () => {
  expect(scale(T, "30deg", 3)).toMatchObject({ ok: true, value: 90, unit: "deg" });
  expect(negate(T, "30deg")).toMatchObject({ ok: true, value: -30, unit: "deg" });
});

test("as rebases without changing the quantity", () => {
  const rebased = as(T, "180deg", "rad");
  expect(rebased).toMatchObject({ ok: true, unit: "rad" });
  if (rebased.ok) expect(rebased.value).toBeCloseTo(Math.PI, 12);
});

test("equals compares across units, with an epsilon", () => {
  expect(equals(T, "180deg", "0.5turn")).toBe(true);
  expect(equals(T, "180deg", "181deg")).toBe(false);
  expect(equals(T, "180deg", "180.0000001deg", 1e-5)).toBe(true);
  expect(equals(T, "180deg", "30smth")).toBe(false);
});

test("compare orders across units and returns undefined on bad input", () => {
  expect(compare(T, "1turn", "180deg")).toBe(1);
  expect(compare(T, "180deg", "1turn")).toBe(-1);
  expect(compare(T, "180deg", "0.5turn")).toBe(0);
  expect(compare(T, "180deg", "30smth")).toBeUndefined();
});

test("format is compact and round-trips through parse in strict mode", () => {
  const a = parse(T, "30.5deg");
  expect(a.ok).toBe(true);
  if (!a.ok) return;
  expect(format(T, a)).toBe("30.5deg");
  expect(parse(T, format(T, a), { mode: "strict" })).toEqual(a);
});

test("op results are frozen", () => {
  expect(Object.isFrozen(add(T, "30deg", "15deg"))).toBe(true);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `bun test ./packages/validate/src/ops.test.ts`
Expected: FAIL — `Cannot find module './ops'`.

- [ ] **Step 6: Write the ops module**

Create `packages/validate/src/ops.ts`:

```ts
import { canonicalOf, coerce, fromCanonical, toCanonical } from "./convert";
import type { Input, Ok, ParseOptions, Parsed, UnitTable } from "./types";

const ok = <U extends string>(value: number, unit: U, raw?: string): Ok<U> =>
  Object.freeze({
    ok: true as const,
    value,
    unit,
    raw: raw ?? String(value),
  }) as Ok<U>;

/**
 * Both operands, or the first `Err`. Short-circuiting on the first failure is
 * what makes the free ops composable without try/catch — and the returned Err
 * carries its own `input`, so a message names the operand that broke.
 */
function pair<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): [Ok<U>, Ok<U>] | Parsed<U> {
  const left = coerce(table, a, opts);
  if (!left.ok) return left;
  const right = coerce(table, b, opts);
  if (!right.ok) return right;
  return [left, right];
}

function combine<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  sign: 1 | -1,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return both;
  const [left, right] = both;
  const canonical =
    canonicalOf(table, left, opts?.ctx) + sign * canonicalOf(table, right, opts?.ctx);
  // The left operand's unit is inherited, matching the engine's documented
  // rule: 1 kg + 500 g is 1.5 kilograms, not 1500 g.
  return ok(fromCanonical(table, canonical, left.unit, opts?.ctx), left.unit);
}

export function add<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return combine(table, a, b, 1, opts);
}

export function sub<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return combine(table, a, b, -1, opts);
}

export function scale<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  factor: number,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return parsed;
  return ok(parsed.value * factor, parsed.unit);
}

export function negate<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  opts?: ParseOptions<U>,
): Parsed<U> {
  return scale(table, a, -1, opts);
}

export function as<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  to: U,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const parsed = coerce(table, a, opts);
  if (!parsed.ok) return parsed;
  return ok(
    fromCanonical(table, canonicalOf(table, parsed, opts?.ctx), to, opts?.ctx),
    to,
  );
}

export function equals<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  epsilon = 0,
  opts?: ParseOptions<U>,
): boolean {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return false;
  const [left, right] = both;
  return (
    Math.abs(canonicalOf(table, left, opts?.ctx) - canonicalOf(table, right, opts?.ctx)) <=
    epsilon
  );
}

export function compare<U extends string>(
  table: UnitTable<U>,
  a: Input<U>,
  b: Input<U>,
  opts?: ParseOptions<U>,
): -1 | 0 | 1 | undefined {
  const both = pair(table, a, b, opts);
  if (!Array.isArray(both)) return undefined;
  const [left, right] = both;
  const l = canonicalOf(table, left, opts?.ctx);
  const r = canonicalOf(table, right, opts?.ctx);
  return l < r ? -1 : l > r ? 1 : 0;
}

/**
 * Compact, not pretty: "30deg", never "30 degrees". Round-tripping through
 * `parse` in strict mode is this path's contract; locale formatting is the
 * engine's job.
 */
export function format<U extends string>(_table: UnitTable<U>, a: Ok<U>): string {
  return `${a.raw}${a.unit}`;
}

/** Re-exported so a caller needs one import for parse-and-convert. */
export { convert, coerce, toCanonical, fromCanonical } from "./convert";
```

- [ ] **Step 7: Write the failing pattern test**

Create `packages/validate/src/pattern.test.ts`:

```ts
import { expect, test } from "bun:test";
import { patternFor } from "./pattern";
import type { UnitTable } from "./types";

const T: UnitTable<"rad" | "deg"> = {
  canonical: "rad",
  ratio: { rad: "1", deg: "0.017453292519943295" },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg" },
};

test("the pattern accepts what parse accepts", () => {
  const re = new RegExp(`^(?:${patternFor(T)})$`);
  for (const good of ["30deg", "30 deg", "-30.5deg", "1e3deg", "30degrees"]) {
    expect(re.test(good), good).toBe(true);
  }
  for (const bad of ["30smth", "deg", "30,5deg", "30 deg extra"]) {
    expect(re.test(bad), bad).toBe(false);
  }
});

test("loose accepts outer whitespace and mixed case, strict does not", () => {
  const loose = new RegExp(`^(?:${patternFor(T)})$`);
  const strict = new RegExp(`^(?:${patternFor(T, { mode: "strict" })})$`);
  expect(loose.test("  30DEG  ")).toBe(true);
  expect(strict.test("  30DEG  ")).toBe(false);
  expect(strict.test("30deg")).toBe(true);
});

test("aliases are escaped, so a regex metacharacter cannot break out", () => {
  const percent: UnitTable<"%"> = {
    canonical: "%",
    ratio: { "%": "0.01" },
    alias: { "%": "%", percent: "%", pct: "%" },
  };
  const re = new RegExp(`^(?:${patternFor(percent)})$`);
  expect(re.test("20%")).toBe(true);
  expect(re.test("20percent")).toBe(true);
  expect(re.test("20x")).toBe(false);
});
```

- [ ] **Step 8: Write the pattern module**

Create `packages/validate/src/pattern.ts`:

```ts
import type { UnitTable } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A `pattern` attribute value covering the same grammar `parse` accepts, so a
 * form gets native validation with no JS and an `inputmode` hint for free.
 *
 * Longest alias first: alternation is ordered, so "deg" listed before
 * "degrees" would match the prefix and leave "rees" as trailing input.
 */
export function patternFor<U extends string>(
  table: UnitTable<U>,
  opts?: { mode?: "strict" | "loose" },
): string {
  const aliases = Object.keys(table.alias)
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escape)
    .join("|");
  const number = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
  const unit = `(?:${aliases})`;
  if (opts?.mode === "strict") return `${number} ?${unit}`;
  // Loose folds case and trims, so the pattern mirrors both.
  const upper = Object.keys(table.alias)
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .flatMap((a) => [a, a.toUpperCase()])
    .map(escape)
    .join("|");
  return `\\s*${number} ?(?:${upper})\\s*`;
}
```

- [ ] **Step 9: Extend the barrel**

Modify `packages/validate/src/index.ts`:

```ts
export {
  canonicalOf,
  coerce,
  convert,
  fromCanonical,
  offsetOf,
  ratioOf,
  toCanonical,
} from "./convert";
export { ValidationError } from "./errors";
export { add, as, compare, equals, format, negate, scale, sub } from "./ops";
export { is, parse } from "./parse";
export { patternFor } from "./pattern";
export type {
  Ctx,
  Err,
  ErrCode,
  Input,
  Ok,
  Parsed,
  ParseOptions,
  UnitTable,
} from "./types";
```

- [ ] **Step 10: Run tests**

Run: `bun test ./packages/validate && bun run typecheck`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/validate
git commit -m "feat(validate): add conversion, operations and pattern generation

Conversion applies (value + offset) * ratio in the order core's
convert.ts uses, so affine kinds land on the same numbers. A ratio may
be a function of a dpi context -- one typeof check, paid by every kind,
which is the difference between measure's px being a unit here and being
a second exclusion.

Ops accept raw strings, inherit the left operand's unit, and
short-circuit on the first Err so a message names the operand that
broke. compare and convert return undefined on bad input rather than a
sentinel number, because neither can return Err without losing its
useful return type.

patternFor sorts aliases longest-first: alternation is ordered, so 'deg'
before 'degrees' would match the prefix and leave 'rees' trailing."
```

---

## Task 5: `@smartput/validate` — the value class factory

**Files:**
- Create: `packages/validate/src/class.ts`, `packages/validate/src/class.test.ts`
- Modify: `packages/validate/src/index.ts`

**Interfaces:**
- Consumes: Task 3's `parse`, `UnitTable`, `Ok`, `ValidationError`; Task 4's `add`, `sub`, `scale`, `negate`, `as`, `equals`, `compare`, `convert`, `canonicalOf`, `format`.
- Produces:
  - `createValueClass<U extends string>(table: UnitTable<U>, kind: string, opts?: { delta?: () => ValueClass<U> }): ValueClass<U>`
  - `interface ValueClass<U extends string>` — `new (value, unit)`, `parse`, `tryParse`, `from`, `kind`, `canonical`, `units`
  - `interface ValueInstance<U extends string>` — `value`, `unit`, `to`, `as`, `add?`, `sub?`, `scale?`, `negate?`, `diff?`, `equals`, `compare`, `toString`, `toJSON`, `valueOf`

- [ ] **Step 1: Write the failing test**

Create `packages/validate/src/class.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createValueClass } from "./class";
import { ValidationError } from "./errors";
import type { UnitTable } from "./types";

const ANGLE: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg", turn: "turn" },
};

const TEMPDELTA: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  alias: { c: "c", f: "f", k: "k" },
};

const TEMP: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  offset: { f: "-32", k: "-273.15" },
  alias: { c: "c", f: "f", k: "k" },
};

const Angle = createValueClass(ANGLE, "angle");
const TempDelta = createValueClass(TEMPDELTA, "tempdelta");
const Temperature = createValueClass(TEMP, "temperature", { delta: () => TempDelta });

test("the spec's worked example", () => {
  const a = Angle.parse("30deg");
  const b = a.add?.(new Angle(30, "deg"));
  expect(a.toString()).toBe("30deg");
  expect(b?.toString()).toBe("60deg");
});

test("instances are frozen and never mutated", () => {
  const a = Angle.parse("30deg");
  expect(Object.isFrozen(a)).toBe(true);
  expect(() => {
    (a as unknown as { value: number }).value = 99;
  }).toThrow();
  const b = a.add?.("15deg");
  expect(a.value).toBe(30);
  expect(b).not.toBe(a);
});

test("parse throws, tryParse does not", () => {
  expect(() => Angle.parse("30smth")).toThrow(ValidationError);
  try {
    Angle.parse("30smth");
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as ValidationError).code).toBe("unknown-unit");
    expect((e as ValidationError).input).toBe("30smth");
  }
  expect(Angle.tryParse("30smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(Angle.tryParse("30deg")).toBeInstanceOf(Angle);
});

test("from accepts a string, an Ok record, and an instance", () => {
  expect(Angle.from("30deg").value).toBe(30);
  expect(Angle.from({ ok: true, value: 30, unit: "deg", raw: "30" }).value).toBe(30);
  const a = Angle.parse("30deg");
  expect(Angle.from(a)).toBe(a);
});

test("to, as, equals, compare", () => {
  const a = Angle.parse("180deg");
  expect(a.to("rad")).toBeCloseTo(Math.PI, 12);
  expect(a.as("rad").unit).toBe("rad");
  expect(a.equals("0.5turn")).toBe(true);
  expect(a.compare("0.25turn")).toBe(1);
});

test("valueOf returns the canonical magnitude, so < and > work", () => {
  const small = Angle.parse("30deg");
  const large = Angle.parse("1turn");
  expect(small < large).toBe(true);
  expect(large > small).toBe(true);
});

test("toJSON and toString round-trip", () => {
  const a = Angle.parse("30.5deg");
  expect(a.toJSON()).toEqual({ value: 30.5, unit: "deg" });
  expect(JSON.stringify(a)).toBe('{"value":30.5,"unit":"deg"}');
  expect(Angle.parse(a.toString()).equals(a)).toBe(true);
});

test("static metadata", () => {
  expect(Angle.kind).toBe("angle");
  expect(Angle.canonical).toBe("rad");
  expect([...Angle.units].sort()).toEqual(["deg", "rad", "turn"]);
});

test("an affine kind has diff and no add, sub, scale or negate", () => {
  const t = Temperature.parse("30c");
  expect(t.add).toBeUndefined();
  expect(t.sub).toBeUndefined();
  expect(t.scale).toBeUndefined();
  expect(t.negate).toBeUndefined();
  expect(t.diff).toBeDefined();
});

test("a temperature diff produces a delta in the delta class", () => {
  const d = Temperature.parse("30c").diff?.("20c");
  expect(d).toBeInstanceOf(TempDelta);
  expect(d?.value).toBeCloseTo(10, 9);
  expect(d?.add?.("5c").value).toBeCloseTo(15, 9);
});

test("a ratio kind has no diff", () => {
  expect(Angle.parse("30deg").diff).toBeUndefined();
});

test("the constructor accepts a numeric string and rejects an unknown unit", () => {
  expect(new Angle("30.5", "deg").value).toBe(30.5);
  expect(() => new Angle(30, "smth" as never)).toThrow(ValidationError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/validate/src/class.test.ts`
Expected: FAIL — `Cannot find module './class'`.

- [ ] **Step 3: Write the factory**

Create `packages/validate/src/class.ts`:

```ts
import { canonicalOf, coerce, fromCanonical, toCanonical } from "./convert";
import { ValidationError } from "./errors";
import { compare as cmp, equals as eq, format } from "./ops";
import { parse } from "./parse";
import type { Err, Input, Ok, ParseOptions, UnitTable } from "./types";

export interface ValueInstance<U extends string> {
  readonly value: number;
  readonly unit: U;

  to(unit: U): number;
  as(unit: U): ValueInstance<U>;

  /** Ratio kinds only; absent on an affine kind. */
  add?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  sub?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  scale?(factor: number): ValueInstance<U>;
  negate?(): ValueInstance<U>;

  /** Affine kinds only. Returns an instance of the paired delta class. */
  diff?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;

  equals(other: Input<U> | ValueInstance<U>, epsilon?: number): boolean;
  compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1;

  toString(): string;
  toJSON(): { value: number; unit: U };
  /** The canonical magnitude, so `<` and `>` compare correctly. */
  valueOf(): number;
}

export interface ValueClass<U extends string> {
  new (value: number | string, unit: U): ValueInstance<U>;
  /** Throws `ValidationError`. */
  parse(input: string, opts?: ParseOptions<U>): ValueInstance<U>;
  tryParse(input: string, opts?: ParseOptions<U>): ValueInstance<U> | Err;
  from(input: Input<U> | ValueInstance<U>): ValueInstance<U>;
  readonly kind: string;
  readonly canonical: U;
  readonly units: readonly U[];
}

/**
 * One implementation for every kind. Which methods exist is decided by the
 * table, exactly as core's createFacade does it: an affine kind gets `diff`
 * and no `add`, because 20C * 2 has no meaning.
 *
 * `opts.delta` is a thunk rather than a class so temperature and tempdelta can
 * refer to each other from the same module without a circular initialisation.
 */
export function createValueClass<U extends string>(
  table: UnitTable<U>,
  kind: string,
  opts?: { delta?: () => ValueClass<U> },
): ValueClass<U> {
  const units = Object.freeze(Object.keys(table.ratio) as U[]);
  const affine = table.offset !== undefined;

  class V implements ValueInstance<U> {
    readonly value: number;
    readonly unit: U;

    constructor(value: number | string, unit: U) {
      if (table.ratio[unit] === undefined) {
        throw new ValidationError("unknown-unit", String(unit));
      }
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new ValidationError("nan", String(value));
      this.value = n;
      this.unit = unit;
      // A readonly that exists only at compile time is a comment.
      Object.freeze(this);
    }

    static readonly kind = kind;
    static readonly canonical = table.canonical;
    static readonly units = units;

    static parse(input: string, o?: ParseOptions<U>): V {
      const r = parse(table, input, o);
      if (!r.ok) throw new ValidationError(r.code, r.input);
      return new V(r.value, r.unit);
    }

    static tryParse(input: string, o?: ParseOptions<U>): V | Err {
      const r = parse(table, input, o);
      return r.ok ? new V(r.value, r.unit) : r;
    }

    static from(input: Input<U> | ValueInstance<U>): V {
      if (input instanceof V) return input;
      if (typeof input === "string") return V.parse(input);
      return new V(input.value, input.unit);
    }

    private other(input: Input<U> | ValueInstance<U>): Ok<U> {
      if (input instanceof V) {
        return { ok: true, value: input.value, unit: input.unit, raw: String(input.value) };
      }
      const r = coerce(table, input as Input<U>);
      if (!r.ok) throw new ValidationError(r.code, r.input);
      return r;
    }

    private self(): Ok<U> {
      return { ok: true, value: this.value, unit: this.unit, raw: String(this.value) };
    }

    to(unit: U): number {
      return fromCanonical(table, canonicalOf(table, this.self()), unit);
    }

    as(unit: U): V {
      return new V(this.to(unit), unit);
    }

    equals(other: Input<U> | ValueInstance<U>, epsilon = 0): boolean {
      return eq(table, this.self(), this.other(other), epsilon);
    }

    compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1 {
      const r = cmp(table, this.self(), this.other(other));
      // `other()` already threw on bad input, so undefined is unreachable.
      if (r === undefined) throw new ValidationError("nan", String(other));
      return r;
    }

    toString(): string {
      return format(table, this.self());
    }

    toJSON(): { value: number; unit: U } {
      return { value: this.value, unit: this.unit };
    }

    valueOf(): number {
      return canonicalOf(table, this.self());
    }
  }

  const proto = V.prototype as unknown as Record<string, unknown>;

  if (affine) {
    // Subtracting two readings yields a difference, in the paired delta class.
    // Adding two readings is meaningless, so `add` is absent rather than
    // throwing — an absent method is a type error, a throwing one is a bug
    // report.
    proto.diff = function (this: V, other: Input<U> | ValueInstance<U>) {
      const Delta = opts?.delta?.();
      if (Delta === undefined) {
        throw new ValidationError("wrong-unit", `${kind} declares no delta class`);
      }
      const right = this.constructor === V ? V.from(other) : V.from(other);
      const difference =
        toCanonical(table, this.value, this.unit) -
        toCanonical(table, right.value, right.unit);
      // The difference is a magnitude on the ratio line, so it is read back
      // through the delta table's ratio -- never through this table's offsets,
      // which would re-apply the 32 in Fahrenheit.
      return new Delta(difference, table.canonical);
    };
  } else {
    proto.add = function (this: V, other: Input<U> | ValueInstance<U>) {
      const right = V.from(other);
      const canonical =
        toCanonical(table, this.value, this.unit) +
        toCanonical(table, right.value, right.unit);
      return new V(fromCanonical(table, canonical, this.unit), this.unit);
    };
    proto.sub = function (this: V, other: Input<U> | ValueInstance<U>) {
      const right = V.from(other);
      const canonical =
        toCanonical(table, this.value, this.unit) -
        toCanonical(table, right.value, right.unit);
      return new V(fromCanonical(table, canonical, this.unit), this.unit);
    };
    proto.scale = function (this: V, factor: number) {
      return new V(this.value * factor, this.unit);
    };
    proto.negate = function (this: V) {
      return new V(-this.value, this.unit);
    };
  }

  return V as unknown as ValueClass<U>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test ./packages/validate/src/class.test.ts`
Expected: PASS — all thirteen tests.

- [ ] **Step 5: Extend the barrel**

Add to `packages/validate/src/index.ts`:

```ts
export { createValueClass } from "./class";
export type { ValueClass, ValueInstance } from "./class";
```

- [ ] **Step 6: Run the full check**

Run: `bun test ./packages/validate && bun run typecheck && bun run lint`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/validate
git commit -m "feat(validate): add the immutable value class factory

One implementation for every kind, mirroring how core's createFacade
already works. Which methods exist is decided by the table: an affine
kind gets diff and no add, because 20C * 2 has no meaning, and an absent
method is a type error where a throwing one is only a bug report.

Instances are frozen in the constructor, not merely readonly -- a
readonly that exists only at compile time is a comment. Every method
returns a new instance and the test asserts identity inequality.

valueOf returns the canonical magnitude so < and > compare across units.
diff reads its difference back through the delta table's ratio, never
through this table's offsets, which would re-apply Fahrenheit's 32.

opts.delta is a thunk so temperature and tempdelta can name each other
from one module without a circular initialisation."
```

---

Remaining tasks (6 through 16) continue in this document. **Stop here and
check in** before implementing them — Task 6 measures the first real byte
budget, and that number decides whether the remaining eleven kinds roll out as
specified or the spec needs amending first.

## Task 6: `angle` — the seam proven on one kind

**Files:**
- Create: `packages/angle/src/units.ts`, `packages/angle/src/validate.ts`, `packages/angle/src/class.ts`
- Create: `packages/angle/src/units.test.ts`, `packages/angle/src/validate.test.ts`, `packages/angle/src/class.test.ts`
- Create: `packages/core/src/kind/from-table.ts`, `packages/core/src/kind/from-table.test.ts`
- Modify: `packages/angle/src/index.ts` (derive aliases from the table)
- Modify: `packages/angle/package.json` (subpaths, `@smartput/validate` dependency)
- Modify: `packages/core/src/index.ts` (export the two adapters)
- Modify: `scripts/check-deps.ts` (angle gains `@smartput/validate`)
- Modify: `scripts/check-size.ts` (`BUDGETS` gains three rows)

**Interfaces:**
- Consumes: Tasks 3–5's whole surface.
- Produces:
  - `ANGLE_UNITS: UnitTable<AngleUnit>`, `type AngleUnit = "rad" | "deg" | "grad" | "turn"` from `@smartput/angle/units`
  - `parseAngle`, `isAngle`, `addAngle`, `subAngle`, `scaleAngle`, `negateAngle`, `toAngle`, `asAngle`, `equalsAngle`, `compareAngle`, `formatAngle`, `patternForAngle` from `@smartput/angle/validate`
  - `Angle: ValueClass<AngleUnit>` from `@smartput/angle/class`
  - `decimalRatios<U>(t: UnitTable<U>): Record<U, Decimal>` and `aliasesFor<U>(t: UnitTable<U>, unit: U): string[]` from `@smartput/core`

- [ ] **Step 1: Write the failing core-adapter test**

Create `packages/core/src/kind/from-table.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { UnitTable } from "@smartput/validate";
import { aliasesFor, decimalRatios } from "./from-table";

const T: UnitTable<"rad" | "deg"> = {
  canonical: "rad",
  ratio: { rad: "1", deg: "0.0174532925199432957692369076848" },
  alias: { rad: "rad", radian: "rad", deg: "deg", degree: "deg", degrees: "deg" },
};

test("decimalRatios keeps every digit the string carried", () => {
  const ratios = decimalRatios(T);
  expect(ratios.rad.toString()).toBe("1");
  expect(ratios.deg.toString()).toBe("0.0174532925199432925199432925");
  // Not Number(): a double would round at the 17th digit.
  expect(ratios.deg.toFixed(28)).not.toContain("0.0174532925199432900000");
});

test("aliasesFor inverts the flat map, in declaration order", () => {
  expect(aliasesFor(T, "rad")).toEqual(["rad", "radian"]);
  expect(aliasesFor(T, "deg")).toEqual(["deg", "degree", "degrees"]);
});

test("a dynamic ratio has no Decimal form and is reported, not silently dropped", () => {
  const dynamic: UnitTable<"inch" | "px"> = {
    canonical: "inch",
    ratio: { inch: "1", px: (ctx) => 1 / (ctx.dpi ?? 96) },
    alias: { inch: "inch", px: "px" },
  };
  expect(() => decimalRatios(dynamic)).toThrow(/px/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./packages/core/src/kind/from-table.test.ts`
Expected: FAIL — `Cannot find module './from-table'`.

- [ ] **Step 3: Write the core adapters**

Create `packages/core/src/kind/from-table.ts`:

```ts
import type { UnitTable } from "@smartput/validate";
import { Decimal } from "../decimal";

/**
 * The engine-side view of a `UnitTable`. `units.ts` is the single source of a
 * kind's ratios and English aliases; this widens the decimal strings to
 * `Decimal` so the descriptor keeps every digit, and inverts the flat alias map
 * into the per-unit arrays a lexicon wants.
 *
 * A dynamic ratio has no constant form, so `decimalRatios` refuses it by name
 * rather than coercing a function to NaN. `measure` keeps declaring its own
 * `px` closure in the descriptor and spreads the rest of the table around it.
 */
export function decimalRatios<U extends string>(
  table: UnitTable<U>,
): Record<U, Decimal> {
  const out = {} as Record<U, Decimal>;
  for (const [unit, ratio] of Object.entries(table.ratio) as Array<
    [U, UnitTable<U>["ratio"][U]]
  >) {
    if (typeof ratio === "function") {
      throw new Error(
        `decimalRatios: unit "${unit}" has a dynamic ratio and no constant form. Declare it directly on the kind.`,
      );
    }
    out[unit] = new Decimal(ratio);
  }
  return out;
}

/** Every alias pointing at `unit`, in the table's declaration order. */
export function aliasesFor<U extends string>(table: UnitTable<U>, unit: U): string[] {
  return Object.entries(table.alias)
    .filter(([, target]) => target === unit)
    .map(([alias]) => alias);
}
```

- [ ] **Step 4: Export the adapters from core and add the dependency**

Add to `packages/core/src/index.ts`, in alphabetical position among the `kind/` exports:

```ts
// The engine-side view of a kind package's UnitTable: the micro path reads the
// same table, so English aliases and ratios have exactly one source.
export { aliasesFor, decimalRatios } from "./kind/from-table";
```

Modify `packages/core/package.json` to add the dependency:

```json
  "dependencies": {
    "decimal.js": "^10.6.0",
    "@smartput/validate": "workspace:*"
  },
```

Modify `scripts/check-deps.ts`:

```ts
  "packages/core/package.json": ["decimal.js", "@smartput/validate"],
```

Note in the `ALLOWED` map, above that line:

```ts
  // @smartput/validate is type-and-adapter only and itself has zero runtime
  // dependencies, so the standing "core ships one runtime dependency" target
  // is unchanged in substance. The dependency runs core -> validate; validate
  // must never import core.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test ./packages/core/src/kind/from-table.test.ts && bun run check-deps`
Expected: PASS.

- [ ] **Step 6: Write the failing angle units test**

Create `packages/angle/src/units.test.ts`:

```ts
import { expect, test } from "bun:test";
import { ANGLE_UNITS } from "./units";

test("every ratio is a decimal string, never a float literal", () => {
  for (const [unit, ratio] of Object.entries(ANGLE_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("pi-derived ratios carry 30 significant digits", () => {
  // The literal angle/index.ts guarded before this table existed. Losing these
  // digits is what makes "0.25 turn in deg" render 89.9999999999999 instead of
  // 90, and a float literal in this file would do exactly that.
  expect(ANGLE_UNITS.ratio.deg).toBe("0.0174532925199432957692369076848");
  expect(ANGLE_UNITS.ratio.turn).toBe("6.28318530717958647692528676656");
});

test("every alias maps to a real unit and every unit has an alias", () => {
  const units = new Set(Object.keys(ANGLE_UNITS.ratio));
  for (const [alias, unit] of Object.entries(ANGLE_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
  for (const unit of units) {
    expect(Object.values(ANGLE_UNITS.alias)).toContain(unit);
  }
});

test("the canonical unit has ratio 1", () => {
  expect(ANGLE_UNITS.ratio[ANGLE_UNITS.canonical]).toBe("1");
});
```

- [ ] **Step 7: Write the angle table**

Create `packages/angle/src/units.ts`:

```ts
import type { UnitTable } from "@smartput/validate";

export type AngleUnit = "rad" | "deg" | "grad" | "turn";

/**
 * The single source of angle's ratios and English aliases. The kind descriptor
 * widens these strings to `Decimal`; the micro path coerces them with
 * `Number()`. Neither owns them.
 *
 * Literals rather than a computed arctangent: decimal.js's trigonometric
 * precision depends on its own config and this value must not drift with it.
 * 30 significant digits, well past the configured 28.
 */
export const ANGLE_UNITS: UnitTable<AngleUnit> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    grad: "0.0157079632679489661923132169164",
    turn: "6.28318530717958647692528676656",
  },
  alias: {
    rad: "rad",
    radian: "rad",
    radians: "rad",
    deg: "deg",
    degree: "deg",
    degrees: "deg",
    grad: "grad",
    gradian: "grad",
    gradians: "grad",
    gon: "grad",
    turn: "turn",
    turns: "turn",
    rev: "turn",
    revolution: "turn",
    revolutions: "turn",
  },
};
```

- [ ] **Step 8: Rewire the descriptor to derive its aliases**

Rewrite `packages/angle/src/index.ts`:

```ts
import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { ANGLE_UNITS } from "./units";

export type { AngleUnit } from "./units";
export { ANGLE_UNITS } from "./units";

const alias = (unit: Parameters<typeof aliasesFor<"rad" | "deg" | "grad" | "turn">>[1]) =>
  aliasesFor(ANGLE_UNITS, unit);

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: ANGLE_UNITS.canonical,
    units: decimalRatios(ANGLE_UNITS),
  },
  // Aliases are derived, never restated: `units.ts` is the one place a new
  // alias is added, and it reaches both the engine and the micro path.
  // `symbol`, `display` and `typical` stay here — the micro path has no use
  // for any of them and should not carry their bytes.
  lexicon: {
    rad: {
      aliases: alias("rad"),
      symbol: "rad",
      display: { one: "radian", other: "radians" },
      // A full circle is 2pi, and nobody writes an angle in radians much past
      // one revolution.
      typical: [0.1, 7],
    },
    deg: {
      aliases: alias("deg"),
      symbol: "deg",
      display: { one: "degree", other: "degrees" },
      typical: [1, 360],
    },
    grad: {
      aliases: alias("grad"),
      symbol: "grad",
      display: { one: "gradian", other: "gradians" },
      typical: [1, 400],
    },
    turn: {
      aliases: alias("turn"),
      symbol: "turn",
      display: { one: "turn", other: "turns" },
      typical: [0.1, 10],
    },
  },
});
```

- [ ] **Step 9: Write the wrappers**

Create `packages/angle/src/validate.ts`:

```ts
import {
  add,
  as,
  compare,
  convert,
  equals,
  format,
  type Input,
  is,
  negate,
  type Ok,
  parse,
  type ParseOptions,
  patternFor,
  scale,
  sub,
} from "@smartput/validate";
import { ANGLE_UNITS, type AngleUnit } from "./units";

export type { AngleUnit } from "./units";
export { ANGLE_UNITS } from "./units";

type O = ParseOptions<AngleUnit>;
type I = Input<AngleUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseAngle = (input: string, opts?: O) => parse(ANGLE_UNITS, input, opts);
export const isAngle = (input: string, opts?: O) => is(ANGLE_UNITS, input, opts);
export const addAngle = (a: I, b: I, opts?: O) => add(ANGLE_UNITS, a, b, opts);
export const subAngle = (a: I, b: I, opts?: O) => sub(ANGLE_UNITS, a, b, opts);
export const scaleAngle = (a: I, factor: number, opts?: O) =>
  scale(ANGLE_UNITS, a, factor, opts);
export const negateAngle = (a: I, opts?: O) => negate(ANGLE_UNITS, a, opts);
export const toAngle = (a: I, to: AngleUnit, opts?: O) =>
  convert(ANGLE_UNITS, a, to, opts);
export const asAngle = (a: I, to: AngleUnit, opts?: O) => as(ANGLE_UNITS, a, to, opts);
export const equalsAngle = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(ANGLE_UNITS, a, b, epsilon, opts);
export const compareAngle = (a: I, b: I, opts?: O) => compare(ANGLE_UNITS, a, b, opts);
export const formatAngle = (a: Ok<AngleUnit>) => format(ANGLE_UNITS, a);
export const patternForAngle = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(ANGLE_UNITS, opts);
```

Create `packages/angle/src/class.ts`:

```ts
import { createValueClass } from "@smartput/validate";
import { ANGLE_UNITS } from "./units";

export type { AngleUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Angle = /*#__PURE__*/ createValueClass(ANGLE_UNITS, "angle");
```

- [ ] **Step 10: Add the subpaths and the dependency**

Modify `packages/angle/package.json`:

```json
{
  "name": "@smartput/angle",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "bun": "./src/index.ts",
      "default": "./dist/index.js"
    },
    "./units": {
      "types": "./dist/units.d.ts",
      "bun": "./src/units.ts",
      "default": "./dist/units.js"
    },
    "./validate": {
      "types": "./dist/validate.d.ts",
      "bun": "./src/validate.ts",
      "default": "./dist/validate.js"
    },
    "./class": {
      "types": "./dist/class.d.ts",
      "bun": "./src/class.ts",
      "default": "./dist/class.js"
    }
  },
  "dependencies": {
    "@smartput/core": "workspace:*",
    "@smartput/validate": "workspace:*"
  },
  "devDependencies": { "@smartput/kinds": "workspace:*" }
}
```

Modify `scripts/check-deps.ts`:

```ts
  "packages/angle/package.json": ["@smartput/core", "@smartput/validate"],
```

- [ ] **Step 11: Write the failing agreement tests**

Create `packages/angle/src/validate.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { angle } from "./index";
import { ANGLE_UNITS, type AngleUnit } from "./units";
import { addAngle, formatAngle, isAngle, parseAngle, toAngle } from "./validate";

const units = Object.keys(ANGLE_UNITS.ratio) as AngleUnit[];

test("the spec's headline example", () => {
  expect(isAngle("30deg")).toBe(true);
  expect(isAngle("30smth")).toBe(false);
});

test("ops work on raw strings", () => {
  expect(addAngle("30deg", "15deg")).toMatchObject({ ok: true, value: 45, unit: "deg" });
});

test("round-trip: parse(format(parse(s))) is parse(s), in strict mode", () => {
  for (const unit of units) {
    for (const n of ["1", "30.5", "-7", "0.25"]) {
      const first = parseAngle(`${n}${unit}`);
      expect(first.ok, `${n}${unit}`).toBe(true);
      if (!first.ok) continue;
      expect(parseAngle(formatAngle(first), { mode: "strict" })).toEqual(first);
    }
  }
});

test("conversion identity: every pair of units returns to the original", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toAngle(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toAngle({ ok: true, value: there, unit: to, raw: String(there) }, from);
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement: the micro path matches the engine's canonical value", () => {
  const engine = createEngine({ locales: [en], kinds: [angle] });
  for (const unit of units) {
    for (const n of ["1", "30.5", "0.25"]) {
      const parsed = parseAngle(`${n}${unit}`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const micro = toAngle(parsed, ANGLE_UNITS.canonical);
      const engineValue = engine.evaluate(`${n} ${unit}`).value.canonical.toNumber();
      expect(micro, `${n}${unit}`).toBeCloseTo(engineValue, 9);
    }
  }
});

test("contract: units.ts and the descriptor agree on every key and alias", () => {
  const declared = Object.keys((angle.value as { units: object }).units).sort();
  expect(declared).toEqual(Object.keys(ANGLE_UNITS.ratio).sort());

  const lexicon = angle.lexicon ?? {};
  for (const [unit, lexeme] of Object.entries(lexicon)) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) {
      expect(ANGLE_UNITS.alias[a], `${a} must be in units.ts`).toBe(unit);
    }
  }
});
```

Create `packages/angle/src/class.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Angle } from "./class";

test("the spec's worked example", () => {
  const a = Angle.parse("30deg");
  const b = a.add?.(new Angle(30, "deg"));
  expect(a.toString()).toBe("30deg");
  expect(b?.toString()).toBe("60deg");
  expect(b?.to("rad")).toBeCloseTo(Math.PI / 3, 12);
});

test("instances are immutable", () => {
  const a = Angle.parse("30deg");
  expect(Object.isFrozen(a)).toBe(true);
  a.add?.("15deg");
  expect(a.value).toBe(30);
});

test("comparison operators work through valueOf", () => {
  expect(Angle.parse("30deg") < Angle.parse("1turn")).toBe(true);
});
```

- [ ] **Step 12: Run tests**

Run: `bun test ./packages/angle ./packages/core/src/kind/from-table.test.ts && bun run typecheck && bun run check-deps`
Expected: all PASS. The pre-existing `packages/angle/src/index.test.ts` must
still pass unchanged — the descriptor's behaviour is identical, only its alias
arrays are now derived.

- [ ] **Step 13: Measure the budgets and commit the numbers**

Run: `bun run build`

Then add three rows to `BUDGETS` in `scripts/check-size.ts` with
`Number.POSITIVE_INFINITY` placeholders, run `bun run check-size`, and replace
the placeholders with the **measured** values rounded up to the next 50 bytes:

```ts
export const BUDGETS: EntrySpec[] = [
  {
    label: "angle/validate parseAngle only",
    from: "@smartput/angle/validate",
    names: ["parseAngle"],
    min: 600,
    gzip: 350,
  },
  {
    label: "angle/validate parse + add + to",
    from: "@smartput/angle/validate",
    names: ["parseAngle", "addAngle", "toAngle"],
    min: 900,
    gzip: 500,
  },
  {
    label: "angle/class",
    from: "@smartput/angle/class",
    names: ["Angle"],
    min: 1400,
    gzip: 700,
  },
];
```

If a measured value **exceeds** the spec's budget above, stop and amend
`docs/superpowers/specs/2026-08-05-smartputs-validate-design.md` §13 with the
measured number and the reason, per the spec's own amendment rule. Do not raise
a budget silently.

- [ ] **Step 14: Run the full check**

Run: `bun run check`
Expected: every stage PASSes, including `check-size` with three OK rows.

- [ ] **Step 15: Commit**

```bash
git add packages/angle packages/core/src/kind packages/core/src/index.ts packages/core/package.json scripts/check-deps.ts scripts/check-size.ts
git commit -m "feat(angle): add units, validate and class subpaths

units.ts becomes the single source of angle's ratios and English
aliases. The descriptor widens the decimal strings to Decimal and
derives its lexicon aliases from the same map, so a new alias is added
in one place and reaches both paths. symbol, display and typical stay on
the descriptor -- the micro path has no use for them and should not
carry their bytes.

Ratios are strings because the descriptor guarded a 30-digit pi against
float drift and a shared table cannot be floats without breaking that.
decimalRatios refuses a dynamic ratio by name rather than coercing a
function to NaN.

Four test classes land with it: round-trip through strict mode,
conversion identity over every unit pair, cross-path agreement against
the engine's canonical value, and a contract test that fails if the
table and the descriptor drift. The third is the one that would catch a
transposed ratio in either path.

Budgets for all three entries are measured and committed to
check-size.ts."
```

---

## Task 7: Plain ratio kinds — `length`, `mass`, `duration`

**Files:**
- Create: `packages/{length,mass,duration}/src/units.ts`, `validate.ts`, `class.ts`
- Create: `packages/{length,mass,duration}/src/validate.test.ts`
- Modify: `packages/{length,mass,duration}/src/index.ts`, `package.json`
- Modify: `scripts/check-deps.ts`, `scripts/check-size.ts`

**Interfaces:**
- Consumes: Task 6's pattern exactly — `aliasesFor`, `decimalRatios`, the wrapper shape, the four test classes.
- Produces: `LENGTH_UNITS`/`LengthUnit`/`parseLength`/`Length`, `MASS_UNITS`/`MassUnit`/`parseMass`/`Mass`, `DURATION_UNITS`/`DurationUnit`/`parseDuration`/`Duration`, each on `./units`, `./validate`, `./class`.

- [ ] **Step 1: Write the three tables**

Create `packages/length/src/units.ts`:

```ts
import type { UnitTable } from "@smartput/validate";

export type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd" | "mi";

export const LENGTH_UNITS: UnitTable<LengthUnit> = {
  canonical: "m",
  ratio: {
    mm: "0.001",
    cm: "0.01",
    m: "1",
    km: "1000",
    in: "0.0254",
    ft: "0.3048",
    yd: "0.9144",
    mi: "1609.344",
  },
  alias: {
    mm: "mm",
    millimetre: "mm",
    millimetres: "mm",
    millimeter: "mm",
    millimeters: "mm",
    cm: "cm",
    centimetre: "cm",
    centimetres: "cm",
    centimeter: "cm",
    centimeters: "cm",
    m: "m",
    metre: "m",
    metres: "m",
    meter: "m",
    meters: "m",
    km: "km",
    kilometre: "km",
    kilometres: "km",
    kilometer: "km",
    kilometers: "km",
    in: "in",
    inch: "in",
    inches: "in",
    ft: "ft",
    foot: "ft",
    feet: "ft",
    yd: "yd",
    yard: "yd",
    yards: "yd",
    mi: "mi",
    mile: "mi",
    miles: "mi",
  },
};
```

Create `packages/mass/src/units.ts`:

```ts
import type { UnitTable } from "@smartput/validate";

export type MassUnit = "mg" | "g" | "kg" | "t" | "oz" | "lb";

export const MASS_UNITS: UnitTable<MassUnit> = {
  canonical: "g",
  ratio: {
    mg: "0.001",
    g: "1",
    kg: "1000",
    t: "1000000",
    oz: "28.349523125",
    lb: "453.59237",
  },
  alias: {
    mg: "mg",
    milligram: "mg",
    milligrams: "mg",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    kilogram: "kg",
    kilograms: "kg",
    t: "t",
    tonne: "t",
    tonnes: "t",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
  },
};
```

Create `packages/duration/src/units.ts`:

```ts
import type { UnitTable } from "@smartput/validate";

export type DurationUnit = "ms" | "s" | "min" | "h" | "d" | "wk";

export const DURATION_UNITS: UnitTable<DurationUnit> = {
  canonical: "s",
  ratio: {
    ms: "0.001",
    s: "1",
    min: "60",
    h: "3600",
    d: "86400",
    wk: "604800",
  },
  // "m" means minutes here and metres in `length`. In the engine that is a
  // genuine ambiguity the solver ranks; in the micro path parseDuration and
  // parseLength are two functions that were called deliberately, so neither is
  // ambiguous.
  alias: {
    ms: "ms",
    millisecond: "ms",
    milliseconds: "ms",
    s: "s",
    sec: "s",
    secs: "s",
    second: "s",
    seconds: "s",
    min: "min",
    mins: "min",
    m: "min",
    minute: "min",
    minutes: "min",
    h: "h",
    hr: "h",
    hrs: "h",
    hour: "h",
    hours: "h",
    d: "d",
    day: "d",
    days: "d",
    wk: "wk",
    wks: "wk",
    week: "wk",
    weeks: "wk",
  },
};
```

- [ ] **Step 2: Write the wrappers and classes**

For each of the three, create `validate.ts` following Task 6 Step 9's shape
exactly, substituting the table, unit type and name. `packages/mass/src/validate.ts`:

```ts
import {
  add,
  as,
  compare,
  convert,
  equals,
  format,
  type Input,
  is,
  negate,
  type Ok,
  parse,
  type ParseOptions,
  patternFor,
  scale,
  sub,
} from "@smartput/validate";
import { MASS_UNITS, type MassUnit } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

type O = ParseOptions<MassUnit>;
type I = Input<MassUnit>;

export const parseMass = (input: string, opts?: O) => parse(MASS_UNITS, input, opts);
export const isMass = (input: string, opts?: O) => is(MASS_UNITS, input, opts);
export const addMass = (a: I, b: I, opts?: O) => add(MASS_UNITS, a, b, opts);
export const subMass = (a: I, b: I, opts?: O) => sub(MASS_UNITS, a, b, opts);
export const scaleMass = (a: I, factor: number, opts?: O) =>
  scale(MASS_UNITS, a, factor, opts);
export const negateMass = (a: I, opts?: O) => negate(MASS_UNITS, a, opts);
export const toMass = (a: I, to: MassUnit, opts?: O) => convert(MASS_UNITS, a, to, opts);
export const asMass = (a: I, to: MassUnit, opts?: O) => as(MASS_UNITS, a, to, opts);
export const equalsMass = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(MASS_UNITS, a, b, epsilon, opts);
export const compareMass = (a: I, b: I, opts?: O) => compare(MASS_UNITS, a, b, opts);
export const formatMass = (a: Ok<MassUnit>) => format(MASS_UNITS, a);
export const patternForMass = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(MASS_UNITS, opts);
```

Repeat for `length` (`LENGTH_UNITS`, `LengthUnit`, `parseLength`, `isLength`,
`addLength`, `subLength`, `scaleLength`, `negateLength`, `toLength`, `asLength`,
`equalsLength`, `compareLength`, `formatLength`, `patternForLength`) and
`duration` (`DURATION_UNITS`, `DurationUnit`, `parseDuration`, `isDuration`,
`addDuration`, `subDuration`, `scaleDuration`, `negateDuration`, `toDuration`,
`asDuration`, `equalsDuration`, `compareDuration`, `formatDuration`,
`patternForDuration`).

Create each `class.ts`:

```ts
// packages/mass/src/class.ts
import { createValueClass } from "@smartput/validate";
import { MASS_UNITS } from "./units";

export type { MassUnit } from "./units";

export const Mass = /*#__PURE__*/ createValueClass(MASS_UNITS, "mass");
```

```ts
// packages/length/src/class.ts
import { createValueClass } from "@smartput/validate";
import { LENGTH_UNITS } from "./units";

export type { LengthUnit } from "./units";

export const Length = /*#__PURE__*/ createValueClass(LENGTH_UNITS, "length");
```

```ts
// packages/duration/src/class.ts
import { createValueClass } from "@smartput/validate";
import { DURATION_UNITS } from "./units";

export type { DurationUnit } from "./units";

export const Duration = /*#__PURE__*/ createValueClass(DURATION_UNITS, "duration");
```

- [ ] **Step 3: Rewire the three descriptors**

For each, replace the inline `units` and the `aliases` arrays with derivations,
keeping `symbol`, `display` and `typical` verbatim. `packages/mass/src/index.ts`:

```ts
import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: MASS_UNITS.canonical,
    units: decimalRatios(MASS_UNITS),
  },
  lexicon: {
    mg: {
      aliases: alias("mg"),
      symbol: "mg",
      display: { one: "milligram", other: "milligrams" },
      typical: [1, 2000],
    },
    g: {
      aliases: alias("g"),
      symbol: "g",
      display: { one: "gram", other: "grams" },
      typical: [1, 1000],
    },
    kg: {
      aliases: alias("kg"),
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
      typical: [0.1, 500],
    },
    t: {
      aliases: alias("t"),
      symbol: "t",
      display: { one: "tonne", other: "tonnes" },
      typical: [0.1, 200],
    },
    oz: {
      aliases: alias("oz"),
      symbol: "oz",
      display: { one: "ounce", other: "ounces" },
      typical: [0.5, 100],
    },
    lb: {
      aliases: alias("lb"),
      symbol: "lb",
      display: { one: "pound", other: "pounds" },
      typical: [0.5, 500],
    },
  },
});
```

Apply the same transformation to `packages/length/src/index.ts` (units `mm`,
`cm`, `m`, `km`, `in`, `ft`, `yd`, `mi`, keeping each existing `symbol`,
`display` and `typical`) and `packages/duration/src/index.ts` (units `ms`, `s`,
`min`, `h`, `d`, `wk`, likewise).

- [ ] **Step 4: Write the shared agreement test, per kind**

Create `packages/mass/src/validate.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { mass } from "./index";
import { MASS_UNITS, type MassUnit } from "./units";
import { addMass, formatMass, parseMass, toMass } from "./validate";

const units = Object.keys(MASS_UNITS.ratio) as MassUnit[];

test("valid and invalid input", () => {
  expect(parseMass("1.5kg")).toMatchObject({ ok: true, value: 1.5, unit: "kg" });
  expect(parseMass("3 pounds")).toMatchObject({ ok: true, value: 3, unit: "lb" });
  expect(parseMass("1.5kilos")).toMatchObject({ ok: true, unit: "kg" });
  expect(parseMass("1.5smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(parseMass("kg")).toMatchObject({ ok: false, code: "nan" });
});

test("the left operand's unit wins", () => {
  const sum = addMass("1kg", "500g");
  expect(sum).toMatchObject({ ok: true, unit: "kg" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);
});

test("round-trip through strict mode", () => {
  for (const unit of units) {
    const first = parseMass(`7.25${unit}`);
    expect(first.ok, unit).toBe(true);
    if (!first.ok) continue;
    expect(parseMass(formatMass(first), { mode: "strict" })).toEqual(first);
  }
});

test("conversion identity over every unit pair", () => {
  for (const from of units) {
    for (const to of units) {
      const there = toMass(`7${from}`, to);
      expect(there, `${from}->${to}`).toBeDefined();
      if (there === undefined) continue;
      const back = toMass({ ok: true, value: there, unit: to, raw: String(there) }, from);
      expect(back, `${from}->${to}->${from}`).toBeCloseTo(7, 9);
    }
  }
});

test("cross-path agreement with the engine", () => {
  const engine = createEngine({ locales: [en], kinds: [mass] });
  for (const unit of units) {
    const parsed = parseMass(`7${unit}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;
    expect(toMass(parsed, MASS_UNITS.canonical), unit).toBeCloseTo(
      engine.evaluate(`7 ${unit}`).value.canonical.toNumber(),
      9,
    );
  }
});

test("contract: the table and the descriptor agree", () => {
  expect(Object.keys((mass.value as { units: object }).units).sort()).toEqual(
    Object.keys(MASS_UNITS.ratio).sort(),
  );
  for (const [unit, lexeme] of Object.entries(mass.lexicon ?? {})) {
    const aliases = Array.isArray(lexeme) ? lexeme : lexeme.aliases;
    for (const a of aliases) expect(MASS_UNITS.alias[a], a).toBe(unit);
  }
});
```

Create the same file for `length` (substituting `LENGTH_UNITS`, `parseLength`,
`toLength`, `formatLength`, `addLength`, `length`, and using `"2ft"` /
`"3 inches"` / `"2metres"` as the valid samples and `addLength("1km", "500m")`
for the unit-inheritance test) and for `duration` (substituting
`DURATION_UNITS`, `parseDuration`, `toDuration`, `formatDuration`,
`addDuration`, `duration`, samples `"90min"` / `"2 hours"` / `"30 m"`, and
`addDuration("1h", "30min")`).

- [ ] **Step 5: Add subpaths, dependencies and budget rows**

For each of the three `package.json` files, apply Task 6 Step 10's exports shape
and add `"@smartput/validate": "workspace:*"` to `dependencies`.

Modify `scripts/check-deps.ts`:

```ts
  "packages/duration/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/length/package.json": ["@smartput/core", "@smartput/validate"],
  "packages/mass/package.json": ["@smartput/core", "@smartput/validate"],
```

Add to `BUDGETS` in `scripts/check-size.ts`, with values measured as in Task 6
Step 13:

```ts
  {
    label: "length/validate parseLength only",
    from: "@smartput/length/validate",
    names: ["parseLength"],
    min: 800,
    gzip: 450,
  },
  {
    label: "mass/validate parseMass only",
    from: "@smartput/mass/validate",
    names: ["parseMass"],
    min: 700,
    gzip: 400,
  },
  {
    label: "duration/validate parseDuration only",
    from: "@smartput/duration/validate",
    names: ["parseDuration"],
    min: 700,
    gzip: 400,
  },
```

- [ ] **Step 6: Run the full check**

Run: `bun run check`
Expected: every stage PASSes. The pre-existing suites for these three kinds must
pass unchanged; `packages/core/src/corpus.test.ts` in particular exercises
`length`, `mass` and `duration` heavily and is the real proof the alias
derivation is faithful.

- [ ] **Step 7: Commit**

```bash
git add packages/length packages/mass packages/duration scripts/check-deps.ts scripts/check-size.ts
git commit -m "feat(length,mass,duration): add units, validate and class subpaths

Same four test classes as angle: strict round-trip, conversion identity
over every unit pair, cross-path agreement against the engine, and a
contract test that fails on table/descriptor drift.

duration's alias map claims 'm' for minutes while length's claims it for
metres. In the engine that is a real ambiguity the solver ranks; here
parseDuration and parseLength are two functions someone called
deliberately, so neither is ambiguous -- one of the few places where
having less machinery gives a better answer.

The corpus suite is the real proof the alias derivation is faithful: it
exercises these three kinds far harder than any new test does."
```

---

Tasks 8 through 16 remain: `datasize`/`speed`/`area`/`volume` (Task 8),
`number`/`percent` (Task 9), `measure` with its dynamic `px` (Task 10),
`temperature`/`tempdelta` with the affine pairing (Task 11), the
`@smartput/kinds` barrels plus the repo-wide contract test (Task 12),
`@smartput/input` DOM (Task 13), React (Task 14), Vue (Task 15), and the six doc
pages (Task 16).

They follow Task 7's shape exactly, with these differences to carry over:

| Task | Difference from Task 7 |
| --- | --- |
| 8 | `area`, `speed`, `volume` keep their `ops` blocks verbatim; their `m²`/`m³`/`m/s` symbol aliases go in `units.ts` so the symbol forms round-trip. |
| 9 | `number` has one unit `one` with no aliases — its wrapper hardcodes `defaultUnit: "one"`, so `missing-unit` is unreachable and a bare `"30"` parses in both modes. `percent` has one unit `%` with ratio `0.01`. |
| 10 | `measure`'s `px` stays a closure in the descriptor, spread around `decimalRatios` of the other five units; `units.ts` declares it as `(ctx) => 1 / (ctx.dpi ?? 96)`. |
| 11 | `temperature` gets `offset`, no `add`/`scale`, and `createValueClass(TEMP_UNITS, "temperature", { delta: () => TempDelta })`; both classes live in one `class.ts`. |
| 12 | `@smartput/kinds/validate` and `/class` barrels; a repo-wide surface test asserting every ratio-kind package exports all three subpaths; `check-deps` extended to enforce it. |

**Stop after Task 7 and check in** — the budget numbers measured in Tasks 6 and
7 determine whether Tasks 8–12 proceed as written.

## Self-Review

**Spec coverage.** §3 layout → Tasks 3–12. §4 data layer → Task 6 Steps 6–8.
§5 parser and the strict/loose table → Task 3. §6 ops → Task 4. §7.1–7.5 per-kind
specifics → Tasks 9, 10, 11 and the Task 8 note. §8 classes → Tasks 5, 6, 11.
§9 fuzzy seam → Task 3's `resolve` option and its test. §10 input adapters →
Tasks 13–15. §11 the two class families → Task 6's cross-path test; the
`QuantitySnapshot` widening it needs is a Task 12 step. §12 testing → the four
test classes in Tasks 6 and 7, the immutability suite in Task 5. §13 build and
budgets → Tasks 1, 2, 6, 7. §14 docs → Task 16.

**Gap found and closed:** the spec's §11 requires widening
`QuantitySnapshot.value` from `string` to `string | number` so
`Quantity.from(angleInstance)` type-checks. That is now an explicit Task 12
step rather than being implied by Task 6's cross-path test.

**Placeholder scan.** No "TBD" or "add error handling". Tasks 8–12 are
summarised rather than expanded, and that is flagged as an explicit check-in
gate driven by real measurements — not a deferral of content. Expand them after
Task 7's numbers land.

**Type consistency.** `Ok`/`Err`/`Parsed`/`UnitTable`/`ParseOptions`/`Ctx`/`Input`
defined in Task 3 and used unchanged in Tasks 4–7. `canonicalOf` is introduced in
Task 4 Step 3 and consumed in Task 4 Step 6 and Task 5. `createValueClass`'s
third parameter is `{ delta?: () => ValueClass<U> }` in Task 5 and used with that
exact shape in the Task 11 note. Wrapper names follow one scheme —
`parseX`/`isX`/`addX`/`subX`/`scaleX`/`negateX`/`toX`/`asX`/`equalsX`/`compareX`/`formatX`/`patternForX`
— and Task 6 and Task 7 both spell out the full list.
