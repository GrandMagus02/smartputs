# smartputs M3 — Money, Rates and Live Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the `ratio: (ctx) => Decimal` escape hatch under a second, harder consumer — foreign exchange, where a unit's ratio comes from injected data rather than from the descriptor — and ship `@smartput/rates` with the ECB provider and an async live engine, so `30 usd - 10 eur` works.

**Architecture:** M2 proved that a unit ratio can be a function of the *value* (dpi in `Value.meta`). M3 proves it can be a function of the *engine* (an injected rate table). Nothing here special-cases currency: `money` is an ordinary ratio kind whose unit table happens to read `ctx.rates`. The engine never learns what a currency is. Two mechanisms the engine does gain, both generic: conversion now takes a context object rather than a widening positional parameter list, and an assumption can be recorded from inside a conversion rather than only from an op signature. `@smartput/rates` is the first package outside core, which is also the rehearsal for M4's datetime package.

**Tech Stack:** TypeScript (strict), Bun, Biome, `decimal.js`. `@smartput/rates` adds no runtime dependency beyond `decimal.js` and `@smartput/core`; the ECB provider parses XML with a regex rather than pulling a parser.

**Spec:** `docs/superpowers/specs/2026-08-04-smartputs-design.md`. Read §4 (`ratio: (ctx)`, the deliberate absence of a per-kind context mechanism), §6 (the `Rates` block, `EngineOptions`, `Result`), §7 (`MissingRateError`), §8 (money never rounds mid-expression; FX is directional and dated), and §11's M3 row.

**Inherited context:** `docs/superpowers/m2-followups.md`. Two items there bind this milestone:

- **The display-precision policy is Task 1 and is not optional.** M2 shipped `angle` printing `0.4999999999999999999999999998turn`. It was deferred with the ruling that it must be M3's first item and must not reach a published release. It is also a prerequisite for money, which needs a rounding seam at format time.
- **`measure` stays out of `BUILTIN_KINDS`** permanently. `money` follows the opposite convention — it lives outside core entirely, so the question does not arise.

---

## Coordination warning — read before starting

A concurrent effort is implementing `Engine.complete()` from `docs/superpowers/specs/2026-08-04-smartputs-completion-design.md`, planned in `docs/superpowers/plans/2026-08-04-smartputs-completion.md`. It has already landed `UnitLexeme.typical` on `main`.

That work and this plan both modify `packages/core/src/engine.ts`, `packages/core/src/types.ts` and `packages/core/src/index.ts`. Before starting, run `git log --oneline -10` and check whether the completion work has landed. If both are in flight, expect textual conflicts in those three files and semantic conflicts in `EngineOptions`. M2's merge produced exactly this failure — `main` changed `SmartputError`'s naming while the branch changed the same class, git merged both cleanly, and the result was broken. **Run the full suite on the merged result, not only on the branch.**

---

## Global Constraints

Every task's requirements implicitly include this section. All are unchanged from M2 except the last two, which are new.

- **`@smartput/core` has exactly ONE runtime dependency: `decimal.js`.** `scripts/check-deps.ts` fails CI on a second. **`@smartput/rates` may depend on `decimal.js` and `@smartput/core`, and nothing else** — Task 5 extends the guard to enforce that.
- **ESM only.** No CJS, no `require`.
- **TypeScript `strict: true`**, plus `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`.
- **Biome**, `noExplicitAny` enabled. No `any`.
- **Decimal precision is 28 significant digits.** Never a JS float for a user-visible value — and note `1 / 1.1` is a float *before* Decimal sees it; write `new Decimal(1).div(1.1)`.
- **Money never rounds mid-expression.** Full Decimal precision through the AST; rounding happens once, at format time, at the currency's minor-unit scale.
- **Immutability.** Descriptors are deep-frozen; every operation returns a new object.
- **Determinism.** Identical input, options and clock produce identical ranking every run.
- **No network and no wall clock in tests.** The ECB provider is tested against a fixture; the live engine takes an injected clock and an injected fetch.
- **Test files are colocated**: `src/foo.ts` ↔ `src/foo.test.ts`. Run with `bun test`.
- **Conventional Commits.** One commit per task, at the end.

### Verification of expected values

Thirteen defects in the M2 plan were caught by implementers who stopped rather than edit a failing expectation — hand-rounded strings, a conversion factor applied backwards, a test whose input was genuinely ambiguous. Every exact value in this plan was produced by running the arithmetic against this repo's `Decimal` at its configured precision, not written by hand. If one still disagrees with your implementation, investigate and report rather than adjusting it.

---

## File Structure

| File | Responsibility | Status |
| --- | --- | --- |
| `packages/core/src/format/format.ts` | Guard-digit rounding; `formatNumber` and `formatValue` become options-aware and exported. | Modify |
| `packages/core/src/eval/convert.ts` | `toCanonical`/`fromCanonical` take a `ConversionCtx` instead of positional `locale`/`meta`. | Modify |
| `packages/core/src/types.ts` | `RateLookup`, `Assumption`, `EvalCtx.rates`, `EvalCtx.note`, `FormatCtx.rounding`. | Modify |
| `packages/core/src/errors.ts` | `MissingRateError`. | Modify |
| `packages/core/src/eval/evaluate.ts` | Takes an options object; threads rates; collects assumptions from conversions. | Modify |
| `packages/core/src/engine.ts` | `rates`, `rounding`, `formatPrecision` options; `Result.meta.ratesAsOf`. | Modify |
| `packages/core/src/facade/quantity.ts` | Call-site updates for the conversion refactor. | Modify |
| `packages/core/src/index.ts` | Exports `formatNumber`, `formatValue`, the new types. | Modify |
| `packages/core/corpus/en.tsv` | Two rows change under guard-digit rounding. | Modify |
| `packages/rates/package.json` | New workspace package. | Create |
| `packages/rates/tsconfig.json` | Extends the base config. | Create |
| `packages/rates/src/index.ts` | Public surface. | Create |
| `packages/rates/src/snapshot.ts` | `RateSnapshot`, `snapshot()`. | Create |
| `packages/rates/src/money.ts` | The `money` kind. | Create |
| `packages/rates/src/currencies.ts` | Currency table: minor units, symbols, aliases. | Create |
| `packages/rates/src/providers/ecb.ts` | ECB daily reference rates. | Create |
| `packages/rates/src/providers/ecb-daily.fixture.xml` | Captured ECB response. | Create |
| `packages/rates/src/live.ts` | `createLiveEngine`. | Create |
| `packages/rates/src/locale/en.ts` | English currency vocabulary. | Create |
| `scripts/check-deps.ts` | Guards both packages. | Modify |
| `docs/superpowers/m2-followups.md` | Display-precision item moves to a "Closed in M3" list. | Modify |

---

## Task 1: Guard-digit display precision

**Files:**
- Modify: `packages/core/src/format/format.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/facade/quantity.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/corpus/en.tsv`
- Modify: `packages/core/src/kinds/angle.test.ts`, `packages/core/src/kinds/measure.test.ts`
- Test: `packages/core/src/format/format.test.ts`

**Interfaces:**
- Produces: `FormatOptions` in `types.ts` (`{ precision?: number; rounding?: Decimal.Rounding }`); `formatNumber(value: Decimal, locale: Locale, opts?: FormatOptions): string`; `formatValue(value, registry, locale, opts?: FormatOptions): string`; `EngineOptions.formatPrecision?: number`. Both `formatNumber` and `formatValue` are re-exported from `packages/core/src/index.ts`.
- Consumes: nothing new.

**Why:** M2 shipped no display-precision policy at all. `formatValue` renders the exact authored value, so any kind whose unit ratio does not terminate in decimal prints one-ulp noise at the 28th significant digit:

```
90 deg + 90 deg in turn  ->  0.4999999999999999999999999998turn
2 turn in grad           ->  799.9999999999999999999999996grad
210 mm in pt             ->  595.2755905511811023622047243pt
```

The fix is the standard guard-digit technique: compute at 28 significant digits, display at 26. Two digits of headroom absorb the accumulated error of a round trip while changing nothing that was already exact.

This is deliberately **not** a general "round to N significant figures for readability" policy. Rounding to, say, 15 would break spec §10's `parse(format(v)) === v` property for any value legitimately needing more digits. Guard rounding *strengthens* that property instead: `temperature:f:1` currently round-trips to `1.00000000000000000000000001` and will now render exactly `1`.

Verified against this repo's `Decimal` at precision 28:

| exact value | rendered at 26 |
| --- | --- |
| `90.00000000000000000000000005` | `90` |
| `180.0000000000000000000000001` | `180` |
| `0.4999999999999999999999999998` | `0.5` |
| `799.9999999999999999999999996` | `800` |
| `1.00000000000000000000000001` | `1` |
| `1.570796326794896619231321691` | `1.5707963267948966192313217` |
| `595.2755905511811023622047243` | `595.27559055118110236220472` |
| `0.931322574615478515625` | `0.931322574615478515625` (unchanged) |
| `1.073741824` | `1.073741824` (unchanged) |

Note the first four restore the expectations M2's RULING 8 and RULING 9 had to abandon as unreachable. They were unreachable only because there was no rounding seam.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/format/format.test.ts`:

```ts
test("guard-digit rounding removes one-ulp noise from a round trip", () => {
  const noisy = new Decimal("0.4999999999999999999999999998");
  expect(formatNumber(noisy, enLocale)).toBe("0.5");
  expect(formatNumber(new Decimal("799.9999999999999999999999996"), enLocale)).toBe("800");
  expect(formatNumber(new Decimal("1.00000000000000000000000001"), enLocale)).toBe("1");
});

test("guard-digit rounding leaves an exactly-representable value alone", () => {
  // 21 significant digits, all meaningful: 1 GB expressed in GiB.
  expect(formatNumber(new Decimal("0.931322574615478515625"), enLocale)).toBe(
    "0.931322574615478515625",
  );
});

test("precision is configurable per call", () => {
  const pi = new Decimal("3.14159265358979323846264338328");
  expect(formatNumber(pi, enLocale, { precision: 5 })).toBe("3.1416");
});

test("grouping still applies after rounding", () => {
  expect(formatNumber(new Decimal("1234567.8999999999999999999999999"), enLocale)).toBe(
    "1,234,567.9",
  );
});
```

