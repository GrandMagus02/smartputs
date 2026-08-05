# M4 — `@smartput/datetime` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@smartput/datetime` — a `datetime` kind that lives entirely outside core, recognises `"today"`, `"next week monday"`, `"3pm"`, `"2026-01-01"`, converts time zones through the ordinary `in` operator, and does date arithmetic against core's `duration` kind through declared `OpSignature`s.

**Architecture:** Core today can only reach a kind through the shape `<number><unit-word>`. A date is neither: `"next week monday"` is three words and no number, `"2026-01-01"` lexes as three numbers and two operators. So M4 adds one new recognition mechanism to core — a **literal matcher**: a kind-supplied function that is offered the source string at a token boundary and claims a run of characters, returning a fully-built `Value`. A new token pass (`foldLiterals`, the sibling of the existing `foldNumerals`/`foldWordOps`) collapses the claimed run into a single `literal` token, the parser turns that into a `LiteralNode`, and the solver scores it exactly like any other candidate. Everything downstream — weights, `kinds` filtering, `explain()`, `AmbiguityError` — falls out unchanged. `@smartput/datetime` then supplies exactly one matcher (a `chrono-node` bridge), a units table whose "units" are IANA time zones, four op signatures, and a formatter.

**Tech Stack:** Bun workspaces, TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome, `decimal.js`, `temporal-polyfill`, `chrono-node`, `bun test`.

## Global Constraints

Copied from `docs/superpowers/specs/2026-08-04-smartputs-design.md`. Every task's requirements implicitly include this section.

- `@smartput/core` has **exactly one** runtime dependency: `decimal.js`. `bun run check-deps` fails CI on a second. M4 adds **zero** dependencies to core.
- `@smartput/datetime` may depend only on `@smartput/core`, `decimal.js`, `temporal-polyfill`, `chrono-node`. Add that row to `scripts/check-deps.ts`'s `ALLOWED` map or the check fails on the new package.
- ESM only. No CJS build. `"type": "module"` in every package manifest.
- TypeScript `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`. Optional properties are spread conditionally (`...(x ? { x } : {})`), never assigned `undefined`.
- Biome: `noExplicitAny` is on, import sorting is enforced. Run `bun run lint` before every commit.
- Descriptors and values are frozen. Every operation returns a new instance.
- Never float. All arithmetic is `Decimal`.
- Result unit is the left operand's unit (spec §8).
- Date math uses Temporal, never milliseconds (spec §8).
- Every test uses a fixed clock. M4's is `2026-01-15T12:00:00Z` — `1768478400000` epoch milliseconds — and the default test time zone is `UTC`. No test touches the network.
- Registration is explicit: `createEngine({ kinds })` is the entire registry. `datetime` is never implicit.
- Registration errors throw at `createEngine()` time, never lazily at parse time.
- Ranking is deterministic. Identical input, options and clock produce identical ranking.

## File Structure

**Core — recognition seam (new capability, no behaviour change for existing kinds):**

| File | Responsibility |
| --- | --- |
| `packages/core/src/types.ts` | *modify* — add `LiteralMatch`, `LiteralMatcher`, `MatchCtx`; `Kind.literals`; `OpaqueSpec.units`, make `OpaqueSpec.parse`/`equals` optional |
| `packages/core/src/kind/define.ts` | *modify* — normalize opaque `units` into the same `NormalizedUnit` map ratio kinds use; carry `literals` onto `NormalizedKind` |
| `packages/core/src/kind/registry.ts` | *modify* — collect every kind's matchers into `Registry.literals` in deterministic order |
| `packages/core/src/parse/literals.ts` | **new** — `foldLiterals(tokens, input, registry, ctx)`, the third token pass |
| `packages/core/src/parse/lex.ts` | *modify* — add the `literal` variant to `Token` |
| `packages/core/src/parse/ast.ts` | *modify* — add `LiteralNode` |
| `packages/core/src/parse/candidates.ts` | *modify* — `Resolver.literal()`, so a literal's weight goes through the same four weight layers |
| `packages/core/src/parse/pratt.ts` | *modify* — `parseAtom` accepts a `literal` token |
| `packages/core/src/solve/solver.ts` | *modify* — literal nodes are slots, have a type, and are named in `DimensionMismatchError` |
| `packages/core/src/eval/evaluate.ts` | *modify* — evaluate a literal node to the `Value` its matcher built |
| `packages/core/src/engine.ts` | *modify* — `now`/`timeZone` options, build `MatchCtx`, run `foldLiterals` |
| `packages/core/src/facade/index.ts` | *modify* — `createFacades` skips opaque kinds |
| `packages/core/src/facade/quantity.ts` | *modify* — `createFacade` throws on an opaque kind rather than generating a broken class |
| `packages/core/src/complete/complete.ts` | *modify* — completion skips opaque kinds |
| `packages/core/src/index.ts` | *modify* — export the new types |

**`packages/datetime` — the plugin (new package):**

| File | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json` | manifest and project refs, mirroring `packages/rates` |
| `src/temporal.ts` | the single import site of `temporal-polyfill` |
| `src/chrono-bridge.ts` | chrono → `Temporal.ZonedDateTime`, the accept-gate, the only import site of `chrono-node` |
| `src/value.ts` | `wrap`/`unwrap`/`durationValue` — the `Value` ⇄ `ZonedDateTime` boundary |
| `src/zones.ts` | the IANA time-zone table and its aliases |
| `src/datetime.ts` | `defineKind` — units, literals, ops, format |
| `src/locale/en.ts` | English zone vocabulary as a `LocalePack` |
| `src/index.ts` | public exports |
| `corpus/en.tsv` | golden corpus |
| `src/*.test.ts`, `src/corpus.test.ts` | tests |

**Docs:** `docs/guide/roadmap.md`, `docs/guide/datetime.md` (new), `docs/api/define-kind.md`, `docs/superpowers/m4-followups.md` (new).

## Design rulings

Recorded here because a reviewer will ask, and because they are the parts a fresh
implementer cannot re-derive from the spec.

**R1 — A datetime `Value` stays inside the existing `Value` shape.** No new field
on `Value`. `canonical` is the **epoch nanosecond count** as a `Decimal` (an
integer; 2026 is 19 digits, comfortably inside Decimal's 28), `unit` is the IANA
time-zone id, and `meta.iso` is the `ZonedDateTime.toString()` round-trip string.
The `Temporal` object is *never* stored on `meta`: `Result` must stay
JSON-serialisable for `@smartput/http` in M6, and `deepFreeze` would walk a
foreign class. `wrap()` derives all three fields from one `ZonedDateTime`, so they
cannot drift.

**R2 — `mode: "opaque"` means "units are labels, not ratios; generate no ops."**
`generateRatioOps` already returns `[]` for opaque kinds. What opaque kinds were
missing is that `normalizeKind` never populated their `units` map, so their
aliases never reached the alias index and no surface could resolve to them. M4
fixes that: an opaque kind declares `units` as a lexicon, gets alias indexing, and
gets `in` targets — which is exactly what `3pm in Tokyo` needs.

**R3 — Recognition is a character-offset matcher, not a token matcher.** chrono's
own API is "here is a string, here is where my match starts and how long it is",
and `#fff000` / `2026-01-01` / `$30` are all sub-token or multi-token runs. A
matcher is offered `(input, offset, ctx)` and returns a length. The fold only
accepts a match that ends exactly on a token boundary; a match that stops halfway
through a token is dropped rather than splitting it.

**R4 — The fold is destructive, so the chrono bridge is deliberately
conservative.** Once `"10 m"` is folded into a datetime literal, the `10 metres`
reading is gone — the solver never sees it. So the bridge rejects a chrono match
unless it passes an accept-gate: the match is ISO-shaped, **or** it contains at
least one letter run that is *not* a registered unit alias. `"10 m"` → letter runs
`["m"]`, all unit aliases → rejected. `"5 min"` → rejected. `"3pm"` → `["pm"]`, not
a unit alias → accepted. `"next week monday"` → `["next","week","monday"]`; `week`
is a duration alias but `next` is not, so not *all* of them are → accepted.
`"2026-01-01"` → no letters, ISO-shaped → accepted. This keeps `30 hours - 10
minutes` pure ratio arithmetic on `duration`, exactly as spec §11 requires.

**R5 — `foldLiterals` runs first**, before `foldNumerals` and `foldWordOps`.
chrono does its own numeral handling (`"two days from now"`), and a matcher slices
the *original* input by offset, so rewriting number tokens first buys nothing and
risks a number token being half-swallowed.

**R6 — `datetime + duration` is calendar-aware for calendar units.** A `duration`
Value is canonical seconds plus an authored `unit`. When that unit is `d` or `wk`
and the authored amount is a whole number, the op adds `{ days }` / `{ weeks }`
through Temporal, so a DST boundary moves the wall clock correctly. Otherwise it
adds exact nanoseconds. This is the whole reason the op reads `r.unit` rather than
only `r.canonical`.

**R7 — Formatting is deterministic, not `Intl.DateTimeFormat`.** ICU output varies
by runtime version, and the golden corpus asserts strings verbatim. M4 formats as
`YYYY-MM-DD HH:MM <zone-symbol>` built from Temporal fields. Locale-aware date
formatting is deferred to M5 and recorded in `m4-followups.md`.

**R8 — Facades and completion opt out of opaque kinds for M4.** `createFacade`
generates `.to()`, `.scale()` and friends from a ratio table an opaque kind does
not have, and completion inserts `<number><unit>`, which is nonsense for a time
zone. Both skip opaque kinds with an explicit guard rather than producing a broken
surface. Date completion is its own design; it goes in the followups file.

**R9 — Time-zone aliases are single words in M4.** The alias index is keyed by one
segmented word, so `"new york"` cannot be an alias. `nyc` can. Recorded as a
followup.

---

### Task 1: The literal-matcher contract and opaque units

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/kind/define.ts`
- Modify: `packages/core/src/kind/registry.ts`
- Test: `packages/core/src/kind/define.test.ts`, `packages/core/src/kind/registry.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LiteralMatch`, `LiteralMatcher`, `MatchCtx` types (exported from `types.ts`)
  - `Kind.literals?: LiteralMatcher[]`
  - `OpaqueSpec.units?: Record<string, UnitLexeme | string[]>`; `OpaqueSpec.parse` and `OpaqueSpec.equals` become optional
  - `NormalizedKind.literals: LiteralMatcher[]`
  - `Registry.literals: ReadonlyArray<{ kind: KindId; matcher: LiteralMatcher }>`
  - An opaque kind's `units` are in `NormalizedKind.units` and in `Registry.aliasIndex`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/kind/registry.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "./define";
import { buildRegistry } from "./registry";
import type { LiteralMatcher } from "../types";

const noopMatcher: LiteralMatcher = () => null;

const zone = defineKind({
  id: "zone",
  value: {
    mode: "opaque",
    units: {
      UTC: ["utc", "z"],
      "Asia/Tokyo": { aliases: ["tokyo", "jst"], symbol: "JST" },
    },
  },
  literals: [noopMatcher],
});

test("an opaque kind's units reach the alias index", () => {
  const registry = buildRegistry([zone], [], "en");
  expect(registry.aliasIndex.get("tokyo")).toEqual([
    { kind: "zone", unit: "Asia/Tokyo" },
  ]);
  expect(registry.aliasIndex.get("utc")).toEqual([{ kind: "zone", unit: "UTC" }]);
});

test("an opaque kind's unit carries its lexeme", () => {
  const registry = buildRegistry([zone], [], "en");
  expect(registry.kinds.get("zone")?.units.get("Asia/Tokyo")?.lexeme.symbol).toBe("JST");
});

test("an opaque kind generates no ops", () => {
  const registry = buildRegistry([zone], [], "en");
  expect(registry.kinds.get("zone")?.ops).toEqual([]);
  expect([...registry.ops.keys()]).toEqual([]);
});

test("literal matchers are collected in kind-id order", () => {
  const other = defineKind({
    id: "aaa",
    value: { mode: "opaque", units: { x: ["x"] } },
    literals: [noopMatcher],
  });
  const registry = buildRegistry([zone, other], [], "en");
  expect(registry.literals.map((l) => l.kind)).toEqual(["aaa", "zone"]);
});

test("a ratio kind without literals contributes none", () => {
  const ratio = defineKind({
    id: "r",
    value: { mode: "ratio", canonical: "a", units: { a: 1 } },
  });
  expect(buildRegistry([ratio], [], "en").literals).toEqual([]);
});

test("an opaque unit's ratio is the identity, so conversion helpers never crash", () => {
  const registry = buildRegistry([zone], [], "en");
  const unit = registry.kinds.get("zone")?.units.get("UTC");
  const ctx = { self: { kind: "zone", canonical: new Decimal(0), unit: "UTC" }, locale: "en" };
  expect(unit?.ratio(ctx).toString()).toBe("1");
  expect(unit?.offset(ctx).toString()).toBe("0");
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: FAIL — `units` is not a known property of `OpaqueSpec`, `literals` is not a known property of `Kind`, `registry.literals` is undefined.

- [ ] **Step 3: Add the types**

In `packages/core/src/types.ts`, add after the `UnitDef` interface:

```ts
/**
 * What a kind's literal matcher claims from the source string.
 *
 * The matcher returns a finished `Value` rather than a payload the engine would
 * have to interpret: the engine has no idea what a date is, and giving it one
 * would be a second value model beside `Value`. `canonical` is whatever scalar
 * the kind orders and subtracts by — epoch nanoseconds for `datetime` — and
 * anything that is not a scalar rides on `meta`, which every value already has.
 */
