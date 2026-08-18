import type { Keyword, KindId, ResultCandidate, Span } from "./types";

export class SmartputError extends Error {
  readonly input: string;
  readonly spans: Span[];

  constructor(message: string, input: string, spans: Span[] = []) {
    super(message);
    // Literal, never `new.target.name`: a minifier renames the class, and
    // `error.name` is a string consumers display and branch on.
    this.name = "SmartputError";
    this.input = input;
    this.spans = spans;
  }
}

export class UnitParseError extends SmartputError {
  readonly kind: KindId | undefined;
  /**
   * `spans` is optional and defaults to empty, so every existing throw site
   * still compiles; the ones that know which token defeated them pass the
   * offending span, and a caller that highlights input gets it for free.
   */
  constructor(input: string, kind?: KindId, spans: Span[] = []) {
    super(`Cannot parse ${JSON.stringify(input)} as a quantity`, input, spans);
    this.name = "UnitParseError";
    this.kind = kind;
  }
}

export class AmbiguityError extends SmartputError {
  readonly candidates: ResultCandidate[];
  constructor(input: string, candidates: ResultCandidate[], spans: Span[] = []) {
    const list = candidates.map((c) => `${c.kind}:${c.unit}`).join(", ");
    super(`${JSON.stringify(input)} is ambiguous between ${list}`, input, spans);
    this.name = "AmbiguityError";
    this.candidates = candidates;
  }
}

export class NoCandidateError extends SmartputError {
  readonly token: string;
  readonly nearest: string[];
  constructor(input: string, token: string, nearest: string[], spans: Span[] = []) {
    const hint = nearest.length > 0 ? `. Did you mean: ${nearest.join(", ")}?` : "";
    super(`Unknown unit ${JSON.stringify(token)}${hint}`, input, spans);
    this.name = "NoCandidateError";
    this.token = token;
    this.nearest = nearest;
  }
}

/**
 * The operands' SOURCE TEXT is what the message quotes, not their kinds alone:
 * "Cannot apply / to mass and duration" sent a reader looking for a duration
 * they never typed, when the truth was that the engine had read their "m" as
 * minutes. Naming the text and then every pair it tried says both halves.
 *
 * `tried` is every (left, right) the solver enumerated and found no signature
 * for, deduplicated, in enumeration order. The old message named one pair —
 * whichever the first failing assignment happened to hold — which is why
 * "10 kg / 2 m" reported mass and duration and read as a bug in the message.
 *
 * The ruling `op` records: it is an `OpSymbol` or `"in"`, and never the string
 * "operation". A message that will not say which operator failed is a message
 * that cannot be acted on.
 *
 * `tried` and `spans` both default, so a throw site that knows neither still
 * compiles and still produces the one-pair message.
 */
export class DimensionMismatchError extends SmartputError {
  readonly left: KindId;
  readonly right: KindId;
  /** An `OpSymbol` or `"in"`. Never the literal "operation". */
  readonly op: string;
  readonly tried: ReadonlyArray<readonly [KindId, KindId]>;
  constructor(
    input: string,
    op: string,
    left: KindId,
    right: KindId,
    tried: ReadonlyArray<readonly [KindId, KindId]> = [[left, right]],
    spans: Span[] = [],
  ) {
    // spans is [left operand, operator, right operand]; the operator's own
    // span is skipped because `op` already spells it.
    const [leftSpan, , rightSpan] = spans;
    const quote = (s: Span | undefined): string | undefined =>
      s === undefined ? undefined : `\`${input.slice(s.start, s.end)}\``;
    const quotedLeft = quote(leftSpan);
    const quotedRight = quote(rightSpan);
    const operands =
      quotedLeft !== undefined && quotedRight !== undefined
        ? `${quotedLeft} and ${quotedRight}`
        : `${left} and ${right}`;
    const pairs = tried.map(([a, b]) => `${a} ${op} ${b}`);
    const listed =
      pairs.length <= 1
        ? (pairs[0] ?? `${left} ${op} ${right}`)
        : `${pairs.slice(0, -1).join(", ")} or ${pairs[pairs.length - 1]}`;
    super(`Cannot apply ${op} to ${operands}: no signature for ${listed}`, input, spans);
    this.name = "DimensionMismatchError";
    this.op = op;
    this.left = left;
    this.right = right;
    this.tried = tried;
  }
}

export class TooAmbiguousError extends SmartputError {
  readonly count: number;
  constructor(input: string, count: number, max: number) {
    super(`Too many interpretations (${count} > ${max})`, input);
    this.name = "TooAmbiguousError";
    this.count = count;
  }
}

/**
 * These last two are configuration errors rather than input errors, but they
 * still extend SmartputError: the facade throws KindConflictError at runtime
 * (an affine kind whose delta kind has no facade), so a consumer's
 * `instanceof SmartputError` guard has to catch them. There is no source
 * expression to report, so `input` carries the offending id instead.
 */
export class KindConflictError extends SmartputError {
  readonly kind: KindId;
  constructor(id: string, detail: string) {
    super(`Kind ${JSON.stringify(id)} conflicts: ${detail}`, id);
    this.name = "KindConflictError";
    this.kind = id;
  }
}

export class UnknownKindError extends SmartputError {
  readonly pack: string;
  readonly kind: KindId;
  readonly unit: string | undefined;
  constructor(pack: string, kind: KindId, unit?: string) {
    const where = unit === undefined ? "" : `, unit ${JSON.stringify(unit)}`;
    super(
      `Locale pack ${JSON.stringify(pack)} contributes to unregistered kind ${JSON.stringify(kind)}${where}`,
      pack,
    );
    this.name = "UnknownKindError";
    this.pack = pack;
    this.kind = kind;
    this.unit = unit;
  }
}

