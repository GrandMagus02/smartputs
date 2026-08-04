# smartputs Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Engine.complete()`, which turns a half-typed unit into ranked completions — `"30 ho"` into `"30 hours"`, `"10 mil"` into `"10 miles"`, `"1 mi"` into mile, minute, millimetre and millisecond ranked against each other.

**Architecture:** A pure function in a new `complete/` module completes the trailing token only — no lexer, no parser, no solver. It prefix-scans `registry.aliasIndex`, scores each hit with the existing `resolveWeight()` plus two new terms, renders the plural form through `Intl.PluralRules`, and splices the result back into the raw input. `Engine.complete()` is a thin wrapper that forwards the registry, locale and weight layers `createEngine` already holds.

**Tech Stack:** TypeScript, Bun test runner, `decimal.js`. No new runtime dependencies.

The spec is `docs/superpowers/specs/2026-08-04-smartputs-completion-design.md`. Section references below (§2, §4.5, §7…) point at the *main* spec, `2026-08-04-smartputs-design.md`, matching the completion spec's own convention.

## Global Constraints

- `@smartput/core` has exactly one runtime dependency: `decimal.js`. Add nothing.
- All arithmetic goes through the configured `Decimal` from `src/decimal.ts`. Never `Number`, never a float literal, in any comparison or accumulation.
- Every descriptor is deep-frozen by `defineKind`. Never mutate one.
- Same input must produce a byte-identical result on every run (§9). Every sort must be total — no comparator may return 0 for two distinct rows.
- Test runner is `bun test`. Run the whole suite, not just the file you touched.
- `bun run typecheck` and `bun run lint` must both be clean before any commit.
- Compute expected values in tests; do not reason them out by hand. Write invisible characters as `\uXXXX` escapes, never as literals. (Both rules come from the M1 plan's closing note on fixtures.)
- British spelling in prose and in `display` forms (`metre`, `tonne`); American aliases stay in `aliases` where they already exist.

## Sequencing Precondition

**This plan lands after `worktree-m2-kinds` merges to `main`.** Tasks 1 and 2 edit `packages/core/src/kinds/*.ts` and `packages/core/corpus/en.tsv`, both of which that branch also touches. Check before starting:

```bash
git worktree list                 # worktree-m2-kinds should be gone, or merged
git log --oneline main -1         # should contain the M2 merge
```

If M2 has merged, Tasks 1 and 2 must additionally cover the kinds it added (temperature, angle, datasize, speed, area, volume, percent and any others). The `display` and `typical` passes are meant to run **once** across every kind, not twice.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/types.ts` | Add `typical?` to `UnitLexeme`; add `Completion` and `CompleteOptions`. |
| `packages/core/src/kinds/duration.ts` | `display` and `typical` for its six units. |
| `packages/core/src/kinds/length.ts` | `display` and `typical` for its eight units. |
| `packages/core/src/kinds/mass.ts` | `display` and `typical` for its six units. |
| `packages/core/corpus/en.tsv` | Expected `formatted` column moves from symbols to words. |
| `packages/core/src/complete/fragment.ts` | Trailing-fragment extraction and leading-count scan. Pure string work, no registry. |
| `packages/core/src/complete/score.ts` | `EXACT_BONUS`, `LENGTH_PENALTY`, `SCALE_BONUS`, `prefixQuality()`, `scaleFit()`. |
| `packages/core/src/complete/complete.ts` | `complete()` — match, score, render, order. |
| `packages/core/src/engine.ts` | `Engine.complete()` wrapper. |
| `packages/core/src/index.ts` | Export the new types and constants. |
| `packages/core/corpus/en-complete.tsv` | Golden completions: input → expected top row. |

Three files rather than one: `fragment.ts` is testable with no registry at all, `score.ts` is pure arithmetic over three exported constants, and `complete.ts` is the only part that needs a `Registry`. Keeping them apart means Task 3 and Task 4 can each fail independently and a reviewer can reject one without the other.

---

## Task 1: Word-form output for every built-in unit

**Files:**
- Modify: `packages/core/src/kinds/duration.ts`
- Modify: `packages/core/src/kinds/length.ts`
- Modify: `packages/core/src/kinds/mass.ts`
- Modify: `packages/core/corpus/en.tsv`
- Modify: `packages/core/src/engine.test.ts:182-187`
- Modify: `docs/guide/pipeline.md:144`, `docs/guide/getting-started.md:85-86,106`

**Interfaces:**
- Consumes: nothing.
- Produces: every built-in unit's `lexeme.display` is populated with `{ one, other }`. `formatValue` already reads this field (`format/format.ts:50`), so `evaluate().formatted` returns words from here on.

**Why:** `complete()` renders its `text` from `lexeme.display`. Without this the feature falls back to the bare alias and `"30 ho"` yields `"30 hour"`. It also settles a pre-existing inconsistency: `kg` prints `"1.5 kilograms"` while `g` prints `"1,500g"`, purely because `kg` is the one unit that was ever given a `display`.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/engine.test.ts`:

```ts
test("every built-in unit renders a word form, not a symbol", () => {
  const cases: Array<[string, string]> = [
    ["30 h", "30 hours"],
    ["1 h", "1 hour"],
    ["90 min", "90 minutes"],
    ["500 ms", "500 milliseconds"],
    ["2 wk", "2 weeks"],
    ["3 d", "3 days"],
    ["45 s", "45 seconds"],
    ["10 km", "10 kilometres"],
    ["1 km", "1 kilometre"],
    ["250 mm", "250 millimetres"],
    ["7 cm", "7 centimetres"],
    ["10 m", "10 metres"],
    ["12 inch", "12 inches"],
    ["1 inch", "1 inch"],
    ["6 ft", "6 feet"],
    ["1 ft", "1 foot"],
    ["100 yd", "100 yards"],
    ["3 mi", "3 miles"],
    ["500 mg", "500 milligrams"],
    ["250 g", "250 grams"],
    ["3 lbs", "3 pounds"],
    ["8 oz", "8 ounces"],
    ["2 t", "2 tonnes"],
  ];
  for (const [input, expected] of cases) {
    expect(`${input} -> ${engine.evaluate(input, { kinds: kindOf(input) }).formatted}`)
      .toBe(`${input} -> ${expected}`);
  }
});
```

`10 m` and `3 mi` are ambiguous between length and duration, so the test needs a
disambiguating filter. Add this helper directly above the test:

```ts
// "10 m" and "3 mi" are genuinely ambiguous (§4.5); this test is about
// rendering, not ranking, so pin the kind rather than lean on a weight.
const kindOf = (input: string): string[] =>
  /\b(h|min|ms|wk|d|s)$/.test(input) ? ["duration"] : ["length", "mass"];
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test packages/core/src/engine.test.ts -t "word form"
```

Expected: FAIL. First mismatch will be `30 h -> 30h` against `30 h -> 30 hours`.

- [ ] **Step 3: Add `display` to every duration unit**

Replace the `lexicon` block in `packages/core/src/kinds/duration.ts`:

```ts
  lexicon: {
    ms: {
      aliases: ["ms", "millisecond"],
      symbol: "ms",
      display: { one: "millisecond", other: "milliseconds" },
    },
    s: {
      aliases: ["s", "sec", "second"],
      symbol: "s",
      display: { one: "second", other: "seconds" },
    },
    min: {
      aliases: ["min", "m", "minute"],
      symbol: "min",
      display: { one: "minute", other: "minutes" },
    },
    h: {
      aliases: ["h", "hr", "hour"],
      symbol: "h",
      display: { one: "hour", other: "hours" },
    },
    d: {
      aliases: ["d", "day"],
      symbol: "d",
      display: { one: "day", other: "days" },
    },
    wk: {
      aliases: ["wk", "week"],
      symbol: "wk",
      display: { one: "week", other: "weeks" },
    },
  },
```

- [ ] **Step 4: Add `display` to every length unit**

Replace the `lexicon` block in `packages/core/src/kinds/length.ts`:

```ts
  lexicon: {
    mm: {
      aliases: ["mm", "millimetre", "millimeter"],
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
    },
    cm: {
      aliases: ["cm", "centimetre", "centimeter"],
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
    },
    m: {
      aliases: ["m", "metre", "meter"],
      symbol: "m",
      display: { one: "metre", other: "metres" },
    },
    km: {
      aliases: ["km", "kilometre", "kilometer"],
      symbol: "km",
      display: { one: "kilometre", other: "kilometres" },
    },
    in: {
      aliases: ["inch"],
      symbol: "in",
      display: { one: "inch", other: "inches" },
    },
    ft: {
      aliases: ["ft", "foot", "feet"],
      symbol: "ft",
      display: { one: "foot", other: "feet" },
    },
    yd: {
      aliases: ["yd", "yard"],
      symbol: "yd",
      display: { one: "yard", other: "yards" },
    },
    mi: {
      aliases: ["mi", "mile"],
      symbol: "mi",
      display: { one: "mile", other: "miles" },
    },
  },
```

- [ ] **Step 5: Add `display` to every mass unit**

Replace the `lexicon` block in `packages/core/src/kinds/mass.ts`:

```ts
  lexicon: {
    mg: {
      aliases: ["mg", "milligram"],
      symbol: "mg",
      display: { one: "milligram", other: "milligrams" },
    },
    g: {
      aliases: ["g", "gram"],
      symbol: "g",
      display: { one: "gram", other: "grams" },
    },
    kg: {
      aliases: ["kg", "kilo", "kilogram"],
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
    },
    t: {
      aliases: ["t", "tonne"],
      symbol: "t",
      display: { one: "tonne", other: "tonnes" },
    },
    oz: {
      aliases: ["oz", "ounce"],
      symbol: "oz",
      display: { one: "ounce", other: "ounces" },
    },
    lb: {
      aliases: ["lb", "lbs", "pound"],
      symbol: "lb",
      display: { one: "pound", other: "pounds" },
    },
  },
```

- [ ] **Step 6: Run the new test to verify it passes**

```bash
bun test packages/core/src/engine.test.ts -t "word form"
```

Expected: PASS.

- [ ] **Step 7: Regenerate the corpus's `formatted` column**

Do **not** hand-edit the expected values — that is the exact failure mode the M1 plan's closing note describes. Print them:

```bash
cd packages/core && bun -e '
import { createEngine } from "./src/engine";
import { BUILTIN_KINDS } from "./src/kinds/index";
import en from "./src/locale/en";
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
const raw = await Bun.file("./corpus/en.tsv").text();
const out = raw.split("\n").map((line) => {
  if (line.trim().length === 0 || line.startsWith("#")) return line;
  const cols = line.split("\t");
  const input = cols[0];
  const r = engine.evaluate(input);
  return [input, r.kind, r.value.canonical.toString(), r.formatted].join("\t");
}).join("\n");
await Bun.write("./corpus/en.tsv", out);
console.log(out);
'
```

Read the printed table before continuing. Every row's `kind` and `canonical`
must be unchanged from before — only the fourth column may differ. If a `kind`
or `canonical` moved, stop: something other than rendering changed, and this
task is not the place to fix it.

- [ ] **Step 8: Run the corpus test**

```bash
bun test packages/core/src/corpus.test.ts
```

Expected: PASS, all rows.

- [ ] **Step 9: Fix the two stale assertions in `engine.test.ts`**

At `packages/core/src/engine.test.ts:182`, replace:

```ts
  const expected = engine.evaluate("2 km in m").formatted;
  expect(expected).toBe("2,000m");
```

with:

```ts
  const expected = engine.evaluate("2 km in m").formatted;
  expect(expected).toBe("2,000 metres");
```

Leave `:205` (`"2,597.152kb"`) alone. Its `datasize` fixture declares no
`lexicon`, so `toLexeme` gives it a fallback with no `display`, and it still
renders the symbol. Leave `:16` (`"1.5 kilograms"`) alone; `kg` already had
display forms.

- [ ] **Step 10: Run the whole suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass, no warnings.

- [ ] **Step 11: Update the three documentation lines**

`docs/guide/pipeline.md:144` — replace:

```
2 km in m     →  "2,000m"           // length:m declares only a symbol
```

with:

```
2 km in m     →  "2,000 metres"     // length:m declares display forms
```

`docs/guide/getting-started.md:85-86` — replace:

```
// [ { kind: "duration", formatted: "10min", confidence: 0.5 },
//   { kind: "length",   formatted: "10m",   confidence: 0.5 } ]
```

with:

```
// [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//   { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]
```

`docs/guide/getting-started.md:106` — replace:

```ts
engine.evaluate("10 m").formatted; // "10m"
```

with:

```ts
engine.evaluate("10 m").formatted; // "10 metres"
```

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/kinds/ packages/core/corpus/en.tsv \
        packages/core/src/engine.test.ts docs/guide/
git commit -m "feat(core): give every built-in unit a display form

formatValue already read lexeme.display; only kg ever had one, so kg printed
\"1.5 kilograms\" while g printed \"1,500g\". Populating display everywhere makes
output consistent and gives complete() the plural forms it renders from.

Corpus expectations were regenerated by running the engine, not hand-edited."
```

---

## Task 2: `typical` bands and `scaleFit`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/kinds/duration.ts`, `length.ts`, `mass.ts`
- Create: `packages/core/src/complete/score.ts`
- Create: `packages/core/src/complete/score.test.ts`

**Interfaces:**
- Consumes: `UnitLexeme` from `types.ts`.
- Produces:
  - `UnitLexeme.typical?: [number, number]`
  - `export const EXACT_BONUS = 10`
  - `export const LENGTH_PENALTY = 1`
  - `export const SCALE_BONUS = 3`
  - `export function prefixQuality(alias: string, fragment: string): number`
  - `export function scaleFit(count: Decimal | undefined, typical: [number, number] | undefined): number`

**Why:** These are the two scoring terms Task 4 adds on top of `resolveWeight()`. They are pure arithmetic with no registry dependency, so they get their own file and their own failing test before anything that consumes them exists.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/complete/score.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { EXACT_BONUS, LENGTH_PENALTY, SCALE_BONUS, prefixQuality, scaleFit } from "./score";

test("an exact alias earns the exact bonus", () => {
  expect(prefixQuality("mi", "mi")).toBe(EXACT_BONUS);
});

test("a longer alias is penalised once per untyped character", () => {
  expect(prefixQuality("mile", "mi")).toBe(-2 * LENGTH_PENALTY);
  expect(prefixQuality("millisecond", "mi")).toBe(-9 * LENGTH_PENALTY);
  expect(prefixQuality("hour", "ho")).toBe(-2 * LENGTH_PENALTY);
});

test("scaleFit pays the bonus inside the band and nothing outside it", () => {
  expect(scaleFit(new Decimal("30"), [1, 72])).toBe(SCALE_BONUS);
  expect(scaleFit(new Decimal("600"), [1, 180])).toBe(0);
});

test("the band is inclusive at both ends", () => {
  expect(scaleFit(new Decimal("1"), [1, 72])).toBe(SCALE_BONUS);
  expect(scaleFit(new Decimal("72"), [1, 72])).toBe(SCALE_BONUS);
});

test("scaleFit is never negative, with or without data", () => {
  expect(scaleFit(new Decimal("9999"), [1, 72])).toBe(0);
  expect(scaleFit(new Decimal("30"), undefined)).toBe(0);
  expect(scaleFit(undefined, [1, 72])).toBe(0);
  expect(scaleFit(undefined, undefined)).toBe(0);
});

test("scaleFit uses magnitude, so a negative count still lands in band", () => {
  expect(scaleFit(new Decimal("-30"), [1, 72])).toBe(SCALE_BONUS);
});

test("scaleFit compares as Decimal, not as float", () => {
  // 0.1 + 0.2 is 0.30000000000000004 in float; as Decimal it is exactly 0.3,
  // which must count as inside a band that ends at 0.3.
  const count = new Decimal("0.1").plus(new Decimal("0.2"));
  expect(scaleFit(count, [0.1, 0.3])).toBe(SCALE_BONUS);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test packages/core/src/complete/score.test.ts
```

Expected: FAIL, `Cannot find module './score'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/complete/score.ts`:

```ts
import { Decimal } from "../decimal";

/** An alias the user has finished typing. */
export const EXACT_BONUS = 10;
/** Charged once per character the user has not typed yet. */
export const LENGTH_PENALTY = 1;
/** The typed count falls inside the unit's declared `typical` band. */
export const SCALE_BONUS = 3;

export function prefixQuality(alias: string, fragment: string): number {
  if (alias === fragment) return EXACT_BONUS;
  return -(alias.length - fragment.length) * LENGTH_PENALTY;
}

/**
 * Never negative. A unit that declares a band is not punished for being out of
 * it relative to a unit that declares nothing — otherwise supplying data would
 * be a liability, and nobody would supply it.
 */
export function scaleFit(
  count: Decimal | undefined,
  typical: [number, number] | undefined,
): number {
  if (count === undefined || typical === undefined) return 0;
  const [lo, hi] = typical;
  // Magnitude, so "-30 min" is scored like "30 min".
  const n = count.abs();
  return n.gte(new Decimal(lo)) && n.lte(new Decimal(hi)) ? SCALE_BONUS : 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test packages/core/src/complete/score.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Add `typical` to `UnitLexeme`**

In `packages/core/src/types.ts`, replace the `UnitLexeme` interface:

```ts
export interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /**
   * The magnitude band people actually type this unit in, inclusive at both
   * ends. Read only by completion's `scaleFit`. Omitting it scores 0, which is
   * the same as being out of band — declaring a band is never a penalty.
   */
  typical?: [number, number];
}
```

- [ ] **Step 6: Write the failing test for the data**

Add to `packages/core/src/complete/score.test.ts`:

```ts
import { BUILTIN_KINDS } from "../kinds/index";
import { buildRegistry } from "../kind/registry";

test("every built-in unit declares a typical band", () => {
  const registry = buildRegistry(BUILTIN_KINDS);
  const missing: string[] = [];
  for (const [kindId, kind] of registry.kinds) {
    // `number`'s single unit has no aliases, so it can never be completed.
    if (kindId === "number") continue;
    for (const [unitName, unit] of kind.units) {
      if (unit.lexeme.typical === undefined) missing.push(`${kindId}:${unitName}`);
    }
  }
  expect(missing).toEqual([]);
});

test("every typical band runs low to high", () => {
  const registry = buildRegistry(BUILTIN_KINDS);
  const inverted: string[] = [];
  for (const [kindId, kind] of registry.kinds) {
    for (const [unitName, unit] of kind.units) {
      const band = unit.lexeme.typical;
      if (band !== undefined && band[0] >= band[1]) {
        inverted.push(`${kindId}:${unitName} [${band[0]}, ${band[1]}]`);
      }
    }
  }
  expect(inverted).toEqual([]);
});
```

- [ ] **Step 7: Run it to verify it fails**

```bash
bun test packages/core/src/complete/score.test.ts -t "typical band"
```

Expected: FAIL, `missing` lists all twenty units.

- [ ] **Step 8: Add `typical` to every duration unit**

Replace the whole `lexicon` block in `packages/core/src/kinds/duration.ts`
with the Task 1 version plus a `typical` band on each unit:

```ts
  lexicon: {
    ms: {
      aliases: ["ms", "millisecond"],
      symbol: "ms",
      display: { one: "millisecond", other: "milliseconds" },
      typical: [1, 5000],
    },
    s: {
      aliases: ["s", "sec", "second"],
      symbol: "s",
      display: { one: "second", other: "seconds" },
      typical: [1, 300],
    },
    min: {
      aliases: ["min", "m", "minute"],
      symbol: "min",
      display: { one: "minute", other: "minutes" },
      typical: [1, 180],
    },
    h: {
      aliases: ["h", "hr", "hour"],
      symbol: "h",
      display: { one: "hour", other: "hours" },
      typical: [1, 72],
    },
    d: {
      aliases: ["d", "day"],
      symbol: "d",
      display: { one: "day", other: "days" },
      typical: [1, 90],
    },
    wk: {
      aliases: ["wk", "week"],
      symbol: "wk",
      display: { one: "week", other: "weeks" },
      typical: [1, 52],
    },
  },
```

- [ ] **Step 9: Add `typical` to every length unit**

Replace the whole `lexicon` block in `packages/core/src/kinds/length.ts`:

```ts
  lexicon: {
    mm: {
      aliases: ["mm", "millimetre", "millimeter"],
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
      typical: [1, 1000],
    },
    cm: {
      aliases: ["cm", "centimetre", "centimeter"],
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
      typical: [1, 300],
    },
    m: {
      aliases: ["m", "metre", "meter"],
      symbol: "m",
      display: { one: "metre", other: "metres" },
      typical: [1, 1000],
    },
    km: {
      aliases: ["km", "kilometre", "kilometer"],
      symbol: "km",
      display: { one: "kilometre", other: "kilometres" },
      typical: [1, 1000],
    },
    in: {
      aliases: ["inch"],
      symbol: "in",
      display: { one: "inch", other: "inches" },
      typical: [1, 120],
    },
    ft: {
      aliases: ["ft", "foot", "feet"],
      symbol: "ft",
      display: { one: "foot", other: "feet" },
      typical: [1, 500],
    },
    yd: {
      aliases: ["yd", "yard"],
      symbol: "yd",
      display: { one: "yard", other: "yards" },
      typical: [1, 500],
    },
    mi: {
      aliases: ["mi", "mile"],
      symbol: "mi",
      display: { one: "mile", other: "miles" },
      typical: [0.1, 500],
    },
  },
```

- [ ] **Step 10: Add `typical` to every mass unit**

Replace the whole `lexicon` block in `packages/core/src/kinds/mass.ts`:

```ts
  lexicon: {
    mg: {
      aliases: ["mg", "milligram"],
      symbol: "mg",
      display: { one: "milligram", other: "milligrams" },
      typical: [1, 1000],
    },
    g: {
      aliases: ["g", "gram"],
      symbol: "g",
      display: { one: "gram", other: "grams" },
      typical: [1, 1000],
    },
    kg: {
      aliases: ["kg", "kilo", "kilogram"],
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
      typical: [0.1, 500],
    },
    t: {
      aliases: ["t", "tonne"],
      symbol: "t",
      display: { one: "tonne", other: "tonnes" },
      typical: [0.1, 100],
    },
    oz: {
      aliases: ["oz", "ounce"],
      symbol: "oz",
      display: { one: "ounce", other: "ounces" },
      typical: [1, 64],
    },
    lb: {
      aliases: ["lb", "lbs", "pound"],
      symbol: "lb",
      display: { one: "pound", other: "pounds" },
      typical: [1, 500],
    },
  },
```

- [ ] **Step 11: Run the tests to verify they pass**

```bash
bun test packages/core/src/complete/score.test.ts
bun test && bun run typecheck && bun run lint
```

Expected: all pass. Nothing outside completion reads `typical`, so no existing
test should move.

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/kinds/ packages/core/src/complete/
git commit -m "feat(core): add typical bands and the completion scoring terms

typical is read only by scaleFit and never penalises a unit for declaring it,
so supplying the data is never a liability. prefixQuality and scaleFit are pure
arithmetic over three exported constants, testable without a registry."
```

---

## Task 3: Trailing-fragment and leading-count extraction

**Files:**
- Create: `packages/core/src/complete/fragment.ts`
- Create: `packages/core/src/complete/fragment.test.ts`

**Interfaces:**
- Consumes: `Span` from `../types`, `parseNumber` from `../locale/number`, `Locale` from `../types`.
- Produces:
  - `export interface Fragment { text: string; span: Span }`
  - `export function trailingFragment(input: string): Fragment | null`
  - `export function leadingCount(input: string, upto: number, locale: Locale): Decimal | null`

**Why:** This is the whole reason `complete()` needs no parser. Both functions are pure string work over the raw input, and both have edge cases worth failing on their own rather than inside a larger function.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/complete/fragment.test.ts`:

```ts
import { expect, test } from "bun:test";
import { defineLocale } from "../locale/define";
import { leadingCount, trailingFragment } from "./fragment";

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });

test("extracts the trailing word fragment with its span", () => {
  expect(trailingFragment("30 ho")).toEqual({ text: "ho", span: { start: 3, end: 5 } });
  expect(trailingFragment("10 kg + 5 gr")).toEqual({
    text: "gr",
    span: { start: 10, end: 12 },
  });
  expect(trailingFragment("ho")).toEqual({ text: "ho", span: { start: 0, end: 2 } });
});

test("a fragment may contain digits after its first letter", () => {
  // M2 ships m2, cm2 and km2. A letters-only rule would return null here and
  // silently make every area unit uncompletable.
  expect(trailingFragment("10 m2")).toEqual({ text: "m2", span: { start: 3, end: 5 } });
});

test("a fragment must begin with a letter", () => {
  expect(trailingFragment("30")).toBeNull();
  expect(trailingFragment("10.5")).toBeNull();
  expect(trailingFragment("")).toBeNull();
});

test("no fragment when the input does not end in one", () => {
  expect(trailingFragment("10 kg + ")).toBeNull();
  expect(trailingFragment("10 kg +")).toBeNull();
  expect(trailingFragment("(1 + 2)")).toBeNull();
});

test("a fragment attached to its number still splits correctly", () => {
  expect(trailingFragment("2km")).toEqual({ text: "km", span: { start: 1, end: 3 } });
});

test("reads the count that precedes the fragment", () => {
  expect(leadingCount("30 ho", 3, en)?.toString()).toBe("30");
  expect(leadingCount("1.5 ho", 4, en)?.toString()).toBe("1.5");
  expect(leadingCount("1,500 ho", 6, en)?.toString()).toBe("1500");
  expect(leadingCount("2km", 1, en)?.toString()).toBe("2");
});

test("reads the nearest count in an expression, not the first", () => {
  expect(leadingCount("10 kg + 5 gr", 10, en)?.toString()).toBe("5");
});

test("a minus separated by a space is an operator, not a sign", () => {
  // "10 kg - 5 mil": the run before the fragment is " - 5 ". Parsing that whole
  // run yields null, so the last whitespace-delimited token wins.
  expect(leadingCount("10 kg - 5 mil", 10, en)?.toString()).toBe("5");
});

test("a minus attached to its digits is a sign", () => {
  expect(leadingCount("-5 km", 3, en)?.toString()).toBe("-5");
});

test("returns null when there is no count", () => {
  expect(leadingCount("ho", 0, en)).toBeNull();
  expect(leadingCount("kg + gr", 5, en)).toBeNull();
});

test("honours a locale whose group separator is a space", () => {
  const fr = defineLocale({
    id: "fr",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  expect(leadingCount("1 500,5 ho", 8, fr)?.toString()).toBe("1500.5");
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test packages/core/src/complete/fragment.test.ts
```

Expected: FAIL, `Cannot find module './fragment'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/complete/fragment.ts`:

```ts
import type { Decimal } from "../decimal";
import { parseNumber } from "../locale/number";
import type { Locale, Span } from "../types";

export interface Fragment {
  text: string;
  span: Span;
}

/**
 * Must begin with a letter, may continue with letters or digits. The leading
 * letter is what keeps a bare "30" from reading as a fragment; allowing digits
 * after it is what keeps M2's `m2`, `cm2` and `km2` completable.
 */
const FRAGMENT = /[\p{L}][\p{L}\p{N}]*$/u;

/**
 * A run that could hold a number: digits, sign, decimal and group separators.
 * \u00A0 and \u202F are written as escapes deliberately - French ICU uses
 * U+202F as its group separator, and a literal would be invisible in source.
 */
const COUNT_RUN = /[-\d.,\u00A0\u202F ]+$/;

export function trailingFragment(input: string): Fragment | null {
  const match = FRAGMENT.exec(input);
  if (match === null) return null;
  return {
    text: match[0],
    span: { start: match.index, end: match.index + match[0].length },
  };
}

export function leadingCount(
  input: string,
  upto: number,
  locale: Locale,
): Decimal | null {
  const match = COUNT_RUN.exec(input.slice(0, upto));
  if (match === null) return null;
  const run = match[0].trim();

  // Try the whole run first: a locale whose group separator is a space needs
  // "1 500,5" kept intact. Fall back to the last whitespace-delimited token,
  // which is what strips a binary operator's minus in "10 kg - 5 mil".
  const whole = parseNumber(run, locale);
  if (whole !== null) return whole;

  const last = run.split(/\s+/).pop();
  return last === undefined ? null : parseNumber(last, locale);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test packages/core/src/complete/fragment.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass. Nothing imports these yet.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/complete/fragment.ts packages/core/src/complete/fragment.test.ts
git commit -m "feat(core): extract the trailing fragment and its leading count

The fragment must start with a letter so a bare number is not a fragment, and
may continue with digits so M2's m2/cm2/km2 stay completable. Spans address the
raw input, never normalize()'s output, so a caller can splice into the exact
string the user typed."
```

---

## Task 4: `complete()`

**Files:**
- Create: `packages/core/src/complete/complete.ts`
- Create: `packages/core/src/complete/complete.test.ts`

**Interfaces:**
- Consumes: `trailingFragment`, `leadingCount` (Task 3); `prefixQuality`, `scaleFit` (Task 2); `resolveWeight` from `../solve/weights`; `Registry` from `../kind/registry`.
- Produces:
  - `export interface Completion { alias: string; span: Span; text: string; kind: KindId; unit: string; score: number }`
  - `export interface CompleteOptions { kinds?: KindId[]; weights?: Weights; limit?: number }`
  - `export function complete(args: { registry: Registry; locale: Locale; layers: (Weights | undefined)[]; input: string; opts?: CompleteOptions }): Completion[]`

**Why:** The whole feature. Pure — it takes a registry and a locale rather than an engine, so it is testable without `createEngine` and pays no per-keystroke construction cost.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/complete/complete.test.ts`:

```ts
import { expect, test } from "bun:test";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import en from "../locale/en";
import type { Weights } from "../types";
import { complete } from "./complete";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const run = (input: string, opts?: Parameters<typeof complete>[0]["opts"], layers: (Weights | undefined)[] = [en.weights]) =>
  complete({ registry, locale: en, layers, input, opts });

test("completes a partial unit into its plural word form", () => {
  const [top] = run("30 ho");
  expect(top?.text).toBe("30 hours");
  expect(top?.kind).toBe("duration");
  expect(top?.unit).toBe("h");
});

test("uses the singular when the count selects it", () => {
  expect(run("1 ho")[0]?.text).toBe("1 hour");
});

test("renders the singular when there is no count at all", () => {
  expect(run("ho")[0]?.text).toBe("hour");
});

test("ranks mile above the milli- units for a longer prefix", () => {
  const rows = run("10 mil");
  expect(rows.map((r) => `${r.kind}:${r.unit}`)).toEqual([
    "length:mi",
    "length:mm",
    "duration:ms",
  ]);
  expect(rows[0]?.text).toBe("10 miles");
});

test("offers one row per unit, ranked, for an ambiguous prefix", () => {
  const rows = run("1 mi");
  expect(rows.map((r) => `${r.kind}:${r.unit}`)).toEqual([
    "length:mi",
    "duration:min",
    "length:mm",
    "duration:ms",
  ]);
  expect(rows.map((r) => r.text)).toEqual([
    "1 mile",
    "1 minute",
    "1 millimetre",
    "1 millisecond",
  ]);
});

test("an exact alias outranks a scale-fitting completion", () => {
  // 600 is outside mi's band and inside ms's, but "mi" is exact and
  // EXACT_BONUS (10) is larger than SCALE_BONUS (3). Documented in the spec.
  expect(run("600 mi")[0]?.unit).toBe("mi");
});

test("the span addresses the raw input and text splices around it", () => {
  const [top] = run("10 kg + 5 gr");
  expect(top?.span).toEqual({ start: 10, end: 12 });
  expect(top?.text).toBe("10 kg + 5 grams");
});

test("returns an empty array rather than throwing", () => {
  expect(run("")).toEqual([]);
  expect(run("30")).toEqual([]);
  expect(run("10 kg + ")).toEqual([]);
  expect(run("10 zzz")).toEqual([]);
});

test("opts.kinds filters candidates by kind", () => {
  const rows = run("1 mi", { kinds: ["duration"] });
  expect(rows.every((r) => r.kind === "duration")).toBe(true);
  expect(rows.map((r) => r.unit)).toEqual(["min", "ms"]);
});

test("weight layers reorder the results", () => {
  const boosted = run("1 mi", undefined, [en.weights, { duration: 20 }]);
  expect(boosted[0]?.kind).toBe("duration");
});

test("a per-call weight layer applies", () => {
  const boosted = run("1 mi", { weights: { "duration:min": 20 } }, [
    en.weights,
    undefined,
  ]);
  expect(boosted[0]?.unit).toBe("min");
});

test("limit defaults to 10 and is applied after ranking", () => {
  const all = run("m");
  expect(all.length).toBeLessThanOrEqual(10);
  const three = run("m", { limit: 3 });
  expect(three).toEqual(all.slice(0, 3));
});

test("results are deterministic across runs", () => {
  expect(JSON.stringify(run("1 mi"))).toBe(JSON.stringify(run("1 mi")));
});

test("matching is case-insensitive", () => {
  expect(run("30 HO")[0]?.unit).toBe("h");
  expect(run("30 Ho")[0]?.text).toBe("30 hours");
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test packages/core/src/complete/complete.test.ts
```

Expected: FAIL, `Cannot find module './complete'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/complete/complete.ts`:

```ts
import type { Registry } from "../kind/registry";
import { resolveWeight } from "../solve/weights";
import type { KindId, Locale, Span, Weights } from "../types";
import { leadingCount, trailingFragment } from "./fragment";
import { prefixQuality, scaleFit } from "./score";

export interface Completion {
  /** The alias that matched, e.g. "hour". */
  alias: string;
  /** The fragment this replaces, as offsets into the original input. */
  span: Span;
  /** The whole input rewritten, ready to put back in the box. */
  text: string;
  kind: KindId;
  /** Registry unit key, e.g. "h". */
  unit: string;
  score: number;
}

export interface CompleteOptions {
  /** Hard filter, identical in meaning to EvalOptions.kinds. */
  kinds?: KindId[];
  /** Per-call weight layer 4, identical to EvalOptions.weights. */
  weights?: Weights;
  /** Applied after ranking. Default 10. */
  limit?: number;
}

const DEFAULT_LIMIT = 10;

export function complete(args: {
  registry: Registry;
  locale: Locale;
  layers: (Weights | undefined)[];
  input: string;
  opts?: CompleteOptions;
}): Completion[] {
  const { registry, locale, layers, input, opts } = args;

  const fragment = trailingFragment(input);
  if (fragment === null) return [];

  const folded = fragment.text.normalize("NFKC").toLocaleLowerCase(locale.id);
  const count = leadingCount(input, fragment.span.start, locale) ?? undefined;
  const category = new Intl.PluralRules(locale.id).select(
    count === undefined ? 1 : count.toNumber(),
  );

  // Best row per (kind, unit): "mi" and "mile" are the same unit, and offering
  // both would fill the list with near-duplicates. Mirrors resolve().
  const best = new Map<string, Completion>();

  for (const [alias, entries] of registry.aliasIndex) {
    if (!alias.startsWith(folded)) continue;

    for (const entry of entries) {
      if (opts?.kinds !== undefined && !opts.kinds.includes(entry.kind)) continue;

      const kind = registry.kinds.get(entry.kind);
      if (kind === undefined) continue;
      const unit = kind.units.get(entry.unit);
      if (unit === undefined) continue;

      const score =
        resolveWeight({
          kind: entry.kind,
          unit: entry.unit,
          surface: alias,
          prior: kind.prior,
          layers,
        }) +
        prefixQuality(alias, folded) +
        scaleFit(count, unit.lexeme.typical);

      const word = unit.lexeme.display?.[category] ?? alias;
      const key = `${entry.kind}:${entry.unit}`;
      const existing = best.get(key);

      // Strictly greater, and alias ascending on a tie, so two aliases of equal
      // length (millimetre / millimeter) resolve the same way on every run.
      if (
        existing === undefined ||
        score > existing.score ||
        (score === existing.score && alias < existing.alias)
      ) {
        best.set(key, {
          alias,
          span: fragment.span,
          text:
            input.slice(0, fragment.span.start) +
            word +
            input.slice(fragment.span.end),
          kind: entry.kind,
          unit: entry.unit,
          score,
        });
      }
    }
  }

  return [...best.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.kind.localeCompare(b.kind) ||
        a.unit.localeCompare(b.unit) ||
        a.alias.localeCompare(b.alias),
    )
    .slice(0, opts?.limit ?? DEFAULT_LIMIT);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test packages/core/src/complete/complete.test.ts
```

Expected: PASS, 14 tests.

If the `"1 mi"` ordering assertion fails, print the actual scores before
changing any constant — the expected values come from the spec's worked table
and a mismatch means the data in Task 2 differs from what the spec assumed:

```bash
cd packages/core && bun -e '
import { buildRegistry } from "./src/kind/registry";
import { BUILTIN_KINDS } from "./src/kinds/index";
import en from "./src/locale/en";
import { complete } from "./src/complete/complete";
const registry = buildRegistry(BUILTIN_KINDS, [], "en");
console.table(complete({ registry, locale: en, layers: [en.weights], input: "1 mi" }));
'
```

- [ ] **Step 5: Run the whole suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/complete/complete.ts packages/core/src/complete/complete.test.ts
git commit -m "feat(core): add complete() for trailing-token unit completion

Prefix-scans aliasIndex, scores with resolveWeight plus prefixQuality and
scaleFit, renders the plural form the leading count selects, and splices the
result into the raw input. Deduplicated by (kind, unit) and totally ordered, so
the same input yields a byte-identical array on every run."
```

---

## Task 5: `Engine.complete()` and public exports

**Files:**
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/engine.test.ts`

**Interfaces:**
- Consumes: `complete`, `Completion`, `CompleteOptions` (Task 4).
- Produces: `Engine.complete(input: string, opts?: CompleteOptions): Completion[]`, plus `Completion`, `CompleteOptions`, `EXACT_BONUS`, `LENGTH_PENALTY` and `SCALE_BONUS` on the package's public surface.

**Why:** `complete()` needs the registry, locale and weight layers that `createEngine` already closes over. Wiring it as a method means a caller never assembles those by hand.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/engine.test.ts`:

```ts
test("engine.complete completes a partial unit", () => {
  const rows = engine.complete("30 ho");
  expect(rows[0]?.text).toBe("30 hours");
  expect(rows[0]?.kind).toBe("duration");
});

test("engine.complete honours engine-level weights", () => {
  const biased = createEngine({
    locales: [en],
    kinds: BUILTIN_KINDS,
    weights: { duration: 20 },
  });
  expect(biased.complete("1 mi")[0]?.kind).toBe("duration");
});

test("engine.complete never throws on half-typed input", () => {
  for (const input of ["", " ", "10 kg +", "(((", "10 zzz", "30"]) {
    expect(Array.isArray(engine.complete(input))).toBe(true);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test packages/core/src/engine.test.ts -t "engine.complete"
```

Expected: FAIL, `engine.complete is not a function`.

- [ ] **Step 3: Wire the method**

In `packages/core/src/engine.ts`, add to the imports:

```ts
import { type CompleteOptions, type Completion, complete } from "./complete/complete";
```

Add to the `Engine` interface, after `explain`:

```ts
  complete(input: string, opts?: CompleteOptions): Completion[];
```

Add to the returned object in `createEngine`, after `explain`:

```ts
    complete(input, call) {
      return complete({
        registry,
        locale: locale as Locale,
        layers: layersFor(call?.weights),
        input,
        ...(call ? { opts: call } : {}),
      });
    },
```

`layersFor` and `registry` are already in scope from `createEngine`'s body; no
other change to that function is needed.

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test packages/core/src/engine.test.ts -t "engine.complete"
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Export the new surface**

In `packages/core/src/index.ts`, add:

```ts
export type { Completion, CompleteOptions } from "./complete/complete";
export { complete } from "./complete/complete";
export { EXACT_BONUS, LENGTH_PENALTY, SCALE_BONUS } from "./complete/score";
```

and extend the existing engine type export to carry the option type through:

```ts
export type {
  Engine,
  EngineOptions,
  EvalOptions,
  Explanation,
  Result,
} from "./engine";
```

- [ ] **Step 6: Run the whole suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/index.ts packages/core/src/engine.test.ts
git commit -m "feat(core): expose complete() as an engine method

createEngine already closes over the registry, locale and weight layers that
complete() needs, so the method forwards them and a caller never assembles them
by hand. Constants are exported so integrators can reason about the scores."
```

---

## Task 6: Round-trip property and the completion corpus

**Files:**
- Create: `packages/core/corpus/en-complete.tsv`
- Create: `packages/core/src/complete/roundtrip.test.ts`
- Modify: `docs/guide/roadmap.md`

**Interfaces:**
- Consumes: `Engine.complete` (Task 5), `Engine.evaluate`.
- Produces: nothing consumed by later tasks. This is the task that protects the design.

**Why:** `complete()` hands the user text they will then evaluate. Every `display` form must therefore be something the parser accepts. `"hours"` only parses because `suffixStripper` strips the `s` at −2, and `"feet"` only because `tableAnalyzer` maps it to `foot` — nothing enforces either. A `display.other` of `"hrs"` would produce a completion that silently fails to evaluate.

- [ ] **Step 1: Write the corpus**

Create `packages/core/corpus/en-complete.tsv`. Columns are
`input`, `kind`, `unit`, `text` — the expected **top** completion.

```
# input	kind	unit	text
30 ho	duration	h	30 hours
1 ho	duration	h	1 hour
10 mil	length	mi	10 miles
1 mi	length	mi	1 mile
600 mi	length	mi	600 miles
5 kilog	mass	kg	5 kilograms
1 kilog	mass	kg	1 kilogram
12 inc	length	in	12 inches
1 inc	length	in	1 inch
6 fo	length	ft	6 feet
1 fo	length	ft	1 foot
3 poun	mass	lb	3 pounds
2 ton	mass	t	2 tonnes
45 sec	duration	s	45 seconds
2 wee	duration	wk	2 weeks
10 kg + 5 gr	mass	g	10 kg + 5 grams
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/complete/roundtrip.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { BUILTIN_KINDS } from "../kinds/index";
import en from "../locale/en";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

const raw = await Bun.file(new URL("../../corpus/en-complete.tsv", import.meta.url)).text();
const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the completion corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, kind, unit, text] of rows) {
  test(`completion corpus: ${input}`, () => {
    const top = engine.complete(input as string)[0];
    expect(`${input} -> ${top?.kind}:${top?.unit} ${top?.text}`).toBe(
      `${input} -> ${kind}:${unit} ${text}`,
    );
  });
}

// The property that protects every display form. A display form the parser
// cannot read turns a completion into a dead end, and nothing else checks it.
test("every completion of a single quantity evaluates back to its own kind", () => {
  const fragments = [
    "ho", "hou", "min", "minu", "sec", "da", "wee",
    "mil", "mi", "met", "kilom", "inc", "fo", "yar", "cent",
    "kilog", "gra", "poun", "oun", "ton", "millig",
  ];
  const counts = ["1", "2", "30", "0.5"];

  for (const count of counts) {
    for (const fragment of fragments) {
      for (const c of engine.complete(`${count} ${fragment}`)) {
        const result = engine.evaluate(c.text, { kinds: [c.kind] });
        expect(`${c.text} -> ${result.kind}`).toBe(`${c.text} -> ${c.kind}`);
      }
    }
  }
});

// Weaker claim for expressions, because completing only the trailing token is
// context-blind: "10 kg + 5 mil" -> "10 kg + 5 miles" is a legal completion and
// a DimensionMismatchError. Lexing is the most that can be asserted.
test("every completion inside an expression at least lexes", () => {
  for (const input of ["10 kg + 5 gr", "2 km in mil", "10 m + 5 ho", "3 lb - 1 oun"]) {
    for (const c of engine.complete(input)) {
      expect(() => lex(normalize(c.text), en)).not.toThrow();
    }
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
bun test packages/core/src/complete/roundtrip.test.ts
```

Expected: FAIL, `Cannot find module '../../corpus/en-complete.tsv'` if Step 1
was skipped, otherwise row mismatches.

- [ ] **Step 4: Reconcile the corpus against reality**

The corpus in Step 1 was written from the spec's worked examples, so treat any
mismatch as a real finding, not a fixture to bend. Print what the engine
actually produces and compare row by row:

```bash
cd packages/core && bun -e '
import { createEngine } from "./src/engine";
import { BUILTIN_KINDS } from "./src/kinds/index";
import en from "./src/locale/en";
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
const raw = await Bun.file("./corpus/en-complete.tsv").text();
for (const line of raw.split("\n")) {
  if (line.trim().length === 0 || line.startsWith("#")) continue;
  const [input] = line.split("\t");
  const t = engine.complete(input)[0];
  console.log([input, t?.kind, t?.unit, t?.text].join("\t"));
}
'
```

If a row differs, decide which is wrong before editing anything. A wrong
`text` means a `display` form is missing or misspelled in Task 1. A wrong
`kind`/`unit` means the scoring data in Task 2 disagrees with the spec.
Fix the source, not the expectation.

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun test packages/core/src/complete/roundtrip.test.ts
```

Expected: PASS. If the round-trip property fails for a specific unit, that unit's
`display` form is unparseable — fix the form, or add the alias that makes it
parse. Do not weaken the assertion.

- [ ] **Step 6: Add the roadmap row**

In `docs/guide/roadmap.md`, insert after the **M2** row:

```markdown
| **M2.5** | `Engine.complete()`, prefix completion, `typical` bands, `display` on every unit, consistent word-form output. | **Shipped** |
```

- [ ] **Step 7: Run the whole suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/corpus/en-complete.tsv \
        packages/core/src/complete/roundtrip.test.ts docs/guide/roadmap.md
git commit -m "test(core): pin completions and prove every display form parses

A display form the parser cannot read turns a completion into a dead end, and
nothing else in the suite checks it. The round-trip property asserts kind
equality for single quantities; expressions get the weaker lexes-cleanly claim,
because completing only the trailing token is context-blind by design."
```

---

## Self-Review

**Spec coverage.** Every section of the completion spec maps to a task:

| Spec section | Task |
| --- | --- |
| §2 public API, `Completion`, `CompleteOptions` | 4 (types), 5 (export) |
| §2 `UnitLexeme.typical` | 2 |
| §2 never throws | 4 step 1, 5 step 1 |
| §2 dedupe by `(kind, unit)` | 4 |
| §3 steps 1–2, fragment and count | 3 |
| §3 steps 3–6, match / score / render / order | 4 |
| §4 constants and worked examples | 2 (constants), 4 (examples as tests), 6 (corpus) |
| §5 `display` data and corpus rewrite | 1 |
| §5 `typical` data | 2 |
| §5 every display form must parse | 6 |
| §6 module structure | file table, Tasks 2–4 |
| §7 all twelve test cases | 2, 3, 4, 6 |
| §8 sequencing behind M2 | Sequencing Precondition |
| §8 roadmap row | 6 step 6 |

**Deviation from the spec's commit plan.** §8 lists three commits; this plan has six. The extra three split the pure helpers (`score.ts`, `fragment.ts`) and the round-trip corpus into their own review gates, because each can fail independently of `complete()` itself. The ordering and content are unchanged.

**Type consistency.** `Completion` and `CompleteOptions` are declared once, in Task 4's `complete.ts`, and re-exported in Task 5. `scaleFit` takes `Decimal | undefined` in Task 2 and receives `count` — a `Decimal | undefined` produced by `leadingCount(...) ?? undefined` — in Task 4. `prefixQuality(alias, folded)` is called with the folded alias and the folded fragment in both. `trailingFragment` returns `Fragment | null` and Task 4 null-checks it.

**One known fixture hazard, called out rather than papered over.** `mm` has two equal-length aliases, `millimetre` and `millimeter`. They score identically, so Task 4's tie-break picks `millimeter` alphabetically for the `alias` field while `text` renders `millimetre` from `display.one`. Task 4's tests therefore assert on `kind`, `unit` and `text`, never on `alias`, for that unit. Do not "fix" this by asserting the alias.