export interface LiteralMatch {
  readonly kind: KindId;
  /** A unit registered by the kind. Never a free-form string. */
  readonly unit: string;
  readonly canonical: Decimal;
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Characters consumed starting at the offered offset. Must be > 0. */
  readonly length: number;
  /** Summed into the candidate's score, exactly like an analyzer's weight. */
  readonly weight?: number;
}

/**
 * Everything a matcher may read about the call. Deliberately not the whole
 * engine: a matcher that could reach the registry could rewrite it.
 */
export interface MatchCtx {
  readonly locale: string;
  /** Epoch milliseconds of "now", from `EngineOptions.now`. */
  readonly now: number;
  /** IANA time zone, from `EvalOptions.timeZone ?? EngineOptions.timeZone`. */
  readonly timeZone: string;
  /**
   * True when `text` is a registered unit alias of any kind. The one piece of
   * registry knowledge a matcher needs, and the reason `"10 m"` does not become
   * a date — see the plan's ruling R4.
   */
  isUnitAlias(text: string): boolean;
}

/**
 * Offered the whole normalized input and an offset that is always a token
 * boundary. Returns null for "not mine". A match that does not end on a token
 * boundary is discarded by the fold, so a matcher never has to align itself.
 */
export type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | null;
```

Replace the `OpaqueSpec` interface with:

```ts
export interface OpaqueSpec {
  mode: "opaque";
  /**
   * The kind's units as a lexicon. An opaque unit is a *label*, not a ratio —
   * `datetime`'s units are IANA time zones — but it is indexed, weighted,
   * formatted and used as an `in` target exactly like a ratio kind's unit.
   */
  units?: Record<string, UnitLexeme | string[]>;
  /** Single-token recognition. Superseded by `Kind.literals` for anything multi-token. */
  parse?: (token: string, ctx: EvalCtx) => unknown | null;
  equals?: (a: unknown, b: unknown) => boolean;
}
```

Add `literals` to `Kind`:

```ts
export interface Kind {
  id: KindId;
  value: RatioSpec | OpaqueSpec;
  extendsKind?: KindId;
  prior?: number;
  lexicon?: Lexicon;
  literals?: LiteralMatcher[];
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}
```

- [ ] **Step 4: Normalize opaque units and literals**

In `packages/core/src/kind/define.ts`, add `LiteralMatcher` to the type import from `../types`, add the field to `NormalizedKind`:

```ts
export interface NormalizedKind {
  id: KindId;
  spec: RatioSpec | OpaqueSpec;
  prior: number;
  units: Map<string, NormalizedUnit>;
  literals: LiteralMatcher[];
  ops: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}
```

and replace the body of `normalizeKind` with:

```ts
export function normalizeKind(k: Kind): NormalizedKind {
  const units = new Map<string, NormalizedUnit>();

  if (k.value.mode === "ratio") {
    for (const [unit, raw] of Object.entries(k.value.units)) {
      const def: UnitDef =
        typeof raw === "number" || raw instanceof Decimal ? { ratio: raw } : raw;
      units.set(unit, {
        unit,
        ratio: toDecimalFn(def.ratio, 1),
        offset: toDecimalFn(def.offset, 0),
        lexeme: toLexeme(unit, k.lexicon?.[unit]),
      });
    }
  } else {
    // An opaque unit has no scale, but it is still a unit: it is indexed by
    // alias, chosen by the solver, named by `in`, and read by the formatter.
    // The identity ratio keeps toCanonical/fromCanonical total, so generic code
    // never has to branch on mode before touching a unit.
    for (const [unit, entry] of Object.entries(k.value.units ?? {})) {
      units.set(unit, {
        unit,
        ratio: toDecimalFn(1, 1),
        offset: toDecimalFn(0, 0),
        lexeme: toLexeme(unit, k.lexicon?.[unit] ?? entry),
      });
    }
  }

  return {
    id: k.id,
    spec: k.value,
    prior: k.prior ?? 0,
    units,
    literals: [...(k.literals ?? [])],
    // Copy, never alias: the descriptor's ops array is deep-frozen, and the
    // registry pushes generated signatures onto this one.
    ops: [...(k.ops ?? [])],
    ...(k.format ? { format: k.format } : {}),
  };
}
```

- [ ] **Step 5: Collect matchers in the registry**

In `packages/core/src/kind/registry.ts`, add `LiteralMatcher` to the type import, extend the interface:

```ts
export interface Registry {
  kinds: Map<KindId, NormalizedKind>;
  ops: Map<string, OpSignature>;
  aliasIndex: Map<string, AliasEntry[]>;
  /**
   * Every registered matcher, ordered by kind id then declaration order.
   * Ordered rather than a Map because the fold tries them all at each token
   * boundary and ties break on this order — spec §8's determinism clause.
   */
  literals: Array<{ kind: KindId; matcher: LiteralMatcher }>;
}
```

In pass 2 (patches), carry a patch's matchers onto the base, next to `base.ops.push(...patch.ops)`:

```ts
    base.ops.push(...patch.ops);
    base.literals.push(...patch.literals);
```

After pass 5 (the alias index) and before the return, add pass 6:

```ts
  // Pass 6: literal matchers, deterministically ordered.
  const literals: Array<{ kind: KindId; matcher: LiteralMatcher }> = [];
  for (const kindId of kindIds) {
    for (const matcher of normalized.get(kindId)?.literals ?? []) {
      literals.push({ kind: kindId, matcher });
    }
  }

  return { kinds: normalized, ops, aliasIndex, literals };
```

- [ ] **Step 6: Run the tests**

Run: `bun test packages/core/src/kind/ && bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Run the whole suite — nothing else may change**

