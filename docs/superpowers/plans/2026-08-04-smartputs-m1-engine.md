# smartputs M1 — Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@smartput/core` — the tokenizer, parser, scored solver and evaluator — so that `evaluate("10 m + 5 min")` returns `15 min`, `evaluate("10 m")` throws `AmbiguityError`, and a weight override can flip either outcome.

**Architecture:** Input flows through seven stages: normalize → lex → analyze → candidates → parse → solve → evaluate → format. Ambiguity is preserved as candidate *sets* on AST nodes until the solver enumerates consistent assignments, scores each by summed weights plus a context bonus, and picks the argmax. Type checking is a lookup in an `OpSignature` table, not a hardcoded switch — which is what lets later milestones add datetime and money as ordinary plugins.

**Tech Stack:** TypeScript (strict), Bun (runtime, test runner, package manager, workspaces), Biome (format + lint), `decimal.js` (the only runtime dependency).

**Spec:** `docs/superpowers/specs/2026-08-04-smartputs-design.md`. Read §3 (pipeline), §4 (extension contract), §4.5 (weights), §4.6 (localization) before starting.

## Global Constraints

Every task's requirements implicitly include this section.

- **`@smartput/core` has exactly one runtime dependency: `decimal.js`.** CI fails on a second. Enforced by a script written in Task 1.
- **ESM only.** No CJS build, no `require`.
- **TypeScript `strict: true`**, plus `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`.
- **Biome** for format and lint, one `biome.json` at the repo root, `noExplicitAny` enabled.
- **`tsc --emitDeclarationOnly`** for `.d.ts`. Bun handles all bundling and test running.
- **Decimal precision is 28 significant digits.** Never use JavaScript floats for a value that reaches a user.
- **Immutability.** Every descriptor and every `Value` is `Object.freeze`d. Every operation returns a new object.
- **No network in tests, ever.** No wall clock either — anything time-dependent takes an injected `now`.
- **Determinism.** Identical input plus identical options always produce identical ranking. Never iterate a `Map` or `Object` where output order affects results without an explicit sort.
- **Test files are colocated**: `src/foo.ts` is tested by `src/foo.test.ts`. Run with `bun test`.
- **Conventional Commits.** Commit at the end of every task, never mid-task.

### Clarification carried into this plan

Spec §3 lists `hintBonus` as an additive scoring term while §6 defines `EvalOptions.kinds` as a hard filter. Implement it as **a hard filter only** — candidates whose kind is outside `opts.kinds` are dropped before solving. A hard filter strictly dominates an additive bonus for this purpose, and `coerce()` needs the guarantee, not a preference. No `hintBonus` term exists in the code.

---

## File Structure

All paths relative to `packages/core/`.

| File | Responsibility |
| --- | --- |
| `src/types.ts` | Every shared type. No logic, no imports except `decimal.js` types. |
| `src/errors.ts` | The `SmartputError` hierarchy. |
| `src/decimal.ts` | The configured `Decimal` constructor, re-exported. Single source of precision config. |
| `src/freeze.ts` | `deepFreeze` — recursive freeze used by every `define*` function. |
| `src/kind/define.ts` | `defineKind`, and normalization of authoring shorthands into a `NormalizedKind`. |
| `src/kind/registry.ts` | `buildRegistry` — merges kinds and packs, generates ratio ops, builds the alias index. |
| `src/kind/ratio-ops.ts` | Generates the `+ - * / in` signatures every ratio kind gets for free. |
| `src/locale/define.ts` | `defineLocale`, `defineLocalePack`. |
| `src/locale/analyze.ts` | The analyzer chain runner and its memo cache. |
| `src/locale/helpers.ts` | `identity`, `suffixStripper`, `tableAnalyzer`. |
| `src/locale/number.ts` | Locale-aware number parsing, driven by `Intl.NumberFormat`. |
| `src/parse/normalize.ts` | NFKC, case folding, dash and degree-sign unification. |
| `src/parse/lex.ts` | String → `Token[]`. |
| `src/parse/candidates.ts` | `Token` → `Candidate[]`, via analyzers, the alias index and weights. |
| `src/parse/ast.ts` | AST node types. |
| `src/parse/pratt.ts` | `Token[]` → `Node`. |
| `src/solve/weights.ts` | Selector matching and layer summing. |
| `src/solve/solver.ts` | Assignment enumeration, type checking, scoring, softmax, tiebreak. |
| `src/eval/convert.ts` | Unit conversion, including affine offsets and context-dependent ratios. |
| `src/eval/evaluate.ts` | AST + assignment → `Value`. |
| `src/format/format.ts` | `Value` → string, using `Intl.PluralRules`. |
| `src/engine.ts` | `createEngine`: `evaluate`, `suggest`, `coerce`, `explain`. |
| `src/kinds/{number,length,mass,duration}.ts` | The four M1 built-in kinds. |
| `src/locale/en.ts` | The English locale (exported as `@smartput/core/locale/en`). |
| `src/index.ts` | Public exports. |
| `corpus/en.tsv` | The golden corpus. |

---

## Task 1: Workspace scaffold

**Files:**
- Create: `package.json`, `biome.json`, `tsconfig.base.json`, `.gitignore` (exists — verify)
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/decimal.ts`, `packages/core/src/decimal.test.ts`
- Create: `scripts/check-deps.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `import { Decimal } from "../decimal"` — the configured constructor used by every later task. `bun test` and `bun run check` as the project's verification commands.

- [ ] **Step 1: Write the failing test**

`packages/core/src/decimal.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "./decimal";

test("Decimal is configured to 28 significant digits", () => {
  expect(Decimal.precision).toBe(28);
});

test("Decimal does not lose precision where float would", () => {
  expect(new Decimal("0.1").plus("0.2").toString()).toBe("0.3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/decimal.test.ts`
Expected: FAIL — `Cannot find module './decimal'`.

- [ ] **Step 3: Create the workspace files**

`package.json` (repo root):

```json
{
  "name": "smartputs-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc -p packages/core/tsconfig.json --noEmit",
    "check-deps": "bun run scripts/check-deps.ts",
    "check": "bun run lint && bun run typecheck && bun run check-deps && bun test"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "typescript": "^5.7.0"
  }
}
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 90 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" }
    }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "skipLibCheck": true
  }
}
```

`packages/core/package.json`:

```json
{
  "name": "@smartput/core",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./locale/en": "./src/locale/en.ts",
    "./testing": "./src/testing/index.ts"
  },
  "dependencies": {
    "decimal.js": "^10.6.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

`packages/core/src/decimal.ts`:

```ts
import DecimalJs from "decimal.js";

DecimalJs.set({ precision: 28, toExpNeg: -21, toExpPos: 40 });

export const Decimal = DecimalJs;
export type Decimal = DecimalJs;
```

`scripts/check-deps.ts`:

```ts
const pkg = await Bun.file("packages/core/package.json").json();
const deps = Object.keys(pkg.dependencies ?? {});
const allowed = ["decimal.js"];
const extra = deps.filter((d) => !allowed.includes(d));

if (extra.length > 0) {
  console.error(
    `@smartput/core must have exactly one runtime dependency (decimal.js). Found extra: ${extra.join(", ")}`,
  );
  process.exit(1);
}
console.log(`@smartput/core dependencies OK: ${deps.join(", ")}`);
```

- [ ] **Step 4: Install and run tests**

Run: `bun install && bun test packages/core/src/decimal.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the dependency guard actually fails**

Run: `bun run check-deps`
Expected: prints `@smartput/core dependencies OK: decimal.js`, exit 0.

Then temporarily add `"lodash": "^4.0.0"` to `packages/core/package.json` dependencies and run `bun run check-deps` again.
Expected: FAIL with `Found extra: lodash`, exit 1. **Remove `lodash` again before committing.**

- [ ] **Step 6: Commit**

```bash
git add package.json biome.json tsconfig.base.json packages scripts
git commit -m "chore: scaffold bun workspace with biome, tsconfig and dependency guard"
```

---

## Task 2: Core types and errors

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`

**Interfaces:**
- Consumes: `Decimal` from Task 1.
- Produces: every shared type used by all later tasks (`KindId`, `Value`, `Candidate`, `Kind`, `RatioSpec`, `OpaqueSpec`, `OpSignature`, `UnitDef`, `UnitLexeme`, `Lexicon`, `Locale`, `LocalePack`, `Analyzer`, `AnalyzedForm`, `Weights`, `Span`, `EvalCtx`, `FormatCtx`), and the error classes `SmartputError`, `UnitParseError`, `AmbiguityError`, `NoCandidateError`, `DimensionMismatchError`, `TooAmbiguousError`, `KindConflictError`, `UnknownKindError`, `DivideByZeroError`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/errors.test.ts`:

```ts
import { expect, test } from "bun:test";
import { AmbiguityError, NoCandidateError, SmartputError } from "./errors";

test("errors carry the input and are instanceof SmartputError", () => {
  const err = new NoCandidateError("10 zz", "zz", ["oz"]);
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.input).toBe("10 zz");
  expect(err.token).toBe("zz");
  expect(err.nearest).toEqual(["oz"]);
  expect(err.name).toBe("NoCandidateError");
});

test("AmbiguityError lists its candidates", () => {
  const err = new AmbiguityError("10 m", [
    { kind: "length", unit: "m", confidence: 0.55 },
    { kind: "duration", unit: "min", confidence: 0.45 },
  ]);
  expect(err.candidates).toHaveLength(2);
  expect(err.message).toContain("length");
  expect(err.message).toContain("duration");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/errors.test.ts`
Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 3: Write types.ts**

`packages/core/src/types.ts`:

```ts
import type { Decimal } from "./decimal";

export type KindId = string;
export type OpSymbol = "+" | "-" | "*" | "/" | "in";
export type Keyword = "in" | "to" | "as" | "plus" | "minus" | "of";

export interface Span {
  start: number;
  end: number;
}

export interface Value {
  readonly kind: KindId;
  readonly canonical: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface Candidate {
  readonly kind: KindId;
  readonly unit: string;
  readonly weight: number;
  readonly surface: string;
  readonly form: string;
}

export interface AnalyzedForm {
  form: string;
  weight?: number;
  tags?: string[];
}

export interface AnalyzeCtx {
  locale: string;
}

export type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];

export type Selector = string;
export type Weights = Record<Selector, number>;

export interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
}

export type Lexicon = Record<string, UnitLexeme | string[]>;

export interface EvalCtx {
  readonly self: Value;
  readonly locale: string;
}

export interface FormatCtx {
  readonly locale: string;
}

export interface UnitDef {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;
  aliases?: string[];
}

export interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number>;
  affine?: { deltaKind: KindId };
}

export interface OpaqueSpec {
  mode: "opaque";
  parse: (token: string, ctx: EvalCtx) => unknown | null;
  equals: (a: unknown, b: unknown) => boolean;
}

export interface OpSignature {
  op: OpSymbol;
  left: KindId;
  right: KindId;
  result: KindId;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}

export interface Kind {
  id: KindId;
  value: RatioSpec | OpaqueSpec;
  extendsKind?: KindId;
  prior?: number;
  lexicon?: Lexicon;
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

export interface NumberFormatSpec {
  group: string;
  decimal: string;
}

export interface Locale {
  id: string;
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];
  analyze?: Analyzer[];
  numerals?: (word: string) => Decimal | null;
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}

export interface LocalePack {
  locale: string;
  contributes: Record<KindId, Lexicon>;
  analyze?: Analyzer[];
}

export interface ResultCandidate {
  kind: KindId;
  unit: string;
  confidence: number;
}
```

- [ ] **Step 4: Write errors.ts**

`packages/core/src/errors.ts`:

```ts
import type { KindId, ResultCandidate, Span } from "./types";

export class SmartputError extends Error {
  readonly input: string;
  readonly spans: Span[];

  constructor(message: string, input: string, spans: Span[] = []) {
    super(message);
    this.name = new.target.name;
    this.input = input;
    this.spans = spans;
  }
}

export class UnitParseError extends SmartputError {
  readonly kind: KindId | undefined;
  constructor(input: string, kind?: KindId) {
    super(`Cannot parse ${JSON.stringify(input)} as a quantity`, input);
    this.kind = kind;
  }
}

export class AmbiguityError extends SmartputError {
  readonly candidates: ResultCandidate[];
  constructor(input: string, candidates: ResultCandidate[], spans: Span[] = []) {
    const list = candidates.map((c) => `${c.kind}:${c.unit}`).join(", ");
    super(`${JSON.stringify(input)} is ambiguous between ${list}`, input, spans);
    this.candidates = candidates;
  }
}

export class NoCandidateError extends SmartputError {
  readonly token: string;
  readonly nearest: string[];
  constructor(input: string, token: string, nearest: string[], spans: Span[] = []) {
    const hint = nearest.length > 0 ? `. Did you mean: ${nearest.join(", ")}?` : "";
    super(`Unknown unit ${JSON.stringify(token)}${hint}`, input, spans);
    this.token = token;
    this.nearest = nearest;
  }
}

export class DimensionMismatchError extends SmartputError {
  readonly left: KindId;
  readonly right: KindId;
  readonly op: string;
  constructor(input: string, op: string, left: KindId, right: KindId) {
    super(`Cannot apply ${op} to ${left} and ${right}`, input);
    this.left = left;
    this.right = right;
    this.op = op;
  }
}

export class TooAmbiguousError extends SmartputError {
  readonly count: number;
  constructor(input: string, count: number, max: number) {
    super(`Too many interpretations (${count} > ${max})`, input);
    this.count = count;
  }
}

export class KindConflictError extends Error {
  constructor(id: string, detail: string) {
    super(`Kind ${JSON.stringify(id)} conflicts: ${detail}`);
    this.name = "KindConflictError";
  }
}

export class UnknownKindError extends Error {
  readonly pack: string;
  readonly kind: KindId;
  constructor(pack: string, kind: KindId) {
    super(`Locale pack ${JSON.stringify(pack)} contributes to unregistered kind ${JSON.stringify(kind)}`);
    this.name = "UnknownKindError";
    this.pack = pack;
    this.kind = kind;
  }
}

export class DivideByZeroError extends SmartputError {
  constructor(input: string) {
    super("Division by zero", input);
  }
}
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/core/src/errors.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/errors.ts packages/core/src/errors.test.ts
git commit -m "feat(core): add shared types and error hierarchy"
```

