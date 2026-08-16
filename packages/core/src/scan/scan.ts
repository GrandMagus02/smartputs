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
  /**
   * The engine's format locale id, needed only to case-fold a `word` token's
   * text the same way `registry.aliasIndex`'s keys were folded when it was
   * built — see `endsOperand` for why an ordinary `.toLowerCase()` is not
   * good enough.
   */
  locale: string;
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
 * True when `token` is something a parsed expression can END on — i.e. its
 * presence right before `sign` makes `sign` binary rather than unary.
 *
 * Two things can make that true, and both have to hold: `token` must abut
 * `sign` with nothing but spaces between them, and `token`'s own type/text
 * must be operand-shaped.
 *
 * The gap check comes first and can veto the type check outright. `lex`
 * silently drops characters it does not recognize — a comma, a full stop —
 * so they exist nowhere in the token stream and can only be seen in the
 * normalized *text* between two tokens' spans. `"5 km, -3 C"` and
 * `"5 km. -3 C"` tokenize identically to `"5 km -3 C"` as far as token TYPES
 * go, but the first two end a clause at the comma/full stop while the third
 * does not — the `-` starts a new quantity in the first two, and continues
 * subtracting from the same one in the third. `cues.ts`'s `broken` reads
 * sentence boundaries out of the same gap for the same reason: the token
 * stream cannot express punctuation, only the source text between spans can.
 * Skipping this check was a real regression the first version of this
 * function shipped with — `"I ran 5 km, -3 C outside"` silently flipped the
 * second mark's sign, the exact defect class this whole rule exists to
 * remove, because `endsOperand` said "km ends an operand" without noticing a
 * comma sat between `km` and the sign.
 *
 * The type check, once the gap is clear: `number`, `literal`, and `rparen`
 * always end an operand — nothing else can follow them to extend the same
 * one. A `word` is *conditional*, and the reason this function needs a
 * `Registry` at all: unit aliases lex as plain `word` tokens the same as any
 * other prose word (`lex.ts`'s token union has no separate "unit" case), so
 * "5 km" is `number` `word`, exactly the same shape as "note -5" is `word`
 * `op`. Only the registry can tell `km` (indexed) from `note` (not) apart.
 * Case-folded with `toLocaleLowerCase(localeId)`, matching exactly how
 * `registry.ts` folded the alias keys it is compared against
 * (`alias.toLocaleLowerCase(localeId)`) and how `Tokenizer`'s own
 * `isUnitAlias` looks them up — a plain `.toLowerCase()` disagrees with that
 * fold for `tr`/`az`/`lt` aliases containing `i`/`I` (`"DAKİKA".toLowerCase()`
 * is `"daki̇ka"`, an index miss; `toLocaleLowerCase("tr")` is `"dakika"`, a
 * hit), and getting this wrong is not a harmless wasted guess: a missed hit
 * makes a genuine unit word look like ordinary prose, which is exactly the
 * shape of bug the gap check above exists to fix, just triggered by a fold
 * mismatch instead of a missing punctuation check.
 */
function endsOperand(
  token: Token | undefined,
  sign: Token,
  text: string,
  registry: Registry,
  localeId: string,
): boolean {
  if (token === undefined) return false;
  if (/\S/.test(text.slice(token.end, sign.start))) return false;
  if (token.type === "number" || token.type === "literal" || token.type === "rparen") {
    return true;
  }
  return (
    token.type === "word" &&
    registry.aliasIndex.has(token.text.toLocaleLowerCase(localeId))
  );
}

/**
 * A token index at which a quantity may begin.
 *
 * A bare unit word is deliberately not one: "the kilometre is a unit" must mark
 * nothing, and an anchor rule that fired on unit words would mark the word
 * `kilometre` as a quantity of one.
 *
 * Three shapes anchor a run:
 * - a `number` or `literal`, the ordinary case;
 * - an `lparen` — a parenthesised expression begins at its paren, never at the
 *   number inside it, or backoff finds "1 + 2" and stops, never trying the run
 *   that also swallows the closing paren and everything after it;
 * - an `op` of `-` in UNARY position: the next token has to be something a
 *   sign can attach to (`number`, `literal`, `lparen`), and the previous
 *   token has to fail `endsOperand` — see that function for why a `word` is
 *   a conditional case rather than an automatic pass, and why the gap
 *   between the two tokens matters as much as their types, and not `+`:
 *   `pratt.ts` has a unary branch for `-` only, so a `+` anchor would never
 *   parse and would cost up to `maxSpan` wasted attempts per `+` in the
 *   input for nothing. (If a unary `+` is ever added to the parser, this is
 *   the line to revisit.) Without the previous-token guard, the binary minus
 *   in "5 - 3 km" would anchor too — backoff would then be free to build the
 *   run "- 3 km" starting mid-subtraction, silently changing what a
 *   *correct* longer match already covers.
 *
 * Two related shapes still lose a sign, and neither is fixable at this
 * layer: "- 2 kg flour" reads as -2kg because there is no lexical way to
 * tell a markdown bullet's "- " from a negation — `engine.evaluate("- 2
 * kg")` already agrees, so scan matching it is the consistent answer, not a
 * bug to chase. And "the min -5 km" reads +5km because `min` genuinely is a
 * registered alias (of `duration`'s minute) sitting where ordinary prose
 * happens to be — `endsOperand` cannot distinguish "the word before the sign
 * IS a unit, used as a unit" from "the word before the sign IS a unit,
 * used as an ordinary noun", because nothing in the token stream marks the
 * difference. Both are real ambiguities of the input, not defects in this
 * function.
 */
function isAnchor(
  tokens: readonly Token[],
  index: number,
  text: string,
  registry: Registry,
  localeId: string,
): boolean {
  const token = tokens[index];
  if (token === undefined) return false;
  if (token.type === "number" || token.type === "literal") return true;
  if (token.type === "lparen") return true;
  if (token.type === "op" && token.op === "-") {
    const next = tokens[index + 1];
    if (next === undefined) return false;
    if (next.type !== "number" && next.type !== "literal" && next.type !== "lparen") {
      return false;
    }
    const previous = tokens[index - 1];
    return !endsOperand(previous, token, text, registry, localeId);
  }
  return false;
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
  private readonly locale: string;

  constructor(cfg: ScannerOptions) {
    this.normalizer = cfg.normalizer ?? new Normalizer();
    this.tokenizer = cfg.tokenizer;
    this.solver = cfg.solver;
    this.registry = cfg.registry;
    this.locale = cfg.locale;
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
      if (!isAnchor(tokens, i, normalized.text, this.registry, this.locale)) {
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

      // `program.root.span` is the span of the parsed EXPRESSION, not of the
      // token run backoff tried: for a parenthesised run "(1 + 2)" the root
      // node's span sits *inside* the parens, since a paren pair contributes
      // no span of its own in the AST it builds. Using it here would report
      // "1 + 2" (or, once trailing tokens are included, drop the parens from
      // the middle of the mark) even though the run that actually parsed
      // spans the parens too. The mark is a claim about the run, not about the
      // node it happened to produce, so its extent has to come from the run's
      // own first and last tokens — `tokens[from]` and `tokens[to - 1]`, both
      // guaranteed to exist by the loop bounds above (`from < to <= limit <=
      // tokens.length`).
      const first = tokens[from];
      const last = tokens[to - 1];
      if (first === undefined || last === undefined) continue;
      const runSpan = { start: first.start, end: last.end };

      return {
        match: {
          span: trimSpan(normalized.source, normalized.mapSpan(runSpan)),
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