Run: `bun test`
Expected: 627+ pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/kind/
git commit -m "feat(core): literal matcher contract and opaque kind units"
```

---

### Task 2: `foldLiterals`, the third token pass

**Files:**
- Create: `packages/core/src/parse/literals.ts`
- Create: `packages/core/src/parse/literals.test.ts`
- Modify: `packages/core/src/parse/lex.ts`

**Interfaces:**
- Consumes: `Registry.literals`, `MatchCtx`, `LiteralMatch` (Task 1).
- Produces:
  - `Token` gains the variant
    `{ type: "literal"; kind: KindId; unit: string; canonical: Decimal; meta?: Readonly<Record<string, unknown>>; weight: number; text: string; start: number; end: number }`
  - `foldLiterals(tokens: Token[], input: string, registry: Registry, ctx: MatchCtx): Token[]`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/parse/literals.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import en from "../locale/en";
import { length } from "../kinds/length";
import type { LiteralMatcher, MatchCtx } from "../types";
import { lex } from "./lex";
import { foldLiterals } from "./literals";

/** Claims the literal word "today", and nothing else. */
const todayMatcher: LiteralMatcher = (input, offset) => {
  if (!input.startsWith("today", offset)) return null;
  return { kind: "day", unit: "UTC", canonical: new Decimal(7), length: 5, weight: 3 };
};

/** Claims a whole ISO date, which lexes as number-op-number-op-number. */
const isoMatcher: LiteralMatcher = (input, offset) => {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(input.slice(offset));
  if (m === null) return null;
  return { kind: "day", unit: "UTC", canonical: new Decimal(1), length: m[0].length };
};

/** Claims one character too few to land on a token boundary. */
const straddling: LiteralMatcher = (input, offset) =>
  input.startsWith("today", offset)
    ? { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 4 }
    : null;

const day = (literals: LiteralMatcher[]) =>
  defineKind({ id: "day", value: { mode: "opaque", units: { UTC: ["utc"] } }, literals });

const ctx: MatchCtx = {
  locale: "en",
  now: 1_768_478_400_000,
  timeZone: "UTC",
  isUnitAlias: () => false,
};

const fold = (input: string, literals: LiteralMatcher[]) => {
  const registry = buildRegistry([day(literals), length], [], "en");
  return foldLiterals(lex(input, en), input, registry, ctx);
};

test("a matched word becomes one literal token", () => {
  const tokens = fold("today", [todayMatcher]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({
    type: "literal",
    kind: "day",
    unit: "UTC",
    weight: 3,
    text: "today",
    start: 0,
    end: 5,
  });
});

test("a match spanning several tokens collapses all of them", () => {
  const tokens = fold("2026-01-15", [isoMatcher]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({ type: "literal", text: "2026-01-15", start: 0, end: 10 });
});

test("surrounding tokens survive untouched", () => {
  const tokens = fold("today + 5 km", [todayMatcher]);
  expect(tokens.map((t) => t.type)).toEqual(["literal", "op", "number", "word"]);
});

test("a match that does not end on a token boundary is discarded", () => {
  const tokens = fold("today", [straddling]);
  expect(tokens.map((t) => t.type)).toEqual(["word"]);
});

test("the longest match wins", () => {
  const shorter: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(0), length: 5 }
      : null;
  const longer: LiteralMatcher = (input, offset) =>
    input.startsWith("today noon", offset)
      ? { kind: "day", unit: "UTC", canonical: new Decimal(9), length: 10 }
      : null;
  const tokens = fold("today noon", [shorter, longer]);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toMatchObject({ text: "today noon" });
});

test("matching resumes after the claimed run", () => {
  const tokens = fold("today today", [todayMatcher]);
  expect(tokens.map((t) => t.type)).toEqual(["literal", "literal"]);
});

test("a zero-length or negative match is ignored rather than looping", () => {
  const zero: LiteralMatcher = () => ({
    kind: "day",
    unit: "UTC",
    canonical: new Decimal(0),
    length: 0,
  });
  expect(fold("today", [zero]).map((t) => t.type)).toEqual(["word"]);
});

test("a match naming a unit the kind does not register is ignored", () => {
  const bogus: LiteralMatcher = (input, offset) =>
    input.startsWith("today", offset)
      ? { kind: "day", unit: "Mars/Olympus", canonical: new Decimal(0), length: 5 }
      : null;
  expect(fold("today", [bogus]).map((t) => t.type)).toEqual(["word"]);
});

test("no matchers means the token list is returned unchanged", () => {
  const tokens = fold("5 km", []);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test packages/core/src/parse/literals.test.ts`
Expected: FAIL — `Cannot find module './literals'`.

- [ ] **Step 3: Add the token variant**

In `packages/core/src/parse/lex.ts`, add `KindId` to the type import from `../types` and add the variant to `Token`:

```ts
export type Token =
  | { type: "number"; value: Decimal; text: string; start: number; end: number }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number }
  // Produced only by foldLiterals, never by lex(): a kind claimed this run of
  // source and already built the value it stands for.
  | {
      type: "literal";
      kind: KindId;
      unit: string;
      canonical: Decimal;
      meta?: Readonly<Record<string, unknown>>;
      weight: number;
      text: string;
      start: number;
      end: number;
    };
```

- [ ] **Step 4: Write the fold**

Create `packages/core/src/parse/literals.ts`:

```ts
import type { Registry } from "../kind/registry";
import type { LiteralMatch, MatchCtx } from "../types";
import type { Token } from "./lex";

/**
 * The third token pass, and the only one that can see the source string.
 *
 * `foldNumerals` and `foldWordOps` rewrite words the lexer already produced;
 * this one asks each registered kind whether it wants a run of *characters*
 * starting at a token boundary. That is what a date needs — "next week monday"
 * is three tokens and "2026-01-15" is five — and it is the reason a matcher
 * takes an offset rather than a token index.
 *
 * Runs before the other two passes: chrono handles its own spelled numerals,
 * and a matcher reads the untouched input regardless, so folding numbers first
 * would only risk a number token being half-claimed.
 */
export function foldLiterals(
  tokens: Token[],
  input: string,
  registry: Registry,
  ctx: MatchCtx,
): Token[] {
  if (registry.literals.length === 0) return tokens;

  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) break;

    let best: { match: LiteralMatch; end: number; through: number } | null = null;

    for (const { matcher } of registry.literals) {
      const match = matcher(input, token.start, ctx);
      if (match === null || match.length <= 0) continue;

      // A unit the kind does not register would resolve to no lexeme and no
      // `in` target, so it is a plugin bug. Dropping the match keeps the
      // ordinary reading of the text rather than producing a half-value.
      if (registry.kinds.get(match.kind)?.units.has(match.unit) !== true) continue;

      const end = token.start + match.length;
      // The match must stop exactly where some token stops. Splitting a token
      // would leave a fragment no lexer rule produced.
      let through = -1;
      for (let j = i; j < tokens.length; j += 1) {
        const candidate = tokens[j];
        if (candidate === undefined || candidate.end > end) break;
        if (candidate.end === end) through = j;
      }
      if (through === -1) continue;

      if (best === null || end > best.end) best = { match, end, through };
    }

    if (best === null) {
      out.push(token);
      i += 1;
      continue;
    }

    const { match, end, through } = best;
    out.push({
      type: "literal",
      kind: match.kind,
      unit: match.unit,
      canonical: match.canonical,
      ...(match.meta ? { meta: match.meta } : {}),
      weight: match.weight ?? 0,
      text: input.slice(token.start, end),
      start: token.start,
      end,
    });
    i = through + 1;
  }

  return out;
}
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/core/src/parse/literals.test.ts && bun run typecheck`
Expected: PASS. If `typecheck` reports a non-exhaustive switch in `foldNumerals`, `foldWordOps` or `complete`, add a `literal` pass-through branch there — those passes must forward a literal token untouched.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parse/lex.ts packages/core/src/parse/literals.ts packages/core/src/parse/literals.test.ts
git commit -m "feat(core): foldLiterals token pass"
```

---

### Task 3: A literal through the parser, solver and evaluator

**Files:**
- Modify: `packages/core/src/parse/ast.ts`
- Modify: `packages/core/src/parse/candidates.ts`
- Modify: `packages/core/src/parse/pratt.ts`
- Modify: `packages/core/src/solve/solver.ts`
- Modify: `packages/core/src/eval/evaluate.ts`
- Test: `packages/core/src/parse/pratt.test.ts`, `packages/core/src/solve/solver.test.ts`

**Interfaces:**
- Consumes: the `literal` `Token` (Task 2), `Resolver` (existing).
- Produces:
  - `LiteralNode = { type: "literal"; value: Value; candidates: Candidate[]; span: Span }`
  - `Resolver.literal(m: { kind: KindId; unit: string; surface: string; weight: number }): Candidate`
  - `parse()` accepts a literal token in operand position
  - `solve()` treats a literal node as a slot; `evaluateNode()` returns its `Value`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/solve/solver.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { defineKind } from "../kind/define";
import { duration } from "../kinds/duration";
import { number } from "../kinds/number";
import en from "../locale/en";
import type { LiteralMatcher } from "../types";

/**
 * A stand-in for M4's chrono bridge: "day7" is a point in time whose canonical
 * value is a second count, so core can be tested against an opaque kind without
 * depending on the datetime package.
 */
const day7: LiteralMatcher = (input, offset) =>
  input.startsWith("day7", offset)
    ? { kind: "day", unit: "UTC", canonical: new Decimal(604_800), meta: { iso: "day7" }, length: 4 }
    : null;

const day = defineKind({
  id: "day",
  value: { mode: "opaque", units: { UTC: ["utc"] } },
  literals: [day7],
  ops: [
    {
      op: "+",
      left: "day",
      right: "duration",
      result: "day",
      apply: (l, r) =>
        Object.freeze({ kind: "day", canonical: l.canonical.plus(r.canonical), unit: l.unit }),
    },
    {
      op: "-",
      left: "day",
      right: "day",
      result: "duration",
      apply: (l, r) =>
        Object.freeze({ kind: "duration", canonical: l.canonical.minus(r.canonical), unit: "s" }),
    },
  ],
  format: (v) => `day+${v.canonical.toFixed()}`,
});

const engine = createEngine({ locales: [en], kinds: [number, duration, day] });

test("a literal evaluates to the value its matcher built", () => {
  const r = engine.evaluate("day7");
  expect(r.kind).toBe("day");
  expect(r.value.canonical.toString()).toBe("604800");
  expect(r.value.unit).toBe("UTC");
  expect(r.value.meta).toEqual({ iso: "day7" });
  expect(r.formatted).toBe("day+604800");
});

test("a cross-kind op signature joins a literal to a quantity", () => {
  const r = engine.evaluate("day7 + 2 h");
  expect(r.kind).toBe("day");
  expect(r.value.canonical.toString()).toBe("612000");
});

test("a literal minus a literal takes the declared result kind", () => {
  const r = engine.evaluate("day7 - day7");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("0");
});

test("a literal without a matching signature raises DimensionMismatchError", () => {
  expect(() => engine.evaluate("day7 * 2")).toThrow(/day/);
});

test("the kinds filter drops a literal candidate", () => {
  expect(() => engine.evaluate("day7", { kinds: ["duration"] })).toThrow();
});

test("a literal's weight goes through the weight layers", () => {
  const boosted = createEngine({
    locales: [en],
    kinds: [number, duration, day],
    weights: { day: 11 },
  });
  const contributions = boosted.explain("day7").assignments[0]?.contributions ?? [];
  expect(contributions).toContainEqual({ selector: "day", value: 11, layer: 2 });
});

test("explain lists the literal as a candidate", () => {
  expect(engine.explain("day7").candidates[0]).toMatchObject({
    kind: "day",
    unit: "UTC",
    surface: "day7",
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: FAIL — `UnitParseError`, because `parseAtom` rejects a literal token.

- [ ] **Step 3: Add the AST node**

In `packages/core/src/parse/ast.ts`, add `Value` to the type import from `../types`, then:

```ts
/**
 * A run of source a kind claimed outright. Unlike a quantity, the value is
 * already built — the matcher had to build it to decide the match — so the
 * evaluator has nothing to compute here. The candidate list exists purely so
 * the node is scored, filtered and explained like every other operand.
 */
export interface LiteralNode {
  type: "literal";
  value: Value;
  candidates: Candidate[];
  span: Span;
}