---

## Task 3: defineKind and kind normalization

**Files:**
- Create: `packages/core/src/freeze.ts`, `packages/core/src/freeze.test.ts`
- Create: `packages/core/src/kind/define.ts`, `packages/core/src/kind/define.test.ts`

**Interfaces:**
- Consumes: types and errors from Task 2.
- Produces: `deepFreeze<T>(value: T): T` — recursively freezes plain objects and arrays. Used by `defineKind` here and by `defineLocale`/`defineLocalePack` in Task 5.
- Produces:
  - `defineKind(k: Kind): Kind` — freezes and returns.
  - `normalizeKind(k: Kind): NormalizedKind`
  - `interface NormalizedUnit { unit: string; ratio(ctx: EvalCtx): Decimal; offset(ctx: EvalCtx): Decimal; lexeme: UnitLexeme }`
  - `interface NormalizedKind { id: KindId; spec: RatioSpec | OpaqueSpec; prior: number; units: Map<string, NormalizedUnit>; ops: OpSignature[]; format?: (v: Value, ctx: FormatCtx) => string }`

- [ ] **Step 1: Write the failing test**

`packages/core/src/kind/define.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { EvalCtx, Value } from "../types";
import { defineKind, normalizeKind } from "./define";

const ctx = (v: Value): EvalCtx => ({ self: v, locale: "en" });
const val = (unit: string): Value => ({ kind: "datasize", canonical: new Decimal(0), unit });

test("a five-line ratio kind needs only id, canonical and units", () => {
  const k = defineKind({
    id: "datasize",
    value: { mode: "ratio", canonical: "b", units: { b: 1, kb: 1e3, kib: 1024 } },
  });
  const n = normalizeKind(k);

  expect(n.id).toBe("datasize");
  expect(n.prior).toBe(0);
  expect(n.units.get("kib")?.ratio(ctx(val("kib"))).toString()).toBe("1024");
});

test("aliases default to the unit key", () => {
  const n = normalizeKind(
    defineKind({ id: "datasize", value: { mode: "ratio", canonical: "b", units: { kb: 1e3 } } }),
  );
  expect(n.units.get("kb")?.lexeme.aliases).toEqual(["kb"]);
});

test("an explicit lexicon replaces the default aliases and keeps display forms", () => {
  const n = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
      lexicon: { kg: { aliases: ["kg", "kilo"], symbol: "kg", display: { one: "kilogram" } } },
    }),
  );
  expect(n.units.get("kg")?.lexeme.aliases).toEqual(["kg", "kilo"]);
  expect(n.units.get("kg")?.lexeme.display?.one).toBe("kilogram");
});

test("a string array is lexicon shorthand for aliases", () => {
  const n = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
      lexicon: { kg: ["kg", "kilo"] },
    }),
  );
  expect(n.units.get("kg")?.lexeme.aliases).toEqual(["kg", "kilo"]);
});

test("a function ratio receives the value's own meta", () => {
  const n = normalizeKind(
    defineKind({
      id: "measure",
      value: {
        mode: "ratio",
        canonical: "inch",
        units: { px: { ratio: (c) => new Decimal(1).div((c.self.meta?.dpi as number) ?? 96) } },
      },
    }),
  );
  const self: Value = { kind: "measure", canonical: new Decimal(0), unit: "px", meta: { dpi: 300 } };
  // 28 significant digits, per the Decimal config in Task 1: 28 threes.
  expect(n.units.get("px")?.ratio({ self, locale: "en" }).toString()).toBe(
    "0.003333333333333333333333333333",
  );
});

test("affine offsets normalize to a Decimal-returning function", () => {
  const n = normalizeKind(
    defineKind({
      id: "temperature",
      value: {
        mode: "ratio",
        canonical: "c",
        units: { c: 1, f: { ratio: 5 / 9, offset: -32 } },
      },
    }),
  );
  expect(n.units.get("f")?.offset(ctx(val("f"))).toString()).toBe("-32");
  expect(n.units.get("c")?.offset(ctx(val("c"))).toString()).toBe("0");
});

test("defineKind deep-freezes its descriptor", () => {
  const k = defineKind({
    id: "x",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
    lexicon: { a: ["a", "alpha"] },
  });
  expect(Object.isFrozen(k)).toBe(true);
  expect(Object.isFrozen(k.value)).toBe(true);
  expect(Object.isFrozen((k.value as RatioSpec).units)).toBe(true);
  expect(Object.isFrozen(k.lexicon)).toBe(true);
  expect(Object.isFrozen(k.lexicon?.a)).toBe(true);
});

test("normalizeKind copies ops rather than aliasing the frozen array", () => {
  const k = defineKind({
    id: "x",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
    ops: [],
  });
  const n = normalizeKind(k);
  // The registry pushes generated signatures onto this array; it must not be
  // the descriptor's frozen one.
  expect(() => n.ops.push({} as OpSignature)).not.toThrow();
  expect(k.ops).toHaveLength(0);
});
```

Add `import type { OpSignature, RatioSpec } from "../types";` to the test file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/kind/define.test.ts`
Expected: FAIL — `Cannot find module './define'`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/freeze.ts`:

```ts
import { Decimal } from "./decimal";

/**
 * Recursively freezes plain objects and arrays.
 *
 * Decimal instances are returned untouched — decimal.js mutates instance
 * internals, so freezing one would break arithmetic. Functions are left alone
 * too: this guards data, not code.
 *
 * Freezing happens before recursion, so a cyclic descriptor terminates on the
 * isFrozen check rather than overflowing the stack.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Decimal) return value;
  if (Object.isFrozen(value)) return value;

  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
```

`packages/core/src/freeze.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { deepFreeze } from "./freeze";

test("freezes nested objects and arrays", () => {
  const o = deepFreeze({ a: { b: [1, 2] } });
  expect(Object.isFrozen(o)).toBe(true);
  expect(Object.isFrozen(o.a)).toBe(true);
  expect(Object.isFrozen(o.a.b)).toBe(true);
});

test("returns primitives unchanged", () => {
  expect(deepFreeze(5)).toBe(5);
  expect(deepFreeze("x")).toBe("x");
  expect(deepFreeze(null)).toBe(null);
});

test("leaves Decimal instances unfrozen so arithmetic still works", () => {
  const d = new Decimal(3);
  deepFreeze({ d });
  expect(Object.isFrozen(d)).toBe(false);
  expect(d.times(2).toString()).toBe("6");
});

test("terminates on a cyclic structure", () => {
  const a: Record<string, unknown> = {};
  a.self = a;
  expect(() => deepFreeze(a)).not.toThrow();
  expect(Object.isFrozen(a)).toBe(true);
});
```

`packages/core/src/kind/define.ts`:

```ts
import { Decimal } from "../decimal";
import { deepFreeze } from "../freeze";
import type {
  EvalCtx,
  FormatCtx,
  Kind,
  KindId,
  Lexicon,
  OpSignature,
  OpaqueSpec,
  RatioSpec,
  UnitDef,
  UnitLexeme,
  Value,
} from "../types";

export interface NormalizedUnit {
  unit: string;
  ratio: (ctx: EvalCtx) => Decimal;
  offset: (ctx: EvalCtx) => Decimal;
  lexeme: UnitLexeme;
}

export interface NormalizedKind {
  id: KindId;
  spec: RatioSpec | OpaqueSpec;
  prior: number;
  units: Map<string, NormalizedUnit>;
  ops: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

export function defineKind(k: Kind): Kind {
  return deepFreeze(k);
}

function toDecimalFn(
  x: Decimal | number | ((ctx: EvalCtx) => Decimal) | undefined,
  fallback: number,
): (ctx: EvalCtx) => Decimal {
  if (x === undefined) {
    const d = new Decimal(fallback);
    return () => d;
  }
  if (typeof x === "function") return x;
  const d = new Decimal(x as Decimal | number);
  return () => d;
}

function toLexeme(unit: string, entry: Lexicon[string] | undefined): UnitLexeme {
  if (entry === undefined) return { aliases: [unit], symbol: unit };
  if (Array.isArray(entry)) return { aliases: entry, symbol: entry[0] ?? unit };
  return { symbol: entry.symbol ?? entry.aliases[0] ?? unit, ...entry };
}

export function normalizeKind(k: Kind): NormalizedKind {
  const units = new Map<string, NormalizedUnit>();

  if (k.value.mode === "ratio") {
    for (const [unit, raw] of Object.entries(k.value.units)) {
      const def: UnitDef = typeof raw === "number" ? { ratio: raw } : raw;
      units.set(unit, {
        unit,
        ratio: toDecimalFn(def.ratio, 1),
        offset: toDecimalFn(def.offset, 0),
        lexeme: toLexeme(unit, k.lexicon?.[unit]),
      });
    }
  }

  return {
    id: k.id,
    spec: k.value,
    prior: k.prior ?? 0,
    units,
    // Copy, never alias: the descriptor's ops array is deep-frozen, and the
    // registry in Task 4 pushes generated signatures onto this one.
    ops: [...(k.ops ?? [])],
    ...(k.format ? { format: k.format } : {}),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/core/src/kind/define.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/kind
git commit -m "feat(core): add defineKind with shorthand normalization"
```

---

## Task 4: Registry with generated ratio ops

**Files:**
- Create: `packages/core/src/kind/ratio-ops.ts`
- Create: `packages/core/src/kind/registry.ts`, `packages/core/src/kind/registry.test.ts`

**Interfaces:**
- Consumes: `NormalizedKind`, `normalizeKind` (Task 3).
- Produces:
  - `generateRatioOps(kind: NormalizedKind): OpSignature[]`
  - `buildRegistry(kinds: Kind[], packs?: LocalePack[], locale?: string): Registry`
  - `interface Registry { kinds: Map<KindId, NormalizedKind>; ops: Map<string, OpSignature>; aliasIndex: Map<string, AliasEntry[]> }`
  - `interface AliasEntry { kind: KindId; unit: string }`
  - `opKey(op: OpSymbol, left: KindId, right: KindId): string`
  - `NUMBER_KIND = "number"` constant.

- [ ] **Step 1: Write the failing test**

`packages/core/src/kind/registry.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineLocalePack } from "../locale/define";
import { KindConflictError, UnknownKindError } from "../errors";
import { defineKind } from "./define";
import { buildRegistry, opKey } from "./registry";

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
  lexicon: { kg: ["kg", "kilo"] },
});

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

test("ratio kinds get same-kind + and - for free", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("+", "mass", "mass"))).toBe(true);
  expect(r.ops.has(opKey("-", "mass", "mass"))).toBe(true);
});

test("ratio kinds get scaling by number in both orders", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("*", "mass", "number"))).toBe(true);
  expect(r.ops.has(opKey("*", "number", "mass"))).toBe(true);
  expect(r.ops.has(opKey("/", "mass", "number"))).toBe(true);
  expect(r.ops.has(opKey("/", "number", "mass"))).toBe(false);
});

test("ratio kinds get in-kind conversion", () => {
  const r = buildRegistry([number, mass]);
  expect(r.ops.has(opKey("in", "mass", "mass"))).toBe(true);
});

test("the alias index maps every alias to its kind and unit", () => {
  const r = buildRegistry([number, mass]);
  expect(r.aliasIndex.get("kilo")).toEqual([{ kind: "mass", unit: "kg" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg" }]);
});

test("the alias index is case-folded", () => {
  const r = buildRegistry([number, mass]);
  expect(r.aliasIndex.get("kg")).toBeDefined();
  expect(r.aliasIndex.has("KG")).toBe(false);
});

test("a locale pack unions aliases into the index", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг", "кілограм"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "uk");
  expect(r.aliasIndex.get("кг")).toEqual([{ kind: "mass", unit: "kg" }]);
  expect(r.aliasIndex.get("kg")).toEqual([{ kind: "mass", unit: "kg" }]);
});

test("a pack for another locale is ignored", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: { mass: { kg: { aliases: ["кг"] } } },
  });
  const r = buildRegistry([number, mass], [pack], "en");
  expect(r.aliasIndex.has("кг")).toBe(false);
});

test("a pack naming an unregistered kind throws at build time", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { nosuchkind: { x: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [pack], "en")).toThrow(UnknownKindError);
});

test("extendsKind merges units and aliases into the base kind", () => {
  const patch = defineKind({
    id: "mass-extra",
    extendsKind: "mass",
    value: { mode: "ratio", canonical: "g", units: { t: 1e6 } },
  });
  const r = buildRegistry([number, mass, patch]);
  expect(r.kinds.get("mass")?.units.has("t")).toBe(true);
  expect(r.aliasIndex.get("t")).toEqual([{ kind: "mass", unit: "t" }]);
  expect(r.kinds.has("mass-extra")).toBe(false);
});

test("a kind registered twice throws", () => {
  expect(() => buildRegistry([number, mass, mass])).toThrow(KindConflictError);
});

test("extending an unknown kind throws", () => {
  const orphan = defineKind({
    id: "orphan",
    extendsKind: "nosuchkind",
    value: { mode: "ratio", canonical: "g", units: { z: 1 } },
  });
  expect(() => buildRegistry([number, mass, orphan])).toThrow(KindConflictError);
});

test("a patch whose value.mode differs from its base throws", () => {
  const opaquePatch = defineKind({
    id: "mass-opaque",
    extendsKind: "mass",
    value: { mode: "opaque", parse: () => null, equals: (a, b) => a === b },
  });
  expect(() => buildRegistry([number, mass, opaquePatch])).toThrow(KindConflictError);
});

test("a pack naming an unregistered unit throws", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  expect(() => buildRegistry([number, mass], [pack], "en")).toThrow(UnknownKindError);
});

test("an ambiguous alias yields several entries sorted by kind id", () => {
  const duration = defineKind({
    id: "duration",
    value: { mode: "ratio", canonical: "s", units: { min: 60 } },
    lexicon: { min: ["min", "m"] },
  });
  const length = defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1 } },
  });
  const r = buildRegistry([number, duration, length]);
  expect(r.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min" },
    { kind: "length", unit: "m" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: FAIL — `Cannot find module './registry'`.

- [ ] **Step 3: Write ratio-ops.ts**

`packages/core/src/kind/ratio-ops.ts`:

```ts
import { Decimal } from "../decimal";
import type { OpSignature, Value } from "../types";
import type { NormalizedKind } from "./define";

