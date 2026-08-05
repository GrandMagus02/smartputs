import type { Decimal } from "./decimal";

export type KindId = string;
export type OpSymbol = "+" | "-" | "*" | "/" | "in" | "of";
/**
 * The keys of `Locale.keywords`, not the surface words. A locale lists every
 * word that means conversion under `in` (English: "in", "to", "as"), and
 * `keywordFor` returns the key — so "to" and "as" are values, never keys, and
 * a `Keyword` of "to" is unreachable by construction.
 *
 * `plus`, `minus`, `times` and `over` are rewritten into op tokens before the
 * parser runs. `by` exists only to be swallowed by one of those four, so that
 * "divided by" is a single operator; anywhere else it reaches the parser
 * unconsumed and fails, exactly as a stray "as" does.
 */
export type Keyword = "in" | "of" | "plus" | "minus" | "times" | "over" | "by";

export interface Span {
  start: number;
  end: number;
}

export interface Value {
  readonly kind: KindId;
  readonly canonical: Decimal;
  readonly unit: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface Candidate {
  readonly kind: KindId;
  readonly unit: string;
  readonly weight: number;
  /** The surface form exactly as typed. */
  readonly surface: string;
  /** Case-folded `surface`. This, not `surface`, is what `token:` selectors match. */
  readonly foldedSurface: string;
  /** Lemma the analyzer chain produced for `surface`. */
  readonly form: string;
  /** Weight the analyzer chain attached to `form`; a summand of `weight`. */
  readonly analyzerWeight: number;
}

export interface AnalyzedForm {
  form: string;
  weight?: number;
  tags?: string[];
}

export interface AnalyzeCtx {
  locale: string;
}

export type Analyzer = (surface: string, ctx: AnalyzeCtx) => AnalyzedForm[];

export type Selector = string;
export type Weights = Record<Selector, number>;

export interface UnitLexeme {
  aliases: string[];
  symbol?: string;
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /**
   * The magnitude band people actually type this unit in, inclusive at both
   * ends. Read only by completion's `scaleFit`. Omitting it scores 0, which is
   * the same as being out of band — declaring a band is never a penalty.
   */
  typical?: [number, number];
}

export type Lexicon = Record<string, UnitLexeme | string[]>;

/**
 * The shape the engine needs from a rate table, declared here rather than
 * imported: `@smartput/rates`'s `RateSnapshot` satisfies it structurally, and
 * core stays free of a dependency on a package that depends on core.
 *
 * `get` returns null for an unknown pair rather than throwing, so the kind that
 * asked decides what a missing rate means. The money kind raises
 * MissingRateError; a different kind might fall back.
 */
export interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}

export interface EvalCtx {
  readonly self: Value;
  readonly locale: string;
  /**
   * The source expression being evaluated. Present while evaluating a parsed
   * expression; absent during a standalone conversion (`toCanonical`/`fromCanonical`),
   * which has no expression of its own to report.
   */
  readonly input?: string;
  /** The engine's injected rate table, when one was supplied. */
  readonly rates?: RateLookup;
  /**
   * Records an assumption made while converting. Supplied by the evaluator;
   * absent during a standalone conversion, which has no Result to attach to.
   */
  readonly note?: (a: Assumption) => void;
}

/**
 * A defensible-but-not-unique reading of the input, surfaced on the Result.
 *
 * `code` is stable and machine-readable — a UI branches on it, a test asserts
 * it. `message` is human-facing and may be reworded freely. `detail` carries
 * the specifics: which currencies, which pivot.
 */
export interface Assumption {
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, string>>;
}

export interface FormatOptions {
  /** Significant digits to display. Defaults to 26. */
  readonly precision?: number;
  /** Rounding mode. Defaults to Decimal's configured mode. */
  readonly rounding?: Decimal.Rounding;
  /** FX rates, threaded through so a money value can format back into its authored currency. */
  readonly rates?: RateLookup;
  /**
   * Pad the fraction to at least this many digits. A Decimal has no notion of
   * a trailing zero, so significant-digit formatting alone cannot express a
   * fixed scale: money needs "30.00", not "30".
   */
  readonly minFractionDigits?: number;
}

export interface FormatCtx extends FormatOptions {
  readonly locale: string;
  /**
   * `value.canonical` already converted into `value.unit`. A hook that wants
   * the number the user typed wants this, not `value.canonical` — and it means
   * a hook never has to resolve a unit ratio, which for money would mean
   * reaching the rate table from inside the formatter.
   */
  readonly authored: Decimal;
  /**
   * The locale-aware number formatter, pre-bound to this locale. Hooks MUST
   * render through it: M2 rejected a per-kind hook precisely because it
   * formatted by hand and silently dropped locale grouping and the locale
   * decimal separator.
   */
  formatNumber(value: Decimal, opts?: FormatOptions): string;
}

