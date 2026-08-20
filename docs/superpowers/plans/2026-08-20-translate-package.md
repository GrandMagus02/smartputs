# `@smartput/translate` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@smartput/translate`, a standalone workspace package that translates text via LibreTranslate, Google Cloud Translate or DeepL, including a literal parser for phrases like `"hello in ukrainian"`.

**Architecture:** Mirrors `@smartput/rate`/`@smartput/geo`'s provider pattern — a `TranslateProvider` interface, one factory per upstream API (raw `fetch`, no SDKs), a `custom()` escape hatch, and a `Translator` class that wraps one provider with language-name resolution and an in-memory cache. Stays outside the Kind/engine system entirely (no `Vocabulary`, no `Value`, no numeric quantity) — root barrel (`.`) carries zero network code, `./providers` is the fetch-touching subpath.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Bun (`bun test`, workspaces), Biome (lint/format).

**Spec:** `docs/superpowers/specs/2026-08-20-translate-package-design.md`

## Global Constraints

- One runtime dependency: `@smartput/kind` (for `SmartputError`, imported from `@smartput/kind/errors` — never through `@smartput/core`'s root barrel, which pulls in `decimal.js`).
- No provider SDKs — every provider factory uses raw `fetch`, injectable via `opts.fetch` (default `globalThis.fetch`), exactly like `packages/rate/src/providers/ecb.ts`.
- Two entry points: `.` (types, errors, language table, literal parser, `Translator`) and `./providers` (the four factories). Nothing under `.` may import anything under `./providers`.
- `packages/translate/package.json` **must** be added to `scripts/check-deps.ts`'s `ALLOWED` map with exactly `["@smartput/kind"]`, or `bun run check-deps` (part of `bun run check`, and CI) fails on this package.
- Package version starts at `0.1.0` (the convention for a brand-new package in this repo — see `packages/query-introspect/package.json`).
- Every provider error is a `TranslateProviderError`, extending `SmartputError` (from `@smartput/kind/errors`), never a bare `Error`.
- `bun run docs:packages` (the docs-site generator) will fail once it discovers this package, because it requires `DEMOS`/`EXAMPLES`/`META` entries in `scripts/gen-package-pages.ts` for every package directory. This is **out of scope** for this plan (`docs:packages`/`docs:build` are not part of `bun run check` or CI — see `.github/workflows/*.yml`, which run `lint`, `typecheck`, `check-deps`, `bun test`, `build`, `check-size`, none of which touch docs generation). Flag it to the user as a known follow-up if they run the docs site build; do not add a task for it here.

---

## File Structure

```
packages/translate/
  package.json
  tsconfig.json
  src/
    types.ts              # TranslateResult, TranslateProvider, LanguageDef, TranslateLiteral
    errors.ts             # TranslateProviderError
    errors.test.ts
    languages.ts           # LANGUAGES table (ISO 639-1) + resolveLanguage()
    languages.test.ts
    literal.ts             # parseLiteral()
    literal.test.ts
    translator.ts           # Translator class
    translator.test.ts
    index.ts               # root barrel — no network code
    providers/
      custom.ts
      libretranslate.ts
      libretranslate.test.ts
      google.ts
      google.test.ts
      deepl.ts
      deepl.test.ts
      index.ts             # ./providers barrel
```

Root `src/index.ts` grows by one `export` line per task (Tasks 1–4); `src/providers/index.ts` grows by one line per provider (Tasks 6–7). Both are edited incrementally rather than written once, so every task leaves `bun run typecheck` and `bun test` passing on their own.

---

### Task 1: Package scaffold, shared types, and the error class

**Files:**
- Create: `packages/translate/package.json`
- Create: `packages/translate/tsconfig.json`
- Create: `packages/translate/src/types.ts`
- Create: `packages/translate/src/errors.ts`
- Test: `packages/translate/src/errors.test.ts`
- Create: `packages/translate/src/index.ts`
- Modify: `scripts/check-deps.ts`

**Interfaces:**
- Consumes: `SmartputError` from `@smartput/kind/errors`.
- Produces: `TranslateResult`, `TranslateProvider`, `LanguageDef`, `TranslateLiteral` (all in `./types`); `TranslateProviderError` (in `./errors`) — every later task in this plan imports from these two files.

- [ ] **Step 1: Create the package manifest**

`packages/translate/package.json`:

```json
{
  "name": "@smartput/translate",
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
    "@smartput/kind": "workspace:*"
  }
}
```

- [ ] **Step 2: Create the package tsconfig**

`packages/translate/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install so the workspace picks up the new package**

Run: `bun install`
Expected: completes with no errors; `packages/translate` appears as a linked workspace package (check with `bun pm ls | grep translate` or by confirming `node_modules/@smartput/translate` is a symlink into `packages/translate`).

- [ ] **Step 4: Write the shared types**

`packages/translate/src/types.ts`:

```ts
/**
 * The shape every provider hands back. Kept apart from the providers
 * themselves so the root barrel — and `Translator`, which only needs the
 * shape, never a fetch call — links no network code (design §5).
 */
export interface TranslateResult {
  readonly text: string;
  readonly source: string;
  readonly target: string;
  readonly provider: string;
}

/** The contract every `./providers` factory returns (design §5). */
export interface TranslateProvider {
  readonly id: string;
  translate(text: string, target: string, source?: string): Promise<TranslateResult>;
}

/** One row of the ISO 639-1 table in `./languages` (design §3). */
export interface LanguageDef {
  readonly code: string;
  readonly name: string;
  readonly aliases?: readonly string[];
}

/** What `parseLiteral` in `./literal` returns (design §4). */
export interface TranslateLiteral {
  readonly text: string;
  readonly target: string;
  readonly source?: string;
}
```

- [ ] **Step 5: Write the error class**

`packages/translate/src/errors.ts`:

```ts
import { SmartputError } from "@smartput/kind/errors";

/**
 * A provider failed outright — non-2xx response, or a payload that does not
 * match the shape its own API promises — or `Translator` could not resolve a
 * language name / literal before ever reaching a provider. Same shape as
 * `@smartput/rate`'s `RateProviderError`; not added to `@smartput/kind/errors`
 * because a translation failure never crosses the shared `evaluate` path
 * (design §7).
 */
export class TranslateProviderError extends SmartputError {
  readonly provider: string;

  constructor(provider: string, detail: string) {
    super(`Translate provider ${JSON.stringify(provider)} failed: ${detail}`, provider);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "TranslateProviderError";
    this.provider = provider;
  }
}
```

- [ ] **Step 6: Write the failing test, then the assertions**

`packages/translate/src/errors.test.ts`:

```ts
import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/kind/errors";
import { TranslateProviderError } from "./errors";

test("carries the provider id and a message naming it", () => {
  const err = new TranslateProviderError("libretranslate", "request failed: 503");
  expect(err.provider).toBe("libretranslate");
  expect(err.message).toBe(
    'Translate provider "libretranslate" failed: request failed: 503',
  );
  expect(err.name).toBe("TranslateProviderError");
});

test("extends SmartputError", () => {
  const err = new TranslateProviderError("google", "boom");
  expect(err).toBeInstanceOf(SmartputError);
});
```

- [ ] **Step 7: Create the root barrel**

`packages/translate/src/index.ts`:

```ts
export { TranslateProviderError } from "./errors";
export type {
  LanguageDef,
  TranslateLiteral,
  TranslateProvider,
  TranslateResult,
} from "./types";
```

- [ ] **Step 8: Register the package in `check-deps.ts`**

Open `scripts/check-deps.ts` and find the `"packages/query-introspect/package.json": [],` entry (around line 379). Add immediately after it:

```ts
  // The words half — a language table and a right-anchored "<text> in
  // <language>" literal parser — plus the SmartputError this package's own
  // TranslateProviderError extends. No SDK: every provider factory under
  // ./providers speaks its API with a raw fetch.
  "packages/translate/package.json": ["@smartput/kind"],
```

- [ ] **Step 9: Run the full dependency and type checks**

Run: `bun test packages/translate`
Expected: 2 pass (the two tests in `errors.test.ts`).

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run check-deps`
Expected: no errors; output includes `@smartput/translate dependencies OK: @smartput/kind`.

- [ ] **Step 10: Format and commit**

Run: `bunx biome check --write packages/translate scripts/check-deps.ts`

```bash
git add packages/translate scripts/check-deps.ts
git commit -m "feat(translate): scaffold package, shared types and TranslateProviderError"
```

---

### Task 2: The language table and resolver

**Files:**
- Create: `packages/translate/src/languages.ts`
- Test: `packages/translate/src/languages.test.ts`
- Modify: `packages/translate/src/index.ts`

**Interfaces:**
- Consumes: `LanguageDef` from `./types` (Task 1).
- Produces: `LANGUAGES: Record<string, LanguageDef>` and `resolveLanguage(word: string): string | undefined` — used by `./literal` (Task 3) and `./translator` (Task 4).

- [ ] **Step 1: Write the language table and resolver**

`packages/translate/src/languages.ts`:

```ts
import type { LanguageDef } from "./types";

/**
 * The full ISO 639-1 set, keyed by its own lowercase code. English names
 * only for v1 — no native-script names, no locale variants (design §3, §9).
 * Aliases stay minimal: alternate English names actually in common use, not
 * an exhaustive synonym list.
 */
export const LANGUAGES: Record<string, LanguageDef> = {
  aa: { code: "aa", name: "Afar" },
  ab: { code: "ab", name: "Abkhazian" },
  ae: { code: "ae", name: "Avestan" },
  af: { code: "af", name: "Afrikaans" },
  ak: { code: "ak", name: "Akan" },
  am: { code: "am", name: "Amharic" },
  an: { code: "an", name: "Aragonese" },
  ar: { code: "ar", name: "Arabic" },
  as: { code: "as", name: "Assamese" },
  av: { code: "av", name: "Avaric" },
  ay: { code: "ay", name: "Aymara" },
  az: { code: "az", name: "Azerbaijani" },
  ba: { code: "ba", name: "Bashkir" },
  be: { code: "be", name: "Belarusian" },
  bg: { code: "bg", name: "Bulgarian" },
  bh: { code: "bh", name: "Bihari" },
  bi: { code: "bi", name: "Bislama" },
  bm: { code: "bm", name: "Bambara" },
  bn: { code: "bn", name: "Bengali" },
  bo: { code: "bo", name: "Tibetan" },
  br: { code: "br", name: "Breton" },
  bs: { code: "bs", name: "Bosnian" },
  ca: { code: "ca", name: "Catalan" },
  ce: { code: "ce", name: "Chechen" },
  ch: { code: "ch", name: "Chamorro" },
  co: { code: "co", name: "Corsican" },
  cr: { code: "cr", name: "Cree" },
  cs: { code: "cs", name: "Czech" },
  cu: { code: "cu", name: "Church Slavic" },
  cv: { code: "cv", name: "Chuvash" },
  cy: { code: "cy", name: "Welsh" },
  da: { code: "da", name: "Danish" },
  de: { code: "de", name: "German" },
  dv: { code: "dv", name: "Divehi" },
  dz: { code: "dz", name: "Dzongkha" },
  ee: { code: "ee", name: "Ewe" },
  el: { code: "el", name: "Greek" },
  en: { code: "en", name: "English" },
  eo: { code: "eo", name: "Esperanto" },
  es: { code: "es", name: "Spanish", aliases: ["castilian"] },
  et: { code: "et", name: "Estonian" },
  eu: { code: "eu", name: "Basque" },
  fa: { code: "fa", name: "Persian", aliases: ["farsi"] },
  ff: { code: "ff", name: "Fulah" },
  fi: { code: "fi", name: "Finnish" },
  fj: { code: "fj", name: "Fijian" },
  fo: { code: "fo", name: "Faroese" },
  fr: { code: "fr", name: "French" },
  fy: { code: "fy", name: "Western Frisian" },
  ga: { code: "ga", name: "Irish" },
  gd: { code: "gd", name: "Scottish Gaelic" },
  gl: { code: "gl", name: "Galician" },
  gn: { code: "gn", name: "Guarani" },
  gu: { code: "gu", name: "Gujarati" },
  gv: { code: "gv", name: "Manx" },
  ha: { code: "ha", name: "Hausa" },
  he: { code: "he", name: "Hebrew" },
  hi: { code: "hi", name: "Hindi" },
  ho: { code: "ho", name: "Hiri Motu" },
  hr: { code: "hr", name: "Croatian" },
  ht: { code: "ht", name: "Haitian Creole", aliases: ["haitian"] },
  hu: { code: "hu", name: "Hungarian" },
  hy: { code: "hy", name: "Armenian" },
  hz: { code: "hz", name: "Herero" },
  ia: { code: "ia", name: "Interlingua" },
  id: { code: "id", name: "Indonesian" },
  ie: { code: "ie", name: "Interlingue" },
  ig: { code: "ig", name: "Igbo" },
  ii: { code: "ii", name: "Sichuan Yi" },
  ik: { code: "ik", name: "Inupiaq" },
  io: { code: "io", name: "Ido" },
  is: { code: "is", name: "Icelandic" },
  it: { code: "it", name: "Italian" },
  iu: { code: "iu", name: "Inuktitut" },
  ja: { code: "ja", name: "Japanese" },
  jv: { code: "jv", name: "Javanese" },
  ka: { code: "ka", name: "Georgian" },
  kg: { code: "kg", name: "Kongo" },
  ki: { code: "ki", name: "Kikuyu" },
  kj: { code: "kj", name: "Kuanyama" },
  kk: { code: "kk", name: "Kazakh" },
  kl: { code: "kl", name: "Kalaallisut" },
  km: { code: "km", name: "Khmer" },
  kn: { code: "kn", name: "Kannada" },
  ko: { code: "ko", name: "Korean" },
  kr: { code: "kr", name: "Kanuri" },
  ks: { code: "ks", name: "Kashmiri" },
  ku: { code: "ku", name: "Kurdish" },
  kv: { code: "kv", name: "Komi" },
  kw: { code: "kw", name: "Cornish" },
  ky: { code: "ky", name: "Kyrgyz" },
  la: { code: "la", name: "Latin" },
  lb: { code: "lb", name: "Luxembourgish" },
  lg: { code: "lg", name: "Ganda" },
  li: { code: "li", name: "Limburgish" },
  ln: { code: "ln", name: "Lingala" },
  lo: { code: "lo", name: "Lao" },
  lt: { code: "lt", name: "Lithuanian" },
  lu: { code: "lu", name: "Luba-Katanga" },
  lv: { code: "lv", name: "Latvian" },
  mg: { code: "mg", name: "Malagasy" },
  mh: { code: "mh", name: "Marshallese" },
  mi: { code: "mi", name: "Maori" },
  mk: { code: "mk", name: "Macedonian" },
  ml: { code: "ml", name: "Malayalam" },
  mn: { code: "mn", name: "Mongolian" },
  mr: { code: "mr", name: "Marathi" },
  ms: { code: "ms", name: "Malay", aliases: ["malaysian"] },
  mt: { code: "mt", name: "Maltese" },
  my: { code: "my", name: "Burmese" },
  na: { code: "na", name: "Nauru" },
  nb: { code: "nb", name: "Norwegian Bokmal" },
  nd: { code: "nd", name: "North Ndebele" },
  ne: { code: "ne", name: "Nepali" },
  ng: { code: "ng", name: "Ndonga" },
  nl: { code: "nl", name: "Dutch", aliases: ["flemish"] },
  nn: { code: "nn", name: "Norwegian Nynorsk" },
  no: { code: "no", name: "Norwegian" },
  nr: { code: "nr", name: "South Ndebele" },
  nv: { code: "nv", name: "Navajo" },
  ny: { code: "ny", name: "Nyanja" },
  oc: { code: "oc", name: "Occitan" },
  oj: { code: "oj", name: "Ojibwa" },
  om: { code: "om", name: "Oromo" },
  or: { code: "or", name: "Oriya" },
  os: { code: "os", name: "Ossetian" },
  pa: { code: "pa", name: "Punjabi" },
  pi: { code: "pi", name: "Pali" },
  pl: { code: "pl", name: "Polish" },
  ps: { code: "ps", name: "Pashto" },
  pt: { code: "pt", name: "Portuguese", aliases: ["brazilian portuguese"] },
  qu: { code: "qu", name: "Quechua" },
  rm: { code: "rm", name: "Romansh" },
  rn: { code: "rn", name: "Rundi" },
  ro: { code: "ro", name: "Romanian" },
  ru: { code: "ru", name: "Russian" },
  rw: { code: "rw", name: "Kinyarwanda" },
  sa: { code: "sa", name: "Sanskrit" },
  sc: { code: "sc", name: "Sardinian" },
  sd: { code: "sd", name: "Sindhi" },
  se: { code: "se", name: "Northern Sami" },
  sg: { code: "sg", name: "Sango" },
  si: { code: "si", name: "Sinhala" },
  sk: { code: "sk", name: "Slovak" },
  sl: { code: "sl", name: "Slovenian" },
  sm: { code: "sm", name: "Samoan" },
  sn: { code: "sn", name: "Shona" },
  so: { code: "so", name: "Somali" },
  sq: { code: "sq", name: "Albanian" },
  sr: { code: "sr", name: "Serbian" },
  ss: { code: "ss", name: "Swati" },
  st: { code: "st", name: "Southern Sotho" },
  su: { code: "su", name: "Sundanese" },
  sv: { code: "sv", name: "Swedish" },
  sw: { code: "sw", name: "Swahili" },
  ta: { code: "ta", name: "Tamil" },
  te: { code: "te", name: "Telugu" },
  tg: { code: "tg", name: "Tajik" },
  th: { code: "th", name: "Thai" },
  ti: { code: "ti", name: "Tigrinya" },
  tk: { code: "tk", name: "Turkmen" },
  tl: { code: "tl", name: "Tagalog" },
  tn: { code: "tn", name: "Tswana" },
  to: { code: "to", name: "Tongan" },
  tr: { code: "tr", name: "Turkish" },
  ts: { code: "ts", name: "Tsonga" },
  tt: { code: "tt", name: "Tatar" },
  tw: { code: "tw", name: "Twi" },
  ty: { code: "ty", name: "Tahitian" },
  ug: { code: "ug", name: "Uyghur" },
  uk: { code: "uk", name: "Ukrainian" },
  ur: { code: "ur", name: "Urdu" },
  uz: { code: "uz", name: "Uzbek" },
  ve: { code: "ve", name: "Venda" },
  vi: { code: "vi", name: "Vietnamese" },
  vo: { code: "vo", name: "Volapuk" },
  wa: { code: "wa", name: "Walloon" },
  wo: { code: "wo", name: "Wolof" },
  xh: { code: "xh", name: "Xhosa" },
  yi: { code: "yi", name: "Yiddish" },
  yo: { code: "yo", name: "Yoruba" },
  za: { code: "za", name: "Zhuang" },
  zh: { code: "zh", name: "Chinese", aliases: ["mandarin"] },
  zu: { code: "zu", name: "Zulu" },
};

const NAME_INDEX = new Map<string, string>();
for (const lang of Object.values(LANGUAGES)) {
  NAME_INDEX.set(lang.name.toLowerCase(), lang.code);
  for (const alias of lang.aliases ?? []) {
    NAME_INDEX.set(alias.toLowerCase(), lang.code);
  }
}

/**
 * Resolves a code, a canonical name or an alias to its ISO 639-1 code,
 * case-insensitively — including multi-word names ("brazilian portuguese"),
 * since the index is keyed by the whole lowercased phrase. `undefined` on no
 * match; this never throws, so a caller can try it and fall back rather than
 * catch (design §3).
 */
export function resolveLanguage(word: string): string | undefined {
  const key = word.trim().toLowerCase();
  if (key === "") return undefined;
  if (LANGUAGES[key] !== undefined) return key;
  return NAME_INDEX.get(key);
}
```

- [ ] **Step 2: Write the tests**

`packages/translate/src/languages.test.ts`:

```ts
import { expect, test } from "bun:test";
import { LANGUAGES, resolveLanguage } from "./languages";

test("every entry's code is lowercase and matches its own key", () => {
  for (const [code, def] of Object.entries(LANGUAGES)) {
    expect(code).toBe(code.toLowerCase());
    expect(def.code).toBe(code);
  }
});

test("covers the full ISO 639-1 set (184 codes)", () => {
  expect(Object.keys(LANGUAGES)).toHaveLength(184);
});

test("resolves a bare code, case-insensitively", () => {
  expect(resolveLanguage("uk")).toBe("uk");
  expect(resolveLanguage("UK")).toBe("uk");
});

test("resolves a canonical name, case-insensitively", () => {
  expect(resolveLanguage("Ukrainian")).toBe("uk");
  expect(resolveLanguage("ukrainian")).toBe("uk");
});

test("resolves an alias", () => {
  expect(resolveLanguage("Mandarin")).toBe("zh");
  expect(resolveLanguage("Farsi")).toBe("fa");
});

test("resolves a multi-word alias", () => {
  expect(resolveLanguage("Brazilian Portuguese")).toBe("pt");
});

test("unknown or empty input resolves to undefined", () => {
  expect(resolveLanguage("Narnia")).toBeUndefined();
  expect(resolveLanguage("")).toBeUndefined();
  expect(resolveLanguage("   ")).toBeUndefined();
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/translate/src/languages.test.ts`
Expected: 7 pass. If the count test fails, recount the table above — it must match exactly.

- [ ] **Step 4: Export from the root barrel**

Edit `packages/translate/src/index.ts` — add one line after the `TranslateProviderError` export:

```ts
export { TranslateProviderError } from "./errors";
export { LANGUAGES, resolveLanguage } from "./languages";
export type {
```

(i.e. insert `export { LANGUAGES, resolveLanguage } from "./languages";` between the existing `errors` export line and the `export type {` block.)

- [ ] **Step 5: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck`
Expected: all pass, no type errors.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add the ISO 639-1 language table and resolver"
```

---

### Task 3: The literal grammar

**Files:**
- Create: `packages/translate/src/literal.ts`
- Test: `packages/translate/src/literal.test.ts`
- Modify: `packages/translate/src/index.ts`

**Interfaces:**
- Consumes: `resolveLanguage` from `./languages` (Task 2), `TranslateLiteral` from `./types` (Task 1).
- Produces: `parseLiteral(input: string): TranslateLiteral | undefined` — used by `Translator.literal()` in Task 4.

- [ ] **Step 1: Write the parser**

`packages/translate/src/literal.ts`:

```ts
import { resolveLanguage } from "./languages";
import type { TranslateLiteral } from "./types";

const CONNECTIVES = ["in", "to", "into"];

/** The rightmost `from <lang>` inside `head`, or `undefined`. */
function findFrom(head: readonly string[]): number | undefined {
  for (let i = head.length - 2; i >= 1; i--) {
    const word = head[i];
    if (word !== undefined && word.toLowerCase() === "from") return i;
  }
  return undefined;
}

/**
 * Parses `"<text> in <language>"` and its variants (design §4): an optional
 * leading `translate`, then `<text> (from <lang>)? (in|to|into) <lang>`.
 *
 * The connective and the language phrase after it are matched from the
 * *end* of the string outward — trying the rightmost eligible connective
 * position first — the same right-anchored approach `splitQuery` in geo's
 * postal provider takes for its trailing country code. That is what lets
 * `<text>` itself contain the words "in" or "to" ("log in to french" reads
 * as text "log in", target "french") without the match breaking on the
 * first occurrence.
 *
 * Returns `undefined` on no match. Never throws — a caller decides what an
 * unparseable literal means.
 */
export function parseLiteral(input: string): TranslateLiteral | undefined {
  let rest = input.trim();
  if (rest.toLowerCase().startsWith("translate ")) {
    rest = rest.slice("translate ".length).trim();
  }

  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length < 2) return undefined;

  for (let i = words.length - 2; i >= 1; i--) {
    const word = words[i];
    if (word === undefined || !CONNECTIVES.includes(word.toLowerCase())) continue;

    const head = words.slice(0, i);
    const tailPhrase = words.slice(i + 1).join(" ");
    const target = resolveLanguage(tailPhrase);
    if (target === undefined) continue;

    const fromIndex = head.length >= 3 ? findFrom(head) : undefined;
    if (fromIndex !== undefined) {
      const text = head.slice(0, fromIndex).join(" ").trim();
      const sourcePhrase = head.slice(fromIndex + 1).join(" ");
      const source = resolveLanguage(sourcePhrase);
      if (text !== "" && source !== undefined) {
        return { text, target, source };
      }
    }

    const text = head.join(" ").trim();
    if (text === "") continue;
    return { text, target };
  }

  return undefined;
}
```

- [ ] **Step 2: Write the tests**

`packages/translate/src/literal.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseLiteral } from "./literal";

test('"<text> in <language>"', () => {
  expect(parseLiteral("hello in ukrainian")).toEqual({ text: "hello", target: "uk" });
});

test('"<text> to <language>"', () => {
  expect(parseLiteral("hello to ukrainian")).toEqual({ text: "hello", target: "uk" });
});

test('leading "translate" is optional sugar', () => {
  expect(parseLiteral("translate hello into ukrainian")).toEqual({
    text: "hello",
    target: "uk",
  });
});

test('explicit source: "<text> from <language> in <language>"', () => {
  expect(parseLiteral("hello from english in ukrainian")).toEqual({
    text: "hello",
    target: "uk",
    source: "en",
  });
});

test("multi-word target language", () => {
  expect(parseLiteral("hello in brazilian portuguese")).toEqual({
    text: "hello",
    target: "pt",
  });
});

test("the rightmost connective wins over one earlier in the text", () => {
  expect(parseLiteral("log in to french")).toEqual({ text: "log in", target: "fr" });
});

test("is case-insensitive on keywords and language names", () => {
  expect(parseLiteral("Hello TO Ukrainian")).toEqual({ text: "Hello", target: "uk" });
});

test("no connective is unparseable", () => {
  expect(parseLiteral("hello")).toBeUndefined();
});

test("unresolvable language is unparseable", () => {
  expect(parseLiteral("hello in Narnia")).toBeUndefined();
});

test("empty input is unparseable", () => {
  expect(parseLiteral("")).toBeUndefined();
  expect(parseLiteral("   ")).toBeUndefined();
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/translate/src/literal.test.ts`
Expected: 10 pass.

- [ ] **Step 4: Export from the root barrel**

Edit `packages/translate/src/index.ts` — add one line after the `languages` export:

```ts
export { LANGUAGES, resolveLanguage } from "./languages";
export { parseLiteral } from "./literal";
export type {
```

- [ ] **Step 5: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck`
Expected: all pass.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add the literal grammar parser"
```

---

### Task 4: The `Translator` class

**Files:**
- Create: `packages/translate/src/translator.ts`
- Test: `packages/translate/src/translator.test.ts`
- Modify: `packages/translate/src/index.ts`

**Interfaces:**
- Consumes: `TranslateProviderError` from `./errors` (Task 1); `resolveLanguage` from `./languages` (Task 2); `parseLiteral` from `./literal` (Task 3); `TranslateProvider`, `TranslateResult` from `./types` (Task 1).
- Produces: `class Translator`, `TranslatorOptions`, `TranslateOptions`, `LiteralOptions` — the package's public door, used directly by any consumer once a provider (Task 5–7) exists.

- [ ] **Step 1: Write the class**

`packages/translate/src/translator.ts`:

```ts
import { TranslateProviderError } from "./errors";
import { resolveLanguage } from "./languages";
import { parseLiteral } from "./literal";
import type { TranslateProvider, TranslateResult } from "./types";

export interface TranslatorOptions {
  readonly provider: TranslateProvider;
  /** Default `true`. */
  readonly cache?: boolean;
}

export interface TranslateOptions {
  /** A language name or ISO 639-1 code. Omitted means auto-detect. */
  readonly source?: string;
  /** Overrides the constructor's `cache` for this call only. */
  readonly cache?: boolean;
}

export interface LiteralOptions {
  readonly cache?: boolean;
}

/**
 * The package's public door (design §6): wraps one `TranslateProvider` with
 * free-text language resolution and an in-memory cache. `custom()` from
 * `./providers` covers any upstream this package has no built-in factory
 * for.
 */
export class Translator {
  readonly #provider: TranslateProvider;
  readonly #cacheEnabled: boolean;
  readonly #cache = new Map<string, Promise<TranslateResult>>();

  constructor(opts: TranslatorOptions) {
    this.#provider = opts.provider;
    this.#cacheEnabled = opts.cache ?? true;
  }

  /** A code, a canonical name or an alias, resolved to its ISO 639-1 code. */
  resolveLanguage(word: string): string | undefined {
    return resolveLanguage(word);
  }

  async translate(
    text: string,
    target: string,
    opts: TranslateOptions = {},
  ): Promise<TranslateResult> {
    const targetCode = resolveLanguage(target);
    if (targetCode === undefined) {
      throw new TranslateProviderError(
        "translate",
        `unknown target language ${JSON.stringify(target)}`,
      );
    }

    const sourceCode = opts.source === undefined ? undefined : resolveLanguage(opts.source);
    if (opts.source !== undefined && sourceCode === undefined) {
      throw new TranslateProviderError(
        "translate",
        `unknown source language ${JSON.stringify(opts.source)}`,
      );
    }

    const useCache = opts.cache ?? this.#cacheEnabled;
    if (!useCache) {
      return this.#provider.translate(text, targetCode, sourceCode);
    }

    const key = `${this.#provider.id}:${sourceCode ?? "auto"}:${targetCode}:${text}`;
    let pending = this.#cache.get(key);
    if (pending === undefined) {
      pending = this.#provider.translate(text, targetCode, sourceCode).catch((err: unknown) => {
        this.#cache.delete(key);
        throw err;
      });
      this.#cache.set(key, pending);
    }
    return pending;
  }

  /** Parses `input` with `parseLiteral` and translates in one call. */
  async literal(input: string, opts: LiteralOptions = {}): Promise<TranslateResult> {
    const parsed = parseLiteral(input);
    if (parsed === undefined) {
      throw new TranslateProviderError(
        "translate",
        `could not parse ${JSON.stringify(input)} as a translation literal`,
      );
    }
    const translateOpts: TranslateOptions = {
      ...(parsed.source !== undefined ? { source: parsed.source } : {}),
      ...(opts.cache !== undefined ? { cache: opts.cache } : {}),
    };
    return this.translate(parsed.text, parsed.target, translateOpts);
  }
}
```

- [ ] **Step 2: Write the tests**

`packages/translate/src/translator.test.ts`:

```ts
import { expect, test } from "bun:test";
import { TranslateProviderError } from "./errors";
import { Translator } from "./translator";
import type { TranslateProvider, TranslateResult } from "./types";