export const NUMBER_KIND = "number";

const wrap = (proto: Value, canonical: Decimal): Value =>
  Object.freeze({
    kind: proto.kind,
    canonical,
    unit: proto.unit,
    ...(proto.meta ? { meta: proto.meta } : {}),
  });

export function generateRatioOps(kind: NormalizedKind): OpSignature[] {
  if (kind.spec.mode !== "ratio") return [];
  const id = kind.id;

  const sameKind: OpSignature[] = [
    { op: "+", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.plus(r.canonical)) },
    { op: "-", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.minus(r.canonical)) },
    { op: "in", left: id, right: id, result: id, apply: (l, r) => wrap(r, l.canonical) },
  ];

  if (id === NUMBER_KIND) {
    return [
      ...sameKind,
      { op: "*", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.times(r.canonical)) },
      { op: "/", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.div(r.canonical)) },
    ];
  }

  return [
    ...sameKind,
    {
      op: "*",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(r.canonical)),
    },
    {
      op: "*",
      left: NUMBER_KIND,
      right: id,
      result: id,
      apply: (l, r) => wrap(r, r.canonical.times(l.canonical)),
    },
    {
      op: "/",
      left: id,
      right: NUMBER_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.div(r.canonical)),
    },
  ];
}
```

- [ ] **Step 4: Write registry.ts**

`packages/core/src/kind/registry.ts`:

```ts
import { KindConflictError, UnknownKindError } from "../errors";
import type { Kind, KindId, LocalePack, OpSignature, OpSymbol, UnitLexeme } from "../types";
import { type NormalizedKind, normalizeKind } from "./define";
import { generateRatioOps } from "./ratio-ops";

export { NUMBER_KIND } from "./ratio-ops";

export interface AliasEntry {
  kind: KindId;
  unit: string;
}

export interface Registry {
  kinds: Map<KindId, NormalizedKind>;
  ops: Map<string, OpSignature>;
  aliasIndex: Map<string, AliasEntry[]>;
}

export function opKey(op: OpSymbol, left: KindId, right: KindId): string {
  return `${op}|${left}|${right}`;
}

function mergeLexeme(base: UnitLexeme, patch: UnitLexeme): UnitLexeme {
  const aliases = [...new Set([...base.aliases, ...patch.aliases])];
  return {
    aliases,
    symbol: patch.symbol ?? base.symbol,
    ...(patch.display || base.display
      ? { display: { ...base.display, ...patch.display } }
      : {}),
  };
}

export function buildRegistry(
  kinds: Kind[],
  packs: LocalePack[] = [],
  locale = "en",
): Registry {
  const normalized = new Map<KindId, NormalizedKind>();

  // Pass 1: base kinds.
  for (const k of kinds) {
    if (k.extendsKind !== undefined) continue;
    if (normalized.has(k.id)) throw new KindConflictError(k.id, "registered twice");
    normalized.set(k.id, normalizeKind(k));
  }

  // Pass 2: patches.
  for (const k of kinds) {
    if (k.extendsKind === undefined) continue;
    const base = normalized.get(k.extendsKind);
    if (base === undefined) throw new KindConflictError(k.id, `extends unknown kind ${k.extendsKind}`);
    if (base.spec.mode !== k.value.mode) {
      throw new KindConflictError(k.id, `value.mode ${k.value.mode} does not match base ${base.spec.mode}`);
    }
    const patch = normalizeKind({ ...k, id: base.id });
    for (const [unit, def] of patch.units) {
      const existing = base.units.get(unit);
      base.units.set(unit, existing ? { ...def, lexeme: mergeLexeme(existing.lexeme, def.lexeme) } : def);
    }
    base.ops.push(...patch.ops);
  }

  // Pass 3: locale packs.
  for (const pack of packs) {
    if (pack.locale !== locale) continue;
    for (const [kindId, lexicon] of Object.entries(pack.contributes)) {
      const kind = normalized.get(kindId);
      if (kind === undefined) throw new UnknownKindError(pack.locale, kindId);
      for (const [unit, entry] of Object.entries(lexicon)) {
        const existing = kind.units.get(unit);
        if (existing === undefined) throw new UnknownKindError(pack.locale, `${kindId}:${unit}`);
        const patch: UnitLexeme = Array.isArray(entry) ? { aliases: entry } : entry;
        existing.lexeme = mergeLexeme(existing.lexeme, patch);
      }
    }
  }

  // Pass 4: op table.
  const ops = new Map<string, OpSignature>();
  for (const kind of normalized.values()) {
    for (const sig of [...generateRatioOps(kind), ...kind.ops]) {
      ops.set(opKey(sig.op, sig.left, sig.right), sig);
    }
  }

  // Pass 5: alias index, deterministically ordered.
  const aliasIndex = new Map<string, AliasEntry[]>();
  const kindIds = [...normalized.keys()].sort();
  for (const kindId of kindIds) {
    const kind = normalized.get(kindId);
    if (kind === undefined) continue;
    const unitNames = [...kind.units.keys()].sort();
    for (const unitName of unitNames) {
      const unit = kind.units.get(unitName);
      if (unit === undefined) continue;
      for (const alias of unit.lexeme.aliases) {
        const key = alias.toLocaleLowerCase(locale);
        const list = aliasIndex.get(key) ?? [];
        if (!list.some((e) => e.kind === kindId && e.unit === unitName)) {
          list.push({ kind: kindId, unit: unitName });
        }
        aliasIndex.set(key, list);
      }
    }
  }

  return { kinds: normalized, ops, aliasIndex };
}
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: FAIL — `Cannot find module '../locale/define'`. That module arrives in Task 5. Skip the two pack tests for now by prefixing them with `test.skip`, confirm the other 8 pass, then restore them at the end of Task 5.

Run again after skipping: PASS, 8 tests, 2 skipped.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/kind
git commit -m "feat(core): add registry with generated ratio ops and alias index"
```

---

## Task 5: Locale, analyzers and locale packs

**Files:**
- Create: `packages/core/src/locale/define.ts`
- Create: `packages/core/src/locale/helpers.ts`, `packages/core/src/locale/helpers.test.ts`
- Create: `packages/core/src/locale/analyze.ts`, `packages/core/src/locale/analyze.test.ts`
- Modify: `packages/core/src/kind/registry.test.ts` — un-skip the two pack tests.

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  - `defineLocale(l: Locale): Locale`, `defineLocalePack(p: LocalePack): LocalePack`
  - `identity(): Analyzer`
  - `suffixStripper(opts: { suffixes: string[]; minStem: number; weight?: number }): Analyzer`
  - `tableAnalyzer(table: Record<string, string>, weight?: number): Analyzer`
  - `createAnalyzerChain(locale: Locale, packs: LocalePack[]): (surface: string) => AnalyzedForm[]` — memoized, deduplicated, deterministic order.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/locale/helpers.test.ts`:

```ts
import { expect, test } from "bun:test";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

const ctx = { locale: "uk" };

test("identity returns the surface form at weight 0", () => {
  expect(identity()("кілограмів", ctx)).toEqual([{ form: "кілограмів", weight: 0 }]);
});

test("suffixStripper offers each strippable suffix at a penalty", () => {
  const a = suffixStripper({ suffixes: ["ів", "и"], minStem: 3, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([{ form: "кілограм", weight: -2 }]);
});

test("suffixStripper respects minStem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 10, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([]);
});

test("suffixStripper never returns an empty stem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 1, weight: -2 });
  expect(a("ів", ctx)).toEqual([]);
});

test("tableAnalyzer maps known irregulars", () => {
  const a = tableAnalyzer({ кіло: "кілограм" }, -1);
  expect(a("кіло", ctx)).toEqual([{ form: "кілограм", weight: -1 }]);
  expect(a("метр", ctx)).toEqual([]);
});
```

`packages/core/src/locale/analyze.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createAnalyzerChain } from "./analyze";
import { defineLocale, defineLocalePack } from "./define";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

const uk = defineLocale({
  id: "uk",
  numberFormat: "intl",
  analyze: [identity(), suffixStripper({ suffixes: ["ів"], minStem: 3, weight: -2 })],
  keywords: { in: ["в"] },
});

test("the chain returns every analyzer's forms, exact match first", () => {
  const analyze = createAnalyzerChain(uk, []);
  expect(analyze("кілограмів")).toEqual([
    { form: "кілограмів", weight: 0 },
    { form: "кілограм", weight: -2 },
  ]);
});

test("duplicate forms keep the highest weight only", () => {
  const locale = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), tableAnalyzer({ кг: "кг" }, -5)],
    keywords: {},
  });
  expect(createAnalyzerChain(locale, [])("кг")).toEqual([{ form: "кг", weight: 0 }]);
});

test("pack analyzers are appended to the locale chain", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: {},
    analyze: [tableAnalyzer({ бит: "біткоїн" }, -1)],
  });
  expect(createAnalyzerChain(uk, [pack])("бит")).toEqual([
    { form: "бит", weight: 0 },
    { form: "біткоїн", weight: -1 },
  ]);
});

test("packs for another locale do not contribute analyzers", () => {
  const pack = defineLocalePack({
    locale: "de",
    contributes: {},
    analyze: [tableAnalyzer({ бит: "біткоїн" }, -1)],
  });
  expect(createAnalyzerChain(uk, [pack])("бит")).toEqual([{ form: "бит", weight: 0 }]);
});

test("results are memoized: the same surface is analyzed once", () => {
  let calls = 0;
  const counting = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [
      (s) => {
        calls += 1;
        return [{ form: s, weight: 0 }];
      },
    ],
    keywords: {},
  });
  const analyze = createAnalyzerChain(counting, []);
  analyze("кг");
  analyze("кг");
  expect(calls).toBe(1);
});

test("a locale with no analyzers still returns the surface form", () => {
  const bare = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });
  expect(createAnalyzerChain(bare, [])("kg")).toEqual([{ form: "kg", weight: 0 }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/locale/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write define.ts**

`packages/core/src/locale/define.ts`:

```ts
import { deepFreeze } from "../freeze";
import type { Locale, LocalePack } from "../types";

export function defineLocale(l: Locale): Locale {
  return deepFreeze(l);
}

export function defineLocalePack(p: LocalePack): LocalePack {
  return deepFreeze(p);
}
```

Note `deepFreeze` leaves functions alone, so a locale's `analyze` array is frozen while the analyzer functions inside it stay callable.

- [ ] **Step 4: Write helpers.ts**

`packages/core/src/locale/helpers.ts`:

```ts
import type { AnalyzedForm, Analyzer } from "../types";

export function identity(): Analyzer {
  return (surface) => [{ form: surface, weight: 0 }];
}

export function suffixStripper(opts: {
  suffixes: string[];
  minStem: number;
  weight?: number;
}): Analyzer {
  const weight = opts.weight ?? -2;
  // Longest suffix first, so "ами" is tried before "и".
  const suffixes = [...opts.suffixes].sort((a, b) => b.length - a.length);

  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const suffix of suffixes) {
      if (!surface.endsWith(suffix)) continue;
      const stem = surface.slice(0, surface.length - suffix.length);
      if (stem.length === 0 || stem.length < opts.minStem) continue;
      out.push({ form: stem, weight });
    }
    return out;
  };
}

export function tableAnalyzer(table: Record<string, string>, weight = -1): Analyzer {
  return (surface) => {
    const form = table[surface];
    return form === undefined ? [] : [{ form, weight }];
  };
}
```

- [ ] **Step 5: Write analyze.ts**

`packages/core/src/locale/analyze.ts`:

```ts
import type { AnalyzedForm, Locale, LocalePack } from "../types";
import { identity } from "./helpers";

