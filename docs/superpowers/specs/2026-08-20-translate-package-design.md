# `@smartput/translate`: text translation as a standalone package

**Status:** design approved, not implemented
**Date:** 2026-08-20
**Depends on:** nothing new — `@smartput/kind`'s error hierarchy only

## 1. What this adds

A new workspace package, `@smartput/translate`, that turns a phrase like

```ts
translator.literal("hello in ukrainian");
// { text: "привіт", source: "en", target: "uk", provider: "libretranslate" }
```

into a translated result, plus a lower-level API for calling a provider
directly:

```ts
translator.translate("hello", "ukrainian");
// same result, target given by name or ISO 639-1 code
```

It does **not** join the Kind engine. Every existing kind (`money`, `length`,
`mass`, …) carries a numeric `Decimal` value and a unit, and a `Vocabulary`
registers words for `createEngine` to resolve against every other kind's words
in one pass. Translation carries no quantity — there is nothing for a `Value`
to hold — and forcing it through `Vocabulary`/`Kind` would buy nothing but a
new way for its literal grammar to collide with everyone else's (the geo
postal literal's `1000mb` bug is exactly that collision, between two kinds
that *do* share the engine). Staying outside it sidesteps that class of bug
entirely: `parseLiteral` is a private grammar this package alone reads.

The package follows the same shape `@smartput/rate` and `@smartput/geo`
already use for network-backed data: a small provider interface, one factory
per upstream, a `custom()` escape hatch, and a class that wraps a provider
with caching. Nothing here is a new pattern for this repo.

## 2. Package layout

```
packages/translate/
  package.json          # deps: @smartput/kind only
  tsconfig.json          # extends ../../tsconfig.base.json, per convention
  src/
    errors.ts            # TranslateProviderError
    languages.ts          # ISO 639-1 table + resolveLanguage()
    literal.ts            # parseLiteral()
    translator.ts          # Translator class
    index.ts              # root barrel — no network code reachable from here
    providers/
      libretranslate.ts
      google.ts
      deepl.ts
      custom.ts
      index.ts            # ./providers barrel
```

Two entry points, exactly like geo's `.` / `./providers` split: the root
barrel exports the class, the grammar, the language table and the errors —
nothing that calls `fetch`. A consumer who only wants `resolveLanguage` or
`parseLiteral` (e.g. to validate input before deciding whether to spend an API
call) imports the root and links no network code. Providers are reached only
through the `./providers` subpath.

**Registration requirement:** `scripts/check-deps.ts` fails CI on any
`packages/*/package.json` not listed in its `ALLOWED` map. Implementation
must add:

```ts
"packages/translate/package.json": ["@smartput/kind"],
```

No other script needs a manual entry — `gen-package-pages.ts` discovers
packages via `readdir`, and `check-size.ts`'s `BUDGETS` array is optional.

## 3. Language table and resolution

`src/languages.ts` ships a `Record<string, LanguageDef>` keyed by ISO 639-1
code (`"uk"`, `"en"`, `"pt"`, …), English names only for v1 (no native-script
names, no locale variants):

```ts
interface LanguageDef {
  readonly code: string;    // ISO 639-1, lowercase — equals the table key
  readonly name: string;    // canonical English name, e.g. "Ukrainian"
  readonly aliases?: readonly string[]; // alt English spellings, e.g. "mandarin" -> zh
}

function resolveLanguage(word: string): string | undefined;
```

`resolveLanguage` matches, case-insensitively, against: the code itself
(`"uk"` → `"uk"`), the canonical name, and any alias — including multi-word
names (`"brazilian portuguese"`). Returns `undefined` on no match; it does not
throw, the same way `splitQuery` in geo's postal provider hands back a partial
result rather than raising for the caller to interpret.

Coverage: the full ISO 639-1 set (~184 codes). Aliases stay minimal —
`"mandarin"→zh`, `"farsi"→fa`, `"castilian"→es`, and a handful more that are
genuinely common alternate names, not an exhaustive synonym list.