function stubProvider(
  fn: (text: string, target: string, source?: string) => Promise<TranslateResult>,
): TranslateProvider {
  return { id: "stub", translate: fn };
}

test("resolves a free-text target and calls the provider with its code", async () => {
  let seen: { text: string; target: string; source: string | undefined } | undefined;
  const provider = stubProvider(async (text, target, source) => {
    seen = { text, target, source };
    return { text: "привіт", source: "en", target: "uk", provider: "stub" };
  });
  const translator = new Translator({ provider });

  const result = await translator.translate("hello", "ukrainian");

  expect(seen).toEqual({ text: "hello", target: "uk", source: undefined });
  expect(result.text).toBe("привіт");
});

test("accepts a bare ISO code target too", async () => {
  const provider = stubProvider(async (_text, target, source) => ({
    text: "x",
    source: source ?? "auto",
    target,
    provider: "stub",
  }));
  const translator = new Translator({ provider });

  const result = await translator.translate("hi", "uk");

  expect(result.target).toBe("uk");
});

test("an unresolvable target throws before the provider is called", async () => {
  let called = false;
  const provider = stubProvider(async () => {
    called = true;
    return { text: "", source: "en", target: "uk", provider: "stub" };
  });
  const translator = new Translator({ provider });

  await expect(translator.translate("hi", "narnia")).rejects.toBeInstanceOf(
    TranslateProviderError,
  );
  expect(called).toBe(false);
});

