import { deepFreeze } from "../freeze";
import type { Registry } from "../kind/registry";
import { buildKeywords } from "../locale/compose";
import type { Keyword, Locale, MatchCtx, Weights } from "../types";
import { lex, type Token } from "./lex";
import { foldLiterals } from "./literals";
import { type NormalizedInput, Normalizer } from "./normalize";
import { foldNumerals } from "./numerals";
import { foldWordOps } from "./wordops";

export interface TokenStream {
  readonly input: NormalizedInput;
  readonly tokens: readonly Token[];
}

export interface TokenizerOptions {
  /**
   * The format locale — number grammar, segmentation and the case fold, all
   * of which belong to the one language the engine speaks (I8).
   */
  locale: Locale;
  /**
   * Every installed locale, for the two parts of lexing that are many-locale:
   * keywords and spelled numerals. Defaults to `[locale]`, so a caller who
   * has one language keeps today's behaviour without naming it twice.
   */
  locales?: readonly Locale[];
  /**
   * Weight layers, read only to break a tie between two languages claiming
   * the same word run as a number. Engine-level layers only — see
   * `foldNumerals` for why a stage frozen at construction cannot see a
   * per-call one.
   */
  weights?: readonly (Weights | undefined)[];
  registry: Registry;
  /** Injectable clock, epoch milliseconds. Called once per `run()`, never at
   * construction — a long-lived `Tokenizer` must not freeze its own clock. */
  now?: () => number;
  /** IANA time zone every literal matcher resolves against by default. */
  timeZone?: string;
}

/**
 * Lexing plus the three fold passes, which today are four separate calls with
 * different argument shapes (spec §4.2). `MatchCtx` is built here, inside
 * `run()`, rather than in the engine closure that was its only caller before
 * this stage existed.
 *
 * The underlying functions stay exported and unchanged: a caller who wants
 * numerals folded but not word operators composes `lex`, `foldLiterals`,
 * `foldNumerals` and `foldWordOps` directly.
 */
export class Tokenizer {
  private readonly locale: Locale;
  private readonly locales: readonly Locale[];
  private readonly keywords: ReadonlyMap<string, Keyword>;
  private readonly weights: readonly (Weights | undefined)[];
  private readonly registry: Registry;
  private readonly now: () => number;
  private readonly timeZone: string;
  private readonly normalizer: Normalizer;

  constructor(cfg: TokenizerOptions) {
    this.locale = cfg.locale;
    this.locales = cfg.locales ?? [cfg.locale];
    // Folded here and not per `run()`: it is a pure function of the installed
    // languages, and it is also where a keyword collision is reported, so
    // building it in the constructor is what makes a bad configuration fail
    // where the stack names the line that wired it (I9).
    this.keywords = buildKeywords(this.locales);
    this.weights = cfg.weights ?? [];
    this.registry = cfg.registry;
    this.now = cfg.now ?? (() => Date.now());
    this.timeZone = cfg.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    // A string input needs normalizing before it can be lexed; a caller who
    // wants different NormalizerOptions normalizes themselves and passes the
    // NormalizedInput in directly.
    this.normalizer = new Normalizer();
    Object.freeze(this);
  }

  run(input: string | NormalizedInput, opts?: { timeZone?: string }): TokenStream {
    const normalized = typeof input === "string" ? this.normalizer.run(input) : input;

    // Built before `lex` rather than after it, because `lex` now reads
    // `isUnitAlias` too: ruling R-B1 asks whether some installed vocabulary
    // spells a unit `in` before it will re-lex the conversion keyword as one.
    // One context, one registry query, two readers.
    const matchCtx: MatchCtx = {
      locale: this.locale.id,
      now: this.now(),
      timeZone: opts?.timeZone ?? this.timeZone,
      isUnitAlias: (text) =>
        this.registry.aliasIndex.has(text.toLocaleLowerCase(this.locale.id)),
    };
    const lexed = lex(normalized.text, this.locale, this.keywords, matchCtx.isUnitAlias);
    const tokens = foldWordOps(
      foldNumerals(
        foldLiterals(lexed, normalized.text, this.registry, matchCtx),
        this.locales,
        this.weights,
      ),
    );

    return Object.freeze({
      input: normalized,
      // `Object.freeze` alone freezes the array but not each `Token` inside
      // it — every other stage deep-freezes, and `Parser.run`'s `[...stream
      // .tokens]` copies the array, not its elements, so a mutable token
      // would still be read downstream. `deepFreeze` closes that gap.
      tokens: deepFreeze(tokens) as readonly Token[],
    });
  }
}
