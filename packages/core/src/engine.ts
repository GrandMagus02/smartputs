import { type CompleteOptions, type Completion, complete } from "./complete/complete";
import {
  AmbiguityError,
  NoCandidateError,
  SmartputError,
  UnitParseError,
} from "./errors";
import { evaluateNode } from "./eval/evaluate";
import { formatValue } from "./format/format";
import { buildRegistry, NUMBER_KIND } from "./kind/registry";
import { createResolver } from "./parse/candidates";
import { lex, type Token } from "./parse/lex";
import { normalize } from "./parse/normalize";
import { parse } from "./parse/pratt";
import { type Assignment, solve } from "./solve/solver";
import { weightBreakdown } from "./solve/weights";
import type {
  Candidate,
  Kind,
  KindId,
  Locale,
  LocalePack,
  ResultCandidate,
  Span,
  Value,
  Weights,
} from "./types";

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
}

export interface EvalOptions {
  kinds?: KindId[];
  weights?: Weights;
}

export interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;
  spans: Span[];
  meta: { assumptions: string[] };
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
    const tokens = lex(normalized, locale as Locale);
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
    const { value, assumptions } = evaluateNode(
      node,
      assignment,
      registry,
      (locale as Locale).id,
      input,
      kindMeta,
    );
    return {
      value,
      formatted: formatValue(value, registry, locale as Locale),
      kind: value.kind,
      confidence: assignment.confidence,
      spans: [node.span],
      meta: { assumptions },
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
        // Only the library's own errors mean "this input has no interpretation".
        // A TypeError from a bug in the pipeline must keep its stack rather than
        // masquerade as an empty result.
        if (e instanceof SmartputError) return [];
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
      return evaluateNode(node, best, registry, locale.id, input, kindMeta).value;
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
                }),
                { selector: "analyzer", value: c.analyzerWeight, layer: 0 },
              ]),
              { selector: "contextBonus", value: a.contextBonus, layer: 0 },
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