export function createAnalyzerChain(
  locale: Locale,
  packs: LocalePack[],
): (surface: string) => AnalyzedForm[] {
  const chain = [
    ...(locale.analyze ?? [identity()]),
    ...packs.filter((p) => p.locale === locale.id).flatMap((p) => p.analyze ?? []),
  ];
  const ctx = { locale: locale.id };
  const cache = new Map<string, AnalyzedForm[]>();

  return (surface) => {
    const hit = cache.get(surface);
    if (hit !== undefined) return hit;

    const best = new Map<string, AnalyzedForm>();
    for (const analyzer of chain) {
      for (const produced of analyzer(surface, ctx)) {
        const weight = produced.weight ?? 0;
        const existing = best.get(produced.form);
        if (existing === undefined || weight > (existing.weight ?? 0)) {
          best.set(produced.form, { ...produced, weight });
        }
      }
    }

    const forms = [...best.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    cache.set(surface, forms);
    return forms;
  };
}
```

- [ ] **Step 6: Run the locale tests**

Run: `bun test packages/core/src/locale/`
Expected: PASS, 11 tests.

- [ ] **Step 7: Restore the skipped registry tests**

Task 4 could not use a static import of `../locale/define` — ES modules evaluate
static imports before any test body runs, so `test.skip` does not prevent the
module-load crash. It therefore used a dynamic `import()` inside each skipped
test, suppressed with `@ts-expect-error`. Now that the module exists, undo all
of that in `packages/core/src/kind/registry.test.ts`:

1. Add the static import at the top: `import { defineLocalePack } from "../locale/define";`
2. Delete every `@ts-expect-error` comment that suppressed the missing module, and
   the dynamic `import()` line each one guarded. **`tsc` errors on an unused
   `@ts-expect-error`, so leaving them breaks the typecheck** — this step is not
   optional.
3. Change all **four** `test.skip(` back to `test(`: "a locale pack unions aliases
   into the index", "a pack for another locale is ignored", "a pack naming an
   unregistered kind throws at build time", and "a pack naming an unregistered
   unit throws". Every test constructing a `defineLocalePack` was skipped; all of
   them come back.
4. Drop the now-unneeded `async` on those test callbacks.

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: PASS, 14 tests, 0 skipped.

Run: `bun run check`
Expected: clean — in particular `tsc` must report no unused-suppression errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/locale packages/core/src/kind/registry.test.ts
git commit -m "feat(core): add locale definitions, analyzer chain and helpers"
```

---

## Task 6: Normalization and lexer

**Files:**
- Create: `packages/core/src/parse/normalize.ts`, `packages/core/src/parse/normalize.test.ts`
- Create: `packages/core/src/locale/number.ts`, `packages/core/src/locale/number.test.ts`
- Create: `packages/core/src/parse/lex.ts`, `packages/core/src/parse/lex.test.ts`

**Interfaces:**
- Consumes: `Locale` (Task 2), `defineLocale` (Task 5).
- Produces:
  - `normalize(input: string): string`
  - `numberSymbols(locale: Locale): { group: string; decimal: string }`
  - `parseNumber(text: string, locale: Locale): Decimal | null`
  - `type Token` (discriminated union: `number`, `word`, `op`, `keyword`, `lparen`, `rparen`), each carrying `start` and `end`
  - `lex(input: string, locale: Locale): Token[]`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/parse/normalize.test.ts`:

```ts
import { expect, test } from "bun:test";
import { normalize } from "./normalize";

test("unifies dash variants to ASCII hyphen", () => {
  expect(normalize("5 − 3")).toBe("5 - 3");
  expect(normalize("5 – 3")).toBe("5 - 3");
  expect(normalize("5 — 3")).toBe("5 - 3");
});

test("strips zero-width characters", () => {
  expect(normalize("10​kg")).toBe("10kg");
});

test("applies NFKC so full-width digits fold to ASCII", () => {
  expect(normalize("１０ kg")).toBe("10 kg");
});

test("removes the degree sign so 20°C and 20C are identical", () => {
  expect(normalize("20°C")).toBe(normalize("20C"));
});

test("trims surrounding whitespace and collapses runs", () => {
  expect(normalize("  10   kg  ")).toBe("10 kg");
});
```

`packages/core/src/locale/number.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineLocale } from "./define";
import { numberSymbols, parseNumber } from "./number";

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });
const de = defineLocale({ id: "de", numberFormat: "intl", keywords: {} });

test("discovers group and decimal symbols from Intl", () => {
  expect(numberSymbols(en)).toEqual({ group: ",", decimal: "." });
  expect(numberSymbols(de)).toEqual({ group: ".", decimal: "," });
});

test("parses grouped numbers per locale", () => {
  expect(parseNumber("1,500.25", en)?.toString()).toBe("1500.25");
  expect(parseNumber("1.500,25", de)?.toString()).toBe("1500.25");
});

test("parses a bare integer and decimal", () => {
  expect(parseNumber("42", en)?.toString()).toBe("42");
  expect(parseNumber("0.5", en)?.toString()).toBe("0.5");
});

test("an explicit NumberFormatSpec overrides Intl", () => {
  const custom = defineLocale({
    id: "xx",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  expect(parseNumber("1 500,25", custom)?.toString()).toBe("1500.25");
});

test("strips non-breaking and narrow no-break spaces", () => {
  // Written as escapes on purpose: these characters are invisible in source.
  // U+00A0 arrives via pasted text; U+202F is French ICU's group separator.
  expect(parseNumber("1\u00A0500.25", en)?.toString()).toBe("1500.25");
  expect(parseNumber("1\u202F500.25", en)?.toString()).toBe("1500.25");
});

test("returns null for non-numeric text", () => {
  expect(parseNumber("kg", en)).toBeNull();
});
```

`packages/core/src/parse/lex.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineLocale } from "../locale/define";
import { lex } from "./lex";

const en = defineLocale({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in", "to", "as"] },
});

test("lexes a number and a word with correct spans", () => {
  const tokens = lex("10 kg", en);
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toMatchObject({ type: "number", start: 0, end: 2 });
  expect(tokens[1]).toMatchObject({ type: "word", text: "kg", start: 3, end: 5 });
});

test("lexes a number with no space before its unit", () => {
  const tokens = lex("10kg", en);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});

test("lexes operators and parens", () => {
  expect(lex("(1 + 2) * 3 / 4 - 5", en).map((t) => t.type)).toEqual([
    "lparen", "number", "op", "number", "rparen",
    "op", "number", "op", "number", "op", "number",
  ]);
});

test("recognizes locale keywords", () => {
  const tokens = lex("10 kg in g", en);
  expect(tokens[2]).toMatchObject({ type: "keyword", keyword: "in" });
});

test("keeps grouped numbers as one token", () => {
  const tokens = lex("1,500.25 kg", en);
  expect(tokens[0]).toMatchObject({ type: "number" });
  expect(tokens).toHaveLength(2);
});

test("backs off a trailing separator that is not part of the number", () => {
  const tokens = lex("1,500. kg", en);
  expect(tokens[0]).toMatchObject({ type: "number", text: "1,500", start: 0, end: 5 });
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});

test("skips unrecognized characters instead of throwing", () => {
  // suggest() must never crash on junk.
  expect(() => lex("10 kg @@ 5", en)).not.toThrow();
  expect(lex("10 kg @@ 5", en).map((t) => t.type)).toEqual(["number", "word", "number"]);
});

test("word runs are split by the locale segmenter when provided", () => {
  const zh = defineLocale({
    id: "zh",
    numberFormat: "intl",
    segment: (run) => (run === "公斤克" ? ["公斤", "克"] : [run]),
    keywords: {},
  });
  expect(lex("10公斤克", zh).map((t) => (t.type === "word" ? t.text : t.type))).toEqual([
    "number", "公斤", "克",
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/parse/ packages/core/src/locale/number.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write normalize.ts**

`packages/core/src/parse/normalize.ts`:

```ts
const DASHES = /[−‒–—―]/g;
const ZERO_WIDTH = /[​‌‍﻿]/g;
const DEGREE = /°/g;
const WHITESPACE = /\s+/g;

export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(DASHES, "-")
    .replace(DEGREE, "")
    .replace(WHITESPACE, " ")
    .trim();
}
```

- [ ] **Step 4: Write number.ts**

`packages/core/src/locale/number.ts`:

```ts
import { Decimal } from "../decimal";
import type { Locale, NumberFormatSpec } from "../types";

const cache = new Map<string, NumberFormatSpec>();

export function numberSymbols(locale: Locale): NumberFormatSpec {
  if (locale.numberFormat !== "intl") return locale.numberFormat;

  const hit = cache.get(locale.id);
  if (hit !== undefined) return hit;

  const parts = new Intl.NumberFormat(locale.id).formatToParts(1234567.5);
  const spec: NumberFormatSpec = {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
  cache.set(locale.id, spec);
  return spec;
}

export function parseNumber(text: string, locale: Locale): Decimal | null {
  const { group, decimal } = numberSymbols(locale);
  let cleaned = "";
  for (const ch of text) {
    // Escapes, not literals: NBSP and narrow NBSP are invisible in source and
    // silently degrade to a plain space when retyped. French ICU uses U+202F as
    // its group separator, so this is load-bearing, not defensive padding.
    if (ch === group || ch === "\u00A0" || ch === "\u202F") continue;
    cleaned += ch === decimal ? "." : ch;
  }
  if (cleaned.length === 0 || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  try {
    return new Decimal(cleaned);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Write lex.ts**

`packages/core/src/parse/lex.ts`:

```ts
import type { Decimal } from "../decimal";
import { numberSymbols, parseNumber } from "../locale/number";
import type { Keyword, Locale, OpSymbol } from "../types";

export type Token =
  | { type: "number"; value: Decimal; text: string; start: number; end: number }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number };

const OPS: Record<string, OpSymbol> = { "+": "+", "-": "-", "*": "*", "/": "/" };

function defaultSegment(run: string, localeId: string): string[] {
  const segmenter = new Intl.Segmenter(localeId, { granularity: "word" });
  return [...segmenter.segment(run)].filter((s) => s.isWordLike).map((s) => s.segment);
}

function keywordFor(word: string, locale: Locale): Keyword | null {
  for (const [keyword, aliases] of Object.entries(locale.keywords)) {
    if (aliases?.includes(word)) return keyword as Keyword;
  }
  return null;
}

export function lex(input: string, locale: Locale): Token[] {
  const { group, decimal } = numberSymbols(locale);
  const tokens: Token[] = [];
  let i = 0;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isLetter = (c: string) => /\p{L}/u.test(c);

  while (i < input.length) {
    const ch = input[i] as string;

    if (ch === " ") {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", start: i, end: i + 1 });
      i += 1;
      continue;
    }

    const op = OPS[ch];
    if (op !== undefined) {
      tokens.push({ type: "op", op, start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      while (
        i < input.length &&
        (isDigit(input[i] as string) || input[i] === group || input[i] === decimal)
      ) {
        i += 1;
      }
      // A trailing group/decimal symbol is punctuation, not part of the number.
      while (i > start && !isDigit(input[i - 1] as string)) i -= 1;
      const text = input.slice(start, i);
      const value = parseNumber(text, locale);
      if (value === null) {
        i = start + 1;
        continue;
      }
      tokens.push({ type: "number", value, text, start, end: i });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      while (i < input.length && isLetter(input[i] as string)) i += 1;
      const run = input.slice(start, i);
      const words = locale.segment ? locale.segment(run) : defaultSegment(run, locale.id);
      let offset = start;
      for (const word of words) {
        const at = input.indexOf(word, offset);
        const wordStart = at === -1 ? offset : at;
        const wordEnd = wordStart + word.length;
        const keyword = keywordFor(word, locale);
        tokens.push(
          keyword === null
            ? { type: "word", text: word, start: wordStart, end: wordEnd }
            : { type: "keyword", keyword, start: wordStart, end: wordEnd },
        );
        offset = wordEnd;
      }
      continue;
    }

    // Unrecognized character: skip it rather than fail the whole parse.
    i += 1;
  }

  return tokens;
}
```

- [ ] **Step 6: Run tests**

Run: `bun test packages/core/src/parse/ packages/core/src/locale/number.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/parse packages/core/src/locale/number.ts packages/core/src/locale/number.test.ts
git commit -m "feat(core): add normalization, locale number parsing and lexer"
```

---

## Task 7: Weights

**Files:**
- Create: `packages/core/src/solve/weights.ts`, `packages/core/src/solve/weights.test.ts`

**Interfaces:**
- Consumes: `Weights`, `KindId` (Task 2).
- Produces: `resolveWeight(args: { kind: KindId; unit: string; surface: string; prior: number; layers: (Weights | undefined)[] }): number` and `weightBreakdown(...): Array<{ selector: string; value: number; layer: number }>` for `explain()`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/solve/weights.test.ts`:

```ts
import { expect, test } from "bun:test";
import { resolveWeight, weightBreakdown } from "./weights";

const base = { kind: "duration", unit: "min", surface: "m", prior: 0 };

test("with no layers the weight is the kind prior", () => {
  expect(resolveWeight({ ...base, prior: 7, layers: [] })).toBe(7);
});

test("a kind selector applies to every unit of the kind", () => {
  expect(resolveWeight({ ...base, layers: [{ duration: 5 }] })).toBe(5);
});

test("a kind:unit selector applies to one unit", () => {
  expect(resolveWeight({ ...base, layers: [{ "duration:min": -20 }] })).toBe(-20);
});

test("a token selector applies to the surface form", () => {
  expect(resolveWeight({ ...base, layers: [{ "token:m": 100 }] })).toBe(100);
});

test("all matching selectors sum — there is no precedence", () => {
  const w = resolveWeight({ ...base, layers: [{ duration: 5, "duration:min": -20 }] });
  expect(w).toBe(-15);
});

test("all four layers sum", () => {
  const w = resolveWeight({
    ...base,
    prior: 1,
    layers: [{ duration: 2 }, { duration: 4 }, { "duration:min": 8 }, { "token:m": 16 }],
  });
  expect(w).toBe(31);
});

test("non-matching selectors contribute nothing", () => {
  expect(resolveWeight({ ...base, layers: [{ length: 99, "length:m": 99, "token:kg": 99 }] })).toBe(0);
});

test("undefined layers are skipped", () => {
  expect(resolveWeight({ ...base, layers: [undefined, { duration: 3 }, undefined] })).toBe(3);
});

test("the breakdown lists every contribution in layer order", () => {
  const b = weightBreakdown({ ...base, prior: 1, layers: [{ duration: 5 }, { "token:m": 2 }] });
  expect(b).toEqual([
    { selector: "prior", value: 1, layer: 0 },
    { selector: "duration", value: 5, layer: 1 },
    { selector: "token:m", value: 2, layer: 2 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/solve/weights.test.ts`
Expected: FAIL — `Cannot find module './weights'`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/solve/weights.ts`:

```ts
import type { KindId, Weights } from "../types";

export interface WeightArgs {
  kind: KindId;
  unit: string;
  surface: string;
  prior: number;
  layers: (Weights | undefined)[];
}

export interface WeightContribution {
  selector: string;
  value: number;
  layer: number;
}

function selectorsFor(args: WeightArgs): string[] {
  return [`token:${args.surface}`, `${args.kind}:${args.unit}`, args.kind];
}

export function weightBreakdown(args: WeightArgs): WeightContribution[] {
  const out: WeightContribution[] = [{ selector: "prior", value: args.prior, layer: 0 }];
  const selectors = selectorsFor(args);

  args.layers.forEach((layer, index) => {
    if (layer === undefined) return;
    for (const selector of selectors) {
      const value = layer[selector];
      if (value !== undefined) out.push({ selector, value, layer: index + 1 });
    }
  });

  return out;
}

export function resolveWeight(args: WeightArgs): number {
  return weightBreakdown(args).reduce((sum, c) => sum + c.value, 0);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/core/src/solve/weights.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/solve
git commit -m "feat(core): add additive layered weight resolution"
```

---

## Task 8: Candidate resolution

**Files:**
- Create: `packages/core/src/parse/candidates.ts`, `packages/core/src/parse/candidates.test.ts`

**Interfaces:**
- Consumes: `Registry`/`AliasEntry` (Task 4), `createAnalyzerChain` (Task 5), `resolveWeight` (Task 7).
- Produces: `createResolver(args: { registry: Registry; locale: Locale; packs: LocalePack[]; layers: (Weights | undefined)[] }): Resolver`, where `interface Resolver { resolve(surface: string): Candidate[]; nearest(surface: string): string[] }`. `resolve` returns candidates sorted by descending weight, then kind id, then unit — deterministic.

- [ ] **Step 1: Write the failing test**

`packages/core/src/parse/candidates.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { identity, suffixStripper } from "../locale/helpers";
import { createResolver } from "./candidates";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m", "metre", "metres"], km: ["km"] },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60 } },
  lexicon: { min: ["min", "m", "minute"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });
const registry = buildRegistry([number, length, duration]);
const resolver = (layers: Parameters<typeof createResolver>[0]["layers"] = []) =>
  createResolver({ registry, locale: en, packs: [], layers });

test("an unambiguous alias yields one candidate", () => {
  expect(resolver().resolve("km")).toEqual([
    { kind: "length", unit: "km", weight: 0, surface: "km", form: "km" },
  ]);
});

test("an ambiguous alias yields all candidates, deterministically ordered", () => {
  expect(resolver().resolve("m").map((c) => `${c.kind}:${c.unit}`)).toEqual([
    "duration:min",
    "length:m",
  ]);
});

test("weights reorder candidates", () => {
  const r = resolver([{ "length:m": 10 }]);
  expect(r.resolve("m").map((c) => `${c.kind}:${c.unit}`)).toEqual(["length:m", "duration:min"]);
  expect(r.resolve("m")[0]?.weight).toBe(10);
});

test("an unknown surface yields no candidates", () => {
  expect(resolver().resolve("zzz")).toEqual([]);
});

test("nearest suggests close aliases for an unknown surface", () => {
  expect(resolver().nearest("kmm")).toContain("km");
});

test("analyzed forms reach the lexicon and are penalised", () => {
  const uk = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), suffixStripper({ suffixes: ["s"], minStem: 3, weight: -2 })],
    keywords: {},
  });
  const r = createResolver({ registry, locale: uk, packs: [], layers: [] });
  const found = r.resolve("metres");
  expect(found.map((c) => `${c.kind}:${c.unit}`)).toEqual(["length:m"]);
  expect(found[0]?.weight).toBe(0);
});

test("a stem match scores below an exact match", () => {
  const uk = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), suffixStripper({ suffixes: ["e"], minStem: 3, weight: -2 })],
    keywords: {},
  });
  const r = createResolver({ registry, locale: uk, packs: [], layers: [] });
  // "metre" matches exactly (weight 0); its stem "metr" matches nothing.
  expect(r.resolve("metre")[0]?.weight).toBe(0);
});

