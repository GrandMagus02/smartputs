import { NoCandidateError, UnitParseError } from "../errors";
import type { OpSymbol, Span } from "../types";
import type { Node } from "./ast";
import type { Resolver } from "./candidates";
import type { Token } from "./lex";

const BINDING: Record<Exclude<OpSymbol, "in">, number> = {
  "+": 10,
  "-": 10,
  // Between + and *: "50 + 20% of 100" is 50 + (20% of 100). The lexer does
  // not yet produce an "of" op token (that lands with the parser support in
  // a later task) — this entry exists so OpSymbol's exhaustiveness check
  // here is satisfied now that Task 1's percent generation needs "of" on
  // OpSymbol.
  of: 15,
  "*": 20,
  "/": 20,
};
const CONVERT_BINDING = 5;

export function parse(tokens: Token[], resolver: Resolver, input: string): Node {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const span = (a: Span, b: Span): Span => ({ start: a.start, end: b.end });

  function parseAtom(): Node {
    const token = peek();
    if (token === undefined) throw new UnitParseError(input);

    if (token.type === "lparen") {
      pos += 1;
      const inner = parseExpr(0);
      const close = peek();
      if (close === undefined || close.type !== "rparen") throw new UnitParseError(input);
      pos += 1;
      return inner;
    }

    if (token.type === "op" && token.op === "-") {
      pos += 1;
      const operand = parseExpr(30);
      return { type: "unary", op: "-", operand, span: span(token, operand.span) };
    }

    if (token.type === "number") {
      pos += 1;
      const next = peek();
      if (next !== undefined && next.type === "word") {
        const candidates = resolver.resolve(next.text);
        if (candidates.length === 0) {
          throw new NoCandidateError(input, next.text, resolver.nearest(next.text), [
            next,
          ]);
        }
        pos += 1;
        return {
          type: "quantity",
          value: token.value,
          candidates,
          span: span(token, next),
        };
      }
      return {
        type: "number",
        value: token.value,
        span: { start: token.start, end: token.end },
      };
    }

    throw new UnitParseError(input);
  }

  function parseExpr(minBinding: number): Node {
    let left = parseAtom();

    for (;;) {
      const token = peek();
      if (token === undefined) break;

      if (
        token.type === "keyword" &&
        (token.keyword === "in" || token.keyword === "to" || token.keyword === "as")
      ) {
        if (CONVERT_BINDING < minBinding) break;
        pos += 1;
        const unit = peek();
        if (unit === undefined || unit.type !== "word") throw new UnitParseError(input);
        const target = resolver.resolve(unit.text);
        if (target.length === 0) {
          throw new NoCandidateError(input, unit.text, resolver.nearest(unit.text), [
            unit,
          ]);
        }
        pos += 1;
        left = { type: "convert", operand: left, target, span: span(left.span, unit) };
        continue;
      }

      if (token.type !== "op") break;
      const binding = BINDING[token.op as Exclude<OpSymbol, "in">];
      if (binding === undefined || binding < minBinding) break;

      pos += 1;
      const right = parseExpr(binding + 1);
      left = {
        type: "binary",
        op: token.op as Exclude<OpSymbol, "in">,
        left,
        right,
        span: span(left.span, right.span),
      };
    }

    return left;
  }

  const node = parseExpr(0);
  if (pos !== tokens.length) throw new UnitParseError(input);
  return node;
}
