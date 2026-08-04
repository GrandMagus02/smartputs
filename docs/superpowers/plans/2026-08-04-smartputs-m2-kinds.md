# smartputs M2 — Kinds and Facades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the M1 Kind contract under every numeric shape — affine (temperature), context-dependent (dpi-relative pixels), derived (speed/area/volume), and relative (percent) — and generate the public facade classes from kind descriptors.

**Architecture:** M1 built the engine; M2 adds data plus three small, generic mechanisms it turned out to need. Nothing here special-cases a kind by name: affine behaviour comes from `RatioSpec.affine`, percent arithmetic is generated the same way number scaling already is, derived quantities are ordinary `OpSignature`s, and dpi rides in `Value.meta` through a per-kind default. The facade generator reads a `NormalizedKind` and returns a class.

**Tech Stack:** TypeScript (strict), Bun, Biome, `decimal.js`. Unchanged from M1.

**Spec:** `docs/superpowers/specs/2026-08-04-smartputs-design.md`. Read §3 (Value model and facade surface), §4 (`RatioSpec.affine`, `OpSignature`), §8 (semantics — temperature and percent are specified there, not in §11), and §11's M2 row.

**Inherited context:** `docs/superpowers/m1-followups.md`. Several items there are scheduled into Task 11 of this plan. Two rulings recorded there bind this milestone: registration stays explicit (`kinds` is the entire registry), and analyzer case-folding is deferred to M5 — **`1.5 KILOGRAMS` stays broken, do not fix it here.**

## Global Constraints

Every task's requirements implicitly include this section. All are unchanged from M1 and already enforced by `bun run check`.

- **`@smartput/core` has exactly ONE runtime dependency: `decimal.js`.** CI fails on a second.
- **ESM only.** No CJS, no `require`.
- **TypeScript `strict: true`**, plus `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`.
- **Biome**, `noExplicitAny` enabled. No `any`.
- **Decimal precision is 28 significant digits.** Never a JS float for a user-visible value — and note `5 / 9` is a float *before* Decimal sees it; write `new Decimal(5).div(9)`.
- **Immutability.** Descriptors are deep-frozen; every operation returns a new object.
- **Determinism.** Identical input and options produce identical ranking every run.
- **No network, no wall clock in tests.**
- **Test files are colocated**: `src/foo.ts` ↔ `src/foo.test.ts`. Run with `bun test`.
- **Conventional Commits.** One commit per task, at the end.

### Verification of expected values

Nine defects in the M1 plan were caught by implementers who stopped rather than edit a failing expectation — every one lived in a test fixture. Where this plan asserts an exact decimal string, it was computed by running the arithmetic, not by hand. If one still disagrees with your implementation, investigate before touching it, and report rather than adjusting it.

---

## File Structure

All paths relative to `packages/core/`.

| File | Responsibility | Status |
| --- | --- | --- |
| `src/kind/ratio-ops.ts` | Generated op signatures. Gains an affine branch and percent generation. | Modify |
| `src/types.ts` | Gains `OpSignature.assumption`, `"of"` on `OpSymbol`. | Modify |
| `src/eval/evaluate.ts` | Returns assumptions alongside the value; attaches per-kind default meta. | Modify |
| `src/engine.ts` | `kindMeta` option; surfaces assumptions in `Result.meta`. | Modify |
| `src/parse/pratt.ts` | Handles the `of` keyword as a binary operator. | Modify |
| `src/kinds/temperature.ts` | `temperature` + `tempdelta`. | Create |
| `src/kinds/percent.ts` | `percent`. | Create |
| `src/kinds/angle.ts` | `angle`. | Create |
| `src/kinds/datasize.ts` | `datasize`. | Create |
| `src/kinds/measure.ts` | `measure` (dpi-relative). | Create |
| `src/kinds/derived.ts` | `speed`, `area`, `volume` and their cross-kind signatures. | Create |
| `src/facade/quantity.ts` | The facade contract and `createFacade`. | Create |
| `src/facade/index.ts` | `createFacades` plus the named classes. | Create |
| `src/kinds/index.ts` | `BUILTIN_KINDS` gains the new kinds. | Modify |
| `src/locale/en.ts` | Drops unimplemented keywords and a redundant analyzer. | Modify |
| `corpus/en.tsv` | Rows for every new kind. | Modify |

---

## Task 1: Affine and percent op generation

**Files:**
- Modify: `packages/core/src/kind/ratio-ops.ts`
- Modify: `packages/core/src/kind/registry.ts` (re-export `PERCENT_KIND`)
- Test: `packages/core/src/kind/ratio-ops.test.ts` (create)

**Interfaces:**
- Consumes: `NormalizedKind` from `kind/define.ts`; `generateRatioOps` as it exists.
- Produces: `PERCENT_KIND = "percent"`, exported from `ratio-ops.ts` and re-exported from `registry.ts`. `generateRatioOps` gains two behaviours: affine kinds get no `+`/`*`/`/` and their `-` yields the delta kind; every non-`number`, non-`percent` ratio kind additionally gets `+|K|percent`, `-|K|percent` and `of|percent|K`.