export type Node =
  | NumberNode
  | QuantityNode
  | LiteralNode
  | BinaryNode
  | UnaryNode
  | ConvertNode;
```

`walk` needs no change: a literal has no children, and its `default` branch already covers it.

- [ ] **Step 4: Give the resolver a literal path**

In `packages/core/src/parse/candidates.ts`, add `KindId` to the type import, extend the interface:

```ts
export interface Resolver {
  resolve(surface: string): Candidate[];
  literal(m: { kind: KindId; unit: string; surface: string; weight: number }): Candidate;
  nearest(surface: string): string[];
}
```

and add the method to the returned object, beside `resolve`:

```ts
    // A literal never went through the analyzer chain — its matcher already
    // decided what the text means — but it must still be weighted by all four
    // layers, or `weights: { datetime: 40 }` would silently not apply to a date.
    literal(m) {
      const foldedSurface = fold(m.surface);
      return {
        kind: m.kind,
        unit: m.unit,
        weight:
          resolveWeight({
            kind: m.kind,
            unit: m.unit,
            surface: foldedSurface,
            prior: args.registry.kinds.get(m.kind)?.prior ?? 0,
            layers: args.layers,
          }) + m.weight,
        surface: m.surface,
        foldedSurface,
        form: m.surface,
        analyzerWeight: m.weight,
      };
    },
```

- [ ] **Step 5: Accept a literal in operand position**

In `packages/core/src/parse/pratt.ts`, inside `parseAtom`, immediately after the `lparen` branch:

```ts
    if (token.type === "literal") {
      pos += 1;
      return {
        type: "literal",
        value: Object.freeze({
          kind: token.kind,
          canonical: token.canonical,
          unit: token.unit,
          ...(token.meta ? { meta: token.meta } : {}),
        }),
        candidates: [
          resolver.literal({
            kind: token.kind,
            unit: token.unit,
            surface: token.text,
            weight: token.weight,
          }),
        ],
        span: { start: token.start, end: token.end },
      };
    }
