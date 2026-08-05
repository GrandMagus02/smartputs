import { NoCandidateError, UnitParseError } from "../errors";
import type { OpSymbol, Span } from "../types";
import type { Node } from "./ast";
import type { Resolver } from "./candidates";
import type { Token } from "./lex";

const BINDING: Record<Exclude<OpSymbol, "in">, number> = {
  "+": 10,
  "-": 10,
  // Between + and *: "50 + 20% of 100" is 50 + (20% of 100). "of" arrives as
  // a *keyword* token, not an op token, so parseExpr reads this binding from
  // its own branch below rather than from the `token.op` lookup.
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

    if (token.type === "literal") {
      pos += 1;
      return {
        type: "literal",
        value: Object.freeze({
          kind: token.kind,
          canonical: token.canonical,
          unit: token.unit,
          ...(token.meta ? { meta: token.meta } : {}),
        }),
        candidates: [
          resolver.literal({
            kind: token.kind,
            unit: token.unit,
            surface: token.text,
            weight: token.weight,
          }),
        ],
        span: { start: token.start, end: token.end },
      };
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

      // "to" and "as" arrive here as `in` too: a locale lists them as aliases
      // under its `in` key, and keywordFor returns the key, never the alias.
      if (token.type === "keyword" && token.keyword === "in") {
        if (CONVERT_BINDING < minBinding) break;
        pos += 1;
        const unit = peek();
        if (unit === undefined) throw new UnitParseError(input);

        // A kind claimed the target and marked the claim targetable: "japan to
        // ukraine", "3pm in japan". The matcher already built the Value and
        // already named a registered unit, so there is nothing to resolve — and
        // the Value travels on the node, because the signature that receives it
        // reads its `meta`.
        //
        // `targetable` is checked rather than `type === "literal"` alone. Every
        // literal is a value, but only some values are conversion *targets*:
        // datetime claims "tomorrow", and accepting that here made
        // `today in tomorrow` a zone conversion returning today, where it had
        // always thrown. A literal that does not opt in falls through to the
        // UnitParseError below, exactly as before.
        if (unit.type === "literal" && unit.targetable === true) {
          pos += 1;
          left = {
            type: "convert",
            operand: left,
            target: [
              resolver.literal({
                kind: unit.kind,
                unit: unit.unit,
                surface: unit.text,
                weight: unit.weight,
              }),
            ],
            targetValue: Object.freeze({
              kind: unit.kind,
              canonical: unit.canonical,
              unit: unit.unit,
              ...(unit.meta ? { meta: unit.meta } : {}),
            }),
            span: span(left.span, unit),
            targetSpan: { start: unit.start, end: unit.end },
          };
          continue;
        }

        if (unit.type !== "word") throw new UnitParseError(input);
        const target = resolver.resolve(unit.text);
        if (target.length === 0) {
          throw new NoCandidateError(input, unit.text, resolver.nearest(unit.text), [
            unit,
          ]);
        }
        pos += 1;
        left = {
          type: "convert",
          operand: left,
          target,
          span: span(left.span, unit),
          targetSpan: { start: unit.start, end: unit.end },
        };
        continue;
      }

      if (token.type === "keyword" && token.keyword === "of") {
        const binding = BINDING.of;
        if (binding < minBinding) break;
        pos += 1;
        const right = parseExpr(binding + 1);
        left = {
          type: "binary",
          op: "of",
          left,
          right,
          span: span(left.span, right.span),
        };
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