test("an unresolvable explicit source throws before the provider is called", async () => {
  let called = false;
  const provider = stubProvider(async () => {
    called = true;
    return { text: "", source: "en", target: "uk", provider: "stub" };
  });
  const translator = new Translator({ provider });

  await expect(
    translator.translate("hi", "uk", { source: "narnia" }),
  ).rejects.toBeInstanceOf(TranslateProviderError);
  expect(called).toBe(false);
});

test("literal() parses and translates in one call", async () => {
  const provider = stubProvider(async (_text, target, source) => ({
    text: "привіт",
    source: source ?? "en",
    target,
    provider: "stub",
  }));
  const translator = new Translator({ provider });

  const result = await translator.literal("hello in ukrainian");

  expect(result).toEqual({ text: "привіт", source: "en", target: "uk", provider: "stub" });
});

test("literal() throws on an unparseable input", async () => {
  const provider = stubProvider(async () => ({
    text: "",
    source: "en",
    target: "uk",
    provider: "stub",
  }));
  const translator = new Translator({ provider });

  await expect(translator.literal("hello")).rejects.toBeInstanceOf(TranslateProviderError);
});

test("identical concurrent calls are deduplicated", async () => {
  let calls = 0;
  const provider = stubProvider(async (_text, target, source) => {
    calls++;
    return { text: "x", source: source ?? "auto", target, provider: "stub" };
  });
  const translator = new Translator({ provider });

  const [a, b] = await Promise.all([
    translator.translate("hi", "uk"),
    translator.translate("hi", "uk"),
  ]);

  expect(calls).toBe(1);
  expect(a).toBe(b);
});

