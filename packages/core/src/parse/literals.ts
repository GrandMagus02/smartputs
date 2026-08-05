import type { Registry } from "../kind/registry";
import type { LiteralMatch, MatchCtx } from "../types";
import type { Token } from "./lex";

/**
 * The third token pass, and the only one that can see the source string.
 *
 * `foldNumerals` and `foldWordOps` rewrite words the lexer already produced;
 * this one asks each registered kind whether it wants a run of *characters*
 * starting at a token boundary. That is what a date needs — "next week monday"
 * is three tokens and "2026-01-15" is five — and it is the reason a matcher
 * takes an offset rather than a token index.
 *
 * Runs before the other two passes: chrono handles its own spelled numerals,
 * and a matcher reads the untouched input regardless, so folding numbers first
 * would only risk a number token being half-claimed.
 */
export function foldLiterals(
  tokens: Token[],
  input: string,
  registry: Registry,
  ctx: MatchCtx,
): Token[] {
  if (registry.literals.length === 0) return tokens;

  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) break;

    let best: { match: LiteralMatch; end: number; through: number } | null = null;

    for (const { matcher } of registry.literals) {
      const match = matcher(input, token.start, ctx);
      if (match === null || match.length <= 0) continue;

      // A unit the kind does not register would resolve to no lexeme and no
      // `in` target, so it is a plugin bug. Dropping the match keeps the
      // ordinary reading of the text rather than producing a half-value.
      if (registry.kinds.get(match.kind)?.units.has(match.unit) !== true) continue;

      const end = token.start + match.length;
      // The match must stop exactly where some token stops. Splitting a token
      // would leave a fragment no lexer rule produced.
      let through = -1;
      for (let j = i; j < tokens.length; j += 1) {
        const candidate = tokens[j];
        if (candidate === undefined || candidate.end > end) break;
        if (candidate.end === end) through = j;
      }
      if (through === -1) continue;

      if (best === null || end > best.end) best = { match, end, through };
    }

    if (best === null) {
      out.push(token);
      i += 1;
      continue;
    }

    const { match, end, through } = best;
    out.push({
      type: "literal",
      kind: match.kind,
      unit: match.unit,
      canonical: match.canonical,
      ...(match.meta ? { meta: match.meta } : {}),
      weight: match.weight ?? 0,
      text: input.slice(token.start, end),
      start: token.start,
      end,
    });
    i = through + 1;
  }

  return out;
}
