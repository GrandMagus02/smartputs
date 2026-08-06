import { type CompleteOptions, type Completion, complete } from "./complete/complete";
import type { Decimal } from "./decimal";
import {
  AmbiguityError,
  KindConflictError,
  MissingRateError,
  NoCandidateError,
  SmartputError,
  UnitParseError,
  UnknownKindError,
} from "./errors";
import { evaluateNode } from "./eval/evaluate";
import { formatValue } from "./format/format";
import { buildRegistry, NUMBER_KIND } from "./kind/registry";
import { createResolver } from "./parse/candidates";
import { lex, type Token } from "./parse/lex";
import { foldLiterals } from "./parse/literals";
import { normalize } from "./parse/normalize";
import { foldNumerals } from "./parse/numerals";
import { parse } from "./parse/pratt";
import { foldWordOps } from "./parse/wordops";
import { type Assignment, solve } from "./solve/solver";
import { weightBreakdown } from "./solve/weights";
import type {
  Assumption,
  Candidate,
  Kind,
  KindId,
  Locale,
  LocalePack,
  MatchCtx,
  RateLookup,
  ResultCandidate,
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

export function createEngine(opts: EngineOptions): Engine {
  const locale = opts.locales[0];
  if (locale === undefined) throw new Error("createEngine requires at least one locale");

  const packs = opts.packs ?? [];
  const kinds = opts.kinds ?? [];
  const registry = buildRegistry(kinds, packs, locale.id);
  const maxCandidates = opts.maxCandidates ?? 10_000;
  const epsilon = opts.ambiguityEpsilon ?? 0.05;
  const tiebreak = opts.tiebreak ?? "error";
  const kindMeta = opts.kindMeta ?? {};
  const formatPrecision = opts.formatPrecision;
  const rates = opts.rates;
  const rounding = opts.rounding;
  const now = opts.now ?? (() => Date.now());
  const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone = opts.timeZone ?? hostZone;

  const layersFor = (call?: Weights) => [locale.weights, opts.weights, call];

  function pipeline(input: string, call?: EvalOptions) {
    const normalized = normalize(input);
    if (normalized.length === 0) throw new UnitParseError(input);
    const resolver = createResolver({
      registry,
      locale: locale as Locale,
      packs,
      layers: layersFor(call?.weights),
    });
    const lexed = lex(normalized, locale as Locale);
    const matchCtx: MatchCtx = {
      locale: (locale as Locale).id,
      now: now(),
      timeZone: call?.timeZone ?? timeZone,
      isUnitAlias: (text) =>
        registry.aliasIndex.has(text.toLocaleLowerCase((locale as Locale).id)),
    };
    const tokens = foldWordOps(
      foldNumerals(foldLiterals(lexed, normalized, registry, matchCtx), locale as Locale),
    );
    const node = parse(tokens, resolver, input);
    const assignments = solve(node, registry, {
      maxCandidates,
      input,
      ...(call?.kinds ? { kinds: call.kinds } : {}),
    });
    return { normalized, resolver, tokens, node, assignments };
  }

  function toResult(
    node: ReturnType<typeof pipeline>["node"],
    assignment: Assignment,
    input: string,
  ): Result {
    const { value, assumptions } = evaluateNode({
      node,
      assignment,
      registry,
      locale: (locale as Locale).id,
      input,
      kindMeta,
      ...(rates ? { rates } : {}),
    });
    return {
      value,
      formatted: formatValue(value, registry, locale as Locale, {
        ...(formatPrecision === undefined ? {} : { precision: formatPrecision }),
        ...(rounding === undefined ? {} : { rounding }),
        ...(rates ? { rates } : {}),
      }),
      kind: value.kind,
      confidence: assignment.confidence,
      spans: [node.span],
      meta: {
        assumptions,
        ...(rates ? { ratesAsOf: rates.asOf } : {}),
      },
    };
  }

  return {
    evaluate(input, call) {
      const { node, assignments } = pipeline(input, call);
      const [best, second] = assignments;
      if (best === undefined) throw new SmartputError("No interpretation", input);

      if (
        tiebreak === "error" &&
        second !== undefined &&
        Math.abs(best.confidence - second.confidence) < epsilon
      ) {
        const listed: ResultCandidate[] = assignments.slice(0, 5).map((a) => ({
          kind: a.kind,
          unit: [...a.choices.values()][0]?.unit ?? "",
          confidence: a.confidence,
        }));
        throw new AmbiguityError(input, listed, [node.span]);
      }

      return toResult(node, best, input);
    },

    suggest(input, call) {
      try {
        const { node, assignments } = pipeline(input, call);
        return assignments.map((a) => toResult(node, a, input));
      } catch (e) {
        // Only the library's own errors mean "this input has no interpretation",
        // and not even all of those — see NEVER_SWALLOWED. A TypeError from a
        // bug in the pipeline must keep its stack rather than masquerade as an
        // empty result.
        if (e instanceof SmartputError && !NEVER_SWALLOWED.some((C) => e instanceof C)) {
          return [];
        }
        throw e;
      }
    },

    coerce(kind, input, call) {
      const merged: EvalOptions = { ...call, kinds: [kind, NUMBER_KIND] };
      let assignments: Assignment[];
      let node: ReturnType<typeof pipeline>["node"];
      try {
        const run = pipeline(input, merged);
        assignments = run.assignments;
        node = run.node;
      } catch (e) {
        if (e instanceof NoCandidateError) throw e;
        // Same rule as suggest: never convert a genuine bug into "no candidate".
        if (!(e instanceof SmartputError)) throw e;
        throw new NoCandidateError(input, input, []);
      }
      const best = assignments.find((a) => a.kind === kind);
      if (best === undefined) throw new NoCandidateError(input, input, []);
      return evaluateNode({
        node,
        assignment: best,
        registry,
        locale: locale.id,
        input,
        kindMeta,
        ...(rates ? { rates } : {}),
      }).value;
    },

    explain(input, call) {
      const { tokens, assignments } = pipeline(input, call);
      const candidates: Candidate[] = [];
      for (const assignment of assignments) {
        for (const candidate of assignment.choices.values()) {
          if (
            !candidates.some(
              (c) => c.kind === candidate.kind && c.unit === candidate.unit,
            )
          ) {
            candidates.push(candidate);
          }
        }
      }

      return {
        input,
        tokens,
        candidates,
        assignments: assignments.map((a) => {
          const chosen = [...a.choices.values()];
          return {
            kind: a.kind,
            score: a.score,
            confidence: a.confidence,
            units: chosen.map((c) => c.unit),
            // Every summand of `score` gets a row, so Σcontributions === score.
            contributions: [
              ...chosen.flatMap((c) => [
                ...weightBreakdown({
                  kind: c.kind,
                  unit: c.unit,
                  // The folded surface is what `token:` selectors matched during
                  // scoring; passing the raw one would drop rows silently.
                  surface: c.foldedSurface,
                  prior: registry.kinds.get(c.kind)?.prior ?? 0,
                  layers: layersFor(call?.weights),
                  // Only a corrected reading carries one, and it is what puts
                  // the `fuzzy:` row in the list. Dropping it here would leave
                  // the rows short of the score by exactly the penalty.
                  ...(c.fuzzy ? { fuzzy: c.fuzzy } : {}),
                }),
                { selector: "analyzer", value: c.analyzerWeight, layer: 0 },
              ]),
              { selector: "contextBonus", value: a.contextBonus, layer: 0 },
              // Unlike contextBonus, emitted only when non-zero: no built-in
              // signature carries a weight, so an unconditional row would add
              // a `signature: 0` line to every explanation in the repo to say
              // nothing. The sum invariant holds either way, 0 being 0.
              ...(a.signatureWeight === 0
                ? []
                : [{ selector: "signature", value: a.signatureWeight, layer: 0 }]),
            ],
          };
        }),
      };
    },

    complete(input, call) {
      return complete({
        registry,
        locale: locale as Locale,
        layers: layersFor(call?.weights),
        input,
        ...(call ? { opts: call } : {}),
      });
    },
  };
}
