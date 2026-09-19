# `@smartput/chat` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@smartput/chat`, a package that reads a freeform chat message and decides whether it is a request, which resolver answers it, and which stretch of it is the payload — routing with a trained linear model and resolving with the engine.

**Architecture:** A pipeline `scan → carve → featurize → score → fill → resolve | abstain`. `carve` strips the carrier phrase a person wraps a request in and emits several candidate spans; `featurize` turns each candidate into named features plus hashed character n-grams, with `engine.suggest()` on the candidate as the load-bearing signal; a multinomial logistic model with an explicit `abstain` class picks a resolver or stays silent; unfilled holes (`"convert this to kg"`) are filled from a bounded `Conversation` ring, using the required kind as the filter.

**Tech Stack:** TypeScript, Bun (test runner, bundler), `@smartput/core` (types + injected `Engine`), `@smartput/kind` (errors, `Span`/`Value`/`KindId`), Biome.

**Spec:** `docs/superpowers/specs/2026-09-19-chat-resolver-design.md`

## Global Constraints

- Runtime dependencies are exactly `@smartput/core` and `@smartput/kind`. `scripts/check-deps.ts` fails CI on any package with no entry in its `ALLOWED` map, and on any dependency not listed there.
- `@smartput/core` is reached through `import type` only from every shipping file. The root barrel must link no engine runtime and no `decimal.js`.
- Errors extend `SmartputError` imported from `@smartput/kind/errors`, never from `@smartput/core`'s root barrel. Naming one export from a barrel links what the barrel loaded to offer it — that import cost four entries in `check-size.ts` ~33 KB of unused `decimal.js`.
- Test files are `*.test.ts` colocated beside the source, run with `bun test`. Shared test setup that needs kind packages goes in a `*.fixture.ts`. `check-deps.ts` skips both suffixes, so kind packages used only by tests belong in `devDependencies`.
- Commit subjects are Conventional Commits: `type(scope): subject`, scope `chat` (valid once `packages/chat/` exists) or one of `repo, ci, deps, docs, scripts, release`. Max 72 chars, no leading capital, no trailing full stop. `bun run check-commits` enforces it.
- `scripts/build.ts` discovers build entries from each package's `exports` map, so a new subpath needs no registration anywhere — but a subpath whose `bun` source file is missing fails the build.
- Every published locale weight table gets a row in `scripts/check-size.ts`'s `BUDGETS`, which guards both a ceiling and a floor.
- Full gate before any task is called done: `bun run check` (lint, typecheck, check-deps, test, build, check-size).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/chat/package.json` | Manifest, `exports` map — every subpath in spec §3 |
| `packages/chat/tsconfig.json` | Extends `../../tsconfig.base.json` |
| `src/types.ts` | `Hole`, `Candidate`, `Filled`, `ChatResult`, `Resolver`, `ResolveCtx`, `ChatVocabulary` — shapes only, no logic |
| `src/errors.ts` | `ChatError` |
| `src/vocabulary.ts` | `chatEn`, `chatUk` |
| `src/carve.ts` | Carrier stripping, frame matching, multi-candidate output |
| `src/state.ts` | `Conversation` — bounded ring, kind-filtered lookup |
| `src/features.ts` | `probe`, `NAMED_FEATURES`, `namedFeatures`, `ngramFeatures`, `featurize` |
| `src/model.ts` | `WeightTable`, `LinearModel` — dequantise, score, softmax |
| `src/resolvers/evaluate.ts` | The `evaluate` resolver |
| `src/resolvers/convert.ts` | The `convert` resolver, including the hole form |
| `src/resolvers/index.ts` | `./resolvers` barrel |
| `src/chat.ts` | `ChatResolver` — wires the pipeline |
| `src/index.ts` | Root barrel |
| `src/locale/en.ts`, `src/locale/uk.ts` | Per-language `ChatVocabulary` re-export |
| `src/weights/en.json`, `src/weights/uk.json` | Trained tables, generated and committed |
| `src/weights/en.ts`, `src/weights/uk.ts` | Typed module wrapper over the JSON |
| `src/embed/index.ts` | Tier 2 — `Embedder`, `EmbeddingFeature`, `cosine` |
| `src/train/index.ts` | The trainer — `train()`, gradient descent, quantisation |
| `src/engine.fixture.ts` | Shared test engine (mass, length, duration, number) |
| `scripts/chat-train.ts` | Builds the corpus, calls `train()`, writes the weight tables |
| `scripts/chat-eval.ts` | Held-out precision/recall/abstain, fails against a baseline |

---

### Task 1: Package scaffold, shared types, and the error class

**Files:**
- Create: `packages/chat/package.json`, `packages/chat/tsconfig.json`
- Create: `packages/chat/src/types.ts`, `packages/chat/src/errors.ts`, `packages/chat/src/index.ts`
- Modify: `scripts/check-deps.ts` (the `ALLOWED` map)
- Test: `packages/chat/src/errors.test.ts`

**Interfaces:**
- Consumes: `SmartputError` from `@smartput/kind/errors`; `KindId`, `Span`, `Value` from `@smartput/kind/types`; `Engine`, `Mark`, `Result` from `@smartput/core` (type-only).
- Produces: every interface later tasks build against — `Hole`, `Candidate`, `Filled`, `ChatResult<T>`, `ResolveCtx`, `Resolver<T>`, `ChatVocabulary`, and `ChatError`.

- [ ] **Step 1: Create the manifest**

`packages/chat/package.json`. Only the `.` entry for now — a subpath whose source file does not exist yet fails `bun run build`, so each later task adds its own entry when it adds its file.

```json
{
  "name": "@smartput/chat",
  "version": "0.1.0",
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
    "@smartput/kind": "workspace:*"
  },
  "devDependencies": {
    "@smartput/kinds": "workspace:*"
  }
}
```

- [ ] **Step 2: Create the tsconfig**

`packages/chat/tsconfig.json`, identical in shape to every other package:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Register the package in check-deps**

In `scripts/check-deps.ts`, add to the `ALLOWED` map with a reason, matching the commentary style of the entries already there:

```ts
  // Chat reaches core for the `Engine` it is handed and the `Mark`s it reads,
  // both through `import type` — the root barrel links no engine runtime. The
  // dependency is declared all the same, because the injected engine is called
  // through core's contract and a type-only edge is not a promise the lockfile
  // keeps. `@smartput/kind` is the error base and the `Span`/`Value` shapes.
  "packages/chat/package.json": ["@smartput/core", "@smartput/kind"],
```

- [ ] **Step 4: Write the failing test for the error class**

`packages/chat/src/errors.test.ts`:

```ts
import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/kind/errors";
import { ChatError } from "./errors";

test("names the stage that failed", () => {
  const err = new ChatError("carve", "no vocabulary installed");
  expect(err.stage).toBe("carve");
  expect(err.message).toBe('Chat stage "carve" failed: no vocabulary installed');
  expect(err.name).toBe("ChatError");
});

