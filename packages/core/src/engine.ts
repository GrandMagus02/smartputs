import type { CompleteOptions, Completion } from "./complete/complete";
import { Autocompleter } from "./complete/completer";
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
import type { CueHit } from "./scan/cues";
import { DEFAULT_CUE_WINDOW, DEFAULT_MAX_SPAN, Scanner } from "./scan/scan";
import type { Resolution } from "./solve/solver";
import { Solver } from "./solve/solver-class";
import { weightBreakdown } from "./solve/weights";
import type {
  Assumption,
  Candidate,
  Kind,
  KindId,
  Locale,
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
 * — a kind registered twice, a vocabulary naming a kind that does not exist —
 * which describe the caller's wiring, never the caller's input.
 */
const NEVER_SWALLOWED = [MissingRateError, KindConflictError, UnknownKindError];

export interface EngineOptions {
  /**
   * Every language the engine reads. Recognition is many-locale: a surface is
   * offered a reading if *any* of these can reach it, which is why `"5 кг in
   * pounds"` works on an engine that prints English.
   */
  locales: Locale[];
  /**
   * The one language the engine writes, by id. Defaults to `locales[0].id`,
   * and must name one of the installed locales — `createEngine` throws if it
   * does not, because a format locale that is not installed has no vocabulary
   * to print from and would fail later, at a keystroke, instead of on boot.
   *
   * Generation is deliberately single-locale (design decision I6): a `Result`
   * is one string in one language, not a table. This also fixes the two
   * input-side concerns that are not recognition — number grammar and
   * segmentation (I8) — because both belong to the language the engine
   * speaks rather than to any of the ones it merely reads.
   */
  format?: string;
  kinds?: Kind[];
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
  /**
   * Significant digits a comparison rounds both operands to before deciding —
   * ruling C4. Defaults to 26, the same figure `formatPrecision` defaults to,
   * so two values that print identically compare identically. `"exact"`
   * compares the canonicals as computed, which is what a caller checking the
   * arithmetic rather than the intent wants.
   */
  comparePrecision?: number | "exact";
}

export interface EvalOptions {
  kinds?: KindId[];
  /**
   * Locale ids a reading may come from, narrowing the candidate set the way
   * `kinds` does and in the same place — `solve/solver.ts`'s `collectSlots`.
   * A reading's locale is the language that *listed its spelling*
   * (`Candidate.locale`), not the language the reader speaks, so this is a
   * filter on vocabularies rather than on readers: `{ locales: ["en"] }`
   * refuses `"5 кг"` because Ukrainian is the vocabulary that spells it that
   * way, and accepts `"5 kg"` because English is the one that spells it this
   * way — even though Ukrainian lists `"kg"` too.
   *
   * Filtering every reading of a slot away is the same situation
   * `{ kinds: [...] }` creates and raises the same `DimensionMismatchError`:
   * the surface *was* recognised and then refused, which is a different thing
   * from `NoCandidateError`'s "no reading exists".
   */
  locales?: string[];
  weights?: Weights;
  /**
   * Kind -> weight, added once to a reading whose *result* kind matches — the
   * term `scan` computes from the words around a mark (spec §5.1).
   *
   * Public rather than a private channel `scan` alone can reach, because a
   * caller who already knows their domain can say the same thing directly:
   * `suggest("10 m", { cues: { duration: 3 } })` gets exactly the bias scan
   * would have computed from a nearby "in". It is what makes `scan` a
   * segmenter over public machinery rather than a second engine.
   *
   * Unlike `weights`, this is a small scale: see `CUE_CEILING`.
   */
  cues?: Readonly<Record<KindId, number>>;
  /**
   * Per-call output language, overriding `EngineOptions.format`. Must name an
   * installed locale.
   *
   * Output only, and the limit is deliberate: it rebuilds the `Printer` and
   * `Evaluator`, not the `Tokenizer`. Number grammar and segmentation are the
   * format locale's too (I8), but they run inside the shared `Tokenizer` that
   * `buildStages` constructs once, so `evaluate("1 000,5 kg", { format: "uk" })`
   * still reads the digits under the engine's own number grammar and prints
   * the answer in Ukrainian. Move the whole engine, not one call, when the
   * input grammar has to move: that is what `EngineOptions.format` is for.
   */
  format?: string;
  /** Per-call time zone, overriding `EngineOptions.timeZone`. */
  timeZone?: string;
  /** Per-call comparison precision, overriding `EngineOptions.comparePrecision`. */
  comparePrecision?: number | "exact";
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

/** Readings kept per mark before truncation. */
const DEFAULT_MAX_READINGS = 3;

export interface ScanOptions extends EvalOptions {
  /** Tokens either side of a mark that are offered as context. Default 4. */
  cueWindow?: number;
  /** Readings kept per mark. Default 3. */
  maxReadings?: number;
  /** The token backoff cap, and the adversarial-input guard. Default 12. */
  maxSpan?: number;
}

export interface MarkReading {
  kind: KindId;
  value: Value;
  formatted: string;
  confidence: number;
}

/**
 * One stretch of the caller's string that reads as a quantity.
 *
 * `start`/`end` index the CALLER's string, like `Result.spans` and never the
 * normalized one, and `text` is `input.slice(start, end)` — carried so a caller
 * never re-slices, and stated because it is the invariant most likely to rot.
 */
export interface Mark {
  start: number;
  end: number;
  text: string;
  /** Ranked, best first. Never empty: a mark with no reading is not emitted. */
  readings: MarkReading[];
  /** Which words biased this mark, and by how much. Empty when none did. */
  cues: CueHit[];
}

export interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
  complete(input: string, opts?: CompleteOptions): Completion[];
  scan(input: string, opts?: ScanOptions): Mark[];
}

/**
 * Layer 1: every installed language's own `weights`, merged, later
 * installations winning a key earlier ones also set.
 *
 * Every installed language and not just the format one, which is a decision
 * worth the paragraph. A language pack declares weights to say how its own
 * readings should rank — that is a claim about its vocabulary, which the
 * engine reads whichever language it prints in, so tying it to `format` would
 * leave a pack unable to bias the readings it contributed unless it happened
 * to win the output slot. It also keeps layer 1 independent of `format`
 * altogether, which is what lets `explain()` reproduce a score that was
 * computed under a per-call `format` override without being handed one:
 * `Σcontributions === score` cannot break on a term neither side can see.
 *
 * `undefined` rather than `{}` when no language declares any, so
 * `weightBreakdown` skips the layer outright. Neither built-in language
 * declares weights today, so this whole function returns `undefined` on every
 * engine in the repo — which is exactly why the decision was free to take now
 * and would not have been later.
 */
function languageWeights(locales: readonly Locale[]): Weights | undefined {
  let merged: Weights | undefined;
  for (const locale of locales) {
    const w = locale.language.weights;
    if (w !== undefined) merged = { ...merged, ...w };
  }
  return merged;
}

/**
 * The three weight layers every reading is scored against — language, engine,
 * call — in the order `resolveWeight` sums them. The one formula, shared by
 * `parserFor`/`completerFor` (which need the array to build a fresh stage)
 * and `toExplanation` (which needs it again to reproduce a candidate's score
 * as named rows), so a fourth caller cannot invent a different order.
 */
function weightLayers(
  locales: readonly Locale[],
  opts: EngineOptions,
  call: Weights | undefined,
): (Weights | undefined)[] {
  return [languageWeights(locales), opts.weights, call];
}

/**
 * One instance each of the stages that hold no per-call state, built once and
 * reused across every call `createEngine`'s returned `Engine` receives. The
 * `Parser` and `Completer` are conspicuously missing: both close over a weight
 * layer that `EvalOptions.weights`/`CompleteOptions.weights` can override per
 * call, so `createEngine` builds a fresh one per call instead (`parserFor`,
 * `completerFor`).
 */
function buildStages(opts: EngineOptions, registry: Registry, format: Locale) {
  // Both lists, because lexing is split down exactly the line the phase is
  // about. `locale` is the format one: number grammar, segmentation and the
  // case fold belong to the language the engine speaks (I8). `locales` is
  // every installed one, for the two parts that are many-locale — keywords
  // and spelled numerals — so a bilingual engine reads "5 кг в грамах" and
  // "двадцять два кг" while still writing one language.
  //
  // `weights` is the engine-level layers and only those: a numeral tie is
  // broken inside this stage, which is built once and frozen, so a per-call
  // `EvalOptions.weights` cannot reach it. `weightLayers` with no call layer
  // is the same array `parserFor` builds, minus the slot only a call fills.
  const tokenizer = new Tokenizer({
    locale: format,
    locales: opts.locales,
    weights: weightLayers(opts.locales, opts, undefined),
    registry,
    ...(opts.now === undefined ? {} : { now: opts.now }),
    ...(opts.timeZone === undefined ? {} : { timeZone: opts.timeZone }),
  });
  const solver = new Solver({
    registry,
    ...(opts.maxCandidates === undefined ? {} : { maxCandidates: opts.maxCandidates }),
    ...(opts.ambiguityEpsilon === undefined
      ? {}
      : { ambiguityEpsilon: opts.ambiguityEpsilon }),
    ...(opts.tiebreak === undefined ? {} : { tiebreak: opts.tiebreak }),
  });
  return {
    normalizer: new Normalizer(),
    tokenizer,
    solver,
    // Shares both: scanning a paragraph normalizes and lexes it once, and the
    // `Scanner` only ever calls `solver.all()`, which applies neither
    // `tiebreak` nor `ambiguityEpsilon` — so sharing the configured instance
    // costs nothing and keeps one solver per engine.
    scanner: new Scanner({ tokenizer, solver, registry }),
    evaluator: newEvaluator(opts, registry, format, opts.comparePrecision),
    printer: newPrinter(opts, registry, format),
  };
}

/**
 * The two generation stages, extracted from `buildStages` because `ctxFor`
 * has to build them a second time — once per call that overrides `format` or
 * `comparePrecision` — and two constructor calls spelled out twice is two
 * places for an option to be dropped from one of them.
 *
 * Both are trivially cheap to rebuild: measured at 0.0002 ms and 0.0001 ms
 * against a 780-alias registry, against 0.06 ms for a whole `evaluate`. The
 * `Tokenizer`, at 0.028 ms, is the one that would not be — see
 * `EvalOptions.format` for why it deliberately is not rebuilt.
 */
function newEvaluator(
  opts: EngineOptions,
  registry: Registry,
  format: Locale,
  comparePrecision: number | "exact" | undefined,
): Evaluator {
  return new Evaluator({
    registry,
    locale: format.id,
    ...(opts.kindMeta === undefined ? {} : { kindMeta: opts.kindMeta }),
    ...(opts.rates ? { rates: opts.rates } : {}),
    ...(comparePrecision === undefined ? {} : { comparePrecision }),
  });
}

function newPrinter(opts: EngineOptions, registry: Registry, format: Locale): Printer {
  return new Printer({
    registry,
    locale: format,
    ...(opts.rates ? { rates: opts.rates } : {}),
    ...(opts.rounding === undefined ? {} : { rounding: opts.rounding }),
  });
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
  /**
   * The one locale this call generates in — `EngineOptions.format` resolved,
   * or a per-call `EvalOptions.format` override. It travels with the
   * `evaluator` and `printer` built against it rather than beside them,
   * because a ctx holding one language and stages built for another is
   * exactly the inconsistency `ctxFor`'s spread exists to make impossible.
   */
  format: Locale;
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
 * separate parameters, which is what lets `ctxFor`'s per-call `Evaluator`
 * override (comparison precision) swap one field via a spread rather than
 * every caller here restating both.
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
  const { registry, opts } = ctx;
  // `opts.locales`, not `ctx.format`: layer 1 is every installed language's
  // weights (see `languageWeights`), so these are the same layers scoring
  // used no matter which language this call asked to print in.
  const layers = weightLayers(opts.locales, opts, weights);
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
              // Off the candidate for exactly the reason the folded surface
              // is: it is what scoring matched `locale:` against, and
              // re-deriving it here from the format locale would report rows
              // the score does not contain and omit rows it does.
              locale: c.locale,
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
          ...(a.cueBonus === 0
            ? []
            : [{ selector: "cueBonus", value: a.cueBonus, layer: 0 }]),
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
  const first = opts.locales[0];
  if (first === undefined) throw new Error("createEngine requires at least one locale");

  /**
   * The locale named by `format`, resolved once here so every later use is a
   * lookup that cannot fail. A plain `Error`, not a `SmartputError`, and the
   * reason is `suggest`: it wraps its body in `swallowedAsEmpty`, which turns
   * every `SmartputError` outside `NEVER_SWALLOWED` into `[]`. A misspelled
   * locale id reported as a `SmartputError` would come back from
   * `suggest("5 kg", { format: "zz" })` as "no results", where the truth is
   * "you named a language this engine does not have". This also matches how
   * the arity check above already reports a bad configuration.
   */
  const formatFor = (id: string): Locale => {
    const found = opts.locales.find((l) => l.id === id);
    if (found === undefined) {
      throw new Error(
        `format ${JSON.stringify(id)} is not among the installed locales (${opts.locales
          .map((l) => l.id)
          .join(", ")})`,
      );
    }
    return found;
  };

  const format = formatFor(opts.format ?? first.id);
  const registry = buildRegistry(opts.kinds ?? [], opts.locales);
  const layers = (call?: Weights) => weightLayers(opts.locales, opts, call);
  const stages = buildStages(opts, registry, format);
  const ctx: EngineCtx = {
    registry,
    format,
    evaluator: stages.evaluator,
    printer: stages.printer,
    opts,
  };

  /**
   * The shared generation stages, unless this call asked for a different
   * comparison precision or a different output language — in which case fresh
   * ones, on exactly the reasoning `parserFor` and `completerFor` are built
   * per call: an `Evaluator` and a `Printer` are config holders, and a
   * per-call override is per-call state that the shared instance by
   * definition cannot carry. Both `Object.freeze(this)` in their
   * constructors, so rebuilding is not merely the tidy option — there is no
   * other one.
   *
   * Identity is preserved when nothing overrides, so the common path still
   * hands `toResult` the same instances `buildStages` built, and an override
   * on one call cannot be visible on the next: nothing here is assigned to.
   */
  const ctxFor = (call?: EvalOptions): EngineCtx => {
    if (call?.comparePrecision === undefined && call?.format === undefined) return ctx;
    const callFormat = call.format === undefined ? format : formatFor(call.format);
    return {
      ...ctx,
      format: callFormat,
      // `?? opts.comparePrecision` because this branch is now also reached by
      // a call that overrode only `format`: without it, asking for a language
      // would silently drop the engine's own comparison precision.
      evaluator: newEvaluator(
        opts,
        registry,
        callFormat,
        call.comparePrecision ?? opts.comparePrecision,
      ),
      printer: newPrinter(opts, registry, callFormat),
    };
  };
  // The Parser (and Completer) is rebuilt per call: it closes over the weight
  // layers, and `EvalOptions.weights` is a per-call override.
  const parserFor = (call?: EvalOptions) =>
    new Parser({
      resolver: createResolver({
        registry,
        // Recognition is every installed language; generation is exactly one.
        // The resolver needs both: `locales` decides which readings exist,
        // `format` decides only the case fold and which language a literal is
        // attributed to.
        locales: opts.locales,
        // The engine's format locale, never the call's: `EvalOptions.format`
        // is output-only, and this decides the case fold every surface is
        // looked up under. A per-call fold would change which readings exist,
        // which is not what asking for a different output language means.
        format,
        layers: layers(call?.weights),
      }),
    });
  // `complete()` is handed `CompleteOptions`, which has no `format` — the
  // completer both reads and writes in one language, and giving it a per-call
  // output language without a per-call input language would be half an
  // override. It stays on the engine's format locale.
  const completerFor = (call?: EvalOptions) =>
    new Autocompleter({ registry, locale: format, layers: layers(call?.weights) });
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
      return toResult(program, stages.solver.best(program, call), ctxFor(call));
    },
    suggest(input, call) {
      return swallowedAsEmpty(() => {
        const program = compile(input, call);
        const resultCtx = ctxFor(call);
        return stages.solver
          .all(program, call)
          .map((r) => toResult(program, r, resultCtx));
      });
    },
    coerce(kind, input, call) {
      const resolved = orNoCandidate(input, () => {
        const program = compile(input, call);
        // `kinds` is this method's own — it is what coercion *means*, and it
        // replaces whatever the caller asked for. Every other narrowing on
        // `call` is still the caller's and has to be forwarded, or
        // `coerce(kind, input, { locales })` would silently ignore the filter.
        const kinds = [kind, NUMBER_KIND];
        return {
          program,
          resolution: stages.solver.forKind(program, kind, {
            kinds,
            ...(call?.locales ? { locales: call.locales } : {}),
          }),
        };
      });
      if (resolved.resolution === undefined) throw new NoCandidateError(input, input, []);
      return ctxFor(call).evaluator.run(resolved.program, resolved.resolution).value;
    },
    explain(input, call) {
      const stream = tokenize(input, call);
      const program = parserFor(call).run(stream);
      const assignments = stages.solver.all(program, call);
      // `ctxFor(call)`, not `ctx`: nothing `toExplanation` reads depends on
      // the format locale today, but calling it through the same door every
      // other entry point uses is what keeps that true — and it is also what
      // makes `explain(input, { format: "zz" })` report the bad id rather
      // than quietly explaining under a different language than `evaluate`
      // would have used.
      return toExplanation(
        program,
        stream.tokens,
        assignments,
        call?.weights,
        ctxFor(call),
      );
    },
    complete(input, call) {
      return [...completerFor(call).run(input, call)];
    },
    scan(input, call) {
      const matches = stages.scanner.run(input, parserFor(call), {
        ...(call?.kinds ? { kinds: call.kinds } : {}),
        ...(call?.locales ? { locales: call.locales } : {}),
        ...(call?.timeZone === undefined ? {} : { timeZone: call.timeZone }),
        ...(call?.cues ? { cues: call.cues } : {}),
        cueWindow: call?.cueWindow ?? DEFAULT_CUE_WINDOW,
        maxSpan: call?.maxSpan ?? DEFAULT_MAX_SPAN,
      });
      const resultCtx = ctxFor(call);
      const limit = call?.maxReadings ?? DEFAULT_MAX_READINGS;
      const marks: Mark[] = [];
      for (const match of matches) {
        const readings: MarkReading[] = [];
        for (const resolution of match.resolutions) {
          if (readings.length === limit) break;
          let result: Result;
          try {
            result = toResult(match.program, resolution, resultCtx);
          } catch (e) {
            // Ruling S4, and narrower than the spec's first wording: the
            // READING is dropped, and the mark with it only if nothing
            // survives. `suggest` re-throws this because the caller typed
            // "30 jpy" and deserves to hear "no rate for JPY"; the caller of
            // `scan` did not type the prose, and one unpriced currency in
            // paragraph three must not delete the twelve marks around it.
            if (e instanceof MissingRateError) continue;
            throw e;
          }
          readings.push({
            kind: result.kind,
            value: result.value,
            formatted: result.formatted,
            confidence: result.confidence,
          });
        }
        if (readings.length === 0) continue;
        marks.push({
          start: match.span.start,
          end: match.span.end,
          text: input.slice(match.span.start, match.span.end),
          readings,
          cues: [...match.cues],
        });
      }
      return marks;
    },
  };
}