export interface UnitDef {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;
  aliases?: string[];
}

/**
 * What a kind's literal matcher claims from the source string.
 *
 * The matcher returns a finished `Value` rather than a payload the engine would
 * have to interpret: the engine has no idea what a date is, and giving it one
 * would be a second value model beside `Value`. `canonical` is whatever scalar
 * the kind orders and subtracts by — epoch nanoseconds for `datetime` — and
 * anything that is not a scalar rides on `meta`, which every value already has.
 */
export interface LiteralMatch {
  readonly kind: KindId;
  /** A unit registered by the kind. Never a free-form string. */
  readonly unit: string;
  readonly canonical: Decimal;
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Characters consumed starting at the offered offset. Must be > 0. */
  readonly length: number;
  /** Summed into the candidate's score, exactly like an analyzer's weight. */
  readonly weight?: number;
}

/**
 * Everything a matcher may read about the call. Deliberately not the whole
 * engine: a matcher that could reach the registry could rewrite it.
 */
export interface MatchCtx {
  readonly locale: string;
  /** Epoch milliseconds of "now", from `EngineOptions.now`. */
  readonly now: number;
  /** IANA time zone, from `EvalOptions.timeZone ?? EngineOptions.timeZone`. */
  readonly timeZone: string;
  /**
   * True when `text` is a registered unit alias of any kind. The one piece of
   * registry knowledge a matcher needs, and the reason `"10 m"` does not become
   * a date — see the plan's ruling R4.
   */
  isUnitAlias(text: string): boolean;
}

/**
 * Offered the whole normalized input and an offset that is always a token
 * boundary. Returns null for "not mine". A match that does not end on a token
 * boundary is discarded by the fold, so a matcher never has to align itself.
 */
export type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | null;

export interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number | Decimal>;
  affine?: { deltaKind: KindId };
  /**
   * Names the unit whose ratio is a function of `meta.dpi` — `measure`'s `px`,
   * and nothing else today. Declaring it is what gives a facade of this kind
   * the `.dpi` getter and the `withDpi()` method; a kind that does not declare
   * it gets neither.
   *
   * Explicit opt-in rather than inference: the facade used to look for "the
   * first unit with a function ratio", which was a sound proxy for `px` only
   * while `measure` was the only kind with one. `money` has twelve, so its
   * quantities acquired a `withDpi()` that wrote into a `meta` nothing reads,
   * and a `.dpi` getter that threw `MissingRateError`.
   */
  dpiUnit?: string;
}

export interface OpaqueSpec {
  mode: "opaque";
  /**
   * The kind's units as a lexicon. An opaque unit is a *label*, not a ratio —
   * `datetime`'s units are IANA time zones — but it is indexed, weighted,
   * formatted and used as an `in` target exactly like a ratio kind's unit.
   */
  units?: Record<string, UnitLexeme | string[]>;
  /** Single-token recognition. Superseded by `Kind.literals` for anything multi-token. */
  parse?: (token: string, ctx: EvalCtx) => unknown | null;
  equals?: (a: unknown, b: unknown) => boolean;
}

export interface OpSignature {
  op: OpSymbol;
  left: KindId;
  right: KindId;
  result: KindId;
  /**
   * Recorded on the Result whenever this signature is applied. For operations
   * that are defensible but not the only reading of the input — "20C + 5C"
   * treats the right operand as a difference, because the alternative is
   * meaningless rather than because the user said so.
   */
  assumption?: Assumption;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}

export interface Kind {
  id: KindId;
  value: RatioSpec | OpaqueSpec;
  extendsKind?: KindId;
  prior?: number;
  lexicon?: Lexicon;
  literals?: LiteralMatcher[];
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

export interface NumberFormatSpec {
  group: string;
  decimal: string;
}

export interface NumeralMatch {
  value: Decimal;
  /** How many of the offered words the parser claimed, counting from the front. */
  consumed: number;
}

/**
 * Offered a run of consecutive words, claims a prefix of it. The single-word
 * signature this replaced could not express "one thousand thirty two": it saw
 * one word and had no way to ask for more.
 */
export type NumeralParser = (words: string[]) => NumeralMatch | null;

export interface Locale {
  id: string;
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];
  analyze?: Analyzer[];
  numerals?: NumeralParser;
  keywords: Partial<Record<Keyword, string[]>>;
  weights?: Weights;
}

export interface LocalePack {
  locale: string;
  contributes: Record<KindId, Lexicon>;
  analyze?: Analyzer[];
}

export interface ResultCandidate {
  kind: KindId;
  unit: string;
  confidence: number;
}