**Why:** Spec §8 requires `20°C * 2` to always raise `DimensionMismatchError` — an absolute temperature has no meaningful product. Since the op table *is* the type system, the only way to forbid it is to not generate it. Percent generation is the same trick `NUMBER_KIND` already uses: it makes `1 kg + 20%` work for third-party kinds nobody has written yet.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kind/ratio-ops.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineKind, normalizeKind } from "./define";
import { generateRatioOps, NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";

const keys = (k: Parameters<typeof generateRatioOps>[0]) =>
  generateRatioOps(k).map((s) => `${s.op}|${s.left}|${s.right}`);

const mass = normalizeKind(
  defineKind({ id: "mass", value: { mode: "ratio", canonical: "g", units: { g: 1 } } }),
);

const temp = normalizeKind(
  defineKind({
    id: "temperature",
    value: {
      mode: "ratio",
      canonical: "c",
      units: { c: 1 },
      affine: { deltaKind: "tempdelta" },
    },
  }),
);

test("an ordinary ratio kind scales by number in both orders", () => {
  expect(keys(mass)).toContain("*|mass|number");
  expect(keys(mass)).toContain("*|number|mass");
  expect(keys(mass)).toContain("/|mass|number");
});

test("an ordinary ratio kind gets percent arithmetic for free", () => {
  expect(keys(mass)).toContain("+|mass|percent");
  expect(keys(mass)).toContain("-|mass|percent");
  expect(keys(mass)).toContain("of|percent|mass");
});

test("an affine kind cannot be scaled or added to itself", () => {
  const k = keys(temp);
  expect(k).not.toContain("*|temperature|number");
  expect(k).not.toContain("*|number|temperature");
  expect(k).not.toContain("/|temperature|number");
  expect(k).not.toContain("+|temperature|temperature");
  expect(k).not.toContain("+|temperature|percent");
});

test("subtracting two absolute temperatures yields the delta kind", () => {
  const sig = generateRatioOps(temp).find((s) => s.op === "-");
  expect(sig?.left).toBe("temperature");
  expect(sig?.right).toBe("temperature");
  expect(sig?.result).toBe("tempdelta");
});

test("an affine kind still converts between its own units", () => {
  expect(keys(temp)).toContain("in|temperature|temperature");
});

test("number and percent do not generate percent arithmetic for themselves", () => {
  const number = normalizeKind(
    defineKind({ id: NUMBER_KIND, value: { mode: "ratio", canonical: "one", units: { one: 1 } } }),
  );
  const percent = normalizeKind(
    defineKind({ id: PERCENT_KIND, value: { mode: "ratio", canonical: "ratio", units: { "%": 0.01 } } }),
  );
  expect(keys(number)).not.toContain("+|number|percent");
  expect(keys(percent)).not.toContain("+|percent|percent");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kind/ratio-ops.test.ts`
Expected: FAIL — `PERCENT_KIND` is not exported.

- [ ] **Step 3: Rewrite `generateRatioOps`**

Replace the body of `packages/core/src/kind/ratio-ops.ts` below the existing `wrap` helper:

```ts
export const NUMBER_KIND = "number";
export const PERCENT_KIND = "percent";

export function generateRatioOps(kind: NormalizedKind): OpSignature[] {
  if (kind.spec.mode !== "ratio") return [];
  const id = kind.id;
  const affine = kind.spec.affine;

  // Conversion between a kind's own units is always available.
  const ops: OpSignature[] = [
    { op: "in", left: id, right: id, result: id, apply: (l, r) => wrap(r, l.canonical) },
  ];

  if (affine !== undefined) {
    // An absolute point on an affine scale has no sum and no product: 20°C + 20°C
    // and 20°C * 2 are both meaningless. Difference is the one exception, and it
    // yields a delta rather than another absolute point. Everything else this
    // kind supports is declared explicitly by the kind itself.
    ops.push({
      op: "-",
      left: id,
      right: id,
      result: affine.deltaKind,
      apply: (l, r) =>
        Object.freeze({
          kind: affine.deltaKind,
          canonical: l.canonical.minus(r.canonical),
          unit: l.unit,
        }),
    });
    return ops;
  }

  ops.push(
    { op: "+", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.plus(r.canonical)) },
    { op: "-", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.minus(r.canonical)) },
  );

  if (id === NUMBER_KIND || id === PERCENT_KIND) {
    ops.push(
      { op: "*", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.times(r.canonical)) },
      { op: "/", left: id, right: id, result: id, apply: (l, r) => wrap(l, l.canonical.div(r.canonical)) },
    );
    return ops;
  }

  ops.push(
    { op: "*", left: id, right: NUMBER_KIND, result: id, apply: (l, r) => wrap(l, l.canonical.times(r.canonical)) },
    { op: "*", left: NUMBER_KIND, right: id, result: id, apply: (l, r) => wrap(r, r.canonical.times(l.canonical)) },
    { op: "/", left: id, right: NUMBER_KIND, result: id, apply: (l, r) => wrap(l, l.canonical.div(r.canonical)) },
    // Percent is relative to the left operand: 50 + 20% is 60, not 50.2.
    // Generated per kind for the same reason number scaling is — so a
    // third-party kind gets it without declaring anything.
    {
      op: "+",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(r.canonical.plus(1))),
    },
    {
      op: "-",
      left: id,
      right: PERCENT_KIND,
      result: id,
      apply: (l, r) => wrap(l, l.canonical.times(new Decimal(1).minus(r.canonical))),
    },
    {
      op: "of",
      left: PERCENT_KIND,
      right: id,
      result: id,
      apply: (l, r) => wrap(r, r.canonical.times(l.canonical)),
    },
  );

  return ops;
}
```

Change the import at the top of the file from `import type { Decimal }` to `import { Decimal }` — the `-|K|percent` signature constructs one.

- [ ] **Step 4: Re-export the constant**

In `packages/core/src/kind/registry.ts`, change the re-export line to:

```ts
export { NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";
```

- [ ] **Step 5: Run the check**

Run: `bun run check`
Expected: all green. The existing M1 suite must still pass — no M1 kind is affine, and percent signatures are additive.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/kind
git commit -m "feat(core): generate affine and percent op signatures"
```

---

## Task 2: Assumptions surfaced through evaluation

**Files:**
- Modify: `packages/core/src/types.ts` (add `OpSignature.assumption`)
- Modify: `packages/core/src/eval/evaluate.ts`
- Modify: `packages/core/src/engine.ts`
- Test: `packages/core/src/eval/evaluate.test.ts`, `packages/core/src/engine.test.ts`

**Interfaces:**
- Consumes: `evaluateNode(node, assignment, registry, locale, input): Value` as M1 left it.
- Produces: `OpSignature.assumption?: string`; `evaluateNode(...): { value: Value; assumptions: string[] }` — **a breaking change to the M1 signature**; `Result.meta.assumptions` is now populated rather than always `[]`.

**Why:** Spec §8 requires `20°C + 5°C` to record an assumption. `Result.meta.assumptions` exists but is hardcoded `[]`. Rather than teach the engine about temperature, an op signature declares its own assumption and evaluation collects them — a general mechanism M3's FX cross-rate hop will reuse.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/eval/evaluate.test.ts`:

```ts
test("evaluateNode collects the assumption of every signature it applies", () => {
  const noted = defineKind({
    id: "length",
    extendsKind: "length",
    value: { mode: "ratio", canonical: "m", units: {} },
    ops: [
      {
        op: "of",
        left: "number",
        right: "length",
        result: "length",
        assumption: "read as a scale factor",
        apply: (l, r) => Object.freeze({ ...r, canonical: r.canonical.times(l.canonical) }),
      },
    ],
  });
  const r = buildRegistry([number, length, duration, noted]);
  const resolver = createResolver({ registry: r, locale: en, packs: [], layers: [] });
  const input = "2 of 10 km";
  const node = parse(lex(input, en), resolver, input);
  const [best] = solve(node, r, { maxCandidates: 10_000, input });
  if (best === undefined) throw new Error("no assignment");

  const out = evaluateNode(node, best, r, "en", input);
  expect(out.value.canonical.toString()).toBe("20000");
  expect(out.assumptions).toEqual(["read as a scale factor"]);
});

test("a plain expression records no assumptions", () => {
  expect(evaluate("1 km + 500 m").assumptions).toEqual([]);
});
```

The existing `evaluate` helper in that file returns a `Value`; change it to return the whole result object and update the other assertions in the file from `evaluate(x).canonical` to `evaluate(x).value.canonical` and `.unit` likewise. That mechanical rename is part of this step.

Note this test needs `"of"` on `OpSymbol` (Task 4 adds parser support; the type widening happens here).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/eval/evaluate.test.ts`
Expected: FAIL — `assumption` is not a property of `OpSignature`.

- [ ] **Step 3: Widen the types**

In `packages/core/src/types.ts`:

```ts
export type OpSymbol = "+" | "-" | "*" | "/" | "in" | "of";
```

and add one field to `OpSignature`:

```ts
export interface OpSignature {
  op: OpSymbol;
  left: KindId;
  right: KindId;
  result: KindId;
  /**
   * Recorded on the Result whenever this signature is applied. For operations
   * that are defensible but not the only reading of the input — "20C + 5C"
   * treats the right operand as a difference, because the alternative is
   * meaningless rather than because the user said so.
   */
  assumption?: string;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}
```

- [ ] **Step 4: Collect assumptions during evaluation**

Rewrite `packages/core/src/eval/evaluate.ts`'s exported function:

```ts
export interface EvalResult {
  value: Value;
  assumptions: string[];
}

export function evaluateNode(
  node: Node,
  assignment: Assignment,
  registry: Registry,
  locale: string,
  input: string,
  kindMeta: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): EvalResult {
  const assumptions: string[] = [];
  const ctxFor = (self: Value): EvalCtx => ({ self, locale });

  const note = (sig: OpSignature): void => {
    if (sig.assumption !== undefined && !assumptions.includes(sig.assumption)) {
      assumptions.push(sig.assumption);
    }
  };

  const evalNode = (n: Node): Value => {
    switch (n.type) {
      case "number":
        return Object.freeze({ kind: NUMBER_KIND, canonical: n.value, unit: "one" });

      case "quantity": {
        const choice = assignment.choices.get(n);
        if (choice === undefined)
          throw new DimensionMismatchError(input, "quantity", "?", "?");
        const kind = registry.kinds.get(choice.kind);
        if (kind === undefined)
          throw new DimensionMismatchError(input, "quantity", choice.kind, "?");
        // Per-kind default meta is how a px measure learns its dpi without the
        // evaluator knowing what dpi is.
        const meta = kindMeta[choice.kind];
        return Object.freeze({
          kind: choice.kind,
          canonical: toCanonical(n.value, kind, choice.unit, locale, meta),
          unit: choice.unit,
          ...(meta ? { meta } : {}),
        });
      }

      case "unary": {
        const operand = evalNode(n.operand);
        return Object.freeze({ ...operand, canonical: operand.canonical.negated() });
      }

      case "convert": {
        const operand = evalNode(n.operand);
        const target = assignment.choices.get(n);
        if (target === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, "?");
        const sig = registry.ops.get(opKey("in", operand.kind, target.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, target.kind);
        note(sig);
        const rhs: Value = Object.freeze({
          kind: target.kind,
          canonical: new Decimal(0),
          unit: target.unit,
          ...(operand.meta ? { meta: operand.meta } : {}),
        });
        return Object.freeze(sig.apply(operand, rhs, ctxFor(operand)));
      }

      case "binary": {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        if (n.op === "/" && right.canonical.isZero()) throw new DivideByZeroError(input);
        const sig = registry.ops.get(opKey(n.op, left.kind, right.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, n.op, left.kind, right.kind);
        note(sig);
        return Object.freeze(sig.apply(left, right, ctxFor(left)));
      }
    }
  };

  return { value: evalNode(node), assumptions };
}
```

Add `OpSignature` to the type imports at the top of the file.

- [ ] **Step 5: Thread it through the engine**

In `packages/core/src/engine.ts`, add `kindMeta` to `EngineOptions`:

```ts
export interface EngineOptions {
  locales: Locale[];
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
  /**
   * Default `Value.meta` per kind, attached to every quantity of that kind.
   * The `measure` kind reads `{ dpi }` from here; nothing else uses it yet.
   */
  kindMeta?: Readonly<Record<KindId, Readonly<Record<string, unknown>>>>;
}
```

Capture it beside the other options (`const kindMeta = opts.kindMeta ?? {};`) and update `toResult`:

```ts
  function toResult(
    node: ReturnType<typeof pipeline>["node"],
    assignment: Assignment,
    input: string,
  ): Result {
    const { value, assumptions } = evaluateNode(
      node,
      assignment,
      registry,
      (locale as Locale).id,
      input,
      kindMeta,
    );
    return {
      value,
      formatted: formatValue(value, registry, locale as Locale),
      kind: value.kind,
      confidence: assignment.confidence,
      spans: [node.span],
      meta: { assumptions },
    };
  }
```

`coerce` also calls `evaluateNode`; change its return to `.value`.

- [ ] **Step 6: Run the check**

Run: `bun run check`
Expected: green. Fix any remaining `evaluateNode(...)` call sites the compiler flags.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): let op signatures declare assumptions"
```

---

## Task 3: Temperature and TempDelta

**Files:**
- Create: `packages/core/src/kinds/temperature.ts`, `packages/core/src/kinds/temperature.test.ts`

**Interfaces:**
- Consumes: `defineKind`; `PERCENT_KIND`-aware generation from Task 1; `assumption` from Task 2.
- Produces: `temperature` and `tempdelta` kinds, both exported.

**Why:** The affine shape is the one the Kind contract was least obviously able to express. Absolute temperature has an offset; a temperature *difference* has the same ratio and no offset, which is exactly why they must be separate kinds — 5°F as a reading is −15°C, but as a difference it is 2.78°C.

Priors are load-bearing here. `temperature` sits at 0 and `tempdelta` at −40, so a bare `5 C` reads as a reading, while `20 C + 5 C` — where the reading interpretation has no signature — falls to `temperature + tempdelta` rather than `tempdelta + tempdelta`, which the context bonus would otherwise win.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/temperature.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { DimensionMismatchError } from "../errors";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { temperature, tempdelta } from "./temperature";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, temperature, tempdelta],
});