Change these two assertions in `packages/core/src/kinds/angle.test.ts` — they are the ones RULING 8 corrected away from the plan's original intent, and guard rounding restores that intent. Delete the explanatory comments RULING 8 added above them, since the artifact they describe no longer reaches the user:

```ts
  expect(engine.evaluate("0.25 turn in deg").formatted).toBe("90deg");
```

```ts
  expect(engine.evaluate("200 grad in deg").formatted).toBe("180deg");
```

Change this assertion in `packages/core/src/kinds/measure.test.ts`, and update the comment above it to say the value is guard-rounded to 26 significant digits rather than that no rounding happens:

```ts
  expect(at().evaluate("210 mm in pt").formatted).toBe("595.27559055118110236220472pt");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/format/format.test.ts packages/core/src/kinds/angle.test.ts packages/core/src/kinds/measure.test.ts`
Expected: FAIL — `formatNumber` is not exported, and the three kind assertions still see unrounded output.

- [ ] **Step 3: Add guard rounding to the formatter**

In `packages/core/src/format/format.ts`, add above `formatNumber`:

```ts
/**
 * Display precision, in significant digits: two below the 28 that Decimal
 * computes at. Those two guard digits absorb the error a round trip through a
 * non-terminating ratio accumulates — 5/9 for Fahrenheit, pi/180 for degrees,
 * 1000/3600 for kph — so `0.25 turn in deg` renders "90deg" rather than
 * "90.00000000000000000000000005deg".
 *
 * This is not a readability policy. Rounding harder would break spec §10's
 * `parse(format(v)) === v` property for values that legitimately need more
 * digits; at 26 it strengthens it, because the noise it removes is exactly
 * what made the property fail for temperature, angle and speed.
 */
const DISPLAY_PRECISION = 26;
```

`FormatOptions` itself goes in `packages/core/src/types.ts`, not here, because Task 3 puts it on `FormatCtx` and `types.ts` must not import from `format/format.ts` — that direction is already taken:

```ts
export interface FormatOptions {
  /** Significant digits to display. Defaults to 26. */
  readonly precision?: number;
  /** Rounding mode. Defaults to Decimal's configured mode. */
  readonly rounding?: Decimal.Rounding;
}
```

Change the `Decimal` import at the top of the file from `import type { Decimal }` to `import { Decimal }` — the rounding step constructs one.

Replace `formatNumber`'s signature and first statement:

```ts
export function formatNumber(
  value: Decimal,
  locale: Locale,
  opts: FormatOptions = {},
): string {
  const { group, decimal } = numberSymbols(locale);
  const precision = opts.precision ?? DISPLAY_PRECISION;
  const shown =
    opts.rounding === undefined
      ? new Decimal(value.toPrecision(precision))
      : new Decimal(value.toPrecision(precision, opts.rounding));
```

and change the `const text = value.toFixed();` line below it to:

```ts
  const text = shown.toFixed();
```

Leave the rest of the function — the sign split, the grouping regex, the rejoin — untouched.

- [ ] **Step 4: Thread the options through `formatValue`**

Still in `packages/core/src/format/format.ts`, change `formatValue`'s signature and its two `formatNumber`-adjacent lines:

```ts
export function formatValue(
  value: Value,
  registry: Registry,
  locale: Locale,
  opts: FormatOptions = {},
): string {
  const kind = registry.kinds.get(value.kind);
  if (kind === undefined) return value.canonical.toFixed();
  if (kind.format !== undefined) return kind.format(value, { locale: locale.id });
```

and:

```ts
  const numberText = formatNumber(authored, locale, opts);
```

**Leave the `format` hook's context exactly as it is** — `{ locale: locale.id }`, unchanged from today. `FormatCtx` is still `{ locale: string }` at this point, and spreading `opts` into it would not typecheck. Task 3 widens `FormatCtx` and rebuilds this call site; doing it here would only be half of that change.

- [ ] **Step 5: Add the engine option**

In `packages/core/src/engine.ts`, add to `EngineOptions`:

```ts
  /**
   * Significant digits in formatted output. Defaults to 26 — two guard digits
   * below the 28 Decimal computes at, which is what keeps a round trip through
   * a non-terminating ratio from surfacing as trailing noise.
   */
  formatPrecision?: number;
```

Capture it beside the other options (`const formatPrecision = opts.formatPrecision;`) and pass it at the single `formatValue` call site in `toResult`:

```ts
      formatted: formatValue(value, registry, locale as Locale, {
        ...(formatPrecision === undefined ? {} : { precision: formatPrecision }),
      }),
```

The conditional spread rather than a plain property is required by `exactOptionalPropertyTypes`.

- [ ] **Step 6: Export the formatter**

Add to `packages/core/src/index.ts`, keeping the file's existing alphabetical grouping:

```ts
export type { FormatOptions } from "./format/format";
export { formatNumber, formatValue } from "./format/format";
```

`formatNumber` is exported because Task 6's money kind lives in `@smartput/rates` and must reuse core's locale-aware grouping rather than reimplementing it. M2 rejected a per-kind `format` hook precisely because it bypassed this function; exporting it is what makes the money hook legitimate.

- [ ] **Step 7: Update the two corpus rows**

In `packages/core/corpus/en.tsv`, the `canonical` column is unaffected — only the `formatted` column rounds. Change line 24's fourth column and line 27's fourth column:

```
90 deg in rad	angle	1.570796326794896619231321691	1.5707963267948966192313217 radians
```

```
100 km / 2 h	speed	13.88888888888888888888888889	13.888888888888888888888889m/s
```

Every other row is unchanged: their formatted values are exact decimals well under 26 significant digits.

- [ ] **Step 8: Run the check**

Run: `bun run check`
Expected: all green. If `properties.test.ts`'s `parse(format(v)) === v` loop now passes more strictly than its relative tolerance requires, leave the tolerance in place — it is still correct, and tightening it is not this task's job.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/format packages/core/src/engine.ts packages/core/src/index.ts packages/core/corpus packages/core/src/kinds/angle.test.ts packages/core/src/kinds/measure.test.ts
git commit -m "feat(core): round formatted output at two guard digits"
```

---

## Task 2: Conversion takes a context object

**Files:**
- Modify: `packages/core/src/eval/convert.ts`
- Modify: `packages/core/src/eval/evaluate.ts`, `packages/core/src/format/format.ts`, `packages/core/src/facade/quantity.ts`
- Test: `packages/core/src/eval/convert.test.ts`

**Interfaces:**
- Produces: `export interface ConversionCtx { locale: string; meta?: Record<string, unknown>; rates?: RateLookup; input?: string; note?: (a: Assumption) => void }` — but only `locale` and `meta` exist after this task; `rates`, `input` and `note` are added in Tasks 3 and 4. `toCanonical(value, kind, unit, ctx)` and `fromCanonical(canonical, kind, unit, ctx)`.
- Consumes: nothing new.

**Why:** `toCanonical(value, kind, unit, locale, meta?)` is already five positional parameters, and money needs a sixth (`rates`), assumptions need a seventh (`note`). A positional list that grows once per milestone is how call sites silently drop arguments — M2 shipped exactly that bug, where `coerce` omitted `kindMeta` and produced a different canonical value than `evaluate` for identical input. An options object makes an omission a type error instead.

There are six call sites, all in this repo, so this is a mechanical refactor with a compiler-checked completion condition.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/eval/convert.test.ts`:

```ts
test("conversion takes its context as an object", () => {
  const kind = normalizeKind(
    defineKind({
      id: "mass",
      value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
    }),
  );
  const canonical = toCanonical(new Decimal("1.5"), kind, "kg", { locale: "en" });
  expect(canonical.toString()).toBe("1500");
  expect(fromCanonical(canonical, kind, "kg", { locale: "en" }).toString()).toBe("1.5");
});

test("a unit whose ratio reads meta sees it through the context", () => {
  const kind = normalizeKind(
    defineKind({
      id: "measure",
      value: {
        mode: "ratio",
        canonical: "inch",
        units: {
          inch: 1,
          px: {
            ratio: (ctx) => {
              const dpi = ctx.self.meta?.dpi;
              return new Decimal(1).div(typeof dpi === "number" ? dpi : 96);
            },
          },
        },
      },
    }),
  );
  const at300 = toCanonical(new Decimal(300), kind, "px", {
    locale: "en",
    meta: { dpi: 300 },
  });
  expect(at300.toString()).toBe("1");
});
```

If `packages/core/src/eval/convert.test.ts` does not exist, create it with the imports these tests need: `Decimal` from `../decimal`, `defineKind` and `normalizeKind` from `../kind/define`, `toCanonical` and `fromCanonical` from `./convert`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/core/src/eval/convert.test.ts`
Expected: FAIL — `toCanonical` still expects `locale` as a string in the fourth position, so passing an object is a type error and produces `NaN`-shaped output at runtime.

- [ ] **Step 3: Rewrite `convert.ts`**

Replace the whole of `packages/core/src/eval/convert.ts`:

```ts
import { Decimal } from "../decimal";
import type { NormalizedKind } from "../kind/define";
import type { EvalCtx, Value } from "../types";

/**
 * Everything a unit's `ratio`/`offset` function might need, in one object.
 *
 * It grows: `rates` and `note` arrive with money. A positional parameter list
 * would let a call site silently omit one — which is exactly the defect M2
 * shipped when `coerce` dropped `kindMeta` and disagreed with `evaluate` about
 * the canonical value of the same input.
 */
export interface ConversionCtx {
  readonly locale: string;
  readonly meta?: Record<string, unknown>;
}

