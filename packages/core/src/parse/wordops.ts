import type { Keyword, OpSymbol } from "../types";
import type { Token } from "./lex";

/**
 * Core, not locale data: "plus" means addition in every language that has the
 * concept. Only the surface words vary, and those live in `locale.keywords`.
 */
const KEYWORD_OPS: Partial<Record<Keyword, OpSymbol>> = {
  plus: "+",
  minus: "-",
  times: "*",
  over: "/",
};

/**
 * Rewriting to op tokens before parsing is what lets word operators inherit the
 * parser's existing precedence table and its unary-minus branch, rather than
 * needing a second table kept in sync with the first.
 */
export function foldWordOps(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i] as Token;
    const op = token.type === "keyword" ? KEYWORD_OPS[token.keyword] : undefined;

    if (op === undefined) {
      out.push(token);
      i += 1;
      continue;
    }

    // "divided by" and "multiplied by" are one operator. A "by" anywhere else
    // is left alone and fails at the parser, exactly as a stray "as" does.
    const next = tokens[i + 1];
    const phrasal = next !== undefined && next.type === "keyword" && next.keyword === "by";

    out.push({
      type: "op",
      op,
      start: token.start,
      end: phrasal ? (next as Token).end : token.end,
    });
    i += phrasal ? 2 : 1;
  }

  return out;
}