test("absolute conversion applies the offset", () => {
  const r = engine.evaluate("212 F in C");
  expect(r.kind).toBe("temperature");
  expect(r.value.canonical.toString()).toBe("100");
});

test("a bare reading is absolute, not a delta", () => {
  expect(engine.evaluate("20 C").kind).toBe("temperature");
});

test("adding two readings treats the right one as a difference", () => {
  const r = engine.evaluate("20 C + 5 C");
  expect(r.kind).toBe("temperature");
  expect(r.value.canonical.toString()).toBe("25");
  expect(r.meta.assumptions.length).toBeGreaterThan(0);
});

test("a Fahrenheit difference is converted as a difference, not a reading", () => {
  // 5F as a reading is -15C; as a difference it is 5 * 5/9 = 2.7777...C.
  const r = engine.evaluate("20 C + 5 F");
  expect(r.value.canonical.toFixed(4)).toBe("22.7778");
});

test("subtracting two readings yields a difference", () => {
  const r = engine.evaluate("30 C - 20 C");
  expect(r.kind).toBe("tempdelta");
  expect(r.value.canonical.toString()).toBe("10");
});

test("scaling an absolute temperature is always an error", () => {
  expect(() => engine.evaluate("20 C * 2")).toThrow(DimensionMismatchError);
});

test("scaling a difference is fine", () => {
  const r = engine.evaluate("30 C - 20 C");
  expect(r.value.canonical.toString()).toBe("10");
  const doubled = engine.evaluate("(30 C - 20 C) * 2");
  expect(doubled.kind).toBe("tempdelta");
  expect(doubled.value.canonical.toString()).toBe("20");
});

test("kelvin is offset-only", () => {
  expect(engine.evaluate("0 K in C").value.canonical.toFixed(2)).toBe("-273.15");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/temperature.test.ts`
Expected: FAIL — `Cannot find module './temperature'`.

- [ ] **Step 3: Write the kinds**

`packages/core/src/kinds/temperature.ts`:

```ts
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";

// new Decimal(5).div(9), never 5 / 9: the latter is a JS float before Decimal
// sees it, and 212F then lands on 100.000000000000008 instead of 100.
const FIVE_NINTHS = new Decimal(5).div(9);

/** An absolute reading. Offsets apply; sums and products do not. */
export const temperature = defineKind({
  id: "temperature",
  value: {
    mode: "ratio",
    canonical: "c",
    affine: { deltaKind: "tempdelta" },
    units: {
      c: 1,
      f: { ratio: FIVE_NINTHS, offset: -32 },
      k: { ratio: 1, offset: -273.15 },
    },
  },
  lexicon: {
    c: { aliases: ["c", "celsius", "centigrade"], symbol: "°C" },
    f: { aliases: ["f", "fahrenheit"], symbol: "°F" },
    k: { aliases: ["k", "kelvin"], symbol: "K" },
  },
  ops: [
    {
      op: "+",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) =>
        Object.freeze({ kind: l.kind, canonical: l.canonical.plus(r.canonical), unit: l.unit }),
    },
    {
      op: "-",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) =>
        Object.freeze({ kind: l.kind, canonical: l.canonical.minus(r.canonical), unit: l.unit }),
    },
  ],
});

/**
 * A difference between readings. Same ratios as `temperature`, no offsets —
 * that difference is the whole point: 5F as a reading is -15C, as a difference
 * it is 2.78C.
 *
 * The prior sits well below `temperature` so a bare "5 C" reads as a reading.
 * It is low enough that "20 C + 5 C" prefers temperature+delta over
 * delta+delta, which the solver's same-kind context bonus would otherwise win.
 */
export const tempdelta = defineKind({
  id: "tempdelta",
  prior: -40,
  value: {
    mode: "ratio",
    canonical: "c",
    units: { c: 1, f: FIVE_NINTHS, k: 1 },
  },
  lexicon: {
    c: { aliases: ["c", "celsius", "centigrade"], symbol: "°C" },
    f: { aliases: ["f", "fahrenheit"], symbol: "°F" },
    k: { aliases: ["k", "kelvin"], symbol: "K" },
  },
});
```

- [ ] **Step 4: Run the tests**

Run: `bun test packages/core/src/kinds/temperature.test.ts`
Expected: PASS, 8 tests.

If "adding two readings" fails by resolving to `tempdelta`, the prior gap is too small relative to `CONTEXT_BONUS` (30). Report the observed scores from `engine.explain("20 C + 5 C")` rather than tuning the number blindly.

- [ ] **Step 5: Run the check and commit**

Run: `bun run check`

```bash
git add packages/core/src/kinds/temperature.ts packages/core/src/kinds/temperature.test.ts
git commit -m "feat(core): add affine temperature and tempdelta kinds"
```

---

## Task 4: The `of` operator and the percent kind

**Files:**
- Modify: `packages/core/src/parse/pratt.ts`
- Create: `packages/core/src/kinds/percent.ts`, `packages/core/src/kinds/percent.test.ts`
- Modify: `packages/core/src/parse/pratt.test.ts`

**Interfaces:**
- Consumes: `OpSymbol` including `"of"` (Task 2); percent signature generation (Task 1).
- Produces: the `percent` kind; `pratt.ts` parses `of` as a binary operator binding at 15.

**Why:** Spec §8 specifies three percent behaviours, and says they are three op signatures rather than special cases. Two come free from Task 1's generation; `20% of 50` needs the parser to treat `of` as an operator. Binding 15 sits between `+` (10) and `*` (20), so `50 + 20% of 100` groups as `50 + (20% of 100)`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/percent.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { percent } from "./percent";

const engine = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, percent] });

test("a bare percentage is a ratio", () => {
  const r = engine.evaluate("20%");
  expect(r.kind).toBe("percent");
  expect(r.value.canonical.toString()).toBe("0.2");
});

test("percent of a number", () => {
  const r = engine.evaluate("20% of 50");
  expect(r.kind).toBe("number");
  expect(r.value.canonical.toString()).toBe("10");
});

test("percent of a quantity keeps the quantity's kind and unit", () => {
  const r = engine.evaluate("10% of 2 km");
  expect(r.kind).toBe("length");
  expect(r.formatted).toBe("0.2km");
});

test("adding a percentage is relative to the left operand", () => {
  expect(engine.evaluate("50 + 20%").value.canonical.toString()).toBe("60");
  expect(engine.evaluate("1 kg + 20%").value.canonical.toString()).toBe("1200");
});

test("subtracting a percentage is relative too", () => {
  expect(engine.evaluate("50 - 20%").value.canonical.toString()).toBe("40");
});

test("of binds tighter than plus", () => {
  expect(engine.evaluate("50 + 20% of 100").value.canonical.toString()).toBe("70");
});
```

Add to `packages/core/src/parse/pratt.test.ts`:

```ts
test("the of keyword produces a binary node", () => {
  const node = ast("2 of 3");
  expect(node).toMatchObject({ type: "binary", op: "of" });
});
```

The `en` fixture in `pratt.test.ts` needs `of: ["of"]` added to its `keywords`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/percent.test.ts packages/core/src/parse/pratt.test.ts`
Expected: FAIL — module not found, and `of` is lexed as a keyword the parser rejects.

- [ ] **Step 3: Teach the parser `of`**

In `packages/core/src/parse/pratt.ts`, extend the binding table:

```ts
const BINDING: Record<Exclude<OpSymbol, "in">, number> = {
  "+": 10,
  "-": 10,
  // Between + and *: "50 + 20% of 100" is 50 + (20% of 100).
  of: 15,
  "*": 20,
  "/": 20,
};
const CONVERT_BINDING = 5;
```

Inside `parseExpr`'s loop, immediately before the existing `if (token.type !== "op") break;`, add:

```ts
      if (token.type === "keyword" && token.keyword === "of") {
        const binding = BINDING.of;
        if (binding < minBinding) break;
        pos += 1;
        const right = parseExpr(binding + 1);
        left = { type: "binary", op: "of", left, right, span: span(left.span, right.span) };
        continue;
      }