function evalCtxFor(
  kind: NormalizedKind,
  unit: string,
  ctx: ConversionCtx,
): EvalCtx {
  const self: Value = {
    kind: kind.id,
    canonical: new Decimal(0),
    unit,
    ...(ctx.meta ? { meta: ctx.meta } : {}),
  };
  return { self, locale: ctx.locale };
}

function unitOf(kind: NormalizedKind, unit: string) {
  const def = kind.units.get(unit);
  if (def === undefined) throw new Error(`Unknown unit ${unit} for kind ${kind.id}`);
  return def;
}

export function toCanonical(
  value: Decimal,
  kind: NormalizedKind,
  unit: string,
  ctx: ConversionCtx,
): Decimal {
  const def = unitOf(kind, unit);
  const evalCtx = evalCtxFor(kind, unit, ctx);
  return value.plus(def.offset(evalCtx)).times(def.ratio(evalCtx));
}

export function fromCanonical(
  canonical: Decimal,
  kind: NormalizedKind,
  unit: string,
  ctx: ConversionCtx,
): Decimal {
  const def = unitOf(kind, unit);
  const evalCtx = evalCtxFor(kind, unit, ctx);
  return canonical.div(def.ratio(evalCtx)).minus(def.offset(evalCtx));
}
```

- [ ] **Step 4: Update the six call sites**

The compiler names all of them. Each becomes an object at the fourth position:

- `packages/core/src/eval/evaluate.ts`, in the `quantity` case: `toCanonical(n.value, kind, choice.unit, { locale, ...(meta ? { meta } : {}) })`
- `packages/core/src/format/format.ts`, in `formatValue`: `fromCanonical(value.canonical, kind, value.unit, { locale: locale.id, ...(value.meta ? { meta: value.meta as Record<string, unknown> } : {}) })`
- `packages/core/src/facade/quantity.ts`, all four sites: the private `canonical()`, `to()`, and the two `fromCanonical` calls in the arithmetic. Each already has `locale.id` and `this.meta` in scope; the conditional spread pattern is the same.

Every one of these uses a conditional spread rather than assigning `meta` directly, because `exactOptionalPropertyTypes` rejects `meta: undefined` where the property is `meta?: Record<string, unknown>`.

- [ ] **Step 5: Run the check**

Run: `bun run check`
Expected: green. The refactor is behaviour-preserving — if any existing test's value changes, stop and report, because that means a call site was passing something the new shape drops.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "refactor(core): give conversion a context object"
```

---

## Task 3: `RateLookup`, `MissingRateError`, and rates through the engine

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/errors.ts`
- Modify: `packages/core/src/eval/convert.ts`
- Modify: `packages/core/src/eval/evaluate.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/engine.test.ts`, `packages/core/src/errors.test.ts`

**Interfaces:**
- Consumes: `ConversionCtx` from Task 2.
- Produces:
  - `export interface RateLookup { readonly base: string; readonly asOf: string; get(from: string, to: string): Decimal | null }`
  - `EvalCtx.rates?: RateLookup`, `ConversionCtx.rates?: RateLookup`
  - `FormatCtx.precision?: number`, `FormatCtx.rounding?: Decimal.Rounding`
  - `MissingRateError` with `from`, `to`, `asOf`
  - `EngineOptions.rates?: RateLookup`, `EngineOptions.rounding?: Decimal.Rounding`
  - `Result.meta.ratesAsOf?: string`
  - `evaluateNode(opts: EvaluateOptions): EvalResult` — the positional parameter list becomes an object, for the same reason Task 2 changed conversion's.

**Why:** Spec §6 puts `rates` on `EngineOptions` and `ratesAsOf` on `Result.meta`. The type it holds must live in core, because `EvalCtx` is a core type and core cannot depend on `@smartput/rates` — that would invert the dependency and break the one-dependency guard. So core declares the *structural* interface `RateLookup`, and `@smartput/rates`'s `RateSnapshot` satisfies it without either package importing the other's type. Core never learns what a currency is; it only knows there is something that can be asked for a number.

`MissingRateError` belongs in core's `errors.ts` even though only the money kind raises it, because spec §7 lists it alongside the rest and every error must extend `SmartputError` — a consumer's `instanceof SmartputError` guard has to catch it. M2 shipped a bug of exactly this shape when two registration errors extended `Error` instead.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/errors.test.ts`:

```ts
test("a missing rate names the pair and the snapshot date", () => {
  const err = new MissingRateError("30 usd in jpy", "USD", "JPY", "2026-08-04");
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.name).toBe("MissingRateError");
  expect(err.from).toBe("USD");
  expect(err.to).toBe("JPY");
  expect(err.asOf).toBe("2026-08-04");
  expect(err.message).toContain("USD");
  expect(err.message).toContain("JPY");
  expect(err.message).toContain("2026-08-04");
});
```

Add to `packages/core/src/engine.test.ts`:

```ts
test("a unit ratio reads the injected rates, and the result is dated", () => {
  // Half a "florin" per "guilder" — an invented pair, so nothing here depends
  // on a real currency table or on @smartput/rates existing yet.
  const rates = {
    base: "GLD",
    asOf: "2026-08-04",
    get: (from: string, to: string) =>
      from === "FLN" && to === "GLD" ? new Decimal("0.5") : null,
  };
  const treasure = defineKind({
    id: "treasure",
    value: {
      mode: "ratio",
      canonical: "gld",
      units: {
        gld: 1,
        fln: {
          ratio: (ctx) => {
            const rate = ctx.rates?.get("FLN", "GLD");
            if (rate === null || rate === undefined) {
              throw new MissingRateError(ctx.input ?? "", "FLN", "GLD", ctx.rates?.asOf ?? "");
            }
            return rate;
          },
        },
      },
    },
    lexicon: { gld: { aliases: ["gld"] }, fln: { aliases: ["fln"] } },
  });

  const e = createEngine({ locales: [en], kinds: [number, treasure], rates });
  const r = e.evaluate("10 fln + 1 gld");
  expect(r.value.canonical.toString()).toBe("6");
  expect(r.meta.ratesAsOf).toBe("2026-08-04");
});

test("without rates, a rate-dependent unit raises MissingRateError", () => {
  const rates = {
    base: "GLD",
    asOf: "2026-08-04",
    get: () => null,
  };
  const treasure = defineKind({
    id: "treasure",
    value: {
      mode: "ratio",
      canonical: "gld",
      units: {
        gld: 1,
        fln: {
          ratio: (ctx) => {
            const rate = ctx.rates?.get("FLN", "GLD");
            if (rate === null || rate === undefined) {
              throw new MissingRateError(ctx.input ?? "", "FLN", "GLD", ctx.rates?.asOf ?? "");
            }
            return rate;
          },
        },
      },
    },
    lexicon: { gld: { aliases: ["gld"] }, fln: { aliases: ["fln"] } },
  });
  const e = createEngine({ locales: [en], kinds: [number, treasure], rates });
  expect(() => e.evaluate("10 fln")).toThrow(MissingRateError);
});

test("a result carries no ratesAsOf when no rates were supplied", () => {
  const e = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(e.evaluate("1 km").meta.ratesAsOf).toBeUndefined();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/errors.test.ts packages/core/src/engine.test.ts`
Expected: FAIL — `MissingRateError` is not exported, `EngineOptions` has no `rates`, and `EvalCtx` has no `rates`.

- [ ] **Step 3: Declare `RateLookup` and widen the contexts**

In `packages/core/src/types.ts`, add above `EvalCtx`:

```ts
/**
 * The shape the engine needs from a rate table, declared here rather than
 * imported: `@smartput/rates`'s `RateSnapshot` satisfies it structurally, and
 * core stays free of a dependency on a package that depends on core.
 *
 * `get` returns null for an unknown pair rather than throwing, so the kind that
 * asked decides what a missing rate means. The money kind raises
 * MissingRateError; a different kind might fall back.
 */
export interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}
```

`types.ts` already imports `Decimal` as a type; if it does not, add `import type { Decimal } from "./decimal";`.

Add two fields to `EvalCtx`:

```ts
  /** The engine's injected rate table, when one was supplied. */
  readonly rates?: RateLookup;
```

and widen `FormatCtx` so a kind's `format` hook has everything it needs without reaching back into the engine:

```ts
export interface FormatCtx extends FormatOptions {
  readonly locale: string;
  /**
   * `value.canonical` already converted into `value.unit`. A hook that wants
   * the number the user typed wants this, not `value.canonical` — and it means
   * a hook never has to resolve a unit ratio, which for money would mean
   * reaching the rate table from inside the formatter.
   */
  readonly authored: Decimal;
  /**
   * The locale-aware number formatter, pre-bound to this locale. Hooks MUST
   * render through it: M2 rejected a per-kind hook precisely because it
   * formatted by hand and silently dropped locale grouping and the locale
   * decimal separator.
   */
  formatNumber(value: Decimal, opts?: FormatOptions): string;
}
```

This is what makes Task 6's money hook a five-line function instead of a re-implementation of the formatter.

- [ ] **Step 3b: Build the richer context in `formatValue`**

In `packages/core/src/format/format.ts`, `formatValue` currently dispatches to `kind.format` *before* computing `authored`. Reorder so `authored` is computed first — for an opaque kind it is `value.canonical`, exactly as the existing fallback already does — and pass the fuller context:

```ts
  const authored =
    kind.spec.mode === "ratio"
      ? fromCanonical(value.canonical, kind, value.unit, {
          locale: locale.id,
          ...(value.meta ? { meta: value.meta as Record<string, unknown> } : {}),
          ...(opts.rates ? { rates: opts.rates } : {}),
        })
      : value.canonical;

  if (kind.format !== undefined) {
    return kind.format(value, {
      locale: locale.id,
      authored,
      ...opts,
      formatNumber: (v, o) => formatNumber(v, locale, o ?? opts),
    });
  }
```

