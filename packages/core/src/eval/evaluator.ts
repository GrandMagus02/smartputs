import { deepFreeze } from "../freeze";
import type { Registry } from "../kind/registry";
import type { Program } from "../parse/program";
import type { Resolution } from "../solve/solver";
import type { Assumption, KindId, RateLookup, Value } from "../types";
import { evaluateNode } from "./evaluate";

export interface Evaluation {
  readonly value: Value;
  readonly assumptions: readonly Assumption[];
}

export interface EvaluatorOptions {
  registry: Registry;
  /** Locale id, as `evaluateNode` takes today — not the `Locale` object. */
  locale: string;
  kindMeta?: Record<KindId, Record<string, unknown>>;
  rates?: RateLookup;
}

/**
 * `evaluateNode` holding its own config, the way `Tokenizer` holds a
 * `TokenizerOptions` and `Parser` holds a `Resolver`. `run()` supplies `input`
 * from `program.input.source` — the one field `evaluateNode`'s options need
 * that a `Program` already carries, so a caller reusing one `Evaluator`
 * across many programs never restates it.
 *
 * `evaluateNode` stays exported and unchanged: a caller who wants to pass a
 * different `input` string than the program's own source — or who has no
 * `Program` at all — calls it directly.
 */
export class Evaluator {
  private readonly registry: Registry;
  private readonly locale: string;
  private readonly kindMeta?: Record<KindId, Record<string, unknown>>;
  private readonly rates?: RateLookup;

  constructor(cfg: EvaluatorOptions) {
    this.registry = cfg.registry;
    this.locale = cfg.locale;
    if (cfg.kindMeta !== undefined) this.kindMeta = cfg.kindMeta;
    if (cfg.rates !== undefined) this.rates = cfg.rates;
    Object.freeze(this);
  }

  run(program: Program, resolution: Resolution): Evaluation {
    const { value, assumptions } = evaluateNode({
      program,
      resolution,
      registry: this.registry,
      locale: this.locale,
      input: program.input.source,
      ...(this.kindMeta !== undefined ? { kindMeta: this.kindMeta } : {}),
      ...(this.rates !== undefined ? { rates: this.rates } : {}),
    });
    return deepFreeze({ value, assumptions });
  }
}