```

- [ ] **Step 4: Write the percent kind**

`packages/core/src/kinds/percent.ts`:

```ts
import { defineKind } from "../kind/define";

/**
 * Canonical is the plain ratio, so "20%" is 0.2 and needs no special case to
 * behave like a number. The three behaviours spec §8 requires are op
 * signatures, not branches: `+|K|percent` and `-|K|percent` are generated for
 * every ratio kind, `of|percent|K` likewise, and a bare percentage is just
 * this kind's own value.
 */
export const percent = defineKind({
  id: "percent",
  value: { mode: "ratio", canonical: "ratio", units: { "%": 0.01 } },
  lexicon: { "%": { aliases: ["%", "percent", "pct"], symbol: "%" } },
});
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/core/src/kinds/percent.test.ts packages/core/src/parse/pratt.test.ts`
Expected: PASS.

Note `20%` lexes as a NUMBER followed by the SYMBOL `%`. Confirm `lex.ts` emits `%` as a word token reaching the resolver — if it is skipped as an unrecognized character, that is a real finding: report it, and the fix belongs in `lex.ts`'s symbol handling rather than in the percent kind.

- [ ] **Step 6: Run the check and commit**

Run: `bun run check`

```bash
git add packages/core/src/kinds/percent.ts packages/core/src/kinds/percent.test.ts packages/core/src/parse
git commit -m "feat(core): add percent kind and the of operator"
```

---

## Task 5: Angle

**Files:**
- Create: `packages/core/src/kinds/angle.ts`, `packages/core/src/kinds/angle.test.ts`

**Interfaces:**
- Produces: the `angle` kind.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/angle.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { angle } from "./angle";

const engine = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, angle] });

test("degrees convert to radians", () => {
  expect(engine.evaluate("90 deg in rad").value.canonical.toFixed(10)).toBe("1.5707963268");
});

test("a quarter turn is 90 degrees", () => {
  expect(engine.evaluate("0.25 turn in deg").value.canonical.toFixed(6)).toBe("1.570796");
  expect(engine.evaluate("0.25 turn in deg").formatted).toBe("90deg");
});

test("gradians convert", () => {
  expect(engine.evaluate("200 grad in deg").formatted).toBe("180deg");
});

test("angles add", () => {
  expect(engine.evaluate("90 deg + 90 deg").formatted).toBe("180deg");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/angle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the kind**

`packages/core/src/kinds/angle.ts`:

```ts
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";

// A literal rather than a computed arctangent: decimal.js's trigonometric
// precision depends on its own config, and this value must not drift with it.
// 30 significant digits, well past the configured 28.
const PI = new Decimal("3.14159265358979323846264338328");

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: "rad",
    units: {
      rad: 1,
      deg: PI.div(180),
      grad: PI.div(200),
      turn: PI.times(2),
    },
  },
  lexicon: {
    rad: { aliases: ["rad", "radian"], symbol: "rad" },
    deg: { aliases: ["deg", "degree"], symbol: "deg" },
    grad: { aliases: ["grad", "gradian", "gon"], symbol: "grad" },
    turn: { aliases: ["turn", "rev", "revolution"], symbol: "turn" },
  },
});
```

- [ ] **Step 4: Run the tests, then the check, then commit**

Run: `bun test packages/core/src/kinds/angle.test.ts` → PASS, 4 tests.
Run: `bun run check` → green.

```bash
git add packages/core/src/kinds/angle.ts packages/core/src/kinds/angle.test.ts
git commit -m "feat(core): add angle kind"
```

---

## Task 6: Datasize

**Files:**
- Create: `packages/core/src/kinds/datasize.ts`, `packages/core/src/kinds/datasize.test.ts`

**Interfaces:**
- Produces: the `datasize` kind.

**Why:** This is the kind the spec uses as its five-line acceptance test (§13). It should stay near-declarative — if it needs anything beyond `id`, `canonical` and `units`, a default is missing.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/datasize.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { datasize } from "./datasize";

const engine = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, datasize] });

test("decimal and binary prefixes are distinct", () => {
  expect(engine.evaluate("1 kb in b").value.canonical.toString()).toBe("1000");
  expect(engine.evaluate("1 kib in b").value.canonical.toString()).toBe("1024");
});

test("mixed-prefix arithmetic converts through the canonical byte", () => {
  const r = engine.evaluate("2 mib + 500 kb in kb");
  expect(r.formatted).toBe("2,597.152kb");
});

test("gigabyte and gibibyte differ as expected", () => {
  // Canonical is bytes whatever the target unit; the formatted value is what
  // actually distinguishes gb from gib.
  expect(engine.evaluate("1 gib in gb").formatted).toBe("1.073741824gb");
  expect(engine.evaluate("1 gb in gib").formatted).toBe("0.931322574615478515625gib");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/datasize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the kind**

`packages/core/src/kinds/datasize.ts`:

```ts
import { defineKind } from "../kind/define";

export const datasize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: "b",
    units: {
      b: 1,
      kb: 1e3,
      mb: 1e6,
      gb: 1e9,
      tb: 1e12,
      kib: 1024,
      mib: 1024 ** 2,
      gib: 1024 ** 3,
      tib: 1024 ** 4,
    },
  },
  lexicon: {
    b: { aliases: ["b", "byte"], symbol: "b" },
    kb: { aliases: ["kb", "kilobyte"], symbol: "kb" },
    mb: { aliases: ["mb", "megabyte"], symbol: "mb" },
    gb: { aliases: ["gb", "gigabyte"], symbol: "gb" },
    tb: { aliases: ["tb", "terabyte"], symbol: "tb" },
    kib: { aliases: ["kib", "kibibyte"], symbol: "kib" },
    mib: { aliases: ["mib", "mebibyte"], symbol: "mib" },
    gib: { aliases: ["gib", "gibibyte"], symbol: "gib" },
    tib: { aliases: ["tib", "tebibyte"], symbol: "tib" },
  },
});
```

- [ ] **Step 4: Run the tests, then the check, then commit**

Run: `bun test packages/core/src/kinds/datasize.test.ts` → PASS, 3 tests.
Run: `bun run check` → green.

```bash
git add packages/core/src/kinds/datasize.ts packages/core/src/kinds/datasize.test.ts
git commit -m "feat(core): add datasize kind"
```

---

## Task 7: Measure and dpi-relative pixels

**Files:**
- Create: `packages/core/src/kinds/measure.ts`, `packages/core/src/kinds/measure.test.ts`

**Interfaces:**
- Consumes: `EngineOptions.kindMeta` and meta-carrying quantities from Task 2.
- Produces: the `measure` kind.

**Why:** This is the context-dependent shape — a unit whose ratio is not a constant. Spec §4 states there is deliberately no per-kind "context" mechanism: `Value.meta` already exists, and dpi rides in it.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/measure.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { measure } from "./measure";

const at = (dpi?: number) =>
  createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, measure],
    ...(dpi === undefined ? {} : { kindMeta: { measure: { dpi } } }),
  });

test("pixels default to 96dpi", () => {
  expect(at().evaluate("96 px in inch").formatted).toBe("1inch");
});

test("the engine's kindMeta overrides the default dpi", () => {
  expect(at(300).evaluate("300 px in inch").value.canonical.toFixed(10)).toBe("1.0000000000");
});

test("A4 width in points", () => {
  expect(at().evaluate("210 mm in pt").value.canonical.toFixed(3)).toBe("8.268");
  expect(at().evaluate("210 mm in pt").formatted).toBe("595.276pt");
});

test("physical units are unaffected by dpi", () => {
  expect(at(300).evaluate("1 inch in mm").formatted).toBe("25.4mm");
});

test("operands authored in different units combine through canonical inches", () => {
  expect(at().evaluate("1 inch + 96 px in inch").value.canonical.toFixed(6)).toBe("2.000000");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/measure.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the kind**

`packages/core/src/kinds/measure.ts`:

```ts
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";

const DEFAULT_DPI = 96;

/**
 * Typographic measurement. `px` is the only dpi-relative unit, and it reads its
 * dpi from the value's own `meta` — the one generic escape hatch, used by the
 * one kind that needs it. There is deliberately no per-kind context mechanism.
 *
 * Arithmetic runs in canonical inches, so operands authored at different dpi
 * still combine correctly.
 */