## 4. Literal grammar

`src/literal.ts`:

```ts
interface TranslateLiteral {
  readonly text: string;
  readonly target: string;   // resolved ISO 639-1 code
  readonly source?: string;  // resolved ISO 639-1 code, when named explicitly
}

function parseLiteral(input: string): TranslateLiteral | undefined;
```

Grammar, matched against the input trimmed and case-folded for keyword
matching only (the returned `text` preserves the original casing):

1. An optional leading `translate` is stripped. `"translate hello to
   ukrainian"` and `"hello to ukrainian"` parse identically once stripped —
   there is no separate rule for the verb form.
2. The remainder must match `<text> (from <lang>)? (in|to|into) <lang>`,
   where `<lang>` is resolved through `resolveLanguage` (so it may be one or
   more words) and the final connective (`in`/`to`/`into`) plus the language
   phrase after it are matched from the **end** of the string, the same
   right-anchored approach `splitQuery` in geo's postal provider takes for its
   trailing country code — it is what lets `<text>` itself contain the words
   "in" or "to" without breaking the match, as long as the literal doesn't
   also end in something that parses as a language name.
3. If no `from <lang>` clause is present, `source` is omitted — the caller
   (a provider) is expected to auto-detect.
4. No match at any step → `undefined`. Never throws.

Examples:

| input | result |
| --- | --- |
| `"hello in ukrainian"` | `{ text: "hello", target: "uk" }` |
| `"hello to ukrainian"` | `{ text: "hello", target: "uk" }` |
| `"translate hello into ukrainian"` | `{ text: "hello", target: "uk" }` |
| `"hello from english in ukrainian"` | `{ text: "hello", target: "uk", source: "en" }` |
| `"hello"` | `undefined` — no connective |
| `"hello in Narnia"` | `undefined` — `resolveLanguage("Narnia")` fails |

## 5. Provider interface

`src/providers/*.ts`, each exporting a factory:

```ts
interface TranslateProvider {
  readonly id: string;
  translate(text: string, target: string, source?: string): Promise<TranslateResult>;
}

interface TranslateResult {
  readonly text: string;
  readonly source: string;   // resolved by the provider when input source was omitted
  readonly target: string;
  readonly provider: string; // == TranslateProvider.id
}
```

Every factory takes an injectable `fetch` (default `globalThis.fetch`) for
tests, the same as `EcbOptions`/`PostalCodesOptions`. `target`/`source` here
are always already-resolved ISO 639-1 codes — resolving a free-text language
name happens once, in `Translator`, before a provider is ever called.

- **`libreTranslate(opts)`** — `POST {url}/translate`, JSON body
  `{ q, source: source ?? "auto", target, format: "text" }`. `opts.url`
  required (no default — LibreTranslate has no single canonical public
  instance to hardcode, the same reasoning `PostalCodesOptions.url` gives for
  having no default). `opts.apiKey` optional, sent as `api_key` when present.
