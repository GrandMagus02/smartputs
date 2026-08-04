import type { Decimal } from "../decimal";
import { parseNumber } from "../locale/number";
import type { Locale, Span } from "../types";

export interface Fragment {
  text: string;
  span: Span;
}

/**
 * Must begin with a letter, may continue with letters or digits. The leading
 * letter is what keeps a bare "30" from reading as a fragment; allowing digits
 * after it is what keeps M2's `m2`, `cm2` and `km2` completable.
 */
const FRAGMENT = /[\p{L}][\p{L}\p{N}]*$/u;

/**
 * A run that could hold a number: digits, sign, decimal and group separators.
 * \u00A0 and \u202F are written as escapes deliberately - French ICU uses
 * U+202F as its group separator, and a literal would be invisible in source.
 */
const COUNT_RUN = /[-\d.,\u00A0\u202F ]+$/;

export function trailingFragment(input: string): Fragment | null {
  const match = FRAGMENT.exec(input);
  if (match === null) return null;
  return {
    text: match[0],
    span: { start: match.index, end: match.index + match[0].length },
  };
}

export function leadingCount(
  input: string,
  upto: number,
  locale: Locale,
): Decimal | null {
  const match = COUNT_RUN.exec(input.slice(0, upto));
  if (match === null) return null;
  const run = match[0].trim();

  // Try the whole run first: a locale whose group separator is a space needs
  // "1 500,5" kept intact. Fall back to the last whitespace-delimited token,
  // which is what strips a binary operator's minus in "10 kg - 5 mil".
  const whole = parseNumber(run, locale);
  if (whole !== null) return whole;

  const last = run.split(/\s+/).pop();
  return last === undefined ? null : parseNumber(last, locale);
}