```

- [ ] **Step 6: Teach the solver about literal nodes**

In `packages/core/src/solve/solver.ts`:

In `reportedOperands`, add a branch beside the `quantity` one:

```ts
    } else if (node.type === "literal") {
      refs.push({ start: node.span.start, kind: pick(node.candidates) });
```

In `collectSlots`, extend the `quantity` branch to cover literals — replace its condition with:

```ts
    if (node.type === "quantity" || node.type === "literal") {
      const filtered =
        kinds === undefined
          ? node.candidates
          : node.candidates.filter((c) => kinds.includes(c.kind));
      slots.push({ node, candidates: filtered });
    } else if (node.type === "convert") {
```

In `typeOf`, add the case beside `quantity`:

```ts
    case "literal":
      return choices.get(node)?.kind ?? null;
```

- [ ] **Step 7: Evaluate a literal**

In `packages/core/src/eval/evaluate.ts`, add a case to `evalNode` after `"number"`:

```ts
      case "literal": {
        // The matcher already built this. The choices lookup is not for the
        // value — it is the assertion that this assignment actually selected
        // the literal, so a filtered-out literal cannot be evaluated anyway.
        const choice = assignment.choices.get(n);
        if (choice === undefined)
          throw new DimensionMismatchError(input, "literal", n.value.kind, "?");
        return deepFreeze({ ...n.value });
      }
```

- [ ] **Step 8: Run the tests**

Run: `bun test packages/core/src && bun run typecheck`
Expected: the new solver tests still fail on `engine.evaluate("day7")` because `createEngine` does not run `foldLiterals` yet — that is Task 4. Every *other* test must pass. Confirm the remaining failures are only the seven added in Step 1.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/parse packages/core/src/solve packages/core/src/eval
git commit -m "feat(core): literal nodes through parser, solver and evaluator"
```

---

### Task 4: Wire the engine — clock, time zone, and the opaque guards

**Files:**
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/facade/index.ts`
- Modify: `packages/core/src/facade/quantity.ts`
- Modify: `packages/core/src/complete/complete.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/engine.test.ts`, `packages/core/src/solve/solver.test.ts` (Task 3's tests now pass)

**Interfaces:**
- Consumes: `foldLiterals` (Task 2), `LiteralNode` plumbing (Task 3).
- Produces:
  - `EngineOptions.now?: () => number` (epoch milliseconds, default `Date.now`)
  - `EngineOptions.timeZone?: string` (IANA, default the host zone)
  - `EvalOptions.timeZone?: string` (per-call override)
  - `createFacades` skips opaque kinds; `createFacade` throws `KindConflictError` on one
  - `complete()` returns no completions for opaque kinds
  - `types.ts`'s new types exported from the package root

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/engine.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { createEngine } from "./engine";
import { createFacades } from "./facade/index";
import { defineKind } from "./kind/define";
import { length } from "./kinds/length";
import { number } from "./kinds/number";
import en from "./locale/en";
import type { LiteralMatcher } from "./types";

/** Echoes the clock and zone it was handed, so the wiring is observable. */
const clockProbe: LiteralMatcher = (input, offset, ctx) =>
  input.startsWith("now", offset)
    ? {
        kind: "probe",
        unit: ctx.timeZone === "UTC" ? "UTC" : "other",
        canonical: new Decimal(ctx.now),
        length: 3,
      }
    : null;

/** Refuses anything whose letters are all unit aliases — the R4 accept-gate. */
const gated: LiteralMatcher = (input, offset, ctx) => {
  const rest = input.slice(offset);
  const m = /^\d+ [a-z]+/.exec(rest);
  if (m === null) return null;
  const word = m[0].split(" ")[1] as string;
  if (ctx.isUnitAlias(word)) return null;
  return { kind: "probe", unit: "UTC", canonical: new Decimal(1), length: m[0].length };
};

const probe = (literals: LiteralMatcher[]) =>
  defineKind({
    id: "probe",
    value: { mode: "opaque", units: { UTC: ["utc"], other: ["other"] } },
    literals,
    format: (v) => v.canonical.toFixed(),
  });

test("EngineOptions.now is what the matcher sees", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now").value.canonical.toString()).toBe("1768478400000");
  expect(engine.evaluate("now").value.unit).toBe("UTC");
});

test("EvalOptions.timeZone overrides the engine's", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, probe([clockProbe])],
    now: () => 1_768_478_400_000,
    timeZone: "UTC",
  });
  expect(engine.evaluate("now", { timeZone: "Asia/Tokyo" }).value.unit).toBe("other");
});

test("isUnitAlias reports what the registry indexed", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, length, probe([gated])],
    now: () => 0,
    timeZone: "UTC",
  });
  // "10 km" — km is a length alias, so the matcher declines and the ordinary
  // reading survives.
  expect(engine.evaluate("10 km").kind).toBe("length");
  // "10 zz" — not an alias, so the matcher claims it.
  expect(engine.evaluate("10 zz").kind).toBe("probe");
});

test("createFacades skips opaque kinds rather than generating a broken class", () => {
  const facades = createFacades({ kinds: [number, length, probe([])], locale: en });
  expect(Object.keys(facades).sort()).toEqual(["length", "number"]);
});

test("completion offers nothing for an opaque kind", () => {
  const engine = createEngine({
    locales: [en],
    kinds: [number, length, probe([])],
  });
  expect(engine.complete("1 ut").every((c) => c.kind !== "probe")).toBe(true);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun test packages/core/src/engine.test.ts`
Expected: FAIL — `now` is not a known option, and `evaluate("now")` throws `UnitParseError`.

- [ ] **Step 3: Add the options and run the fold**

In `packages/core/src/engine.ts`:

Add to `EngineOptions`:

```ts
  /**
   * Injectable clock, epoch milliseconds. Spec §6 requires it: "today" and
   * "next week monday" are untestable without one. Epoch milliseconds rather
   * than a Temporal instant so core stays free of a Temporal dependency —
   * `@smartput/datetime` converts.
   */
  now?: () => number;
  /** IANA time zone every literal matcher resolves against. Defaults to the host zone. */
  timeZone?: string;
```

Add to `EvalOptions`:

```ts
  /** Per-call time zone, overriding `EngineOptions.timeZone`. */
  timeZone?: string;
```

Add the imports:

```ts
import { foldLiterals } from "./parse/literals";
import type { MatchCtx } from "./types";
```

Inside `createEngine`, beside the other option reads:

```ts
  const now = opts.now ?? (() => Date.now());
  const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone = opts.timeZone ?? hostZone;
```

and in `pipeline`, replace the token line:

```ts
    const lexed = lex(normalized, locale as Locale);
    const matchCtx: MatchCtx = {
      locale: (locale as Locale).id,
      now: now(),
      timeZone: call?.timeZone ?? timeZone,
      isUnitAlias: (text) =>
        registry.aliasIndex.has(text.toLocaleLowerCase((locale as Locale).id)),
    };
    const tokens = foldWordOps(
      foldNumerals(foldLiterals(lexed, normalized, registry, matchCtx), locale as Locale),
    );
```

Note the fold receives `normalized`, not `input`: offsets in the token stream are
offsets into the normalized string, and slicing the raw input by them would be off
by however many characters normalization removed.

- [ ] **Step 4: Guard the facade**

In `packages/core/src/facade/index.ts`, skip opaque kinds in the build loop:

```ts
  for (const [id, kind] of registry.kinds) {
    // A facade is generated from a ratio table: `.to()`, `.scale()` and
    // `.equals()` all read unit ratios. An opaque kind has labels instead, so
    // there is nothing to generate — see plan ruling R8. Date facades are M5.
    if (kind.spec.mode !== "ratio") continue;
    classes.set(
```

In `packages/core/src/facade/quantity.ts`, at the top of `createFacade`, refuse
explicitly rather than producing a class whose every method throws:

```ts
  if (args.kind.spec.mode !== "ratio") {
    throw new KindConflictError(
      args.kind.id,
      "createFacade requires a ratio kind; opaque kinds have no unit ratios to convert between",
    );
  }
```

(Import `KindConflictError` from `../errors` if it is not already imported.)

- [ ] **Step 5: Guard completion**

In `packages/core/src/complete/complete.ts`, inside the loop over `registry.aliasIndex`, after the kind lookup, skip opaque kinds:

```ts
      // Completion inserts "<number><unit>", which a time zone is not. Date
      // completion has its own shape and is out of M4's scope (ruling R8).
      if (kind.spec.mode !== "ratio") continue;
```

- [ ] **Step 6: Export the new types**

In `packages/core/src/index.ts` nothing is needed for `types.ts` (it is
`export type * from "./types"`), but add the fold so plugin authors can test a
matcher in isolation:

```ts
export { foldLiterals } from "./parse/literals";
```

- [ ] **Step 7: Run everything**

Run: `bun test && bun run typecheck && bun run lint`
Expected: PASS — including all seven of Task 3's solver tests.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): clock and time-zone options, literal fold in the pipeline"
```

---

### Task 5: `@smartput/datetime` package scaffold

**Files:**
- Create: `packages/datetime/package.json`
- Create: `packages/datetime/tsconfig.json`
- Create: `packages/datetime/src/temporal.ts`
- Create: `packages/datetime/src/temporal.test.ts`
- Modify: `scripts/check-deps.ts`
- Modify: `package.json` (root — add the package to `typecheck`)

**Interfaces:**
- Consumes: nothing.
- Produces: `packages/datetime/src/temporal.ts` exporting `Temporal`, and the constants `TEST_NOW = 1_768_478_400_000` and `TEST_ZONE = "UTC"` from `src/temporal.ts` for every later test to share.

- [ ] **Step 1: Create the manifest**

`packages/datetime/package.json`:

```json
{
  "name": "@smartput/datetime",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./locale/en": "./src/locale/en.ts"
  },
  "dependencies": {
    "@smartput/core": "workspace:*",
    "chrono-node": "^2.9.0",
    "decimal.js": "^10.6.0",
    "temporal-polyfill": "^0.3.0"
  }
}
```

`packages/datetime/tsconfig.json` (identical to `packages/rates/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Register the package with the dependency check**

In `scripts/check-deps.ts`, add to `ALLOWED`:

```ts
  "packages/datetime/package.json": [
    "@smartput/core",
    "chrono-node",
    "decimal.js",
    "temporal-polyfill",
  ],
```

In the root `package.json`, extend the `typecheck` script with
` && tsc -p packages/datetime/tsconfig.json --noEmit`.

- [ ] **Step 3: Install**

Run: `bun install`
Expected: `chrono-node` and `temporal-polyfill` resolve; the workspace links `@smartput/datetime`.

- [ ] **Step 4: Write the failing test**

`packages/datetime/src/temporal.test.ts`:

```ts
import { expect, test } from "bun:test";
import { TEST_NOW, TEST_ZONE, Temporal } from "./temporal";

test("the fixed test clock is 2026-01-15T12:00Z", () => {
  const zdt = Temporal.Instant.fromEpochMilliseconds(TEST_NOW).toZonedDateTimeISO(TEST_ZONE);
  expect(zdt.toString()).toBe("2026-01-15T12:00:00+00:00[UTC]");
});

test("Temporal round-trips a zoned datetime string", () => {
  const zdt = Temporal.ZonedDateTime.from("2026-01-15T00:00:00+09:00[Asia/Tokyo]");
  expect(zdt.timeZoneId).toBe("Asia/Tokyo");
  expect(zdt.epochNanoseconds.toString()).toBe(
    (BigInt(Date.UTC(2026, 0, 14, 15, 0, 0)) * 1_000_000n).toString(),
  );
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `bun test packages/datetime`
Expected: FAIL — `Cannot find module './temporal'`.

- [ ] **Step 6: Write it**

`packages/datetime/src/temporal.ts`:

```ts
import { Temporal } from "temporal-polyfill";

/**
 * The one import site of `temporal-polyfill` in this package.
 *
 * Everything else imports Temporal from here, so swapping the polyfill for the
 * native global once runtimes ship it is a one-line change rather than a sweep.
 */
export { Temporal };

/**
 * The fixed clock every test in this repo uses (spec §10), as epoch
 * milliseconds — the unit `EngineOptions.now` speaks.
 */
export const TEST_NOW = 1_768_478_400_000;
export const TEST_ZONE = "UTC";
```

- [ ] **Step 7: Run the tests**

Run: `bun test packages/datetime && bun run check-deps && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/datetime package.json bun.lock scripts/check-deps.ts
git commit -m "feat(datetime): package scaffold and Temporal import site"
```

---

### Task 6: The chrono bridge

**Files:**
- Create: `packages/datetime/src/chrono-bridge.ts`
- Create: `packages/datetime/src/chrono-bridge.test.ts`

**Interfaces:**
- Consumes: `Temporal`, `TEST_NOW`, `TEST_ZONE` (Task 5); `MatchCtx` (Task 1).
- Produces:
  - `parseDateTime(input: string, offset: number, ctx: MatchCtx): { zdt: Temporal.ZonedDateTime; length: number } | null`
  - `accepts(text: string, isUnitAlias: (s: string) => boolean): boolean`

- [ ] **Step 1: Write the failing test**

`packages/datetime/src/chrono-bridge.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { accepts, parseDateTime } from "./chrono-bridge";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const UNIT_ALIASES = new Set(["m", "min", "h", "d", "wk", "s", "km", "kg", "week", "day"]);

const ctx: MatchCtx = {
  locale: "en",
  now: TEST_NOW,
  timeZone: TEST_ZONE,
  isUnitAlias: (s) => UNIT_ALIASES.has(s),
};

const iso = (input: string, offset = 0) =>
  parseDateTime(input, offset, ctx)?.zdt.toString() ?? null;

test("today resolves against the injected clock at midnight", () => {
  expect(iso("today")).toBe("2026-01-15T00:00:00+00:00[UTC]");
});

test("tomorrow is the next day", () => {
  expect(iso("tomorrow")).toBe("2026-01-16T00:00:00+00:00[UTC]");
});

test("a clock time keeps today's date", () => {
  expect(iso("3pm")).toBe("2026-01-15T15:00:00+00:00[UTC]");
});

test("an ISO date parses with no letters at all", () => {
  expect(iso("2026-03-01")).toBe("2026-03-01T00:00:00+00:00[UTC]");
});

test("next week monday resolves forward", () => {
  // 2026-01-15 is a Thursday; the Monday of the following week is 2026-01-19.
  expect(iso("next week monday")).toBe("2026-01-19T00:00:00+00:00[UTC]");
});

test("the reported length covers exactly the matched text", () => {
  expect(parseDateTime("today + 5 h", 0, ctx)?.length).toBe(5);
});

test("a match must start at the offset", () => {
  expect(parseDateTime("5 h + today", 0, ctx)).toBeNull();
});

test("the offset is honoured", () => {
  expect(iso("5 h + today", 8)).toBe("2026-01-15T00:00:00+00:00[UTC]");
});

test("the time zone is the one on the context", () => {
  expect(
    parseDateTime("today", 0, { ...ctx, timeZone: "Asia/Tokyo" })?.zdt.toString(),
  ).toBe("2026-01-16T00:00:00+09:00[Asia/Tokyo]");
});

test("a run whose letters are all unit aliases is refused", () => {
  expect(accepts("10 m", ctx.isUnitAlias)).toBe(false);
  expect(accepts("5 min", ctx.isUnitAlias)).toBe(false);
  expect(accepts("2 weeks", ctx.isUnitAlias)).toBe(false);
});

test("a run with one non-unit word is accepted", () => {
  expect(accepts("next week monday", ctx.isUnitAlias)).toBe(true);
  expect(accepts("3pm", ctx.isUnitAlias)).toBe(true);
  expect(accepts("in 3 days", ctx.isUnitAlias)).toBe(true);
});

test("a letterless run is accepted only when it is ISO-shaped", () => {
  expect(accepts("2026-03-01", ctx.isUnitAlias)).toBe(true);
  expect(accepts("10:30", ctx.isUnitAlias)).toBe(true);
  expect(accepts("2026", ctx.isUnitAlias)).toBe(false);
  expect(accepts("5 + 3", ctx.isUnitAlias)).toBe(false);
});

test("a duration expression is never claimed as a date", () => {
  expect(parseDateTime("30 hours", 0, { ...ctx, isUnitAlias: (s) => s === "hours" })).toBeNull();
});
```

The three-week weekday assertion is checkable by hand: 2026-01-15 is a Thursday.

- [ ] **Step 2: Run and watch it fail**

Run: `bun test packages/datetime/src/chrono-bridge.test.ts`
Expected: FAIL — `Cannot find module './chrono-bridge'`.

- [ ] **Step 3: Write the bridge**

`packages/datetime/src/chrono-bridge.ts`:

```ts
import type { MatchCtx } from "@smartput/core";
import * as chrono from "chrono-node";
import { Temporal } from "./temporal";

/**
 * Letterless runs a date is allowed to claim: an ISO date, an ISO date-time,
 * or a bare clock time. Everything else without letters is arithmetic.
 */
const LETTERLESS_OK =
  /^(\d{4}-\d{2}-\d{2}([T ]\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}:\d{2}(:\d{2})?)$/;

const LETTER_RUN = /\p{L}+/gu;

/**
 * The accept-gate (plan ruling R4).
 *
 * The literal fold is destructive: once "10 m" is a date, the length reading is
 * gone before the solver ever runs. chrono is happy to read a bare quantity as
 * a duration-from-now, so the bridge refuses any match whose letter runs are
 * *all* registered unit aliases. "5 min" is refused; "next week monday" is not,
 * because `next` and `monday` are nobody's unit.
 */
export function accepts(text: string, isUnitAlias: (s: string) => boolean): boolean {
  const words = text.toLowerCase().match(LETTER_RUN) ?? [];
  if (words.length === 0) return LETTERLESS_OK.test(text.trim());
  return !words.every((w) => isUnitAlias(w));
}

/**
 * chrono's reference has to be expressed in the *engine's* time zone, not the
 * host's, or an injected clock stops being deterministic: chrono fills implied
 * components (the date behind "3pm") from the reference's local wall clock, and
 * a JS Date's local wall clock is the machine's.
 */
function referenceFor(ctx: MatchCtx): chrono.ParsingReference {
  const zoned = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
    ctx.timeZone,
  );
  return {
    instant: new Date(ctx.now),
    timezone: zoned.offsetNanoseconds / 60_000_000_000,
  };
}

export interface BridgeMatch {
  zdt: Temporal.ZonedDateTime;
  length: number;
}

/**
 * Parses a date anchored at `offset`, or returns null.
 *
 * Anchored, not "somewhere in the string": the fold offers every token boundary
 * in turn, so a match that starts later belongs to a later call. Accepting an
 * unanchored match here would let "5 h + today" report a length measured from
 * the wrong place.
 */