- **`googleTranslate(opts)`** — `POST https://translation.googleapis.com/language/translate/v2?key={apiKey}`, body `{ q: [text], target, source, format: "text" }`; `source` omitted from the body when not given, letting Google auto-detect. `opts.apiKey` required.
- **`deepl(opts)`** — `POST {url}/v2/translate`, `Authorization: DeepL-Auth-Key {apiKey}`, body `{ text: [text], target_lang: target.toUpperCase(), source_lang: source?.toUpperCase() }`. `opts.url` defaults to the free-tier endpoint (`api-free.deepl.com`); `opts.apiKey` required. **Known gap, not solved here:** DeepL uses regional variant codes for some targets (`EN-US` vs `EN-GB`, `PT-BR` vs `PT-PT`) where this package's table only has the bare ISO 639-1 code. The bare code is passed through as-is; DeepL accepts it for languages without a variant split and the variant-aware form is left as a follow-up.
- **`custom(fn)`** — wraps `(text, target, source?) => Promise<TranslateResult>` in the provider shape, `id: "custom"`. Covers Smartcat (dropped from v1's built-ins) or any other upstream without writing a first-class factory.

Every non-2xx response, and every response that fails to parse into the shape
each API promises, throws `TranslateProviderError(id, detail)` — no partial
or best-effort result.

## 6. `Translator`

`src/translator.ts` — the package's public door:

```ts
class Translator {
  constructor(opts: { provider: TranslateProvider; cache?: boolean }); // cache defaults true

  translate(
    text: string,
    target: string,           // name or ISO 639-1 code
    opts?: { source?: string; cache?: boolean },
  ): Promise<TranslateResult>;

  literal(input: string, opts?: { cache?: boolean }): Promise<TranslateResult>;
  // throws TranslateProviderError("translate", `could not parse ${JSON.stringify(input)} as a translation literal`)
  // when parseLiteral(input) returns undefined — literal() commits to a result or a thrown error,
  // unlike parseLiteral itself.

  resolveLanguage(word: string): string | undefined; // re-exports languages.ts's function as a method
}
```

`translate()` resolves `target` (and `source`, if given) through
`resolveLanguage` before calling the provider; an unresolvable `target` throws
`TranslateProviderError("translate", ...)` immediately, without reaching the
network.

**Caching:** an in-memory `Map<string, Promise<TranslateResult>>` keyed by
`` `${provider.id}:${source ?? "auto"}:${target}:${text}` ``, holding the
in-flight promise rather than its resolved value — the same shape
`PostalCodes#files` uses, so a burst of identical concurrent calls makes one
request, and a rejection deletes the entry so the next call retries rather
than replaying a settled rejection. No TTL: a translation of fixed input
doesn't go stale the way an exchange rate does. `{ cache: false }` on a call
bypasses both read and write for that call; `cache: false` on the constructor
disables it entirely (a 0-length effective cache).

## 7. Errors

`src/errors.ts`:

```ts
class TranslateProviderError extends SmartputError { // from @smartput/kind/errors
  readonly provider: string;
  constructor(provider: string, detail: string);
  // message: `Translate provider ${JSON.stringify(provider)} failed: ${detail}`
}
```

Same shape as `RateProviderError`, same reasoning for not living in
`@smartput/kind/errors` itself: geo's `errors.ts` gives it — this package's
errors never cross the shared `evaluate` path, so they stay local.

## 8. Testing

Colocated `*.test.ts`, run with `bun test`, matching every other package.

- `languages.test.ts` — table integrity (every code lowercase, unique, valid
  ISO 639-1 shape) and `resolveLanguage` cases: code, name, alias, multi-word,
  case-insensitivity, unknown → `undefined`.
- `literal.test.ts` — the table in §4 plus edge cases: text containing "in"/
  "to", missing connective, unresolvable language, empty input.
- `providers/*.test.ts` — one per provider, injected `fetch` returning fixture
  JSON for the happy path, a non-ok status, and a malformed body; asserts the
  exact request shape (URL, method, body, headers) each API contract requires.
- `translator.test.ts` — `translate()` and `literal()` against a `custom()`
  provider stub: resolves free-text and code targets identically, caching
  (dedup of concurrent identical calls, cache-bypass option, cache-clear on
  rejection), and `literal()`'s throw on an unparseable input.

## 9. Out of scope (v1)

- Multi-provider fallback/aggregation (unlike `Geo`'s multi-source search) —
  one `TranslateProvider` per `Translator`; `custom()` covers anything a
  built-in factory doesn't.
- Smartcat as a built-in factory — reachable via `custom()` if needed later.
- DeepL regional variant codes (§5).
- Native-script / localized language names in the table.
- Wiring into the Kind engine / `Vocabulary` (§1) — this is a deliberate,
  not merely deferred, exclusion.
