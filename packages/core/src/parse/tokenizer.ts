import type { Registry } from "../kind/registry";
import type { Locale, MatchCtx } from "../types";
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
  locale: Locale;
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
  private readonly registry: Registry;
  private readonly now: () => number;
  private readonly timeZone: string;
  private readonly normalizer: Normalizer;

  constructor(cfg: TokenizerOptions) {
    this.locale = cfg.locale;
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

    const lexed = lex(normalized.text, this.locale);
    const matchCtx: MatchCtx = {
      locale: this.locale.id,
      now: this.now(),
      timeZone: opts?.timeZone ?? this.timeZone,
      isUnitAlias: (text) =>
        this.registry.aliasIndex.has(text.toLocaleLowerCase(this.locale.id)),
    };
    const tokens = foldWordOps(
      foldNumerals(
        foldLiterals(lexed, normalized.text, this.registry, matchCtx),
        this.locale,
      ),
    );

    return Object.freeze({
      input: normalized,
      tokens: Object.freeze(tokens) as readonly Token[],
    });
  }
}