export function parseDateTime(
  input: string,
  offset: number,
  ctx: MatchCtx,
): BridgeMatch | null {
  const rest = input.slice(offset);
  if (rest.length === 0) return null;

  const results = chrono
    .parse(rest, referenceFor(ctx), { forwardDate: false })
    .filter((r) => r.index === 0)
    .sort((a, b) => b.text.length - a.text.length);

  for (const result of results) {
    if (!accepts(result.text, ctx.isUnitAlias)) continue;

    const year = result.start.get("year");
    const month = result.start.get("month");
    const day = result.start.get("day");
    if (year === null || month === null || day === null) continue;

    // Implied components are chrono's guesses about what the user left out.
    // A time the user did not type is midnight, deliberately and always: a
    // formatted result that silently carried the reference's own clock time
    // would make "today" depend on when the test ran.
    const certainTime = result.start.isCertain("hour");
    const plain = new Temporal.PlainDateTime(
      year,
      month,
      day,
      certainTime ? (result.start.get("hour") ?? 0) : 0,
      certainTime ? (result.start.get("minute") ?? 0) : 0,
      certainTime ? (result.start.get("second") ?? 0) : 0,
    );

    // An explicit offset in the text ("3pm EST") wins over the engine's zone;
    // the instant is what the user named, and the zone label follows it.
    const offsetMinutes = result.start.isCertain("timezoneOffset")
      ? result.start.get("timezoneOffset")
      : null;

    const zdt =
      offsetMinutes === null
        ? plain.toZonedDateTime(ctx.timeZone)
        : plain
            .toZonedDateTime("UTC")
            .add({ minutes: -offsetMinutes })
            .withTimeZone(ctx.timeZone);

    return { zdt, length: result.text.length };
  }

  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test packages/datetime/src/chrono-bridge.test.ts`
Expected: PASS. If a chrono result reports a `text` with trailing whitespace, the
reported length is wrong — trim the result text and shorten the length by the
difference before returning, and add a test for it.

- [ ] **Step 5: Commit**

```bash
git add packages/datetime/src/chrono-bridge.ts packages/datetime/src/chrono-bridge.test.ts
git commit -m "feat(datetime): chrono bridge with an accept-gate"
```

---

### Task 7: The `datetime` kind

**Files:**
- Create: `packages/datetime/src/zones.ts`
- Create: `packages/datetime/src/value.ts`
- Create: `packages/datetime/src/value.test.ts`
- Create: `packages/datetime/src/datetime.ts`
- Create: `packages/datetime/src/datetime.test.ts`

**Interfaces:**
- Consumes: `parseDateTime` (Task 6), `Temporal` (Task 5), core's `defineKind`.
- Produces:
  - `DATETIME_KIND = "datetime"`, `ZONES: Record<string, { aliases: string[]; symbol: string }>`
  - `wrap(zdt: Temporal.ZonedDateTime): Value`
  - `unwrap(v: Value): Temporal.ZonedDateTime`
  - `durationValue(nanoseconds: Decimal): Value`
  - `addDuration(zdt: Temporal.ZonedDateTime, duration: Value, sign: 1 | -1): Temporal.ZonedDateTime`
  - `datetime: Kind`

- [ ] **Step 1: Write the failing value tests**

`packages/datetime/src/value.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { Temporal } from "./temporal";
import { addDuration, durationValue, unwrap, wrap } from "./value";

const zdt = Temporal.ZonedDateTime.from("2026-01-15T12:00:00+00:00[UTC]");

test("wrap carries the instant, the zone and the ISO string", () => {
  const v = wrap(zdt);
  expect(v.kind).toBe("datetime");
  expect(v.unit).toBe("UTC");
  expect(v.canonical.toString()).toBe(zdt.epochNanoseconds.toString());
  expect(v.meta).toEqual({ iso: "2026-01-15T12:00:00+00:00[UTC]" });
});

test("wrap then unwrap is the identity", () => {
  expect(unwrap(wrap(zdt)).equals(zdt)).toBe(true);
});

test("the wrapped value is frozen and JSON-serialisable", () => {
  const v = wrap(zdt);
  expect(Object.isFrozen(v)).toBe(true);
  expect(JSON.parse(JSON.stringify(v.meta))).toEqual({ iso: "2026-01-15T12:00:00+00:00[UTC]" });
});

test("durationValue picks the largest unit that reads as at least one", () => {
  const hour = new Decimal(3_600).times(1e9);
  expect(durationValue(hour)).toMatchObject({ kind: "duration", unit: "h" });
  expect(durationValue(hour).canonical.toString()).toBe("3600");
  expect(durationValue(new Decimal(1e9))).toMatchObject({ unit: "s" });
  expect(durationValue(new Decimal(864_000).times(1e9))).toMatchObject({ unit: "d" });
  expect(durationValue(new Decimal(0))).toMatchObject({ unit: "s" });
  expect(durationValue(new Decimal(-3_600).times(1e9))).toMatchObject({ unit: "h" });
});

test("a whole day is added as a calendar day, not 86400 seconds", () => {
  // 2026-03-08 is the US DST transition; 00:00 + 1 calendar day is 00:00 again,
  // while 86400 exact seconds would land on 01:00.
  const ny = Temporal.ZonedDateTime.from("2026-03-08T00:00:00-05:00[America/New_York]");
  const day = { kind: "duration", canonical: new Decimal(86_400), unit: "d" };
  expect(addDuration(ny, day, 1).toString()).toBe("2026-03-09T00:00:00-04:00[America/New_York]");
});

test("a sub-day duration is added exactly", () => {
  const two = { kind: "duration", canonical: new Decimal(7_200), unit: "h" };
  expect(addDuration(zdt, two, 1).toString()).toBe("2026-01-15T14:00:00+00:00[UTC]");
  expect(addDuration(zdt, two, -1).toString()).toBe("2026-01-15T10:00:00+00:00[UTC]");
});

test("a fractional calendar unit falls back to exact nanoseconds", () => {
  const half = { kind: "duration", canonical: new Decimal(43_200), unit: "d" };
  expect(addDuration(zdt, half, 1).toString()).toBe("2026-01-16T00:00:00+00:00[UTC]");
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun test packages/datetime/src/value.test.ts`
Expected: FAIL — `Cannot find module './value'`.

- [ ] **Step 3: Write the zone table**

`packages/datetime/src/zones.ts`:

```ts
/**
 * The time zones this package registers as `datetime` units, with the words
 * people type for them.
 *
 * Aliases are single words: the alias index is keyed by one segmented word, so
 * "new york" cannot be one — "nyc" can. A caller who needs more registers a
 * `LocalePack` (spec §4.6) or an `extendsKind` patch; nothing here is a closed
 * list.
 */
export const ZONES: Record<string, { aliases: string[]; symbol: string }> = {
  UTC: { aliases: ["utc", "gmt", "z", "zulu"], symbol: "UTC" },
  "America/New_York": { aliases: ["nyc", "est", "edt"], symbol: "ET" },
  "America/Chicago": { aliases: ["cst", "cdt", "chicago"], symbol: "CT" },
  "America/Denver": { aliases: ["mst", "mdt", "denver"], symbol: "MT" },
  "America/Los_Angeles": { aliases: ["pst", "pdt", "la"], symbol: "PT" },
  "America/Sao_Paulo": { aliases: ["brt"], symbol: "BRT" },
  "Europe/London": { aliases: ["london", "bst"], symbol: "London" },
  "Europe/Paris": { aliases: ["paris", "cet", "cest"], symbol: "CET" },
  "Europe/Berlin": { aliases: ["berlin"], symbol: "Berlin" },
  "Europe/Kyiv": { aliases: ["kyiv", "kiev", "eet"], symbol: "Kyiv" },
  "Europe/Moscow": { aliases: ["moscow", "msk"], symbol: "MSK" },
  "Asia/Dubai": { aliases: ["dubai", "gst"], symbol: "Dubai" },
  "Asia/Kolkata": { aliases: ["kolkata", "delhi", "mumbai"], symbol: "IST" },
  "Asia/Shanghai": { aliases: ["shanghai", "beijing"], symbol: "CST" },
  "Asia/Tokyo": { aliases: ["tokyo", "jst", "japan"], symbol: "JST" },
  "Asia/Singapore": { aliases: ["singapore", "sgt"], symbol: "SGT" },
  "Australia/Sydney": { aliases: ["sydney", "aest", "aedt"], symbol: "Sydney" },
  "Pacific/Auckland": { aliases: ["auckland", "nzst"], symbol: "NZ" },
};
```

- [ ] **Step 4: Write the value boundary**

`packages/datetime/src/value.ts`:

```ts
import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "./temporal";

export const DATETIME_KIND = "datetime";
export const DURATION_KIND = "duration";

const NS_PER_SECOND = new Decimal(1e9);

/**
 * A datetime `Value` is an ordinary `Value` — no new field, no class instance.
 *
 * `canonical` is the epoch nanosecond count, which is what makes ordering and
 * subtraction work without the engine knowing what a date is. The zone and the
 * wall clock live on `meta.iso`, as a string rather than a Temporal object:
 * `Result` has to survive `JSON.stringify` for `@smartput/http`, and core's
 * `deepFreeze` walks whatever it is handed.
 */
export function wrap(zdt: Temporal.ZonedDateTime): Value {
  return Object.freeze({
    kind: DATETIME_KIND,
    canonical: new Decimal(zdt.epochNanoseconds.toString()),
    unit: zdt.timeZoneId,
    meta: Object.freeze({ iso: zdt.toString() }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(`datetime value is missing meta.iso: ${JSON.stringify(value.unit)}`);
  }
  return Temporal.ZonedDateTime.from(iso);
}

/** Seconds per core duration unit. Mirrors `duration.ts`'s ratio table. */
const DURATION_SECONDS: Record<string, number> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3_600,
  d: 86_400,
  wk: 604_800,
};

/** Largest first: `durationValue` reports in the biggest unit that reads >= 1. */
const DURATION_SCALE: Array<[string, number]> = [
  ["wk", 604_800],
  ["d", 86_400],
  ["h", 3_600],
  ["min", 60],
  ["s", 1],
  ["ms", 0.001],
];

/**
 * The difference between two datetimes, as a core `duration`.
 *
 * Spec §8 says the result keeps the left operand's unit, but the left operand
 * here is a datetime whose "unit" is a time zone — there is no unit to keep. So
 * the largest unit the magnitude fills is chosen instead, which is what makes
 * a three-week gap read as "3wk" rather than "1814400s".
 */
export function durationValue(nanoseconds: Decimal): Value {
  const seconds = nanoseconds.div(NS_PER_SECOND);
  const magnitude = seconds.abs();
  const found = DURATION_SCALE.find(([, size]) => magnitude.gte(size));
  return Object.freeze({
    kind: DURATION_KIND,
    canonical: seconds,
    unit: found?.[0] ?? "s",
  });
}

/**
 * Adds (sign 1) or subtracts (sign -1) a core `duration` from a datetime.
 *
 * A whole number of days or weeks is added through the *calendar*, so a DST
 * boundary moves the wall clock rather than the instant — spec §8's "date math
 * uses Temporal, never milliseconds". Everything else is exact: two hours is
 * two hours whatever the calendar is doing.
 */
export function addDuration(
  zdt: Temporal.ZonedDateTime,
  duration: Value,
  sign: 1 | -1,
): Temporal.ZonedDateTime {
  const perUnit = DURATION_SECONDS[duration.unit];
  const authored =
    perUnit === undefined ? null : duration.canonical.div(perUnit).times(sign);

  if (authored !== null && authored.isInteger()) {
    if (duration.unit === "d") return zdt.add({ days: authored.toNumber() });
    if (duration.unit === "wk") return zdt.add({ weeks: authored.toNumber() });
  }

  const nanoseconds = duration.canonical.times(NS_PER_SECOND).times(sign);
  return zdt.add(
    Temporal.Duration.from({ nanoseconds: Number(nanoseconds.toFixed(0)) }),
  );
}
```

- [ ] **Step 5: Run the value tests**

Run: `bun test packages/datetime/src/value.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing kind test**

`packages/datetime/src/datetime.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { datetime } from "./datetime";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("a bare date evaluates", () => {
  const r = engine.evaluate("today");
  expect(r.kind).toBe("datetime");
  expect(r.value.meta?.iso).toBe("2026-01-15T00:00:00+00:00[UTC]");
  expect(r.formatted).toBe("2026-01-15 00:00 UTC");
});

test("adding a duration is a datetime", () => {
  expect(engine.evaluate("today + 3 d").formatted).toBe("2026-01-18 00:00 UTC");
  expect(engine.evaluate("today + 2 h").formatted).toBe("2026-01-15 02:00 UTC");
});

test("a duration may lead", () => {
  expect(engine.evaluate("3 d + today").formatted).toBe("2026-01-18 00:00 UTC");
});

test("subtracting a duration is a datetime", () => {
  expect(engine.evaluate("today - 1 wk").formatted).toBe("2026-01-08 00:00 UTC");
});

test("the difference of two datetimes is a duration", () => {
  const r = engine.evaluate("2026-01-18 - today");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("259200");
  expect(r.formatted).toBe("3 days");
});

test("`in` converts the zone and keeps the instant", () => {
  const r = engine.evaluate("3pm in tokyo");
  expect(r.kind).toBe("datetime");
  expect(r.formatted).toBe("2026-01-16 00:00 JST");
  expect(r.value.canonical.toString()).toBe(
    engine.evaluate("3pm").value.canonical.toString(),
  );
});

test("duration arithmetic still needs no date at all", () => {
  const r = engine.evaluate("30 hours - 10 minutes");
  expect(r.kind).toBe("duration");
  expect(r.formatted).toBe("29.833333333333333333333333 hours");
});

test("a length expression is untouched by the date matcher", () => {
  expect(engine.evaluate("10 km + 5 km").kind).toBe("length");
});

test("multiplying a datetime is refused", () => {
  expect(() => engine.evaluate("today * 2")).toThrow(/datetime/);
});

test("a datetime is JSON-serialisable end to end", () => {
  const r = engine.evaluate("today");
  expect(JSON.parse(JSON.stringify(r.value))).toEqual({
    kind: "datetime",
    canonical: r.value.canonical.toString(),
    unit: "UTC",
    meta: { iso: "2026-01-15T00:00:00+00:00[UTC]" },
  });
});
```

The `30 hours - 10 minutes` expectation is whatever core already produces today —
run `bun test packages/core -t "30 hours"` or evaluate it once and paste the exact
string. It is asserted here to prove M4 did not disturb it.

- [ ] **Step 7: Run and watch it fail**

Run: `bun test packages/datetime/src/datetime.test.ts`
Expected: FAIL — `Cannot find module './datetime'`.

- [ ] **Step 8: Write the kind**

`packages/datetime/src/datetime.ts`:

```ts
import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { parseDateTime } from "./chrono-bridge";
import { addDuration, DATETIME_KIND, durationValue, unwrap, wrap } from "./value";
import { ZONES } from "./zones";

/**
 * The one matcher this kind registers. Everything date-shaped enters the engine
 * through here — there is no other path, and core knows nothing about dates.
 */
const dateLiteral: LiteralMatcher = (input, offset, ctx) => {
  const match = parseDateTime(input, offset, ctx);
  if (match === null) return null;
  const value = wrap(match.zdt);
  return {
    kind: DATETIME_KIND,
    unit: value.unit,
    canonical: value.canonical,
    ...(value.meta ? { meta: value.meta } : {}),
    length: match.length,
  };
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * `YYYY-MM-DD HH:MM <zone>`, built from Temporal fields rather than
 * `Intl.DateTimeFormat`.
 *
 * The golden corpus asserts formatted output verbatim (spec §10), and ICU's
 * date patterns move between runtime versions — a locale-aware date format
 * would make the corpus a test of the host's ICU build. Locale-aware date
 * formatting is M5's problem, together with the rest of i18n.
 */
function formatDateTime(iso: string): string {
  const zdt = Temporal.ZonedDateTime.from(iso);
  const date = `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}`;
  const time = `${pad(zdt.hour)}:${pad(zdt.minute)}`;
  return `${date} ${time} ${ZONES[zdt.timeZoneId]?.symbol ?? zdt.timeZoneId}`;
}

const units: Record<string, { aliases: string[]; symbol: string }> = {};
for (const [zone, def] of Object.entries(ZONES)) {
  units[zone] = { aliases: [...def.aliases], symbol: def.symbol };
}

/**
 * An instant with a time zone. Opaque, because it is not a scalar on a ratio
 * line: its "units" are IANA zones, and every operation it supports is a
 * declared signature. The engine has no date-specific code anywhere — which is
 * the whole claim M4 exists to test.
 */
export const datetime: Kind = defineKind({
  id: DATETIME_KIND,
  value: { mode: "opaque", units },
  literals: [dateLiteral],
  ops: [
    {
      op: "+",
      left: DATETIME_KIND,
      right: "duration",
      result: DATETIME_KIND,
      apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
    },
    {
      // "3 d + today" is the same expression written the other way round, and a
      // solver that has no signature for it reports a dimension mismatch on
      // input a user considers obviously fine.
      op: "+",
      left: "duration",
      right: DATETIME_KIND,
      result: DATETIME_KIND,
      apply: (l, r) => wrap(addDuration(unwrap(r), l, 1)),
    },
    {
      op: "-",
      left: DATETIME_KIND,
      right: "duration",
      result: DATETIME_KIND,
      apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
    },
    {
      op: "-",
      left: DATETIME_KIND,
      right: DATETIME_KIND,
      result: "duration",
      apply: (l, r) => durationValue(l.canonical.minus(r.canonical)),
    },
    {
      // Time-zone conversion is an op, not a subsystem (spec §8): the target of
      // `in` is a unit of this kind, and a unit of this kind is a zone.
      op: "in",
      left: DATETIME_KIND,
      right: DATETIME_KIND,
      result: DATETIME_KIND,
      apply: (l, r) => wrap(unwrap(l).withTimeZone(r.unit)),
    },
  ],
  format: (value) => formatDateTime(String(value.meta?.iso ?? "")),
});
```

The file's imports are therefore:

```ts
import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { parseDateTime } from "./chrono-bridge";
import { Temporal } from "./temporal";
import { addDuration, DATETIME_KIND, durationValue, unwrap, wrap } from "./value";
import { ZONES } from "./zones";
```

- [ ] **Step 9: Run the tests**

Run: `bun test packages/datetime && bun run typecheck`
Expected: PASS. If `3pm in tokyo` reports `DimensionMismatchError`, check that
`tokyo` reached the alias index — that is Task 1's opaque-units change.

- [ ] **Step 10: Commit**

```bash
git add packages/datetime/src
git commit -m "feat(datetime): datetime kind, zones, Temporal ops"
```

---

### Task 8: Locale pack and package exports

**Files:**
- Create: `packages/datetime/src/locale/en.ts`
- Create: `packages/datetime/src/locale/en.test.ts`
- Create: `packages/datetime/src/index.ts`
- Create: `packages/datetime/src/index.test.ts`

**Interfaces:**
- Consumes: `datetime`, `ZONES`, `wrap`, `unwrap` (Task 7).
- Produces:
  - default export from `@smartput/datetime/locale/en`: a `LocalePack` contributing English zone vocabulary
  - `@smartput/datetime` exports `datetime`, `DATETIME_KIND`, `ZONES`, `wrap`, `unwrap`, `parseDateTime`, `Temporal`

- [ ] **Step 1: Write the failing tests**

`packages/datetime/src/locale/en.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import en from "./en";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime],
  packs: [en],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("the pack targets English", () => {
  expect(en.locale).toBe("en");
});

test("the pack adds spelled-out zone words", () => {
  expect(engine.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
});

test("every unit the pack contributes exists on the kind", () => {
  const units = Object.keys(en.contributes.datetime ?? {});
  expect(units.length).toBeGreaterThan(0);
  const declared = new Set(Object.keys((datetime.value as { units: object }).units));
  for (const unit of units) expect(declared.has(unit)).toBe(true);
});
```

`packages/datetime/src/index.test.ts`:

```ts
import { expect, test } from "bun:test";
import * as api from "./index";

test("the public surface is what the package promises", () => {
  expect(Object.keys(api).sort()).toEqual([
    "DATETIME_KIND",
    "Temporal",
    "ZONES",
    "datetime",
    "parseDateTime",
    "unwrap",
    "wrap",
  ]);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun test packages/datetime/src/locale packages/datetime/src/index.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the pack**

`packages/datetime/src/locale/en.ts`:

```ts
import { defineLocalePack, type Lexicon } from "@smartput/core";
import { DATETIME_KIND } from "../value";

/**
 * English words for the registered zones, beyond the abbreviations the kind
 * itself ships.
 *
 * Vocabulary lives with the kind that defines it (spec §4.6), and a pack rather
 * than a bigger `ZONES` table because that is the seam third parties extend:
 * `smartput-locale-uk-zones` contributes through this same channel, and using
 * it here is what proves the channel works.
 */
const datetimeLexicon: Lexicon = {
  UTC: ["universal"],
  "America/New_York": ["manhattan", "brooklyn"],
  "America/Los_Angeles": ["hollywood"],
  "Europe/London": ["england", "britain"],
  "Europe/Paris": ["france"],
  "Europe/Berlin": ["germany"],
  "Europe/Kyiv": ["ukraine"],
  "Asia/Tokyo": ["japan"],
  "Asia/Shanghai": ["china"],
  "Asia/Kolkata": ["india"],
  "Australia/Sydney": ["australia"],
  "Pacific/Auckland": ["nz"],
};

export default defineLocalePack({
  locale: "en",
  contributes: { [DATETIME_KIND]: datetimeLexicon },
});
```

Note `japan` also appears in `ZONES`'s own aliases; a pack's aliases are unioned
with the kind's, so the duplicate is harmless and the test above still passes.

- [ ] **Step 4: Write the index**

`packages/datetime/src/index.ts`:

```ts
export { parseDateTime } from "./chrono-bridge";
export { datetime } from "./datetime";
export { Temporal } from "./temporal";
export { DATETIME_KIND, unwrap, wrap } from "./value";
export { ZONES } from "./zones";
```

`TEST_NOW` and `TEST_ZONE` are deliberately not exported: they are the repo's
test fixtures, not API.

- [ ] **Step 5: Run the tests**

Run: `bun test packages/datetime && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/datetime/src
git commit -m "feat(datetime): English zone pack and public exports"
```

---

### Task 9: Golden corpus and integration

**Files:**
- Create: `packages/datetime/corpus/en.tsv`
- Create: `packages/datetime/src/corpus.test.ts`
- Create: `packages/datetime/src/integration.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the regression suite for M4.

- [ ] **Step 1: Write the corpus runner**

`packages/datetime/src/corpus.test.ts` (the same shape as `packages/rates/src/corpus.test.ts`):

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime } from "./datetime";
import en from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const engine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime],
  packs: [en],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(20);
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

- [ ] **Step 2: Author the corpus**

`packages/datetime/corpus/en.tsv`. Columns are
`input ⇥ kind ⇥ canonical ⇥ formatted`, tab-separated. The clock is
2026-01-15T12:00Z, a **Thursday**, and the zone is UTC.

The `formatted` column is the human-checkable one — write it by hand from the
rules (`YYYY-MM-DD HH:MM <zone symbol>`, midnight when no time was typed). The
`canonical` column is the epoch nanosecond count for a datetime and the second
count for a duration; derive it by running

```bash
bun -e 'import {createEngine,BUILTIN_KINDS} from "@smartput/core";
import en from "@smartput/core/locale/en";
import {datetime} from "./packages/datetime/src/datetime";
const e=createEngine({locales:[en],kinds:[...BUILTIN_KINDS,datetime],now:()=>1768478400000,timeZone:"UTC"});
for (const i of ["today","tomorrow"]) { const r=e.evaluate(i);
console.log([i,r.kind,r.value.canonical.toString(),r.formatted].join("\t")); }'
```

and pasting the output — **after** checking that the `formatted` column it printed
is the one you wrote by hand. A row whose formatted value is wrong is a bug to
fix, never a number to paste.

Rows to include, at minimum:

```
# datetime — recognition
today
tomorrow
yesterday
next week monday
next friday
last monday
3pm
9:30
2026-03-01
2026-03-01 08:00
in 3 days
3 days ago

# datetime — arithmetic against core's duration kind
today + 3 d
today - 1 wk
3 d + today
today + 2 h
today + 90 min
tomorrow - today
2026-03-01 - today

# time-zone conversion
3pm in tokyo
today in nyc
9:30 in london
3pm in japan

# nothing here is a date — the accept-gate holds
10 km + 5 km
30 hours - 10 minutes
5 min
20 C
2 wk
```

The last block's rows keep their existing kinds (`length`, `duration`,
`temperature`, `duration`) and their existing formatted output. They are the
regression guard for ruling R4: if a future chrono upgrade starts claiming them,
these rows fail loudly.

