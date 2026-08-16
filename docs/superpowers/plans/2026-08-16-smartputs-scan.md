# Scan Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `engine.scan(text)`, a sixth entry point that finds the quantities inside free-form prose, marks each with caller-relative character offsets, and lets nearby "cue" words bias which kind each mark resolves to.

**Architecture:** Scan adds no parser, lexer or scoring model. It normalizes and tokenizes the prose **once**, walks the token stream for anchors (`number` and `literal` tokens), and for each anchor hands progressively shorter **slices** of that same stream to the `Parser` the engine already holds — `pratt.ts` already throws when a parse does not consume its whole token list, which is exactly the signal a longest-match backoff needs. Cue words near a mark are folded into a per-kind weight that enters scoring as one new term on `Resolution`, beside the existing `contextBonus` and `signatureWeight`.

**Tech Stack:** TypeScript (ESM only), Bun (`bun test`), Biome, `decimal.js`. Monorepo of workspace packages under `packages/*`.

**Spec:** `docs/superpowers/specs/2026-08-16-smartputs-scan-design.md` — read it first; every task below cites the section it implements.

## Global Constraints

- **`@smartput/core` ships exactly one runtime dependency, `decimal.js`.** `bun run check-deps` fails the repo on a second. Add no dependency in any task.
- **ESM only.** No `require`, no CommonJS interop.
- **Cue weights are single digits**, authored 1–4. `CUE_CEILING = 4` clamps the summed weight per kind per mark (spec §4).
- **Every span that reaches a caller is caller-relative.** Token and node spans are relative to the *normalized* string; they must pass through `normalized.mapSpan(span)` before landing on a `Mark` or a `CueHit`. This is the single most likely defect in this plan.
- **Determinism.** Registry index construction iterates sorted kind ids then sorted locale ids, matching `aliasIndex`. Two runs must produce identical entry lists.
- **`bun run check` must pass** before the final commit: `lint`, `typecheck`, `check-deps`, `test`, `build`, `check-size`.
- **Do not touch `scripts/check-size.ts`, `packages/kind/src/decimal.ts`, `packages/kind/src/freeze.ts`, `packages/kind/src/brand.ts`** except where Task 9 explicitly says so — they carry uncommitted work from another branch.
- **Branch:** create `scan-mode` off the current `locales-tier-1-3` before Task 1.

---

### Task 1: `Vocabulary.cues` and `Registry.cueIndex`

Spec §3, §3.1. A cue word is declared beside the kind that owns it, and the registry folds every installed vocabulary's cues into one index at boot.

**Files:**
- Modify: `packages/kind/src/types.ts` (the `Vocabulary` interface, ~line 695)
- Modify: `packages/core/src/kind/registry.ts` (`Registry`, `buildRegistry` passes 3 and 5)
- Test: `packages/core/src/kind/registry.test.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CueEntry { kind: KindId; weight: number; locale: string }` exported from `packages/core/src/kind/registry.ts`; `Registry.cueIndex: Map<string, CueEntry[]>`; `Vocabulary.cues?: Readonly<Record<string, number>>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/kind/registry.test.ts`:

```ts
test("cueIndex folds every installed vocabulary's cues", () => {
  const massCued = defineVocabulary({
    locale: "en",
    kind: "mass",
    units: { kg: { aliases: ["kg"], symbol: "kg" } },
    cues: { Weighs: 4, heavy: 3 },
  });
  const registry = buildRegistry([mass, number], [composeLocale(englishStub, [massCued])]);
  // Keys are folded, so the authored capital survives only as the entry's own word.
  expect(registry.cueIndex.get("weighs")).toEqual([
    { kind: "mass", weight: 4, locale: "en" },
  ]);
  expect(registry.cueIndex.get("Weighs")).toBeUndefined();
  expect(registry.cueIndex.get("heavy")).toEqual([
    { kind: "mass", weight: 3, locale: "en" },
  ]);
});

test("two kinds claiming one cue word is not a conflict", () => {
  // `buildKeywords` refuses a two-language disagreement on one surface. A cue
  // is a vote rather than a definition, so both entries are kept and the
  // solver weighs them — spec §3.1.
  const registry = buildRegistry(
    [mass, number],
    [
      composeLocale(englishStub, [
        defineVocabulary({
          locale: "en",
          kind: "mass",
          units: { kg: { aliases: ["kg"], symbol: "kg" } },
          cues: { about: 2 },
        }),
        defineVocabulary({
          locale: "en",
          kind: "number",
          units: { one: { aliases: ["ones"] } },
          cues: { about: 1 },
        }),
      ]),
    ],
  );
  // Sorted by kind id, so the list is identical on every run.
  expect(registry.cueIndex.get("about")).toEqual([
    { kind: "mass", weight: 2, locale: "en" },
    { kind: "number", weight: 1, locale: "en" },
  ]);
});

test("a vocabulary with no cues contributes no entries", () => {
  const registry = buildRegistry([mass, number], [composeLocale(englishStub, [massEn])]);
  expect(registry.cueIndex.size).toBe(0);
});

test("a zero-weight cue is skipped rather than indexed as a no-op", () => {
  const registry = buildRegistry(
    [mass, number],
    [
      composeLocale(englishStub, [
        defineVocabulary({
          locale: "en",
          kind: "mass",
          units: { kg: { aliases: ["kg"], symbol: "kg" } },
          cues: { heavy: 3, maybe: 0 },
        }),
      ]),
    ],
  );
  expect(registry.cueIndex.get("maybe")).toBeUndefined();
  expect(registry.cueIndex.get("heavy")).toBeDefined();
});
```

Add this helper near the top of the file, beside the existing `mass`/`massEn` fixtures, so the four tests above share one language:

```ts
const englishStub = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: {},
  selectForm: () => "other",
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: FAIL — `cues` is not a known property of `Vocabulary` (typecheck), and `registry.cueIndex` is `undefined`.

- [ ] **Step 3: Add `cues` to `Vocabulary`**

In `packages/kind/src/types.ts`, inside `interface Vocabulary`, after `units`:

```ts
  /**
   * Words that, standing NEAR a quantity, argue it is this kind — read only by
   * `scan`. Positive argues for; negative argues against.
   *
   * The kind and the language are the vocabulary's own, so a cue needs only a
   * word and a weight. This is the whole authoring surface: a kind package
   * already ships `src/locale/<id>.ts`, and cues are another key in the object
   * that is already there.
   *
   * Single digits, typically 1–4, and `CUE_CEILING` clamps the sum per kind per
   * mark. The scale is small on purpose: the solver's softmax turns a score
   * difference into odds, so a cue of 25 would report the losing reading at
   * 1e-11 and claim a certainty no adjacent preposition has earned. A cue ranks
   * readings; it never admits or refuses one.
   */
  readonly cues?: Readonly<Record<string, number>>;
```

- [ ] **Step 4: Add `CueEntry` and `cueIndex` to the registry**

In `packages/core/src/kind/registry.ts`, after the `AliasEntry` interface:

```ts
/**
 * One kind's claim on one cue word. Unlike `AliasEntry`, several may share a
 * surface: `in` is evidence for `duration` and, once `@smartput/datetime` is
 * installed, for `datetime` too. `buildKeywords` treats such a clash as a boot
 * error because a keyword is a definition; a cue is a vote, so both are kept.
 */
export interface CueEntry {
  readonly kind: KindId;
  readonly weight: number;
  /** The language that listed the word, recorded for `AliasEntry`'s reason. */
  readonly locale: string;
}
```

In `interface Registry`, after `aliasIndex`:

```ts
  /** Case-folded cue word -> every kind that claims it. Read only by `scan`. */
  cueIndex: Map<string, CueEntry[]>;
```

- [ ] **Step 5: Collect cue tables in pass 3**

In `buildRegistry`, beside the `words` map (~line 119):

```ts
  /** `${locale}|${kind}` -> that vocabulary's cue table. */
  const cueTables = new Map<string, Record<string, number>>();
```

and inside `install`, after the `spokenKinds.add(...)` line:

```ts
    if (vocab.cues !== undefined) {
      const key = `${vocab.locale}|${vocab.kind}`;
      // Merged rather than overwritten, for the reason `mergeWords` is: a
      // collision here means one language was assembled from two `Locale`
      // objects, and the later half is a patch, not a replacement.
      cueTables.set(key, { ...cueTables.get(key), ...vocab.cues });
    }