`FormatOptions` gains an optional `rates?: RateLookup` for the same reason `ConversionCtx` did — formatting a money value converts canonical euros back into the authored currency, which needs the table. Add it to `FormatOptions` in `types.ts`, and thread `rates` at `formatValue`'s two call sites (`engine.ts`'s `toResult`, and `facade/quantity.ts`'s `toString`) alongside `precision` and `rounding`.

In `packages/core/src/eval/convert.ts`, add `rates` to `ConversionCtx` and thread it into `evalCtxFor`'s return:

```ts
export interface ConversionCtx {
  readonly locale: string;
  readonly meta?: Record<string, unknown>;
  readonly rates?: RateLookup;
}
```

```ts
  return { self, locale: ctx.locale, ...(ctx.rates ? { rates: ctx.rates } : {}) };
```

- [ ] **Step 4: Add the error**

In `packages/core/src/errors.ts`, following the file's existing convention — extend `SmartputError`, set `this.name` to a string literal, and never derive the name from `new.target`:

```ts
export class MissingRateError extends SmartputError {
  readonly from: string;
  readonly to: string;
  readonly asOf: string;
  constructor(input: string, from: string, to: string, asOf: string) {
    super(`No rate for ${from}->${to} in the snapshot as of ${asOf}`, input);
    this.name = "MissingRateError";
    this.from = from;
    this.to = to;
    this.asOf = asOf;
  }
}
```

- [ ] **Step 5: Give `evaluateNode` an options object**

In `packages/core/src/eval/evaluate.ts`, replace the positional signature. It currently takes six parameters and is about to need eight:

```ts
export interface EvaluateOptions {
  node: Node;
  assignment: Assignment;
  registry: Registry;
  locale: string;
  input: string;
  kindMeta?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  rates?: RateLookup;
}

export function evaluateNode(opts: EvaluateOptions): EvalResult {
  const { node, assignment, registry, locale, input, rates } = opts;
  const kindMeta = opts.kindMeta ?? {};
```

Inside, `ctxFor` gains rates so an op signature's `apply` sees them too:

```ts
  const ctxFor = (self: Value): EvalCtx => ({
    self,
    locale,
    input,
    ...(rates ? { rates } : {}),
  });
```

and the `quantity` case's conversion passes them:

```ts
          canonical: toCanonical(n.value, kind, choice.unit, {
            locale,
            ...(meta ? { meta } : {}),
            ...(rates ? { rates } : {}),
          }),
```

- [ ] **Step 6: Thread it through the engine**

In `packages/core/src/engine.ts`, add to `EngineOptions`:

```ts
  /**
   * FX rates for kinds whose unit ratios are not constants. `@smartput/rates`'s
   * RateSnapshot satisfies this structurally; core never imports it.
   */
  rates?: RateLookup;
  /** Rounding mode for money formatting. Default ROUND_HALF_EVEN. */
  rounding?: Decimal.Rounding;
```

Capture them beside the other options, and update both `evaluateNode` call sites — `toResult` and `coerce` — to the object form. `toResult` becomes:

```ts
  function toResult(
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
      }),
      kind: value.kind,
      confidence: assignment.confidence,
      spans: [node.span],
      meta: {
        assumptions,
        ...(rates ? { ratesAsOf: rates.asOf } : {}),
      },
    };
  }
```

`coerce`'s call takes the same object shape and keeps its `.value` access. Widen `Result["meta"]` to `{ ratesAsOf?: string; assumptions: string[] }` — `assumptions` becomes structured in Task 4, not here.

- [ ] **Step 7: Export the new surface**

Add `MissingRateError` to core's public exports — `packages/core/src/index.ts` already has `export * from "./errors"`, so it is automatic; verify rather than assume. `RateLookup` is covered by the existing `export type * from "./types"`.

- [ ] **Step 8: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/core/src
git commit -m "feat(core): accept an injected rate table"
```

---

## Task 4: Structured assumptions, recordable from a conversion

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/eval/convert.ts`
- Modify: `packages/core/src/eval/evaluate.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/kinds/temperature.ts`
- Test: `packages/core/src/eval/evaluate.test.ts`, `packages/core/src/kinds/temperature.test.ts`

**Interfaces:**
- Consumes: `EvalCtx` from Task 3.
- Produces: `export interface Assumption { code: string; message: string; detail?: Readonly<Record<string, string>> }`; `EvalCtx.note?: (a: Assumption) => void`; `OpSignature.assumption?: Assumption`; `Result.meta.assumptions: Assumption[]`.

**Why:** Two reasons, and the second is what makes this a task rather than a rename.

Spec §6 types `meta.assumptions` as `Assumption[]`; M2 shipped `string[]` because a bare string was all temperature needed. Spec §8 requires a cross-rate — `USD→EUR→UAH` — to be "recorded in `meta.assumptions`, never silent". That assumption is not a constant: it names both currencies and the pivot, which are known only once a specific expression is being evaluated. A `string` cannot carry that structure, and `OpSignature.assumption` cannot carry it either, because that field is fixed at registration while the currencies vary per expression.

So assumptions need two things they lack: structure, and a way to be recorded *dynamically* from inside an op's `apply` rather than only declared statically on the signature. The sink mirrors the collector `evaluateNode` already runs for static assumptions — it stays owned by the evaluator, and an `apply` invoked outside evaluation simply sees no sink and records nothing, which is correct: there is no `Result` to attach to.

`ConversionCtx` deliberately does **not** gain a sink. Task 6 records its cross-rate from an `in|money|money` signature, which sees both currencies; a unit ratio sees only one and could not name a pivot anyway.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/eval/evaluate.test.ts`:

```ts
// A kind whose `+` records an assumption naming its own operands — the shape
// money's cross-rate needs, where the detail is known only per expression.
const dynamicallyNoted = defineKind({
  id: "treasure",
  value: { mode: "ratio", canonical: "gld", units: { gld: 1, slv: 0.5 } },
  lexicon: { gld: { aliases: ["gld"] }, slv: { aliases: ["slv"] } },
  ops: [
    {
      op: "+",
      left: "treasure",
      right: "treasure",
      result: "treasure",
      apply: (l, r, ctx) => {
        ctx.note?.({
          code: "melted-down",
          message: `${l.unit} and ${r.unit} were melted into one ingot`,
          detail: { from: l.unit, to: r.unit, via: "gld" },
        });
        return Object.freeze({
          kind: l.kind,
          canonical: l.canonical.plus(r.canonical),
          unit: l.unit,
        });
      },
    },
  ],
});

test("an op can record an assumption dynamically through the context sink", () => {
  const e = createEngine({ locales: [en], kinds: [number, dynamicallyNoted] });
  const r = e.evaluate("10 gld + 4 slv");
  expect(r.meta.assumptions).toHaveLength(1);
  expect(r.meta.assumptions[0]?.code).toBe("melted-down");
  expect(r.meta.assumptions[0]?.detail?.via).toBe("gld");
  expect(r.meta.assumptions[0]?.message).toBe("gld and slv were melted into one ingot");
});