- [ ] **Step 3: Write the integration tests**

`packages/datetime/src/integration.test.ts`:

```ts
import { expect, test } from "bun:test";
import { AmbiguityError, BUILTIN_KINDS, createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime } from "./datetime";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const make = (extra: Record<string, unknown> = {}) =>
  createEngine({
    locales: [coreEn],
    kinds: [...BUILTIN_KINDS, datetime],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
    ...extra,
  });

test("an engine without the datetime kind does not know what today is", () => {
  const bare = createEngine({ locales: [coreEn], kinds: [...BUILTIN_KINDS] });
  expect(() => bare.evaluate("today")).toThrow();
});

test("suggest ranks a date and never throws", () => {
  const engine = make();
  const results = engine.suggest("today");
  expect(results[0]?.kind).toBe("datetime");
  expect(engine.suggest("!!!")).toEqual([]);
});

test("coerce targets the datetime kind", () => {
  expect(make().coerce("datetime", "tomorrow").unit).toBe("UTC");
});

test("explain names the literal and its weight contributions", () => {
  const explanation = make().explain("today");
  expect(explanation.candidates[0]).toMatchObject({ kind: "datetime", surface: "today" });
  expect(explanation.assignments[0]?.confidence).toBeCloseTo(1);
});

test("a weight override can outrank a date", () => {
  // "9:30" is a date by default; a large negative weight on the whole kind
  // demotes it, which is the four-layer weight model working on a plugin kind.
  const demoted = make({ weights: { datetime: -1000 } });
  expect(demoted.suggest("9:30 in tokyo")).toEqual([]);
});

test("the engine's timeZone changes what a bare time means", () => {
  const tokyo = make({ timeZone: "Asia/Tokyo" });
  expect(tokyo.evaluate("3pm").formatted).toBe("2026-01-15 15:00 JST");
  expect(tokyo.evaluate("3pm").value.canonical.toString()).not.toBe(
    make().evaluate("3pm").value.canonical.toString(),
  );
});

test("a per-call timeZone overrides the engine's", () => {
  expect(make().evaluate("3pm", { timeZone: "Asia/Tokyo" }).formatted).toBe(
    "2026-01-15 15:00 JST",
  );
});

test("the clock is injectable, so nothing depends on the wall clock", () => {
  const later = make({ now: () => TEST_NOW + 86_400_000 });
  expect(later.evaluate("today").formatted).toBe("2026-01-16 00:00 UTC");
});

test("AmbiguityError is still reachable for genuinely ambiguous units", () => {
  expect(() => make().evaluate("10 m")).toThrow(AmbiguityError);
});
```