```

- [ ] **Step 6: Build the index, after pass 5**

In `buildRegistry`, immediately after the alias-index loop closes and before pass 6:

```ts
  // Pass 5b: cue index, ordered by the rule pass 5 uses — kind ids sorted, then
  // locales sorted, then words sorted — so one surface's entry list is byte-for
  // -byte identical on every run and in every process.
  //
  // A zero weight is skipped rather than recorded: it would be an entry that
  // changes no score, and `scan` would still pay to look it up and would still
  // report it as a `CueHit` the user could see no effect from.
  const cueIndex = new Map<string, CueEntry[]>();
  for (const kindId of kindIds) {
    for (const localeId of readIds) {
      const table = cueTables.get(`${localeId}|${kindId}`);
      if (table === undefined) continue;
      for (const word of Object.keys(table).sort()) {
        const weight = table[word];
        if (weight === undefined || weight === 0) continue;
        const fold = word.toLocaleLowerCase(localeId);
        const list = cueIndex.get(fold) ?? [];
        if (!list.some((e) => e.kind === kindId && e.locale === localeId)) {
          list.push({ kind: kindId, weight, locale: localeId });
        }
        cueIndex.set(fold, list);
      }
    }
  }
```

and add it to the return statement:

```ts
  return { kinds: normalized, ops, aliasIndex, cueIndex, literals, words };
```

- [ ] **Step 7: Export `CueEntry` from the package door**

In `packages/core/src/index.ts`, change the registry export line to:

```ts
export type { AliasEntry, CueEntry, Registry } from "./kind/registry";
```

and in `packages/core/src/registry.ts` add `CueEntry` to the same `export type` list it already re-exports `AliasEntry` and `Registry` from.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun test packages/core/src/kind/registry.test.ts`
Expected: PASS, all four new tests plus every pre-existing one.

- [ ] **Step 9: Commit**

```bash
git add packages/kind/src/types.ts packages/core/src/kind/registry.ts \
        packages/core/src/index.ts packages/core/src/registry.ts \
        packages/core/src/kind/registry.test.ts
git commit -m "feat(core): index cue words declared on a Vocabulary

A cue is a word that argues, by standing near a quantity, that the
quantity is of a given kind. It is declared beside the kind that owns
it — whoever adds a duration unit is who knows that 'wait' and 'ago'
argue for durations — and folded into one index at boot, like aliases.

Unlike buildKeywords, two kinds claiming one word is not an error. A
keyword is a definition; a cue is a vote."
```

---

### Task 2: `Resolution.cueBonus` — the solver term

Spec §5. A cue prices a *resolution*, not a reading. This is what stops the term multiplying with operand count and what lets the whole scan share one `Parser`.