test("the same assumption recorded twice is kept once", () => {
  const e = createEngine({ locales: [en], kinds: [number, dynamicallyNoted] });
  // Two additions, identical operand units, so both notes serialize the same.
  expect(e.evaluate("1 gld + 2 gld + 3 gld").meta.assumptions).toHaveLength(1);
});
```

In `packages/core/src/kinds/temperature.test.ts`, the existing assertion `expect(r.meta.assumptions.length).toBeGreaterThan(0)` still holds. Add one that pins the new shape:

```ts
test("the temperature-delta assumption carries a stable code", () => {
  const r = engine.evaluate("20 C + 5 C");
  expect(r.meta.assumptions[0]?.code).toBe("temperature-delta");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/eval/evaluate.test.ts packages/core/src/kinds/temperature.test.ts`
Expected: FAIL — `ctx.note` does not exist, and assumptions are strings with no `.code`.

- [ ] **Step 3: Define the type**

In `packages/core/src/types.ts`:

```ts
/**
 * A defensible-but-not-unique reading of the input, surfaced on the Result.
 *
 * `code` is stable and machine-readable — a UI branches on it, a test asserts
 * it. `message` is human-facing and may be reworded freely. `detail` carries
 * the specifics: which currencies, which pivot.
 */
export interface Assumption {
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, string>>;
}
```

Change `OpSignature.assumption` from `string` to `Assumption`, keeping its existing doc comment, and add the sink to `EvalCtx`:

```ts
  /**
   * Records an assumption made while converting. Supplied by the evaluator;
   * absent during a standalone conversion, which has no Result to attach to.
   */
  readonly note?: (a: Assumption) => void;
```

- [ ] **Step 4: Thread the sink**

`packages/core/src/eval/convert.ts` is **not** touched by this task — see the Interfaces note above.

In `packages/core/src/eval/evaluate.ts`, change the collector to dedupe on the serialized assumption rather than on string identity, and pass itself into both the eval context and the conversion:

```ts
  const assumptions: Assumption[] = [];
  const seen = new Set<string>();
  const note = (a: Assumption): void => {
    const key = JSON.stringify([a.code, a.message, a.detail ?? null]);
    if (seen.has(key)) return;
    seen.add(key);
    assumptions.push(a);
  };
  const noteSignature = (sig: OpSignature): void => {
    if (sig.assumption !== undefined) note(sig.assumption);
  };
```

Replace the two existing `note(sig)` calls with `noteSignature(sig)`, and add `note` to `ctxFor`'s returned object so an op's `apply` can reach it. The `quantity` case's `toCanonical` context is unchanged — conversions record nothing.

- [ ] **Step 5: Update temperature's two signatures**

In `packages/core/src/kinds/temperature.ts`, both declared signatures currently carry a string assumption. Replace each with:

```ts
      assumption: {
        code: "temperature-delta",
        message: "the second operand was read as a temperature difference",
      },
```

- [ ] **Step 6: Widen `Result`**

In `packages/core/src/engine.ts`, `Result["meta"]` becomes `{ ratesAsOf?: string; assumptions: Assumption[] }`. This is a breaking change to a public type, deliberate and spec-directed.

- [ ] **Step 7: Run the check and commit**

Run: `bun run check` → green. The corpus test does not read assumptions, so no corpus row changes.

```bash
git add packages/core/src
git commit -m "feat(core): make assumptions structured and recordable from conversions"
```

---

## Task 5: The `@smartput/rates` package and `RateSnapshot`

**Files:**
- Create: `packages/rates/package.json`, `packages/rates/tsconfig.json`
- Create: `packages/rates/src/index.ts`, `packages/rates/src/snapshot.ts`
- Test: `packages/rates/src/snapshot.test.ts`
- Modify: `scripts/check-deps.ts`
- Modify: `tsconfig.base.json` if it lists project paths; check before editing

**Interfaces:**
- Consumes: `RateLookup` from `@smartput/core` (Task 3) — `RateSnapshot` must satisfy it structurally.
- Produces: `export interface RateSnapshot extends RateLookup {}`; `export function snapshot(base: string, asOf: string, table: Record<string, number | string>): RateSnapshot`.

**Why:** This is the first package outside core, and it is the rehearsal for M4's datetime package. Getting the workspace wiring, the dependency guard and the test discovery right here means M4 copies a working shape instead of inventing one.

`snapshot()` takes the table in the shape providers actually return: quotes per one unit of the base. ECB's daily file says `USD 1.1` meaning one euro buys 1.1 dollars. Every `get` is derived from that single table, which is what makes cross-rates fall out for free.

- [ ] **Step 1: Write the failing test**

`packages/rates/src/snapshot.test.ts`:

```ts
import { expect, test } from "bun:test";
import { snapshot } from "./snapshot";

// One euro buys 1.1 dollars and 45.5 hryvnia.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

test("the base converts to itself at one", () => {
  expect(rates.get("EUR", "EUR")?.toString()).toBe("1");
  expect(rates.get("USD", "USD")?.toString()).toBe("1");
});

test("a quote against the base reads straight off the table", () => {
  expect(rates.get("EUR", "USD")?.toString()).toBe("1.1");
});

test("the inverse direction divides", () => {
  expect(rates.get("USD", "EUR")?.toString()).toBe("0.9090909090909090909090909091");
});

test("a cross rate goes through the base", () => {
  // 45.5 UAH per EUR / 1.1 USD per EUR = 41.36... UAH per USD.
  expect(rates.get("USD", "UAH")?.toString()).toBe("41.36363636363636363636363636");
});

test("an unknown currency is null, not an exception", () => {
  expect(rates.get("USD", "JPY")).toBeNull();
  expect(rates.get("JPY", "USD")).toBeNull();
});

test("codes are matched case-insensitively", () => {
  expect(rates.get("usd", "eur")?.toString()).toBe("0.9090909090909090909090909091");
});

test("the snapshot is frozen and carries its date", () => {
  expect(rates.base).toBe("EUR");
  expect(rates.asOf).toBe("2026-08-04");
  expect(Object.isFrozen(rates)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/rates/src/snapshot.test.ts`
Expected: FAIL — `Cannot find module './snapshot'`.

- [ ] **Step 3: Create the package**

`packages/rates/package.json`:

```json
{
  "name": "@smartput/rates",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./locale/en": "./src/locale/en.ts"
  },
  "dependencies": {
    "@smartput/core": "workspace:*",
    "decimal.js": "^10.6.0"
  }
}
```

`packages/rates/tsconfig.json` — copy `packages/core/tsconfig.json` and adjust only the paths it contains. Read that file first rather than assuming its shape; it is the authority on the compiler options this repo uses.

The root `package.json` already declares `"workspaces": ["packages/*"]`, so no change is needed there. Run `bun install` after creating the package so the workspace link resolves.

- [ ] **Step 4: Write the snapshot**

`packages/rates/src/snapshot.ts`:

```ts
import { Decimal } from "decimal.js";
import type { RateLookup } from "@smartput/core";

/**
 * A dated, immutable rate table. Satisfies core's `RateLookup` structurally, so
 * neither package imports the other's implementation.
 *
 * Everything derives from one table of quotes per unit of `base`, which is the
 * shape every provider returns. A cross rate is then just a division, and it is
 * the caller's kind — not this table — that decides whether to record that as
 * an assumption.
 */
export interface RateSnapshot extends RateLookup {}

export function snapshot(
  base: string,
  asOf: string,
  table: Record<string, number | string>,
): RateSnapshot {
  const baseCode = base.toUpperCase();
  const quotes = new Map<string, Decimal>([[baseCode, new Decimal(1)]]);
  for (const [code, quote] of Object.entries(table)) {
    quotes.set(code.toUpperCase(), new Decimal(quote));
  }

  return Object.freeze({
    base: baseCode,
    asOf,
    get(from: string, to: string): Decimal | null {
      const a = quotes.get(from.toUpperCase());
      const b = quotes.get(to.toUpperCase());
      if (a === undefined || b === undefined) return null;
      // Both are quoted per unit of base, so the base cancels.
      return b.div(a);
    },
  });
}
```

Note `new Decimal(quote)` accepts the number form directly; the table is authored as numbers for readability and nothing downstream sees a float, because `Decimal` widens at construction. A provider that has more precision than a JS number can hold should pass strings, which is why the parameter accepts both.

- [ ] **Step 5: Write the barrel**

`packages/rates/src/index.ts`:

```ts
export type { RateSnapshot } from "./snapshot";
export { snapshot } from "./snapshot";
```

Later tasks extend this file.

- [ ] **Step 6: Extend the dependency guard**

`scripts/check-deps.ts` currently hardcodes core. Rewrite it to check both packages against their own allowlists:

```ts
const ALLOWED: Record<string, string[]> = {
  "packages/core/package.json": ["decimal.js"],
  "packages/rates/package.json": ["decimal.js", "@smartput/core"],
};

let failed = false;
for (const [path, allowed] of Object.entries(ALLOWED)) {
  const pkg = await Bun.file(path).json();
  const deps = Object.keys(pkg.dependencies ?? {});
  const extra = deps.filter((d) => !allowed.includes(d));
  if (extra.length > 0) {
    console.error(
      `${pkg.name} may depend only on ${allowed.join(", ")}. Found extra: ${extra.join(", ")}`,
    );
    failed = true;
  } else {
    console.log(`${pkg.name} dependencies OK: ${deps.join(", ") || "(none)"}`);
  }
}
if (failed) process.exit(1);
```

- [ ] **Step 7: Confirm the typecheck covers the new package**

`package.json`'s `typecheck` script runs `tsc -p packages/core/tsconfig.json`. It must now cover both. Change it to run each in turn:

```json
"typecheck": "tsc -p packages/core/tsconfig.json --noEmit && tsc -p packages/rates/tsconfig.json --noEmit",
```

- [ ] **Step 8: Run the check and commit**

Run: `bun install && bun run check`
Expected: green, with the dependency guard now reporting two packages.

```bash
git add packages/rates scripts/check-deps.ts package.json bun.lock
git commit -m "feat(rates): add the package and RateSnapshot"
```

---

## Task 6: The `money` kind

**Files:**
- Create: `packages/rates/src/currencies.ts`, `packages/rates/src/money.ts`
- Create: `packages/rates/src/money.test.ts`
- Modify: `packages/rates/src/index.ts`

**Interfaces:**
- Consumes: `snapshot` (Task 5); `RateLookup`, `MissingRateError`, `formatNumber`, `Assumption` from `@smartput/core` (Tasks 1, 3, 4).
- Produces: `export const money: Kind`; `export const CURRENCIES: Record<string, CurrencyDef>` where `CurrencyDef = { minorUnits: number; symbol: string; aliases: string[] }`.

**Why:** This is the milestone's point. `money` is an ordinary ratio kind — no new engine mechanism, no currency-aware code path. Its canonical unit is EUR because ECB quotes against EUR, and every other currency's ratio is a function that asks `ctx.rates`. Spec §4 shows exactly this shape.

Two behaviours need care.

**Money never rounds mid-expression** (§8): the ratio functions return full-precision Decimals and rounding happens once, in the format hook, at the currency's minor-unit scale.

**A cross rate is recorded, never silent** (§8). Getting this right needs care about *where* it can be detected. A unit's `ratio` function sees one currency — its own — and converts it to canonical EUR; against an ECB snapshot that is always a directly quoted rate, never a cross. The cross appears only when an expression converts between two currencies that are *both* non-base, as in `100 usd in uah`: USD→EUR and EUR→UAH are each direct, but the USD/UAH rate the user effectively asked for was derived by division. Only something that sees both currencies can say that, so `money` overrides the generated `in|money|money` signature with one whose `apply` records the assumption. Registry pass 4 permits a kind to replace a signature it generated itself.

That is also why Task 4 put the `note` sink on `EvalCtx` rather than on `ConversionCtx`: the detail is per-expression, so it cannot be the static `OpSignature.assumption`, and it cannot come from a conversion that sees only one side.

The format hook must call core's `formatNumber` rather than formatting by hand. M2 rejected a per-kind format hook that bypassed it, because doing so silently dropped locale grouping and the locale decimal separator. Task 1 exported `formatNumber` precisely so this hook can be legitimate.

Verified arithmetic, against `snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 })`:

| expression | canonical (EUR) | formatted |
| --- | --- | --- |
| `30 usd` | `27.27272727272727272727272727` | `$30.00` |
| `30 usd - 10 eur` | `17.27272727272727272727272727` | `$19.00` |
| `100 usd in uah` | `90.90909090909090909090909091` | `₴4,136.36` |

The `30 usd - 10 eur` case is exact before any rounding: the division by the USD ratio cancels, giving precisely 19.

- [ ] **Step 1: Write the failing tests**

`packages/rates/src/money.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine, MissingRateError, number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "./money";
import { snapshot } from "./snapshot";

// One euro buys 1.1 dollars and 45.5 hryvnia.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });
const engine = createEngine({ locales: [en], kinds: [number, money], rates });

test("a bare amount is money in its authored currency", () => {
  const r = engine.evaluate("30 usd");
  expect(r.kind).toBe("money");
  expect(r.value.canonical.toString()).toBe("27.27272727272727272727272727");
  expect(r.formatted).toBe("$30.00");
});

test("mixed-currency subtraction keeps the left operand's currency", () => {
  const r = engine.evaluate("30 usd - 10 eur");
  expect(r.value.canonical.toString()).toBe("17.27272727272727272727272727");
  expect(r.formatted).toBe("$19.00");
});

test("conversion goes through the canonical euro", () => {
  expect(engine.evaluate("100 usd in uah").formatted).toBe("₴4,136.36");
});

test("the result is dated from the snapshot", () => {
  expect(engine.evaluate("30 usd").meta.ratesAsOf).toBe("2026-08-04");
});

test("a cross rate is recorded, never silent", () => {
  const r = engine.evaluate("100 usd in uah");
  const cross = r.meta.assumptions.find((a) => a.code === "cross-rate");
  expect(cross).toBeDefined();
  expect(cross?.detail).toEqual({ from: "USD", to: "UAH", via: "EUR" });
});

test("a conversion involving the base records no cross-rate assumption", () => {
  expect(engine.evaluate("30 usd in eur").meta.assumptions).toEqual([]);
});

test("a currency absent from the snapshot raises MissingRateError", () => {
  expect(() => engine.evaluate("30 jpy")).toThrow(MissingRateError);
});

test("a zero-minor-unit currency formats without decimals", () => {
  const withYen = createEngine({
    locales: [en],
    kinds: [number, money],
    rates: snapshot("EUR", "2026-08-04", { JPY: 170 }),
  });
  expect(withYen.evaluate("5000 jpy").formatted).toBe("¥5,000");
});

test("money never rounds mid-expression", () => {
  // A third of a dollar three times is a dollar, not 0.99.
  const r = engine.evaluate("(1 usd / 3) * 3");
  expect(r.formatted).toBe("$1.00");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/rates/src/money.test.ts`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 3: Write the currency table**

`packages/rates/src/currencies.ts`:

```ts
export interface CurrencyDef {
  /** Decimal places at which this currency is displayed. JPY has none. */
  minorUnits: number;
  symbol: string;
  aliases: string[];
}

/**
 * The currencies ECB's daily reference file covers, plus the euro itself.
 * Deliberately not the full ISO 4217 list: a code with no rate behind it can
 * only ever raise MissingRateError, so listing it would promise nothing.
 */
export const CURRENCIES: Record<string, CurrencyDef> = {
  eur: { minorUnits: 2, symbol: "€", aliases: ["eur", "euro", "euros"] },
  usd: { minorUnits: 2, symbol: "$", aliases: ["usd", "dollar", "dollars"] },
  gbp: { minorUnits: 2, symbol: "£", aliases: ["gbp", "pound", "pounds"] },
  jpy: { minorUnits: 0, symbol: "¥", aliases: ["jpy", "yen"] },
  chf: { minorUnits: 2, symbol: "CHF", aliases: ["chf", "franc", "francs"] },
  pln: { minorUnits: 2, symbol: "zł", aliases: ["pln", "zloty"] },
  uah: { minorUnits: 2, symbol: "₴", aliases: ["uah", "hryvnia"] },
  cad: { minorUnits: 2, symbol: "CA$", aliases: ["cad"] },
  aud: { minorUnits: 2, symbol: "A$", aliases: ["aud"] },
  sek: { minorUnits: 2, symbol: "kr", aliases: ["sek"] },
  nok: { minorUnits: 2, symbol: "NOK", aliases: ["nok"] },
  czk: { minorUnits: 2, symbol: "Kč", aliases: ["czk"] },
};
```

`$` is deliberately absent from `usd`'s aliases. A leading `$` does not lex as a word token — core's `UNIT_SYMBOLS` allowlist contains only `%` — and adding it there is a lexer change belonging to its own task, not a side effect of this one. Currency symbols are output-only in M3.

- [ ] **Step 4: Write the kind**

`packages/rates/src/money.ts`:

```ts
import {
  Decimal,
  defineKind,
  formatNumber,
  MissingRateError,
  type Kind,
  type Lexicon,
  type UnitDef,
} from "@smartput/core";
import { CURRENCIES } from "./currencies";

const CANONICAL = "eur";

/**
 * One currency's ratio to the canonical euro, resolved from the injected
 * snapshot at conversion time rather than baked into the descriptor. This is
 * the whole reason `ratio` may be a function.
 */
function rateRatio(code: string): UnitDef {
  const upper = code.toUpperCase();
  return {
    ratio: (ctx) => {
      const rates = ctx.rates;
      if (rates === undefined) {
        throw new MissingRateError(ctx.input ?? "", upper, "EUR", "");
      }
      const rate = rates.get(upper, "EUR");
      if (rate === null) {
        throw new MissingRateError(ctx.input ?? "", upper, "EUR", rates.asOf);
      }
      return rate;
    },
  };
}

const units: Record<string, UnitDef | number> = { [CANONICAL]: 1 };
const lexicon: Lexicon = {};
for (const [code, def] of Object.entries(CURRENCIES)) {
  if (code !== CANONICAL) units[code] = rateRatio(code);
  lexicon[code] = { aliases: def.aliases, symbol: def.symbol };
}

/**
 * Canonical euro, because ECB's daily reference file quotes against it.
 *
 * Rounding happens here and nowhere else: the AST carries full Decimal
 * precision, so `(1 usd / 3) * 3` is a dollar rather than 99 cents.
 */
export const money: Kind = defineKind({
  id: "money",
  value: { mode: "ratio", canonical: CANONICAL, units },
  lexicon,
  ops: [
    {
      // Replaces the generated `in|money|money`. Same arithmetic — the
      // conversion itself is done by toCanonical/fromCanonical around this —
      // but it is the one place that sees both currencies, so it is the only
      // place that can tell a directly quoted rate from a derived one.
      op: "in",
      left: "money",
      right: "money",
      result: "money",
      apply: (l, r, ctx) => {
        const base = ctx.rates?.base;
        const from = l.unit.toUpperCase();
        const to = r.unit.toUpperCase();
        if (base !== undefined && from !== to && from !== base && to !== base) {
          ctx.note?.({
            code: "cross-rate",
            message: `${from} to ${to} was derived via ${base}`,
            detail: { from, to, via: base },
          });
        }
        // Same shape the generated signature produces, meta included — M2's
        // review found six hand-written applies that silently dropped it.
        return Object.freeze({
          kind: r.kind,
          canonical: l.canonical,
          unit: r.unit,
          ...(l.meta ? { meta: l.meta } : {}),
        });
      },
    },
  ],
  format: (value, ctx) => {
    const def = CURRENCIES[value.unit];
    const minorUnits = def?.minorUnits ?? 2;
    const rounding = ctx.rounding ?? Decimal.ROUND_HALF_EVEN;
    // ctx.authored is already in this currency; the only job left is to round
    // to its minor units and render through the locale-aware formatter.
    const rounded = new Decimal(ctx.authored.toFixed(minorUnits, rounding));
    return `${def?.symbol ?? value.unit.toUpperCase()}${ctx.formatNumber(rounded, { precision: 34 })}`;
  },
});
```

`precision: 34` disables guard rounding for a value already rounded to its minor units — rounding twice would be wrong, and 34 sits above any minor-unit scale. `toFixed(0, …)` for JPY yields no decimal point, which is what `¥5,000` requires.

Note this hook never touches a rate table or a `Locale` object: Task 3 put `authored` and a pre-bound `formatNumber` on `FormatCtx` precisely so a hook could stay this small. `formatNumber` is still imported into this file for nothing — remove it from the import list if the implementation ends up not needing it directly.

- [ ] **Step 5: Export it**

Add to `packages/rates/src/index.ts`:

```ts
export type { CurrencyDef } from "./currencies";
export { CURRENCIES } from "./currencies";
export { money } from "./money";
```

- [ ] **Step 6: Run the tests**

Run: `bun test packages/rates/src/money.test.ts`
Expected: PASS, 9 tests.

If `30 usd - 10 eur` yields anything other than exactly `19`, do not adjust the expectation — the value was computed against this repo's Decimal and the division cancels exactly. Investigate whether the ratio direction is inverted: `ratio` converts authored to canonical, so USD's ratio is euros per dollar, which is `get("USD", "EUR")` and is less than one.

- [ ] **Step 7: Run the check and commit**

Run: `bun run check` → green.

```bash
git add packages/rates/src
git commit -m "feat(rates): add the money kind"
```

---

## Task 7: The ECB provider

**Files:**
- Create: `packages/rates/src/providers/ecb.ts`, `packages/rates/src/providers/ecb.test.ts`
- Create: `packages/rates/src/providers/ecb-daily.fixture.xml`
- Modify: `packages/rates/src/index.ts`

**Interfaces:**
- Consumes: `snapshot` (Task 5).
- Produces: `export interface RateProvider { readonly id: string; fetch(): Promise<RateSnapshot> }`; `export function ecb(opts?: { fetch?: typeof globalThis.fetch; url?: string }): RateProvider`; `export function custom(fn: () => Promise<RateSnapshot>): RateProvider`.

**Why:** ECB's daily reference rates are the default because they are official, free, keyless and unencumbered — §2 of the spec rules out redistributing most commercial feeds. The file is small XML quoting roughly thirty currencies against the euro, which is exactly `snapshot`'s input shape.

Parsing it with a regex rather than an XML parser is deliberate: the document is a fixed three-level structure the ECB has published unchanged for two decades, and a parser dependency would be the largest thing in the package. The regex is pinned by a captured fixture so a format change fails loudly.

**No test touches the network.** `fetch` is injected; the test passes a stub that returns the fixture.

- [ ] **Step 1: Capture the fixture**

`packages/rates/src/providers/ecb-daily.fixture.xml` — a trimmed but structurally faithful copy of `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
	<gesmes:subject>Reference rates</gesmes:subject>
	<gesmes:Sender>
		<gesmes:name>European Central Bank</gesmes:name>
	</gesmes:Sender>
	<Cube>
		<Cube time='2026-08-04'>
			<Cube currency='USD' rate='1.1'/>
			<Cube currency='JPY' rate='170.25'/>
			<Cube currency='GBP' rate='0.8412'/>
			<Cube currency='CHF' rate='0.9385'/>
			<Cube currency='PLN' rate='4.2680'/>
			<Cube currency='UAH' rate='45.5'/>
		</Cube>
	</Cube>
</gesmes:Envelope>
```

The USD and UAH values match Task 6's fixture rates so the two tasks' expectations stay in one arithmetic universe.

- [ ] **Step 2: Write the failing tests**

`packages/rates/src/providers/ecb.test.ts`:

```ts
import { expect, test } from "bun:test";
import { ecb } from "./ecb";

const xml = await Bun.file(
  new URL("./ecb-daily.fixture.xml", import.meta.url),
).text();

const stubFetch = (async () =>
  new Response(xml, { status: 200 })) as unknown as typeof globalThis.fetch;

test("the provider parses the daily file into a snapshot", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.base).toBe("EUR");
  expect(rates.asOf).toBe("2026-08-04");
  expect(rates.get("EUR", "USD")?.toString()).toBe("1.1");
  expect(rates.get("USD", "EUR")?.toString()).toBe("0.9090909090909090909090909091");
});

test("every currency in the file is present", () => {
  expect(xml.match(/currency='/g)).toHaveLength(6);
});

test("cross rates work off the parsed table", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.get("USD", "UAH")?.toString()).toBe("41.36363636363636363636363636");
});

test("a currency absent from the file is null", async () => {
  const rates = await ecb({ fetch: stubFetch }).fetch();
  expect(rates.get("EUR", "NZD")).toBeNull();
});

test("a non-200 response is an error naming the status", async () => {
  const failing = (async () =>
    new Response("nope", { status: 503 })) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: failing }).fetch()).rejects.toThrow("503");
});

