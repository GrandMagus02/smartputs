# Word Math Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `"one kg"`, `"one thousand thirty two"` and `"ten km plus five km"` evaluate exactly like `"1 kg"`, `"1032"` and `"10 km + 5 km"`.

**Architecture:** Two pure `Token[] → Token[]` passes are inserted between `lex` and `parse` in `createEngine`'s `pipeline()`. `foldNumerals` collapses runs of spelled-number words into one `number` token by calling the locale's `numerals` hook. `foldWordOps` rewrites `plus`/`minus`/`times`/`over` keyword tokens into the `op` tokens the Pratt parser already understands. The lexer, parser, resolver, solver and evaluator are untouched.

**Tech Stack:** TypeScript, Bun (runtime + test runner), `decimal.js`, Biome.

## Global Constraints

- **`@smartput/core` ships exactly one runtime dependency**, `decimal.js`. `bun run check-deps` fails on a second. Add no imports outside the package.
- **All arithmetic uses `Decimal`**, never JS `number`. The engine promises 23-significant-digit fidelity and there is a corpus row testing it.
- **Verification command is `bun run check`** — Biome lint, `tsc --noEmit`, dependency check, then `bun test`. A task is not done until it passes.
- **`docs/superpowers/specs/2026-08-05-smartputs-word-math-design.md`** is the spec. Section references below (§4.3, §5.2, …) point into it.
- **Corpus files are tab-separated.** `packages/core/corpus/en.tsv` columns are `input`, `kind`, `canonical`, `formatted`. Aligned columns in this plan are for reading; write real tabs.
- **Locale objects are deep-frozen** by `defineLocale`. Never mutate one at runtime.
- Every code comment must explain *why*, matching the existing house style. Do not add comments that restate the code.

---

### Task 1: The numeral parser

Adds the `NumeralParser` contract and a table-driven English implementation. Pure functions only — nothing calls them yet, so this task cannot change any existing behaviour.

**Files:**
- Modify: `packages/core/src/types.ts:214` (the `numerals` field) and the type declarations above the `Locale` interface
- Modify: `packages/core/src/locale/helpers.ts`
- Modify: `packages/core/src/locale/en.ts`
- Modify: `packages/core/src/index.ts:40`
- Test: `packages/core/src/locale/helpers.test.ts`

**Interfaces:**
- Consumes: `Decimal` from `packages/core/src/decimal.ts` (a re-export of `decimal.js` configured to 28 digits of precision).
- Produces:
  - `interface NumeralMatch { value: Decimal; consumed: number }` in `types.ts`
  - `type NumeralParser = (words: string[]) => NumeralMatch | null` in `types.ts`
  - `Locale.numerals?: NumeralParser`
  - `cardinalNumerals(opts): NumeralParser` exported from `locale/helpers.ts` and from the package root
  - `en.numerals` set to an English `NumeralParser`

- [ ] **Step 1: Replace the `numerals` field and add its two types**

In `packages/core/src/types.ts`, delete the line `numerals?: (word: string) => Decimal | null;` from the `Locale` interface and put `numerals?: NumeralParser;` in its place. Then add these two declarations immediately above the `Locale` interface:

```ts
export interface NumeralMatch {
  value: Decimal;
  /** How many of the offered words the parser claimed, counting from the front. */
  consumed: number;
}

/**
 * Offered a run of consecutive words, claims a prefix of it. The single-word
 * signature this replaced could not express "one thousand thirty two": it saw
 * one word and had no way to ask for more.
 */
export type NumeralParser = (words: string[]) => NumeralMatch | null;
```

`types.ts` already imports `Decimal` on line 1, so no import changes.

- [ ] **Step 2: Write the failing tests for `cardinalNumerals`**

Append to `packages/core/src/locale/helpers.test.ts`:

```ts
const cardinals = cardinalNumerals({
  units: { zero: 0, one: 1, two: 2, five: 5, nineteen: 19 },
  tens: { twenty: 20, thirty: 30 },
  scales: { hundred: 100, thousand: 1000, million: 1_000_000 },
  connectors: ["and"],
});

const claimed = (words: string[]) => {
  const m = cardinals(words);
  return m === null ? null : [m.value.toString(), m.consumed];
};

test("cardinalNumerals reads a single word", () => {
  expect(claimed(["one"])).toEqual(["1", 1]);
});

test("cardinalNumerals reads zero", () => {
  expect(claimed(["zero"])).toEqual(["0", 1]);
});

test("cardinalNumerals adds a tens word to a units word", () => {
  expect(claimed(["twenty", "two"])).toEqual(["22", 2]);
});

test("cardinalNumerals multiplies by a scale word", () => {
  expect(claimed(["two", "hundred"])).toEqual(["200", 2]);
});

test("cardinalNumerals treats a leading scale word as one of them", () => {
  expect(claimed(["hundred"])).toEqual(["100", 1]);
});

test("cardinalNumerals accumulates across a thousands boundary", () => {
  expect(claimed(["one", "thousand", "thirty", "two"])).toEqual(["1032", 4]);
});

test("cardinalNumerals skips a connector between claimed words", () => {
  expect(claimed(["two", "hundred", "and", "five"])).toEqual(["205", 4]);
});

test("cardinalNumerals never claims a trailing connector", () => {
  expect(claimed(["five", "and", "kg"])).toEqual(["5", 1]);
});

test("cardinalNumerals stops at the first unknown word", () => {
  expect(claimed(["twenty", "two", "km", "five"])).toEqual(["22", 2]);
});

test("cardinalNumerals matches case-insensitively", () => {
  expect(claimed(["One", "MILLION"])).toEqual(["1000000", 2]);
});

test("cardinalNumerals returns null when it claims nothing", () => {
  expect(cardinals(["km"])).toBeNull();
  expect(cardinals([])).toBeNull();
});

test("cardinalNumerals will not claim a leading connector", () => {
  expect(cardinals(["and", "five"])).toBeNull();
});
```

