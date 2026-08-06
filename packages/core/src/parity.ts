import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "./engine";
import en from "./locale/en";

/**
 * The acceptance criterion for the whole stage restructuring: every public
 * result, over the whole corpus, byte for byte.
 *
 * Recorded with `bun run parity:record` and committed. A later task that
 * changes an output has to change this file too, in a diff a reviewer reads —
 * which is the point. The one expected diff is the span fix in Task 3, and it
 * gets its own explicit expectations rather than a blanket re-record.
 */
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

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
export function snapshot(input: string): unknown {
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

export function record(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of INPUTS) out[input] = snapshot(input);
  return out;
}
