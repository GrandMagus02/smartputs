import type { Registry } from "../kind/registry";
import type { LiteralMatch, LiteralReading, MatchCtx } from "../types";
import type { NumberToken, Token, WordToken } from "./lex";

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
 *
 * The fold is a *grouping*, not a choice. Every match that reaches the furthest
 * end travels on together, from every kind rather than from the first one to
 * register, and a claim over a single token keeps that token beside them. What
 * gets chosen and what merely gets ranked is the solver's business, which is
 * where a word token's readings have always been settled.
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

    let best: { end: number; through: number; readings: LiteralReading[] } | null = null;

    for (const { matcher } of registry.literals) {
      const result = matcher(input, token.start, ctx);
      if (result === null) continue;

      for (const match of Array.isArray(result)
        ? (result as readonly LiteralMatch[])
        : [result as LiteralMatch]) {
        if (match.length <= 0) continue;

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

        const reading: LiteralReading = {
          kind: match.kind,
          unit: match.unit,
          canonical: match.canonical,
          ...(match.meta ? { meta: match.meta } : {}),
          weight: match.weight ?? 0,
          ...(match.targetable ? { targetable: true } : {}),
        };

        // Longest still wins, and readings of a shorter span are dropped rather
        // than ranked below it: they describe different text. Only a tie on the
        // end joins the group, which is what lets two kinds share one token.
        if (best === null || end > best.end) best = { end, through, readings: [reading] };
        else if (end === best.end) best.readings.push(reading);
      }
    }

    if (best === null) {
      out.push(token);
      i += 1;
      continue;
    }

    // `through === i` is "the claim covered this token and no other", which is
    // the only case with an ordinary reading left to keep. A number or a word is
    // all that has one: an op or a paren means nothing on its own, and a keyword
    // read as a value is what the claim was made to override.
    const single =
      best.through === i && (token.type === "number" || token.type === "word")
        ? (token as NumberToken | WordToken)
        : undefined;

    out.push({
      type: "literal",
      readings: best.readings,
      ...(single ? { fallback: single } : {}),
      text: input.slice(token.start, best.end),
      start: token.start,
      end: best.end,
    });
    i = best.through + 1;
  }

  return out;
}