export const measure = defineKind({
  id: "measure",
  value: {
    mode: "ratio",
    canonical: "inch",
    units: {
      inch: 1,
      mm: new Decimal(1).div(25.4),
      cm: new Decimal(1).div(2.54),
      pt: new Decimal(1).div(72),
      pc: new Decimal(1).div(6),
      px: {
        ratio: (ctx) => {
          const dpi = ctx.self.meta?.dpi;
          return new Decimal(1).div(typeof dpi === "number" ? dpi : DEFAULT_DPI);
        },
      },
    },
  },
  lexicon: {
    inch: { aliases: ["inch"], symbol: "inch" },
    mm: { aliases: ["mm", "millimetre", "millimeter"], symbol: "mm" },
    cm: { aliases: ["cm", "centimetre", "centimeter"], symbol: "cm" },
    pt: { aliases: ["pt", "point"], symbol: "pt" },
    pc: { aliases: ["pc", "pica"], symbol: "pc" },
    px: { aliases: ["px", "pixel"], symbol: "px" },
  },
});
```

`mm` and `cm` collide with `length`'s aliases, which is correct and intentional: `10 cm` is genuinely ambiguous between a physical length and a typographic measure once both kinds are registered. The corpus in Task 12 must therefore disambiguate, and `measure` is deliberately **not** added to `BUILTIN_KINDS` in Task 12 for that reason — a caller opts into it.

- [ ] **Step 4: Run the tests**

Run: `bun test packages/core/src/kinds/measure.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/core/src/kinds/measure.ts packages/core/src/kinds/measure.test.ts
git commit -m "feat(core): add dpi-relative measure kind"
```

---

## Task 8: Derived kinds — speed, area, volume

**Files:**
- Create: `packages/core/src/kinds/derived.ts`, `packages/core/src/kinds/derived.test.ts`

**Interfaces:**
- Produces: `speed`, `area`, `volume` kinds, each declaring the cross-kind signature that produces it.

**Why:** Spec §4 states there is deliberately no general dimensional algebra — a dimension-vector engine would be the second-largest subsystem in the library and would earn its keep only for quantities nobody types into a launcher. Six hand-written signatures cover the cases that matter.

Note the ownership rule from M1's final fix wave: a signature key may only be claimed by one kind. `*|length|length` is claimed by `area`, `/|length|duration` by `speed`, `*|area|length` and `*|length|area` by `volume`. None collides with the generated `*|length|number`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/kinds/derived.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { KindConflictError } from "../errors";
import { BUILTIN_KINDS } from "./index";
import en from "../locale/en";
import { area, speed, volume } from "./derived";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, speed, area, volume],
});

test("length over duration is a speed", () => {
  const r = engine.evaluate("100 km / 2 h");
  expect(r.kind).toBe("speed");
  expect(r.value.canonical.toFixed(6)).toBe("13.888889");
});

test("a speed converts to another speed unit", () => {
  expect(engine.evaluate("100 km / 1 h in kph").formatted).toBe("100kph");
});

test("length times length is an area", () => {
  const r = engine.evaluate("3 m * 4 m");
  expect(r.kind).toBe("area");
  expect(r.value.canonical.toString()).toBe("12");
});

test("area times length is a volume", () => {
  const r = engine.evaluate("3 m * 4 m * 2 m");
  expect(r.kind).toBe("volume");
  expect(r.value.canonical.toString()).toBe("24");
});

test("scaling a length by a number is still a length", () => {
  expect(engine.evaluate("3 m * 4").kind).toBe("length");
});

test("registering two kinds that claim the same signature throws", () => {
  const impostor = {
    ...area,
    id: "impostor",
  };
  expect(() =>
    createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, area, impostor] }),
  ).toThrow(KindConflictError);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/kinds/derived.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the kinds**

`packages/core/src/kinds/derived.ts`:

```ts
import type { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import type { Value } from "../types";

const make = (kind: string, unit: string, canonical: Decimal): Value =>
  Object.freeze({ kind, canonical, unit });

/** Canonical metres per second. Produced by dividing a length by a duration. */
export const speed = defineKind({
  id: "speed",
  value: {
    mode: "ratio",
    canonical: "mps",
    units: {
      mps: 1,
      kph: new (require("../decimal").Decimal)(1000).div(3600),
      mph: 0.44704,
      knot: 0.514444,
    },
  },
  lexicon: {
    mps: { aliases: ["mps"], symbol: "m/s" },
    kph: { aliases: ["kph", "kmh"], symbol: "kph" },
    mph: { aliases: ["mph"], symbol: "mph" },
    knot: { aliases: ["knot", "kt"], symbol: "kt" },
  },
  ops: [
    {
      op: "/",
      left: "length",
      right: "duration",
      result: "speed",
      apply: (l, r) => make("speed", "mps", l.canonical.div(r.canonical)),
    },
  ],
});

/** Canonical square metres. Produced by multiplying two lengths. */
export const area = defineKind({
  id: "area",
  value: {
    mode: "ratio",
    canonical: "m2",
    units: { m2: 1, cm2: 0.0001, km2: 1e6, hectare: 1e4, acre: 4046.8564224 },
  },
  lexicon: {
    m2: { aliases: ["m2", "sqm"], symbol: "m²" },
    cm2: { aliases: ["cm2", "sqcm"], symbol: "cm²" },
    km2: { aliases: ["km2", "sqkm"], symbol: "km²" },
    hectare: { aliases: ["hectare", "ha"], symbol: "ha" },
    acre: { aliases: ["acre"], symbol: "acre" },
  },
  ops: [
    {
      op: "*",
      left: "length",
      right: "length",
      result: "area",
      apply: (l, r) => make("area", "m2", l.canonical.times(r.canonical)),
    },
  ],
});

/** Canonical litres. Produced by multiplying an area by a length. */
export const volume = defineKind({
  id: "volume",
  value: {
    mode: "ratio",
    canonical: "l",
    units: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784, pint: 0.473176473 },
  },
  lexicon: {
    l: { aliases: ["l", "litre", "liter"], symbol: "l" },
    ml: { aliases: ["ml", "millilitre", "milliliter"], symbol: "ml" },
    m3: { aliases: ["m3"], symbol: "m³" },
    gal: { aliases: ["gal", "gallon"], symbol: "gal" },
    pint: { aliases: ["pint"], symbol: "pint" },
  },
  ops: [
    {
      // 1 m³ is 1000 l, and area·length is in m³ — hence the factor.
      op: "*",
      left: "area",
      right: "length",
      result: "volume",
      apply: (l, r) => make("volume", "m3", l.canonical.times(r.canonical).div(1000)),
    },
    {
      op: "*",
      left: "length",
      right: "area",
      result: "volume",
      apply: (l, r) => make("volume", "m3", l.canonical.times(r.canonical).div(1000)),
    },
  ],
});
```

Replace the inline `require("../decimal")` in `speed`'s `kph` with a proper top-level `import { Decimal } from "../decimal";` — `require` is banned by the ESM constraint. The value is `new Decimal(1000).div(3600)`.

- [ ] **Step 4: Run the tests**

Run: `bun test packages/core/src/kinds/derived.test.ts`
Expected: PASS, 6 tests.

The `3 m * 4 m * 2 m` test exercises left-associativity: `(3m * 4m) * 2m` is `area * length`. If it fails with `DimensionMismatchError`, check that `*|area|length` is registered — not `*|length|area` alone.

- [ ] **Step 5: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/core/src/kinds/derived.ts packages/core/src/kinds/derived.test.ts
git commit -m "feat(core): add speed, area and volume via explicit signatures"
```

---

## Task 9: The facade contract

**Files:**
- Create: `packages/core/src/facade/quantity.ts`, `packages/core/src/facade/quantity.test.ts`

**Interfaces:**
- Consumes: `NormalizedKind`, `buildRegistry`, `toCanonical`/`fromCanonical`, `formatValue`.
- Produces:
  - `interface Quantity { readonly value: Decimal; readonly unit: string; readonly meta?: Readonly<Record<string, unknown>>; to(unit: string): Decimal; as(unit: string): Quantity; equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean; toString(): string; toJSON(): { value: string; unit: string } }`
  - `type QuantityInput = Quantity | number | string`
  - `interface QuantityClass { new (value: Decimal | number | string, unit: string, meta?: Record<string, unknown>): Quantity; from(input: QuantityInput): Quantity; parse(text: string): Quantity; readonly kindId: KindId }`
  - `createFacade(args: { kind: NormalizedKind; registry: Registry; locale: Locale }): QuantityClass`

**Why:** Spec §3 specifies the facade surface and states the generated facade is the contract — an override would let plugin classes drift from it. `.value` and the converters return `Decimal`, not `number`: returning a float would violate the no-floats constraint on the library's most-used surface. Call `.toNumber()` or `String()` at the boundary.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/facade/quantity.test.ts`:

```ts
import { expect, test } from "bun:test";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import en from "../locale/en";
import { UnitParseError } from "../errors";
import { createFacade } from "./quantity";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const massKind = registry.kinds.get("mass");
if (massKind === undefined) throw new Error("mass kind missing");
const Weight = createFacade({ kind: massKind, registry, locale: en });

test("constructs in an authored unit and stores it verbatim", () => {
  const w = new Weight(1.5, "kg");
  expect(w.value.toString()).toBe("1.5");
  expect(w.unit).toBe("kg");
});

test("converts to another unit", () => {
  expect(new Weight(1, "kg").to("g").toString()).toBe("1000");
});

test("as rebases on a unit without changing the quantity", () => {
  const rebased = new Weight(1, "kg").as("g");
  expect(rebased.unit).toBe("g");
  expect(rebased.value.toString()).toBe("1000");
});

test("parse accepts a number-unit string", () => {
  expect(Weight.parse("12.5lb").to("g").toString()).toBe("5669.904625");
});

test("parse rejects a bare number", () => {
  expect(() => Weight.parse("12.5")).toThrow(UnitParseError);
});

test("from passes an instance through unchanged", () => {
  const w = new Weight(1, "kg");
  expect(Weight.from(w)).toBe(w);
});

test("from treats a bare number as the canonical unit", () => {
  expect(Weight.from(500).unit).toBe("g");
});

test("equals compares canonical values across units", () => {
  expect(new Weight(1, "kg").equals(new Weight(1000, "g"))).toBe(true);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"))).toBe(false);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"), 2)).toBe(true);
});

test("toString renders in the authored unit", () => {
  expect(new Weight(1.5, "kg").toString()).toBe("1.5 kilograms");
  expect(new Weight(210, "g").toString()).toBe("210g");
});

test("toJSON round-trips through from", () => {
  const w = new Weight(1.5, "kg");
  expect(w.toJSON()).toEqual({ value: "1.5", unit: "kg" });
});

test("instances are frozen", () => {
  expect(Object.isFrozen(new Weight(1, "kg"))).toBe(true);
});

test("an unknown unit throws", () => {
  expect(() => new Weight(1, "furlong")).toThrow(UnitParseError);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/facade/quantity.test.ts`
Expected: FAIL — `Cannot find module './quantity'`.

- [ ] **Step 3: Write the facade**

`packages/core/src/facade/quantity.ts`:

```ts
import { Decimal } from "../decimal";
import { fromCanonical, toCanonical } from "../eval/convert";
import { UnitParseError } from "../errors";
import { formatValue } from "../format/format";
import type { NormalizedKind } from "../kind/define";
import type { Registry } from "../kind/registry";
import type { KindId, Locale, Value } from "../types";

export interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): { value: string; unit: string };
}

export type QuantityInput = Quantity | number | string;

export interface QuantityClass {
  new (
    value: Decimal | number | string,
    unit: string,
    meta?: Record<string, unknown>,
  ): Quantity;
  from(input: QuantityInput): Quantity;
  parse(text: string): Quantity;
  readonly kindId: KindId;
}

const PARSE = /^\s*(-?[\d.]+)\s*°?\s*([\p{L}%][\p{L}\d²³%]*)\s*$/u;

export function createFacade(args: {
  kind: NormalizedKind;
  registry: Registry;
  locale: Locale;
}): QuantityClass {
  const { kind, registry, locale } = args;
  const canonicalUnit = kind.spec.mode === "ratio" ? kind.spec.canonical : "";

  const requireUnit = (unit: string): string => {
    if (!kind.units.has(unit)) {
      throw new UnitParseError(`${unit} is not a unit of ${kind.id}`, kind.id);
    }
    return unit;
  };

  class Q implements Quantity {
    readonly value: Decimal;
    readonly unit: string;
    readonly meta?: Readonly<Record<string, unknown>>;

    constructor(
      value: Decimal | number | string,
      unit: string,
      meta?: Record<string, unknown>,
    ) {
      this.value = new Decimal(value);
      this.unit = requireUnit(unit);
      if (meta !== undefined) this.meta = Object.freeze({ ...meta });
      Object.freeze(this);
    }

    static readonly kindId = kind.id;

    static from(input: QuantityInput): Quantity {
      if (input instanceof Q) return input;
      if (typeof input === "number") return new Q(input, canonicalUnit);
      if (typeof input === "string") return Q.parse(input);
      // A Quantity from another facade of the same kind.
      const other = input as Quantity;
      return new Q(other.value, other.unit, other.meta as Record<string, unknown>);
    }

    static parse(text: string): Quantity {
      const m = PARSE.exec(text);
      const digits = m?.[1];
      const unit = m?.[2];
      if (digits === undefined || unit === undefined) throw new UnitParseError(text, kind.id);
      return new Q(digits, unit.toLowerCase());
    }

    /** Canonical magnitude, the basis for every conversion and comparison. */
    private canonical(): Decimal {
      return toCanonical(
        this.value,
        kind,
        this.unit,
        locale.id,
        this.meta as Record<string, unknown>,
      );
    }

    to(unit: string): Decimal {
      return fromCanonical(
        this.canonical(),
        kind,
        requireUnit(unit),
        locale.id,
        this.meta as Record<string, unknown>,
      );
    }

    as(unit: string): Quantity {
      return new Q(this.to(unit), unit, this.meta as Record<string, unknown>);
    }

    equals(other: QuantityInput, epsilon: Decimal | number | string = 0): boolean {
      const rhs = Q.from(other);
      const diff = this.canonical().minus((rhs as Q).canonical()).abs();
      return diff.lessThanOrEqualTo(new Decimal(epsilon));
    }

    toString(): string {
      const value: Value = Object.freeze({
        kind: kind.id,
        canonical: this.canonical(),
        unit: this.unit,
        ...(this.meta ? { meta: this.meta } : {}),
      });
      return formatValue(value, registry, locale);
    }

    toJSON(): { value: string; unit: string } {
      return { value: this.value.toFixed(), unit: this.unit };
    }
  }

  Object.defineProperty(Q, "name", { value: kind.id });
  return Q as unknown as QuantityClass;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test packages/core/src/facade/quantity.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/core/src/facade
git commit -m "feat(core): generate quantity facade classes from kind descriptors"
```

---

## Task 10: Facade arithmetic and the affine specialization

**Files:**
- Modify: `packages/core/src/facade/quantity.ts`
- Create: `packages/core/src/facade/index.ts`, `packages/core/src/facade/index.test.ts`
- Modify: `packages/core/src/facade/quantity.test.ts`

**Interfaces:**
- Consumes: `createFacade` from Task 9.
- Produces: `add`, `sub`, `scale`, `negate` on ratio facades; `diff` on affine facades; `withDpi`/`dpi` when the kind's units read a dpi; `createFacades(args: { kinds: Kind[]; locale: Locale }): Record<KindId, QuantityClass>`.

**Why:** Spec §3: results keep the left operand's unit, and `Temperature` is the exception — it exposes `add(TempDelta)` and `diff(Temperature) → TempDelta`, and no `scale`. The facade must express that from the descriptor, not from a hardcoded kind name: `spec.affine` is the signal.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/facade/quantity.test.ts`:

```ts
test("add keeps the left operand's unit", () => {
  expect(new Weight(1, "kg").add(new Weight(500, "g")).toString()).toBe("1.5 kilograms");
});

test("add accepts a parseable string", () => {
  expect(new Weight(1, "kg").add("500g").to("g").toString()).toBe("1500");
});

test("sub, scale and negate", () => {
  expect(new Weight(1, "kg").sub("200g").to("g").toString()).toBe("800");
  expect(new Weight(1, "kg").scale(3).to("kg").toString()).toBe("3");
  expect(new Weight(1, "kg").negate().to("g").toString()).toBe("-1000");
});

test("the original is never mutated", () => {
  const w = new Weight(1, "kg");
  w.add("500g");
  expect(w.value.toString()).toBe("1");
});
```

`packages/core/src/facade/index.test.ts`:

```ts
import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "../kinds/index";
import { measure } from "../kinds/measure";
import { temperature, tempdelta } from "../kinds/temperature";
import en from "../locale/en";
import { createFacades } from "./index";

const F = createFacades({
  kinds: [...BUILTIN_KINDS, temperature, tempdelta, measure],
  locale: en,
});

test("a facade is generated per kind", () => {
  expect(Object.keys(F)).toContain("mass");
  expect(Object.keys(F)).toContain("temperature");
});

test("an absolute temperature has no scale", () => {
  const T = F.temperature;
  if (T === undefined) throw new Error("missing");
  expect("scale" in new T(20, "c")).toBe(false);
});

test("a temperature adds a delta and keeps its own unit", () => {
  const T = F.temperature;
  const D = F.tempdelta;
  if (T === undefined || D === undefined) throw new Error("missing");
  expect(new T(20, "c").add(new D(5, "c")).to("c").toString()).toBe("25");
});

test("two temperatures differ into a delta", () => {
  const T = F.temperature;
  if (T === undefined) throw new Error("missing");
  const d = new T(30, "c").diff(new T(20, "c"));
  expect(d.value.toString()).toBe("10");
});

test("a delta scales", () => {
  const D = F.tempdelta;
  if (D === undefined) throw new Error("missing");
  expect(new D(5, "c").scale(2).to("c").toString()).toBe("10");
});

test("withDpi re-reads pixels and leaves physical units alone", () => {
  const M = F.measure;
  if (M === undefined) throw new Error("missing");
  expect(new M(96, "px").withDpi(300).to("inch").toFixed(2)).toBe("0.32");
  expect(new M(1, "inch").withDpi(300).to("inch").toString()).toBe("1");
});

test("dpi defaults to 96 and is readable", () => {
  const M = F.measure;
  if (M === undefined) throw new Error("missing");
  expect(new M(1, "inch").dpi).toBe(96);
  expect(new M(1, "inch", { dpi: 300 }).dpi).toBe(300);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/src/facade/`