test("extends SmartputError", () => {
  expect(new ChatError("score", "boom")).toBeInstanceOf(SmartputError);
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `bun test packages/chat/src/errors.test.ts`
Expected: FAIL — cannot resolve `./errors`.

- [ ] **Step 6: Write the error class**

`packages/chat/src/errors.ts`:

```ts
import { SmartputError } from "@smartput/kind/errors";

/**
 * A stage could not run at all — no vocabulary installed, a weight table whose
 * class list does not match the resolvers it was handed. Imported from
 * `@smartput/kind/errors` and not through `@smartput/core`'s root barrel: that
 * door links `decimal.js` for a class that needs none of it (design §10).
 *
 * A message that routes nowhere is NOT this. Routing failure is `null` from
 * `handle`, because "no resolver wanted it" is the expected outcome for most
 * of what arrives in a chat.
 */
export class ChatError extends SmartputError {
  readonly stage: string;

  constructor(stage: string, detail: string) {
    super(`Chat stage ${JSON.stringify(stage)} failed: ${detail}`, stage);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "ChatError";
    this.stage = stage;
  }
}
```

- [ ] **Step 7: Run the test and watch it pass**

Run: `bun test packages/chat/src/errors.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Write the shared types**

`packages/chat/src/types.ts`. No logic — these are the shapes every later task builds against.

```ts
import type { Engine, Mark, Result } from "@smartput/core";
import type { KindId, Span, Value } from "@smartput/kind/types";

/** A slot a candidate needs and the message did not supply. */
export interface Hole {
  readonly slot: string;
  /** The kind a value must have to fill this slot. The coreference filter. */
  readonly kind: KindId;
}

/**
 * One reading of what the message was asking, before anything scored it.
 *
 * `carve` emits several per message and never one: committing to a span before
 * any evidence is weighed is how a carver acquires a rule nobody can state
 * (design §4.2).
 */
export interface Candidate {
  /** Caller-relative, like `Mark.start`/`end` and never normalized. */
  readonly span: Span;
  /** `input.slice(span.start, span.end)`, carried so no caller re-slices. */
  readonly text: string;
  /** Which intent frame matched, if any. */
  readonly frame?: string;
  readonly holes: readonly Hole[];
  /** What was removed from each end, for the feature extractor to read. */
  readonly stripped: { readonly head: string; readonly tail: string };
}

/** A hole filled from conversation state. */
export interface Filled {
  readonly slot: string;
  readonly from: "state";
  readonly value: Value;
}

export interface ChatResult<T = Result> {
  readonly resolver: string;
  readonly payload: string;
  readonly span: Span;
  readonly result: T;
  readonly confidence: number;
  readonly filled: readonly Filled[];
}

/** What a resolver is handed. Deliberately not the conversation: a resolver
 * reads the values that were already filled for it, and never reaches back
 * into state to choose differently from what was scored. */
export interface ResolveCtx {
  readonly engine: Engine;
  readonly filled: readonly Filled[];
  readonly marks: readonly Mark[];
}

export interface Resolver<T = Result> {
  readonly id: string;
  /** Locale id -> the intent frames this resolver answers. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  /** Kinds whose presence argues for this resolver. */
  readonly kinds?: readonly KindId[];
  /** Tier 2 only: locale id -> example phrasings, embedded once at warm-up. */
  readonly prototypes?: Readonly<Record<string, readonly string[]>>;
  /** True when `resolve` returns a promise. Excluded from `handle` (design §5). */
  readonly async?: boolean;
  resolve(candidate: Candidate, ctx: ResolveCtx): T | Promise<T>;
}

export interface ChatVocabulary {
  readonly id: string;
  /** Head-only, like query's `leading`. */
  readonly greetings: readonly string[];
  readonly leading: readonly string[];
  /** Tail-only, like query's `trailing`. */
  readonly trailing: readonly string[];
  /** Words standing in for a prior value — "this", "that", "it". */
  readonly referents: readonly string[];
  /** Frame id -> spellings. `"convert" -> ["convert", "turn", "make"]`. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  readonly interrogatives: readonly string[];
}
```

- [ ] **Step 9: Write the root barrel**

`packages/chat/src/index.ts`:

```ts
// `@smartput/chat` — a chat message to a resolved value. The barrel exports
// shapes and the error class; every later task adds its own line here.
export { ChatError } from "./errors";
export type {
  Candidate,
  ChatResult,
  ChatVocabulary,
  Filled,
  Hole,
  ResolveCtx,
  Resolver,
} from "./types";
```

- [ ] **Step 10: Install and verify the gates**

```bash
bun install
bun run check-deps
bun run typecheck
bun test packages/chat
```
Expected: `check-deps` prints `@smartput/chat dependencies OK`, typecheck clean, 2 tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/chat scripts/check-deps.ts bun.lock
git commit -m "feat(chat): scaffold package, shared types and ChatError"
```

---

### Task 2: `Conversation` — the referent memory

**Files:**
- Create: `packages/chat/src/state.ts`
- Test: `packages/chat/src/state.test.ts`
- Modify: `packages/chat/src/index.ts` (export it)

**Interfaces:**
- Consumes: `KindId`, `Value` from `@smartput/kind/types`.
- Produces: `class Conversation { constructor(limit?: number); push(entry: ConversationEntry): void; last(kind?: KindId): Value | undefined; candidates(kind?: KindId): readonly Value[]; clear(): void; get size(): number }` and `interface ConversationEntry { readonly kind: KindId; readonly value: Value; readonly text: string }`.

Built before the feature extractor because one of the tier 0 features is "state holds a compatible value of the required kind", and that feature cannot be tested without this.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/state.test.ts`. `Value` is `{ kind, canonical, unit }` — a plain object is enough here, nothing in `Conversation` reads the `Decimal`.

```ts
import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import type { Value } from "@smartput/kind/types";
import { Conversation } from "./state";

const val = (kind: string, unit: string, n: number): Value => ({
  kind,
  canonical: new Decimal(n),
  unit,
});

test("last returns the most recent entry when no kind is named", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last()?.kind).toBe("length");
});

test("last filters by kind — the coreference resolver", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last("mass")?.unit).toBe("lb");
});

test("last returns undefined when no entry has the kind", () => {
  const c = new Conversation();
  c.push({ kind: "length", value: val("length", "m", 5), text: "5 m" });
  expect(c.last("mass")).toBeUndefined();
});

test("candidates returns every compatible value, most recent first", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  c.push({ kind: "mass", value: val("mass", "g", 2000), text: "2 kg" });
  const found = c.candidates("mass");
  expect(found.map((v) => v.unit)).toEqual(["g", "lb"]);
});

test("the ring is bounded and drops the oldest", () => {
  const c = new Conversation(2);
  c.push({ kind: "mass", value: val("mass", "g", 1), text: "a" });
  c.push({ kind: "mass", value: val("mass", "g", 2), text: "b" });
  c.push({ kind: "mass", value: val("mass", "g", 3), text: "c" });
  expect(c.size).toBe(2);
  expect(c.candidates("mass").map((v) => v.canonical.toString())).toEqual(["3", "2"]);
});

test("clear empties it", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "g", 1), text: "a" });
  c.clear();
  expect(c.size).toBe(0);
  expect(c.last()).toBeUndefined();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 3: Implement `Conversation`**

`packages/chat/src/state.ts`:

```ts
import type { KindId, Value } from "@smartput/kind/types";

export interface ConversationEntry {
  readonly kind: KindId;
  readonly value: Value;
  /** The surface the value was read from, kept for explanation and training. */
  readonly text: string;
}

/** Entries kept. Eight turns is far enough back for a referent to still mean
 * what the user thinks it means, and short enough that a stale value cannot
 * win a lookup a fresh one should have. */
const DEFAULT_LIMIT = 8;

/**
 * The referent memory, and the whole of it.
 *
 * Deliberately not a dialogue model: no turns, no roles, no intent history. A
 * hole carries the kind it needs, so `candidates(kind)` is the entire
 * coreference mechanism — "convert this to kg" needs a mass, and a state
 * holding one length and one mass has no contest to resolve (design §4.5).
 *
 * Most recent first everywhere, because a referent means the thing most
 * recently said and every caller wants the same order.
 */
export class Conversation {
  #entries: ConversationEntry[] = [];
  readonly #limit: number;

  constructor(limit: number = DEFAULT_LIMIT) {
    this.#limit = Math.max(1, limit);
  }

  push(entry: ConversationEntry): void {
    this.#entries.push(entry);
    if (this.#entries.length > this.#limit) {
      this.#entries = this.#entries.slice(-this.#limit);
    }
  }

  last(kind?: KindId): Value | undefined {
    return this.candidates(kind)[0];
  }

  candidates(kind?: KindId): readonly Value[] {
    const out: Value[] = [];
    for (let i = this.#entries.length - 1; i >= 0; i--) {
      const entry = this.#entries[i];
      if (entry === undefined) continue;
      if (kind === undefined || entry.kind === kind) out.push(entry.value);
    }
    return out;
  }

  clear(): void {
    this.#entries = [];
  }

  get size(): number {
    return this.#entries.length;
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/state.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Export from the barrel**

Add to `packages/chat/src/index.ts`:

```ts
export { Conversation, type ConversationEntry } from "./state";
```

- [ ] **Step 6: Commit**

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): add Conversation, the kind-filtered referent memory"
```

---

### Task 3: The vocabulary, and `chatEn`

**Files:**
- Create: `packages/chat/src/vocabulary.ts`, `packages/chat/src/locale/en.ts`
- Test: `packages/chat/src/vocabulary.test.ts`
- Modify: `packages/chat/package.json` (add `./locale/en`), `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `ChatVocabulary` from `./types`.
- Produces: `chatEn: ChatVocabulary`, and `export default chatEn` from `./locale/en`.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/vocabulary.test.ts`. These are table-integrity tests — the kind `@smartput/query`'s vocabulary earns, because a duplicate spelling across two frames is a routing bug that shows up as a mystery months later.

```ts
import { expect, test } from "bun:test";
import { chatEn } from "./vocabulary";

test("every spelling is lowercase and trimmed", () => {
  const all = [
    ...chatEn.greetings,
    ...chatEn.leading,
    ...chatEn.trailing,
    ...chatEn.referents,
    ...chatEn.interrogatives,
    ...Object.values(chatEn.frames).flat(),
  ];
  for (const word of all) {
    expect(word).toBe(word.toLowerCase().trim());
    expect(word.length).toBeGreaterThan(0);
  }
});

test("no spelling appears under two frames", () => {
  const seen = new Map<string, string>();
  for (const [frame, words] of Object.entries(chatEn.frames)) {
    for (const word of words) {
      const first = seen.get(word);
      expect(first === undefined || first === frame).toBe(true);
      seen.set(word, frame);
    }
  }
});

test("a referent is never also a frame spelling", () => {
  const frames = new Set(Object.values(chatEn.frames).flat());
  for (const ref of chatEn.referents) expect(frames.has(ref)).toBe(false);
});

test("names the convert frame, which the worked case needs", () => {
  expect(chatEn.frames.convert).toContain("convert");
  expect(chatEn.referents).toContain("this");
  expect(chatEn.trailing).toContain("please");
  expect(chatEn.greetings).toContain("hi");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/vocabulary.test.ts`
Expected: FAIL — cannot resolve `./vocabulary`.

- [ ] **Step 3: Write `chatEn`**

`packages/chat/src/vocabulary.ts`:

```ts
import type { ChatVocabulary } from "./types";

/**
 * English.
 *
 * The two end-restricted lists are lifted from `@smartput/query`'s vocabulary,
 * where `leading` is stripped only at the front and `trailing` only at the
 * tail, each for a reason that file writes out: dropped anywhere else,
 * "please" is free to swallow the operand in front of it. Chat lifts the same
 * rule from one resolver to all of them and adds the two forms query never had
 * to read — a greeting at the head, and an intent frame that names a target.
 *
 * `frames` keys are frame ids, not resolver ids: several resolvers may answer
 * one frame, and one resolver may answer several. The model decides which,
 * which is the whole reason frames carry no resolver name.
 */
export const chatEn: ChatVocabulary = {
  id: "en",
  greetings: ["hi", "hey", "hello", "yo", "morning", "good morning", "good evening"],
  // "whats" without the apostrophe is deliberate: `normalize` has not run on
  // this string, chat input is typed fast, and the elided form is what people
  // send. The apostrophised spellings sit beside it rather than replacing it.
  leading: [
    "what is",
    "what's",
    "whats",
    "how much is",
    "how many",
    "how long is",
    "how far is",
    "can you",
    "could you",
    "please",
    "tell me",
    "show me",
    "i need",
    "i want",
  ],
  trailing: ["please", "thanks", "thank you", "ty", "cheers", "pls"],
  referents: ["this", "that", "it", "the result", "the answer", "ans"],
  frames: {
    convert: ["convert", "turn", "change", "make"],
    compute: ["calculate", "compute", "work out", "evaluate"],
    compare: ["compare", "which is bigger", "which is more"],
  },
  interrogatives: ["what", "how", "which", "when", "where", "why", "who"],
};
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/vocabulary.test.ts`
Expected: PASS, 4 tests.

Note the deliberate overlap: `"please"` is in both `leading` and `trailing`. That is not a duplicate-spelling bug — the tests above forbid a spelling under two *frames*, not a politeness word at two ends, and "please convert this" and "convert this please" are both real.

- [ ] **Step 5: Add the locale entry point**

`packages/chat/src/locale/en.ts`:

```ts
// `@smartput/chat/locale/en` — English carrier vocabulary, on its own subpath
// so a consumer reading one language links only that one's words.
export { chatEn as default, chatEn } from "../vocabulary";
```

Add to `packages/chat/package.json`'s `exports`, after the `.` entry:

```json
    "./locale/en": {
      "bun": "./src/locale/en.ts",
      "types": "./dist/locale/en.d.ts",
      "default": "./dist/locale/en.js"
    }
```

- [ ] **Step 6: Export from the barrel and verify the build sees the subpath**

Add to `packages/chat/src/index.ts`:

```ts
export { chatEn } from "./vocabulary";
```

Run: `bun run build && bun run typecheck && bun test packages/chat`
Expected: build reports the new entry, typecheck clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/chat
git commit -m "feat(chat): add the English carrier vocabulary"
```

---

### Task 4: `carve` — strip the carrier, emit candidates

**Files:**
- Create: `packages/chat/src/carve.ts`
- Test: `packages/chat/src/carve.test.ts`
- Modify: `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `Candidate`, `ChatVocabulary`, `Hole` from `./types`.
- Produces: `function carve(input: string, vocabs: readonly ChatVocabulary[]): Candidate[]`.

No engine here. `carve` is a pure string function over the vocabulary, which is what makes it the cheapest thing in the package to test exhaustively.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/carve.test.ts`:

```ts
import { expect, test } from "bun:test";
import { carve } from "./carve";
import { chatEn } from "./vocabulary";

const en = [chatEn];

test("strips a greeting at the head and politeness at the tail", () => {
  const [top] = carve("Hi, convert this to kg please", en);
  expect(top?.stripped.head).toBe("hi,");
  expect(top?.stripped.tail).toBe("please");
  expect(top?.text).toBe("convert this to kg");
});

test("spans index the caller's string", () => {
  const input = "Hi, convert this to kg please";
  const [top] = carve(input, en);
  expect(input.slice(top?.span.start ?? 0, top?.span.end ?? 0)).toBe(top?.text);
});

test("matches the convert frame and records the hole the referent leaves", () => {
  const [top] = carve("convert this to kg", en);
  expect(top?.frame).toBe("convert");
  expect(top?.holes).toHaveLength(1);
  expect(top?.holes[0]?.slot).toBe("source");
});

test("a referent with no frame still leaves a hole", () => {
  const [top] = carve("that in kg", en);
  expect(top?.holes.map((h) => h.slot)).toContain("source");
});

test("leaves a message with its own operand hole-free", () => {
  const [top] = carve("convert 5 lb to kg", en);
  expect(top?.holes).toHaveLength(0);
});

test("emits several candidates and never one", () => {
  const found = carve("what is 2 + 2", en);
  expect(found.length).toBeGreaterThan(1);
  expect(found.map((c) => c.text)).toContain("2 + 2");
});

test("the unstripped whole message is always a candidate", () => {
  const input = "what is 2 + 2";
  expect(carve(input, en).map((c) => c.text)).toContain(input);
});

test("a stripped word never eats an operand beside it", () => {
  // "it" is a referent; "5 it" is not a thing, and stripping mid-string would
  // make it one. Referents are recognised, never removed.
  const [top] = carve("convert 5 lb to it", en);
  expect(top?.text).toContain("5 lb");
});

test("strips nothing from a message with no carrier", () => {
  const [top] = carve("2 + 2", en);
  expect(top?.stripped).toEqual({ head: "", tail: "" });
  expect(top?.text).toBe("2 + 2");
});

test("returns a single whole-input candidate for empty vocabulary", () => {
  const found = carve("2 + 2", []);
  expect(found).toHaveLength(1);
  expect(found[0]?.text).toBe("2 + 2");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/carve.test.ts`
Expected: FAIL — cannot resolve `./carve`.

- [ ] **Step 3: Implement `carve`**

`packages/chat/src/carve.ts`:

```ts
import type { Candidate, ChatVocabulary, Hole } from "./types";

/** Phrases are matched against a case-folded copy; spans index the original. */
const fold = (s: string) => s.toLowerCase();

/** Trailing punctuation a stripped head may carry — "hi," and "hey!". */
const HEAD_PUNCT = /^[,!.:;\s]+/;

/** Characters that may sit either side of a matched phrase. */
const BOUND = /[\s,!.:;]/;

/**
 * The longest listed phrase `text` starts with, ending at a word boundary.
 *
 * Longest-first because "what is" must beat "what": a shorter prefix winning
 * would leave "is" at the head of the payload, and `engine.suggest` would
 * reject the span that was otherwise correct.
 */
function matchAtHead(text: string, phrases: readonly string[]): string | undefined {
  const folded = fold(text);
  let best: string | undefined;
  for (const phrase of phrases) {
    if (!folded.startsWith(phrase)) continue;
    const after = folded.charAt(phrase.length);
    if (after !== "" && !BOUND.test(after)) continue;
    if (best === undefined || phrase.length > best.length) best = phrase;
  }
  return best;
}

/** Same, at the tail. */
function matchAtTail(text: string, phrases: readonly string[]): string | undefined {
  const folded = fold(text);
  let best: string | undefined;
  for (const phrase of phrases) {
    if (!folded.endsWith(phrase)) continue;
    const before = folded.charAt(folded.length - phrase.length - 1);
    if (before !== "" && !BOUND.test(before)) continue;
    if (best === undefined || phrase.length > best.length) best = phrase;
  }
  return best;
}

/** Which frame, if any, the span opens with. */
function frameOf(text: string, vocabs: readonly ChatVocabulary[]): string | undefined {
  for (const vocab of vocabs) {
    for (const [frame, spellings] of Object.entries(vocab.frames)) {
      if (matchAtHead(text, spellings) !== undefined) return frame;
    }
  }
  return undefined;
}

/**
 * Referents are RECOGNISED and never removed.
 *
 * Stripping "this" out of "convert this to kg" would leave "convert to kg",
 * which reads as a complete instruction and is not one. The word is the
 * evidence that a slot is empty, so it stays in the text and the emptiness
 * becomes a `Hole` beside it.
 */
function holesOf(text: string, vocabs: readonly ChatVocabulary[]): Hole[] {
  const folded = fold(text);
  for (const vocab of vocabs) {
    for (const ref of vocab.referents) {
      const at = folded.indexOf(ref);
      if (at < 0) continue;
      const before = folded.charAt(at - 1);
      const after = folded.charAt(at + ref.length);
      const ok = (c: string) => c === "" || BOUND.test(c);
      if (!ok(before) || !ok(after)) continue;
      // The kind is left open here and narrowed by the target unit at fill
      // time: "to kg" is what says this hole is a mass, and that word has not
      // been read yet. `""` means "any kind"; `fill` replaces it.
      return [{ slot: "source", kind: "" }];
    }
  }
  return [];
}

/**
 * Strip the carrier phrase and emit every span the message could have meant.
 *
 * Head-only and tail-only, each for the reason `@smartput/query`'s vocabulary
 * writes out: a politeness word dropped anywhere else is free to swallow the
 * operand in front of it.
 *
 * The whole unstripped input is always among the results, and the result is
 * sorted shortest-span-first so the most-stripped reading leads. A message
 * that looks like a carrier and is not — "convert" as a surname, "it" as an
 * ordinary pronoun — must still have a candidate the model can score, and the
 * cheapest way to guarantee that is never to drop the original.
 */
export function carve(input: string, vocabs: readonly ChatVocabulary[]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const emit = (start: number, end: number, head: string, tail: string): void => {
    if (end <= start) return;
    const key = `${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    const text = input.slice(start, end);
    out.push({
      span: { start, end },
      text,
      frame: frameOf(text, vocabs),
      holes: holesOf(text, vocabs),
      stripped: { head, tail },
    });
  };

  // Always first: the message as sent.
  emit(0, input.length, "", "");

  let start = 0;
  let end = input.length;
  let head = "";
  let tail = "";

  // Head — greetings, then openers, each removed at most once. Two passes and
  // not a loop: a loop would let a message made entirely of carrier words strip
  // itself to nothing, and "hi hi hi convert" is not a message anyone sends.
  for (const list of [
    vocabs.flatMap((v) => v.greetings),
    vocabs.flatMap((v) => v.leading),
  ]) {
    const slice = input.slice(start, end);
    const lead = slice.length - slice.trimStart().length;
    const hit = matchAtHead(slice.trimStart(), list);
    if (hit === undefined) continue;
    const rest = slice.trimStart().slice(hit.length);
    const punct = HEAD_PUNCT.exec(rest)?.[0].length ?? 0;
    const removed = fold(slice.slice(lead, lead + hit.length + punct)).trim();
    head = head === "" ? removed : `${head} ${removed}`;
    start += lead + hit.length + punct;
    emit(start, end, head, tail);
  }

  // Tail — once.
  const slice = input.slice(start, end);
  const trimmed = slice.trimEnd();
  const hit = matchAtTail(trimmed, vocabs.flatMap((v) => v.trailing));
  if (hit !== undefined) {
    tail = fold(trimmed.slice(trimmed.length - hit.length));
    end = start + trimmed.length - hit.length;
    // Drop the separator the politeness word hung off.
    while (end > start && BOUND.test(input.charAt(end - 1))) end--;
    emit(start, end, head, tail);
  }

  // Most-stripped first: the shortest span is the one a human would name as
  // "the request", and every caller that destructures `[top]` wants it.
  return out.sort((a, b) => a.text.length - b.text.length);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/carve.test.ts`
Expected: PASS, 10 tests.

If "emits several candidates" returns one, the `emit` dedupe key collided — check that stripping actually advanced `start`.

- [ ] **Step 5: Export from the barrel and commit**

Add to `packages/chat/src/index.ts`:

```ts
export { carve } from "./carve";
```

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): carve the carrier phrase off a message"
```

---

### Task 5: The test engine, `probe`, and the tier 0 features

**Files:**
- Create: `packages/chat/src/engine.fixture.ts`, `packages/chat/src/features.ts`
- Test: `packages/chat/src/features.test.ts`
- Modify: `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `Candidate` from `./types`, `Conversation` from `./state`, `Engine` and `Mark` (type-only) from `@smartput/core`.
- Produces: `interface Probe`, `function probe(engine: Engine, text: string): Probe`, `const NAMED_FEATURES`, `interface FeatureInput`, `function namedFeatures(inp: FeatureInput): Float64Array`.

- [ ] **Step 1: Write the shared test engine**

`packages/chat/src/engine.fixture.ts`. The `.fixture.ts` suffix is load-bearing: `check-deps.ts` skips both `.test.ts` and `.fixture.ts` when deciding what the shipping source imports, which is what lets this file reach kind packages that are only `devDependencies`. `@smartput/query` keeps its worked schema in the same kind of file for the same reason.

```ts
import type { Engine } from "@smartput/core";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

/** One engine, every built-in kind, English in and English out. */
export function testEngine(): Engine {
  return createEngine({
    locales: [composeLocale(english, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
}
```

- [ ] **Step 2: Write the failing tests**

`packages/chat/src/features.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "./carve";
import { testEngine } from "./engine.fixture";
import type { FeatureInput } from "./features";
import { NAMED_FEATURES, namedFeatures, probe } from "./features";
import { Conversation } from "./state";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const en = [chatEn];

const inputFor = (text: string, conversation = new Conversation()): FeatureInput => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return {
    input: text,
    candidate,
    marks: engine.scan(text),
    probe: probe(engine, candidate.text),
    conversation,
  };
};

const at = (v: Float64Array, name: string): number => {
  const i = NAMED_FEATURES.indexOf(name as (typeof NAMED_FEATURES)[number]);
  if (i < 0) throw new Error(`no feature named ${name}`);
  return v[i] ?? 0;
};

test("probe says a carved payload resolves and a carrier fragment does not", () => {
  expect(probe(engine, "2 + 2").resolves).toBe(true);
  expect(probe(engine, "is 2 + 2").resolves).toBe(false);
});

test("probe never throws on an ambiguous payload", () => {
  const p = probe(engine, "10 m");
  expect(p.resolves).toBe(true);
  expect(p.count).toBeGreaterThan(1);
});

test("the feature vector is the length of the name list", () => {
  expect(namedFeatures(inputFor("what is 2 + 2"))).toHaveLength(NAMED_FEATURES.length);
});

test("probeResolves fires on a carved payload", () => {
  expect(at(namedFeatures(inputFor("what is 2 + 2")), "probeResolves")).toBe(1);
});

test("frameMatched fires on a frame and not on plain arithmetic", () => {
  expect(at(namedFeatures(inputFor("convert 5 lb to kg")), "frameMatched")).toBe(1);
  expect(at(namedFeatures(inputFor("2 + 2")), "frameMatched")).toBe(0);
});

test("greetingStripped and politenessStripped read carve's record", () => {
  const v = namedFeatures(inputFor("Hi, convert 5 lb to kg please"));
  expect(at(v, "greetingStripped")).toBe(1);
  expect(at(v, "politenessStripped")).toBe(1);
});

test("holePresent fires on a referent", () => {
  expect(at(namedFeatures(inputFor("convert this to kg")), "holePresent")).toBe(1);
});

test("stateHasCompatible is 0 on an empty conversation and 1 on a match", () => {
  expect(at(namedFeatures(inputFor("convert this to kg")), "stateHasCompatible")).toBe(0);

  const conversation = new Conversation();
  conversation.push({
    kind: "mass",
    value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
    text: "5 pounds",
  });
  const v = namedFeatures(inputFor("convert this to kg", conversation));
  expect(at(v, "stateHasCompatible")).toBe(1);
});

test("markCount and topConfidence read the scan", () => {
  const v = namedFeatures(inputFor("5 kg"));
  expect(at(v, "markCount")).toBeGreaterThan(0);
  expect(at(v, "topConfidence")).toBeGreaterThan(0);
});

test("bias is always 1", () => {
  expect(at(namedFeatures(inputFor("anything at all")), "bias")).toBe(1);
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `bun test packages/chat/src/features.test.ts`
Expected: FAIL — cannot resolve `./features`.

- [ ] **Step 4: Implement `probe` and the named features**

`packages/chat/src/features.ts`:

```ts
import type { Engine, Mark } from "@smartput/core";
import type { KindId } from "@smartput/kind/types";
import type { Conversation } from "./state";
import type { Candidate } from "./types";

/**
 * What `engine.suggest` said about a candidate span on its own.
 *
 * `suggest` and not `evaluate`: it never throws, and ambiguity is the signal
 * wanted here rather than an error to catch. This is the load-bearing feature
 * of the whole model — "2 + 2" resolves and "is 2 + 2" does not, so carving
 * checks itself against the engine and the classifier only has to learn which
 * frame introduced a payload (design §4.3).
 */
export interface Probe {
  readonly resolves: boolean;
  readonly confidence: number;
  readonly kind?: KindId;
  /** Readings returned. Greater than 1 is ambiguity, which is evidence. */
  readonly count: number;
}

export function probe(engine: Engine, text: string): Probe {
  const trimmed = text.trim();
  if (trimmed === "") return { resolves: false, confidence: 0, count: 0 };
  const found = engine.suggest(trimmed);
  const top = found[0];
  if (top === undefined) return { resolves: false, confidence: 0, count: 0 };
  return { resolves: true, confidence: top.confidence, kind: top.kind, count: found.length };
}

export interface FeatureInput {
  readonly input: string;
  readonly candidate: Candidate;
  readonly marks: readonly Mark[];
  readonly probe: Probe;
  readonly conversation: Conversation;
}

/**
 * The named rows, in a fixed order the weight table's columns match.
 *
 * Kind identity is deliberately NOT here. A named row per kind would fix the
 * vector's length to the kinds installed when the model was trained, and kinds
 * are registered at runtime — a consumer's own `defineKind` has to be routable
 * by a table trained before it existed (design §1.1). Kind identity goes into
 * the hashed space instead, where an unseen name costs a bucket rather than a
 * shape mismatch.
 *
 * Appending to this list invalidates every trained table: adding a row means
 * re-running `bun run chat:train`.
 */
export const NAMED_FEATURES = [
  "bias",
  "markCount",
  "topConfidence",
  "confidenceMargin",
  "cueCount",
  "frameMatched",
  "greetingStripped",
  "politenessStripped",
  "leadingInterrogative",
  "payloadRatio",
  "probeResolves",
  "probeConfidence",
  "probeReadingCount",
  "holePresent",
  "stateHasCompatible",
] as const;

const INTERROGATIVE = /^\s*(what|how|which|when|where|why|who)\b/i;

/** Squash an unbounded count into [0, 1) so one long message cannot dominate. */
const squash = (n: number) => n / (n + 1);

export function namedFeatures(inp: FeatureInput): Float64Array {
  const { candidate, marks, probe: p, conversation } = inp;
  const top = marks[0]?.readings[0]?.confidence ?? 0;
  const second = marks[0]?.readings[1]?.confidence ?? 0;
  const cues = marks.reduce((n, m) => n + m.cues.length, 0);
  const hole = candidate.holes[0];
  // An empty `kind` means "any": carve could not know it yet, so a conversation
  // holding anything at all is compatible. `fill` narrows it later.
  const compatible =
    hole === undefined
      ? false
      : hole.kind === ""
        ? conversation.size > 0
        : conversation.last(hole.kind) !== undefined;

  const v = new Float64Array(NAMED_FEATURES.length);
  const set = (name: (typeof NAMED_FEATURES)[number], value: number) => {
    v[NAMED_FEATURES.indexOf(name)] = value;
  };

  set("bias", 1);
  set("markCount", squash(marks.length));
  set("topConfidence", top);
  set("confidenceMargin", top - second);
  set("cueCount", squash(cues));
  set("frameMatched", candidate.frame === undefined ? 0 : 1);
  set("greetingStripped", candidate.stripped.head === "" ? 0 : 1);
  set("politenessStripped", candidate.stripped.tail === "" ? 0 : 1);
  // Reads the WHOLE input and not the candidate: the word this looks for is the
  // one `carve` just removed, so reading the stripped span would pin it to zero.
  set("leadingInterrogative", INTERROGATIVE.test(inp.input) ? 1 : 0);
  set("payloadRatio", inp.input.length === 0 ? 0 : candidate.text.length / inp.input.length);
  set("probeResolves", p.resolves ? 1 : 0);
  set("probeConfidence", p.confidence);
  set("probeReadingCount", squash(p.count));
  set("holePresent", candidate.holes.length === 0 ? 0 : 1);
  set("stateHasCompatible", compatible ? 1 : 0);

  return v;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `bun test packages/chat/src/features.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): add the engine probe and the tier 0 features"
```

---

### Task 6: Tier 1 — hashed character n-grams

**Files:**
- Modify: `packages/chat/src/features.ts`, `packages/chat/src/index.ts`
- Test: `packages/chat/src/features.test.ts` (append)

**Interfaces:**
- Produces: `const NGRAM_BUCKETS = 2048`, `function carrierOf(inp: FeatureInput): string`, `function ngramFeatures(carrier: string): Map<number, number>`, `interface FeatureVector { readonly named: Float64Array; readonly hashed: ReadonlyMap<number, number> }`, `function featurize(inp: FeatureInput): FeatureVector`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/chat/src/features.test.ts`. Extend the existing import of `./features` to add the four new names rather than writing a second import line — Biome's lint fails on duplicate imports from one module.

```ts
test("hashing is stable across calls", () => {
  const a = [...ngramFeatures("can you convert").entries()].sort();
  const b = [...ngramFeatures("can you convert").entries()].sort();
  expect(a).toEqual(b);
});

test("every bucket is in range", () => {
  for (const bucket of ngramFeatures("could you maybe make that into kilos").keys()) {
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(NGRAM_BUCKETS);
  }
});

test("paraphrases share buckets without either being listed", () => {
  const a = new Set(ngramFeatures("can you convert that to kg").keys());
  const b = new Set(ngramFeatures("could you convert that into kg").keys());
  expect([...a].filter((k) => b.has(k)).length).toBeGreaterThan(5);
});

test("the carrier excludes the payload", () => {
  const carrier = carrierOf(inputFor("Hi, convert 5 lb to kg please"));
  expect(carrier).not.toContain("5 lb");
  expect(carrier).toContain("hi");
  expect(carrier).toContain("please");
});

test("the carrier carries the kind names the scan found", () => {
  expect(carrierOf(inputFor("convert 5 lb to kg"))).toContain("kind:mass");
});

test("featurize returns both halves", () => {
  const v = featurize(inputFor("what is 2 + 2"));
  expect(v.named).toHaveLength(NAMED_FEATURES.length);
  expect(v.hashed.size).toBeGreaterThan(0);
});

test("an empty carrier hashes to nothing rather than throwing", () => {
  expect(ngramFeatures("").size).toBe(0);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/features.test.ts`
Expected: FAIL — `carrierOf` is not exported from `./features`.

- [ ] **Step 3: Implement the hashing half**

Append to `packages/chat/src/features.ts`:

```ts
/**
 * Fixed, so the table has the same shape in every language: a locale with a
 * longer phrase list must not produce a larger model. 2048 buckets × one row
 * per class, int8-quantised, is ~2 KB per class (design §4.3).
 */
export const NGRAM_BUCKETS = 2048;

/**
 * FNV-1a, 32-bit.
 *
 * Stable across runs and processes, which a trained table depends on
 * absolutely: a different hash function is a different model, and the failure
 * mode is silent — every weight lands on the wrong bucket and the router
 * merely gets worse.
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % NGRAM_BUCKETS;
}

/**
 * The text the n-grams are taken over: the carrier, never the payload.
 *
 * Putting the payload's characters in a bag would teach the router to
 * recognise units it should be asking the engine about — and to fail on the
 * ones it never saw, which is the failure the engine exists to prevent
 * (design §4.3).
 *
 * The kinds the scan found are appended as `kind:<id>` tokens. That is how
 * kind identity reaches the model without a named row per kind, and it is what
 * lets a runtime-registered kind be routed by a table trained before it
 * existed.
 */
export function carrierOf(inp: FeatureInput): string {
  const { candidate } = inp;
  const before = inp.input.slice(0, candidate.span.start);
  const after = inp.input.slice(candidate.span.end);
  const frame = candidate.frame === undefined ? "" : ` frame:${candidate.frame}`;
  const kinds = [...new Set(inp.marks.map((m) => m.readings[0]?.kind))]
    .filter((k): k is string => k !== undefined)
    .sort()
    .map((k) => ` kind:${k}`)
    .join("");
  return `${before} ${after}${frame}${kinds}`.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Character 3-, 4- and 5-grams, hashed, counts squashed to [0, 1). */
export function ngramFeatures(carrier: string): Map<number, number> {
  const out = new Map<number, number>();
  if (carrier === "") return out;
  const padded = ` ${carrier} `;
  for (const n of [3, 4, 5]) {
    for (let i = 0; i + n <= padded.length; i++) {
      const bucket = hash(padded.slice(i, i + n));
      out.set(bucket, (out.get(bucket) ?? 0) + 1);
    }
  }
  for (const [bucket, count] of out) out.set(bucket, squash(count));
  return out;
}

export interface FeatureVector {
  readonly named: Float64Array;
  readonly hashed: ReadonlyMap<number, number>;
}

export function featurize(inp: FeatureInput): FeatureVector {
  return { named: namedFeatures(inp), hashed: ngramFeatures(carrierOf(inp)) };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/features.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Export from the barrel and commit**

Add to `packages/chat/src/index.ts`:

```ts
export type { FeatureInput, FeatureVector, Probe } from "./features";
export {
  carrierOf,
  featurize,
  NAMED_FEATURES,
  namedFeatures,
  NGRAM_BUCKETS,
  ngramFeatures,
  probe,
} from "./features";
```

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): hash the carrier into n-gram features"
```

---

### Task 7: `LinearModel` — the trained table and the score

**Files:**
- Create: `packages/chat/src/model.ts`
- Test: `packages/chat/src/model.test.ts`
- Modify: `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `FeatureVector`, `NAMED_FEATURES`, `NGRAM_BUCKETS` from `./features`; `ChatError` from `./errors`.
- Produces: `interface WeightTable`, `interface EmbedScores { readonly centroid: number; readonly max: number }`, `class LinearModel { static from(table: WeightTable): LinearModel; readonly classes: readonly string[]; score(v: FeatureVector, embed?: ReadonlyMap<string, EmbedScores>): Map<string, number> }`, `const ABSTAIN = "abstain"`.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/model.test.ts`:

```ts
import { expect, test } from "bun:test";
import { ChatError } from "./errors";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";
import type { FeatureVector } from "./features";
import { ABSTAIN, LinearModel } from "./model";
import type { WeightTable } from "./model";

const zeros = () => new Array(NAMED_FEATURES.length).fill(0) as number[];

/** A table with two classes and no hashed weights. */
const table = (named: Record<string, number[]>): WeightTable => {
  const classes = Object.keys(named);
  return {
    locale: "en",
    features: [...NAMED_FEATURES],
    buckets: NGRAM_BUCKETS,
    classes,
    named: classes.map((c) => named[c] ?? zeros()),
    hashed: Buffer.alloc(classes.length * NGRAM_BUCKETS).toString("base64"),
    hashedScale: classes.map(() => 1),
  };
};

const vector = (named: number[]): FeatureVector => ({
  named: Float64Array.from(named),
  hashed: new Map(),
});

const withFeature = (name: string, value: number): number[] => {
  const v = zeros();
  v[NAMED_FEATURES.indexOf(name as (typeof NAMED_FEATURES)[number])] = value;
  return v;
};

test("scores every class and the probabilities sum to one", () => {
  const model = LinearModel.from(table({ convert: zeros(), [ABSTAIN]: zeros() }));
  const scores = model.score(vector(zeros()));
  expect([...scores.keys()].sort()).toEqual([ABSTAIN, "convert"]);
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  expect(total).toBeCloseTo(1, 10);
});

test("a class whose weight matches the firing feature wins", () => {
  const model = LinearModel.from(
    table({ convert: withFeature("frameMatched", 4), [ABSTAIN]: zeros() }),
  );
  const scores = model.score(vector(withFeature("frameMatched", 1)));
  expect((scores.get("convert") ?? 0) > (scores.get(ABSTAIN) ?? 0)).toBe(true);
});

test("abstain wins when nothing argues for a resolver", () => {
  const model = LinearModel.from(
    table({ convert: withFeature("frameMatched", 4), [ABSTAIN]: withFeature("bias", 1) }),
  );
  const scores = model.score(vector(withFeature("bias", 1)));
  expect((scores.get(ABSTAIN) ?? 0) > (scores.get("convert") ?? 0)).toBe(true);
});

test("hashed weights move the score", () => {
  const classes = ["convert", ABSTAIN];
  const q = Buffer.alloc(classes.length * NGRAM_BUCKETS);
  q[7] = 100; // class 0, bucket 7
  const model = LinearModel.from({
    ...table({ convert: zeros(), [ABSTAIN]: zeros() }),
    hashed: q.toString("base64"),
    hashedScale: [0.05, 0.05],
  });
  const plain = model.score({ named: Float64Array.from(zeros()), hashed: new Map() });
  const hit = model.score({ named: Float64Array.from(zeros()), hashed: new Map([[7, 1]]) });
  expect((hit.get("convert") ?? 0) > (plain.get("convert") ?? 0)).toBe(true);
});

test("embed scores are added to the same logits when the table carries weights", () => {
  const base = table({ convert: zeros(), [ABSTAIN]: zeros() });
  const model = LinearModel.from({ ...base, embed: [[3, 1], [0, 0]] });
  const without = model.score(vector(zeros()));
  const with_ = model.score(
    vector(zeros()),
    new Map([["convert", { centroid: 0.9, max: 0.95 }]]),
  );
  expect((with_.get("convert") ?? 0) > (without.get("convert") ?? 0)).toBe(true);
});

test("rejects a table whose feature list does not match this build", () => {
  const bad = { ...table({ convert: zeros() }), features: ["bias"] };
  expect(() => LinearModel.from(bad)).toThrow(ChatError);
});

test("rejects a table whose bucket count does not match this build", () => {
  const bad = { ...table({ convert: zeros() }), buckets: 64 };
  expect(() => LinearModel.from(bad)).toThrow(ChatError);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/model.test.ts`
Expected: FAIL — cannot resolve `./model`.

- [ ] **Step 3: Implement the model**

`packages/chat/src/model.ts`:

```ts
import { ChatError } from "./errors";
import type { FeatureVector } from "./features";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";

/**
 * The class a router needs and a "least bad resolver" scorer cannot express.
 *
 * Most chat messages are not requests, so abstain is trained as a class rather
 * than bolted on as a threshold: a model that can only rank resolvers against
 * each other will answer every greeting in the room (design §4.4).
 */
export const ABSTAIN = "abstain";

/** Tier 2's two rows per class, from `EmbeddingFeature`. */
export interface EmbedScores {
  readonly centroid: number;
  readonly max: number;
}

/**
 * A trained table, as `src/weights/<locale>.json` holds it.
 *
 * `features` and `buckets` are recorded rather than assumed: a table trained
 * before a feature row was added is not merely stale, it is silently wrong —
 * every weight after the inserted row lands on the wrong column. Recording
 * both turns that into a startup error.
 */
export interface WeightTable {
  readonly locale: string;
  /** Must equal `NAMED_FEATURES` for this build. */
  readonly features: readonly string[];
  /** Must equal `NGRAM_BUCKETS` for this build. */
  readonly buckets: number;
  /** Resolver ids plus `ABSTAIN`. */
  readonly classes: readonly string[];
  /** `[class][namedFeature]`. */
  readonly named: readonly (readonly number[])[];
  /** int8, class-major, base64 — `classes.length * buckets` bytes. */
  readonly hashed: string;
  /** Per-class dequantisation scale. */
  readonly hashedScale: readonly number[];
  /** Tier 2, optional: `[class] -> [centroidWeight, maxWeight]`. */
  readonly embed?: readonly (readonly [number, number])[];
}

/**
 * Multinomial logistic regression over the named rows, the hashed buckets and
 * — when a table was trained with them — tier 2's two embedding rows.
 *
 * One model and one decision path. Tier 2 contributes features here rather
 * than scoring in parallel, because two routers disagreeing need a tiebreak
 * rule and there is no honest place to put one (design §7).
 */
export class LinearModel {
  readonly classes: readonly string[];
  readonly #named: readonly (readonly number[])[];
  readonly #hashed: Int8Array;
  readonly #scale: readonly number[];
  readonly #embed: readonly (readonly [number, number])[] | undefined;

  private constructor(table: WeightTable, hashed: Int8Array) {
    this.classes = table.classes;
    this.#named = table.named;
    this.#hashed = hashed;
    this.#scale = table.hashedScale;
    this.#embed = table.embed;
  }

  static from(table: WeightTable): LinearModel {
    if (table.features.join(",") !== NAMED_FEATURES.join(",")) {
      throw new ChatError(
        "model",
        `weight table lists ${table.features.length} features, this build has ${NAMED_FEATURES.length}; retrain with \`bun run chat:train\``,
      );
    }
    if (table.buckets !== NGRAM_BUCKETS) {
      throw new ChatError(
        "model",
        `weight table has ${table.buckets} hash buckets, this build has ${NGRAM_BUCKETS}`,
      );
    }
    const bytes = Uint8Array.from(atob(table.hashed), (c) => c.charCodeAt(0));
    const expected = table.classes.length * table.buckets;
    if (bytes.length !== expected) {
      throw new ChatError(
        "model",
        `weight table has ${bytes.length} hashed bytes, expected ${expected}`,
      );
    }
    return new LinearModel(table, new Int8Array(bytes.buffer));
  }

  score(v: FeatureVector, embed?: ReadonlyMap<string, EmbedScores>): Map<string, number> {
    const logits = this.classes.map((id, c) => {
      const named = this.#named[c] ?? [];
      let sum = 0;
      for (let f = 0; f < NAMED_FEATURES.length; f++) {
        sum += (named[f] ?? 0) * (v.named[f] ?? 0);
      }
      const scale = this.#scale[c] ?? 0;
      const base = c * NGRAM_BUCKETS;
      for (const [bucket, value] of v.hashed) {
        sum += (this.#hashed[base + bucket] ?? 0) * scale * value;
      }
      const weights = this.#embed?.[c];
      const scores = embed?.get(id);
      if (weights !== undefined && scores !== undefined) {
        sum += weights[0] * scores.centroid + weights[1] * scores.max;
      }
      return sum;
    });

    // Softmax, shifted by the max so a large logit cannot overflow `exp`.
    const top = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - top));
    const total = exps.reduce((a, b) => a + b, 0);
    const out = new Map<string, number>();
    this.classes.forEach((id, c) => out.set(id, (exps[c] ?? 0) / total));
    return out;
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/model.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Export and commit**

Add to `packages/chat/src/index.ts`:

```ts
export type { EmbedScores, WeightTable } from "./model";
export { ABSTAIN, LinearModel } from "./model";
```

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): add the linear model and its weight table"
```

---

### Task 8: `fill` — narrow a hole and take a value from state

**Files:**
- Create: `packages/chat/src/fill.ts`
- Modify: `packages/chat/src/state.ts` (add `entries`), `packages/chat/src/types.ts` (`Filled.text`), `packages/chat/src/index.ts`
- Test: `packages/chat/src/fill.test.ts`, `packages/chat/src/state.test.ts` (append)

**Interfaces:**
- Consumes: `Candidate`, `Filled` from `./types`; `Conversation`, `ConversationEntry` from `./state`; `Mark` (type-only).
- Produces: `function targetKindOf(candidate: Candidate, marks: readonly Mark[]): KindId | undefined`, `function fill(candidate: Candidate, marks: readonly Mark[], conversation: Conversation): Filled[]`; `Conversation.entries(kind?: KindId): readonly ConversationEntry[]`; `Filled` gains `readonly text: string`.

`Filled` carries the **surface the value was typed as**, not just the `Value`. That is what lets a resolver hand `"5 pounds in kg"` back to the engine instead of reconstructing a number from a canonical `Decimal` and a unit — this package does no arithmetic, and rebuilding a display value from a canonical one is arithmetic.

- [ ] **Step 1: Add `entries` to `Conversation`**

Append to `packages/chat/src/state.test.ts`:

```ts
test("entries returns whole rows so a caller can reach the surface text", () => {
  const c = new Conversation();
  c.push({ kind: "mass", value: val("mass", "lb", 2268), text: "5 pounds" });
  expect(c.entries("mass")[0]?.text).toBe("5 pounds");
  expect(c.entries("length")).toHaveLength(0);
});
```

Run: `bun test packages/chat/src/state.test.ts` — Expected: FAIL, `entries is not a function`.

In `packages/chat/src/state.ts`, add the method and rewrite `candidates` on top of it so the two orderings cannot drift:

```ts
  /** Whole rows, most recent first. `candidates` is this, projected. */
  entries(kind?: KindId): readonly ConversationEntry[] {
    const out: ConversationEntry[] = [];
    for (let i = this.#entries.length - 1; i >= 0; i--) {
      const entry = this.#entries[i];
      if (entry === undefined) continue;
      if (kind === undefined || entry.kind === kind) out.push(entry);
    }
    return out;
  }

  candidates(kind?: KindId): readonly Value[] {
    return this.entries(kind).map((e) => e.value);
  }
```

Run: `bun test packages/chat/src/state.test.ts` — Expected: PASS, 7 tests.

- [ ] **Step 2: Add `text` to `Filled`**

In `packages/chat/src/types.ts`:

```ts
/** A hole filled from conversation state. */
export interface Filled {
  readonly slot: string;
  readonly from: "state";
  readonly value: Value;
  /** The surface the value was originally typed as — "5 pounds".
   * A resolver hands this back to the engine rather than rebuilding a display
   * number from a canonical `Decimal`, which would be arithmetic this package
   * does not do. */
  readonly text: string;
}
```

- [ ] **Step 3: Write the failing tests for `fill`**

`packages/chat/src/fill.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "./carve";
import { testEngine } from "./engine.fixture";
import { fill, targetKindOf } from "./fill";
import { Conversation } from "./state";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const en = [chatEn];

const stocked = (): Conversation => {
  const c = new Conversation();
  c.push({
    kind: "mass",
    value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
    text: "5 pounds",
  });
  return c;
};

const carved = (text: string) => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return { candidate, marks: engine.scan(text) };
};

test("targetKindOf reads the kind of the last mark in the candidate", () => {
  const { candidate, marks } = carved("convert this to kg");
  expect(targetKindOf(candidate, marks)).toBe("mass");
});

test("targetKindOf is undefined when the candidate names no unit", () => {
  const { candidate, marks } = carved("convert this");
  expect(targetKindOf(candidate, marks)).toBeUndefined();
});

test("fills a hole from a compatible value and carries its surface text", () => {
  const { candidate, marks } = carved("convert this to kg");
  const [filled] = fill(candidate, marks, stocked());
  expect(filled?.slot).toBe("source");
  expect(filled?.from).toBe("state");
  expect(filled?.text).toBe("5 pounds");
  expect(filled?.value.unit).toBe("lb");
});

test("fills nothing when state holds no compatible value", () => {
  const { candidate, marks } = carved("convert this to kg");
  expect(fill(candidate, marks, new Conversation())).toHaveLength(0);
});

test("the target kind and not recency decides which value is taken", () => {
  const c = stocked();
  c.push({
    kind: "length",
    value: { kind: "length", canonical: new Decimal(5), unit: "m" },
    text: "5 metres",
  });
  const { candidate, marks } = carved("convert this to kg");
  expect(fill(candidate, marks, c)[0]?.value.kind).toBe("mass");
});

test("fills nothing when the candidate has no hole", () => {
  const { candidate, marks } = carved("convert 5 lb to kg");
  expect(fill(candidate, marks, stocked())).toHaveLength(0);
});
```

- [ ] **Step 4: Run them and watch them fail**

Run: `bun test packages/chat/src/fill.test.ts`
Expected: FAIL — cannot resolve `./fill`.

- [ ] **Step 5: Implement `fill`**

`packages/chat/src/fill.ts`:

```ts
import type { Mark } from "@smartput/core";
import type { KindId } from "@smartput/kind/types";
import type { Conversation } from "./state";
import type { Candidate, Filled } from "./types";

/**
 * The kind the target unit names — what "to kg" says the hole must hold.
 *
 * The LAST mark inside the candidate, because the target is written after the
 * source in every frame this vocabulary lists: "convert X to Y". When the
 * source is a hole there is only one mark and last is also first, which is the
 * case that matters here.
 */
export function targetKindOf(
  candidate: Candidate,
  marks: readonly Mark[],
): KindId | undefined {
  const inside = marks.filter(
    (m) => m.start >= candidate.span.start && m.end <= candidate.span.end,
  );
  return inside[inside.length - 1]?.readings[0]?.kind;
}

/**
 * Take a value out of state for every hole the candidate left open.
 *
 * The kind constraint is the whole mechanism: `carve` emits a hole with an
 * empty kind because it has not read the target unit yet, `targetKindOf`
 * narrows it, and `Conversation.entries(kind)` does the rest. A state holding
 * one length and one mass has no contest to resolve when the target is
 * kilograms — the kind system is the coreference resolver (design §4.5).
 *
 * Fills nothing rather than guessing when no compatible value is in reach. The
 * caller sees an unfilled hole and abstains, which is the honest outcome: the
 * information is not there.
 */
export function fill(
  candidate: Candidate,
  marks: readonly Mark[],
  conversation: Conversation,
): Filled[] {
  const out: Filled[] = [];
  const target = targetKindOf(candidate, marks);
  for (const hole of candidate.holes) {
    const kind = hole.kind === "" ? target : hole.kind;
    if (kind === undefined) continue;
    const entry = conversation.entries(kind)[0];
    if (entry === undefined) continue;
    out.push({ slot: hole.slot, from: "state", value: entry.value, text: entry.text });
  }
  return out;
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `bun test packages/chat/src/fill.test.ts`
Expected: PASS, 6 tests. Run `bun test packages/chat` too — `Filled` gained a field, so anything constructing one must be updated.

- [ ] **Step 7: Export and commit**

Add to `packages/chat/src/index.ts`:

```ts
export { fill, targetKindOf } from "./fill";
```

```bash
bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): fill a hole from state under the target kind"
```

---

### Task 9: The `evaluate` and `convert` resolvers

**Files:**
- Create: `packages/chat/src/resolvers/evaluate.ts`, `packages/chat/src/resolvers/convert.ts`, `packages/chat/src/resolvers/index.ts`
- Test: `packages/chat/src/resolvers/resolvers.test.ts`
- Modify: `packages/chat/package.json` (add `./resolvers`)

**Interfaces:**
- Consumes: `Resolver`, `Candidate`, `ResolveCtx` from `../types`.
- Produces: `const evaluateResolver: Resolver`, `const convertResolver: Resolver`, both exported from `./resolvers`.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/resolvers/resolvers.test.ts`:

```ts
import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind/decimal";
import { carve } from "../carve";
import { testEngine } from "../engine.fixture";
import { chatEn } from "../vocabulary";
import { convertResolver, evaluateResolver } from "./index";

const engine = testEngine();
const en = [chatEn];

const ctxFor = (text: string, filled = []) => {
  const candidate = carve(text, en)[0];
  if (candidate === undefined) throw new Error("carve produced nothing");
  return { candidate, ctx: { engine, filled, marks: engine.scan(text) } };
};

test("evaluate resolves arithmetic", () => {
  const { candidate, ctx } = ctxFor("2 + 2");
  expect(evaluateResolver.resolve(candidate, ctx).formatted).toBe("4");
});

test("evaluate resolves a unit expression", () => {
  const { candidate, ctx } = ctxFor("1 kg + 500 g");
  expect(evaluateResolver.resolve(candidate, ctx).formatted).toBe("1.5 kilograms");
});

test("evaluate takes the top reading of an ambiguous payload rather than throwing", () => {
  const { candidate, ctx } = ctxFor("10 m");
  expect(() => evaluateResolver.resolve(candidate, ctx)).not.toThrow();
});

test("convert handles an explicit source", () => {
  const { candidate, ctx } = ctxFor("convert 5 lb to kg");
  expect(convertResolver.resolve(candidate, ctx).kind).toBe("mass");
});

test("convert rebuilds the input from a filled surface, not from a Decimal", () => {
  const { candidate, ctx } = ctxFor("convert this to kg", [
    {
      slot: "source",
      from: "state" as const,
      value: { kind: "mass", canonical: new Decimal(2268), unit: "lb" },
      text: "5 pounds",
    },
  ]);
  const result = convertResolver.resolve(candidate, ctx);
  expect(result.kind).toBe("mass");
  expect(result.formatted).toContain("kilogram");
});

test("both resolvers are synchronous", () => {
  expect(evaluateResolver.async).toBeUndefined();
  expect(convertResolver.async).toBeUndefined();
});

test("convert claims the convert frame and evaluate claims none", () => {
  expect(convertResolver.frames.en).toContain("convert");
  expect(evaluateResolver.frames.en ?? []).toHaveLength(0);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/resolvers`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the `evaluate` resolver**

`packages/chat/src/resolvers/evaluate.ts`:

```ts
import type { Result } from "@smartput/core";
import { ChatError } from "../errors";
import type { Candidate, ResolveCtx, Resolver } from "../types";

/**
 * The plain path: the payload is already an expression, so hand it to the
 * engine and return what comes back.
 *
 * `suggest` and not `evaluate`: the strict door throws `AmbiguityError`, and a
 * chat router that has already decided this message is a request should answer
 * it with the reading the engine ranked first rather than raise. A caller who
 * wants every reading uses `handleAll` and reads the ranked results.
 *
 * `frames` is empty on purpose. This resolver answers messages with no frame
 * at all — "what is 2 + 2", "5 kg + 3 kg" — and claiming a frame would put it
 * in competition with the resolver that owns one.
 */
export const evaluateResolver: Resolver<Result> = {
  id: "evaluate",
  frames: { en: [] },
  resolve(candidate: Candidate, ctx: ResolveCtx): Result {
    const found = ctx.engine.suggest(candidate.text);
    const top = found[0];
    if (top === undefined) {
      throw new ChatError("resolve", `engine found no reading for ${JSON.stringify(candidate.text)}`);
    }
    return top;
  },
};
```

- [ ] **Step 4: Write the `convert` resolver**

`packages/chat/src/resolvers/convert.ts`:

```ts
import type { Result } from "@smartput/core";
import { ChatError } from "../errors";
import type { Candidate, ResolveCtx, Resolver } from "../types";

/** The frame word, and any referent standing where the source should be. */
const LEAD = /^\s*(convert|turn|change|make)\b\s*/i;
const REFERENT = /\b(this|that|it|the result|the answer|ans)\b/i;

/**
 * Conversion, including the form where the source came from the last turn.
 *
 * The filled value is spliced back in as the SURFACE it was typed as — "5
 * pounds" — and the whole string is handed to the engine. Rebuilding a display
 * number from `Value.canonical` would mean dividing by the unit's ratio here,
 * and this package does no arithmetic: every number in a `ChatResult` came out
 * of the engine (design §4).
 */
export const convertResolver: Resolver<Result> = {
  id: "convert",
  frames: { en: ["convert", "turn", "change", "make"] },
  prototypes: {
    en: [
      "convert this to kilograms",
      "can you turn that into miles",
      "change it to celsius",
      "make that kg",
      "what is 5 lb in kg",
    ],
  },
  resolve(candidate: Candidate, ctx: ResolveCtx): Result {
    const source = ctx.filled.find((f) => f.slot === "source");
    let text = candidate.text.replace(LEAD, "");
    if (source !== undefined) {
      if (!REFERENT.test(text)) {
        throw new ChatError("resolve", "a source was filled but the payload names no referent");
      }
      text = text.replace(REFERENT, source.text);
    }
    // The engine's own conversion keyword. "to kg" is chat's spelling of it.
    const normalized = text.replace(/\bto\b/i, "in");
    const found = ctx.engine.suggest(normalized);
    const top = found[0];
    if (top === undefined) {
      throw new ChatError("resolve", `engine found no reading for ${JSON.stringify(normalized)}`);
    }
    return top;
  },
};
```

- [ ] **Step 5: Write the barrel and add the subpath**

`packages/chat/src/resolvers/index.ts`:

```ts
// `@smartput/chat/resolvers` — the two resolvers that need nothing but the
// engine. Resolvers over `math`, `distance`, `translate` and `query` are the
// consumer's to write: bundling them would make this package depend on six
// others to serve someone who wanted one (design §2).
export { convertResolver } from "./convert";
export { evaluateResolver } from "./evaluate";
```

Add to `packages/chat/package.json`'s `exports`:

```json
    "./resolvers": {
      "bun": "./src/resolvers/index.ts",
      "types": "./dist/resolvers/index.d.ts",
      "default": "./dist/resolvers/index.js"
    }
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `bun test packages/chat/src/resolvers`
Expected: PASS, 7 tests.

If "convert rebuilds the input" fails with no reading, print `normalized` — the likely cause is `to` surviving inside a unit alias, which the word-boundary anchor is there to prevent.

- [ ] **Step 7: Commit**

```bash
bun run build && bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): add the evaluate and convert resolvers"
```

---

### Task 10: `ChatResolver` — wire the pipeline

**Files:**
- Create: `packages/chat/src/chat.ts`, `packages/chat/src/model.fixture.ts`
- Test: `packages/chat/src/chat.test.ts`
- Modify: `packages/chat/src/index.ts`

**Interfaces:**
- Consumes: `carve`, `featurize`, `probe`, `fill`, `LinearModel`, `ABSTAIN`, `Conversation`, `Resolver`, `ChatResult`.
- Produces: `interface ChatResolverOptions`, `class ChatResolver { constructor(opts: ChatResolverOptions); handle(text): ChatResult | null; handleAll(text): ChatResult[]; handleAsync(text): Promise<ChatResult | null>; handleAllAsync(text): Promise<ChatResult[]>; readonly conversation: Conversation }`.

A hand-built weight table lives in `model.fixture.ts` so this task's tests do not wait on the trainer. Task 11 replaces it for real use; it stays for tests, which should not break when a retrain shifts a weight.

- [ ] **Step 1: Write the hand-built table**

`packages/chat/src/model.fixture.ts`:

```ts
import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";
import { ABSTAIN } from "./model";
import type { WeightTable } from "./model";

/**
 * A table written by hand, not trained.
 *
 * Tests need a model whose behaviour they can state — "a frame makes convert
 * win" — and a trained table cannot promise that any individual weight has a
 * given sign. The trainer's output is checked by `chat-eval`, on held-out data,
 * which is the only honest way to check it.
 */
export function fixtureTable(resolverIds: readonly string[]): WeightTable {
  const classes = [...resolverIds, ABSTAIN];
  const row = (weights: Partial<Record<(typeof NAMED_FEATURES)[number], number>>) =>
    NAMED_FEATURES.map((name) => weights[name] ?? 0);

  const named = classes.map((id) => {
    if (id === ABSTAIN) return row({ bias: 1.5 });
    if (id === "convert") return row({ frameMatched: 5, holePresent: 2, probeResolves: 2 });
    return row({ probeResolves: 4, probeConfidence: 2, markCount: 1 });
  });

  return {
    locale: "en",
    features: [...NAMED_FEATURES],
    buckets: NGRAM_BUCKETS,
    classes,
    named,
    hashed: btoa(String.fromCharCode(...new Uint8Array(classes.length * NGRAM_BUCKETS))),
    hashedScale: classes.map(() => 0),
  };
}
```

- [ ] **Step 2: Write the failing tests**

`packages/chat/src/chat.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { Result } from "@smartput/core";
import { ChatResolver } from "./chat";
import { testEngine } from "./engine.fixture";
import { fixtureTable } from "./model.fixture";
import { LinearModel } from "./model";
import { convertResolver, evaluateResolver } from "./resolvers";
import type { Candidate, ResolveCtx, Resolver } from "./types";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const resolvers = [evaluateResolver, convertResolver];

const make = (extra: readonly Resolver[] = []) =>
  new ChatResolver({
    engine,
    resolvers: [...resolvers, ...extra],
    locales: [chatEn],
    weights: LinearModel.from(fixtureTable([...resolvers, ...extra].map((r) => r.id))),
    threshold: 0.4,
  });

test("routes arithmetic to evaluate", () => {
  const out = make().handle("what is 2 + 2");
  expect(out?.resolver).toBe("evaluate");
  expect(out?.payload).toBe("2 + 2");
  expect((out?.result as Result).formatted).toBe("4");
});

test("abstains on chatter", () => {
  expect(make().handle("lol ok")).toBeNull();
});

test("abstains on a greeting alone", () => {
  expect(make().handle("hey")).toBeNull();
});

test("the worked case: a referent filled from the previous turn", () => {
  const chat = make();
  chat.handle("5 pounds of flour");
  const out = chat.handle("Hi, convert this to kg please");
  expect(out?.resolver).toBe("convert");
  expect(out?.filled[0]?.slot).toBe("source");
  expect(out?.filled[0]?.text).toBe("5 pounds");
  expect((out?.result as Result).formatted).toContain("kilogram");
});

test("a successful handle pushes its result onto the conversation", () => {
  const chat = make();
  expect(chat.conversation.size).toBe(0);
  chat.handle("what is 1 kg + 500 g");
  expect(chat.conversation.size).toBe(1);
  expect(chat.conversation.last()?.kind).toBe("mass");
});

test("an abstained message leaves the conversation alone", () => {
  const chat = make();
  chat.handle("lol ok");
  expect(chat.conversation.size).toBe(0);
});

test("handleAll returns several results for a message carrying two requests", () => {
  const found = make().handleAll("what is 2 + 2 and 3 kg + 1 kg");
  expect(found.length).toBeGreaterThanOrEqual(1);
});

test("handle excludes an async resolver rather than returning a promise", () => {
  const slow: Resolver<Result> = {
    id: "slow",
    frames: { en: [] },
    async: true,
    resolve: (c: Candidate, ctx: ResolveCtx) => Promise.resolve(ctx.engine.suggest(c.text)[0] as Result),
  };
  const out = make([slow]).handle("what is 2 + 2");
  expect(out?.resolver).not.toBe("slow");
  expect(out?.result).not.toBeInstanceOf(Promise);
});

test("handleAsync scores async resolvers too", async () => {
  const slow: Resolver<Result> = {
    id: "slow",
    frames: { en: [] },
    async: true,
    resolve: (c: Candidate, ctx: ResolveCtx) => Promise.resolve(ctx.engine.suggest(c.text)[0] as Result),
  };
  const out = await make([slow]).handleAsync("what is 2 + 2");
  expect(out).not.toBeNull();
});

test("a higher threshold silences a weak route", () => {
  const chat = new ChatResolver({
    engine,
    resolvers,
    locales: [chatEn],
    weights: LinearModel.from(fixtureTable(resolvers.map((r) => r.id))),
    threshold: 0.999,
  });
  expect(chat.handle("what is 2 + 2")).toBeNull();
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `bun test packages/chat/src/chat.test.ts`
Expected: FAIL — cannot resolve `./chat`.

- [ ] **Step 4: Implement `ChatResolver`**

`packages/chat/src/chat.ts`:

```ts
import type { Engine, Mark, Result } from "@smartput/core";
import { carve } from "./carve";
import type { EmbeddingFeature } from "./embed";
import { featurize, probe } from "./features";
import { fill } from "./fill";
import { ABSTAIN, type LinearModel } from "./model";
import { Conversation } from "./state";
import type { ChatResult, ChatVocabulary, Filled, Resolver } from "./types";

export interface ChatResolverOptions {
  readonly engine: Engine;
  readonly resolvers: readonly Resolver[];
  readonly locales: readonly ChatVocabulary[];
  /** Required and never defaulted: a default would mean the root barrel
   * importing a shipped table, which is the one thing that lives on its own
   * subpath. The same answer `createEngine` gives (design §6). */
  readonly weights: LinearModel;
  /** Tier 2. Read only by `handleAsync` / `handleAllAsync`. */
  readonly embedder?: EmbeddingFeature;
  /** Minimum probability the winning class must reach. */
  readonly threshold?: number;
  readonly conversation?: Conversation;
}

/** Tuned by `chat-eval` on held-out negatives; this is the starting point the
 * first training run replaces. */
const DEFAULT_THRESHOLD = 0.5;

interface Row {
  readonly resolver: Resolver;
  readonly payload: string;
  readonly span: { start: number; end: number };
  readonly score: number;
  readonly filled: readonly Filled[];
  readonly marks: readonly Mark[];
}

export class ChatResolver {
  readonly conversation: Conversation;
  readonly #engine: Engine;
  readonly #resolvers: readonly Resolver[];
  readonly #locales: readonly ChatVocabulary[];
  readonly #model: LinearModel;
  readonly #embedder: EmbeddingFeature | undefined;
  readonly #threshold: number;

  constructor(opts: ChatResolverOptions) {
    this.#engine = opts.engine;
    this.#resolvers = opts.resolvers;
    this.#locales = opts.locales;
    this.#model = opts.weights;
    this.#embedder = opts.embedder;
    this.#threshold = opts.threshold ?? DEFAULT_THRESHOLD;
    this.conversation = opts.conversation ?? new Conversation();
  }

  handle(text: string): ChatResult | null {
    return this.#top(this.#rank(text, false));
  }

  handleAll(text: string): ChatResult[] {
    return this.#all(this.#rank(text, false));
  }

  async handleAsync(text: string): Promise<ChatResult | null> {
    return this.#top(await this.#rankAsync(text));
  }

  async handleAllAsync(text: string): Promise<ChatResult[]> {
    return this.#all(await this.#rankAsync(text));
  }

  /**
   * Score every (candidate, resolver) pair.
   *
   * `includeAsync` is the one difference between the two doors, and it is a
   * strict subset rather than a different decision: the synchronous path
   * answers fewer messages, never the same ones worse (design §6).
   */
  #rank(text: string, includeAsync: boolean, embed?: ReadonlyMap<string, { centroid: number; max: number }>): Row[] {
    const marks = this.#engine.scan(text);
    const rows: Row[] = [];
    const eligible = this.#resolvers.filter((r) => includeAsync || r.async !== true);
    const byId = new Map(eligible.map((r) => [r.id, r]));

    for (const candidate of carve(text, this.#locales)) {
      const filled = fill(candidate, marks, this.conversation);
      // An unfilled hole is a payload that cannot resolve. Skip the candidate
      // rather than routing to a resolver that will throw on it.
      if (candidate.holes.length > filled.length) continue;
      const scores = this.#model.score(
        featurize({
          input: text,
          candidate,
          marks,
          probe: probe(this.#engine, candidate.text),
          conversation: this.conversation,
        }),
        embed,
      );
      const abstain = scores.get(ABSTAIN) ?? 0;
      for (const [id, score] of scores) {
        const resolver = byId.get(id);
        if (resolver === undefined) continue;
        if (score < this.#threshold || score <= abstain) continue;
        rows.push({ resolver, payload: candidate.text, span: candidate.span, score, filled, marks });
      }
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  async #rankAsync(text: string): Promise<Row[]> {
    const embed = await this.#embedder?.score(text);
    return this.#rank(text, true, embed);
  }

  #resolve(row: Row): ChatResult | null {
    const out = row.resolver.resolve(
      { span: row.span, text: row.payload, holes: [], stripped: { head: "", tail: "" } },
      { engine: this.#engine, filled: row.filled, marks: row.marks },
    );
    // A resolver that declared itself synchronous and returned a promise is a
    // bug in that resolver, not a case to paper over.
    if (out instanceof Promise) return null;
    const result = out as Result;
    this.conversation.push({ kind: result.kind, value: result.value, text: row.payload });
    return {
      resolver: row.resolver.id,
      payload: row.payload,
      span: row.span,
      result,
      confidence: row.score,
      filled: row.filled,
    };
  }

  #top(rows: readonly Row[]): ChatResult | null {
    const row = rows[0];
    return row === undefined ? null : this.#resolve(row);
  }

  /** One result per non-overlapping span, best first: a message carrying two
   * requests gets two answers, and two readings of one span get one. */
  #all(rows: readonly Row[]): ChatResult[] {
    const out: ChatResult[] = [];
    const taken: { start: number; end: number }[] = [];
    for (const row of rows) {
      if (taken.some((t) => row.span.start < t.end && t.start < row.span.end)) continue;
      const result = this.#resolve(row);
      if (result === null) continue;
      taken.push(row.span);
      out.push(result);
    }
    return out;
  }
}
```

Note the re-wrapped candidate in `#resolve`: holes are cleared because `fill` already satisfied them, and a resolver reads `ctx.filled` rather than the hole list.

- [ ] **Step 5: Stub `./embed` so the type import resolves**

`chat.ts` imports `EmbeddingFeature` as a type. Create `packages/chat/src/embed/index.ts` with the interface only — Task 12 fills it in:

```ts
import type { EmbedScores } from "../model";

/** Tier 2's contract. Implemented in full in the next task. */
export interface EmbeddingFeature {
  score(text: string): Promise<ReadonlyMap<string, EmbedScores>>;
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `bun test packages/chat/src/chat.test.ts`
Expected: PASS, 10 tests.

If "the worked case" returns `evaluate` rather than `convert`, the fixture table's `frameMatched` weight is being beaten by `probeResolves` on the whole-input candidate — raise `frameMatched` in `model.fixture.ts` until the intended behaviour is the stated one. That is a legitimate edit: the fixture exists to make a behaviour testable, not to be accurate.

- [ ] **Step 7: Export and commit**

Add to `packages/chat/src/index.ts`:

```ts
export { ChatResolver, type ChatResolverOptions } from "./chat";
```

```bash
bun run build && bun run typecheck && bun test packages/chat
git add packages/chat
git commit -m "feat(chat): wire the pipeline into ChatResolver"
```

---

### Task 11: The trainer, and the first English weight table

**Files:**
- Create: `packages/chat/src/train/index.ts`, `packages/chat/src/weights/en.ts`, `scripts/chat-train.ts`
- Generated: `packages/chat/src/weights/en.json`
- Test: `packages/chat/src/train/train.test.ts`
- Modify: `packages/chat/package.json` (`./train`, `./weights/en`), root `package.json` (`chat:train`)

**Interfaces:**
- Consumes: `FeatureVector`, `NAMED_FEATURES`, `NGRAM_BUCKETS`, `WeightTable`, `ABSTAIN`.
- Produces: `interface TrainRow { readonly features: FeatureVector; readonly label: string }`, `interface TrainOptions { readonly locale: string; readonly classes: readonly string[]; readonly epochs?: number; readonly lr?: number; readonly l2?: number }`, `function train(rows: readonly TrainRow[], opts: TrainOptions): WeightTable`.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/train/train.test.ts`. The claim a trainer must satisfy in a unit test is that it *learns a separable signal* — accuracy on held-out data is `chat-eval`'s job, not a unit test's.

```ts
import { expect, test } from "bun:test";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "../features";
import type { FeatureVector } from "../features";
import { ABSTAIN, LinearModel } from "../model";
import { train } from "./index";

const vec = (name: string, buckets: number[] = []): FeatureVector => {
  const named = new Float64Array(NAMED_FEATURES.length);
  named[NAMED_FEATURES.indexOf(name as (typeof NAMED_FEATURES)[number])] = 1;
  named[NAMED_FEATURES.indexOf("bias")] = 1;
  return { named, hashed: new Map(buckets.map((b) => [b, 1])) };
};

test("learns a separable named feature", () => {
  const rows = [
    ...Array.from({ length: 20 }, () => ({ features: vec("frameMatched"), label: "convert" })),
    ...Array.from({ length: 20 }, () => ({ features: vec("markCount"), label: ABSTAIN })),
  ];
  const model = LinearModel.from(
    train(rows, { locale: "en", classes: ["convert", ABSTAIN], epochs: 300 }),
  );
  const scores = model.score(vec("frameMatched"));
  expect((scores.get("convert") ?? 0) > (scores.get(ABSTAIN) ?? 0)).toBe(true);
});

test("learns a separable hashed bucket", () => {
  const rows = [
    ...Array.from({ length: 20 }, () => ({ features: vec("bias", [11]), label: "convert" })),
    ...Array.from({ length: 20 }, () => ({ features: vec("bias", [12]), label: ABSTAIN })),
  ];
  const model = LinearModel.from(
    train(rows, { locale: "en", classes: ["convert", ABSTAIN], epochs: 300 }),
  );
  const scores = model.score(vec("bias", [11]));
  expect((scores.get("convert") ?? 0) > (scores.get(ABSTAIN) ?? 0)).toBe(true);
});

test("the table it emits declares this build's shape", () => {
  const table = train([], { locale: "uk", classes: ["evaluate", ABSTAIN] });
  expect(table.features).toEqual([...NAMED_FEATURES]);
  expect(table.buckets).toBe(NGRAM_BUCKETS);
  expect(table.locale).toBe("uk");
  expect(() => LinearModel.from(table)).not.toThrow();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/train`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement the trainer**

`packages/chat/src/train/index.ts`:

```ts
import type { FeatureVector } from "../features";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "../features";
import type { WeightTable } from "../model";

export interface TrainRow {
  readonly features: FeatureVector;
  readonly label: string;
}

export interface TrainOptions {
  readonly locale: string;
  /** Every class the model may emit, including `ABSTAIN`. */
  readonly classes: readonly string[];
  readonly epochs?: number;
  readonly lr?: number;
  readonly l2?: number;
}

/**
 * Multinomial logistic regression by full-batch gradient descent.
 *
 * Published on `./train` rather than kept in `scripts/` because retraining on
 * your own chat logs is a feature, not a repo chore: the shipped table is
 * English written the way this repo's corpus writes it, and a product with its
 * own phrasing should be able to fit the model to it. A subpath nobody imports
 * costs nothing.
 */
export function train(rows: readonly TrainRow[], opts: TrainOptions): WeightTable {
  const { classes, locale } = opts;
  const epochs = opts.epochs ?? 200;
  const lr = opts.lr ?? 0.5;
  const l2 = opts.l2 ?? 1e-4;
  const K = classes.length;
  const F = NAMED_FEATURES.length;

  const named = Array.from({ length: K }, () => new Float64Array(F));
  const hashed = Array.from({ length: K }, () => new Float64Array(NGRAM_BUCKETS));
  const index = new Map(classes.map((c, i) => [c, i]));

  for (let epoch = 0; epoch < epochs && rows.length > 0; epoch++) {
    const gNamed = Array.from({ length: K }, () => new Float64Array(F));
    const gHashed = Array.from({ length: K }, () => new Float64Array(NGRAM_BUCKETS));

    for (const row of rows) {
      const logits = new Float64Array(K);
      for (let k = 0; k < K; k++) {
        let sum = 0;
        const nk = named[k];
        const hk = hashed[k];
        if (nk === undefined || hk === undefined) continue;
        for (let f = 0; f < F; f++) sum += (nk[f] ?? 0) * (row.features.named[f] ?? 0);
        for (const [b, v] of row.features.hashed) sum += (hk[b] ?? 0) * v;
        logits[k] = sum;
      }
      const top = Math.max(...logits);
      let total = 0;
      for (let k = 0; k < K; k++) {
        logits[k] = Math.exp((logits[k] ?? 0) - top);
        total += logits[k] ?? 0;
      }
      const gold = index.get(row.label) ?? -1;
      for (let k = 0; k < K; k++) {
        const err = (logits[k] ?? 0) / total - (k === gold ? 1 : 0);
        const gn = gNamed[k];
        const gh = gHashed[k];
        if (gn === undefined || gh === undefined) continue;
        for (let f = 0; f < F; f++) gn[f] = (gn[f] ?? 0) + err * (row.features.named[f] ?? 0);
        for (const [b, v] of row.features.hashed) gh[b] = (gh[b] ?? 0) + err * v;
      }
    }

    const step = lr / rows.length;
    for (let k = 0; k < K; k++) {
      const nk = named[k];
      const hk = hashed[k];
      const gn = gNamed[k];
      const gh = gHashed[k];
      if (nk === undefined || hk === undefined || gn === undefined || gh === undefined) continue;
      for (let f = 0; f < F; f++) nk[f] = (nk[f] ?? 0) - step * ((gn[f] ?? 0) + l2 * (nk[f] ?? 0));
      for (let b = 0; b < NGRAM_BUCKETS; b++) {
        hk[b] = (hk[b] ?? 0) - step * ((gh[b] ?? 0) + l2 * (hk[b] ?? 0));
      }
    }
  }

  // int8 with a per-class scale: the hashed half is most of the table's bytes,
  // and a row's weights are all of one magnitude, so one scale per class loses
  // very little and keeps the budget a number CI can hold.
  const bytes = new Int8Array(K * NGRAM_BUCKETS);
  const scale: number[] = [];
  for (let k = 0; k < K; k++) {
    const hk = hashed[k] ?? new Float64Array(NGRAM_BUCKETS);
    const peak = Math.max(...Array.from(hk, Math.abs), 1e-12);
    scale.push(peak / 127);
    for (let b = 0; b < NGRAM_BUCKETS; b++) {
      bytes[k * NGRAM_BUCKETS + b] = Math.round((hk[b] ?? 0) / (peak / 127));
    }
  }

  return {
    locale,
    features: [...NAMED_FEATURES],
    buckets: NGRAM_BUCKETS,
    classes,
    named: named.map((row) => Array.from(row)),
    hashed: btoa(String.fromCharCode(...new Uint8Array(bytes.buffer))),
    hashedScale: scale,
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test packages/chat/src/train`
Expected: PASS, 3 tests. If the separable tests fail, raise `epochs` — the assertion is that the signal is learnable, and convergence speed is not what is being claimed.

- [ ] **Step 5: Write the corpus builder and train English**

`scripts/chat-train.ts`:

```ts
/**
 * Builds the routing corpus, fits a table per locale, writes it beside the
 * source. Committed output, regenerated on demand — the same contract
 * `parity-record.ts` keeps.
 *
 *   bun run chat:train
 */
import { carve } from "../packages/chat/src/carve";
import { testEngine } from "../packages/chat/src/engine.fixture";
import { featurize, probe } from "../packages/chat/src/features";
import { ABSTAIN } from "../packages/chat/src/model";
import { Conversation } from "../packages/chat/src/state";
import { train, type TrainRow } from "../packages/chat/src/train";
import { chatEn } from "../packages/chat/src/vocabulary";

const engine = testEngine();
const locales = [chatEn];

/** Payloads with known readings. Gold data, because the engine reads them the
 * same way at train time and at run time — what is being learned is the frame,
 * not the payload. */
const PAYLOADS = [
  "2 + 2",
  "1 kg + 500 g",
  "30 h - 30 min",
  "212 F in C",
  "3 ft in cm",
  "2 GB + 500 MB",
  "20% of 150",
  "100 km / 2 h",
  "5 lb to kg",
  "10 km",
];

const FRAMES: Array<[string, (p: string) => string]> = [
  ["evaluate", (p) => p],
  ["evaluate", (p) => `what is ${p}`],
  ["evaluate", (p) => `hey what is ${p} please`],
  ["evaluate", (p) => `can you calculate ${p}`],
  ["convert", (p) => `convert ${p}`],
  ["convert", (p) => `hi, convert ${p} please`],
  ["convert", (p) => `could you turn ${p}`],
];

/** Chatter, plus near-misses: a frame with no payload, and a payload under a
 * frame that introduces none. Near-misses are what teach abstain anything. */
const NEGATIVES = [
  "lol ok",
  "hey",
  "hi there",
  "thanks!",
  "sounds good to me",
  "i'll check later",
  "convert",
  "can you",
  "what is",
  "please",
  "that was 5 stars honestly",
  "meeting at 3",
];

const rows: TrainRow[] = [];
const add = (text: string, label: string): void => {
  const marks = engine.scan(text);
  const conversation = new Conversation();
  for (const candidate of carve(text, locales)) {
    rows.push({
      features: featurize({
        input: text,
        candidate,
        marks,
        probe: probe(engine, candidate.text),
        conversation,
      }),
      // Only the fully carved candidate carries the label; every other span of
      // the same message is a negative. That is what teaches the model WHERE a
      // payload ends, and without it the whole-input candidate wins every time.
      label: candidate.text === payloadOf(text) ? label : ABSTAIN,
    });
  }
};

/** The span the templates put the payload at, recovered by longest suffix. */
function payloadOf(text: string): string {
  for (const p of PAYLOADS) if (text.includes(p)) return p;
  return text;
}

for (const payload of PAYLOADS) {
  for (const [label, frame] of FRAMES) add(frame(payload), label);
}
for (const text of NEGATIVES) add(text, ABSTAIN);

const table = train(rows, {
  locale: "en",
  classes: ["evaluate", "convert", ABSTAIN],
  epochs: 400,
});

const out = new URL("../packages/chat/src/weights/en.json", import.meta.url);
await Bun.write(out, `${JSON.stringify(table, null, 1)}\n`);
console.log(`wrote ${rows.length} rows to ${out.pathname}`);
```

Add to the root `package.json` scripts, beside `parity:record`:

```json
    "chat:train": "bun run scripts/chat-train.ts",
```

Run: `bun run chat:train`
Expected: writes `packages/chat/src/weights/en.json` and prints the row count.

- [ ] **Step 6: Add the typed wrapper and the subpaths**

`packages/chat/src/weights/en.ts`:

```ts
// `@smartput/chat/weights/en` — the trained English table, on its own subpath
// so a consumer who supplies their own links neither this nor the trainer.
import type { WeightTable } from "../model";
import table from "./en.json";

export default table as WeightTable;
```

Add both subpaths to `packages/chat/package.json`:

```json
    "./weights/en": {
      "bun": "./src/weights/en.ts",
      "types": "./dist/weights/en.d.ts",
      "default": "./dist/weights/en.js"
    },
    "./train": {
      "bun": "./src/train/index.ts",
      "types": "./dist/train/index.d.ts",
      "default": "./dist/train/index.js"
    }
```

- [ ] **Step 7: Prove the shipped table loads and routes**

Append to `packages/chat/src/chat.test.ts`:

```ts
test("the shipped English table loads and routes arithmetic", async () => {
  const { default: table } = await import("./weights/en.json");
  const chat = new ChatResolver({
    engine,
    resolvers,
    locales: [chatEn],
    weights: LinearModel.from(table as never),
  });
  expect(chat.handle("what is 2 + 2")?.resolver).toBe("evaluate");
  expect(chat.handle("lol ok")).toBeNull();
});
```

Run: `bun run build && bun run typecheck && bun test packages/chat`
Expected: PASS. If the shipped table routes `"what is 2 + 2"` to `convert`, the corpus is too small for the frame signal to separate — add payloads to `PAYLOADS` and retrain rather than hand-editing the table.

- [ ] **Step 8: Commit**

```bash
git add packages/chat scripts/chat-train.ts package.json
git commit -m "feat(chat): train and ship the English routing table"
```

---

### Task 12: Tier 2 — the injected embedder

**Files:**
- Modify: `packages/chat/src/embed/index.ts` (replace the Task 10 stub), `packages/chat/package.json` (add `./embed`)
- Test: `packages/chat/src/embed/embed.test.ts`

**Interfaces:**
- Consumes: `EmbedScores` from `../model`; `Resolver` from `../types`.
- Produces: `interface Embedder { readonly id: string; embed(texts: readonly string[]): Promise<Float32Array[]> }`, `function cosine(a: Float32Array, b: Float32Array): number`, `class PrototypeFeature implements EmbeddingFeature { constructor(embedder: Embedder, resolvers: readonly Resolver[], locale: string); warm(): Promise<void>; score(text: string): Promise<ReadonlyMap<string, EmbedScores>> }`.

The package ships no model and no inference dependency. `Embedder` is brought by the consumer, exactly as `TranslateProvider`, `RateProvider` and geo's providers already work here.

- [ ] **Step 1: Write the failing tests**

`packages/chat/src/embed/embed.test.ts`:

```ts
import { expect, test } from "bun:test";
import { convertResolver, evaluateResolver } from "../resolvers";
import { cosine, PrototypeFeature } from "./index";
import type { Embedder } from "./index";

/** A deterministic stand-in: three character-count axes, normalised. Enough
 * for "similar strings score higher", which is the only claim being made. */
const stub: Embedder = {
  id: "stub",
  embed: async (texts) =>
    texts.map((t) => {
      const v = new Float32Array([
        (t.match(/[aeiou]/g) ?? []).length,
        (t.match(/[kgml]/g) ?? []).length,
        t.length / 10,
      ]);
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm) as Float32Array;
    }),
};

test("cosine is 1 for a vector against itself", () => {
  const v = new Float32Array([0.6, 0.8, 0]);
  expect(cosine(v, v)).toBeCloseTo(1, 6);
});

test("cosine is 0 for orthogonal vectors", () => {
  expect(cosine(new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]))).toBeCloseTo(0, 6);
});

test("cosine is 0 rather than NaN for a zero vector", () => {
  expect(cosine(new Float32Array([0, 0, 0]), new Float32Array([1, 0, 0]))).toBe(0);
});

test("warm embeds each resolver's prototypes once", async () => {
  let calls = 0;
  const counted: Embedder = { id: "counted", embed: async (t) => { calls++; return stub.embed(t); } };
  const feature = new PrototypeFeature(counted, [convertResolver, evaluateResolver], "en");
  await feature.warm();
  await feature.warm();
  expect(calls).toBe(1);
});

test("score returns centroid and max for every resolver with prototypes", async () => {
  const feature = new PrototypeFeature(stub, [convertResolver, evaluateResolver], "en");
  const scores = await feature.score("can you convert that to kg");
  expect(scores.get("convert")).toBeDefined();
  expect(scores.get("convert")?.max).toBeGreaterThanOrEqual(scores.get("convert")?.centroid ?? 1);
});

test("a resolver with no prototypes gets no rows", async () => {
  const feature = new PrototypeFeature(stub, [evaluateResolver], "en");
  expect((await feature.score("anything")).get("evaluate")).toBeUndefined();
});

test("score warms on first use without an explicit warm", async () => {
  const feature = new PrototypeFeature(stub, [convertResolver], "en");
  expect((await feature.score("convert this")).size).toBe(1);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun test packages/chat/src/embed`
Expected: FAIL — `PrototypeFeature` is not exported.

- [ ] **Step 3: Implement tier 2**

Replace `packages/chat/src/embed/index.ts`:

```ts
import type { EmbedScores } from "../model";
import type { Resolver } from "../types";

/**
 * Bring your own.
 *
 * The package ships no model and no inference dependency — `check-deps` would
 * need a line nobody wants to write, and `check-size` measures what a barrel
 * links. A consumer wires transformers.js, a hosted embedding API, or anything
 * else behind this interface, the same way `TranslateProvider` and
 * `RateProvider` already work in this repo (design §7).
 */
export interface Embedder {
  readonly id: string;
  embed(texts: readonly string[]): Promise<Float32Array[]>;
}

/** What `ChatResolver` needs from tier 2. */
export interface EmbeddingFeature {
  score(text: string): Promise<ReadonlyMap<string, EmbedScores>>;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  // 0 and not NaN: a zero vector is a legitimate embedding of an empty
  // carrier, and a NaN here would poison a logit and silence a whole class.
  return norm === 0 ? 0 : dot / norm;
}

/**
 * Prototype similarity as two features per resolver, never as a second router.
 *
 * `warm()` embeds each resolver's `prototypes` once, batched, and holds a
 * centroid. `score()` embeds the carrier and returns cosine-to-centroid and
 * max-cosine-to-any-prototype, which `LinearModel` adds into the SAME logits
 * as every tier 0 and tier 1 feature. Two routers scoring in parallel would
 * need a tiebreak rule and there is no honest place to put one.
 *
 * Vectors are never shipped: a table embedded under one encoder is noise under
 * another. The warm-up promise is held rather than its result, the shape
 * `Translator`'s cache and `PostalCodes#files` use, so concurrent first calls
 * make one round trip.
 */
export class PrototypeFeature implements EmbeddingFeature {
  readonly #embedder: Embedder;
  readonly #locale: string;
  readonly #prototypes: ReadonlyMap<string, readonly string[]>;
  #warming: Promise<Map<string, { centroid: Float32Array; each: Float32Array[] }>> | undefined;

  constructor(embedder: Embedder, resolvers: readonly Resolver[], locale: string) {
    this.#embedder = embedder;
    this.#locale = locale;
    const map = new Map<string, readonly string[]>();
    for (const resolver of resolvers) {
      const phrases = resolver.prototypes?.[locale];
      if (phrases !== undefined && phrases.length > 0) map.set(resolver.id, phrases);
    }
    this.#prototypes = map;
  }

  async warm(): Promise<void> {
    await this.#vectors();
  }

  #vectors(): Promise<Map<string, { centroid: Float32Array; each: Float32Array[] }>> {
    if (this.#warming !== undefined) return this.#warming;
    const ids = [...this.#prototypes.keys()];
    const flat = ids.flatMap((id) => [...(this.#prototypes.get(id) ?? [])]);
    this.#warming = this.#embedder.embed(flat).then((all) => {
      const out = new Map<string, { centroid: Float32Array; each: Float32Array[] }>();
      let at = 0;
      for (const id of ids) {
        const n = this.#prototypes.get(id)?.length ?? 0;
        const each = all.slice(at, at + n);
        at += n;
        const dims = each[0]?.length ?? 0;
        const centroid = new Float32Array(dims);
        for (const v of each) for (let i = 0; i < dims; i++) centroid[i] = (centroid[i] ?? 0) + (v[i] ?? 0);
        for (let i = 0; i < dims; i++) centroid[i] = (centroid[i] ?? 0) / Math.max(each.length, 1);
        out.set(id, { centroid, each });
      }
      return out;
    });
    // A rejection must not be replayed for the life of the process: drop the
    // cached promise so the next call retries, as `Translator`'s cache does.
    this.#warming.catch(() => {
      this.#warming = undefined;
    });
    return this.#warming;
  }

  async score(text: string): Promise<ReadonlyMap<string, EmbedScores>> {
    const vectors = await this.#vectors();
    const [query] = await this.#embedder.embed([text]);
    const out = new Map<string, EmbedScores>();
    if (query === undefined) return out;
    for (const [id, { centroid, each }] of vectors) {
      const max = each.reduce((best, v) => Math.max(best, cosine(query, v)), -1);
      out.set(id, { centroid: cosine(query, centroid), max });
    }
    return out;
  }

  /** The language whose prototypes this feature holds. */
  get locale(): string {
    return this.#locale;
  }
}
```

- [ ] **Step 4: Add the subpath**

In `packages/chat/package.json`:

```json
    "./embed": {
      "bun": "./src/embed/index.ts",
      "types": "./dist/embed/index.d.ts",
      "default": "./dist/embed/index.js"
    }
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `bun test packages/chat/src/embed`
Expected: PASS, 7 tests.

- [ ] **Step 6: Prove tier 2 upgrades rather than replaces**

Append to `packages/chat/src/chat.test.ts`:

```ts
test("handle still answers when an embedder is configured", async () => {
  const { PrototypeFeature } = await import("./embed");
  const stub = {
    id: "stub",
    embed: async (texts: readonly string[]) =>
      texts.map(() => new Float32Array([1, 0, 0])),
  };
  const chat = new ChatResolver({
    engine,
    resolvers,
    locales: [chatEn],
    weights: LinearModel.from(fixtureTable(resolvers.map((r) => r.id))),
    threshold: 0.4,
    embedder: new PrototypeFeature(stub, resolvers, "en"),
  });
  // Synchronous door, embedder present: the tier 0+1 answer, not an exception.
  expect(chat.handle("what is 2 + 2")?.resolver).toBe("evaluate");
  expect((await chat.handleAsync("what is 2 + 2"))?.resolver).toBe("evaluate");
});
```

Run: `bun run build && bun run typecheck && bun test packages/chat`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/chat
git commit -m "feat(chat): add the injected embedder as a tier 2 feature"
```

---

### Task 13: Eval harness, size budgets, docs, and the full gate

**Files:**
- Create: `scripts/chat-eval.ts`, `docs/packages/chat.md` — check first whether `bun run docs:packages` generates it
- Modify: `scripts/check-size.ts` (`BUDGETS`), root `package.json` (`chat:eval`), `README.md`
- Generated: `packages/chat/src/weights/en.baseline.json`

**Interfaces:**
- Consumes: everything built so far.
- Produces: `bun run chat:eval`, and a recorded baseline CI compares against.

- [ ] **Step 1: Write the eval harness**

`scripts/chat-eval.ts`. Precision on short messages is where this design dies if it dies, so it is the number CI watches.

```ts
/**
 * Held-out routing accuracy, reported per class and gated on a recorded
 * baseline — the contract `parity-record.ts` keeps for the engine.
 *
 *   bun run chat:eval            # report and compare
 *   bun run chat:eval --record   # overwrite the baseline
 */
import { ChatResolver } from "../packages/chat/src/chat";
import { testEngine } from "../packages/chat/src/engine.fixture";
import { LinearModel } from "../packages/chat/src/model";
import { convertResolver, evaluateResolver } from "../packages/chat/src/resolvers";
import { chatEn } from "../packages/chat/src/vocabulary";
import table from "../packages/chat/src/weights/en.json";

/** Held out from `chat-train.ts`: different payloads, different phrasings, and
 * short messages, which is the weak case the design names. */
const CASES: Array<[string, string | null]> = [
  ["what is 7 * 6", "evaluate"],
  ["how much is 2 kg + 300 g", "evaluate"],
  ["convert 10 miles to km", "convert"],
  ["hi could you turn 40 C into F please", "convert"],
  ["can you calculate 15% of 200", "evaluate"],
  ["lol", null],
  ["ok sounds good", null],
  ["morning everyone", null],
  ["thanks a lot", null],
  ["see you at the standup", null],
  ["5kg", null],
  ["convert", null],
];

const chat = new ChatResolver({
  engine: testEngine(),
  resolvers: [evaluateResolver, convertResolver],
  locales: [chatEn],
  weights: LinearModel.from(table as never),
});

let correct = 0;
let answered = 0;
let rightWhenAnswered = 0;
for (const [text, want] of CASES) {
  const got = chat.handle(text)?.resolver ?? null;
  if (got !== null) answered++;
  if (got === want) {
    correct++;
    if (got !== null) rightWhenAnswered++;
  }
  if (got !== want) console.log(`  ${JSON.stringify(text)}: want ${want}, got ${got}`);
}

const report = {
  accuracy: correct / CASES.length,
  precision: answered === 0 ? 1 : rightWhenAnswered / answered,
  abstainRate: (CASES.length - answered) / CASES.length,
};
console.log(report);

const baselineUrl = new URL("../packages/chat/src/weights/en.baseline.json", import.meta.url);
if (process.argv.includes("--record")) {
  await Bun.write(baselineUrl, `${JSON.stringify(report, null, 1)}\n`);
  console.log("baseline recorded");
  process.exit(0);
}

const baseline = await Bun.file(baselineUrl).json();
// A tolerance, not equality: a retrain moves a number by a hair, and a gate
// that fires on noise is a gate people delete.
const slipped = (["accuracy", "precision"] as const).filter(
  (key) => report[key] < baseline[key] - 0.02,
);
if (slipped.length > 0) {
  console.error(`chat-eval regressed on ${slipped.join(", ")} against the baseline`);
  process.exit(1);
}
console.log("chat-eval OK");
```

Add to the root `package.json`:

```json
    "chat:eval": "bun run scripts/chat-eval.ts",
```

- [ ] **Step 2: Record the baseline and read the numbers**

```bash
bun run chat:eval --record
cat packages/chat/src/weights/en.baseline.json
```

If precision is below 0.8, the corpus in `chat-train.ts` is too thin. Add payloads and frame templates, `bun run chat:train`, and re-record. Do NOT lower the baseline to make it pass — the baseline is the claim, and a claim edited to match the result says nothing.

- [ ] **Step 3: Add the size budgets**

In `scripts/check-size.ts`'s `BUDGETS`, add rows with a comment recording what they cover. Run the check first to read the real numbers, then write them in:

```bash
bun run build
bun run check-size
```

```ts
  // 2026-09-19, @smartput/chat. Three rows, because they measure three
  // different promises: the barrel links no engine runtime and no decimal.js
  // (design §2), the trained table is data whose size is a budget rather than
  // an estimate (§4.3), and `./embed` ships no model.
  { label: "chat root", from: "@smartput/chat", names: ["ChatResolver"], min: 0, gzip: 0 },
  { label: "chat weights en", from: "@smartput/chat/weights/en", names: ["default"], min: 0, gzip: 0 },
  { label: "chat embed", from: "@smartput/chat/embed", names: ["PrototypeFeature"], min: 0, gzip: 0 },
```

Replace each `0` with the measured bytes plus roughly 10% headroom, from the `check-size` output. The floor guard means a row set far above the truth fails too, so do not pad generously.

Run: `bun run check-size`
Expected: three `chat` rows reported, none OVER or UNDER.

- [ ] **Step 4: Confirm the barrel links no engine runtime**

This is the claim in Global Constraints, and `check-size` is what proves it. The `chat root` figure should be a few KB. If it is over ~30 KB, `decimal.js` is being linked — find the value import of `@smartput/core` that should be `import type` and fix it.

```bash
bun run check-size 2>&1 | grep chat
```

- [ ] **Step 5: Add the docs page**

```bash
bun run docs:packages
git status --short docs/
```

If that generated `docs/packages/chat.md`, review it and stop here. If it did not, write the page by hand following `docs/packages/query.md`'s shape: what the package does, the pipeline, a worked example ending in the referent case from design §4.6, the tier table, and how to retrain.

Add a row to `README.md`'s **Money, maths, places, queries** table:

```md
| [`@smartput/chat`](docs/packages/chat.md) | A chat message to a resolved value, or to silence. |
```

- [ ] **Step 6: Run the full gate**

```bash
bun run check
```
Expected: lint, typecheck, check-deps, test, build, check-size all pass.

Common failures and their causes:
- `check-deps`: a value import of `@smartput/core` in shipping source, or `@smartput/kinds` imported from a file whose name lacks the `.fixture.ts`/`.test.ts` suffix.
- `check-size` UNDER: a budget written higher than the truth. Lower it.
- Biome: duplicate imports from one module in `features.test.ts` — merge them.

- [ ] **Step 7: Check the commit subjects and commit**

```bash
bun run check-commits origin/main..HEAD
git add -A
git commit -m "feat(chat): add the eval harness, size budgets and docs"
```

---

## Self-Review Notes

**Spec coverage.** Every section maps to a task: §1/§1.1 → the design comments in Tasks 5 and 7 that state why the model is linear; §2 layout → Task 1, with subpaths added by the task that creates each file, because `build.ts` fails on an `exports` entry whose source is missing; §3 entry points → Tasks 3, 9, 11, 12; §4.1 scan → Task 5; §4.2 carve → Task 4; §4.3 featurize → Tasks 5 and 6; §4.4 score → Task 7; §4.5 fill → Task 8; §4.6 the worked case → a test in Task 10; §5 resolvers → Task 9; §6 `ChatResolver` → Task 10; §7 tier 2 → Task 12; §8 training and eval → Tasks 11 and 13; §9 vocabulary → Task 3; §10 errors → Task 1; §11 testing → the test file in every task; §12 risks → the eval baseline in Task 13, which is where the abstain-threshold risk becomes a number.

**Two spec items deliberately deferred, and where they are recorded.** `chatUk` and `./weights/uk` are in the spec's §9 and in this plan's file table, but no task builds them: the spec says ship `en` first and let tier 1 carry the rest, and a Ukrainian phrase list written by someone who does not speak it is worse than none. Add it as its own task when a speaker is available — `@smartput/query`'s `queryUk` is the model to follow. `./locale/uk` is likewise absent from every `exports` map edit above, so nothing references a file that does not exist.

**Type consistency checked across tasks.** `Filled` gains `text` in Task 8 and every later use reads it (Task 9's convert resolver, Task 10's test). `Conversation.entries` is added in Task 8 and `candidates` is rewritten on top of it so the two orderings cannot drift. `EmbeddingFeature` is declared as a stub interface in Task 10 Step 5 and implemented in Task 12, so `chat.ts`'s type import resolves at every point in the sequence. `NAMED_FEATURES`, `NGRAM_BUCKETS` and `WeightTable.features`/`buckets` are checked against each other at load time by `LinearModel.from`, which is what turns "this table is stale" from a silent wrong answer into a startup error.

**One known rough edge.** Task 11's `payloadOf` recovers the payload span by substring search over the template list, which works because `chat-train.ts` generated both halves. It is not a general function and must not be exported from the package — if a later task needs payload recovery at runtime, that is a new design question, not a reuse.