If `demoted.suggest("9:30 in tokyo")` does not come back empty — the literal is
still the only reading of that text, so the weight cannot change *which* reading
wins, only its score — replace the assertion with one on
`explain("9:30").assignments[0]?.contributions`, asserting the `-1000` row is
present. Weights are proven by the contribution row either way; do not delete the
test.

- [ ] **Step 4: Run everything**

Run: `bun run check`
Expected: lint, typecheck, check-deps and the full test suite all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/datetime
git commit -m "test(datetime): golden corpus and integration suite"
```

---

### Task 10: Documentation

**Files:**
- Create: `docs/guide/datetime.md`
- Create: `docs/superpowers/m4-followups.md`
- Modify: `docs/guide/roadmap.md`
- Modify: `docs/api/define-kind.md`
- Modify: `docs/.vitepress/config.ts` (sidebar entry for the new guide page)

**Interfaces:**
- Consumes: the shipped package.
- Produces: docs matching the code.

- [ ] **Step 1: Write the guide page**

`docs/guide/datetime.md` — front matter matching the other guide pages
(`title`, `description`), then:

1. Install and register: the `createEngine({ kinds: [...BUILTIN_KINDS, datetime], now, timeZone })` snippet.
2. What it recognises: the corpus's recognition block, as a table of input → output.
3. Arithmetic: `today + 3 d`, `tomorrow - today`, and the sentence that `duration` lives in core, so `30 hours - 10 minutes` never loads Temporal.
4. Time zones: the `in` operator, the `ZONES` table, the single-word alias rule (R9), and how to add a zone with a `LocalePack`.
5. How it works: literal matchers, the accept-gate (R4), and the fact that core contains no date-specific code.
6. Limits: no locale-aware date formatting yet (R7), no recurrence, no historical zone names, no date completion (R8).

Every code block must be copy-pasteable and must actually run — verify each one
against the test suite's expectations before committing.

- [ ] **Step 2: Update the roadmap**

In `docs/guide/roadmap.md`: move M4's status to **Shipped**, move
`@smartput/datetime` from the Planned block to the Shipped block, and add the
`datetime` row to the runtime-dependency table
(`temporal-polyfill`, `chrono-node`, `@smartput/core`, `decimal.js`).

- [ ] **Step 3: Document the extension point**

In `docs/api/define-kind.md`, add a section documenting `Kind.literals`,
`LiteralMatcher`, `LiteralMatch` and `MatchCtx`, plus the opaque-kind `units`
field — with the shortest possible working matcher as the example, and a note
that the fold is destructive so a matcher must be conservative.

- [ ] **Step 4: Record the followups**

`docs/superpowers/m4-followups.md`, in the shape of `m3-followups.md`:

- Locale-aware date formatting (`Intl.DateTimeFormat`) — deferred to M5, needs a
  corpus strategy that does not assert ICU output verbatim.
- Multi-word zone aliases (`"new york"`) — needs a multi-word alias index.
- Date completion — `complete()` skips opaque kinds; a date completion has a
  different shape from `<number><unit>`.
- A `DateTime` facade class — `createFacade` refuses opaque kinds today.
- Non-destructive literal folding — today a claimed run erases the alternative
  reading; a lattice would let the solver choose. The accept-gate is the
  workaround.
- `chrono` locales beyond `en` — M5's Ukrainian work needs `chrono.uk`, which
  does not exist upstream.

- [ ] **Step 5: Verify the docs build**

Run: `bun run docs:build`
Expected: builds with no dead links.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: document the datetime package and M4 followups"
```

---

## Definition of done

- [ ] `bun run check` passes: `lint`, `typecheck`, `check-deps`, `bun test`.
- [ ] `packages/core/package.json` still lists exactly one dependency.
- [ ] `bun run docs:build` succeeds.
- [ ] Every corpus row's `formatted` column was written by hand before its
      `canonical` column was pasted.
- [ ] Core contains no occurrence of "date", "time zone", "chrono" or "Temporal"
      outside comments — the seam is real or M4 has not been achieved.
