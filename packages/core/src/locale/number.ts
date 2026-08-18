import { Decimal } from "../decimal";
import type { Language, Locale, NumberFormatSpec } from "../types";

const cache = new Map<string, NumberFormatSpec>();

export function numberSymbols(language: Language): NumberFormatSpec {
  if (language.numberFormat !== "intl") return language.numberFormat;

  const hit = cache.get(language.id);
  if (hit !== undefined) return hit;

  const parts = new Intl.NumberFormat(language.id).formatToParts(1234567.5);
  const spec: NumberFormatSpec = {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
  cache.set(language.id, spec);
  return spec;
}

/**
 * One number grammar: a `(group, decimal)` pair, and the installed locales that
 * read digits with it.
 *
 * A grammar rather than a language because reading is many-to-one — `en`, `ja`,
 * `zh`, `hi`, `id` and `ko` all group with "," and point with "." — and the
 * lexer scans a digit run once per *grammar*. Seventeen installed languages
 * collapse to three or four of these, which is what keeps the per-grammar scan
 * from being a per-language one.
 */
export interface Grammar {
  readonly group: string;
  readonly decimal: string;
  /** Locale ids whose `numberFormat` is this pair. Sorted, so a reading is stable. */
  readonly locales: readonly string[];
}

/**
 * The distinct `(group, decimal)` pairs among the installed locales, each
 * tagged with the locale ids that use it.
 *
 * Deterministic in both axes, because a `NumberReading` built from one is a
 * public output and a set iteration order is not a contract: pairs come out in
 * first-installed order, locale ids sorted inside each.
 *
 * Tagged with the *locale* id and not the language id, because the id a reading
 * carries has to be the same id a unit candidate carries — `Candidate.locale`
 * is what a number reading is later ranked for agreement against, and that is
 * `Locale.id`.
 */
export function grammarsFor(locales: readonly Locale[]): Grammar[] {
  const byPair = new Map<string, { group: string; decimal: string; locales: string[] }>();
  for (const locale of locales) {
    const { group, decimal } = numberSymbols(locale.language);
    const key = `${group}\u0000${decimal}`;
    const hit = byPair.get(key);
    if (hit === undefined) byPair.set(key, { group, decimal, locales: [locale.id] });
    else if (!hit.locales.includes(locale.id)) hit.locales.push(locale.id);
  }
  return [...byPair.values()].map((pair) => ({
    group: pair.group,
    decimal: pair.decimal,
    locales: pair.locales.sort(),
  }));
}

/**
 * @param grammar A `Language`, whose `numberFormat` names the pair, or a
 * `Grammar` that already is one. The second form is what `lex`'s per-grammar
 * scan passes, so it does not have to synthesise a fake language to read a run
 * under a locale other than the format one; the first is what `numerals.ts`,
 * the completer and `facade/quantity.ts` have always passed and keeps working
 * unchanged.
 */
export function parseNumber(text: string, grammar: Language | Grammar): Decimal | null {
  const { group, decimal } = "numberFormat" in grammar ? numberSymbols(grammar) : grammar;
  // A language whose separator is a non-breaking space also has to accept the
  // plain one: `normalize()` folds every whitespace run before `lex()` runs, so
  // "2\u00A0000" \u2014 this language's own printed output \u2014 reaches here as "2 000".
  // Gated on the separator rather than unconditional, because for `en` a space
  // inside a number is a word boundary and "1 500" must stay unparseable.
  const groupIsSpaceLike = /\s/.test(group);
  let cleaned = "";
  for (const ch of text) {
    // Escapes, not literals: NBSP and narrow NBSP are invisible in source and
    // silently degrade to a plain space when retyped. French ICU uses U+202F as
    // its group separator, so this is load-bearing, not defensive padding.
    if (ch === group || ch === "\u00A0" || ch === "\u202F") continue;
    if (groupIsSpaceLike && ch === " ") continue;
    cleaned += ch === decimal ? "." : ch;
  }
  if (cleaned.length === 0 || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  try {
    return new Decimal(cleaned);
  } catch {
    return null;
  }
}
