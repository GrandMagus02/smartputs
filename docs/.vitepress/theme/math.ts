import type {
  AnalysisResult,
  EvaluateResult,
  MathEngine,
  MatrixResult,
  SolveResult,
  Step,
  SystemResult,
} from "@smartput/math";
import { onMounted, type ShallowRef, shallowRef } from "vue";

export type {
  AnalysisResult,
  EvaluateResult,
  MathEngine,
  MatrixResult,
  SolveResult,
  Step,
  SystemResult,
};

export interface MathApi {
  engine: MathEngine;
  operatorWords: Readonly<Record<string, string>>;
}

/**
 * `@smartput/math` carries a computer algebra system, and it is around nine
 * megabytes of it. Imported statically it would land in the theme chunk that
 * every page of this site loads — including the ones with no maths on them.
 * So it is fetched on mount, once, and shared: the first maths demo to mount
 * pays for the download and every other one on the page joins the same promise.
 */
let pending: Promise<MathApi> | null = null;

export function loadMath(): Promise<MathApi> {
  pending ??= import("@smartput/math")
    .then((module) => ({
      engine: module.createMathEngine(),
      operatorWords: module.OPERATOR_WORDS,
    }))
    // A failed load is not cached: the next demo to mount retries rather than
    // joining a promise that is already rejected, which would leave the page
    // spinning forever after one bad network moment.
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

/**
 * The compute engine's symbolic integration rules read `process.env.RUBI_*`
 * feature flags at import time. In Node that is unremarkable; in a browser
 * `process` does not exist, and the ReferenceError takes down the whole module
 * — every demo on the page stays on "loading" with the reason only visible in
 * the console. One empty environment satisfies it.
 */
function shimProcessEnv(): void {
  const scope = globalThis as { process?: { env: Record<string, string> } };
  scope.process ??= { env: {} };
}

/**
 * The engine, once it has arrived. Null until then — which is also the SSR
 * state, so every demo has to render something sensible without it.
 */
export function useMath(): ShallowRef<MathApi | null | Error> {
  const api = shallowRef<MathApi | null | Error>(null);
  onMounted(() => {
    shimProcessEnv();
    void loadMath().then(
      (loaded) => {
        api.value = loaded;
      },
      (error: unknown) => {
        api.value = error instanceof Error ? error : new Error(String(error));
      },
    );
  });
  return api;
}

export type MathOutcome<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ok"; value: T }
  | { status: "error"; name: string; message: string };

/**
 * Run one call and keep its failure as data.
 *
 * Every entry point throws on input it cannot read, and half-typed LaTeX is the
 * normal state of a live input — `\frac{1}{` is what `\frac{1}{2}` looks like
 * two keystrokes early. Demos render the error instead of blanking, so the
 * failure modes are part of what the page teaches.
 */
export function attempt<T>(
  api: MathApi | null | Error,
  input: string,
  run: (engine: MathEngine) => T,
): MathOutcome<T> {
  if (api === null) return { status: "loading" };
  // The engine itself failed to arrive. Reported like any other failure, since
  // a demo that spins forever tells the reader nothing about why.
  if (api instanceof Error) {
    return { status: "error", name: "LoadError", message: api.message };
  }
  if (input.trim() === "") return { status: "empty" };
  try {
    return { status: "ok", value: run(api.engine) };
  } catch (error) {
    // `error.name`, never `constructor.name`: the client bundle is minified, so
    // the class name is mangled while `name` is a literal the library sets.
    return {
      status: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * A step's rule id, shortened for display. The algebraic rules arrive
 * namespaced (`solve.quadratic-formula`) and the integration rules arrive as
 * whole Rubi corpus paths, which are stable machine ids and useless as labels —
 * so the tail is shown and the full id stays in the `title` attribute.
 */
export function shortRule(rule: string): string {
  const tail = rule.split("/").at(-1) ?? rule;
  return tail.length > 32 ? `${tail.slice(0, 31)}…` : tail;
}
