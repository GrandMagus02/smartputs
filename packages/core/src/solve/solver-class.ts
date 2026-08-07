import { AmbiguityError } from "../errors";
import type { Registry } from "../kind/registry";
import type { Program } from "../parse/program";
import type { KindId, ResultCandidate } from "../types";
import { type Resolution, solve } from "./solver";

export interface SolverOptions {
  registry: Registry;
  maxCandidates?: number;
  ambiguityEpsilon?: number;
  tiebreak?: "error" | "first";
}

/**
 * `best()` is where the epsilon-and-tiebreak block that lived inline in
 * `evaluate()` moves, and `forKind()` is what `coerce()` open-coded. Having all
 * three named in one place is what stops the fourth caller inventing a fourth
 * variant.
 */
export class Solver {
  private readonly registry: Registry;
  private readonly maxCandidates: number;
  private readonly epsilon: number;
  private readonly tiebreak: "error" | "first";

  constructor(cfg: SolverOptions) {
    this.registry = cfg.registry;
    this.maxCandidates = cfg.maxCandidates ?? 10_000;
    this.epsilon = cfg.ambiguityEpsilon ?? 0.05;
    this.tiebreak = cfg.tiebreak ?? "error";
    Object.freeze(this);
  }

  /** Every consistent assignment, ranked. Never throws on ambiguity. */
  all(program: Program, opts?: { kinds?: KindId[] }): Resolution[] {
    return solve(program, this.registry, {
      maxCandidates: this.maxCandidates,
      input: program.input.source,
      ...(opts?.kinds ? { kinds: opts.kinds } : {}),
    });
  }

  /** The winner, applying epsilon and tiebreak. Throws `AmbiguityError`. */
  best(program: Program, opts?: { kinds?: KindId[] }): Resolution {
    const all = this.all(program, opts);
    const [best, second] = all;
    // Unreachable in practice: `solve` throws before returning an empty array,
    // so `all` is never `[]` here. The guard stays because destructuring under
    // `noUncheckedIndexedAccess` types `best` as `Resolution | undefined`
    // regardless — this is what the type system requires to typecheck, not a
    // path that runs.
    if (best === undefined) {
      throw new AmbiguityError(
        program.input.source,
        [],
        [program.input.mapSpan(program.root.span)],
      );
    }
    if (
      this.tiebreak === "error" &&
      second !== undefined &&
      Math.abs(best.confidence - second.confidence) < this.epsilon
    ) {
      const listed: ResultCandidate[] = all.slice(0, 5).map((a) => ({
        kind: a.kind,
        unit: Object.values(a.choices)[0]?.unit ?? "",
        confidence: a.confidence,
      }));
      throw new AmbiguityError(program.input.source, listed, [
        program.input.mapSpan(program.root.span),
      ]);
    }
    return best;
  }

  /** The best resolution whose result kind is `kind`, or undefined. */
  forKind(
    program: Program,
    kind: KindId,
    opts?: { kinds?: KindId[] },
  ): Resolution | undefined {
    return this.all(program, opts).find((r) => r.kind === kind);
  }
}