Expected: FAIL — `add` is not a function; `./index` not found.

- [ ] **Step 3: Add arithmetic to the facade**

In `packages/core/src/facade/quantity.ts`, extend the `Quantity` interface:

```ts
export interface Quantity {
  readonly value: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly dpi?: number;
  to(unit: string): Decimal;
  as(unit: string): Quantity;
  equals(other: QuantityInput, epsilon?: Decimal | number | string): boolean;
  toString(): string;
  toJSON(): { value: string; unit: string };
  /** Ratio kinds only; absent on an affine kind. */
  add?(other: QuantityInput): Quantity;
  sub?(other: QuantityInput): Quantity;
  scale?(factor: Decimal | number | string): Quantity;
  negate?(): Quantity;
  /** Affine kinds only. */
  diff?(other: QuantityInput): Quantity;
  withDpi?(dpi: number): Quantity;
}
```

Add to the class body, before `Object.defineProperty`:

```ts
    /** Result keeps the left operand's unit — spec §8. */
    private combine(other: QuantityInput, sign: 1 | -1): Quantity {
      const rhs = Q.from(other);
      const delta = (rhs as Q).canonical().times(sign);
      const total = this.canonical().plus(delta);
      return new Q(
        fromCanonical(total, kind, this.unit, locale.id, this.meta as Record<string, unknown>),
        this.unit,
        this.meta as Record<string, unknown>,
      );
    }

    get dpi(): number | undefined {
      const d = this.meta?.dpi;
      return typeof d === "number" ? d : usesDpi ? 96 : undefined;
    }
```

and after the class declaration, before the `Object.defineProperty` call:

```ts
  const affine = kind.spec.mode === "ratio" ? kind.spec.affine : undefined;
  const proto = Q.prototype as unknown as Record<string, unknown>;

  if (affine === undefined) {
    // Ratio kinds: every unit is a pure multiple, so sums and products are
    // meaningful. An affine kind gets none of these — 20C * 2 has no meaning.
    proto.add = function (this: Quantity, other: QuantityInput) {
      return (this as unknown as { combine(o: QuantityInput, s: 1 | -1): Quantity }).combine(other, 1);
    };
    proto.sub = function (this: Quantity, other: QuantityInput) {
      return (this as unknown as { combine(o: QuantityInput, s: 1 | -1): Quantity }).combine(other, -1);
    };
    proto.scale = function (this: Quantity, factor: Decimal | number | string) {
      return new Q(this.value.times(new Decimal(factor)), this.unit, this.meta as Record<string, unknown>);
    };
    proto.negate = function (this: Quantity) {
      return new Q(this.value.negated(), this.unit, this.meta as Record<string, unknown>);
    };
  } else {
    // Absolute points: a reading plus a difference is a reading, and two
    // readings differ into a difference. Nothing else is defined.
    const deltaKind = affine.deltaKind;
    proto.add = function (this: Quantity, other: QuantityInput) {
      const rhs = Q.from(other);
      const total = (this as unknown as { canonical(): Decimal }).canonical().plus(
        (rhs as unknown as { canonical(): Decimal }).canonical(),
      );
      return new Q(
        fromCanonical(total, kind, this.unit, locale.id, this.meta as Record<string, unknown>),
        this.unit,
      );
    };
    proto.diff = function (this: Quantity, other: QuantityInput) {
      const rhs = Q.from(other);
      const delta = (this as unknown as { canonical(): Decimal }).canonical().minus(
        (rhs as unknown as { canonical(): Decimal }).canonical(),
      );
      const DeltaClass = deltaFacades.get(deltaKind);
      if (DeltaClass === undefined) {
        throw new UnitParseError(`delta kind ${deltaKind} is not registered`, kind.id);
      }
      return new DeltaClass(delta, canonicalUnit);
    };
  }

  if (usesDpi) {
    proto.withDpi = function (this: Quantity, dpi: number) {
      return new Q(this.value, this.unit, { ...this.meta, dpi });
    };
  }
```

Two new locals are needed near the top of `createFacade`:

```ts
  const usesDpi =
    kind.spec.mode === "ratio" &&
    Object.values(kind.spec.units).some(
      (u) => typeof u === "object" && typeof u.ratio === "function",
    );
```

and `createFacade` gains an optional `deltaFacades` argument so an affine kind can build its delta:

```ts
export function createFacade(args: {
  kind: NormalizedKind;
  registry: Registry;
  locale: Locale;
  deltaFacades?: Map<KindId, QuantityClass>;
}): QuantityClass {
  const { kind, registry, locale } = args;
  const deltaFacades = args.deltaFacades ?? new Map<KindId, QuantityClass>();
```

- [ ] **Step 4: Write the barrel**

`packages/core/src/facade/index.ts`:

```ts
import { buildRegistry } from "../kind/registry";
import type { Kind, KindId, Locale } from "../types";
import { createFacade, type QuantityClass } from "./quantity";

export type { Quantity, QuantityClass, QuantityInput } from "./quantity";
export { createFacade } from "./quantity";

/**
 * One facade class per registered kind, sharing a single registry so
 * cross-kind results (a Temperature's diff producing a TempDelta) resolve.
 */
export function createFacades(args: {
  kinds: Kind[];
  locale: Locale;
}): Record<KindId, QuantityClass> {
  const registry = buildRegistry(args.kinds, [], args.locale.id);
  const classes = new Map<KindId, QuantityClass>();

  // Two passes: an affine kind needs its delta kind's class to exist before it
  // can build one, and the Map is shared by reference so pass 1's entries are
  // visible to pass 2's closures.
  for (const [id, kind] of registry.kinds) {
    classes.set(
      id,
      createFacade({ kind, registry, locale: args.locale, deltaFacades: classes }),
    );
  }

  return Object.fromEntries(classes);
}
```

- [ ] **Step 5: Run the tests**

Run: `bun test packages/core/src/facade/`
Expected: PASS.