test("{ cache: false } bypasses the cache for that call", async () => {
  let calls = 0;
  const provider = stubProvider(async (_text, target, source) => {
    calls++;
    return { text: "x", source: source ?? "auto", target, provider: "stub" };
  });
  const translator = new Translator({ provider });

  await translator.translate("hi", "uk", { cache: false });
  await translator.translate("hi", "uk", { cache: false });

  expect(calls).toBe(2);
});

test("a rejection is not cached — the next call retries", async () => {
  let calls = 0;
  const provider = stubProvider(async () => {
    calls++;
    if (calls === 1) throw new Error("boom");
    return { text: "x", source: "en", target: "uk", provider: "stub" };
  });
  const translator = new Translator({ provider });

  await expect(translator.translate("hi", "uk")).rejects.toThrow("boom");
  const result = await translator.translate("hi", "uk");

  expect(calls).toBe(2);
  expect(result.text).toBe("x");
});

test("resolveLanguage() is exposed as a method", () => {
  const provider = stubProvider(async () => {
    throw new Error("must not be called");
  });
  const translator = new Translator({ provider });

  expect(translator.resolveLanguage("Ukrainian")).toBe("uk");
  expect(translator.resolveLanguage("Narnia")).toBeUndefined();
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/translate/src/translator.test.ts`
Expected: 10 pass.

- [ ] **Step 4: Export from the root barrel**

Replace the full contents of `packages/translate/src/index.ts` with:

```ts
export { TranslateProviderError } from "./errors";
export { LANGUAGES, resolveLanguage } from "./languages";
export { parseLiteral } from "./literal";
export { Translator } from "./translator";
export type { LiteralOptions, TranslateOptions, TranslatorOptions } from "./translator";
export type {
  LanguageDef,
  TranslateLiteral,
  TranslateProvider,
  TranslateResult,
} from "./types";
```

- [ ] **Step 5: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck`
Expected: all pass.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add the Translator class"
```

---

### Task 5: The `custom()` escape hatch and the LibreTranslate provider

**Files:**
- Create: `packages/translate/src/providers/custom.ts`
- Create: `packages/translate/src/providers/libretranslate.ts`
- Test: `packages/translate/src/providers/libretranslate.test.ts`
- Create: `packages/translate/src/providers/index.ts`
- Modify: `packages/translate/package.json`

**Interfaces:**
- Consumes: `TranslateProviderError` from `../errors` (Task 1); `TranslateProvider`, `TranslateResult` from `../types` (Task 1).
- Produces: `custom(fn)`, `libreTranslate(opts)` — exported from the new `./providers` subpath. `google.ts`/`deepl.ts` (Tasks 6–7) are siblings added to the same `providers/index.ts` barrel.

- [ ] **Step 1: Write `custom()`**

`packages/translate/src/providers/custom.ts`:

```ts
import type { TranslateProvider, TranslateResult } from "../types";

/**
 * Wraps any async function in the provider shape (design §5). Covers
 * Smartcat — dropped from this package's built-in factories — or any other
 * upstream without a first-class one.
 */
export function custom(
  fn: (text: string, target: string, source?: string) => Promise<TranslateResult>,
): TranslateProvider {
  return { id: "custom", translate: fn };
}
```

- [ ] **Step 2: Write the LibreTranslate provider**

`packages/translate/src/providers/libretranslate.ts`:

```ts
import { TranslateProviderError } from "../errors";
import type { TranslateProvider, TranslateResult } from "../types";

const ID = "libretranslate";

export interface LibreTranslateOptions {
  /**
   * The instance's base URL, e.g. `"https://libretranslate.example"`. No
   * default: LibreTranslate has no single canonical public instance to
   * hardcode (design §5, the same reasoning `PostalCodesOptions.url` gives).
   */
  readonly url: string;
  readonly apiKey?: string;
  /** Injected for tests; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
}

interface LibreTranslateResponse {
  readonly translatedText?: string;
  readonly detectedLanguage?: { readonly language?: string };
}

/** A LibreTranslate instance (design §5): `POST {url}/translate`. */
export function libreTranslate(opts: LibreTranslateOptions): TranslateProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = opts.url.endsWith("/") ? opts.url.slice(0, -1) : opts.url;

  return {
    id: ID,
    async translate(text, target, source): Promise<TranslateResult> {
      const body: Record<string, string> = {
        q: text,
        source: source ?? "auto",
        target,
        format: "text",
      };
      if (opts.apiKey !== undefined) body.api_key = opts.apiKey;

      const res = await doFetch(`${base}/translate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new TranslateProviderError(ID, `request failed: ${res.status} ${res.statusText}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new TranslateProviderError(ID, "response was not JSON");
      }
      const payload = json as LibreTranslateResponse;
      if (typeof payload.translatedText !== "string") {
        throw new TranslateProviderError(ID, "response carried no translatedText");
      }

      return {
        text: payload.translatedText,
        source: source ?? payload.detectedLanguage?.language ?? "auto",
        target,
        provider: ID,
      };
    },
  };
}
```

- [ ] **Step 3: Write the tests**

`packages/translate/src/providers/libretranslate.test.ts`:

```ts
import { expect, test } from "bun:test";
import { TranslateProviderError } from "../errors";
import { libreTranslate } from "./libretranslate";

function stubFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof globalThis.fetch;
}

test("translates and reports the detected source language", async () => {
  const provider = libreTranslate({
    url: "https://libretranslate.example",
    fetch: stubFetch({ translatedText: "привіт", detectedLanguage: { language: "en" } }),
  });

  const result = await provider.translate("hello", "uk");

  expect(result).toEqual({
    text: "привіт",
    source: "en",
    target: "uk",
    provider: "libretranslate",
  });
});

test("an explicit source is echoed back rather than the detected one", async () => {
  const provider = libreTranslate({
    url: "https://libretranslate.example",
    fetch: stubFetch({ translatedText: "привіт", detectedLanguage: { language: "es" } }),
  });

  const result = await provider.translate("hello", "uk", "en");

  expect(result.source).toBe("en");
});

test("sends the request the API expects", async () => {
  let seenUrl = "";
  let seenBody: unknown;
  const fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url;
    seenBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ translatedText: "x" }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  await libreTranslate({ url: "https://libretranslate.example/", fetch }).translate(
    "hello",
    "uk",
  );

  expect(seenUrl).toBe("https://libretranslate.example/translate");
  expect(seenBody).toEqual({ q: "hello", source: "auto", target: "uk", format: "text" });
});