export class DivideByZeroError extends SmartputError {
  constructor(input: string) {
    super("Division by zero", input);
    this.name = "DivideByZeroError";
  }
}

/**
 * A rate provider could not produce a usable snapshot: the request failed, or
 * the payload carried no date or no quotes. Like the two configuration errors
 * above, it still extends SmartputError — `instanceof SmartputError` is the
 * discriminator this codebase's own engine branches on, so an error that does
 * not extend it is invisible to every consumer that follows the convention.
 * There is no source expression, so `input` carries the provider id.
 */
export class RateProviderError extends SmartputError {
  readonly provider: string;
  constructor(provider: string, detail: string) {
    super(`Rate provider ${JSON.stringify(provider)} failed: ${detail}`, provider);
    this.name = "RateProviderError";
    this.provider = provider;
  }
}

/** Rates were asked for before any snapshot had been fetched. */
export class RatesNotReadyError extends SmartputError {
  constructor(detail: string) {
    super(`No rates available: ${detail}`, "");
    this.name = "RatesNotReadyError";
  }
}

export class MissingRateError extends SmartputError {
  readonly from: string;
  readonly to: string;
  readonly asOf: string;
  constructor(input: string, from: string, to: string, asOf: string) {
    super(`No rate for ${from}->${to} in the snapshot as of ${asOf}`, input);
    this.name = "MissingRateError";
    this.from = from;
    this.to = to;
    this.asOf = asOf;
  }
}

/**
 * A vocabulary handed to `composeLocale` for a language that is not its own.
 * Same philosophy as `KindConflictError`: a bad configuration fails on boot,
 * where the stack names the line that wired it, and never at a keystroke.
 */
export class LocaleMismatchError extends SmartputError {
  readonly locale: string;
  readonly vocabularyLocale: string;
  readonly kind: KindId;
  constructor(locale: string, vocabularyLocale: string, kind: KindId) {
    super(
      `Locale ${JSON.stringify(locale)} was given a ${JSON.stringify(vocabularyLocale)} vocabulary for kind ${JSON.stringify(kind)}`,
      locale,
    );
    this.name = "LocaleMismatchError";
    this.locale = locale;
    this.vocabularyLocale = vocabularyLocale;
    this.kind = kind;
  }
}

/** Two vocabularies for one kind in one language. Names both by kind and locale. */
export class VocabularyConflictError extends SmartputError {
  readonly locale: string;
  readonly kind: KindId;
  constructor(locale: string, kind: KindId) {
    super(
      `Locale ${JSON.stringify(locale)} has two vocabularies for kind ${JSON.stringify(kind)}`,
      locale,
    );
    this.name = "VocabularyConflictError";
    this.locale = locale;
    this.kind = kind;
  }
}

/**
 * One spelling that two installed languages read as two *different*
 * connectives — "do" meaning `in` in one and `of` in another. Recognition is
 * many-locale, so both tables feed one lexer, and a word the lexer cannot
 * assign a single meaning to has no reading the parser could rank: the two
 * readings differ in grammar, not in weight.
 *
 * The same keyword in several languages is not a conflict and is the common
 * case — English and Ukrainian both spell `in` with their own words, and two
 * Slavic languages sharing "в" for it should compose without comment.
 *
 * Raised from `buildKeywords`, i.e. once at `createEngine`, on the same
 * philosophy as `LocaleMismatchError`: a bad configuration fails on boot,
 * where the stack names the line that wired the languages together, and never
 * at a keystroke (I9). All four facts are in the message because a reader
 * needs every one of them to decide which language should give the word up.
 */
export class KeywordConflictError extends SmartputError {
  readonly surface: string;
  readonly keywords: readonly [Keyword, Keyword];
  readonly locales: readonly [string, string];
  constructor(
    surface: string,
    keywords: readonly [Keyword, Keyword],
    locales: readonly [string, string],
  ) {
    super(
      `${JSON.stringify(surface)} means ${JSON.stringify(keywords[0])} in ${JSON.stringify(locales[0])} and ${JSON.stringify(keywords[1])} in ${JSON.stringify(locales[1])}`,
      surface,
    );
    this.name = "KeywordConflictError";
    this.surface = surface;
    this.keywords = keywords;
    this.locales = locales;
  }
}

/**
 * A "how many X in a Y" reading that has no answer, because fewer than one X
 * fits inside one Y — "hours in minute", "kilograms in gram".
 *
 * The reading itself is real: a plural unit word, `in`, a singular unit word,
 * and no count anywhere is English asking how many of the first fit in one of
 * the second (`eval/count.ts` is where that is decided). What makes this an
 * error rather than a fraction is that the question is only ever asked the
 * way round that has a whole answer. Nobody types "hours in minute" meaning
 * 0.017 hours; they have written the two units the wrong way round, and
 * answering anything hides that. The mirrored spelling — "hour in minutes" —
 * is a plain conversion and still resolves.
 */
export class CountQueryError extends SmartputError {
  readonly kind: KindId;
  /** The unit being counted — the plural word's unit, the one on the left. */
  readonly unit: string;
  /** The unit one of which was to hold them — the singular word's, on the right. */
  readonly per: string;
  /** The two words as typed, which is what the message quotes. */
  readonly unitWord: string;
  readonly perWord: string;
  constructor(
    input: string,
    kind: KindId,
    unit: string,
    per: string,
    unitWord: string,
    perWord: string,
  ) {
    super(
      `${JSON.stringify(input)} counts ${unitWord} inside one ${perWord}, and fewer than one fits. Did you mean ${JSON.stringify(`${perWord} in ${unitWord}`)}?`,
      input,
    );
    this.name = "CountQueryError";
    this.kind = kind;
    this.unit = unit;
    this.per = per;
    this.unitWord = unitWord;
    this.perWord = perWord;
  }
}
