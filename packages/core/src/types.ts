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
 * imported: `@smartput/rate`'s `RateSnapshot` satisfies it structurally, and
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

/**
 * What a `place` Value carries on `meta`, declared here for the same reason as
 * `RateLookup`: `@smartput/geo` produces it and the datetime and money kinds
 * read it, so the contract lives in the one package all three already depend on
 * and none of them imports another.
 *
 * The rejected alternative was injecting a `PlaceLookup` into datetime, which
 * would have made datetime's construction depend on geo being present to serve
 * a case that a plain string on `meta` already covers: the datetime bridge
 * reads `zone`, the money bridge reads `currency`, and neither needs to know
 * what a city is.
 */
export interface PlaceMeta {
  /** GeoNames feature id. Stable, and the Value's canonical. */
  readonly geonameId: number;
  /**
   * The place's own display name — "Japan", "Athens", "Los Angeles".
   *
   * Here rather than left to the formatter to look up, because the lookup a
   * formatter could do is by `country`, and that returns the *country's* name
   * for a city: it rendered "athens" as "Greece — … 11M" while this same meta
   * said 664,046. A city table big enough to answer the question properly is
   * the one thing the formatter must not import, since reaching it statically
   * links the whole gazetteer into every bundle.
   */
  readonly name: string;
  /** IANA zone. Always present: a country carries its capital's zone. */
  readonly zone: string;
  /** ISO 4217. Present on countries; on a city, its country's. */
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
  /** ISO 3166-1 alpha-2, lowercased. Equals the Value's `unit`. */
  readonly country: string;
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
  /**
   * Opt-in: this claim may stand as the *target* of a conversion — "3pm in
   * japan", where the right operand is a claimed value rather than a unit
   * label, and the signature that receives it reads its `meta`.
   *
   * Off by default, and deliberately not inferred from "the kind has a literal
   * matcher". Datetime claims "tomorrow" as a value, so an inferred rule made
   * `today in tomorrow` a legal zone conversion that quietly returned today
   * instead of the `UnitParseError` it had always thrown. A target is a
   * narrower thing than a value, and only the kind knows which of its claims
   * are one.
   */
  readonly targetable?: boolean;
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
 * One reading of a span the fold has already settled.
 *
 * `LiteralMatch` without `length` — by the time the fold has grouped the
 * matches that reach the same end, the span is a property of the group and no
 * longer of the reading — and with `weight` defaulted, so nothing downstream
 * has to spell `?? 0` again.
 */
export interface LiteralReading {
  readonly kind: KindId;
  readonly unit: string;
  readonly canonical: Decimal;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly weight: number;
  readonly targetable?: boolean;
}

/**
 * Offered the whole normalized input and an offset that is always a token
 * boundary. Returns null for "not mine". A match that does not end on a token
 * boundary is discarded by the fold, so a matcher never has to align itself.
 *
 * An array is several readings of the SAME text, not several spans: the other
 * Athens, the other Springfield, both Congos. The fold keeps whichever readings
 * reach the furthest end and hands all of them to the solver as candidates, so
 * a matcher that has ranked its hits should return them ranked and stop there —
 * returning only the winner is what made `suggest("springfield")` a list of
 * one, and dropping the ranking would ask the solver to redo a decision it has
 * no information for.
 *
 * Returning the single object stays legal and means exactly what it always did.
 */
export type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | readonly LiteralMatch[] | null;

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

/**
 * Everything a completer may read about the keystroke. Deliberately not the
 * whole input: a completer answers "what could this word become", and the words
 * before it are the parser's business, not a lexicon's.
 *
 * The fragment arrives folded because completion has already folded it to search
 * the alias index, and a completer that folded the raw text again would be a
 * second answer to "does this alias match" — drifting the day one of the two
 * learns about a script the other does not.
 */
export interface CompleteCtx {
  readonly locale: string;
  /** The trailing fragment, NFKC-folded and lowercased — what the user is typing. */
  readonly fragment: string;
  /** The number in front of the fragment, when there is one. */
  readonly count?: Decimal;
  /**
   * The whole input, and where `fragment` sits in it.
   *
   * A completer needs both because the fragment is one word and a name is not:
   * "san fran" hands over `fragment` "fran", and a completer that can see no
   * further offers "France" — which core then splices back as "san France", a
   * place that does not exist. Looking behind the fragment is the only way to
   * know the word before it was part of the name being typed.
   */
  readonly input: string;
  readonly span: Span;
}

/**
 * One row a kind offers for the fragment being typed.
 *
 * `text` is the replacement and not a template, which is the whole difference
 * from the alias-index path: that path splices "<the count already typed> <the
 * unit's plural display form>", and a place is not a quantity. "Kyiv" is the
 * answer; there is no count for it to agree with and no word to pluralize.
 * Templating with an opt-out flag was the alternative, and it says the same
 * thing twice — a kind that wants the templated form gets it by registering an
 * alias, which is what the index is for.
 */
export interface KindCompletion {
  /** What replaces the fragment. A place supplies a name; nothing is templated. */
  readonly text: string;
  /** The alias that matched, for display and for tie-breaking. */
  readonly alias: string;
  /** A registered unit of the kind. */
  readonly unit: string;
  /** Summed into the score exactly like a weight layer. */
  readonly weight?: number;
  /**
   * De-duplication key within the kind. Defaults to `unit`. Places need it:
   * every US city shares the unit "us", so a unit-keyed map keeps one of them.
   */
  readonly key?: string;
  /**
   * Replace from this offset instead of from the fragment's start, so a row may
   * consume the words *before* what is being typed. "san fran" is one name and
   * has to be replaced as one: without this the row can only rewrite "fran",
   * and "San Francisco" spliced over it reads "san San Francisco".
   *
   * Must be a real offset at or before `ctx.span.start`; a row naming anything
   * else is dropped, on the same reasoning as a row naming an unregistered unit.
   * Core does not check that it falls on a word boundary — the completer chose
   * it from `ctx.input`, and only the completer knows what a word is in its own
   * vocabulary.
   */
  readonly start?: number;
}

/**
 * Called once per keystroke for every registered kind that declares one, and
 * the only way a vocabulary that must stay out of the global alias index can
 * still be completed.
 *
 * That exclusion is not hypothetical: `km` is Comoros and `pm` is Saint Pierre,
 * which is why nothing shorter than four characters is indexed at all, and
 * @smartput/geo's gazetteer is six thousand more names of exactly that kind. A
 * kind in that position keeps its own structure — geo keeps a trie — and this is
 * how what it knows reaches the ranking without core learning what a city is.
 *
 * Return rows already ranked among themselves. Core scores them against every
 * other row and re-sorts, but a tie falls back to this order, so a kind that has
 * ranked its hits should say so here rather than hope the score preserves it.
 */
export type Completer = (ctx: CompleteCtx) => readonly KindCompletion[];

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
  /**
   * Beside `lexicon`, never instead of it. A unit's aliases keep completing
   * through the global index; this is for the names that were never allowed in
   * it, and a kind may declare both.
   */
  completions?: Completer;
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
