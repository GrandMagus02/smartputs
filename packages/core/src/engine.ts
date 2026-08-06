import type { CompleteOptions, Completion } from "./complete/complete";
import { Completer } from "./complete/completer";
import type { Decimal } from "./decimal";
import {
  KindConflictError,
  MissingRateError,
  NoCandidateError,
  SmartputError,
  UnitParseError,
  UnknownKindError,
} from "./errors";
import { Evaluator } from "./eval/evaluator";
import { buildRegistry, NUMBER_KIND, type Registry } from "./kind/registry";
import { createResolver } from "./parse/candidates";
import type { Token } from "./parse/lex";
import { Normalizer } from "./parse/normalize";
import { Parser, type Program } from "./parse/program";
import { Tokenizer, type TokenStream } from "./parse/tokenizer";
import { Printer } from "./print/print";
import type { Resolution } from "./solve/solver";
import { Solver } from "./solve/solver-class";
import { weightBreakdown } from "./solve/weights";
import type {
  Assumption,
  Candidate,
  Kind,
  KindId,
  Locale,
  LocalePack,
  RateLookup,
  Span,
  Value,
  Weights,
} from "./types";

/**
 * SmartputErrors that never mean "this input has no interpretation", so
 * `suggest` re-throws them rather than answering with an empty list.
 *
 * Spec §7 promises `suggest()` does not throw on *parse* problems. A missing
 * rate is a data problem: `suggest("30 jpy")` against a snapshot without JPY
 * used to return `[]` while `evaluate` on the same input threw, and
 * `LiveEngine.suggest` is the keystroke-rate API, so the user saw "no results"
 * where the truth was "no rate for JPY". The other two are registration errors
 * — a kind registered twice, a locale pack contributing to a kind that does not
 * exist — which describe the caller's wiring, never the caller's input.
 */
const NEVER_SWALLOWED = [MissingRateError, KindConflictError, UnknownKindError];

export interface EngineOptions {
  locales: Locale[];
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
  /**
   * Default `Value.meta` per kind, attached to every quantity of that kind.
   * The `measure` kind reads `{ dpi }` from here; nothing else uses it yet.
   */
  kindMeta?: Readonly<Record<KindId, Readonly<Record<string, unknown>>>>;
  /**
   * Significant digits in formatted output. Defaults to 26 — two guard digits
   * below the 28 Decimal computes at, which is what keeps a round trip through
   * a non-terminating ratio from surfacing as trailing noise.
   */
  formatPrecision?: number;
  /**
   * FX rates for kinds whose unit ratios are not constants. `@smartput/rate`'s
   * RateSnapshot satisfies this structurally; core never imports it.
   */
  rates?: RateLookup;
  /** Rounding mode for money formatting. Default ROUND_HALF_EVEN. */
  rounding?: Decimal.Rounding;
  /**
   * Injectable clock, epoch milliseconds. Spec §6 requires it: "today" and
   * "next week monday" are untestable without one. Epoch milliseconds rather
   * than a Temporal instant so core stays free of a Temporal dependency —
   * `@smartput/datetime` converts.
   */
  now?: () => number;
  /** IANA time zone every literal matcher resolves against. Defaults to the host zone. */
  timeZone?: string;
}

export interface EvalOptions {
  kinds?: KindId[];
  weights?: Weights;
  /** Per-call time zone, overriding `EngineOptions.timeZone`. */
  timeZone?: string;
}

export interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;
  spans: Span[];
  meta: { ratesAsOf?: string; assumptions: Assumption[] };
}

export interface Explanation {
  input: string;
  /** Token.start/end index `input`, the same string `Result.spans` does. */
  tokens: Token[];
  candidates: Candidate[];
  assignments: Array<{
    kind: KindId;
    score: number;
    confidence: number;
    units: string[];
    contributions: Array<{ selector: string; value: number; layer: number }>;
  }>;
}

export interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
  complete(input: string, opts?: CompleteOptions): Completion[];
}

/**
 * The three weight layers every reading is scored against — locale, engine,
 * call — in the order `resolveWeight` sums them. The one formula, shared by
 * `parserFor`/`completerFor` (which need the array to build a fresh stage)
 * and `toExplanation` (which needs it again to reproduce a candidate's score
 * as named rows), so a fourth caller cannot invent a different order.
 */
function weightLayers(
  locale: Locale,
  opts: EngineOptions,
  call: Weights | undefined,
): (Weights | undefined)[] {
  return [locale.weights, opts.weights, call];
}

/**
 * One instance each of the stages that hold no per-call state, built once and
 * reused across every call `createEngine`'s returned `Engine` receives. The
 * `Parser` and `Completer` are conspicuously missing: both close over a weight
 * layer that `EvalOptions.weights`/`CompleteOptions.weights` can override per
 * call, so `createEngine` builds a fresh one per call instead (`parserFor`,
 * `completerFor`).
 */