test("a response missing the date is an error, not a silent empty table", async () => {
  const garbage = (async () =>
    new Response("<html>maintenance</html>", { status: 200 })) as unknown as typeof globalThis.fetch;
  await expect(ecb({ fetch: garbage }).fetch()).rejects.toThrow();
});

test("the provider is identified", () => {
  expect(ecb().id).toBe("ecb");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test packages/rates/src/providers/ecb.test.ts`
Expected: FAIL — `Cannot find module './ecb'`.

- [ ] **Step 4: Write the provider**

`packages/rates/src/providers/ecb.ts`:

```ts
import { snapshot, type RateSnapshot } from "../snapshot";

export interface RateProvider {
  readonly id: string;
  fetch(): Promise<RateSnapshot>;
}

const ECB_DAILY =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const DATE = /<Cube\s+time='(\d{4}-\d{2}-\d{2})'/;
const QUOTE = /<Cube\s+currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;

export interface EcbOptions {
  /** Injected for tests; defaults to the global. */
  fetch?: typeof globalThis.fetch;
  /** Override the endpoint, e.g. for a mirror. */
  url?: string;
}

/**
 * ECB daily reference rates: official, free, no key, ~30 fiat currencies,
 * quoted against the euro and published once each working day.
 *
 * Parsed with two regexes rather than an XML parser. The document has had the
 * same three-level Cube structure for two decades, and a parser would be the
 * heaviest thing in this package. The fixture test is what makes that safe: if
 * the format moves, it fails here rather than in production.
 */
export function ecb(opts: EcbOptions = {}): RateProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const url = opts.url ?? ECB_DAILY;

  return {
    id: "ecb",
    async fetch(): Promise<RateSnapshot> {
      const res = await doFetch(url);
      if (!res.ok) {
        throw new Error(`ECB rates request failed: ${res.status} ${res.statusText}`);
      }
      const xml = await res.text();

      const date = DATE.exec(xml)?.[1];
      if (date === undefined) {
        throw new Error("ECB rates response carried no <Cube time='...'> date");
      }

      const table: Record<string, string> = {};
      // exec in a loop rather than matchAll, so the lastIndex reset below is
      // explicit: QUOTE is module-level and stateful.
      QUOTE.lastIndex = 0;
      let m = QUOTE.exec(xml);
      while (m !== null) {
        const code = m[1];
        const rate = m[2];
        if (code !== undefined && rate !== undefined) table[code] = rate;
        m = QUOTE.exec(xml);
      }
      if (Object.keys(table).length === 0) {
        throw new Error("ECB rates response carried no currency quotes");
      }

      return snapshot("EUR", date, table);
    },
  };
}

/** Wraps any async source in the provider shape. */
export function custom(fn: () => Promise<RateSnapshot>): RateProvider {
  return { id: "custom", fetch: fn };
}
```

Note the rates are passed as **strings**, not numbers — ECB publishes five significant digits and a string keeps them exact through `Decimal`'s constructor with no float in between.

- [ ] **Step 5: Export it**

Add to `packages/rates/src/index.ts`:

```ts
export type { EcbOptions, RateProvider } from "./providers/ecb";
export { custom, ecb } from "./providers/ecb";
```

- [ ] **Step 6: Run the tests, the check, and commit**

Run: `bun test packages/rates/src/providers/ecb.test.ts` → PASS, 7 tests.
Run: `bun run check` → green.

```bash
git add packages/rates/src/providers packages/rates/src/index.ts
git commit -m "feat(rates): add the ECB daily rates provider"
```

---

## Task 8: `createLiveEngine`

**Files:**
- Create: `packages/rates/src/live.ts`, `packages/rates/src/live.test.ts`
- Modify: `packages/rates/src/index.ts`

**Interfaces:**
- Consumes: `RateProvider` (Task 7); `createEngine`, `EngineOptions`, `Engine`, `Result` from `@smartput/core`.
- Produces:

```ts
export interface LiveEngineOptions extends Omit<EngineOptions, "rates"> {
  provider: RateProvider;
  ttlMs?: number;            // default 3_600_000
  now?: () => number;        // injectable clock, default Date.now
}

export interface LiveEngine {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  refresh(): Promise<void>;
  readonly sync: Engine;     // throws until the first refresh
  readonly ratesAsOf: string | undefined;
}
```

**Why:** Spec §5 (D6) keeps the core sync — keystroke-rate parsing and deterministic tests both require it — and pushes I/O to a separate async facade. `createLiveEngine` is that facade: it owns the fetch, the TTL and the cached snapshot, and rebuilds a plain sync `Engine` whenever the snapshot changes. `.sync` is the escape hatch for a caller who wants to drive the sync engine directly after a refresh.

The clock is injected for the same reason `now` is injectable on `EngineOptions`: a TTL test that slept for an hour would not be a test.

- [ ] **Step 1: Write the failing tests**

`packages/rates/src/live.test.ts`:

```ts
import { expect, test } from "bun:test";
import { number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { createLiveEngine } from "./live";
import { money } from "./money";
import { snapshot } from "./snapshot";
import type { RateProvider } from "./providers/ecb";

function countingProvider(): RateProvider & { calls: number } {
  const p = {
    id: "test",
    calls: 0,
    async fetch() {
      p.calls += 1;
      // The rate moves each call, so a stale read is visible in the output.
      return snapshot("EUR", `2026-08-0${p.calls}`, { USD: 1 + p.calls / 10 });
    },
  };
  return p;
}

test("the first evaluate fetches, and the result is dated", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  const r = await live.evaluate("11 usd");
  expect(provider.calls).toBe(1);
  expect(r.meta.ratesAsOf).toBe("2026-08-01");
});

test("a second call inside the TTL reuses the snapshot", async () => {
  const provider = countingProvider();
  let clock = 0;
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("11 usd");
  clock = 999;
  await live.evaluate("11 usd");
  expect(provider.calls).toBe(1);
});

test("a call past the TTL refetches", async () => {
  const provider = countingProvider();
  let clock = 0;
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
    ttlMs: 1000,
    now: () => clock,
  });
  await live.evaluate("11 usd");
  clock = 1001;
  const r = await live.evaluate("11 usd");
  expect(provider.calls).toBe(2);
  expect(r.meta.ratesAsOf).toBe("2026-08-02");
});