test("an api key is sent when given", async () => {
  let seenBody: unknown;
  const fetch = (async (_url: string, init?: RequestInit) => {
    seenBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ translatedText: "x" }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  await libreTranslate({
    url: "https://libretranslate.example",
    apiKey: "secret",
    fetch,
  }).translate("hello", "uk");

  expect((seenBody as Record<string, unknown>).api_key).toBe("secret");
});

test("a non-2xx response is a TranslateProviderError naming the status", async () => {
  const provider = libreTranslate({
    url: "https://libretranslate.example",
    fetch: stubFetch({}, 503),
  });

  await expect(provider.translate("hi", "uk")).rejects.toBeInstanceOf(TranslateProviderError);
  await expect(provider.translate("hi", "uk")).rejects.toThrow("503");
});

test("a response with no translatedText is an error, not a silent empty string", async () => {
  const provider = libreTranslate({
    url: "https://libretranslate.example",
    fetch: stubFetch({ detectedLanguage: { language: "en" } }),
  });

  await expect(provider.translate("hi", "uk")).rejects.toThrow("no translatedText");
});

test("the provider is identified", () => {
  expect(libreTranslate({ url: "https://libretranslate.example" }).id).toBe("libretranslate");
});
```

- [ ] **Step 4: Run the tests**

Run: `bun test packages/translate/src/providers/libretranslate.test.ts`
Expected: 7 pass.

- [ ] **Step 5: Create the `./providers` barrel**

`packages/translate/src/providers/index.ts`:

```ts
export { custom } from "./custom";
export { libreTranslate, type LibreTranslateOptions } from "./libretranslate";
```

- [ ] **Step 6: Declare the `./providers` export in the package manifest**

Edit `packages/translate/package.json` — replace:

```json
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
```

with:

```json
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./providers": {
      "bun": "./src/providers/index.ts",
      "types": "./dist/providers/index.d.ts",
      "default": "./dist/providers/index.js"
    }
  },