test("case is folded before lookup", () => {
  expect(resolver().resolve("KM").map((c) => c.unit)).toEqual(["km"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/parse/candidates.test.ts`
Expected: FAIL — `Cannot find module './candidates'`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/parse/candidates.ts`:

```ts
import type { Registry } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { resolveWeight } from "../solve/weights";
import type { Candidate, Locale, LocalePack, Weights } from "../types";

export interface Resolver {
  resolve(surface: string): Candidate[];
  nearest(surface: string): string[];
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

export function createResolver(args: {
  registry: Registry;
  locale: Locale;
  packs: LocalePack[];
  layers: (Weights | undefined)[];
}): Resolver {
  const analyze = createAnalyzerChain(args.locale, args.packs);
  const fold = (s: string) => s.toLocaleLowerCase(args.locale.id);

  return {
    resolve(surface) {
      const found = new Map<string, Candidate>();

      for (const analyzed of analyze(surface)) {
        const entries = args.registry.aliasIndex.get(fold(analyzed.form));
        if (entries === undefined) continue;

        for (const entry of entries) {
          const kind = args.registry.kinds.get(entry.kind);
          if (kind === undefined) continue;

          const weight =
            resolveWeight({
              kind: entry.kind,
              unit: entry.unit,
              surface: fold(surface),
              prior: kind.prior,
              layers: args.layers,
            }) + (analyzed.weight ?? 0);

          const key = `${entry.kind}:${entry.unit}`;
          const existing = found.get(key);
          if (existing === undefined || weight > existing.weight) {
            found.set(key, {
              kind: entry.kind,
              unit: entry.unit,
              weight,
              surface,
              form: analyzed.form,
            });
          }
        }
      }

      return [...found.values()].sort(
        (a, b) =>
          b.weight - a.weight || a.kind.localeCompare(b.kind) || a.unit.localeCompare(b.unit),
      );
    },

    nearest(surface) {
      const target = fold(surface);
      return [...args.registry.aliasIndex.keys()]
        .map((alias) => ({ alias, d: editDistance(target, alias) }))
        .filter((x) => x.d > 0 && x.d <= 2)
        .sort((a, b) => a.d - b.d || a.alias.localeCompare(b.alias))
        .slice(0, 3)
        .map((x) => x.alias);
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/core/src/parse/candidates.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/parse/candidates.ts packages/core/src/parse/candidates.test.ts
git commit -m "feat(core): resolve tokens to weighted candidate sets"
```

---

## Task 9: AST and Pratt parser

**Files:**
- Create: `packages/core/src/parse/ast.ts`
- Create: `packages/core/src/parse/pratt.ts`, `packages/core/src/parse/pratt.test.ts`

**Interfaces:**
- Consumes: `Token` (Task 6), `Resolver` (Task 8).
- Produces:
  - `type Node = NumberNode | QuantityNode | BinaryNode | UnaryNode | ConvertNode`, each with a `span`.
  - `parse(tokens: Token[], resolver: Resolver, input: string): Node` — throws `UnitParseError` on malformed input and `NoCandidateError` on an unknown unit word.

- [ ] **Step 1: Write the failing test**

`packages/core/src/parse/pratt.test.ts`:

```ts
import { expect, test } from "bun:test";
import { NoCandidateError, UnitParseError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "./candidates";
import { lex } from "./lex";
import { parse } from "./pratt";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const en = defineLocale({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in", "to", "as"] },
});
const registry = buildRegistry([number, length]);
const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });

const ast = (input: string) => parse(lex(input, en), resolver, input);

test("a bare number parses to a number node", () => {
  expect(ast("42")).toMatchObject({ type: "number" });
});

test("a number followed by a unit parses to a quantity node", () => {
  const node = ast("10 km");
  expect(node).toMatchObject({ type: "quantity" });
  if (node.type !== "quantity") throw new Error("unreachable");
  expect(node.candidates.map((c) => c.unit)).toEqual(["km"]);
});

test("addition is left-associative", () => {
  const node = ast("1 + 2 + 3");
  expect(node).toMatchObject({ type: "binary", op: "+" });
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.left).toMatchObject({ type: "binary", op: "+" });
});

test("multiplication binds tighter than addition", () => {
  const node = ast("1 + 2 * 3");
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.op).toBe("+");
  expect(node.right).toMatchObject({ type: "binary", op: "*" });
});

test("parens override precedence", () => {
  const node = ast("(1 + 2) * 3");
  if (node.type !== "binary") throw new Error("unreachable");
  expect(node.op).toBe("*");
  expect(node.left).toMatchObject({ type: "binary", op: "+" });
});

test("unary minus parses", () => {
  expect(ast("-5")).toMatchObject({ type: "unary", op: "-" });
});

test("the in keyword produces a convert node", () => {
  const node = ast("10 km in m");
  expect(node).toMatchObject({ type: "convert" });
  if (node.type !== "convert") throw new Error("unreachable");
  expect(node.target.map((c) => c.unit)).toEqual(["m"]);
});

test("convert binds loosest, so arithmetic on the left is grouped first", () => {
  const node = ast("1 km + 500 m in m");
  if (node.type !== "convert") throw new Error("unreachable");
  expect(node.operand).toMatchObject({ type: "binary", op: "+" });
});

test("an unknown unit word throws NoCandidateError", () => {
  expect(() => ast("10 zork")).toThrow(NoCandidateError);
});

test("an empty input throws UnitParseError", () => {
  expect(() => ast("")).toThrow(UnitParseError);
});

test("a trailing operator throws UnitParseError", () => {
  expect(() => ast("10 km +")).toThrow(UnitParseError);
});

test("an unclosed paren throws UnitParseError", () => {
  expect(() => ast("(1 + 2")).toThrow(UnitParseError);
});

test("nodes carry spans back to the source", () => {
  const node = ast("10 km");
  expect(node.span).toEqual({ start: 0, end: 5 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/parse/pratt.test.ts`
Expected: FAIL — `Cannot find module './pratt'`.

- [ ] **Step 3: Write ast.ts**

`packages/core/src/parse/ast.ts`:

```ts
import type { Decimal } from "../decimal";
import type { Candidate, OpSymbol, Span } from "../types";

export interface NumberNode {
  type: "number";
  value: Decimal;
  span: Span;
}

export interface QuantityNode {
  type: "quantity";
  value: Decimal;
  candidates: Candidate[];
  span: Span;
}

export interface BinaryNode {
  type: "binary";
  op: Exclude<OpSymbol, "in">;
  left: Node;
  right: Node;
  span: Span;
}

export interface UnaryNode {
  type: "unary";
  op: "-";
  operand: Node;
  span: Span;
}

export interface ConvertNode {
  type: "convert";
  operand: Node;
  target: Candidate[];
  span: Span;
}

export type Node = NumberNode | QuantityNode | BinaryNode | UnaryNode | ConvertNode;

export function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  switch (node.type) {
    case "binary":
      walk(node.left, visit);
      walk(node.right, visit);
      break;
    case "unary":
      walk(node.operand, visit);
      break;
    case "convert":
      walk(node.operand, visit);
      break;
    default:
      break;
  }
}
```

- [ ] **Step 4: Write pratt.ts**

`packages/core/src/parse/pratt.ts`:

```ts
import { NoCandidateError, UnitParseError } from "../errors";
import type { OpSymbol, Span } from "../types";
import type { Node } from "./ast";
import type { Resolver } from "./candidates";
import type { Token } from "./lex";

const BINDING: Record<Exclude<OpSymbol, "in">, number> = { "+": 10, "-": 10, "*": 20, "/": 20 };
const CONVERT_BINDING = 5;

export function parse(tokens: Token[], resolver: Resolver, input: string): Node {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const span = (a: Span, b: Span): Span => ({ start: a.start, end: b.end });

  function parseAtom(): Node {
    const token = peek();
    if (token === undefined) throw new UnitParseError(input);

    if (token.type === "lparen") {
      pos += 1;
      const inner = parseExpr(0);
      const close = peek();
      if (close === undefined || close.type !== "rparen") throw new UnitParseError(input);
      pos += 1;
      return inner;
    }

    if (token.type === "op" && token.op === "-") {
      pos += 1;
      const operand = parseExpr(30);
      return { type: "unary", op: "-", operand, span: span(token, operand.span) };
    }

    if (token.type === "number") {
      pos += 1;
      const next = peek();
      if (next !== undefined && next.type === "word") {
        const candidates = resolver.resolve(next.text);
        if (candidates.length === 0) {
          throw new NoCandidateError(input, next.text, resolver.nearest(next.text), [next]);
        }
        pos += 1;
        return { type: "quantity", value: token.value, candidates, span: span(token, next) };
      }
      return { type: "number", value: token.value, span: { start: token.start, end: token.end } };
    }

    throw new UnitParseError(input);
  }

  function parseExpr(minBinding: number): Node {
    let left = parseAtom();

    for (;;) {
      const token = peek();
      if (token === undefined) break;

      if (token.type === "keyword" && (token.keyword === "in" || token.keyword === "to" || token.keyword === "as")) {
        if (CONVERT_BINDING < minBinding) break;
        pos += 1;
        const unit = peek();
        if (unit === undefined || unit.type !== "word") throw new UnitParseError(input);
        const target = resolver.resolve(unit.text);
        if (target.length === 0) {
          throw new NoCandidateError(input, unit.text, resolver.nearest(unit.text), [unit]);
        }
        pos += 1;
        left = { type: "convert", operand: left, target, span: span(left.span, unit) };
        continue;
      }

      if (token.type !== "op") break;
      const binding = BINDING[token.op as Exclude<OpSymbol, "in">];
      if (binding === undefined || binding < minBinding) break;

      pos += 1;
      const right = parseExpr(binding + 1);
      left = {
        type: "binary",
        op: token.op as Exclude<OpSymbol, "in">,
        left,
        right,
        span: span(left.span, right.span),
      };
    }

    return left;
  }

  const node = parseExpr(0);
  if (pos !== tokens.length) throw new UnitParseError(input);
  return node;
}
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/core/src/parse/pratt.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parse/ast.ts packages/core/src/parse/pratt.ts packages/core/src/parse/pratt.test.ts
git commit -m "feat(core): add AST and Pratt parser with candidate sets preserved"
```

---

## Task 10: Solver

**Files:**
- Create: `packages/core/src/solve/solver.ts`, `packages/core/src/solve/solver.test.ts`

**Interfaces:**
- Consumes: `Node` (Task 9), `Registry`/`opKey` (Task 4).
- Produces:
  - `interface Assignment { choices: Map<Node, Candidate>; kind: KindId; score: number; confidence: number }`
  - `solve(root: Node, registry: Registry, opts: { maxCandidates: number; kinds?: KindId[]; input: string }): Assignment[]` — sorted by descending confidence, ties broken by kind id then unit. Throws `TooAmbiguousError` when the search space exceeds `maxCandidates`, and `DimensionMismatchError` when no assignment type-checks.
  - `CONTEXT_BONUS = 30` exported for tests.

- [ ] **Step 1: Write the failing test**

`packages/core/src/solve/solver.test.ts`:

```ts
import { expect, test } from "bun:test";
import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { parse } from "../parse/pratt";
import { solve } from "./solver";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m"], km: ["km"] },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60, h: 3600 } },
  lexicon: { min: ["min", "m"], h: ["h"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: { in: ["in"] } });
const registry = buildRegistry([number, length, duration]);

function run(input: string, layers: Parameters<typeof createResolver>[0]["layers"] = []) {
  const resolver = createResolver({ registry, locale: en, packs: [], layers });
  const node = parse(lex(input, en), resolver, input);
  return { node, assignments: solve(node, registry, { maxCandidates: 10_000, input }) };
}

test("an unambiguous input yields one assignment at confidence 1", () => {
  const { assignments } = run("10 km");
  expect(assignments).toHaveLength(1);
  expect(assignments[0]?.kind).toBe("length");
  expect(assignments[0]?.confidence).toBeCloseTo(1, 10);
});

test("an ambiguous token yields both assignments", () => {
  const { assignments } = run("10 m");
  expect(assignments.map((a) => a.kind).sort()).toEqual(["duration", "length"]);
});

test("context resolves ambiguity: 10 m + 5 h is a duration", () => {
  const { assignments } = run("10 m + 5 h");
  expect(assignments[0]?.kind).toBe("duration");
});

test("context resolves ambiguity the other way: 10 m + 5 km is a length", () => {
  const { assignments } = run("10 m + 5 km");
  expect(assignments[0]?.kind).toBe("length");
});

test("a cross-kind expression with no signature throws", () => {
  expect(() => run("10 km + 5 h")).toThrow(DimensionMismatchError);
});

test("weights flip an ambiguous result", () => {
  const { assignments } = run("10 m", [{ "duration:min": 999 }]);
  expect(assignments[0]?.kind).toBe("duration");
  const flipped = run("10 m", [{ "length:m": 999 }]).assignments;
  expect(flipped[0]?.kind).toBe("length");
});

test("confidences form a softmax and sum to 1", () => {
  const { assignments } = run("10 m");
  const total = assignments.reduce((s, a) => s + a.confidence, 0);
  expect(total).toBeCloseTo(1, 10);
});

test("scaling by a number type-checks", () => {
  const { assignments } = run("10 km * 3");
  expect(assignments[0]?.kind).toBe("length");
});

test("conversion type-checks and takes the target unit's kind", () => {
  const { assignments } = run("10 km in m");
  expect(assignments[0]?.kind).toBe("length");
});

test("exceeding maxCandidates throws TooAmbiguousError", () => {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const input = "1 m + 1 m + 1 m + 1 m";
  const node = parse(lex(input, en), resolver, input);
  expect(() => solve(node, registry, { maxCandidates: 4, input })).toThrow(TooAmbiguousError);
});

test("the kinds filter drops candidates outside the allowed set", () => {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const input = "10 m";
  const node = parse(lex(input, en), resolver, input);
  const assignments = solve(node, registry, {
    maxCandidates: 10_000,
    kinds: ["length"],
    input,
  });
  expect(assignments).toHaveLength(1);
  expect(assignments[0]?.kind).toBe("length");
});

test("ranking is stable across repeated runs", () => {
  const first = run("10 m").assignments.map((a) => `${a.kind}`);
  const second = run("10 m").assignments.map((a) => `${a.kind}`);
  expect(first).toEqual(second);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: FAIL — `Cannot find module './solver'`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/solve/solver.ts`:

```ts
import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { NUMBER_KIND, type Registry, opKey } from "../kind/registry";
import type { Node } from "../parse/ast";
import { walk } from "../parse/ast";
import type { Candidate, KindId } from "../types";

export const CONTEXT_BONUS = 30;

export interface Assignment {
  choices: Map<Node, Candidate>;
  kind: KindId;
  score: number;
  confidence: number;
}

interface Slot {
  node: Node;
  candidates: Candidate[];
}

function collectSlots(root: Node, kinds: KindId[] | undefined): Slot[] {
  const slots: Slot[] = [];
  walk(root, (node) => {
    if (node.type === "quantity") {
      const filtered =
        kinds === undefined ? node.candidates : node.candidates.filter((c) => kinds.includes(c.kind));
      slots.push({ node, candidates: filtered });
    } else if (node.type === "convert") {
      const filtered =
        kinds === undefined ? node.target : node.target.filter((c) => kinds.includes(c.kind));
      slots.push({ node, candidates: filtered });
    }
  });
  return slots;
}

/** Returns the kind of `node` under `choices`, or null when no op signature applies. */
function typeOf(node: Node, choices: Map<Node, Candidate>, registry: Registry): KindId | null {
  switch (node.type) {
    case "number":
      return NUMBER_KIND;
    case "quantity":
      return choices.get(node)?.kind ?? null;
    case "unary":
      return typeOf(node.operand, choices, registry);
    case "convert": {
      const operand = typeOf(node.operand, choices, registry);
      const target = choices.get(node);
      if (operand === null || target === undefined) return null;
      return registry.ops.has(opKey("in", operand, target.kind)) ? target.kind : null;
    }
    case "binary": {
      const left = typeOf(node.left, choices, registry);
      const right = typeOf(node.right, choices, registry);
      if (left === null || right === null) return null;
      return registry.ops.get(opKey(node.op, left, right))?.result ?? null;
    }
  }
}

function contextBonus(node: Node, choices: Map<Node, Candidate>, registry: Registry): number {
  let bonus = 0;
  walk(node, (n) => {
    if (n.type !== "binary") return;
    const left = typeOf(n.left, choices, registry);
    const right = typeOf(n.right, choices, registry);
    if (left !== null && left === right && left !== NUMBER_KIND) bonus += CONTEXT_BONUS;
  });
  return bonus;
}

function softmax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

export function solve(
  root: Node,
  registry: Registry,
  opts: { maxCandidates: number; kinds?: KindId[]; input: string },
): Assignment[] {
  const slots = collectSlots(root, opts.kinds);

  const space = slots.reduce((n, s) => n * Math.max(s.candidates.length, 1), 1);
  if (space > opts.maxCandidates) {
    throw new TooAmbiguousError(opts.input, space, opts.maxCandidates);
  }

  const viable: Array<{ choices: Map<Node, Candidate>; kind: KindId; score: number }> = [];

  const enumerate = (index: number, choices: Map<Node, Candidate>, weight: number): void => {
    if (index === slots.length) {
      const kind = typeOf(root, choices, registry);
      if (kind === null) return;
      viable.push({
        choices: new Map(choices),
        kind,
        score: weight + contextBonus(root, choices, registry),
      });
      return;
    }
    const slot = slots[index];
    if (slot === undefined) return;
    for (const candidate of slot.candidates) {
      choices.set(slot.node, candidate);
      enumerate(index + 1, choices, weight + candidate.weight);
      choices.delete(slot.node);
    }
  };

  enumerate(0, new Map(), 0);

  if (viable.length === 0) {
    const first = slots[0]?.candidates[0]?.kind ?? "unknown";
    const second = slots[1]?.candidates[0]?.kind ?? "unknown";
    throw new DimensionMismatchError(opts.input, "operation", first, second);
  }

  viable.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      [...a.choices.values()].map((c) => c.unit).join().localeCompare(
        [...b.choices.values()].map((c) => c.unit).join(),
      ),
  );

  const confidences = softmax(viable.map((v) => v.score));
  return viable.map((v, i) => ({ ...v, confidence: confidences[i] ?? 0 }));
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/solve/solver.ts packages/core/src/solve/solver.test.ts
git commit -m "feat(core): add scored solver with softmax confidence"
```

---

## Task 11: Conversion and evaluation

**Files:**
- Create: `packages/core/src/eval/convert.ts`, `packages/core/src/eval/convert.test.ts`
- Create: `packages/core/src/eval/evaluate.ts`, `packages/core/src/eval/evaluate.test.ts`

**Interfaces:**
- Consumes: `NormalizedKind` (Task 3), `Registry` (Task 4), `Node` (Task 9), `Assignment` (Task 10).
- Produces:
  - `toCanonical(value: Decimal, kind: NormalizedKind, unit: string, locale: string, meta?: Record<string, unknown>): Decimal`
  - `fromCanonical(canonical: Decimal, kind: NormalizedKind, unit: string, locale: string, meta?: Record<string, unknown>): Decimal`
  - `evaluateNode(node: Node, assignment: Assignment, registry: Registry, locale: string, input: string): Value`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/eval/convert.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind, normalizeKind } from "../kind/define";
import { fromCanonical, toCanonical } from "./convert";

const length = normalizeKind(
  defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000, cm: 0.01 } },
  }),
);

