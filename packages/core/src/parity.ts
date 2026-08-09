import type { Engine } from "./engine";

/**
 * The acceptance criterion for the whole stage restructuring: every public
 * result, over the whole corpus, byte for byte — for the one engine every
 * caller builds it with (`BUILTIN_KINDS`, locale `en`; see the callers of
 * `snapshot`/`record` for the exact construction). Callers build that engine
 * themselves and pass it in, so this module names no `@smartput/kinds`
 * dependency of its own: importing that package at module scope from
 * shipping (non-test) source is exactly what `check-deps` forbids for a
 * package that only devDependencies it.
 *
 * Recorded with `bun run parity:record` and committed. A later task that
 * changes an output has to change this file too, in a diff a reviewer reads —
 * which is the point. The one expected diff is the span fix in Task 3, and it
 * gets its own explicit expectations rather than a blanket re-record.
 *
 * Two known blind spots, not fixed here, just named: (a) no corpus input
 * exercises a length-changing normalization, so a length-changing `mapSpan`
 * regression is invisible to this net — `span.test.ts`'s padded-corpus loop
 * covers that instead; (b) `BUILTIN_KINDS` registers no literal matchers, so
 * the fixture contains no `literal` token, no `LiteralNode`, and no claimed
 * convert target — the paths where node-object identity mattered before the
 * re-key are untouched by this net.
 *
 * A third, measured rather than reasoned about: every input in both corpora
 * is pure ASCII, so this net never diffs a `mapSpan`-mapped span against an
 * unmapped one — again `span.test.ts`'s corpus is what actually covers that
 * (its own inputs include the degree sign and non-ASCII dashes). Of the 85
 * inputs, 51 evaluate without error, and for every one of those 51,
 * `confidence` is exactly `1` and `assumptions` is `[]` — this net has never
 * been able to catch a regression in either. What it does cover, and covers
 * well: 178 `complete()` rows across the corpus, a per-candidate
 * `explain().assignments` breakdown for each of the 51 successful
 * evaluations, and — since a few inputs share a `formatted` string with
 * another input (`"1 kg + 500 g"` and `"1.5 kilograms"` both print
 * `"1.5 kilograms"`, for one) — 48 distinct formatted strings, not 51. In
 * short: this net is a formatting-and-scoring regression guard, not a
 * confidence/assumption/span one.
 */

const corpus = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();
const completeCorpus = await Bun.file(
  new URL("../corpus/en-complete.tsv", import.meta.url),
).text();

const ukCorpus = await Bun.file(new URL("../corpus/uk.tsv", import.meta.url)).text();
const ukCompleteCorpus = await Bun.file(
  new URL("../corpus/uk-complete.tsv", import.meta.url),
).text();

const rows = (raw: string): string[][] =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t"));

const inputsOf = (...raws: string[]): string[] =>
  raws
    .flatMap((raw) => rows(raw).map((r) => r[0] as string))
    .filter((v, i, a) => a.indexOf(v) === i);

/** Every input the recorder and the test both walk, in a stable order. */
export const INPUTS: string[] = inputsOf(corpus, completeCorpus);

/**
 * The same, for Ukrainian, against its own corpus.
 *
 * A separate list rather than a second column on the English one, because the
 * two corpora are translations rather than transliterations: Ukrainian's rows
 * exercise four plural categories where English needs two, a decimal comma
 * that collides with English's thousands separator, and spelled numerals whose
 * hundreds are words rather than compounds. Half of them have no English row
 * to sit beside.
 *
 * The engine that replays this one is built from `ukrainian` and `BUILTIN_UK`,
 * which is what makes it a parity net for a *language* rather than for the
 * engine's plumbing — the two share every line of code below.
 */
export const UK_INPUTS: string[] = inputsOf(ukCorpus, ukCompleteCorpus);

/**
 * What a corpus row *declares*, for the columns beyond the input.
 *
 * These columns were decorative until this function existed: `INPUTS` read
 * column 0 and nothing read the rest, so `en.tsv` carried 36 rows of
 * unverified documentation. They were all correct, as it turned out — but
 * nothing was keeping them that way, and for Ukrainian that gap is the whole
 * risk. A recorded snapshot pins that output does not *change*; only a
 * declared column pins that it was *right to begin with*, in a diff a reader
 * who speaks the language can check.
 */
export interface DeclaredRow {
  readonly input: string;
  readonly kind: string;
  readonly canonical: string;
  readonly formatted: string;
}

/** What a completion corpus row declares about its first offered row. */
export interface DeclaredCompletion {
  readonly input: string;
  readonly kind: string;
  readonly unit: string;
  readonly text: string;
}

const declared = (raw: string): DeclaredRow[] =>
  rows(raw)
    .filter((r) => r.length >= 4)
    .map(([input, kind, canonical, formatted]) => ({
      input: input as string,
      kind: kind as string,
      canonical: canonical as string,
      formatted: formatted as string,
    }));

const declaredCompletions = (raw: string): DeclaredCompletion[] =>
  rows(raw)
    .filter((r) => r.length >= 4)
    .map(([input, kind, unit, text]) => ({
      input: input as string,
      kind: kind as string,
      unit: unit as string,
      text: text as string,
    }));

export const DECLARED: Record<"en" | "uk", DeclaredRow[]> = {
  en: declared(corpus),
  uk: declared(ukCorpus),
};

export const DECLARED_COMPLETIONS: Record<"en" | "uk", DeclaredCompletion[]> = {
  en: declaredCompletions(completeCorpus),
  uk: declaredCompletions(ukCompleteCorpus),
};

/** JSON-safe, and deliberately lossy in no place a later task could hide in. */
export function snapshot(engine: Engine, input: string): unknown {
  const capture = <T>(f: () => T): unknown => {
    try {
      return { ok: f() };
    } catch (e) {
      return {
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      };
    }
  };

  return {
    evaluate: capture(() => {
      const r = engine.evaluate(input);
      return {
        kind: r.kind,
        canonical: r.value.canonical.toString(),
        unit: r.value.unit,
        formatted: r.formatted,
        confidence: r.confidence,
        spans: r.spans,
        assumptions: r.meta.assumptions,
      };
    }),
    suggest: capture(() =>
      engine.suggest(input).map((r) => ({
        kind: r.kind,
        canonical: r.value.canonical.toString(),
        formatted: r.formatted,
        confidence: r.confidence,
      })),
    ),
    explain: capture(() => {
      const x = engine.explain(input);
      return {
        tokens: x.tokens.map((t) =>
          t.type === "number"
            ? { type: t.type, text: t.text, start: t.start, end: t.end }
            : { ...t, value: undefined, canonical: undefined },
        ),
        candidates: x.candidates.map((c) => ({
          kind: c.kind,
          unit: c.unit,
          weight: c.weight,
          form: c.form,
        })),
        assignments: x.assignments,
      };
    }),
    complete: capture(() => engine.complete(input)),
    coerce: capture(() => {
      const kind = engine.evaluate(input).kind;
      const v = engine.coerce(kind, input);
      return { kind: v.kind, canonical: v.canonical.toString(), unit: v.unit };
    }),
  };
}

export function record(
  engine: Engine,
  inputs: readonly string[] = INPUTS,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of inputs) out[input] = snapshot(engine, input);
  return out;
}