```

- [ ] **Step 7: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck && bun run check-deps`
Expected: all pass.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add custom() and the LibreTranslate provider"
```

---

### Task 6: The Google Cloud Translate provider

**Files:**
- Create: `packages/translate/src/providers/google.ts`
- Test: `packages/translate/src/providers/google.test.ts`
- Modify: `packages/translate/src/providers/index.ts`

**Interfaces:**
- Consumes: `TranslateProviderError` from `../errors` (Task 1); `TranslateProvider`, `TranslateResult` from `../types` (Task 1).
- Produces: `googleTranslate(opts)`, added to `./providers`.

- [ ] **Step 1: Write the provider**

`packages/translate/src/providers/google.ts`:

```ts
import { TranslateProviderError } from "../errors";
import type { TranslateProvider, TranslateResult } from "../types";

const ID = "google";
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

export interface GoogleTranslateOptions {
  readonly apiKey: string;
  /** Override the endpoint, e.g. for a proxy. */
  readonly url?: string;
  /** Injected for tests; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
}

interface GoogleTranslateResponse {
  readonly data?: {
    readonly translations?: ReadonlyArray<{
      readonly translatedText?: string;
      readonly detectedSourceLanguage?: string;
    }>;
  };
}

/** Google Cloud Translate v2 (design §5): `POST {url}?key={apiKey}`. */
export function googleTranslate(opts: GoogleTranslateOptions): TranslateProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const url = opts.url ?? ENDPOINT;

