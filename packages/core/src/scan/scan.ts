import { SmartputError } from "../errors";
import type { Registry } from "../kind/registry";
import type { Token } from "../parse/lex";
import { type NormalizedInput, Normalizer } from "../parse/normalize";
import type { Parser, Program } from "../parse/program";
import type { Tokenizer, TokenStream } from "../parse/tokenizer";
import type { Resolution } from "../solve/solver";
import type { Solver } from "../solve/solver-class";
import type { KindId, Span } from "../types";
import { type CueHit, collectCues } from "./cues";

/** Tokens either side of a mark that are offered as context. */
export const DEFAULT_CUE_WINDOW = 4;
/**
 * The longest token run backoff will try, and the reason a pasted paragraph
 * cannot go quadratic. Backoff from one anchor is O(maxSpan) parse attempts
 * over runs of at most `maxSpan` tokens, so with this fixed the whole scan is
 * linear in the input.
 *
 * Twelve rather than a rounder number because the longest thing worth reading
 * as one quantity is a conversion of a sum — "5 km + 3 km in miles" is nine
 * tokens — and a cap has to clear the real cases with room rather than
 * exactly.
 */
export const DEFAULT_MAX_SPAN = 12;

export interface ScannerOptions {
  normalizer?: Normalizer;
  tokenizer: Tokenizer;
  solver: Solver;
  registry: Registry;
}

export interface ScanScope {
  kinds?: KindId[];
  locales?: string[];
  cueWindow?: number;
  maxSpan?: number;
  timeZone?: string;
  /**
   * Cue weights the CALLER supplied, which the ones collected from the text are
   * added to. Not clamped: `CUE_CEILING` bounds what the surrounding words may
   * argue, and a caller who names a kind outright is doing what
   * `EvalOptions.weights` already lets them do.
   */
  cues?: Readonly<Record<KindId, number>>;
}

/**
 * One stretch of the input that parsed, with every reading it earned.
 *
 * Deliberately short of a finished `Mark`: turning a `Resolution` into a
 * formatted reading needs an `Evaluator` and a `Printer`, which are per-call
 * config holders the engine owns. The `Scanner` is the segmenter, and stops
 * where `Solver` stops.
 */
export interface ScanMatch {
  /** Caller-relative, already mapped through `NormalizedInput`. */
  readonly span: Span;
  readonly program: Program;
  /** Ranked, never empty. */
  readonly resolutions: readonly Resolution[];
  readonly cues: readonly CueHit[];
}

/**
 * A token index at which a quantity may begin.
 *
 * A bare unit word is deliberately not one: "the kilometre is a unit" must mark
 * nothing, and an anchor rule that fired on unit words would mark the word
 * `kilometre` as a quantity of one.
 */
function isAnchor(token: Token | undefined): boolean {
  return token !== undefined && (token.type === "number" || token.type === "literal");
}

/**
 * A mark never begins or ends with whitespace.
 *
 * `mapSpan` is exact about which normalized offset corresponds to which source
 * offset, but "exact" and "tight" are different things: normalization deletes
 * characters (the degree sign) and collapses whitespace runs, so the source
 * offset a normalized end maps to can sit one or more spaces past the last
 * character the mark actually claims. `"it was  30  °C  outside"` mapped to
 * `"30  °C "` — correct by `mapSpan`'s contract, wrong as a thing to hand a
 * caller who is going to highlight it.
 *
 * Interior whitespace is untouched: `"30  °C"` keeps its double space, because
 * that is genuinely what the caller wrote between the two tokens of one mark.
 */
function trimSpan(source: string, span: Span): Span {
  let { start, end } = span;
  while (start < end && /\s/.test(source[start] as string)) start += 1;
  while (end > start && /\s/.test(source[end - 1] as string)) end -= 1;
  return { start, end };
}

/**
 * Finds the quantities inside free-form prose.
 *
 * One normalization and one tokenization for the whole input — the `Tokenizer`
 * is the expensive stage, at 0.028 ms against 0.06 ms for a whole `evaluate`,
 * and `foldNumerals`/`foldLiterals` run inside it, so "twenty two kg" is
 * already one number token and "tomorrow" is already a literal by the time the
 * segmenter sees anything.
 */