function buildStages(opts: EngineOptions, registry: Registry, locale: Locale) {
  return {
    normalizer: new Normalizer(),
    tokenizer: new Tokenizer({
      locale,
      registry,
      ...(opts.now === undefined ? {} : { now: opts.now }),
      ...(opts.timeZone === undefined ? {} : { timeZone: opts.timeZone }),
    }),
    solver: new Solver({
      registry,
      ...(opts.maxCandidates === undefined ? {} : { maxCandidates: opts.maxCandidates }),
      ...(opts.ambiguityEpsilon === undefined
        ? {}
        : { ambiguityEpsilon: opts.ambiguityEpsilon }),
      ...(opts.tiebreak === undefined ? {} : { tiebreak: opts.tiebreak }),
    }),
    evaluator: new Evaluator({
      registry,
      locale: locale.id,
      ...(opts.kindMeta === undefined ? {} : { kindMeta: opts.kindMeta }),
      ...(opts.rates ? { rates: opts.rates } : {}),
    }),
    printer: new Printer({
      registry,
      locale,
      ...(opts.rates ? { rates: opts.rates } : {}),
      ...(opts.rounding === undefined ? {} : { rounding: opts.rounding }),
    }),
  };
}

/**
 * The stage instances and options every entry point method needs but no
 * single call supplies — as opposed to `layers(call?.weights)` and a fresh
 * `Parser`/`Completer`, which are per-call. Built once, passed down instead of
 * closed over, the way spec §5's `toResult(program, resolution, printer,
 * evaluator)` already takes `printer` and `evaluator` as explicit arguments.
 *
 * `opts` must be `createEngine`'s frozen copy, never the caller's own
 * `EngineOptions` object, because `toResult` reads `opts.formatPrecision`/
 * `opts.rounding`/`opts.rates` live, on every call — unlike every other stage
 * here, which snapshots its config once at construction. If `opts` aliased
 * the caller's live object, a caller mutating `opts.rates` after
 * `createEngine` returns would change what `evaluate()` formats and reports
 * as `meta.ratesAsOf`, while `Evaluator` (already constructed, holding the
 * table it was given) keeps computing `value` against the rates that existed
 * at construction time — two rate tables in one `Result`.
 */
interface EngineCtx {
  registry: Registry;
  locale: Locale;
  evaluator: Evaluator;
  printer: Printer;
  opts: EngineOptions;
}

/**
 * `evaluator.run` plus the formatting and span-mapping every entry point
 * needs to turn a `Resolution` into the public `Result` shape. Takes `ctx`
 * explicitly rather than closing over it, the way spec §5's
 * `toResult(program, resolution, printer, evaluator)` does — `printer` and
 * `evaluator` both arrive folded into one `ctx` here instead of as two
 * separate parameters, which is what lets a future per-call override swap
 * one field via a spread rather than every caller here restating both.
 *
 * `printer.value` replaces the direct `formatValue` call: the `Printer`
 * this `EngineCtx` carries was built with the same `rates`/`rounding`
 * `formatValue` used to be handed explicitly, so only `formatPrecision`
 * (a per-call-shaped option `Printer`'s constructor does not hold) still
 * needs threading through here.
 */
function toResult(program: Program, resolution: Resolution, ctx: EngineCtx): Result {
  const { evaluator, printer, opts } = ctx;
  const { value, assumptions } = evaluator.run(program, resolution);
  return {
    value,
    formatted: printer.value(value, {
      ...(opts.formatPrecision === undefined ? {} : { precision: opts.formatPrecision }),
    }),
    kind: value.kind,
    confidence: resolution.confidence,
    // Spans are produced against the normalized text; the caller reads them
    // against the string they passed in. Without this they disagree whenever
    // normalization changed a length.
    spans: [program.input.mapSpan(program.root.span)],
    meta: {
      assumptions: [...assumptions],
      ...(opts.rates ? { ratesAsOf: opts.rates.asOf } : {}),
    },
  };
}

/**
 * `explain()`'s whole body: the token span mapping (Task 6's boundary rule —
 * `stream.tokens` is normalized-relative because `foldLiterals` slices
 * `normalized.text` by these offsets, so this is the one place they reach a
 * caller), the deduplicated candidate list, and the per-assignment
 * contribution rows, where every summand of `score` gets a row so
 * `Σcontributions === score`.
 */