  return {
    id: ID,
    async translate(text, target, source): Promise<TranslateResult> {
      const body: Record<string, unknown> = { q: [text], target, format: "text" };
      if (source !== undefined) body.source = source;

      const res = await doFetch(`${url}?key=${encodeURIComponent(opts.apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new TranslateProviderError(ID, `request failed: ${res.status} ${res.statusText}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new TranslateProviderError(ID, "response was not JSON");
      }
      const translation = (json as GoogleTranslateResponse).data?.translations?.[0];
      if (translation?.translatedText === undefined) {
        throw new TranslateProviderError(ID, "response carried no translation");
      }

      return {
        text: translation.translatedText,
        source: source ?? translation.detectedSourceLanguage ?? "auto",
        target,
        provider: ID,
      };
    },
  };
}
```

- [ ] **Step 2: Write the tests**

`packages/translate/src/providers/google.test.ts`:

```ts
import { expect, test } from "bun:test";
import { TranslateProviderError } from "../errors";
import { googleTranslate } from "./google";

function stubFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof globalThis.fetch;
}

test("translates and reports the detected source language", async () => {
  const provider = googleTranslate({
    apiKey: "key123",
    fetch: stubFetch({
      data: { translations: [{ translatedText: "привіт", detectedSourceLanguage: "en" }] },
    }),
  });

  const result = await provider.translate("hello", "uk");

  expect(result).toEqual({ text: "привіт", source: "en", target: "uk", provider: "google" });
});

test("an explicit source is echoed back rather than the detected one", async () => {
  const provider = googleTranslate({
    apiKey: "key123",
    fetch: stubFetch({
      data: { translations: [{ translatedText: "привіт", detectedSourceLanguage: "es" }] },
    }),
  });

  const result = await provider.translate("hello", "uk", "en");

  expect(result.source).toBe("en");
});

test("sends the request the API expects, key on the query string", async () => {
  let seenUrl = "";
  let seenBody: unknown;
  const fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url;
    seenBody = JSON.parse(init?.body as string);
    return new Response(
      JSON.stringify({ data: { translations: [{ translatedText: "x" }] } }),
      { status: 200 },
    );
  }) as unknown as typeof globalThis.fetch;

  await googleTranslate({ apiKey: "key123", fetch }).translate("hello", "uk", "en");

  expect(seenUrl).toBe("https://translation.googleapis.com/language/translate/v2?key=key123");
  expect(seenBody).toEqual({ q: ["hello"], target: "uk", format: "text", source: "en" });
});

test("source is omitted from the body when not given, for auto-detect", async () => {
  let seenBody: unknown;
  const fetch = (async (_url: string, init?: RequestInit) => {
    seenBody = JSON.parse(init?.body as string);
    return new Response(
      JSON.stringify({ data: { translations: [{ translatedText: "x" }] } }),
      { status: 200 },
    );
  }) as unknown as typeof globalThis.fetch;

  await googleTranslate({ apiKey: "key123", fetch }).translate("hello", "uk");

  expect(seenBody).toEqual({ q: ["hello"], target: "uk", format: "text" });
});

test("a non-2xx response is a TranslateProviderError naming the status", async () => {
  const provider = googleTranslate({ apiKey: "key123", fetch: stubFetch({}, 403) });

  await expect(provider.translate("hi", "uk")).rejects.toBeInstanceOf(TranslateProviderError);
  await expect(provider.translate("hi", "uk")).rejects.toThrow("403");
});

test("a response with no translation is an error", async () => {
  const provider = googleTranslate({
    apiKey: "key123",
    fetch: stubFetch({ data: { translations: [] } }),
  });

  await expect(provider.translate("hi", "uk")).rejects.toThrow("no translation");
});

