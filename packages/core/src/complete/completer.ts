import { deepFreeze } from "../freeze";
import type { Registry } from "../kind/registry";
import type { Locale, Weights } from "../types";
import { type CompleteOptions, type Completion, complete } from "./complete";

export interface CompleterOptions {
  registry: Registry;
  /** The `Locale` object, unlike `Evaluator`'s locale id — `complete()` takes
   * the object today, and this stage keeps that shape rather than papering
   * over the asymmetry. */
  locale: Locale;
  layers: (Weights | undefined)[];
}

/**
 * `complete()` holding its own config, the same shape as every other stage.
 * No behaviour change (spec §4.7): the stage set is complete, and one import
 * style — a configured class alongside the pure function it wraps — covers
 * everything.
 *
 * Deliberately runs on a raw input string, not a `NormalizedInput` or a
 * `Program`: a completion is offered for text that by definition does not yet
 * parse, which a `Program` cannot represent.
 */
export class Completer {
  private readonly registry: Registry;
  private readonly locale: Locale;
  private readonly layers: (Weights | undefined)[];

  constructor(cfg: CompleterOptions) {
    this.registry = cfg.registry;
    this.locale = cfg.locale;
    // Copied, not aliased: `layers` is an array the caller could keep pushing
    // onto after construction, and a frozen `Completer` promising no state
    // between runs would otherwise still see it move.
    this.layers = [...cfg.layers];
    Object.freeze(this);
  }

  run(input: string, opts?: CompleteOptions): readonly Completion[] {
    // `complete()` itself returns a plain, unfrozen array — every other
    // caller of it composes further (the engine wraps rows into `Result`s),
    // so freezing there would be freezing something about to be thrown away.
    // Here the array *is* the output, so it is frozen the way every other
    // stage's output is.
    return deepFreeze(
      complete({
        registry: this.registry,
        locale: this.locale,
        layers: this.layers,
        input,
        ...(opts !== undefined ? { opts } : {}),
      }),
    );
  }
}