const temp = normalizeKind(
  defineKind({
    id: "temperature",
    value: { mode: "ratio", canonical: "c", units: { c: 1, f: { ratio: 5 / 9, offset: -32 } } },
  }),
);

const measure = normalizeKind(
  defineKind({
    id: "measure",
    value: {
      mode: "ratio",
      canonical: "inch",
      units: { inch: 1, px: { ratio: (c) => new Decimal(1).div((c.self.meta?.dpi as number) ?? 96) } },
    },
  }),
);

test("converts a unit to canonical", () => {
  expect(toCanonical(new Decimal(2), length, "km", "en").toString()).toBe("2000");
});

test("converts canonical back to a unit", () => {
  expect(fromCanonical(new Decimal(2000), length, "km", "en").toString()).toBe("2");
});

test("round-trips through an unrelated unit", () => {
  const canonical = toCanonical(new Decimal(150), length, "cm", "en");
  expect(fromCanonical(canonical, length, "m", "en").toString()).toBe("1.5");
});

test("applies the affine offset before the ratio", () => {
  // 212F -> (212 - 32) * 5/9 = 100C
  expect(toCanonical(new Decimal(212), temp, "f", "en").toString()).toBe("100");
});

test("reverses the affine offset on the way out", () => {
  expect(fromCanonical(new Decimal(100), temp, "f", "en").toString()).toBe("212");
});