Add `cardinalNumerals` to the existing import on line 2 of that file.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test packages/core/src/locale/helpers.test.ts`
Expected: FAIL — `SyntaxError` or `cardinalNumerals is not a function`, because the export does not exist.

- [ ] **Step 4: Implement `cardinalNumerals`**

Append to `packages/core/src/locale/helpers.ts`, and add `import { Decimal } from "../decimal";` plus `NumeralMatch` and `NumeralParser` to the type import on line 1:

```ts
export function cardinalNumerals(opts: {
  units: Record<string, number>;
  tens: Record<string, number>;
  scales: Record<string, number>;
  connectors?: string[];
}): NumeralParser {
  const table = (source: Record<string, number>) =>
    new Map(
      Object.entries(source).map(([word, value]) => [
        word.toLowerCase(),
        new Decimal(value),
      ]),
    );

  const addends = new Map([...table(opts.units), ...table(opts.tens)]);
  const scales = table(opts.scales);
  const connectors = new Set((opts.connectors ?? []).map((w) => w.toLowerCase()));
  const THOUSAND = new Decimal(1000);

  return (words) => {
    let total = new Decimal(0);
    let current = new Decimal(0);
    // Distinct from `current.isZero()` so "hundred" alone reads as 100 while
    // "zero thousand" still reads as 0.
    let currentSet = false;
    let claimed = false;
    // The prefix length at the last accepting state. A connector advances the
    // scan without advancing this, which is what stops "five and kg" from
    // claiming the "and".
    let consumed = 0;

    for (const [index, raw] of words.entries()) {
      const word = raw.toLowerCase();

      const addend = addends.get(word);
      if (addend !== undefined) {
        current = current.plus(addend);
        currentSet = true;
        claimed = true;
        consumed = index + 1;
        continue;
      }

      const scale = scales.get(word);
      if (scale !== undefined) {
        const multiplicand = currentSet ? current : new Decimal(1);
        if (scale.gte(THOUSAND)) {
          total = total.plus(multiplicand.times(scale));
          current = new Decimal(0);
          currentSet = false;
        } else {
          current = multiplicand.times(scale);
          currentSet = true;
        }
        claimed = true;
        consumed = index + 1;
        continue;
      }

      if (claimed && connectors.has(word)) continue;
      break;
    }

    // `total` and `current` only ever advance on an accepting word, so their
    // sum already describes the prefix `consumed` points at.
    return claimed ? { value: total.plus(current), consumed } : null;
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test packages/core/src/locale/helpers.test.ts`
Expected: PASS, all tests including the pre-existing analyzer ones.

- [ ] **Step 6: Give the `en` locale its cardinal table**

In `packages/core/src/locale/en.ts`, add `cardinalNumerals` to the import on line 2, and add a `numerals` field between `analyze` and `keywords`:

```ts
  numerals: cardinalNumerals({
    units: {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
      eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
      fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
      nineteen: 19,
    },
    tens: {
      twenty: 20, thirty: 30, forty: 40, fifty: 50,
      sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    },
    scales: {
      hundred: 100,
      thousand: 1_000,
      million: 1_000_000,
      billion: 1_000_000_000,
      trillion: 1_000_000_000_000,
    },
    // "and" is a numeral connector, not an operator. A locale cannot have it
    // both ways, and "two hundred and five" is the commoner input.
    connectors: ["and"],
  }),
```

Nothing reads `locale.numerals` yet, so this changes no behaviour.

- [ ] **Step 7: Export the helper from the package root**

In `packages/core/src/index.ts`, change line 40 to:

```ts
export { cardinalNumerals, identity, suffixStripper, tableAnalyzer } from "./locale/helpers";
```

- [ ] **Step 8: Verify the whole suite still passes**

Run: `bun run check`
Expected: lint clean, typecheck clean, one dependency, all tests PASS. The engine's behaviour is unchanged because nothing calls the new code.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/locale/helpers.ts \
        packages/core/src/locale/helpers.test.ts packages/core/src/locale/en.ts \
        packages/core/src/index.ts
git commit -m "feat(core): add cardinalNumerals and the NumeralParser contract"
```

---

### Task 2: The numeral fold pass

Turns runs of spelled-number word tokens into single `number` tokens. Still not wired into the engine, so this task changes no end-to-end behaviour either.

**Files:**
- Create: `packages/core/src/parse/numerals.ts`
- Test: `packages/core/src/parse/numerals.test.ts`

**Interfaces:**
- Consumes: `Token` from `packages/core/src/parse/lex.ts` (a discriminated union on `type`, members `number`, `word`, `op`, `keyword`, `lparen`, `rparen`, all carrying `start` and `end` offsets); `lex` and `normalize` from the same directory; `Locale` and `NumeralParser` from `types.ts`; the `en` locale, which now sets `numerals`.
- Produces: `foldNumerals(tokens: Token[], locale: Locale): Token[]`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/parse/numerals.test.ts`:

```ts
import { expect, test } from "bun:test";
import en from "../locale/en";
import type { Locale } from "../types";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { foldNumerals } from "./numerals";

const fold = (input: string) => foldNumerals(lex(normalize(input), en), en);

/** Compact shape for assertions: type, surface-ish text, span. */
const shape = (input: string) =>
  fold(input).map((t) => [
    t.type,
    t.type === "number" ? t.value.toString() : t.type === "word" ? t.text : "",
    t.start,
    t.end,
  ]);

test("a single numeral word becomes a number token", () => {
  expect(shape("one kg")).toEqual([
    ["number", "1", 0, 3],
    ["word", "kg", 4, 6],
  ]);
});

test("a multi-word numeral collapses into one token spanning it", () => {
  expect(shape("one thousand thirty two")).toEqual([["number", "1032", 0, 23]]);
});

test("a connector inside a numeral is absorbed", () => {
  expect(shape("two hundred and five g")).toEqual([
    ["number", "205", 0, 20],
    ["word", "g", 21, 22],
  ]);
});

test("a hyphen joining two numeral words is absorbed", () => {
  expect(shape("twenty-two km")).toEqual([
    ["number", "22", 0, 10],
    ["word", "km", 11, 13],
  ]);
});

test("a spaced dash between numeral words stays subtraction", () => {
  expect(shape("twenty - two")).toEqual([
    ["number", "20", 0, 6],
    ["op", "", 7, 8],
    ["number", "2", 9, 12],
  ]);
});

test("a scale word directly after digits multiplies them", () => {
  expect(shape("1.5 million km")).toEqual([
    ["number", "1500000", 0, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a non-scale numeral after digits is left alone", () => {
  expect(shape("5 one")).toEqual([
    ["number", "5", 0, 1],
    ["number", "1", 2, 5],
  ]);
});

test("unit words are untouched", () => {
  expect(shape("10 km")).toEqual([
    ["number", "10", 0, 2],
    ["word", "km", 3, 5],
  ]);
});

test("a numeral run stops at a unit word and resumes after it", () => {
  expect(shape("ten km five km")).toEqual([
    ["number", "10", 0, 3],
    ["word", "km", 4, 6],
    ["number", "5", 7, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a locale without numerals is passed through unchanged", () => {
  const bare = { ...en, numerals: undefined } as Locale;
  const tokens = lex(normalize("one kg"), bare);
  expect(foldNumerals(tokens, bare)).toBe(tokens);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/parse/numerals.test.ts`
Expected: FAIL — cannot resolve `./numerals`.

- [ ] **Step 3: Implement the pass**

Create `packages/core/src/parse/numerals.ts`:

```ts
import type { Locale } from "../types";
import type { Token } from "./lex";

/**
 * Longest cardinal the largest plausible table can express, so the cap bounds
 * the work per token without ever truncating a real number. Five scale groups
 * up to trillions, each "nine hundred and ninety nine" plus its scale word, is
 * 29 words. Rounded up for headroom.
 */
const MAX_RUN = 32;

interface Run {
  words: string[];
  /** `ends[k]` is the token index just past the k-th word, hyphens included. */
  ends: number[];
}

/**
 * Consecutive `word` tokens from `start`, hopping a hyphen that joins two of
 * them. `normalize()` maps every dash to "-" and the lexer emits that as an op,
 * so "twenty-two" arrives as word/op/word and would otherwise evaluate to 18.
 * Absorbing it only when nothing separates it from the words on either side is
 * what keeps "twenty - two" as subtraction; the spans make that test exact.
 */
function collectRun(tokens: Token[], start: number): Run {
  const words: string[] = [];
  const ends: number[] = [];
  let i = start;
  let prev: Token | undefined;

  while (i < tokens.length && words.length < MAX_RUN) {
    let cursor = i;
    const dash = tokens[cursor];

    if (prev !== undefined && dash !== undefined && dash.type === "op" && dash.op === "-") {
      const after = tokens[cursor + 1];
      if (
        after === undefined ||
        after.type !== "word" ||
        prev.end !== dash.start ||
        dash.end !== after.start
      ) {
        break;
      }
      cursor += 1;
    }

    const token = tokens[cursor];
    if (token === undefined || token.type !== "word") break;

    words.push(token.text);
    i = cursor + 1;
    ends.push(i);
    prev = token;
  }

  return { words, ends };
}

export function foldNumerals(tokens: Token[], locale: Locale): Token[] {
  const numerals = locale.numerals;
  if (numerals === undefined) return tokens;

  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i] as Token;

    if (token.type === "number") {
      const next = tokens[i + 1];
      if (next !== undefined && next.type === "word") {
        const match = numerals([next.text]);
        // Only a bare scale word may attach to digits, so "1.5 million" reads
        // as one number while "5 one" stays two adjacent numbers the parser
        // refuses. Identifying the scale word by value rather than by table is
        // what keeps this pass locale-agnostic: no other one-word cardinal
        // reaches 100.
        if (match !== null && match.consumed === 1 && match.value.gte(100)) {
          out.push({
            type: "number",
            value: token.value.times(match.value),
            text: `${token.text} ${next.text}`,
            start: token.start,
            end: next.end,
          });
          i += 2;
          continue;
        }
      }
      out.push(token);
      i += 1;
      continue;
    }

    if (token.type === "word") {
      const run = collectRun(tokens, i);
      const match = run.words.length === 0 ? null : numerals(run.words);
      if (match !== null && match.consumed > 0 && match.consumed <= run.words.length) {
        const end = run.ends[match.consumed - 1] as number;
        const last = tokens[end - 1] as Token;
        out.push({
          type: "number",
          value: match.value,
          // Informational only — `explain()` reads it, the parser reads `value`.
          // Joined rather than sliced because the pass never sees the input.
          text: run.words.slice(0, match.consumed).join(" "),
          start: token.start,
          end: last.end,
        });
        i = end;
        continue;
      }
    }

    out.push(token);
    i += 1;
  }

  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/src/parse/numerals.test.ts`
Expected: PASS, all ten tests.

- [ ] **Step 5: Verify nothing else moved**

Run: `bun run check`
Expected: everything PASS. `foldNumerals` still has no caller.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parse/numerals.ts packages/core/src/parse/numerals.test.ts
git commit -m "feat(core): fold spelled-out numerals into number tokens"
```

---

### Task 3: Word operators

Gives `en` the operator words and rewrites them into the op tokens the parser already handles. Not wired in yet.

**Files:**
- Modify: `packages/core/src/types.ts` (the `Keyword` union)
- Modify: `packages/core/src/locale/en.ts` (the `keywords` block)
- Create: `packages/core/src/parse/wordops.ts`
- Test: `packages/core/src/parse/wordops.test.ts`

**Interfaces:**
- Consumes: `Token` from `parse/lex.ts`; `Keyword` and `OpSymbol` from `types.ts`. `OpSymbol` is `"+" | "-" | "*" | "/" | "in" | "of"`.
- Produces: `foldWordOps(tokens: Token[]): Token[]` — no locale parameter, because the keyword-to-operator mapping is core and only the surface words are per-locale.

- [ ] **Step 1: Widen the `Keyword` union**

In `packages/core/src/types.ts`, replace the `Keyword` declaration with:

```ts
/**
 * The keys of `Locale.keywords`, not the surface words. A locale lists every
 * word that means conversion under `in` (English: "in", "to", "as"), and
 * `keywordFor` returns the key — so "to" and "as" are values, never keys, and
 * a `Keyword` of "to" is unreachable by construction.
 *
 * `plus`, `minus`, `times` and `over` are rewritten into op tokens before the
 * parser runs. `by` exists only to be swallowed by one of those four, so that
 * "divided by" is a single operator; anywhere else it reaches the parser
 * unconsumed and fails, exactly as a stray "as" does.
 */
export type Keyword = "in" | "of" | "plus" | "minus" | "times" | "over" | "by";
```

- [ ] **Step 2: Give `en` the operator words**

In `packages/core/src/locale/en.ts`, replace the `keywords` block with:

```ts
  keywords: {
    in: ["in", "to", "as"],
    of: ["of"],
    plus: ["plus"],
    minus: ["minus"],
    times: ["times", "multiplied"],
    over: ["over", "divided"],
    by: ["by"],
  },
```

A word listed here can never be a unit alias, because `keywordFor` runs before
candidate resolution — the same trade `in` already makes with the inch alias.
None of these is a registered alias in any shipped lexicon.

- [ ] **Step 3: Write the failing tests**

Create `packages/core/src/parse/wordops.test.ts`:

```ts
import { expect, test } from "bun:test";
import en from "../locale/en";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { foldWordOps } from "./wordops";

const shape = (input: string) =>
  foldWordOps(lex(normalize(input), en)).map((t) => [
    t.type,
    t.type === "op" ? t.op : t.type === "keyword" ? t.keyword : "",
    t.start,
    t.end,
  ]);

test("plus becomes an addition op spanning the word", () => {
  expect(shape("10 plus 5")).toEqual([
    ["number", "", 0, 2],
    ["op", "+", 3, 7],
    ["number", "", 8, 9],
  ]);
});

test("minus, times and over become their operators", () => {
  expect(shape("10 minus 5")[1]).toEqual(["op", "-", 3, 8]);
  expect(shape("10 times 5")[1]).toEqual(["op", "*", 3, 8]);
  expect(shape("10 over 5")[1]).toEqual(["op", "/", 3, 7]);
});

test("divided by is one operator spanning both words", () => {
  expect(shape("20 divided by 4")).toEqual([
    ["number", "", 0, 2],
    ["op", "/", 3, 13],
    ["number", "", 14, 15],
  ]);
});

test("multiplied by is one operator spanning both words", () => {
  expect(shape("20 multiplied by 4")[1]).toEqual(["op", "*", 3, 16]);
});

test("a stray by is left for the parser to reject", () => {
  expect(shape("20 by 4")[1]).toEqual(["keyword", "by", 3, 5]);
});

test("conversion and percentage keywords are untouched", () => {
  expect(shape("2 km in m")[2]).toEqual(["keyword", "in", 5, 7]);
  expect(shape("20 % of 50")[2]).toEqual(["keyword", "of", 5, 7]);
});

test("symbolic operators pass through", () => {
  expect(shape("10 + 5")[1]).toEqual(["op", "+", 3, 4]);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `bun test packages/core/src/parse/wordops.test.ts`
Expected: FAIL — cannot resolve `./wordops`.

- [ ] **Step 5: Implement the pass**

Create `packages/core/src/parse/wordops.ts`:

```ts
import type { Keyword, OpSymbol } from "../types";
import type { Token } from "./lex";

/**
 * Core, not locale data: "plus" means addition in every language that has the
 * concept. Only the surface words vary, and those live in `locale.keywords`.
 */
const KEYWORD_OPS: Partial<Record<Keyword, OpSymbol>> = {
  plus: "+",
  minus: "-",
  times: "*",
  over: "/",
};

/**
 * Rewriting to op tokens before parsing is what lets word operators inherit the
 * parser's existing precedence table and its unary-minus branch, rather than
 * needing a second table kept in sync with the first.
 */
export function foldWordOps(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i] as Token;
    const op = token.type === "keyword" ? KEYWORD_OPS[token.keyword] : undefined;

    if (op === undefined) {
      out.push(token);
      i += 1;
      continue;
    }

    // "divided by" and "multiplied by" are one operator. A "by" anywhere else
    // is left alone and fails at the parser, exactly as a stray "as" does.
    const next = tokens[i + 1];
    const phrasal = next !== undefined && next.type === "keyword" && next.keyword === "by";

    out.push({
      type: "op",
      op,
      start: token.start,
      end: phrasal ? (next as Token).end : token.end,
    });
    i += phrasal ? 2 : 1;
  }

  return out;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test packages/core/src/parse/wordops.test.ts`
Expected: PASS, all seven tests.

- [ ] **Step 7: Verify the whole suite**

Run: `bun run check`
Expected: PASS. Adding keywords changes which error an input like `"10 plus 5"` raises (`UnitParseError` instead of `NoCandidateError`), but no test asserts on that input yet.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/locale/en.ts \
        packages/core/src/parse/wordops.ts packages/core/src/parse/wordops.test.ts
git commit -m "feat(core): rewrite word operators into op tokens"
```

---

### Task 4: Wire the passes into the engine

The behaviour change lands here, driven by the corpus.

**Files:**
- Modify: `packages/core/src/engine.ts:138`
- Modify: `packages/core/corpus/en.tsv`
- Test: `packages/core/src/corpus.test.ts` (no edit — it is table-driven over the `.tsv`)

**Interfaces:**
- Consumes: `foldNumerals(tokens, locale)` from Task 2, `foldWordOps(tokens)` from Task 3.
- Produces: no new exports. `Engine.evaluate`, `suggest`, `coerce` and `explain` all gain the new syntax, because all four go through `pipeline()`.

- [ ] **Step 1: Add the failing corpus rows**

Append to `packages/core/corpus/en.tsv`. **Columns are separated by a single tab.**

```
# Word math: spelled-out cardinals and word operators.
one kg	mass	1000	1 kilogram
one thousand thirty two	number	1032	1,032
two hundred and five g	mass	205	205 grams
twenty-two km	length	22000	22 kilometres
ten km plus five km	length	15000	15 kilometres
twenty divided by four	number	5	5
minus five kg	mass	-5000	-5 kilograms
1.5 million km	length	1500000000	1,500,000 kilometres
# A spaced dash is subtraction, not a hyphenated numeral.
twenty - two	number	18	18
```

- [ ] **Step 2: Run the corpus to verify the new rows fail**

Run: `bun test packages/core/src/corpus.test.ts`
Expected: FAIL — nine new failures, each a `NoCandidateError` or `UnitParseError`. Every pre-existing row must still PASS. If a pre-existing row fails at this point, stop: Task 3's keywords have shadowed something.

- [ ] **Step 3: Insert the two passes into the pipeline**

In `packages/core/src/engine.ts`, add the imports beside the existing `lex` import:

```ts
import { foldNumerals } from "./parse/numerals";
import { foldWordOps } from "./parse/wordops";
```

Replace line 138 with:

```ts
    const lexed = lex(normalized, locale as Locale);
    const tokens = foldWordOps(foldNumerals(lexed, locale as Locale));
```

Order does not matter — numeral runs are broken by keyword tokens and word
operators are never numeral words — but numerals runs first so that the hyphen
rule sees the lexer's `-` tokens exactly as emitted.

- [ ] **Step 4: Run the corpus to verify it passes**

Run: `bun test packages/core/src/corpus.test.ts`
Expected: PASS, every row.

- [ ] **Step 5: Verify the whole suite**

Run: `bun run check`
Expected: PASS. Pay attention to `packages/core/src/engine.test.ts` and `packages/core/src/index.test.ts` — if either asserts an error type for an input that now parses, the input has genuinely changed meaning and the assertion should be updated to the new behaviour, not worked around.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/engine.ts packages/core/corpus/en.tsv
git commit -m "feat(core): accept word operators and spelled-out numbers"
```

---

### Task 5: Spelled counts in completion

`scaleFit` ranks `km` over `kB` for `"20 k"` by looking at the count. Spelled counts currently score 0 on that signal. This task makes `"twenty k"` rank like `"20 k"`.

**Files:**
- Modify: `packages/core/src/complete/fragment.ts:33-50` (the body of `leadingCount`)
- Test: `packages/core/src/complete/fragment.test.ts` (exists; append to it)

**Watch out:** `fragment.test.ts:5` already declares a local `const en` — a bare
`defineLocale({ id: "en", numberFormat: "intl", keywords: {} })` stub with no
`numerals`. Do not shadow or replace it; the existing tests rely on it, and its
missing `numerals` is exactly what proves the new branch degrades cleanly. Import
the real locale under a different name, as the test code below does.

**Interfaces:**
- Consumes: `Locale.numerals` (Task 1), `Decimal`, the existing `parseNumber` from `locale/number.ts`.
- Produces: `leadingCount(input: string, upto: number, locale: Locale): Decimal | null` — unchanged signature, wider behaviour. `complete()` calls it at `complete/complete.ts:44` and needs no edit.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/complete/fragment.test.ts`. It already imports
`expect` and `test` from `bun:test` and `leadingCount` from `./fragment`. Add
one import at the top, named `enLocale` so it does not collide with the file's
existing bare `en` stub:

```ts
import enLocale from "../locale/en";
```

Then append:

```ts
const count = (input: string, upto: number) => {
  const d = leadingCount(input, upto, enLocale);
  return d === null ? null : d.toString();
};

test("leadingCount still reads digits", () => {
  expect(count("20 k", 3)).toBe("20");
});

test("leadingCount still strips a binary operator's minus", () => {
  expect(count("10 kg - 5 mil", 10)).toBe("5");
});

test("leadingCount reads a single spelled count", () => {
  expect(count("twenty k", 7)).toBe("20");
});

test("leadingCount reads a hyphenated spelled count", () => {
  expect(count("twenty-two k", 11)).toBe("22");
});

test("leadingCount reads a multi-word spelled count after other text", () => {
  expect(count("5 kg + one thousand thirty two k", 31)).toBe("1032");
});

test("leadingCount ignores words that are not a count", () => {
  expect(count("kg + mil", 6)).toBeNull();
});

test("a locale without numerals still reads digits and nothing else", () => {
  // The file's bare `en` stub declares no `numerals`, so the spelled branch
  // must degrade to null rather than throw.
  expect(leadingCount("20 k", 3, en)?.toString()).toBe("20");
  expect(leadingCount("twenty k", 7, en)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test packages/core/src/complete/fragment.test.ts`
Expected: FAIL on the three spelled-count tests, returning `null`. The two digit tests must PASS already.

- [ ] **Step 3: Implement the spelled branch**

Replace the body of `leadingCount` in `packages/core/src/complete/fragment.ts` and add the helper below it. Add `Locale` to the type import on line 3 if it is not already there:

```ts
/** Matches MAX_RUN in parse/numerals.ts, for the same reason. */
const MAX_NUMERAL_WORDS = 32;

export function leadingCount(
  input: string,
  upto: number,
  locale: Locale,
): Decimal | null {
  const head = input.slice(0, upto);
  const match = COUNT_RUN.exec(head);

  if (match !== null) {
    const run = match[0].trim();

    // Try the whole run first: a locale whose group separator is a space needs
    // "1 500,5" kept intact. Fall back to the last whitespace-delimited token,
    // which is what strips a binary operator's minus in "10 kg - 5 mil".
    const whole = parseNumber(run, locale);
    if (whole !== null) return whole;

    const last = run.split(/\s+/).pop();
    const parsed = last === undefined ? null : parseNumber(last, locale);
    if (parsed !== null) return parsed;
  }

  return spelledCount(head, locale);
}

/**
 * `NumeralParser` consumes from the front, but completion needs the count that
 * ends where the fragment begins. So try successively shorter suffixes of the
 * preceding words, longest first, and accept the first match that claims the
 * whole suffix. Hyphens split like whitespace so "twenty-two k" reads as 22.
 */
function spelledCount(head: string, locale: Locale): Decimal | null {
  const numerals = locale.numerals;
  if (numerals === undefined) return null;

  const words = head.split(/[\s-]+/).filter((w) => w.length > 0);
  const start = Math.max(0, words.length - MAX_NUMERAL_WORDS);

  for (let from = start; from < words.length; from += 1) {
    const slice = words.slice(from);
    const match = numerals(slice);
    if (match !== null && match.consumed === slice.length) return match.value;
  }

  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/core/src/complete/fragment.test.ts`
Expected: PASS, all six tests.

- [ ] **Step 5: Verify the whole suite**

Run: `bun run check`
Expected: PASS, including `complete/complete.test.ts`, `complete/score.test.ts` and `complete/roundtrip.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/complete/fragment.ts packages/core/src/complete/fragment.test.ts
git commit -m "feat(core): rank completions by spelled-out counts"
```

---

### Task 6: Documentation

**Files:**
- Modify: `docs/api/types.md`
- Modify: `docs/api/define-locale.md`
- Modify: `docs/guide/locales.md`
- Modify: `docs/guide/pipeline.md`
- Modify: `docs/guide/roadmap.md`

**Interfaces:**
- Consumes: everything shipped in Tasks 1–5. No code changes.

- [ ] **Step 1: Update the type reference**

In `docs/api/types.md`, replace `numerals?: (word: string) => Decimal | null;` with `numerals?: NumeralParser;`, widen the `Keyword` union to `"in" | "of" | "plus" | "minus" | "times" | "over" | "by"`, and add:

```ts
interface NumeralMatch {
  value: Decimal;
  consumed: number;   // words claimed, from the front
}

type NumeralParser = (words: string[]) => NumeralMatch | null;
```

- [ ] **Step 2: Update the `defineLocale` reference**

In `docs/api/define-locale.md`, update the `numerals` line in the interface block and rewrite the `### numerals` section:

```md
### numerals

`(words: string[]) => { value: Decimal; consumed: number } | null` — offered a
run of consecutive words, claims a prefix of it. `["one","thousand","thirty","two"]`
returns `{ value: 1032, consumed: 4 }`. Returns `null` for anything it does not
recognise.

Use `cardinalNumerals()` rather than writing one by hand.
```

Then extend the keywords section: the union now carries `plus`, `minus`, `times`, `over` and `by`. `plus`/`minus`/`times`/`over` are rewritten into `+`/`-`/`*`/`/` before parsing, and a `by` following one of them is swallowed so `divided by` is a single operator. Note the constraint that a word listed as a keyword cannot also be a unit alias.

- [ ] **Step 3: Add the helper to the locales guide**

In `docs/guide/locales.md`, update the `Locale` interface block, then add a section after the analyzer chain:

```md
## Numerals

`"one kg"` should mean what `"1 kg"` means. `cardinalNumerals()` builds the
parser from four tables:

    cardinalNumerals({
      units:      { zero: 0, one: 1, /* … */ nineteen: 19 },
      tens:       { twenty: 20, /* … */ ninety: 90 },
      scales:     { hundred: 100, thousand: 1_000, million: 1_000_000 },
      connectors: ["and"],
    })

Matching is greedy and `consumed` reports how much was claimed, so a trailing
connector is never eaten: `["five","and","kg"]` returns `{ value: 5, consumed: 1 }`.

English cardinals do not inflect, so the analyzer chain does not run on them.
```

- [ ] **Step 4: Document the two passes**

In `docs/guide/pipeline.md`, insert a `2b. Fold` row into the ASCII diagram
directly after the `2. Lex` row, and renumber the existing `2b. Analyze` row to
`2c`:

```
  2b. Fold          spelled-number runs → one NUMBER; operator words → OP.
  │                 "one thousand thirty two" → 1032, "divided by" → /
  │
  2c. Analyze       each WORD → lemma candidates via the locale's analyzer chain
```

Rename the existing `## Stage 2b — Analyze` heading to `## Stage 2c — Analyze`,
and insert this section directly before it:

```md
## Stage 2b — Fold

Two pure token rewrites, so the parser never learns that words can be numbers or
operators.

`foldNumerals` collapses a run of spelled-number words into a single `number`
token by calling the locale's `numerals` hook, which claims a prefix of the run
and reports how much it took. A hyphen between two numeral words is absorbed
only when nothing separates it from either side, so `twenty-two` is 22 while
`twenty - two` is 18.

`foldWordOps` rewrites the `plus`, `minus`, `times` and `over` keywords into
`+`, `-`, `*` and `/`, swallowing a following `by` so that `divided by` is one
operator.

Because both run before parsing, `"ten plus five"` and `"10 + 5"` reach the
parser as identical token streams. Word operators get the existing precedence
table for free, with no second table to keep in sync:
`ten plus two times three` is 16.
```

Update the `## Stage 2 — Lex` section's closing line to note that `-` is emitted
as an op token even between letters, which is what stage 2b's hyphen rule exists
to undo.

- [ ] **Step 5: Add the roadmap row**

In `docs/guide/roadmap.md`, add a row to the milestone table after the **M2.5** row:

```md
| **M2.6** | Word operators (`plus`, `minus`, `times`, `over`, `divided by`), spelled-out cardinals via `cardinalNumerals()`, `Locale.numerals` wired in. | **Shipped** |
```

Add to the "Out of scope for v1" paragraph: spelled decimals (`three point five`), fractions (`half a kg`) and ordinals.

- [ ] **Step 6: Verify the docs build**

Run: `bun run docs:build`
Expected: build succeeds with no dead-link warnings.

- [ ] **Step 7: Commit**

```bash
git add docs/api/types.md docs/api/define-locale.md docs/guide/locales.md \
        docs/guide/pipeline.md docs/guide/roadmap.md
git commit -m "docs: word operators and spelled-out numbers"
```

---

## Verification

Final gate, after Task 6:

```bash
bun run check
```

All four must be green: Biome, `tsc --noEmit`, the one-dependency check, and the
full test suite including every corpus row.