test("the provider is identified", () => {
  expect(googleTranslate({ apiKey: "key123" }).id).toBe("google");
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/translate/src/providers/google.test.ts`
Expected: 7 pass.

- [ ] **Step 4: Add to the `./providers` barrel**

`packages/translate/src/providers/index.ts` (full replacement):

```ts
export { custom } from "./custom";
export { googleTranslate, type GoogleTranslateOptions } from "./google";
export { libreTranslate, type LibreTranslateOptions } from "./libretranslate";
```

- [ ] **Step 5: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck`
Expected: all pass.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add the Google Cloud Translate provider"
```

---

### Task 7: The DeepL provider

**Files:**
- Create: `packages/translate/src/providers/deepl.ts`
- Test: `packages/translate/src/providers/deepl.test.ts`
- Modify: `packages/translate/src/providers/index.ts`

**Interfaces:**
- Consumes: `TranslateProviderError` from `../errors` (Task 1); `TranslateProvider`, `TranslateResult` from `../types` (Task 1).
- Produces: `deepl(opts)`, added to `./providers`.

- [ ] **Step 1: Write the provider**

`packages/translate/src/providers/deepl.ts`:

```ts
import { TranslateProviderError } from "../errors";
import type { TranslateProvider, TranslateResult } from "../types";

const ID = "deepl";
const FREE_ENDPOINT = "https://api-free.deepl.com";

export interface DeeplOptions {
  readonly apiKey: string;
  /**
   * Base URL. Defaults to the free-tier endpoint; pass
   * `"https://api.deepl.com"` for a paid account.
   */
  readonly url?: string;
  /** Injected for tests; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
}

interface DeeplResponse {
  readonly translations?: ReadonlyArray<{
    readonly text?: string;
    readonly detected_source_language?: string;
  }>;
}

/**
 * DeepL API (design §5): `POST {url}/v2/translate`,
 * `Authorization: DeepL-Auth-Key {apiKey}`.
 *
 * Regional variant target codes (`EN-US`, `PT-BR`) are not modeled — the
 * resolved ISO 639-1 code is upper-cased and sent as is, which DeepL accepts
 * for every language without a variant split (design §5, known gap).
 */
export function deepl(opts: DeeplOptions): TranslateProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = opts.url ?? FREE_ENDPOINT;

  return {
    id: ID,
    async translate(text, target, source): Promise<TranslateResult> {
      const body: Record<string, unknown> = {
        text: [text],
        target_lang: target.toUpperCase(),
      };
      if (source !== undefined) body.source_lang = source.toUpperCase();

      const res = await doFetch(`${base}/v2/translate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `DeepL-Auth-Key ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new TranslateProviderError(ID, `request failed: ${res.status} ${res.statusText}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new TranslateProviderError(ID, "response was not JSON");
      }
      const translation = (json as DeeplResponse).translations?.[0];
      if (translation?.text === undefined) {
        throw new TranslateProviderError(ID, "response carried no translation");
      }

      return {
        text: translation.text,
        source: source ?? translation.detected_source_language?.toLowerCase() ?? "auto",
        target,
        provider: ID,
      };
    },
  };
}
```

- [ ] **Step 2: Write the tests**

`packages/translate/src/providers/deepl.test.ts`:

```ts
import { expect, test } from "bun:test";
import { TranslateProviderError } from "../errors";
import { deepl } from "./deepl";

function stubFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof globalThis.fetch;
}

test("translates and reports the detected source language, lower-cased", async () => {
  const provider = deepl({
    apiKey: "key123",
    fetch: stubFetch({ translations: [{ text: "привіт", detected_source_language: "EN" }] }),
  });

  const result = await provider.translate("hello", "uk");

  expect(result).toEqual({ text: "привіт", source: "en", target: "uk", provider: "deepl" });
});

test("an explicit source is echoed back rather than the detected one", async () => {
  const provider = deepl({
    apiKey: "key123",
    fetch: stubFetch({ translations: [{ text: "привіт", detected_source_language: "ES" }] }),
  });

  const result = await provider.translate("hello", "uk", "en");

  expect(result.source).toBe("en");
});

test("sends upper-cased language codes and the auth header", async () => {
  let seenUrl = "";
  let seenBody: unknown;
  let seenAuth: string | null = null;
  const fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url;
    seenBody = JSON.parse(init?.body as string);
    seenAuth = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ translations: [{ text: "x" }] }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  await deepl({ apiKey: "key123", fetch }).translate("hello", "uk", "en");

  expect(seenUrl).toBe("https://api-free.deepl.com/v2/translate");
  expect(seenBody).toEqual({ text: ["hello"], target_lang: "UK", source_lang: "EN" });
  expect(seenAuth).toBe("DeepL-Auth-Key key123");
});

test("a custom url overrides the free-tier default", async () => {
  let seenUrl = "";
  const fetch = (async (url: string) => {
    seenUrl = url;
    return new Response(JSON.stringify({ translations: [{ text: "x" }] }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  await deepl({ apiKey: "key123", url: "https://api.deepl.com", fetch }).translate(
    "hello",
    "uk",
  );

  expect(seenUrl).toBe("https://api.deepl.com/v2/translate");
});

test("a non-2xx response is a TranslateProviderError naming the status", async () => {
  const provider = deepl({ apiKey: "key123", fetch: stubFetch({}, 456) });

  await expect(provider.translate("hi", "uk")).rejects.toBeInstanceOf(TranslateProviderError);
  await expect(provider.translate("hi", "uk")).rejects.toThrow("456");
});

test("a response with no translation is an error", async () => {
  const provider = deepl({ apiKey: "key123", fetch: stubFetch({ translations: [] }) });

  await expect(provider.translate("hi", "uk")).rejects.toThrow("no translation");
});

test("the provider is identified", () => {
  expect(deepl({ apiKey: "key123" }).id).toBe("deepl");
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/translate/src/providers/deepl.test.ts`
Expected: 7 pass.

- [ ] **Step 4: Add to the `./providers` barrel**

`packages/translate/src/providers/index.ts` (full replacement):

```ts
export { custom } from "./custom";
export { deepl, type DeeplOptions } from "./deepl";
export { googleTranslate, type GoogleTranslateOptions } from "./google";
export { libreTranslate, type LibreTranslateOptions } from "./libretranslate";
```

- [ ] **Step 5: Full verify and commit**

Run: `bun test packages/translate && bun run typecheck`
Expected: all pass.

```bash
bunx biome check --write packages/translate
git add packages/translate
git commit -m "feat(translate): add the DeepL provider"
```

---

### Task 8: Full repo check

**Files:** none created; this task only runs and, if needed, fixes.

**Interfaces:** none — verification only.

- [ ] **Step 1: Run the same gate CI runs**

Run: `bun run check`

This runs, in order: `lint` (Biome), `typecheck`, `check-deps`, `bun test` (the whole repo, not just `packages/translate`), `build`, `check-size`.

Expected: exits 0.

- [ ] **Step 2: If `lint` fails**

Run: `bunx biome check --write packages/translate scripts/check-deps.ts`, then re-run `bun run lint`. Fix anything it can't auto-fix (typically unused imports or an `any`) by hand, re-running `bun run lint` until clean.

- [ ] **Step 3: If `build` fails**

Run: `bun run build 2>&1 | grep -A5 translate` to isolate the error. The most likely cause is a stale `exports` map entry in `packages/translate/package.json` pointing at a file that doesn't exist, or a type-only export missing its `type` keyword (`verbatimModuleSyntax`). Fix and re-run `bun run build`.

- [ ] **Step 4: Confirm the package is otherwise untouched by unrelated failures**

Run: `bun test 2>&1 | tail -20`
Expected: the final summary shows 0 failing tests repo-wide. If a failure is in a package other than `translate`, stop and report it rather than touching unrelated code — it did not come from this plan's changes.

- [ ] **Step 5: Final commit, if Step 2 or 3 produced changes**

```bash
git add -A
git commit -m "chore(translate): fix lint/build issues found by the full check"
```

If no changes were needed, skip this step — there is nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** §2 (layout) → Tasks 1–7 file tree. §3 (language table) → Task 2. §4 (grammar) → Task 3. §5 (providers) → Tasks 5–7. §6 (`Translator`) → Task 4. §7 (errors) → Task 1. §8 (testing) → every task's own test file. §9 (out of scope) → no task implements multi-provider fallback, Smartcat, DeepL variants, or Kind-engine wiring; Task 8 explicitly does not add docs-site registration, per Global Constraints.
- **Type consistency checked:** `TranslateResult`/`TranslateProvider`/`TranslateLiteral`/`LanguageDef` (Task 1) are the exact names and shapes every later task imports. `resolveLanguage` (Task 2) is used identically in `literal.ts` (Task 3) and `translator.ts` (Task 4). `parseLiteral`'s return shape matches `TranslateLiteral` field-for-field. Every provider's `translate(text, target, source?)` signature matches `TranslateProvider` exactly.