test("a function ratio reads dpi from the value's meta", () => {
  expect(toCanonical(new Decimal(300), measure, "px", "en", { dpi: 300 }).toString()).toBe("1");
  expect(toCanonical(new Decimal(96), measure, "px", "en").toString()).toBe("1");
});
```

`packages/core/src/eval/evaluate.test.ts`:

```ts
import { expect, test } from "bun:test";
import { DivideByZeroError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { createResolver } from "../parse/candidates";
import { lex } from "../parse/lex";
import { parse } from "../parse/pratt";
import { solve } from "../solve/solver";
import { evaluateNode } from "./evaluate";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m"], km: ["km"] },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { s: 1, min: 60, h: 3600 } },
  lexicon: { min: ["min", "m"], h: ["h"], s: ["s"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: { in: ["in"] } });
const registry = buildRegistry([number, length, duration]);

function evaluate(input: string) {
  const resolver = createResolver({ registry, locale: en, packs: [], layers: [] });
  const node = parse(lex(input, en), resolver, input);
  const [best] = solve(node, registry, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");
  return evaluateNode(node, best, registry, "en", input);
}

test("evaluates a single quantity in its authored unit", () => {
  const v = evaluate("10 km");
  expect(v.kind).toBe("length");
  expect(v.unit).toBe("km");
  expect(v.canonical.toString()).toBe("10000");
});

test("addition keeps the left operand's unit", () => {
  const v = evaluate("1 km + 500 m");
  expect(v.unit).toBe("km");
  expect(v.canonical.toString()).toBe("1500");
});

test("subtraction across duration units", () => {
  const v = evaluate("30 h - 30 min");
  expect(v.unit).toBe("h");
  expect(v.canonical.toString()).toBe("106200");
});

test("context-resolved ambiguity evaluates as duration", () => {
  const v = evaluate("10 m + 5 h");
  expect(v.kind).toBe("duration");
  expect(v.canonical.toString()).toBe("18600");
});

test("scaling by a number", () => {
  expect(evaluate("10 km * 3").canonical.toString()).toBe("30000");
});

test("conversion rebases the unit without changing the quantity", () => {
  const v = evaluate("2 km in m");
  expect(v.unit).toBe("m");
  expect(v.canonical.toString()).toBe("2000");
});

test("unary minus negates", () => {
  expect(evaluate("-5 km").canonical.toString()).toBe("-5000");
});

test("plain arithmetic on numbers", () => {
  expect(evaluate("(1 + 2) * 3").canonical.toString()).toBe("9");
});

test("division by zero throws", () => {
  expect(() => evaluate("10 km / 0")).toThrow(DivideByZeroError);
});

test("values are frozen", () => {
  expect(Object.isFrozen(evaluate("10 km"))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/eval/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write convert.ts**

`packages/core/src/eval/convert.ts`:

```ts
import { Decimal } from "../decimal";
import type { NormalizedKind } from "../kind/define";
import type { EvalCtx, Value } from "../types";

function ctxFor(
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta: Record<string, unknown> | undefined,
): EvalCtx {
  const self: Value = {
    kind: kind.id,
    canonical: new Decimal(0),
    unit,
    ...(meta ? { meta } : {}),
  };
  return { self, locale };
}

export function toCanonical(
  value: Decimal,
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta?: Record<string, unknown>,
): Decimal {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  const ctx = ctxFor(kind, unit, locale, meta);
  return value.plus(def.offset(ctx)).times(def.ratio(ctx));
}

export function fromCanonical(
  canonical: Decimal,
  kind: NormalizedKind,
  unit: string,
  locale: string,
  meta?: Record<string, unknown>,
): Decimal {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  const ctx = ctxFor(kind, unit, locale, meta);
  return canonical.div(def.ratio(ctx)).minus(def.offset(ctx));
}
```

- [ ] **Step 4: Write evaluate.ts**

`packages/core/src/eval/evaluate.ts`:

```ts
import { Decimal } from "../decimal";
import { DimensionMismatchError, DivideByZeroError } from "../errors";
import { NUMBER_KIND, type Registry, opKey } from "../kind/registry";
import type { Node } from "../parse/ast";
import type { Assignment } from "../solve/solver";
import type { EvalCtx, Value } from "../types";
import { toCanonical } from "./convert";

export function evaluateNode(
  node: Node,
  assignment: Assignment,
  registry: Registry,
  locale: string,
  input: string,
): Value {
  const ctxFor = (self: Value): EvalCtx => ({ self, locale });

  const evalNode = (n: Node): Value => {
    switch (n.type) {
      case "number":
        return Object.freeze({ kind: NUMBER_KIND, canonical: n.value, unit: "one" });

      case "quantity": {
        const choice = assignment.choices.get(n);
        if (choice === undefined) throw new DimensionMismatchError(input, "quantity", "?", "?");
        const kind = registry.kinds.get(choice.kind);
        if (kind === undefined) throw new DimensionMismatchError(input, "quantity", choice.kind, "?");
        return Object.freeze({
          kind: choice.kind,
          canonical: toCanonical(n.value, kind, choice.unit, locale),
          unit: choice.unit,
        });
      }

      case "unary": {
        const operand = evalNode(n.operand);
        return Object.freeze({ ...operand, canonical: operand.canonical.negated() });
      }

      case "convert": {
        const operand = evalNode(n.operand);
        const target = assignment.choices.get(n);
        if (target === undefined) throw new DimensionMismatchError(input, "in", operand.kind, "?");
        const sig = registry.ops.get(opKey("in", operand.kind, target.kind));
        if (sig === undefined) throw new DimensionMismatchError(input, "in", operand.kind, target.kind);
        const rhs: Value = Object.freeze({
          kind: target.kind,
          canonical: new Decimal(0),
          unit: target.unit,
        });
        return Object.freeze(sig.apply(operand, rhs, ctxFor(operand)));
      }

      case "binary": {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        if (n.op === "/" && right.canonical.isZero()) throw new DivideByZeroError(input);
        const sig = registry.ops.get(opKey(n.op, left.kind, right.kind));
        if (sig === undefined) throw new DimensionMismatchError(input, n.op, left.kind, right.kind);
        return Object.freeze(sig.apply(left, right, ctxFor(left)));
      }
    }
  };

  return evalNode(node);
}
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/core/src/eval/`
Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/eval
git commit -m "feat(core): add unit conversion and AST evaluation"
```

---

## Task 12: Formatting

**Files:**
- Create: `packages/core/src/format/format.ts`, `packages/core/src/format/format.test.ts`

**Interfaces:**
- Consumes: `Registry` (Task 4), `fromCanonical` (Task 11).
- Produces: `formatValue(value: Value, registry: Registry, locale: string): string`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/format/format.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import type { Value } from "../types";
import { formatValue } from "./format";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
  lexicon: {
    kg: { aliases: ["kg"], symbol: "kg", display: { one: "kilogram", other: "kilograms" } },
    g: { aliases: ["g"], symbol: "g" },
  },
});

const registry = buildRegistry([number, mass]);
const value = (canonical: string, unit: string): Value =>
  Object.freeze({ kind: "mass", canonical: new Decimal(canonical), unit });

test("formats using the authored unit's symbol", () => {
  expect(formatValue(value("1500", "kg"), registry, "en")).toBe("1.5kg");
});

test("uses the plural display form when the number selects it", () => {
  const mass2 = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
    lexicon: { kg: { aliases: ["kg"], display: { one: "kilogram", other: "kilograms" } } },
  });
  const r = buildRegistry([number, mass2]);
  expect(formatValue(value("1000", "kg"), r, "en")).toBe("1 kilogram");
  expect(formatValue(value("3000", "kg"), r, "en")).toBe("3 kilograms");
});

test("falls back to the symbol when no display form covers the category", () => {
  expect(formatValue(value("3000", "g"), registry, "en")).toBe("3000g");
});

test("formats a plain number without a unit", () => {
  const v: Value = Object.freeze({ kind: "number", canonical: new Decimal("9"), unit: "one" });
  expect(formatValue(v, registry, "en")).toBe("9");
});

test("uses the locale's number grammar", () => {
  expect(formatValue(value("1500500", "kg"), registry, "de")).toBe("1.500,5kg");
});

test("does not print floating point noise", () => {
  expect(formatValue(value("100", "kg"), registry, "en")).toBe("0.1kg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/format/format.test.ts`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/format/format.ts`:

```ts
import { fromCanonical } from "../eval/convert";
import { NUMBER_KIND, type Registry } from "../kind/registry";
import type { Value } from "../types";

function formatNumber(text: string, locale: string): string {
  // Intl cannot take a Decimal, and Number() would lose precision on long values,
  // so reformat the digit string by hand using the locale's own symbols.
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";

  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [intPart = "0", fracPart] = body.split(".");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const joined = fracPart === undefined ? grouped : `${grouped}${decimal}${fracPart}`;
  return negative ? `-${joined}` : joined;
}

export function formatValue(value: Value, registry: Registry, locale: string): string {
  const kind = registry.kinds.get(value.kind);
  if (kind === undefined) return value.canonical.toString();
  if (kind.format !== undefined) return kind.format(value, { locale });

  const authored =
    kind.spec.mode === "ratio"
      ? fromCanonical(value.canonical, kind, value.unit, locale, value.meta as Record<string, unknown>)
      : value.canonical;

  const numberText = formatNumber(authored.toString(), locale);
  if (value.kind === NUMBER_KIND) return numberText;

  const unit = kind.units.get(value.unit);
  const lexeme = unit?.lexeme;
  const category = new Intl.PluralRules(locale).select(authored.toNumber());
  const display = lexeme?.display?.[category];

  if (display !== undefined) return `${numberText} ${display}`;
  return `${numberText}${lexeme?.symbol ?? value.unit}`;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/core/src/format/format.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/format
git commit -m "feat(core): add value formatting with Intl.PluralRules"
```

---

## Task 13: Built-in kinds and the English locale

**Files:**
- Create: `packages/core/src/kinds/number.ts`, `length.ts`, `mass.ts`, `duration.ts`
- Create: `packages/core/src/kinds/index.ts`, `packages/core/src/kinds/kinds.test.ts`
- Create: `packages/core/src/locale/en.ts`

**Interfaces:**
- Consumes: `defineKind` (Task 3), `defineLocale`, `suffixStripper`, `identity` (Task 5).
- Produces: `number`, `length`, `mass`, `duration` kinds; `BUILTIN_KINDS: Kind[]`; the default export of `src/locale/en.ts` as the English `Locale`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/kinds/kinds.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { BUILTIN_KINDS } from "./index";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");

test("all four M1 kinds are registered", () => {
  expect([...registry.kinds.keys()].sort()).toEqual(["duration", "length", "mass", "number"]);
});

test("m is ambiguous between length and duration", () => {
  expect(registry.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min" },
    { kind: "length", unit: "m" },
  ]);
});

test("canonical ratios are correct", () => {
  const length = registry.kinds.get("length");
  const self = { kind: "length", canonical: new Decimal(0), unit: "km" };
  expect(length?.units.get("km")?.ratio({ self, locale: "en" }).toString()).toBe("1000");
});

test("imperial length units are present", () => {
  for (const unit of ["in", "ft", "yd", "mi"]) {
    expect(registry.kinds.get("length")?.units.has(unit)).toBe(true);
  }
});

test("imperial mass units are present", () => {
  for (const unit of ["oz", "lb"]) {
    expect(registry.kinds.get("mass")?.units.has(unit)).toBe(true);
  }
});

test("duration covers ms through weeks", () => {
  for (const unit of ["ms", "s", "min", "h", "d", "wk"]) {
    expect(registry.kinds.get("duration")?.units.has(unit)).toBe(true);
  }
});

test("the English locale declares conversion keywords", () => {
  expect(en.keywords.in).toContain("in");
  expect(en.keywords.in).toContain("to");
  expect(en.keywords.in).toContain("as");
});

test("the English analyzer chain strips regular plurals", () => {
  expect(registry.aliasIndex.has("kilogram")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/kinds/kinds.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the kinds**

`packages/core/src/kinds/number.ts`:

```ts
import { defineKind } from "../kind/define";

export const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
  lexicon: { one: { aliases: [], symbol: "" } },
});
```

`packages/core/src/kinds/length.ts`:

```ts
import { defineKind } from "../kind/define";

export const length = defineKind({
  id: "length",
  value: {
    mode: "ratio",
    canonical: "m",
    units: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    },
  },
  lexicon: {
    mm: { aliases: ["mm", "millimetre", "millimeter"], symbol: "mm" },
    cm: { aliases: ["cm", "centimetre", "centimeter"], symbol: "cm" },
    m: { aliases: ["m", "metre", "meter"], symbol: "m" },
    km: { aliases: ["km", "kilometre", "kilometer"], symbol: "km" },
    in: { aliases: ["inch"], symbol: "in" },
    ft: { aliases: ["ft", "foot", "feet"], symbol: "ft" },
    yd: { aliases: ["yd", "yard"], symbol: "yd" },
    mi: { aliases: ["mi", "mile"], symbol: "mi" },
  },
});
```

Note `in` deliberately does **not** list `"in"` as an alias — `in` is a conversion keyword in English, and the lexer emits it as a keyword token before the resolver ever sees it. `"inch"` is the alias that works.

`packages/core/src/kinds/mass.ts`:

```ts
import { defineKind } from "../kind/define";

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: "g",
    units: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 },
  },
  lexicon: {
    mg: { aliases: ["mg", "milligram"], symbol: "mg" },
    g: { aliases: ["g", "gram"], symbol: "g" },
    kg: {
      aliases: ["kg", "kilo", "kilogram"],
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
    },
    t: { aliases: ["t", "tonne"], symbol: "t" },
    oz: { aliases: ["oz", "ounce"], symbol: "oz" },
    lb: { aliases: ["lb", "lbs", "pound"], symbol: "lb" },
  },
});
```

`packages/core/src/kinds/duration.ts`:

```ts
import { defineKind } from "../kind/define";

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: "s",
    units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
  },
  lexicon: {
    ms: { aliases: ["ms", "millisecond"], symbol: "ms" },
    s: { aliases: ["s", "sec", "second"], symbol: "s" },
    min: { aliases: ["min", "m", "minute"], symbol: "min" },
    h: { aliases: ["h", "hr", "hour"], symbol: "h" },
    d: { aliases: ["d", "day"], symbol: "d" },
    wk: { aliases: ["wk", "week"], symbol: "wk" },
  },
});
```

`packages/core/src/kinds/index.ts`:

```ts
import type { Kind } from "../types";
import { duration } from "./duration";
import { length } from "./length";
import { mass } from "./mass";
import { number } from "./number";

export { duration, length, mass, number };

export const BUILTIN_KINDS: Kind[] = [number, length, mass, duration];
```

- [ ] **Step 4: Write the English locale**

`packages/core/src/locale/en.ts`:

```ts
import { defineLocale } from "./define";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

export default defineLocale({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    // Regular plurals: metres -> metre, inches -> inche (harmless: no such alias),
    // kilograms -> kilogram. Penalised so an exact alias always wins.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
    tableAnalyzer({ feet: "foot", inches: "inch" }, -1),
  ],
  keywords: {
    in: ["in", "to", "as"],
    plus: ["plus"],
    minus: ["minus"],
    of: ["of"],
  },
});
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/core/src/kinds/kinds.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/kinds packages/core/src/locale/en.ts
git commit -m "feat(core): add number, length, mass and duration kinds with en locale"
```

---

## Task 14: createEngine, corpus and property tests

**Files:**
- Create: `packages/core/src/engine.ts`, `packages/core/src/engine.test.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/testing/index.ts`
- Create: `packages/core/corpus/en.tsv`, `packages/core/src/corpus.test.ts`
- Create: `packages/core/src/properties.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–13.
- Produces: `createEngine(opts: EngineOptions): Engine` with `evaluate`, `suggest`, `coerce`, `explain`; `assertKindContract(kind: Kind)`; the public `src/index.ts` surface.

- [ ] **Step 1: Write the failing engine test**