function toExplanation(
  program: Program,
  streamTokens: readonly Token[],
  assignments: Resolution[],
  weights: Weights | undefined,
  ctx: EngineCtx,
): Explanation {
  const { registry, locale, opts } = ctx;
  const layers = weightLayers(locale, opts, weights);
  const tokens: Token[] = streamTokens.map((t) => ({
    ...t,
    ...program.input.mapSpan({ start: t.start, end: t.end }),
  }));

  const candidates: Candidate[] = [];
  for (const assignment of assignments) {
    for (const candidate of Object.values(assignment.choices)) {
      if (
        !candidates.some((c) => c.kind === candidate.kind && c.unit === candidate.unit)
      ) {
        candidates.push(candidate);
      }
    }
  }

  return {
    input: program.input.source,
    tokens,
    candidates,
    assignments: assignments.map((a) => {
      const chosen = Object.values(a.choices);
      return {
        kind: a.kind,
        score: a.score,
        confidence: a.confidence,
        units: chosen.map((c) => c.unit),
        contributions: [
          ...chosen.flatMap((c) => [
            ...weightBreakdown({
              kind: c.kind,
              unit: c.unit,
              // The folded surface is what `token:` selectors matched during
              // scoring; passing the raw one would drop rows silently.
              surface: c.foldedSurface,
              prior: registry.kinds.get(c.kind)?.prior ?? 0,
              layers,
              // Only a corrected reading carries one, and it is what puts
              // the `fuzzy:` row in the list. Dropping it here would leave
              // the rows short of the score by exactly the penalty.
              ...(c.fuzzy ? { fuzzy: c.fuzzy } : {}),
            }),
            { selector: "analyzer", value: c.analyzerWeight, layer: 0 },
          ]),
          { selector: "contextBonus", value: a.contextBonus, layer: 0 },
          // Unlike contextBonus, emitted only when non-zero: no built-in
          // signature carries a weight, so an unconditional row would add a
          // `signature: 0` line to every explanation in the repo to say
          // nothing. The sum invariant holds either way, 0 being 0.
          ...(a.signatureWeight === 0
            ? []
            : [{ selector: "signature", value: a.signatureWeight, layer: 0 }]),
        ],
      };
    }),
  };
}

/**
 * Only the library's own errors mean "this input has no interpretation", and
 * not even all of those — see `NEVER_SWALLOWED`. A TypeError from a bug in
 * the pipeline must keep its stack rather than masquerade as an empty result.
 */
function swallowedAsEmpty<T>(fn: () => T[]): T[] {
  try {
    return fn();
  } catch (e) {
    if (e instanceof SmartputError && !NEVER_SWALLOWED.some((C) => e instanceof C))
      return [];
    throw e;
  }
}

/**
 * `coerce`'s error policy: any `SmartputError` other than a `NoCandidateError`
 * already in hand becomes one. This must wrap `forKind`'s own solve() call
 * along with parsing — a kinds-filtered solve over an expression whose
 * operand kinds fall outside `[kind, NUMBER_KIND]` (coercing "3 m * 4 m" to
 * "area" filters the length-typed "m" slots down to nothing) throws
 * `DimensionMismatchError`, another `SmartputError` this method's contract
 * still answers with `NoCandidateError`, not the raw error.
 */
function orNoCandidate<T>(input: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof NoCandidateError) throw e;
    if (!(e instanceof SmartputError)) throw e;
    throw new NoCandidateError(input, input, []);
  }
}

export function createEngine(callerOpts: EngineOptions): Engine {
  const opts = Object.freeze({ ...callerOpts }); // a copy — see EngineCtx's doc for why
  const locale = opts.locales[0];
  if (locale === undefined) throw new Error("createEngine requires at least one locale");
  const registry = buildRegistry(opts.kinds ?? [], opts.packs ?? [], locale.id);
  const layers = (call?: Weights) => weightLayers(locale, opts, call);
  const stages = buildStages(opts, registry, locale);
  const ctx: EngineCtx = {
    registry,
    locale,
    evaluator: stages.evaluator,
    printer: stages.printer,
    opts,
  };
  // The Parser (and Completer) is rebuilt per call: it closes over the weight
  // layers, and `EvalOptions.weights` is a per-call override.
  const parserFor = (call?: EvalOptions) =>
    new Parser({
      resolver: createResolver({
        registry,
        locale,
        packs: opts.packs ?? [],
        layers: layers(call?.weights),
      }),
    });
  const completerFor = (call?: EvalOptions) =>
    new Completer({ registry, locale, layers: layers(call?.weights) });
  const tokenize = (input: string, call?: EvalOptions): TokenStream => {
    const normalized = stages.normalizer.run(input);
    if (normalized.empty) throw new UnitParseError(input);
    const tz = call?.timeZone === undefined ? undefined : { timeZone: call.timeZone };
    return stages.tokenizer.run(normalized, tz);
  };
  const compile = (input: string, call?: EvalOptions): Program =>
    parserFor(call).run(tokenize(input, call));

  return {
    evaluate(input, call) {
      const program = compile(input, call);
      return toResult(program, stages.solver.best(program, call), ctx);
    },
    suggest(input, call) {
      return swallowedAsEmpty(() => {
        const program = compile(input, call);
        return stages.solver.all(program, call).map((r) => toResult(program, r, ctx));
      });
    },
    coerce(kind, input, call) {
      const resolved = orNoCandidate(input, () => {
        const program = compile(input, call);
        const kinds = [kind, NUMBER_KIND];
        return { program, resolution: stages.solver.forKind(program, kind, { kinds }) };
      });
      if (resolved.resolution === undefined) throw new NoCandidateError(input, input, []);
      return stages.evaluator.run(resolved.program, resolved.resolution).value;
    },
    explain(input, call) {
      const stream = tokenize(input, call);
      const program = parserFor(call).run(stream);
      const assignments = stages.solver.all(program, call);
      return toExplanation(program, stream.tokens, assignments, call?.weights, ctx);
    },
    complete(input, call) {
      return [...completerFor(call).run(input, call)];
    },
  };
}