test("concurrent first calls share one fetch", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  await Promise.all([live.evaluate("11 usd"), live.evaluate("11 usd")]);
  expect(provider.calls).toBe(1);
});

test("sync throws before the first refresh and works after", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  expect(() => live.sync).toThrow();
  await live.refresh();
  expect(live.sync.evaluate("11 usd").meta.ratesAsOf).toBe("2026-08-01");
  expect(live.ratesAsOf).toBe("2026-08-01");
});

test("suggest is available asynchronously too", async () => {
  const provider = countingProvider();
  const live = createLiveEngine({
    locales: [en],
    kinds: [number, money],
    provider,
  });
  expect(Array.isArray(await live.suggest("11 usd"))).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/rates/src/live.test.ts`
Expected: FAIL — `Cannot find module './live'`.

- [ ] **Step 3: Write the live engine**

`packages/rates/src/live.ts`:

```ts
import {
  createEngine,
  type Engine,
  type EngineOptions,
  type EvalOptions,
  type Result,
} from "@smartput/core";
import type { RateProvider } from "./providers/ecb";
import type { RateSnapshot } from "./snapshot";

const HOUR_MS = 3_600_000;

export interface LiveEngineOptions extends Omit<EngineOptions, "rates"> {
  provider: RateProvider;
  /** How long a snapshot stays fresh. Default one hour. */
  ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  now?: () => number;
}

export interface LiveEngine {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  /** Force a fetch regardless of TTL. */
  refresh(): Promise<void>;
  /** The underlying sync engine. Throws until the first refresh. */
  readonly sync: Engine;
  readonly ratesAsOf: string | undefined;
}

/**
 * The async facade over a sync core (spec D6). The core stays pure and
 * keystroke-fast; all I/O, caching and TTL live here.
 *
 * A single in-flight promise is shared by concurrent callers, so a burst of
 * keystrokes on a cold cache produces one request, not one per keystroke.
 */
export function createLiveEngine(opts: LiveEngineOptions): LiveEngine {
  const { provider, ttlMs = HOUR_MS, now = Date.now, ...engineOpts } = opts;

  let engine: Engine | undefined;
  let rates: RateSnapshot | undefined;
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<void> | undefined;

  const doRefresh = async (): Promise<void> => {
    const next = await provider.fetch();
    rates = next;
    fetchedAt = now();
    engine = createEngine({ ...engineOpts, rates: next });
  };

  const refresh = (): Promise<void> => {
    // Share one request among concurrent callers.
    if (inFlight === undefined) {
      inFlight = doRefresh().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };

  const ready = async (): Promise<Engine> => {
    if (engine === undefined || now() - fetchedAt >= ttlMs) await refresh();
    if (engine === undefined) throw new Error("rate provider returned no snapshot");
    return engine;
  };

  return {
    async evaluate(input, evalOpts) {
      return (await ready()).evaluate(input, evalOpts);
    },
    async suggest(input, evalOpts) {
      return (await ready()).suggest(input, evalOpts);
    },
    refresh,
    get sync(): Engine {
      if (engine === undefined) {
        throw new Error("no rates yet — await refresh() or an evaluate() first");
      }
      return engine;
    },
    get ratesAsOf(): string | undefined {
      return rates?.asOf;
    },
  };
}
```

- [ ] **Step 4: Export it**

Add to `packages/rates/src/index.ts`:

```ts
export type { LiveEngine, LiveEngineOptions } from "./live";
export { createLiveEngine } from "./live";
```

- [ ] **Step 5: Run the tests, the check, and commit**

Run: `bun test packages/rates/src/live.test.ts` → PASS, 6 tests.
Run: `bun run check` → green.

```bash
git add packages/rates/src
git commit -m "feat(rates): add createLiveEngine"
```

---

## Task 9: Locale vocabulary, corpus, and closing the M2 item

**Files:**
- Create: `packages/rates/src/locale/en.ts`, `packages/rates/src/locale/en.test.ts`
- Create: `packages/rates/corpus/en.tsv`, `packages/rates/src/corpus.test.ts`
- Modify: `docs/superpowers/m2-followups.md`
- Modify: `README.md` if it documents the package list; check before editing

**Interfaces:**
- Consumes: `defineLocalePack` from `@smartput/core`; `money` (Task 6).
- Produces: `export default enMoney: LocalePack`.

**Why:** Every package that owns a kind owns its vocabulary too, so `@smartput/rates/locale/en` is the shape M4's datetime package and M5's colour package will copy. The corpus is the regression net: M2's corpus caught two arithmetic defects that unit tests missed, because it exercises the whole pipeline from raw text to formatted output.

- [ ] **Step 1: Write the failing locale test**

`packages/rates/src/locale/en.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine, number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "../money";
import { snapshot } from "../snapshot";
import enMoney from "./en";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 });
const engine = createEngine({
  locales: [en],
  kinds: [number, money],
  packs: [enMoney],
  rates,
});

test("spelled-out currency names resolve", () => {
  expect(engine.evaluate("30 dollars").kind).toBe("money");
  expect(engine.evaluate("30 quid").formatted).toBe("£30.00");
});

test("the pack adds vocabulary without replacing the built-in aliases", () => {
  expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test packages/rates/src/locale/en.test.ts`
Expected: FAIL — `Cannot find module './en'`.

- [ ] **Step 3: Write the pack**

`packages/rates/src/locale/en.ts`:

```ts
import { defineLocalePack } from "@smartput/core";

/**
 * Colloquial English currency vocabulary. The ISO codes and the primary names
 * live on the kind itself; this pack adds what only English speakers say.
 */
export default defineLocalePack({
  locale: "en",
  contributes: {
    money: {
      gbp: ["quid", "sterling"],
      usd: ["buck", "bucks"],
      eur: ["euros"],
    },
  },
});
```

Check `defineLocalePack`'s real signature and the `contributes` shape against `packages/core/src/locale/define.ts` before writing this — M2's registry rejects a pack that contributes to an unregistered unit with `UnknownKindError`, so every unit key here must exist in `CURRENCIES`.

- [ ] **Step 4: Write the corpus and its test**

`packages/rates/corpus/en.tsv`, with the same four columns as core's — input, kind, canonical, formatted:

```
# input	kind	canonical	formatted
30 usd	money	27.27272727272727272727272727	$30.00
30 usd - 10 eur	money	17.27272727272727272727272727	$19.00
100 usd in uah	money	90.90909090909090909090909091	₴4,136.36
5 eur + 5 eur	money	10	€10.00
```

`packages/rates/src/corpus.test.ts` — copy `packages/core/src/corpus.test.ts`'s structure exactly, changing only the engine construction to include `money` and the fixed snapshot, and the corpus path. Read that file first; it is the authority on the row format and the assertions.

The snapshot it builds must be `snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 })`, matching Tasks 6 and 7, so every expectation in this milestone lives in one arithmetic universe.

- [ ] **Step 5: Close the M2 follow-up**

In `docs/superpowers/m2-followups.md`, move the "No display-precision policy" section out of "Blocking before any published release" and into a new "Closed in M3" list naming Task 1's commit. Leave every other item in place — none of the rest is addressed by this milestone.

Add to that file's remaining open items, since M3 introduces them:

```markdown
- **Currency symbols are output-only.** `$30` does not parse: core's lexer
  allowlist (`UNIT_SYMBOLS`) contains only `%`, so a leading `$` is skipped.
  Adding currency symbols to the allowlist is a lexer change with its own
  ambiguity questions — `$` prefixes the number rather than following it — and
  belongs in its own task.
- **`money` is not in any default kind set.** It lives in `@smartput/rates` and
  callers pass it explicitly, like every other kind.
```

- [ ] **Step 6: Run the full check**

Run: `bun run check`
Expected: green — lint, typecheck across both packages, the dependency guard reporting both, and the whole suite.

- [ ] **Step 7: Commit**

```bash
git add packages/rates docs/superpowers/m2-followups.md
git commit -m "feat(rates): add English currency vocabulary and the money corpus"
```

---

## Self-Review

**Spec coverage.** §11's M3 row maps to tasks as: money kind → T6; `@smartput/rates` → T5; ECB provider → T7; `createLiveEngine` → T8; `30 usd - 10 eur` → T6's second test and T9's corpus; the `ratio: (ctx)` escape hatch → T3 (the mechanism) and T6 (the consumer). §6's `Rates` block → T5, T7, T8. §6's `EngineOptions.rates`/`rounding` and `Result.meta.ratesAsOf` → T3. §7's `MissingRateError` → T3. §8's "money never rounds mid-expression" → T6's last test; "FX is directional and dated" → T6's cross-rate and dating tests. The M2 display-precision item → T1.

**Deliberately not in M3:** datetime (M4), colour and the Ukrainian locale (M5), `@smartput/http` and the meta-package (M6), CoinGecko (spec §6 lists it beside `ecb()`, but §2 rules the free tier covers crypto only and M3's acceptance criterion is fiat — it belongs with whatever milestone needs crypto). Currency symbols as *input* are excluded and recorded in the follow-ups.

**Known risks, stated rather than hidden:**

1. **`FormatCtx` grows a method, not just fields.** Task 3 puts a pre-bound `formatNumber` on it so a `format` hook cannot bypass locale-aware rendering — M2's rejected hook did exactly that. A method on a context object is slightly awkward to construct and slightly awkward to freeze; the alternative, handing hooks a `Locale` and letting them call the free function, is what M2 showed people get wrong. The trade is deliberate. It also means `FormatCtx` is no longer a plain data bag, so anything that serializes it will need care.
2. **`Result.meta.assumptions` changes shape in T4** from `string[]` to `Assumption[]`. That is a breaking change to a public type, spec-directed, and every in-repo consumer is updated in the same task — but a downstream consumer of M2 would break.
3. **`evaluateNode` and the conversion functions change signature** in T2 and T3. Both are internal, but the concurrent `Engine.complete()` work may hold the old shapes. See the coordination warning.
4. **The ECB regex is pinned only by a fixture we wrote.** If the ECB changes its format, the fixture keeps passing while production fails. A periodic live smoke test outside the unit suite would close that, and belongs in M6 with the release tooling.
5. **`snapshot()` derives every cross rate by division**, which is correct for reference rates but not for a market feed with bid/ask spreads. The `RateLookup` interface leaves room for a provider that quotes pairs directly; nothing here forecloses it.

**Type consistency checked.** `FormatOptions` (T1) is consumed by `formatValue` in T1 and by the money hook in T6. `ConversionCtx` (T2) gains `rates` in T3 and `note` in T4; all three tasks touch the same interface in the same file, in order. `RateLookup` (T3) is implemented by `RateSnapshot` (T5) structurally, and neither package imports the other's version. `Assumption` (T4) is produced by T6's cross-rate note and asserted in T6's test. `RateProvider` (T7) is consumed by `LiveEngineOptions` (T8). `MissingRateError` (T3) is raised in T6 and asserted in T6's test. `CURRENCIES` (T6) is read by T6's format hook and constrains T9's locale pack keys.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-05-smartputs-m3-money.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, a spec-and-quality review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batching with checkpoints.

Which approach?
