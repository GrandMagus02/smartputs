import { CURRENCIES } from "./currencies";

/**
 * Currency recognition without an engine, spec §3's micro path applied to the
 * one kind that could never take the ordinary version of it.
 *
 * `@smartput/validate`'s `UnitTable` requires a ratio per unit, and money's
 * ratios are a live rate table — which is why `@smartput/rate` is exempt from
 * `./units` and `./validate` and why a `parseMoney` that also *converted* would
 * be a lie. What is left once conversion is removed is still most of what a
 * form field wants: which currency is this, how much is it, and how do I print
 * it back. None of those need a rate, and none of them need the engine.
 *
 * So this file parses and `format.ts` renders, and neither can convert. The
 * moment you want `30 usd in gbp` you want a snapshot, and that is
 * `@smartput/rate`.
 */

/** Lowercase ISO code -> itself, plus every alias the shipped table carries. */
const BY_ALIAS = new Map<string, string>();
for (const [code, def] of Object.entries(CURRENCIES)) {
  BY_ALIAS.set(code, code);
  for (const alias of def.aliases) BY_ALIAS.set(alias.toLowerCase(), code);
  for (const word of Object.values(def.display ?? {})) {
    BY_ALIAS.set(word.toLowerCase(), code);
  }
}

/**
 * Symbols longest-first, so `CA$` and `A$` are tried before the bare `$` they
 * both end with — first match wins and a shorter prefix would swallow them.
 *
 * Two symbols in the shipped table are genuinely shared with currencies that
 * are not in it: `kr` is Swedish, Norwegian and Danish, and `$` is a dozen
 * dollars. They resolve to the row this table holds — SEK and USD — which is a
 * choice and not a fact, and the reason symbols are opt-in below.
 */
const SYMBOLS: ReadonlyArray<readonly [string, string]> = Object.entries(CURRENCIES)
  .map(([code, def]) => [def.symbol.toLowerCase(), code] as const)
  .sort((a, b) => b[0].length - a[0].length);

/**
 * The ISO code a word names, or `null`.
 *
 * Case-insensitive and trimmed. Reads exactly the aliases and display forms the
 * kind registers before any locale pack — so `usd`, `dollar` and `dollars`
 * resolve and `quid` does not, because `quid` arrives with
 * `@smartput/rate/locale/en` and a pack is something a consumer chose. A parser
 * that knew a word the engine had not been given would be the more confusing of
 * the two disagreements.
 */
export function parseCurrency(word: string): string | null {
  return BY_ALIAS.get(word.trim().toLowerCase()) ?? null;
}

/** Whether `word` names a currency this table carries. */
export function isCurrency(word: string): boolean {
  return parseCurrency(word) !== null;
}

/**
 * A parsed amount.
 *
 * `amount` is a plain `number` and `raw` is the digits exactly as authored,
 * which is the shape `@smartput/shared`'s own `Ok` carries and for the same
 * reason: a `Decimal` in the return type would put core's 28-digit constructor
 * in the graph of every field that only wanted to know whether the input was
 * valid, and cost 35 KB to do it. Hand `raw` to a `Decimal` when you need the
 * arithmetic to be exact — `new Decimal(parsed.raw)` — and read `amount` when
 * you need a number.
 */
export interface ParsedAmount {
  readonly ok: true;
  readonly amount: number;
  /** Lowercase ISO 4217. */
  readonly currency: string;
  /** The digits as written, separators removed. Feed this to a `Decimal`. */
  readonly raw: string;
}

export type AmountError =
  /** Input was empty or whitespace only. */
  | "empty"
  /** No number could be read. */
  | "nan"
  /** A number was read and no currency followed it. */
  | "missing-currency"
  /** The word after the number names no currency in this table. */
  | "unknown-currency"
  /** Input continued past the currency. */
  | "trailing";

export interface AmountFailure {
  readonly ok: false;
  readonly code: AmountError;
  readonly input: string;
}

export type ParsedInput = ParsedAmount | AmountFailure;

export interface AmountOptions {
  /**
   * Read a leading or trailing symbol — `$30`, `30 €` — as its currency.
   * Default `false`.
   *
   * Off by default because it is the one place this parser can be *wider* than
   * the engine: `evaluate("$30")` is the number 30, since a symbol is not a
   * registered alias and reading it as one would make every `$` in an
   * expression a unit claim. A form field has no number kind to lose the token
   * to, so there the wider reading is the useful one — but it has to be asked
   * for, or the two paths would disagree about the same string by default.
   */
  readonly symbols?: boolean;
}

const NUMBER = /^[+-]?(?:\d[\d,_]*)?(?:\.\d+)?(?:[eE][+-]?\d+)?/;

/** The digits with grouping removed, or `null` when they are not a number. */
function digitsOf(raw: string): string | null {
  const cleaned = raw.replaceAll(",", "").replaceAll("_", "");
  if (cleaned === "" || cleaned === "+" || cleaned === "-" || cleaned === ".")
    return null;
  return Number.isFinite(Number(cleaned)) ? cleaned : null;
}

function symbolAt(text: string): readonly [string, string] | null {
  const lower = text.toLowerCase();
  for (const [symbol, code] of SYMBOLS) {
    if (lower.startsWith(symbol)) return [symbol, code] as const;
  }
  return null;
}

/**
 * `"30 usd"`, `"1,250.50 dollars"`, `"-4 eur"` — a number and the currency it
 * is in, in the order the engine reads them.
 *
 * Amount first is not a style choice: `evaluate("usd 30")` throws, because a
 * unit is written after its quantity, so accepting the reverse here would make
 * this parser accept strings the engine refuses. With `symbols: true` a symbol
 * may lead — `$30` — which is the shape nobody writes the other way round.
 */
export function parseAmount(input: string, opts: AmountOptions = {}): ParsedInput {
  const text = input.trim();
  if (text === "") return { ok: false, code: "empty", input };

  let rest = text;
  let leading: string | null = null;

  if (opts.symbols === true) {
    const found = symbolAt(rest);
    if (found !== null) {
      leading = found[1];
      rest = rest.slice(found[0].length).trimStart();
    }
  }

  const matched = NUMBER.exec(rest)?.[0] ?? "";
  const digits = digitsOf(matched);
  if (digits === null) return { ok: false, code: "nan", input };
  const amount = Number(digits);

  rest = rest.slice(matched.length).trim();

  if (rest === "") {
    if (leading !== null) {
      return { ok: true, amount, currency: leading, raw: digits };
    }
    return { ok: false, code: "missing-currency", input };
  }

  // A trailing symbol is read on the same opt-in as a leading one, and only
  // when it is the whole of what is left — `30 €` yes, `30 € each` no.
  if (opts.symbols === true) {
    const found = symbolAt(rest);
    if (found !== null && rest.length === found[0].length) {
      return { ok: true, amount, currency: found[1], raw: digits };
    }
  }

  const currency = parseCurrency(rest);
  if (currency === null) {
    // A word that is not a currency and a word that is a currency followed by
    // more text are different mistakes, and a form telling them apart can say
    // "we do not know that currency" instead of "check your input".
    const head = rest.split(/\s+/)[0] ?? rest;
    return {
      ok: false,
      code: parseCurrency(head) === null ? "unknown-currency" : "trailing",
      input,
    };
  }

  // A leading symbol and a trailing word that disagree — "$30 eur" — is the
  // trailing word's answer: it is the more explicit of the two, and it is the
  // one the engine would have read.
  return { ok: true, amount, currency, raw: digits };
}
