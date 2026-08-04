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
}

export type Lexicon = Record<string, UnitLexeme | string[]>;

export interface EvalCtx {
  readonly self: Value;
  readonly locale: string;
  /**
   * The source expression being evaluated. Present while evaluating a parsed
   * expression; absent during a standalone conversion (`toCanonical`/`fromCanonical`),
   * which has no expression of its own to report.
   */
  readonly input?: string;
}

export interface FormatCtx {
  readonly locale: string;
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
  assumption?: string;
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
