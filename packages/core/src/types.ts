import type { Decimal } from "./decimal";

export type KindId = string;
export type OpSymbol = "+" | "-" | "*" | "/" | "in" | "of";
/**
 * The keys of `Locale.keywords`, not the surface words. A locale lists every
 * word that means conversion under `in` (English: "in", "to", "as"), and
 * `keywordFor` returns the key — so "to" and "as" are values, never keys, and
 * a `Keyword` of "to" is unreachable by construction.
 */
export type Keyword = "in" | "of";

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

export interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number | Decimal>;
  affine?: { deltaKind: KindId };
}

export interface OpaqueSpec {
  mode: "opaque";
  parse: (token: string, ctx: EvalCtx) => unknown | null;
  equals: (a: unknown, b: unknown) => boolean;
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
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}

export interface NumberFormatSpec {
  group: string;
  decimal: string;
}

export interface Locale {
  id: string;
  numberFormat: "intl" | NumberFormatSpec;
  segment?: (run: string) => string[];
  analyze?: Analyzer[];
  numerals?: (word: string) => Decimal | null;
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