export class Scanner {
  private readonly normalizer: Normalizer;
  private readonly tokenizer: Tokenizer;
  private readonly solver: Solver;
  private readonly registry: Registry;

  constructor(cfg: ScannerOptions) {
    this.normalizer = cfg.normalizer ?? new Normalizer();
    this.tokenizer = cfg.tokenizer;
    this.solver = cfg.solver;
    this.registry = cfg.registry;
    Object.freeze(this);
  }

  /**
   * `parser` is a positional argument rather than constructor config because it
   * is per-call state: a `Parser` closes over the weight layers, and
   * `EvalOptions.weights` may override them on any single call. Every other
   * stage here is config-only and is built once.
   */
  run(input: string, parser: Parser, opts?: ScanScope): ScanMatch[] {
    const normalized = this.normalizer.run(input);
    // Unlike `evaluate`, empty is an answer rather than an error: scan is
    // handed prose it did not ask for, and "nothing in it" is a legal result.
    if (normalized.empty) return [];
    const stream = this.tokenizer.run(
      normalized,
      opts?.timeZone === undefined ? undefined : { timeZone: opts.timeZone },
    );
    const tokens = stream.tokens;
    const window = opts?.cueWindow ?? DEFAULT_CUE_WINDOW;
    const maxSpan = opts?.maxSpan ?? DEFAULT_MAX_SPAN;

    const out: ScanMatch[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isAnchor(tokens[i])) {
        i += 1;
        continue;
      }
      const found = this.matchAt(tokens, normalized, parser, i, window, maxSpan, opts);
      if (found === undefined) {
        i += 1;
        continue;
      }
      out.push(found.match);
      // Resuming past the winning run is what makes non-overlap a property of
      // the walk rather than of a later filtering pass — and it is why "3pm in
      // tokyo" is one mark and not two.
      i = found.next;
    }
    return out;
  }

  /**
   * Longest-match backoff from one anchor: try the longest run, drop the last
   * token on failure, retry, down to the anchor alone.
   *
   * It needs no cooperation from the parser because `pratt.ts` already ends
   * with `if (pos !== tokens.length) throw new UnitParseError(input)` — a parse
   * that does not consume its whole token list is already an error, which is
   * exactly the signal backoff reads.
   */
  private matchAt(
    tokens: readonly Token[],
    normalized: NormalizedInput,
    parser: Parser,
    from: number,
    window: number,
    maxSpan: number,
    opts: ScanScope | undefined,
  ): { match: ScanMatch; next: number } | undefined {
    const limit = Math.min(tokens.length, from + maxSpan);
    for (let to = limit; to > from; to -= 1) {
      // `input` is the WHOLE NormalizedInput, never a sliced one: token offsets
      // stay relative to the entire string, so `mapSpan` maps a mark back to
      // the caller's original exactly as it does for `evaluate`.
      const sub: TokenStream = { input: normalized, tokens: tokens.slice(from, to) };
      let program: Program;
      try {
        program = parser.run(sub);
      } catch (e) {
        // A run that is not a quantity is the ordinary case here, not a
        // failure. Anything that is not one of the library's own errors is a
        // bug in the pipeline and keeps its stack.
        if (e instanceof SmartputError) continue;
        throw e;
      }

      const { hits, weights } = collectCues({
        tokens,
        from,
        to,
        input: normalized,
        registry: this.registry,
        window,
      });

      // The caller's own cues are a floor the collected ones build on, so
      // `scan(text, { cues })` is not silently dropped — see ScanScope.cues.
      const merged: Record<KindId, number> = { ...opts?.cues };
      for (const [kind, weight] of Object.entries(weights)) {
        merged[kind] = (merged[kind] ?? 0) + weight;
      }

      let resolutions: readonly Resolution[];
      try {
        resolutions = this.solver.all(program, {
          ...(opts?.kinds ? { kinds: opts.kinds } : {}),
          ...(opts?.locales ? { locales: opts.locales } : {}),
          cues: merged,
        });
      } catch (e) {
        if (e instanceof SmartputError) continue;
        throw e;
      }
      if (resolutions.length === 0) continue;

      return {
        match: {
          span: trimSpan(normalized.source, normalized.mapSpan(program.root.span)),
          program,
          resolutions,
          cues: hits,
        },
        next: to,
      };
    }
    return undefined;
  }
}