**Files:**
- Modify: `packages/core/src/solve/solver.ts` (`Resolution`, `solve`'s opts and `enumerate`)
- Modify: `packages/core/src/solve/solver-class.ts` (`SolveScope`, `all`)
- Test: `packages/core/src/solve/solver.test.ts` (append)

**Interfaces:**
- Consumes: `Registry.cueIndex` exists (Task 1), though this task does not read it.
- Produces: `Resolution.cueBonus: number`; `SolveScope.cues?: Readonly<Record<KindId, number>>`, forwarded by `Solver.all`/`best`/`forKind`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/solve/solver.test.ts`. Match the file's existing fixture names — read the top of the file first and reuse its engine/registry setup rather than building a second one.

```ts
test("a cue lands once per resolution, not once per slot", () => {
  // The regression spec §5 exists to prevent. `5 km + 3 km` has two `length`
  // slots; a cue folded into a weight LAYER would be summed per slot and
  // contribute 8. Priced on the resolution, it contributes 4 — the same as it
  // would to a single-quantity mark, which is what "the word `away` is nearby"
  // actually means.
  const program = compile("5 km + 3 km");
  const [best] = solver.all(program, { cues: { length: 4 } });
  expect(best?.kind).toBe("length");
  expect(best?.cueBonus).toBe(4);
});

test("cueBonus is a summand of score", () => {
  const program = compile("10 m");
  const plain = solver.all(program).find((r) => r.kind === "duration");
  const cued = solver
    .all(program, { cues: { duration: 3 } })
    .find((r) => r.kind === "duration");
  expect(plain?.cueBonus).toBe(0);
  expect(cued?.cueBonus).toBe(3);
  expect((cued?.score ?? 0) - (plain?.score ?? 0)).toBe(3);
});

test("a cue moves the winner and leaves the loser visible", () => {
  // The §4 arithmetic, asserted rather than trusted. Delta 4 through the
  // softmax is 0.982/0.018 — decisive, and not a claim of certainty.
  const program = compile("10 m");
  const ranked = solver.all(program, { cues: { duration: 4 } });
  expect(ranked[0]?.kind).toBe("duration");
  expect(ranked[0]?.confidence).toBeCloseTo(0.982, 3);
  expect(ranked[1]?.kind).toBe("length");
  expect(ranked[1]?.confidence).toBeCloseTo(0.018, 3);
});

test("a cue for a kind no reading produces changes nothing", () => {
  const program = compile("10 m");
  const withCue = solver.all(program, { cues: { mass: 4 } });
  const without = solver.all(program);
  expect(withCue.map((r) => [r.kind, r.score])).toEqual(
    without.map((r) => [r.kind, r.score]),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/solve/solver.test.ts`
Expected: FAIL — `cues` is not assignable to `SolveScope`, and `cueBonus` is not a property of `Resolution`.

- [ ] **Step 3: Add the field and the term**

In `packages/core/src/solve/solver.ts`, in `interface Resolution`, after `signatureWeight`:

```ts
  /**
   * The part of `score` contributed by cue words near this reading — `scan`'s
   * term, and the mirror of `contextBonus` and `signatureWeight` above.
   *
   * Added once per resolution and against the resolution's *result* kind, which
   * is what a cue actually claims: "away" says this quantity is a distance, and
   * for `5 km + 3 km` the quantity is the sum. Pricing it per reading instead
   * would make it louder the longer the expression is.
   */
  readonly cueBonus: number;
```

Widen `solve`'s options:

```ts
export function solve(
  program: Program,
  registry: Registry,
  opts: {
    maxCandidates: number;
    kinds?: KindId[];
    locales?: string[];
    input: string;
    /**
     * Kind -> summed cue weight. NOT clamped here: `scan` applies
     * `CUE_CEILING`, and a caller passing this through `EvalOptions.cues`
     * directly is trusted with it exactly as they are trusted with `weights`.
     */
    cues?: Readonly<Record<KindId, number>>;
  },
): Resolution[] {
```

Widen the `viable` array's element type with `cueBonus: number;`, and in `enumerate`, replace the `viable.push` block:

```ts
    if (index === slots.length) {
      const kind = typeOf(root, choices, registry);
      if (kind === null) return;
      const bonus = contextBonus(root, choices, registry);
      const signature = signatureWeight(root, choices, registry);
      const cue = opts.cues?.[kind] ?? 0;
      viable.push({
        choices: { ...choices },
        kind,
        score: weight + bonus + signature + cue,
        contextBonus: bonus,
        signatureWeight: signature,
        cueBonus: cue,
      });
      return;
    }
```

- [ ] **Step 4: Forward it through `Solver`**

In `packages/core/src/solve/solver-class.ts`, in `interface SolveScope`:

```ts
  /**
   * Kind -> summed cue weight, added once per resolution to its result kind.
   * `scan` computes it from the words around a mark; a caller who already knows
   * the domain may pass it to `evaluate`/`suggest` directly.
   */
  cues?: Readonly<Record<KindId, number>>;
```

and in `all()`, beside the two existing conditional spreads:

```ts
      ...(opts?.cues ? { cues: opts.cues } : {}),
```

`best()` and `forKind()` both delegate to `all()`, so they inherit it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test packages/core/src/solve/`
Expected: PASS. Every pre-existing solver test still passes — `cueBonus` is 0 when nothing supplies cues, so no score moves.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/solve/solver.ts packages/core/src/solve/solver-class.ts \
        packages/core/src/solve/solver.test.ts
git commit -m "feat(core): price cue words on the resolution, not the reading

A weight layer is summed once per slot, so a cue folded into one would
get louder the longer the expression is: '5 km + 3 km' would collect it
twice. It would also force a fresh Parser per mark, since candidate
weights are computed during parsing.

cueBonus is the third term beside contextBonus and signatureWeight —
same walk, same push, added once against the result kind."
```

---

### Task 3: `EvalOptions.cues` and the `explain()` row

Spec §5.1, §5.2. Cues become reachable from every entry point, and `explain()` accounts for them so `Σcontributions === score` still holds.

**Files:**
- Modify: `packages/core/src/engine.ts` (`EvalOptions`, `toExplanation`)
- Test: `packages/core/src/engine.test.ts` (append)

**Interfaces:**
- Consumes: `SolveScope.cues` (Task 2), `Resolution.cueBonus` (Task 2).
- Produces: `EvalOptions.cues?: Readonly<Record<KindId, number>>`; an `explain()` contribution row with `selector: "cueBonus"`, emitted only when non-zero.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/engine.test.ts`:

```ts
test("cues passed to suggest re-rank the readings", () => {
  const ranked = engine.suggest("10 m", { cues: { duration: 4 } });
  expect(ranked[0]?.kind).toBe("duration");
  expect(ranked[1]?.kind).toBe("length");
});

test("explain lists cueBonus as its own row when a cue applied", () => {
  const explained = engine.explain("10 m", { cues: { duration: 3 } });
  const duration = explained.assignments.find((a) => a.kind === "duration");
  expect(duration?.contributions).toContainEqual({
    selector: "cueBonus",
    value: 3,
    layer: 0,
  });
});

test("explain omits the cueBonus row when no cue applied", () => {
  // Emitted only when non-zero, following `signature` and not `contextBonus`:
  // an unconditional row would add `cueBonus: 0` to every explanation in the
  // repo to say nothing, and would move every recorded parity fixture.
  const explained = engine.explain("10 m");
  for (const assignment of explained.assignments) {
    expect(assignment.contributions.map((c) => c.selector)).not.toContain("cueBonus");
  }
});

test("the contribution rows still sum to the score with a cue applied", () => {
  const explained = engine.explain("10 m", { cues: { duration: 3 } });
  for (const assignment of explained.assignments) {
    const sum = assignment.contributions.reduce((total, c) => total + c.value, 0);
    expect(sum).toBeCloseTo(assignment.score, 10);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/engine.test.ts`
Expected: FAIL — `cues` is not a known property of `EvalOptions`.

- [ ] **Step 3: Add `cues` to `EvalOptions`**

In `packages/core/src/engine.ts`, in `interface EvalOptions`, after `weights`:

```ts
  /**
   * Kind -> weight, added once to a reading whose *result* kind matches — the
   * term `scan` computes from the words around a mark (spec §5.1).
   *
   * Public rather than a private channel `scan` alone can reach, because a
   * caller who already knows their domain can say the same thing directly:
   * `suggest("10 m", { cues: { duration: 3 } })` gets exactly the bias scan
   * would have computed from a nearby "in". It is what makes `scan` a
   * segmenter over public machinery rather than a second engine.
   *
   * Unlike `weights`, this is a small scale: see `CUE_CEILING`.
   */
  cues?: Readonly<Record<KindId, number>>;
```

- [ ] **Step 4: Emit the row**

In `toExplanation`, in the `contributions` array, after the `signatureWeight` conditional spread:

```ts
          ...(a.cueBonus === 0
            ? []
            : [{ selector: "cueBonus", value: a.cueBonus, layer: 0 }]),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test packages/core/src/engine.test.ts && bun test packages/core/src/parity.test.ts`
Expected: PASS both. The parity fixtures must not move — that is what the conditional row buys.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/engine.test.ts
git commit -m "feat(core): accept cues on EvalOptions, account for them in explain

The row is conditional, following signature and not contextBonus: an
unconditional cueBonus: 0 would move every recorded parity fixture to
say nothing. Sigma-contributions-equals-score holds either way."
```

---

### Task 4: `scan/cues.ts` — the window walk

Spec §6.5, §6.6. A pure function over a token stream: which words near a mark are cues, what they sum to, and where a sentence ends.

**Files:**
- Create: `packages/core/src/scan/cues.ts`
- Test: `packages/core/src/scan/cues.test.ts`

**Interfaces:**
- Consumes: `Registry.cueIndex`, `CueEntry` (Task 1).
- Produces: `CUE_CEILING`, `CueHit`, `collectCues(args) => { hits: CueHit[]; weights: Record<KindId, number> }` — Task 5 calls it, Task 6 re-exports `CueHit`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/scan/cues.test.ts`:

```ts
import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";
import { Normalizer } from "../parse/normalize";
import { Tokenizer } from "../parse/tokenizer";
import { CUE_CEILING, collectCues } from "./cues";

/**
 * A duration vocabulary patch carrying cues, composed on top of the built-in
 * English pack. Task 7 puts these words in the duration package itself; this
 * file declares its own so it tests the mechanism rather than the shipped table.
 */
const cued = defineVocabulary({
  locale: "en",
  kind: "duration",
  units: {},
  cues: { in: 3, time: 2, wait: 3 },
});
const lengthCued = defineVocabulary({
  locale: "en",
  kind: "length",
  units: {},
  cues: { away: 4, from: 1 },
});

const locale = composeLocale(en, [...BUILTIN_EN, cued, lengthCued]);
const registry = buildRegistry(BUILTIN_KINDS, [locale]);
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale, locales: [locale], registry });

/** Tokenize, then collect cues around the token range [from, to). */
function around(input: string, from: number, to: number, window = 4) {
  const normalized = normalizer.run(input);
  const stream = tokenizer.run(normalized);
  return collectCues({
    tokens: stream.tokens,
    from,
    to,
    input: normalized,
    registry,
    window,
  });
}

test("a keyword token is a cue candidate", () => {
  // The load-bearing half of §6.5. `in` is lexed as a `keyword` token, not a
  // `word` token, and carries no `text` field — a collector reading word
  // tokens only would find "time" and miss both "in"s, and the headline
  // example of this whole feature would resolve on one cue instead of three.
  //   word(Will) word(be) keyword(in) word(time) keyword(in) number(5) word(m)
  const { hits, weights } = around("Will be in time in 5m", 5, 7);
  expect(hits.map((h) => h.word)).toEqual(["in", "time", "in"]);
  // 3 + 2 + 3 = 8, clamped to the ceiling.
  expect(weights.duration).toBe(CUE_CEILING);
});

test("cue hit spans index the caller's string", () => {
  const input = "  wait 5 m  ";
  const { hits } = around(input, 1, 3);
  const hit = hits[0];
  expect(hit).toBeDefined();
  if (hit === undefined) return;
  expect(input.slice(hit.start, hit.end)).toBe("wait");
});

test("the window bounds how far a cue may reach", () => {
  // "wait" sits five tokens before the anchor, so a window of 4 cannot see it.
  const far = around("wait a b c d 5 m", 5, 7, 4);
  expect(far.hits).toEqual([]);
  const near = around("wait a b c d 5 m", 5, 7, 5);
  expect(near.hits.map((h) => h.word)).toEqual(["wait"]);
});

test("a sentence break stops the walk", () => {
  // §6.6: `lex` drops the full stop silently, so the break can only be seen in
  // the gap between two tokens' spans in the source.
  const { hits } = around("wait. 5 m", 1, 3);
  expect(hits).toEqual([]);
});

test("a decimal point is not a sentence break", () => {
  // "5.5" is one number token, so the dot never sits BETWEEN two tokens.
  const { hits } = around("wait 5.5 m", 1, 3);
  expect(hits.map((h) => h.word)).toEqual(["wait"]);
});

test("cues are collected on both sides of the mark", () => {
  const { weights } = around("in 5 m away", 1, 3);
  expect(weights.duration).toBe(3);
  expect(weights.length).toBe(4);
});

test("the ceiling clamps a negative sum too", () => {
  const negative = defineVocabulary({
    locale: "en",
    kind: "duration",
    units: {},
    cues: { nope: -3 },
  });
  const loc = composeLocale(en, [...BUILTIN_EN, negative]);
  const reg = buildRegistry(BUILTIN_KINDS, [loc]);
  const tk = new Tokenizer({ locale: loc, locales: [loc], registry: reg });
  const normalized = normalizer.run("nope nope 5 m");
  const stream = tk.run(normalized);
  const { weights } = collectCues({
    tokens: stream.tokens,
    from: 2,
    to: 4,
    input: normalized,
    registry: reg,
    window: 4,
  });
  expect(weights.duration).toBe(-CUE_CEILING);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/scan/cues.test.ts`
Expected: FAIL — `Cannot find module './cues'`.

- [ ] **Step 3: Write `packages/core/src/scan/cues.ts`**

```ts
import type { CueEntry, Registry } from "../kind/registry";
import type { Token } from "../parse/lex";
import type { NormalizedInput } from "../parse/normalize";
import type { KindId } from "../types";

/**
 * The most any number of cue words may move one kind at one mark.
 *
 * The magnitude is set by the softmax in `solve/solver.ts`, exactly as
 * `TYPO_PENALTY`'s is. A score difference of 4 is 0.982 against 0.018: decisive
 * enough to pass `ambiguityEpsilon` (0.05) several times over, and short of
 * claiming the loser does not exist. The figures this design started from — 25,
 * on the scale `CONTEXT_BONUS` uses — put the loser at 1e-11, which is a
 * certainty that "there is an `in` four words away" has not earned.
 *
 * Clamping rather than trusting the tables is what makes the scale enforceable.
 * A vocabulary author who writes `{ in: 25 }` gets saturation, not a silently
 * overconfident engine and no error.
 *
 * Per kind, not per mark: `duration` saturating does not stop `length`
 * collecting its own from a cue on the other side, and the two then cancel —
 * the right answer for a sentence that argues both ways.
 */
export const CUE_CEILING = 4;

export interface CueHit {
  /** The word as written, not folded. */
  readonly word: string;
  /** Caller-relative, so a UI can underline it. */
  readonly start: number;
  readonly end: number;
  readonly kind: KindId;
  readonly weight: number;
}

/**
 * Characters that end a cue's reach. `lex` skips every one of them silently, so
 * they exist nowhere in the token stream and can only be seen in the source
 * text *between* two tokens' spans — which is what `broken` reads.
 *
 * A decimal point is unaffected: `5.5` is a single number token, so its dot is
 * never between two tokens. An abbreviation ("e.g.") ends a window early, which
 * is the accepted failure: a short window loses a bias, while a long one
 * imports an unrelated sentence's words as evidence.
 */
const BREAK = /[.!?;\n]/;

/**
 * The surface of a token that could be a cue, or `undefined` for one that never
 * is.
 *
 * The `keyword` branch is the load-bearing one. `in`, `to` and `as` are folded
 * by `lex` into a `Keyword` *key*, and the key is not the word that was typed —
 * a `keyword` token has no `text` field at all. Slicing the normalized source is
 * the only way back to the surface, and without it `in` is unreachable as a cue,
 * which is most of what this feature was asked for.
 */
function cueSurface(token: Token, text: string): string | undefined {
  if (token.type === "word") return token.text;
  if (token.type === "keyword") return text.slice(token.start, token.end);
  return undefined;
}

/** True when the source between two adjacent tokens ends a sentence. */
function broken(tokens: readonly Token[], a: number, b: number, text: string): boolean {
  const left = tokens[a];
  const right = tokens[b];
  if (left === undefined || right === undefined) return false;
  return BREAK.test(text.slice(left.end, right.start));
}

export interface CollectCuesArgs {
  readonly tokens: readonly Token[];
  /** Index of the mark's first token. */
  readonly from: number;
  /** Index one past the mark's last token. */
  readonly to: number;
  readonly input: NormalizedInput;
  readonly registry: Registry;
  /** Tokens of any type to look at in each direction. */
  readonly window: number;
}

/**
 * Every cue near `[from, to)`, and what they sum to per kind.
 *
 * Tokens *inside* the mark are never offered, and that exclusion is not
 * tidiness — it is what tells the two `in`s apart without a grammar rule. In
 * "5 km in miles" the `in` is the convert node and sits inside the mark, so it
 * does not vote; in "be in time in 5m" it sits outside, so it does. Backoff has
 * already decided which, and this reads the answer off the mark's extent rather
 * than re-deriving it.
 */
export function collectCues(args: CollectCuesArgs): {
  hits: CueHit[];
  weights: Record<KindId, number>;
} {
  const { tokens, from, to, input, registry, window } = args;
  const text = input.text;
  const hits: CueHit[] = [];

  const visit = (index: number): void => {
    const token = tokens[index];
    if (token === undefined) return;
    const surface = cueSurface(token, text);
    if (surface === undefined) return;
    const entries: readonly CueEntry[] =
      registry.cueIndex.get(surface.toLowerCase()) ?? [];
    for (const entry of entries) {
      // Token spans are normalized-relative; every span that reaches a caller
      // is not.
      const span = input.mapSpan({ start: token.start, end: token.end });
      hits.push({
        word: surface,
        start: span.start,
        end: span.end,
        kind: entry.kind,
        weight: entry.weight,
      });
    }
  };

  // Leftward from the token before the mark, nearest first. The break check
  // runs before the visit so a cue on the far side of a full stop is never
  // read, and `break` rather than `continue` because a sentence boundary ends
  // the reach rather than skipping one word of it.
  for (let i = from - 1, n = 0; i >= 0 && n < window; i -= 1, n += 1) {
    if (broken(tokens, i, i + 1, text)) break;
    visit(i);
  }
  for (let i = to, n = 0; i < tokens.length && n < window; i += 1, n += 1) {
    if (broken(tokens, i - 1, i, text)) break;
    visit(i);
  }

  const weights: Record<KindId, number> = {};
  for (const hit of hits) {
    weights[hit.kind] = (weights[hit.kind] ?? 0) + hit.weight;
  }
  for (const kind of Object.keys(weights)) {
    const summed = weights[kind] ?? 0;
    weights[kind] = Math.max(-CUE_CEILING, Math.min(CUE_CEILING, summed));
  }

  return { hits, weights };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/src/scan/cues.test.ts`
Expected: PASS, all eight.

If "the window bounds how far a cue may reach" fails, print the token list first — `stream.tokens.map(t => t.type)` — and count positions from that rather than from the written words. `a b c d` are word tokens; the assertion depends on there being exactly four of them between `wait` and `5`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scan/cues.ts packages/core/src/scan/cues.test.ts
git commit -m "feat(core): collect cue words around a token range

Keyword tokens are candidates alongside word tokens, and that is the
load-bearing half: 'in' lexes as a keyword and carries no text field, so
a collector reading word tokens only would miss the cue this feature was
asked for.

Sentence breaks are read from the gap between two tokens' spans, because
lex drops punctuation silently and the stream cannot express one."
```

---

### Task 5: `scan/scan.ts` — anchors, backoff, non-overlap

Spec §6.1–§6.4, §6.7. The segmenter. Produces resolutions; Task 6 turns them into formatted readings.

**Files:**
- Create: `packages/core/src/scan/scan.ts`
- Test: `packages/core/src/scan/scan.test.ts`

**Interfaces:**
- Consumes: `collectCues`, `CueHit` (Task 4); `Solver.all` with `cues` (Task 2).
- Produces: `Scanner`, `ScannerOptions`, `ScanMatch { span: Span; program: Program; resolutions: readonly Resolution[]; cues: readonly CueHit[] }`, `ScanScope`, `DEFAULT_CUE_WINDOW = 4`, `DEFAULT_MAX_SPAN = 12`. Task 6 calls `scanner.run(input, parser, opts)`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/scan/scan.test.ts`:

```ts
import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import { Scanner } from "./scan";

const durationCues = defineVocabulary({
  locale: "en",
  kind: "duration",
  units: {},
  cues: { in: 3, time: 2 },
});
const locale = composeLocale(en, [...BUILTIN_EN, durationCues]);
const registry = buildRegistry(BUILTIN_KINDS, [locale]);
const parser = new Parser({
  resolver: createResolver({ registry, locales: [locale], format: locale, layers: [] }),
});
const scanner = new Scanner({
  normalizer: new Normalizer(),
  tokenizer: new Tokenizer({ locale, locales: [locale], registry }),
  solver: new Solver({ registry }),
  registry,
});

const spans = (input: string) =>
  scanner.run(input, parser).map((m) => input.slice(m.span.start, m.span.end));

test("a quantity in prose is marked, and the prose is not", () => {
  expect(spans("My house is in 5km from work")).toEqual(["5km"]);
});

test("backoff stops at the longest run that parses", () => {
  // "5 km from work" and "5 km from" both fail in the Pratt parser; "5 km"
  // parses and wins. Nothing in the parser changed to make this work — a parse
  // that does not consume its whole token list was already an error.
  expect(spans("walk 5 km from work today")).toEqual(["5 km"]);
});

test("an expression inside prose is one mark, not two", () => {
  expect(spans("the total was 5 km + 3 km overall")).toEqual(["5 km + 3 km"]);
});

test("a conversion inside prose is one mark", () => {
  expect(spans("convert 5 km in miles please")).toEqual(["5 km in miles"]);
});

test("several quantities in one sentence are several marks", () => {
  expect(spans("I walked 5 km then ran 3 km")).toEqual(["5 km", "3 km"]);
});

test("marks never overlap and are in source order", () => {
  const input = "I walked 5 km then ran 3 km";
  const marks = scanner.run(input, parser);
  for (let i = 1; i < marks.length; i += 1) {
    const previous = marks[i - 1];
    const current = marks[i];
    expect(previous).toBeDefined();
    expect(current).toBeDefined();
    if (previous === undefined || current === undefined) continue;
    expect(current.span.start).toBeGreaterThanOrEqual(previous.span.end);
  }
});

test("prose with no quantity in it marks nothing", () => {
  expect(spans("the kilometre is a unit of length")).toEqual([]);
});

test("an empty input marks nothing rather than throwing", () => {
  expect(scanner.run("   ", parser)).toEqual([]);
});

test("a cue outside the mark biases it; one inside does not", () => {
  // The whole §6.5 distinction, in two assertions. Same word, both times.
  const biased = scanner.run("Will be in time in 5m", parser);
  expect(biased[0]?.resolutions[0]?.kind).toBe("duration");
  expect(biased[0]?.cues.map((c) => c.word)).toEqual(["in", "time", "in"]);

  // Here `in` is the convert node, inside the mark, so it casts no vote.
  const converted = scanner.run("5 km in miles", parser);
  expect(converted[0]?.cues).toEqual([]);
});

test("maxSpan bounds the backoff", () => {
  // With a cap of 2 tokens the scanner can never reach past "5 km", so the
  // longer expression is broken into the marks that fit.
  const marks = scanner.run("total 5 km + 3 km", parser, { maxSpan: 2 });
  expect(marks.map((m) => m.span.end - m.span.start)).toEqual([4, 4]);
});

test("span offsets survive normalization edits", () => {
  const input = "it was  30  °C  outside";
  const marks = scanner.run(input, parser);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(input.slice(mark.span.start, mark.span.end)).toBe("30  °C");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/scan/scan.test.ts`
Expected: FAIL — `Cannot find module './scan'`.

- [ ] **Step 3: Write `packages/core/src/scan/scan.ts`**

```ts
import { SmartputError } from "../errors";
import type { Registry } from "../kind/registry";
import type { Token } from "../parse/lex";
import { type NormalizedInput, Normalizer } from "../parse/normalize";
import type { Parser, Program } from "../parse/program";
import type { Tokenizer, TokenStream } from "../parse/tokenizer";
import type { Resolution } from "../solve/solver";
import type { Solver } from "../solve/solver-class";
import type { KindId, Span } from "../types";
import { type CueHit, collectCues } from "./cues";

/** Tokens either side of a mark that are offered as context. */
export const DEFAULT_CUE_WINDOW = 4;
/**
 * The longest token run backoff will try, and the reason a pasted paragraph
 * cannot go quadratic. Backoff from one anchor is O(maxSpan) parse attempts
 * over runs of at most `maxSpan` tokens, so with this fixed the whole scan is
 * linear in the input.
 *
 * Twelve rather than a rounder number because the longest thing worth reading
 * as one quantity is a conversion of a sum — "5 km + 3 km in miles" is nine
 * tokens — and a cap has to clear the real cases with room rather than
 * exactly.
 */
export const DEFAULT_MAX_SPAN = 12;

export interface ScannerOptions {
  normalizer?: Normalizer;
  tokenizer: Tokenizer;
  solver: Solver;
  registry: Registry;
}

export interface ScanScope {
  kinds?: KindId[];
  locales?: string[];
  cueWindow?: number;
  maxSpan?: number;
  timeZone?: string;
}

/**
 * One stretch of the input that parsed, with every reading it earned.
 *
 * Deliberately short of a finished `Mark`: turning a `Resolution` into a
 * formatted reading needs an `Evaluator` and a `Printer`, which are per-call
 * config holders the engine owns. The `Scanner` is the segmenter, and stops
 * where `Solver` stops.
 */
export interface ScanMatch {
  /** Caller-relative, already mapped through `NormalizedInput`. */
  readonly span: Span;
  readonly program: Program;
  /** Ranked, never empty. */
  readonly resolutions: readonly Resolution[];
  readonly cues: readonly CueHit[];
}

/**
 * A token index at which a quantity may begin.
 *
 * A bare unit word is deliberately not one: "the kilometre is a unit" must mark
 * nothing, and an anchor rule that fired on unit words would mark the word
 * `kilometre` as a quantity of one.
 */
function isAnchor(token: Token | undefined): boolean {
  return token !== undefined && (token.type === "number" || token.type === "literal");
}

/**
 * Finds the quantities inside free-form prose.
 *
 * One normalization and one tokenization for the whole input — the `Tokenizer`
 * is the expensive stage, at 0.028 ms against 0.06 ms for a whole `evaluate`,
 * and `foldNumerals`/`foldLiterals` run inside it, so "twenty two kg" is
 * already one number token and "tomorrow" is already a literal by the time the
 * segmenter sees anything.
 */
export class Scanner {
  private readonly normalizer: Normalizer;
  private readonly tokenizer: Tokenizer;
  private readonly solver: Solver;
  private readonly registry: Registry;

  constructor(cfg: ScannerOptions) {
    this.normalizer = cfg.normalizer ?? new Normalizer();
    this.tokenizer = cfg.tokenizer;
    this.solver = cfg.solver;
    this.registry = cfg.registry;
    Object.freeze(this);
  }

  /**
   * `parser` is a positional argument rather than constructor config because it
   * is per-call state: a `Parser` closes over the weight layers, and
   * `EvalOptions.weights` may override them on any single call. Every other
   * stage here is config-only and is built once.
   */
  run(input: string, parser: Parser, opts?: ScanScope): ScanMatch[] {
    const normalized = this.normalizer.run(input);
    // Unlike `evaluate`, empty is an answer rather than an error: scan is
    // handed prose it did not ask for, and "nothing in it" is a legal result.
    if (normalized.empty) return [];
    const stream = this.tokenizer.run(
      normalized,
      opts?.timeZone === undefined ? undefined : { timeZone: opts.timeZone },
    );
    const tokens = stream.tokens;
    const window = opts?.cueWindow ?? DEFAULT_CUE_WINDOW;
    const maxSpan = opts?.maxSpan ?? DEFAULT_MAX_SPAN;

    const out: ScanMatch[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isAnchor(tokens[i])) {
        i += 1;
        continue;
      }
      const found = this.matchAt(tokens, normalized, parser, i, window, maxSpan, opts);
      if (found === undefined) {
        i += 1;
        continue;
      }
      out.push(found.match);
      // Resuming past the winning run is what makes non-overlap a property of
      // the walk rather than of a later filtering pass — and it is why "3pm in
      // tokyo" is one mark and not two.
      i = found.next;
    }
    return out;
  }

  /**
   * Longest-match backoff from one anchor: try the longest run, drop the last
   * token on failure, retry, down to the anchor alone.
   *
   * It needs no cooperation from the parser because `pratt.ts` already ends
   * with `if (pos !== tokens.length) throw new UnitParseError(input)` — a parse
   * that does not consume its whole token list is already an error, which is
   * exactly the signal backoff reads.
   */
  private matchAt(
    tokens: readonly Token[],
    normalized: NormalizedInput,
    parser: Parser,
    from: number,
    window: number,
    maxSpan: number,
    opts: ScanScope | undefined,
  ): { match: ScanMatch; next: number } | undefined {
    const limit = Math.min(tokens.length, from + maxSpan);
    for (let to = limit; to > from; to -= 1) {
      // `input` is the WHOLE NormalizedInput, never a sliced one: token offsets
      // stay relative to the entire string, so `mapSpan` maps a mark back to
      // the caller's original exactly as it does for `evaluate`.
      const sub: TokenStream = { input: normalized, tokens: tokens.slice(from, to) };
      let program: Program;
      try {
        program = parser.run(sub);
      } catch (e) {
        // A run that is not a quantity is the ordinary case here, not a
        // failure. Anything that is not one of the library's own errors is a
        // bug in the pipeline and keeps its stack.
        if (e instanceof SmartputError) continue;
        throw e;
      }

      const { hits, weights } = collectCues({
        tokens,
        from,
        to,
        input: normalized,
        registry: this.registry,
        window,
      });

      let resolutions: readonly Resolution[];
      try {
        resolutions = this.solver.all(program, {
          ...(opts?.kinds ? { kinds: opts.kinds } : {}),
          ...(opts?.locales ? { locales: opts.locales } : {}),
          cues: weights,
        });
      } catch (e) {
        if (e instanceof SmartputError) continue;
        throw e;
      }
      if (resolutions.length === 0) continue;

      return {
        match: {
          span: normalized.mapSpan(program.root.span),
          program,
          resolutions,
          cues: hits,
        },
        next: to,
      };
    }
    return undefined;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/src/scan/scan.test.ts`
Expected: PASS, all eleven.

Two failures to expect and how to read them:
- **"an expression inside prose is one mark"** returning `["5 km", "3 km"]` means backoff shortened past the `+`. Check that `maxSpan` is not being applied as a *character* count and that the loop starts at `limit`, not at `from + 1`.
- **"span offsets survive normalization edits"** returning `"30  °"` or similar means a raw `program.root.span` reached the `ScanMatch` without `normalized.mapSpan`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scan/scan.ts packages/core/src/scan/scan.test.ts
git commit -m "feat(core): segment prose into marks by longest-match backoff

From each anchor, hand progressively shorter slices of the one token
stream to the existing Parser until one parses. This needs no change to
the parser: pratt already throws when a parse does not consume its whole
token list, which is exactly the signal backoff reads.

Anchor search resumes past the winning run, so non-overlap is a property
of the walk rather than of a filtering pass."
```

---

### Task 6: `engine.scan()` and the package door

Spec §2, §8. The public entry point, the `MissingRateError` ruling, and the `@smartput/core/scan` subpath.

**Files:**
- Modify: `packages/core/src/engine.ts` (`ScanOptions`, `Mark`, `MarkReading`, `buildStages`, the returned object)
- Create: `packages/core/src/scan.ts` (subpath re-export)
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json` (`exports`, `sideEffects`)
- Test: `packages/core/src/scan/scan-engine.test.ts`

**Interfaces:**
- Consumes: `Scanner`, `ScanMatch`, `DEFAULT_CUE_WINDOW`, `DEFAULT_MAX_SPAN` (Task 5); `CueHit` (Task 4).
- Produces: `Engine.scan(input: string, opts?: ScanOptions): Mark[]`; `Mark`, `MarkReading`, `ScanOptions` exported from `@smartput/core`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/scan/scan-engine.test.ts`:

```ts
import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { MissingRateError } from "../errors";
import { defineKind } from "../kind/define";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";

const durationCues = defineVocabulary({
  locale: "en",
  kind: "duration",
  units: {},
  cues: { in: 3, time: 2 },
});
const engine = createEngine({
  locales: [composeLocale(en, [...BUILTIN_EN, durationCues])],
  kinds: BUILTIN_KINDS,
});

test("scan marks a quantity in prose with its formatted reading", () => {
  const input = "My house is in 5km from work";
  const marks = engine.scan(input);
  expect(marks).toHaveLength(1);
  const mark = marks[0];
  expect(mark).toBeDefined();
  if (mark === undefined) return;
  expect(mark.text).toBe("5km");
  expect(input.slice(mark.start, mark.end)).toBe("5km");
  expect(mark.readings[0]?.kind).toBe("length");
});

test("a cue lifts the reading it argues for and leaves the loser visible", () => {
  // The headline example. Three cues — in, time, in — saturate at CUE_CEILING,
  // which the softmax turns into 0.982 against 0.018.
  const marks = engine.scan("Will be in time in 5m");
  const readings = marks[0]?.readings ?? [];
  expect(readings[0]?.kind).toBe("duration");
  expect(readings[0]?.formatted).toBe("5 minutes");
  expect(readings[1]?.kind).toBe("length");
  // The bounds are the assertion. "duration wins" alone would pass just as well
  // under a cue weight ten times too large, which is the bug §4 exists to stop.
  expect(readings[1]?.confidence).toBeGreaterThan(0.01);
  expect(readings[1]?.confidence).toBeLessThan(0.1);
});

test("text always equals the slice it names", () => {
  const input = "  I walked 5 km then ran 3 km.  ";
  for (const mark of engine.scan(input)) {
    expect(mark.text).toBe(input.slice(mark.start, mark.end));
  }
});

test("cue hits carry caller-relative spans", () => {
  const input = "Will be in time in 5m";
  const cues = engine.scan(input)[0]?.cues ?? [];
  expect(cues).not.toHaveLength(0);
  for (const cue of cues) {
    expect(input.slice(cue.start, cue.end)).toBe(cue.word);
  }
});

test("maxReadings truncates after ranking, not before", () => {
  const marks = engine.scan("about 10 m here", { maxReadings: 1 });
  expect(marks[0]?.readings).toHaveLength(1);
});

test("scan answers [] rather than throwing on prose with nothing in it", () => {
  expect(engine.scan("the kilometre is a unit of length")).toEqual([]);
  expect(engine.scan("")).toEqual([]);
});

test("a reading whose rate is missing is dropped, not thrown", () => {
  // Ruling S4, exercised rather than asserted around. `@smartput/rate` is the
  // real source of a MissingRateError and core cannot depend on it, so a stub
  // kind whose format hook raises the same error stands in — the code path
  // under test is `toResult` throwing inside `scan`, and it does not care which
  // kind raised it.
  const unpriced = defineKind({
    id: "unpriced",
    value: { mode: "ratio", canonical: "zz", units: { zz: 1 } },
    format: () => {
      throw new MissingRateError("zz", "zz", "usd", "2026-08-16");
    },
  });
  const unpricedEn = defineVocabulary({
    locale: "en",
    kind: "unpriced",
    units: { zz: { aliases: ["zorkmid", "zorkmids"], symbol: "zz" } },
  });
  const stubbed = createEngine({
    locales: [composeLocale(en, [...BUILTIN_EN, unpricedEn])],
    kinds: [...BUILTIN_KINDS, unpriced],
  });

  // The unpriced mark has no formattable reading, so it is dropped whole — and
  // the two marks around it survive, which is the entire point of the ruling.
  const marks = stubbed.scan("I walked 5 km, paid 9 zorkmids, then ran 3 km");
  expect(marks.map((m) => m.text)).toEqual(["5 km", "3 km"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/scan/scan-engine.test.ts`
Expected: FAIL — `engine.scan is not a function`.

- [ ] **Step 3: Add the public types to `engine.ts`**

Add these imports at the top of `packages/core/src/engine.ts`:

```ts
import type { CueHit } from "./scan/cues";
import { DEFAULT_CUE_WINDOW, DEFAULT_MAX_SPAN, Scanner } from "./scan/scan";
```

and add `MissingRateError` to the existing import from `./errors` if it is not already listed (it is — `NEVER_SWALLOWED` uses it).

After `interface Explanation`, add:

```ts
/** Readings kept per mark before truncation. */
const DEFAULT_MAX_READINGS = 3;

export interface ScanOptions extends EvalOptions {
  /** Tokens either side of a mark that are offered as context. Default 4. */
  cueWindow?: number;
  /** Readings kept per mark. Default 3. */
  maxReadings?: number;
  /** The token backoff cap, and the adversarial-input guard. Default 12. */
  maxSpan?: number;
}

export interface MarkReading {
  kind: KindId;
  value: Value;
  formatted: string;
  confidence: number;
}

/**
 * One stretch of the caller's string that reads as a quantity.
 *
 * `start`/`end` index the CALLER's string, like `Result.spans` and never the
 * normalized one, and `text` is `input.slice(start, end)` — carried so a caller
 * never re-slices, and stated because it is the invariant most likely to rot.
 */
export interface Mark {
  start: number;
  end: number;
  text: string;
  /** Ranked, best first. Never empty: a mark with no reading is not emitted. */
  readings: MarkReading[];
  /** Which words biased this mark, and by how much. Empty when none did. */
  cues: CueHit[];
}
```

and add the method to `interface Engine`:

```ts
  scan(input: string, opts?: ScanOptions): Mark[];
```

- [ ] **Step 4: Build the `Scanner` in `buildStages`**

`buildStages` currently constructs its `Tokenizer` and `Solver` inline in the returned object literal. Hoist both to `const`s above the `return` so the `Scanner` can share the same instances — a second `Tokenizer` would double the one cost that matters:

```ts
function buildStages(opts: EngineOptions, registry: Registry, format: Locale) {
  const tokenizer = new Tokenizer({
    locale: format,
    locales: opts.locales,
    weights: weightLayers(opts.locales, opts, undefined),
    registry,
    ...(opts.now === undefined ? {} : { now: opts.now }),
    ...(opts.timeZone === undefined ? {} : { timeZone: opts.timeZone }),
  });
  const solver = new Solver({
    registry,
    ...(opts.maxCandidates === undefined ? {} : { maxCandidates: opts.maxCandidates }),
    ...(opts.ambiguityEpsilon === undefined
      ? {}
      : { ambiguityEpsilon: opts.ambiguityEpsilon }),
    ...(opts.tiebreak === undefined ? {} : { tiebreak: opts.tiebreak }),
  });
  return {
    normalizer: new Normalizer(),
    tokenizer,
    solver,
    // Shares both: scanning a paragraph normalizes and lexes it once, and the
    // `Scanner` only ever calls `solver.all()`, which applies neither
    // `tiebreak` nor `ambiguityEpsilon` — so sharing the configured instance
    // costs nothing and keeps one solver per engine.
    scanner: new Scanner({ tokenizer, solver, registry, locale: format.id }),
    evaluator: newEvaluator(opts, registry, format, opts.comparePrecision),
    printer: newPrinter(opts, registry, format),
  };
}
```

Keep the two doc comments that currently sit on the inline `tokenizer` and `solver` — move them up with the constructors rather than dropping them.

- [ ] **Step 5: Implement `scan()`**

In the object `createEngine` returns, after `complete`:

```ts
    scan(input, call) {
      const matches = stages.scanner.run(input, parserFor(call), {
        ...(call?.kinds ? { kinds: call.kinds } : {}),
        ...(call?.locales ? { locales: call.locales } : {}),
        ...(call?.timeZone === undefined ? {} : { timeZone: call.timeZone }),
        cueWindow: call?.cueWindow ?? DEFAULT_CUE_WINDOW,
        maxSpan: call?.maxSpan ?? DEFAULT_MAX_SPAN,
      });
      const resultCtx = ctxFor(call);
      const limit = call?.maxReadings ?? DEFAULT_MAX_READINGS;
      const marks: Mark[] = [];
      for (const match of matches) {
        const readings: MarkReading[] = [];
        for (const resolution of match.resolutions) {
          if (readings.length === limit) break;
          let result: Result;
          try {
            result = toResult(match.program, resolution, resultCtx);
          } catch (e) {
            // Ruling S4, and narrower than the spec's first wording: the
            // READING is dropped, and the mark with it only if nothing
            // survives. `suggest` re-throws this because the caller typed
            // "30 jpy" and deserves to hear "no rate for JPY"; the caller of
            // `scan` did not type the prose, and one unpriced currency in
            // paragraph three must not delete the twelve marks around it.
            if (e instanceof MissingRateError) continue;
            throw e;
          }
          readings.push({
            kind: result.kind,
            value: result.value,
            formatted: result.formatted,
            confidence: result.confidence,
          });
        }
        if (readings.length === 0) continue;
        marks.push({
          start: match.span.start,
          end: match.span.end,
          text: input.slice(match.span.start, match.span.end),
          readings,
          cues: [...match.cues],
        });
      }
      return marks;
    },
```

- [ ] **Step 6: Export from the package door**

In `packages/core/src/index.ts`, extend the engine export line and add the scan exports in alphabetical position:

```ts
export type {
  Engine,
  EngineOptions,
  EvalOptions,
  Explanation,
  Mark,
  MarkReading,
  Result,
  ScanOptions,
} from "./engine";
export { createEngine } from "./engine";
```

and, after the `./print/print` exports:

```ts
// The segmenter behind `engine.scan`, exposed for the same reason `Solver` and
// `Parser` are: a caller who wants marks without formatted readings can drive
// it directly, and a plugin can see what a cue did without an engine.
export type { CueHit } from "./scan/cues";
export { CUE_CEILING, collectCues } from "./scan/cues";
export type { ScanMatch, ScannerOptions, ScanScope } from "./scan/scan";
export { DEFAULT_CUE_WINDOW, DEFAULT_MAX_SPAN, Scanner } from "./scan/scan";
```

Create `packages/core/src/scan.ts`:

```ts
// `@smartput/core/scan` — prose segmentation alone: `Scanner` finds the
// quantities inside free text and `collectCues` is the context walk that biases
// them, without pulling in the evaluator or printer.
export type { CueHit } from "./scan/cues";
export { CUE_CEILING, collectCues } from "./scan/cues";
export type { ScanMatch, ScannerOptions, ScanScope } from "./scan/scan";
export { DEFAULT_CUE_WINDOW, DEFAULT_MAX_SPAN, Scanner } from "./scan/scan";
```

In `packages/core/package.json`, add `"./dist/scan.js"` to `sideEffects` after `"./dist/solve.js"`, and add the export map entry after `"./solve"`:

```json
    "./scan": {
      "bun": "./src/scan.ts",
      "types": "./dist/scan.d.ts",
      "default": "./dist/scan.js"
    },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `bun test packages/core/src/scan/ && bun run typecheck`
Expected: PASS both.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/scan.ts \
        packages/core/src/index.ts packages/core/package.json \
        packages/core/src/scan/scan-engine.test.ts
git commit -m "feat(core): add engine.scan(), the sixth entry point

Marks carry caller-relative offsets and every reading the stretch
earned, ranked.

scan drops a reading whose rate is missing where suggest re-throws, and
the mark with it only if nothing survives. suggest's caller typed the
input and deserves to hear 'no rate for JPY'; scan's caller did not type
the prose, and one unpriced currency must not delete the marks around
it."
```

---

### Task 7: English cue tables in the kind packages

Spec §7. Authored words, single digits, English only.

**Files:**
- Modify: `packages/{duration,length,mass,temperature,datasize,speed,volume,area,power,energy,percent}/src/locale/en.ts`
- Test: `packages/kinds/src/cues.test.ts` (create)

**Interfaces:**
- Consumes: `Vocabulary.cues` (Task 1), `engine.scan` (Task 6).
- Produces: no new symbols — data only.

> **Scope note:** `@smartput/currency` and `@smartput/rate`'s money vocabulary are **not** in this list. Neither kind is in `BUILTIN_KINDS`, so a cue table on them would be untested by the corpus net in Task 8. They are follow-up work.

- [ ] **Step 1: Write the failing test**

Create `packages/kinds/src/cues.test.ts`:

```ts
import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { CUE_CEILING } from "@smartput/core/scan";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("every shipped cue weight is on the authored scale", () => {
  // The scale is enforceable because CUE_CEILING clamps it, but a table that
  // needs clamping is a table nobody calibrated. Assert the tables themselves.
  let counted = 0;
  for (const vocabulary of BUILTIN_EN) {
    for (const [word, weight] of Object.entries(vocabulary.cues ?? {})) {
      expect(Number.isInteger(weight), `${vocabulary.kind}:${word}`).toBe(true);
      expect(Math.abs(weight), `${vocabulary.kind}:${word}`).toBeLessThanOrEqual(
        CUE_CEILING,
      );
      expect(Math.abs(weight), `${vocabulary.kind}:${word}`).toBeGreaterThan(0);
      counted += 1;
    }
  }
  // Guards against the loop finding nothing and passing vacuously.
  expect(counted).toBeGreaterThan(40);
});

test("no shipped cue word is also a unit alias of the kind that claims it", () => {
  // A word that is both would be read as the unit inside the mark and as a cue
  // outside it, which is confusing rather than wrong — but it is always a
  // mistake in the table, because a unit alias next to a quantity is a second
  // quantity, not context.
  for (const vocabulary of BUILTIN_EN) {
    const aliases = new Set(
      Object.values(vocabulary.units).flatMap((u) => u.aliases.map((a) => a.toLowerCase())),
    );
    for (const word of Object.keys(vocabulary.cues ?? {})) {
      expect(aliases.has(word.toLowerCase()), `${vocabulary.kind}:${word}`).toBe(false);
    }
  }
});

test("the shipped tables resolve the sentences they were written for", () => {
  for (const [input, expected] of [
    ["Will be in time in 5m", "duration"],
    ["my house is 5 m away", "length"],
    ["the parcel weighs 5 kg", "mass"],
    ["the oven is at 200 c", "temperature"],
    ["the file is 5 m", "datasize"],
  ] as const) {
    const marks = engine.scan(input);
    expect(marks.length, input).toBeGreaterThan(0);
    expect(marks[0]?.readings[0]?.kind, input).toBe(expected);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/kinds/src/cues.test.ts`
Expected: FAIL — `counted` is 0, well short of 40.

- [ ] **Step 3: Add the cue tables**

Add a `cues` key to each `defineVocabulary({...})` call, after `units`. The exact tables:

```ts
// packages/duration/src/locale/en.ts
  cues: { in: 3, within: 3, after: 2, ago: 3, wait: 3, takes: 2, lasts: 3,
          late: 2, early: 2, delay: 3, every: 1, time: 2, spent: 2 },

// packages/length/src/locale/en.ts
  cues: { away: 4, far: 3, from: 1, tall: 4, wide: 3, deep: 2, long: 1,
          drive: 2, walk: 2, distance: 4, radius: 4, height: 4, depth: 3 },

// packages/mass/src/locale/en.ts
  cues: { weighs: 4, weight: 4, heavy: 3, lifts: 2, parcel: 2, luggage: 3 },

// packages/temperature/src/locale/en.ts
  cues: { degrees: 3, hot: 3, cold: 3, warm: 2, oven: 3, fever: 3, forecast: 2 },

// packages/datasize/src/locale/en.ts
  cues: { file: 3, download: 2, upload: 2, disk: 3, storage: 3, ram: 3, quota: 2 },

// packages/speed/src/locale/en.ts
  cues: { speed: 4, fast: 3, limit: 2, driving: 2, wind: 2, pace: 2 },

// packages/volume/src/locale/en.ts
  cues: { pour: 3, bottle: 3, tank: 3, recipe: 2, capacity: 3, litres: 1 },

// packages/area/src/locale/en.ts
  cues: { floor: 2, plot: 3, garden: 2, surface: 3, covers: 2 },

// packages/power/src/locale/en.ts
  cues: { engine: 3, motor: 3, output: 2, draws: 2, rated: 2 },

// packages/energy/src/locale/en.ts
  cues: { consumed: 3, battery: 3, calories: 3, burned: 2, bill: 2 },

// packages/percent/src/locale/en.ts
  cues: { discount: 3, off: 2, increase: 2, growth: 2, share: 2, rate: 1 },
```

`from` earns 1 rather than 3 because it argues for length only weakly —
"5 minutes from now" is at least as common as "5 km from work" — and `litres`
earns 1 because it is nearly a unit alias and is here only for the spelled-out
prose case. Judgements like these are the reason the table lives beside the
vocabulary.

If the "no shipped cue word is also a unit alias" test fails on a word, delete
that word rather than lowering its weight. The test is naming a real collision.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/kinds/ && bun test packages/core/`
Expected: PASS both. If a kind package's own `locale/en.test.ts` fails, it is asserting the vocabulary's exact shape — extend the assertion rather than dropping the cues.

- [ ] **Step 5: Commit**

```bash
git add packages/*/src/locale/en.ts packages/kinds/src/cues.test.ts
git commit -m "feat(kinds): English cue words for eleven built-in kinds

Authored, not generated, and English only. The words that argue for a
duration in Polish are Polish words a Polish speaker picks, and machine
-translating this table would produce a file that looks authored and is
not.

currency and money are left out: neither is in BUILTIN_KINDS, so a table
on them would be untested by the corpus net."
```

---

### Task 8: The corpus net, span fidelity, and properties

Spec §10. The regression net that catches a backoff change eating one token too many.

**Files:**
- Create: `packages/core/src/scan/corpus.test.ts`
- Test: itself

**Interfaces:**
- Consumes: `engine.scan` (Task 6), the shipped cue tables (Task 7).
- Produces: nothing.

- [ ] **Step 1: Write the tests**

Create `packages/core/src/scan/corpus.test.ts`:

```ts
import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { composeLocale } from "../locale/compose";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

const corpusRows = (await Bun.file(new URL("../../corpus/en.tsv", import.meta.url)).text())
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"))
  .map((l) => l.split("\t")[0] as string);

test("a corpus row inside a carrier sentence scans to what it evaluates to alone", () => {
  let checked = 0;
  let skipped = 0;
  for (const row of corpusRows) {
    let alone: { kind: string; formatted: string };
    try {
      const result = engine.evaluate(row);
      alone = { kind: result.kind, formatted: result.formatted };
    } catch {
      // Deliberately ambiguous or otherwise throwing rows are not this test's
      // concern. They are counted so the skip rate is visible rather than
      // silent.
      skipped += 1;
      continue;
    }
    const carrier = `note ${row} ok`;
    const marks = engine.scan(carrier);
    expect(marks.length, carrier).toBe(1);
    const mark = marks[0];
    if (mark === undefined) continue;
    expect(mark.text, carrier).toBe(row);
    expect(mark.readings[0]?.kind, carrier).toBe(alone.kind);
    expect(mark.readings[0]?.formatted, carrier).toBe(alone.formatted);
    checked += 1;
  }
  // Every `continue` above skips a row without recording that it did, so a bare
  // loop with no counter would still pass if a change made most rows throw.
  // This is the guard the corpus span test already uses, for the same reason.
  expect(checked).toBeGreaterThan(30);
  expect(skipped).toBeLessThan(checked);
});

test("every mark's span survives leading and trailing padding", () => {
  // The whitespace-padding torture from span.test.ts, which caught three real
  // normalized-relative span bugs on the Result path.
  let checked = 0;
  for (const row of corpusRows) {
    const carrier = `note ${row} ok`;
    const plain = engine.scan(carrier);
    if (plain.length !== 1) continue;
    const padded = engine.scan(`  ${carrier}  `);
    expect(padded.length, carrier).toBe(1);
    expect(padded[0]?.text, carrier).toBe(plain[0]?.text);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(30);
});

test("marks are sorted, non-overlapping, and name their own text", () => {
  const input = "I walked 5 km, waited 20 min, then drove 30 km at 100 kph.";
  const marks = engine.scan(input);
  expect(marks.length).toBeGreaterThan(2);
  let previousEnd = 0;
  for (const mark of marks) {
    expect(mark.start).toBeGreaterThanOrEqual(previousEnd);
    expect(mark.end).toBeGreaterThan(mark.start);
    expect(mark.text).toBe(input.slice(mark.start, mark.end));
    previousEnd = mark.end;
  }
});

test("scanning a long paragraph stays linear", () => {
  // The maxSpan guard of §6.3, asserted as a wall-clock ceiling rather than a
  // complexity proof: 200 quantities should not take 20x what 20 take.
  const sentence = "I walked 5 km and waited 20 min. ";
  const short = sentence.repeat(20);
  const long = sentence.repeat(200);

  const t0 = Bun.nanoseconds();
  engine.scan(short);
  const shortNs = Bun.nanoseconds() - t0;

  const t1 = Bun.nanoseconds();
  const marks = engine.scan(long);
  const longNs = Bun.nanoseconds() - t1;

  expect(marks.length).toBe(400);
  // Generous by design — this catches quadratic behaviour, not a slow day on
  // shared CI.
  expect(longNs).toBeLessThan(shortNs * 40);
});
```

- [ ] **Step 2: Run the tests**

Run: `bun test packages/core/src/scan/corpus.test.ts`
Expected: PASS.

If "a corpus row inside a carrier sentence" fails with `marks.length` of 2 for a row, the carrier words are being read as quantities — check that `note` and `ok` are not unit aliases in the installed vocabularies and pick different carrier words if they are. If it fails with a `text` mismatch, backoff is claiming a carrier word: that is a real bug in Task 5, not a bad test.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/scan/corpus.test.ts
git commit -m "test(core): scan every corpus row inside a carrier sentence

A few hundred assertions from one loop: a row embedded in prose must
mark exactly its own text and resolve to what evaluate() gives it alone.
This is the net that catches a backoff change eating one token too many.

The loop counts what it checked and asserts the count, or a change that
made half the rows throw would halve the test's reach and still pass."
```

---

### Task 9: Budgets, docs, and the full check

Spec §1, §11. Land the size budget, update the entry-point table everywhere it appears, and reconcile the spec with the one place implementation refined it.

**Files:**
- Modify: `scripts/check-size.ts` (budget rows only)
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `docs/superpowers/specs/2026-08-16-smartputs-scan-design.md` (§8 wording)

- [ ] **Step 1: Run the full check to find the budget failures**

Run: `bun run check`
Expected: FAIL at `check-size` — the core rows grew by the scanner, the cue index and the new types.

> **Coordinate first.** `scripts/check-size.ts` has uncommitted work on this branch from another change. Run `git diff scripts/check-size.ts` before editing and touch only the `min`/`gzip`/`floor` numbers on rows that the check reports as over budget. Do not reformat the file.

- [ ] **Step 2: Raise only the failing budgets**

For each row `check-size` reports over, set `min` and `gzip` to the measured value plus the headroom the file's existing rows use. Do not raise a row the check did not name. If a row's *floor* now fails — the measurement dropped below the band — that is a signal something got tree-shaken away that should not have; investigate rather than lowering the floor.

- [ ] **Step 3: Update the entry-point tables**

In `README.md`, the "Five entry points" section becomes six. Change the heading and add the row:

```markdown
| Method | On ambiguity | Returns |
| --- | --- | --- |
| `evaluate(input)` | throws `AmbiguityError` | one `Result` |
| `suggest(input)` | ranks | `Result[]`, possibly empty; never throws |
| `coerce(kind, input)` | resolved by the hard kind constraint | a `Value` |
| `explain(input)` | shows the scoring | an `Explanation` |
| `complete(input)` | ranks the units the fragment could become | `Completion[]` |
| `scan(text)` | ranks, per mark | `Mark[]`, possibly empty; never throws |
```

and add a worked example after the `complete` one:

```markdown
`evaluate` and friends read the whole string as one expression. `scan` does not:
it finds the quantities inside a sentence and marks each one, letting the words
around a mark argue for a kind.

```ts
engine.scan("My house is 5km from work");
// [ { start: 12, end: 15, text: "5km", readings: [ { kind: "length", … } ] } ]

engine.scan("Will be in time in 5m")[0].readings.map((r) => r.kind);
// [ "duration", "length" ]   — "in" and "time" argue for minutes, and the
//                              metres reading survives at 0.018 rather than
//                              being deleted
```
```

Mirror both edits in `packages/core/README.md` if it carries the same table — check with `grep -n "Five entry points" packages/core/README.md`.

- [ ] **Step 4: Reconcile the spec with §8's refinement**

Implementation narrowed ruling S4: the *reading* is dropped, and the mark only if nothing survives. Edit §8 of the spec so the document and the code agree — replace "the mark is dropped and the scan continues" with:

```markdown
`scan` inverts that for `MissingRateError` alone: the *reading* is dropped, and
the mark with it only if no reading survives. The caller of `scan` did not type
the prose — it arrived from a document, a message, a paste — and a single
unpriced currency in paragraph three must not delete the twelve marks around it.
Dropping the reading rather than the whole mark is the narrower form of the same
rule: a mark whose other readings are perfectly priced still has something true
to say.
```

- [ ] **Step 5: Regenerate the docs pages**

Run: `bun run docs:readmes && bun run docs:packages`
Expected: clean, and any regenerated file that changed is part of the commit.

- [ ] **Step 6: Run the full check**

Run: `bun run check`
Expected: PASS — `lint`, `typecheck`, `check-deps`, `test`, `build`, `check-size` all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: scan is the sixth entry point; land its size budget

Also narrows ruling S4 in the spec to what the implementation does: a
reading whose rate is missing is dropped, and the mark with it only if
nothing survives. A mark whose other readings are priced still has
something true to say."
```

---

## Notes for the executor

**The defect this plan is most likely to produce** is a normalized-relative span
reaching a caller. Every span on a `Mark` or a `CueHit` must have passed through
`normalized.mapSpan`. Tasks 4, 5 and 6 each assert it independently, and Task 8
asserts it across the whole corpus, because it is the bug class the repo has
already been bitten by three times on the `Result` path.

**If a test in Task 5 or 6 fails in a way that suggests the design is wrong**
rather than the code — for instance, if backoff proves unable to separate two
adjacent quantities — stop and report rather than widening `maxSpan` or adding a
special case. The spec is the thing to change first.

**Do not add cue tables to locales other than English.** The mechanism is
language-neutral and the tables are not; §7 of the spec records why.
