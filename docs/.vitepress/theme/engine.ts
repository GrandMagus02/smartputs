import type { Engine, EngineOptions, Kind, Result, Weights } from "@smartput/core";
import { BUILTIN_KINDS, createEngine, SmartputError } from "@smartput/core";
import en from "@smartput/core/locale/en";

export type { Engine, Result };

export interface DocsEngineOptions {
  kinds?: Kind[];
  weights?: Weights;
  tiebreak?: EngineOptions["tiebreak"];
  ambiguityEpsilon?: number;
}

/**
 * Every demo on this site talks to a real engine built from the published
 * entry points — there is no mock layer and no precomputed output.
 */
export function createDocsEngine(opts: DocsEngineOptions = {}): Engine {
  return createEngine({
    locales: [en],
    kinds: [...BUILTIN_KINDS, ...(opts.kinds ?? [])],
    ...(opts.weights ? { weights: opts.weights } : {}),
    ...(opts.tiebreak ? { tiebreak: opts.tiebreak } : {}),
    ...(opts.ambiguityEpsilon !== undefined
      ? { ambiguityEpsilon: opts.ambiguityEpsilon }
      : {}),
  });
}

export const docsEngine: Engine = createDocsEngine();

export type EvalOutcome =
  | { status: "empty" }
  | { status: "ok"; result: Result }
  | { status: "error"; name: string; message: string };

/**
 * `evaluate()` is strict and throws — including on ambiguity, which is a
 * normal thing to type into a live input. Demos render the error instead of
 * breaking, so the failure modes are visible rather than hidden.
 */
export function evaluateSafely(engine: Engine, input: string): EvalOutcome {
  if (input.trim() === "") return { status: "empty" };
  try {
    return { status: "ok", result: engine.evaluate(input) };
  } catch (error) {
    // `error.name` and not `constructor.name`: the client bundle is minified,
    // so the class name is mangled while `name` is a literal the library sets.
    if (error instanceof SmartputError) {
      return { status: "error", name: error.name, message: error.message };
    }
    return {
      status: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Lucide icon suffix per built-in kind, used by the result cards. */
export const KIND_ICONS: Record<string, string> = {
  length: "ruler",
  mass: "weight",
  duration: "timer",
  number: "hash",
};

export function kindIcon(kind: string): string {
  return `i-lucide-${KIND_ICONS[kind] ?? "shapes"}`;
}