If `"scale" in new T(20, "c")` is `true`, the affine branch is attaching ratio methods — check that `kind.spec.affine` is reaching `createFacade` (it lives on the *spec*, not the normalized kind's top level).

- [ ] **Step 6: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/core/src/facade
git commit -m "feat(core): add facade arithmetic with affine and dpi specializations"
```

---

## Task 11: M1 follow-ups scheduled into M2

**Files:**
- Modify: `packages/core/src/eval/evaluate.ts` (deep-freeze values)
- Modify: `packages/core/src/errors.ts` (`UnknownKindError` unit field)
- Modify: `packages/core/src/kind/registry.ts` (pass the unit separately)
- Modify: `packages/core/src/solve/solver.ts` (mismatch operand order)
- Modify: `packages/core/src/engine.ts` (use `NUMBER_KIND`)
- Modify: `packages/core/src/locale/en.ts` (drop unimplemented keywords, redundant analyzer)
- Modify: `packages/core/src/parse/candidates.test.ts` (nearest coverage)
- Modify: `packages/core/src/format/format.test.ts` (format hook coverage)

**Interfaces:**
- Produces: `UnknownKindError` gains a `unit?: string` field; `kind` always holds a bare `KindId`.

**Why:** These are the items `docs/superpowers/m1-followups.md` triaged to M2. Each is small; they are batched because none carries its own test cycle.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/eval/evaluate.test.ts`:

```ts
test("a value's meta is frozen, not just the value", () => {
  const engine = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    kindMeta: { mass: { note: "x" } },
  });
  const v = engine.evaluate("1 kg").value;
  expect(Object.isFrozen(v)).toBe(true);
  expect(Object.isFrozen(v.meta)).toBe(true);
});
```

Add to `packages/core/src/kind/registry.test.ts`:

```ts
test("an unregistered unit reports a bare kind id and the unit separately", () => {
  const pack = defineLocalePack({
    locale: "en",
    contributes: { mass: { nosuchunit: ["x"] } },
  });
  try {
    buildRegistry([number, mass], [pack], "en");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(UnknownKindError);
    expect((e as UnknownKindError).kind).toBe("mass");
    expect((e as UnknownKindError).unit).toBe("nosuchunit");
  }
});
```

Add to `packages/core/src/solve/solver.test.ts`:

```ts
test("a dimension mismatch names the operands in source order", () => {
  try {
    run("10 km + 5 h");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as DimensionMismatchError;
    expect(err.left).toBe("length");
    expect(err.right).toBe("duration");
  }
});
```

Add to `packages/core/src/parse/candidates.test.ts`:

```ts
test("nearest excludes exact matches, caps at three, and orders by distance", () => {
  const r = resolver();
  expect(r.nearest("km")).not.toContain("km");
  expect(r.nearest("m").length).toBeLessThanOrEqual(3);
  const near = r.nearest("kmm");
  expect(near[0]).toBe("km");
});
```

Add to `packages/core/src/format/format.test.ts`:

```ts
test("a kind's own format hook wins over the default rendering", () => {
  const shouty = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
    format: (v) => `<<${v.canonical.toFixed()}>>`,
  });
  const r = buildRegistry([number, shouty]);
  expect(formatValue(value("1500", "kg"), r, enLocale)).toBe("<<1500>>");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run check`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Apply the fixes**

**Deep-freeze values.** In `packages/core/src/eval/evaluate.ts`, import `deepFreeze` from `../freeze` and replace every `Object.freeze(` on a constructed `Value` with `deepFreeze(`. Spec §8 groups descriptors and values under one immutability rule; `Value.meta` is the M2 dpi carrier and was mutable.

**`UnknownKindError`.** In `packages/core/src/errors.ts`:

```ts
export class UnknownKindError extends Error {
  readonly pack: string;
  readonly kind: KindId;
  readonly unit: string | undefined;
  constructor(pack: string, kind: KindId, unit?: string) {
    const where = unit === undefined ? "" : `, unit ${JSON.stringify(unit)}`;
    super(
      `Locale pack ${JSON.stringify(pack)} contributes to unregistered kind ${JSON.stringify(kind)}${where}`,
    );
    this.name = "UnknownKindError";
    this.pack = pack;
    this.kind = kind;
    this.unit = unit;
  }
}
```

In `packages/core/src/kind/registry.ts`, change the unregistered-unit throw from the composite string to `new UnknownKindError(pack.locale, kindId, unit)`.

**Mismatch operand order.** In `packages/core/src/solve/solver.ts`, the zero-viable-assignment branch takes `slots[0]`/`slots[1]`, and `walk` visits a convert node before its operand, so the operands read reversed. Sort the reported slots by their node's `span.start` before naming them:

```ts
  if (viable.length === 0) {
    const bySource = [...slots].sort((a, b) => a.node.span.start - b.node.span.start);
    const first = bySource[0]?.candidates[0]?.kind ?? "unknown";
    const second = bySource[1]?.candidates[0]?.kind ?? "unknown";
    throw new DimensionMismatchError(opts.input, "operation", first, second);
  }
```

**`NUMBER_KIND` in the engine.** In `packages/core/src/engine.ts`, `coerce` builds `kinds: [kind, "number"]`. Import `NUMBER_KIND` from `./kind/registry` and use it.

**English locale.** In `packages/core/src/locale/en.ts`:
- Remove `plus` and `minus` from `keywords` — the parser has no word-operator support, so declaring them turns a useful `NoCandidateError: Unknown unit "plus". Did you mean…` into a bare `UnitParseError`. Keep `of`, which Task 4 now implements.
- Remove the `tableAnalyzer({ feet: "foot", inches: "inch" })` entry: `feet` is already a direct alias on `length.ft`, and `suffixStripper` already derives `inch` from `inches` via the `es` suffix. It only nudged the weight from −2 to −1.

- [ ] **Step 4: Run the check**

Run: `bun run check`
Expected: green. If removing the `feet`/`inches` table breaks a corpus row, that means the alias or suffix path does not in fact cover it — report rather than restoring the table.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "fix(core): clear the M1 follow-ups scheduled for M2"
```

---

## Task 12: Wire up, corpus, and docs

**Files:**
- Modify: `packages/core/src/kinds/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/corpus/en.tsv`
- Modify: `packages/core/src/properties.test.ts`
- Modify: `docs/superpowers/m1-followups.md`

**Interfaces:**
- Produces: `BUILTIN_KINDS` including the new non-colliding kinds; the public surface exporting the facades.

- [ ] **Step 1: Extend BUILTIN_KINDS**

`packages/core/src/kinds/index.ts`:

```ts
import type { Kind } from "../types";
import { angle } from "./angle";
import { datasize } from "./datasize";
import { area, speed, volume } from "./derived";
import { duration } from "./duration";
import { length } from "./length";
import { mass } from "./mass";
import { measure } from "./measure";
import { number } from "./number";
import { percent } from "./percent";
import { temperature, tempdelta } from "./temperature";

export {
  angle, area, datasize, duration, length, mass, measure, number, percent,
  speed, temperature, tempdelta, volume,
};

/**
 * The standard set. `measure` is deliberately excluded: its `mm`/`cm` aliases
 * collide with `length`, so registering both by default would make "10 cm"
 * ambiguous for every consumer. Callers who want typographic units opt in.
 */
export const BUILTIN_KINDS: Kind[] = [
  number,
  percent,
  length,
  mass,
  duration,
  temperature,
  tempdelta,
  angle,
  datasize,
  speed,
  area,
  volume,
];
```

- [ ] **Step 2: Export the facades**

Add to `packages/core/src/index.ts`:

```ts
export { createFacade, createFacades } from "./facade/index";
export type { Quantity, QuantityClass, QuantityInput } from "./facade/index";
```

- [ ] **Step 3: Extend the corpus**

Append to `packages/core/corpus/en.tsv`:

```
212 F in C	temperature	100	100°C
30 C - 20 C	tempdelta	10	10°C
20% of 50	number	10	10
50 + 20%	number	60	60
90 deg in rad	angle	1.570796326794896619231321691	1.570796326794896619231321691rad
1 kib in b	datasize	1024	1,024b
3 m * 4 m	area	12	12m²
100 km / 2 h	speed	13.88888888888888888888888889	13.88888888888888888888888889m/s
```

Run the corpus test after adding these. **The two long decimals were computed, not hand-written — but recompute them against your build before accepting a mismatch**, and if one differs, report the observed value with your analysis rather than editing the row to match.

- [ ] **Step 4: Extend the property tests**

In `packages/core/src/properties.test.ts`, the round-trip and transitivity loops iterate every ratio kind in the registry, so the new kinds are covered automatically once `BUILTIN_KINDS` grows. Add one guard that the affine kind is included in the round-trip:

```ts
test("affine round-trips are exact at the anchor points", () => {
  const temp = registry.kinds.get("temperature");
  if (temp === undefined) throw new Error("temperature missing");
  for (const [unit, expected] of [["c", "0"], ["f", "32"], ["k", "273.15"]] as const) {
    const canonical = toCanonical(new Decimal(expected), temp, unit, "en");
    const back = fromCanonical(canonical, temp, unit, "en");
    expect(back.toString()).toBe(expected);
  }
});
```

- [ ] **Step 5: Update the follow-ups doc**

In `docs/superpowers/m1-followups.md`, move every item Task 11 fixed out of its section and into a short "Closed in M2" list naming the commit. Leave the M5/M6 items in place.

- [ ] **Step 6: Run the full check**

Run: `bun run check`
Expected: green — lint, typecheck, dependency guard, and the whole suite.

- [ ] **Step 7: Commit**

```bash
git add packages/core docs
git commit -m "feat(core): register M2 kinds, extend corpus, close M2 follow-ups"
```

---

## Self-Review

**Spec coverage.** §11's M2 row maps to tasks as: Temperature affine → T1+T3; Measure dpi via `Value.meta` → T2+T7; angle → T5; datasize → T6; speed/area/volume as explicit signatures → T8; facade class generator → T9+T10. §8's percent semantics → T1+T4. §3's facade surface → T9+T10. The M1 follow-ups triaged to M2 → T11.

**Deliberately not in M2:** money and `RateSnapshot` (M3), datetime (M4), Ukrainian locale and `assertLocaleContract` (M5), the tooling items — `--error-on-warnings`, `.d.ts` emission, verbatim error snapshots (M6). Analyzer case-folding stays deferred to M5 by the recorded ruling, so **`1.5 KILOGRAMS` still throws after M2** — that is intended, not a gap.

**Known risks, stated rather than hidden:**

1. **T3's priors are tuned against `CONTEXT_BONUS = 30`.** `tempdelta`'s −40 prior is what makes `20 C + 5 C` prefer temperature+delta over delta+delta. If M3 changes the bonus, that balance breaks. T3's test asserts the outcome, so it will fail loudly rather than silently — but the coupling is real and belongs in M3's plan review.
2. **`measure` collides with `length` on `mm`/`cm`.** Handled by excluding it from `BUILTIN_KINDS`, which is a scope decision, not a fix. If a consumer registers both they get genuine ambiguity, resolvable with weights. Worth revisiting when the launcher use case is real.
3. **T9's facade returns `Decimal`, not `number`.** Spec §3's examples (`new Distance(5,"km").miles; // 3.106…`) read as numbers. Returning floats from the library's most-touched surface would violate the no-floats constraint, so the plan diverges deliberately and documents `.toNumber()` at the boundary. If that ergonomic cost is unacceptable, the decision to revisit is the spec's, not the implementer's.
4. **T10 attaches methods to the prototype after class declaration**, which TypeScript cannot type as neatly as class members — hence the optional methods on `Quantity` and the casts. The alternative, two separate class bodies, duplicates every shared member. Flagged for the reviewer to weigh.

**Type consistency checked.** `PERCENT_KIND` (T1) is consumed by T4 and T12. `OpSignature.assumption` (T2) is used by T3 and asserted in T3's tests. `evaluateNode`'s new return shape (T2) is consumed by the engine in T2 and by tests updated in the same task. `kindMeta` (T2) is consumed by T7 and T11. `createFacade`'s `deltaFacades` parameter (T10) is supplied by `createFacades` in the same task. `QuantityClass.kindId` (T9) is unused by later tasks but is part of the stated surface.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-smartputs-m2-kinds.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