`packages/core/src/engine.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "./engine";
import { AmbiguityError, DimensionMismatchError, NoCandidateError } from "./errors";
import { defineKind } from "./kind/define";
import { BUILTIN_KINDS } from "./kinds/index";
import en from "./locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

test("evaluate returns a formatted result for an unambiguous input", () => {
  const r = engine.evaluate("1 kg + 500 g");
  expect(r.kind).toBe("mass");
  expect(r.formatted).toBe("1.5kg");
});

test("evaluate resolves ambiguity from context", () => {
  expect(engine.evaluate("10 m + 5 h").kind).toBe("duration");
  expect(engine.evaluate("10 m + 5 km").kind).toBe("length");
});

test("evaluate throws AmbiguityError on a genuine tie", () => {
  expect(() => engine.evaluate("10 m")).toThrow(AmbiguityError);
});

test("weights break the tie", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m").kind).toBe("length");
});

test("per-call weights override engine weights", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { "length:m": 10 },
  });
  expect(biased.evaluate("10 m", { weights: { "duration:min": 20 } }).kind).toBe("duration");
});

test("tiebreak first resolves instead of throwing", () => {
  const stable = createEngine({ locales: [en], kinds: BUILTIN_KINDS, tiebreak: "first" });
  expect(stable.evaluate("10 m").kind).toBe("duration");
});

test("suggest never throws and returns ranked results", () => {
  const results = engine.suggest("10 m");
  expect(results).toHaveLength(2);
  expect(results[0]?.confidence).toBeGreaterThanOrEqual(results[1]?.confidence ?? 0);
});

test("suggest returns an empty array for unparseable input", () => {
  expect(engine.suggest("!!!")).toEqual([]);
  expect(engine.suggest("10 zork")).toEqual([]);
});

test("coerce filters candidates to the requested kind", () => {
  const v = engine.coerce("length", "10 m");
  expect(v.kind).toBe("length");
  expect(v.canonical.toString()).toBe("10");
});

test("coerce throws when no candidate matches the kind", () => {
  expect(() => engine.coerce("mass", "10 m")).toThrow(NoCandidateError);
});

test("mismatched dimensions throw", () => {
  expect(() => engine.evaluate("5 kg + 3 km")).toThrow(DimensionMismatchError);
});

test("an unknown unit throws NoCandidateError with suggestions", () => {
  try {
    engine.evaluate("10 kgg");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(NoCandidateError);
    expect((e as NoCandidateError).nearest).toContain("kg");
  }
});

test("explain exposes tokens, candidates and weight contributions", () => {
  const x = engine.explain("10 m");
  expect(x.tokens).toHaveLength(2);
  expect(x.candidates.map((c) => `${c.kind}:${c.unit}`).sort()).toEqual([
    "duration:min",
    "length:m",
  ]);
  expect(x.assignments[0]?.contributions.length).toBeGreaterThan(0);
});

test("results carry spans and confidence", () => {
  const r = engine.evaluate("1 kg + 500 g");
  expect(r.spans.length).toBeGreaterThan(0);
  expect(r.confidence).toBeGreaterThan(0);
});

test("a custom five-line kind works end to end", () => {
  const datasize = defineKind({
    id: "datasize",
    value: { mode: "ratio", canonical: "b", units: { b: 1, kb: 1e3, kib: 1024, mib: 1024 ** 2 } },
  });
  const e = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, datasize] });
  expect(e.evaluate("2 mib + 500 kb in kb").formatted).toBe("2,597.152kb");
});

test("engines with different locales coexist", () => {
  const a = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  const b = createEngine({ locales: [en], kinds: BUILTIN_KINDS, weights: { "length:m": 99 } });
  expect(() => a.evaluate("10 m")).toThrow(AmbiguityError);
  expect(b.evaluate("10 m").kind).toBe("length");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/engine.test.ts`
Expected: FAIL — `Cannot find module './engine'`.

- [ ] **Step 3: Write engine.ts**

`packages/core/src/engine.ts`:

```ts
import { evaluateNode } from "./eval/evaluate";
import { AmbiguityError, NoCandidateError, SmartputError, UnitParseError } from "./errors";
import { formatValue } from "./format/format";
import { buildRegistry } from "./kind/registry";
import { normalize } from "./parse/normalize";
import { createResolver } from "./parse/candidates";
import { type Token, lex } from "./parse/lex";
import { parse } from "./parse/pratt";
import { type Assignment, solve } from "./solve/solver";
import { weightBreakdown } from "./solve/weights";
import type {
  Candidate,
  Kind,
  KindId,
  Locale,
  LocalePack,
  ResultCandidate,
  Span,
  Value,
  Weights,
} from "./types";

export interface EngineOptions {
  locales: Locale[];
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
}

export interface EvalOptions {
  kinds?: KindId[];
  weights?: Weights;
}

export interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;
  spans: Span[];
  meta: { assumptions: string[] };
}

export interface Explanation {
  input: string;
  tokens: Token[];
  candidates: Candidate[];
  assignments: Array<{
    kind: KindId;
    score: number;
    confidence: number;
    units: string[];
    contributions: Array<{ selector: string; value: number; layer: number }>;
  }>;
}

export interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
}

export function createEngine(opts: EngineOptions): Engine {
  const locale = opts.locales[0];
  if (locale === undefined) throw new Error("createEngine requires at least one locale");

  const packs = opts.packs ?? [];
  const kinds = opts.kinds ?? [];
  const registry = buildRegistry(kinds, packs, locale.id);
  const maxCandidates = opts.maxCandidates ?? 10_000;
  const epsilon = opts.ambiguityEpsilon ?? 0.05;
  const tiebreak = opts.tiebreak ?? "error";

  const layersFor = (call?: Weights) => [locale.weights, opts.weights, call];

  function pipeline(input: string, call?: EvalOptions) {
    const normalized = normalize(input);
    if (normalized.length === 0) throw new UnitParseError(input);
    const resolver = createResolver({
      registry,
      locale: locale as Locale,
      packs,
      layers: layersFor(call?.weights),
    });
    const tokens = lex(normalized, locale as Locale);
    const node = parse(tokens, resolver, input);
    const assignments = solve(node, registry, {
      maxCandidates,
      input,
      ...(call?.kinds ? { kinds: call.kinds } : {}),
    });
    return { normalized, resolver, tokens, node, assignments };
  }

  function toResult(
    node: ReturnType<typeof pipeline>["node"],
    assignment: Assignment,
    input: string,
  ): Result {
    const value = evaluateNode(node, assignment, registry, locale.id, input);
    return {
      value,
      formatted: formatValue(value, registry, locale.id),
      kind: value.kind,
      confidence: assignment.confidence,
      spans: [node.span],
      meta: { assumptions: [] },
    };
  }

  return {
    evaluate(input, call) {
      const { node, assignments } = pipeline(input, call);
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
        throw new AmbiguityError(input, listed, [node.span]);
      }

      return toResult(node, best, input);
    },

    suggest(input, call) {
      try {
        const { node, assignments } = pipeline(input, call);
        return assignments.map((a) => toResult(node, a, input));
      } catch {
        return [];
      }
    },

    coerce(kind, input, call) {
      const merged: EvalOptions = { ...call, kinds: [kind, "number"] };
      let assignments: Assignment[];
      let node: ReturnType<typeof pipeline>["node"];
      try {
        const run = pipeline(input, merged);
        assignments = run.assignments;
        node = run.node;
      } catch (e) {
        if (e instanceof NoCandidateError) throw e;
        throw new NoCandidateError(input, input, []);
      }
      const best = assignments.find((a) => a.kind === kind);
      if (best === undefined) throw new NoCandidateError(input, input, []);
      return evaluateNode(node, best, registry, locale.id, input);
    },

    explain(input, call) {
      const { tokens, node, assignments } = pipeline(input, call);
      const candidates: Candidate[] = [];
      for (const assignment of assignments) {
        for (const candidate of assignment.choices.values()) {
          if (!candidates.some((c) => c.kind === candidate.kind && c.unit === candidate.unit)) {
            candidates.push(candidate);
          }
        }
      }

      return {
        input,
        tokens,
        candidates,
        assignments: assignments.map((a) => {
          const chosen = [...a.choices.values()];
          return {
            kind: a.kind,
            score: a.score,
            confidence: a.confidence,
            units: chosen.map((c) => c.unit),
            contributions: chosen.flatMap((c) =>
              weightBreakdown({
                kind: c.kind,
                unit: c.unit,
                surface: c.surface,
                prior: registry.kinds.get(c.kind)?.prior ?? 0,
                layers: layersFor(call?.weights),
              }),
            ),
          };
        }),
      };
    },
  };
}
```

- [ ] **Step 4: Write index.ts and testing/index.ts**

`packages/core/src/index.ts`:

```ts
export { Decimal } from "./decimal";
export { createEngine } from "./engine";
export type { Engine, EngineOptions, EvalOptions, Explanation, Result } from "./engine";
export * from "./errors";
export { defineKind } from "./kind/define";
export { BUILTIN_KINDS, duration, length, mass, number } from "./kinds/index";
export { createAnalyzerChain } from "./locale/analyze";
export { defineLocale, defineLocalePack } from "./locale/define";
export { identity, suffixStripper, tableAnalyzer } from "./locale/helpers";
export type * from "./types";
```

`packages/core/src/testing/index.ts`:

```ts
import { expect } from "bun:test";
import { Decimal } from "../decimal";
import { buildRegistry } from "../kind/registry";
import type { EvalCtx, Kind } from "../types";

/**
 * Assertions every kind must satisfy. Built-in and third-party kinds run the
 * same suite — this is what keeps the extension seam honest.
 */
export function assertKindContract(kind: Kind): void {
  const registry = buildRegistry([kind]);
  const normalized = registry.kinds.get(kind.id);

  expect(normalized).toBeDefined();
  if (normalized === undefined) return;
  if (normalized.spec.mode !== "ratio") return;

  expect(normalized.units.size).toBeGreaterThan(0);
  expect(normalized.units.has(normalized.spec.canonical)).toBe(true);

  for (const [unitName, unit] of normalized.units) {
    expect(unit.lexeme.aliases.length).toBeGreaterThan(0);
    const ctx: EvalCtx = {
      self: { kind: kind.id, canonical: new Decimal(0), unit: unitName },
      locale: "en",
    };
    // A zero ratio would make the unit unconvertible in both directions.
    expect(unit.ratio(ctx).isZero()).toBe(false);
  }
}
```

- [ ] **Step 5: Run the engine tests**

Run: `bun test packages/core/src/engine.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Write the golden corpus**

`packages/core/corpus/en.tsv` — tab-separated, `#` starts a comment line:

```
# input	kind	canonical	formatted
10 km	length	10000	10km
1 kg + 500 g	mass	1500	1.5kg
30 h - 30 min	duration	106200	29.5h
10 m + 5 h	duration	18600	310min
10 m + 5 km	length	5010	5010m
2 km in m	length	2000	2000m
10 km * 3	length	30000	30km
(1 + 2) * 3	number	9	9
-5 km	length	-5000	-5km
1,500 g	mass	1500	1500g
12 inch	length	0.3048	12in
3 lbs	mass	1360.77711	3lb
2 wk	duration	1209600	2wk
1.5 kilograms	mass	1500	1.5 kilograms
```

`packages/core/src/corpus.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "./engine";
import { BUILTIN_KINDS } from "./kinds/index";
import en from "./locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, kind, canonical, formatted] of rows) {
  test(`corpus: ${input}`, () => {
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}
```

- [ ] **Step 7: Run the corpus and reconcile**

Run: `bun test packages/core/src/corpus.test.ts`
Expected: PASS. If a row fails, the corpus expectation is what to fix **only** when the engine's output is defensibly correct — otherwise fix the engine. Do not weaken a row to make it pass. Record the reasoning in the commit message for any row you change.

- [ ] **Step 8: Write the property tests**

`packages/core/src/properties.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { fromCanonical, toCanonical } from "./eval/convert";
import { buildRegistry } from "./kind/registry";
import { BUILTIN_KINDS } from "./kinds/index";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const SAMPLES = ["0", "1", "0.5", "12.25", "1000", "999999", "0.000001"];

test("conversion round-trips for every unit of every kind", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    for (const unit of kind.units.keys()) {
      for (const sample of SAMPLES) {
        const v = new Decimal(sample);
        const back = fromCanonical(toCanonical(v, kind, unit, "en"), kind, unit, "en");
        expect(back.minus(v).abs().lessThan("1e-20")).toBe(true);
      }
    }
  }
});

test("conversion is transitive across every unit pair", () => {
  for (const kind of registry.kinds.values()) {
    if (kind.spec.mode !== "ratio") continue;
    const units = [...kind.units.keys()];
    for (const a of units) {
      for (const b of units) {
        const direct = toCanonical(new Decimal("7"), kind, a, "en");
        const viaB = toCanonical(
          fromCanonical(direct, kind, b, "en"),
          kind,
          b,
          "en",
        );
        expect(viaB.minus(direct).abs().lessThan("1e-18")).toBe(true);
      }
    }
  }
});

test("every alias in the index resolves back to a registered unit", () => {
  for (const [, entries] of registry.aliasIndex) {
    for (const entry of entries) {
      expect(registry.kinds.get(entry.kind)?.units.has(entry.unit)).toBe(true);
    }
  }
});

test("every kind satisfies the kind contract", async () => {
  const { assertKindContract } = await import("./testing/index");
  for (const kind of BUILTIN_KINDS) assertKindContract(kind);
});
```

- [ ] **Step 9: Run the full check**

Run: `bun run check`
Expected: Biome clean, `tsc` clean, dependency guard passes, all tests pass.

Fix any Biome or `tsc` complaints now — do not commit with a failing `check`.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/index.ts packages/core/src/testing packages/core/corpus packages/core/src/engine.test.ts packages/core/src/corpus.test.ts packages/core/src/properties.test.ts
git commit -m "feat(core): add createEngine, golden corpus and property tests"
```

---

## Self-Review

**Spec coverage.** Every M1 item in spec §11 maps to a task: contracts (T2), registry (T4), lexer (T6), Pratt parser (T9), solver (T10), layered weights (T7), softmax confidence (T10), `explain()` (T14), kinds number/length/mass/duration (T13), locale en (T13). The analyzer pipeline (§4.6) lands in T5 and T13 even though it is nominally M5 work — the locale type cannot be defined twice, and English plural stripping exercises it immediately. `suggest`, `coerce`, `tiebreak`, `ambiguityEpsilon` and `maxCandidates` (§6) are all covered in T14 and T10.

**Deferred to later milestones, deliberately:** facade classes (M2), affine `Temperature`/`TempDelta` (M2 — `convert.ts` already implements offsets and is tested, but no affine kind ships in M1), percent (M2), `Value.meta` dpi (M2 — the mechanism is implemented and tested in T3/T11, no kind uses it), money and `RateSnapshot` (M3), datetime (M4), Ukrainian locale and `assertLocaleContract` (M5).

**Known gap accepted for M1:** `DimensionMismatchError` raised from the solver reports the first two slot kinds rather than the exact operands that failed to unify, because the solver discards non-type-checking assignments without recording why. The message is still correct about *which kinds are present*. Improving it needs failure-tracking in `enumerate`, which is M2 work once more kinds exist to make the message worth refining.

**Type consistency check performed.** `NormalizedKind`/`NormalizedUnit` (T3) are consumed unchanged by T4, T11 and T12. `Registry`/`AliasEntry`/`opKey`/`NUMBER_KIND` (T4) are used identically in T8, T10, T11, T12. `Candidate` (T2) is produced by T8 and consumed by T9, T10, T14. `Assignment` (T10) is consumed by T11 and T14. `Token` (T6) is produced by T6 and consumed by T9 and T14. `Node`/`walk` (T9) are consumed by T10 and T11.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-smartputs-m1-engine.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
