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

const rows = (raw: string): string[][] =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("\t"));

/** Every input the recorder and the test both walk, in a stable order. */
export const INPUTS: string[] = [
  ...rows(corpus).map((r) => r[0] as string),
  ...rows(completeCorpus).map((r) => r[0] as string),
].filter((v, i, a) => a.indexOf(v) === i);

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

export function record(engine: Engine): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of INPUTS) out[input] = snapshot(engine, input);
  return out;
}
